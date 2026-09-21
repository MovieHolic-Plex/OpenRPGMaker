// Real editor tool + native renderer; no LLM call. Dedicated remote rows only.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const forest = process.argv.includes('--forest');
const manor = process.argv.includes('--manor');
const out = manor ? '/home/main/river-village-manor-live' : forest ? '/home/main/river-village-forest-live' : '/home/main/river-village-live'; fs.mkdirSync(out, { recursive: true });
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{ const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1).trim().replace(/^['"]|['"]$/g,'')]; }));
const projectId = manor ? 'river-village-manor-20260921-414a' : forest ? 'river-village-forest-20260921-414a' : 'river-village-live-20260921-414a';
async function remote(method, body) {
 const url = `${env.VITE_SUPABASE_URL}/rest/v1/projects?${method==='GET'?`project_id=eq.${projectId}&select=current_json,current_sha256`:'on_conflict=project_id'}`;
 const r=await fetch(url,{method,headers:{apikey:env.VITE_SUPABASE_ANON_KEY,Authorization:`Bearer ${env.VITE_SUPABASE_ANON_KEY}`,'Content-Type':'application/json','Accept-Profile':'rpg_zzu','Content-Profile':'rpg_zzu',Prefer:'resolution=merge-duplicates,return=representation'},...(body?{body:JSON.stringify(body)}:{})});
 if(!r.ok)throw new Error(`DB ${r.status}: ${(await r.text()).slice(0,250)}`);return r.json();
}
async function save(p) {const sha=createHash('sha256').update(JSON.stringify(p)).digest('hex');await remote('POST',{project_id:projectId,title:p.title??'조수 마을 계약 실험',schema_version:p.schemaVersion??p.version??1,current_json:p,current_sha256:sha,map_count:Object.keys(p.maps).length,tileset_count:Object.keys(p.tilesets).length,terrain_template_count:0});const [row]=await remote('GET'); if(row.current_sha256!==sha || JSON.stringify(row.current_json.maps)!==JSON.stringify(p.maps)) { // JSONB reorders keys; hash + stable value comparison below
 const normalize=v=>v&&typeof v==='object'?Array.isArray(v)?v.map(normalize):Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,normalize(x)])):v;
 if(row.current_sha256!==sha||JSON.stringify(normalize(row.current_json))!==JSON.stringify(normalize(p)))throw new Error('DB reload mismatch');
 } return {project:row.current_json,sha};}

// Verify the dedicated remote target is reachable before authoring content.
await remote('GET');
const baseline=JSON.parse(fs.readFileSync('/home/main/village-contract-live/baseline.json','utf8'));
const browser=await chromium.launch({headless:true,executablePath:'/home/main/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1600,height:1100}});page.setDefaultTimeout(120000);
try {
 await page.route('**/__river_capture',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><body></body>'}));
 await page.goto('http://127.0.0.1:9839/__river_capture');
 const result=await page.evaluate(async ({baseline,forest,manor})=>{
  const {AUTHOR_VILLAGE_TOOL}=await import('/src/editor/tools/authorVillageTool.ts');
  const p=structuredClone(baseline);
  const report=AUTHOR_VILLAGE_TOOL.run(p,{target:{kind:'existing',mapId:p.startMapId},houseCount:8,npcCount:4,countPolicy:'exact',seed:17,interior:true,...(manor?{housePlans:Array.from({length:8},(_,i)=>({program:i<2?'manor':'dwelling',...(i===1?{fence:false}:{})}))}:{}),...(forest?{morphology:'river',theme:'숲이 있는 강촌'}:{})});
  return {project:p,report};
 },{baseline,forest,manor});
 const saved=await save(result.project);
 fs.writeFileSync(`${out}/reloaded.json`,JSON.stringify(saved.project));
 fs.writeFileSync(`${out}/report.json`,JSON.stringify({projectId,sha:saved.sha,remoteReloadVerified:true,report:result.report},null,2));
 const rendered=await page.evaluate(async p=>{
  const {renderHarmonyMapImages}=await import('/src/ai/ultrabrainImage.ts');
  const {computeReachableCells}=await import('/src/project/lint/reachability.ts');
  const m=p.maps[p.startMapId], fronts=m.layoutPlan.regions.filter(r=>r.role==='house').map(r=>r.front);
  const reachable=computeReachableCells(p,m,p.startPos.x,p.startPos.y);
  const [image]=await renderHarmonyMapImages(p,m);
  const fenceTiles=new Set([378,379,380,408,409,410,438,439]);
  const oldTrees=new Set([260,261,262,263,290,291,292,293]);
  return {tilesetId:m.tilesetId,tilesetName:p.tilesets[m.tilesetId].name,fencedHouses:m.layoutPlan.regions.filter(r=>r.role==='house'&&r.hasFence).length,fenceTileCount:m.upperTiles.filter(t=>fenceTiles.has(t)).length,legacyTreeTileCount:[...m.lowerTiles,...m.upperTiles].filter(t=>oldTrees.has(t)).length,dataUrl:image.dataUrl,start:p.startPos,width:m.width,height:m.height,houseCount:fronts.length,doorsReachable:fronts.filter(f=>reachable.has(`${f.x},${f.y}`)).length};
 },saved.project);
 fs.writeFileSync(`${out}/village-full.png`,Buffer.from(rendered.dataUrl.split(',')[1],'base64'));
 const {dataUrl,...proof}=rendered;
 fs.writeFileSync(`${out}/render-proof.json`,JSON.stringify(proof,null,2));
 fs.writeFileSync(manor ? '/home/main/river-village-manor-result.html' : forest ? '/home/main/river-village-forest-result.html' : '/home/main/river-village-result.html',`<!doctype html><html lang="ko"><meta charset="utf-8"><title>강변 마을 생성 결과</title><style>body{max-width:1400px;margin:auto;background:#182624;color:#e9efe4;padding:28px;font:18px/1.6 system-ui}img{max-width:100%;image-rendering:pixelated}</style><h1>강을 따라 자란 마을</h1><p>에디터의 실제 author_village 실행 · 집 ${proof.houseCount}채 · 현관 도달 ${proof.doorsReachable}/${proof.houseCount}</p><p>${proof.tilesetName} · 울타리 집 ${proof.fencedHouses}채 · 이전 나무 타일 ${proof.legacyTreeTileCount}칸</p><img src="${dataUrl}" alt="Supabase에서 재로드한 강변 마을"><p>project id: ${projectId} · 원격 저장 후 전체 문서 재조회 일치 확인. LLM 호출 없이 실제 도구를 직접 실행한 결과입니다.</p></html>`);
 console.log(JSON.stringify({projectId,...proof,summary:result.report.summary}));
}finally{await browser.close();}
