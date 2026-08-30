import { readFileSync, readdirSync } from "node:fs";
import { PNG } from "pngjs";
const dir="/tmp/back-anim/keyed/hero-04-v3";
const B="public/assets/generated/battle-skins/sprites";
function bbox(p){let t=p.height,b=-1,l=p.width,r=-1;for(let y=0;y<p.height;y+=1)for(let x=0;x<p.width;x+=1){if(p.data[(y*p.width+x)*4+3]>8){if(y<t)t=y;if(y>b)b=y;if(x<l)l=x;if(x>r)r=x;}}return{t,b,l,r};}
function headStats(p){const {t,b,l,r}=bbox(p);const he=t+Math.round((b-t)*0.30);let skin=0,hair=0,band=0,tot=0;
for(let y=t;y<=he;y+=1)for(let x=l;x<=r;x+=1){const i=(y*p.width+x)*4;if(p.data[i+3]<=8)continue;const R=p.data[i],G=p.data[i+1],Bl=p.data[i+2];tot+=1;
if(R>120&&R-Bl>25&&R-G>12&&G>=Bl&&R<252)skin+=1; if(G>R&&G>Bl&&G<150)hair+=1; if(G>R+20&&G>Bl+20&&G>=150)band+=1;}
return {skin:skin/tot,hair:hair/tot,band:band/tot};}
function shares(p){const {t,b,l,r}=bbox(p);let blue=0,red=0,green=0,warm=0,bright=0,dark=0,luma=0,tot=0;
for(let y=t;y<=b;y+=1)for(let x=l;x<=r;x+=1){const i=(y*p.width+x)*4;if(p.data[i+3]<=8)continue;const R=p.data[i],G=p.data[i+1],Bl=p.data[i+2];tot+=1;
const isB=Bl-R>30&&Bl-G>30,isR=R-Bl>40&&R-G>25,isG=G-R>12&&G-Bl>12;
if(isB)blue+=1;else if(isR)red+=1;else if(isG)green+=1;else if(R-Bl>15)warm+=1;
const m=(R+G+Bl)/3; if(m>170&&!isB&&!isR&&!isG)bright+=1; if(m<60)dark+=1; luma+=0.299*R+0.587*G+0.114*Bl;}
return [...[blue,red,green,warm,bright,dark].map(c=>c/tot),luma/tot/255];}
function relDev(f,ref){let w=0;for(let k=0;k<ref.length;k+=1){if(ref[k]<0.02)continue;w=Math.max(w,Math.abs(f[k]-ref[k])/ref[k]);}return w;}
function diff(a,b){const n=Math.min(a.data.length,b.data.length);let c=0,t=0;for(let i=0;i<n;i+=4){t+=1;const d=Math.abs(a.data[i]-b.data[i])+Math.abs(a.data[i+1]-b.data[i+1])+Math.abs(a.data[i+2]-b.data[i+2])+Math.abs(a.data[i+3]-b.data[i+3]);if(d>24)c+=1;}return c/t;}
const ref=PNG.sync.read(readFileSync(`${B}/hero-04-back.png`));
const R=headStats(ref), RS=shares(ref);
const files=readdirSync(dir).filter(f=>f.endsWith(".png")).sort();
const F=new Map();
for(const f of files){const idx=Number(f.replace(/\D/g,""));const p=PNG.sync.read(readFileSync(`${dir}/${f}`));
const h=headStats(p);
F.set(idx,{p,skinDev:Math.abs(h.skin-R.skin)/Math.max(R.skin,.02),hairDev:Math.abs(h.hair-R.hair)/Math.max(R.hair,.02),band:h.band,color:relDev(shares(p),RS)});}
const idxs=[...F.keys()].sort((a,b)=>a-b);
const out=[]; const reasons={total:0,skin:0,hair:0,band:0,color:0,motion:0,seam:0};
for (const start of idxs) {
  for (const stride of [1,2,3,4,5]) {
    for (const mode of ["cont","ping"]) {
      const seq = mode==="cont" ? Array.from({length:8},(_,i)=>start+i*stride)
                                : (()=>{const a=Array.from({length:5},(_,i)=>start+i*stride);return [...a,a[3],a[2],a[1]];})();
      if (seq.some(i=>!F.has(i))) continue;
      const skinW=Math.max(...seq.map(i=>F.get(i).skinDev));
      const hairW=Math.max(...seq.map(i=>F.get(i).hairDev));
      const bandW=Math.max(...seq.map(i=>F.get(i).band));
      const colW=Math.max(...seq.map(i=>F.get(i).color));
      reasons.total+=1;
      if (skinW>0.50){reasons.skin+=1;continue;}
      if (hairW>0.25){reasons.hair+=1;continue;}
      if (bandW>0.010){reasons.band+=1;continue;}
      if (colW>0.15){reasons.color+=1;continue;}
      const headW=Math.max(skinW,hairW);
      const steps=[];for(let i=1;i<seq.length;i+=1)steps.push(diff(F.get(seq[i-1]).p,F.get(seq[i]).p));
      const seam=diff(F.get(seq[seq.length-1]).p,F.get(seq[0]).p);
      const mn=Math.min(...steps),mx=Math.max(...steps);
      if(mn<0.020){reasons.motion+=1;continue;}
      const ratio=seam/mx; if(ratio>1.5){reasons.seam+=1;continue;}
      out.push({mode,start,stride,headW:+headW.toFixed(3),bandW:+bandW.toFixed(4),colW:+colW.toFixed(3),mn:+mn.toFixed(4),ratio:+ratio.toFixed(2),seq});
    }
  }
}
out.sort((a,b)=>(a.headW+a.colW)-(b.headW+b.colW));
console.log("탈락 사유:", JSON.stringify(reasons));
console.log(`통과 후보 ${out.length}개`);
for(const o of out.slice(0,10)) console.log(`  ${o.mode} start=${o.start} stride=${o.stride} head=${o.headW} band=${o.bandW} color=${o.colW} minAdj=${(o.mn*100).toFixed(2)}% ratio=${o.ratio} idx=[${o.seq}]`);
