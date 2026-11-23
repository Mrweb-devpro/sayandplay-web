/* Game 3 — Road Rush.
   Pip waits at the roadside; each correct letter or digit is one hop across one lane.
   A vehicle approaches in the lane ahead and arrives when the lane timer runs out:
   then it honks, Pip hops back to the kerb, and the child simply tries that lane again. Nobody loses. */
import {spellLevel,spellRound,type SpellCard,type SpellMode} from "./spell.ts";

export const ROAD_LEVELS=40, ROUNDS_PER_LEVEL=3;
export type Vehicle="car"|"bus"|"truck"|"train";
export interface RoadLevel{index:number,stage:number,laneSeconds:number,vehicles:Vehicle[],numberShare:number}

/** 4 stages of 10 levels: longer words, less time per lane, bigger vehicles (trains from stage 4). */
export function roadLevel(index:number):RoadLevel{
 const stage=Math.floor(index/10);
 // Generous on purpose: 11 s per lane at first, ~6 s by level 40. The timer pauses while the narrator talks.
 const laneSeconds=Math.round((11-stage*1.3-(index%10)*0.1)*10)/10;
 const vehicles:Vehicle[][]=[["car"],["car","bus"],["car","bus","truck"],["car","bus","truck","train"]];
 return {index,stage,laneSeconds,vehicles:vehicles[stage],numberShare:stage===0?0.3:0.4};
}
export interface RoadRound{mode:SpellMode,card:SpellCard,lanes:Vehicle[]}
/** Three crossings per level, words and numbers mixed at random, one vehicle type per lane. */
export function roadRounds(index:number):RoadRound[]{
 const level=roadLevel(index);
 const modes:SpellMode[]=Array.from({length:ROUNDS_PER_LEVEL},()=>Math.random()<level.numberShare?"numbers":"words");
 if(!modes.includes("words"))modes[0]="words";
 const cards={words:spellRound(spellLevel("words",index)),numbers:spellRound(spellLevel("numbers",index))};
 return modes.map((mode,i)=>{
   const card=cards[mode][i];
   const lanes=card.target.split("").map(()=>level.vehicles[Math.floor(Math.random()*level.vehicles.length)]);
   return {mode,card,lanes};
 });
}

/* ---------- What Pip and the narrator say ---------- */
const vehicleName:Record<Vehicle,string>={car:"car",bus:"bus",truck:"truck",train:"train"};
export const roadLines={
 home:"Welcome to Road Rush! Spell words and numbers to help Pip cross the road before the cars come. Press start to begin.",
 levels:"Choose a road, or press play to keep going!",
 countdown:"Three! Two! One!",
 hurry:(v:Vehicle)=>`Hurry up! A ${vehicleName[v]} is coming!`,
 bump:(v:Vehicle)=>v==="train"?"Choo choo! Pip jumped back. Try again!":"Beep beep! Pip jumped back. Try again!",
 allDone:"You helped Pip cross every road! You're a Road Rush champion!",
 listen:"Spell fast to help Pip cross!",
};
export function allRoadLines():string[]{
 const v:Vehicle[]=["car","bus","truck","train"];
 return [...new Set([roadLines.home,roadLines.levels,roadLines.countdown,roadLines.allDone,...v.map(roadLines.hurry),...v.map(roadLines.bump)])];
}
