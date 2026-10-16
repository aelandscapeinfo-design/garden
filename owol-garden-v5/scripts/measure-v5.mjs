import {chromium} from 'playwright-core';
import fs from 'node:fs/promises';
import os from 'node:os';
const fixture=JSON.parse(await fs.readFile('evidence/art-fixture.json'));
const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
for(const [label,port] of [['V4 baseline',5180],['V5 composition',5183]]){
 const p=await b.newPage({viewport:{width:1440,height:960},deviceScaleFactor:1});p.setDefaultTimeout(120000);
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(`http://127.0.0.1:${port}`);await p.waitForFunction(()=>window.owol);
 await p.locator('#import-open').click();await p.locator('#import-file').setInputFiles({name:'same-fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});await p.waitForFunction(()=>!owol.stats().camera.running);
 const screenshot=p.waitForEvent('download');await p.locator('#scene-png').click();await screenshot;
 const initial=await p.evaluate(()=>owol.stats());await p.evaluate(()=>{owol.measurement(true);window.inputGaps=[];document.querySelector('#scene canvas').addEventListener('pointermove',e=>{if(e.buttons){const start=performance.now();requestAnimationFrame(()=>inputGaps.push(performance.now()-start));}},{capture:true})});
 await p.mouse.move(800,390);await p.mouse.down({button:'right'});
 await p.mouse.move(920,410,{steps:24});await p.mouse.up({button:'right'});
 await p.waitForFunction(()=>!owol.stats().camera.running);
 const measured=await p.evaluate(()=>owol.measurement());
 results.push({label,initial:{drawCalls:initial.drawCalls,triangles:initial.triangles,textureBytesEstimate:initial.textureBytesEstimate,lod:initial.lod},inputToNextRafMs:await p.evaluate(()=>inputGaps),constructions:initial.constructions,geometries:initial.geometries,frames:measured.frames,p50:measured.frameTimeP50,p95:measured.frameTimeP95,renderer:measured.renderer,errors});
 await p.close();
}
const report={date:new Date().toISOString(),environment:{browser:await b.version(),os:os.platform(),cpu:os.cpus()[0].model,allocatedCpuCount:os.availableParallelism(),viewport:[1440,960],canvas:[1440,882],dpr:1,quality:'standard',items:fixture.items.length,plants:fixture.items.filter(x=>x.type!=='bench').length},method:'One sequential observation per build; identical JSON fixture, steady geometry counters after PNG render (no shadow refresh); 24-step actual right mouse drag; RAF frame intervals include software rendering and browser input. Pointermove to next RAF callback is reported separately; it is not proof of display paint latency. Not a physical GPU or mobile measurement.',results};
await fs.writeFile('evidence/performance-v5.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));await b.close();
