/** Focused real renderer fixture gate. Synthetic PNGs, no app/canonical/server.
 * Verifies dimensions/fallback/cleanup; generated art approval is separate.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const out=path.resolve(process.argv[2]??path.join(os.tmpdir(),'oprn-emerald-trainer-dimensions'));
fs.mkdirSync(out,{recursive:true});
const entry=path.join(out,'entry.ts');
fs.writeFileSync(entry,`import {mountEmeraldTrainerIntro,resolveEmeraldTrainerIntro} from ${JSON.stringify(path.join(root,'src/player/emeraldTrainerIntro.ts'))}; Object.assign(window,{trainerProbe:{mountEmeraldTrainerIntro,resolveEmeraldTrainerIntro}});`);
await build({entryPoints:[entry],outfile:path.join(out,'probe.js'),bundle:true,platform:'browser',format:'iife',tsconfig:path.join(root,'tsconfig.app.json'),logLevel:'silent',plugins:[{
  name:'fixture-resource-boundary',setup(b){
    b.onResolve({filter:/generatedAssetResourceResolver$/},()=>({path:'fixture-resolver',namespace:'probe'}));
    b.onLoad({filter:/.*/,namespace:'probe'},()=>({contents:'export function resolveAssetResourceUrl(id,{project}){return project.assets.uploaded[id]?.dataUrl??null}',loader:'js'}));
  }
}]});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1024,height:720},reducedMotion:'reduce'}),errors=[];
page.on('pageerror',error=>errors.push(String(error)));
try{
  await page.setContent('<main id="host" style="display:flex;gap:16px;flex-wrap:wrap"></main>');
  await page.addStyleTag({content:'.battle-scene{position:relative;width:480px;height:320px;background:#e0e8b0}.battle-actor-group{position:absolute;inset:0;background:#c8d8c0}'+fs.readFileSync(path.join(out,'probe.css'),'utf8')});
  await page.addScriptTag({path:path.join(out,'probe.js')});
  const result=await page.evaluate(async()=>{
    const {mountEmeraldTrainerIntro,resolveEmeraldTrainerIntro}=window.trainerProbe,checks=[],cases=[];
    const check=(name,pass,details)=>{checks.push({name,pass:!!pass,details});if(!pass)throw Error(name+': '+JSON.stringify(details))};
    const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    const png=(width,height)=>{const c=document.createElement('canvas');c.width=width;c.height=height;const x=c.getContext('2d');x.fillStyle='#265478';x.fillRect(0,0,width,height);x.fillStyle='#f0b830';x.fillRect(0,0,8,8);x.fillRect(width-8,height-8,8,8);return c.toDataURL()};
    const picture=(height)=>({kind:'picture',meta:{width:64,height},dataUrl:png(64,height)});
    const session={currentMapId:'field',switches:{},variables:{},selfSwitches:{}};
    const snapshot={troopId:'mx_troop_rival',eventState:{switches:{},variables:{},selfSwitches:{}}};
    const project=(opponentHeight,heroHeight)=>({database:{troops:[{id:snapshot.troopId,trainerBattle:true}]},maps:{field:{events:[{id:'rival',pages:[{conditions:[],graphic:{sprite:{type:'uploaded',id:'oprn_emerald_field_cast_1'},pattern:3}}]}]}},assets:{uploaded:{oprn_emerald_trainer_rival:picture(opponentHeight),oprn_emerald_trainer_hero_back:picture(heroHeight)}}});
    const mounted=(project,label)=>{
      const root=document.createElement('div');root.className='battle-scene';root.dataset.monsterStyle='emerald';root.dataset.case=label;
      const battler=document.createElement('div');battler.className='battle-actor-group';root.append(battler);document.querySelector('#host').append(root);
      const controller=mountEmeraldTrainerIntro(root,project,session,snapshot);controller.sync({step:'intro',trainerIntroduction:true});return {root,battler,controller};
    };
    for(const [label,opponentHeight,heroHeight] of [['native',64,64],['legacy',96,96],['mixed',64,96]]){
      const p=project(opponentHeight,heroHeight),pair=resolveEmeraldTrainerIntro(p,session,snapshot);
      check(label+' metadata resolves correct profile',pair?.role==='rival'&&pair.opponent.height===opponentHeight&&pair.hero.height===heroHeight);
      const m=mounted(p,label);
      for(let i=0;i<40&&!m.root.dataset.emeraldTrainerIntro;i++)await wait(10);
      const dimensions=[...m.root.querySelectorAll('img')].map(image=>{const style=getComputedStyle(image),rect=image.getBoundingClientRect(),root=m.root.getBoundingClientRect();return {side:image.className,profile:image.dataset.portraitProfile,width:image.width,height:image.height,naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight,cssWidth:parseFloat(style.width),cssHeight:parseFloat(style.height),objectFit:style.objectFit,bottom:rect.bottom-root.top}});
      check(label+' decoded pictures render at uniform integer2x',dimensions.length===2&&dimensions.every(image=>image.width===image.naturalWidth*2&&image.height===image.naturalHeight*2&&image.cssWidth===image.width&&image.cssHeight===image.height&&image.objectFit==='contain'),dimensions);
      check(label+' preserves battle baseline and hides monsters only when ready',m.root.dataset.emeraldTrainerIntro==='true'&&getComputedStyle(m.battler).visibility==='hidden'&&dimensions[0].bottom===240&&dimensions[1].bottom===210,dimensions);
      m.controller.sync({step:'intro'});
      check(label+' send-out retains original native battlers',!m.root.dataset.emeraldTrainerIntro&&m.root.querySelector('.emerald-trainer-intro').hidden&&getComputedStyle(m.battler).visibility==='visible');
      m.controller.sync({step:'intro',trainerIntroduction:true});cases.push({label,dimensions});
    }
    const invalidChanges=[
      ['width63',a=>a.meta.width=63],['height65',a=>a.meta.height=65],['uncropped-back-strip',a=>a.meta.height=256],
      ['metadata-decode-mismatch',a=>a.meta.height=96],['decode-error',a=>a.dataUrl='data:image/png;base64,broken'],
      ['missing',(_a,p)=>delete p.assets.uploaded.oprn_emerald_trainer_rival]
    ];
    for(const [label,change] of invalidChanges){
      const p=project(64,64);change(p.assets.uploaded.oprn_emerald_trainer_rival,p);const m=mounted(p,label);await wait(100);
      check(label+' retains native battle fallback',!m.root.dataset.emeraldTrainerIntro&&getComputedStyle(m.battler).visibility==='visible'&&(!m.root.querySelector('.emerald-trainer-intro')||m.root.querySelector('.emerald-trainer-intro').hidden));
      m.controller.destroy();m.root.remove();
    }
    const late=mounted(project(64,64),'late-destroy');late.controller.destroy();late.controller.destroy();await wait(100);
    check('destroy and late load cannot revive portrait layer',!late.root.dataset.emeraldTrainerIntro&&!late.root.querySelector('.emerald-trainer-intro'));late.root.remove();
    return {checks,cases,limitations:'Actual trainer renderer and CSS with synthetic dimension PNGs and fixture URL resolution. No canonical/art changes, app shell, battle campaign, send-out pose animation, or generated-art approval.'};
  });
  if(errors.length)throw Error('Browser errors: '+errors.join(';'));
  result.errors=errors;await page.screenshot({path:path.join(out,'native-legacy-mixed.png')});
  fs.writeFileSync(path.join(out,'record.json'),JSON.stringify(result,null,2));
  fs.writeFileSync(path.join(out,'SUMMARY.md'),'# Emerald trainer dimensions fixture gate\n\n'+result.checks.map(c=>`- ${c.pass?'PASS':'FAIL'} ${c.name}`).join('\n')+'\n\nInspect: native-legacy-mixed.png\n\n'+result.limitations+'\n');
  console.log(JSON.stringify({output:out,checks:result.checks.length,errors:errors.length}));
}catch(error){await page.screenshot({path:path.join(out,'failure.png')});throw error}
finally{await browser.close()}
