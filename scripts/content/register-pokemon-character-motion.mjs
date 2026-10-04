// Registers only reviewed, current harness builds. No remote/project-store writes.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const [selectionFile]=process.argv.slice(2);
if(!selectionFile)throw Error('Usage: node scripts/content/register-pokemon-character-motion.mjs <explicit-reviewed-candidates.json>');
const selection=JSON.parse(fs.readFileSync(selectionFile,'utf8'));
const roles=['hero','rival','professor','nurse','merchant','mother','resident','gym_leader','company_agent','captain','worker','explorer','student','ranger','moon_leader','hiker'];
if(Object.keys(selection.walk??{}).length!==roles.length||roles.some(role=>!selection.walk[role])||!selection.clip||Object.keys(selection.trainers??{}).length!==17||[...roles,'hero_back'].some(role=>!selection.trainers[role]))throw Error('All sixteen roles and the professor clip require an explicit selection');
const root=process.cwd(),dir=path.resolve('src/harnesses/pokemon-character-motion/node'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'pokemon-motion-register-'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const authored=selection.authoring?JSON.parse(fs.readFileSync(selection.authoring,'utf8')):null;
if(authored){
  if(authored.method!=='python-native-pixel-authoring'||authored.resizing!==false||authored.quantization!==false)throw Error('Wrong native authoring declaration');
  for(const [file,sha] of Object.entries(authored.sources))if(hash(fs.readFileSync(path.resolve('scripts/asset-gen/pokemon-characters',file)))!==sha)throw Error('Authored Python source changed: '+file);
}
try {
  const entry=path.join(temp,'entry.ts'),compiled=path.join(temp,'harness.cjs');
  fs.writeFileSync(entry,'export {run} from '+JSON.stringify(path.join(dir,'cli.ts'))+';\nexport * from '+JSON.stringify(path.resolve('src/harnesses/monster-collect-species/node/png.ts'))+';\nexport * from '+JSON.stringify(path.resolve('src/harnesses/monster-collect-species/pixel/image.ts'))+';');
  await build({entryPoints:[entry],outfile:compiled,bundle:true,platform:'node',format:'cjs',logLevel:'silent',define:{'import.meta.dirname':JSON.stringify(dir)}});
  const h=createRequire(import.meta.url)(compiled),outputs=new Map();
  // Prepare every role first; a failure leaves the shared catalog untouched.
  for(const role of [...roles,'professor-intro',...[...roles,'hero_back'].map(role=>'trainer-'+role)]){
    const trainer=role.startsWith('trainer-');
    const candidate=path.resolve(trainer?selection.trainers[role.slice(8)]:role==='professor-intro'?selection.clip:selection.walk[role]),out=path.join(temp,'output',role);
    if(await h.run(['gate','--candidate',candidate])!==0)throw Error('Current gate rejected '+role);
    if(await h.run(['build','--candidate',candidate,'--out',out])!==0)throw Error('Current build rejected '+role);
    const provenance=JSON.parse(fs.readFileSync(path.join(out,'provenance.json'),'utf8'));
    if(provenance.role!==(trainer?role.slice(8):role==='professor-intro'?'professor':role))throw Error('Wrong role '+role);
    if(authored){
      const key=trainer?role.slice(8):role;
      const record=authored.roles.find(r=>r.role===key);
      const expected=role==='professor-intro'?authored.professorClip.sha256:key==='hero_back'?authored.heroBack.sha256:trainer?record?.portraitSha256:record?.charsetSha256;
      if(provenance.mode!=='native'||provenance.sourceSha256!==expected)throw Error('Authored native source mismatch: '+role);
      const src=h.readPng(path.join(candidate,'source.png')),final=h.readPng(path.join(out,trainer?'portrait.png':role==='professor-intro'?'clip.png':'charset.png'));
      if(src.width!==final.width||src.height!==final.height||!Buffer.from(src.data).equals(Buffer.from(final.data)))throw Error('Native authoring import changed pixels: '+role);
    }
    outputs.set(role,{candidate,out,provenance});
  }
  const sheets=[h.createImage(288,256),h.createImage(288,256)];
  const blit=(dst,src,x,y)=>{for(let yy=0;yy<src.height;yy++)for(let xx=0;xx<src.width;xx++)h.setPixel(dst,x+xx,y+yy,h.pixelAt(src,xx,yy));};
  for(const [i,role] of roles.entries()){
    const output=outputs.get(role),native=h.readPng(path.join(output.out,'charset.png')),adapter=h.readPng(path.join(output.out,'editor-charset.png'));
    if(native.width!==48||native.height!==128||adapter.width!==72||adapter.height!==128)throw Error('Native16x32/editor24x32 distinction missing: '+role);
    // The adapter must add transparent4px gutters only, without resizing or changing a single native pixel.
    for(let row=0;row<4;row++)for(let col=0;col<3;col++)for(let y=0;y<32;y++)for(let x=0;x<24;x++){
      const p=h.pixelAt(adapter,col*24+x,row*32+y),expected=x>=4&&x<20?h.pixelAt(native,col*16+x-4,row*32+y):[0,0,0,0];
      if(p.some((v,k)=>v!==expected[k]))throw Error('Adapter changes native pixels: '+role);
    }
    blit(sheets[Math.floor(i/8)],adapter,(i%4)*72,Math.floor((i%8)/4)*128);
  }
  const clip=h.readPng(path.join(outputs.get('professor-intro').out,'clip.png'));
  if(clip.width!==384||clip.height!==64)throw Error('Emerald professor portrait must use six64x64 frames');
  for(const role of [...roles,'hero_back']){const portrait=h.readPng(path.join(outputs.get('trainer-'+role).out,'portrait.png'));if(portrait.width!==64||portrait.height!==64)throw Error('Native trainer64x64 required: '+role);}
  const dest=path.resolve('public/assets/harnesses/pokemon-character-motion/emerald'),castDir=path.resolve('public/assets/emerald-monster/cast');
  fs.mkdirSync(dest,{recursive:true});
  const catalog=JSON.parse(fs.readFileSync(path.join(castDir,'uploaded-cast.json'),'utf8'));
  const previous=JSON.parse(fs.readFileSync(path.join(castDir,'catalog.json'),'utf8'));
  const professor=JSON.parse(fs.readFileSync('public/assets/emerald-monster/professor-asset.json','utf8'));
  if(professor.id!=='oprn_emerald_professor')throw Error('Wrong existing professor identity');
  for(const role of [...roles,'hero_back'])if(!catalog['oprn_emerald_trainer_'+role])throw Error('Existing trainer identity missing '+role);
  for(let i=0;i<2;i++){
    const file='cast-'+(i+1)+'.png';h.writePng(path.join(castDir,file),sheets[i]);
    const id='oprn_emerald_field_cast_'+(i+1),bytes=fs.readFileSync(path.join(castDir,file));catalog[id]={...catalog[id],dataUrl:'data:image/png;base64,'+bytes.toString('base64')};
  }
  for(const role of [...roles,'hero_back']){
    const file='trainer-'+role+'.png',id='oprn_emerald_trainer_'+role,output=outputs.get('trainer-'+role);
    if(!catalog[id])throw Error('Existing trainer identity missing '+id);
    fs.copyFileSync(path.join(output.out,'portrait.png'),path.join(castDir,file));
    catalog[id]={...catalog[id],dataUrl:'data:image/png;base64,'+fs.readFileSync(path.join(castDir,file)).toString('base64'),meta:{...catalog[id].meta,width:64,height:64}};
  }
  const ledger=[];
  for(const [role,output] of outputs){
    const target=path.join(dest,role);fs.mkdirSync(target,{recursive:true});
    for(const file of fs.readdirSync(output.out))fs.copyFileSync(path.join(output.out,file),path.join(target,file));
    const evidence=JSON.parse(fs.readFileSync(path.join(output.candidate,'review.json'),'utf8')).evidence;
    for(const e of evidence)fs.copyFileSync(path.join(output.candidate,e.file),path.join(target,e.file));
    fs.copyFileSync(path.join(output.candidate,'prompt.txt'),path.join(target,'prompt.txt'));
    ledger.push({role,source:output.candidate,sourceSha256:output.provenance.sourceSha256,promptSha256:output.provenance.promptSha256,finalSha256:output.provenance.finalSha256,gateSha256:hash(fs.readFileSync(path.join(output.out,'gate.json')))});
  }
  const clipBytes=fs.readFileSync(path.join(outputs.get('professor-intro').out,'clip.png'));
  const clipAsset={id:'oprn_emerald_professor_motion',kind:'picture',name:'비취섬 천문박사 · 6개 실제 도트 자세',dataUrl:'data:image/png;base64,'+clipBytes.toString('base64'),meta:{mime:'image/png',width:384,height:64}};
  fs.writeFileSync(path.join(dest,'professor-motion-asset.json'),JSON.stringify(clipAsset));
  const still=h.createImage(64,64);for(let y=0;y<64;y++)for(let x=0;x<64;x++)h.setPixel(still,x,y,h.pixelAt(clip,x,y));
  h.writePng(path.join(dest,'professor-still.png'),still);
  professor.dataUrl='data:image/png;base64,'+fs.readFileSync(path.join(dest,'professor-still.png')).toString('base64');professor.meta={mime:'image/png',width:64,height:64};
  fs.writeFileSync('public/assets/emerald-monster/professor-asset.json',JSON.stringify(professor));
  fs.writeFileSync(path.join(castDir,'uploaded-cast.json'),JSON.stringify(catalog));
  for(const a of previous)if(a.id.startsWith('oprn_emerald_field_cast_')||a.id.startsWith('oprn_emerald_trainer_')){a.sha256=hash(Buffer.from(catalog[a.id].dataUrl.split(',')[1],'base64'));a.meta={...catalog[a.id].meta};a.source='public/assets/harnesses/pokemon-character-motion/emerald/generation.json';a.pipeline='scripts/content/register-pokemon-character-motion.mjs';}
  fs.writeFileSync(path.join(castDir,'catalog.json'),JSON.stringify(previous,null,2));
  if(authored)fs.copyFileSync(selection.authoring,path.join(dest,'authoring.json'));
  fs.writeFileSync(path.join(dest,'generation.json'),JSON.stringify({version:2,native:{frameWidth:16,frameHeight:32,opaqueColorsMax:15},editorAdapter:{frameWidth:24,frameHeight:32,paddingX:4,resizing:false},imageGeneration:authored?'none / native Python pixels':'builtin-imagegen',...(authored?{authoring:{method:authored.method,manifestSha256:hash(fs.readFileSync(selection.authoring)),sources:authored.sources}}:{}),roles:ledger},null,2));
  console.log(JSON.stringify({sharedRoles:roles.length,nativeWalkingFrames:192,professorFrames:6,trainerPortraits:17,canonicalSaved:false}));
} finally {fs.rmSync(temp,{recursive:true,force:true});}
