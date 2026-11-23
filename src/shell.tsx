import {createContext,useContext,useEffect,useRef,useState,type Dispatch,type MutableRefObject,type ReactNode,type SetStateAction} from "react";
import {Outlet,useLocation,useNavigate} from "react-router";
import {Star,Medal,Settings2,Hand,Mic,Sparkles,Volume2,X,House,Music,Play,LayoutGrid,ListOrdered} from "lucide-react";
import {initial,restore,lines,type Saved} from "./game";
import {music,speechEngine} from "./speech";
import {speak} from "./guide";
import {openListener,type Listener} from "./listen";
import {useOfflineState} from "./offline";

export type Panel="parents"|"rewards"|"pause"|"setup"|null;
export type VoiceState="off"|"loading"|"ready"|"failed";
const milestones=[0,39,79,119], badges=["First Steps","Meadow Medal","River Medal","Summit Medal"];

/** Everything the games share: progress, settings dialogs, the microphone, sound and the narrator's state. */
export interface Shell{
 save:Saved; setSave:Dispatch<SetStateAction<Saved>>;
 panel:Panel; openPanel:(p:Panel)=>void; closePanel:()=>void;
 engaged:boolean; attempt:number; bump:()=>void;
 supported:boolean; voiceState:VoiceState; micMessage:string;
 listener:MutableRefObject<Listener|null>; pendingArm:MutableRefObject<(()=>void)|null>; announce:MutableRefObject<string>;
 audio:MutableRefObject<AudioContext|null>;
 needSetup:(then:()=>void)=>boolean; retryVoice:()=>void; setPlaying:(on:boolean)=>void;
}
const ShellContext=createContext<Shell|null>(null);
export function useShell(){const shell=useContext(ShellContext);if(!shell)throw new Error("useShell outside Shell");return shell;}

/** Speaks a page's narration when it opens, and again on "Read this screen". */
export function usePageVoice(text:string){
 const {engaged,panel,attempt,save}=useShell();
 useEffect(()=>{
   if(!engaged||panel||document.hidden)return;
   const controller=new AbortController();void speak(text,save.narrate,controller.signal);
   return ()=>controller.abort();
 },[engaged,panel,attempt,text,save.narrate]);
}
/** Marks the page as a play screen: opens the microphone and enables auto-pause while mounted. */
export function usePlaying(){
 const {setPlaying}=useShell();
 useEffect(()=>{setPlaying(true);return ()=>setPlaying(false);},[]);
}
/** Moves keyboard/screen-reader focus to the page heading when a page opens. */
export function useHeadingFocus(){
 const heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{heading.current?.focus();},[]);
 return {ref:heading,tabIndex:-1};
}

/** Where "Choose a level" in the pause dialog should go, based on the current address. */
function levelsPathFor(path:string){
 if(path.startsWith("/numbers"))return "/numbers/levels";
 if(path.startsWith("/road"))return "/road/levels";
 const spell=path.match(/^\/spell\/(words|numbers)/);if(spell)return "/spell/"+spell[1];
 if(path.startsWith("/spell"))return "/spell/modes";
 return null;
}
function themeFor(path:string){return path.startsWith("/numbers")?"numbers":path.startsWith("/spell")?"spell":path.startsWith("/road")?"road":"home";}

export function ShellLayout(){
 const navigate=useNavigate(), {pathname}=useLocation();
 const [save,setSave]=useState(initial),[ready,setReady]=useState(false),[storageError,setStorageError]=useState(false);
 const [panel,setPanel]=useState<Panel>(null),[engaged,setEngaged]=useState(false),[attempt,setAttempt]=useState(0);
 const [supported,setSupported]=useState(false),[micMessage,setMicMessage]=useState("");
 const [voiceState,setVoiceState]=useState<VoiceState>("off"),[voiceKind,setVoiceKind]=useState<Listener["kind"]|null>(null),[voiceRetry,setVoiceRetry]=useState(0);
 const [audioOn,setAudioOn]=useState(false),[playing,setPlaying]=useState(false);
 const blocked=useRef(false),announce=useRef(""),afterSetup=useRef<(()=>void)|null>(null),voiceStateRef=useRef<VoiceState>("off");
 const audio=useRef<AudioContext|null>(null),listener=useRef<Listener|null>(null),pendingArm=useRef<(()=>void)|null>(null);
 const dialog=useRef<HTMLDialogElement>(null);
 const offline=useOfflineState();
 voiceStateRef.current=voiceState;

 useEffect(()=>{
   try{setSave(restore(localStorage.getItem("number-rush-v1")));}catch{setStorageError(true);}
   setSupported(Boolean(window.isSecureContext&&(navigator.mediaDevices?.getUserMedia||speechEngine())));setReady(true);
   // Sound may only start after a tap or key press, so the first one anywhere "wakes up" the narrator.
   function wake(){setEngaged(true);ensureAudio();}
   document.addEventListener("pointerdown",wake);document.addEventListener("keydown",wake);
   return ()=>{document.removeEventListener("pointerdown",wake);document.removeEventListener("keydown",wake);listener.current?.close();music.stop();void audio.current?.close();};
 },[]);
 useEffect(()=>{if(ready){try{localStorage.setItem("number-rush-v1",JSON.stringify(save));}catch{setStorageError(true);}}},[save,ready]);
 useEffect(()=>{if(panel)dialog.current?.showModal();else dialog.current?.close();},[panel]);
 useEffect(()=>{setPanel(null);window.scrollTo(0,0);},[pathname]); // dialogs never follow you to another page
 function ensureAudio(){try{audio.current??=new AudioContext();void audio.current.resume().catch(()=>{});setAudioOn(true);}catch{}}
 // Gentle background music (stops during a break).
 useEffect(()=>{if(audioOn&&engaged&&save.music&&panel!=="pause"&&audio.current)music.start(audio.current);else music.stop();},[audioOn,engaged,save.music,panel]);
 // The microphone opens when a game starts and stays ready across its levels.
 useEffect(()=>{
   if(!playing||!save.voice||!supported){listener.current?.close();listener.current=null;setVoiceState("off");return;}
   if(listener.current||blocked.current)return;
   let cancelled=false;setVoiceState("loading");
   void openListener(reason=>{
     blocked.current=true;listener.current?.close();listener.current=null;setVoiceState("failed");
     const message=reason==="denied"?lines.micDenied:lines.micUnavailable;setMicMessage(message);announce.current=message;setAttempt(a=>a+1);
   }).then(ear=>{
     if(cancelled){ear?.close();return;}
     if(!ear){setVoiceState("failed");return;}
     listener.current=ear;setVoiceKind(ear.kind);setVoiceState("ready");
     const waiting=pendingArm.current;pendingArm.current=null;waiting?.();
   });
   return ()=>{cancelled=true;};
 },[playing,save.voice,supported,voiceRetry]);
 // Auto-pause in every game: switching tabs, minimising, or clicking into another window.
 useEffect(()=>{
   if(!playing)return;
   const pause=()=>setPanel(p=>p??"pause");
   function visibility(){if(document.hidden)pause();}
   function blur(){if(voiceStateRef.current!=="loading")pause();} // not while the microphone permission prompt is up
   document.addEventListener("visibilitychange",visibility);window.addEventListener("blur",blur);
   return ()=>{document.removeEventListener("visibilitychange",visibility);window.removeEventListener("blur",blur);};
 },[playing]);
 // Narration for the dialogs.
 useEffect(()=>{
   if(!panel||!engaged)return;
   const controller=new AbortController();
   void speak(panel==="setup"?lines.setup:panel==="pause"?lines.breakTime:panel==="parents"?lines.parents:lines.rewards,save.narrate,controller.signal);
   return ()=>controller.abort();
 },[panel,engaged,attempt,save.narrate]);

 const shell:Shell={
   save,setSave,panel,openPanel:p=>{setEngaged(true);ensureAudio();setPanel(p);},closePanel:()=>setPanel(null),
   engaged,attempt,bump:()=>setAttempt(a=>a+1),supported,voiceState,micMessage,listener,pendingArm,announce,audio,
   needSetup:then=>{if(save.chosen||!supported)return false;afterSetup.current=then;setEngaged(true);setPanel("setup");return true;},
   retryVoice:()=>{setMicMessage("");if(blocked.current||voiceState==="failed"){blocked.current=false;setVoiceRetry(r=>r+1);}setAttempt(a=>a+1);},
   setPlaying,
 };
 const levelsPath=levelsPathFor(pathname);
 return <ShellContext.Provider value={shell}><div className={save.motion?"shell":"shell still"} data-theme={themeFor(pathname)}>
 <header><div className="bar">
   <button className="brand" onClick={()=>playing?shell.openPanel("pause"):navigate("/")}><span className="logo"><Sparkles/></span>Say &amp; Play</button>
   <nav><button className="pill" onClick={()=>shell.openPanel("rewards")}><Star size={18} fill="#ffd45c"/>{save.stars} {save.stars===1?"star":"stars"}</button><button className="pill" onClick={()=>shell.openPanel("parents")}><Settings2 size={18}/>Parents</button></nav>
 </div></header>
 <main><Outlet/>
   {pathname!=="/"&&<button className="back" onClick={()=>{setEngaged(true);setAttempt(a=>a+1);}}><Volume2 size={18}/>Read this screen</button>}
   {storageError&&<p role="status">Storage is unavailable. Progress lasts for this visit.</p>}
 </main>
 <footer><span><Sparkles size={17}/> Say &amp; Play</span>{offline!=="unsupported"&&<span className={"offlineBadge "+offline}>{offline==="ready"?"✓ Ready to play offline":"Saving for offline…"}</span>}<span>Learning games for ages 3–6</span></footer>
 <dialog ref={dialog} onCancel={()=>setPanel(null)} aria-labelledby="dialog-title"><div className="modalTop"><h2 id="dialog-title">{panel==="setup"?"How shall we play?":panel==="parents"?"Parent settings":panel==="rewards"?"My rewards":"Taking a break?"}</h2><button className="close" aria-label="Close" onClick={()=>setPanel(null)}><X/></button></div>
 {panel==="setup"&&<><p>With voice play the game listens all through each level, so your child just says the answer — no buttons. Answers are understood right here on this device, without internet. Your browser will ask you once to allow the microphone. Nothing is recorded.</p>{[true,false].map(voice=><button className="back" key={String(voice)} onClick={()=>{setSave(s=>({...s,chosen:true,voice}));setPanel(null);const then=afterSetup.current;afterSetup.current=null;then?.();}}>{voice?<Mic/>:<Hand/>}{voice?"Voice and tap":"Tap only"}</button>)}</>}
 {panel==="parents"&&<>{([{k:"sound",label:"Celebration sounds",Icon:Volume2},{k:"music",label:"Background music",Icon:Music},{k:"narrate",label:"Spoken guidance",Icon:Volume2},{k:"motion",label:"Moving tiles",Icon:Sparkles},{k:"voice",label:"Voice play",Icon:Mic}] as const).map(({k,label,Icon})=><label key={k} className="setting"><Icon size={20}/>{label}<input type="checkbox" disabled={k==="voice"&&!supported} checked={save[k]&&(k!=="voice"||supported)} onChange={e=>{blocked.current=false;setMicMessage("");setSave({...save,[k]:e.target.checked,chosen:k==="voice"||save.chosen});}}/></label>)}<p className="note">{!supported?"Voice recognition is unavailable here. Tap to answer.":voiceKind==="browser"?"Voice play is using the browser’s own recogniser because the offline one could not start; it may need internet.":"Voice play listens all through each level and recognises number words offline, on this device."} After five quiet seconds the guide checks in, then gives a clue, then takes a break. Say &amp; Play saves no audio or transcripts. Stars and settings stay on this device.</p></>}
 {panel==="rewards"&&<><p className="score"><Star fill="#ffd45c"/>{save.stars} stars collected</p><p>Number Playroom: {save.completed.length} of 120 levels · Spell It: {save.spell.words.length+save.spell.numbers.length} of 80 levels · Road Rush: {save.road.done.length} of 40 levels</p><div className="badgeGrid">{badges.map((name,i)=><div key={name} className={save.badges.includes(i)?"badge owned":"badge"}><Medal/><strong>{name}</strong><small>{save.badges.includes(i)?"Earned":"Finish level "+(milestones[i]+1)}</small></div>)}</div></>}
 {panel==="pause"&&<><button className="primary" onClick={()=>setPanel(null)}><Play/>Keep playing</button>
   {levelsPath&&<button className="back" onClick={()=>navigate(levelsPath)}><ListOrdered/>Choose a level</button>}
   <button className="back" onClick={()=>navigate("/games")}><LayoutGrid/>All games</button>
   <button className="back" onClick={()=>navigate("/")}><House/>Home</button></>}
 {panel&&<button className="back" onClick={()=>setAttempt(a=>a+1)}><Volume2 size={18}/>Read this screen</button>}
 </dialog></div></ShellContext.Provider>;
}
export type {ReactNode};
