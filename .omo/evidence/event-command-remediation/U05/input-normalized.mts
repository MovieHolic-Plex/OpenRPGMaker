import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { deserialize, serialize } from '../../../../src/project/io';
const out='.omo/evidence/event-command-remediation/U05';
const root=(await readFile(`${out}/owned-root.txt`,'utf8')).trim();
const results=[];
for(const [id,path] of [['editor-stale',`${out}/qa-input-legacy-call.json`],['editor-current',`${root}/fixtures/project.json`],['player-stale-export',`${out}/editor-map-wire-legacy-call.json`],['player-current-export',`${root}/fixtures/editor-map.json`]]){
 const project=deserialize(await readFile(path!,'utf8'));
 const normalized=serialize(project);
 results.push({id,path,normalizedHash:createHash('sha256').update(normalized).digest('hex'),normalizedTrigger:project.commonEvents?.[0]?.trigger});
}
await writeFile(`${out}/acceptance-normalized-hashes.json`,JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
