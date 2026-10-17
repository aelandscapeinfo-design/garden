import {chromium} from 'playwright-core';
import fs from 'node:fs/promises';
const b=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage({viewport:{width:1440,height:960},deviceScaleFactor:1});await p.goto('http://127.0.0.1:5186');await p.waitForFunction(()=>window.owol&&!owol.stats().camera.running);
const a=JSON.parse(await fs.readFile('examples/v6/material-samples.json')),c=JSON.parse(await fs.readFile('examples/v6/mixed-garden.json'));
const load=async data=>{await p.locator('#import-open').click();await p.locator('#import-file').setInputFiles({name:'memory.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});await p.waitForFunction(()=>!owol.stats().camera.running);await p.evaluate(async()=>{await new Promise(requestAnimationFrame);await owol.benchmark(1)})};
const cycles=[];
for(let i=0;i<8;i++){await load(a);await load(c);const stats=await p.evaluate(()=>({geometries:owol.stats().geometries,textures:owol.stats().textures,prototypes:owol.stats().prototypes}));if(i>=2)cycles.push(stats);}
const r=JSON.parse(await fs.readFile('evidence/v6/performance.json'));r.initialUnfencedMemoryCycles=r.memoryCycles;r.memoryCycles=cycles;r.memoryStableAfterWarmup=cycles.every(x=>JSON.stringify(x)===JSON.stringify(cycles[0]));r.memoryMethod='Separate fresh browser. Two warm-up round trips, six measured round trips. One animation-frame boundary and synchronous renderer/readback fence after each import; counts sampled after drawing. Initial asynchronous samples retained separately.';
await fs.writeFile('evidence/v6/performance.json',JSON.stringify(r,null,2));console.log(JSON.stringify({memoryStable:r.memoryStableAfterWarmup,cycles,method:r.memoryMethod},null,2));await b.close();
