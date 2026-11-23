// 몬스터 원정 길·필드·던전 맵 생성기: 견본을 칸 그대로 옮기지 않고(겹침 관문), 씨앗마다 다른 판을 짜며, 입구에서 모든 사람·문에 걸어 닿는다.
// 예전 make() 는 견본을 복사해 기본 캠페인 필드·던전 17맵 중 16맵이 견본과 93~100% 같았다(2026-11-22 분석).
// 작성만 했고 실행하지 않았다(워크트리 규칙) — CI 에서 돈다.
import { describe, expect, it } from "vitest";
import { createMonsterExpedition } from "@/project/examples/monsterExpedition";
import templateData from "@/project/examples/monsterExpedition/mapTemplates.json" with { type: "json" };
import { maxTemplateOverlap, templateOverlap, TEMPLATE_COPY_GATE, type OverlapGrid } from "@/project/mapTemplateOverlap";
import { canMove } from "@/project/collision";
import type { GameMap, Project } from "@/project/types";

type Built = { project: Project; manifest: { maps: { id: string; role: string; entry: { x: number; y: number } }[] } };
const templates = templateData as unknown as Record<string, OverlapGrid>;
const grid = (m: GameMap): OverlapGrid => ({ width: m.width, height: m.height, lower: m.lowerTiles, tilesetId: m.tilesetId });
const fieldMaps = ({ manifest }: Built) => manifest.maps.filter((m) => m.role === "field" || m.role === "dungeon");

/** 입구에서 사람(막힌 이벤트) 칸을 피해 걸어 닿지 못하는 이벤트(자동 실행 제외). */
function unreachable(project: Project, map: GameMap, entry: { x: number; y: number }): string[] {
  const key = (x: number, y: number) => `${x},${y}`;
  const solid = new Set(map.events.filter((e) => e.pages?.[0]?.overlapForbidden).map((e) => key(e.x, e.y)));
  const seen = new Set([key(entry.x, entry.y)]), queue = [entry];
  for (let n = 0; n < queue.length; n++) {
    const p = queue[n]!;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
      const q = { x: p.x + dx, y: p.y + dy };
      if (!seen.has(key(q.x, q.y)) && !solid.has(key(q.x, q.y)) && canMove(project, map, p.x, p.y, q.x, q.y)) { seen.add(key(q.x, q.y)); queue.push(q); }
    }
  }
  return map.events.filter((e) => e.pages?.[0]?.trigger?.kind !== "auto")
    .filter((e) => !seen.has(key(e.x, e.y)) && ![[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => seen.has(key(e.x + dx!, e.y + dy!))))
    .map((e) => e.id);
}

describe("monster expedition field generator", () => {
  it("does not copy a reference template into any route, side area or dungeon", () => {
    const built = createMonsterExpedition() as unknown as Built;
    const maps = fieldMaps(built);
    expect(maps.length).toBe(17);
    const copies = maps.map((m) => ({ id: m.id, hit: maxTemplateOverlap(grid(built.project.maps[m.id]!), templates)! }))
      .filter(({ hit }) => hit.overlap >= TEMPLATE_COPY_GATE).map(({ id, hit }) => `${id}≈${hit.key} ${Math.round(hit.overlap * 100)}%`);
    expect(copies).toEqual([]);
  }, 180_000);

  it("lets the player walk from each entrance to every trainer, sign and exit", () => {
    for (const mapSeed of [0, 1]) {
      const built = createMonsterExpedition({ mapSeed }) as unknown as Built;
      const blocked = fieldMaps(built).flatMap((m) => unreachable(built.project, built.project.maps[m.id]!, m.entry));
      expect(blocked, `mapSeed ${mapSeed}`).toEqual([]);
    }
  }, 180_000);

  it("builds a different layout for a different seed", () => {
    const a = createMonsterExpedition({ mapSeed: 0 }) as unknown as Built;
    const b = createMonsterExpedition({ mapSeed: 1 }) as unknown as Built;
    for (const m of fieldMaps(a)) {
      const overlap = templateOverlap(grid(a.project.maps[m.id]!), grid(b.project.maps[m.id]!)).overlap;
      expect(overlap, m.id).toBeLessThan(0.5);
    }
  }, 180_000);
});
