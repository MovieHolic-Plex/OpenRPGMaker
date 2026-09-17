import {describe,it,expect} from 'vitest';
import {defaultTilesets,ensureBundledTilesets} from '@/project/defaults/defaultAssets';
import {bundledChipsetFrameCount} from '@/assets/bundled';
import {createTiboInteriorTileset,tiboInteriorObjectById} from '@/project/defaults/tiboInterior';
import {readFileSync,existsSync} from 'node:fs';
describe('recovered Tibo assets',()=>{
 it('restores all 353 saved kits without changing their tile slots, plus four approved props',()=>{
 const previous=JSON.parse(readFileSync('test/fixtures/tiboRecoveredSlots.json','utf8'));
 const pack=defaultTilesets().tibo_interior_expanded;
 expect(pack.structureKits).toHaveLength(357);
 expect(pack.structureKits!.slice(0,353)).toEqual(previous.structureKits);
 expect(pack.passability.slice(0,previous.count)).toEqual(previous.passability);
 for(const kit of pack.structureKits!){expect(existsSync(`public/assets/tibo-interior/${kit.id}.png`)).toBe(true);expect(tiboInteriorObjectById(kit.id)?.cells).toHaveLength(kit.width*kit.height);}
 expect(bundledChipsetFrameCount(pack.image.id)).toBe(pack.count);
 });
 it('extends the old pack without overwriting user edits',()=>{
 const pack=createTiboInteriorTileset();pack.count=1890;pack.structureKits=pack.structureKits!.slice(0,353);pack.name='내 소품';pack.passability[480]={up:true,down:true,left:true,right:true};
 const p={tilesets:{tibo_interior_expanded:pack}};ensureBundledTilesets(p);expect(pack.structureKits).toHaveLength(357);expect(pack.name).toBe('내 소품');expect(pack.passability[480].down).toBe(true);
 const once=JSON.stringify(pack);ensureBundledTilesets(p);expect(JSON.stringify(pack)).toBe(once);
 });
});
