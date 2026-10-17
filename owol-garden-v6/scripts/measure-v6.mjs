import {chromium} from 'playwright-core';
import fs from 'node:fs/promises';
import os from 'node:os';
import {emptyScene,regionDefaults,derive} from '../src/composition-state.js';
import {rect} from '../src/scene-config.js';
import {fromRing} from '../src/region-geometry.js';
import {PLANTS_V6,plantReference} from '../src/plant-library-v6.js';
import {encode,decode} from '../src/persistence.js';
const b=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage({viewport:{width:1440,height:960},deviceScaleFactor:1});const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
await p.goto('http://127.0.0.1:5186');await p.waitForFunction(()=>window.owol&&!owol.stats().camera.running);
const load=async d=>{await p.locator('#import-open').click();await p.locator('#import-file').setInputFiles({name:'performance.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(d))});await p.waitForFunction(()=>!owol.stats().camera.running)};
let config=emptyScene(16,16);config.composition.regions=[regionDefaults('benchmark-soil',fromRing(rect(0,0,15.8,15.8)))];config=derive(config);const types=Object.keys(PLANTS_V6),measurements=[];
for(const count of [50,150,300]){
 const items=Array.from({length:count},(_,i)=>{const type=types[i%types.length];return {id:i+1,type,x:-7.1+(i%20)*.74,z:-6.8+Math.floor(i/20)*.88,r:i*37%360,scale:.8,variant:Math.floor(i/types.length)%3,...plantReference(type),seed:771+i,seasonalState:i%4===0?'flowering':'foliage'}});
 const document=encode({config,items,pending:[],profile:{},wish:'',camera:{position:[12,16,19],target:[0,.4,0],view:'edit'}});decode(document);const start=Date.now();await load(document);const loadAndSettleMs=Date.now()-start;
 const result=await p.evaluate(async()=>{await owol.benchmark(2);return owol.benchmark(12)});
 const summary={count,loadAndSettleMs,drawCalls:result.drawCalls,triangles:result.triangles,textureBytesEstimate:result.textureBytesEstimate,geometries:result.geometries,prototypes:result.prototypes,samples:result.samples,medianRenderAndReadbackMs:result.medianRenderAndReadbackMs,medianFrameIntervalMs:result.medianFrameIntervalMs,p95FrameIntervalMs:result.p95FrameIntervalMs,approxLoopFps:+(1000/result.medianFrameIntervalMs).toFixed(2),lod:result.lod,renderer:result.renderer,note:result.note};measurements.push(summary);console.log(JSON.stringify(summary));
}
const memory=[];const material=JSON.parse(await fs.readFile('examples/v6/material-samples.json'));
for(let i=0;i<6;i++){await load(material);await load(JSON.parse(await fs.readFile('examples/v6/mixed-garden.json')));await p.evaluate(async()=>{await new Promise(requestAnimationFrame);await owol.benchmark(1)});memory.push(await p.evaluate(()=>({geometries:owol.stats().geometries,textures:owol.stats().textures,prototypes:owol.stats().prototypes})));}
const report={date:'2026-10-17',hardware:{cpu:os.cpus()[0]?.model,cpuCount:os.cpus().length,totalMemoryBytes:os.totalmem()},browser:await b.version(),viewport:{width:1440,height:960},dpr:1,measurements,memoryCycles:memory,memoryStableAfterWarmup:memory.slice(1).every(a=>a.geometries===memory[1].geometries&&a.textures===memory[1].textures&&a.prototypes===memory[1].prototypes),errors,limitations:'Linux Chromium SwiftShader software rendering. Synchronous readback loop and warm caches; not real-phone FPS, hardware GPU time, heap leak proof or a 30fps guarantee. Camera is fixed. Shadow refresh on every frame is not measured.'};
await fs.writeFile('evidence/v6/performance.json',JSON.stringify(report,null,2));if(errors.length)throw Error(errors.join('\n'));await b.close();
