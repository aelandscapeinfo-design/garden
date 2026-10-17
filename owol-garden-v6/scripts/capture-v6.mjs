import {chromium} from 'playwright-core';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const evidence='evidence/v6';await fs.mkdir(evidence,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await browser.newPage({viewport:{width:1440,height:960},deviceScaleFactor:1});
const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
const wait=async()=>{await p.waitForFunction(()=>window.owol);await p.waitForFunction(()=>!owol.stats().camera.running)};
const load=async d=>{await p.locator('#import-open').click();await p.locator('#import-file').setInputFiles({name:'fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(d))});await wait();assert.equal((await p.evaluate(()=>owol.state())).items.length,d.items.length)};
const png=async name=>{const event=p.waitForEvent('download');await p.locator('#scene-png').click();await(await event).saveAs(evidence+'/'+name+'.png')};
// Same browser, viewport, saved camera and original lighting for both versions.
await p.goto('http://127.0.0.1:5182');await wait();
const materialV5=JSON.parse(await fs.readFile('examples/v6/material-samples-v5-reference.json'));
await load(materialV5);await png('materials-before-v5');
await p.goto('http://127.0.0.1:5186');await wait();
for(const name of ['material-samples','plant-specimens','plant-specimens-foliage','mixed-garden']){
 const d=JSON.parse(await fs.readFile('examples/v6/'+name+'.json'));await load(d);await png(name);await p.screenshot({path:evidence+'/'+name+'-ui.png'});
 const s=await p.evaluate(()=>owol.state());assert.deepEqual(s.items,d.items);assert.deepEqual(s.config.composition,d.sceneConfig.composition);
 await p.locator('#save').click();await p.reload();await wait();const restored=await p.evaluate(()=>owol.state());assert.deepEqual(restored.items,d.items);assert.deepEqual(restored.config.composition,d.sceneConfig.composition);
 // Import again and capture the exact same saved camera after restoring.
 await load(d);await png(name+'-restored');
 console.log('Captured and round-tripped:',name);
}
const report={errors,browser:await browser.version(),viewport:{width:1440,height:960},measurement:await p.evaluate(()=>owol.measurement()),source:'actual running app; scene PNG exports; no generated mockups'};
await fs.writeFile(evidence+'/capture-report.json',JSON.stringify(report,null,2));assert.deepEqual(errors,[]);await browser.close();
