import {canAttachEventPropReferences,type PixelArtWorldEventPropPack} from '@/project/pixelArtWorldEventProps';
import {validateTilesetReferences} from '@/project/tilesetReferences';
import type {UploadedAsset} from '@/project/types';
import {sha256HexBytes} from '@/util/sha256';
import {genId} from '@/util/id';
import {createEventPropReferences} from './pixelArtWorldEventPropReferences';
export async function preparePixelArtWorldEventProp(file:File,pack:PixelArtWorldEventPropPack,assetId=genId('paw_eventprop')) {
  if(!pack.rights.runtimeImportAllowed)throw Error('RPG Maker XP 소유자·RPG Maker 제작물 전용 자료입니다. OPRN 실행 소재로 가져올 수 없습니다.');
  if(file.size>4_000_000||await sha256HexBytes(new Uint8Array(await file.arrayBuffer()))!==pack.sha256)throw Error(`${pack.filename}의 확인된 원본과 다릅니다.`);
  const source=new Image(),url=URL.createObjectURL(file);try{source.src=url;await source.decode();}finally{URL.revokeObjectURL(url);}
  if(source.naturalWidth!==pack.width||source.naturalHeight!==pack.height)throw Error('원본 치수가 다릅니다.');
  const atlas=document.createElement('canvas');atlas.width=pack.atlasColumns*pack.frameWidth;atlas.height=Math.ceil(pack.frames.length/pack.atlasColumns)*pack.frameHeight;
  const ctx=atlas.getContext('2d',{willReadFrequently:true})!;ctx.imageSmoothingEnabled=false;
  for(const frame of pack.frames){const[x,y,w,h]=frame.sourceRect,[ox,oy]=frame.atlasOffset;ctx.drawImage(source,x,y,w,h,(frame.index%4)*pack.frameWidth+ox,Math.floor(frame.index/4)*pack.frameHeight+oy,w,h);}
  for(const frame of pack.frames){
    const data=ctx.getImageData(frame.index%4*pack.frameWidth,Math.floor(frame.index/4)*pack.frameHeight,pack.frameWidth,pack.frameHeight).data;
    let left=pack.frameWidth,top=pack.frameHeight,right=-1,bottom=-1;
    for(let y=0;y<pack.frameHeight;y++)for(let x=0;x<pack.frameWidth;x++)if(data[(y*pack.frameWidth+x)*4+3]){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
    const actual=right<0?null:[left,top,right+1,bottom+1],b=frame.alphaBounds,[ox,oy]=frame.atlasOffset;
    const expected=b?[b[0]+ox,b[1]+oy,b[2]+ox,b[3]+oy]:null;
    if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error(`전체 프레임/앵커 범위가 다릅니다: ${frame.index}`);
  }
  for(const v of pack.variants)for(const part of v.parts)for(const index of part.frames){
    const data=ctx.getImageData(index%4*pack.frameWidth,Math.floor(index/4)*pack.frameHeight,pack.frameWidth,pack.frameHeight).data;
    if(!data.some((v,i)=>i%4===3&&v>0))throw Error('빈 프레임을 객체로 사용할 수 없습니다.');
  }
  const dataUrl=atlas.toDataURL('image/png');
  const asset:UploadedAsset={id:assetId,name:pack.name,kind:'sprite',dataUrl,meta:{width:atlas.width,height:atlas.height,frameWidth:pack.frameWidth,frameHeight:pack.frameHeight,frames:pack.frames.length}};
  const references=createEventPropReferences(pack,source,atlas,assetId);validateTilesetReferences([references]);
  return {packId:pack.id,sourceSha256:pack.sha256,asset,references};
}
export async function importPixelArtWorldEventProp(file:File,pack:PixelArtWorldEventPropPack,tilesetId:string,signal?:AbortSignal) {
  const [{store},{projectRepository},{uploadedAssetForImport},{recordProjectSnapshot}]=await Promise.all([import('@/project/store'),import('@/project/persistence/repository'),import('./uploadedAssetStorage'),import('./mapEditHistory')]);
  const target=store.getCurrent().tilesets[tilesetId];if(!target||!canAttachEventPropReferences(target,pack))throw Error('참고자료를 보관할32px 사용자 타일셋을 선택하세요.');
  const lineage=store.getVersionToken().lineage,signature=JSON.stringify(target),repository=projectRepository(),location=JSON.stringify(repository.currentTarget());
  const ensure=()=>{if(signal?.aborted||store.getVersionToken().lineage!==lineage||JSON.stringify(repository.currentTarget())!==location||JSON.stringify(store.getCurrent().tilesets[tilesetId])!==signature)throw Error('가져오기 대상이 변경되었거나 취소되었습니다.');};
  const prepared=await preparePixelArtWorldEventProp(file,pack);ensure();
  const refs=[...(target.referenceDocuments??[]),prepared.references];validateTilesetReferences(refs);
  const asset=await uploadedAssetForImport({repository,...prepared.asset,dataUrl:prepared.asset.dataUrl!});ensure();recordProjectSnapshot();
  store.update(project=>{project.assets.uploaded[asset.id]=asset;project.tilesets[tilesetId].referenceDocuments=refs;});return tilesetId;
}
