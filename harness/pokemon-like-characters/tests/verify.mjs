// All decisions below are synthetic QA in an isolated temp store. Never use live --data.
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {pathToFileURL} from 'node:url';
const ROOT=path.resolve(import.meta.dirname,'..');const args=process.argv.slice(2);const out=args.length?(assert(args[0]==='--out'&&args.length===2),path.resolve(args[1])):path.join(ROOT,'.data/verification');fs.mkdirSync(out,{recursive:true});
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'character-harness-isolated-')),copy=path.join(temp,'portable copy'),data=path.join(temp,'review store'),checks=[];let server;
function check(name,ok){checks.push({name,pass:!!ok});assert(ok,name);}
function cli(argv,pass=true){const r=spawnSync(process.execPath,[path.join(copy,'cli.mjs'),...argv],{cwd:temp,encoding:'utf8',env:{...process.env,NODE_PATH:'',POKEMON_HARNESS_DATA:data},maxBuffer:4*1024*1024});check('CLI '+argv.join(' '),pass?r.status===0:r.status!==0);if(pass)return JSON.parse(r.stdout);return r;}
try{
 fs.cpSync(ROOT,copy,{recursive:true,filter:p=>!path.relative(ROOT,p).split(path.sep).some(x=>['node_modules','.data','.exports','.venv','__pycache__','.git'].includes(x))});
 check('portable copy has no editor, node_modules, or symlinks',!fs.existsSync(path.join(copy,'src'))&&!fs.existsSync(path.join(copy,'node_modules'))&&fs.readdirSync(copy,{recursive:true}).every(p=>!fs.lstatSync(path.join(copy,p)).isSymbolicLink()));
 check('doctor outside repository succeeds',cli(['doctor']).editorRequired===false);
 const prepared=cli(['prepare']);check('16 roles and 192 poses generated with zero auto approval',prepared.roles===16&&prepared.poses===192&&prepared.autoApproved===0);
 const again=cli(['prepare']);check('repeat generation keeps identical IDs',JSON.stringify(prepared.candidateIds)===JSON.stringify(again.candidateIds));
 check('all 16 packages and exact GIF/replay checks pass',cli(['verify']).candidates===16);
 let status=cli(['status']);check('new store has 16 pending candidates',status.counts.pending===16&&status.items.length===16);
 const hero=status.items.find(x=>x.role==='hero'),rival=status.items.find(x=>x.role==='rival');
 cli(['export','--id',hero.id,'--out',path.join(temp,'pending-export')],false);
 cli(['new','--from','explorer','--name','QA 새 탐험가','--out',path.join(temp,'draft')]);
 const specPath=path.join(temp,'draft/template.json'),spec=JSON.parse(fs.readFileSync(specPath));
 // A true authored variant, not a metadata-only duplicate. Existing explicit rows are retained.
 spec.paletteOverrides['B']='#997f51';fs.writeFileSync(specPath,JSON.stringify(spec,null,2)+'\n');
 const created=cli(['render','--draft',path.join(temp,'draft'),'--out',path.join(temp,'bundle')]);check('new author draft renders and registers pending',!!created.id&&created.autoApproved===0);
 // Protected legs and source hashing must fail even under PYTHONOPTIMIZE=2.
 spec.patches.push({frame:'down_idle',y:28,rows:['................']});fs.writeFileSync(specPath,JSON.stringify(spec));
 const oldOptimize=process.env.PYTHONOPTIMIZE;process.env.PYTHONOPTIMIZE='2';cli(['render','--draft',path.join(temp,'draft'),'--out',path.join(temp,'bad-foot')],false);if(oldOptimize===undefined)delete process.env.PYTHONOPTIMIZE;else process.env.PYTHONOPTIMIZE=oldOptimize;
 spec.patches.pop();spec.templateSourceSha256='0'.repeat(64);fs.writeFileSync(specPath,JSON.stringify(spec));cli(['render','--draft',path.join(temp,'draft'),'--out',path.join(temp,'bad-source')],false);
 const {serve}=await import(pathToFileURL(path.join(copy,'lib/server.mjs')));server=await serve({data,host:'127.0.0.1',port:0});let base='http://127.0.0.1:'+server.address().port;
 const session=await fetch(base+'/api/session'),cookie=session.headers.get('set-cookie').split(';')[0],{csrf}=await session.json();
 const observations=['identity','directions','gait','poses','context'];
 async function vote(item,verdict,extra={},headers={}){return fetch(base+'/api/decisions',{method:'POST',headers:{'Content-Type':'application/json',Origin:base,Cookie:cookie,'X-Casting-CSRF':csrf,...headers},body:JSON.stringify({id:item.id,packageSha256:item.packageSha256,verdict,observed:observations,note:'SYNTHETIC ISOLATED QA — not human art approval',...extra})});}
 check('missing CSRF rejected',(await vote(hero,'allow',{}, {'X-Casting-CSRF':''})).status===409);
 check('cross-origin vote rejected',(await vote(hero,'allow',{}, {Origin:'http://other.invalid'})).status===409);
 check('incomplete observations rejected',(await vote(hero,'allow',{observed:[]})).status===409);
 check('stale candidate digest rejected',(await vote(hero,'allow',{packageSha256:'wrong'})).status===409);
 check('Deny needs repair reason',(await vote(rival,'deny',{note:''})).status===409);
 check('isolated complete Allow recorded',(await vote(hero,'allow')).status===200);
 check('isolated Deny recorded',(await vote(rival,'deny')).status===200);
 const exported=cli(['export','--id',hero.id,'--out',path.join(temp,'approved-export')]);const sprite=JSON.parse(fs.readFileSync(path.join(exported.out,'sprite.json')));
 check('engine-neutral export has native dimensions and matching GIF timing',sprite.frameWidth===16&&sprite.frameHeight===32&&sprite.frameMs===130&&sprite.atlas==='charset.png'&&!fs.existsSync(path.join(exported.out,'editor-charset.png')));
 check('exported source PNG is byte exact',fs.readFileSync(path.join(exported.out,'charset.png')).equals(fs.readFileSync(path.join(data,'candidates',hero.id,'charset.png'))));
 cli(['export','--id',rival.id,'--out',path.join(temp,'denied-export')],false);
 const zip=await fetch(base+'/download/'+hero.id+'.zip');check('approved browser ZIP works',zip.status===200&&(await zip.arrayBuffer()).byteLength>1000);
 await new Promise(resolve=>server.close(resolve));server=null;
 // Relocate the entire tool and its approved store; hashes/evidence must remain usable.
 const relocated=path.join(temp,'relocated-store');fs.cpSync(data,relocated,{recursive:true});
 check('Allow survives store relocation',cli(['export','--data',relocated,'--id',hero.id,'--out',path.join(temp,'relocated-export')]).id===hero.id);
 server=await serve({data,host:'127.0.0.1',port:0});base='http://127.0.0.1:'+server.address().port;
 status=await (await fetch(base+'/api/candidates')).json();check('Allow and Deny survive process restart',status.items.find(x=>x.id===hero.id).state==='allowed'&&status.items.find(x=>x.id===rival.id).state==='denied');
 await new Promise(resolve=>server.close(resolve));server=null;
 // Current source tampering invalidates previous approval and blocks export.
 const file=path.join(data,'candidates',hero.id,'charset.png');fs.appendFileSync(file,Buffer.from('tampered'));
 check('tampered candidate becomes stale',cli(['status']).items.find(x=>x.id===hero.id).state==='stale');cli(['export','--id',hero.id,'--out',path.join(temp,'tampered-export')],false);
 cli(['verify'],false);
 fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({pass:true,checks,copyOutsideRepository:true,runtimeNpmDependencies:0,syntheticDecisionsOnly:true,liveStoresTouched:false},null,2)+'\n');
 console.log(JSON.stringify({pass:true,checks:checks.length,out}));
}catch(e){fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({pass:false,checks,error:e.stack},null,2)+'\n');throw e;}
finally{if(server)await new Promise(resolve=>server.close(resolve));fs.rmSync(temp,{recursive:true,force:true});}
