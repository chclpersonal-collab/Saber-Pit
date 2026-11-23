/** Round counters and attribution for real contact, damage and knockouts. */
export const ARCADE_STAT_KEYS=Object.freeze(['saberSwings','saberHits','damage','damageTaken','blocks','counters','parries','forceCasts','forceHits','kills','deaths','assists','environmentDeaths','saberLanded','forceLanded','punishes','whiffs','clashes','rankDeflections','rankComposure','rankMoves','allyBlocks','feints','guardReads','ripostes'] as const);
const recordKeys=['kills','deaths','assists','environmentDeaths'] as const;
export type ArcadeRecordKey = typeof recordKeys[number];
export type ArcadeStatKey = typeof ARCADE_STAT_KEYS[number];
export type ArcadeRecord = Record<ArcadeRecordKey, number>;
export type ArcadeRoundStats = Record<ArcadeStatKey, number>;
export type ArcadeTeamStats = Record<ArcadeStatKey, [number, number]>;
interface Contributor { id: string; time: number; damage: number }
interface RatedFighter { id: string; team: 0|1; stats: ArcadeRoundStats; contributors: Contributor[] }
interface StatsLedger { time: number; stats: ArcadeTeamStats; fighters: RatedFighter[]; records: {teams: [ArcadeRecord,ArcadeRecord]; soldiers: (ArcadeRecord & {id: string})[]} }
function isRecordKey(key: ArcadeStatKey): key is ArcadeRecordKey {return (recordKeys as readonly ArcadeStatKey[]).includes(key);}
export const record = (prior?: Partial<Record<ArcadeRecordKey, unknown>> | null): ArcadeRecord =>
  Object.fromEntries(recordKeys.map(k=>{
    const value=prior?.[k];
    return [k,typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?Math.min(value,1e9):0];
  })) as ArcadeRecord;
export const roundStats = (): ArcadeRoundStats => Object.fromEntries(ARCADE_STAT_KEYS.map(k=>[k,0])) as ArcadeRoundStats;
export const credit=(s: StatsLedger,f: RatedFighter,key: ArcadeStatKey,amount=1)=>{
  f.stats[key]+=amount;s.stats[key][f.team]+=amount;
  if(isRecordKey(key)){
    const side=s.records.teams[f.team], slot=s.records.soldiers.find(r=>r.id===f.id);
    side[key]=Math.min(1e9,side[key]+amount);slot![key]=Math.min(1e9,slot![key]+amount); // Every arena fighter gets a record at spawn.
  }
};
export function recordDamage(s: StatsLedger,attacker: RatedFighter,victim: RatedFighter,amount: number) {
  if(amount<=0)return;
  credit(s,attacker,'damage',amount);credit(s,victim,'damageTaken',amount);
  victim.contributors=victim.contributors.filter(entry=>entry.time>=s.time-6).slice(-95);
  victim.contributors.push({id:attacker.id,time:s.time,damage:amount});
}
export function recordKnockout(s: StatsLedger,victim: RatedFighter){
  credit(s,victim,'deaths');
  const dealt=new Map<string,number>();
  for(const {id,time,damage} of victim.contributors) if(time>=s.time-6) dealt.set(id,(dealt.get(id)??0)+damage);
  const contributors=[...dealt].sort(([a,av],[b,bv])=>bv-av||(a<b?-1:a>b?1:0)).map(([id])=>s.fighters.find(f=>f.id===id)).filter((fighter): fighter is RatedFighter=>Boolean(fighter));
  const [killer,...assists]=contributors;
  if(killer){credit(s,killer,'kills');for(const helper of assists)credit(s,helper,'assists');}
  else credit(s,victim,'environmentDeaths');
  return {killerId:killer?.id??null,assists:assists.map(f=>f.id)};
}

