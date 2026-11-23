import {test,expect,type Page} from "@playwright/test";
// window.testVoice is declared in play.spec.ts.
async function voices(page:Page,voice:boolean){
 await page.route("**/models/**",route=>route.abort());
 await page.addInitScript(v=>{
   const state={starts:0,active:null as unknown};
   Object.assign(window,{testVoice:state,SpeechRecognition:class{start(){state.starts++;state.active=this;}abort(){if(state.active===this)state.active=null;}}});
   Object.defineProperty(window,"speechSynthesis",{value:{getVoices:()=>[],cancel(){},speak(u:SpeechSynthesisUtterance){setTimeout(()=>u.onend?.({} as SpeechSynthesisEvent),15);}}});
   Object.defineProperty(navigator,"mediaDevices",{value:{getUserMedia:async()=>new MediaStream()}});
   class FakeClip{onended:null|(()=>void)=null;onerror:null|(()=>void)=null;play(){setTimeout(()=>this.onended?.(),15);return Promise.resolve();}pause(){}}
   Object.assign(window,{Audio:FakeClip});
   localStorage.setItem("number-rush-v1",JSON.stringify({chosen:true,voice:v}));
 },voice);
}
const target=async(page:Page)=>(await page.getByLabel(/^Target /).getAttribute("aria-label"))!.replace("Target ","");
const ready=(page:Page)=>expect(page.locator(".tiles button:not([disabled])").first()).toBeVisible({timeout:10000});
async function tapWord(page:Page,word:string){for(const c of word)await page.getByRole("button",{name:"Tile "+c.toUpperCase()}).and(page.locator(":not([disabled])")).first().click();}

test("picker → Road Rush → countdown, hop across by tapping, finish a level",async({page})=>{
 await voices(page,false);await page.goto("/games");await page.getByRole("button",{name:/Road Rush/}).click();
 await expect(page).toHaveURL(/\/road$/);expect(await page.locator(".shell").getAttribute("data-theme")).toBe("road");
 await page.getByRole("button",{name:"Start",exact:true}).click();await page.getByRole("button",{name:"Play Road Rush level 1",exact:true}).click();
 await expect(page).toHaveURL(/\/road\/level\/1$/);
 for(let n=0;n<3;n++){
   await expect(page.getByText(`CROSSING ${n+1} OF 3`)).toBeVisible({timeout:10000});
   await ready(page);const word=await target(page);
   await tapWord(page,word);
   await expect(page.getByRole("status")).toContainText(/spells|You made/);
 }
 await expect(page.getByRole("heading",{name:"You did it!"})).toBeVisible({timeout:10000});
 await expect(page.getByRole("button",{name:"3 stars"})).toBeVisible();
 await expect(page).toHaveURL(/\/road\/level\/2$/,{timeout:10000});
});

test("voice hops Pip; a wrong letter is named; the timer hurries, then a friendly bump",async({page})=>{
 test.setTimeout(60000);
 await voices(page,true);await page.goto("/road/level/1");await page.getByRole("button",{name:"Tap to play"}).click();
 await ready(page);const word=await target(page);
 await expect.poll(()=>page.evaluate(()=>Boolean(window.testVoice.active)),{timeout:10000}).toBe(true);
 await page.evaluate(t=>window.testVoice.active?.onresult({results:[[{transcript:t}]]}),word[0].toUpperCase());
 await expect(page.locator(".slot.full")).toHaveCount(1);
 const wrong=(await page.locator(".tiles button:not([disabled])").allInnerTexts()).find(t=>t!==word[1]?.toUpperCase())!;
 await page.getByRole("button",{name:"Tile "+wrong}).and(page.locator(":not([disabled])")).first().click();
 await expect(page.getByRole("status")).toContainText("is not next");
 await expect(page.getByRole("status")).toContainText("Hurry up!",{timeout:15000});
 await expect(page.getByRole("status")).toContainText(/Beep beep|Choo choo/,{timeout:15000});
 await expect(page.locator(".slot.full")).toHaveCount(1); // nobody loses: Pip just tries that lane again
 await ready(page);
});

test("three timeouts with no answer at all → the game takes a break by itself",async({page})=>{
 test.setTimeout(90000);
 await voices(page,false);await page.goto("/road/level/1");await page.getByRole("button",{name:"Tap to play"}).click();
 await expect(page.getByRole("heading",{name:"Taking a break?"})).toBeVisible({timeout:60000});
});
