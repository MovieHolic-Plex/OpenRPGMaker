/** One authored new-monster field contact and victory, using the served canonical export. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { withTsModule } from '../../ontology-ts-loader.mjs';
import { runRuntimeQa } from '../../lib/runtimeQaRun.mjs';
import starter from './joseon-folklore-starter.scenario.mjs';

const arg = (key, fallback) => {
  const index = process.argv.indexOf('--' + key);
  return index < 0 ? fallback : process.argv[index + 1];
};
const out = arg('out', 'output/jf-diversity-20261005/spawn');
const source = arg('project', 'output/joseon-folklore/starter/game.oprn.json');
const project = JSON.parse(fs.readFileSync(source, 'utf8'));
const map = project.maps.joseon_field;
const spawn = map.fieldSpawns.find(s => s.id === 'jb_hunt_9');
assert.equal(spawn.troopId, 'troop_jf_venom_toad');
let approach;
await withTsModule('src/project/collision.ts', 'jf-spawn-approach.mjs', api => {
  const { x, y } = spawn.area;
  const options = [[x,y+1,'up'],[x,y-1,'down'],[x-1,y,'right'],[x+1,y,'left']];
  approach = options.find(([fx,fy]) => api.canMove(project,map,fx,fy,x,y));
  assert(approach, 'Spawn needs a reachable approach');
});
fs.mkdirSync(out, { recursive: true });
const present = testid => ({ kind:'waitFor',testid,state:'present',timeoutMs:30000 });
const [x,y,dir] = approach;
const scenario = { ...starter, id:'joseon-monster-native-spawn', projectFixture:source, viewport:{width:960,height:720},
  beats:[...starter.beats.filter(b=>['title','village'].includes(b.id)),
    {id:'toad-contact',ops:[{kind:'waitForFieldReady'},{kind:'teleport',mapId:map.id,x,y},
      {kind:'waitForPosition',mapId:map.id,x,y},{kind:'waitForFieldReady'},
      {kind:'hold',dir,ms:300},present('battle-scene'),present('actor-command-attack'),
      {kind:'waitForAttr',testid:'battle-scenery',attr:'data-layers',value:'ready'}],
      expect:{battlerGeometry:{minEnemies:1},visibleText:{'battle-scene':'독두꺼비'}},shot:true},
    {id:'toad-victory',ops:[{kind:'key',key:'f'},
      {kind:'waitFor',testid:'battle-result-panel',state:'present',timeoutMs:120000},
      {kind:'waitForVisible',testid:'battle-result-panel'}],
      expect:{visibleText:{'battle-result-panel':'승리'}},shot:true},
  ]};
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
  const page=await browser.newPage({viewport:scenario.viewport});page.setDefaultNavigationTimeout(120000);
  const missing=[];page.on('response',r=>{if(r.status()>=400)missing.push({url:r.url(),status:r.status()});});
  const result=await runRuntimeQa(page,scenario,{serverUrl:arg('server','http://127.0.0.1:18345'),projectUrl:'/project.json',outDir:out});
  assert.equal(result.errors.length,0);assert(result.beats.every(b=>!b.failures?.length));assert.deepEqual(missing,[]);
  const proof={projectUrl:'/project.json',sourceProjectFile:source,spawnId:spawn.id,troopId:spawn.troopId,
    approach:{x,y,dir},formationChanged:false,statsChanged:false,errors:result.errors,missing,
    resultText:await page.getByTestId('battle-result-panel').innerText(),beats:result.beats.map(b=>({id:b.id,failures:b.failures}))};
  fs.writeFileSync(out+'/spawn-proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
} finally {await browser.close();}
