/** Dedicated focused portrait gate. No repository suites or shared server. */
import {build} from 'esbuild';
import {mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {chromium} from 'playwright';
const dir=import.meta.dirname,temp=mkdtempSync(join(tmpdir(),'pokemon-portrait-executable-')),out=join(temp,'verify.cjs');
await build({entryPoints:[join(dir,'verifyPortrait.ts')],outfile:out,bundle:true,platform:'node',format:'cjs',logLevel:'silent',define:{'import.meta.dirname':JSON.stringify(dir)}});
const child=spawnSync(process.execPath,[out],{encoding:'utf8'});
if(child.status!==0){process.stderr.write(child.stderr);process.stdout.write(child.stdout);process.exitCode=child.status??1;}
else{
  const report=JSON.parse(child.stdout.trim()),browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:960,height:640}}),errors=[];page.on('pageerror',error=>errors.push(String(error)));
    await page.goto(pathToFileURL(report.preview).href);await page.waitForFunction(()=>[...document.images].length===3&&[...document.images].every(i=>i.complete&&i.naturalWidth===64&&i.naturalHeight===64));
    const scales=await page.locator('img').evaluateAll(images=>images.map(i=>({scale:Number(i.dataset.scale),width:i.getBoundingClientRect().width,height:i.getBoundingClientRect().height,rendering:getComputedStyle(i).imageRendering})));
    if(errors.length||scales.some(i=>i.width!==i.scale*64||i.height!==i.scale*64||i.rendering!=='pixelated'))throw Error('Static preview native1x2x3x geometry/browser errors');
    report.results.push({name:'browser static1x2x3x PNG geometry and pixelated display',pass:true});report.count++;report.previewScales=scales;report.browserErrors=errors;
    await page.screenshot({path:join(report.base,'preview-native-scales.png')});writeFileSync(join(report.base,'verification.json'),JSON.stringify(report,null,2));
    writeFileSync(join(report.base,'SUMMARY.md'),'# Trainer portrait lifecycle focused gate\n\n'+report.results.map(r=>`- PASS ${r.name}`).join('\n')+'\n\nInspect preview-native-scales.png.\n\n'+report.limitations+'\n');
    console.log(JSON.stringify({base:report.base,count:report.count,errors:errors.length,output:report.output}));
  }finally{await browser.close()}
}
