// Synthetic receipts are created only in a disposable copied harness, never the live review store.
import {pathToFileURL,fileURLToPath} from 'node:url';
if(!process.env.FIELD_KIT_PLAYWRIGHT)throw Error('Set FIELD_KIT_PLAYWRIGHT');
const {chromium}=await import(pathToFileURL(process.env.FIELD_KIT_PLAYWRIGHT).href);
import {mkdtemp,cp,readFile,writeFile} from 'node:fs/promises';import {spawn,spawnSync} from 'node:child_process';import {tmpdir} from 'node:os';import {resolve,dirname} from 'node:path';
const root=dirname(fileURLToPath(import.meta.url));
const folder=await mkdtemp(resolve(tmpdir(),'field-kit-receipts-')),kit=resolve(folder,'kit');
await cp(root,kit,{recursive:true,filter:p=>!p.split('/').some(n=>['.data','evidence','__pycache__'].includes(n))});
const report={scope:'Synthetic browser decisions in a disposable harness copy. NOT human approval.',temporaryKit:kit,checks:{}};
let server;
async function start(){server=spawn(process.execPath,[resolve(kit,'server.mjs'),'--port','18328'],{stdio:['ignore','pipe','pipe']});await new Promise((yes,no)=>{server.stdout.once('data',yes);server.once('error',no);server.once('exit',code=>{if(code)no(Error('server exited '+code));});});}
await start();const b=await chromium.launch({args:['--no-sandbox']}),p=await b.newPage();
const check=(x,name)=>{report.checks[name]=Boolean(x);if(!x)throw Error(name);};
try{
 await p.goto('http://127.0.0.1:18328');await p.waitForFunction(()=>window.fieldKit);
 const initial=await(await fetch('http://127.0.0.1:18328/api/reviews')).json();
 const post=payload=>p.evaluate(async v=>{const r=await fetch('/api/reviews',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(v)});return r.status;},payload);
 check(await post({group:'monster',decision:'allow',note:'synthetic',package:initial.packages.monster,checks:[false,false]})===400,'unchecked_allow_rejected');
 check(await post({group:'monster',decision:'allow',note:'synthetic',package:'stale',checks:[true,true]})===409,'stale_package_rejected');
 check((await fetch('http://127.0.0.1:18328/api/reviews',{method:'POST',headers:{'Content-Type':'application/json','Origin':'http://wrong.example'},body:'{}'})).status===403,'foreign_origin_rejected');
 async function allow(group){for(const box of await p.locator(`[data-group="${group}"] input`).all())await box.check();await p.locator(`[data-group="${group}"] .allow`).click();await p.locator(`[data-group="${group}"] .decision`).filter({hasText:'ALLOW'}).waitFor();}
 await allow('monster');await p.locator('[data-group="ui"] textarea').fill('Synthetic Deny used only to prove persistence and export blocking.');await p.locator('[data-group="ui"] .deny').click();await p.locator('[data-group="ui"] .decision').filter({hasText:'DENY'}).waitFor();await allow('music');
 let result=spawnSync(process.execPath,[resolve(kit,'package.mjs'),'export',resolve(folder,'blocked')]);check(result.status!==0,'deny_blocks_export');
 server.kill();await new Promise(r=>server.once('exit',r));await start();await p.reload();await p.waitForFunction(()=>window.fieldKit);
 check((await p.locator('[data-group="monster"] .decision').innerText()).includes('ALLOW'),'allow_survives_restart');check((await p.locator('[data-group="ui"] .decision').innerText()).includes('DENY'),'deny_survives_restart');
 await allow('ui');result=spawnSync(process.execPath,[resolve(kit,'package.mjs'),'export',resolve(folder,'approved')]);check(result.status===0,'all_current_allows_export');
 await writeFile(resolve(kit,'site/assets/cursor.wav'),Buffer.from('altered candidate'));
 result=spawnSync(process.execPath,[resolve(kit,'package.mjs'),'export',resolve(folder,'stale')]);check(result.status!==0,'changed_bytes_block_export');
 const production=await(await fetch((process.env.FIELD_KIT_URL??'http://127.0.0.1:18327')+'/api/reviews')).json();check(Object.keys(production.decisions).length===0,'production_has_zero_votes');
 await writeFile(resolve(root,'evidence/receipts.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await b.close();server.kill();}
