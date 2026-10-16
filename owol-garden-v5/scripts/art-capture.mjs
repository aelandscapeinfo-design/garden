import {chromium} from 'playwright-core';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const fixture=JSON.parse(await fs.readFile('evidence/art-fixture.json'));
const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage({viewport:{width:1440,height:960},deviceScaleFactor:1});p.setDefaultTimeout(120000);
const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
const wait=async()=>{await p.waitForFunction(()=>window.owol);await p.waitForFunction(()=>!owol.stats().camera.running)};
const importData=async d=>{await p.locator('#import-open').click();await p.locator('#import-file').setInputFiles({name:'art.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(d))});await wait()};
const png=async name=>{const d=p.waitForEvent('download');await p.locator('#scene-png').click();await(await d).saveAs('evidence/'+name+'.png')};
const url=process.env.OWOL_TEST_URL||'http://127.0.0.1:5178';
await p.goto(url);await wait();
await importData(fixture);await png('after-scene');await p.screenshot({path:'evidence/after-ui.png'});
const state=await p.evaluate(()=>({state:owol.state(),stats:owol.stats()}));
assert.deepEqual(state.state.items,fixture.items);assert.deepEqual(state.state.config,fixture.sceneConfig);
fixture.camera.position.forEach((n,i)=>assert.ok(Math.abs(n-state.state.camera.position[i])<1e-8));
await fs.writeFile('evidence/after-state.json',JSON.stringify(state,null,2));
await fs.writeFile('assets/registry.json',JSON.stringify(await p.evaluate(()=>owol.assetStats()),null,2));
for(const [name,position,target]of [
  ['plants-close',[-.1,3.25,2.1],[-1.6,1.55,-.8]],
  ['ground-close',[-.1,1.3,3.4],[-1.4,.3,.65]],
  ['bench-close',[3.9,2.15,1.7],[1.9,.7,-1.3]],
  ['far',[9.5,9.5,11],[0,.65,0]],
]){await importData({...fixture,camera:{position,target,view:'browse'}});await png(name)}
for(const name of ['entrance','seat']){await p.locator(`[data-view=${name}]`).click();await wait();await png(name)}
await fs.writeFile('evidence/art-capture-validation.json',JSON.stringify({url,errors,resolution:[1440,882],sameItems:true,sameConfig:true,sameCamera:true,browser:await b.version(),capturedAt:new Date().toISOString()},null,2));
console.log({errors,drawCalls:state.stats.drawCalls,triangles:state.stats.triangles});await b.close();
