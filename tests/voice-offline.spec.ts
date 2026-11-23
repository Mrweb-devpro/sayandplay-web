import {test,expect} from "@playwright/test";
import {fileURLToPath} from "node:url";

// Real end-to-end check of the offline recogniser: Chrome's fake microphone loops a recording of
// someone saying "one", the bundled Vosk model hears it with all internet access blocked.
const wav=fileURLToPath(new URL("./fixtures/say-one.wav",import.meta.url));
test.use({launchOptions:{args:["--use-fake-ui-for-media-stream","--use-fake-device-for-media-stream","--use-file-for-fake-audio-capture="+wav]}});

test("offline recogniser hears a spoken answer with no internet",async({page,context})=>{
 test.setTimeout(120000);
 await context.grantPermissions(["microphone"]);
 await page.route("**/*",route=>new URL(route.request().url()).hostname==="127.0.0.1"?route.continue():route.abort());
 await page.goto("/numbers/levels");
 await page.getByRole("button",{name:"Play level 1",exact:true}).click();await page.getByText("Voice and tap",{exact:true}).click();
 // Level 1 starts with the number 1: hearing "one" should be marked correct.
 await expect(page.getByRole("status")).toContainText("That's one",{timeout:90000});
 await page.getByRole("button",{name:"Parents"}).click();
 await expect(page.getByText("recognises number words offline")).toBeVisible();
});

test("offline recogniser switches to Spell It digits and fills the first box",async({page,context})=>{
 test.setTimeout(120000);
 await context.grantPermissions(["microphone"]);
 await page.route("**/*",route=>new URL(route.request().url()).hostname==="127.0.0.1"?route.continue():route.abort());
 // Numbers level 1 uses 10–20; pin the shuffle so the first number starts with 1.
 await page.addInitScript(()=>{let seed=11;Math.random=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};});
 await page.goto("/spell/numbers");
 await page.getByRole("button",{name:"Play Numbers level 1",exact:true}).click();await page.getByText("Voice and tap",{exact:true}).click();
 const target=(await page.getByLabel(/^Target /).getAttribute("aria-label"))!.replace("Target ","");
 expect(target.startsWith("1")).toBe(true);
 await expect(page.locator(".slot.full").first()).toHaveText("1",{timeout:90000});
});
