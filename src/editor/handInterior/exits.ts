import { passabilityOf } from '@/project/collision';
import { layerTileAt } from '@/project/mapLayers';
import type { GameMap, Project } from '@/project/types';
import { analyseHandInteriorPlan } from './builder';

export interface InteriorExitSpan { readonly x: number; readonly y: number; readonly width: number }

function southSpans(width: number, height: number, open: (x: number) => boolean): InteriorExitSpan[] {
  const spans: InteriorExitSpan[] = [];
  for (let x = 0; x < width;) {
    if (!open(x)) { x++; continue; }
    const start = x++;
    while (x < width && open(x)) x++;
    spans.push({ x: start, y: height - 1, width: x - start });
  }
  return spans;
}

/** start는 BFS의 출발 칸일 뿐이다. 실제 출구 폭은 평면의 남쪽 바닥 틈에서 읽는다. */
export function handInteriorPlanExits(plan: readonly string[]): InteriorExitSpan[] {
  const a = analyseHandInteriorPlan(plan);
  return southSpans(a.W, a.H, x => a.isFloor(x, a.H - 1));
}

/** 출구 틈은 설치된 1층 구조로 잰다. 옆 칸을 가구로 막아 두 칸 틈을 숨길 수 없다. */
export function handInteriorMapExits(project: Project, map: GameMap): InteriorExitSpan[] {
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset) return [];
  return southSpans(map.width, map.height, x => {
    const flags = passabilityOf(tileset, layerTileAt(map, 1, (map.height - 1) * map.width + x), -1, -1, -1);
    return flags.up || flags.down || flags.left || flags.right;
  });
}
