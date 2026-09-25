import type { UploadedAsset } from './types';
/** General uploaded event sprites use explicit row-major geometry, never RM2K charset slicing. */
export function uploadedSpriteGeometry(asset: UploadedAsset | undefined) {
  if(asset?.kind!=='sprite')return null;
  const {width,height,frameWidth,frameHeight,frames}=asset.meta;
  if(![width,height,frameWidth,frameHeight,frames].every(n=>typeof n==='number'&&Number.isInteger(n)&&n>0))return null;
  const w=width!,h=height!,fw=frameWidth!,fh=frameHeight!,count=frames!;
  if(w%fw||h%fh||count>w/fw*(h/fh)||w>16384||h>16384)return null;
  return {width:w,height:h,frameWidth:fw,frameHeight:fh,frames:count,columns:w/fw};
}
export function uploadedSpriteFrame(asset: UploadedAsset | undefined, pattern: number) {
  const sheet=uploadedSpriteGeometry(asset);
  if(!sheet||!Number.isInteger(pattern)||pattern<0||pattern>=sheet.frames)return null;
  return {x:pattern%sheet.columns*sheet.frameWidth,y:Math.floor(pattern/sheet.columns)*sheet.frameHeight,width:sheet.frameWidth,height:sheet.frameHeight};
}
