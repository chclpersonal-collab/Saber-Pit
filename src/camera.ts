// @ts-nocheck
/** Presentation-only fit in CSS pixels. Keep the existing independent-axis map
 * fit and pixel-sized fighters, but frame the complete map plus legal airborne
 * silhouettes. These transforms never change positions, height, or hit tests. */
const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

function fitAxis(viewport, extent, actorMin, actorMax, before, after) {
  const available = Math.max(0, viewport - 8);
  const lower = [[0, 0], [actorMin, -before]], upper = [[extent, 0], [actorMax, after]];
  let scale = available / extent;
  // Each upper/lower pair bounds a world-space span plus fixed-pixel artwork.
  for (const [high, highPixels] of upper) for (const [low, lowPixels] of lower) {
    if (high > low) scale = Math.min(scale, (available - highPixels + lowPixels) / (high - low));
  }
  scale = Math.max(1e-6, scale); // Hidden/tiny canvases still have a finite inverse.
  const start = Math.min(...lower.map(([world, pixels]) => world * scale + pixels));
  const end = Math.max(...upper.map(([world, pixels]) => world * scale + pixels));
  return { scale, offset: (viewport - end - start) / 2 };
}

export function fitBattleCamera({ width = 960, height = 540, worldWidth = 960, worldHeight = 540, bounds = null, fighterBoost = 1 } = {}) {
  width = Math.max(0, finite(width, 960)); height = Math.max(0, finite(height, 540));
  worldWidth = Math.max(1, finite(worldWidth, 960)); worldHeight = Math.max(1, finite(worldHeight, 540));
  // Preserve the pre-camera fighter size rather than shrinking it with the map.
  const spriteScale = clamp(width / worldWidth, .77, 1.14) * clamp(finite(fighterBoost, 1), 1, 1.28);
  const minX = clamp(finite(bounds?.minX, 40), 0, worldWidth);
  const maxX = clamp(finite(bounds?.maxX, worldWidth - 40), minX, worldWidth);
  const minY = clamp(finite(bounds?.minY, 50), 0, worldHeight);
  const maxY = clamp(finite(bounds?.maxY, worldHeight - 50), minY, worldHeight);
  // 100 is startAirborne's maximum world height. 56 covers a rotated blade,
  // hands and glow; the target-lock label extends 61 fixed CSS pixels upward.
  const silhouette = 56 * spriteScale;
  const x = fitAxis(width, worldWidth, minX, maxX, silhouette, silhouette);
  const y = fitAxis(height, worldHeight, minY - 100, maxY, Math.max(61, silhouette), silhouette);
  return { width, height, sx: x.scale, sy: y.scale, ox: x.offset, oy: y.offset, spriteScale };
}

export function worldToCanvas(view, x, y) { return { x: x * view.sx + view.ox, y: y * view.sy + view.oy }; }
export function canvasToWorld(view, x, y) { return { x: (x - view.ox) / view.sx, y: (y - view.oy) / view.sy }; }
