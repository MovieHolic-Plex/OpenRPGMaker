import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { initLocalProjectStore, openLocalProjectStore } from '../../../../electron/local-store/store';
import { createBlankProject } from '../../../project/defaults/blankProject';
import { createBlankMap } from '../../../project/defaults/defaultMaps';
import { createModernCityTileset, ensureModernCityTileset, ensureModernCityReferences } from '../../../project/defaults/modernCity';
import { canMove, isPassable } from '../../../project/collision';
import { deserialize, serialize } from '../../../project/io/serialize';

type ParkingRecipe = {
  id: string; name: string; tilesetId: string; width: number; height: number;
  rows: {tiles:number[]; upperTiles:number[]}[]; start:[number,number];
  targets:[number,number][]; blocked:[number,number][];
};

/** A new canonical project only. Never overwrite an existing author's project. */
export async function saveParkingProject(projectDir: string, evidenceDir: string, repo: string, recipePath?: string) {
  if (existsSync(join(projectDir, 'project.sqlite'))) throw new Error('Destination already contains a project');
  const tileset = createModernCityTileset();
  const kit = tileset.structureKits!.find(k => k.id === 'mc-parking-two-bays');
  if (!kit) throw new Error('Publish the approved parking kit first');
  const map = createBlankMap('지하 주차장 · 두 면', kit.width, kit.height, tileset.id, 16);
  map.id = 'map_approved_parking';
  map.lowerTiles = kit.rows.flatMap(r => r.tiles);
  map.upperTiles = kit.rows.flatMap(r => r.upperTiles ?? Array(kit.width).fill(-1));
  const recipe: ParkingRecipe | null = recipePath ? JSON.parse(readFileSync(recipePath, 'utf8')) : null;
  if (recipe) {
    if (recipe.id !== 'mc-parking-wide-experiment' || recipe.tilesetId !== tileset.id) throw new Error('Unsupported assembly recipe');
    map.id = 'map_parking_wide'; map.name = recipe.name;
    map.width = recipe.width; map.height = recipe.height;
    map.lowerTiles = recipe.rows.flatMap(r => r.tiles);
    map.upperTiles = recipe.rows.flatMap(r => r.upperTiles);
  }
  const project = createBlankProject();
  project.meta.title = recipe ? recipe.name : '지하 주차장 · 검수 완료 두 면';
  delete project.system.opening;
  project.maps = { [map.id]: map };
  project.mapTree = { mapId: map.id, children: [] };
  project.startMapId = map.id;
  project.startPos = recipe ? {x:recipe.start[0],y:recipe.start[1]} : { x: 1, y: 4 };
  project.tilesets[tileset.id] = tileset;
  // Prove the existing-project bundle migration also receives the kit/docs.
  const old: ReturnType<typeof createModernCityTileset> = JSON.parse(readFileSync(join(evidenceDir, 'previous-tileset.json'), 'utf8'));
  old.id = tileset.id; old.image = tileset.image;
  old.referenceDocuments = [{ id: 'authored', name: '보존', description: '사용자 참고문서 보존 검사', documents: [], images: [] }];
  ensureModernCityTileset(old); ensureModernCityReferences(old);
  if (!old.structureKits!.some(k => k.id === kit.id) || !old.referenceDocuments!.some(c => c.id === 'mc-parking') || !old.referenceDocuments!.some(c => c.id === 'authored')) throw new Error('Existing project migration failed');
  const start = [project.startPos.x, project.startPos.y];
  const queue = [start], reached = new Set([start.join(',')]);
  const moves = [[1,0],[-1,0],[0,1],[0,-1]];
  for (let i=0; i<queue.length; i++) {
    const [x,y] = queue[i];
    for (const [dx,dy] of moves) {
      const xx=x+dx, yy=y+dy, key=`${xx},${yy}`;
      if (!reached.has(key) && canMove(project,map,x,y,xx,yy)) { reached.add(key);queue.push([xx,yy]); }
    }
  }
  const targets = recipe?.targets ?? [[9,2],[9,4],[9,6],[9,5],[0,4]];
  const blocked = recipe?.blocked ?? [[5,0],[5,1],[0,2],[9,3],[12,4],[12,5]];
  for (const [x,y] of targets) if (!reached.has(`${x},${y}`)) throw new Error(`Required walkway unreachable: ${x},${y}`);
  for (const [x,y] of blocked) if (isPassable(project,map,x,y)) throw new Error(`Solid object is walkable: ${x},${y}`);
  deserialize(serialize(project)); // Reject invalid generated metadata before creating a project.
  const store = await initLocalProjectStore({ projectDir });
  let saved;
  const projectId = store.projectId;
  try {
    // Keep a content-addressed source copy alongside the canonical document.
    await store.putAsset(readFileSync(join(repo,'public/assets/modern-city/modern-city-chipset.png')), {mime:'image/png', extension:'png', originalName:'modern-city-chipset.png',kind:'tileset'});
    saved = await store.saveProject(project);
    if (saved.kind !== 'saved') throw new Error(`Canonical save failed: ${JSON.stringify(saved)}`);
  } finally { store.close(); }
  const reopened = await openLocalProjectStore({ projectDir });
  try {
    const snapshot = reopened.loadSnapshot();
    if (!snapshot || snapshot.sha256 !== saved.sha256 || JSON.stringify(snapshot.project.maps[map.id]) !== JSON.stringify(map)) throw new Error('Canonical reload mismatch');
    mkdirSync(evidenceDir,{recursive:true});
    writeFileSync(join(evidenceDir,'reloaded-project.json'),JSON.stringify(snapshot.project));
    const proof = {projectId, projectDir, mapId:map.id, revision:snapshot.revision, sha256:snapshot.sha256,
      kit:recipe?.id ?? kit.id, width:map.width,height:map.height, reachableCells:reached.size,
      requiredRoutes:targets, canonicalReload:true, newAndExistingBundle:true};
    writeFileSync(join(evidenceDir,'canonical-proof.json'),JSON.stringify(proof,null,2)+'\n');
    return proof;
  } finally { reopened.close(); }
}
