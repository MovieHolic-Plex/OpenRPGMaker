import { readFileSync } from "node:fs";
import { PNG } from "pngjs";
function bboxC(p,ci,cw,ch){let t=ch,b=-1,l=cw,r=-1;for(let y=0;y<ch;y+=1)for(let x=0;x<cw;x+=1){if(p.data[(y*p.width+ci*cw+x)*4+3]>8){if(y<t)t=y;if(y>b)b=y;if(x<l)l=x;if(x>r)r=x;}}return{t,b,l,r};}
function headStats(p,ci,cw,ch){const {t,b,l,r}=bboxC(p,ci,cw,ch);const he=t+Math.round((b-t)*0.30);let skin=0,hair=0,band=0,tot=0;
for(let y=t;y<=he;y+=1)for(let x=l;x<=r;x+=1){const i=(y*p.width+ci*cw+x)*4;if(p.data[i+3]<=8)continue;const R=p.data[i],G=p.data[i+1],Bl=p.data[i+2];tot+=1;
if(R>120&&R-Bl>25&&R-G>12&&G>=Bl&&R<252)skin+=1; if(G>R&&G>Bl&&G<150)hair+=1; if(G>R+20&&G>Bl+20&&G>=150)band+=1;}
return {skin:skin/tot,hair:hair/tot,band:band/tot};}
function shares(p,ci,cw,ch){let blue=0,red=0,green=0,warm=0,bright=0,dark=0,luma=0,tot=0;
for(let y=0;y<ch;y+=1)for(let x=0;x<cw;x+=1){const i=(y*p.width+ci*cw+x)*4;if(p.data[i+3]<=8)continue;const R=p.data[i],G=p.data[i+1],Bl=p.data[i+2];tot+=1;
const isB=Bl-R>30&&Bl-G>30,isR=R-Bl>40&&R-G>25,isG=G-R>12&&G-Bl>12;
if(isB)blue+=1;else if(isR)red+=1;else if(isG)green+=1;else if(R-Bl>15)warm+=1;
const m=(R+G+Bl)/3;if(m>170&&!isB&&!isR&&!isG)bright+=1;if(m<60)dark+=1;luma+=0.299*R+0.587*G+0.114*Bl;}
return [...[blue,red,green,warm,bright,dark].map(c=>c/tot),luma/tot/255];}
function relDev(f,ref){let w=0;for(let k=0;k<ref.length;k+=1){if(ref[k]<0.02)continue;w=Math.max(w,Math.abs(f[k]-ref[k])/ref[k]);}return w;}
function change(p,a,b,cw,ch){let c=0,t=0;for(let y=0;y<ch;y+=1)for(let x=0;x<cw;x+=1){const ia=(y*p.width+a*cw+x)*4,ib=(y*p.width+b*cw+x)*4;t+=1;
const d=Math.abs(p.data[ia]-p.data[ib])+Math.abs(p.data[ia+1]-p.data[ib+1])+Math.abs(p.data[ia+2]-p.data[ib+2])+Math.abs(p.data[ia+3]-p.data[ib+3]);if(d>24)c+=1;}return c/t;}
const [refPath, stripPath] = process.argv.slice(2);
const src=PNG.sync.read(readFileSync(refPath));
const RS=shares(src,0,src.width,src.height), RH=headStats(src,0,src.width,src.height);
const st=PNG.sync.read(readFileSync(stripPath)); const cw=290,ch=280,n=st.width/cw;
let col=0,skin=0,hair=0,band=0;
for(let i=0;i<n;i+=1){col=Math.max(col,relDev(shares(st,i,cw,ch),RS));const h=headStats(st,i,cw,ch);
skin=Math.max(skin,Math.abs(h.skin-RH.skin)/Math.max(RH.skin,.02));hair=Math.max(hair,Math.abs(h.hair-RH.hair)/Math.max(RH.hair,.02));band=Math.max(band,h.band);}
const steps=[];for(let i=1;i<n;i+=1)steps.push(change(st,i-1,i,cw,ch));
const seam=change(st,n-1,0,cw,ch),mx=Math.max(...steps),mn=Math.min(...steps);
console.log(JSON.stringify({color:+col.toFixed(3),headSkin:+skin.toFixed(3),headHair:+hair.toFixed(3),band:+band.toFixed(4),minAdj:+(mn*100).toFixed(2),seamRatio:+(seam/mx).toFixed(2)}));
