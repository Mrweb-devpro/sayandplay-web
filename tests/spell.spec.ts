import {test,expect,type Page} from "@playwright/test";

// window.testVoice is declared in play.spec.ts.
/** Same simulated microphone/recogniser/narrator as play.spec.ts (offline model blocked → browser fallback). */
async function voices(page:Page){
 await page.route("**/models/**",route=>route.abort());
 await page.addInitScript(()=>{
   const state={starts:0,active:null as unknown};
   Object.assign(window,{testVoice:state,SpeechRecognition:class{start(){state.starts++;state.active=this;}abort(){if(state.active===this)state.active=null;}}});
   Object.defineProperty(window,"speechSynthesis",{value:{getVoices:()=>[],cancel(){},speak(u:SpeechSynthesisUtterance){setTimeout(()=>u.onend?.({} as SpeechSynthesisEvent),15);}}});
   Object.defineProperty(navigator,"mediaDevices",{value:{getUserMedia:async()=>new MediaStream()}});
   class FakeClip{onended:null|(()=>void)=null;onerror:null|(()=>void)=null;play(){setTimeout(()=>this.onended?.(),15);return Promise.resolve();}pause(){}}
   Object.assign(window,{Audio:FakeClip});
 });
}
async function open(page:Page,mode:"Food words"|"Numbers",level:number,voice:boolean){
 await page.goto("/");await page.getByRole("button",{name:"Let’s play"}).click();
 await page.getByRole("button",{name:/Spell It/}).click();await page.getByRole("button",{name:"Start",exact:true}).click();
 await page.getByRole("button",{name:new RegExp(mode)}).click();
 await page.getByRole("button",{name:`Play ${mode} level ${level}`,exact:true}).click();
 await page.getByText(voice?"Voice and tap":"Tap only",{exact:true}).click();
}
const target=async(page:Page)=>(await page.getByLabel(/^Target /).getAttribute("aria-label"))!.replace("Target ","");
const say=(page:Page,text:string)=>page.evaluate(t=>window.testVoice.active?.onresult({results:[[{transcript:t}]]}),text);
const armed=(page:Page)=>expect.poll(()=>page.evaluate(()=>Boolean(window.testVoice.active)),{timeout:15000}).toBe(true);

test("game picker leads to Spell It; tapping tiles spells words, with clues and a finished level",async({page})=>{
 await voices(page);await open(page,"Food words",1,false);
 const word=await target(page);
 const wrong=(await page.locator(".tiles button").allInnerTexts()).find(t=>t!==word[0].toUpperCase())!;
 await page.getByRole("button",{name:"Tile "+wrong}).first().click();
 await expect(page.getByRole("status")).toContainText("is not next");
 await page.getByRole("button",{name:"Tile "+wrong}).first().click();
 await expect(page.getByRole("status")).toContainText("Here's a clue");
 await expect(page.locator(".tiles button.hinted")).toHaveText(word[0].toUpperCase());
 for(let n=0;n<3;n++){
   const w=await target(page);
   for(const c of w)await page.getByRole("button",{name:"Tile "+c.toUpperCase()}).and(page.locator(":not([disabled])")).first().click();
   await expect(page.getByRole("status")).toContainText("spells "+w);
   if(n<2)await expect(page.getByText(`WORD ${n+2} OF 3`)).toBeVisible({timeout:8000});
 }
 await expect(page.getByRole("heading",{name:"You did it!"})).toBeVisible({timeout:8000});
 await expect(page.getByRole("button",{name:"3 stars"})).toBeVisible(); // header star count
 await expect(page).toHaveURL(/\/spell\/words\/level\/2$/,{timeout:8000}); // auto-advances into level 2
 await expect(page.getByText("WORD 1 OF 3")).toBeVisible({timeout:8000});
 await expect(page.getByText("Level 2 · Food words")).toBeVisible();
});

test("voice: letters by name, noise ignored, whole numbers accepted",async({page})=>{
 await voices(page);await open(page,"Food words",1,true);
 const word=await target(page);
 await armed(page);await say(page,"hello");
 await expect(page.locator(".slot.full")).toHaveCount(0);
 for(const [i,c] of [...word].entries()){
   await armed(page);await say(page,c.toUpperCase());
   await expect(page.locator(".slot.full")).toHaveCount(i+1);
 }
 await expect(page.getByRole("status")).toContainText("spells "+word);
 // Numbers mode: saying the whole number ("15") builds it in one go.
 await page.getByRole("button",{name:"Pause",exact:true}).click();await page.getByText("Choose a level").click();
 await expect(page).toHaveURL(/\/spell\/words$/);
 await page.getByRole("button",{name:"Spell It"}).click();await page.getByRole("button",{name:/Numbers/}).click();
 await page.getByRole("button",{name:"Play Numbers level 1",exact:true}).click();
 const n=await target(page);
 await armed(page);await say(page,n);
 await expect(page.getByRole("status")).toContainText("You made");
});

test("memory levels hide the word but keep the picture and tiles",async({page})=>{
 await voices(page);await open(page,"Food words",5,false);
 await expect(page.getByText("Level 5 · Food words · Memory")).toBeVisible();
 await expect(page.getByLabel("Hidden — listen and remember")).toBeVisible();
 await expect(page.getByRole("status")).toContainText("Listen, then spell!");
 await expect(page.locator(".tiles button").first()).toBeVisible();
});
