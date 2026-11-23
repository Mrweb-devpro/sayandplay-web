import {speechEngine,type Recognition} from "./speech";

/** An always-on ear. While armed, everything heard is passed to the handler as text ("[unk]" for noise). */
export interface Listener{
 kind:"offline"|"browser";
 /** Start passing what is heard to onText. `vocabulary` limits recognition to those words (default: one–ten). */
 arm(onText:(text:string)=>void,vocabulary?:string[]):void;
 disarm():void;
 close():void;
}
export type ListenFailure="denied"|"unavailable";

const numberWords=["one","two","three","four","five","six","seven","eight","nine","ten"];
type VoskModel=Awaited<ReturnType<typeof import("vosk-browser").createModel>>;
let modelPromise:Promise<VoskModel>|null=null;
const MODEL_URL="/models/vosk-en-small.tar.gz";
/** Loads the bundled offline model once per page (about 40 MB, served from this app, no internet needed). */
function loadModel(){
 modelPromise??=Promise.race([
   // Check the model file is there first: Vosk's worker never reports a failed download.
   fetch(MODEL_URL,{method:"HEAD"}).then(r=>{if(!r.ok)throw new Error("model missing");})
     .then(()=>import("vosk-browser")).then(({createModel})=>createModel(MODEL_URL,-1)),
   // Unpacking takes a few seconds; if it never finishes, fall back instead of waiting forever.
   new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error("model timeout")),60000)),
 ]);
 modelPromise.catch(()=>{modelPromise=null;});
 return modelPromise;
}

async function microphone(){
 return navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1}});
}

/** Offline recognition with Vosk, limited to the number words so children's speech is matched reliably. */
async function offlineListener(stream:MediaStream):Promise<Listener>{
 const model=await loadModel();
 const ctx=new AudioContext();void ctx.resume().catch(()=>{});
 let handler:((text:string)=>void)|null=null;
 // One recogniser per word list; switching lists (numbers ↔ letter tiles) swaps the recogniser.
 let recognizer:InstanceType<VoskModel["KaldiRecognizer"]>|null=null, current="";
 function use(words:string[]){
   const key=JSON.stringify(words.includes("[unk]")?words:[...words,"[unk]"]);
   if(key===current&&recognizer)return;
   try{recognizer?.remove();}catch{}
   const r=new model.KaldiRecognizer(ctx.sampleRate,key);current=key;recognizer=r;
   r.on("result",message=>{
     if(r!==recognizer)return;
     const text=(message as {result:{text:string}}).result.text;
     if(handler&&text)handler(text);
   });
 }
 use(numberWords);
 const source=ctx.createMediaStreamSource(stream), node=ctx.createScriptProcessor(4096,1,1);
 // Only feed audio while armed: the narrator's own voice never reaches the recogniser.
 node.onaudioprocess=event=>{if(handler&&recognizer)try{recognizer.acceptWaveform(event.inputBuffer);}catch{}};
 source.connect(node);node.connect(ctx.destination);
 return {
   kind:"offline",
   arm(onText,vocabulary){if(ctx.state==="suspended")void ctx.resume().catch(()=>{});use(vocabulary??numberWords);handler=onText;},
   disarm(){if(handler){handler=null;try{recognizer?.retrieveFinalResult();}catch{}}},
   close(){handler=null;node.onaudioprocess=null;try{source.disconnect();node.disconnect();recognizer?.remove();}catch{}stream.getTracks().forEach(t=>t.stop());void ctx.close().catch(()=>{});},
 };
}

/** Fallback: the browser's built-in recogniser, restarted continuously while armed. May need internet. */
function browserListener(onFailure:(reason:ListenFailure)=>void):Listener|null{
 const Engine=speechEngine();if(!Engine)return null;
 let active:Recognition|null=null,restart:ReturnType<typeof setTimeout>|undefined,handler:((text:string)=>void)|null=null;
 function stop(){clearTimeout(restart);if(active){active.onresult=null;active.onerror=null;active.onend=null;try{active.abort();}catch{}active=null;}}
 function begin(){
   if(!handler||!Engine)return;
   try{
     const r=new Engine();active=r;r.lang="en-US";r.continuous=false;r.interimResults=false;
     r.onresult=e=>{const text=e.results[0]?.[0]?.transcript??"";if(text)handler?.(text);};
     r.onerror=e=>{if(e.error==="not-allowed"||e.error==="service-not-allowed"){handler=null;stop();onFailure("denied");}};
     r.onend=()=>{active=null;if(handler)restart=setTimeout(begin,300);};
     r.start();
   }catch{handler=null;onFailure("unavailable");}
 }
 return {
   kind:"browser",
   arm(onText){const was=handler;handler=onText;if(!was)begin();},
   disarm(){handler=null;stop();},
   close(){handler=null;stop();},
 };
}

/** Opens the microphone once and keeps it ready for the whole play session. */
export async function openListener(onFailure:(reason:ListenFailure)=>void):Promise<Listener|null>{
 if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){const b=browserListener(onFailure);if(!b)onFailure("unavailable");return b;}
 let stream:MediaStream;
 try{stream=await microphone();}
 catch(error){onFailure((error as DOMException)?.name==="NotAllowedError"?"denied":"unavailable");return null;}
 try{return await offlineListener(stream);}
 catch{
   stream.getTracks().forEach(t=>t.stop());
   const b=browserListener(onFailure);if(!b)onFailure("unavailable");return b;
 }
}
/** Starts downloading/unpacking the offline model early (e.g. when the level list opens). */
export function warmUp(){void loadModel().catch(()=>{});}
