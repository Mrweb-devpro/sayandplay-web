import {useEffect,useRef,useState} from "react";
import {useNavigate,useParams,Navigate} from "react-router";
import {ArrowLeft,ArrowRight,Mic,Pause,Star} from "lucide-react";
import {lines} from "./game";
import {showLine,spellLines,spellVocabulary,heardSymbols,saidWholeNumber} from "./spell";
import {roadLevel,roadRounds,roadLines,ROAD_LEVELS,type RoadRound} from "./road";
import {RoadScene} from "./roadScene";
import {speak} from "./guide";
import {chime,oops,fanfare,hooray,music} from "./speech";
import {useShell,usePlaying,useHeadingFocus} from "./shell";
import {TapToStart} from "./NumberGame";

type Phase="countdown"|"go"|"bump"|"crossed"|"done";
const vehicleEmoji={car:"🚗",bus:"🚌",truck:"🚚",train:"🚂"};

/** Route /road/level/:n — remounts for every level so each starts fresh. */
export default function RoadRoute(){
 const n=Number(useParams().n);
 if(!Number.isInteger(n)||n<1||n>ROAD_LEVELS)return <Navigate to="/road/levels" replace/>;
 return <RoadPlay key={n} index={n-1}/>;
}

/** Game 3, Road Rush: every correct letter or digit hops Pip across one lane before the traffic arrives. */
function RoadPlay({index}:{index:number}){
 const shell=useShell(), {save,setSave,supported,listener,pendingArm,announce,audio,panel,openPanel,engaged,attempt}=shell;
 const navigate=useNavigate();
 usePlaying();
 const titleRef=useHeadingFocus();
 const level=roadLevel(index);
 const [rounds]=useState<RoadRound[]>(()=>roadRounds(index));
 const [round,setRound]=useState(0),[phase,setPhase]=useState<Phase>("countdown");
 const [lane,setLane]=useState(0),[used,setUsed]=useState<number[]>([]),[misses,setMisses]=useState(0);
 const [status,setStatus]=useState(""),[hintTile,setHintTile]=useState(-1),[shake,setShake]=useState(-1),[count,setCount]=useState(0);
 const [timeShown,setTimeShown]=useState(1),[speaking,setSpeaking]=useState(false),[turn,setTurn]=useState(0);
 const [listening,setListening]=useState(false),[burst,setBurst]=useState(0),[noScene,setNoScene]=useState(false),[sceneReady,setSceneReady]=useState(false);
 const cue=useRef<string[]>([]),timeLeft=useRef(level.laneSeconds),hurried=useRef(false),idle=useRef(0),lastAttempt=useRef(attempt);
 const host=useRef<HTMLDivElement>(null),scene=useRef<RoadScene|null>(null);
 const current=rounds[round], card=current?.card, mode=current?.mode??"words", expected=card?.target[lane];
 const vehicle=current?.lanes[Math.min(lane,(current?.lanes.length??1)-1)]??"car";
 useEffect(()=>{setSave(s=>({...s,road:{...s.road,resume:index}}));},[]);

 // The road picture (PixiJS). If drawing isn't possible the game still works with the boxes and tiles.
 useEffect(()=>{
   if(!engaged||!host.current)return;
   const s=new RoadScene();let alive=true;
   s.mount(host.current).then(()=>{if(!alive){s.destroy();return;}scene.current=s;setSceneReady(true);}).catch(()=>{if(alive)setNoScene(true);});
   return ()=>{alive=false;scene.current=null;setSceneReady(false);s.destroy();};
 },[engaged]);
 useEffect(()=>{if(sceneReady&&current)scene.current?.newRoad(current.lanes);},[sceneReady,round]);
 useEffect(()=>{scene.current?.setPaused(Boolean(panel));},[panel,sceneReady]);

 function resetLaneTimer(){timeLeft.current=level.laneSeconds;hurried.current=false;setTimeShown(1);scene.current?.setDanger(0);}
 /** A letter/digit chosen by voice (tile -1) or by tapping a tile. */
 function choose(symbol:string,tile=-1){
   if(!card||phase!=="go"||panel||document.hidden)return;
   idle.current=0;setHintTile(-1);
   if(symbol!==expected){
     const nextMiss=misses+1;setMisses(nextMiss);
     if(save.sound&&audio.current)oops(audio.current);
     if(tile>=0){setShake(tile);setTimeout(()=>setShake(-1),450);}
     const text=nextMiss>=2?spellLines.hint(mode,expected):spellLines.wrong(mode,symbol);
     if(nextMiss>=2)setHintTile(card.tiles.findIndex((t,i)=>t===expected&&!used.includes(i)));
     setStatus(text);cue.current=[text];setTurn(t=>t+1);return;
   }
   const slot=tile>=0&&card.tiles[tile]===symbol&&!used.includes(tile)?tile:card.tiles.findIndex((t,i)=>t===symbol&&!used.includes(i));
   const next=lane+1;
   setUsed([...used,slot]);setLane(next);setMisses(0);scene.current?.hop(symbol);resetLaneTimer();
   if(next>=card.target.length){crossed();return;}
   if(save.sound&&audio.current)chime(audio.current);
   const text=spellLines.good(mode,symbol);setStatus(text);cue.current=[text];setTurn(t=>t+1);
 }
 function crossed(){
   if(!card)return;
   if(save.sound&&audio.current)hooray(audio.current);
   setLane(card.target.length);setUsed(card.tiles.map((_,i)=>i));setBurst(b=>b+1);setStatus(spellLines.done(mode,card));
   setSave(s=>({...s,stars:s.stars+1}));setPhase("crossed");
 }

 // Lane timer: runs only while it's the child's turn (never while the narrator talks or in a pause).
 useEffect(()=>{
   if(phase!=="go"||speaking||panel||!engaged)return;
   const total=level.laneSeconds;
   const id=setInterval(()=>{
     if(document.hidden)return;
     timeLeft.current=Math.max(0,timeLeft.current-0.1);
     const left=timeLeft.current/total;
     scene.current?.setDanger(1-left);setTimeShown(left);
     if(left<=0.35&&!hurried.current){hurried.current=true;const text=roadLines.hurry(vehicle);setStatus(text);cue.current=[text];setTurn(t=>t+1);}
     if(timeLeft.current<=0){
       clearInterval(id);
       // Three timeouts in a row without any answer: the child has probably wandered off.
       if(++idle.current>=3){idle.current=0;resetLaneTimer();openPanel("pause");return;}
       setPhase("bump");
     }
   },100);
   return ()=>clearInterval(id);
 },[phase,speaking,panel,engaged,round,lane]);

 // Narrator + always-on listening.
 useEffect(()=>{
   if(!engaged||panel||document.hidden||!current||!card)return;
   const controller=new AbortController(),signal=controller.signal;
   let timer:ReturnType<typeof setTimeout>|undefined;
   const counters:ReturnType<typeof setTimeout>[]=[];
   const say=async(text:Parameters<typeof speak>[0])=>{setSpeaking(true);await speak(text,save.narrate,signal);if(!signal.aborted)setSpeaking(false);};
   function stopEar(){pendingArm.current=null;listener.current?.disarm();music.duck("listening",false);setListening(false);}
   signal.addEventListener("abort",()=>{stopEar();counters.forEach(clearTimeout);setSpeaking(false);});
   function listenNow(){
     if(signal.aborted||!save.voice||!supported||!card)return;
     const ear=listener.current;
     if(!ear){pendingArm.current=listenNow;return;}
     ear.arm(text=>{
       if(signal.aborted)return;
       if(mode==="numbers"&&saidWholeNumber(text,card.target)){scene.current?.hop(card.target[lane]);crossed();return;}
       const heard=heardSymbols(mode,text);
       if(!heard.length)return;
       choose(heard.includes(expected)?expected:heard[heard.length-1]);
     },spellVocabulary(mode,card));
     music.duck("listening",true);setListening(true);
   }
   async function run(){
     const notice=announce.current;announce.current="";
     if(phase==="countdown"){
       if(round===0)await say([notice,lines.levelIntro(index)]);
       if(signal.aborted)return;
       setCount(3);counters.push(setTimeout(()=>setCount(2),650),setTimeout(()=>setCount(1),1300));
       await say(roadLines.countdown);if(signal.aborted)return;
       setCount(0);
       await say(spellLines.prompt(mode,card));if(signal.aborted)return;
       resetLaneTimer();lastAttempt.current=attempt;setPhase("go");return;
     }
     if(phase==="bump"){
       scene.current?.bump();setStatus(roadLines.bump(vehicle));
       await say(roadLines.bump(vehicle));if(signal.aborted)return;
       resetLaneTimer();setPhase("go");return;
     }
     if(phase==="crossed"){
       scene.current?.celebrate();
       await say(spellLines.done(mode,card));if(signal.aborted)return;
       timer=setTimeout(()=>{
         if(round+1>=rounds.length){levelComplete();return;}
         setRound(round+1);setLane(0);setUsed([]);setMisses(0);setStatus("");setHintTile(-1);idle.current=0;setPhase("countdown");
       },1200);
       return;
     }
     if(phase==="done"){
       if(save.sound&&audio.current)fanfare(audio.current);
       const last=index>=ROAD_LEVELS-1;
       await say(last?roadLines.allDone:lines.levelDone);
       if(!signal.aborted&&!last)timer=setTimeout(()=>navigate("/road/level/"+(index+2),{replace:true}),1500);
       return;
     }
     // phase "go": say any queued line (or repeat the prompt on "Read this screen"), then listen.
     let queued=cue.current;cue.current=[];
     if(attempt!==lastAttempt.current){lastAttempt.current=attempt;queued=[...queued,spellLines.prompt(mode,card)];}
     if(notice)queued=[notice,...queued];
     if(queued.length){await say(queued);if(signal.aborted)return;}
     listenNow();
   }
   void run();
   return ()=>{controller.abort();clearTimeout(timer);};
 },[engaged,panel,phase,round,turn,attempt,save.narrate,save.voice,supported]);
 function levelComplete(){
   setSave(s=>({...s,road:{done:[...new Set([...s.road.done,index])],resume:Math.min(index+1,ROAD_LEVELS-1)}}));
   setPhase("done");
 }

 const display=(c:string)=>mode==="words"?c.toUpperCase():c;
 if(!engaged)return <TapToStart title={"Road Rush · Level "+(index+1)}/>;
 if(phase==="done")return <section className="board result">
   <span className="bigStar"><Star size={60} fill="#ffcc4f"/></span><h1 {...titleRef}>You did it!</h1>
   <p className="lead">Road Rush level {index+1} complete · {rounds.length} stars</p>
   <p>{index<ROAD_LEVELS-1?"Level "+(index+2)+" starts automatically.":"Pip crossed every road!"}</p>
   <button className="back" onClick={()=>openPanel("pause")}><Pause/>Take a break</button>
   <button className="back" onClick={()=>navigate("/road/levels")}>Choose a level <ArrowRight/></button>
 </section>;
 if(!card)return null;
 const statusText=status||shell.micMessage||(phase==="countdown"?"Get ready…":roadLines.listen+" "+(supported&&save.voice?(shell.voiceState==="loading"?"Getting my ears ready…":listening?"I'm listening!":""):"Tap the tiles."));
 return <section className="board road">
   <div className="boardBar"><button className="pill" onClick={()=>navigate("/road/levels")} aria-label="Back to levels"><ArrowLeft size={16}/> Levels</button><strong>Level {index+1} · Road Rush</strong><button className="pill" onClick={()=>openPanel("pause")}><Pause size={16}/> Pause</button></div>
   <p className="eyebrow justify-center">CROSSING {round+1} OF {rounds.length}</p>
   <h1 {...titleRef}>{mode==="words"?"Spell":"Make"} <span className="roadWord" aria-label={"Target "+card.label}>{card.emoji&&<span aria-hidden="true">{card.emoji} </span>}{display(card.label)}</span></h1>
   <div className="timer" role="progressbar" aria-label="Time before the traffic arrives" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(timeShown*100)}>
     <span className="timerFill" style={{width:timeShown*100+"%"}} data-low={timeShown<0.35||undefined}/><span className="timerIcon" aria-hidden="true">{vehicleEmoji[vehicle]}</span>
   </div>
   <div className="roadCanvas" ref={host}>
     {noScene&&<div className="roadFallback" aria-hidden="true">{current.lanes.map((v,i)=><span key={i} className={i<lane?"crossed":""}>{vehicleEmoji[v]}</span>)}</div>}
     {count>0&&<span className="countdown" aria-live="assertive" key={count}>{count}</span>}
   </div>
   <div className="slots" aria-label={"Spelled so far: "+card.target.slice(0,lane)}>
     {card.target.split("").map((c,i)=><span key={i} className={"slot"+(i<lane?" full":"")+(i===lane&&phase==="go"?" next":"")}>{i<lane?display(c):""}</span>)}
   </div>
   <p className="feedback" role="status">{phase==="crossed"&&<Star fill="#ffce57"/>}{showLine(statusText)}</p>
   <div className="choices tiles">{card.tiles.map((t,i)=><button key={i} disabled={phase!=="go"||used.includes(i)} aria-label={"Tile "+display(t)}
     className={(hintTile===i?"hinted":"")+(shake===i?" shake":"")} onClick={()=>choose(t,i)}>{display(t)}</button>)}</div>
   <button className="voice" disabled={phase==="crossed"} onClick={()=>{if(supported&&save.voice){idle.current=0;setStatus("");shell.retryVoice();}else openPanel("parents");}}><Mic size={18}/>{save.voice&&supported?"Say my answer":"Voice settings"}</button>
   {phase==="crossed"&&<div className="cheer" aria-hidden="true"><span className="thumb">🎉</span><strong>Pip made it!</strong></div>}
   {burst>0&&<div className="confetti" key={burst} aria-hidden="true">{Array.from({length:70},(_,i)=><i key={i} style={{left:Math.random()*100+"%",background:["#18b3c4","#ffb020","#ff5d73","#4f8cff","#2fbf71","#a66bff"][i%6],animationDelay:Math.random()*0.35+"s",animationDuration:1.4+Math.random()*1.2+"s",width:6+Math.random()*7,height:8+Math.random()*9}}/>)}</div>}
 </section>;
}
