// Opt-in real assistant observation. No answer arrays or mocked model responses.
import fs from 'node:fs';
import {isDeepStrictEqual} from 'node:util';
import {spawnSync} from 'node:child_process';
import {PNG} from 'pngjs';
import {readSharedContent} from '../lib/sharedContentSqlite.ts';
import {installSharedContent} from '../../src/project/sharedContent.ts';
import {createBlankProject} from '../../src/project/defaults/blankProject.ts';
import {runPiAgent} from '../lib/piAgentRuntime.ts';
import {resolveRequestApiKey} from '../lib/aiAuthRuntime.ts';
const out=process.argv[2]??'output/paw-modern-interiors/ai-live';fs.mkdirSync(out,{recursive:true});
const snapshot=readSharedContent();await installSharedContent(snapshot);let project=createBlankProject();const baseMaps=structuredClone(project.maps);
const resume=process.argv[3];const prior=resume?JSON.parse(fs.readFileSync(resume+'/report.json','utf8')):null;const priorCalls=resume?JSON.parse(fs.readFileSync(resume+'/tool-calls.json','utf8')):[];
if(resume){if(prior.sharedRevision!==snapshot.revision)throw Error('Resume catalog changed');project=JSON.parse(fs.readFileSync(resume+'/result-project.json','utf8'));}
project.meta.title='현대 일본 실내8개 · 실제 AI 구현 확인';
const before=JSON.stringify(baseMaps),calls:any[]=[],events:any[]=[],renders:any[]=[],cache=new Map();
async function render(p:any,data:any){
 const map=p.maps[data.mapId],ts=p.tilesets[map.tilesetId],asset=p.assets.uploaded[ts.image.id];
 let src=cache.get(ts.image.id);if(!src){src=PNG.sync.read(Buffer.from(asset.dataUrl.split(',')[1],'base64'));cache.set(ts.image.id,src);}
 const width=data.w??map.width,height=data.h??map.height,ox=data.x??0,oy=data.y??0,size=ts.tileSize;
 const dst=new PNG({width:width*size,height:height*size});
 for(const layer of [map.lowerTiles,map.upperTiles])for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const tile=layer[(oy+y)*map.width+ox+x];if(tile<0)continue;
  for(let py=0;py<size;py++)for(let px=0;px<size;px++){
   const si=((Math.floor(tile/ts.tilesPerRow)*size+py)*src.width+tile%ts.tilesPerRow*size+px)*4,di=((y*size+py)*dst.width+x*size+px)*4;
   const a=src.data[si+3]/255,b=dst.data[di+3]/255,v=a+b*(1-a);
   for(let k=0;k<3;k++)dst.data[di+k]=v?Math.round((src.data[si+k]*a+dst.data[di+k]*b*(1-a))/v):0;
   dst.data[di+3]=Math.round(v*255);
  }
 }
 const png=PNG.sync.write(dst);fs.writeFileSync(`${out}/map-${renders.length}.png`,png);renders.push({file:`map-${renders.length}.png`,...data});
 const resized=spawnSync('python3',['-c',"from PIL import Image; import sys,io; im=Image.open(io.BytesIO(sys.stdin.buffer.read())); im.thumbnail((960,960),Image.Resampling.NEAREST); im.save(sys.stdout.buffer,format='PNG')"],{input:png,maxBuffer:16*1024*1024});if(resized.status!==0)throw Error('Preview resize failed');return resized.stdout.toString('base64');
}
const request=process.argv[4]==='images'?'이전 확인에서 문서는 전 페이지 읽었지만 결과 이미지를 다시 요청하지 않았다. 이번에는 다른 문서나 자료 검색 없이 다음8개 실제 맵의 show_map_region을 각각 호출해서 반환되는 실제 이미지를 모두 확인해라. 맵 생성/수정은 하지 않는다. 그림에서 확인한 방/천장/가구/통로와 의심되는 점을 짧게 보고하되 구조 검사나 플레이를 실행했다고 말하지 마라. 맵 ID: '+prior.builds.flatMap((b:any)=>Object.values(b.receipt.mapIds)).join(', '):(resume?'이전 실행에서8개 실내 생성과 그림 확인은 성공했지만 긴 문서의 첫6000자만 읽고 nextOffset을 따르지 않았다. 이번에는 맵을 수정하거나 중복 생성하지 마라. 각 장소의 place-layout/assembly 문서를 offset0부터 nextOffset이 없어질 때까지 모두 읽어라. 도구가 반환하는 document.nextOffset을 그대로 다음 offset에 넣고 마지막 페이지까지 확인해라. 필요하면 maxChars를 도구 허용 범위 안에서 늘려라.8곳 전부 읽은 뒤 현재 생성 결과 그림과 구획/가구/통로를 대조하고 실제 확인 범위와 한계를 보고해라. 원래 요청: ':'')+'설치된 공용 Pixel Art World 자료에서 최근 완성된 현대 일본 실내를 찾아 실제로 배치해라. 동네 센토(접수·탈의실2·욕탕2), 라멘집(바6석·2인 테이블3개), 아파트 A(1K 독립 주방), 아파트 B(1DK 독립 침실·식사실), 아파트 C(재택형), 작은 여관(독립 다다미 객실3), 의원(진찰·처치·화장실 분리·대기8석), 탁구장(코트2·탈의·창고), 총8개다. 각각 독립 namespace의 편집 가능한 맵으로 만들고 기존 맵은 보존해라. 자료의 조립 문서와 실제 그림을 먼저 확인하고 도구로 생성해라. 각 생성 결과도 실제 이미지로 확인해라. 천장 아래 벽 전체·가구 밑동·출입 동선을 보존하고, 아직 없는 도시 전이·문 개폐·영업 이벤트를 만들었다고 하지 마라. 좌표나 배열을 답변으로만 출력하지 말고 프로젝트를 편집해라. 새 디자인이나 다운로드는 하지 않는다. 누락이나 실패는 사실대로 보고해라.';
fs.writeFileSync(out+'/request.txt',request);
let report:any;
try{
 const provider='google-antigravity',apiKey=await resolveRequestApiKey(provider);if(!apiKey)throw Error('Provider not connected');
 const done=await runPiAgent({provider,task:request,project,mapIds:[],scopeStrict:false,mode:'single',applyMode:'default',initialToolNames:['find_tools'],maxTurns:64,thinkingLevel:'low'}, {apiKey,timeoutMs:900000,renderToolImage:async(p,_name,data)=>render(p,data),
  onToolCall:r=>{calls.push(r);fs.writeFileSync(out+'/tool-calls.json',JSON.stringify(calls));},
  onEvent:e=>{if(['start','tool_start','tool_end','assistant','error','turn'].includes(e.type)){events.push(e);fs.writeFileSync(out+'/events.json',JSON.stringify(events));if(['start','tool_end','error'].includes(e.type))console.log(JSON.stringify({type:e.type,...(e.type==='start'?{model:e.model}:{}),...(e.type==='error'?{error:e}:{}),...(e.type==='tool_end'?{name:e.name}:{} )}));}}
 });
 const builds=[...(prior?.builds??[]).map((b:any)=>({name:'build_shared_scene',args:b.args,result:{ok:true,data:b.receipt}})),...calls.filter(c=>c.name==='build_shared_scene'&&c.result.ok)],mismatches=[];
 for(const b of builds){const lib=Object.values(snapshot.libraries).find(l=>l.places[b.args.id])!;
  for(const[srcId,destId]of Object.entries(b.result.data.mapIds)){
   const actual=done.project.maps[destId as string],place=lib.places[srcId],kit=place?.exterior&&lib.tilesets[place.exterior.tilesetId].structureKits!.find(k=>k.id===place.exterior!.kitId);
   const src=lib.maps[srcId]??{lowerTiles:kit!.rows.flatMap(r=>r.tiles),upperTiles:kit!.rows.flatMap(r=>r.upperTiles)};
   for(const layer of ['lowerTiles','upperTiles']as const)if(JSON.stringify(actual?.[layer])!==JSON.stringify(src[layer]))mismatches.push({mapId:destId,layer});
  }
 }
 const types=['sento_neighborhood','ramen_counter','apartment_1k','apartment_1dk','apartment_work','ryokan_three_rooms','clinic_separated','table_tennis_club'];
 const allRenders=[...(prior?.renders??[]),...renders];
 const coverage=types.map(type=>({type,built:builds.some(b=>b.args.id==='shared_paw_'+type),rendered:builds.some(b=>b.args.id==='shared_paw_'+type&&allRenders.some(r=>Object.values(b.result.data.mapIds).includes(r.mapId)))}));
 const errors=events.filter(e=>e.type==='error'),assistant=events.filter(e=>e.type==='assistant').map(e=>e.text);
 const preserved=isDeepStrictEqual(JSON.parse(JSON.stringify(Object.fromEntries(Object.keys(baseMaps).map(id=>[id,done.project.maps[id]])))),JSON.parse(before));
 report={liveModel:true,passMeaning:'Scene construction and rendered coverage; full-page reading is audited separately.',...(resume?{resumeFrom:resume,priorStats:prior.stats}:{}),model:events.find(e=>e.type==='start')?.model,sharedRevision:snapshot.revision,stats:done.stats,coverage,builds:builds.map(b=>({args:b.args,receipt:b.result.data})),toolFailures:calls.filter(c=>!c.result.ok).map(c=>({name:c.name,args:c.args,result:c.result})),referenceImages:(prior?.referenceImages??0)+calls.filter(c=>c.name==='read_spatial_reference'&&c.args.imageId&&c.result.ok).length,renders,errors,assistant,mismatches,preserved,pass:coverage.every(c=>c.built&&c.rendered)&&mismatches.length===0&&preserved&&errors.length===0&&assistant.some(s=>s.trim()),scope:'Real-model construction followed by review of the same unchanged result; eight modern interiors using deterministic authored-example reuse; not arbitrary floor-plan generation or a success-rate benchmark.'};
 fs.writeFileSync(out+'/result-project.json',JSON.stringify(done.project));
}catch(e){report={liveModel:true,pass:false,error:String(e)};}
fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,builds:undefined,renders:undefined}));if(!report.pass)process.exitCode=1;
