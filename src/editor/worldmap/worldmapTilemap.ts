import type { GameMap, Project, TilesetDef, TilesetId } from '@/project/types';
import { WORLDMAP_SELECTED_ICONS, WORLDMAP_SELECTED_ID, WORLDMAP_SELECTED_TEXTURE } from '@/project/defaults/worldmapSelected';
import type { WorldmapBuildResult } from './worldmapBuild';

type Build = Extract<WorldmapBuildResult, { ok: true }>;

/** Real material tiles, with a coordinate-independent terrain atlas and separate approved props. */
export function makeWorldmapTilemap(project: Project, id: TilesetId, assetId: string, result: Build, old?: GameMap) {
  const packed = result.tilemap;
  if (!packed || packed.version !== 1 || packed.lowerTiles.length !== result.world.width * result.world.height) {
    throw Error('호스트 월드맵 빌더를 업데이트하세요. 완성 지도 이미지를 팔레트로 등록하지 않습니다.');
  }
  const count = packed.tiles.length;
  const tileset: TilesetDef = {
    id, name: `세계 지도 · ${result.theme} 지형`, family: 'worldmap-kit', kind: 'custom',
    image: { type: 'uploaded', id: assetId }, tileSize: 16, tilesPerRow: packed.tilesPerRow, count,
    passability: packed.tiles.map(tile => ({ up: tile.walkable, down: tile.walkable, left: tile.walkable, right: tile.walkable })),
    priority: new Array(count).fill('lower'), terrain: new Array(count).fill(0),
    tileMeta: packed.tiles.map(tile => ({ label: tile.label, description: '다른 좌표에도 놓을 수 있는 세계 지도 지형 조각', defaultLayer: 'lower', passage: tile.walkable ? 'passable' : 'solid', tags: ['worldmap-material', tile.key], source: 'imported' })),
    tileGroups: packed.groups.map((group, i) => ({ id: `worldmap-material-${i}`, name: group.name, role: 'terrain', defaultLayer: 'lower',
      tileIds: [group.representative, ...group.tiles.filter(tile => tile !== group.representative)], description: `${group.name} 지형과 경계 변형`,
      placementRules: '대표 재료를 바닥에 칠한다. 경계 변형은 캔버스 스포이트로 선택한다. 큰 지형 변경은 edit_world_terrain으로 한다.', source: 'imported' })),
    referenceSourceTilesetId: WORLDMAP_SELECTED_ID,
  };
  const upper = new Array<number>(packed.lowerTiles.length).fill(-1);
  const source = project.tilesets[WORLDMAP_SELECTED_ID];
  const graft = (tile: number, inheritGround = false) => {
    const passage = inheritGround ? 'star' : source?.tileMeta?.[tile]?.passage;
    const found = tileset.tileGrafts?.find(g => g.sourceChipset === WORLDMAP_SELECTED_TEXTURE && g.sourceTile === tile && tileset.tileMeta?.[g.targetTile]?.passage === passage);
    if (found) return found.targetTile;
    if (!source) throw Error('공용 사람 선택 월드맵 타일셋이 없습니다.');
    const targetTile = tileset.count++;
    (tileset.tileGrafts ??= []).push({ targetTile, sourceChipset: WORLDMAP_SELECTED_TEXTURE, sourceTile: tile });
    tileset.passability[targetTile] = inheritGround
      ? { up: true, down: true, left: true, right: true }
      : { ...source.passability[tile]! };
    tileset.priority[targetTile] = 'upper'; tileset.terrain[targetTile] = 0;
    tileset.tileMeta![targetTile] = { ...source.tileMeta![tile]!, ...(inheritGround ? { passage: 'star' as const } : {}) };
    return targetTile;
  };
  const icons = WORLDMAP_SELECTED_ICONS.filter(icon => icon.theme === (result.iconSelection?.rendered[0]?.iconId.split('/')[0] ?? result.theme));
  // A palette contains complete prop kits; users never have to assemble an icon by tile number.
  tileset.structureKits = icons.map(icon => ({ id: `wmi-${icon.id}`, name: icon.name, kind: 'section', tileSize: 16, width: icon.width, height: icon.height,
    rows: icon.rows.map(row => ({ tiles: row.map(() => -1), upperTiles: row.map(tile => graft(tile)) })), learnedFrom: 'db-authored',
    ai: { role: 'prop', repeatability: 'fixed', layerHome: 'upper', tags: ['worldmap-icon', icon.theme], description: icon.name,
      placementRules: '열린 육지 위에 전체 배열로 놓는다. 이동 이벤트는 따로 연결한다.' } }));
  for (const site of result.iconSelection?.rendered ?? []) {
    const icon = WORLDMAP_SELECTED_ICONS.find(icon => icon.id === site.iconId);
    if (!icon || icon.sha256 !== site.sha256) throw Error(`선택 아이콘 판본 불일치: ${site.iconId}`);
    for (let y = 0; y < icon.height; y++) for (let x = 0; x < icon.width; x++) {
      // The original journey's walk table owns passage for generated sites.
      upper[(site.y + y) * result.world.width + site.x + x] = graft(icon.rows[y]![x]!, true);
    }
  }
  const generatedUpper = [...upper], lower = [...packed.lowerTiles];
  if (old) {
    const previous = project.tilesets[old.tilesetId]!;
    const baseline = old.worldmapSource?.tilemap;
    const remappedGrafts = new Map<number, number>();
    const resolveOld = (tile: number) => {
      if (tile < 0) return tile;
      const oldGraft = previous.tileGrafts?.find(g => g.targetTile === tile);
      if (oldGraft) {
        const known = remappedGrafts.get(tile);
        if (known !== undefined) return known;
        const target = tileset.count++;
        (tileset.tileGrafts ??= []).push({ ...oldGraft, targetTile: target });
        tileset.passability[target] = { ...previous.passability[tile]! };
        tileset.priority[target] = previous.priority[tile]!;
        tileset.terrain[target] = previous.terrain[tile] ?? 0;
        if (previous.tileMeta?.[tile]) tileset.tileMeta![target] = structuredClone(previous.tileMeta[tile]!);
        remappedGrafts.set(tile, target);
        return target;
      }
      const key = baseline?.materialKeys[tile], mapped = key ? packed.tiles.findIndex(t => t.key === key) : -1;
      if (mapped >= 0) return mapped;
      throw Error('손으로 놓은 타일이 새 지형 재료에 없습니다. 기존 지도를 보존하려면 새 mapId로 생성하세요.');
    };
    if (baseline) {
      for (let i = 0; i < lower.length; i++) {
        if (old.lowerTiles[i] !== baseline.lowerTiles[i]) lower[i] = resolveOld(old.lowerTiles[i]!);
        if (old.upperTiles[i] !== baseline.upperTiles[i]) upper[i] = resolveOld(old.upperTiles[i]!);
      }
    } else {
      if (old.lowerTiles.some((tile, i) => tile !== i)) throw Error('기존 지도 바닥의 손 편집을 덮어쓰지 않습니다. 새 mapId로 생성하세요.');
      for (let i = 0; i < upper.length; i++) if (old.upperTiles[i]! >= 0) upper[i] = resolveOld(old.upperTiles[i]!);
    }
    for (const layer of [old.lowerOverlayTiles, old.upperOverlayTiles]) if (layer) {
      for (let i = 0; i < layer.length; i++) layer[i] = resolveOld(layer[i]!);
    }
    for (const stacks of [old.lowerTileStacks, old.upperTileStacks]) if (stacks) {
      for (const [cell, tiles] of Object.entries(stacks)) stacks[Number(cell)] = tiles.map(resolveOld);
    }
    for (const group of old.doodadGroups ?? []) for (const cell of group.cells) {
      cell.tile = resolveOld(cell.tile);
      cell.before = resolveOld(cell.before);
    }
  }
  return { tileset, lower, upper, baseline: { version: 1 as const, lowerTiles: [...packed.lowerTiles], upperTiles: generatedUpper, materialKeys: packed.tiles.map(tile => tile.key) } };
}
