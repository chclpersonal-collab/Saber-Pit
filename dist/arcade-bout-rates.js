/** Career outcome shares. Seed advancement after draws adds no extra result. */
const count=value=>Number.isSafeInteger(value)&&value>=0?value:0;
export function tournamentBoutRates({wins,draws,losses}={}){
  const lost=count(losses),total=count(wins)+count(draws)+lost;
  if(!total)return null;
  const tenths=Math.round(lost*1000/total);
  return {lossPercent:tenths/10,winDrawPercent:(1000-tenths)/10,total};
}
