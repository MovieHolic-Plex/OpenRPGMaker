// 몬스터 원정 길·필드·던전 맵 생성기: 견본을 칸 그대로 옮기지 않고(겹침 관문), 씨앗마다 다른 판을 짜며, 입구에서 모든 사람·문에 걸어 닿는다.
// 예전 make() 는 견본을 복사해 기본 캠페인 필드·던전 17맵 중 16맵이 견본과 93~100% 같았다(2026-11-22 분석).
// 작성만 했고 실행하지 않았다(워크트리 규칙) — CI 에서 돈다.
import { describe, expect, it } from "vitest";
import { createMonsterExpedition } from "@/project/examples/monsterExpedition";
import templateData from "@/project/examples/monsterExpedition/mapTemplates.json" with { type: "json" };
import { maxTemplateOverlap, templateOverlap, TEMPLATE_COPY_GATE, type OverlapGrid } from "@/project/mapTemplateOverlap";
import { canMove, layeredPassability } from "@/project/collision";
import { caveRimDefects, fieldGeneratorInternals, hallFrameDefects, type FieldTemplate } from "@/project/examples/monsterExpedition/fieldGenerator";
import type { GameMap, Project } from "@/project/types";

type Built = { project: Project; manifest: { maps: { id: string; role: string; template: string; entry: { x: number; y: number } }[] } };
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

  // 큰 방(밤막회사·유적·탑) 천장이 조각나고(이웃 점수로 테두리 조각을 골랐다) 동굴 테두리 아래 줄이 귀퉁이 그림으로 채워지던 판(2026-11-23).
  it("draws hall ceilings and cave rims by the template's frame rule", () => {
    const ruled = new Set<string>();
    for (const mapSeed of [0, 1]) {
      const built = createMonsterExpedition({ mapSeed }) as unknown as Built;
      const bad: string[] = [];
      for (const m of fieldMaps(built)) {
        const map = built.project.maps[m.id]!, tileset = built.project.tilesets[map.tilesetId]!;
        const L = fieldGeneratorInternals.learn(tileset, (templateData as unknown as Record<string, FieldTemplate>)[m.template]!);
        const walk = (x: number, y: number) => {
          if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
          const i = y * map.width + x, p = layeredPassability(tileset, [map.lowerTiles[i]!, -1, map.upperTiles[i] ?? -1, -1]);
          return p.up || p.down || p.left || p.right;
        };
        if (L.frame) { ruled.add(`${m.id}:frame`); bad.push(...hallFrameDefects(L.frame, map.width, map.height, map.lowerTiles).map((d) => `${m.id} ${d.x},${d.y} ${d.tile}->${d.want}`)); }
        if (L.rim) { ruled.add(`${m.id}:rim`); bad.push(...caveRimDefects(L.rim, map.width, map.height, map.lowerTiles, walk).map((d) => `${m.id} ${d.x},${d.y} ${d.tile}->${d.want}`)); }
      }
      expect(bad, `mapSeed ${mapSeed}`).toEqual([]);
    }
    // 검사가 빈손으로 통과하지 않게: 큰 방 넷·동굴 넷에서 규칙을 찾아야 한다.
    expect([...ruled].sort()).toEqual(["mx_map_cave:rim", "mx_map_ghost_tower:frame", "mx_map_hideout:frame", "mx_map_ice_cave:rim", "mx_map_lava_cave:rim", "mx_map_observatory:frame", "mx_map_ruins:frame", "mx_map_sea_cave:rim"]);
  }, 180_000);

  it("counts a hall ceiling cell whose edge line faces the wrong way", () => {
    const built = createMonsterExpedition() as unknown as Built;
    const m = fieldMaps(built).find((x) => x.id === "mx_map_hideout")!;
    const map = built.project.maps[m.id]!;
    const L = fieldGeneratorInternals.learn(built.project.tilesets[map.tilesetId]!, (templateData as unknown as Record<string, FieldTemplate>)[m.template]!);
    const f = L.frame!;
    const i = map.lowerTiles.findIndex((v) => v === f.l);
    expect(i).toBeGreaterThanOrEqual(0);
    const broken = [...map.lowerTiles];
    broken[i] = f.r;
    expect(hallFrameDefects(f, map.width, map.height, broken).map((d) => d.y * map.width + d.x)).toEqual([i]);
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
