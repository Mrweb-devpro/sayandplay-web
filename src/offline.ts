import {useEffect,useState} from "react";
import {registerSW} from "virtual:pwa-register";

/** "saving" while the first visit downloads everything for offline use, "ready" once it is all cached. */
export type OfflineState="unsupported"|"saving"|"ready";
let registered=false;

/** True when the app page and the 40 MB speech model (the last big file) are both in the offline cache. */
async function everythingCached(){
 try{
   const page=await caches.match("/index.html",{ignoreSearch:true});
   const model=await caches.match("/models/vosk-en-small.tar.gz",{ignoreSearch:true});
   return Boolean(page&&model);
 }catch{return false;}
}

export function useOfflineState():OfflineState{
 const [state,setState]=useState<OfflineState>("unsupported");
 useEffect(()=>{
   if(!("serviceWorker" in navigator)||!("caches" in window)||import.meta.env.DEV)return;
   let stopped=false;
   const check=async()=>{if(await everythingCached()){if(!stopped)setState("ready");return true;}return false;};
   if(!registered){
     registered=true;
     registerSW({immediate:true,onOfflineReady:()=>void check(),onRegisteredSW:()=>{if(!stopped)setState(s=>s==="ready"?s:"saving");}});
   }
   // Keep checking while the first download runs (it can take a minute on a phone).
   void (async()=>{
     for(let i=0;i<300&&!stopped;i++){
       if(await check())return;
       await new Promise(r=>setTimeout(r,2000));
     }
   })();
   return ()=>{stopped=true;};
 },[]);
 return state;
}
