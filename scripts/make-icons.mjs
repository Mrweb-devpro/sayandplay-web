// Draws the Say & Play logo (triangle, square and circle on a tilted purple tile — the original
// Number Rush logo) as the favicon and app icons. Usage: node scripts/make-icons.mjs
import {writeFileSync} from "node:fs";
import {chromium} from "@playwright/test";

// The "shapes" icon from lucide (24×24, white outline).
const shapes=`<path d="M8.3 10a.7.7 0 0 1-.626-1.079L11.4 3a.7.7 0 0 1 1.198-.043L16.3 8.9a.7.7 0 0 1-.572 1.1Z"/><rect x="3" y="14" width="7" height="7" rx="1"/><circle cx="17.5" cy="17.5" r="3.5"/>`;
const glyph=(x,y,size)=>`<g transform="translate(${x} ${y}) scale(${size/24})" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${shapes}</g>`;
const PURPLE="#7950cb", SHADOW="#5534a3";

// Tilted tile on a transparent background — same look as the logo in the app header.
const tile=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g transform="rotate(-5 32 32)">
<rect x="5" y="5" width="54" height="54" rx="16" fill="${SHADOW}"/><rect x="5" y="5" width="54" height="50.5" rx="16" fill="${PURPLE}"/>${glyph(14,13.2,36)}</g></svg>`;
// Full-bleed square for Android "maskable" icons and the iPhone home screen (the OS rounds the corners).
const square=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${PURPLE}"/>${glyph(17,17,30)}</svg>`;

writeFileSync(new URL("../public/icon.svg",import.meta.url),tile+"\n");
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||"chrome"});
const page=await browser.newPage();
for(const [file,svg,size,transparent] of [["pwa-192.png",tile,192,true],["pwa-512.png",tile,512,true],["maskable-512.png",square,512,false],["apple-touch-icon.png",square,180,false],["favicon-48.png",tile,48,true]]){
 await page.setViewportSize({width:size,height:size});
 await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace("<svg ",`<svg width="${size}" height="${size}" `)}</body></html>`);
 writeFileSync(new URL("../public/"+file,import.meta.url),await page.screenshot({omitBackground:transparent,type:"png"}));
}
await browser.close();
console.log("icons written to public/");
