import {drawArcadeFighter as original} from './arcade-fighters.js?v=6.0.2-rc2';
import {drawArcadePeasantFighter,drawArcadePeasantFighterPreview} from './arcade-peasant-art.js?v=6.0.2-rc2';
import type { sampleArcadeFighter } from './arcade-fighters.js?v=6.0.2-rc2';

export interface FighterPaintIdentity {
  peasantMotion?: boolean;
  id?: string | number; team?: number;
  face?: number; x?: number; y?: number; appearanceSeed?: number;
  alive?: boolean; saberOff?: boolean; body?: string;
}
export interface FighterPaintOptions {
  ghost?: boolean | string;
  reducedMotion?: boolean;
  outline?: boolean;
  selected?: boolean;
  hideSabers?: boolean;
  lowDetail?: boolean;
  crowded?: boolean;
  pathFactory?: () => Path2D;
  rig?: ReturnType<typeof sampleArcadeFighter>;
}
export interface FighterPreviewOptions extends FighterPaintOptions {
  width?: number; height?: number;
  framing?: 'portrait' | 'full';
  time?: number;
}

export function drawArcadeFighter<F extends FighterPaintIdentity>(ctx:CanvasRenderingContext2D,f:F,time?:number,options?:FighterPaintOptions):ReturnType<typeof sampleArcadeFighter>{
  return (f.peasantMotion===true?drawArcadePeasantFighter:original)(ctx,f,time,options);
}
export const drawArcadeFighterPreview:<F extends FighterPaintIdentity>(ctx:CanvasRenderingContext2D,f?:F,options?:FighterPreviewOptions)=>ReturnType<typeof sampleArcadeFighter>=drawArcadePeasantFighterPreview;
