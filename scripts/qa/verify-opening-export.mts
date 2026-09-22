// Build real game ZIPs, then serve ONLY their contents under a subdirectory.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {extname,resolve} from 'node:path';
import {chromium} from '@playwright/test';
import {createServer as createViteServer} from 'vite';
import {readStoredZipEntry,readStoredZipEntryNames} from '../../src/project/packageZip';
const out='verify-shots/opening-examples';
const packages=new Map<string,Map<string,Uint8Array>>();
const requests:string[]=[];
// Explicitly exercise the editor's CDN -> local exported filename conversion.
process.env.VITE_STILL_CDN_BASE='https://fixture-cdn.invalid';
// Resolve import.meta.env through Vite, as in the editor. Plain tsx imports do
// not expose VITE_* and silently test only the local fallback path.
const vite=await createViteServer({configFile:false,cacheDir:'.vite-cache/opening-export-qa',server:{watch:null},resolve:{alias:{'@':resolve('src')}}});
let deserialize:typeof import('../../src/project/io').deserialize;
let createWebPlayerExportPackage:typeof import('../../src/project/webExport').createWebPlayerExportPackage;
try{
 ({deserialize}=await vite.ssrLoadModule('/src/project/io.ts'));
 ({createWebPlayerExportPackage}=await vite.ssrLoadModule('/src/project/webExport.ts'));
}finally{await vite.close();}
for(const theme of ['winter','ocean']){
 const p=deserialize(await readFile(out+'/'+theme+'.json','utf8'));
 const {blob,summary}=await createWebPlayerExportPackage(p,{fetchBytes:async url=>{
  requests.push(url);
  if(url.startsWith('https://fixture-cdn.invalid/stills/v1/'))return new Uint8Array(await readFile('public/assets/stills/pack/'+url.split('/').at(-1)));
  return new Uint8Array(await readFile(url.startsWith('/export-player/')?'dist'+url:'public'+url));
 }});
 const bytes=new Uint8Array(await blob.arrayBuffer());await writeFile(out+'/'+theme+'-web.zip',bytes);
 const names=readStoredZipEntryNames(bytes);
 const entries=new Map(names.map(name=>[name,readStoredZipEntry(bytes,name)!]));
 for(let i=1;i<=4;i++)assert.ok(entries.has('assets/stills/pack/'+theme+'-0'+i+'.jpg'));
 assert.ok(entries.has('assets/ATTRIBUTION.md'));
 assert.equal(names.filter(n=>n.startsWith('assets/stills/pack/')).length,4,'Only referenced pack images should be shipped');
 packages.set(theme,entries);console.log('ZIP_OK',theme,summary.zipEntryCount,bytes.length);
}
assert.ok(requests.some(url=>url.startsWith('https://fixture-cdn.invalid/')));
const mime:Record<string,string>={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.mp3':'audio/mpeg','.ogg':'audio/ogg','.woff2':'font/woff2','.md':'text/plain'};
const server=createServer((req,res)=>{
 const match=/^\/games\/(winter|ocean)\/(.+)$/.exec(new URL(req.url!,'http://localhost').pathname);
 const bytes=match&&packages.get(match[1])?.get(decodeURIComponent(match[2]));
 if(!bytes){res.writeHead(404);res.end('not in exported ZIP');return;}
 res.writeHead(200,{'Content-Type':mime[extname(match![2])]??'application/octet-stream'});res.end(bytes);
});
await new Promise<void>(ok=>server.listen(0,'127.0.0.1',ok));
const port=(server.address() as {port:number}).port;
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=swiftshader','--autoplay-policy=no-user-gesture-required']});
const results=[];
try{
 for(const theme of ['winter','ocean']){
  const page=await browser.newPage({viewport:{width:960,height:540}});
  const errors:string[]=[],badAssets:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400 && r.url().includes('/assets/'))badAssets.push(r.url());});
  await page.route('https://fixture-cdn.invalid/**',r=>r.abort());
  await page.goto('http://127.0.0.1:'+port+'/games/'+theme+'/player.html');
  await page.getByTestId('title-screen').waitFor({timeout:60000}).catch(async error=>{await page.screenshot({path:out+'/'+theme+'-export-failure.png'});console.error('EXPORT_BOOT_FAILED',JSON.stringify({errors,badAssets,text:await page.locator('body').innerText()}));throw error;});
  await page.getByTestId('title-license-notice').click();
  await page.locator('dialog.rm-license-dialog').waitFor();
  assert.match(await page.locator('.rm-license-dialog-body').innerText(),/Opening still release pack v1/);
  await page.screenshot({path:out+'/'+theme+'-export-license.png'});
  await page.keyboard.press('Escape');
  await page.locator('dialog.rm-license-dialog').waitFor({state:'detached'});
  assert.ok(await page.getByTestId('title-screen').isVisible(),'Escape must not fall through to game');
  await page.keyboard.press('Enter');
  await page.getByTestId('cinematic-sequence').waitFor();
  const seen=new Set<string>();
  const deadline=Date.now()+25000;
  while(Date.now()<deadline){const overlay=page.getByTestId('cinematic-sequence');if(!await overlay.count())break;seen.add((await overlay.getAttribute('data-scene-id'))!);await page.waitForTimeout(100);}
  assert.equal(seen.size,5);assert.equal(await page.getByTestId('cinematic-sequence').count(),0);
  assert.deepEqual(errors,[]);assert.deepEqual(badAssets,[]);
  results.push({theme,subdirectory:true,zipOnly:true,scenes:[...seen],errors,badAssets});
  await page.close();console.log('EXPORTED_PLAYBACK_OK',theme);
 }
 await writeFile(out+'/export-proof.json',JSON.stringify({cdnSourceFetched:true,results},null,2)+'\n');
}finally{await browser.close();await new Promise<void>(ok=>server.close(()=>ok()));}
