import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { runRuntimeQa, startPlayerQaServer } from '../../../scripts/lib/runtimeQaRun.mjs';
const projectFixture = process.argv[2] ?? 'output/evidence/jrpg-adversarial-review/project-final.json';
const outDir = 'output/evidence/field-resource/runtime';
const scenario = { id: 'generated-monster-field', projectFixture, beats: [
  { id:'start', ops:[{kind:'key',key:'Enter'},{kind:'waitForRuntime'}], expect:{playerSpriteTextureLoaded:true} },
  { id:'dungeon-monsters', ops:[{kind:'teleport',mapId:'map_forest_dungeon',x:4,y:5},{kind:'waitForPosition',mapId:'map_forest_dungeon',x:4,y:5},{kind:'hold',dir:'down',ms:180}], expect:{mapId:'map_forest_dungeon',testidAbsent:['missing-resource-error']}, shot:true }
]};
const server = await startPlayerQaServer();
const browser = await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=swiftshader','--disable-gpu','--disable-features=LocalNetworkAccessChecks']});
try {
  const page = await browser.newPage();
  // Forward the owned Vite server's exact bytes through Node: host netlink changes cancel Chromium fetches.
  await page.route(`${server.url}/**`, async route => {
    const response = await fetch(route.request().url());
    await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
  });
  page.on('pageerror',e=>console.log('PAGEERROR',String(e)));
  page.on('console',m=>{if(m.type()==='error') console.log('CONSOLE',m.text());});
  const report = await runRuntimeQa(page, scenario, {serverUrl:server.url,outDir});
  const sprites = await page.evaluate(() => window.__oprnCharacterSprites?.());
  await writeFile(`${outDir}/sprites.json`, JSON.stringify(sprites,null,2));
  const field = Object.entries(sprites?.events ?? {}).filter(([id])=>id.startsWith('__field_spawn__'));
  const valid = field.length > 0 && field.every(([,sprite])=>sprite.textureKey==='generated-enemy-slime-green' && sprite.frame==='__BASE');
  console.log(JSON.stringify({port:server.port,errors:report.errors,beats:report.beats.map(b=>({id:b.id,failures:b.failures})),field,valid},null,2));
  if (!valid || report.errors.length || report.beats.some(b=>b.failures.length)) process.exitCode = 1;
} finally {await browser.close();await server.close();}
