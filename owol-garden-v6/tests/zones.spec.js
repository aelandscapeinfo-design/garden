import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
const errors=new WeakMap();
test.beforeEach(async({page})=>{const list=[];errors.set(page,list);page.on('pageerror',e=>list.push(e.message));});
test.afterEach(async({page})=>{expect(errors.get(page)).toEqual([])});
const wait=async p=>{await p.waitForFunction(()=>window.owol);await p.waitForFunction(()=>!owol.stats().camera.running)};
const state=p=>p.evaluate(()=>owol.state());
const zstate=p=>p.evaluate(()=>owol.state().zoneEditor);
const data=s=>({config:s.config,items:s.items,pending:s.pending});
async function start(p){await p.goto('/');await wait(p)}
async function handle(p,i){await wait(p);await expect(p.locator(`[data-zone-handle="${i}"]`)).toBeVisible();const b=await p.locator(`[data-zone-handle="${i}"]`).boundingBox();return {x:b.x+b.width/2,y:b.y+b.height/2}}
async function drag(p,i,dx,dy){const q=await handle(p,i);await p.mouse.move(q.x,q.y);await p.mouse.down();await p.mouse.move(q.x+dx,q.y+dy,{steps:5});await p.mouse.up();await wait(p)}
async function point(p,x,z){return p.evaluate(([x,z])=>owol.screen(x,z),[x,z])}
async function click(p,x,z){const q=await point(p,x,z);await p.mouse.click(q.x,q.y)}
async function exported(p){const event=p.waitForEvent('download');await p.locator('#export-json').click();return JSON.parse(await fs.readFile(await(await event).path(),'utf8'))}
async function imported(p,d){await p.locator('#import-open').click();await p.locator('#import-file').setInputFiles({name:'zones.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(d))});await wait(p)}
test('zone vertices, local gesture history, curve, scale, atomic apply and all storage round trips',async({page:p})=>{
 await start(p);const initial=data(await state(p)),builds=await p.evaluate(()=>owol.stats().constructions);await p.locator('#zone-open').click();const before=await zstate(p);
 await drag(p,0,25,10);const moved=await zstate(p);expect(moved.past).toBe(1);expect(moved.zones).not.toEqual(before.zones);expect(moved.error).toBeNull();
 await p.locator('#zone-undo').click();expect((await zstate(p)).zones).toEqual(before.zones);await p.locator('#zone-redo').click();expect((await zstate(p)).zones).toEqual(moved.zones);
 await p.locator('#zone-snap').uncheck();await drag(p,0,4,1);expect((await zstate(p)).zones[0].points[0].some(v=>Math.abs(v*4-Math.round(v*4))>.001)).toBe(true);await p.locator('#zone-undo').click();await p.locator('#zone-snap').check();
 await p.locator('[data-zone-mode=add]').click();const z=(await zstate(p)).zones[0],a=z.points[4],b=z.points[5];await click(p,(a[0]+b[0])/2,(a[1]+b[1])/2);expect((await zstate(p)).zones[0].points).toHaveLength(7);
 await p.locator('#zone-point-delete').click();expect((await zstate(p)).zones[0].points).toHaveLength(6);
 await p.locator('#zone-round').selectOption('0.15');await p.locator('#zone-smaller').click();expect((await zstate(p)).error).toBeNull();
 expect(await p.evaluate(()=>owol.stats().constructions)).toBe(builds);await p.screenshot({path:'evidence/zone-editor-desktop.png'});await p.locator('#zone-apply').click();await wait(p);const edited=data(await state(p));expect(edited.config.customZones).toBe(true);expect(edited.items.length+edited.pending.length).toBe(19);expect(edited.config.plantableZones[0].polygon.length).toBeGreaterThan(6);
 await p.locator('#undo').click();expect(data(await state(p))).toEqual(initial);await p.locator('#redo').click();expect(data(await state(p))).toEqual(edited);
 await p.locator('#save').click();await p.reload();await wait(p);await p.locator('#load').click();await wait(p);expect(data(await state(p))).toEqual(edited);
 const json=await exported(p);expect(json.version).toBe(6);await imported(p,json);expect(data(await state(p))).toEqual(edited);
 const png=p.waitForEvent('download');await p.locator('#scene-png').click();await(await png).saveAs('evidence/zone-edited-scene.png');
 const old=await fs.readFile('evidence/art-fixture.json','utf8');await p.evaluate(raw=>localStorage.setItem('owol-art-study-01',raw),old);const newSlot=await p.evaluate(()=>localStorage.getItem('owol-garden-materials-v6'));
 await p.locator('#import-open').click();await p.locator('#previous-load').click();await wait(p);expect((await state(p)).config.customZones).not.toBe(true);expect(await p.evaluate(()=>localStorage.getItem('owol-art-study-01'))).toBe(old);expect(await p.evaluate(()=>localStorage.getItem('owol-garden-materials-v6'))).toBe(newSlot);await p.locator('#load').click();expect(data(await state(p))).toEqual(edited);
});
test('new contour, whole translation, delete and restoration preserve every plant',async({page:p})=>{
 await start(p);const initial=data(await state(p));await p.locator('#zone-open').click();await p.locator('#zone-delete').click();await p.locator('#zone-new').click();
 for(const q of [[-2.5,-1.5],[-1,-1.5],[-1,.5],[-2.5,.5]])await click(p,...q);await p.locator('#zone-finish').click();
 let z=await zstate(p);expect(z.error).toBeNull();const id=z.selected;expect(z.zones.find(z=>z.id===id).points).toHaveLength(4);
 await p.locator('[data-zone-mode=move]').click();const q=await point(p,-1.7,-.5),to=await point(p,-1.45,-.5);await p.mouse.move(q.x,q.y);await p.mouse.down();await p.mouse.move(to.x,to.y,{steps:4});await p.mouse.up();await wait(p);
 expect((await zstate(p)).zones.find(z=>z.id===id).points).not.toEqual(z.zones.find(z=>z.id===id).points);expect((await zstate(p)).error).toBeNull();
 await p.locator('#zone-apply').click();await wait(p);let s=await state(p);expect(s.items.length+s.pending.length).toBe(19);expect(s.pending.length).toBeGreaterThan(0);
 await p.locator('#undo').click();expect(data(await state(p))).toEqual(initial);await p.locator('#redo').click();
 await p.locator('#zone-open').click();while((await zstate(p)).zones.length)await p.locator('#zone-delete').click();await p.locator('#zone-apply').click();s=await state(p);expect(s.items).toHaveLength(1);expect(s.pending).toHaveLength(18);expect(new Set([...s.items,...s.pending.map(p=>p.item)].map(i=>i.id)).size).toBe(19);
});
test('invalid preview, pointer cancellation, camera gestures and Escape never change saved geometry',async({page:p})=>{
 await start(p);const initial=data(await state(p));await p.locator('#zone-open').click();await drag(p,0,-360,-100);expect((await zstate(p)).error).not.toBeNull();await expect(p.locator('#zone-apply')).toBeDisabled();expect(data(await state(p))).toEqual(initial);await p.screenshot({path:'evidence/zone-invalid-preview.png'});await p.locator('#zone-cancel').click();expect(data(await state(p))).toEqual(initial);
 await p.locator('#zone-open').click();const z=await zstate(p),h=await handle(p,0);await p.mouse.move(h.x,h.y);await p.mouse.down();await p.mouse.move(h.x+25,h.y+12);await p.locator('#scene canvas').dispatchEvent('pointercancel',{pointerId:1,pointerType:'mouse',bubbles:true});await p.mouse.up();expect((await zstate(p)).zones).toEqual(z.zones);expect((await zstate(p)).past).toBe(0);
 const cam=(await state(p)).camera;await p.mouse.move(850,390);await p.mouse.down({button:'right'});await p.mouse.move(930,405,{steps:8});await p.mouse.up({button:'right'});await wait(p);expect((await state(p)).camera.position).not.toEqual(cam.position);expect((await zstate(p)).zones).toEqual(z.zones);expect((await zstate(p)).past).toBe(0);
 await p.locator('#zone-smaller').click();await p.keyboard.press('Escape');expect((await zstate(p)).active).toBe(false);expect(data(await state(p))).toEqual(initial);
 await p.locator('#zone-open').click();await p.locator('#zone-smaller').click();await p.evaluate(()=>window.dispatchEvent(new Event('blur')));expect((await zstate(p)).active).toBe(false);expect(data(await state(p))).toEqual(initial);
});
test('raised planter mesh/height and custom contour transfer across dimensions',async({page:p})=>{
 await start(p);await p.locator('#edit-profile').click();await p.locator('#preset').selectOption('terrace');await p.locator('[name=transfer][value=archive]').check();await p.locator('#condition-form [type=submit]').click();await wait(p);
 await p.locator('#zone-open').click();await p.locator('#zone-height').fill('0.75');await p.locator('#zone-height').blur();await p.locator('#zone-round').selectOption('0.15');expect((await zstate(p)).error).toBeNull();await p.locator('#zone-apply').click();await wait(p);expect((await p.evaluate(()=>owol.zoneGeometry()))[0].height).toBe(.75);await p.locator('#zone-open').click();await p.locator('#zone-new').click();const drawn=[[-1.75,-.25],[-1.25,-.25],[-1.25,.5],[-1.75,.5]];for(const q of drawn)await click(p,...q);await p.locator('#zone-finish').click();const draft=await zstate(p);expect(draft.error).toBeNull();expect(draft.zones.find(z=>z.id===draft.selected).points).toEqual(drawn);await p.locator('#zone-apply').click();await wait(p);const original=(await state(p)).config.plantableZones;
 await p.screenshot({path:'evidence/zone-raised-planter.png'});await p.locator('#edit-profile').click();await p.locator('[name=width]').fill('8');await p.locator('[name=depth]').fill('4');await expect(p.locator('#zone-transfer-options')).toBeVisible();await p.locator('[name=zoneTransfer][value=keep]').check();await p.locator('[name=transfer][value=move]').check();await p.locator('#condition-form [type=submit]').click();await wait(p);expect((await state(p)).config.plantableZones.map(z=>z.points)).toEqual(original.map(z=>z.points));expect((await state(p)).config.plantableZones[0].height).toBe(.75);
 const valid=data(await state(p));await p.locator('#edit-profile').click();await p.locator('[name=width]').fill('3');await p.locator('[name=depth]').fill('3');await p.locator('[name=zoneTransfer][value=keep]').check();await p.locator('[name=transfer][value=move]').check();await p.locator('#condition-form [type=submit]').click();await expect(p.locator('#conditions')).toBeVisible();expect(data(await state(p))).toEqual(valid);
 await p.locator('[name=zoneTransfer][value=reset]').check();await p.locator('#condition-form [type=submit]').click();await wait(p);expect((await state(p)).config.customZones).not.toBe(true);expect(await p.evaluate(()=>Object.keys(localStorage).some(k=>k.startsWith('owol-garden-materials-v6-archive-')))).toBe(true);
});
test('mobile contour touch edits, two-touch cancellation and camera mode stay separate',async({browser,baseURL})=>{
 const c=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});const p=await c.newPage();await p.goto(baseURL);await wait(p);await p.locator('#zone-open').click();
 const h=await handle(p,0),initial=await zstate(p),cdp=await c.newCDPSession(p);
 const touch=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
 await touch('touchStart',[{x:h.x,y:h.y,id:0}]);await touch('touchMove',[{x:h.x+12,y:h.y+4,id:0}]);await touch('touchEnd',[]);expect((await zstate(p)).past).toBe(1);
 await p.locator('#zone-undo').click();expect((await zstate(p)).zones).toEqual(initial.zones);
 await touch('touchStart',[{x:h.x,y:h.y,id:0}]);await touch('touchMove',[{x:h.x+12,y:h.y+4,id:0}]);await touch('touchStart',[{x:h.x+12,y:h.y+4,id:0},{x:h.x+30,y:h.y,id:1}]);await touch('touchEnd',[]);expect((await zstate(p)).zones).toEqual(initial.zones);expect((await zstate(p)).past).toBe(0);
 expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await p.screenshot({path:'evidence/zone-mobile-ui.png'});await p.locator('[data-view=browse]').click();expect((await zstate(p)).active).toBe(false);expect((await state(p)).view).toBe('browse');await c.close();
});
