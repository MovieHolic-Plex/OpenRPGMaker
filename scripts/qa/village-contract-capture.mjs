import { chromium } from 'playwright-core';
import fs from 'node:fs';
const out='/home/main/village-contract-live';
const project=JSON.parse(fs.readFileSync(`${out}/reloaded.json`,'utf8'));
const browser=await chromium.launch({headless:true,executablePath:'/home/main/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1600,height:1100}});page.setDefaultTimeout(120000);
try {
 await page.route('**/__village_capture',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><body></body>'}));
 await page.goto('http://127.0.0.1:9839/__village_capture');
 const evidence=await page.evaluate(async p=>{
   const {renderHarmonyMapImages}=await import('/src/ai/ultrabrainImage.ts');
   const {computeReachableCells}=await import('/src/project/lint/reachability.ts');
   const m=p.maps[p.startMapId];const fronts=m.layoutPlan.regions.filter(r=>r.role==='house').map(r=>r.front);
   const seen=computeReachableCells(p,m,p.startPos.x,p.startPos.y);
   const images=[];
   for(const map of [m,...Object.values(p.maps).filter(x=>x.id!==m.id).slice(0,1)]){
    const [image]=await renderHarmonyMapImages(p,map); images.push({id:map.id,name:map.name,dataUrl:image.dataUrl});
   }
   return {images,doorsReachable:fronts.filter(f=>seen.has(`${f.x},${f.y}`)).length,houseCount:fronts.length,start:p.startPos,
    residents:m.events.filter(e=>e.schedule?.length).map(e=>({id:e.id,pages:e.pages.map(p=>({name:p.name,lines:p.commands.filter(c=>c.kind==='text').map(c=>c.body)}))}))};
 },project);
 for(const [i,img]of evidence.images.entries()){
  // Native editor renderer output, including actual event sprites. No image edits.
  fs.writeFileSync(`${out}/${i?'interior':'village-full'}.png`,Buffer.from(img.dataUrl.split(',')[1],'base64'));
 }
 fs.writeFileSync(`${out}/render-proof.json`,JSON.stringify({...evidence,images:evidence.images.map(({dataUrl,...x})=>({...x,format:dataUrl.split(';')[0]}))},null,2));
 console.log(JSON.stringify({doorsReachable:evidence.doorsReachable,houseCount:evidence.houseCount,residents:evidence.residents.length}));
 const report=JSON.parse(fs.readFileSync(`${out}/report.json`,'utf8'));
 const events=fs.readFileSync(`${out}/run-0.ndjson`,'utf8').trim().split('\n').map(JSON.parse);const done=events.find(e=>e.type==='done');
 const editorImage='data:image/png;base64,'+fs.readFileSync(`${out}/editor-after.png`).toString('base64');
 const html=`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>조수 마을 생성 · 실제 실행 결과</title><style>body{max-width:1400px;margin:auto;padding:32px;background:#142221;color:#ecf3e9;font:17px/1.7 system-ui}h1{font-size:36px}img{max-width:100%;image-rendering:pixelated;border-radius:8px}article{background:#213331;padding:24px;margin:24px 0;border-radius:12px}.metrics{display:flex;gap:28px;flex-wrap:wrap}small{color:#b8cec7}</style><h1>말로 요청한 마을, 실제 생성 결과</h1><p>${report.prompt}</p><div class="metrics"><b>집 ${evidence.houseCount}채</b><b>주민 ${evidence.residents.length}명</b><b>입구→집 ${evidence.doorsReachable}/${evidence.houseCount} 도달</b><b>시공 ${Math.round(done.stats.ms/1000)}초 · 도구 ${done.stats.toolCalls}회</b></div><small>실제 Gemini 호출 · 모의 응답 없음 · 시공 시간은 의도 해석과 저장 시간을 제외한 worker 실행 시간</small><article><h2>Supabase에서 다시 읽은 마을</h2><img src="${evidence.images[0].dataUrl}" alt="재로드한 마을 전체"><p>프로젝트 ID: ${report.projectId}<br>원격 업서트 후 전체 문서 재조회 일치 확인. 웹 QA 세션의 자동 저장은 꺼져 있으므로 별도 스크립트로 저장했습니다.</p></article><article><h2>집 내부</h2><img src="${evidence.images[1].dataUrl}" alt="집 내부"></article><article><h2>실제 에디터 실행 화면</h2><img src="${editorImage}" alt="조수 실행이 완료된 에디터"><p>화면의 ‘저장 확인 못함’은 임시 웹 세션의 저장 상태입니다. 위 원격 저장 확인은 실행 후 QA 스크립트에서 별도로 수행했습니다.</p></article><article><h2>바뀐 흐름</h2><p>resolveVillageContract → runPiAgent 안에서 author_village → validateVillageContract → 에디터 applyProposedProject</p><p>요청 수량과 범위를 먼저 고정합니다. 시공 중에는 초안을 유지하고, 필요한 대사 보충도 같은 턴 예산에서 끝냅니다. 실제 시작점에서 집까지 타일 통행을 확인한 뒤 한 번에 반영합니다. 미감 점수는 필수 완료 조건으로 사용하지 않습니다.</p><p>외형 평가는 여전히 필요합니다. 이 결과는 길과 광장이 규칙적이고, 별도 플레이 테스트까지 한 결과는 아닙니다.</p></article></html>`;
 fs.writeFileSync('/home/main/village-contract-result.html',html);
}finally{await browser.close();}
