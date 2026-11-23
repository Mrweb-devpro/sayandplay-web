import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import {VitePWA} from "vite-plugin-pwa";

export default defineConfig({
 plugins:[
   react(),
   // Installable app: after the first visit everything (code, fonts, voice clips, the 40 MB speech
   // model) is cached by a service worker, so the game opens and plays with no internet at all.
   VitePWA({
     registerType:"autoUpdate",
     manifest:{
       name:"Say & Play",short_name:"Say & Play",description:"Hands-free learning games for ages 3–6.",
       theme_color:"#7042c7",background_color:"#fcfaf7",display:"standalone",start_url:"/",
       icons:[
         {src:"/pwa-192.png",sizes:"192x192",type:"image/png",purpose:"any"},
         {src:"/pwa-512.png",sizes:"512x512",type:"image/png",purpose:"any"},
         {src:"/maskable-512.png",sizes:"512x512",type:"image/png",purpose:"maskable"},
         {src:"/icon.svg",sizes:"any",type:"image/svg+xml",purpose:"any"},
       ],
     },
     workbox:{
       globPatterns:["**/*.{js,css,html,svg,png,woff,woff2,mp3}","models/*.tar.gz"],
       maximumFileSizeToCacheInBytes:60*1024*1024,
     },
   }),
 ],
 // vosk-browser is an old UMD bundle; let Vite convert it once up front.
 optimizeDeps:{include:["vosk-browser"]},
 // The speech library is ~6 MB but loads separately, only when voice play starts.
 build:{chunkSizeWarningLimit:6500},
});
