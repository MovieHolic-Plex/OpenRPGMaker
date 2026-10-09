/** Original generated trainer artwork -> Emerald64x64. Samples existing pixels; never draws shapes. */
import {createImage,cropToInk,opaqueBounds,pixelAt,setPixel,type RgbaImage} from '../../monster-collect-species/pixel/image';
import {quantizePalette} from './motion';

export const TRAINER_PORTRAIT={width:64,height:64,maxOpaqueColors:15,alphaThreshold:128,fitInkMax:62,bottomExclusive:63,margin:1};
export const TRAINER_ROLES=['hero','rival','professor','nurse','merchant','mother','resident','gym_leader','company_agent','captain','worker','explorer','student','ranger','moon_leader','hiker','hero_back'] as const;
export function prepareTrainerPortrait(source:RgbaImage){
  const ink=cropToInk(source),bounds=opaqueBounds(ink);
  if(!bounds)throw Error('Empty trainer portrait');
  const scale=Math.min(1,TRAINER_PORTRAIT.fitInkMax/ink.width,TRAINER_PORTRAIT.fitInkMax/ink.height);
  const width=Math.max(1,Math.round(ink.width*scale)),height=Math.max(1,Math.round(ink.height*scale));
  const image=createImage(TRAINER_PORTRAIT.width,TRAINER_PORTRAIT.height),left=Math.floor((TRAINER_PORTRAIT.width-width)/2),top=TRAINER_PORTRAIT.bottomExclusive-height;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const p=pixelAt(ink,Math.min(ink.width-1,Math.floor((x+.5)/scale)),Math.min(ink.height-1,Math.floor((y+.5)/scale)));
    if(p[3]>=TRAINER_PORTRAIT.alphaThreshold)setPixel(image,left+x,top+y,[p[0],p[1],p[2],255]);
  }
  if(!opaqueBounds(image))throw Error('Empty trainer portrait after alpha128 threshold');
  const palette=quantizePalette(image,TRAINER_PORTRAIT.maxOpaqueColors);
  return {image,sourceInk:{width:ink.width,height:ink.height},scale,palette,alphaThreshold:TRAINER_PORTRAIT.alphaThreshold,sampling:'nearest-existing-pixels',nativeFrame:TRAINER_PORTRAIT};
}
export function checkTrainerPortrait(image:RgbaImage){
  const errors:string[]=[],colors=new Set<string>();
  if(image.width!==64||image.height!==64)errors.push('Emerald trainer portrait must be64x64');
  let nonBinaryAlpha=0;
  for(let i=0;i<image.data.length;i+=4){const alpha=image.data[i+3]!;if(alpha!==0&&alpha!==255)nonBinaryAlpha++;if(alpha)colors.add(image.data.slice(i,i+3).join(','));}
  if(nonBinaryAlpha)errors.push('Nonbinary trainer alpha');
  if(colors.size>15)errors.push('Trainer exceeds15 opaque colors plus transparency');
  const bounds=opaqueBounds(image);
  if(!bounds)errors.push('Empty trainer portrait');
  else if(bounds.x<1||bounds.y<1||bounds.x+bounds.width>63||bounds.y+bounds.height>63)errors.push('Trainer ink clips its declared transparent margin');
  return {pass:errors.length===0,errors,warnings:[],metrics:{paletteUnion:colors.size,nonBinaryAlpha,bounds}};
}
