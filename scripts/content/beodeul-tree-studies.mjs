// Pixel studies: retain source trees as the comparison baseline; author explicit integer pixels.
import fs from 'node:fs';
import {PNG} from 'pngjs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const OUT='tiledata/beodeul-ground/tree-studies';fs.mkdirSync(OUT,{recursive:true});
const city=JSON.parse(fs.readFileSync('src/assets/beodeulCityTileset.json','utf8'));
const atlas=PNG.sync.read(fs.readFileSync('public/assets/beodeul-city/beodeul-city-chipset.png'));
const load=name=>PNG.sync.read(fs.readFileSync(`public/assets/beodeul-ground/${name}.png`));
const blank=(w,h)=>new PNG({width:w,height:h});
const get=(im,x,y)=>x<0||y<0||x>=im.width||y>=im.height?[0,0,0,0]:Array.from(im.data.subarray((y*im.width+x)*4,(y*im.width+x)*4+4));
function put(im,x,y,c){if(x<0||y<0||x>=im.width||y>=im.height)return;im.data.set(c,(y*im.width+x)*4);}
function over(im,x,y,c){const a=c[3]/255,b=get(im,x,y),oa=a+b[3]/255*(1-a);if(!oa)return;
 put(im,x,y,[0,1,2].map(i=>Math.round((c[i]*a+b[i]*b[3]/255*(1-a))/oa)).concat(Math.round(oa*255)));}
function stamp(im,src,ox,oy){for(let y=0;y<src.height;y++)for(let x=0;x<src.width;x++){const c=get(src,x,y);if(c[3])over(im,ox+x,oy+y,c);}}
function line(im,x0,y0,x1,y1,c){const n=Math.max(Math.abs(x1-x0),Math.abs(y1-y0));for(let i=0;i<=n;i++)put(im,Math.round(x0+(x1-x0)*i/(n||1)),Math.round(y0+(y1-y0)*i/(n||1)),c);}
function ellipse(im,cx,cy,rx,ry,c){for(let y=Math.floor(cy-ry);y<=cy+ry;y++)for(let x=Math.floor(cx-rx);x<=cx+rx;x++)if(((x-cx)/rx)**2+((y-cy)/ry)**2<=1)over(im,x,y,c);}
function poly(im,pts,c){const ys=pts.map(a=>a[1]);for(let y=Math.min(...ys);y<=Math.max(...ys);y++){
 const cuts=[];for(let i=0;i<pts.length;i++){const [x0,y0]=pts[i],[x1,y1]=pts[(i+1)%pts.length];if((y0<=y&&y1>y)||(y1<=y&&y0>y))cuts.push(x0+(y-y0)*(x1-x0)/(y1-y0));}
 cuts.sort((a,b)=>a-b);for(let i=0;i<cuts.length;i+=2)for(let x=Math.ceil(cuts[i]);x<=Math.floor(cuts[i+1]);x++)put(im,x,y,c);
}}
function tile(n){const im=blank(16,16);PNG.bitblt(atlas,im,n%128*16,Math.floor(n/128)*16,16,16,0,0);return im;}
const grass=tile(737),road=load('hamlet-stone-15'),soil=load('hamlet-soil-15');
const IDS=['03a8f7','3e8732','1a786c'];
const native=IDS.map(id=>{const k=city.structureKits.find(k=>k.id==='bd-tree-'+id),im=blank(64,80);
 for(let y=0;y<k.height;y++)for(let x=0;x<k.width;x++){const n=k.rows[y].upperTiles[x];if(n>=0)stamp(im,tile(n),8+x*16,y*16);}
 if(k.height===3){stamp(im,load('tree-neck'),8,32);stamp(im,load('roots'),8,48);}return im;});
const existingShadow=IDS.map((id,i)=>{const im=blank(64,80);stamp(im,load(`light-tree-${id}`),8,i===2?48:32);return im;});
// Native bark palette. A narrow hard contact seam and softer canopy cast are different shapes.
const bark=[[52,43,27,255],[79,59,32,255],[107,77,40,255],[136,101,53,255],[160,123,68,255]];
function contactBody(sprite){const im=PNG.sync.read(PNG.sync.write(sprite));
 for(let y=54;y<64;y++)for(let x=12;x<53;x++){const c=get(sprite,x,y);
  if(c[3]&&c[0]>=c[1]&&c[0]>40)put(im,x,y,[Math.round(c[0]*.73),Math.round(c[1]*.78),Math.round(c[2]*.83),c[3]]);
 }return im;}
function groundedShadow(sprite,foot=58){const im=blank(64,80);
 for(let y=0;y<44;y++)for(let x=0;x<48;x++){const c=get(sprite,x+8,y);if(c[3]&&c[1]>c[0]*1.08){
  const xx=10+x,yy=foot-8+Math.floor(y*.31);over(im,xx,yy,[29,51,34,42]);}}
 ellipse(im,33,foot,15,4,[30,49,27,66]);ellipse(im,32,foot-1,7,2,[28,39,23,166]);return im;}
function rooted(sprite){const im=PNG.sync.read(PNG.sync.write(sprite));
 // The trunk grows into the crown; the thickened base branches into tapered roots.
 poly(im,[[29,36],[33,37],[34,50],[38,55],[46,59],[41,60],[35,57],[33,60],[29,59],[27,56],[19,59],[16,58],[26,52],[28,45]],bark[1]);
 poly(im,[[29,37],[31,36],[31,51],[27,55],[21,57],[25,53],[28,49]],bark[3]);
 poly(im,[[32,39],[34,41],[34,51],[40,56],[38,57],[31,52]],bark[2]);
 line(im,31,45,30,55,bark[4]);line(im,33,53,39,58,bark[0]);line(im,27,54,19,58,bark[0]);
 // Native bark specks interrupt flat bands; texture follows the tapered authored trunk mask.
 for(let y=37;y<60;y++)for(let x=18;x<46;x++){
  const c=get(im,x,y),old=get(sprite,x,y);if(!c[3]||c[0]<c[1]||c.join(',')===old.join(','))continue;
  const source=get(native[2],27+(x*3+y)%9,44+(y+x)%10);
  if(source[3]&&source[0]>=source[1]){
   const shade=x>33?.85:1;
   put(im,x,y,[0,1,2].map(i=>Math.round((source[i]*.62+c[i]*.38)*shade)).concat(255));
  }
 }
 for(const [x,y] of [[23,58],[28,60],[34,60],[41,60]]){
  line(im,x-2,y,x+2,y,[44,76,29,255]);line(im,x,y,x-1,y-3,[72,109,38,255]);put(im,x-1,y-3,[117,143,55,255]);}
 // Preserve native foreground leaves over the upper bark.
 for(let y=34;y<43;y++)for(let x=23;x<40;x++){const c=get(sprite,x,y);if(c[3]&&c[1]>c[0]*1.15)put(im,x,y,c);}
 return im;}
const leafPalette=[[21,60,30],[29,79,31],[42,96,33],[58,113,36],[78,131,43],[99,149,50],[125,164,63],[155,183,82]];
function volume(sprite){const im=PNG.sync.read(PNG.sync.write(sprite));
 for(let y=0;y<47;y++)for(let x=5;x<59;x++){
  const c=get(sprite,x,y);if(!c[3]||c[1]<c[0]*1.08)continue;
  // Three broad lobes with one upper-left light. Reduce isolated leaf glints, never blur.
  let avg=0,n=0;for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){const q=get(sprite,x-x%2+dx,y-y%2+dy);if(q[3]&&q[1]>q[0]){avg+=(q[0]*.24+q[1]*.65+q[2]*.11);n++;}}
  const lum=n?avg/n:c[1],lobe=Math.min(((x-20)/21)**2+((y-12)/18)**2,((x-39)/18)**2+((y-22)/17)**2,((x-22)/20)**2+((y-34)/13)**2);
  const light=11-0.27*x-0.26*y+(lobe<.32?9:0)-(y>35?9:0);
  const value=lum*.65+(c[0]*.24+c[1]*.65+c[2]*.11)*.35+light;
  const q=leafPalette[Math.max(0,Math.min(7,Math.round((value-39)/18)))];put(im,x,y,[...q,c[3]]);
 }
 return im;
}
function squat(sprite){const im=blank(64,80);
 // Broader overhead crown: integer remap of original leaves, no interpolation.
 for(let y=0;y<80;y++)for(let x=0;x<64;x++){const c=get(sprite,x,y);if(c[3]&&!(y<47&&c[1]>c[0]*1.08))put(im,x,y,c);}
 for(let y=0;y<38;y++)for(let x=0;x<56;x++){
  const sx=8+Math.floor(x*48/56),sy=Math.floor(y*46/38),c=get(sprite,sx,sy);
  if(c[3]&&c[1]>c[0]*1.08)put(im,x+4,y+8,c);
 }
 return rooted(im);
}
function undergrowth(){const im=blank(64,80);
 poly(im,[[15,55],[23,50],[35,51],[46,56],[44,63],[30,66],[19,62]], [89,86,40,87]);
 const leaves=[[61,90,35,255],[90,121,43,255],[127,151,59,255]];
 for(const [x,y] of [[18,59],[23,63],[40,62],[46,57]]){
  line(im,x-3,y,x+4,y,leaves[0]);line(im,x,y,x-2,y-4,leaves[1]);line(im,x+1,y,x+3,y-3,leaves[1]);put(im,x-2,y-4,leaves[2]);}
 for(const [x,y] of [[24,64],[36,64],[42,54],[17,56]]){put(im,x,y,[135,121,58,255]);put(im,x+1,y,[101,101,41,255]);}return im;
}
const labels=['현재','접촉 그림자','굵은 줄기·뿌리','수관 명암 정리','낮고 넓은 수관','밑동·수관·숲 통합'];
const descriptions=['현재 마을의 원본 수관과 공용 밑동/그늘','수관 모양을 닮은 땅 그늘 + 좁고 짙은 밑동 접촉','줄기를 수관 안까지 연결하고 뿌리를 지면에 벌림','잔잎 반짝임을 줄이고 좌상단 빛/아래쪽 덩어리 음영','수관을 가로로 넓혀 윗면이 보이는 낮은 형태','줄기·뿌리 + 수관 명암 + 낙엽/전경 풀 겹침'];
const versions=labels.map((label,v)=>({id:['current','contact','roots','volume','squat','integrated'][v],label,description:descriptions[v],trees:native.map((s,i)=>{
 let body=v===1?contactBody(s):v===2?rooted(s):v===3?volume(s):v===4?squat(s):v===5?volume(rooted(s)):PNG.sync.read(PNG.sync.write(s));
 const shadow=v===0?existingShadow[i]:v===3?existingShadow[i]:groundedShadow(body,i===2?60:58);
 const foreground=v===5?undergrowth():blank(64,80);return {body,shadow,foreground};})}));
const house=PNG.sync.read(fs.readFileSync('public/assets/beodeul-architecture/stone.png'));
assert.equal(house.width,64);assert.equal(house.height,96);
function board(version,group=false){const im=blank(160,128);for(let y=0;y<128;y+=16)for(let x=0;x<160;x+=16)stamp(im,grass,x,y);
 // Exact same native 4x6 house, foundation, light and ground line for every variant.
 for(let x=0;x<160;x+=16)stamp(im,road,x,112);stamp(im,soil,32,96);
 stamp(im,load('light-house-stone'),4,84);
 stamp(im,house,4,4);stamp(im,load('foundation-h112_0'),4,84);
 // A single trunk and the house both touch the ground at y=100, at native 16px scale.
 const points=group?[[1,68,28],[2,80,36],[0,96,44]]:[[2,88,40]];
 for(const [i,x,y] of points)stamp(im,version.trees[i].shadow,x,y);
 for(const [i,x,y] of [...points].sort((a,b)=>a[2]-b[2])){stamp(im,version.trees[i].body,x,y);stamp(im,version.trees[i].foreground,x,y);}
 return im;
}
function encode(im){const palette=[],map=new Map(),pixels=[];for(let y=0;y<im.height;y++)for(let x=0;x<im.width;x++){const c=get(im,x,y),key=c.join(',');if(!map.has(key)){map.set(key,palette.length);palette.push(c);}pixels.push(map.get(key));}return {width:im.width,height:im.height,palette,pixels};}
const gallery=blank(160*3,128*2),report=[];
for(const [v,a] of versions.entries()){
 const solo=board(a),grove=board(a,true);fs.writeFileSync(`${OUT}/${a.id}-solo.png`,PNG.sync.write(solo));fs.writeFileSync(`${OUT}/${a.id}-grove.png`,PNG.sync.write(grove));
 PNG.bitblt(grove,gallery,0,0,160,128,(v%3)*160,Math.floor(v/3)*128);
 const edits=a.trees.map((t,i)=>{let changed=0;for(let p=0;p<t.body.data.length;p+=4)if(!t.body.data.subarray(p,p+4).equals(native[i].data.subarray(p,p+4)))changed++;return{sourceKit:'bd-tree-'+IDS[i],changedBodyPixels:changed};});
 if(v>0)assert(a.trees.some((t,i)=>!t.body.data.equals(native[i].data))||v===1);
 for(const [i,t] of a.trees.entries())for(const [key,im] of Object.entries(t))fs.writeFileSync(`${OUT}/${a.id}-${IDS[i]}-${key}.png`,PNG.sync.write(im));
 report.push({id:a.id,label:a.label,description:a.description,edits,solo:encode(solo),grove:encode(grove),body:a.trees.map(t=>encode(t.body)),shadow:a.trees.map(t=>encode(t.shadow)),foreground:a.trees.map(t=>encode(t.foreground))});
}
fs.writeFileSync(`${OUT}/studies.json`,JSON.stringify(report));
const zoom=blank(gallery.width*3,gallery.height*3);for(let y=0;y<zoom.height;y++)for(let x=0;x<zoom.width;x++)put(zoom,x,y,get(gallery,Math.floor(x/3),Math.floor(y/3)));
fs.writeFileSync('verify-shots/beodeul-tree-variants/contact-sheet.png',PNG.sync.write(zoom));
fs.writeFileSync(`${OUT}/inspection.json`,JSON.stringify({candidateOnly:true,nativeAtlasHash:crypto.createHash('sha256').update(atlas.data).digest('hex'),sourceProjectId:'3dd2427f-38dc-46e5-925b-a717dbe5bb03',sourceRevision:18,labels,edits:report.map(r=>({id:r.id,edits:r.edits})),sourceAtlasUnchanged:true,integerPixelsOnly:true,contextHouse:'bd-house-village-stone',housePixelHash:crypto.createHash('sha256').update(house.data).digest('hex'),houseAndSoloTreeGroundLine:100,sameHouseAndNativeScaleInAllVariants:true},null,2));
console.log(JSON.stringify(report.map(r=>({id:r.id,edits:r.edits}))));
