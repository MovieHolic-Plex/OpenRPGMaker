// The only DB-writing entry point. Preparation lives in a separate module with no SQLite import.
import fs from 'node:fs/promises';
import path from 'node:path';
import {withTsModule} from '../ontology-ts-loader.mjs';
import {LOOSE_LIBRARY_ID,hash,readPreparedLooseLibrary} from './prepare-pixel-art-world-loose-library.mjs';
const[action,preparedDir,out,...extra]=process.argv.slice(2);
if(action!=='--publish-local'||!out||extra.length)throw Error('Usage: --publish-local <prepared directory> <private receipt output>');
const {lib,proof}=await readPreparedLooseLibrary(preparedDir);
await fs.mkdir(out,{recursive:true});
await withTsModule('scripts/lib/sharedContentSqlite.ts','paw-loose-publish.mjs',async api=>{
 const before=api.readSharedContent(),existing=before.libraries[LOOSE_LIBRARY_ID],actual=existing?hash(existing):null;
 if(actual!==proof.expectedLibraryRevision)throw Error('Loose library changed after preparation. Read a fresh snapshot and prepare again.');
 for(const[id,other]of Object.entries(before.libraries))if(id!==LOOSE_LIBRARY_ID)for(const tileId of Object.keys(lib.tilesets))if(other.tilesets?.[tileId]||other.assets?.[tileId+'_image'])throw Error('Another library owns '+tileId);
 const saved=api.publishSharedContent(LOOSE_LIBRARY_ID,lib,proof.expectedLibraryRevision),after=api.readSharedContent();
 for(const[id,other]of Object.entries(before.libraries))if(id!==LOOSE_LIBRARY_ID&&hash(after.libraries[id])!==hash(other))throw Error('Unrelated library changed '+id);
 if(hash(saved.reloaded)!==proof.libraryObjectSha256)throw Error('Published library reload differs');
 const receipt={libraryId:LOOSE_LIBRARY_ID,file:saved.file,revision:saved.revision,reloadedEqual:true,counts:proof.counts,source:proof.source,reviewBundle:proof.reviewBundle,preparationProofSha256:hash(await fs.readFile(path.join(preparedDir,'preparation-proof.json'))),scope:proof.scope};
 await fs.writeFile(path.join(out,'proof.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
});
