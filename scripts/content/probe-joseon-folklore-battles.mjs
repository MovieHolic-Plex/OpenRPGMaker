import fs from 'node:fs';
import {withTsModule} from '../ontology-ts-loader.mjs';
await withTsModule('scripts/content/probe-joseon-folklore-battles.ts','jf-battle-probe.mjs',api=>{
 const proof=api.probeJoseonBattles(JSON.parse(fs.readFileSync('output/joseon-folklore/game.oprn.json','utf8')));
 fs.writeFileSync('output/joseon-folklore/battle-probe.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
});
