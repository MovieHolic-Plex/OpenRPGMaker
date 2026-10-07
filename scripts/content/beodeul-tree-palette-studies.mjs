import fs from 'node:fs';
import assert from 'node:assert/strict';
import {PNG} from 'pngjs';
import crypto from 'node:crypto';
const INPUT='tiledata/beodeul-ground/tree-studies',OUT='tiledata/beodeul-ground/tree-palette-studies';
fs.mkdirSync(OUT,{recursive:true});fs.mkdirSync('verify-shots/beodeul-tree-palette',{recursive:true});
const read=p=>PNG.sync.read(fs.readFileSync(p)),blank=(w,h)=>new PNG({width:w,height:h});
const get=(im,x,y)=>Array.from(im.data.subarray((y*im.width+x)*4,(y*im.width+x)*4+4));
const put=(im,x,y,c)=>{if(x>=0&&y>=0&&x<im.width&&y<im.height)im.data.set(c,(y*im.width+x)*4);};
function stamp(im,src,ox,oy){for(let y=0;y<src.height;y++)for(let x=0;x<src.width;x++){
 const c=get(src,x,y);if(!c[3]||ox+x>=im.width||oy+y>=im.height)continue;
 const b=get(im,x+ox,y+oy),a=c[3]/255,oa=a+b[3]/255*(1-a);
 put(im,x+ox,y+oy,[0,1,2].map(i=>Math.round((c[i]*a+b[i]*b[3]/255*(1-a))/oa)).concat(Math.round(oa*255)));
}}
const IDS=['03a8f7','3e8732','1a786c'];
const bodies=IDS.map(id=>read(`${INPUT}/current-${id}-body.png`));
const shadows=IDS.map(id=>read(`${INPUT}/current-${id}-shadow.png`));
const atlas=read('public/assets/beodeul-city/beodeul-city-chipset.png'),grass=blank(16,16);
PNG.bitblt(atlas,grass,737%128*16,Math.floor(737/128)*16,16,16,0,0);
const ground=n=>read(`public/assets/beodeul-ground/${n}.png`);
const road=ground('hamlet-stone-15'),soil=ground('hamlet-soil-15'),house=read('public/assets/beodeul-architecture/stone.png');
const houseShadow=ground('light-house-stone'),foundation=ground('foundation-h112_0');
const defs=[
 {id:'current',label:'현재 원본',description:'원본 나무 색 · 모든 시안의 형태/뿌리/그림자 동일'},
 {id:'muted',label:'초록 채도 완화',description:'밝기 유지 · 녹색 채도만 낮춤'},
 {id:'warm',label:'따뜻한 황록',description:'밝기 유지 · 노랑/올리브 쪽으로 색조 이동'},
 {id:'cool',label:'청록 음영',description:'밝기 유지 · 어두운 잎에 푸른 기 추가'},
 {id:'contrast',label:'명암 폭 축소',description:'밝은 잎은 낮추고 어두운 잎은 올려 반짝임 완화'},
 {id:'balanced',label:'황록·목재 조화',description:'녹색 채도/명암 완화 · 줄기도 집의 갈색 계열로 조정'},
];
const lum=c=>c[0]*.2126+c[1]*.7152+c[2]*.0722;
const clamp=x=>Math.max(0,Math.min(255,Math.round(x)));
function palette(c,id){
 if(c[3]!==255||id==='current')return c;
 const green=c[1]>c[0]*1.08&&c[1]>c[2]*1.15,y=lum(c);let rgb=c.slice(0,3);
 if(green){
  if(id==='muted')rgb=rgb.map(v=>y+(v-y)*.56);
  if(id==='warm')rgb=[c[0]+24,c[1]-5,c[2]-13];
  if(id==='cool'){const amount=Math.max(.1,Math.min(1,(160-y)/130));rgb=[c[0]-8*amount,c[1]+2*amount,c[2]+28*amount];}
  if(id==='contrast'){const target=43+y*.66;rgb=rgb.map(v=>target+(v-y)*.78);}
  if(id==='balanced'){const target=18+y*.86;rgb=[target+(c[0]-y)*.67+9,target+(c[1]-y)*.67-2,target+(c[2]-y)*.67-8];}
  if(['muted','warm','cool'].includes(id)){const delta=y-lum(rgb);rgb=rgb.map(v=>v+delta);}
 }else if(id==='balanced'&&c[0]>=c[1]&&c[0]>c[2]*1.2){rgb=[c[0]*.92+9,c[1]*.93+4,c[2]*.96+1];}
 return rgb.map(clamp).concat(c[3]);
}
function recolor(src,id){const dst=PNG.sync.read(PNG.sync.write(src));for(let y=0;y<src.height;y++)for(let x=0;x<src.width;x++)put(dst,x,y,palette(get(src,x,y),id));return dst;}
function board(body,group=false){const im=blank(160,128);for(let y=0;y<128;y+=16)for(let x=0;x<160;x+=16)stamp(im,grass,x,y);
 for(let x=0;x<160;x+=16)stamp(im,road,x,112);stamp(im,soil,32,96);stamp(im,houseShadow,4,84);stamp(im,house,4,4);stamp(im,foundation,4,84);
 const points=group?[[1,68,28],[2,80,36],[0,96,44]]:[[2,88,40]];
 for(const [i,x,y] of points)stamp(im,shadows[i],x,y);
 for(const [i,x,y] of [...points].sort((a,b)=>a[2]-b[2]))stamp(im,body[i],x,y);
 return im;
}
const current={solo:board(bodies),grove:board(bodies,true)};
for(const key of ['solo','grove'])assert(current[key].data.equals(read(`${INPUT}/current-${key}.png`).data),'Baseline matches the previous house comparison pixel for pixel');
const report=[],gallery=blank(480,256);
for(const [n,d] of defs.entries()){
 const body=bodies.map(b=>recolor(b,d.id));
 const mapping=new Map();let changed=0;
 for(let t=0;t<body.length;t++)for(let p=0;p<body[t].data.length;p+=4){
  assert.equal(body[t].data[p+3],bodies[t].data[p+3]);
  const before=Array.from(bodies[t].data.subarray(p,p+4)),after=Array.from(body[t].data.subarray(p,p+4));
  const key=before.join(',');if(mapping.has(key))assert.deepEqual(mapping.get(key),after);mapping.set(key,after);
  if(before.join(',')!==after.join(','))changed++;
 }
 const scenes={solo:board(body),grove:board(body,true)};
 for(const [key,im] of Object.entries(scenes)){
  const sameRegion=(x,y,w,h)=>{for(let dy=0;dy<h;dy++)for(let dx=0;dx<w;dx++)assert.deepEqual(get(im,x+dx,y+dy),get(current[key],x+dx,y+dy));};
  sameRegion(0,0,68,128);sameRegion(0,112,160,16);
  fs.writeFileSync(`${OUT}/${d.id}-${key}.png`,PNG.sync.write(im));
 }
 for(const [i,im] of body.entries())fs.writeFileSync(`${OUT}/${d.id}-${IDS[i]}-body.png`,PNG.sync.write(im));
 PNG.bitblt(scenes.solo,gallery,0,0,160,128,n%3*160,Math.floor(n/3)*128);
 report.push({...d,changedBodyPixels:changed,paletteMapping:[...mapping].map(([from,to])=>({from:from.split(',').map(Number),to}))});
}
const big=blank(1440,768);for(let y=0;y<big.height;y++)for(let x=0;x<big.width;x++)put(big,x,y,get(gallery,Math.floor(x/3),Math.floor(y/3)));
fs.writeFileSync('verify-shots/beodeul-tree-palette/contact-sheet.png',PNG.sync.write(big));
fs.writeFileSync(`${OUT}/palettes.json`,JSON.stringify(report));
fs.writeFileSync(`${OUT}/inspection.json`,JSON.stringify({candidateOnly:true,baseline:'current native tree composition',allAlphaAndPixelPositionsIdentical:true,colorLookupIndependentOfPosition:true,allGroundShadowsByteIdentical:true,houseGrassRoadFoundationUnchanged:true,baselineMatchesPreviousComparison:true,sourceBodyHashes:bodies.map(b=>crypto.createHash('sha256').update(b.data).digest('hex')),variants:report.map(({id,changedBodyPixels})=>({id,changedBodyPixels}))},null,2));
console.log(JSON.stringify(report.map(({id,changedBodyPixels})=>({id,changedBodyPixels}))));
