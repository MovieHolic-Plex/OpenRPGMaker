import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { prepareWebExport } from '../../../project/webExport';
import type { Project } from '../../../project/types';
import { resolve } from 'node:path';

const [source, output] = process.argv.slice(2);
if (!source || !output) throw Error('runtimeProjection <saved project JSON> <player project JSON>');
const sourceBytes = readFileSync(source);
const prepared = prepareWebExport(JSON.parse(sourceBytes.toString()) as Project);
writeFileSync(output, prepared.projectJson);
writeFileSync(`${output}.receipt.json`, JSON.stringify({
  sourceSha256: createHash('sha256').update(sourceBytes).digest('hex'),
  playerSha256: createHash('sha256').update(prepared.projectJson).digest('hex'),
  projection: 'prepareWebExport', summary: prepared.summary,
}, null, 2));
const projectDir=resolve(source,'..','project');
const assets=prepared.assets.filter(a=>a.kind==='uploaded'&&a.asset.ref).map(a=>{
  if(a.kind!=='uploaded'||!a.asset.ref)throw Error('Uploaded export ref required');
  const ref=a.asset.ref;
  if(!/^[a-f0-9]{64}$/.test(ref.sha256)||!/^\w{1,12}$/.test(ref.extension))throw Error('Invalid exported media ref');
  const file=resolve(projectDir,'assets',`${ref.sha256}.${ref.extension}`),bytes=readFileSync(file);
  if(bytes.length!==ref.bytes||createHash('sha256').update(bytes).digest('hex')!==ref.sha256)throw Error(`Missing or corrupt saved media: ${a.asset.id}`);
  return {zipPath:a.zipPath,file,mime:ref.mime,sha256:ref.sha256,bytes:ref.bytes};
});
writeFileSync(`${output}.assets.json`,JSON.stringify(assets));
