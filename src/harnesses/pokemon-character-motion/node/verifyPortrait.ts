/** Synthetic negative controls and ledger checks; no generated-art approval. */
import {strict as assert} from 'node:assert';
import {mkdtempSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createImage,cloneImage,setPixel,opaqueBounds} from '../../monster-collect-species/pixel/image';
import {readPng,writePng} from '../../monster-collect-species/node/png';
import {checkTrainerPortrait,prepareTrainerPortrait,TRAINER_PORTRAIT} from './portrait';
import {sha,VERSION} from './motion';
import {run} from './cli';

const base=mkdtempSync(join(tmpdir(),'pokemon-portrait-verifier-')),results:{name:string,pass:boolean}[]=[];
const check=(name:string,pass:boolean)=>{assert(pass,name);results.push({name,pass:true});};
const legacy=createImage(64,96);for(let y=5;y<75;y++)for(let x=22;x<42;x++)setPixel(legacy,x,y,[30,70,100,255]);
const source=join(base,'source.png'),prompt=join(base,'prompt.txt');writePng(source,legacy);writeFileSync(prompt,'Synthetic existing-pixel extraction/ledger fixture; never publish this as art.');
const execute=async(stage:string,args:string[]=[])=>{
  const log=console.log,error=console.error,messages:string[]=[];console.log=(...v:unknown[])=>messages.push(v.map(String).join(' '));console.error=(...v:unknown[])=>messages.push(v.map(String).join(' '));
  try{return {code:await run([stage,'--sandbox',base,...args]),messages};}finally{console.log=log;console.error=error;}
};
async function main(){
  const prepared=prepareTrainerPortrait(legacy),native=prepared.image;
  check('legacy64x96 extracts uniform nearest fit within62ink',native.width===64&&native.height===64&&prepared.scale===62/70&&opaqueBounds(native)!.y+opaqueBounds(native)!.height===63&&checkTrainerPortrait(native).pass);
  check('unconverted64x96 rejects native portrait check',!checkTrainerPortrait(legacy).pass);
  const sixteen=createImage(64,64);for(let i=0;i<16;i++)setPixel(sixteen,20+i%4,20+Math.floor(i/4),[i*13,i*5,180-i*7,255]);
  check('16opaque colors rejects',!checkTrainerPortrait(sixteen).pass);
  const empty=createImage(64,64);check('empty portrait rejects',!checkTrainerPortrait(empty).pass);
  const partial=cloneImage(native);setPixel(partial,30,30,[30,70,100,128]);check('partial alpha rejects',!checkTrainerPortrait(partial).pass);
  const clipped=cloneImage(native);setPixel(clipped,0,30,[30,70,100,255]);check('missing transparent margin rejects',!checkTrainerPortrait(clipped).pass);
  const threshold=createImage(2,2);setPixel(threshold,0,0,[30,70,100,127]);setPixel(threshold,1,1,[30,70,100,128]);
  const th=prepareTrainerPortrait(threshold).image;check('alpha127 dropped and128 retained binary',Array.from(th.data).filter((v,i)=>i%4===3&&v===255).length===1&&!Array.from(th.data).some((v,i)=>i%4===3&&v!==0&&v!==255));
  for(const [name,image] of [['64x96',legacy],['16colors',sixteen],['empty',empty],['partial-alpha',partial]] as const){const p=join(base,name+'.png');writePng(p,image);check('CLI direct portrait check rejects '+name,(await execute('check',['--kind','portrait','--source',p])).code===1);}
  check('unknown role rejects',(await execute('portrait-import',['--role','unknown','--source',source,'--prompt-file',prompt])).code===1);
  const emptyPath=join(base,'empty.png');check('empty source import rejects',(await execute('portrait-import',['--role','hero','--source',emptyPath,'--prompt-file',prompt])).code===1);
  const imported=await execute('portrait-import',['--role','hero_back','--source',source,'--prompt-file',prompt]);assert.equal(imported.code,0);const candidate=imported.messages.find(s=>s.includes('/candidates/'))!;assert(candidate);
  const provenance=JSON.parse(readFileSync(join(candidate,'provenance.json'),'utf8'));
  check('source prompt final hashes are preserved',provenance.kind==='portrait'&&provenance.sourceSha256===sha(readFileSync(source))&&provenance.promptSha256===sha(readFileSync(prompt))&&provenance.finalSha256===sha(readFileSync(join(candidate,'portrait.png')))&&JSON.stringify(provenance.contract)===JSON.stringify(TRAINER_PORTRAIT));
  check('portrait bypasses only field16 contract',(await execute('check',['--candidate',candidate])).code===0);
  check('structural-only passes',(await execute('gate',['--candidate',candidate,'--structural-only'])).code===0);
  check('structural pass alone cannot build',(await execute('build',['--candidate',candidate])).code===1);
  check('missing review blocks gate',(await execute('gate',['--candidate',candidate])).code===1);
  check('preview produces static native scales',(await execute('preview',['--candidate',candidate])).code===0&&readFileSync(join(candidate,'preview.html'),'utf8').includes('data-scale="3"'));
  const evidence=join(base,'fixture-evidence.txt');writeFileSync(evidence,'Fixture gate ledger only. No supervisor art selection or real picture approval.');
  const reviewArgs=['--candidate',candidate,'--who','executable-fixture','--why','mechanics only; not art approval','--verdict','pass','--evidence',evidence];
  check('current fixture evidence permits review',(await execute('review',reviewArgs)).code===0);
  check('review alone cannot bypass failed gate',(await execute('build',['--candidate',candidate])).code===1);
  check('full review gate build lifecycle',(await execute('gate',['--candidate',candidate])).code===0&&(await execute('build',['--candidate',candidate])).code===0);
  const output=join(base,'output','portraits','hero_back'),motion=JSON.parse(readFileSync(join(output,'motion.json'),'utf8'));
  check('build has portrait contract and no field adapter',['portrait.png','provenance.json','review.json','gate.json','motion.json'].every(f=>existsSync(join(output,f)))&&!existsSync(join(output,'charset.png'))&&!existsSync(join(output,'editor-charset.png'))&&motion.kind==='portrait'&&motion.frameCount===1&&motion.width===64&&motion.height===64&&readPng(join(output,'portrait.png')).height===64);
  const snap=JSON.parse(readFileSync(join(candidate,'check.json'),'utf8'));
  const files=['cli.ts','motion.ts','portrait.ts','../../monster-collect-species/pixel/grid.ts','../../monster-collect-species/pixel/image.ts','../../monster-collect-species/pixel/oklab.ts','../../monster-collect-species/node/png.ts'];
  const {resolve}=await import('node:path');check('implementation fingerprint includes portrait helper',snap.implementationSha256===sha(files.map(f=>sha(readFileSync(resolve(import.meta.dirname,f)))).join(':')));
  for(const file of ['source.png','prompt.txt','portrait.png']){
    const p=join(candidate,file),original=readFileSync(p);writeFileSync(p,Buffer.concat([original,Buffer.from('mutated')]));check(file+' mutation blocks build',(await execute('build',['--candidate',candidate])).code===1);writeFileSync(p,original);
  }
  const reviewPath=join(candidate,'review.json'),reviewBytes=readFileSync(reviewPath),review=JSON.parse(reviewBytes.toString());
  for(const [name,change] of [['version',{version:'obsolete'}],['implementation',{implementationSha256:'old-helper'}],['contract',{limits:{width:64,height:96}}]] as const){writeFileSync(reviewPath,JSON.stringify({...review,...change}));check('stale '+name+' review blocks gate',(await execute('gate',['--candidate',candidate])).code===1);writeFileSync(reviewPath,reviewBytes);}
  const evidencePath=join(candidate,'review-evidence-0.txt'),evidenceBytes=readFileSync(evidencePath);writeFileSync(evidencePath,'mutated');check('mutated review evidence blocks gate',(await execute('gate',['--candidate',candidate])).code===1);writeFileSync(evidencePath,evidenceBytes);
  const previewPath=join(candidate,'preview.html'),previewBytes=readFileSync(previewPath);writeFileSync(previewPath,Buffer.concat([previewBytes,Buffer.from('mutated')]));check('mutated preview blocks gate',(await execute('gate',['--candidate',candidate])).code===1);writeFileSync(previewPath,previewBytes);
  const receiptPath=join(candidate,'preview-receipt.json'),receipt=JSON.parse(readFileSync(receiptPath,'utf8'));writeFileSync(receiptPath,JSON.stringify({...receipt,implementationSha256:'old-preview'}));check('stale preview implementation blocks new review',(await execute('review',reviewArgs)).code===1);writeFileSync(receiptPath,JSON.stringify(receipt));
  check('restored exact ledger can gate and build again',(await execute('gate',['--candidate',candidate])).code===0&&(await execute('build',['--candidate',candidate])).code===0);
  const report={version:VERSION,base,candidate,preview:previewPath,output,results,count:results.length,limitations:'Synthetic extraction pixels and fixture review evidence. Ledger verification, never shipping art approval.'};writeFileSync(join(base,'verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
