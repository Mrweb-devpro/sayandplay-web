/* Game 2 — Spell It.
   Words mode: spell foods letter by letter. Numbers mode: build numbers digit by digit (1, 5 → 15).
   Children say each letter/digit (or tap the scrambled tiles); the word fills empty boxes one by one. */
import {shuffle} from "./game.ts";

export type SpellMode="words"|"numbers";
export interface Food{word:string,emoji:string}
const foods=(list:string)=>list.split(" ").map(item=>{const [word,emoji]=item.split(":");return {word,emoji};});
// Short, common foods first; nothing tricky like "cabbage" until the very last stage.
export const pantry={
 3:foods("egg:🥚 pie:🥧 tea:🍵 nut:🥜 ham:🍖 yam:🍠"),
 4:foods("cake:🍰 corn:🌽 pear:🍐 kiwi:🥝 rice:🍚 milk:🥛 soup:🍲 fish:🐟 taco:🌮"),
 5:foods("apple:🍎 mango:🥭 lemon:🍋 grape:🍇 melon:🍈 peach:🍑 bread:🍞 pizza:🍕 honey:🍯"),
 6:foods("banana:🍌 cherry:🍒 carrot:🥕 potato:🥔 orange:🍊 tomato:🍅 cookie:🍪 cheese:🧀"),
 7:foods("coconut:🥥 pumpkin:🎃 avocado:🥑 sandwich:🥪 pineapple:🍍 watermelon:🍉"),
};
export const allFoods=Object.values(pantry).flat();

const digitNames=["zero","one","two","three","four","five","six","seven","eight","nine"];
const teens=["ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"];
const tensNames=["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];
/** 0–100 as words: 25 → "twenty-five". */
export function numberName(n:number):string{
 if(n===100)return "one hundred";
 if(n<10)return digitNames[n];
 if(n<20)return teens[n-10];
 return tensNames[Math.floor(n/10)]+(n%10?"-"+digitNames[n%10]:"");
}
const range=(from:number,to:number)=>Array.from({length:to-from+1},(_,i)=>from+i);

export interface SpellLevel{mode:SpellMode,index:number,stage:number,hidden:boolean,extra:number,words:Food[],numbers:number[]}
export const SPELL_LEVELS=40, ITEMS_PER_LEVEL=3;
/** 40 levels per mode in 4 stages. Every 5th level (and every other level in the last stage) is a
    "memory level": the word or number is hidden and must be spelled from the spoken prompt alone. */
export function spellLevel(mode:SpellMode,index:number):SpellLevel{
 const stage=Math.floor(index/10), late=index%10>=5;
 const hidden=(index+1)%5===0||(stage===3&&index%2===1);
 const extra=stage<2?1:2; // at least one extra tile, so even "11" or "egg" can be scrambled
 const wordPools=[late?[...pantry[3],...pantry[4]]:pantry[3],late?[...pantry[4],...pantry[5]]:pantry[4],late?[...pantry[5],...pantry[6]]:pantry[5],late?[...pantry[6],...pantry[7]]:pantry[6]];
 const numberPools=[range(10,20),range(10,50),range(10,99),range(20,100)];
 return {mode,index,stage,hidden,extra,words:wordPools[stage],numbers:numberPools[stage]};
}

export interface SpellCard{target:string,label:string,emoji:string,tiles:string[]}
const ALPHABET="abcdefghijklmnoprstuvwyz".split(""); // q and x are left out as distractors (rare, confusing)
/** Three items for a level, each with its letters/digits scrambled into tiles plus a few distractors. */
export function spellRound(level:SpellLevel):SpellCard[]{
 const picks=level.mode==="words"?shuffle(level.words).slice(0,ITEMS_PER_LEVEL).map(f=>({target:f.word,label:f.word,emoji:f.emoji}))
   :shuffle(level.numbers).slice(0,ITEMS_PER_LEVEL).map(n=>({target:String(n),label:String(n),emoji:""}));
 return picks.map(p=>{
   const chars=p.target.split(""), pool=level.mode==="words"?ALPHABET:"0123456789".split("");
   const extras=shuffle(pool.filter(c=>!chars.includes(c))).slice(0,level.extra);
   let tiles=shuffle([...chars,...extras]);
   // Never show the answer already in order: reshuffle, then rotate as a last resort.
   for(let i=0;i<5&&tiles.join("").startsWith(p.target);i++)tiles=shuffle(tiles);
   for(let i=0;i<tiles.length&&tiles.join("").startsWith(p.target);i++)tiles=[...tiles.slice(1),tiles[0]];
   return {...p,tiles};
 });
}

/* ---------- Hearing letters and digits ---------- */
// Ways a letter name can come back from the recogniser (single letters plus their spoken names).
const letterForms:Record<string,string[]>={a:["a","ay"],b:["b","bee","be"],c:["c","see","sea"],d:["d","dee"],e:["e","ee"],f:["f","eff"],g:["g","gee","jee"],
 h:["h"],i:["i","eye"],j:["j","jay"],k:["k","kay"],l:["l","el","ell"],m:["m","em"],n:["n","en"],o:["o","oh"],p:["p","pee","pea"],q:["q","queue","cue"],
 r:["r","are","ar"],s:["s","ess"],t:["t","tee","tea"],u:["u","you"],v:["v","vee"],w:["w","double"],x:["x","ex"],y:["y","why"],z:["z","zee","zed"]};
const digitForms:Record<string,string[]>={0:["zero","oh"],1:["one"],2:["two"],3:["three"],4:["four"],5:["five"],6:["six"],7:["seven"],8:["eight"],9:["nine"]};
const formToSymbol:Record<string,string>={};
for(const [s,forms] of Object.entries(letterForms))for(const f of forms)formToSymbol["L:"+f]=s;
for(const [s,forms] of Object.entries(digitForms))for(const f of forms)formToSymbol["D:"+f]=s;
Object.assign(formToSymbol,{"D:to":"2","D:too":"2","D:for":"4","D:won":"1","D:ate":"8"});

/** Words the offline recogniser should listen for: only the tiles on screen (far more accurate than
    the whole alphabet), plus the full number name in numbers mode ("fifteen" builds 15 at once). */
export function spellVocabulary(mode:SpellMode,card:SpellCard):string[]{
 const unique=[...new Set(card.tiles)];
 const words=unique.flatMap(s=>mode==="words"?letterForms[s]:digitForms[s]);
 if(mode==="numbers")words.push(...numberName(Number(card.target)).split(/[- ]/));
 return [...new Set(words),"[unk]"];
}
/** Letters or digits heard in a transcript, in order. Noise and unknown words are dropped. */
export function heardSymbols(mode:SpellMode,text:string):string[]{
 const tag=mode==="words"?"L:":"D:";
 return text.toLowerCase().replace(/[^a-z0-9 ]+/g," ").split(/\s+/).filter(Boolean).flatMap(token=>{
   if(mode==="numbers"&&/^\d+$/.test(token))return token.split("");
   if(mode==="words"&&token.length===1&&/[a-z]/.test(token))return [token];
   const s=formToSymbol[tag+token];return s?[s]:[];
 });
}
/** True when the child said the whole number ("fifteen" / "15") instead of its digits. */
export function saidWholeNumber(text:string,target:string){
 const clean=text.toLowerCase().replace(/[^a-z0-9 -]+/g," ").replace(/\s+/g," ").trim();
 return clean.split(" ").includes(target)||clean.replace(/ /g,"-").includes(numberName(Number(target)));
}

/* ---------- Everything the narrator says in Spell It ---------- */
/** On screen, letters lose the quote marks used to make the narrator say the letter name. */
export const showLine=(text:string)=>text.replace(/"([A-Z])"/g,"$1");
const L=(s:string)=>`"${s.toUpperCase()}"`; // quoted capital: shown as "G", spoken as the letter name
const spokenSymbol=(mode:SpellMode,s:string)=>mode==="words"?L(s):digitNames[Number(s)];
export const spellLines={
 home:"Welcome to Spell It! Spell yummy foods and build big numbers. Press start to begin.",
 menu:"Spell It! Choose words to spell yummy foods, or numbers to build big numbers!",
 levels:(mode:SpellMode)=>mode==="words"?"Choose a word level, or press play to keep going!":"Choose a number level, or press play to keep going!",
 prompt:(mode:SpellMode,card:SpellCard)=>mode==="words"?`Spell ${card.target}!`:`Make ${numberName(Number(card.target))}!`,
 good:(mode:SpellMode,s:string)=>spokenSymbol(mode,s)+"!",
 wrong:(mode:SpellMode,s:string)=>`Hmm, ${spokenSymbol(mode,s)} is not next. Try again!`,
 hint:(mode:SpellMode,s:string)=>`Here's a clue. The next ${mode==="words"?"letter":"number"} is ${spokenSymbol(mode,s)}.`,
 done:(mode:SpellMode,card:SpellCard)=>mode==="words"
   ?`Hooray! ${card.target.split("").map(c=>c.toUpperCase()).join(", ")} spells ${card.target}!`
   :`Hooray! You made ${numberName(Number(card.target))}!`,
 allWords:"You spelled every food! You're a super speller!",
 allNumbers:"You built every number! You're a number builder star!",
 listen:"Listen, then spell!",
};
/** Every Spell It sentence, for pre-recording. */
export function allSpellLines():string[]{
 const out=new Set<string>([spellLines.home,spellLines.menu,spellLines.levels("words"),spellLines.levels("numbers"),spellLines.allWords,spellLines.allNumbers]);
 for(const f of allFoods){const card={target:f.word,label:f.word,emoji:f.emoji,tiles:[]};out.add(spellLines.prompt("words",card));out.add(spellLines.done("words",card));}
 for(let n=10;n<=100;n++){const card={target:String(n),label:String(n),emoji:"",tiles:[]};out.add(spellLines.prompt("numbers",card));out.add(spellLines.done("numbers",card));}
 for(const mode of ["words","numbers"] as const)for(const s of mode==="words"?Object.keys(letterForms):Object.keys(digitForms)){
   out.add(spellLines.good(mode,s));out.add(spellLines.wrong(mode,s));out.add(spellLines.hint(mode,s));
 }
 return [...out];
}
