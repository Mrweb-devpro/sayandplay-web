import {test,expect} from "@playwright/test";

// The real installable-app path: service worker on, everything cached, then no network at all.
test.use({serviceWorkers:"allow"});

test("first visit saves everything; afterwards the whole app works with no network",async({page,context})=>{
 test.setTimeout(150000);
 await page.goto("/");
 await expect(page.locator(".offlineBadge")).toBeVisible({timeout:15000});
 await expect(page.getByText("✓ Ready to play offline")).toBeVisible({timeout:120000});

 await context.setOffline(true);
 await page.reload();
 await expect(page.getByRole("heading",{name:"Say & Play!"})).toBeVisible();
 await expect(page.getByText("✓ Ready to play offline")).toBeVisible({timeout:15000});
 // Deep links, the narrator clips, the speech model and every game still load offline.
 for(const [url,text] of [["/road/level/2","Road Rush · Level 2"],["/spell/words/level/3","Food words · Level 3"],["/numbers/level/5","Level 5"]]){
   await page.goto(url);await expect(page.getByRole("heading",{name:text})).toBeVisible();
 }
 const cached=await page.evaluate(async()=>{
   return {model:Boolean(await caches.match("/models/vosk-en-small.tar.gz",{ignoreSearch:true})),
     voice:(await Promise.all((await caches.keys()).map(async k=>(await (await caches.open(k)).keys()).filter(r=>r.url.includes("/voice/")).length))).reduce((a,b)=>a+b,0)};
 });
 expect(cached.model).toBe(true);
 expect(cached.voice).toBeGreaterThan(600);
 await page.getByRole("button",{name:"Tap to play"}).click();
 await expect(page.getByText("Level 5 · Meadow Trail")).toBeVisible();
 await context.setOffline(false);
});
