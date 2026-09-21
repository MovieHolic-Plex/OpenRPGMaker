import{readFile,writeFile}from'node:fs/promises';
const manifest=JSON.parse(await readFile('public/assets/slates/slates-reference-recipes.json','utf8'));
const index=JSON.parse(await readFile('output/slates-mastery/patch-index.json','utf8'));
const lines=(await readFile('output/slates-mastery/patch-matches.txt','utf8')).trim().split('\n');
if(lines.length!==index.names.length*1020)throw Error('Incomplete analysis');let improved=0;
for(const line of lines){const[n,before,after,...path]=line.split(' ').map(Number);if(after>=before)continue;const name=index.names[Math.floor(n/1020)],i=n%1020;let parts=[];for(const p of path)parts.push(...(p===-1?manifest.maps[name].recipes[i]:[index.ids[p]]));manifest.maps[name].recipes[i]=parts;improved++;}
manifest.analysis={method:'Original RGBA rectangle beam search; visual review still required',changedPatches:improved};
await writeFile('public/assets/slates/slates-mastery-reference-recipes.json',JSON.stringify(manifest));console.log({improved});
