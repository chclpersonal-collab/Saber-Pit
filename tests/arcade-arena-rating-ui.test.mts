import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {arenaLobbyRating} from '../dist/arcade-arena-rating-ui.js';

test('Arena setup previews rating and explains how to make an unrated match eligible',()=>{
  const rate=(mode:string,rule:string,sizes:number[],heroes:Record<string,{id:string}>={})=>arenaLobbyRating(mode,rule,sizes,heroes);
  assert.deepEqual(rate('duel','elimination',[1,1]),{rated:true,label:'Rated · starts at 100 Elo'});
  assert.equal(rate('watch','elimination',[15,15]).rated,true);
  assert.match(rate('watch','elimination',[16,16]).label,/ends at 15v15/);
  assert.match(rate('watch','elimination',[1,15]).label,/same size/);
  assert.match(rate('command','elimination',[5,5]).label,/Commander/);
  assert.match(rate('watch','control',[5,5]).label,/Elimination/);
  assert.match(rate('duel','elimination',[1,1],{'1-0':{id:'hero'}}).label,/Saved Hero/);
  assert.match(rate('watch','elimination',[NaN,4]).label,/Enter both/);
});

test('setup status is visible beside the launch controls, outside the collapsible tabs',async()=>{
  const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
  assert.match(html,/<p id="arenaRatingStatus"[^>]+role="status"[^>]+aria-live="polite"[^>]*>[^<]+<\/p>\s*<div class="lobby-bottom"><button[^>]+aria-describedby="arenaRatingStatus"/);
});
