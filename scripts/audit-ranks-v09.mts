import {runtimeDir} from './tool-runtime.mjs';
/** Independent paired-seed rank audit. Does not patch positions or combat state. */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const args = Object.fromEntries(process.argv.slice(2).map(arg => { const [k, ...v] = arg.replace(/^--/, '').split('='); return [k, v.join('=') || true]; }));
const runtime = path.resolve(args.runtime || runtimeDir);
const hashSources=()=>Object.fromEntries(fs.readdirSync(runtime).filter(n=>n.endsWith('.js')).sort().map(n=>[n,createHash('sha256').update(fs.readFileSync(path.join(runtime,n))).digest('hex')]));
const sourceHashes=hashSources();
const {createGame, step, FORMS, MAPS} = await import(pathToFileURL(path.join(runtime, 'sim.js')));
const seeds = Number(args.seeds || 3), size = Number(args.size || 1);
const forms = args.forms ? args.forms.split(',') : Object.keys(FORMS);
const terrains = args.terrains ? args.terrains.split(',') : MAPS.map(m => m.id);
const modes = args.modes ? args.modes.split(',') : ['elimination','control','relic'];
const modifiers = args.modifiers ? args.modifiers.split(',') : ['standard','saber_only'];
if(args.equalRank)args.equal=true;
const ranks = args.equal ? [args.equalRank||'F',args.equalRank||'F'] : ['F','SSS+V'];
const results = [], started = Date.now();
for (const form of forms) for (const opponentForm of (args.cross ? forms : [form])) for (const terrain of terrains) for (const matchMode of modes) for (const modifier of modifiers) for (let seedIndex=0; seedIndex<seeds; seedIndex++) for (const highSide of (args.equal?[0]:[0,1])) {
  const seed = args.seedScheme==='hashed' ? createHash('sha256').update(`saber-pit-v09-independent-${seedIndex}`).digest().readUInt32LE(0) : 29041 + seedIndex * 7919;
  const startingRanks = highSide === 0 ? [...ranks].reverse() : [...ranks];
  const matchedForms=highSide===0?[form,opponentForm]:[opponentForm,form];
  const game = createGame(seed,{teamSizes:[size,size],mapSize:args.mapSize||'small',terrain,mode:'spectate',forms:matchedForms.map(f=>Array(size).fill(f)),startingRanks,matchMode,modifier,roundDuration:90,autoCommand:true});
  step(game,90);
  if (game.status !== 'ended') throw new Error('Natural round failed to settle');
  results.push({seed,form,opponentForm,terrain,matchMode,modifier,highSide,winner:game.winner,result:game.winner===null?'draw':game.winner===highSide?'high':'low',seconds:game.time,reason:game.reason,saberSwings:game.stats.saberSwings,forceCasts:game.stats.forceCasts,damage:game.soldiers.map(s=>s.damageDealt),survivors:[0,1].map(t=>game.soldiers.filter(s=>s.team===t&&s.alive).length)});
  if(results.length%108===0) console.error(`${results.length} rounds complete (${((Date.now()-started)/1000).toFixed(1)}s)`);
}
function summarize(rows){let high=0,low=0,draw=0; for(const r of rows)({high:()=>high++,low:()=>low++,draw:()=>draw++}[r.result]());const engaged=rows.filter(r=>r.saberSwings.some(n=>n>0));return {rounds:rows.length,highWins:high,lowWins:low,draws:draw,blueWins:rows.filter(r=>r.winner===0).length,redWins:rows.filter(r=>r.winner===1).length,highWinRate:high/rows.length,averageSeconds:rows.reduce((s,r)=>s+r.seconds,0)/rows.length,zeroSaberRounds:rows.length-engaged.length,engagedHighWinRate:engaged.filter(r=>r.result==='high').length/engaged.length,timeoutRounds:rows.filter(r=>r.reason.startsWith('Time limit')).length};}
const output={label:args.label||'v0.9',runtime,sourceHashes,sourceChangedDuringRun:JSON.stringify(sourceHashes)!==JSON.stringify(hashSources()),protocol:{seeds,size,ranks,forms,terrains,modes,modifiers,pairedSides:!args.equal,crossForms:!!args.cross,naturalSpawns:true,equalEquipment:'standard',seedScheme:args.seedScheme==='hashed'?'SHA256(saber-pit-v09-independent-i) first uint32 LE':'29041 + i * 7919'},summary:summarize(results),byForm:Object.fromEntries(forms.map(k=>[k,summarize(results.filter(r=>r.form===k))])),byMode:Object.fromEntries(modes.map(k=>[k,summarize(results.filter(r=>r.matchMode===k))])),byModifier:Object.fromEntries(modifiers.map(k=>[k,summarize(results.filter(r=>r.modifier===k))])),bySide:Object.fromEntries([0,1].map(k=>[k,summarize(results.filter(r=>r.highSide===k))])),durationSeconds:(Date.now()-started)/1000,results};
if(args.out){fs.mkdirSync(path.dirname(args.out),{recursive:true});fs.writeFileSync(args.out,JSON.stringify(output,null,2)+'\n');}
console.log(JSON.stringify({...output,results:undefined},null,2));
