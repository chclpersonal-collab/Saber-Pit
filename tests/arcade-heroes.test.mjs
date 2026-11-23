import test from 'node:test';
import assert from 'node:assert/strict';
import {battleHeroLineup,normalizeHeroLineup} from '../dist/arcade-heroes.js';
import {normalizeSetup} from '../dist/arcade-setup.js';
import {createArcade} from '../dist/arcade-engine.js';

const hero={id:'f-ember',name:'Mael Ember',grade:'SSS+ V',form:'ataru',body:'rabbit',weapon:'staff',grip:'backhand',
  dualPhase:true,forceFamily:'force_pulse',doctrine:'defensive'};

test('saved hero uses their own name, grade, body, gear and doctrine in only the selected slot',()=>{
  const source=Object.freeze({...hero});
  const picks=normalizeSetup({teamSizes:[2,2],heroPicks:[{}, {id:source.id,slot:1}]}).heroPicks;
  const heroLineup=battleHeroLineup(picks,[source],record=>record);
  const before=createArcade({mode:'watch',form:'makashi',teamSizes:[2,2]});
  const game=createArcade({mode:'watch',form:'makashi',teamSizes:[2,2],heroLineup});
  const f=game.fighters.find(x=>x.id==='1-1');
  assert.deepEqual([f.displayName,f.heroId,f.career.grade,f.form,f.body,f.gear.weapon,f.gear.grip,f.gear.dualPhase,f.gear.forceFamily,f.heroDoctrine],
    [source.name,source.id,'SSS+V','ataru','rabbit','staff','forward',true,'force_pulse','defensive']);
  for(const v of game.fighters.filter(x=>x.id!=='1-1'))assert.deepEqual(v,before.fighters.find(x=>x.id===v.id));
  assert.equal(source.grip,'backhand');
});

test('old settings contain no heroes and attempted duplicates or out-of-roster slots are ignored',()=>{
  assert.deepEqual(normalizeSetup({}).heroPicks,[{id:'',slot:0},{id:'',slot:0}]);
  assert.deepEqual(normalizeSetup({teamSizes:[2,1],heroPicks:[{id:hero.id,slot:50},{id:'a b',slot:3}]}).heroPicks,
    [{id:hero.id,slot:1},{id:'',slot:0}]);
  const line=normalizeHeroLineup({'0-23':hero,'1-0':hero,'1-24':{...hero,id:'other'}, arbitrary:hero});
  assert.deepEqual(Object.keys(line),['0-23']);
});

test('stored generated Heroes adopt the new name but personal names remain untouched',()=>{
  const imported={...hero,id:'f-briallen-coldwater',name:'Briallen Coldwater'};
  assert.equal(normalizeHeroLineup({'0-0':imported})['0-0'].name,'Tseokaishi Seok');
  assert.equal(normalizeHeroLineup({'0-0':{...imported,name:'Moon in Glass'}})['0-0'].name,'Moon in Glass');
});
