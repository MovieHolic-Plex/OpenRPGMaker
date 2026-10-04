// Actual browser GIF playback, not a canvas sprite animation substituted for it.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {chromium} from '@playwright/test';
const [gifFile, outDir] = process.argv.slice(2);
if(!outDir)throw Error('Usage: pokemon-hero-gif.mjs native-four-direction.gif output');
const out=path.resolve(outDir),bytes=await fs.readFile(gifFile);
await fs.mkdir(out,{recursive:true});
const html=`<!doctype html><meta charset="utf-8"><title>실제 GIF 재생 검수</title><style>body{margin:24px;background:#e8e5d9;color:#283b4a;font:16px/24px system-ui}h1{font-size:32px;line-height:40px;margin:0 0 16px}p{margin:0 0 16px}img{display:block;background:#e8e5d9;image-rendering:pixelated;margin:20px 0}#large{width:272px;height:128px}#native{width:68px;height:32px}</style><h1>주인공 · 실제 GIF</h1><p>위·오른쪽·아래·왼쪽 · 4배 / 1배</p><img id="large" src="data:image/gif;base64,${bytes.toString('base64')}"><img id="native" src="data:image/gif;base64,${bytes.toString('base64')}">`;
await fs.writeFile(path.join(out,'playback.html'),html);
const browser=await chromium.launch({args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:600,height:440},recordVideo:{dir:path.join(out,'video'),size:{width:600,height:440}}});
const page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(String(e)));
try{
 await page.goto('file://'+path.join(out,'playback.html'));
 await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth===68));
 for(let i=0;i<14;i++){
  await page.locator('#large').screenshot({path:path.join(out,`large-${i}.png`)});
  await page.locator('#native').screenshot({path:path.join(out,`native-${i}.png`)});
  await page.waitForTimeout(55);
 }
 await page.screenshot({path:path.join(out,'browser-playback.png')});
}finally{await context.close();await browser.close();}
if(errors.length)throw Error(errors.join('\n'));
const result=spawnSync('python3',['-c',`
from pathlib import Path
from PIL import Image
import json,sys
g=Image.open(sys.argv[1]);out=Path(sys.argv[2]);expected=[]
for i in range(g.n_frames):
 g.seek(i);f=g.convert('RGBA');bg=Image.new('RGBA',f.size,(232,229,217,255));bg.alpha_composite(f);expected.append(bg)
records=[]
for scale,prefix in [(1,'native'),(4,'large')]:
 matches=[]
 for i in range(14):
  actual=Image.open(out/f'{prefix}-{i}.png').convert('RGBA');assert actual.size==(68*scale,32*scale)
  found=[phase for phase,e in enumerate(expected) if e.resize(actual.size,Image.Resampling.NEAREST).tobytes()==actual.tobytes()]
  assert found,(prefix,i,'Browser pixels differ from real native GIF')
  matches.append(found[0])
 assert len(set(matches))==3,(prefix,'Not all actual GIF poses observed')
 records.append({'scale':scale,'samples':14,'observedGifFrames':matches,'distinctNativePoses':3,'nativePixelsMatch':True})
print(json.dumps(records))
`,path.resolve(gifFile),out],{encoding:'utf8'});
if(result.status!==0)throw Error(result.stderr+result.stdout);
const record={gifSha256:createHash('sha256').update(bytes).digest('hex'),scope:'Actual animated HTMLImageElement screenshot pixels at1x/4x equal decoded native GIF frames; three distinct poses observed at each scale. No canvas or CSS pose animation.',checks:JSON.parse(result.stdout),errors};
await fs.writeFile(path.join(out,'record.json'),JSON.stringify(record,null,2));
console.log(JSON.stringify(record));
