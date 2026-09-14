import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const out='output/evidence/emerald-fields';
const saved=process.argv.includes('--saved');
const expected=JSON.parse(fs.readFileSync(`${out}/${saved?'reloaded':'preview'}-project.json`,'utf8'));
const ids=['map_field_twinfalls_20260913','map_field_fernwood_20260913','map_field_riverbend_20260913'];
const browser=await chromium.launch({args:['--no-sandbox','--use-gl=swiftshader','--disable-gpu']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const r=route.request();if(!['GET','HEAD','OPTIONS'].includes(r.method())&&/\/rest\/v1\/|\/rpc\//.test(r.url()))return route.abort();return route.continue();});
 await page.addInitScript(()=>{localStorage.setItem('oprn:ai-panel-collapsed','1');for(const k of ['oprn:editor-welcome-dismissed','oprn:standard-welcome-seen','oprn:coachmarks-basic-v1'])localStorage.setItem(k,'1');});
 await page.goto(`http://127.0.0.1:9809/?${saved?'project=rpg-zzu-house-template-gallery':'blankProject=1'}`,{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>window.__oprnEditorStore?.getCurrent()&&window.__oprnEditWorldToClient,null,{timeout:120000});
 const images=await page.evaluate(async({expected,ids,saved})=>{
  const store=window.__oprnEditorStore;
  if(!saved)store.replace(expected,{change:{label:'필드 미리보기',origin:'system',scope:'project'}});
  const project=store.getCurrent();
  const {drawMapTileLayers,loadTilesetImage}=await import('/src/editor/mapTileDraw.ts');
  const images=[];
  for(const id of ids){const map=project.maps[id];if(JSON.stringify(map)!==JSON.stringify(expected.maps[id]))throw Error(`Map mismatch ${id}`);
   const tileset=project.tilesets[map.tilesetId],source=await loadTilesetImage(tileset);const canvas=document.createElement('canvas');canvas.width=map.width*16;canvas.height=map.height*16;const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;drawMapTileLayers(ctx,source,map,tileset,1);images.push({id,image:canvas.toDataURL()});
  }
  const {editorState}=await import('/src/editor/editorState.ts');const {requestEditorCameraFocus}=await import('/src/editor/editorCameraFocus.ts');
  const focus=project.maps[ids[0]];editorState.set({currentMapId:ids[0],zoom:1.5});requestEditorCameraFocus({mapId:ids[0],tileX:focus.width/2,tileY:focus.height/2,bounds:{x:0,y:0,width:focus.width,height:focus.height}});
  return {images,remote:store.isRemotePersistenceEnabled()};
 },{expected,ids,saved});
 for(const item of images.images)fs.writeFileSync(`${out}/${item.id}.png`,Buffer.from(item.image.split(',')[1],'base64'));
 await page.screenshot({path:`${out}/editor-${saved?'saved':'preview'}.png`});
 if(saved)assert.equal(images.remote,true);
 fs.writeFileSync(`${out}/editor-${saved?'saved':'preview'}-proof.json`,JSON.stringify({saved,remote:images.remote,mapReadbacksMatch:true,errors},null,2));
 console.log(JSON.stringify({saved,mapReadbacksMatch:true,errors}));
}finally{await browser.close();}
