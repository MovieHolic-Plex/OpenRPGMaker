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
const out=process.argv[2]??'output/paw-all-authoring/live';fs.mkdirSync(out,{recursive:true});
let project=createBlankProject();const baseMaps=structuredClone(project.maps),snapshot=readSharedContent();await installSharedContent(snapshot);
const resume=process.argv[3];const prior=resume?JSON.parse(fs.readFileSync(resume+'/report.json','utf8')):null;const priorCalls=resume?JSON.parse(fs.readFileSync(resume+'/tool-calls.json','utf8')):[];
if(resume){if(prior.sharedRevision!==snapshot.revision)throw Error('Resume catalog changed');project=JSON.parse(fs.readFileSync(resume+'/result-project.json','utf8'));}
project.meta.title='학교·교실·실내·도시 · 실제 AI 구현 확인';
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
const request=(resume?'이전 실행에서 아래 7묶음은 이미 생성했다. 새로 만들거나 타일을 바꾸지 말고 현재 결과를 이어서 확인해라. 이전 실행의 이미지 전달 콜백 문제를 수정했으니 show_map_region으로 7묶음 모두 실제 이미지를 확인하고 한계를 보고해라. 기존 생성 ID는 현재 프로젝트의 맵 목록에서 찾고 자료 이미지와 대조해라.\n원래 요청: ':'')+'설치된 공용 Pixel Art World 자료에서 다음을 찾아 실제로 구현해라: (1) 도시 50×50와 출입으로 연결된 모든 시설 내부, (2) 별도 학교 4층 전체, (3) 사물함이 있는 교실 하나, (4) 과학실 하나, (5) 방이 구분된 주택 하나, (6) 체육관 실내, (7) 이자카야 실내. 각 묶음은 독립 namespace로 만들고 현재 맵은 보존한다. 도시 묶음은 연결 전체를 포함하고, 나머지 독립 표본의 외부 목적맵은 명시적으로 제외해라. 자료의 문서와 실제 그림을 확인하고 도구로 맵을 생성해라. 각 묶음의 생성 결과 그림도 확인하고 출입 연결/정적 예제의 한계를 보고해라. 배열을 답변으로만 출력하지 말고 프로젝트를 실제 편집해라. 임의 추가 디자인이나 다운로드는 하지 않는다.';
fs.writeFileSync(out+'/request.txt',request);
let report:any;
try{
 const provider='google-antigravity',apiKey=await resolveRequestApiKey(provider);if(!apiKey)throw Error('Provider not connected');
 const done=await runPiAgent({provider,task:request,project,mapIds:[],scopeStrict:false,mode:'single',applyMode:'default',initialToolNames:['find_tools'],maxTurns:48,thinkingLevel:'low'}, {apiKey,timeoutMs:600000,renderToolImage:async(p,_name,data)=>render(p,data),
  onToolCall:r=>{calls.push(r);fs.writeFileSync(out+'/tool-calls.json',JSON.stringify(calls));},
  onEvent:e=>{if(['start','tool_start','tool_end','assistant','error','turn'].includes(e.type)){events.push(e);fs.writeFileSync(out+'/events.json',JSON.stringify(events));if(['start','tool_end','error'].includes(e.type))console.log(JSON.stringify(e));}}
 });
 const builds=[...priorCalls,...calls].filter(c=>c.name==='build_shared_scene'&&c.result.ok),mismatches=[];
 for(const b of builds){const lib=Object.values(snapshot.libraries).find(l=>l.places[b.args.id])!;
  for(const[srcId,destId]of Object.entries(b.result.data.mapIds)){
   const actual=done.project.maps[destId as string],place=lib.places[srcId],kit=place?.exterior&&lib.tilesets[place.exterior.tilesetId].structureKits!.find(k=>k.id===place.exterior!.kitId);
   const src=lib.maps[srcId]??{lowerTiles:kit!.rows.flatMap(r=>r.tiles),upperTiles:kit!.rows.flatMap(r=>r.upperTiles)};
   for(const layer of ['lowerTiles','upperTiles']as const)if(JSON.stringify(actual?.[layer])!==JSON.stringify(src[layer]))mismatches.push({mapId:destId,layer});
  }
 }
 const types=['city','school_building','room_school_','room_school_2_2','home_compact_','gym_practice','izakaya'];
 const coverage=types.map(type=>({type,built:builds.some(b=>b.args.id.includes(type)),rendered:builds.some(b=>b.args.id.includes(type)&&renders.some(r=>Object.values(b.result.data.mapIds).includes(r.mapId)))}));
 const errors=events.filter(e=>e.type==='error'),assistant=events.filter(e=>e.type==='assistant').map(e=>e.text);
 const preserved=isDeepStrictEqual(JSON.parse(JSON.stringify(Object.fromEntries(Object.keys(baseMaps).map(id=>[id,done.project.maps[id]])))),JSON.parse(before));
 report={liveModel:true,...(resume?{resumeFrom:resume,priorStats:prior.stats}:{}),model:events.find(e=>e.type==='start')?.model,sharedRevision:snapshot.revision,stats:done.stats,coverage,builds:builds.map(b=>({args:b.args,receipt:b.result.data})),referenceImages:[...priorCalls,...calls].filter(c=>c.name==='read_spatial_reference'&&c.args.imageId&&c.result.ok).length,renders,errors,assistant,mismatches,preserved,pass:coverage.every(c=>c.built&&c.rendered)&&mismatches.length===0&&preserved&&errors.length===0&&assistant.some(s=>s.trim()),scope:'Real-model construction followed by review of the same unchanged result; seven scene families using deterministic authored-example reuse; not arbitrary floor-plan generation or a success-rate benchmark.'};
 fs.writeFileSync(out+'/result-project.json',JSON.stringify(done.project));
}catch(e){report={liveModel:true,pass:false,error:String(e)};}
fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,builds:undefined,renders:undefined}));if(!report.pass)process.exitCode=1;
