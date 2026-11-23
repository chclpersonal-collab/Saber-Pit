type Doctrine='balanced'|'aggressive'|'defensive';
type Key='accuracy'|'pressure'|'guardRate'|'forceRate'|'whiffRate'|'counterRate';
type Variant={bouts:number;wins:number;score:number};
type Saved={wins?:number;lastDoctrine:Doctrine;variants:Record<string,Variant>;bouts:number;observed:Record<string,number>};
type Read={opponentId:string|number;start:number;spent:number;guarded:number;commits:number;force:number;whiffs:number;
 exposed:number;lastSerial?:number;lastWhiffs:number;seenAt?:number};
type Enemy={id:string|number;stats:{whiffs?:number};attackSerial?:number;attack?:unknown;action:string;exposedUntil?:number};
type Reader={heroAdaptation?:Saved;heroRead?:Read;energy:number;heroPlanAt?:number;heroPlan?:Doctrine};
/** A Hero's only extra ability is selecting legal tactics from actual evidence. */
const PLANS:Doctrine[]=['balanced','aggressive','defensive'];
const KEYS:Key[]=['accuracy','pressure','guardRate','forceRate','whiffRate','counterRate'];
const safe=(n:number|undefined,lo:number,hi:number)=>Number.isFinite(n)?Math.max(lo,Math.min(hi,n!)):lo;
export function normalizeHeroTactics(raw?:Partial<Omit<Saved,"variants"|"observed">>&{variants?:Partial<Record<Doctrine,Partial<Variant>>>;observed?:Partial<Record<Key,number>>}){
  const bouts=Math.floor(safe(raw?.bouts,0,1e5));
  return {
    bouts,wins:Math.floor(safe(raw?.wins,0,bouts)),
    lastDoctrine:PLANS.includes(raw?.lastDoctrine as Doctrine)?raw!.lastDoctrine!:'balanced',
    variants:Object.fromEntries(PLANS.map(k=>{
      const v=raw?.variants?.[k],n=Math.floor(safe(v?.bouts,0,bouts));
      return [k,{bouts:n,wins:Math.floor(safe(v?.wins,0,n)),score:Number.isFinite(v?.score)?safe(v?.score,-n,n):0}];
    })),
    observed:Object.fromEntries(KEYS.map(k=>[k,safe(raw?.observed?.[k],0,1)]))
  };
}
export function chooseHeroPlan(saved:Saved,seen:{pressure:number;guard:number;force:number;whiff:number;exposure:number},energy=100){
  const {lastDoctrine,variants,bouts,observed}=saved;
  const {pressure,guard,force,whiff,exposure}=seen;
  const weight=bouts/(bouts+3);
  const prior=(key:Doctrine)=>variants[key].score/(variants[key].bouts+3.25)*.24+(lastDoctrine===key?.11:0);
  const candidates={
    balanced:.35+prior('balanced')+Math.min(pressure,guard)*.36+weight*observed.accuracy*.07,
    aggressive:.13+prior('aggressive')+guard*.91+whiff*.36+exposure*.16-pressure*.14+weight*observed.pressure*.08,
    defensive:.14+prior('defensive')+pressure*.71+force*.39+(energy<31?.19:0)+weight*observed.guardRate*.08,
  };
  return {plan:PLANS.slice().sort((a,b)=>candidates[b]-candidates[a])[0],scores:candidates};
}
const fresh=(now:number,enemy:Enemy):Read=>({opponentId:enemy.id,start:now,spent:0,guarded:0,commits:0,force:0,
  whiffs:0,exposed:0,lastSerial:enemy.attackSerial,lastWhiffs:enemy.stats.whiffs??0});
export function observeHeroPlan(f:Reader,enemy:Enemy|null|undefined,now:number,dt:number,visible:boolean,settled:boolean){
  const saved=f.heroAdaptation;
  if(!saved||!enemy||!visible)return null;
  if(!f.heroRead||f.heroRead.opponentId!==enemy.id||now-(f.heroRead?.seenAt??now)>.92)f.heroRead=fresh(now,enemy);
  const v=f.heroRead;v.seenAt=now;v.spent+=dt;
  if(enemy.action==='guard')v.guarded+=dt;
  if(enemy.attack&&enemy.attackSerial!==v.lastSerial){v.commits++;if(enemy.action==='force')v.force++;}
  v.lastSerial=enemy.attackSerial;
  const w=enemy.stats.whiffs??0;v.whiffs+=Math.max(0,w-v.lastWhiffs);v.lastWhiffs=w;
  if(enemy.exposedUntil!>now||enemy.action==='stagger')v.exposed+=dt;
  if(!settled||v.spent<1.25||now<(f.heroPlanAt??0))return null;
  const seen={pressure:safe(v.commits/(v.spent*1.73),0,1),guard:safe(v.guarded/v.spent,0,1),
    force:safe(v.force/Math.max(1,v.commits),0,1),whiff:safe(v.whiffs/Math.max(1,v.commits),0,1),
    exposure:safe(v.exposed/v.spent,0,1)};
  const {plan,scores}=chooseHeroPlan(saved,seen,f.energy);
  f.heroRead=fresh(now,enemy);f.heroPlanAt=now+1.35;
  if(plan===f.heroPlan||scores[plan]-(scores[f.heroPlan as Doctrine]??0)<.10)return null;
  const previous=f.heroPlan;f.heroPlan=plan;
  return {plan,previous,targetId:enemy.id};
}
