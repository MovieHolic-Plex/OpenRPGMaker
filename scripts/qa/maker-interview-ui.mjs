// Production components, isolated from game-content writes. Synthetic network fixtures exercise races/failure.
import { chromium } from 'playwright';
import fs from 'node:fs';
import { resolve } from 'node:path';
const out=resolve('verify-shots/maker-click-first'); fs.mkdirSync(out,{recursive:true});
const base=process.env.MAKER_UI_URL??'http://127.0.0.1:9812';
const browser=await chromium.launch({args:['--no-sandbox','--disable-dev-shm-usage']});
const report={componentQA:true,syntheticNetwork:true,viewports:[],errors:[]};
try {
for(const size of [{width:1440,height:900},{width:960,height:540},{width:390,height:844},{width:320,height:568}]){
 const p=await browser.newPage({viewport:size,reducedMotion:'reduce'});p.on('pageerror',e=>report.errors.push(e.message));
 await p.route('**/v1/images/generations',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'QA unavailable'})}));
 await p.goto(base+'/start-screen.html');
 await p.evaluate(async()=>{await import('/src/editor/ui/projectInterviewDialog.ts');}).catch(()=>{});
 await p.waitForTimeout(2000);
 await p.goto(base+'/start-screen.html');
 await p.evaluate(async()=>{document.querySelector('#start-app')?.remove();const {createFirstWorldArrival}=await import('/src/start/firstWorldArrival.ts');window.__submitted=null;window.__arrival=createFirstWorldArrival({inputTestId:'qa-input',submitTestId:'qa-submit',genreTestId:c=>'qa-genre-'+c.id,onChoice:()=>{},onIntent:()=>{},onSubmit:(id,text)=>{window.__submitted={id,text};}});document.body.append(window.__arrival.element);});
 await p.getByTestId('qa-genre-story-cutscene').click();
 await p.getByTestId('qa-submit').click();
 const clickOnly=await p.evaluate(()=>window.__submitted?.id==='story-cutscene'&&window.__submitted.text==='');if(!clickOnly)throw Error('Click-only arrival failed');
 await p.screenshot({path:out+`/arrival-${size.width}.png`});
 await p.evaluate(async()=>{window.__arrival.dispose();window.__arrival.element.remove();const {showProjectInterview}=await import('/src/editor/ui/projectInterviewDialog.ts');window.__brief=null;void showProjectInterview('story-cutscene').then(b=>window.__brief=b);});
 await p.getByTestId('project-interview-genre-romance').click();
 const rect=async id=>p.getByTestId(id).evaluate(e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height,visible:b.x>=0&&b.y>=0&&b.right<=innerWidth&&b.bottom<=innerHeight&&b.width>0&&b.height>0,uncovered:e.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2))};});
 const stages=[];stages.push({stage:'genre',button:await rect('project-interview-begin')});
 await p.getByTestId('project-interview-begin').click();
 for(let index=0;index<5;index++){
  await p.getByTestId('project-interview-option-0').click();
  stages.push({stage:'question-'+index,button:await rect('project-interview-next'),options:await Promise.all([0,1,2].map(i=>rect('project-interview-option-'+i))),recommend:await rect('project-interview-recommend')});
  await p.getByTestId('project-interview-next').click();
 }
 stages.push({stage:'confirm',button:await rect('project-interview-confirm')});
 const noBank=await p.locator('.ci-genres img,.ci-options img').count()===0;
 const noShortcut=await p.locator('.cinematic-interview').evaluate(e=>!/(Ctrl|⌘|단축키|WASD)/.test(e.innerText));
 await p.screenshot({path:out+`/review-${size.width}.png`});
 await p.getByTestId('project-interview-confirm').click();
 await p.waitForFunction(()=>window.__brief);
 const brief=await p.evaluate(()=>({genre:window.__brief.interview.genre,answers:Object.keys(window.__brief.answers).length,protagonist:window.__brief.interview.protagonist}));
 if(stages.some(s=>!s.button.visible||!s.button.uncovered||s.options?.some(o=>!o.visible||!o.uncovered)||s.recommend&&!s.recommend.visible)||!noBank||!noShortcut||brief.answers!==5||brief.protagonist!=='')throw Error('UI invariants failed '+JSON.stringify({size,stages,noBank,noShortcut,brief}));
 report.viewports.push({size,clickOnly,noBank,noShortcut,stages,brief});await p.close();
}
report.passed=true;
}finally{fs.writeFileSync(out+'/ui-proof.json',JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({passed:report.passed,viewports:report.viewports.length,errors:report.errors}));
