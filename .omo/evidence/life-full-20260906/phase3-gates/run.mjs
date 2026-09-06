import {spawn,execFileSync} from 'node:child_process';
import {writeFile,readFile,lstat} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const out=dirname(fileURLToPath(import.meta.url));
const [head,tree]=execFileSync('git',['rev-parse','HEAD','HEAD^{tree}'],{encoding:'utf8'}).trim().split('\n');
if(head!=='d107ac24ed72902fb35980034d08aed3ab3e0553')throw Error('Unexpected integrated HEAD');
if(await lstat('.omo/gates-vitest-report.json').catch(e=>{if(e.code==='ENOENT')return null;throw e;}))throw Error('Preexisting fixed report');
async function run(label,seconds,extra=[]){
 const args=['--timeout','900','/tmp/rpg-zzu-life-full-qa-01a0727b.lock','timeout','--signal=TERM','--kill-after=15s',seconds+'s','npm','run','gates','--','--json',...extra];
 const started=new Date().toISOString();const loadBefore=await readFile('/proc/loadavg','utf8');
 console.log('PHASE3_GATE_START '+label);
 const child=spawn('flock',args,{env:{...process.env,NODE_OPTIONS:label==='full'?'--import='+join(out,'trace.mjs'):process.env.NODE_OPTIONS??''},stdio:['ignore','pipe','pipe']});
 let stdout='',stderr='';child.stdout.on('data',b=>{stdout+=b;process.stdout.write(b);});child.stderr.on('data',b=>{stderr+=b;process.stderr.write(b);});
 const result=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(exit,signal)=>resolve({exit,signal}));});
 const loadAfter=await readFile('/proc/loadavg','utf8');
 await writeFile(join(out,label+'.json'),JSON.stringify({head,tree,command:['flock',...args],started,finished:new Date().toISOString(),...result,stdout,stderr,loadBefore,loadAfter},null,2)+'\n',{flag:'wx'});
 console.log('PHASE3_GATE_END '+label+' exit='+result.exit);return result.exit;
}
const full=await run('full',1200);
let fallback=[];
if(full===124||full===137){fallback.push(await run('css',300,['--only','css']));fallback.push(await run('surface',300,['--only','surface']));}
const report=await readFile('.omo/gates-vitest-report.json','utf8').catch(e=>{if(e.code==='ENOENT')return null;throw e;});
if(report!==null)await writeFile(join(out,'vitest-report.json'),report,{flag:'wx'});
await writeFile(join(out,'completion.json'),JSON.stringify({head,tree,full,fallback,vitestReport:report!==null,finished:new Date().toISOString()},null,2)+'\n',{flag:'wx'});
process.exitCode=full===0?0:1;
