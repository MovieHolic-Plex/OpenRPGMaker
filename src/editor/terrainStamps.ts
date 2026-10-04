import type { GameMap, TilesetDef } from "@/project/types";
import type { TerrainStamp, TerrainStampCell } from "@/project/terrainDesign";
import { cellLayerTiles, compactMapLayers, layerTileAt, setLayerTileAt, shadowAt, setShadowAt } from "@/project/mapLayers";
import { emptyRelief, copyRelief } from "@/project/relief/edit";
import { normalizeTerrainDesign } from "@/project/terrainDesign";
import { terrainEditable, type TerrainDesignPlan } from "./terrainDesignPlans";
import { transformPoint, type TerrainPoint } from "./terrainDesignGeometry";
import { autotileGroupsForTileset } from "@/project/defaults/autotileGroups";
import { shapeAutotileGroupAround } from "@/project/defaults/autotileEngine";
import { genId } from "@/util/id";

export function captureTerrainStamp(map: GameMap, a: TerrainPoint, b: TerrainPoint, name: string): TerrainStamp {
  const x0 = Math.max(0, Math.min(a.x, b.x)), y0 = Math.max(0, Math.min(a.y, b.y));
  const width = Math.min(map.width - x0, Math.abs(a.x - b.x) + 1), height = Math.min(map.height - y0, Math.abs(a.y - b.y) + 1);
  if (width < 1 || height < 1 || width > 128 || height > 128) throw new Error("도장은 최대 128×128칸으로 고르세요");
  const cells: TerrainStampCell[] = [], at = new Map<number, number>();
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y0 + y) * map.width + x0 + x; at.set(i, cells.length);
    cells.push({ layers: [...cellLayerTiles(map, i)], shadow: shadowAt(map, i), level: map.relief?.levels[i] ?? 0, ramp: map.relief?.ramps?.[i] ?? 0, depth: map.terrainDesign?.waterDepth?.[i] ?? 0 });
  }
  const groups = map.doodadGroups?.filter(g => g.cells.every(c => at.has(c.index))).map(g => ({ label: g.label, kitId: g.kitId, cells: g.cells.map(c => ({ ...c, index: at.get(c.index)! })) }));
  if (map.doodadGroups?.some(g => g.cells.some(c => at.has(c.index)) && !g.cells.every(c => at.has(c.index)))) throw new Error("소품 군집 전체가 사각형 안에 들어오게 고르세요");
  return { id: genId("terrain-stamp"), name: name.trim() || "지형 도장", tilesetId: map.tilesetId, width, height, cells, ...(map.relief?.style ? { style: map.relief.style } : {}), ...(groups?.length ? { groups } : {}), ...(map.relief?.wallDecor?.length ? { wallDecor: map.relief.wallDecor.filter(d => at.has(d.y * map.width + d.x)).map(d => ({ ...d, x: d.x - x0, y: d.y - y0 })) } : {}) };
}
export function transformedRamp(code: number, rotation: number, mirror: boolean): number {
  if (code < 1 || code > 8) return code;
  const dirs = [0, 2, 1, 3], // Stored n,s,e,w -> clockwise n,e,s,w.
    old = (code - 1) % 4, clockwise = dirs[old]!;
  let dir = mirror ? (4 - clockwise) % 4 : clockwise; dir = (dir + rotation) % 4;
  return [1, 3, 2, 4][dir]! + (code > 4 ? 4 : 0);
}
/** Compose map symmetry after the user's stamp transform, including its bounding box. */
export function symmetricStampPlacement(stamp: TerrainStamp, anchor: TerrainPoint, rotation: 0 | 1 | 2 | 3, mirror: boolean, variant: number, mapWidth: number, mapHeight: number): { anchor: TerrainPoint; rotation: 0 | 1 | 2 | 3; mirror: boolean } {
  const width = rotation % 2 ? stamp.height : stamp.width, height = rotation % 2 ? stamp.width : stamp.height;
  const corners = [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]].map(([x, y]) => transformPoint({ x: anchor.x + x!, y: anchor.y + y! }, mapWidth, mapHeight, variant));
  const turn = variant === 1 ? -rotation : variant === 2 ? 2 - rotation : rotation + (variant === 3 ? 2 : variant === 4 ? 1 : variant === 5 ? 3 : 0);
  return { anchor: { x: Math.min(...corners.map(p => p.x)), y: Math.min(...corners.map(p => p.y)) }, rotation: ((turn + 4) % 4) as 0 | 1 | 2 | 3, mirror: mirror !== (variant === 1 || variant === 2) };
}
function transformedShadow(bits: number, rotation: number, mirror: boolean): number {
  let result = 0;
  for (let i = 0; i < 4; i++) if (bits & 1 << i) { let x = i % 2, y = Math.floor(i / 2); if (mirror) x = 1 - x; for (let n = 0; n < rotation; n++) [x, y] = [1 - y, x]; result |= 1 << (y * 2 + x); }
  return result;
}
export function transformTerrainStamp(stamp: TerrainStamp, rotation: 0 | 1 | 2 | 3, mirror: boolean): TerrainStamp {
  const width = rotation % 2 ? stamp.height : stamp.width, height = rotation % 2 ? stamp.width : stamp.height;
  const point = (x: number, y: number) => {
    let p = mirror ? { x: stamp.width - 1 - x, y } : { x, y }, w = stamp.width, h = stamp.height;
    for (let n = 0; n < rotation; n++) { p = { x: h - 1 - p.y, y: p.x }; [w, h] = [h, w]; }
    return p;
  };
  const cells: TerrainStampCell[] = new Array(stamp.cells.length), remap = new Map<number, number>();
  for (let i = 0; i < stamp.cells.length; i++) {
    const p = point(i % stamp.width, Math.floor(i / stamp.width)), c = stamp.cells[i]!; remap.set(i, p.y * width + p.x);
    cells[p.y * width + p.x] = { ...c, layers: [c.layers[0], c.layers[1], -1, -1], shadow: transformedShadow(c.shadow, rotation, mirror), ramp: transformedRamp(c.ramp, rotation, mirror) };
  }
  // Keep each connected prop's pixel art upright; rotate its center/position, not its tile pieces.
  const seen = new Set<number>(), propTargets = new Map<number, number>();
  for (let i = 0; i < stamp.cells.length; i++) {
    if (seen.has(i) || stamp.cells[i]!.layers[2] < 0 && stamp.cells[i]!.layers[3] < 0) continue;
    const component = [i]; seen.add(i);
    for (let n = 0; n < component.length; n++) { const c = component[n]!, x = c % stamp.width, y = Math.floor(c / stamp.width); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx!, Y = y + dy!, j = Y * stamp.width + X; if (X < 0 || Y < 0 || X >= stamp.width || Y >= stamp.height || seen.has(j) || stamp.cells[j]!.layers[2] < 0 && stamp.cells[j]!.layers[3] < 0) continue; seen.add(j); component.push(j); } }
    const x0 = Math.min(...component.map(i => i % stamp.width)), y0 = Math.min(...component.map(i => Math.floor(i / stamp.width))), x1 = Math.max(...component.map(i => i % stamp.width)), y1 = Math.max(...component.map(i => Math.floor(i / stamp.width)));
    const center = point((x0 + x1) / 2, (y0 + y1) / 2), ox = Math.round(center.x - (x1 - x0) / 2), oy = Math.round(center.y - (y1 - y0) / 2);
    for (const index of component) {
      const x = ox + index % stamp.width - x0, y = oy + Math.floor(index / stamp.width) - y0;
      if (x < 0 || y < 0 || x >= width || y >= height) throw new Error("소품 그림이 도장 밖으로 나갑니다. 여백을 포함해 저장하세요");
      const target = y * width + x, old = cells[target]!;
      if (old.layers[2] >= 0 || old.layers[3] >= 0) throw new Error("회전한 소품이 겹칩니다. 여백을 포함해 저장하세요");
      old.layers[2] = stamp.cells[index]!.layers[2]; old.layers[3] = stamp.cells[index]!.layers[3]; propTargets.set(index, target);
    }
  }
  const groups = stamp.groups?.map(g => ({ ...g, cells: g.cells.map(c => ({ ...c, index: propTargets.get(c.index) ?? remap.get(c.index)! })) }));
  return { ...stamp, width, height, cells, ...(groups ? { groups } : {}), ...(stamp.wallDecor ? { wallDecor: stamp.wallDecor.map(d => ({ ...d, ...point(d.x, d.y) })) } : {}) };
}
export function planTerrainStamp(map: GameMap, tileset: TilesetDef, source: TerrainStamp, anchor: TerrainPoint, rotation: 0 | 1 | 2 | 3, mirror: boolean): TerrainDesignPlan {
  if (source.tilesetId !== map.tilesetId) return { ok: false, reason: "같은 칩셋의 맵에서 도장을 사용하세요", indices: [] };
  let stamp: TerrainStamp;
  try { stamp = transformTerrainStamp(source, rotation, mirror); } catch (e) { return { ok: false, reason: (e as Error).message, indices: [] }; }
  if (anchor.x < 0 || anchor.y < 0 || anchor.x + stamp.width > map.width || anchor.y + stamp.height > map.height) return { ok: false, reason: "도장이 맵 밖으로 나갑니다", indices: [] };
  const indices = stamp.cells.map((_, i) => (anchor.y + Math.floor(i / stamp.width)) * map.width + anchor.x + i % stamp.width);
  if (indices.some(i => !terrainEditable(map, i, true, false))) return { ok: false, reason: "잠금·이벤트·기존 소품을 피해 놓으세요", indices };
  const beforeGroups = map.doodadGroups?.filter(g => g.cells.some(c => indices.includes(c.index)));
  if (beforeGroups?.length) return { ok: false, reason: "기존 군집을 옮기거나 지운 뒤 놓으세요", indices };
  const dirty = new Set(indices);
  for (const i of indices) for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const x=i%map.width+dx,y=Math.floor(i/map.width)+dy;if(x>=0&&y>=0&&x<map.width&&y<map.height)dirty.add(y*map.width+x);}
  return { ok: true, reason: `${stamp.name} · ${stamp.width}×${stamp.height}칸`, indices: [...dirty], apply: draft => {
    draft.relief = draft.relief ? copyRelief(draft.relief) : emptyRelief(draft.width, draft.height); draft.relief.ramps ??= new Array<number>(draft.width * draft.height).fill(0);
    draft.terrainDesign = { ...draft.terrainDesign, waterDepth: draft.terrainDesign?.waterDepth?.slice() ?? new Array<number>(draft.width * draft.height).fill(0) };
    for (let n = 0; n < indices.length; n++) { const i = indices[n]!, c = stamp.cells[n]!; for (const layer of [1, 2, 3, 4] as const) setLayerTileAt(draft, layer, i, c.layers[layer - 1]!); setShadowAt(draft, i, c.shadow); draft.relief.levels[i] = c.level; draft.relief.ramps[i] = c.ramp; draft.terrainDesign.waterDepth[i] = c.depth; }
    if (stamp.style && !map.relief?.style) draft.relief.style = stamp.style;
    const overwritten = new Set(indices);
    draft.relief.wallDecor = [...(draft.relief.wallDecor ?? []).filter(d => !overwritten.has(d.y * draft.width + d.x)), ...(stamp.wallDecor ?? []).map(d => ({ ...d, x: d.x + anchor.x, y: d.y + anchor.y }))];
    if (stamp.groups) draft.doodadGroups = [...(draft.doodadGroups ?? []), ...stamp.groups.map(g => ({ ...g, id: genId("doodad"), cells: g.cells.map(c => ({ ...c, index: indices[c.index]!, before: layerTileAt(map, 3, indices[c.index]!) })) }))];
    const points = indices.map(i => ({ x: i % draft.width, y: Math.floor(i / draft.width) }));
    for (const group of autotileGroupsForTileset(tileset)) if ((group.layer ?? "lower") === "lower" && stamp.cells.some(c => group.memberTileIds.includes(c.layers[0]))) shapeAutotileGroupAround(draft, group, points);
    const design = normalizeTerrainDesign(draft.terrainDesign, draft.width * draft.height); if (design) draft.terrainDesign = design; else delete draft.terrainDesign;
    compactMapLayers(draft);
  } };
}
