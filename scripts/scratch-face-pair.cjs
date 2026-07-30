const fs=require("node:fs");const {PNG}=require("pngjs");
const [csName,fsName]=process.argv.slice(2);const scale=3;
const cs=PNG.sync.read(fs.readFileSync(`public/assets/easyrpg/charset/${csName}.png`));
const fsh=PNG.sync.read(fs.readFileSync(`public/assets/easyrpg/faceset/${fsName}.png`));
const CW=24,CH=32,FW=48,FH=48;const cellW=FW*scale+8;const rowH=FH*scale+CH*scale+14;
const out=new PNG({width:cellW*8,height:rowH});
for(let i=0;i<out.data.length;i+=4){out.data[i]=30;out.data[i+1]=30;out.data[i+2]=38;out.data[i+3]=255;}
function blit(src,sx,sy,sw,sh,dx,dy){for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){const si=((sy+y)*src.width+(sx+x))*4;
 for(let ky=0;ky<scale;ky++)for(let kx=0;kx<scale;kx++){const px=dx+x*scale+kx,py=dy+y*scale+ky;
  if(px<0||py<0||px>=out.width||py>=out.height)continue;const di=(py*out.width+px)*4;
  out.data[di]=src.data[si];out.data[di+1]=src.data[si+1];out.data[di+2]=src.data[si+2];out.data[di+3]=255;}}}
for(let idx=0;idx<8;idx++){const bc=idx%4,br=Math.floor(idx/4);
 blit(cs,bc*3*CW+CW,br*4*CH+2*CH,CW,CH,idx*cellW+(FW*scale-CW*scale)/2,4);
 blit(fsh,(idx%4)*FW,Math.floor(idx/4)*FH,FW,FH,idx*cellW,CH*scale+10);}
fs.writeFileSync(`report-assets/pair-${csName}-x-${fsName}.png`,PNG.sync.write(out));console.log("ok");
