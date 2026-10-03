// Real provider and real production map PNG. Read-only follow-up, separate from initial generation.
import fs from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {chromium} from 'playwright';
const [file,host,outDir='verify-shots/romance-scene-review']=process.argv.slice(2);
if(!file||!host)throw Error('Usage: node scripts/qa/romance-scene-review.mjs <canonical.json> <owned-host-url> [out]');
const project=JSON.parse(fs.readFileSync(file)),url=new URL(host),out=resolve(outDir);fs.mkdirSync(out,{recursive:true});
const report={readOnlyFollowUp:true,realProvider:true,projectId:project.id,tools:[],images:[],reviews:[],errors:[]};
const save=()=>fs.writeFileSync(out+'/proof.json',JSON.stringify(report,null,2));
const browser=await chromium.launch({args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--js-flags=--max-old-space-size=16384']});
const runId=randomUUID();let headers;
try{
 const page=await browser.newPage({bypassCSP:true});const teamUrl=new URL('/__oprn/team',url);teamUrl.search=url.search;
 await page.goto(teamUrl.href);await page.waitForFunction(()=>window.__OPRN_BRIDGE__);
 const token=await page.evaluate(()=>window.__OPRN_BRIDGE__.companionToken);
 const cookie=(await page.context().cookies()).map(c=>c.name+'='+c.value).join('; ');
 headers={'content-type':'application/json','x-oprn-companion-token':token,origin:url.origin,cookie};
 await page.addScriptTag({path:resolve('output/qa/romance-scene/renderer.js')});
 const endpoint=path=>new URL(path+'?provider=google-antigravity',url).href;
 const request={runId,provider:'google-antigravity',model:'gemini-3.8-flash',mode:'team',readOnly:true,mapIds:[project.startMapId],currentMapId:project.startMapId,project,maxTurns:40,timeoutMs:240000,task:'저장된 첫 만남의 읽기 전용 검증을 끝내라. 이미 제작된 맵과 대사는 수정하지 마라. inspect_romance_scene으로 두 선택, 기억 대사, 중복 방지, 취소, 종료를 확인하라. review_map을 호출하고 검수 담당에게 show_map_region으로 실제 맵 PNG를 반드시 본 뒤 report_review를 호출하게 하라. 이름은 지우/나래이고 외형은 사용자 미정인 임시 자산이다. 지적이 있으면 정직하게 보고하고 finish하지 마라. 검수와 실행 검사가 통과하면 finish로 완료를 보고하라. 새 제작 배정을 하지 마라.'};
 const response=await fetch(endpoint('/v1/agent/run'),{method:'POST',headers:{...headers,'content-encoding':'gzip'},body:gzipSync(Buffer.from(JSON.stringify(request))),signal:AbortSignal.timeout(360000)});
 if(!response.ok)throw Error('Run HTTP '+response.status+' '+await response.text());
 async function receive(event){
  if(event.type==='agent_event'){await receive(event.event);return;}
  if(event.type==='render_request'){
   const p={...event.project};for(const key of event.unchangedKeys??[])p[key]=project[key];
   if(event.unchangedTilesetIds?.length)p.tilesets={...Object.fromEntries(event.unchangedTilesetIds.map(id=>[id,project.tilesets[id]])),...p.tilesets};
   // Renderer reads only this map's tileset and sprite assets; native map/event data is unchanged.
   p.tilesets=Object.fromEntries(Object.entries(p.tilesets).filter(([id])=>Object.values(p.maps).some(m=>m.tilesetId===id)));
   const spriteIds=new Set(Object.values(p.maps).flatMap(m=>m.events.flatMap(e=>(e.pages??[]).map(pg=>pg.graphic?.sprite?.id))));
   for(const t of Object.values(p.tilesets)){spriteIds.add(t.image.id);for(const g of t.tileGrafts??[])spriteIds.add(g.sourceChipset);}
   p.assets={...p.assets,uploaded:Object.fromEntries(Object.entries(p.assets.uploaded).filter(([id])=>spriteIds.has(id)))};
   const dataUrl=await page.evaluate(async ([p,data])=>window.RomanceRender.renderPiMapImage(p,data),[p,event.data]);
   const png=dataUrl.replace(/^data:image\/png;base64,/,'');fs.writeFileSync(out+'/map-'+report.images.length+'.png',Buffer.from(png,'base64'));
   const ack=await fetch(endpoint('/v1/agent/render'),{method:'POST',headers,body:JSON.stringify({renderId:event.renderId,png})});if(!ack.ok)throw Error('Render ACK HTTP '+ack.status);
   report.images.push({tool:event.toolName,bytes:Buffer.from(png,'base64').length,ackStatus:ack.status});save();
  }else if(event.type==='checkpoint')throw Error('Read-only follow-up unexpectedly proposed a checkpoint');
  else if(event.type==='tool_end'){report.tools.push({name:event.name,ok:event.ok,summary:event.result?.summary});save();}
  else if(event.type==='review'){report.reviews.push({ok:event.ok,findings:event.findings});save();}
  else if(event.type==='execution_status'&&event.name==='map.image.delivered'){report.imageDelivered=event.ok;save();}
  else if(event.type==='team_report'){report.summary=event.text;save();}
  else if(event.type==='done'){report.done=true;report.stats=event.stats;report.changedKeys=event.changedKeys;save();}
  else if(event.type==='error'){report.errors.push(event.message??event.error??JSON.stringify(event));save();}
 }
 const decoder=new TextDecoder();let pending='';for await(const chunk of response.body){pending+=decoder.decode(chunk,{stream:true});const lines=pending.split('\n');pending=lines.pop();for(const line of lines){if(!line.trim())continue;const raw=JSON.parse(line);await receive(raw.event??raw);}}
 report.ok=report.done===true&&report.imageDelivered===true&&report.reviews.some(r=>r.ok&&!r.findings?.length)&&report.errors.length===0;
 if(!report.ok)process.exitCode=1;
}catch(error){report.errors.push(String(error));process.exitCode=1;}
finally{if(headers&&!report.done)await fetch(new URL('/v1/agent/cancel?provider=google-antigravity',url),{method:'POST',headers,body:JSON.stringify({runId})}).catch(()=>{});save();await browser.close();}
console.log(JSON.stringify({ok:report.ok,images:report.images.length,reviews:report.reviews,errors:report.errors}));
