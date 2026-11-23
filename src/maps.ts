// @ts-nocheck
/** Versioned, mirrored battlefields. The original map catalog remains untouched for old saves. */
import { MAPS, createTerrain } from './content.js?v=1.4.0';
import { ENVIRONMENTS } from './environment.js?v=1.4.0';

export const MAP_GEOMETRY_VERSION = 1;
export const MAP_SIZES = Object.freeze(Object.fromEntries([
  ['small', 'Small', 960, 540], ['medium', 'Medium', 1280, 720], ['large', 'Large', 1600, 900],
].map(([id, name, width, height]) => [id, Object.freeze({ id, name, width, height })])));
const round = number => Math.round(number * 1000) / 1000;
function seedNumber(seed) {
  if (typeof seed === 'number' && Number.isFinite(seed)) return seed >>> 0;
  let value = 2166136261;
  for (const char of String(seed)) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return value >>> 0;
}
function sizes(input) {
  return [0, 1].map(team => Number.isInteger(input?.[team]) && input[team] >= 1 && input[team] <= 15 ? input[team] : 15);
}
const DESCRIPTIONS = {
  crossroads: 'Three open approaches cross a field of directional barricades and central walls.',
  zigzag: 'Staggered cover positions and short central walls create offset attack routes.',
  craterfield: 'Heavy rough ground slows the center approach; dangerous outer vents have safe alternatives.',
};
const PALETTES = {
  crossroads: ['#c0bd95', '#c8bc95', '#aeb18b'],
  zigzag: ['#bac29b', '#c3bd95', '#a2b18b'],
  craterfield: ['#b9b190', '#bcb28d', '#9fa987'],
};
/** All slots retain stable lane IDs; lane is not a geometric row. Never mutates catalogs. */
export function createBattlefield(seed = 1, options = {}) {
  options = options && typeof options === 'object' ? options : {};
  if (options.mapSize === 'legacy') return createTerrain(seed, options.terrain ?? null);
  const preset = Object.hasOwn(MAP_SIZES, options.mapSize) ? MAP_SIZES[options.mapSize] : MAP_SIZES.medium;
  const template = MAPS.find(map => map.id === options.terrain) || MAPS[seedNumber(seed) % MAPS.length];
  const { width, height } = preset, teamSizes = sizes(options.teamSizes);
  const environment = Object.hasOwn(ENVIRONMENTS, options.environment) ? options.environment : 'clear';
  const bounds = { minX: 40, minY: 50, maxX: width - 40, maxY: height - 50 };
  const rows = [.18, .34, .5, .66, .82].map(y => round(height * y));
  const banks = [.18, .31, .44];
  const coverNodes = [0, 1].flatMap(team => banks.flatMap((fraction, bank) =>
    Array.from({ length: teamSizes[team] }, (_, lane) => {
      const row = lane % 5, column = Math.floor(lane / 5);
      // Every slot has its own collision-free bank destination. Three depth ranks fit 15 units.
      const stagger = template.id === 'zigzag' ? (row % 2 ? -8 : 0) : template.id === 'craterfield' && row === 2 ? -10 : 0;
      const leftX = round(width * fraction - column * 28 + stagger);
      return { id: `${template.id}-${preset.id}-${team}-${bank}-${lane}`, team, bank, lane,
        x: team === 0 ? leftX : round(width - leftX), y: rows[row] };
    })));
  const solids = [];
  // Cover is physical and directional. Body-sized gaps remain between each bank and each row.
  for (const team of [0, 1]) for (let bank = 0; bank < banks.length; bank++) for (let row = 0; row < rows.length; row++) {
    // Central walls replace the forward cover in these rows. A second solid here
    // creates actor-width slivers that continuous collision can enter but the
    // navigation grid cannot attach to. Keep all bank destinations, omit the slivers.
    if (bank === 2 && (row === 1 || row === 3)) continue;
    const stagger = template.id === 'zigzag' ? (row % 2 ? -8 : 0) : template.id === 'craterfield' && row === 2 ? -10 : 0;
    const leftX = round(width * banks[bank] + stagger + 20);
    solids.push({ id: `cover-${team}-${bank}-${row}`, kind: 'barricade',
      x: team === 0 ? leftX : round(width - leftX - 8), y: round(rows[row] - 15), width: 8, height: 30 });
  }
  // Central walls deliberately interrupt two lanes while preserving upper, central and lower approaches.
  const wallRows = template.id === 'zigzag' ? [[.27, .1], [.63, .1]] : template.id === 'craterfield' ? [[.25, .14], [.61, .14]] : [[.27, .12], [.61, .12]];
  wallRows.forEach(([y, h], index) => solids.push({ id: `wall-${index}`, kind: 'wall',
    x: round(width / 2 - 18), y: round(height * y), width: 36, height: round(height * h) }));
  const zones = [];
  const addMirroredZone = (name, kind, x, y, w, h, moveCost, damagePerSecond = 0) => {
    for (const team of [0, 1]) zones.push({ id: `${name}-${team}`, kind,
      x: round(team === 0 ? x : width - x - w), y: round(y), width: round(w), height: round(h), moveCost, damagePerSecond });
  };
  // Rough ground makes the shortest route a tradeoff; safe routes remain above and below it.
  addMirroredZone('rough', 'rough', width * .34, height * .43, width * .1, height * .14, template.id === 'craterfield' ? 1.55 : 1.3);
  if (template.id === 'craterfield') {
    addMirroredZone('vent-upper', 'hazard', width * .34, height * .1, width * .085, height * .045, 1.2, 7);
    addMirroredZone('vent-lower', 'hazard', width * .34, height * .855, width * .085, height * .045, 1.2, 7);
  }
  const decorations = template.decorations.map(d => ({ ...d, x: round(d.x * width / 960), y: round(d.y * height / 540), radius: round(d.radius * Math.min(width / 960, height / 540)) }));
  const objective = { id: 'center', name: 'Signal post', x: width / 2, y: height / 2, radius: 108 };
  return { id: template.id, name: template.name, description: DESCRIPTIONS[template.id], geometryVersion: MAP_GEOMETRY_VERSION,
    mapSize: preset.id, environment, width, height, bounds, playBounds: { ...bounds }, teamSizes,
    palette: [...PALETTES[template.id]], coverNodes, solids, zones, decorations,
    controlPoints: [{ ...objective }], objective: { ...objective }, cosmeticTerrainOnly: false };
}
