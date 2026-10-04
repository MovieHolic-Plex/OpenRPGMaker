import {mkdir,cp,readFile,writeFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {withTsModule} from '../ontology-ts-loader.mjs';
import {createHash} from 'node:crypto';
const out=resolve(process.argv[2]??'/home/main/claude-viz/monster-expedition');
await mkdir(out,{recursive:true});
await cp(resolve(process.argv[5] ?? 'dist/export-player'),out,{recursive:true});
// An optional freshly reloaded canonical document owns the shipped content. The
// existing portable asset bytes are a cache, verified against every host asset SHA.
const canonicalPath = process.argv[3];
if (canonicalPath) {
 const canonical = JSON.parse(await readFile(canonicalPath,'utf8'));
 const portable = JSON.parse(await readFile(process.argv[4] ?? 'public/monster-expedition/project.json','utf8'));
 // Ship the transitive tileset dependencies of the actual campaign, rather
 // than every editor catalog. This changes only the export, never SQLite.
 const referenced = new Set();
 const walk = value => { if(typeof value==='string') referenced.add(value); else if(Array.isArray(value)) value.forEach(walk); else if(value&&typeof value==='object') for(const [key,child] of Object.entries(value)) if(key!=='uploaded'&&key!=='tilesets') walk(child); };
 walk(canonical);
 const retained = new Set(); let progressed=true;
 while(progressed) { progressed=false;for(const [id,tileset] of Object.entries(canonical.tilesets)) if(referenced.has(id)&&!retained.has(id)){retained.add(id);walk(tileset);progressed=true;} }
 for(const id of Object.keys(canonical.tilesets)) if(!retained.has(id)) delete canonical.tilesets[id];
 const used = await withTsModule(resolve('src/project/webExportAssets.ts'),'campaign-used-resources.mjs',m=>[...m.collectUsedUploadedAssetIds(canonical)]);
 const usedIds=new Set(used);for(const id of Object.keys(canonical.assets.uploaded)) if(!usedIds.has(id)) delete canonical.assets.uploaded[id];
 for (const [id, asset] of Object.entries(canonical.assets.uploaded)) {
  if (!asset.ref) continue;
  const dataUrl = portable.assets.uploaded[id]?.dataUrl;
  const match = /^data:([^;,]+);base64,(.+)$/.exec(dataUrl ?? '');
  if (!match || createHash('sha256').update(Buffer.from(match[2],'base64')).digest('hex') !== asset.ref.sha256) {
   throw Error('Portable bytes do not match canonical asset: '+id);
  }
  delete asset.ref; asset.dataUrl = dataUrl;
 }
 // Editing references are retained in SQLite and are not shipping game assets.
 for (const tileset of Object.values(canonical.tilesets)) delete tileset.referenceDocuments;
 await writeFile(resolve(out,'project.json'),JSON.stringify(canonical));
} else await cp('public/monster-expedition/project.json',resolve(out,'project.json'));
await cp('public/monster-expedition/world-manifest.json',resolve(out,'world-manifest.json'));
const assets=JSON.parse(await readFile('public/monster-expedition/public-assets.json','utf8'));
for(const asset of assets) {
  if (/^https?:/.test(asset.sourcePath)) throw Error('Campaign export unexpectedly depends on a remote asset: '+asset.sourcePath);
  const target=resolve(out,asset.zipPath);
  await mkdir(resolve(target,'..'),{recursive:true});
  await cp(resolve('public',asset.sourcePath),target);
}
// Authored animatic cues may select a real library sound beyond the original
// campaign manifest. Export those exact local files alongside the player.
const shipping = JSON.parse(await readFile(resolve(out,'project.json'),'utf8'));
const needed = new Set();
for (const scene of shipping.system.opening?.scenes ?? []) {
 if(scene.kind === 'animatic') { for(const l of scene.composition.layers) if(l.resourceId) needed.add(l.resourceId); for(const c of scene.composition.audioCues ?? []) needed.add(c.resourceId); }
 else if(scene.resourceId) needed.add(scene.resourceId);
 if(scene.narrationAudioResourceId) needed.add(scene.narrationAudioResourceId);
}
if(shipping.system.opening?.musicResourceId) needed.add(shipping.system.opening.musicResourceId);
// System/menu authoring can select library audio outside the original manifest.
for(const id of [shipping.system.titleScreen?.musicResourceId,shipping.system.defaultBgmResourceId,
 shipping.system.battleBgmResourceId,shipping.system.battleVictoryMeResourceId,shipping.system.battleDefeatSeResourceId,
 ...Object.values(shipping.system.titleScreen?.sounds??{}),...Object.values(shipping.meta.oprnMenuSounds??{})]) if(id) needed.add(id);
for(const map of Object.values(shipping.maps)) if(map.bgm?.mode==='custom'&&map.bgm.resourceId) needed.add(map.bgm.resourceId);
const libraryIds=[...needed].filter(id=>!shipping.assets.uploaded[id]);
if(libraryIds.length) {
 const urls=await withTsModule(resolve('src/assets/generatedAssetResourceResolver.ts'),'opening-export-resolver.mjs',m=>libraryIds.map(id=>({id,url:m.resolveAssetResourceUrl(id,{project:shipping})})));
 for(const {id,url} of urls) {
  if(typeof url!=='string'||!url.startsWith('/assets/')) throw Error('Opening library resource is not a local exportable asset: '+id);
  const relative=url.slice(1),target=resolve(out,relative);if(!target.startsWith(out+sep))throw Error('Invalid export path');
  await mkdir(resolve(target,'..'),{recursive:true});
  let copied=false;for(const base of [resolve('public'),resolve(process.argv[5]??'dist/export-player','..','..','public')]) { const source=resolve(base,relative);if(!source.startsWith(base+sep))throw Error('Invalid source path');try{await cp(source,target);copied=true;break;}catch(e){if(e.code!=='ENOENT')throw e;} }
  if(!copied)throw Error('Missing opening library bytes: '+id);
 }
}
// Runtime assets with static public URLs must accompany the shipping player.
for(const directory of ['public/assets/generated/starter','public/assets/generated/battle-skins','public/assets/cc0/jetrel','public/generated']){
 try{await cp(directory,resolve(out,directory.replace(/^public\//,'')),{recursive:true});}catch(e){if(e.code!=='ENOENT')throw e;}
}
const html=await readFile(resolve(out,'player.html'),'utf8');
await writeFile(resolve(out,'player.html'),html.replace('<title>OPRN Player</title>','<title>별빛섬 몬스터 원정</title>').replace('<head>','<head><script>window.__OPENRPG_BOOT__={projectUrl:"./project.json",saveNamespace:"starlight-islands-v1"};</script>'));
await writeFile(resolve(out,'README.txt'),'별빛섬 몬스터 원정\nplayer.html을 HTTP 서버에서 열어 플레이하세요. 방향키 이동 / Z 또는 Enter 대화 / X 또는 Esc 메뉴. 첫 동료는 별싹 마을 북동쪽 연구소에서 선택합니다. Esc 메뉴의 도감·지도·배지에서 만난 동료와 현재 목표를 확인하세요. 저장/불러오기는 이 게임의 전용 네임스페이스를 씁니다.\n');
console.log(JSON.stringify({output:out,entry:out+'/player.html'}));
