import catalog from '@/assets/publicForestRecipes.json';
import saved from '@/assets/forestHarmonyTileset.json';
import { canMove, isPassable } from './collision';
import { compileForestRecipe, ForestRecipeError } from './forestRecipes';
import type { GameMap, Project, TilesetDef } from './types';
export type RecipePlacement = { recipeId: string; x: number; y: number };
export type RecipeIssue = { code: string; x: number; y: number; layer?: string; expected?: number; actual?: number; role?: string };
export const PUBLIC_TILE_RECIPE_IDS = catalog.recipes.map(r => r.id);
export function publicRecipe(t: TilesetDef, placement: RecipePlacement) {
  // Includes exact bundled image/count/grafts and integer origin checks.
  compileForestRecipe(t, {recipeId:'strip', x:placement.x, y:placement.y});
  const r = catalog.recipes.find(r => r.id === placement.recipeId);
  if (!r) throw new ForestRecipeError('unsupported-recipe','목록에 없는 조립법입니다.');
  for (const cell of r.tileCoordinates) {
    if (t.priority[cell.id] !== cell.home || t.tileMeta?.[cell.id]?.layerBacking !== (saved as unknown as TilesetDef).tileMeta?.[cell.id]?.layerBacking)
      throw new ForestRecipeError('recipe-source-changed',`타일 ${cell.id}의 레이어/받침이 기준과 다릅니다.`);
  }
  return r;
}
function bounds(map: GameMap, p: RecipePlacement, r: {width:number;height:number}) {
  if (p.x+r.width>map.width || p.y+r.height>map.height) throw new ForestRecipeError('out-of-bounds','전체 부품과 접근칸이 들어가야 합니다.',p.x,p.y);
}
export function validatePublicTileRecipes(project: Project, map: GameMap, placements: RecipePlacement[], entryPoints: {x:number;y:number}[] = []) {
  const issues: RecipeIssue[] = [], anchors = [...entryPoints];
  for (const p of placements) {
    const r=publicRecipe(project.tilesets[map.tilesetId],p);bounds(map,p,r);
    for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++){
      const local=y*r.width+x,at=(p.y+y)*map.width+p.x+x,role=r.roles[local];
      for(const layer of ['lower','upper'] as const){
        const expected=r[`${layer}Tiles`][local],actual=map[`${layer}Tiles`][at];if(expected===actual)continue;
        const opposite=map[layer==='lower'?'upperTiles':'lowerTiles'][at];
        const missing=actual<0 || [240,1141,1145].includes(actual);
        const code=expected>=0 && opposite===expected?'wrong-layer':expected>=0 && role==='root' && missing?'cut-root':expected>=0 && role==='trunk' && missing?'missing-trunk':role.startsWith('edge-')||role.startsWith('corner-')?'wrong-edge-direction':role.startsWith('door-')?'broken-door':role==='cave-mouth'?'broken-cave-mouth':'tile-mismatch';
        issues.push({code,x:p.x+x,y:p.y+y,layer,expected,actual,role});
      }
    }
    for(const a of r.access)anchors.push({x:p.x+a.x,y:p.y+a.y});
  }
  const unique=[...new Map(anchors.map(p=>[`${p.x},${p.y}`,p])).values()];
  const valid=unique.filter(p=>Number.isInteger(p.x)&&Number.isInteger(p.y)&&isPassable(project,map,p.x,p.y));
  for(const p of unique)if(!valid.includes(p))issues.push({code:'blocked-entrance',x:p.x,y:p.y});
  if(valid.length){const queue=[valid[0]],seen=new Set([valid[0].y*map.width+valid[0].x]);for(let i=0;i<queue.length;i++){const p=queue[i];for(const[dx,dy]of [[0,-1],[1,0],[0,1],[-1,0]]){const x=p.x+dx,y=p.y+dy,k=y*map.width+x;if(x<0||y<0||x>=map.width||y>=map.height||seen.has(k))continue;if(canMove(project,map,p.x,p.y,x,y)){seen.add(k);queue.push({x,y});}}}for(const p of valid)if(!seen.has(p.y*map.width+p.x))issues.push({code:'disconnected-entrance',x:p.x,y:p.y});}
  return {valid:issues.length===0,issueCount:issues.length,issues:issues.slice(0,128),access:{anchors:unique,checked:unique.length>0,externalEntriesProvided:entryPoints.length>0},scope:'registered-recipe footprints; tile passability, not runtime event execution'};
}
export function stampPublicTileRecipe(project: Project, map: GameMap, p: RecipePlacement, overwrite=false, entryPoints:{x:number;y:number}[]=[]) {
  const r=publicRecipe(project.tilesets[map.tilesetId],p);bounds(map,p,r);
  const next={...map,lowerTiles:[...map.lowerTiles],upperTiles:[...map.upperTiles]};
  for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++){
    const mx=p.x+x,my=p.y+y,at=my*map.width+mx,from=y*r.width+x;
    if(map.events.some(e=>e.x===mx&&e.y===my))throw new ForestRecipeError('event-overlap','기존 이벤트를 덮지 않습니다.',mx,my);
    const same=map.lowerTiles[at]===r.lowerTiles[from]&&map.upperTiles[at]===r.upperTiles[from];
    if(!overwrite&&!same&&(map.upperTiles[at]>=0||![240,1141,1145].includes(map.lowerTiles[at])))throw new ForestRecipeError('occupied-cell','기존 타일이 있는 영역입니다.',mx,my);
    next.lowerTiles[at]=r.lowerTiles[from];next.upperTiles[at]=r.upperTiles[from];
  }
  const result=validatePublicTileRecipes(project,next,[p],entryPoints);
  if(!result.valid){const e=result.issues[0];throw new ForestRecipeError(e.code,'배치하면 출입/접근 조건을 위반합니다.',e.x,e.y);}
  map.lowerTiles=next.lowerTiles;map.upperTiles=next.upperTiles;
  return result;
}
