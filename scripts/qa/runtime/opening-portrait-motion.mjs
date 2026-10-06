/** Focused fixture probe. No app server, canonical writes, or repository suites.
 * Synthetic coloured frames prove controller mechanics, not the quality of art.
 * Audio methods are observed stubs; native playback/listening is a separate gate.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const out = path.resolve(process.argv[2] ?? path.join(os.tmpdir(), 'oprn-opening-portrait-motion-probe'));
fs.mkdirSync(out, { recursive: true });
const entry = path.join(out, 'entry.ts');
fs.writeFileSync(entry, `
import {playCinematicSequence} from ${JSON.stringify(path.join(root,'src/player/cinematicSequence.ts'))};
import {createOpeningPortraitMotion} from ${JSON.stringify(path.join(root,'src/player/openingPortraitMotion.ts'))};
import {validateOpeningPortraitMotion} from ${JSON.stringify(path.join(root,'src/project/openingPortraitMotion.ts'))};
import {validateMeta} from ${JSON.stringify(path.join(root,'src/project/io/shapeResourceFields.ts'))};
import {encodeCinematicWire,decodeCinematicWire} from ${JSON.stringify(path.join(root,'src/project/cinematicWire.ts'))};
Object.assign(window,{motionProbe:{playCinematicSequence,createOpeningPortraitMotion,validateOpeningPortraitMotion,validateMeta,encodeCinematicWire,decodeCinematicWire}});
`);
await build({entryPoints:[entry],outfile:path.join(out,'probe.js'),bundle:true,platform:'browser',format:'iife',tsconfig:path.join(root,'tsconfig.app.json'),logLevel:'silent',plugins:[{
  name:'fixture-resource-boundary',setup(b){
    b.onResolve({filter:/generatedAssetResourceResolver$/},()=>({path:'fixture-resolver',namespace:'probe'}));
    b.onLoad({filter:/.*/,namespace:'probe'},()=>({contents:`export function resolveAssetResourceUrl(id,{project}){return project.assets.uploaded[id]?.dataUrl??null}`,loader:'js'}));
  }
}]});
const browser = await chromium.launch({headless:true});
const context = await browser.newContext({viewport:{width:960,height:640}});
const page = await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
  await page.setContent('<main id="host" style="position:relative;width:480px;height:320px"></main>');
  await page.addStyleTag({content:fs.readFileSync(path.join(root,'src/styles/runtime/playSurface.css'),'utf8')+'\n'+fs.readFileSync(path.join(out,'probe.css'),'utf8')});
  await page.addScriptTag({path:path.join(out,'probe.js')});
  const result = await page.evaluate(async()=>{
    const {playCinematicSequence,createOpeningPortraitMotion,validateOpeningPortraitMotion,validateMeta,encodeCinematicWire,decodeCinematicWire}=window.motionProbe;
    const checks=[];const check=(name,yes,details)=>{checks.push({name,pass:!!yes,details});if(!yes)throw Error(name+': '+JSON.stringify(details));};
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    const host=document.querySelector('#host');
    let playCalls=0,pauseCalls=0;
    HTMLMediaElement.prototype.play=function(){playCalls++;this.dataset.probePlaying='true';return Promise.resolve()};
    HTMLMediaElement.prototype.pause=function(){pauseCalls++};HTMLMediaElement.prototype.load=function(){};
    const strip=document.createElement('canvas');strip.width=32;strip.height=12;const ctx=strip.getContext('2d');
    ['#a42f42','#f2d055','#246e90','#58ab6d'].forEach((color,i)=>{ctx.fillStyle=color;ctx.fillRect(i*8,0,8,12)});
    const png=strip.toDataURL(),still=document.createElement('canvas');still.width=8;still.height=12;still.getContext('2d').drawImage(strip,0,0,8,12,0,0,8,12);
    const ids=Array.from({length:8},(_,i)=>'page'+i);
    const motion={resourceId:'poses',frameWidth:8,frameHeight:12,frameCount:4,frames:[0,1,2,3],fps:12,sceneFrames:{page1:[3,2,1,0]}};
    const project={meta:{title:'fixture',author:'probe',terms:{},oprnMonsterStyle:{version:1,reference:'emerald'},oprnOpeningBook:{version:1,ink:'ivory',sceneIds:ids,portraitResourceId:'still',portraitMotion:motion}},system:{titleScreen:{},monsterCampaign:{},opening:{enabled:true,skippable:true,musicResourceId:'music',scenes:ids.map(id=>({id,kind:'image',resourceId:'still',motion:'none',durationMs:0,narration:id}))}},assets:{uploaded:{poses:{kind:'picture',dataUrl:png},still:{kind:'picture',dataUrl:still.toDataURL()},music:{kind:'music',dataUrl:'data:audio/wav;base64,'}}}};
    validateOpeningPortraitMotion(motion,ids);
    const raw=JSON.parse(JSON.stringify(encodeCinematicWire(project)));const round=decodeCinematicWire(raw);
    validateMeta(round.meta);
    check('wire metadata survives JSON encode/decode',JSON.stringify(round.meta.oprnOpeningBook.portraitMotion)===JSON.stringify(motion));
    const invalid=[{frameCount:33},{frameWidth:0},{fps:NaN},{frames:[4]},{frames:[]},{sceneFrames:{unknown:[0]}},{unknown:true}];
    check('malformed metadata rejected',invalid.every(change=>{try{validateOpeningPortraitMotion({...motion,...change},ids);return false}catch{return true}}));
    check('actual project meta guard rejects malformed motion',invalid.every(change=>{try{validateMeta({...project.meta,oprnOpeningBook:{...project.meta.oprnOpeningBook,portraitMotion:{...motion,...change}}});return false}catch{return true}}));
    const abort=new AbortController(),playback=playCinematicSequence({host,project,sequence:project.system.opening,signal:abort.signal});
    for(let i=0;i<40&&!host.querySelector('[data-portrait-motion="ready"]');i++)await wait(25);
    const stage=host.querySelector('.cinematic-sequence'),canvas=host.querySelector('[data-testid="opening-portrait-motion"]'),image=host.querySelector('img.cinematic-image'),music=host.querySelector('[data-testid="cinematic-music"]');
    check('strip decoded with expected native bounds',canvas?.width===8&&canvas?.height===12&&stage.dataset.portraitMotion==='ready');
    const hashes=new Set();for(let i=0;i<8;i++){hashes.add(canvas.toDataURL());await wait(95)}
    check('distinct actual frame pixels',hashes.size>=3,{distinct:hashes.size});
    check('legacy bob suppressed',getComputedStyle(canvas).animationName==='none');
    const clock=Number(canvas.dataset.clockMs),controller=canvas.dataset.controller;
    const key=(key,repeat=false)=>window.dispatchEvent(new KeyboardEvent('keydown',{key,repeat,bubbles:true,cancelable:true}));
    key('w');key('a');key('s');key('d');check('WASD owns no advance or music restart',stage.dataset.page==='1'&&playCalls===1);
    key('Enter');await wait(100);
    check('Enter retains canvas image controller music and clock',stage.dataset.page==='2'&&canvas===host.querySelector('[data-testid="opening-portrait-motion"]')&&image===host.querySelector('img.cinematic-image')&&music===host.querySelector('[data-testid="cinematic-music"]')&&canvas.dataset.controller===controller&&Number(canvas.dataset.clockMs)>=clock&&playCalls===1);
    key('Enter',true);check('held Enter advances no additional page',stage.dataset.page==='2');
    Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));
    const paused=canvas.toDataURL(),pausedClock=canvas.dataset.clockMs;await wait(250);
    check('hidden tab freezes pose and clock',canvas.toDataURL()===paused&&canvas.dataset.clockMs===pausedClock&&canvas.dataset.paused==='hidden');
    Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));await wait(110);
    check('visible tab resumes without new controller',canvas.dataset.controller===controller&&Number(canvas.dataset.clockMs)>Number(pausedClock));
    key('Escape');check('skip removes portrait and music',await playback.done==='skipped'&&!host.querySelector('canvas')&&!host.querySelector('audio')&&pauseCalls===1);
    const disposedClock=canvas.dataset.clockMs;await wait(100);check('disposed portrait clock stopped',canvas.dataset.clockMs===disposedClock);
    const make=async(change,reduced=false)=>{
      const root=document.createElement('div'),image=document.createElement('img');image.src=still.toDataURL();root.append(image);host.append(root);
      const ctl=createOpeningPortraitMotion({root,image,project,motion:{...motion,...change},sceneIds:ids,sceneId:ids[0],reducedMotion:reduced});
      const ready=ctl?await ctl.ready:false;return {root,image,ctl,ready};
    };
    const reduced=await make({},true);check('reduced motion neutral frame',reduced.ready&&reduced.ctl.element.dataset.frame==='0'&&reduced.ctl.element.dataset.paused==='reduced-motion');
    const stillHash=reduced.ctl.element.toDataURL();await wait(180);check('reduced motion remains frozen',stillHash===reduced.ctl.element.toDataURL());reduced.ctl.dispose();reduced.root.remove();
    for(const change of [{resourceId:'missing'},{frameWidth:9},{frames:[50]}]){
      const fallback=await make(change);check('invalid/missing/decoded mismatch retains still '+JSON.stringify(change),!fallback.ready&&fallback.image.style.visibility!=='hidden'&&!fallback.root.querySelector('canvas'));fallback.ctl?.dispose();fallback.root.remove();
    }
    const prototypePage=await make({});prototypePage.ctl.setScene('constructor');await wait(100);check('page names do not read inherited frame orders',prototypePage.ready&&Number(prototypePage.ctl.element.dataset.frame)>=0);prototypePage.ctl.dispose();prototypePage.root.remove();
    const finishing=playCinematicSequence({host,project,sequence:project.system.opening,signal:new AbortController().signal});for(let i=0;i<8;i++)key('Enter');check('all confirm pages finish and clean',await finishing.done==='completed'&&!host.querySelector('canvas')&&!host.querySelector('audio'));
    const killed=new AbortController(),pending=playCinematicSequence({host,project,sequence:project.system.opening,signal:killed.signal});killed.abort();check('abort during decode cleans',await pending.done==='aborted'&&!host.querySelector('canvas'));await wait(80);check('late decode cannot resurrect portrait',!host.querySelector('canvas'));
    return {checks,distinctFixtureFrames:hashes.size,audioObserved:{playCalls,pauseCalls},limitations:'Synthetic pose pixels; stubbed audio methods. This is controller verification, not art acceptance, canonical persistence, native shipping playback, or listening.'};
  });
  result.pageErrors=errors;
  if(errors.length)throw Error('Browser errors: '+errors.join('; '));
  fs.writeFileSync(path.join(out,'record.json'),JSON.stringify(result,null,2));
  fs.writeFileSync(path.join(out,'SUMMARY.md'),'# Opening portrait motion fixture probe\n\n'+result.checks.map(c=>`- ${c.pass?'PASS':'FAIL'} ${c.name}`).join('\n')+'\n\n'+result.limitations+'\n');
  console.log(JSON.stringify({output:out,checks:result.checks.length,errors:errors.length,distinctFrames:result.distinctFixtureFrames}));
} finally {await browser.close()}
