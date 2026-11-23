export const words=["","one","two","three","four","five","six","seven","eight","nine","ten"];
export const worlds=["Meadow Trail","Rainbow River","Starlight Summit"];
export const levels=Array.from({length:120},(_,index)=>{
 const world=Math.floor(index/40), stage=index%40;
 return {world,name:worlds[world],max:Math.min(10,3+Math.floor(index/7)),count:5+Math.floor(index/24),
   choices:Math.min(5,2+Math.floor(index/30)),seconds:12-index/24,
   task:(world===2&&(stage%3===2||index===119)?"after":world>0&&stage%3!==0?"count":"name") as Task};
});
export function shuffle<T>(items:T[]):T[]{
 const copy=[...items];
 for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];}
 return copy;
}
export function round(index:number){
 const level=levels[index], first=level.task==="after"?2:1;
 const pool=Array.from({length:level.max-first+1},(_,i)=>i+first);
 let targets:number[]=[];
 while(targets.length<level.count){
   const cycle=index<7?pool.map((_,i)=>pool[(i+index)%pool.length]):shuffle(pool);
   targets=targets.concat(cycle);
 }
 return targets.slice(0,level.count).map(target=>({target,options:shuffle([target,...shuffle(Array.from({length:level.max},(_,i)=>i+1).filter(n=>n!==target)).slice(0,level.choices-1)])}));
}
// Common speech-recogniser mishearings of young children's number words.
const aliases:Record<string,number>={won:1,wan:1,to:2,too:2,tu:2,tree:3,free:3,thee:3,for:4,fore:4,fo:4,fife:5,fi:5,hive:5,sex:6,sicks:6,sick:6,sax:6,seben:7,ate:8,eigh:8,nein:9,nine:9,nyne:9,tin:10,tan:10};
// Filler that can surround a number: "it's a five", "um, three please", "I think it's seven".
const filler=new Set(["unk","it","its","it's","is","a","an","the","number","um","uhm","uh","er","erm","i","think","say","says","please","that","that's","thats","oh","ok","okay","yes","yeah","maybe","there","are","dots","dot"]);
function numberWord(token:string){
 if(/^(10|[1-9])$/.test(token))return Number(token);
 const index=words.indexOf(token);
 return index>0?index:aliases[token]??0;
}
/** Returns 1–10 when the transcript clearly names one number, otherwise 0 (unrecognised). */
export function spokenNumber(text:string){
 const tokens=text.toLowerCase().replace(/[’]/g,"'").replace(/[^a-z0-9' ]+/g," ").split(/\s+/).filter(t=>t&&!filler.has(t));
 if(!tokens.length)return 0;
 const values=tokens.map(numberWord);
 // Children often repeat themselves ("five, five!"); accept that, but not mixed or unknown words.
 return values.every(v=>v>0&&v===values[0])?values[0]:0;
}
export type Dot={row:number,col:number,filled:boolean};
const dice:Record<number,[number,number][]>={1:[[2,2]],2:[[1,1],[3,3]],3:[[1,1],[2,2],[3,3]],4:[[1,1],[1,3],[3,1],[3,3]],
 5:[[1,1],[1,3],[2,2],[3,1],[3,3]],6:[[1,1],[2,1],[3,1],[1,3],[2,3],[3,3]]};
/** Dice patterns for 1–6 (recognisable at a glance), a ten-frame for 7–10 (five on top, the rest below). */
export function dotLayout(n:number):{kind:"dice"|"frame",dots:Dot[]}{
 if(n<=6)return {kind:"dice",dots:(dice[n]??[]).map(([row,col])=>({row,col,filled:true}))};
 return {kind:"frame",dots:Array.from({length:10},(_,i)=>({row:i<5?1:2,col:i%5+1,filled:i<n}))};
}
export type Saved={stars:number,badges:number[],sound:boolean,music:boolean,motion:boolean,voice:boolean,narrate:boolean,chosen:boolean,completed:number[],resume:number,spell:SpellProgress,road:RoadProgress};
/** Road Rush progress: finished levels and where to continue (40 levels). */
export type RoadProgress={done:number[],resume:number};
/** Spell It progress: finished levels and where to continue, per mode (40 levels each). */
export type SpellProgress={words:number[],numbers:number[],resumeWords:number,resumeNumbers:number};
export const initial:Saved={stars:0,badges:[],sound:true,music:true,motion:true,voice:false,narrate:true,chosen:false,completed:[],resume:0,spell:{words:[],numbers:[],resumeWords:0,resumeNumbers:0},road:{done:[],resume:0}};
function ids(value:unknown,max:number):number[]{
 return Array.isArray(value)?[...new Set<number>(value.filter(n=>Number.isInteger(n)&&n>=0&&n<max))]:[];
}
export function restore(raw:string|null):Saved{
 try{
 const v=JSON.parse(raw??"null");if(!v||typeof v!=="object")return initial;
 return {stars:Number.isSafeInteger(v.stars)&&v.stars>=0?v.stars:0,badges:ids(v.badges,4),sound:v.sound!==false,music:v.music!==false,motion:v.motion!==false,voice:v.voice===true,narrate:v.narrate!==false,chosen:v.chosen===true||v.voice===true,completed:ids(v.completed,levels.length),resume:ids([v.resume],levels.length)[0]??0,spell:{words:ids(v.spell?.words,40),numbers:ids(v.spell?.numbers,40),resumeWords:ids([v.spell?.resumeWords],40)[0]??0,resumeNumbers:ids([v.spell?.resumeNumbers],40)[0]??0},road:{done:ids(v.road?.done,40),resume:ids([v.road?.resume],40)[0]??0}};
 }catch{return initial;}
}

/* ---------- Everything the narrator says ----------
 Every sentence the game can speak is built here, so the offline voice generator
 (scripts/make-voice.mjs) can pre-record each one and the game can play the matching clip. */
export type Task="name"|"count"|"after";
const praises=["Yes! That's ","You found ","Woohoo! It's ","Super! That's ","Hooray! It's ","Brilliant! That's "];
export const lines={
 levelIntro:(tier:number)=>"Level "+(tier+1)+"!",
 question:(task:Task,target:number)=>task==="count"?"How many dots?":task==="after"?"What comes after "+words[target-1]+"?":"What number is this?",
 praise:(step:number,n:number)=>praises[step%praises.length]+words[n]+"!",
 nudge:(task:Task,target:number)=>task==="count"?"Not quite. Let's count the dots together, one at a time.":task==="after"?"Not quite. Count up from "+words[target-1]+". What comes next?":"Not quite. Look at the number friend and try again.",
 reveal:(n:number)=>"Let's try together. Say "+words[n]+", or tap "+n+".",
 stillThere:"Are you still there? Take your time.",
 clue:(n:number)=>"Here's a clue. It's "+words[n]+". Say "+words[n]+"!",
 breakTime:"Let's take a little break. Tap keep playing when you're ready!",
 levelDone:"Level complete! Get ready for the next one!",
 allDone:"You did it! You finished Starlight Summit! You're a number superstar!",
 listening:"Listening… say the number.",
 home:"Welcome to Say and Play! Press let's play, then pick a game.",
 picker:"Pick a game! Play Number Playroom, Spell It, or Road Rush!",
 numbersHome:"Welcome to the Number Playroom! Meet a number, say its name, or tap the answer, and collect stars! Press start to begin.",
 levels:(world:number)=>"Choose a level in "+worlds[world]+", or press the big play button to keep going!",
 setup:"How shall we play? A grown-up can choose voice and tap, or tap only.",
 parents:"Parent settings. Choose sounds, music, spoken guidance, moving tiles, and voice play.",
 rewards:"My rewards! Look at all the stars you collected!",
 micDenied:"The microphone is switched off. You can tap your answer.",
 micUnavailable:"Voice is resting. Tap your answer, or press say my answer.",
};
/** Every fixed sentence, for pre-recording. Keep in sync by only building sentences through `lines`. */
export function allLines():string[]{
 const out=new Set<string>();
 for(const [k,v] of Object.entries(lines))if(typeof v==="string"&&k!=="listening")out.add(v);
 levels.forEach((_,t)=>out.add(lines.levelIntro(t)));
 worlds.forEach((_,w)=>out.add(lines.levels(w)));
 for(let n=1;n<=10;n++){
   for(const task of ["name","count","after"] as const){if(task!=="after"||n>1){out.add(lines.question(task,n));out.add(lines.nudge(task,n));}}
   praises.forEach((_,s)=>out.add(lines.praise(s,n)));out.add(lines.reveal(n));out.add(lines.clue(n));
 }
 return [...out];
}
/** Stable file name for a sentence's recorded clip (FNV-1a hash). */
export function clipName(text:string){
 let h=0x811c9dc5;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;}
 return h.toString(16).padStart(8,"0")+".mp3";
}
