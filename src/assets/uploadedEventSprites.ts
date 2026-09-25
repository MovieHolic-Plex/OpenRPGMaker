import type Phaser from 'phaser';
import type { Project } from '@/project/types';
import { uploadedSpriteGeometry, uploadedSpriteFrame } from '@/project/uploadedSpriteGeometry';
import { uploadedAssetUrl } from '@/project/persistence/assetAccessors';
import { ensureSceneImageTexture } from '@/player/playSceneImageTexture';
import { withInlineAsset } from './inlineAssetStore';

export function loadUploadedEventSprites(scene:{readonly load:Pick<Phaser.Loader.LoaderPlugin,'image'>},project?:Project, referenced?:ReadonlySet<string>):void {
  for(const asset of Object.values(project?.assets.uploaded??{})){
    const url=uploadedAssetUrl(asset);
    if(url&&uploadedSpriteGeometry(asset)&&(!referenced||referenced.has(asset.id)))scene.load.image(asset.id,withInlineAsset(url));
  }
}
export function registerUploadedEventSpriteFrames(scene:Phaser.Scene,project?:Project):void {
  for(const asset of Object.values(project?.assets.uploaded??{})){
    const sheet=uploadedSpriteGeometry(asset);
    if(!sheet||!scene.textures.exists(asset.id))continue;
    const texture=scene.textures.get(asset.id),source=texture.getSourceImage() as HTMLImageElement;
    if(source.width!==sheet.width||source.height!==sheet.height)continue;
    for(let i=0;i<sheet.frames;i++){
      const frame=uploadedSpriteFrame(asset,i)!;
      if(!texture.has(String(i)))texture.add(i,0,frame.x,frame.y,frame.width,frame.height);
    }
  }
}
const pending=new WeakMap<Phaser.Scene,Set<string>>();
export function ensureUploadedEventSpriteTextures(scene:Phaser.Scene,project:Project,onReady:()=>void):void {
  registerUploadedEventSpriteFrames(scene,project);
  const loading=pending.get(scene)??new Set<string>();pending.set(scene,loading);
  for(const asset of Object.values(project.assets.uploaded)){
    if(!uploadedSpriteGeometry(asset)||scene.textures.exists(asset.id)||loading.has(asset.id))continue;
    const url=uploadedAssetUrl(asset);if(!url)continue;
    loading.add(asset.id);
    void ensureSceneImageTexture(scene,asset.id,withInlineAsset(url)).then(key=>{
      loading.delete(asset.id);if(!key||!scene.sys.isActive())return;
      registerUploadedEventSpriteFrames(scene,project);onReady();
    });
  }
}
