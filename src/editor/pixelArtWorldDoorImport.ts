import { canAttachPixelArtWorldDoorReferences, type PixelArtWorldDoorPack } from '@/project/pixelArtWorldDoors';
import { validateTilesetReferences } from '@/project/tilesetReferences';
import type { SpriteDef, UploadedAsset } from '@/project/types';
import { sha256HexBytes } from '@/util/sha256';
import { genId } from '@/util/id';
import { createPixelArtWorldDoorReferences } from './pixelArtWorldDoorReferences';

export async function preparePixelArtWorldDoor(file: File, pack: PixelArtWorldDoorPack, assetId = genId('paw_door')) {
  if(file.size>4_000_000) throw new Error('확인된 원본 PNG를 선택하세요.');
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(await sha256HexBytes(bytes)!==pack.sha256)throw new Error(`${pack.filename}의 확인된 원본과 다릅니다.`);
  const source=new Image(), url=URL.createObjectURL(file);
  try{source.src=url;await source.decode();}finally{URL.revokeObjectURL(url);}
  if(source.naturalWidth!==pack.width||source.naturalHeight!==pack.height)throw new Error('원본 문 시트 치수가 다릅니다.');
  const canvas=document.createElement('canvas');canvas.width=pack.width;canvas.height=pack.height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(source,0,0);
  for(const v of pack.variants)for(const frame of v.openingFrames){
    const [x,y,w,h]=pack.frames[frame].sourceRect;
    const rgba=ctx.getImageData(x,y,w,h).data;
    if(!rgba.some((n,i)=>i%4===3&&n>0))throw new Error('빈 프레임은 문으로 등록할 수 없습니다.');
  }
  const dataUrl=canvas.toDataURL('image/png');
  const asset:UploadedAsset={id:assetId,name:pack.name,kind:'sprite',dataUrl,meta:{width:pack.width,height:pack.height,frames:16,frameWidth:pack.frameWidth,frameHeight:pack.frameHeight}};
  const sprite:SpriteDef={id:assetId,image:{type:'uploaded',id:assetId},frames:16,frameWidth:pack.frameWidth,frameHeight:pack.frameHeight};
  const references=createPixelArtWorldDoorReferences(pack,source,dataUrl,assetId);
  validateTilesetReferences([references]);
  return {packId:pack.id,asset,sprite,references};
}

export async function importPixelArtWorldDoor(file:File,pack:PixelArtWorldDoorPack,tilesetId:string,signal?:AbortSignal):Promise<string>{
  const [{store},{projectRepository},{uploadedAssetForImport},{recordProjectSnapshot}]=await Promise.all([
    import('@/project/store'),import('@/project/persistence/repository'),import('./uploadedAssetStorage'),import('./mapEditHistory'),
  ]);
  const target=store.getCurrent().tilesets[tilesetId];
  if(!target||!canAttachPixelArtWorldDoorReferences(target,pack))throw new Error('문 참고자료를 보관할 32px 사용자 타일셋을 선택하세요.');
  const lineage=store.getVersionToken().lineage, signature=JSON.stringify(target), repository=projectRepository(), repositoryTarget=JSON.stringify(repository.currentTarget());
  const ensureCurrent=()=>{
    if(signal?.aborted)throw new Error('가져오기가 취소되었습니다.');
    if(store.getVersionToken().lineage!==lineage||JSON.stringify(repository.currentTarget())!==repositoryTarget||JSON.stringify(store.getCurrent().tilesets[tilesetId])!==signature)throw new Error('대상 프로젝트 또는 타일셋이 변경되었습니다. 다시 가져오세요.');
  };
  ensureCurrent();const prepared=await preparePixelArtWorldDoor(file,pack);ensureCurrent();
  const references=[...(target.referenceDocuments??[]),prepared.references];validateTilesetReferences(references);
  const asset=await uploadedAssetForImport({repository,...prepared.asset,dataUrl:prepared.asset.dataUrl!});ensureCurrent();
  recordProjectSnapshot();
  store.update(project=>{project.assets.uploaded[asset.id]=asset;project.assets.sprites[asset.id]=prepared.sprite;project.tilesets[tilesetId].referenceDocuments=references;});
  return tilesetId;
}
