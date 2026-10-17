import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import {PLANTS_V6} from '../src/plant-library-v6.js';
const wait=async p=>{await p.waitForFunction(()=>window.owol);await p.waitForFunction(()=>!owol.stats().camera.running)};
const fixture=async name=>JSON.parse(await fs.readFile('examples/v6/'+name+'.json','utf8'));
const load=async(p,data)=>{await p.locator('#import-open').click();await p.locator('#import-file').setInputFiles({name:'garden.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});await wait(p)};
const image=async p=>{const event=p.waitForEvent('download');await p.locator('#scene-png').click();return fs.readFile(await(await event).path())};
test('all twelve visible catalogue assets actually place, keep seed/season and reload',async({page:p})=>{
 const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await p.goto('/');await wait(p);const d=await fixture('plant-specimens');d.items=[];await load(p,d);await p.locator('#plant-season').selectOption('flowering');
 let index=0;for(const [type,spec]of Object.entries(PLANTS_V6)){
  await p.locator(`[data-type="${type}"]`).scrollIntoViewIfNeeded();await p.locator(`[data-type="${type}"]`).click();
  const x=(index%4-1.5)*2.15,z=(Math.floor(index/4)-1)*2.2,q=await p.evaluate(([x,z])=>owol.screen(x,z),[x,z]);await p.mouse.click(q.x,q.y);
  const items=await p.evaluate(()=>owol.state().items);expect(items).toHaveLength(index+1);expect(items.at(-1)).toMatchObject({type,assetId:spec.assetId,assetVersion:1,catalogId:spec.catalogId,seasonalState:'flowering'});expect(Number.isInteger(items.at(-1).seed)).toBe(true);index++;
 }
 const before=await p.evaluate(()=>owol.state().items);await p.locator('#save').click();await p.reload();await wait(p);expect(await p.evaluate(()=>owol.state().items)).toEqual(before);expect(errors).toEqual([]);
 await p.screenshot({path:'evidence/v6/twelve-placed-through-ui.png'});
});
test('V5 local slot migrates in browser and saving V6 leaves original byte-for-byte',async({page:p})=>{
 const old=await fs.readFile('tests/fixtures/v5/patch-and-catalog.json','utf8');
 await p.addInitScript(raw=>{if(!localStorage.getItem('fixture-seeded')){localStorage.setItem('owol-garden-composition-v5',raw);localStorage.setItem('fixture-seeded','yes')}},old);
 await p.goto('/');await wait(p);const original=JSON.parse(old);expect(await p.evaluate(()=>owol.state().items)).toEqual(original.items);
 await p.locator('#save').click();expect(await p.evaluate(()=>localStorage.getItem('owol-garden-composition-v5'))).toBe(old);
 const current=await p.evaluate(()=>JSON.parse(localStorage.getItem('owol-garden-materials-v6')));expect(current.version).toBe(6);expect(current.items).toEqual(original.items);expect(current.camera).toEqual(await p.evaluate(()=>owol.state().camera));
});
test('scene PNG excludes patch/grid overlay while material and geometry stay unchanged',async({page:p})=>{
 await p.goto('/');await wait(p);await load(p,await fixture('material-samples'));await p.mouse.move(20,90);const before=await image(p),comparisonBefore=await p.evaluate(()=>owol.comparisonImage());
 await p.locator('#compose-patch').click();const q=await p.evaluate(()=>owol.screen(0,0));await p.mouse.click(q.x,q.y);expect(await p.locator('#patch-overlay path').count()).toBeGreaterThan(0);
 expect(await p.locator('#scene-png').isVisible()).toBe(false);const comparisonDuring=await p.evaluate(()=>owol.comparisonImage());expect(comparisonDuring).toBe(comparisonBefore);await p.locator('#patch-cancel').click();expect((await image(p)).equals(before)).toBe(true);
});
test('mobile save and camera controls receive pointer input above expanded plant panel',async({browser,baseURL})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const p=await context.newPage();await p.goto(baseURL);await wait(p);
 for(const selector of ['#save','#zoom-in','#zoom-out']){
  // The camera buttons use aria labels in the original UI.
  const target=selector==='#save'?p.locator(selector):p.getByRole('button',{name:selector==='#zoom-in'?'확대':'축소',exact:true});
  expect(await target.evaluate(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return e===hit||e.contains(hit)})).toBe(true);
 }
 await p.locator('#save').click();expect(await p.evaluate(()=>JSON.parse(localStorage.getItem('owol-garden-materials-v6')).version)).toBe(6);await context.close();
});
