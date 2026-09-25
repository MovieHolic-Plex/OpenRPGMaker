// Publish the user-local direct-authoring families to the host shared SQLite, then reload and compare.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {withTsModule} from '../ontology-ts-loader.mjs';
const [input]=process.argv.slice(2);
if(!input)throw Error('Usage: <library.json from prepare-pixel-art-world-direct-families.py>');
const library=JSON.parse(await fs.readFile(input,'utf8')),id='pixel-art-world-direct-families-local';
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
await withTsModule('scripts/lib/sharedContentSqlite.ts','publish-direct-families.mjs',async api=>{
 const before=api.readSharedContent().libraries[id];
 const saved=api.publishSharedContent(id,library,before?hash(before):null);
 if(hash(saved.reloaded)!==hash(library))throw Error('Shared reload differs');
 console.log({file:saved.file,library:id,revision:saved.revision,tilesets:Object.keys(library.tilesets),reloadedEqual:true});
});
