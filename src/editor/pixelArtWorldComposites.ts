import recipes from '@/assets/pixelArtWorldTabletopComposites.json';
import type { ExternalTilesetPack } from '@/project/externalTilesetCatalog';
import type { TilesetDef } from '@/project/types';
import { validateTilesetReferences, type TilesetReferenceCategory } from '@/project/tilesetReferences';

/** Only source rectangles/offsets are shipped. The user's verified PNG supplies all pixels. */
export function appendPixelArtWorldComposites(pack: ExternalTilesetPack, source: HTMLImageElement, target: TilesetDef, currentImage: HTMLImageElement) {
  const selected = recipes.filter(r => r.packId === pack.id);
  if (!selected.length) return null;
  if (target.tileSize !== 32 || target.tilesPerRow !== 8 || currentImage.width !== 256 || currentImage.height * 8 / 32 < target.count) throw Error('상판 합성 대상 규격이 다릅니다.');
  if (source.width !== pack.width || source.height !== pack.height || selected.some(r => r.sourceSha256 !== pack.sha256)) throw Error('상판 합성 원본 판본이 다릅니다.');
  if (target.referenceDocuments?.some(c => c.id === 'paw-tabletop-composites') || selected.some(r => target.tileGroups?.some(g => g.id === r.id))) throw Error('상판 조립 자료가 이미 있습니다. 기존 조립을 중복 추가하지 않습니다.');
  const tileset = structuredClone(target);
  const firstRow = Math.ceil(Math.max(target.count / 8, currentImage.height / 32));
  const height = (firstRow + selected.reduce((n,r) => n + r.canvas.height / 32, 0)) * 32;
  const atlas = document.createElement('canvas'); atlas.width = 256; atlas.height = height;
  const ctx = atlas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = false; ctx.drawImage(currentImage, 0, 0);
  const raw = document.createElement('canvas'); raw.width = source.width; raw.height = source.height;
  raw.getContext('2d')!.drawImage(source, 0, 0);
  const pixels = raw.getContext('2d')!.getImageData(0, 0, raw.width, raw.height).data;
  const prefix = ctx.getImageData(0, 0, raw.width, raw.height).data;
  for (let i=0;i<pixels.length;i++) if ((i%4===3 || pixels[i-i%4+3]!>0) && pixels[i]!==prefix[i]) throw Error('기존 아틀라스의 원본 칸이 변경되어 상판 조립을 적용할 수 없습니다.');
  const alpha = (x: number, y: number) => pixels[(y * raw.width + x) * 4 + 3]!;
  tileset.count = height / 32 * 8;
  for (let i = target.count; i < tileset.count; i++) {
    tileset.passability[i] = { up: false, down: false, left: false, right: false };
    tileset.priority[i] = 'upper'; tileset.terrain[i] = 0;
    (tileset.tileMeta ??= [])[i] = { label: '조립 행 여백', description: '배치하지 않는 투명 정렬 칸.', source: 'unknown' };
  }
  const category: TilesetReferenceCategory = { id: 'paw-tabletop-composites', name: '상판과 소품의 완전 조립', description: '기존 원본 칸은 보존하고 완전 가구와 소품을 사용자 로컬에서 합성한 추가 타일. 상위 두 물체를 덮어 지우지 않는다.', documents: [], images: [] };
  const placements = [];
  let row = firstRow;
  for (const recipe of selected) {
    const w = recipe.canvas.width / 32, h = recipe.canvas.height / 32;
    const canvas = document.createElement('canvas'); canvas.width = recipe.canvas.width; canvas.height = recipe.canvas.height;
    const draw = canvas.getContext('2d', { willReadFrequently: true })!; draw.imageSmoothingEnabled = false;
    for (const part of [recipe.base, ...recipe.overlays]) {
      const r = part.sourceRect, o = part.offset;
      if (![r.x,r.y,r.width,r.height,o.x,o.y].every(Number.isInteger) || r.x < 0 || r.y < 0 || r.x+r.width > source.width || r.y+r.height > source.height || o.x < 0 || o.y < 0 || o.x+r.width > canvas.width || o.y+r.height > canvas.height) throw Error('합성 사각형이 원본 또는 가구 범위를 벗어납니다.');
      draw.drawImage(source, r.x, r.y, r.width, r.height, o.x, o.y, r.width, r.height);
    }
    // The complete object's bottom two visible rows must rest on opaque tabletop pixels.
    for (const part of recipe.overlays) {
      const r = part.sourceRect, base = recipe.base.sourceRect;
      let bottom = -1;
      for (let y=0;y<r.height;y++) for(let x=0;x<r.width;x++) if(alpha(r.x+x,r.y+y)>0) bottom=y;
      if (bottom < 0) throw Error('빈 상판 소품입니다.');
      for(let y=Math.max(0,bottom-1);y<=bottom;y++) for(let x=0;x<r.width;x++) if(alpha(r.x+x,r.y+y)>0) {
        const bx=part.offset.x+x, by=part.offset.y+y;
        if(by<recipe.tabletopSupportYInclusive[0]!||by>recipe.tabletopSupportYInclusive[1]!||alpha(base.x+bx,base.y+by)!==255) throw Error(`${recipe.name}: 소품 밑동이 상판 밖입니다.`);
      }
    }
    ctx.drawImage(canvas, 0, row * 32);
    const tiles = Array.from({length:h},(_,y)=>Array.from({length:w},(_,x)=>(row+y)*8+x));
    for (const tile of tiles.flat()) tileset.tileMeta![tile] = { label: recipe.name, description: '완전 가구와 상판 소품을 합친 고정 조립. 전 조각을 상위에 놓고 기존 하위 바닥을 보존한다.', defaultLayer: 'upper', passage: 'solid', repeatability: 'fixed', source: 'imported' };
    const supportCells=Array.from({length:w},(_,x)=>({x,y:h-1}));
    (tileset.tileGroups ??= []).push({ id:recipe.id, name:recipe.name, role:'prop', defaultLayer:'upper', tileIds:tiles.flat(), source:'imported', confidence:'high', sourceRect:{x:0,y:row,width:w,height:h}, description:recipe.notes, placementRules:`${w}×${h} 전체 고정 배열. 밑동은 실제 바닥. 소품은 이미 합성했으므로 별도 upper 소품을 덮지 않는다. ${recipe.facing}쪽 조작면과 접근칸을 보존한다.` });
    const lowerTiles=Array(w*h).fill(-1) as number[], upperTiles=tiles.flat();
    (tileset.structureKits ??= []).push({id:recipe.id,kind:'section',name:recipe.name,width:w,height:h,tileSize:32,rows:tiles.map(upper=>({tiles:Array(w).fill(-1),upperTiles:upper})),learnedFrom:'db-authored',ai:{description:recipe.name,placementRules:`고정 배열 전체를 상위에 배치. 바닥을 보존하고 남쪽 조작면으로 접근한다.`,repeatability:'fixed',layerHome:'upper',origin:'ai'}});
    category.images.push({id:recipe.id,name:recipe.id+'.png',caption:'사용자 원본의 전체 가구와 완전 소품을 원래 픽셀로 합성.',dataUrl:canvas.toDataURL('image/png')});
    category.documents.push({id:recipe.id,name:recipe.name+'.md',markdown:[`# ${recipe.name}`,`tilesetId: ${tileset.id}. 원본 ${pack.filename}, SHA256 ${pack.sha256}.`,recipe.notes,'좌표는 0기준 픽셀. 리사이즈·반전·회전·부분 다리 잘라내기 없음. base 전체를 먼저 그리고 overlay를 순서대로 source-over 합성했다. sourceRect는 원본 픽셀, 아래 tiles는 현재 아틀라스 번호라 다른 프로젝트에서 번호만 복사하지 않는다.',`\`\`\`json\n${JSON.stringify({recipe,width:w,height:h,tiles,lowerTiles,upperTiles,supportCells,facing:recipe.facing},null,2)}\n\`\`\``, '배치는 하위 실제 바닥을 보존하고 상위에 전체 배열을 찍는다. 기존 가구 위에 소품만 같은 상위 칸으로 덮으면 가구가 사라진다. ★통행과 상위 레이어는 다르며 전체 가구 사각형은 차단된다. 상판 장비는 새 통행 칸을 추가하지 않는다. 계산기의 키패드는 남쪽/남서쪽을 향하므로 북쪽 직원 배치는 피한다. 자동 상호작용은 없다.',`![완전 조립](image:${recipe.id})`,`[제작자](${pack.sourcePage}) · ${pack.credit} · 원본/가공 소재 재배포 금지.`].join('\n\n')});
    placements.push({id:recipe.id,tiles,width:w,height:h,baseRecipeId:recipe.baseRecipeId}); row+=h;
  }
  for (const kit of tileset.structureKits!.filter(k=>selected.some(r=>r.id===k.id))) kit.referenceDocuments=[{...category,documents:category.documents.filter(d=>d.id===kit.id),images:category.images.filter(i=>i.id===kit.id)}];
  (tileset.referenceDocuments ??= []).push(category); validateTilesetReferences(tileset.referenceDocuments);
  return { tileset, dataUrl: atlas.toDataURL('image/png'), imageWidth: atlas.width, imageHeight: atlas.height, placements };
}
