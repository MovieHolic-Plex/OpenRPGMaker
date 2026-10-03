// The exported player build, with public asset fallback; no editor shell or database bridge.
import { createServer } from "node:http";
import { createReadStream,existsSync } from "node:fs";
import { resolve,extname } from "node:path";
export async function startProductionPlayerPreview(){
 const roots=[resolve("dist/export-player"),resolve("public")],types={".html":"text/html",".js":"text/javascript",".css":"text/css",".json":"application/json",".png":"image/png",".webp":"image/webp",".svg":"image/svg+xml",".ogg":"audio/ogg",".mp3":"audio/mpeg"};
 if(!existsSync(resolve(roots[0],"player.html")))throw new Error("Run npm run build:player first");
 const server=createServer((req,res)=>{let path;try{path=decodeURIComponent(new URL(req.url,"http://127.0.0.1").pathname).replace(/^\/+/,"");}catch{res.writeHead(400).end();return;}const file=roots.map(root=>resolve(root,path)).find((file,n)=>file.startsWith(roots[n]+"/")&&existsSync(file));if(!file){res.writeHead(404).end();return;}res.setHeader("Content-Type",types[extname(file)]??"application/octet-stream");const stream=createReadStream(file);stream.on("error",()=>res.destroy());stream.pipe(res);});
 await new Promise(r=>server.listen(0,"127.0.0.1",r));return {url:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(r=>{server.closeAllConnections();server.close(r);})};
}
