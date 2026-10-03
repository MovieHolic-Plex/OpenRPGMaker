import type { GameMap } from "@/project/types";
import { cloneExtraLayers } from "@/project/mapLayers";
import { emptyRelief } from "@/project/relief/edit";
import { terrainEditable, type TerrainDesignPlan } from "./terrainDesignPlans";
import { polygonCells, lineCells, type TerrainPoint } from "./terrainDesignGeometry";
export function planTerrainFinish(map: GameMap, points: TerrainPoint[], method: "smooth" | "erode" | "corners", passes: number): TerrainDesignPlan {
  if (points.length < 3) return { ok: false, reason: "다듬을 영역의 외곽을 세 점 이상 찍으세요", indices: [] };
  const next = { ...map, ...cloneExtraLayers(map) }; next.relief ??= emptyRelief(map.width, map.height);
  const region = new Set(polygonCells(points, map.width, map.height).map(p => p.y * map.width + p.x));
  const eligible = (i: number) => region.has(i) && terrainEditable(map, i) && !(map.terrainDesign?.waterDepth?.[i]);
  const changed = new Set<number>();
  for (let pass = 0; pass < passes; pass++) {
    const levels = next.relief.levels.slice(), deltas = new Map<number, number>();
    for (const i of region) {
      if (!eligible(i)) continue;
      const x = i % map.width, y = Math.floor(i / map.width), adjacent = [[0,-1],[0,1],[-1,0],[1,0]].map(([dx,dy]) => ({ x:x+dx!, y:y+dy! })).filter(p => p.x >= 0 && p.y >= 0 && p.x < map.width && p.y < map.height).map(p => p.y * map.width + p.x);
      if (!adjacent.length) continue;
      let level = levels[i]!;
      if (method === "erode") {
        const low = adjacent.filter(eligible).sort((a,b) => levels[a]! - levels[b]!)[0];
        if (low !== undefined && levels[i]! - levels[low]! > 2 && levels[low]! + (deltas.get(low) ?? 0) < 14 && levels[i]! + (deltas.get(i) ?? 0) > 0) { deltas.set(i, (deltas.get(i) ?? 0) - 1); deltas.set(low, (deltas.get(low) ?? 0) + 1); }
        continue;
      }
      if (method === "smooth") level = Math.round((levels[i]! * 2 + adjacent.reduce((s,j) => s + levels[j]!,0)) / (adjacent.length + 2));
      else { const sorted = adjacent.map(j => levels[j]!).sort((a,b) => a-b); if (adjacent.filter(j => levels[j]! < level).length >= 3 || adjacent.filter(j => levels[j]! > level).length >= 3) level = sorted[Math.floor(sorted.length / 2)]!; }
      if (level !== levels[i]) { next.relief.levels[i] = level; changed.add(i); }
    }
    for (const [i,delta] of deltas) { const level = Math.max(0, Math.min(14, levels[i]! + delta)); if (level !== levels[i]) { next.relief.levels[i] = level; changed.add(i); } }
  }
  const border = lineCells([...points, points[0]!]);
  return { ok: changed.size > 0, reason: changed.size ? `${{smooth:"평활화",erode:"침식",corners:"절벽 모서리 정리"}[method]} ${changed.size}칸 · ${passes}회` : "다듬을 높이 차가 없거나 보호된 영역입니다", indices: [...new Set([...changed,...border.map(p=>p.y*map.width+p.x)])], apply: draft => { draft.relief = next.relief; } };
}
