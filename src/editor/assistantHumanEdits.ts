import { store } from "@/project/store";
import type { GameMap, Project } from "@/project/types";
import { cloneExtraLayers, compactMapLayers, layerTileAt, setLayerTileAt, shadowAt, setShadowAt, TILE_LAYER_NOS } from "@/project/mapLayers";

type CellMetadata = Map<number, string>;
/** Build each sparse membership list once per comparison, preserving member order.
 * This is deliberately request-local, not a WeakMap that could hide in-place edits.
 */
function cellMetadata(map: GameMap): CellMetadata {
  const rows = new Map<number, { walls: unknown[]; groups: unknown[]; features: unknown[]; locked: boolean }>();
  const at = (index: number) => {
    let row = rows.get(index);
    if (!row) { row = { walls: [], groups: [], features: [], locked: false }; rows.set(index, row); }
    return row;
  };
  for (const d of map.relief?.wallDecor ?? []) {
    // Flatten only real grid coordinates: an out-of-range x must not alias the
    // neighboring row, which the original coordinate comparison never matched.
    if (Number.isInteger(d.x) && Number.isInteger(d.y) && d.x >= 0 && d.y >= 0 && d.x < map.width && d.y < map.height)
      at(d.y * map.width + d.x).walls.push(d);
  }
  for (const i of map.terrainDesign?.lockedCells ?? []) at(i).locked = true;
  for (const g of map.doodadGroups ?? []) for (const c of g.cells) at(c.index).groups.push([g.id, g.label, g.kitId, c]);
  for (const f of map.terrainDesign?.features ?? []) for (const p of f.patches) at(p.index).features.push([f.id, p]);
  return new Map([...rows].map(([i, row]) => [i, JSON.stringify(row)]));
}
function sameStack(a: number[] | undefined, b: number[] | undefined): boolean {
  return a === b || (!!a && !!b && a.length === b.length && a.every((v, i) => v === b[i]));
}
function cellComparison(a: GameMap, b: GameMap): (i: number) => boolean {
  const metadataChanged = a.relief?.wallDecor !== b.relief?.wallDecor || a.terrainDesign?.lockedCells !== b.terrainDesign?.lockedCells
    || a.doodadGroups !== b.doodadGroups || a.terrainDesign?.features !== b.terrainDesign?.features;
  const left = metadataChanged ? cellMetadata(a) : undefined;
  const right = metadataChanged ? cellMetadata(b) : undefined;
  return i => TILE_LAYER_NOS.some(layer => layerTileAt(a, layer, i) !== layerTileAt(b, layer, i))
    || shadowAt(a, i) !== shadowAt(b, i)
    || !sameStack(a.lowerTileStacks?.[i], b.lowerTileStacks?.[i]) || !sameStack(a.upperTileStacks?.[i], b.upperTileStacks?.[i])
    || (a.relief?.levels[i] ?? 0) !== (b.relief?.levels[i] ?? 0) || (a.relief?.ramps?.[i] ?? 0) !== (b.relief?.ramps?.[i] ?? 0)
    || (a.terrainDesign?.waterDepth?.[i] ?? 0) !== (b.terrainDesign?.waterDepth?.[i] ?? 0)
    || left?.get(i) !== right?.get(i);
}

/** Descriptor-free restoration/relief fallback. Scan only changed dense fields;
 * compare sparse metadata once by cell, never stringify or filter per grid cell.
 */
export function changedAssistantMapCells(a: GameMap, b: GameMap): Set<number> {
  const changed = new Set<number>(), count = b.width * b.height;
  const arrays: [readonly number[] | undefined, readonly number[] | undefined, number][] = [
    [a.lowerTiles, b.lowerTiles, -1], [a.upperTiles, b.upperTiles, -1],
    [a.lowerOverlayTiles, b.lowerOverlayTiles, -1], [a.upperOverlayTiles, b.upperOverlayTiles, -1], [a.shadowBits, b.shadowBits, 0],
    [a.relief?.levels, b.relief?.levels, 0], [a.relief?.ramps, b.relief?.ramps, 0], [a.terrainDesign?.waterDepth, b.terrainDesign?.waterDepth, 0],
  ];
  for (const [before, after, empty] of arrays) {
    if (before === after) continue;
    for (let i = 0; i < count; i++) if ((before?.[i] ?? empty) !== (after?.[i] ?? empty)) changed.add(i);
  }
  for (const key of ["lowerTileStacks", "upperTileStacks"] as const) {
    if (a[key] === b[key]) continue;
    for (const index of new Set([...Object.keys(a[key] ?? {}), ...Object.keys(b[key] ?? {})])) {
      const i = Number(index);
      if (Number.isInteger(i) && i >= 0 && i < count && !sameStack(a[key]?.[i], b[key]?.[i])) changed.add(i);
    }
  }
  if (a.relief?.wallDecor !== b.relief?.wallDecor || a.terrainDesign?.lockedCells !== b.terrainDesign?.lockedCells
    || a.doodadGroups !== b.doodadGroups || a.terrainDesign?.features !== b.terrainDesign?.features) {
    const before = cellMetadata(a), after = cellMetadata(b);
    for (const i of new Set([...before.keys(), ...after.keys()])) if (Number.isInteger(i) && i >= 0 && i < count && before.get(i) !== after.get(i)) changed.add(i);
  }
  return changed;
}

export type AssistantHumanEdits = ReturnType<typeof createAssistantHumanEdits>;

/** Request-local intent, retained after checkpoint ACKs adopt human edits as their baseline. */
export function createAssistantHumanEdits() {
  let previous = store.getCurrent();
  const lineage = store.getVersionToken().lineage;
  const identity = JSON.stringify(store.getProjectIdentity());
  const cells = new Map<string, Set<number>>();
  const structures = new Set<string>();
  let valid = true;
  const unsubscribe = store.subscribe((project, change) => {
    const before = previous;
    previous = project;
    if (change.projectSwitch || store.getVersionToken().lineage !== lineage
      || JSON.stringify(store.getProjectIdentity()) !== identity) {
      valid = false; cells.clear(); structures.clear(); return;
    }
    if (!valid || change.origin === "ai" || change.origin === "system" || change.scope === "system") return;
    const ids = change.scope === "map" ? [change.mapId] : new Set([...Object.keys(before.maps), ...Object.keys(project.maps)]);
    for (const id of ids) {
      const old = before.maps[id], next = project.maps[id];
      if (!old || !next || old.width !== next.width || old.height !== next.height || old.tilesetId !== next.tilesetId) {
        if (old !== next) { structures.add(id); cells.delete(id); }
        continue;
      }
      const protectedCells = cells.get(id) ?? new Set<number>();
      // Explicit brush intent also protects a same-value stroke.
      if (change.scope === "map" && change.cells) for (const c of change.cells) {
        if (Number.isInteger(c.x) && Number.isInteger(c.y) && c.x >= 0 && c.y >= 0 && c.x < next.width && c.y < next.height)
          protectedCells.add(c.y * next.width + c.x);
      }
      else if (old !== next) for (const i of changedAssistantMapCells(old, next)) protectedCells.add(i);
      if (protectedCells.size) cells.set(id, protectedCells);
    }
  });
  return {
    dispose: unsubscribe,
    protect(proposed: Project, live: Project): { project: Project; preservedCells: number; issue?: string } {
      if (!valid) return { project: proposed, preservedCells: 0, issue: "작업 중 프로젝트가 바뀌었습니다." };
      for (const id of new Set([...structures, ...cells.keys()])) {
        const a = proposed.maps[id], b = live.maps[id];
        if (!!a !== !!b || (a && b && (a.width !== b.width || a.height !== b.height || a.tilesetId !== b.tilesetId)))
          return { project: proposed, preservedCells: 0, issue: "직접 편집한 맵의 삭제·크기·타일셋 변경을 적용하지 않았어요. 새 작업으로 요청해주세요." };
      }
      let result = proposed, preservedCells = 0;
      for (const [id, indices] of cells) {
        const next = proposed.maps[id], current = live.maps[id];
        if (!next || !current) continue;
        const differs = cellComparison(next, current);
        const changed = [...indices].filter(differs);
        if (!changed.length) continue;
        const map: GameMap = { ...next, lowerTiles: next.lowerTiles.slice(), upperTiles: next.upperTiles.slice(), ...cloneExtraLayers(next),
          lowerTileStacks: { ...next.lowerTileStacks }, upperTileStacks: { ...next.upperTileStacks } };
        for (const i of changed) {
          for (const layer of TILE_LAYER_NOS) setLayerTileAt(map, layer, i, layerTileAt(current, layer, i));
          setShadowAt(map, i, shadowAt(current, i));
          for (const key of ["lowerTileStacks", "upperTileStacks"] as const) {
            const stack = current[key]?.[i];
            if (stack) map[key]![i] = stack.slice(); else delete map[key]![i];
          }
          if (map.relief || current.relief) {
            map.relief ??= { width: map.width, height: map.height, levels: Array(map.width * map.height).fill(0), ...(current.relief?.style ? { style: current.relief.style } : {}) };
            map.relief.levels[i] = current.relief?.levels[i] ?? 0;
            if (map.relief.ramps || current.relief?.ramps) {
              map.relief.ramps ??= Array(map.width * map.height).fill(0);
              map.relief.ramps[i] = current.relief?.ramps?.[i] ?? 0;
            }
            const x = i % map.width, y = Math.floor(i / map.width);
            map.relief.wallDecor = [...(map.relief.wallDecor ?? []).filter(d => d.x !== x || d.y !== y),
              ...(current.relief?.wallDecor ?? []).filter(d => d.x === x && d.y === y).map(d => ({ ...d }))];
          }
          if (map.terrainDesign || current.terrainDesign) {
            map.terrainDesign ??= {};
            if (map.terrainDesign.waterDepth || current.terrainDesign?.waterDepth) {
              map.terrainDesign.waterDepth ??= Array(map.width * map.height).fill(0);
              map.terrainDesign.waterDepth[i] = current.terrainDesign?.waterDepth?.[i] ?? 0;
            }
            map.terrainDesign.lockedCells = [...(map.terrainDesign.lockedCells ?? []).filter(c => c !== i),
              ...(current.terrainDesign?.lockedCells?.includes(i) ? [i] : [])];
          }
        }
        // Group/feature membership follows the retained cells, too; otherwise erasing a
        // protected tile through a later group operation would revive a stale before-value.
        const locked = new Set(changed);
        const groups = (map.doodadGroups ?? []).map(g => ({ ...g, cells: g.cells.filter(c => !locked.has(c.index)) }));
        for (const g of current.doodadGroups ?? []) {
          const retained = g.cells.filter(c => locked.has(c.index)).map(c => ({ ...c }));
          if (!retained.length) continue;
          const match = groups.find(item => item.id === g.id);
          if (match) match.cells.push(...retained); else groups.push({ ...g, cells: retained });
        }
        map.doodadGroups = groups.filter(g => g.cells.length);
        if (!map.doodadGroups.length) delete map.doodadGroups;
        if (map.terrainDesign) {
          const features = (map.terrainDesign.features ?? []).map(f => ({ ...f, patches: f.patches.filter(p => !locked.has(p.index)) }));
          for (const f of current.terrainDesign?.features ?? []) {
            const retained = structuredClone(f.patches.filter(p => locked.has(p.index)));
            if (!retained.length) continue;
            const match = features.find(item => item.id === f.id);
            if (match) match.patches.push(...retained); else features.push({ ...structuredClone(f), patches: retained });
          }
          map.terrainDesign.features = features.filter(f => f.patches.length);
        }
        compactMapLayers(map);
        for (const key of ["lowerTileStacks", "upperTileStacks"] as const) if (!Object.keys(map[key]!).length) delete map[key];
        if (result === proposed) result = { ...proposed, maps: { ...proposed.maps } };
        result.maps[id] = map;
        preservedCells += changed.length;
      }
      return { project: result, preservedCells };
    },
  };
}
