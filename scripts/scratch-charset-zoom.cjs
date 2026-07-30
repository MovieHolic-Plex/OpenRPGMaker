const fs=require("node:fs");const {PNG}=require("pngjs");
const name=process.argv[2];const scale=Number(process.argv[3]||6);
const cs=PNG.sync.read(fs.readFileSync(`public/assets/easyrpg/charset/${name}.png`));
const CW=24,CH=32;const out=new PNG({width:(CW*scale+6)*8,height:CH*scale+8});
for(let i=0;i<out.data.length;i+=4){out.data[i]=255;out.data[i+1]=0;out.data[i+2]=255;out.data[i+3]=255;}
for(let idx=0;idx<8;idx++){const bc=idx%4,br=Math.floor(idx/4);
 const sx=bc*3*CW+CW, sy=br*4*CH+2*CH;
 for(let y=0;y<CH;y++)for(let x=0;x<CW;x++){const si=((sy+y)*cs.width+(sx+x))*4;
  for(let ky=0;ky<scale;ky++)for(let kx=0;kx<scale;kx++){const px=idx*(CW*scale+6)+x*scale+kx,py=4+y*scale+ky;
   const di=(py*out.width+px)*4;out.data[di]=cs.data[si];out.data[di+1]=cs.data[si+1];out.data[di+2]=cs.data[si+2];out.data[di+3]=255;}}}
fs.writeFileSync(`report-assets/zoom-${name}.png`,PNG.sync.write(out));console.log("ok");
