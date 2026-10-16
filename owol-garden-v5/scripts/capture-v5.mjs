import {chromium} from 'playwright-core';
import fs from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:960},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(120000);
await page.goto(process.env.OWOL_TEST_URL||'http://127.0.0.1:5183');await page.waitForFunction(()=>window.owol);
for(const id of ['L','U']){
 await page.locator('#compose-templates').click();await page.locator(`[data-template="${id}"]`).click();await page.locator('#template-plants').check();await page.locator('#composition-apply').click();await page.waitForFunction(()=>!owol.stats().camera.running);
 await page.locator('#camera-home').click();await page.waitForFunction(()=>!owol.stats().camera.running);
 await page.screenshot({path:`evidence/v5-${id}-garden-ui.png`});
 const png=page.waitForEvent('download');await page.locator('#scene-png').click();await(await png).saveAs(`evidence/v5-${id}-garden.png`);
 const data=page.waitForEvent('download');await page.locator('#export-json').click();await(await data).saveAs(`examples/${id}-garden.json`);
}
if(errors.length)throw Error(JSON.stringify(errors));await browser.close();console.log('Captured real L/U template gardens and matching JSON.');
