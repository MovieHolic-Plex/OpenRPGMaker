import http from 'node:http';
import {readFile,writeFile,mkdir,readdir,stat,realpath} from 'node:fs/promises';
import {resolve,dirname,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
const root=dirname(fileURLToPath(import.meta.url)),site=resolve(root,'site');
const args=process.argv.slice(2),option=(key,fallback)=>{const at=args.indexOf(key);return at<0?fallback:args[at+1];};
const data=resolve(option('--data',resolve(root,'.data'))),port=Number(option('--port','18327')),host=option('--host','127.0.0.1');
if(!Number.isInteger(port)||port<1||port>65535)throw Error('Valid --port required');
await mkdir(data,{recursive:true});
const manifest=JSON.parse(await readFile(resolve(root,'manifest.json'),'utf8'));
async function verify(){for(const [path,expected] of Object.entries(manifest.files)){const hash=createHash('sha256').update(await readFile(resolve(root,path))).digest('hex');if(hash!==expected)throw Error('Package changed. Rebuild manifest before review: '+path);}}
await verify();
async function receipts(){const entries=[];for(const f of await readdir(data)){if(!/^review-.*\.json$/.test(f))continue;entries.push(JSON.parse(await readFile(resolve(data,f),'utf8')));}return entries.sort((a,b)=>a.at.localeCompare(b.at)||a.id.localeCompare(b.id));}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.gif':'image/gif','.wav':'audio/wav','.ogg':'audio/ogg','.woff2':'font/woff2'};
const server=http.createServer(async(req,res)=>{
 const send=(code,obj)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(obj));};
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/api/reviews'){
   await verify();
   if(req.method==='GET'){
    const decisions={};for(const receipt of await receipts())if(manifest.packages[receipt.group]===receipt.package)decisions[receipt.group]=receipt;
    send(200,{packages:manifest.packages,decisions});return;
   }
   if(req.method!=='POST'){send(405,{error:'Method not allowed'});return;}
   if(!req.headers.origin||new URL(req.headers.origin).host!==req.headers.host){send(403,{error:'Same-origin browser review required'});return;}
   if(!req.headers['content-type']?.startsWith('application/json')){send(415,{error:'JSON required'});return;}
   let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>4096){send(413,{error:'Review too large'});return;}}
   const value=JSON.parse(body),{group,decision,note,checks}=value;
   if(!Object.hasOwn(manifest.packages,group)||!['allow','deny'].includes(decision)||typeof note!=='string'||note.length>2000||!Array.isArray(checks)||checks.length!==2||checks.some(c=>typeof c!=='boolean')){send(400,{error:'Invalid review'});return;}
   if(value.package!==manifest.packages[group]){send(409,{error:'새 후보입니다. 새로고침한 뒤 다시 확인하세요.'});return;}
   if(decision==='allow'&&!checks.every(Boolean)||decision==='deny'&&!note.trim()){send(400,{error:'확인 항목 또는 수정 의견이 필요합니다.'});return;}
   const receipt={id:randomUUID(),at:new Date().toISOString(),group,decision,note:note.trim(),checks,package:value.package,source:'human-browser'};
   await writeFile(resolve(data,`review-${receipt.at.replaceAll(':','-')}-${receipt.id}.json`),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});send(201,receipt);return;
  }
  if(!['GET','HEAD'].includes(req.method)){send(405,{error:'Method not allowed'});return;}
  const file=resolve(site,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
  if(!file.startsWith(site+sep)){send(403,{error:'Forbidden'});return;}
  const actual=await realpath(file);if(!actual.startsWith(site+sep)){send(403,{error:'Forbidden'});return;}
  const info=await stat(actual);if(!info.isFile()){send(404,{error:'Not found'});return;}
  const bytes=await readFile(actual);res.writeHead(200,{'Content-Type':mime[extname(actual)]??'application/octet-stream','Content-Length':bytes.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:bytes);
 }catch(e){if(!res.headersSent)send(e.code==='ENOENT'?404:500,{error:e.code==='ENOENT'?'Not found':String(e.message)});else res.end();}
});
server.listen(port,host,()=>console.log(`Field kit review: http://${host}:${port}\nReview data: ${data}`));
