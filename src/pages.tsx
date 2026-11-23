import {useState} from "react";
import {useNavigate,useParams,Navigate} from "react-router";
import {Play,Star,Medal,ArrowRight,ArrowLeft,Hand,Shapes,Check,EyeOff,Volume2,LayoutGrid,Ear} from "lucide-react";
import NumberFriends from "./NumberFriends";
import {levels,worlds,lines} from "./game";
import {spellLines,spellLevel,SPELL_LEVELS} from "./spell";
import {modeName} from "./SpellIt";
import {roadLines,roadLevel,ROAD_LEVELS} from "./road";
import {warmUp} from "./listen";
import {useShell,usePageVoice,useHeadingFocus} from "./shell";

type Step={title:string,body:string,Icon:typeof Shapes};
function HowToPlay({steps}:{steps:Step[]}){
 const {bump}=useShell();
 return <><div className="headingRow"><h2>How to play</h2><button className="pill" onClick={bump}><Volume2 size={18}/>Hear instructions</button></div>
 <div className="howGrid">{steps.map(({title,body,Icon},i)=><article key={title} className={"how how"+i}><div className="howTop"><span className="iconBox"><Icon/></span><span className="step">0{i+1}</span></div><h3>{title}</h3><p>{body}</p></article>)}</div></>;
}

/** "/" — Say & Play welcome. "Let's play" leads to the game picker. */
export function Landing(){
 const navigate=useNavigate(), {save,openPanel}=useShell();
 usePageVoice(lines.home);
 return <>
 <section className="hero"><div className="heroText"><div className="eyebrow"><span className="tiny-dot"/>3 GAMES · AGES 3–6</div><h1>Say &amp; <em>Play!</em></h1><p>Talk to the game! Say numbers and letters out loud<br className="desktop"/> to play, learn and collect stars.</p><button className="primary" onClick={()=>navigate("/games")}><Play fill="currentColor"/>Let’s play</button></div>
   <div className="sp-art" aria-hidden="true"><span className="bubble b1">🔢</span><span className="bubble b2">🍎</span><span className="bubble b3">🚦</span><span className="speech">“Apple!”</span></div></section>
 <HowToPlay steps={[{title:"Pick a game",body:"Choose numbers, spelling, or the road race.",Icon:LayoutGrid},{title:"Listen and say it",body:"The game asks out loud. Say your answer, or tap it.",Icon:Ear},{title:"Collect stars",body:"Every right answer earns a star.",Icon:Star}]}/>
 <button className="rewardStrip" onClick={()=>openPanel("rewards")}><Medal/><strong>My rewards</strong><small>{save.stars} stars collected</small><ArrowRight className="ml-auto"/></button>
 </>;
}

/** "/games" — the game picker. */
export function GamePicker(){
 const navigate=useNavigate(), titleRef=useHeadingFocus();
 usePageVoice(lines.picker);
 return <>
 <button className="back" onClick={()=>navigate("/")}><ArrowLeft/>Home</button>
 <h1 {...titleRef}>Pick a game</h1><p className="lead">Three games. Say your answers out loud!</p>
 <div className="gameGrid">
   <button className="gameCard game-numbers" onClick={()=>navigate("/numbers")}><span className="gameIcon" aria-hidden="true">🔢</span><h3>Number Playroom</h3><p>Meet numbers, count dots and find what comes next.</p><span className="tag">120 levels</span></button>
   <button className="gameCard game-spell" onClick={()=>navigate("/spell")}><span className="gameIcon" aria-hidden="true">🍎</span><h3>Spell It</h3><p>Spell yummy foods and build numbers, one letter at a time.</p><span className="tag">80 levels</span></button>
   <button className="gameCard game-road" onClick={()=>navigate("/road")}><span className="gameIcon" aria-hidden="true">🚦</span><h3>Road Rush</h3><p>Spell fast to help Pip cross the road before the cars come.</p><span className="tag">40 levels</span></button>
 </div></>;
}

/** "/numbers" — Number Playroom's own welcome page (purple). */
export function NumbersHome(){
 const navigate=useNavigate(), {save,openPanel}=useShell();
 usePageVoice(lines.numbersHome);
 return <>
 <button className="back" onClick={()=>navigate("/games")}><ArrowLeft/>All games</button>
 <section className="hero"><div className="heroText"><div className="eyebrow"><span className="tiny-dot"/>GAME 1 · NUMBER PLAYROOM</div><h1>Number <em>Playroom!</em></h1><p>Meet your number friends. Say their names<br className="desktop"/> or tap along to collect stars!</p><button className="primary" onClick={()=>{navigate("/numbers/levels");if(save.voice)warmUp();}}><Play fill="currentColor"/>Start</button></div><NumberFriends/></section>
 <HowToPlay steps={[{title:"Meet a number",body:"Watch a number friend float into view.",Icon:Shapes},{title:"Say it or tap it",body:"Listen to the question, then say or tap your answer.",Icon:Hand},{title:"Collect stars",body:"Follow your stars from one level to the next.",Icon:Star}]}/>
 <button className="rewardStrip" onClick={()=>openPanel("rewards")}><Medal/><strong>My rewards</strong><small>{save.completed.length} of 120 levels complete</small><ArrowRight className="ml-auto"/></button>
 </>;
}

/** "/numbers/levels" — choose a Number Playroom level. */
export function NumbersLevels(){
 const navigate=useNavigate(), {save,needSetup}=useShell(), titleRef=useHeadingFocus();
 const [world,setWorld]=useState(()=>Math.floor(save.resume/40));
 usePageVoice(lines.levels(world));
 function choose(t:number){const go=()=>navigate("/numbers/level/"+(t+1));if(!needSetup(go))go();}
 return <><button className="back" onClick={()=>navigate("/numbers")}><ArrowLeft/>Number Playroom</button><h1 {...titleRef}>Choose a level</h1><p className="lead">Three adventures. 120 little steps.</p><button className="primary" onClick={()=>choose(save.resume)}><Play/> {save.resume?"Continue":"Start"} level {save.resume+1}</button><div className="worlds">{worlds.map((name,i)=><button key={name} aria-pressed={world===i} className="pill" onClick={()=>setWorld(i)}>{name}</button>)}</div><h2>{worlds[world]}</h2><p>Levels {world*40+1}–{world*40+40}</p><div className="levelGrid">{levels.map((l,i)=>l.world===world&&<button key={i} aria-label={"Play level "+(i+1)} className="pill" onClick={()=>choose(i)}>{save.completed.includes(i)&&<Check size={15}/>} {i+1}</button>)}</div></>;
}

/** "/spell" — Spell It's own welcome page (orange). */
export function SpellHome(){
 const navigate=useNavigate(), {save,openPanel}=useShell();
 usePageVoice(spellLines.home);
 return <>
 <button className="back" onClick={()=>navigate("/games")}><ArrowLeft/>All games</button>
 <section className="hero"><div className="heroText"><div className="eyebrow"><span className="tiny-dot"/>GAME 2 · SPELL IT</div><h1>Spell <em>It!</em></h1><p>Spell yummy foods and build big numbers.<br className="desktop"/> Say each letter out loud!</p><button className="primary" onClick={()=>{navigate("/spell/modes");if(save.voice)warmUp();}}><Play fill="currentColor"/>Start</button></div>
   <div className="food-art" aria-hidden="true"><span className="f1">🍎</span><span className="f2">🍌</span><span className="f3">🥕</span><span className="f4">🍕</span><b className="t1">A</b><b className="t2">B</b><b className="t3">C</b></div></section>
 <HowToPlay steps={[{title:"Listen to the word",body:"The guide says “Spell egg!” or “Make fifteen!”",Icon:Ear},{title:"Say each letter",body:"Say E… G… G… or tap the tiles. Each one drops into a box.",Icon:Hand},{title:"Hooray!",body:"Finish the word for a star and confetti.",Icon:Star}]}/>
 <button className="rewardStrip" onClick={()=>openPanel("rewards")}><Medal/><strong>My rewards</strong><small>{save.spell.words.length+save.spell.numbers.length} of 80 levels complete</small><ArrowRight className="ml-auto"/></button>
 </>;
}

/** "/spell/modes" — food words or numbers. */
export function SpellModes(){
 const navigate=useNavigate(), titleRef=useHeadingFocus();
 usePageVoice(spellLines.menu);
 return <>
 <button className="back" onClick={()=>navigate("/spell")}><ArrowLeft/>Spell It</button>
 <h1 {...titleRef}>What shall we spell?</h1><p className="lead">Say each letter or number out loud, or tap the tiles.</p>
 <div className="modeGrid">
   {([["words","🍎","Food words","Spell apple, egg, banana and more yummy foods."],["numbers","🔢","Numbers","Build numbers like 15 by saying one, then five."]] as const).map(([m,icon,title,body])=>
     <button key={m} className="modeCard" onClick={()=>navigate("/spell/"+m)}><span className="modeIcon" aria-hidden="true">{icon}</span><strong>{title}</strong><small>{body}</small><ArrowRight className="ml-auto"/></button>)}
 </div></>;
}

/** "/spell/:mode" — choose a Spell It level. */
export function SpellLevels(){
 const {mode}=useParams(), navigate=useNavigate(), {save,needSetup}=useShell(), titleRef=useHeadingFocus();
 const valid=mode==="words"||mode==="numbers";
 usePageVoice(spellLines.levels(mode==="numbers"?"numbers":"words"));
 if(!valid)return <Navigate to="/spell/modes" replace/>;
 const resume=mode==="words"?save.spell.resumeWords:save.spell.resumeNumbers, done=mode==="words"?save.spell.words:save.spell.numbers;
 function start(i:number){const go=()=>navigate(`/spell/${mode}/level/${i+1}`);if(!needSetup(go))go();}
 return <>
 <button className="back" onClick={()=>navigate("/spell/modes")}><ArrowLeft/>Spell It</button>
 <h1 {...titleRef}>{modeName(mode)}</h1><p className="lead">40 levels. <EyeOff size={16} className="inline"/> marks memory levels, where the {mode==="words"?"word":"number"} stays hidden.</p>
 <button className="primary" onClick={()=>start(resume)}><Play/> {resume?"Continue":"Start"} level {resume+1}</button>
 <div className="levelGrid">{Array.from({length:SPELL_LEVELS},(_,i)=><button key={i} aria-label={"Play "+modeName(mode)+" level "+(i+1)} className="pill" onClick={()=>start(i)}>
   {done.includes(i)&&<Check size={15}/>} {i+1}{spellLevel(mode,i).hidden&&<EyeOff size={13} aria-label="memory level"/>}</button>)}</div>
 </>;
}

/** "/road" — Road Rush's own welcome page (teal). */
export function RoadHome(){
 const navigate=useNavigate(), {save,openPanel}=useShell();
 usePageVoice(roadLines.home);
 return <>
 <button className="back" onClick={()=>navigate("/games")}><ArrowLeft/>All games</button>
 <section className="hero"><div className="heroText"><div className="eyebrow"><span className="tiny-dot"/>GAME 3 · ROAD RUSH</div><h1>Road <em>Rush!</em></h1><p>Help Pip cross the road! Spell each word<br className="desktop"/> before the cars and trains zoom by.</p><button className="primary" onClick={()=>{navigate("/road/levels");if(save.voice)warmUp();}}><Play fill="currentColor"/>Start</button></div>
   <div className="road-art" aria-hidden="true"><span className="lane l1"/><span className="lane l2"/><span className="lane l3"/><span className="pip">🐥</span><span className="v v1">🚗</span><span className="v v2">🚌</span><span className="v v3">🚂</span><b className="t1">A</b><b className="t2">7</b></div></section>
 <HowToPlay steps={[{title:"3, 2, 1… go!",body:"The guide says the word. A car starts coming.",Icon:Ear},{title:"Spell to hop",body:"Each right letter or number hops Pip across one lane.",Icon:Hand},{title:"Pip made it!",body:"Cross the whole road for a star. A beep just means try again.",Icon:Star}]}/>
 <button className="rewardStrip" onClick={()=>openPanel("rewards")}><Medal/><strong>My rewards</strong><small>{save.road.done.length} of 40 levels complete</small><ArrowRight className="ml-auto"/></button>
 </>;
}

/** "/road/levels" — choose a Road Rush level. */
export function RoadLevels(){
 const navigate=useNavigate(), {save,needSetup}=useShell(), titleRef=useHeadingFocus();
 usePageVoice(roadLines.levels);
 const stages=["Quiet Street","Busy Avenue","Big Highway","Railway Crossing"];
 function start(i:number){const go=()=>navigate("/road/level/"+(i+1));if(!needSetup(go))go();}
 return <>
 <button className="back" onClick={()=>navigate("/road")}><ArrowLeft/>Road Rush</button>
 <h1 {...titleRef}>Choose a road</h1><p className="lead">40 roads. Cars get faster, and trains join in at the Railway Crossing.</p>
 <button className="primary" onClick={()=>start(save.road.resume)}><Play/> {save.road.resume?"Continue":"Start"} level {save.road.resume+1}</button>
 {stages.map((name,stage)=><div key={name}><h2 className="stageTitle">{name} <small>· {roadLevel(stage*10).laneSeconds} seconds per lane</small></h2>
   <div className="levelGrid">{Array.from({length:10},(_,k)=>stage*10+k).filter(i=>i<ROAD_LEVELS).map(i=><button key={i} aria-label={"Play Road Rush level "+(i+1)} className="pill" onClick={()=>start(i)}>{save.road.done.includes(i)&&<Check size={15}/>} {i+1}</button>)}</div></div>)}
 </>;
}
