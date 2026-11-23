/** Render-only silhouette crowd estimates. Never modify combat positions. */
export function sharesSilhouette(a,b){
  if(!a||!b||a.id===b.id||(a.alive===false||(a.alive===undefined&&a.hp<=0))||(b.alive===false||(b.alive===undefined&&b.hp<=0)))return false;
  const dy=(a.y-(a.airHeight??0))-(b.y-(b.airHeight??0));
  return Math.abs(a.x-b.x)<54&&Math.abs(dy)<86;
}
export function crowdedFighters(fighters){
  const result=new Set();
  for(let i=0;i<fighters.length;i++)for(let j=i+1;j<fighters.length;j++){
    const a=fighters[i],b=fighters[j];
    if(sharesSilhouette(a,b)){result.add(a.id);result.add(b.id);}
  }
  return result;
}
