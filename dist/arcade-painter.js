import {drawArcadeFighter as original} from './arcade-fighters.js?v=4.0.0';
import {drawArcadePeasantFighter,drawArcadePeasantFighterPreview} from './arcade-peasant-art.js?v=4.0.0';

export function drawArcadeFighter(ctx,f,time,options){
  return (f.peasantMotion===true?drawArcadePeasantFighter:original)(ctx,f,time,options);
}
export const drawArcadeFighterPreview=drawArcadePeasantFighterPreview;
