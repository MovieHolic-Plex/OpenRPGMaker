import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { withTsModule } from '../ontology-ts-loader.mjs';

const destination = resolve(process.argv[2] ?? 'public/monster-expedition');
await mkdir(destination, {recursive:true});
await withTsModule(resolve('src/project/examples/monsterExpedition/index.ts'), 'monster-expedition.mjs', async mod => {
  const {project, serialized, manifest} = mod.createMonsterExpedition();
  const prepared = mod.prepareExpeditionExport(project);
  const privateOut=resolve(process.argv[3] ?? '/home/main/.local/share/oprn/monster-expedition-evidence');
  await mkdir(privateOut,{recursive:true});
  await writeFile(resolve(privateOut, 'prepared-canonical.json'), serialized);
  await writeFile(resolve(destination, 'project.json'), prepared.projectJson);
  await writeFile(resolve(destination, 'world-manifest.json'), JSON.stringify(manifest, null, 2));
  await writeFile(resolve(destination, 'public-assets.json'), JSON.stringify(prepared.assets.filter(a=>a.kind==='public'), null, 2));
  console.log(JSON.stringify({destination, maps:Object.keys(project.maps).length,
    species:project.system.monsterCampaign.speciesIds.length, skills:project.database.skills.filter(s=>s.id.startsWith('mx_')).length,
    links:manifest.links.length,battles:manifest.battles.length,devices:manifest.devices.length,bytes:serialized.length}));
});
