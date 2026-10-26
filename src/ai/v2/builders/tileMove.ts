// 조수 v2 — 다시 지어 낼 인자가 없는 실내(손으로 고친 방·dress_room·stamp_object 로 채운 방)의 가구를 «그림 칸 그대로» 옮긴다.
//
// 왜(2026-10-26 hf2-school-claude-j81): move_object 는 방을 같은 인자로 다시 지어 가구를 옮겼다. 이 실행이 짓지 않았거나
// 지은 뒤 손으로 고친 방은 그 인자를 찾지 못해 「가구 목록을 읽지 못했다」로 끝났고, 교장실 소파 하나가 끝까지 남았다.
// 그래서 인자를 못 찾으면: at 칸의 물체 한 점(같은 이름표로 이어진 3·4층 칸, objectClusterAt)을 집어
// 그 칸들의 3·4층 그림을 to 만큼 밀어 옮기거나(to) 걷는다(remove). 옮길 자리에 다른 물체가 있거나 발이 바닥이 아니면 거부하고,
// 옮긴 뒤 걸어 닿는 칸·이벤트가 줄면 되돌린다. 방향 바꾸기(face)는 그림 칸만으로는 못 한다 — 그렇다고 말한다.
import { isPassable } from "@/project/collision";
import { objectClusterAt } from "@/project/objectFootprint";
import type { GameMap, Project } from "@/project/types";
import { access } from "./dressRoom";
import type { ObjectEdit } from "./interior";

export interface TileMoveResult { readonly ok: boolean; readonly project: Project; readonly done: readonly string[]; readonly refused: readonly string[] }

type Layers = { upper: number[]; overlay: number[] };

function withLayers(project: Project, map: GameMap, layers: Layers): Project {
  return { ...project, maps: { ...project.maps, [map.id]: { ...map, upperTiles: layers.upper, upperOverlayTiles: layers.overlay } } };
}

/** 3·4층 그림 칸 단위로 가구를 옮기거나 걷는다. 다시 짓지 않는다 — 방의 나머지 그림은 한 칸도 바뀌지 않는다. */
export function tileMoveObjects(project0: Project, mapId: string, edits: readonly ObjectEdit[]): TileMoveResult {
  let project = project0;
  const done: string[] = [];
  const refused: string[] = [];
  let base = access(project, mapId);
  for (const edit of edits) {
    const map = project.maps[mapId]!;
    const W = map.width;
    const cluster = objectClusterAt(project, map, edit.at.x, edit.at.y);
    if (!cluster) { refused.push(`(${edit.at.x},${edit.at.y}) 에 이름표 있는 가구가 없다`); continue; }
    if (edit.face && !edit.to && !edit.remove) { refused.push(`「${cluster.label}」(${edit.at.x},${edit.at.y}) — 손으로 고친 방에서는 방향을 못 돌린다(옮기기·빼기만 된다)`); continue; }
    if (cluster.cells.length > 24) { refused.push(`「${cluster.label}」(${edit.at.x},${edit.at.y}) — 같은 이름표 칸이 ${cluster.cells.length}칸 이어져 한 점으로 집을 수 없다`); continue; }
    const layers: Layers = { upper: [...map.upperTiles], overlay: [...(map.upperOverlayTiles ?? new Array(map.width * map.height).fill(-1))] };
    const picked = cluster.cells.map((i) => ({ i, x: i % W, y: Math.floor(i / W), upper: layers.upper[i] ?? -1, overlay: layers.overlay[i] ?? -1 }));
    for (const c of picked) { layers.upper[c.i] = -1; layers.overlay[c.i] = -1; }
    if (edit.remove) {
      const next = withLayers(project, map, layers);
      const now = access(next, mapId);
      project = next; base = now;
      done.push(`「${cluster.label}」(${edit.at.x},${edit.at.y}) 를 뺐다(${picked.length}칸)`);
      continue;
    }
    if (!edit.to) { refused.push(`(${edit.at.x},${edit.at.y}) — to·remove 중 하나가 필요하다`); continue; }
    const dx = edit.to.x - edit.at.x, dy = edit.to.y - edit.at.y;
    const tileset = project.tilesets[map.tilesetId];
    const blocks = (t: number) => { const p = t >= 0 ? tileset?.passability?.[t] : undefined; return !!p && !(p.up || p.down || p.left || p.right); };
    const bottom = Math.max(...picked.map((c) => c.y));
    const anyBlocks = picked.some((c) => blocks(c.upper) || blocks(c.overlay));
    let why = "";
    for (const c of picked) {
      const x = c.x + dx, y = c.y + dy;
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) { why = `(${x},${y}) 가 맵 밖이다`; break; }
      const j = y * W + x;
      if ((layers.upper[j] ?? -1) >= 0 || (layers.overlay[j] ?? -1) >= 0) { why = `(${x},${y}) 에 다른 물체가 있다`; break; }
      const foot = anyBlocks ? blocks(c.upper) || blocks(c.overlay) : c.y === bottom;
      if (foot && !isPassable(project, map, x, y)) { why = `발 칸 (${x},${y}) 가 걷는 바닥이 아니다`; break; }
      if (foot && (map.events ?? []).some((e) => e.x === x && e.y === y)) { why = `발 칸 (${x},${y}) 에 이벤트가 있다`; break; }
    }
    if (why) { refused.push(`「${cluster.label}」 → (${edit.to.x},${edit.to.y}): ${why}`); continue; }
    for (const c of picked) { const j = (c.y + dy) * W + c.x + dx; layers.upper[j] = c.upper; layers.overlay[j] = c.overlay; }
    const next = withLayers(project, map, layers);
    const now = access(next, mapId);
    if (!Number.isFinite(base.stranded) || now.stranded > base.stranded || now.cutOff > base.cutOff) { refused.push(`「${cluster.label}」 → (${edit.to.x},${edit.to.y}): 옮기면 길이나 이벤트가 막혀 되돌렸다`); continue; }
    project = next; base = now;
    done.push(`「${cluster.label}」 (${edit.at.x},${edit.at.y}) → (${edit.to.x},${edit.to.y})`);
  }
  return { ok: done.length > 0, project, done, refused };
}
