/** Tournament mastery badges use earned ratings only, never a custom Hero Elo. */
export function masteryTitle(earnedElo,hasRatedBout=true){
  if(!hasRatedBout||!Number.isFinite(earnedElo)||earnedElo<1500)return '';
  return earnedElo>=1800?'AGM':earnedElo>=1700?'SGM':earnedElo>=1600?'HGM':'GM';
}
export function earnedMasteryTitle(state,id){
  const record=state?.records?.[id]??state?.teams?.[id];
  const peak=state?.peaks?.[id]?.peakElo;
  const fought=!!record&&['wins','draws','losses'].some(key=>record[key]>0);
  const eligible=Number.isFinite(peak)||fought;
  return masteryTitle(Math.max(Number.isFinite(peak)?peak:0,fought&&Number.isFinite(record.elo)?record.elo:0),eligible);
}
