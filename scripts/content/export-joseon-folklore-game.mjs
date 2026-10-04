import fs from 'node:fs';
import path from 'node:path';
import { withTsModule } from '../ontology-ts-loader.mjs';
const out=path.resolve(process.argv.includes('--pilot')?'output/joseon-folklore/pilot':'output/joseon-folklore');
const project=JSON.parse(fs.readFileSync(path.join(out,'game.oprn.json'),'utf8'));
const fallback=process.env.JOSEON_EXISTING_ASSET_ROOT;
const fromFallback=[];
await withTsModule('src/project/webExport.ts','jf-export.mjs',async api=>{
 const result=await api.createWebPlayerExportPackage(project,{
  fetchBytes:async resource=>{
   const name=decodeURIComponent(new URL(resource,'http://localhost').pathname).replace(/^\//,'');
   if(name.split('/').some(p=>p==='..'))throw new Error('Unsafe export path');
   let local=name.startsWith('export-player/')?path.join('dist',name):path.join('public',name);
   if(!fs.existsSync(local)&&fallback&&!name.startsWith('export-player/')&&!name.startsWith('assets/joseon-folklore/')) {
    const inherited=path.join(fallback,name);
    if(fs.existsSync(inherited)){local=inherited;fromFallback.push(name);}
   }
   if(!fs.existsSync(local))throw new Error('Missing export dependency: '+name);
   return new Uint8Array(fs.readFileSync(local));
  }
 });
 fs.writeFileSync(path.join(out,'game-web.zip'),new Uint8Array(await result.blob.arrayBuffer()));
 fs.writeFileSync(path.join(out,'export-proof.json'),JSON.stringify({summary:result.summary,inheritedAssets:fromFallback},null,2));
 console.log(JSON.stringify({summary:result.summary,inheritedAssets:fromFallback.length}));
});
