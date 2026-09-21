// Reference-only migration. Preserve current maps and use CAS for both project stores.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {loadEnv} from 'vite';
import {withTsModule} from '../ontology-ts-loader.mjs';
const out='output/castle-ai-references';fs.mkdirSync(out,{recursive:true});
const root='tiledata/castle-tiles-rpgs',env=loadEnv('development',process.cwd(),'');
assert(env.VITE_SUPABASE_URL&&env.VITE_SUPABASE_ANON_KEY);
const headers={apikey:env.VITE_SUPABASE_ANON_KEY,Authorization:'Bearer '+env.VITE_SUPABASE_ANON_KEY,'Accept-Profile':'rpg_zzu','Content-Profile':'rpg_zzu','Content-Type':'application/json',Prefer:'return=representation'};
const endpoint=env.VITE_SUPABASE_URL+'/rest/v1/';
async function request(route,method='GET',body){const r=await fetch(endpoint+route,{method,headers,...(body?{body:JSON.stringify(body)}:{})});assert(r.ok,`Database ${r.status}`);return r.json();}
const projectId='castle-fortress-city-20260921';
assert((await request('projects?project_id=eq.'+projectId+'&select=project_id')).length===1);
const groups=[];
function category(id,name,description,docs,images){
 const g={id,name,description,documents:[],images:[]};
 for(const file of docs){let markdown=fs.readFileSync(root+'/'+file,'utf8');
  if(!file.endsWith('.md'))markdown=`# ${path.basename(file)}\n\n\`\`\`${file.endsWith('.json')?'json':'text'}\n${markdown}\n\`\`\``;
  const warning=file.startsWith('improvements/landscape-02/')?'\n> 이 단계의 목재 관리소는 사용자 선택으로 취소되었습니다. 최종 관리소는 개선1 석조 건물입니다. 나머지 개선2 구역은 유지합니다.\n':'';
  g.documents.push({id:file.replace(/[^\w.-]/g,'-'),name:file,markdown:`> 연구 출처: ${root}/${file}. 경로는 출처 표기입니다. 본문은 DB에 포함됩니다. 과거 판정과 현재 적용 여부는 00-읽기-순서를 우선합니다.\n${warning}\n${markdown}`});
 }
 let gallery='# 비교 그림\n\n학습·비교 전용입니다. 사용자 참고 그림에서 타일을 잘라 게임 소재로 사용하지 않습니다. 원본 그림에 보이는 큰 돌다리는 사용 제외 상태입니다.\n';
 for(const file of images){const bytes=fs.readFileSync(root+'/'+file);assert(bytes.length<=4e6);const id=file.replace(/[^\w.-]/g,'-');g.images.push({id,name:file,caption:file+' · 학습/비교용. 경로별 제작 단계와 본문 판정을 함께 읽습니다.',dataUrl:'data:image/png;base64,'+bytes.toString('base64')});gallery+=`\n## ${file}\n![${file}](image:${id})\n`;}
 if(images.length)g.documents.push({id:'visual-evidence',name:'그림과 비교 증거.md',markdown:gallery});groups.push(g);
}
category('castle-art-direction','성채 구도와 제작 기준','새 성을 만들기 전에 읽을 구도·재료·높이·생활감과 실패 기준.', ['ART_DIRECTION.md','ADVERSARIAL_REVIEW.md'], ['reference/user-castle.png','reference/rejected-layout.png','reference/revised-layout.png',...['forecourt','courtyard','north','approach'].map(s=>'audit/'+s+'.png')]);
category('castle-assembly','성채 칩셋 조립','16px 좌표, 완성 부품, 반복, 레이어, 통행, 출처. 원본 번호와 파생 아틀라스 번호를 구별한다.', ['ASSEMBLY.md','parts.json','harbor-parts.json','supplement-parts.json','regions.json','CASTLE-CREDITS.txt','SURROUNDINGS-CREDITS.txt'], []);
category('castle-revisions','비교 개선과 확정 장소','개선1·개선2의 차이와 최종 석조 관리소 선택. 현재 장소도 참고와 동일한 완성도라고 주장하지 않는다.', ['REVISION.md','improvements/density-01/README.md','improvements/density-01/source-parts.json','improvements/landscape-02/README.md','improvements/landscape-02/source-parts.json','shared-place/README.md','shared-scenes/README.md'], [...['density-01','landscape-02'].flatMap(v=>['forecourt','courtyard','north','approach'].map(s=>`improvements/${v}/${s}.png`)),'improvements/landscape-02/before-after.png','shared-place/map.png']);
const assembly=groups.find(g=>g.id==='castle-assembly');
let atlasGuide='# 원본 및 현재 조립 아틀라스\n\nCastle2 원본 512×512, 16px 셀, 32열입니다. 현재 파생 아틀라스의 추가 셀은 합성 결과이며 원본 번호와 구별합니다. 각 parts JSON의 기록 시점과 좌표 단위를 먼저 확인합니다.\n';
for(const [id,file] of [['castle-original','public/assets/opengameart-castle-tiles.png'],['castle-current','public/assets/region-references/river-fortress-atlas.png']]){const bytes=fs.readFileSync(file);assert(bytes.length<=4e6);assembly.images.push({id,name:path.basename(file),caption:id+' · 16px 셀 / 32열',dataUrl:'data:image/png;base64,'+bytes.toString('base64')});atlasGuide+=`\n![${id}](image:${id})\n`;}
assembly.documents.push({id:'atlas-images',name:'원본과 파생 아틀라스.md',markdown:atlasGuide});
groups[0].documents.unshift({id:'start',name:'00-읽기-순서.md',markdown:'# Castle2 성채 학습 자료\n\n현재 저작 지침은 이 AI 참고문서의 본문·첨부 그림입니다. tiledata는 연구 출처와 변경 이력입니다.\n\n1. 성채 구도와 제작 기준의 MD 전체와 그림을 읽습니다.\n2. 성채 칩셋 조립에서 좌표와 완성 부품, 통행, 출처를 확인합니다.\n3. 비교 개선과 확정 장소를 읽고 과거 시도와 최종 선택을 구별합니다.\n\n## 최종 사용자 결정\n\n- 큰 돌다리는 사용하지 않습니다. 사용자 참고의 다리는 비교 이미지에만 남아 있습니다.\n- 남쪽 관리소는 개선1의 석조 건물·정돈된 길을 유지합니다. 개선2 목재 건물/휴식 공간으로 되돌리지 않습니다.\n- 다른 부분은 개선2를 유지합니다. 전체 성채와 뒤뜰·선착장·석조 관리소가 공용 장소로 등록되어 있습니다.\n- 저장·통행 성공은 미술적 합격이 아닙니다. 밝은 잔디, 돌 포장 재료, 자연스러운 전이, 소품 군집 밀도는 계속 비교해야 합니다.\n\n## AI 읽기\n\nlist_tileset_references → 용도별 read_tileset_reference. 문서는 nextOffset이 null일 때까지, 그림은 imageId로 직접 읽습니다. 사용한 용도를 referencePurpose로 지정합니다. 16구역 관찰은 ART_DIRECTION 본문에 포함되어 있습니다.\n\n공유된 파생 칩셋에서도 같은 문서가 보입니다. 독립 맵에 원본 칩셋이 없으면 자체 사본을 포함합니다.\n'});
for(const g of groups)for(const d of g.documents)assert(d.markdown.length<=120000);
await withTsModule(path.resolve('src/project/tilesetReferences.ts'),'castle-reference-validation.mjs',async m=>m.validateTilesetReferences(groups));
function attach(p){const owner=p.tilesets.opengameart_castle??p.tilesets.castle_courtyard_harbor;assert(owner);const ids=new Set(groups.map(g=>g.id));owner.referenceDocuments=[...(owner.referenceDocuments??[]).filter(g=>!ids.has(g.id)),...structuredClone(groups)];
 const derived=p.tilesets.castle_courtyard_harbor;if(derived&&derived!==owner){assert(!derived.referenceDocuments?.length,'Do not discard existing derived references');derived.referenceSourceTilesetId=owner.id;}return owner.id;}
const proof={projects:[],sqlite:null,categories:groups.map(g=>({id:g.id,documents:g.documents.length,images:g.images.length}))};
for(const id of [projectId,'oprn-place-river-fortress-v1','oprn-place-castle-courtyard-v1','oprn-place-castle-small-harbor-v1','oprn-place-castle-stone-lodge-v1']){
 const [row]=await request('projects?project_id=eq.'+id+'&select=current_json,current_sha256');assert(row);const p=structuredClone(row.current_json);attach(p);assert.deepEqual(p.maps,row.current_json.maps);
 const rows=await request('projects?project_id=eq.'+id+'&current_sha256=eq.'+row.current_sha256,'PATCH',{current_json:p,current_sha256:createHash('sha256').update(JSON.stringify(p)).digest('hex')});assert.equal(rows.length,1,'Concurrent remote write');
 const [after]=await request('projects?project_id=eq.'+id+'&select=current_json');assert.deepEqual(after.current_json,p);
 const mirrors=await request('tilesets?project_id=eq.'+id+'&select=tileset_id');
 for(const t of Object.values(p.tilesets).filter(t=>t.referenceDocuments||t.referenceSourceTilesetId))if(mirrors.some(m=>m.tileset_id===t.id)){
 await request('tilesets?project_id=eq.'+id+'&tileset_id=eq.'+t.id,'PATCH',{tileset_json:t});const [saved]=await request('tilesets?project_id=eq.'+id+'&tileset_id=eq.'+t.id+'&select=tileset_json');assert.deepEqual(saved.tileset_json,t);}
 proof.projects.push({id,reloadEqual:true,mapsUnchanged:true});
 if(id!==projectId){const file=id==='oprn-place-river-fortress-v1'?'river-fortress':id.slice('oprn-place-'.length,-3);fs.writeFileSync('public/assets/region-references/'+file+'.oprn.json',JSON.stringify(p));}
}
await withTsModule(path.resolve('electron/local-store/store.ts'),'castle-reference-store.mjs',async m=>{
 const store=await m.openLocalProjectStore({projectDir:'/home/main/.local/share/oprn/web-workspace/.oprn-projects/'+projectId});try{
 const before=store.loadSnapshot(),p=structuredClone(before.project);attach(p);assert.deepEqual(p.maps,before.project.maps);store.backup();const saved=await store.saveSerialized(JSON.stringify(p),before.sha256);assert.equal(saved.kind,'saved');const after=store.loadSnapshot();assert.deepEqual(after.project,p);
 fs.writeFileSync(out+'/sqlite-reloaded.json',store.exportSerialized());proof.sqlite={projectId:store.info().projectId,revision:after.revision,reloadEqual:true,mapsUnchanged:true};
 }finally{store.close();}
});
fs.writeFileSync(out+'/persistence.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
