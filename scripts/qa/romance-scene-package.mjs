// Build the production web export, including every dependency, for shipped-player QA.
import fs from 'node:fs';import {resolve,sep} from 'node:path';import {spawnSync} from 'node:child_process';import {withTsModule} from '../ontology-ts-loader.mjs';
import {connectHostBridge} from '../lib/hostBridgeClient.mjs';
const [input,outDir='output/qa/romance-scene/package',host]=process.argv.slice(2);if(!input)throw Error('Usage: node scripts/qa/romance-scene-package.mjs <canonical.json> [owned-output-dir] [owned-host-url]');
const out=resolve(outDir);if(!out.startsWith(resolve('output/qa')+sep))throw Error('Package QA output must be inside output/qa');fs.mkdirSync(out,{recursive:true});
const entry=resolve(out,'export-entry.ts');fs.writeFileSync(entry,`export {createWebPlayerExportPackage} from ${JSON.stringify(resolve('src/project/webExport.ts'))};\nexport {setUploadedAssetResolver} from ${JSON.stringify(resolve('src/project/persistence/assetAccessors.ts'))};\n`);
await withTsModule(entry,'export.mjs',async ({createWebPlayerExportPackage,setUploadedAssetResolver})=>{
 const project=JSON.parse(fs.readFileSync(input));
 if(host){const {call}=await connectHostBridge(host);const status=await call('oprn:project.status');setUploadedAssetResolver({url:ref=>new URL('/__oprn/asset/'+new URL(host).searchParams.get('hostProject')+'/'+ref.sha256,host).href,bytes:async ref=>new Uint8Array(Buffer.from(await call('oprn:assets.read',{projectDir:status.projectDir,sha256:ref.sha256}),'base64'))});}
 const fetchBytes=async url=>{if(url.startsWith('data:'))return new Uint8Array(await (await fetch(url)).arrayBuffer());const u=new URL(url,'http://local'),name=decodeURIComponent(u.pathname);const player=name.startsWith('/export-player/');const root=resolve(player?'dist/export-player':'public');const path=resolve(root,player?name.slice('/export-player/'.length):name.slice(1));if(!path.startsWith(root+sep))throw Error('Asset path outside root');try{return new Uint8Array(fs.readFileSync(path));}catch(error){console.error('Missing export dependency:',name);throw error;}};
 const result=await createWebPlayerExportPackage(project,{fetchBytes});const zip=resolve(out,'game.zip');fs.writeFileSync(zip,Buffer.from(await result.blob.arrayBuffer()));
 const unpack=spawnSync('python3',['-c','import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])',zip,out],{encoding:'utf8'});if(unpack.status!==0)throw Error(unpack.stderr);
 fs.writeFileSync(resolve(out,'qa-package-summary.json'),JSON.stringify(result.summary,null,2));console.log(result.summary);
});
