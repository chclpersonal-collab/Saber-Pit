/** Headless pose audit with no renderer or engine mutations.
 * node build/scripts/audit-arcade-multiblade-visuals.mjs [new arena-fighters.js] [old arena-fighters.js]
 */
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const args=process.argv.slice(2);
const target=args[0]?pathToFileURL(resolve(args[0])):new URL('../dist/arcade-fighters.js',import.meta.url);
const before=args[1]?pathToFileURL(resolve(args[1])):null;
const revision=await import(target);
const reference=before?await import(before):null;
const repertoire=await import(new URL('./arcade-repertoire.js',before??target));
const forms=['shii_cho','makashi','soresu','ataru','djem_so','niman','juyo'];
const kits={
  staff:{weapon:'staff',grip:'forward'},
  dualForward:{weapon:'dual',grip:'forward',dualSabers:true},
  dualReverse:{weapon:'dual',grip:'backhand',dualSabers:true},
  singleForward:{weapon:'single',grip:'forward'},
  singleReverse:{weapon:'single',grip:'backhand'},
};
const step=1/240;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const point=(x,y)=>({x,y});
const vector=(a,b)=>point(b.x-a.x,b.y-a.y);
const dot=(a,b)=>a.x*b.x+a.y*b.y;
const norm=v=>Math.hypot(v.x,v.y);
const turn=(a,b)=>Math.acos(Math.max(-1,Math.min(1,dot(a,b)/(norm(a)*norm(b)||1))))*180/Math.PI;
const round=(n,p=3)=>Number.isFinite(n)?Number(n.toFixed(p)):null;
const q=(xs,p)=>round([...xs].sort((a,b)=>a-b)[Math.floor((xs.length-1)*p)]);
const expectedIds=key=>key==='staff'?['main','rear']:key.startsWith('dual')?['main','off']:['main'];
const signedCore=(f,blade)=>(blade.tip.x-blade.hand.x)*Math.sign(Math.cos(f.face));
const channels=(r,w)=>({wrist:r.hand,offWrist:r.backHand,primary:w.blades[0].tip,
  ...(w.blades[1]?{secondary:w.blades[1].tip}:{}),head:r.head});
const poses=(model,f,time=0,options)=>{
  const r=model.sampleArcadeFighter(f,time,options),w=model.arcadeBladeWorld(f,r);
  return {r,w,k:channels(r,w)};
};
function clips(form,kit){
  const base=[
    ['slash','slash',1,.57,.218],['slash','slash2',2,.60,.245],
    ['slash','slash3',3,.71,.282],['slash','slash4',4,.69,.267],
    ['rush','thrust',0,.69,.284],['sweep','wide_cut',0,.92,.405],
    ['uppercut','riposte',0,.88,.363],['rush','vault',0,.92,.428],
  ];
  for(const item of (repertoire.ARCADE_REPERTOIRE[form]??[])){
    if(item.mapAction==='force')continue;
    base.push([item.mapAction,item.id,0,item.duration,item.contact]);
  }
  return base.map(([action,technique,combo,duration,contact])=>{
    const side=kit.weapon==='single'?undefined:{contact:kit.weapon==='staff'?contact:contact+.10};
    const actionDuration=Math.max(duration,(side?.contact??0)+.08);
    return {action,technique,combo,actionDuration,attack:technique,attackSpec:{duration:actionDuration,contact,offhand:side}};
  });
}
function validate(model){
  const reports={};
  for(const [name,gear] of Object.entries(kits)){
    const maxima={},running={},wristFrames=[],tipFrames=[],axisFrames=[],transitionFrames=[];
    let samples=0,clipsTested=0,coaxWorst=0,emitterMidError=0,supportDistanceError=0,minLength=Infinity;
    let activeFront=[],activeRear=[],worstTurn=null;
    for(const form of forms)for(const face of [0,Math.PI])for(const body of ['femboy','woman'])
      for(const saberPhase of ['short','long']){
      const input={id:'0-0',team:face?1:0,form,face,body,gear:{...gear,dualPhase:true},saberPhase,x:520,y:350,
        alive:true,airPhase:'grounded',airHeight:0};
      for(const clip of clips(form,gear)){
        clipsTested++;
        const start=poses(model,{...input,action:'idle',actionTime:0});
        const fresh=t=>poses(model,{...input,...clip,actionTime:t},0);
        const resetDistance=(a,b,key)=>round(dist(a.k[key],b.k[key]));
        const timeline=Array.from({length:Math.ceil(clip.actionDuration/step)+1},(_,i)=>Math.min(clip.actionDuration,i*step));
        let prev=null;
        for(const elapsed of timeline){
          const current=fresh(elapsed),{r,w,k}=current;
          assert.deepEqual(w.blades.map(x=>x.id),expectedIds(name));
          for(const p of Object.values(k))assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));
          for(const blade of w.blades)minLength=Math.min(minLength,dist(blade.hand,blade.tip));
          if(name==='staff'){
            const [front,rear]=w.blades,axis=vector(front.hand,front.tip),other=vector(rear.hand,rear.tip);
            const expected=point((r.emitter.x+r.offEmitter.x)/2,(r.emitter.y+r.offEmitter.y)/2);
            coaxWorst=Math.max(coaxWorst,Math.abs(180-turn(axis,other)));
            emitterMidError=Math.max(emitterMidError,dist(expected,r.hand));
            supportDistanceError=Math.max(supportDistanceError,Math.abs(dist(r.hand,r.backHand)-7.5));
          }
          if(prev){
            const wrist=Math.max(dist(prev.k.wrist,k.wrist),dist(prev.k.offWrist,k.offWrist));
            const tip=Math.max(dist(prev.k.primary,k.primary),k.secondary?dist(prev.k.secondary,k.secondary):0);
            const turns=w.blades.map((blade,j)=>turn(vector(blade.hand,blade.tip),
              vector(prev.w.blades[j].hand,prev.w.blades[j].tip)));
            const axis=Math.max(...turns);
            wristFrames.push(wrist);tipFrames.push(tip);axisFrames.push(axis);
            if(!worstTurn||axis>worstTurn.degrees)worstTurn={degrees:axis,form,face,body,technique:clip.technique,elapsed};
            for(const [key,value] of [['wrist',wrist],['tip',tip],['axis',axis]])
              maxima[key]=Math.max(maxima[key]??0,value);
          }
          prev=current;samples++;
        }
        const a=fresh(0),b=fresh(clip.actionDuration);
        for(const key of ['wrist','offWrist','primary','secondary'])if(a.k[key]){
          const jump=Math.max(resetDistance(start,a,key),resetDistance(b,start,key));
          running[key]=Math.max(running[key]??0,jump);
          if(key==='wrist'||key==='offWrist')transitionFrames.push(jump);
        }
        const main=fresh(clip.attackSpec.contact).w.blades[0];
        activeFront.push(signedCore(input,main));
        if(clip.attackSpec.offhand){
          const other=fresh(clip.attackSpec.offhand.contact).w.blades[1];
          activeRear.push((name==='staff'?-1:1)*signedCore(input,other));
        }
      }
    }
    reports[name]={clips:clipsTested,poses:samples,
      frameMax:Object.fromEntries(Object.entries(maxima).map(([k,v])=>[k,round(v)])),
      frameP99:{wrist:q(wristFrames,.99),tip:q(tipFrames,.99),axis:q(axisFrames,.99)},
      maxIdleBoundary:running,wristBoundaryP90:q(transitionFrames,.90),
      bladeSpanMin:round(minLength),frontContactForwardP10:q(activeFront,.1),
      secondaryContactDirectionalP10:q(activeRear,.1),
      ...(name==='staff'?{coaxWorst:round(coaxWorst,6),emitterMidError:round(emitterMidError,6),
        supportDistanceError:round(supportDistanceError,6)}:{}),
      worstTurn:{...worstTurn,degrees:round(worstTurn.degrees),elapsed:round(worstTurn.elapsed)}
    };
  }
  return reports;
}

function gaitAndTimingParity(old,updated){
  // Artistic paths may change; locomotion ground support and attack clock
  // must match fixed states. Test both sides, shapes, pace and reduced motion.
  let gaitSamples=0,attackContacts=0,singleArtIdentical=0,singleArtSamples=0;
  for(const [name,gear] of Object.entries(kits))if(name.startsWith('single'))
    for(const form of forms)for(const face of [0,Math.PI/2,Math.PI])for(const body of ['femboy','woman'])
      for(const reducedMotion of [false,true]){
      const input={id:'audit-single',form,face,body,gear,alive:true,x:450,y:310};
      for(const speed of [0,90,215])for(const d of [0,7,20,45,62,89]){
        const f={...input,action:speed?'run':'idle',vx:Math.cos(face)*speed,vy:Math.sin(face)*speed,groundDistance:d,groundSpeed:speed};
        const a=poses(old,f,.75,{reducedMotion}),b=poses(updated,f,.75,{reducedMotion});
        assert.deepEqual(b.r.legs,a.r.legs,'single support phase moved at same ground distance');
        gaitSamples++;
      }
      for(const clip of clips(form,gear)){
        const f={...input,...clip,actionTime:clip.attackSpec.contact};
        const a=poses(old,f,.75,{reducedMotion}),b=poses(updated,f,.75,{reducedMotion});
        assert.equal(a.r.t,b.r.t,'single normalized contact clock changed');
        assert.equal(a.r.airPhase,b.r.airPhase,'single air timing changed');
        attackContacts++;
        singleArtSamples++;
        if(JSON.stringify(a.k)===JSON.stringify(b.k))singleArtIdentical++;
      }
    }
  return {gaitSamples,attackContacts,singleArtSamples,singleArtIdentical};
}
const out={after:validate(revision)};
if(reference){out.before=validate(reference);out.singleControls=gaitAndTimingParity(reference,revision);}
console.log(JSON.stringify(out,null,2));
