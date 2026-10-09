// Preserve a live assistant observation in its own new SQLite project. Never opens the user's school store.
import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {withTsModule} from '../ontology-ts-loader.mjs';
const [input,projectDir,out]=process.argv.slice(2);
if(!input||!projectDir||!out)throw Error('Usage: node save-school-ai-observation.mjs <result-project.json> <new-project-dir> <evidence-dir>');
const verifyExisting=process.argv.includes('--verify-existing');
if(fs.existsSync(path.join(projectDir,'project.sqlite'))&&!verifyExisting)throw Error('Observation requires a new project folder');
const project=JSON.parse(fs.readFileSync(input,'utf8'));
const submitted=structuredClone(project);
if(project.meta.title!=='학교 계단실 · 실제 AI 재현 확인'||Object.keys(project.maps).join()!=='school-ai-stairwell')throw Error('Unexpected observation project');
await withTsModule('electron/local-store/store.ts','school-ai-save.mjs',async api=>{
 let store;
 if(!verifyExisting){
 store=await api.initLocalProjectStore({projectDir});
 try{
  for(const asset of Object.values(project.assets.uploaded)){
   const match=asset.dataUrl?.match(/^data:(image\/(?:png|webp|jpeg));base64,(.+)$/);if(!match)throw Error('Unresolved observation asset');
   asset.ref=await store.putAsset(Buffer.from(match[2],'base64'),{mime:match[1],extension:match[1].split('/')[1],originalName:asset.name,kind:asset.kind});delete asset.dataUrl;
  }
  const saved=await store.saveSerialized(JSON.stringify(project),store.loadSnapshot()?.sha256??null);if(saved.kind!=='saved')throw Error('Observation save rejected');
 }finally{store.close();}
 }
 store=await api.openLocalProjectStore({projectDir});
 try{
  const snapshot=store.loadSnapshot();if(!snapshot)throw Error('Observation reload missing');
  const portable=structuredClone(snapshot.project);
  for(const asset of Object.values(portable.assets.uploaded)){
   const original=submitted.assets.uploaded[asset.id];if(!original?.dataUrl||!asset.ref)throw Error('Observation asset identity changed');
   const prefix=original.dataUrl.slice(0,original.dataUrl.indexOf(',')+1);
   asset.dataUrl=prefix+Buffer.from(await store.assetBytes(asset.ref.sha256)).toString('base64');delete asset.ref;
  }
  // The store may materialize optional undefined fields; compare the persisted JSON contract.
  if(!isDeepStrictEqual(JSON.parse(JSON.stringify(portable)),submitted))throw Error('Observation reload changed');
  const proof={projectId:store.info().projectId,projectDir:path.resolve(projectDir),revision:snapshot.revision,sha256:snapshot.sha256,reopenedEqual:true,maps:Object.keys(snapshot.project.maps),assets:store.listAssets().length};
  fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'storage-proof.json'),JSON.stringify(proof,null,2));console.log(proof);
 }finally{store.close();}
});
