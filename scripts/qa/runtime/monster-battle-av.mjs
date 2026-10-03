// Record real keyboard-driven player battles and the browser's actual audio output.
// Private Xvfb + PipeWire/Pulse monitor; no reconstructed frames or replacement audio.
import {mkdtemp,mkdir,readFile,writeFile,access} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {chromium} from '@playwright/test';
import {recordingFixture} from './retro2003-gif-fixture.mjs';
import {startPlayerQaServer} from '../../lib/runtimeQaRun.mjs';

const out=resolve('verify-shots/monster-battle-av');
await mkdir(out,{recursive:true});
const temp=await mkdtemp('/tmp/oprn-monster-av-');
await mkdir(join(temp,'runtime'),{mode:0o700});
let displayNumber=180;
for(;;displayNumber++){
 try{await access('/tmp/.X11-unix/X'+displayNumber);}catch{break;}
}
const env={...process.env,XDG_RUNTIME_DIR:join(temp,'runtime'),
 DISPLAY:':'+displayNumber,PULSE_SERVER:'unix:'+join(temp,'runtime/pulse/native'),PULSE_SINK:'monster_capture'};
process.env.VITE_CACHE_DIR??=resolve('.vite-cache/monster-battle-av');
process.env.VITE_BGM_CDN_BASE='';
const manifest=JSON.parse(await readFile(resolve('scripts/asset-gen/pixel-enemy/redraw/manifest.json'),'utf8'));
const cases=[['orc-warrior','오크 전사'],['hydra-three','삼두 히드라'],['dragon-blue','푸른 용']];
const report={route:'player.html + exportProjectStoreShim',fixtureOnly:true,
 capture:'Real X11 browser pixels + real Pulse sink monitor in one ffmpeg process.',
 cases:[],errors:[]};
const processes=[];
let server,context,recorder;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function command(bin,args){
 const result=spawnSync(bin,args,{env,encoding:'utf8',maxBuffer:5*1024*1024});
 if(result.status!==0)throw new Error(bin+': '+result.stderr);
 return result.stdout;
}
function daemon(bin,args=[]){
 const child=spawn(bin,args,{env,stdio:['ignore','ignore','pipe']});
 child.logs='';child.stderr.on('data',b=>{child.logs=(child.logs+String(b)).slice(-5000);});
 processes.push(child);return child;
}
async function choose(page,id){
 for(let i=0;i<12;i++){
  const ui=await page.evaluate(()=>{
   const root=document.querySelector('[data-testid="battle-scene"]');
   const buttons=[...document.querySelectorAll('button.battle-command')].filter(n=>!n.disabled&&n.dataset.previewOnly!=='true');
   return {busy:root?.dataset.battleSequenceBusy==='true',menu:buttons.map(n=>n.dataset.testid),cursor:buttons.findIndex(n=>n.dataset.battleCommandCursor==='true')};
  });
  if(ui.busy||!ui.menu.includes(id))return false;
  const want=ui.menu.indexOf(id);
  if(ui.cursor===want){await page.keyboard.press('z');return true;}
  await page.keyboard.press(ui.cursor<0||want>ui.cursor?'ArrowDown':'ArrowUp');await delay(65);
 }
 return false;
}
async function finishRecording(){
 if(!recorder)return;
 const child=recorder;recorder=null;
 child.stdin.end('q\n');
 const status=await child.done;
 if(status!==0)throw new Error('ffmpeg capture failed: '+child.logs.slice(-1800));
}
try{
 const bus=spawn('dbus-daemon',['--session','--nofork','--print-address=1'],{env,stdio:['ignore','pipe','pipe']});
 processes.push(bus);
 env.DBUS_SESSION_BUS_ADDRESS=await new Promise((r,j)=>{
  const deadline=setTimeout(()=>j(new Error('Private session bus did not start')),4000);
  bus.stdout.once('data',b=>{clearTimeout(deadline);r(String(b).trim());});bus.once('error',j);
 });
 daemon('Xvfb',[env.DISPLAY,'-screen','0','962x722x24','-nolisten','tcp','-ac']);
 daemon('pipewire');daemon('pipewire-pulse');
 let ready=false;
 for(let i=0;i<60;i++){
  await delay(100);
  if(spawnSync('pactl',['info'],{env,stdio:'ignore'}).status===0){ready=true;break;}
 }
 if(!ready)throw new Error('Private Pulse service did not start');
 daemon('wireplumber');
 command('pactl',['load-module','module-null-sink','sink_name=monster_capture','rate=48000','channels=2']);
 let selected=false;
 for(let i=0;i<40;i++){
  await delay(100);
  if(spawnSync('pactl',['set-default-sink','monster_capture'],{env,stdio:'ignore'}).status===0){selected=true;break;}
 }
 if(!selected)throw new Error('Private sink policy did not start');
 server=await startPlayerQaServer({logLevel:'error'});
 await mkdir(join(temp,'browser/Default'),{recursive:true});
 await writeFile(join(temp,'browser/Default/Preferences'),JSON.stringify({
  translate:{enabled:false},intl:{accept_languages:'ko-KR,ko,en-US,en'}
 }));
 context=await chromium.launchPersistentContext(join(temp,'browser'),{
  headless:false,viewport:null,env,ignoreDefaultArgs:['--no-startup-window'],
  args:['--no-sandbox','--kiosk','--app=about:blank','--window-position=0,0','--window-size=960,720',
    '--autoplay-policy=no-user-gesture-required','--disable-features=Translate,TranslateUI','--lang=ko','--use-gl=swiftshader','--disable-gpu']
 });
 const page=context.pages()[0]??await context.newPage();
 for(const other of context.pages())if(other!==page)await other.close();
 const cdp=await context.newCDPSession(page);
 const window=await cdp.send('Browser.getWindowForTarget');
 await cdp.send('Browser.setWindowBounds',{windowId:window.windowId,bounds:{windowState:'fullscreen'}});
 await delay(250);
 await page.setViewportSize({width:960,height:720});
 if(await page.evaluate(()=>innerHeight<720))await page.keyboard.press('F11');
 await delay(250);
 await page.addInitScript(()=>{
  window.__OPENRPG_BOOT__={projectUrl:'/__monster-av/project.json',saveNamespace:'monster-av-fixture',qaInstrumentation:true};
  window.__avSoundStarts=[];
  for(const Class of [AudioBufferSourceNode,OscillatorNode]){
   const start=Class.prototype.start;
   Class.prototype.start=function(...args){
    window.__avSoundStarts.push({kind:Class.name,at:performance.now(),duration:this.buffer?.duration});
    return start.apply(this,args);
   };
  }
 });
 for(const [slug,name] of cases){
  const fixture=await recordingFixture();
  const entry=manifest.find(e=>e.slug===slug),row={slug,name,cell:entry.cell,motion:entry.motion,errors:[]};
  const errors=[];page.on('pageerror',error=>errors.push(String(error)));
  let networkChanged=false;
  const failed=r=>{if(r.failure()?.errorText==='net::ERR_NETWORK_CHANGED')networkChanged=true;};
  page.on('requestfailed',failed);
  try{
   const project=fixture.project;project.system.battleUiStyle='retro2003';project.system.battleFlow='strict';
   project.system.battleBgmResourceId='cc0-bgm-rtp-btl-001';
   project.system.startActorIds=['actor_hero'];project.session.partyActorIds=['actor_hero'];
   const sample=structuredClone(project.database.enemies[0]);
   const enemy={...sample,id:'enemy_video',name,monsterResourceId:entry.resourceId,
    stats:{...sample.stats,maxHp:35,defense:1,attack:35,agility:1},
    actions:[{skillId:'skill_attack',priority:5,condition:{kind:'always'}}]};
   delete enemy.collapseEffect;project.database.enemies.push(enemy);
   const troop=project.database.troops.find(t=>t.id===fixture.entry.troopId);
   troop.enemyIds=[enemy.id];troop.autoAlign=false;troop.members=[{enemyId:enemy.id,x:110,y:144,hidden:false}];
   await page.unroute('**/__monster-av/project.json');
   await page.route('**/__monster-av/project.json',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(project)}));
   await page.goto(server.url+'/player.html?e2eVitals=1',{waitUntil:'domcontentloaded'});
   for(let attempt=0;attempt<3;attempt++){
    try{await page.waitForSelector('[data-testid="title-screen"]',{timeout:30000});break;}
    catch(e){if(!networkChanged||attempt===2)throw e;networkChanged=false;await page.reload({waitUntil:'domcontentloaded'});}
   }
   await page.keyboard.press('Enter');
   await page.waitForFunction(()=>!!window.__oprnDebug?.readState?.().currentMapId,null,{timeout:60000});
   await page.evaluate(e=>{window.__oprnDebug.setSeed(1);window.__oprnDebug.teleport(e.mapId,e.x,e.y);window.__oprnInput.face('up');},fixture.entry);
   for(let i=0;i<30&&!(await page.locator('[data-testid="battle-scene"]').count());i++){await page.keyboard.press('z');await delay(200);}
   await page.waitForFunction(cell=>{
    const root=document.querySelector('[data-testid="battle-scene"]'),node=root?.querySelector('.battle-enemy');
    return root?.dataset.battlePhase==='actorCommand'&&root.dataset.battleSequenceBusy==='false'&&node?.dataset.pixelEnemyCell===String(cell);
   },entry.cell,{timeout:30000});
   row.window=await page.evaluate(()=>({innerWidth,innerHeight,outerWidth,outerHeight,screenX,screenY}));
   // X11's undecorated app window can leave one outline pixel on the 960×720 screen.
   if(row.window.innerWidth<959||row.window.innerHeight<719)throw new Error('Wrong capture viewport');
   await page.screenshot({path:join(out,slug+'-idle.png')});
   await page.evaluate(()=>{
    window.__avFrames=[];window.__avStop=false;window.__avRecordStart=performance.now();
    let previous='';
    const node=document.querySelector('.battle-enemy');
    window.__avObserver=new MutationObserver(records=>{for(const r of records){
     if(r.oldValue)window.__avFrames.push({frame:r.oldValue,at:performance.now()-window.__avRecordStart});
     window.__avFrames.push({frame:node.dataset.battlePoseFrame,at:performance.now()-window.__avRecordStart});
    }});
    window.__avObserver.observe(node,{attributes:true,attributeOldValue:true,attributeFilter:['data-battle-pose-frame']});
   });
   recorder=spawn('ffmpeg',['-hide_banner','-loglevel','warning','-y',
    '-thread_queue_size','1024','-use_wallclock_as_timestamps','1','-f','x11grab','-draw_mouse','0','-framerate','30','-video_size','960x720','-i',env.DISPLAY+'.0+0,0',
    '-thread_queue_size','1024','-use_wallclock_as_timestamps','1','-f','pulse','-sample_rate','48000','-i','monster_capture.monitor',
    '-c:v','libx264','-preset','veryfast','-crf','18','-pix_fmt','yuv420p','-threads','2',
    '-c:a','aac','-b:a','192k','-af','aresample=async=1:first_pts=0','-movflags','+faststart',join(out,slug+'.mp4')],
    {env,stdio:['pipe','ignore','pipe']});
   recorder.logs='';recorder.stderr.on('data',b=>{recorder.logs+=String(b);});
   recorder.done=new Promise((r,j)=>{recorder.on('exit',r);recorder.on('error',j);});
   await delay(1100);
   let defended=false,attacked=false;
   const deadline=Date.now()+35000;
   while(Date.now()<deadline){
    const ui=await page.evaluate(()=>{
     const root=document.querySelector('[data-testid="battle-scene"]');
     return {busy:root?.dataset.battleSequenceBusy==='true',phase:root?.dataset.battlePhase,
      target:!!document.querySelector('[data-testid="battle-target-prompt"]'),
      result:!!document.querySelector('[data-testid="battle-result-panel"]'),frames:window.__avFrames.map(r=>r.frame)};
    });
    if(ui.result||ui.frames.includes('dead')){await delay(2200);break;}
    if(!ui.busy){
     if(ui.target){await page.keyboard.press('z');attacked=true;}
     else if(ui.phase==='actorCommand'){
      if(!ui.frames.includes('attack'))defended=(await choose(page,'actor-command-defend'))||defended;
      else await choose(page,'actor-command-attack');
     }
    }
    await delay(80);
   }
   await finishRecording();
   row.observed=await page.evaluate(()=>{
    window.__avObserver.disconnect();
    return {frames:window.__avFrames,soundStarts:window.__avSoundStarts.filter(r=>r.at>=window.__avRecordStart),
      audioState:window.__oprnAudioState?.(),resources:window.__oprnAudioObserved};
   });
   row.defended=defended;row.playerAttackConfirmed=attacked;
   const frames=new Set(row.observed.frames.map(r=>r.frame));
   for(const f of ['windup','attack','hit','dead'])if(!frames.has(f))throw new Error('Missing real battle pose '+f);
   if(!row.observed.soundStarts.length)throw new Error('No live battle sounds scheduled');
   if(errors.length)throw new Error(errors.join('\n'));
   row.probe=JSON.parse(command('ffprobe',['-v','error','-show_streams','-show_format','-of','json',join(out,slug+'.mp4')]));
   if(!row.probe.streams.some(s=>s.codec_type==='audio')||!row.probe.streams.some(s=>s.codec_type==='video'))throw new Error('Missing AV stream');
   const pcm=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-i',join(out,slug+'.mp4'),'-vn','-ac','1','-ar','12000','-f','f32le','pipe:1'],{env,maxBuffer:8*1024*1024});
   if(pcm.status!==0)throw new Error('Audio decode failed');
   let peak=0,square=0;for(let i=0;i<pcm.stdout.length;i+=4){const x=pcm.stdout.readFloatLE(i);peak=Math.max(peak,Math.abs(x));square+=x*x;}
   row.audio={peak,rms:Math.sqrt(square/(pcm.stdout.length/4)),samples:pcm.stdout.length/4};
   if(row.audio.rms<0.002||row.audio.peak<0.02)throw new Error('Captured audio is silent');
   command('ffmpeg',['-hide_banner','-loglevel','error','-y','-ss','2','-i',join(out,slug+'.mp4'),'-frames:v','1',join(out,slug+'-video-frame.png')]);
   console.log(JSON.stringify({slug,duration:row.probe.format.duration,audio:row.audio,frames:[...frames]}));
  }catch(e){row.errors.push(String(e.stack??e));report.errors.push(...row.errors);await finishRecording().catch(()=>{});}
  finally{page.removeAllListeners('pageerror');page.off('requestfailed',failed);fixture.cleanup();}
  report.cases.push(row);await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  if(row.errors.length)break;
 }
 if(report.cases.length===3&&!report.errors.length){
  await writeFile(join(out,'concat.txt'),cases.map(([slug])=>"file '"+slug+".mp4'").join('\n')+'\n');
  command('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',join(out,'concat.txt'),'-c','copy','-movflags','+faststart',join(out,'monster-battles-with-audio.mp4')]);
  report.combined=JSON.parse(command('ffprobe',['-v','error','-show_streams','-show_format','-of','json',join(out,'monster-battles-with-audio.mp4')]));
 }
}catch(e){report.errors.push(String(e.stack??e));}
finally{
 await finishRecording().catch(e=>report.errors.push(String(e)));
 await context?.close();await server?.close();
 for(const child of processes.reverse())child.kill('SIGTERM');
}
report.passed=report.cases.length===3&&report.errors.length===0&&!!report.combined;
await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
await writeFile(join(out,'SUMMARY.md'),`# 몬스터 실제 전투 · 소리 포함 MP4\n\n${report.passed?'PASS':'FAIL'} — ${report.cases.length}/3종.\n\n즉시 확인: orc-warrior-video-frame.png, hydra-three-video-frame.png, dragon-blue-video-frame.png.\n\n출하 player.html + export shim, 임시 fixture, 실제 키보드 방어→적 공격→아군 공격→승리. Xvfb의 실제 브라우저 픽셀과 독립 Pulse 출력 모니터를 같은 ffmpeg 프로세스로 녹화했다. BGM·타격음·UI음은 게임이 재생한 원음이다. 대체 오디오나 포즈판을 합성하지 않았다. 최종 MP4는 H.264 + AAC,960×720,30fps다. 개별 클립을 그대로 이어 붙인다. 정본 프로젝트를 수정하지 않았다.\n\n${report.errors.join('\n')}\n`);
console.log(JSON.stringify({passed:report.passed,cases:report.cases.length,errors:report.errors}));
if(!report.passed)process.exitCode=1;
