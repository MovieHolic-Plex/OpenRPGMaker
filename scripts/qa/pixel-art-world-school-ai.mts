// Opt-in live assistant observation. Uses real shared SQLite, tools, image delivery and reference gate.
// No mock responses, answer arrays in the prompt, or writes to the user's school project.
import fs from 'node:fs';
import path from 'node:path';
import {PNG} from 'pngjs';
import {readSharedContent} from '../lib/sharedContentSqlite.ts';
import {installSharedContent} from '../../src/project/sharedContent.ts';
import {createBlankProject} from '../../src/project/defaults/blankProject.ts';
import {runPiAgent} from '../lib/piAgentRuntime.ts';
import {resolveRequestApiKey} from '../lib/aiAuthRuntime.ts';
import {canMove} from '../../src/project/collision.ts';
import type {Project} from '../../src/project/types.ts';
const arg=(key:string,fallback:string)=>{const i=process.argv.indexOf('--'+key);return i<0?fallback:process.argv[i+1]??fallback;};
const out=arg('out','output/paw-school-ai-check/live'),provider=arg('provider','google-antigravity'),resume=arg('resume','');
fs.mkdirSync(out,{recursive:true});
const snapshot=readSharedContent(),lib=snapshot.libraries['pixel-art-world-local'];
const tilesetId='shared_paw_school_four_composed',categoryId='school-stairwell';
const owner=lib?.tilesets[tilesetId],category=owner?.referenceDocuments?.find(c=>c.id===categoryId);
if(!category)throw Error('Publish the school-stairwell category to shared SQLite first.');
const arrays=JSON.parse(category.documents.find(d=>d.id==='arrays')!.markdown.match(/```json\n([\s\S]*?)\n```/)![1]);
// This answer is used only by the scorer, after the assistant returns.
const origin={x:3,y:2},mapId='school-ai-stairwell';
let project=createBlankProject();
project.meta.title='학교 계단실 · 실제 AI 재현 확인';
project.tilesets={[tilesetId]:structuredClone(owner)};
project.assets.uploaded={[owner.image.id]:structuredClone(lib.assets[owner.image.id])};
project.maps={[mapId]:{id:mapId,name:'계단실 재현 확인',width:15,height:14,tileSize:32,tilesetId,lowerTiles:Array(210).fill(0),upperTiles:Array(210).fill(-1),events:[],encounterRate:0}};
project.mapTree={mapId,children:[]};
project.startMapId=mapId;
project.startPos={x:origin.x+4,y:origin.y+7};
const prior=resume?JSON.parse(fs.readFileSync(path.join(resume,'report.json'),'utf8')):undefined;
const priorCalls=resume?JSON.parse(fs.readFileSync(path.join(resume,'tool-calls.json'),'utf8')):[];
if(resume){
 if(prior.sharedRevision!==snapshot.revision||prior.categoryId!==categoryId||prior.provider!==provider)throw Error('Resume source does not match this observation');
 project=JSON.parse(fs.readFileSync(path.join(resume,'result-project.json'),'utf8'));
}
await installSharedContent(snapshot);
const baseline=JSON.stringify(project.maps[mapId]),calls:any[]=[],events:any[]=[];
const render=(p:Project,data:any)=>{
 const map=p.maps[data.mapId],ts=p.tilesets[map.tilesetId],asset=p.assets.uploaded[ts.image.id];
 const src=PNG.sync.read(Buffer.from(asset.dataUrl!.split(',')[1],'base64'));
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
 return PNG.sync.write(dst);
};
const task=`공용 학교 타일셋 ${tilesetId}의 참고문서에서 '계단실 · 연결 벽과 열린 계단참'을 찾아 모든 문서 페이지와 정상/오류 그림을 읽어라. 빈 맵 ${mapId}에 그 중간층 계단실 9×9를 좌상단(3,2)에 실제 타일로 재현해라. 문서 좌표는 상대좌표이므로 이동량을 반영하고, 사각형 밖의 기존 타일은 보존해라. 두 계단을 벽에 붙이고 중앙 벽을 이어서 계단참으로 양쪽을 오갈 수 있어야 한다. paint_tiles의 cells 모드로 정확한 칸을 놓고 referencePurpose를 명시해라. 완료 후 show_map_region으로 실제 그림을 확인하고, 오류 그림 두 개의 문제와 이 맵에서 양쪽 접근 좌표를 보고해라. 목적층 맵이 없는 단일 배치 확인이므로 전이 이벤트를 만들지 말고 미연결이라고 명시해라.`;
const request=resume?task+'\n\n이전 실행이 확인용 턴 제한에서 중단되어 그 실행이 만든 타일을 그대로 이어받았다. 현재 배치를 공용 문서·그림과 대조하고 잘못된 칸만 수정해라. 마지막 실제 그림 확인과 오류 예제 설명을 마무리해라.':task;
fs.writeFileSync(path.join(out,'request.txt'),request);
let report:any;
try{
 const apiKey=await resolveRequestApiKey(provider);if(!apiKey)throw Error('Assistant provider is not connected');
 const done=await runPiAgent({provider,task:request,project,mapIds:[mapId],currentMapId:mapId,scopeStrict:true,mode:'single',applyMode:'default',maxTurns:Number(arg('max-turns','48')),thinkingLevel:'low'},
  {apiKey,timeoutMs:480_000,toolNames:['list_tileset_references','read_tileset_reference','get_map_region','get_tile_info','paint_tiles','show_map_region'],
   renderToolImage:async(p,_name,data)=>render(p,data).toString('base64'),
   onToolCall:r=>{calls.push(r);fs.writeFileSync(path.join(out,'tool-calls.json'),JSON.stringify(calls));},
   onEvent:e=>{if(['start','tool_start','tool_end','assistant','error','turn'].includes(e.type)){events.push(e);fs.writeFileSync(path.join(out,'events.json'),JSON.stringify(events));if(e.type==='start'||e.type==='tool_end'||e.type==='error')console.log(JSON.stringify(e));}}
  });
 const actual=done.project.maps[mapId],old=JSON.parse(baseline),mismatches:any[]=[],outside:any[]=[];
 for(const layer of ['lowerTiles','upperTiles'] as const)for(let y=0;y<actual.height;y++)for(let x=0;x<actual.width;x++){
  const i=y*actual.width+x,inside=x>=origin.x&&x<origin.x+9&&y>=origin.y&&y<origin.y+9;
  const expected=inside?arrays[layer][(y-origin.y)*9+x-origin.x]:old[layer][i];
  if(actual[layer][i]!==expected)(inside?mismatches:outside).push({layer,x,y,expected,actual:actual[layer][i]});
 }
 const start={x:origin.x+4,y:origin.y+7},queue=[start],seen=new Set([start.y*actual.width+start.x]);
 for(let n=0;n<queue.length;n++)for(const[dx,dy]of [[0,1],[0,-1],[1,0],[-1,0]]){const a=queue[n],x=a.x+dx,y=a.y+dy,i=y*actual.width+x;if(x>=0&&y>=0&&x<actual.width&&y<actual.height&&!seen.has(i)&&canMove(done.project,actual,a.x,a.y,x,y)){seen.add(i);queue.push({x,y});}}
 const approaches=arrays.stairs.map((s:any)=>({x:origin.x+s.approach.x,y:origin.y+s.approach.y}));
 const reachable=approaches.every((p:any)=>seen.has(p.y*actual.width+p.x));
 const rendered=calls.some(c=>c.name==='show_map_region'&&c.result.ok);
 const imageReads=calls.filter(c=>c.name==='read_tileset_reference'&&c.result.ok&&c.args.imageId).map(c=>c.args.imageId);
 const writesThisRun=calls.filter(c=>c.name==='paint_tiles'&&c.result.ok).length;
 const writes=writesThisRun+priorCalls.filter((c:any)=>c.name==='paint_tiles'&&c.result.ok).length;
 const errors=events.filter(e=>e.type==='error').map(e=>e.message),assistant=events.filter(e=>e.type==='assistant').map(e=>e.text);
 report={liveModel:true,provider,model:events.find(e=>e.type==='start')?.model,sharedRevision:snapshot.revision,categoryId,origin,stats:done.stats,...(resume?{resumeFrom:resume,priorStats:prior.stats,priorErrors:prior.errors}:{}),writes,writesThisRun,imageReads,rendered,mismatches,outsideChanges:outside,approaches,reachable,eventsCreated:actual.events.length,errors,assistant,pass:writes>0&&mismatches.length===0&&outside.length===0&&reachable&&rendered&&errors.length===0&&actual.events.length===0&&assistant.some(text=>text.trim())&&['normal','divider-gap','landing-blocked'].every(id=>imageReads.includes(id)),scope:'One live single-map placement case with normal production tools and reference gate. No general success-rate or inter-floor event claim.'};
 fs.writeFileSync(path.join(out,'result-project.json'),JSON.stringify(done.project));
 fs.writeFileSync(path.join(out,'actual.png'),render(done.project,{mapId,x:origin.x,y:origin.y,w:9,h:9}));
}catch(error){report={liveModel:true,provider,error:error instanceof Error?error.message:String(error),pass:false,scope:'Live attempt; failure is not replaced by scripted success.'};}
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));if(!report.pass)process.exitCode=1;
