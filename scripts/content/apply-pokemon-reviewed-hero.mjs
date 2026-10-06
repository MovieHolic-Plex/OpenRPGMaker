// Detached single-slot preparation. Official host API owns all asset reads and CAS save/reload.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {spawnSync} from 'node:child_process';
import {connectHostBridge} from '../lib/hostBridgeClient.mjs';
const [canonicalDir,heroAdapter,out,cachePath]=process.argv.slice(2);
if(!cachePath)throw Error('Usage: apply-pokemon-reviewed-hero.mjs canonical-read-directory reviewed-editor-charset.png private-output verified-portable-cache.json');
await fs.mkdir(out,{recursive:true});
// Refuse an arbitrary caller-supplied adapter: it must be the current registered hero build.
const registered=path.resolve('public/assets/harnesses/pokemon-character-motion/emerald/hero');
const motion=JSON.parse(await fs.readFile(path.join(registered,'motion.json'))),quality=JSON.parse(await fs.readFile(path.join(registered,'quality-gate.json')));
const adapterBytes=await fs.readFile(heroAdapter),adapterSha=createHash('sha256').update(adapterBytes).digest('hex');
if(adapterSha!==motion.editorAdapter.sha256 || !quality.pass || quality.sheetSha256!==motion.sourceSha256)throw Error('Adapter does not match the registered approved hero');

const identity=JSON.parse(await fs.readFile(path.join(canonicalDir,'canonical-identity.json'))),receipt=JSON.parse(await fs.readFile(path.join(canonicalDir,'canonical-receipt.json'))),raw=await fs.readFile(path.join(canonicalDir,'canonical-reloaded.json'),'utf8');
const hash=b=>createHash('sha256').update(b).digest('hex');
if(hash(raw)!==receipt.sha256)throw Error('Read document differs from receipt');
const url=new URL(identity.host),scope=identity.bridgeProject??identity.hostProject;if(scope)url.searchParams.set('hostProject',scope);
const host=await connectHostBridge(url.href);await host.call('oprn:project.open',{projectDir:'host-project'});
const live=await host.call('oprn:project.load',{projectDir:'host-project'});if(live.sha256!==receipt.sha256)throw Error('Canonical changed since read');
const before=JSON.parse(raw),project=structuredClone(before),id='oprn_emerald_field_cast_1',asset=project.assets.uploaded[id];
if(before.id!==undefined&&before.id!==identity.projectId)throw Error('Wrong project');
if(!asset?.ref?.sha256)throw Error('Canonical cast1 asset reference missing');
const bytes=Buffer.from(await host.call('oprn:assets.read',{projectDir:'host-project',sha256:asset.ref.sha256}),'base64');
if(hash(bytes)!==asset.ref.sha256)throw Error('Canonical source cast bytes differ');
await fs.writeFile(path.join(out,'old-cast-1.png'),bytes);
const result=spawnSync('python3',['-c',`
from PIL import Image
from pathlib import Path
import sys,json
old=Image.open(sys.argv[1]).convert('RGBA');hero=Image.open(sys.argv[2]).convert('RGBA')
assert old.size==(288,256) and hero.size==(72,128)
for row in range(4):
 for column in range(3):
  for y in range(32):
   for x in range(24):
    if x<4 or x>=20:assert hero.getpixel((column*24+x,row*32+y))[3]==0
new=old.copy();new.paste(hero,(0,0))
for y in range(256):
 for x in range(288):
  if x>=72 or y>=128:assert new.getpixel((x,y))==old.getpixel((x,y))
new.save(sys.argv[3]);print(json.dumps({'outsideHeroPixelsCompared':288*256-72*128,'outsideHeroPixelsIdentical':True,'nativePaddingOnly':True}))
`,path.join(out,'old-cast-1.png'),heroAdapter,path.join(out,'new-cast-1.png')],{encoding:'utf8'});
if(result.status!==0)throw Error(result.stderr+result.stdout);
const replacement=await fs.readFile(path.join(out,'new-cast-1.png'));
delete asset.ref;asset.dataUrl='data:image/png;base64,'+replacement.toString('base64');
if(quality.mode==='reference-fidelity')asset.meta={...asset.meta,heroReferenceAdoption:{name:'Pokémon Emerald Brendan',sourceUrl:quality.sourceUrl,sourceSha256:quality.sourceSha256,independentlyAuthored:false,minimumExactRatio:quality.minimumExactRatio}};
const proof=structuredClone(project);proof.assets.uploaded[id]=before.assets.uploaded[id];if(!isDeepStrictEqual(proof,before))throw Error('Changes outside the cast1 asset');
const cache=JSON.parse(await fs.readFile(cachePath));cache.assets.uploaded[id]=asset;
await fs.writeFile(path.join(out,'prepared-canonical.json'),JSON.stringify(project));
await fs.writeFile(path.join(out,'portable-cache.json'),JSON.stringify(cache));
await fs.copyFile(path.join(path.dirname(cachePath),'world-manifest.json'),path.join(out,'world-manifest.json'));
const record={projectId:identity.projectId,projectDir:identity.projectDir,sourceSha256:receipt.sha256,changedAsset:id,oldAssetSha256:hash(bytes),newAssetSha256:hash(replacement),...JSON.parse(result.stdout),allOtherProjectFieldsAndAssetsIdentical:true,canonicalSaved:false};
await fs.writeFile(path.join(out,'preparation-receipt.json'),JSON.stringify(record,null,2));console.log(JSON.stringify(record));
