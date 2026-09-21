import{readFile,writeFile}from'node:fs/promises';
const m=JSON.parse(await readFile('public/assets/slates/slates-mastery-reference-recipes.json','utf8'));
const index=JSON.parse(await readFile('output/slates-mastery/fine-index.json','utf8'));
const lines=(await readFile('output/slates-mastery/fine-matches.txt','utf8')).trim().split('\n');if(lines.length!==index.names.length*4080)throw Error('Incomplete fine analysis');
const patches=new Map(),seen=new Map(m.rects.map((r,i)=>[r.join(','),i]));
const idFor=r=>{const key=r.join(',');if(!seen.has(key)){seen.set(key,m.rects.length);m.rects.push(r);}return seen.get(key);};
let improved=0;
for(const line of lines){const[n,before,after,...path]=line.split(' ').map(Number);if(after>=before)continue;const name=index.names[Math.floor(n/4080)],i=n%4080,x=i%68,y=Math.floor(i/68),parent=Math.floor(y/2)*34+Math.floor(x/2),dx=x%2*8,dy=y%2*8,key=name+':'+parent;
 if(!patches.has(key)){patches.set(key,{name,parent,quads:Array.from({length:4},(_,q)=>m.maps[name].recipes[parent].map(id=>{const[s,sx,sy]=m.rects[id];return idFor([s,sx+q%2*8,sy+Math.floor(q/2)*8,8,q%2*8,Math.floor(q/2)*8]);}))});}
 const record=patches.get(key),q=y%2*2+x%2,old=record.quads[q];record.quads[q]=path.flatMap(p=>p===-1?old:[idFor([...index.rects[p],8,dx,dy])]);improved++;
}
for(const r of patches.values())m.maps[r.name].recipes[r.parent]=r.quads.flat();m.analysis.fineChangedPatches=improved;m.analysis.fineParentPatches=patches.size;
await writeFile('public/assets/slates/slates-mastery-fine-recipes.json',JSON.stringify(m));console.log({improved,parentPatches:patches.size});
