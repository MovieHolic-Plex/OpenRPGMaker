import { firefox } from '/home/main/z-project/rpg-zzu/node_modules/playwright/index.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
const out=new URL('./',import.meta.url).pathname;
const project=await readFile(out+'canonical-project.json','utf8');
const browser=await firefox.launch({headless:true});
const context=await browser.newContext({viewport:{width:1024,height:768}});
const page=await context.newPage();
const log={startedAt:new Date().toISOString(),url:'http://127.0.0.1:9841/export-player/player.html',projectSha256:createHash('sha256').update(project).digest('hex'),browserVersion:browser.version(),errors:[],failedRequests:[],actions:[],loadedCode:[],cleanup:[]};
page.on('pageerror',e=>log.errors.push(e.message));
page.on('requestfailed',r=>log.failedRequests.push({url:r.url(),error:r.failure()}));
const responses=[];
page.on('response',r=>{if(/\.(js|css)(\?|$)/.test(r.url()))responses.push((async()=>{const bytes=await r.body();log.loadedCode.push({url:r.url(),status:r.status(),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),comparison:bytes.includes(Buffer.from('shop-detail-open'))});})());});
await page.route('**/__runtime-qa/project.json',r=>r.fulfill({contentType:'application/json',body:project}));
await page.route('**/export-player/**',async route=>{const path=new URL(route.request().url()).pathname.replace('/export-player/','/');try{const bytes=await readFile('/home/main/z-project/rpg-zzu/public'+path);const types={js:'text/javascript',png:'image/png',ogg:'audio/ogg',webp:'image/webp',json:'application/json'};await route.fulfill({body:bytes,contentType:types[path.split('.').pop()]??'application/octet-stream'});}catch(error){if(error.code!=='ENOENT'&&error.code!=='EISDIR')throw error;await route.continue();}});
await page.addInitScript(()=>{window.__OPENRPG_BOOT__={projectUrl:'/__runtime-qa/project.json',saveNamespace:'st_01a07fdb:keyboard-readonly',qaInstrumentation:true};});
const server=createServer(async(req,res)=>{let data='';for await(const part of req)data+=part;try{const c=JSON.parse(data||'{}');let value;
 if(c.op==='eval')value=await page.evaluate(c.code,c.arg);
 else if(c.op==='key'){await page.keyboard.press(c.key);value=true;}
 else if(c.op==='resize'){await page.setViewportSize(c.viewport);value=page.viewportSize();}
 else if(c.op==='shot'){await page.screenshot({path:out+c.name});value=c.name;}
 else if(c.op==='goto'){await page.goto(log.url,{waitUntil:'domcontentloaded',timeout:120000});value=await page.title();}
 else if(c.op==='close'){await Promise.all(responses);await page.close();log.cleanup.push({resource:'page',closed:page.isClosed()});await context.close();log.cleanup.push({resource:'context',closed:true});await browser.close();log.cleanup.push({resource:'browser',closed:!browser.isConnected()});value=log.cleanup;server.close(()=>process.exit());}
 else throw new Error('Unknown op');
 log.actions.push({at:new Date().toISOString(),command:c,result:value});await writeFile(out+'browser-session.json',JSON.stringify(log,null,2));res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({value}));
 }catch(e){log.errors.push(String(e));await writeFile(out+'browser-session.json',JSON.stringify(log,null,2));res.writeHead(500).end(JSON.stringify({error:String(e)}));}});
server.listen(0,'127.0.0.1',async()=>{await writeFile(out+'browser-control.json',JSON.stringify({pid:process.pid,port:server.address().port}));console.log(JSON.stringify({pid:process.pid,port:server.address().port}));});
