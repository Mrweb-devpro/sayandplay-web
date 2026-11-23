/* The Road Rush picture, drawn with PixiJS (everything is drawn in code, so it works offline).
   Top-down view: Pip starts on the grass at the bottom and hops up one lane per correct letter.
   The vehicle in the lane ahead creeps in from the left as the lane timer runs down. */
import {Application,Container,Graphics,Text} from "pixi.js";
import type {Vehicle} from "./road";

const COLORS=[0xff5d73,0x4f8cff,0xffb020,0x2fbf71,0xa66bff,0xff7a3d,0x18b3c4];
type Tween={t:number,dur:number,step:(k:number)=>void,done?:()=>void};
interface Mover{node:Container,lane:number,speed:number,length:number}

export class RoadScene{
 private app=new Application();
 private root=new Container();
 private world=new Container();
 private pip=new Container();
 private danger:Mover|null=null;
 private passing:Mover[]=[];
 private decor:Mover[]=[];
 private tweens:Tween[]=[];
 private observer:ResizeObserver|null=null;
 private lanes:Vehicle[]=[];
 private letters:(string|null)[]=[];
 private pipLane=0;
 private progress=0;
 private paused=false;
 private W=640;private LH=46;private G=64;
 private ready=false;

 /** Creates the canvas inside `host`. Rejects if neither WebGL nor canvas drawing is available. */
 async mount(host:HTMLElement){
   await this.app.init({preference:["webgl","canvas"],backgroundAlpha:0,antialias:true,resolution:Math.min(window.devicePixelRatio||1,2),autoDensity:true,width:host.clientWidth||640,height:300});
   this.app.canvas.setAttribute("aria-hidden","true");
   host.appendChild(this.app.canvas);
   this.app.stage.addChild(this.root);
   this.app.ticker.add(t=>this.update(t.deltaMS/1000));
   this.observer=new ResizeObserver(()=>this.layout(host.clientWidth));
   this.observer.observe(host);
   this.ready=true;
   this.layout(host.clientWidth||640);
 }
 destroy(){this.observer?.disconnect();this.ready=false;try{this.app.destroy(true,{children:true});}catch{}}
 setPaused(paused:boolean){this.paused=paused;}

 /** A new crossing: one lane per letter. */
 newRoad(lanes:Vehicle[]){
   this.lanes=lanes;this.letters=lanes.map(()=>null);this.pipLane=0;this.progress=0;
   this.passing=[];this.tweens=[];this.danger=null;
   if(this.ready)this.layout(this.W);
 }
 /** How far the vehicle in the lane ahead has come (0 = just appearing, 1 = at Pip). */
 setDanger(progress:number){this.progress=Math.max(0,Math.min(1,progress));}
 /** Correct letter: paint it on the lane and hop Pip across; the vehicle zooms past behind. */
 hop(letter:string){
   if(!this.ready)return;
   const lane=this.pipLane;this.letters[lane]=letter;this.paintLetter(lane,letter);
   if(this.danger){this.danger.speed=900;this.passing.push(this.danger);this.danger=null;}
   this.pipLane=Math.min(this.lanes.length,lane+1);this.progress=0;
   this.jumpPip(this.pipY(lane),this.pipY(this.pipLane),340);
   this.spawnDanger();this.refreshDecor();
 }
 /** Time ran out: the vehicle honks and drives on, Pip wobbles back onto the kerb. */
 bump(){
   if(!this.ready)return;
   if(this.danger){this.danger.speed=700;this.passing.push(this.danger);this.danger=null;}
   this.honk();
   const y=this.pipY(this.pipLane);
   this.tween(450,k=>{this.pip.x=this.pipX()+Math.sin(k*Math.PI*6)*6*(1-k);this.pip.y=y+Math.sin(k*Math.PI)*10;},()=>{this.pip.x=this.pipX();this.progress=0;this.spawnDanger();});
 }
 /** Crossing complete: a happy triple jump. */
 celebrate(){
   if(!this.ready)return;
   if(this.danger){this.danger.speed=900;this.passing.push(this.danger);this.danger=null;}
   const y=this.pip.y;
   this.tween(1200,k=>{const b=Math.abs(Math.sin(k*Math.PI*3));this.pip.y=y-b*22;this.pip.rotation=Math.sin(k*Math.PI*6)*0.15;},()=>{this.pip.rotation=0;});
 }

 /* ---------- layout and drawing ---------- */
 private pipX(){return Math.round(this.W*0.62);}
 private roadTop(){return this.G;}
 private roadBottom(){return this.G+this.lanes.length*this.LH;}
 private laneY(i:number){return this.roadBottom()-(i+0.5)*this.LH;}
 private pipY(k:number){
   if(k<=0)return this.roadBottom()+this.G*0.42;
   if(k>=this.lanes.length)return this.roadTop()-this.G*0.42;
   return this.roadBottom()-k*this.LH;
 }
 private layout(width:number){
   if(!this.ready||!width)return;
   this.W=Math.max(300,Math.min(width,960));
   // Long words get thinner lanes so the whole road still fits on screen.
   const small=this.W<520, lanes=Math.max(1,this.lanes.length);
   this.LH=Math.round(Math.max(26,Math.min(small?36:46,(small?260:330)/lanes)));this.G=small?48:56;
   const H=this.G*2+Math.max(1,this.lanes.length)*this.LH;
   this.app.renderer.resize(this.W,H);
   this.root.removeChildren();this.world=new Container();this.root.addChild(this.world);
   this.drawGround(H);
   this.letters.forEach((l,i)=>{if(l)this.paintLetter(i,l);});
   this.decor=[];this.refreshDecor();
   this.pip=this.drawPip();this.pip.x=this.pipX();this.pip.y=this.pipY(this.pipLane);this.root.addChild(this.pip);
   this.passing=[];this.danger=null;this.spawnDanger();
 }
 private drawGround(H:number){
   const g=new Graphics(), W=this.W, top=this.roadTop(), bottom=this.roadBottom();
   g.rect(0,0,W,top).fill({color:0x8fd694});g.rect(0,bottom,W,H-bottom).fill({color:0x8fd694});
   for(let x=10;x<W;x+=46){g.circle(x,top*0.3,3).fill({color:0x6fbf75});g.circle(x+23,bottom+(H-bottom)*0.75,3).fill({color:0x6fbf75});}
   g.rect(0,top-6,W,6).fill({color:0xd9d4c7});g.rect(0,bottom,W,6).fill({color:0xd9d4c7}); // kerbs
   this.lanes.forEach((kind,i)=>{
     const y=bottom-(i+1)*this.LH;
     if(kind==="train"){
       g.rect(0,y,W,this.LH).fill({color:0x9c8a76});
       for(let x=0;x<W;x+=18)g.rect(x,y+4,8,this.LH-8).fill({color:0x6b4f3a});
       g.rect(0,y+this.LH*0.28,W,4).fill({color:0xc9ced6});g.rect(0,y+this.LH*0.68,W,4).fill({color:0xc9ced6});
     }else g.rect(0,y,W,this.LH).fill({color:0x4b5262});
   });
   for(let i=1;i<this.lanes.length;i++){
     const y=bottom-i*this.LH;
     if(this.lanes[i]==="train"||this.lanes[i-1]==="train"){g.rect(0,y-1,W,2).fill({color:0xe7e2d6});continue;}
     for(let x=6;x<W;x+=34)g.rect(x,y-1.5,18,3).fill({color:0xffffff,alpha:0.85});
   }
   // A zebra hint where Pip crosses, and the finish flag on the far side.
   g.roundRect(this.pipX()-26,top-2,52,bottom-top+4,6).fill({color:0xffffff,alpha:0.07});
   this.world.addChild(g);
   const flag=new Graphics();
   flag.rect(this.pipX()+44,top*0.18,3,top*0.6).fill({color:0x6b4f3a});
   flag.poly([this.pipX()+47,top*0.18,this.pipX()+72,top*0.3,this.pipX()+47,top*0.42]).fill({color:0xff5d73});
   this.world.addChild(flag);
 }
 private paintLetter(lane:number,letter:string){
   const t=new Text({text:letter.toUpperCase(),style:{fontFamily:"Fredoka, Trebuchet MS, sans-serif",fontWeight:"600",fontSize:Math.round(this.LH*0.62),fill:0xffffff}});
   t.anchor.set(0.5);t.x=this.pipX()-58;t.y=this.laneY(lane);t.alpha=0.95;
   const badge=new Graphics().roundRect(t.x-this.LH*0.42,t.y-this.LH*0.4,this.LH*0.84,this.LH*0.8,8).fill({color:0x2fbf71});
   this.world.addChild(badge,t);
   badge.scale.set(1);
 }
 private drawPip(){
   const c=new Container(), r=this.LH*0.36, g=new Graphics();
   g.ellipse(0,r*0.95,r*0.9,r*0.28).fill({color:0x000000,alpha:0.18});           // shadow
   g.ellipse(-r*0.45,r*0.85,r*0.32,r*0.2).fill({color:0xc2571a});g.ellipse(r*0.45,r*0.85,r*0.32,r*0.2).fill({color:0xc2571a}); // feet
   g.circle(0,0,r).fill({color:0xffa53a});                                         // body
   g.ellipse(0,r*0.35,r*0.6,r*0.45).fill({color:0xffd18a});                        // belly
   g.circle(-r*0.36,-r*0.22,r*0.26).fill({color:0xffffff});g.circle(r*0.36,-r*0.22,r*0.26).fill({color:0xffffff});
   g.circle(-r*0.3,-r*0.18,r*0.13).fill({color:0x2b2135});g.circle(r*0.42,-r*0.18,r*0.13).fill({color:0x2b2135});
   g.circle(-r*0.62,r*0.12,r*0.12).fill({color:0xff7a8a,alpha:0.7});g.circle(r*0.62,r*0.12,r*0.12).fill({color:0xff7a8a,alpha:0.7});
   g.arc(0,r*0.08,r*0.3,0.15*Math.PI,0.85*Math.PI).stroke({color:0x2b2135,width:Math.max(2,r*0.1)});
   g.ellipse(0,-r*0.92,r*0.62,r*0.22).fill({color:0x4f8cff});g.circle(0,-r*1.08,r*0.14).fill({color:0xff5d73}); // cap
   c.addChild(g);return c;
 }
 private drawVehicle(kind:Vehicle){
   const c=new Container(), h=this.LH*0.66, color=COLORS[Math.floor(Math.random()*COLORS.length)];
   const length=kind==="car"?h*2.1:kind==="bus"?h*3.4:kind==="truck"?h*3.0:h*8.6;
   const g=new Graphics();
   const box=(x:number,w:number,col:number)=>{
     g.roundRect(x,-h/2,w,h,h*0.3).fill({color:col});
     g.circle(x+w*0.2,-h/2,h*0.13).fill({color:0x222222});g.circle(x+w*0.8,-h/2,h*0.13).fill({color:0x222222});
     g.circle(x+w*0.2,h/2,h*0.13).fill({color:0x222222});g.circle(x+w*0.8,h/2,h*0.13).fill({color:0x222222});
   };
   if(kind==="train"){
     const carW=length/3-4;
     for(let i=0;i<3;i++){box(i*(carW+4),carW,i===2?0xff5d73:0x4f8cff);for(let w=0;w<3;w++)g.roundRect(i*(carW+4)+carW*0.12+w*carW*0.28,-h*0.28,carW*0.2,h*0.56,3).fill({color:0xd9f0ff});}
   }else{
     if(kind==="truck"){box(0,length*0.7,0xeeeeee);box(length*0.72,length*0.28,color);}else box(0,length,color);
     const front=kind==="truck"?length*0.74:length*(kind==="bus"?0.82:0.62);
     g.roundRect(front,-h*0.32,length*(kind==="bus"?0.12:0.2),h*0.64,4).fill({color:0xd9f0ff}); // windscreen
     if(kind==="bus")for(let w=0;w<4;w++)g.roundRect(length*0.08+w*length*0.18,-h*0.3,length*0.12,h*0.6,3).fill({color:0xd9f0ff});
   }
   g.circle(length-2,-h*0.3,h*0.1).fill({color:0xfff27a});g.circle(length-2,h*0.3,h*0.1).fill({color:0xfff27a}); // headlights
   c.addChild(g);
   return {node:c,length};
 }
 private spawnDanger(){
   if(this.pipLane>=this.lanes.length){this.danger=null;return;}
   const {node,length}=this.drawVehicle(this.lanes[this.pipLane]);
   node.y=this.laneY(this.pipLane);node.x=-length-30;
   this.world.addChild(node);
   this.danger={node,lane:this.pipLane,speed:0,length};
 }
 /** Background traffic far ahead of Pip, just for fun (never in the lanes next to Pip). */
 private refreshDecor(){
   for(const d of this.decor)if(d.lane<=this.pipLane+1){d.node.destroy();}
   this.decor=this.decor.filter(d=>d.lane>this.pipLane+1&&!d.node.destroyed);
   for(let lane=this.pipLane+2;lane<this.lanes.length;lane++){
     if(this.decor.some(d=>d.lane===lane))continue;
     const {node,length}=this.drawVehicle(this.lanes[lane]);
     node.y=this.laneY(lane);node.x=Math.random()*this.W-length;
     this.world.addChild(node);
     this.decor.push({node,lane,speed:50+Math.random()*90,length});
   }
 }
 private honk(){
   const t=new Text({text:"BEEP!",style:{fontFamily:"Fredoka, Trebuchet MS, sans-serif",fontWeight:"600",fontSize:Math.round(this.LH*0.5),fill:0xffffff,stroke:{color:0xff5d73,width:5}}});
   t.anchor.set(0.5);t.x=this.pipX()-70;t.y=this.pipY(this.pipLane)-this.LH*0.7;this.root.addChild(t);
   this.tween(700,k=>{t.y-=0.6;t.alpha=1-k;},()=>t.destroy());
 }
 private jumpPip(from:number,to:number,dur:number){
   this.tween(dur,k=>{this.pip.y=from+(to-from)*k-Math.sin(k*Math.PI)*this.LH*0.5;this.pip.scale.set(1+Math.sin(k*Math.PI)*0.12,1-Math.sin(k*Math.PI)*0.06);},()=>{this.pip.y=to;this.pip.scale.set(1);});
 }
 private tween(dur:number,step:(k:number)=>void,done?:()=>void){this.tweens.push({t:0,dur,step,done});}
 private update(dt:number){
   if(!this.ready)return;
   // Pip's animations keep playing in a pause so a hop never freezes mid-air; traffic stops.
   for(const tw of [...this.tweens]){tw.t+=dt*1000;const k=Math.min(1,tw.t/tw.dur);tw.step(k);if(k>=1){this.tweens.splice(this.tweens.indexOf(tw),1);tw.done?.();}}
   if(this.danger){
     const start=-this.danger.length-30, end=this.pipX()-24-this.danger.length;
     const target=start+(end-start)*this.progress;
     this.danger.node.x+=(target-this.danger.node.x)*Math.min(1,dt*8); // smooth follow of the timer
   }
   for(const p of [...this.passing]){p.node.x+=p.speed*dt;if(p.node.x>this.W+40){p.node.destroy();this.passing.splice(this.passing.indexOf(p),1);}}
   if(this.paused)return;
   for(const d of this.decor){d.node.x+=d.speed*dt;if(d.node.x>this.W+20)d.node.x=-d.length-20-Math.random()*200;}
 }
}
