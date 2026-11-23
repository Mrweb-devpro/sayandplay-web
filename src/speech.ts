export interface Recognition {
 processLocally?:boolean; onstart:(()=>void)|null; lang:string; continuous:boolean; interimResults:boolean;
 onresult:((e:{results:ArrayLike<ArrayLike<{transcript:string}>>})=>void)|null;
 onerror:((e:{error:string})=>void)|null; onend:(()=>void)|null;
 start():void;abort():void;
}
export function speechEngine(){
 type Engine={new():Recognition;available?:(options:{langs:string[],processLocally:boolean})=>Promise<string>};
 const browser=window as Window & {SpeechRecognition?:Engine;webkitSpeechRecognition?:Engine};
 return window.isSecureContext?(browser.SpeechRecognition??browser.webkitSpeechRecognition):undefined;
}

function note(ctx:AudioContext,hz:number,start:number,length:number,volume:number,type:OscillatorType="triangle",out:AudioNode=ctx.destination){
 const osc=ctx.createOscillator(), gain=ctx.createGain();
 osc.type=type;osc.frequency.value=hz;
 gain.gain.setValueAtTime(0.0001,start);gain.gain.exponentialRampToValueAtTime(volume,start+0.015);gain.gain.exponentialRampToValueAtTime(0.0001,start+length);
 osc.connect(gain);gain.connect(out);osc.start(start);osc.stop(start+length+0.02);
}
/** Correct answer: a bright rising sparkle. */
export function chime(ctx:AudioContext){
 const t=ctx.currentTime;[523.25,659.25,783.99,1046.5].forEach((hz,i)=>note(ctx,hz,t+i*0.08,0.3,0.07));
}
/** Wrong answer: a soft, friendly "boop-boop" (never harsh). */
export function oops(ctx:AudioContext){
 const t=ctx.currentTime;note(ctx,392,t,0.22,0.05,"sine");note(ctx,329.63,t+0.16,0.3,0.05,"sine");
}
/** Level complete: a short happy fanfare. */
export function fanfare(ctx:AudioContext){
 const t=ctx.currentTime;
 [[523.25,0],[659.25,.12],[783.99,.24],[1046.5,.36],[783.99,.56],[1046.5,.68]].forEach(([hz,at])=>note(ctx,hz,t+at,0.35,0.07));
 [261.63,329.63,392].forEach(hz=>note(ctx,hz,t+0.68,0.9,0.03,"sine"));
}

/** Word or number finished: a bouncy "hoo-ray!" flourish with sparkles on top. */
export function hooray(ctx:AudioContext){
 const t=ctx.currentTime;
 [[392,0,.18],[523.25,.14,.18],[659.25,.28,.16],[783.99,.4,.45]].forEach(([hz,at,len])=>{note(ctx,hz,t+at,len,0.08,"square");note(ctx,hz/2,t+at,len,0.04,"triangle");});
 [1568,1975.5,2349.3,2637,3136].forEach((hz,i)=>note(ctx,hz,t+0.45+i*0.06,0.18,0.025,"sine"));
}

/* Gentle generated background music: a music-box melody over soft bass, in C major pentatonic.
   It ducks while the narrator speaks or the game listens, so voices stay clear. */
const melody=[0,2,4,2, 5,4,2,null, 4,5,7,5, 4,2,0,null, 2,4,5,4, 7,5,4,2, 0,2,4,5, 4,2,0,null];
// Index = step of the C major scale; the melody only uses C, D, E, G, A (pentatonic: nothing clashes).
const scale=[523.25,587.33,659.25,698.46,783.99,880,987.77,1046.5]; // C5..C6
const bass=[130.81,174.61,196,130.81]; // C, F, G, C
function createMusic(){
 let ctx:AudioContext|null=null,bus:GainNode|null=null,timer:ReturnType<typeof setInterval>|undefined,step=0,next=0;
 const ducks=new Set<string>();
 const beat=0.36;
 function level(){return ducks.has("speaking")?0.18:ducks.has("listening")?0.4:1;}
 function apply(){if(ctx&&bus)bus.gain.setTargetAtTime(0.5*level(),ctx.currentTime,0.15);}
 function schedule(){
   if(!ctx||!bus)return;
   while(next<ctx.currentTime+0.6){
     const degree=melody[step%melody.length];
     if(degree!==null){note(ctx,scale[degree],next,0.55,0.05,"sine",bus);note(ctx,scale[degree]*2,next,0.25,0.012,"triangle",bus);}
     if(step%4===0)note(ctx,bass[Math.floor(step/8)%bass.length],next,beat*3.6,0.045,"sine",bus);
     step++;next+=beat;
   }
 }
 return {
   start(audio:AudioContext){
     if(timer&&ctx===audio)return;
     this.stop();ctx=audio;bus=audio.createGain();bus.gain.value=0.0001;bus.connect(audio.destination);
     next=audio.currentTime+0.1;apply();schedule();timer=setInterval(schedule,200);
   },
   stop(){
     clearInterval(timer);timer=undefined;
     if(ctx&&bus){const b=bus;b.gain.setTargetAtTime(0.0001,ctx.currentTime,0.2);setTimeout(()=>b.disconnect(),1200);}
     bus=null;
   },
   duck(reason:"speaking"|"listening",on:boolean){if(on)ducks.add(reason);else ducks.delete(reason);apply();},
 };
}
export const music=createMusic();
