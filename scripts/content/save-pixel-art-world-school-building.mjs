// Private local project only. Never writes LegacyDb, remote hosts, or source art into git.
import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {withTsModule} from '../ontology-ts-loader.mjs';
const input=process.argv[2];
const projectDir=process.argv[3];
if(!input||!projectDir)throw Error('Usage: node scripts/content/save-pixel-art-world-school-building.mjs <authored.json> <new/private/project-folder>');
const project=JSON.parse(fs.readFileSync(input,'utf8'));
const title='Pixel Art World · 도시 50×50';
if(project.meta.title!==title)throw Error('Unexpected authored project');
const existed=fs.existsSync(path.join(projectDir,'project.sqlite'));
await withTsModule('electron/local-store/store.ts','paw-city-store.mjs',async api=>{
 let store=existed?await api.openLocalProjectStore({projectDir}):await api.initLocalProjectStore({projectDir});
 let expected;
 try {
  const previous=store.loadSnapshot();
  if(previous&&previous.project.meta.title!==title)throw Error('Refusing to replace unrelated local project');
  const basis=JSON.parse(fs.readFileSync('output/paw-school-four/before-proof.json','utf8'));
  if(previous?.sha256!==basis.sha256)throw Error('Canonical project changed since authoring began');
  await store.backup();
  for(const asset of Object.values(project.assets.uploaded)){
   if(!asset.dataUrl)continue;
   const match=asset.dataUrl.match(/^data:image\/png;base64,(.+)$/);
   if(!match)throw Error('Expected PNG asset');
   asset.ref=await store.putAsset(Buffer.from(match[1],'base64'),{mime:'image/png',extension:'png',originalName:asset.name,kind:asset.kind});
   delete asset.dataUrl;
  }
  const saved=await store.saveSerialized(JSON.stringify(project),previous?.sha256??null);
  if(saved.kind!=='saved')throw Error('Project changed during save');
  expected=project;
 }finally{store.close();}
 store=await api.openLocalProjectStore({projectDir});
 try {
  const snapshot=store.loadSnapshot();
  if(!snapshot||!isDeepStrictEqual(JSON.parse(JSON.stringify(snapshot.project)),JSON.parse(JSON.stringify(expected)))){ fs.writeFileSync('output/paw-school-four/reload-actual.json',JSON.stringify(snapshot?.project));fs.writeFileSync('output/paw-school-four/reload-expected.json',JSON.stringify(expected));throw Error('Canonical reload differs from submitted document');}
  const proof={projectId:store.info().projectId,projectDir:path.resolve(projectDir),revision:snapshot.revision,sha256:snapshot.sha256,reopened:true,maps:Object.values(snapshot.project.maps).map(m=>({id:m.id,name:m.name,width:m.width,height:m.height,events:m.events.length})),assets:store.listAssets().length};
  const out='output/paw-school-four';fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(`${out}/canonical-reloaded.json`,JSON.stringify(snapshot.project));
  // Local preview/export gets pixels from the just-reopened canonical asset service.
  const portable=structuredClone(snapshot.project);
  for(const asset of Object.values(portable.assets.uploaded))if(asset.ref){asset.dataUrl='data:image/png;base64,'+Buffer.from(await store.assetBytes(asset.ref.sha256)).toString('base64');delete asset.ref;}
  fs.writeFileSync(`${out}/reloaded-portable.json`,JSON.stringify(portable));
  fs.writeFileSync(`${out}/storage-proof.json`,JSON.stringify(proof,null,2));
  console.log(JSON.stringify(proof));
 }finally{store.close();}
});
