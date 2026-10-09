#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {python} from './lib/python.mjs';
const ROOT=path.dirname(fileURLToPath(import.meta.url));
const help=`Pokémon-like Character Harness (Node 24 + Python 3.10+ / Pillow 12.1.1)
  node cli.mjs doctor
  node cli.mjs templates
  node cli.mjs prepare [--data PATH]
  node cli.mjs new --from explorer --name NAME --out DRAFT
  node cli.mjs render --draft DRAFT --out BUNDLE [--data PATH]
  node cli.mjs queue --bundle BUNDLE [--data PATH]
  node cli.mjs serve [--data PATH] [--host 127.0.0.1] [--port 18317]
  node cli.mjs status [--data PATH]
  node cli.mjs verify [--data PATH]
  node cli.mjs export --id ID --out EMPTY_DIR [--data PATH]
No AI/API keys or editor needed. Edits are explicit pixel rows. Only browser users approve.
POKEMON_HARNESS_PYTHON selects a Python/venv; POKEMON_HARNESS_DATA selects a store.
`;
export function doctor(){
 const r=python(['-c','import sys,PIL; assert sys.version_info >= (3,10); assert PIL.__version__ == "12.1.1", "Install requirements.txt"; print(sys.version.split()[0]+" / Pillow "+PIL.__version__)'],{encoding:'utf8'});
 if(Number(process.versions.node.split('.')[0])<24)throw Error('Node.js 24 이상을 설치하세요');
 if(r.status!==0)throw Error('Python/Pillow 필요: python3 -m pip install -r requirements.txt\n'+(r.stderr||r.error?.message));
 if(!fs.existsSync(path.join(ROOT,'lib/native.cjs')))throw Error('lib/native.cjs 누락. npm ci && npm run build:core');
 return {node:process.version,python:r.stdout.trim(),root:ROOT,editorRequired:false,npmRuntimeDependencies:0};
}
export async function run(argv){
 const [stage,...rest]=argv;
 if(!stage||['help','--help','-h'].includes(stage)){console.log(help);return;}
 const permitted={doctor:[],templates:[],prepare:['data'],new:['from','name','out'],render:['draft','out','data'],queue:['bundle','data'],serve:['data','host','port'],status:['data'],verify:['data'],export:['id','out','data']};
 if(!permitted[stage])throw Error('알 수 없는 명령: '+stage+'\n'+help);
 const flags={};for(let i=0;i<rest.length;i+=2){const key=rest[i].slice(2);if(!rest[i].startsWith('--')||!permitted[stage].includes(key)||flags[key]!==undefined||!rest[i+1]||rest[i+1].startsWith('--'))throw Error('잘못된 옵션: '+rest[i]);flags[key]=rest[i+1];}
 const need=(...names)=>{for(const name of names)if(!flags[name])throw Error('--'+name+' 필요');};
 if(stage==='doctor'){console.log(JSON.stringify(doctor(),null,2));return;}
 if(stage==='templates'){
  console.log(JSON.stringify(fs.readdirSync(path.join(ROOT,'examples')).map(role=>({role,...JSON.parse(fs.readFileSync(path.join(ROOT,'examples',role,'candidate.json'),'utf8'))})),null,2));return;
 }
 doctor();
 const {DEFAULT_DATA,openStore,list,queue,buildApproved,packageFor}=await import('./lib/store.mjs');
 const data=path.resolve(flags.data??DEFAULT_DATA);
 if(stage==='serve'){
  const {serve}=await import('./lib/server.mjs');const server=await serve({data,host:flags.host??'127.0.0.1',port:Number(flags.port??18317)});
  const stop=()=>server.close();process.once('SIGINT',stop);process.once('SIGTERM',stop);await new Promise(resolve=>server.once('close',resolve));return;
 }
 const {newDraft,renderDraft,prepare}=await import('./lib/workflow.mjs');
 if(stage==='new'){need('from','name','out');console.log(JSON.stringify(newDraft(flags.from,flags.name,flags.out),null,2));return;}
 const store=openStore(data);
 try{
  let result;
  if(stage==='prepare')result=prepare(store);
  if(stage==='render'){need('draft','out');result={id:queue(store,renderDraft(flags.draft,flags.out)),autoApproved:0};}
  if(stage==='queue'){need('bundle');result={id:queue(store,flags.bundle),autoApproved:0};}
  if(stage==='status'){const items=list(store);result={data,counts:items.reduce((a,i)=>(a[i.state]=(a[i.state]??0)+1,a),{}),items};}
  if(stage==='verify'){
   const items=list(store);if(!items.length)throw Error('후보가 없습니다. prepare 또는 render 먼저 실행하세요');
   for(const item of items){const pkg=packageFor(store,item.id);const r=python([path.join(ROOT,'lib/verify_bundle.py'),'--bundle',pkg.folder],{encoding:'utf8'});if(r.status!==0)throw Error(item.id+': '+r.stderr);}
   result={pass:true,candidates:items.length,scope:'Package hashes, native implementation, original template replay, PNG/GIF pixels and timing. Human appearance review is separate.'};
  }
  if(stage==='export'){need('id','out');result=buildApproved(store,flags.id,flags.out);}
  console.log(JSON.stringify(result,null,2));
 }finally{store.db.close();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))run(process.argv.slice(2)).catch(e=>{console.error(e.message);process.exitCode=1;});
