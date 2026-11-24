import {ARENA_NORMAL_ELO_START,arenaNormalRating} from './arcade-normal-elo.js';

/**
 * Mid-match scoreboard model. Pure: reads live round numbers the Arena already keeps and
 * returns what the panel shows. No save fields, no new stats.
 */
export type ScoreboardRule='elimination'|'control'|'relic';
export type ScoreboardFighter={
  id:string;team:0|1;slot:number;control:boolean;alive:boolean;name:string;rank:string;
  kills:unknown;deaths:unknown;damage:unknown;
  /** The slot's saved Arena rating, as the round was set up with it. */
  slotRating?:unknown;
  /** A Saved Hero's own rating. */
  heroElo?:unknown;
};
export type ScoreboardInput={
  fighters:readonly ScoreboardFighter[];rule:ScoreboardRule;mapSize:string;round:number;
  secondsLeft:number;rated:boolean;objective?:readonly [number,number]|null;
};
export type ScoreboardRow={id:string;name:string;rank:string;k:number;d:number;dmg:number;elo:string;me:boolean;ko:boolean};
export type ScoreboardTeam={side:'blue'|'pink';name:string;alive:number;total:number;rows:ScoreboardRow[]};
export type ScoreboardModel={
  score:[number,number];meta:string;round:string;rated:boolean;badge:'RATED'|'UNRATED';
  teams:[ScoreboardTeam,ScoreboardTeam];note:string;
};

const RULES:Record<ScoreboardRule,string>={elimination:'Elimination',control:'Control',relic:'Relic'};
const SIZES:Record<string,string>={small:'Small',medium:'Medium',large:'Large'};
const count=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&n>0?Math.floor(n):0;
const finite=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n);

export function scoreboardClock(seconds:number):string {
  const s=Math.max(0,Math.ceil(finite(seconds)?seconds:0));
  return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
}
/**
 * Rated rounds show the rating each slot was rated at, starting at 100 like the Arena does.
 * Unrated rounds show a saved rating only where one exists: the slot's, else a Saved Hero's.
 */
export function scoreboardElo(rated:boolean,slotRating:unknown,heroElo:unknown):number|null {
  if(rated)return arenaNormalRating(slotRating);
  if(finite(slotRating))return arenaNormalRating(slotRating);
  if(finite(heroElo))return Math.max(0,Math.round(heroElo));
  return null;
}
const eloText=(n:number|null)=>n===null?'—':n.toLocaleString('en-US');

/** Most kills first, then fewest deaths, then most damage. Slot order breaks ties so rows never jump. */
function byScore(a:ScoreboardRow&{slot:number},b:ScoreboardRow&{slot:number}){
  return b.k-a.k||a.d-b.d||b.dmg-a.dmg||a.slot-b.slot;
}
export function buildArenaScoreboard(input:ScoreboardInput):ScoreboardModel {
  const teams=([0,1] as const).map(team=>{
    const roster=input.fighters.filter(f=>f.team===team);
    const rows=roster.map(f=>({
      id:f.id,slot:f.slot,name:f.name,rank:f.rank,k:count(f.kills),d:count(f.deaths),dmg:Math.round(count(f.damage)),
      elo:eloText(scoreboardElo(input.rated,f.slotRating,f.heroElo)),me:f.control,ko:!f.alive,
    })).sort(byScore).map(({slot:_slot,...row})=>row);
    return {side:team?'pink':'blue',name:team?'Pink':'Blue',alive:roster.filter(f=>f.alive).length,total:roster.length,rows} as ScoreboardTeam;
  }) as [ScoreboardTeam,ScoreboardTeam];
  const objective=input.rule!=='elimination'&&input.objective;
  const score:[number,number]=objective
    ?[count(objective[0]+1e-8),count(objective[1]+1e-8)]
    :[teams[0].rows.reduce((n,r)=>n+r.k,0),teams[1].rows.reduce((n,r)=>n+r.k,0)];
  return {
    score,
    meta:[RULES[input.rule]??'Arena',SIZES[input.mapSize],scoreboardClock(input.secondsLeft)].filter(Boolean).join(' · '),
    round:'Round '+Math.max(1,Math.floor(input.round)||1),
    rated:input.rated,badge:input.rated?'RATED':'UNRATED',teams,
    note:input.rated?'Elo before this round. Starts at '+ARENA_NORMAL_ELO_START+'.':'Unrated. Elo shows a saved rating where one exists, otherwise —.',
  };
}
