// QA sidecar: actual browser image tools and real configured image endpoint.
// The tiny HTML bridge is a test surface; it does not mock model/image responses.
import {createServer} from 'node:http';
import {chromium} from '@playwright/test';
const [base, imageProvider, imageModel] = process.argv.slice(2);
if (!base) throw Error('Usage: opening-assistant-browser-bridge.mjs <dev-origin> [image-provider image-model]');
const browser = await chromium.launch({headless:true});
const page = await browser.newPage();
await page.route('**/opening-assistant-qa.html', route => route.fulfill({contentType:'text/html',body:'<!doctype html><title>Opening authoring QA</title>'}));
await page.goto(new URL('/opening-assistant-qa.html',base).href);
if(imageProvider) await page.evaluate(async ({imageProvider,imageModel})=>{
 const c=await import('/src/ai/llmClient.ts'); c.saveAiConfig({...c.loadAiConfig(),imageProviderId:imageProvider,...(imageModel?{imageModel}:{})});
},{imageProvider,imageModel});
// Import all actual helpers before starting a model run. A cold Vite dependency
// optimization failure must fail startup, rather than poison every later image call.
await page.evaluate(async()=>{await import('/src/editor/openingImageGeneration.ts');await import('/src/editor/openingAnimaticPreview.ts');});
const server=createServer(async(req,res)=>{
 try{
  let body=''; for await(const part of req){body+=part; if(body.length>80_000_000)throw Error('QA payload too large');}
  const payload=JSON.parse(body);
  const value=await page.evaluate(async({operation,payload})=>{
   const m=await import('/src/editor/openingImageGeneration.ts');
   if(operation==='/generate') return m.generateOpeningStill(payload.args,{project:payload.project});
   if(operation==='/render') {
    const a=await import('/src/editor/openingAnimaticPreview.ts');
    const url=payload.toolName==='preview_opening_animatic'?await a.renderOpeningAnimaticPreview(payload.project,payload.data):payload.toolName==='preview_opening_reference'?await a.renderOpeningReferencePreview(payload.data):await m.renderOpeningImage(payload.project,payload.data);
    return {png:url.split(',')[1]};
   }
   throw Error('Unknown QA operation');
  },{operation:req.url,payload});
  res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(value));
 }catch(error){res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:String(error.message).slice(0,500)}));}
});
server.listen(0,'127.0.0.1',()=>process.stdout.write(JSON.stringify({ready:true,port:server.address().port})+'\n'));
const close=async()=>{server.close();await browser.close();process.exit(0);};process.on('SIGTERM',close);process.on('SIGINT',close);
