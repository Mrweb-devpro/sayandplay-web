// Creates tests/fixtures/say-one.wav: a different voice saying "one" followed by silence.
// Chrome plays it (looped) as a fake microphone in tests/voice-offline.spec.ts.
import {mkdirSync,writeFileSync} from "node:fs";
import {KokoroTTS} from "kokoro-js";

const tts=await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX",{dtype:"q8",device:"cpu"});
const {audio,sampling_rate:rate}=await tts.generate("One!",{voice:"am_michael",speed:0.95});
const silence=Math.round(rate*2.5), samples=new Float32Array(audio.length+silence);
samples.set(audio,0);
const pcm=Buffer.alloc(samples.length*2);
samples.forEach((s,i)=>pcm.writeInt16LE(Math.round(Math.max(-1,Math.min(1,s))*32767),i*2));
const header=Buffer.alloc(44);
header.write("RIFF",0);header.writeUInt32LE(36+pcm.length,4);header.write("WAVE",8);header.write("fmt ",12);
header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(rate,24);
header.writeUInt32LE(rate*2,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write("data",36);header.writeUInt32LE(pcm.length,40);
const dir=new URL("../tests/fixtures/",import.meta.url);mkdirSync(dir,{recursive:true});
writeFileSync(new URL("say-one.wav",dir),Buffer.concat([header,pcm]));
console.log("wrote tests/fixtures/say-one.wav",(samples.length/rate).toFixed(2)+"s");
