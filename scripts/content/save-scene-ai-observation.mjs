// Save and reopen the multi-scene live AI output in a new, isolated canonical store.
import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {withTsModule} from '../ontology-ts-loader.mjs';
const [input,projectDir,out]=process.argv.slice(2);
if(!input||!projectDir||!out)throw Error('Usage: <result-project.json> <new-project-dir> <evidence-dir>');
if(fs.existsSync(path.join(projectDir,'project.sqlite')))throw Error('Requires a new project folder');
const project=JSON.parse(fs.readFileSync(input,'utf8')),submitted=structuredClone(project);
if(project.meta.title!=='학교·교실·실내·도시 · 실제 AI 구현 확인')throw Error('Unexpected observation project');
await withTsModule('electron/local-store/store.ts','scene-ai-save.mjs',async api=>{
 let store=await api.initLocalProjectStore({projectDir});
 try{
  for(const asset of Object.values(project.assets.uploaded)){
   const match=asset.dataUrl?.match(/^data:(image\/(?:png|webp|jpeg));base64,(.+)$/);if(!match)throw Error('Unresolved observation asset');
   asset.ref=await store.putAsset(Buffer.from(match[2],'base64'),{mime:match[1],extension:match[1].split('/')[1],originalName:asset.name,kind:asset.kind});delete asset.dataUrl;
  }
  const saved=await store.saveSerialized(JSON.stringify(project),store.loadSnapshot()?.sha256??null);if(saved.kind!=='saved')throw Error('Observation save rejected');
 }finally{store.close();}
 store=await api.openLocalProjectStore({projectDir});
 try{
  const snapshot=store.loadSnapshot();if(!snapshot)throw Error('Observation reload missing');
  const portable=structuredClone(snapshot.project);
  for(const asset of Object.values(portable.assets.uploaded)){
   const original=submitted.assets.uploaded[asset.id];if(!original?.dataUrl||!asset.ref)throw Error('Observation asset identity changed');
   asset.dataUrl=original.dataUrl.slice(0,original.dataUrl.indexOf(',')+1)+Buffer.from(await store.assetBytes(asset.ref.sha256)).toString('base64');delete asset.ref;
  }
  if(!isDeepStrictEqual(JSON.parse(JSON.stringify(portable)),submitted))throw Error('Observation reload changed');
  const proof={projectId:store.info().projectId,projectDir:path.resolve(projectDir),revision:snapshot.revision,sha256:snapshot.sha256,reopenedEqual:true,maps:Object.keys(snapshot.project.maps),assets:store.listAssets().length};
  fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'storage-proof.json'),JSON.stringify(proof,null,2));console.log(proof);
 }finally{store.close();}
});
