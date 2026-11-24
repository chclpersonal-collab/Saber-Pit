import assert from 'node:assert/strict';
import test from 'node:test';
import {createArcadeFloatingText} from '../dist/arcade-floating-text.js';

const roster=Array.from({length:30},(_,i)=>({id:'f'+i,x:70+i%6*182,y:i<6?155:i<12?445:690,control:i===29}));
const events=(kinds:readonly string[],from=1)=>kinds.map((kind,i)=>({id:from+i,kind,region:'head',fighterId:roster[i].id,x:roster[i].x,y:roster[i].y}));
type Captions=ReturnType<typeof createArcadeFloatingText>;
function render(captions:Captions) {
  const drawn:{text:string;x:number;y:number;alpha:number}[]=[];
  const ctx={globalAlpha:1,save(){},restore(){},strokeText(){},
    fillText(text:string,x:number,y:number){drawn.push({text,x,y,alpha:this.globalAlpha});}
  } as unknown as CanvasRenderingContext2D;
  captions.draw(ctx,{reducedMotion:true});return drawn;
}
const draw=(captions:Captions)=>render(captions).map(({text})=>text);
const at=(id:number,kind:string,index:number)=>{
  const f=roster[index];return {id,kind,region:'head',fighterId:f.id,x:f.x,y:f.y};
};
test('real floating update/draw keeps all simultaneous KO and parry counts before the generic budget',()=>{
  const captions=createArcadeFloatingText();
  const batch=events([...Array(6).fill('ko'),...Array(6).fill('parry')]);
  const player={id:13,kind:'parry',fighterId:roster.at(-1)!.id};
  captions.update(.01,[...batch,player],roster);
  assert.deepEqual(new Set(draw(captions)),new Set(['KO ×6','PARRY ×6','PARRY']));
  captions.update(.01,[...batch,player],roster);
  assert.deepEqual(new Set(draw(captions)),new Set(['KO ×6','PARRY ×6','PARRY']),'historical events do not count again');
  captions.update(.01,events(['ko','ko'],14),roster);
  assert.ok(draw(captions).includes('KO ×8'),'two updates preserve the aggregate');
  for(let i=0;i<6;i++)captions.update(.25,[],roster);
  assert.deepEqual(draw(captions),[]);
});
test('eight concurrent KOs or parries are not truncated to six',()=>{
  for(const [kind,title] of [['ko','KO'],['parry','PARRY']]){
    const captions=createArcadeFloatingText();
    captions.update(.01,events(Array(8).fill(kind)),roster);
    assert.deepEqual(draw(captions),[title+' ×8']);
  }
});

test('a fresh same-family cue at 830 ms rolls out of a fading window and receives a readable full lifetime',()=>{
  for(const kind of ['parry','ko']){
    const captions=createArcadeFloatingText();
    captions.update(0,[at(1,kind,0)],roster);
    for(let i=0;i<3;i++)captions.update(.25,[],roster);
    captions.update(.08,[at(2,kind,4),at(3,kind,5)],roster);
    assert.deepEqual(render(captions),[{
      text:kind.toUpperCase()+' ×2',x:roster[4].x,y:roster[4].y-83,alpha:1,
    }]);
    captions.update(.20,[],roster);
    assert.equal(render(captions)[0]?.alpha,1,'fresh arrivals must outlast the older caption');
  }
});

test('rollover is independently counted for simultaneous KO, crowd parry, and anchored focus parry',()=>{
  const captions=createArcadeFloatingText(),player=roster.length-1;
  captions.update(0,[at(1,'parry',0)],roster);
  captions.update(.23,[],roster);
  captions.update(.20,[at(2,'ko',6),at(3,'parry',player)],roster);
  captions.update(.25,[],roster);
  captions.update(.15,[at(4,'parry',1),at(5,'parry',2),at(6,'ko',7),at(7,'parry',player)],roster);
  const cues=render(captions);
  assert.equal(cues.length,3);
  assert.ok(cues.some(c=>c.text==='PARRY ×2'&&c.x===roster[player].x&&c.alpha===1),'focus remains its own anchored window');
  assert.ok(cues.some(c=>c.text==='PARRY ×2'&&c.x===roster[1].x&&c.alpha===1),'only the expired crowd window rolled');
  assert.ok(cues.some(c=>c.text==='KO ×2'&&c.x===roster[6].x&&c.alpha===1),'ongoing KO window remains intact');
});

test('continuous events keep three rendered buckets and account for every event across bounded windows',()=>{
  const captions=createArcadeFloatingText(),player=roster.length-1;
  const counts=[0,0,0],peaks=[0,0,0],retired=[0,0,0];
  for(let n=0;n<120;n++){
    const frame=[at(n*3+1,'ko',6),at(n*3+2,'parry',0),at(n*3+3,'parry',player)];
    assert.equal(captions.update(.1,frame,roster),3,'do not retain stale bucket copies');
    const cues=render(captions);
    assert.equal(cues.length,3,'crowd and local counts stay within the board budget');
    for(const cue of cues){
      const type=cue.text.startsWith('KO')?0:cue.x===roster[player].x?2:1;
      const count=Number(cue.text.split('×')[1]??1);
      assert.ok(cue.alpha>=.9,'new events never inherit an almost invisible caption');
      if(count===1)retired[type]+=counts[type];
      else assert.equal(count,counts[type]+1,'exactly one fresh event in this bucket');
      counts[type]=count;peaks[type]=Math.max(peaks[type],count);
    }
  }
  for(let i=0;i<3;i++){
    assert.equal(retired[i]+counts[i],120,'no dropped or double-counted arrivals');
    assert.ok(peaks[i]<=8,'a flood must roll windows over instead of renewing them indefinitely');
  }
  for(let i=0;i<5;i++)captions.update(.25,[],roster);
  assert.deepEqual(draw(captions),[]);
});
