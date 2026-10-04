// Desktop launcher -> a new, isolated SQLite folder -> production interview. Cancel before AI.
import { _electron } from 'playwright';
import { resolve } from 'node:path';
import { mkdirSync,writeFileSync } from 'node:fs';
const root=resolve('output/qa/interview-desktop');const out=resolve('verify-shots/interview-desktop');mkdirSync(out,{recursive:true});mkdirSync(root,{recursive:true});
const env={...process.env,OPRN_RENDERER_DIR:resolve('dist'),OPRN_NEW_PROJECT_ROOT:root+'/games'};
delete env.OPRN_OPEN_PROJECT_DIR;
const report={errors:[]};const app=await _electron.launch({args:[process.cwd(),'--disable-gpu','--disable-dev-shm-usage',`--user-data-dir=${root}/profile`],env,timeout:60000});
try{const p=await app.firstWindow();p.on('pageerror',e=>report.errors.push(e.message));await p.getByTestId('start-new-game').waitFor({timeout:90000});await p.screenshot({path:out+'/launcher.png'});await p.getByTestId('start-new-game').click();await p.getByTestId('start-title-input').fill('데스크톱 인터뷰 QA');await p.getByTestId('start-create').click();await p.getByTestId('project-interview').waitFor({timeout:180000});report.url=p.url();report.bridge=await p.evaluate(async()=>({status:await window.oprn.project.status()}));report.genres=await p.locator('.ci-genres').innerText();await p.getByTestId('project-interview-genre-monster').click();await p.getByTestId('project-interview-begin').click();await p.waitForTimeout(700);report.question=await p.locator('#project-interview-question').innerText();await p.screenshot({path:out+'/interview.png'});await p.getByTestId('project-interview-cancel').click();report.cancelClosed=await p.getByTestId('project-interview').count()===0;report.passed=report.cancelClosed&&report.genres.includes('관계')&&report.question.length>0&&report.errors.length===0;
}catch(e){report.failure=e.message;throw e;}finally{writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await app.close();}console.log(JSON.stringify(report));
