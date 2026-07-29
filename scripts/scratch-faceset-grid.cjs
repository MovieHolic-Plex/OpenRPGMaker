const fs=require("node:fs");const {PNG}=require("pngjs");
const name=process.argv[2];const scale=2;const FW=48,FH=48;
const f=PNG.sync.read(fs.readFileSync(`public/assets/easyrpg/faceset/${name}.png`));
const cols=8;const cellW=FW*scale+6,cellH=FH*scale+6;
const out=new PNG({width:cellW*cols,height:cellH*2});
for(let i=0;i<out.data.length;i+=4){out.data[i]=255;out.data[i+1]=0;out.data[i+2]=255;out.data[i+3]=255;}
for(let idx=0;idx<16;idx++){const sx=(idx%4)*FW,sy=Math.floor(idx/4)*FH;
 const dx=(idx%8)*cellW+3,dy=Math.floor(idx/8)*cellH+3;
 for(let y=0;y<FH;y++)for(let x=0;x<FW;x++){const si=((sy+y)*f.width+(sx+x))*4;
  for(let ky=0;ky<scale;ky++)for(let kx=0;kx<scale;kx++){const px=dx+x*scale+kx,py=dy+y*scale+ky;
   const di=(py*out.width+px)*4;out.data[di]=f.data[si];out.data[di+1]=f.data[si+1];out.data[di+2]=f.data[si+2];out.data[di+3]=255;}}}
fs.writeFileSync(`report-assets/faceset-grid-${name}.png`,PNG.sync.write(out));console.log("ok "+name);
