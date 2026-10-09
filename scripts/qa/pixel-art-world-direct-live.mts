import { homeRequirements } from './pixel-art-world-home-requirements';
// Opt-in real assistant observation. No answer arrays or mocked model responses.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {PNG} from 'pngjs';
import {readSharedContent} from '../lib/sharedContentSqlite.ts';
import {createBlankProject} from '../../src/project/defaults/blankProject.ts';
import {runPiAgent} from '../lib/piAgentRuntime.ts';
import {resolveRequestApiKey} from '../lib/aiAuthRuntime.ts';
const maxTurns=Number(process.env.PAW_DIRECT_MAX_TURNS??100),timeoutMs=Number(process.env.PAW_DIRECT_TIMEOUT_MS??900000);
if(!Number.isInteger(maxTurns)||maxTurns<1||maxTurns>100||!Number.isInteger(timeoutMs)||timeoutMs<1000||timeoutMs>900000)throw Error('Invalid observation budget');
const out=process.argv[2]??'output/paw-direct-authoring/live-ramen';fs.mkdirSync(out,{recursive:true});
const snapshot=readSharedContent(),owner=snapshot.libraries['pixel-art-world-local'].tilesets.shared_paw_modern_interiors;
const category=owner.referenceDocuments!.find(c=>c.id==='direct-authoring');if(!category)throw Error('Publish the direct-authoring dictionary first');
let project=createBlankProject();project.meta.title='PAW · 완성맵 없이 직접 배치';
const caseId=process.argv[5]??'ramen',width=caseId==='home'?16:caseId==='clinic'?19:17,height=caseId==='ramen'?17:18;
const mapId='direct-'+caseId,tilesetId=owner.id;
project.tilesets={[tilesetId]:{...structuredClone(owner),referenceDocuments:[structuredClone(category)],structureKits:[]}};
project.assets.uploaded={[owner.image.id]:structuredClone(snapshot.libraries['pixel-art-world-local'].assets[owner.image.id])};
project.maps={[mapId]:{id:mapId,name:'조수 직접 설계 · '+caseId,width,height,tileSize:32,tilesetId,lowerTiles:Array(width*height).fill(-1),upperTiles:Array(width*height).fill(-1),events:[],encounterRate:0}};
project.mapTree={mapId,children:[]};project.startMapId=mapId;project.startPos={x:8,y:13};
const resume=process.argv[3]&&process.argv[3]!=='-'?process.argv[3]:undefined;if(resume)project=JSON.parse(fs.readFileSync(resume+'/result-project.json','utf8'));
if(Object.keys(project.maps).length!==1||!project.maps[mapId]||Object.keys(project.tilesets).length!==1||Object.values(project.tilesets).some(t=>t.structureKits?.length||t.referenceDocuments?.length!==1||t.referenceDocuments[0].id!=='direct-authoring'))throw Error('Observation input exposes content outside the isolated material/object dictionary');
const referenceHash=createHash('sha256').update(JSON.stringify(project.tilesets[tilesetId].referenceDocuments)).digest('hex');
const calls:any[]=[],events:any[]=[],renders:any[]=[],cache=new Map();
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
const brief=caseId==='home'?'총 면적224칸 이하의 새 일본 현대 주택을 설계해라. 초기 빈 캔버스는16×18이지만 최종 크기 요구가 아니다. 방과 가구의 실제 크기를 고려하여 너가 폭/높이를 정하고 먼저 resize_map으로 맞춘다. 서쪽에 거실과 주방, 동쪽에 벽으로 독립시킨 침실1개와 별개의 욕실/화장실이 필요하다. 남쪽 현관으로 들어가 각 방에 접근해야 한다. 침실에는 침대·옷장·책상·의자, 거실에는 좌식탁과 방석2개, 주방에는 싱크대·냉장고, 욕실에는 욕조, 화장실에는 변기와 세탁기를 둔다. 가구의 독립 조작면을 확보하고 불필요한 빈 바닥을 줄여라.':caseId==='clinic'?'새19×18 동네 의원을 설계해라. 서쪽에6석 대기실과 접수, 동쪽에 각각 벽으로 분리된 진찰실과 처치실을 둔다. 진찰실에는 진찰대1·모니터·의사용 의자·약장, 처치실에는 진찰대1·약장을 둔다. 남쪽 정문에서 세 구역과 각 가구 조작면으로 도달할 수 있어야 한다. 대기석은TV를 바라보고 접수대 양쪽에 접근할 공간을 둔다. 불필요한 빈 바닥을 줄인다. 벽은 wall-clinic을 사용한다.':'새17×17 일본 식당을 설계해라. 서쪽에는 벽과 출입 통로로 독립시킨 조리실, 동쪽에는 바4석과2인 테이블2개(총8석), 남쪽에는 정문이 필요하다. 주방에는 조리대·냉장고·레인지, 홀에는 직원/손님이 접근 가능한 카운터와 서로 마주보는 테이블 의자를 둔다.';
const task=`완성 맵을 복사하지 말고 ${resume?"이전 조수가 직접 배치한 맵":"빈 맵"} ${mapId}에서 직접 타일을 배치해라. ${resume?brief.replace(/새[0-9×]+ /, ""):brief} 천장 아래 벽 정면 전체가 남쪽 외곽까지 맵 안에 들어가고, 모든 가구의 바닥 지지와 완전 조립, 의자 뒤와 조작면 접근을 확보한다. direct-authoring 용도의 모든 MD 페이지와 정상/오류 그림을 먼저 읽어라. 완성 방/맵 배열이나 복제 도구는 없다. 네가 구조와 모든 가구 좌표를 정하고 paint_tiles로 직접 칠한다. materials.mapped와 objects.tiles가 현재 번호다. 정확한 부품은 cells 모드로 같은 tile 값의 여러 좌표를 묶어 호출한다. set_start_position을 정문 안에 지정한다. 마지막에 inspect_interior_layout(mapId, wallMaterial, entry)로 검사하고 오류 좌표를 직접 고쳐 다시 검사한다. 독립방은 rooms의 id/seed/doorways를 반드시 선언해 실제 문턱을 닫았을 때 분리되는지 검사한다. 아래 감독 지시로 면적 축소가 필요하면 resize_map을 사용할 수 있다. 구조 오류0만으로 요청 방 구획/가구 수를 만족했다고 하지 말고, 남쪽 경계출구/각 독립방/필요 가구도 직접 확인한다. show_map_region의 실제 그림도 확인하고 필요하면 고친다. 마지막에 구획/문턱/가구 원점/접근점과 한계를 간결히 보고해라. 새로운 평면 설계이며 게임 이벤트는 요구하지 않는다.`;
const contractText=caseId==='home'?'\n고정 요구조건(requirements 인자로 전달, 변경하지 말 것): '+JSON.stringify(homeRequirements):'';
const request=(resume?task+'\n\n이전 실행의 실제 배치를 이어서 수정한다. 아래 후속 조건이 초기 크기/계획보다 우선하며, 이미 맞는 배치는 보존한다. 감독 검토 결과: '+fs.readFileSync(process.argv[4],'utf8'):task)+contractText;
fs.writeFileSync(out+'/request.txt',request);
let report:any;
try{
 const provider='google-antigravity',apiKey=await resolveRequestApiKey(provider);if(!apiKey)throw Error('Provider not connected');
 const done=await runPiAgent({provider,task:request,project,mapIds:[],scopeStrict:false,mode:'single',applyMode:'default',maxTurns,thinkingLevel:'high'}, {apiKey,interiorRequirements:caseId==='home'?{[mapId]:homeRequirements}:undefined,timeoutMs,toolNames:['list_tileset_references','read_tileset_reference','get_map_region','get_tile_info','paint_tiles','show_map_region','set_start_position','resize_map','inspect_interior_layout'],renderToolImage:async(p,_name,data)=>render(p,data),
  onToolCall:r=>{calls.push(r);fs.writeFileSync(out+'/tool-calls.json',JSON.stringify(calls));},
  onEvent:e=>{if(['start','tool_start','tool_end','assistant','error','turn'].includes(e.type)){events.push(e);fs.writeFileSync(out+'/events.json',JSON.stringify(events));if(['start','tool_end','error'].includes(e.type))console.log(JSON.stringify({type:e.type,...(e.type==='start'?{model:e.model}:{}),...(e.type==='error'?{error:e}:{}),...(e.type==='tool_end'?{name:e.name}:{} )}));}}
 });
 const writes=calls.filter(c=>c.name==='paint_tiles'&&c.result.ok),errors=events.filter(e=>e.type==='error');
 const finalPaint=calls.findLastIndex(c=>c.name==='paint_tiles'&&c.result.ok),finalRender=calls.findLastIndex(c=>c.name==='show_map_region'&&c.result.ok),finalInspection=calls.findLastIndex(c=>c.name==='inspect_interior_layout'&&c.result.ok);
 const executionPass=writes.length>0&&renders.length>0&&errors.length===0,structuralPass=finalInspection>finalPaint&&calls[finalInspection]?.result.data?.valid===true,freshPreview=finalRender>finalPaint;
 report={liveModel:true,model:events.find(e=>e.type==='start')?.model,sharedRevision:snapshot.revision,referenceHash,resumedFrom:resume??null,initialMapBlank:!resume,stats:done.stats,caseId,writes:writes.length,inspectionCalls:calls.filter(c=>c.name==='inspect_interior_layout').map(c=>({args:c.args,result:c.result})),toolFailures:calls.filter(c=>!c.result.ok),renders,errors,assistant:events.filter(e=>e.type==='assistant').map(e=>e.text),copyToolsAvailable:false,completeSceneArraysAvailable:false,referenceCategory:'direct-authoring',executionPass,structuralPass,freshPreview,scope:'The model chooses its own room geometry and every painted tile position. Content quality is scored separately, not by equality to a prewritten map.',pass:executionPass&&structuralPass&&freshPreview};
 fs.writeFileSync(out+'/result-project.json',JSON.stringify(done.project));
}catch(e){report={liveModel:true,pass:false,error:String(e),stack:(e as Error)?.stack};}
fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,builds:undefined,renders:undefined}));if(!report.pass)process.exitCode=1;
