import test from "node:test";
import assert from "node:assert/strict";
import {round,levels,spokenNumber,restore,initial,dotLayout,allLines,clipName,lines} from "../src/game.ts";
import {existsSync} from "node:fs";
test("120 levels in three worlds generate solvable preschool challenges",()=>{
 assert.equal(levels.length,120);
 for(const [i,l] of levels.entries()){
 assert.equal(l.world,Math.floor(i/40));
 for(const c of round(i)){assert.ok(c.options.includes(c.target));assert.equal(new Set(c.options).size,l.choices);assert.ok(c.options.every(n=>n>=1&&n<=10));if(l.task==="after")assert.ok(c.target>1);}
 }});
test("recognizes short answers and number words",()=>{for(const [s,n] of [[" TWO!",2],["it is ten",10],["won",1],["ate",8],["one two",0],["",0]])assert.equal(spokenNumber(s),n);});
test("forgives filler, repeats and common mishearings but rejects noise",()=>{
 for(const [s,n] of [["it's a five",5],["Um, three please.",3],["tree",3],["free",3],["sex",6],["fife",5],["five five!",5],["I think it’s seven",7],["7",7],["tin",10],
   ["hello",0],["[unk]",0],["[unk] three",3],["five six",0],["what",0],["um",0],["11",0]])assert.equal(spokenNumber(s),n,JSON.stringify(s));
});
test("dot layouts use dice patterns up to six and a ten-frame above",()=>{
 for(let n=1;n<=10;n++){
   const {kind,dots}=dotLayout(n), filled=dots.filter(d=>d.filled);
   assert.equal(filled.length,n);assert.equal(kind,n<=6?"dice":"frame");
   assert.equal(new Set(dots.map(d=>d.row+","+d.col)).size,dots.length,"no overlapping dots for "+n);
   if(kind==="frame"){assert.equal(dots.length,10);assert.ok(filled.slice(0,5).every(d=>d.row===1));}
 }
});
test("recovers earlier progress and rejects invalid checkpoints",()=>{assert.deepEqual(restore("{"),initial);assert.deepEqual(restore('{"stars":6,"badges":[0,0,9],"resume":999}'),{...initial,stars:6,badges:[0]});});
test("every narrator sentence has a unique pre-recorded clip",()=>{
 const all=allLines();
 assert.equal(new Set(all.map(clipName)).size,all.length);
 for(const t of [lines.levelIntro(119),lines.question("after",10),lines.praise(5,7),lines.clue(9),lines.levels(2)])assert.ok(all.includes(t),t);
 const missing=all.filter(t=>!existsSync(new URL("../public/voice/"+clipName(t),import.meta.url)));
 assert.deepEqual(missing,[],"run npm run voice to record missing clips");
});
import {spellLevel,spellRound,spellVocabulary,heardSymbols,saidWholeNumber,numberName,allSpellLines,allFoods,SPELL_LEVELS} from "../src/spell.ts";
test("Spell It: 40 levels per mode, memory levels, solvable scrambled tiles",()=>{
 for(const mode of ["words","numbers"]){
   for(let i=0;i<SPELL_LEVELS;i++){
     const level=spellLevel(mode,i);
     assert.equal(level.hidden,(i+1)%5===0||(i>=30&&i%2===1),mode+" "+i);
     for(const card of spellRound(level)){
       const need=[...card.target], pool=[...card.tiles];
       for(const c of need){const at=pool.indexOf(c);assert.ok(at>=0,`${card.target} missing ${c} in ${card.tiles}`);pool.splice(at,1);}
       assert.equal(pool.length,level.extra,"distractor count");
       if(card.tiles.length>1)assert.ok(!card.tiles.join("").startsWith(card.target),"never pre-solved");
       if(mode==="numbers")assert.ok(+card.target>=10&&+card.target<=100);
     }
   }
 }
 assert.ok(allFoods.every(f=>/^[a-z]{3,10}$/.test(f.word)&&f.emoji));
});
test("Spell It: hears letters, digits and whole numbers",()=>{
 assert.deepEqual(heardSymbols("words","[unk] gee e"),["g","e"]);
 assert.deepEqual(heardSymbols("words","bee see"),["b","c"]);
 assert.deepEqual(heardSymbols("words","E"),["e"]);
 assert.deepEqual(heardSymbols("numbers","one five"),["1","5"]);
 assert.deepEqual(heardSymbols("numbers","15"),["1","5"]);
 assert.deepEqual(heardSymbols("numbers","hello"),[]);
 assert.ok(saidWholeNumber("twenty five","25"));assert.ok(saidWholeNumber("fifteen","15"));assert.ok(!saidWholeNumber("five","15"));
 assert.equal(numberName(100),"one hundred");assert.equal(numberName(40),"forty");assert.equal(numberName(13),"thirteen");
 const vocab=spellVocabulary("words",{target:"egg",label:"egg",emoji:"",tiles:["g","e","g","t"]});
 assert.ok(vocab.includes("gee")&&vocab.includes("ee")&&vocab.includes("tee")&&!vocab.includes("bee"));
 assert.ok(spellVocabulary("numbers",{target:"25",label:"25",emoji:"",tiles:["5","2"]}).includes("twenty"));
});
test("every Spell It sentence has a pre-recorded clip",()=>{
 const missing=allSpellLines().filter(t=>!existsSync(new URL("../public/voice/"+clipName(t),import.meta.url)));
 assert.deepEqual(missing,[],"run npm run voice to record missing clips");
});
import {roadLevel,roadRounds,allRoadLines,ROAD_LEVELS} from "../src/road.ts";
test("Road Rush: generous, steadily shorter lane timers; trains only at the end; words and numbers mixed",()=>{
 let prev=Infinity;
 for(let i=0;i<ROAD_LEVELS;i++){
   const l=roadLevel(i);assert.ok(l.laneSeconds<=prev&&l.laneSeconds>=6,"lane time "+i);prev=l.laneSeconds;
   assert.equal(l.vehicles.includes("train"),i>=30);
   const rounds=roadRounds(i);assert.equal(rounds.length,3);assert.ok(rounds.some(r=>r.mode==="words"));
   for(const r of rounds){assert.equal(r.lanes.length,r.card.target.length);assert.ok(r.lanes.every(v=>l.vehicles.includes(v)));}
 }
 assert.ok(roadLevel(0).laneSeconds>=10);
});
test("every Road Rush sentence has a pre-recorded clip",()=>{
 const missing=allRoadLines().filter(t=>!existsSync(new URL("../public/voice/"+clipName(t),import.meta.url)));
 assert.deepEqual(missing,[]);
});
