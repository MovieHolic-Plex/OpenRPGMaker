import { readFileSync } from "node:fs";
import { PNG } from "pngjs";
const N=["blue","red","green","warm","bright","dark","luma"];
function bboxC(p,ci,cw,ch){let t=ch,b=-1,l=cw,r=-1;for(let y=0;y<ch;y+=1)for(let x=0;x<cw;x+=1){if(p.data[(y*p.width+ci*cw+x)*4+3]>8){if(y<t)t=y;if(y>b)b=y;if(x<l)l=x;if(x>r)r=x;}}return{t,b,l,r};}
// 머리 영역(피사체 상단 30%) 만 같은 7버킷으로 잰다.
function headShares(p,ci,cw,ch){const {t,b,l,r}=bboxC(p,ci,cw,ch);const he=t+Math.round((b-t)*0.30);
let blue=0,red=0,green=0,warm=0,bright=0,dark=0,luma=0,tot=0;
for(let y=t;y<=he;y+=1)for(let x=l;x<=r;x+=1){const i=(y*p.width+ci*cw+x)*4;if(p.data[i+3]<=8)continue;
const R=p.data[i],G=p.data[i+1],Bl=p.data[i+2];tot+=1;
const isB=Bl-R>30&&Bl-G>30,isR=R-Bl>40&&R-G>25,isG=G-R>12&&G-Bl>12;
if(isB)blue+=1;else if(isR)red+=1;else if(isG)green+=1;else if(R-Bl>15)warm+=1;
const m=(R+G+Bl)/3;if(m>170&&!isB&&!isR&&!isG)bright+=1;if(m<60)dark+=1;luma+=0.299*R+0.587*G+0.114*Bl;}
return [...[blue,red,green,warm,bright,dark].map(c=>c/tot),luma/tot/255];}
function metrics(refPath, stripPath){
  const src=PNG.sync.read(readFileSync(refPath));
  const RH=headShares(src,0,src.width,src.height);
  const st=PNG.sync.read(readFileSync(stripPath));const cw=290,ch=280,n=st.width/cw;
  let rel=0, novel=0, relWho="", novelWho="";
  for(let i=0;i<n;i+=1){const f=headShares(st,i,cw,ch);
    for(let k=0;k<RH.length;k+=1){
      if(RH[k]>=0.02){const d=Math.abs(f[k]-RH[k])/RH[k]; if(d>rel){rel=d;relWho=`${N[k]} 칸${i}`;}}
      else {const d=f[k]; if(d>novel){novel=d;novelWho=`${N[k]} 칸${i}`;}}}}
  return {rel:+rel.toFixed(3),relWho,novel:+novel.toFixed(4),novelWho,refHead:RH.map((v,k)=>`${N[k]}=${(v*100).toFixed(1)}%`).join(" ")};
}
const B="public/assets/generated/battle-skins/sprites";
for (const h of ["hero-01","hero-02","hero-03","hero-04"]) {
  const m=metrics(`${B}/${h}-back.png`, `${B}/idle/${h}-back.png`);
  console.log(`${h}  머리 상대편차=${m.rel} (${m.relWho})  없던색=${m.novel} (${m.novelWho})`);
}
const d=metrics(`${B}/hero-04-back.png`, "/tmp/hero-04-defect.png");
console.log(`\n[알려진 불량: 고개 돌린 옛 hero-04] 머리 상대편차=${d.rel} (${d.relWho})  없던색=${d.novel} (${d.novelWho})`);
console.log(`hero-04 원본 머리 지분: ${d.refHead}`);
