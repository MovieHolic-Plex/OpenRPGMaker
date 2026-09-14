import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {PNG} from 'pngjs';
const base='output/evidence/emerald-wide-v2',dir=`${base}/${process.argv[2]??'inspection-16-fixed'}`;
const bytes=fs.readFileSync(`${base}/map_field_emerald_basin_20260914.png`),src=PNG.sync.read(bytes);
fs.mkdirSync(dir,{recursive:true});
const regions=[];
for(let r=0;r<4;r++)for(let c=0;c<4;c++){
 const w=src.width/4,h=src.height/4,out=new PNG({width:w*2,height:h*2});
 for(let y=0;y<h*2;y++)for(let x=0;x<w*2;x++){
  const a=((r*h+Math.floor(y/2))*src.width+c*w+Math.floor(x/2))*4,b=(y*w*2+x)*4;
  src.data.copy(out.data,b,a,a+4);
 }
 const file=`${r*4+c+1}-${r+1}-${c+1}.png`;
 fs.writeFileSync(`${dir}/${file}`,PNG.sync.write(out));
 regions.push({number:r*4+c+1,file,tileBounds:{x:c*w/16,y:r*h/16,width:w/16,height:h/16}});
}
fs.writeFileSync(`${dir}/manifest.json`,JSON.stringify({sourceSha256:createHash('sha256').update(bytes).digest('hex'),zoom:2,regions},null,2));
console.log(`Wrote ${regions.length} regions to ${dir}`);
