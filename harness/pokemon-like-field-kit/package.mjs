// Seal source + deliverable bytes. Any art/UI/audio change requires a fresh human decision.
import {readdir,readFile,writeFile,cp,mkdir} from 'node:fs/promises';
import {resolve,dirname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=dirname(fileURLToPath(import.meta.url)),sha=b=>createHash('sha256').update(b).digest('hex');
const walk=async path=>{const entries=await readdir(resolve(root,path),{withFileTypes:true});return(await Promise.all(entries.filter(e=>!e.name.startsWith('.')&&e.name!=='__pycache__').map(e=>e.isDirectory()?walk(path+'/'+e.name):path+'/'+e.name))).flat();};
if(process.argv[2]==='export'){
 const target=process.argv[3];if(!target)throw Error('Supply a new export directory');
 if(resolve(target)===root||resolve(target).startsWith(root+sep))throw Error('Export outside the working harness');
 const m=JSON.parse(await readFile(resolve(root,'manifest.json'),'utf8'));
 for(const [f,hash]of Object.entries(m.files))if(sha(await readFile(resolve(root,f)))!==hash)throw Error('Stale package: '+f);
 const data=resolve(process.argv[4]??resolve(root,'.data')),decisions={};
 for(const f of (await readdir(data)).filter(f=>/^review-.*\.json$/.test(f)).sort()){
  const r=JSON.parse(await readFile(resolve(data,f),'utf8'));if(r.package===m.packages[r.group])decisions[r.group]=r;
 }
 for(const group of ['monster','ui','music'])if(decisions[group]?.decision!=='allow'||decisions[group]?.source!=='human-browser'||decisions[group]?.checks?.length!==2||!decisions[group].checks.every(v=>v===true))throw Error('Current human Allow required: '+group);
 await mkdir(resolve(target));
 // Carry native sources, provenance and font license together with approved bytes.
 for(const file of [...Object.keys(m.files),'README.md','AGENTS.md']){const to=resolve(target,file);await mkdir(dirname(to),{recursive:true});await cp(resolve(root,file),to);}
 await writeFile(resolve(target,'approval.json'),JSON.stringify({packages:m.packages,decisions},null,2)+'\n');
 await cp(resolve(root,'manifest.json'),resolve(target,'manifest.json'));console.log('Approved portable review pack exported: '+resolve(target));
}else{
 const paths=[...await walk('site'),...await walk('references'),...await walk('recipes'),...await walk('lib'),'render.py','compose.mjs','server.mjs','package.mjs'];
 const files={};for(const f of paths.sort())files[f]=sha(await readFile(resolve(root,f)));
 const shared=['site/index.html','site/style.css','site/app.js','server.mjs','package.mjs'];
 const groupFiles={monster:paths.filter(p=>p.startsWith('references/')||p.startsWith('recipes/')||/\.(png|gif)$/.test(p)||/pixels|sprite|art-checks|render.py/.test(p)),ui:paths.filter(p=>/\.(html|css|js|woff2)$/.test(p)),music:paths.filter(p=>/\.(wav|ogg)$/.test(p)||p.includes('-score.json')||p.includes('audio.json')||p==='compose.mjs'||p.startsWith('lib/'))};
 const packages={};for(const [group,list]of Object.entries(groupFiles)){const names=[...new Set([...list,...shared])].sort();packages[group]=sha(JSON.stringify(names.map(n=>[n,files[n]])));}
 await writeFile(resolve(root,'manifest.json'),JSON.stringify({version:1,files,packages},null,2)+'\n');console.log(JSON.stringify(packages,null,2));
}
