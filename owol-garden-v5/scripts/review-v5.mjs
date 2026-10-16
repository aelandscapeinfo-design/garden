import fs from 'node:fs/promises';
const files=[
 ['V4 기준 장면','v4-after-scene.png','작업 전. 선택한 군집 수정 02, 6 × 4.5 m, 식물 18개와 벤치 1개.'],
 ['V5 같은 장면','v5-baseline.png','같은 카메라·배치. PNG 바이트가 V4와 동일합니다. 모델·색·빛 변경 없이 구성 편집을 추가했습니다.'],
 ['실제 빈 땅','v5-empty.png','흙과 경계만 남깁니다. 새로고침해도 예시 식물이 자동으로 다시 생기지 않습니다.'],
 ['패치 줄이기와 구멍','v5-patch-hole.png','유효한 식재 영역이 줄어들면 해당 식물은 이동 대기로 보존됩니다. 획 이력과 문서 이력은 분리됩니다.'],
 ['ㄱ자 집과 마당','v5-L-garden.png','실제 오목 건물 footprint, 출입문, 포장·잔디·식재와 기존 V4 식물로 구성한 예시.'],
 ['ㄷ자 집과 중정','v5-U-garden.png','안쪽 공간이 막힌 직육면체가 아닌 실제 ㄷ자 면입니다. 예시 JSON으로 다시 불러올 수 있습니다.'],
 ['집 모양 편집','v5-building-editor.png','치수·회전·반전·날개·문은 미리보기와 실제 저장된 건물 기하에 연결됩니다.'],
 ['포장과 구멍','v5-paving.png','재료/패턴/모듈/방향을 분리하고 동일 면의 실제 구멍에 맞춰 패턴을 자릅니다.'],
 ['플랜터와 면 편집','v5-raised-planter.png','복제·합치기·이동·잔디 전환 후 별도의 0.55 m 플랜터에 식재한 실제 장면.'],
 ['390 × 844 터치 에뮬레이션','v5-mobile-patch.png','패널 접기와 터치 브러시를 확인했습니다. 실제 휴대폰 검수 화면은 아닙니다.'],
];
const cards=[];for(const [title,file,caption]of files){const data=(await fs.readFile('evidence/'+file)).toString('base64');cards.push(`<figure><h2>${title}</h2><a href="data:image/png;base64,${data}" download="${file}"><img alt="${title}" src="data:image/png;base64,${data}"></a><figcaption>${caption}</figcaption></figure>`)}
const html=`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>OWOL V5 실제 실행 비교</title><style>*{box-sizing:border-box}body{margin:0;padding:36px;background:#f4f2ea;color:#243029;font:16px/1.65 system-ui,sans-serif}main{max-width:1300px;margin:auto}h1{font-size:30px}p{max-width:960px}section{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:28px}figure{margin:0;padding:16px;border:1px solid #cdd1c2;background:#faf9f3}h2{font-size:18px;margin:0 0 10px}img{display:block;width:100%;max-height:560px;object-fit:contain;background:#eeece1}figcaption{margin-top:12px;font-size:14px}@media(max-width:700px){body{padding:18px}section{grid-template-columns:1fr}}</style><main><h1>OWOL Garden V5 · 같은 표현, 직접 바꾸는 구성</h1><p>모두 실제 Chromium WebGL 실행 화면입니다. 위의 두 이미지는 같은 조건으로 저장한 V4와 V5이며 픽셀까지 같습니다. 아래는 V5의 새로운 구성 편집 결과입니다. 이 페이지는 비교 자료이며 정원 실행은 START-ART-WINDOWS.cmd 또는 node serve.mjs를 사용하세요.</p><section>${cards.join('')}</section><p>Node 검사 39개, 브라우저 시나리오 23개. 실물 휴대폰·Windows 실행기는 미검증입니다. 소프트웨어 GPU 측정과 기능별 범위는 VALIDATION.md를 확인하세요. 실제 식재와 시공은 현장 조건과 전문가 검토가 필요합니다.</p></main></html>`;
await fs.writeFile('review.html',html);await fs.writeFile('release/review.html',html);console.log('Embedded actual screenshots:',files.length);
