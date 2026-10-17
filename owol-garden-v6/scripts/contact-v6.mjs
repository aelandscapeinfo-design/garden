import {chromium} from 'playwright-core';
import fs from 'node:fs/promises';
import * as T from 'three';
import {PLANTS_V6,libraryCounts} from '../src/plant-library-v6.js';
import {plantPrototype} from '../src/plant-models-v6.js';
import {surfaceSpecification} from '../src/surface-materials-v6.js';
const b=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage({viewport:{width:1440,height:960},deviceScaleFactor:1});await p.goto('http://127.0.0.1:5186');await p.waitForFunction(()=>window.owol&&!owol.stats().camera.running);
const cards=[],manifest=[];
for(const [type,spec]of Object.entries(PLANTS_V6)){
 const url=await p.evaluate(type=>owol.assetThumbnail(type,'flowering'),type);await fs.writeFile('evidence/v6/'+type+'.png',Buffer.from(url.split(',')[1],'base64'));
 const states={};for(const season of ['foliage','flowering']){states[season]={};for(const lod of ['near','far']){const root=plantPrototype(type,0,lod,season),box=new T.Box3().setFromObject(root),size=box.getSize(new T.Vector3());states[season][lod]={boundsM:size.toArray().map(x=>+x.toFixed(3)),rootY:+box.min.y.toFixed(6),triangles:root.children.reduce((s,m)=>s+m.geometry.attributes.position.count/3,0),parts:root.children.length};}}
 manifest.push({...spec,renderBounds:states,actualRender:'evidence/v6/'+type+'.png',specimenScene:'examples/v6/plant-specimens.json',referencePhotosBundled:false});
 cards.push(`<article><img src="${url}" alt="${spec.displayNameKo}"><h2>${spec.displayNameKo}</h2><p>${spec.assetId} · v${spec.assetVersion}</p><p>${spec.morphologyCard}</p><small>화면 기준 높이 ${spec.modelDisplayHeightM} m · 폭 ${spec.modelDisplayWidthM} m</small></article>`);
}
const html=`<!doctype html><html lang="ko"><meta charset="utf-8"><title>OWOL V6 실제 자산 12개</title><style>body{margin:0;padding:38px;background:#f4f2e8;color:#294335;font:15px system-ui}h1{font-size:30px;margin:0 0 8px}header p{max-width:1200px;line-height:1.6;color:#5b6b58}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}article{background:#faf9f2;border:1px solid #d5dccb;border-radius:10px;padding:16px}article img{display:block;width:100%;height:190px;object-fit:contain}h2{font-size:17px;margin:12px 0 7px}article p{font-size:12px;line-height:1.6;margin:5px 0}small{font-size:11px;color:#687a60}</style><header><h1>오월 V6 · 실제 렌더 자산 12개</h1><p>게임의 동일 모델·재질·썸네일 렌더 경로로 촬영했습니다. 사진·생성 시안이 아닙니다. 카드마다 확대 비율이 다릅니다. 상대 크기는 별도 표본 장면에서 비교하세요.<br>꽃 보기 상태를 비교한 형태 예시입니다. 특정 품종 재현·생육 적합성은 미검증입니다. 36개 목표 중 현재 신규 자산은 12개입니다.</p></header><section class="grid">${cards.join('')}</section></html>`;
await fs.writeFile('evidence/v6/contact-sheet.html',html);const contact=await b.newPage({viewport:{width:1440,height:1200},deviceScaleFactor:1});await contact.setContent(html);await contact.screenshot({path:'evidence/v6/contact-sheet.png',fullPage:true});
await fs.writeFile('evidence/v6/asset-manifest.json',JSON.stringify({counts:libraryCounts(),assets:manifest},null,2));await fs.writeFile('evidence/v6/material-specification.json',JSON.stringify(surfaceSpecification(),null,2));await b.close();console.log('Captured twelve actual assets and wrote measured geometry manifest.');
