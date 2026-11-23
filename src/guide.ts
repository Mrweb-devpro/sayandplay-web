import {clipName} from "./game";
import {music} from "./speech";

/** Plays one pre-recorded narrator clip. Resolves false if the clip is missing so we can fall back. */
function playClip(text:string,signal:AbortSignal):Promise<boolean>{
 return new Promise(resolve=>{
   const clip=new Audio("/voice/"+clipName(text));
   let settled=false;
   function finish(ok:boolean){if(settled)return;settled=true;signal.removeEventListener("abort",cancel);clip.onended=null;clip.onerror=null;resolve(ok);}
   function cancel(){clip.pause();finish(true);}
   signal.addEventListener("abort",cancel,{once:true});
   clip.onended=()=>finish(true);clip.onerror=()=>finish(false);
   clip.play().catch(()=>finish(false));
 });
}

/** Device speech synthesis: only used if a recorded clip is missing. */
function synth(text:string,signal:AbortSignal):Promise<void>{
 return new Promise(resolve=>{
   if(signal.aborted||!window.speechSynthesis){resolve();return;}
   const engine=window.speechSynthesis, line=new SpeechSynthesisUtterance(text);
   const voices=engine.getVoices().filter(v=>/^en\b/i.test(v.lang));
   line.voice=voices.find(v=>v.localService)??voices[0]??null;
   line.lang=line.voice?.lang??"en-US";line.rate=1.04;line.pitch=1.15;
   function finish(){clearTimeout(watchdog);signal.removeEventListener("abort",cancel);line.onend=null;line.onerror=null;resolve();}
   function cancel(){finish();engine.cancel();}
   const watchdog=setTimeout(cancel,Math.max(3500,text.length*115));
   signal.addEventListener("abort",cancel,{once:true});line.onend=finish;line.onerror=finish;
   try{engine.speak(line);}catch{finish();}
 });
}

/** Says one or more sentences in order with the recorded playful voice. */
export async function speak(parts:string|(string|false|null|undefined)[],enabled:boolean,signal:AbortSignal):Promise<void>{
 const queue=(Array.isArray(parts)?parts:[parts]).filter((p):p is string=>Boolean(p));
 if(!enabled||!queue.length)return;
 music.duck("speaking",true);
 try{
   for(const text of queue){
     if(signal.aborted)return;
     if(!(await playClip(text,signal))&&!signal.aborted)await synth(text,signal);
   }
 }finally{music.duck("speaking",false);}
}
