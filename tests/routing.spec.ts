import {test,expect,type Page} from "@playwright/test";

async function quiet(page:Page){
 await page.route("**/models/**",route=>route.abort());
 await page.addInitScript(()=>{
   Object.defineProperty(window,"speechSynthesis",{value:undefined});
   class Silent{onended:null|(()=>void)=null;onerror:null|(()=>void)=null;play(){setTimeout(()=>this.onended?.(),15);return Promise.resolve();}pause(){}}
   Object.assign(window,{Audio:Silent});
   localStorage.setItem("number-rush-v1",JSON.stringify({chosen:true,voice:false}));
 });
}
const theme=(page:Page)=>page.locator(".shell").getAttribute("data-theme");

test("landing → game picker → each game has its own pages, theme and working browser Back",async({page})=>{
 await quiet(page);await page.goto("/");
 await expect(page.getByRole("heading",{name:"Say & Play!"})).toBeVisible();expect(await theme(page)).toBe("home");
 await page.getByRole("button",{name:"Let’s play"}).click();await expect(page).toHaveURL(/\/games$/);
 await page.getByRole("button",{name:/Number Playroom/}).click();await expect(page).toHaveURL(/\/numbers$/);
 expect(await theme(page)).toBe("numbers");
 await page.getByRole("button",{name:"Start",exact:true}).click();await expect(page).toHaveURL(/\/numbers\/levels$/);
 await page.getByRole("button",{name:"Play level 3",exact:true}).click();await expect(page).toHaveURL(/\/numbers\/level\/3$/);
 await expect(page.getByText("Level 3 · Meadow Trail")).toBeVisible();
 await page.goBack();await expect(page).toHaveURL(/\/numbers\/levels$/);await expect(page.getByRole("heading",{name:"Choose a level"})).toBeVisible();
 await page.goBack();await expect(page).toHaveURL(/\/numbers$/);
 await page.goBack();await expect(page).toHaveURL(/\/games$/);
 await page.getByRole("button",{name:/Spell It/}).click();await expect(page).toHaveURL(/\/spell$/);expect(await theme(page)).toBe("spell");
 await page.getByRole("button",{name:"All games"}).click();await expect(page).toHaveURL(/\/games$/);
 await page.getByRole("button",{name:"Home"}).click();await expect(page).toHaveURL(/\/$/);
});

test("deep links and refresh work; the in-game Levels button goes back",async({page})=>{
 await quiet(page);await page.goto("/spell/words/level/3");
 await page.getByRole("button",{name:"Tap to play"}).click();
 await expect(page.getByText("Level 3 · Food words")).toBeVisible();expect(await theme(page)).toBe("spell");
 await page.reload();await page.getByRole("button",{name:"Tap to play"}).click();
 await expect(page.getByText("Level 3 · Food words")).toBeVisible();
 await page.getByRole("button",{name:"Back to levels"}).click();await expect(page).toHaveURL(/\/spell\/words$/);
 await page.goto("/numbers/level/999");await expect(page).toHaveURL(/\/numbers\/levels$/); // bad level → level list
 await page.goto("/nowhere");await expect(page).toHaveURL(/\/$/);
});

for(const [game,url,label] of [["Number Playroom","/numbers/level/1","Level 1 · Meadow Trail"],["Spell It","/spell/words/level/1","Level 1 · Food words"],["Road Rush","/road/level/1","Level 1 · Road Rush"]] as const){
 test(`${game} pauses itself when the window loses focus or the tab is hidden`,async({page})=>{
   await quiet(page);await page.goto(url);await page.getByRole("button",{name:"Tap to play"}).click();
   await expect(page.getByText(label)).toBeVisible();
   await page.evaluate(()=>window.dispatchEvent(new Event("blur")));
   await expect(page.getByRole("heading",{name:"Taking a break?"})).toBeVisible();
   await page.getByText("Keep playing").click();
   await page.evaluate(()=>{Object.defineProperty(document,"hidden",{value:true,configurable:true});document.dispatchEvent(new Event("visibilitychange"));});
   await expect(page.getByRole("heading",{name:"Taking a break?"})).toBeVisible();
 });
}
