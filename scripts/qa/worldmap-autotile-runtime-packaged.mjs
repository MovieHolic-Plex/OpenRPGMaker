// Same runtime QA harness and player shim, served from the compiled player.
import {chromium} from 'playwright';
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';
import {startPackagedPlayerQaServer} from '../lib/packagedPlayerQaServer.mjs';
import {runRuntimeQa} from '../lib/runtimeQaRun.mjs';
import scenario from './runtime/worldmap-autotile-visual.scenario.mjs';
const server=await startPackagedPlayerQaServer(process.argv[4]?{packageDir:resolve(process.argv[4])}:{}),browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=swiftshader','--disable-gpu']});
try{
 const project=JSON.parse(readFileSync(process.argv[2],'utf8'));
 const opening=project.system.opening;
 const openingOps=opening?.enabled&&opening.scenes?.length ? [
  {kind:'waitFor',testid:'cinematic-sequence',state:'present'},
  ...(opening.skippable?[{kind:'cinematic',action:'key',key:'Escape',selector:'[data-testid="cinematic-sequence"]',absent:true}]:[{kind:'waitFor',testid:'cinematic-sequence',state:'absent',timeoutMs:120000}]),
  {kind:'waitFor',testid:'opening-map-handoff',state:'absent'},
 ]:[];
 const beats=scenario.beats.map(b=>b.id==='coast'?{...b,ops:[b.ops[0],...openingOps,...b.ops.slice(1)],expect:{...b.expect,testidAbsent:['cinematic-sequence','opening-map-handoff']}}:b);
 const page=await browser.newPage();const report=await runRuntimeQa(page,{...scenario,beats,projectFixture:resolve(process.argv[2])},{serverUrl:server.url,outDir:resolve(process.argv[3])});
 const passed=!report.errors.length&&report.beats.every(b=>!b.failures.length);console.log({passed,beats:report.beats.map(b=>({id:b.id,failures:b.failures})),errors:report.errors});if(!passed)process.exitCode=1;
}finally{await browser.close();await server.close();}
