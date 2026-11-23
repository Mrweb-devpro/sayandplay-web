import {useEffect,useRef,useState} from "react";
import {useNavigate,useParams,Navigate} from "react-router";
import {Star,ArrowLeft,ArrowRight,Mic,Pause,Play} from "lucide-react";
import {levels,round,spokenNumber,words,dotLayout,lines} from "./game";
import {chime,oops,fanfare,music} from "./speech";
import {speak} from "./guide";
import {useShell,usePlaying,useHeadingFocus} from "./shell";

const milestones=[0,39,79,119];
const SILENCE_MS=5000; // how long to wait for an answer before checking on the child

/** Route /numbers/level/:n — remounts for every level so each starts fresh. */
export default function NumberGameRoute(){
 const n=Number(useParams().n);
 if(!Number.isInteger(n)||n<1||n>levels.length)return <Navigate to="/numbers/levels" replace/>;
 return <NumberGame key={n} tier={n-1}/>;
}

/** Game 1, Number Playroom: name the number, count the dots, or say what comes next. */
function NumberGame({tier}:{tier:number}){
 const shell=useShell(), {save,setSave,panel,openPanel,engaged,attempt,supported,listener,pendingArm,announce,audio}=shell;
 const navigate=useNavigate();
 usePlaying();
 const titleRef=useHeadingFocus();
 const [screen,setScreen]=useState<"game"|"results">("game");
 const [cards]=useState(()=>round(tier)),[step,setStep]=useState(0);
 const [celebrate,setCelebrate]=useState(false),[hint,setHint]=useState(""),[remindText,setRemindText]=useState("");
 const [listening,setListening]=useState(false),[misses,setMisses]=useState(0),[turn,setTurn]=useState(0);
 const locked=useRef(false),silent=useRef(0),session=useRef<AbortController|null>(null);
 const card=cards[step],level=levels[tier];
 const question=lines.question(level.task,card?.target??2);
 useEffect(()=>{setSave(s=>({...s,resume:tier}));},[]);

 function answer(n:number){
   if(locked.current||!card||panel||document.hidden)return;
   session.current?.abort();setRemindText("");silent.current=0;
   if(n!==card.target){
     // First miss: a nudge that keeps the puzzle. Second miss: show the answer.
     setHint(misses===0?lines.nudge(level.task,card.target):lines.reveal(card.target));
     if(save.sound&&audio.current)oops(audio.current);
     setMisses(m=>m+1);setTurn(t=>t+1);return;
   }
   locked.current=true;setCelebrate(true);setHint(lines.praise(step+tier,n));
   if(save.sound&&audio.current)chime(audio.current);
   const last=step===cards.length-1, badge=milestones.indexOf(tier);
   setSave(s=>({...s,stars:s.stars+1,completed:last?[...new Set([...s.completed,tier])]:s.completed,resume:last?Math.min(tier+1,119):tier,
     badges:last&&badge>=0?[...new Set([...s.badges,badge])]:s.badges}));
 }
 // The narrator: speaks the question, then listens and keeps the game moving on its own.
 useEffect(()=>{
   if(!engaged||panel||document.hidden)return;
   const controller=new AbortController(),signal=controller.signal;session.current=controller;
   let timer:ReturnType<typeof setTimeout>|undefined;
   const say=(text:Parameters<typeof speak>[0])=>speak(text,save.narrate,signal);
   function stopEar(){pendingArm.current=null;listener.current?.disarm();music.duck("listening",false);setListening(false);}
   signal.addEventListener("abort",stopEar);
   async function guide(){
     const notice=announce.current;announce.current="";
     if(screen==="results"){
       if(save.sound&&audio.current)fanfare(audio.current);
       await say(tier===119?lines.allDone:lines.levelDone);
       // Next level gets its own address; "replace" keeps Back pointing at the level list.
       if(!signal.aborted&&tier<119)timer=setTimeout(()=>navigate("/numbers/level/"+(tier+2),{replace:true}),1500);return;
     }
     if(!card)return;
     if(celebrate){
       await say(hint);if(signal.aborted)return;
       timer=setTimeout(()=>{if(step+1===cards.length)setScreen("results");else setStep(step+1);setMisses(0);setHint("");setRemindText("");setCelebrate(false);locked.current=false;silent.current=0;},500);return;
     }
     await say([notice,step===0&&!hint&&lines.levelIntro(tier),hint||question]);if(signal.aborted)return;
     /** Arms the always-on microphone: a number answers, anything else (chatter, coughs) is ignored. */
     function listenNow(){
       if(signal.aborted||!save.voice||!supported)return;
       const ear=listener.current;
       if(!ear){pendingArm.current=listenNow;return;} // still warming up: arm as soon as it is ready
       ear.arm(text=>{
         if(signal.aborted)return;
         // Only a clear number counts. Other sounds (TV, chatter) neither answer nor delay the check-ins.
         const n=spokenNumber(text);
         if(n)answer(n);
       });
       music.duck("listening",true);setListening(true);
     }
     function restartSilence(){clearTimeout(timer);timer=setTimeout(()=>void checkIn(),SILENCE_MS);}
     /** No answer for a while: check on the child, then give a clue, then take a break. */
     async function checkIn(){
       if(signal.aborted)return;
       const k=silent.current++;
       if(k>=2){silent.current=0;openPanel("pause");return;}
       stopEar();
       const text=k===0?lines.stillThere:lines.clue(card.target);
       setRemindText(text);
       await say(k===0?[text,question]:text);if(signal.aborted)return;
       listenNow();restartSilence();
     }
     listenNow();restartSilence();
   }
   void guide();
   return ()=>{controller.abort();clearTimeout(timer);};
 },[engaged,screen,panel,step,celebrate,attempt,turn,save.narrate,save.voice,supported]);
 function retry(){session.current?.abort();setRemindText("");setHint("");silent.current=0;shell.retryVoice();}
 const status=save.voice&&supported?(shell.voiceState==="loading"?"Getting my ears ready…":listening?lines.listening:"Say the number or tap your answer."):"Tap your answer.";

 if(!engaged)return <TapToStart title={"Level "+(tier+1)}/>;
 if(screen==="results")return <section className="board result"><span className="bigStar"><Star size={60} fill="#ffcc4f"/></span><h1 {...titleRef}>You did it!</h1><p className="lead">Level {tier+1} complete · {cards.length} stars</p><p>{tier<119?"Level "+(tier+2)+" starts automatically.":"You reached the end of the trail!"}</p><button className="back" onClick={()=>openPanel("pause")}><Pause/>Take a break</button><button className="back" onClick={()=>navigate("/numbers/levels")}>Choose a level <ArrowRight/></button></section>;
 return <section className="board"><div className="boardBar"><button className="pill" onClick={()=>navigate("/numbers/levels")} aria-label="Back to levels"><ArrowLeft size={16}/> Levels</button><strong>Level {tier+1} · {level.name}</strong><button className="pill" onClick={()=>openPanel("pause")}><Pause size={16}/> Pause</button></div><p className="eyebrow justify-center">NUMBER {step+1} OF {cards.length}</p><h1 {...titleRef}>{question}</h1><div className="track"><div role="img" aria-label={level.task==="count"?"Count the dots":level.task==="after"?"Find the next number":"Target number "+card.target} className={"tile "+(celebrate?"won":"")} style={{animationDuration:(hint?18:level.seconds)+"s",animationPlayState:panel||celebrate?"paused":"running"}}>{level.task==="count"?<span className={"dotGroup "+dotLayout(card.target).kind}>{dotLayout(card.target).dots.map((d,i)=><i key={i} className={d.filled?undefined:"empty"} style={{gridRow:d.row,gridColumn:d.col}}/>)}</span>:<>{level.task==="after"?card.target-1:card.target}<small>{words[level.task==="after"?card.target-1:card.target]}</small></>}</div></div>
 <p className="feedback" role="status">{celebrate&&<Star fill="#ffce57"/>}{(celebrate?hint:shell.micMessage)||remindText||hint||status}</p><div className="choices">{card.options.map(n=><button disabled={celebrate} key={n} aria-label={"Answer "+n} onClick={()=>answer(n)}>{n}</button>)}</div><button className="voice" disabled={celebrate} onClick={()=>supported&&save.voice?retry():openPanel("parents")}><Mic size={18}/>{save.voice&&supported?"Say my answer":"Voice settings"}</button></section>;
}

/** Opening a level straight from its address (a bookmark or refresh): one tap is needed before sound can play. */
export function TapToStart({title}:{title:string}){
 return <section className="board result"><h1>{title}</h1><p className="lead">Ready when you are!</p><button className="primary tapStart"><Play fill="currentColor"/>Tap to play</button></section>;
}
