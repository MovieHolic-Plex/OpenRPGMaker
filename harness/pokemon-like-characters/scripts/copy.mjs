// Copy the complete tool, never credentials, dependencies, review stores or votes.
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..'),args=process.argv.slice(2);
if(args.length!==2||args[0]!=='--out')throw Error('node scripts/copy.mjs --out /path/to/harness/pokemon-like-characters');
const out=path.resolve(args[1]);if(out===root||out.startsWith(root+path.sep)||root.startsWith(out+path.sep)||fs.existsSync(out))throw Error('도구 밖의 새 경로를 지정하세요. 기존 폴더는 덮어쓰지 않습니다');
const excluded=new Set(['node_modules','.data','.exports','.venv','__pycache__','.git']);
fs.cpSync(root,out,{recursive:true,filter:p=>!path.relative(root,p).split(path.sep).some(part=>excluded.has(part))&&!p.endsWith('.pyc')&&!path.basename(p).startsWith('.env')&&!fs.lstatSync(p).isSymbolicLink()});
const files=fs.readdirSync(out,{recursive:true}).filter(p=>fs.statSync(path.join(out,p)).isFile()&&p!=='distribution.json').sort();
fs.writeFileSync(path.join(out,'distribution.json'),JSON.stringify({format:1,files:Object.fromEntries(files.map(p=>[p,createHash('sha256').update(fs.readFileSync(path.join(out,p))).digest('hex')]))},null,2)+'\n');
console.log(JSON.stringify({out,files:files.length,reviewDataCopied:false,editorRequired:false}));
