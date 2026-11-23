import {test,expect,type Page} from "@playwright/test";
import {clipName} from "../src/game";

type Mock={starts:number,lines:string[],clips:string[],active:null|{onresult:(e:unknown)=>void,onerror:(e:{error:string})=>void}};
declare global{interface Window{testVoice:Mock}}

/** Simulated microphone, browser recogniser and narrator clips. The offline model is blocked so the
    browser-recogniser fallback is exercised (tests/voice-offline.spec.ts covers the real offline path). */
async function voices(page:Page){
 await page.route("**/models/**",route=>route.abort());
 await page.addInitScript(()=>{
   const state={lines:[] as string[],clips:[] as string[],starts:0,active:null as unknown};
   Object.assign(window,{testVoice:state,SpeechRecognition:class{
     onstart?:()=>void;
     start(){state.starts++;state.active=this;this.onstart?.();}
     abort(){if(state.active===this)state.active=null;}
   }});
   Object.defineProperty(window,"speechSynthesis",{value:{getVoices:()=>[],cancel(){},speak(u:SpeechSynthesisUtterance){state.lines.push(u.text);setTimeout(()=>u.onend?.({} as SpeechSynthesisEvent),15);}}});
   Object.defineProperty(navigator,"mediaDevices",{value:{getUserMedia:async()=>new MediaStream()}});
   class FakeClip{
     onended:null|(()=>void)=null;onerror:null|(()=>void)=null;
     constructor(public src:string){}
     play(){state.clips.push(this.src.split("/").pop()!);setTimeout(()=>this.onended?.(),15);return Promise.resolve();}
     pause(){}
   }
   Object.assign(window,{Audio:FakeClip});
 });
}
async function begin(page:Page,n:number,voice:boolean){await page.goto("/numbers/levels");
 if(n>80)await page.getByRole("button",{name:"Starlight Summit"}).click();else if(n>40)await page.getByRole("button",{name:"Rainbow River"}).click();
 await page.getByRole("button",{name:"Play level "+n,exact:true}).click();await page.getByText(voice?"Voice and tap":"Tap only",{exact:true}).click();}
const say=(page:Page,word:string)=>page.evaluate(w=>window.testVoice.active?.onresult({results:[[{transcript:w}]]}),word);
const armed=(page:Page)=>expect.poll(()=>page.evaluate(()=>Boolean(window.testVoice.active)),{timeout:15000}).toBe(true);

test("hands-free speech, silence check-in, correction, pause and continuous levels",async({page})=>{
 await voices(page);await begin(page,1,true);
 await armed(page);
 await expect(page.getByRole("status")).toContainText("still there",{timeout:8500});
 await expect.poll(()=>page.evaluate(()=>window.testVoice.starts)).toBe(2);
 await say(page,"three");
 await expect(page.getByRole("status")).toContainText("Not quite");
 await armed(page);await say(page,"hello there"); // chatter is ignored, not marked wrong
 await expect(page.getByRole("status")).toContainText("Not quite");
 await armed(page);await say(page,"three");
 await expect(page.getByRole("status")).toContainText("try together");
 await page.getByRole("button",{name:"Pause",exact:true}).click();
 expect(await page.evaluate(()=>window.testVoice.active)).toBe(null);
 await page.getByText("Keep playing").click();
 for(const n of ["one","two","three","one","two"]){await armed(page);await say(page,n);}
 await expect(page.getByText("Level 2 · Meadow Trail")).toBeVisible({timeout:8000});
 const levelTwo=clipName("Level 2!");
 await expect.poll(()=>page.evaluate(()=>window.testVoice.clips)).toContain(levelTwo);
 expect(await page.evaluate(()=>window.testVoice.lines.length)).toBe(0); // all narration came from recorded clips
 await expect(page).toHaveURL(/\/numbers\/level\/2$/);
 await page.goto("/numbers/levels");await expect(page.getByText("Continue level 2")).toBeVisible();
});
test("denied permission leaves tapping available and manual retry works",async({page})=>{
 await voices(page);await begin(page,1,true);await armed(page);
 await page.evaluate(()=>window.testVoice.active?.onerror({error:"not-allowed"}));await expect(page.getByRole("status")).toContainText("switched off");
 await page.getByText("Say my answer").click();await expect.poll(()=>page.evaluate(()=>window.testVoice.starts),{timeout:15000}).toBe(2);
 await page.getByLabel("Answer 1").click();await expect(page.getByRole("status")).toContainText("That's one");
});
test("silence: checks in, gives a clue, then takes a break by itself",async({page})=>{
 await voices(page);await begin(page,1,false);
 await expect(page.getByRole("status")).toContainText("still there",{timeout:8000});
 await expect(page.getByRole("status")).toContainText("Here's a clue",{timeout:8000});
 await expect(page.getByRole("heading",{name:"Taking a break?"})).toBeVisible({timeout:8000});
 await page.getByText("Keep playing").click();
 await page.getByLabel("Answer 1").click();await expect(page.getByRole("status")).toContainText("That's one");
});
test("final level works with only local assets, with no microphone",async({page})=>{
 await page.route("**/*",route=>new URL(route.request().url()).hostname==="127.0.0.1"?route.continue():route.abort());
 await page.setViewportSize({width:360,height:740});await voices(page);await begin(page,120,false);
 for(let i=0;i<9;i++){
 const question=await page.getByRole("heading",{level:1}).innerText();
 const words=["","one","two","three","four","five","six","seven","eight","nine","ten"];
 const n=words.indexOf(question.replace("What comes after ","").replace("?",""))+1;
 await page.getByRole("button",{name:"Answer "+n,exact:true}).click();
 if(i<8)await expect(page.getByText("NUMBER "+(i+2)+" OF 9")).toBeVisible();
 }
 await expect(page.getByText("You reached the end of the trail!")).toBeVisible();
 expect(await page.evaluate(()=>window.testVoice.starts)).toBe(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(360);
});
