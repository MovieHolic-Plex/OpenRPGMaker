/** Focused data/asset probe only. No project store, test suite or runtime session. */
import type { TilesetDef } from '@/project/types';
import { readFile } from 'node:fs/promises';
import { EMERALD_MONSTER_KIT_SHEETS } from '@/assets/emeraldMonsterKitAssets';
import { createMonsterKitTileset } from '@/project/defaults/monsterKit';
import { createEmeraldMonsterKitTileset, ensureEmeraldMonsterKitTileset } from '@/project/defaults/emeraldMonsterKit';
import { ensureBundledTilesets } from '@/project/defaults/defaultAssets';
import { createBlankProject } from '@/project/defaults/blankProject';
import { bundledChipsetFrameCount, bundledChipsetSheetHeight } from '@/assets/bundled';
import { bundledChipsetTileSize, bundledChipsetTilesPerRow } from '@/assets/bundledChipsetGeometry';
const fields=['tileSize','tilesPerRow','count','passability','priority','terrain','tileMeta','animationStrips','autotileGroups','structureKits','ledgeDirections','slideTiles'] as const;
function assert(value:unknown,message:string){if(!value)throw new Error(message);}
const newProject=createBlankProject();
const existing:{tilesets:Record<string,TilesetDef>;maps:{}}={tilesets:{},maps:{}};
ensureBundledTilesets(existing);
const report=[];
for(const sheet of EMERALD_MONSTER_KIT_SHEETS){
 const source=createMonsterKitTileset(sheet.sourceTextureKey), variant=createEmeraldMonsterKitTileset(sheet.textureKey);
 for(const field of fields)assert(JSON.stringify(source[field])===JSON.stringify(variant[field]),sheet.id+': '+field+' changed');
 assert(variant.passability!==source.passability,'not isolated');
 assert(newProject.tilesets[sheet.id]&&existing.tilesets[sheet.id],sheet.id+': missing new/existing registration');
 assert(bundledChipsetFrameCount(sheet.textureKey)===sheet.count,'frame count');
 assert(bundledChipsetTileSize(sheet.textureKey)===16&&bundledChipsetTilesPerRow(sheet.textureKey)===16,'geometry');
 assert(bundledChipsetSheetHeight(sheet.textureKey)===sheet.count,'sheet height');
 const png=await readFile('public/'+sheet.path);
 assert(png.readUInt32BE(16)===256&&png.readUInt32BE(20)===sheet.count,'actual PNG bounds');
 const refs=variant.referenceDocuments??[];
 assert(refs.length>=2&&!variant.referenceSourceTilesetId,'reference owner');
 for(const category of refs)for(const im of category.images){assert(im.dataUrl.startsWith('/assets/'),'embedded reference image');await readFile('public'+im.dataUrl);}
 const saved=structuredClone(variant);saved.referenceDocuments=[];assert(!ensureEmeraldMonsterKitTileset(saved)&&saved.referenceDocuments.length===0,'intentional empty overwritten');
 saved.referenceDocuments=[{id:'author',name:'author',description:'author',documents:[],images:[]}];
 assert(ensureEmeraldMonsterKitTileset(saved)&&saved.referenceDocuments[0].id==='author','author preserved');
 assert(!ensureEmeraldMonsterKitTileset(saved),'not idempotent');
 report.push({id:sheet.id,count:sheet.count,fieldsPreserved:fields.length,categories:refs.length,documents:refs.flatMap(c=>c.documents).length,images:refs.flatMap(c=>c.images).length});
}
console.log(JSON.stringify({sheets:report.length,newAndExisting:true,authorAndEmptyPreserved:true,report},null,2));
