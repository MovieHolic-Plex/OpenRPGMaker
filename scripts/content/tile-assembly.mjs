// Usage: node scripts/content/tile-assembly.mjs <preview|validate> <project.json> <mapId> <input-or-plan.json> <output.json>
import fs from 'node:fs';import {withTsModule} from '../ontology-ts-loader.mjs';
const[mode,input,mapId,planFile,output]=process.argv.slice(2);
if(!['preview','validate'].includes(mode)||!output)throw Error('Usage: tile-assembly.mjs <preview|validate> <project.json> <mapId> <input-or-plan.json> <output.json>');
const p=JSON.parse(fs.readFileSync(input)),args=JSON.parse(fs.readFileSync(planFile)),map=p.maps[mapId];if(!map)throw Error('Map not found');
await withTsModule('src/project/tileAssemblyGuide.ts','assembly-cli.mjs',m=>{
 const result=mode==='validate'?m.validateTileAssembly(p,map,args):(()=>{const plan=m.forestStripPlan(args.x,args.y,args.width,args.height);return{plan,map:m.assembleTilePlan(map,plan)};})();
 fs.writeFileSync(output,JSON.stringify(result,null,2));console.log(mode+': '+output);if(mode==='validate'&&!result.valid)process.exitCode=2;
});
