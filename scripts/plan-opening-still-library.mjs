// Expand the authored coverage matrix into a pending tibo batch, never a playable catalog.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {parseArgs} from 'node:util';
const {values}=parseArgs({options:{out:{type:'string',default:'artifacts/stills-library-plan.json'}}});
const plan=JSON.parse(await readFile(new URL('../assets/opening-still-library-plan.json',import.meta.url),'utf8'));
const stills=[];
for(const world of plan.worlds) for(const light of plan.lighting) for(const shot of plan.shots){
  const place=world.places[shot.place];
  if(!place)throw new Error('Missing place: '+world.id+'/'+shot.place);
  const name=`${world.name} · ${shot.name} · ${light.name}`;
  const description=`${world.name}의 ${place}. ${shot.detail}. ${shot.composition}. ${light.name} 분위기.`;
  const series=`${world.id}-${light.id}`;
  const slug=`library-${series}-${shot.id}`;
  stills.push({id:'oprn-pack-still-'+slug,fileName:slug+'.jpg',name,description,
    mood:[...new Set([...shot.mood,...light.mood])],useCases:shot.role,series,cautions:[],
    tags:[world.name,place,shot.name,light.name,shot.composition],reviewStatus:'pending',
    prompt:`Use case: illustration-story. Asset: RPG opening still. One complete 16:9 landscape illustration, at least 1536x864. World: ${world.name}; ${world.materials}. Scene: ${description} Lighting: ${light.description}. Style: ${plan.style}. Make the location and physical event distinctive. The stated description is the requested content, not a caption. Keep the bottom area readable for a later narration overlay. No text, captions, letters, logos, watermark, UI, collage, split panels, recognizable copyrighted characters or human figures. Draw ONLY this one scene. Series ${series}: maintain this world's materials and palette across shots.`});
}
if(new Set(stills.map(s=>s.id)).size!==stills.length)throw new Error('Duplicate planned ID');
const out=resolve(values.out);await mkdir(dirname(out),{recursive:true});
await writeFile(out,JSON.stringify({schemaVersion:1,status:'planned-not-generated',stills},null,2)+'\n');
console.log(JSON.stringify({out,planned:stills.length,worlds:plan.worlds.length,shots:plan.shots.length,lighting:plan.lighting.length,generated:0}));
