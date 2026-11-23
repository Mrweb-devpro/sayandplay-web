import {useEffect,useRef,useState} from "react";
import {useNavigate,useParams,Navigate} from "react-router";
import {ArrowLeft,ArrowRight,Mic,Pause,Star} from "lucide-react";
import {lines} from "./game";
import {showLine,spellLevel,spellRound,spellLines,spellVocabulary,heardSymbols,saidWholeNumber,SPELL_LEVELS,type SpellMode,type SpellCard} from "./spell";
import {speak} from "./guide";
import {chime,oops,fanfare,hooray,music} from "./speech";
import {useShell,usePlaying,useHeadingFocus} from "./shell";
import {TapToStart} from "./NumberGame";

const SILENCE_MS=5000;
export const modeName=(mode:SpellMode)=>mode==="words"?"Food words":"Numbers";

/** Route /spell/:mode/level/:n — remounts for every level so each starts fresh. */
export default function SpellRoute(){
 const {mode,n}=useParams(), level=Number(n);
 if((mode!=="words"&&mode!=="numbers")||!Number.isInteger(level)||level<1||level>SPELL_LEVELS)return <Navigate to="/spell/modes" replace/>;
 return <SpellPlay key={mode+level} mode={mode} index={level-1}/>;
}

/** Game 2, Spell It: spell foods letter by letter, or build numbers digit by digit, by voice or by tapping tiles. */
function SpellPlay({mode,index}:{mode:SpellMode,index:number}){
 const shell=useShell(), {save,setSave,supported,listener,pendingArm,announce,audio,panel,openPanel,engaged,attempt}=shell;
 const navigate=useNavigate();
 usePlaying();
 const titleRef=useHeadingFocus();
 const levelsPath="/spell/"+mode;
 const [stage,setStage]=useState<"play"|"done">("play");
 const [cards]=useState<SpellCard[]>(()=>spellRound(spellLevel(mode,index))),[step,setStep]=useState(0);
 const [filled,setFilled]=useState(0),[used,setUsed]=useState<number[]>([]),[misses,setMisses]=useState(0);
 const [celebrate,setCelebrate]=useState(false),[status,setStatus]=useState(""),[hintTile,setHintTile]=useState(-1),[shake,setShake]=useState(-1);
 const [turn,setTurn]=useState(0),[listening,setListening]=useState(false),[burst,setBurst]=useState(0);
 const cue=useRef<(string|false)[]>([]),silent=useRef(0);
 const level=spellLevel(mode,index), card=cards[step], expected=card?.target[filled];
 useEffect(()=>{setSave(s=>({...s,spell:{...s.spell,[mode==="words"?"resumeWords":"resumeNumbers"]:index}}));},[]);

 function resetCard(){setFilled(0);setUsed([]);setMisses(0);setCelebrate(false);setStatus("");setHintTile(-1);silent.current=0;cue.current=[];}
 /** A letter/digit chosen by voice (tile -1) or by tapping a tile. */
 function choose(symbol:string,tile=-1){
   if(!card||celebrate||panel||document.hidden||stage!=="play")return;
   silent.current=0;setHintTile(-1);
   if(symbol!==expected){
     const nextMiss=misses+1;setMisses(nextMiss);
     if(save.sound&&audio.current)oops(audio.current);
     if(tile>=0){setShake(tile);setTimeout(()=>setShake(-1),450);}
     // First miss names the wrong letter; after that, give the answer as a clue.
     const text=nextMiss>=2?spellLines.hint(mode,expected):spellLines.wrong(mode,symbol);
     if(nextMiss>=2)setHintTile(card.tiles.findIndex((t,i)=>t===expected&&!used.includes(i)));
     setStatus(text);cue.current=[text];setTurn(t=>t+1);return;
   }
   const slot=tile>=0&&card.tiles[tile]===symbol&&!used.includes(tile)?tile:card.tiles.findIndex((t,i)=>t===symbol&&!used.includes(i));
   const nowFilled=filled+1;
   setUsed([...used,slot]);setFilled(nowFilled);setMisses(0);
   if(nowFilled<card.target.length){
     if(save.sound&&audio.current)chime(audio.current);
     const text=spellLines.good(mode,symbol);setStatus(text);cue.current=[text];setTurn(t=>t+1);return;
   }
   finishCard();
 }
 function finishCard(){
   if(!card)return;
   if(save.sound&&audio.current)hooray(audio.current);
   setBurst(b=>b+1);setCelebrate(true);setStatus(spellLines.done(mode,card));
   setFilled(card.target.length);setUsed(card.tiles.map((_,i)=>i));
   setSave(s=>({...s,stars:s.stars+1}));
 }
 function levelComplete(){
   const key=mode==="words"?"words":"numbers", resumeKey=mode==="words"?"resumeWords":"resumeNumbers";
   setSave(s=>({...s,spell:{...s.spell,[key]:[...new Set([...s.spell[key],index])],[resumeKey]:Math.min(index+1,SPELL_LEVELS-1)}}));
   setStage("done");
 }

 // Narrator + always-on listening, re-run on every turn of the game.
 useEffect(()=>{
   if(!engaged||document.hidden||panel)return;
   const controller=new AbortController(),signal=controller.signal;
   let timer:ReturnType<typeof setTimeout>|undefined;
   const say=(text:Parameters<typeof speak>[0])=>speak(text,save.narrate,signal);
   function stopEar(){pendingArm.current=null;listener.current?.disarm();music.duck("listening",false);setListening(false);}
   signal.addEventListener("abort",stopEar);
   async function run(){
     if(stage==="done"){
       if(save.sound&&audio.current)fanfare(audio.current);
       const last=index>=SPELL_LEVELS-1;
       await say(last?(mode==="words"?spellLines.allWords:spellLines.allNumbers):lines.levelDone);
       // Next level gets its own address; "replace" keeps Back pointing at the level list.
       if(!signal.aborted&&!last)timer=setTimeout(()=>navigate(`/spell/${mode}/level/${index+2}`,{replace:true}),1500);
       return;
     }
     if(!card)return;
     if(celebrate){
       await say(spellLines.done(mode,card));if(signal.aborted)return;
       timer=setTimeout(()=>{if(step+1>=cards.length)levelComplete();else{setStep(step+1);resetCard();}},1400);
       return;
     }
     const notice=announce.current;announce.current="";
     const queued=cue.current;cue.current=[];
     await say(queued.length?[notice,...queued]:[notice,step===0&&filled===0&&lines.levelIntro(index),spellLines.prompt(mode,card)]);
     if(signal.aborted)return;
     function listenNow(){
       if(signal.aborted||!save.voice||!supported||!card)return;
       const ear=listener.current;
       if(!ear){pendingArm.current=listenNow;return;}
       ear.arm(text=>{
         if(signal.aborted)return;
         if(mode==="numbers"&&saidWholeNumber(text,card.target)){finishCard();return;}
         const heard=heardSymbols(mode,text);
         if(!heard.length)return; // noise or unclear: keep listening
         // Generous: if the expected letter was heard anywhere, it counts.
         choose(heard.includes(expected)?expected:heard[heard.length-1]);
       },spellVocabulary(mode,card));
       music.duck("listening",true);setListening(true);
     }
     function restartSilence(){clearTimeout(timer);timer=setTimeout(()=>void checkIn(),SILENCE_MS);}
     async function checkIn(){
       if(signal.aborted||!card)return;
       const k=silent.current++;
       if(k>=2){silent.current=0;openPanel("pause");return;}
       stopEar();
       if(k===0){setStatus(lines.stillThere);await say([lines.stillThere,spellLines.prompt(mode,card)]);}
       else{const text=spellLines.hint(mode,expected);setStatus(text);setHintTile(card.tiles.findIndex((t,i)=>t===expected&&!used.includes(i)));await say(text);}
       if(signal.aborted)return;
       listenNow();restartSilence();
     }
     listenNow();restartSilence();
   }
   void run();
   return ()=>{controller.abort();clearTimeout(timer);};
 },[engaged,panel,stage,step,turn,celebrate,attempt,save.narrate,save.voice,supported]);

 const display=(c:string)=>mode==="words"?c.toUpperCase():c;
 const statusText=status||shell.micMessage||(level.hidden?spellLines.listen:card?spellLines.prompt(mode,card):"")+" "+(supported&&save.voice?(shell.voiceState==="loading"?"Getting my ears ready…":listening?"I'm listening!":""):"Tap the tiles.");

 if(!engaged)return <TapToStart title={modeName(mode)+" · Level "+(index+1)}/>;
 if(stage==="done")return <section className="board result">
   <span className="bigStar"><Star size={60} fill="#ffcc4f"/></span><h1 {...titleRef}>You did it!</h1>
   <p className="lead">{modeName(mode)} level {index+1} complete · {cards.length} stars</p>
   <p>{index<SPELL_LEVELS-1?"Level "+(index+2)+" starts automatically.":"You finished every level!"}</p>
   <button className="back" onClick={()=>openPanel("pause")}><Pause/>Take a break</button>
   <button className="back" onClick={()=>navigate(levelsPath)}>Choose a level <ArrowRight/></button>
 </section>;
 if(!card)return null;
 return <section className="board spell">
   <div className="boardBar"><button className="pill" onClick={()=>navigate(levelsPath)} aria-label="Back to levels"><ArrowLeft size={16}/> Levels</button><strong>Level {index+1} · {modeName(mode)}{level.hidden&&" · Memory"}</strong><button className="pill" onClick={()=>openPanel("pause")}><Pause size={16}/> Pause</button></div>
   <p className="eyebrow justify-center">{mode==="words"?"WORD":"NUMBER"} {step+1} OF {cards.length}</p>
   <h1 {...titleRef}>{mode==="words"?"Spell it!":"Make it!"}</h1>
   <div className="spellStage">
     {mode==="words"&&<span className={"foodPic"+(celebrate?" won":"")} role="img" aria-label={level.hidden?"A mystery food":card.label}>{card.emoji}</span>}
     <span className={"spellTarget"+(level.hidden&&!celebrate?" secret":"")} aria-label={level.hidden&&!celebrate?"Hidden — listen and remember":"Target "+card.label}>{level.hidden&&!celebrate?"? ? ?":display(card.label)}</span>
   </div>
   <div className="slots" aria-label={"Spelled so far: "+card.target.slice(0,filled)}>
     {card.target.split("").map((c,i)=><span key={i} className={"slot"+(i<filled?" full":"")+(i===filled&&!celebrate?" next":"")}>{i<filled?display(c):""}</span>)}
   </div>
   <p className="feedback" role="status">{celebrate&&<Star fill="#ffce57"/>}{showLine(statusText)}</p>
   <div className="choices tiles">{card.tiles.map((t,i)=><button key={i} disabled={celebrate||used.includes(i)} aria-label={"Tile "+display(t)}
     className={(hintTile===i?"hinted":"")+(shake===i?" shake":"")} onClick={()=>choose(t,i)}>{display(t)}</button>)}</div>
   <button className="voice" disabled={celebrate} onClick={()=>{if(supported&&save.voice){silent.current=0;setStatus("");shell.retryVoice();}else openPanel("parents");}}><Mic size={18}/>{save.voice&&supported?"Say my answer":"Voice settings"}</button>
   {celebrate&&<div className="cheer" aria-hidden="true"><span className="thumb">👍</span><strong>Hooray!</strong></div>}
   <Confetti burst={burst}/>
 </section>;
}

/** A shower of paper confetti over the board each time `burst` changes. */
function Confetti({burst}:{burst:number}){
 if(!burst)return null;
 const colors=["#ffcf70","#7950cb","#4fbf8b","#ff7aa8","#5aa9ff","#ff9b45"];
 return <div className="confetti" key={burst} aria-hidden="true">{Array.from({length:70},(_,i)=><i key={i} style={{
   left:Math.random()*100+"%",background:colors[i%colors.length],animationDelay:Math.random()*0.35+"s",
   animationDuration:1.4+Math.random()*1.2+"s",transform:`rotate(${Math.random()*360}deg)`,width:6+Math.random()*7,height:8+Math.random()*9,
 }}/>)}</div>;
}
