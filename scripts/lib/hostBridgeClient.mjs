// Headless content operations use the same authenticated HTTP dispatcher as the
// browser bridge. Credentials stay in memory; this never opens a project SQLite.
import {chromium} from 'playwright';
import {randomUUID} from 'node:crypto';
import {gzip} from 'node:zlib';
import {promisify} from 'node:util';
const zip=promisify(gzip);
export async function connectHostBridge(host){
 const url=new URL(host),pageUrl=new URL('/__oprn/team',url);pageUrl.search=url.search;
 if(!['http:','https:'].includes(url.protocol))throw Error('HTTP project host required');
 const browser=await chromium.launch();let config,cookie;
 try{
  const context=await browser.newContext(),page=await context.newPage();
  await page.goto(pageUrl.href,{waitUntil:'commit'});
  // The authenticated inline configuration is sufficient for the official
  // dispatcher. Waiting for the editor to mount makes headless persistence
  // depend on large catalog downloads and can trigger unrelated boot saves.
  await page.waitForFunction(()=>typeof window.__OPRN_BRIDGE__?.endpoint==='string'&&typeof window.__OPRN_BRIDGE__?.token==='string');
  config=await page.evaluate(()=>({endpoint:window.__OPRN_BRIDGE__.endpoint,token:window.__OPRN_BRIDGE__.token,requestBodyEncoding:window.__OPRN_BRIDGE__.requestBodyEncoding}));
  cookie=(await context.cookies(pageUrl.href)).map(c=>c.name+'='+c.value).join('; ');
 }finally{await browser.close();}
 const endpoint=new URL(config.endpoint,pageUrl);if(endpoint.origin!==url.origin)throw Error('Cross-origin bridge endpoint refused');
 const base={'content-type':'application/json','x-oprn-bridge-token':config.token,'x-oprn-session':randomUUID(),'x-oprn-project':url.searchParams.get('hostProject')??'',origin:url.origin};if(cookie)base.cookie=cookie;
 const requests=[];
 async function call(channel,payload){
  let body=Buffer.from(JSON.stringify({channel,payload}));const decodedBytes=body.length,headers={...base,'x-oprn-channel':channel};
  const documentChannel=['oprn:project.save','oprn:start.createProject'].includes(channel),limit=(documentChannel?256:64)*1024*1024;
  if(decodedBytes>limit)throw Error(channel+': decoded body exceeds host contract');
  if(config.requestBodyEncoding==='gzip'&&decodedBytes>1024*1024){const compressed=await zip(body);if(compressed.length<body.length&&compressed.length<=64*1024*1024){body=compressed;headers['content-encoding']='gzip';}}
  if(channel==='oprn:project.save')requests.push({channel,encoding:headers['content-encoding']??'identity',bodyBytes:body.length,decodedBytes});
  // A transport failure can follow a committed CAS. Never retry automatically.
  const response=await fetch(endpoint,{method:'POST',headers,body,signal:AbortSignal.timeout(600000)});
  if(!response.ok)throw Error(channel+': HTTP '+response.status+' '+await response.text());
  return response.json();
 }
 return {call,requests};
}
