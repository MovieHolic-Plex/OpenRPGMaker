// Dedicated compiled player QA; no editor shell or Vite module graph.
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
export async function startPackagedPlayerQaServer(options={}) {
 const roots=options.packageDir?[resolve(options.packageDir)]:[resolve('dist/export-player'),resolve('public')];
 const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.woff2':'font/woff2','.ogg':'audio/ogg','.mp3':'audio/mpeg'};
 const server=createServer((req,res)=>{void(async()=>{
  let name;try{name=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).replace(/^\//,'');}catch{res.writeHead(400).end();return;}
  if(name==='__runtime-qa/project.json'&&options.projectJson){res.writeHead(200,{'content-type':'application/json'}).end(options.projectJson);return;}
  if(name.split('/').some(p=>p==='..'||p.startsWith('.'))){res.writeHead(403).end();return;}
  for(const root of roots){const path=resolve(root,name);if(!path.startsWith(root+sep))continue;try{if(!(await stat(path)).isFile())continue;const data=await readFile(path);res.writeHead(200,{'content-type':mime[extname(path)]??'application/octet-stream'}).end(data);return;}catch{}}
  res.writeHead(404).end();
 })().catch(()=>res.writeHead(500).end());});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 return {url:'http://127.0.0.1:'+server.address().port,close:()=>new Promise(r=>server.close(r))};
}
