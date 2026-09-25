// Save model-authored output to a NEW isolated canonical project, with an explicit visual verdict.
import fs from 'node:fs/promises';
import path from 'node:path';
import {existsSync} from 'node:fs';
import {isDeepStrictEqual} from 'node:util';
import {withTsModule} from '../ontology-ts-loader.mjs';
const [run,projectDir,mode]=process.argv.slice(2);
if(!run||!projectDir||(mode!==undefined&&mode!=='--review'))throw Error('Usage: <run directory> <new project directory> [--review]');
if(existsSync(path.join(projectDir,'project.sqlite')))throw Error('Refusing to overwrite an existing canonical project');
const report=JSON.parse(await fs.readFile(run+'/report.json','utf8'));
const audit=JSON.parse(await fs.readFile(run+'/placement-audit.json','utf8'));
if(!report.pass||!audit.pass)throw Error('Execution or independent placement audit failed');
const visual=JSON.parse(await fs.readFile(run+'/visual-review.json','utf8'));
if(visual.pass!==true&&mode!=='--review')throw Error('Visual review failed; only an isolated --review save is allowed');
const project=JSON.parse(await fs.readFile(run+'/result-project.json','utf8'));
await withTsModule('electron/local-store/store.ts','save-direct-result.mjs',async api=>{
 let store=await api.initLocalProjectStore({projectDir});
 try{
  for(const asset of Object.values(project.assets.uploaded)){
   const match=asset.dataUrl?.match(/^data:image\/png;base64,(.+)$/);if(!match)throw Error('Portable PNG asset required');
   asset.ref=await store.putAsset(Buffer.from(match[1],'base64'),{mime:'image/png',extension:'png',originalName:asset.name,kind:asset.kind});delete asset.dataUrl;
  }
  const saved=await store.saveSerialized(JSON.stringify(project),null);
  if(saved.kind!=='saved')throw Error('Canonical save rejected');
 }finally{store.close();}
 store=await api.openLocalProjectStore({projectDir});
 try{
  const loaded=store.loadSnapshot();if(!loaded||!isDeepStrictEqual(JSON.parse(JSON.stringify(loaded.project)),project))throw Error('Canonical reopen differs');
  for(const asset of Object.values(loaded.project.assets.uploaded))await store.assetBytes(asset.ref.sha256);
  const proof={projectId:store.info().projectId,projectDir:path.resolve(projectDir),revision:loaded.revision,sha256:loaded.sha256,reopened:true,maps:Object.keys(loaded.project.maps),acceptance:mode==='--review'?'review-only':'visual-and-structural',visualReview:visual,source:'actual model-painted result; no supervisor painting'};
  await fs.writeFile(run+'/storage-proof.json',JSON.stringify(proof,null,2));console.log(proof);
 }finally{store.close();}
});
