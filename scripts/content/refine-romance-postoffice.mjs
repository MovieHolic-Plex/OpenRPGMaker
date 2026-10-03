// Authored reference scene, not a claim the AI generated it or a generic location template.
// Read the current canonical beodeul-city-blocks MD/images before using this recipe.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {withTsModule} from '../ontology-ts-loader.mjs';
const [input, output] = process.argv.slice(2);
if (!input || !output) throw Error('Usage: node scripts/content/refine-romance-postoffice.mjs <canonical.json> <new-output.json>');
if (fs.existsSync(output)) throw Error('Refusing to overwrite a previous authored result');
const project = JSON.parse(fs.readFileSync(input));
const map = project.maps[project.startMapId];
assert.equal(map.name, '별빛 우체국 앞'); assert.equal(map.tilesetId, 'beodeul_city');
assert.equal(map.width, 20); assert.equal(map.height, 15);
const identity = JSON.stringify({brief:project.gameDesignBrief,actors:project.database.actors,events:map.events,start:project.startPos});
const calls = [];
await withTsModule('src/editor/tools/toolRunner.ts', 'author.mjs', async ({runTool}) => {
  const ctx = {project, currentMapId:map.id};
  const tool = (name, args) => {
    const result = runTool(ctx, name, {...args, ...(name === 'set_project_settings' ? {} : {mapId:map.id})});
    if (!result.ok) throw Error(name + ': ' + JSON.stringify(result));
    calls.push({name,args,warnings:result.warnings??[]});
  };
  // Preserve the building and both characters. Recompose the isolated props.
  for (const rect of [[5,7,1,3],[2,9,2,1],[12,7,2,1],[15,3,4,4]]) {
    const [x,y,w,h] = rect; tool('clear_region',{x,y,w,h,layer:'upper'});
  }
  const road = rect => tool('fill_region',{rect,material:'버들항 길 포석',clearUpper:false,referencePurpose:'beodeul-city-blocks'});
  road({x:0,y:8,w:20,h:3});
  road({x:5,y:7,w:9,h:2});
  road({x:3,y:5,w:2,h:4});
  road({x:14,y:6,w:3,h:3});
  const stamp = (id,x,y) => tool('stamp_object',{objectId:'kit:beodeul_city/'+id,x,y,layers:'upper',referencePurpose:'beodeul-city-blocks'});
  // Background boundaries, a small neighborhood rest area, and two foreground masses.
  stamp('bd-tree-d43edd',0,0);
  stamp('bd-tree-1a786c',17,2);
  stamp('bd-prop-hedge',13,0);
  stamp('bd-prop-hedge',16,0);
  stamp('bd-prop-well_roofed',1,5);
  stamp('bd-prop-bench_wood',1,7);
  stamp('bd-prop-flowerbed',0,4);
  stamp('bd-prop-flowerbox_long',6,8);
  stamp('bd-prop-door_pots',13,7);
  stamp('bd-prop-lamp_crook',14,4);
  stamp('bd-prop-flowerbed',17,6);
  stamp('bd-tree-37f48b',18,7);
  stamp('bd-tree-5844f6',0,10);
  stamp('bd-tree-f4f319',5,12);
  stamp('bd-prop-flowerbed',7,12);
  stamp('bd-prop-hedge',10,12);
  stamp('bd-tree-d43edd',16,10);
  tool('set_lighting_volume',{ambient:0.14,color:'#273c46',sources:[
    {id:'postoffice-lamp',at:{x:14,y:6},radius:3,intensity:0.6,color:'#f3cc94',flicker:false},
  ]});
  tool('set_project_settings',{dialogue:{style:'pixel-cinematic',font:'galmuri9'}});
  const after = ctx.project;
  assert.equal(JSON.stringify({brief:after.gameDesignBrief,actors:after.database.actors,events:after.maps[map.id].events,start:after.startPos}),identity);
  fs.writeFileSync(output,JSON.stringify(after));
});
fs.writeFileSync(output.replace(/\.json$/,'.recipe.json'),JSON.stringify({authoredBy:'coding agent',automaticAi:false,identityPreserved:true,calls},null,2));
console.log(JSON.stringify({output,calls:calls.length,identityPreserved:true}));
