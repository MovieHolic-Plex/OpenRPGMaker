/** Actual standalone export QA, without editor boot or canonical writes.
 * Opening uses native keys and real audio. Walking explicitly uses private QA
 * teleport/input/frame hooks, preserving collision, gait speed and pose pixels.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const args = process.argv.slice(2), options = {};
for (let i=0;i<args.length;i++) {
  const key=args[i];
  if(key==='--opening-only')options.openingOnly=true;
  else if(['--export','--port','--url','--out','--canonical','--walk-map','--walk-x','--walk-y'].includes(key)){
    if(!args[i+1]||args[i+1].startsWith('--'))throw Error('Missing value: '+key);
    options[key.slice(2)]=args[++i];
  }else throw Error('Unknown option: '+key);
}
if(!options.out||(!options.export&&!options.url))throw Error('Usage: node pokemon-native-motion.mjs --export <standalone-folder> --port <private-port> --out <evidence-folder> [--canonical <reloaded.json>] [--walk-map <id> --walk-x <n> --walk-y <n>] [--opening-only]\nOr use --url <existing-private-player/base-URL> instead of --export/--port.');
const output=path.resolve(options.out),repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
await fs.mkdir(output,{recursive:true});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
let server,browser,activePage;
const report={scope:'Actual compiled standalone player and original project/assets. Isolated browser storage. HTML injects only the existing qaInstrumentation boot capability; no JS/CSS/project replacement. Opening uses native keys and real media playback. Walking preparation is separately recorded.',checks:[],pages:[],errors:[],requestsFailed:[],warnings:[]};
const check=(name,passed,details)=>{report.checks.push({name,pass:Boolean(passed),...(details===undefined?{}:{details})});assert(passed,name+': '+JSON.stringify(details));};
const savePng=async(name,data)=>{const bytes=Buffer.from(data.slice(data.indexOf(',')+1),'base64');await fs.writeFile(path.join(output,name),bytes);return {file:name,sha256:sha(bytes),bytes:bytes.length};};
const safeCloseServer=()=>new Promise(resolve=>{if(server)server.close(resolve);else resolve();});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.ogg':'audio/ogg','.wav':'audio/wav','.mp3':'audio/mpeg','.webm':'video/webm','.wasm':'application/wasm','.svg':'image/svg+xml'};

try {
  let playerUrl;
  if(options.url){
    const base=new URL(options.url);if(!['http:','https:'].includes(base.protocol))throw Error('Use an HTTP standalone player URL');
    playerUrl=base.pathname.endsWith('/player.html')?base:new URL('player.html',base.href.endsWith('/')?base.href:base.href+'/');
  }else{
    const folder=await fs.realpath(path.resolve(options.export)),port=Number(options.port);
    if(!Number.isSafeInteger(port)||port<1024||port>65535)throw Error('--port must be an explicit private port1024..65535');
    await fs.access(path.join(folder,'player.html'));await fs.access(path.join(folder,'project.json'));
    server=http.createServer(async(req,res)=>{
      try{
        if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
        const requested=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
        if(requested==='/favicon.ico'){res.writeHead(204);res.end();return;}
        const file=path.resolve(folder,'.'+requested);
        if(!file.startsWith(folder+path.sep)){res.writeHead(403);res.end();return;}
        const bytes=await fs.readFile(file);
        res.writeHead(200,{'Content-Type':mime[path.extname(file)]??'application/octet-stream','Cache-Control':'no-store'});
        res.end(req.method==='HEAD'?undefined:bytes);
      }catch{res.writeHead(404);res.end();}
    });
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
    report.privateServer={folder,port,ownership:'Created only for this probe; occupied ports fail rather than reusing or stopping another server.'};
    playerUrl=new URL(`http://127.0.0.1:${port}/player.html`);
  }
  report.url=playerUrl.href;
  const projectUrl=new URL('project.json',playerUrl),projectResponse=await fetch(projectUrl);
  assert(projectResponse.ok,'Standalone project.json must load');
  const projectBytes=Buffer.from(await projectResponse.arrayBuffer()),project=JSON.parse(projectBytes.toString());
  report.projectSha256=sha(projectBytes);
  const htmlResponse=await fetch(playerUrl),originalHtml=await htmlResponse.text();assert(htmlResponse.ok,'player.html must load');
  report.htmlSha256=sha(originalHtml);
  const jsMatch=originalHtml.match(/<script[^>]+src=["']([^"']+)["']/u);
  assert(jsMatch,'Standalone module script missing');
  const jsUrl=new URL(jsMatch[1],playerUrl),jsResponse=await fetch(jsUrl);assert(jsResponse.ok,'Standalone module must load');
  const jsBytes=Buffer.from(await jsResponse.arrayBuffer());report.playerJs={url:jsUrl.href,sha256:sha(jsBytes),bytes:jsBytes.length};
  const book=project.meta?.oprnOpeningBook,sequence=project.system?.opening,motion=book?.portraitMotion;
  check('authored confirm opening and actual pose strip exist',book?.version===1&&sequence?.enabled&&sequence.scenes.length===8&&sequence.scenes.every((s,i)=>s.id===book.sceneIds[i]&&s.kind==='image'&&s.durationMs===0)&&motion?.resourceId&&motion.frameCount>=4);
  report.authoredMotion=motion;report.voiceAuthoredPages=sequence.scenes.filter(s=>s.narrationAudioResourceId).map(s=>({id:s.id,resourceId:s.narrationAudioResourceId}));
  if(!report.voiceAuthoredPages.length)report.warnings.push('No narration voice is authored. Real BGM continuity is checked; continuous voice across pages is not claimed.');
  if(options.canonical){
    const canonicalBytes=await fs.readFile(path.resolve(options.canonical)),canonical=JSON.parse(canonicalBytes.toString());
    report.canonical={path:path.resolve(options.canonical),sha256:sha(canonicalBytes),scope:'Read-only comparison with supplied previously reloaded snapshot; not a new SQLite load/save proof.'};
    check('supplied canonical snapshot preserves exact motion metadata',JSON.stringify(canonical.meta.oprnOpeningBook)===JSON.stringify(book));
  }
  browser=await chromium.launch({args:['--no-sandbox','--use-gl=swiftshader']});
  const watch=async(context,label)=>{
    const page=await context.newPage();
    activePage=page;
    page.on('pageerror',error=>report.errors.push({label,error:String(error)}));
    page.on('response',response=>{if(response.status()>=400&&!response.url().endsWith('/favicon.ico'))report.errors.push({label,http:response.status(),url:response.url()});});
    page.on('requestfailed',request=>report.requestsFailed.push({label,url:request.url(),reason:request.failure()?.errorText}));
    await page.addInitScript(()=>{
      const ids=new WeakMap();let serial=0;const events=[];
      const id=audio=>{if(!ids.has(audio))ids.set(audio,++serial);return ids.get(audio)};
      for(const type of ['play','pause','ended','loadedmetadata'])document.addEventListener(type,e=>{if(e.target instanceof HTMLMediaElement){const a=e.target;events.push({event:type,id:id(a),testid:a.dataset.testid??null,src:a.currentSrc||a.src,time:a.currentTime,at:performance.now()})}},true);
      window.__pokemonMotionAudio={id,events};
    });
    await page.route('**/player.html*',async route=>{
      const response=await route.fetch(),html=await response.text();
      const modified=html.replace(/(<script\b[^>]*>[\s\S]*?window\.__OPENRPG_BOOT__[\s\S]*?)(<\/script>)/u,'$1;window.__OPENRPG_BOOT__.qaInstrumentation=true;$2');
      if(modified===html)throw Error('Explicit export boot object missing; cannot install QA capability');
      await route.fulfill({response,body:modified});
    });
    return page;
  };
  const newGame=async page=>{
    await page.goto(playerUrl.href);
    await page.getByTestId('title-screen').waitFor({timeout:90000});
    await page.waitForFunction(()=>document.querySelector('[data-testid="title-screen"]')?.dataset.seqState==='done',undefined,{timeout:30000});
    await page.getByTestId('title-new-game').focus();await page.keyboard.press('Enter');
    await page.getByTestId('cinematic-sequence').waitFor({timeout:30000});
    await page.waitForFunction(()=>document.querySelector('[data-testid="cinematic-sequence"]')?.dataset.portraitMotion==='ready',undefined,{timeout:30000});
  };
  const mediaState=page=>page.evaluate(()=>{
    const music=document.querySelector('[data-testid="cinematic-music"]'),a=window.__pokemonMotionAudio;
    return {music:music?{id:a.id(music),src:music.currentSrc||music.src,time:music.currentTime,duration:Number.isFinite(music.duration)?music.duration:null,paused:music.paused,playEvents:a.events.filter(e=>e.id===a.id(music)&&e.event==='play').length,pauseEvents:a.events.filter(e=>e.id===a.id(music)&&e.event==='pause').length}:null,voices:[...document.querySelectorAll('.cinematic-sequence audio')].map(v=>({id:a.id(v),src:v.currentSrc||v.src,time:v.currentTime,paused:v.paused,playEvents:a.events.filter(e=>e.id===a.id(v)&&e.event==='play').length}))};
  });
  const context=await browser.newContext({viewport:{width:960,height:720}}),page=await watch(context,'normal');
  await newGame(page);
  await page.waitForFunction(()=>{const a=document.querySelector('[data-testid="cinematic-music"]');return a&&!a.paused&&a.currentTime>.05},undefined,{timeout:30000});
  const music=await page.getByTestId('cinematic-music').elementHandle(),portrait=await page.getByTestId('opening-portrait-motion').elementHandle(),poster=await page.locator('img.cinematic-image').elementHandle();
  const initialMedia=await mediaState(page),firstFrame=await portrait.evaluate(c=>({width:c.width,height:c.height,data:{...c.dataset},animation:getComputedStyle(c).animationName}));
  check('real decoded canvas has native authored dimensions and stationary pose',firstFrame.width===motion.frameWidth&&firstFrame.height===motion.frameHeight&&firstFrame.animation==='none');
  report.initial=firstFrame;
  await portrait.evaluate(canvas=>{
    if(!canvas.captureStream||!window.MediaRecorder)return;
    const stream=canvas.captureStream(12),mime=MediaRecorder.isTypeSupported('video/webm;codecs=vp8')?'video/webm;codecs=vp8':'video/webm',recorder=new MediaRecorder(stream,{mimeType:mime}),chunks=[];
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};recorder.start();window.__pokemonMotionClip={recorder,chunks,stream,mime};
  });
  const unique=new Map();let previousClock=-1,previousMusic=initialMedia.music;
  for(const [index,scene] of sequence.scenes.entries()){
    await page.waitForFunction(id=>document.querySelector('[data-testid="cinematic-sequence"]')?.dataset.sceneId===id,scene.id,{timeout:15000});
    const order=motion.sceneFrames?.[scene.id]??motion.frames,sampleMs=Math.min(6000,Math.max(1000,order.length/motion.fps*1000+200));
    const until=Date.now()+sampleMs,samples=[];
    while(Date.now()<until){
      const shot=await portrait.evaluate(c=>({data:{...c.dataset},png:c.toDataURL()}));const hash=sha(shot.png);
      samples.push({frame:Number(shot.data.frame),phase:Number(shot.data.phase),clockMs:Number(shot.data.clockMs),pixelSha256:hash});
      if(!unique.has(hash)){const evidence=await savePng(`opening-pose-${shot.data.frame}-${unique.size}.png`,shot.png);unique.set(hash,evidence)}
      await page.waitForTimeout(75);
    }
    const state=await page.getByTestId('cinematic-sequence').evaluate(root=>({id:root.dataset.sceneId,narration:root.querySelector('.cinematic-narration')?.textContent,root:{...root.dataset},images:[...root.querySelectorAll('img')].map(i=>({width:i.naturalWidth,height:i.naturalHeight,complete:i.complete})),bounds:{width:root.clientWidth,height:root.clientHeight}}));
    state.media=await mediaState(page);state.samples=samples;
    state.identity=await page.evaluate(({music,portrait,poster})=>({music:music===document.querySelector('[data-testid="cinematic-music"]'),portrait:portrait===document.querySelector('[data-testid="opening-portrait-motion"]'),poster:poster===document.querySelector('img.cinematic-image')}),{music,portrait,poster});
    const clock=samples.at(-1)?.clockMs;
    const nowMusic=state.media.music,playheadContinues=nowMusic.time>=previousMusic.time||(previousMusic.duration&&previousMusic.time>previousMusic.duration-6.5&&nowMusic.time<6.5);
    check('page '+(index+1)+' retains drawn controller, music track and progressing clock',Object.values(state.identity).every(Boolean)&&clock>previousClock&&nowMusic.id===initialMedia.music.id&&nowMusic.src===initialMedia.music.src&&!nowMusic.paused&&nowMusic.playEvents===initialMedia.music.playEvents&&nowMusic.pauseEvents===initialMedia.music.pauseEvents&&playheadContinues&&state.narration===scene.narration&&state.images.every(i=>i.complete&&i.width&&i.height));
    previousMusic=nowMusic;
    previousClock=clock;report.pages.push(state);
    await page.screenshot({path:path.join(output,`opening-page-${index+1}.png`)});
    if(index===0){
      const before=await mediaState(page);for(const key of ['w','a','s','d'])await page.keyboard.press(key);await page.waitForTimeout(350);const after=await mediaState(page);
      check('WASD leaves page, BGM play event identity and current voice intact',await page.getByTestId('cinematic-sequence').getAttribute('data-scene-id')===scene.id&&before.music.id===after.music.id&&before.music.playEvents===after.music.playEvents&&before.music.pauseEvents===after.music.pauseEvents&&before.voices.length===after.voices.length&&before.voices.every((voice,i)=>after.voices[i].id===voice.id&&after.voices[i].time>=voice.time-.025&&after.voices[i].playEvents===voice.playEvents));
      report.wasd={before,after};
    }
    if(index===sequence.scenes.length-1){
      const clip=await page.evaluate(async()=>{
        const clip=window.__pokemonMotionClip;if(!clip)return null;
        await new Promise(resolve=>{clip.recorder.onstop=resolve;clip.recorder.stop()});clip.stream.getTracks().forEach(t=>t.stop());
        const bytes=new Uint8Array(await new Blob(clip.chunks,{type:clip.mime}).arrayBuffer());let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);return {base64:btoa(binary),mime:clip.mime};
      });
      if(clip){const bytes=Buffer.from(clip.base64,'base64');await fs.writeFile(path.join(output,'opening-native-poses.webm'),bytes);report.clip={file:'opening-native-poses.webm',bytes:bytes.length,sha256:sha(bytes),mime:clip.mime,scope:'Silent capture of the actual native-resolution drawn-pose canvas; audio is observed separately.'};}
      else report.warnings.push('Canvas video recorder unavailable; actual native PNG samples retained.');
    }
    if(index===1){
      await page.keyboard.down('Enter');await page.waitForTimeout(120);const beforeRepeat=await mediaState(page);await page.keyboard.down('Enter');await page.waitForTimeout(120);await page.keyboard.up('Enter');const afterRepeat=await mediaState(page);
      check('held Enter repeat advances exactly one page',await page.getByTestId('cinematic-sequence').getAttribute('data-scene-id')===sequence.scenes[index+1].id);
      check('held Enter repeat does not restart BGM or current voice',beforeRepeat.music.id===afterRepeat.music.id&&beforeRepeat.music.playEvents===afterRepeat.music.playEvents&&beforeRepeat.music.pauseEvents===afterRepeat.music.pauseEvents&&beforeRepeat.voices.length===afterRepeat.voices.length&&beforeRepeat.voices.every((voice,i)=>afterRepeat.voices[i].id===voice.id&&afterRepeat.voices[i].time>=voice.time-.025&&afterRepeat.voices[i].playEvents===voice.playEvents));
      report.heldEnter={beforeRepeat,afterRepeat};
    }else await page.keyboard.press('Enter');
  }
  report.poseEvidence=[...unique.values()];check('at least four distinct actual drawn pose pixel frames',unique.size>=4,{distinct:unique.size});
  check('actual drawn-pose canvas clip is recorded',report.clip?.bytes>0,{clip:report.clip??null});
  await page.getByTestId('cinematic-sequence').waitFor({state:'detached',timeout:30000});
  await page.waitForFunction(()=>window.__oprnHooksScene?.session?.currentMapId,undefined,{timeout:90000});
  const disposedClock=await portrait.evaluate(c=>c.dataset.clockMs);await page.waitForTimeout(250);
  check('completion cleans canvas and BGM; detached pose clock stops',await page.getByTestId('opening-portrait-motion').count()===0&&await page.getByTestId('cinematic-music').count()===0&&await portrait.evaluate(c=>!c.isConnected&&c.dataset.clockMs)===disposedClock);
  report.field=await page.evaluate(()=>({state:window.__oprnDebug.readLive(),camera:window.__oprnCamera?.(),sprite:window.__oprnPlayerSprite?.()}));
  check('New Game reaches authored start map',report.field.state.currentMapId===project.startMapId);
  await page.screenshot({path:path.join(output,'first-field.png')});

  if(!options.openingOnly){
    for(let i=0;i<30&&await page.getByTestId('dialogue-box').count();i++){await page.keyboard.press('Enter');await page.waitForTimeout(150)}
    check('native startup dialogue clears before walking',await page.getByTestId('dialogue-box').count()===0);
    const collisionEntry=path.join(output,'collision-entry.ts');await fs.writeFile(collisionEntry,`export {canMove,isPassable} from ${JSON.stringify(path.join(repo,'src/project/collision.ts'))};`);
    await build({entryPoints:[collisionEntry],outfile:path.join(output,'collision.cjs'),bundle:true,platform:'node',format:'cjs',tsconfig:path.join(repo,'tsconfig.app.json'),logLevel:'silent'});
    const collision=createRequire(import.meta.url)(path.join(output,'collision.cjs'));
    const mapId=options['walk-map']??project.startMapId,map=project.maps[mapId];assert(map,'Unknown walking map');
    const directions=[['up',0,-1],['right',1,0],['down',0,1],['left',-1,0]];
    const safeRoute=(x,y,dx,dy)=>{
      if(!collision.isPassable(project,map,x,y))return false;
      for(let step=1;step<=3;step++){
        const nx=x+dx*step,ny=y+dy*step;
        if(!collision.canMove(project,map,nx-dx,ny-dy,nx,ny)||map.events.some(e=>Math.abs(e.x-nx)<=1&&Math.abs(e.y-ny)<=1))return false;
      }
      return !map.events.some(e=>Math.abs(e.x-x)<=1&&Math.abs(e.y-y)<=1);
    };
    const plannedRoutes=directions.map(([direction,dx,dy])=>{
      let anchor;
      if(options['walk-x']!==undefined||options['walk-y']!==undefined){anchor={x:Number(options['walk-x']),y:Number(options['walk-y'])};assert(Number.isSafeInteger(anchor.x)&&Number.isSafeInteger(anchor.y)&&safeRoute(anchor.x,anchor.y,dx,dy),'Requested walk anchor lacks a safe '+direction+' three-tile route');}
      else{
        const candidates=[];for(let y=1;y<map.height-1;y++)for(let x=1;x<map.width-1;x++)if(safeRoute(x,y,dx,dy))candidates.push({x,y});
        candidates.sort((a,b)=>Math.abs(a.x-map.width/2)+Math.abs(a.y-map.height/2)-Math.abs(b.x-map.width/2)-Math.abs(b.y-map.height/2));anchor=candidates[0];assert(anchor,'No event-free '+direction+' walking lane; supply an explicit suitable map/anchor');
      }
      return {direction,dx,dy,anchor};
    });
    report.walking={preparation:'After genuine native New Game/Enter opening and startup dialogue, private browser QA telemetry boot permits teleport to original authored map corridors. Each direction may use its own original event-free three-tile lane, listed in plannedRoutes. Direction is injected into the actual Input, and the existing Phaser QA frame controller advances normal engine updates at17ms. No map, collisions, walk speed, moveDurationMs, walkFrame, walkTimer, sprite selection, inventory, story flags or persisted save is patched. This isolates gait rendering; it is not a natural route/campaign-completion claim.',mapId,plannedRoutes,directions:[]};
    for(const {direction,dx,dy,anchor} of plannedRoutes){
      await page.evaluate(({mapId,anchor})=>{window.__oprnInput.dir(null);window.__oprnDebug.teleport(mapId,anchor.x,anchor.y)}, {mapId,anchor});
      await page.waitForTimeout(200);
      const run=await page.evaluate(({direction,dx,dy,anchor})=>{
        const s=window.__oprnHooksScene,frames=window.__oprnQaFrames,input=window.__oprnInput;
        if(!frames||!input||!s.player)throw Error('Compiled player lacks explicit QA sprite/frame hooks');
        const samples=[],poses={},poseGeometry={};frames.pause();input.dir(direction);
        try{
          for(let i=0;i<120;i++){
            frames.step({frames:1,deltaMs:17});const state=window.__oprnPlayerSprite(),f=s.player.frame;
            const name=Number(state.frame),phase=name%3,row=Math.floor(name/12)%4;
            samples.push({engineFrame:s.game.loop.frame,frame:name,phase,row,moving:s.moving,x:s.player.x,y:s.player.y,tileX:s.tileX,tileY:s.tileY,walkFrame:s.walkFrame,walkTimer:s.walkTimer});
            if(s.moving&&!poses[phase]){
              const c=document.createElement('canvas');c.width=f.cutWidth;c.height=f.cutHeight;const ctx=c.getContext('2d');ctx.drawImage(s.player.texture.getSourceImage(),f.cutX,f.cutY,f.cutWidth,f.cutHeight,0,0,c.width,c.height);poses[phase]=c.toDataURL();
              const pixels=ctx.getImageData(0,0,c.width,c.height).data;let minX=c.width,minY=c.height,maxX=-1,maxY=-1;
              for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(pixels[(y*c.width+x)*4+3]){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y)}
              poseGeometry[phase]={frame:f.name,width:c.width,height:c.height,opaqueBounds:maxX<0?null:{x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1},displayWidth:s.player.displayWidth,displayHeight:s.player.displayHeight,scaleX:s.player.scaleX,scaleY:s.player.scaleY};
            }
            if(!s.moving&&s.tileX===anchor.x+dx*3&&s.tileY===anchor.y+dy*3)break;
          }
          input.dir(null);frames.step({frames:2,deltaMs:17});
          return {samples,poses,poseGeometry,idle:window.__oprnPlayerSprite(),facing:s.facing,camera:window.__oprnCamera(),moveDurationMs:s.moveDurationMs,tile:{x:s.tileX,y:s.tileY}};
        }finally{input.dir(null);frames.resume()}
      },{direction,dx,dy,anchor});
      const moving=run.samples.filter(s=>s.moving),sequencePhases=[];for(const s of moving)if(sequencePhases.at(-1)!==s.phase)sequencePhases.push(s.phase);
      const pattern=sequencePhases.join(','),row=directions.findIndex(([d])=>d===direction);
      check('walking '+direction+' uses actual0/1/2/1 gait and idle1',run.tile.x===anchor.x+dx*3&&run.tile.y===anchor.y+dy*3&&pattern.includes('0,1,2,1')&&moving.every(s=>s.row===row)&&Number(run.idle.frame)%3===1&&!run.idle.moving&&run.facing===direction,{phases:sequencePhases,tile:run.tile,idle:run.idle});
      const poseHashes=new Set(Object.values(run.poses).map(sha));check('walking '+direction+' displays three distinct drawn native poses',poseHashes.size===3);
      const expectedZoom=project.system.cameraZoom??1;check('walking '+direction+' preserves authored camera zoom',run.camera.zoom===expectedZoom);
      run.poseEvidence=[];for(const [phase,png] of Object.entries(run.poses))run.poseEvidence.push(await savePng(`walking-${direction}-phase-${phase}.png`,png));delete run.poses;
      report.walking.directions.push({direction,anchor,phases:sequencePhases,...run});
      await page.screenshot({path:path.join(output,`walking-${direction}-idle.png`)});
    }
  }else report.walking={skipped:true,reason:'Explicit --opening-only'};

  const reducedContext=await browser.newContext({viewport:{width:960,height:720},reducedMotion:'reduce'}),reducedPage=await watch(reducedContext,'reduced');
  await newGame(reducedPage);
  const reducedPortrait=await reducedPage.getByTestId('opening-portrait-motion').elementHandle(),before=await reducedPortrait.evaluate(c=>({png:c.toDataURL(),data:{...c.dataset}}));
  await reducedPage.waitForTimeout(1100);for(const key of ['w','a','s','d'])await reducedPage.keyboard.press(key);await reducedPage.keyboard.press('Enter');
  const after=await reducedPortrait.evaluate(c=>({png:c.toDataURL(),data:{...c.dataset},same:c===document.querySelector('[data-testid="opening-portrait-motion"]')}));
  check('OS reduced motion freezes native neutral pose across Enter',before.png===after.png&&before.data.frame==='0'&&after.data.frame==='0'&&after.data.paused==='reduced-motion'&&after.data.clockMs===before.data.clockMs&&after.same);
  report.reduced={before:{...before.data,pixelSha256:sha(before.png)},after:{...after.data,pixelSha256:sha(after.png)}};
  await reducedPage.screenshot({path:path.join(output,'opening-reduced-motion.png')});await reducedPage.keyboard.press('Escape');
  await reducedPage.getByTestId('cinematic-sequence').waitFor({state:'detached',timeout:30000});
  check('native Skip disposes reduced pose and opening music',await reducedPage.getByTestId('opening-portrait-motion').count()===0&&await reducedPage.getByTestId('cinematic-music').count()===0);
  report.audioEvents=await page.evaluate(()=>window.__pokemonMotionAudio.events);
  check('native browser and resource errors absent',report.errors.length===0,{errors:report.errors,requestsFailed:report.requestsFailed});
  report.completed=true;
}catch(error){report.failure=String(error);process.exitCode=1;console.error(String(error));if(activePage){await activePage.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});report.failureState=await activePage.evaluate(()=>({scene:document.querySelector('[data-testid="cinematic-sequence"]')?.dataset,sprite:window.__oprnPlayerSprite?.(),state:window.__oprnDebug?.readLive?.(),text:document.body.innerText})).catch(()=>null);}}
finally{
  if(browser)await browser.close();await safeCloseServer();
  await fs.writeFile(path.join(output,'record.json'),JSON.stringify(report,null,2));
  await fs.writeFile(path.join(output,'SUMMARY.md'),`# Pokémon native motion QA\n\nCompleted: ${report.completed===true}. Checks: ${report.checks.length}. Pages: ${report.pages.length}/8. Errors: ${report.errors.length}.\n\n${report.failure?`Failure: ${report.failure}\n\n`:''}Inspect first: opening-page-3.png, opening-native-poses.webm, walking-down-idle.png, opening-reduced-motion.png.\n\n${report.scope}\n\n${report.walking?.preparation??report.walking?.reason??'Walking not reached.'}\n\n${report.warnings.join('\n')}\n\n${report.checks.map(c=>`- ${c.pass?'PASS':'FAIL'} ${c.name}`).join('\n')}\n`);
}
console.log(JSON.stringify({completed:report.completed===true,checks:report.checks.length,pages:report.pages.length,errors:report.errors.length,output,failure:report.failure??null}));
