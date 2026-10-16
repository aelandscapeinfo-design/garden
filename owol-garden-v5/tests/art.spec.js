import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
const wait=async p=>{await p.waitForFunction(()=>window.owol);await p.waitForFunction(()=>!owol.stats().camera.running)};
test('packaged art render: exact scene PNG, near/far LOD, DPR and no external runtime requests',async({browser,baseURL})=>{
 test.setTimeout(240000);
 const records=[];
 for(const dpr of [1,2]){
  const ctx=await browser.newContext({viewport:{width:1280,height:900},deviceScaleFactor:dpr});
  const p=await ctx.newPage(),errors=[],external=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  p.on('request',r=>{if(!r.url().startsWith(baseURL)&&!r.url().startsWith('data:'))external.push(r.url())});
  await p.goto(baseURL);await wait(p);
  const initial=await p.evaluate(()=>owol.stats());
  expect(initial.renderStyle).toBe('toon');expect(initial.toonBatches).toBeGreaterThan(0);expect(initial.inkBatches).toBeGreaterThan(0);expect(initial.lod).toBe('far');
  const expected=Buffer.from((await p.evaluate(()=>document.querySelector('#scene canvas').toDataURL('image/png'))).split(',')[1],'base64');
  const event=p.waitForEvent('download');await p.locator('#scene-png').click();const file=await event,actual=await fs.readFile(await file.path());
  expect(actual.equals(expected)).toBe(true);
  expect(actual.readUInt32BE(16)).toBe(1280*(dpr===1?1:1.5));
  await file.saveAs(`evidence/dpr-${dpr}-scene.png`);
  await p.screenshot({path:`evidence/dpr-${dpr}-ui.png`});
  const fixture=JSON.parse(await fs.readFile('evidence/art-fixture.json','utf8'));
  fixture.camera={position:[3.9,2.15,1.7],target:[1.9,.7,-1.3],view:'browse'};
  await p.locator('#import-open').click();await p.locator('#import-file').setInputFiles({name:'near.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});await wait(p);
  const near=await p.evaluate(()=>owol.stats());expect(near.lod).toBe('near');expect(near.inkBatches).toBeGreaterThan(0);
  const nearPng=p.waitForEvent('download');await p.locator('#scene-png').click();await(await nearPng).saveAs(`evidence/dpr-${dpr}-near.png`);
  await p.locator('#quality').click();await wait(p);
  expect((await p.evaluate(()=>owol.stats())).quality).toBe('light');expect((await p.evaluate(()=>owol.stats())).lod).toBe('far');
  records.push({dpr,initial:{width:initial.width,height:initial.height,pixelRatio:initial.pixelRatio,lod:initial.lod,drawCalls:initial.drawCalls,inkBatches:initial.inkBatches},near:{lod:near.lod,drawCalls:near.drawCalls,inkBatches:near.inkBatches},pngMatchesCanvas:true,errors,external});
  expect(errors).toEqual([]);expect(external).toEqual([]);await ctx.close();
 }
 await fs.writeFile('evidence/art-render-validation.json',JSON.stringify(records,null,2));
});
