/** Native hand-art integration controls. Detached inputs, no canonical writes. */
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';import {build} from 'esbuild';import {createRequire} from 'node:module';
const [selectionFile,outDir]=process.argv.slice(2);if(!outDir)throw Error('Usage: pokemon-hand-authoring.mjs selection.json output');
const selection=JSON.parse(fs.readFileSync(selectionFile,'utf8')),source=JSON.parse(fs.readFileSync(selection.authoring,'utf8'));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'pokemon-native-hand-')),dir=path.resolve('src/harnesses/pokemon-character-motion/node');
try{
 const entry=path.join(temp,'entry.ts'),compiled=path.join(temp,'check.cjs');fs.writeFileSync(entry,'export {run} from '+JSON.stringify(path.join(dir,'cli.ts'))+';\nexport * from '+JSON.stringify(path.resolve('src/harnesses/monster-collect-species/node/png.ts'))+';');
 await build({entryPoints:[entry],outfile:compiled,bundle:true,platform:'node',format:'cjs',logLevel:'silent',define:{'import.meta.dirname':JSON.stringify(dir)}});
 const h=createRequire(import.meta.url)(compiled),checks=[];
 const equalPixels=(src,dst,name)=>{const a=h.readPng(src),b=h.readPng(dst);assert.equal(a.width,b.width);assert.equal(a.height,b.height);assert(Buffer.from(a.data).equals(Buffer.from(b.data)),name);checks.push({name,pass:true});};
 for(const r of source.roles){equalPixels(r.charset,path.join(selection.walk[r.role],'charset.png'),r.role+' native16x32 field bytes unchanged');equalPixels(r.portrait,path.join(selection.trainers[r.role],'portrait.png'),r.role+' native64 trainer bytes unchanged');}
 equalPixels(source.heroBack.file,path.join(selection.trainers.hero_back,'portrait.png'),'native64 player back bytes unchanged');
 equalPixels(source.professorClip.file,path.join(selection.clip,'clip.png'),'all6 native64 professor poses unchanged');
 const prompt=path.join(temp,'origin.txt');fs.writeFileSync(prompt,'Adversarial native-only test fixture; not authored or shipping art.');
 const reject=async(name,command,args)=>{assert.equal(await h.run([command,'--native','--role','professor','--source',args.source,'--prompt-file',prompt,'--sandbox',temp,...args.flags]),1);checks.push({name,pass:true});};
 await reject('native64 clip rejects mismatched declared grid','clip-import',{source:source.professorClip.file,flags:['--columns','3','--rows','2']});
 const partial=h.readPng(source.roles[0].portrait);partial.data[partial.data.findIndex((v,i)=>i%4===3&&v===255)]=128;const alpha=path.join(temp,'partial.png');h.writePng(alpha,partial);
 await reject('native portrait rejects partial alpha without automatic repair','portrait-import',{source:alpha,flags:[]});
 const tall=h.readPng(source.roles[0].portrait);const image={width:64,height:96,data:new Uint8ClampedArray(64*96*4)};image.data.set(tall.data);const wrong=path.join(temp,'tall.png');h.writePng(wrong,image);
 await reject('native portrait rejects64x96 instead of shrinking it','portrait-import',{source:wrong,flags:[]});
 const colorful=h.readPng(source.roles[0].portrait);for(let i=0;i<16;i++){const index=((10+i)*64+10)*4;colorful.data.set([17+i*11,20+i*7,30+i*5,255],index);}const colors=path.join(temp,'colors.png');h.writePng(colors,colorful);
 await reject('native portrait rejects excess palette instead of quantizing','portrait-import',{source:colors,flags:[]});
 fs.mkdirSync(outDir,{recursive:true});fs.writeFileSync(path.join(outDir,'record.json'),JSON.stringify({checks,sourceMethod:source.method,scope:'Exact source/final RGBA for all34 native artifacts plus4 no-repair rejection controls. Pixel craft and campaign gameplay are separate reviews.'},null,2));fs.writeFileSync(path.join(outDir,'SUMMARY.md'),'# Direct native Python art controls\n\n'+checks.map(c=>'- PASS '+c.name).join('\n')+'\n');console.log(JSON.stringify({checks:checks.length,output:path.resolve(outDir)}));
}finally{fs.rmSync(temp,{recursive:true,force:true});}
