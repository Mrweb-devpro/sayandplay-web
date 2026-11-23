// Pre-records every narrator sentence with the Kokoro neural voice, entirely on this machine.
// Usage:  npm run voice            (only records missing clips)
//         $env:VOICE='af_bella'; npm run voice -- --force   (re-record everything with another voice)
// The first run downloads the Kokoro model (~90 MB) once; afterwards it works offline.
import {mkdirSync,existsSync,writeFileSync,readdirSync,unlinkSync} from "node:fs";
import {KokoroTTS} from "kokoro-js";
import {Mp3Encoder} from "@breezystack/lamejs";
import {allLines,clipName} from "../src/game.ts";
import {allSpellLines} from "../src/spell.ts";
import {allRoadLines} from "../src/road.ts";

const voice=process.env.VOICE||"af_heart", speed=Number(process.env.SPEED||1.08), force=process.argv.includes("--force");
const out=new URL("../public/voice/",import.meta.url);
mkdirSync(out,{recursive:true});

const lines=[...new Set([...allLines(),...allSpellLines(),...allRoadLines()])], wanted=new Set(lines.map(clipName));
// Split the work across parallel processes: --part 1/3, --part 2/3, --part 3/3 (cleanup only runs unsplit).
const partArg=process.argv[process.argv.indexOf("--part")+1], [part,parts]=process.argv.includes("--part")?partArg.split("/").map(Number):[1,1];
if(parts===1)for(const file of readdirSync(out))if(file.endsWith(".mp3")&&!wanted.has(file))unlinkSync(new URL(file,out)); // drop clips for removed sentences
const todo=lines.filter((text,i)=>i%parts===part-1&&(force||!existsSync(new URL(clipName(text),out))));
console.log(`${lines.length} sentences, ${todo.length} to record with voice ${voice} at speed ${speed}`);
if(!todo.length)process.exit(0);

const tts=await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX",{dtype:"q8",device:"cpu"});

function trim(samples,rate){ // cut leading/trailing silence so the narrator feels snappy
 const limit=0.012,pad=Math.round(rate*0.04);
 let start=0,end=samples.length-1;
 while(start<end&&Math.abs(samples[start])<limit)start++;
 while(end>start&&Math.abs(samples[end])<limit)end--;
 return samples.subarray(Math.max(0,start-pad),Math.min(samples.length,end+pad));
}
function mp3(samples,rate){
 const pcm=new Int16Array(samples.length);
 for(let i=0;i<samples.length;i++)pcm[i]=Math.max(-1,Math.min(1,samples[i]))*32767;
 const encoder=new Mp3Encoder(1,rate,56),chunks=[];
 for(let i=0;i<pcm.length;i+=1152){const c=encoder.encodeBuffer(pcm.subarray(i,i+1152));if(c.length)chunks.push(Buffer.from(c));}
 chunks.push(Buffer.from(encoder.flush()));
 return Buffer.concat(chunks);
}

let done=0;
for(const text of todo){
 // Speak "tap 3" as "tap three" and the symbol-free text the child hears.
 const spoken=text.replace(/"([A-Z])"/g,"$1").replace(/…/g,"...").replace(/\btap (\d+)/g,(_,n)=>"tap "+["","one","two","three","four","five","six","seven","eight","nine","ten"][n]);
 const audio=await tts.generate(spoken,{voice,speed});
 writeFileSync(new URL(clipName(text),out),mp3(trim(audio.audio,audio.sampling_rate),audio.sampling_rate));
 if(++done%20===0||done===todo.length)console.log(`${done}/${todo.length}`);
}
