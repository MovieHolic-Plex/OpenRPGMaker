import catalog from '@/assets/beodeulGroundCatalog.json';
import references from '@/assets/beodeulGroundReferences.json';
import type { StructureKitDef, TileGroupMetadata, TilesetDef } from '../types';

export const BEODEUL_GROUND_ID='beodeul_ground';
export const BEODEUL_GROUND_TEXTURE='tex_beodeul_ground';
export const BEODEUL_GROUND_RECIPES=catalog.recipes;
export const beodeulGroundReferences=()=>structuredClone(references);

export function createBeodeulGroundTileset():TilesetDef {
  const passability=Array.from({length:catalog.count},()=>({up:true,down:true,left:true,right:true}));
  for(const r of catalog.recipes) if(r.blocked) for(const n of r.rows.at(-1)??[])
    if(n!=null&&n>=0) passability[n]={up:false,down:false,left:false,right:false};
  // The wall-facing row is ★: its transparent foundation must inherit the wall's passage.
  const priority=Array.from({length:catalog.count},()=>'lower' as 'lower'|'upper');
  for(const r of catalog.recipes){
    if(r.upperCells)for(const [x,y] of r.upperCells){const n=r.rows[y!]?.[x!];if(n!=null&&n>=0)priority[n]='upper';}
    if(r.blockingCells)for(const [x,y] of r.blockingCells){const n=r.rows[y!]?.[x!];if(n!=null&&n>=0){priority[n]='lower';passability[n]={up:false,down:false,left:false,right:false};}}
  }
  for(const n of catalog.recipes.find(r=>r.id==='bdg-foundation')!.rows[0]!)
    if(n!=null&&n>=0) priority[n]='upper';
  for(const n of catalog.recipes.find(r=>r.id==='bdg-tree-neck')!.rows.flat()) if(n!=null&&n>=0) priority[n]='upper';
  for(const r of catalog.recipes.filter(r=>r.id.startsWith('bdg-foundation-')))
    for(const n of r.rows.flat()) if(n!=null&&n>=0) priority[n]='upper';
  return {id:BEODEUL_GROUND_ID,name:'버들항 · 기초·밑동·잔디 꾸미기',
    image:{type:'bundled',id:BEODEUL_GROUND_TEXTURE},kind:'custom',family:'oprn-atlas',
    tileSize:16,tilesPerRow:8,count:catalog.count,passability,
    priority,terrain:Array(catalog.count).fill(0),
    tileGroups:catalog.recipes.map<TileGroupMetadata>(r=>({id:r.id,name:r.name,role:'prop',defaultLayer:r.layer<=2?'lower':'upper',layerHome:r.layer<=2?'lower':'upper',
      tileIds:r.rows.flat().filter(n=>n>=0),origin:'ai',description:r.layer===1?'잔디 경계와 통행을 유지한 전체 바닥 칸, 홈 층 1.':`투명 덧그림, 실제 도구 홈 층 ${r.layer}.`,
      placementRules:('hamlet' in r&&r.hamlet)?'naturalize_beodeul_hamlet로 지원하는 작은 마을의 길·마당에 배치. 전체 원본 집 일치 후 실행.':('lighting' in r&&r.lighting)?'harmonize_beodeul_daylight로 집·나무·길 연결을 보존하며 적용. source 번호를 맵 번호로 추측하지 않는다.':'집·나무·길을 보존하는 dress_beodeul_ground로 배치. source 번호를 맵 번호로 추측하지 않는다.'})),
    structureKits:catalog.recipes.filter(r=>r.layer===4&&!r.id.startsWith('bdg-foundation')&&!['bdg-roots','bdg-root-shadow','bdg-tree-neck'].includes(r.id)).map<StructureKitDef>(r=>({
      id:r.id,name:r.name,kind:'section',learnedFrom:'pack-preset',width:r.width,height:r.height,tileSize:16,
      rows:r.rows.map(row=>({tiles:row.map(()=>-1),upperTiles:row})),
      ai:{role:'prop',repeatability:'fixed',layerHome:'upper',tags:['버들항','잔디','꾸미기'],description:r.name,placementRules:'빈 잔디만. 문 앞·길·기존 물체 위 금지. 자동 군락은 dress_beodeul_ground.'}})),
    referenceDocuments:beodeulGroundReferences()};
}

export function ensureBeodeulGroundReferences(tileset:TilesetDef):boolean {
  if(!['beodeul_city',BEODEUL_GROUND_ID].includes(tileset.id)||tileset.referenceSourceTilesetId) return false;
  const cats=[...(tileset.referenceDocuments??[])];let changed=false;
  if(tileset.id===BEODEUL_GROUND_ID&&tileset.image.id===BEODEUL_GROUND_TEXTURE){
    const shippedIds=new Set(catalog.recipes.map(r=>r.id));
    const fresh=createBeodeulGroundTileset();
    if(tileset.count<fresh.count){
      for(let n=tileset.count;n<fresh.count;n++){
        tileset.priority[n]=fresh.priority[n]!;tileset.passability[n]=structuredClone(fresh.passability[n]!);tileset.terrain[n]=0;
      }
      tileset.count=fresh.count;changed=true;
    }
    for(const r of catalog.recipes) {
      for(const n of r.rows.flat()) if(n>=0&&tileset.priority[n]!==fresh.priority[n]){
        tileset.priority[n]=fresh.priority[n];tileset.passability[n]=structuredClone(fresh.passability[n]!);changed=true;
      }
      if(!(tileset.tileGroups??[]).some(g=>g.id===r.id)){
        (tileset.tileGroups??=[]).push(fresh.tileGroups!.find(g=>g.id===r.id)!);changed=true;
      }
    }
    for(const kit of tileset.structureKits??[]) if(shippedIds.has(kit.id)){
      if(!kit.learnedFrom){kit.learnedFrom='pack-preset';changed=true;}
      if(kit.ai&&!kit.ai.repeatability){kit.ai.repeatability='fixed';changed=true;}
      if(kit.ai&&!kit.ai.layerHome){kit.ai.layerHome='upper';changed=true;}
    }
  }
  for(const shipped of references){
    const at=cats.findIndex(c=>c.id===shipped.id);
    if(at<0){cats.push(structuredClone(shipped));changed=true;continue;}
    const old=cats[at]!;
    const next={...old,documents:[...old.documents.filter(d=>!shipped.documents.some(s=>s.id===d.id)),...shipped.documents],
      images:[...old.images.filter(d=>!shipped.images.some(s=>s.id===d.id)),...shipped.images]};
    if(JSON.stringify(old)!==JSON.stringify(next)){cats[at]=structuredClone(next);changed=true;}
  }
  if(changed) tileset.referenceDocuments=cats;
  return changed;
}
