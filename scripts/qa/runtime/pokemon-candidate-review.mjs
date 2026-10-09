// Visual evidence for selected generated assets; never grants semantic approval.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
const [selectionPath,outPath]=process.argv.slice(2);
if(!outPath)throw Error('Usage: pokemon-candidate-review.mjs <explicit-selection.json> <evidence-output>');
const selection=JSON.parse(await fs.readFile(selectionPath,'utf8')),out=path.resolve(outPath);
await fs.mkdir(out,{recursive:true});
const models=[];
for(const [role,candidate] of Object.entries(selection.walk))models.push({id:role,kind:'walk',candidate,file:'charset.png',width:16,height:32});
for(const [role,candidate] of Object.entries(selection.trainers))models.push({id:'trainer-'+role,kind:'portrait',candidate,file:'portrait.png',width:64,height:64});
models.push({id:'professor-intro',kind:'clip',candidate:selection.clip,file:'clip.png',width:64,height:64});
for(const m of models){const bytes=await fs.readFile(path.join(m.candidate,m.file));m.sha256=createHash('sha256').update(bytes).digest('hex');m.src='data:image/png;base64,'+bytes.toString('base64');}
const html=`<!doctype html><html lang="ko"><meta charset="utf-8"><title>원본 규격 도트 검수</title><style>body{margin:16px;background:#17252d;color:#edf0e6;font:14px system-ui}main{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}article{background:#293d48;padding:12px;break-inside:avoid}h2{margin:0 0 12px;font-size:15px}.poses{display:flex;gap:16px}canvas{image-rendering:pixelated;background:repeating-conic-gradient(#314952 0% 25%,#3d5960 0% 50%) 0 0/8px 8px}small{display:block;color:#aec6cc}button{font:inherit;padding:8px}</style><h1>16×32 걷기 · 64×64 인물 — 원본 1배 / 3배</h1><p>별도 후보 검수 화면. 아래 그림은 실제 파일을 그립니다. 게임 플레이 검증은 따로 수행합니다.</p><button id="pause">일시정지</button><button id="step">다음 포즈</button><main></main><script>const models=${JSON.stringify(models).replace(/</g,'\\u003c')};let phase=0,paused=false,last=0;const cards=[];for(const m of models){const a=document.createElement('article');a.id=m.id;const h=document.createElement('h2');h.textContent=m.id;a.append(h);const group=document.createElement('div');group.className='poses';a.append(group);const img=new Image();img.src=m.src;const cvs=[];for(const row of m.kind==='walk'?[0,1,2,3]:[0]){const panel=document.createElement('div');for(const scale of [1,3]){const cv=document.createElement('canvas');cv.width=m.width;cv.height=m.height;cv.style.width=cv.width*scale+'px';cv.style.height=cv.height*scale+'px';panel.append(cv);cvs.push({cv,row});}group.append(panel);}const s=document.createElement('small');s.textContent=m.kind==='walk'?'up / right / down / left · stepA → idle → stepB → idle':m.kind==='clip'?'눈·입·손의 6개 실제 자세':'64×64 정면/뒷면';a.append(s);document.querySelector('main').append(a);cards.push({m,img,cvs});}function draw(){for(const{m,img,cvs}of cards){if(!img.complete||!img.naturalWidth)continue;const col=m.kind==='walk'?[0,1,2,1][phase%4]:m.kind==='clip'?phase%6:0;for(const{cv,row}of cvs){const c=cv.getContext('2d');c.imageSmoothingEnabled=false;c.clearRect(0,0,cv.width,cv.height);c.drawImage(img,col*cv.width,row*cv.height,cv.width,cv.height,0,0,cv.width,cv.height);}}}window.setPhase=p=>{paused=true;phase=p;draw()};window.assetsLoaded=()=>cards.every(({img})=>img.complete&&img.naturalWidth);document.querySelector('#pause').onclick=()=>paused=!paused;document.querySelector('#step').onclick=()=>window.setPhase(phase+1);function tick(t){if(!paused&&t-last>=140){phase++;last=t;}draw();requestAnimationFrame(tick)}requestAnimationFrame(tick);</script></html>`;
await fs.writeFile(path.join(out,'gallery.html'),html);
const browser=await chromium.launch({args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1400,height:1000},recordVideo:{dir:path.join(out,'video'),size:{width:1400,height:1000}}});
const page=await context.newPage(),evidence={generatedAt:new Date().toISOString(),scope:'Real selected native PNGs at1×/3×, actual browser animation; separate from exported-game QA.',models:[]};
try{
 await page.goto('file://'+path.join(out,'gallery.html'));await page.waitForFunction(()=>window.assetsLoaded());await page.waitForTimeout(1400);
 for(let phase=0;phase<3;phase++){await page.evaluate(p=>window.setPhase(p),phase);await page.screenshot({path:path.join(out,'all-phase-'+phase+'.png'),fullPage:true});for(const m of models){if(m.kind==='portrait'&&phase>0)continue;await page.locator('[id="'+m.id+'"]').screenshot({path:path.join(out,m.id+'-phase-'+phase+'.png')});}}
 for(let phase=3;phase<6;phase++){await page.evaluate(p=>window.setPhase(p),phase);await page.locator('#professor-intro').screenshot({path:path.join(out,'professor-intro-phase-'+phase+'.png')});}
 for(const m of models){const files=Array.from({length:m.kind==='portrait'?1:m.kind==='clip'?6:3},(_,i)=>m.id+'-phase-'+i+'.png');evidence.models.push({id:m.id,candidate:m.candidate,nativeSha256:m.sha256,files});}
}finally{await context.close();await browser.close();await fs.writeFile(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));}
console.log(JSON.stringify({models:models.length,out,semanticApproved:false}));
