import { describe, expect, it } from "vitest";
import { createNewProjectSeed } from "@/editor/genrePacks";
import { newProjectChoiceById } from "@/editor/newProjectChoices";
import { runTool } from "@/editor/tools/toolRunner";
import { eligibleEncounterEntries } from "@/player/encounters";
import { canMove } from "@/project/collision";
import { startSession } from "@/project/session";
import { TILE } from "@/project/defaults/constants";

function monsterProject() {
  const choice = newProjectChoiceById("monster-collect")!;
  const project = createNewProjectSeed(choice.packId, "도로 시험");
  const troopId = project.database.troops[0]!.id;
  return { context: { project }, troopId };
}

describe("author_wild_route", () => {
  it("lays a road, forest and tall-grass patches whose encounters only fire inside the grass", () => {
    const { context, troopId } = monsterProject();
    const created = runTool(context, "create_map", { id: "map_route_1", name: "1번 도로", width: 28, height: 22 });
    expect(created.ok, created.summary).toBe(true);
    const result = runTool(context, "author_wild_route", {
      mapId: "map_route_1", exits: [{ x: 14, y: 21 }, { x: 14, y: 0 }], grassPatches: 3, encounters: [{ troopId, weight: 5 }],
    });
    expect(result.ok, result.summary).toBe(true);
    const map = context.project.maps.map_route_1!;
    const data = result.data as { grassPatches: { id: string; x: number; y: number; w: number; h: number }[]; trainerSpots: unknown[] };
    expect(data.grassPatches.length).toBeGreaterThanOrEqual(2);
    expect(result.warnings ?? []).not.toContainEqual(expect.stringContaining("이어지지 않습니다"));
    expect(map.lowerTiles.filter(tile => tile !== TILE.GRASS).length).toBeGreaterThan(40);
    expect(map.upperTiles.some(tile => tile !== TILE.EMPTY)).toBe(true);
    expect(map.encounterTable?.every(entry => entry.conditions?.locationId?.startsWith("loc_wild_grass_"))).toBe(true);
    const session = startSession(context.project);
    const patch = data.grassPatches[0]!;
    expect(eligibleEncounterEntries(map, session, { x: patch.x, y: patch.y })).not.toHaveLength(0);
    expect(eligibleEncounterEntries(map, session, { x: 14, y: 21 })).toHaveLength(0);
  });

  it("refuses to repaint an authored map without replace", () => {
    const { context } = monsterProject();
    // 몬스터 프로젝트의 시작 맵은 monster_overworld(#2232)라 도로 시공 대상이 아니다 — 시공 가능한 새 맵에서 본다.
    expect(runTool(context, "create_map", { id: "map_route_1", name: "1번 도로", width: 28, height: 22 }).ok).toBe(true);
    const map = context.project.maps.map_route_1!;
    map.upperTiles[0] = 5;
    const result = runTool(context, "author_wild_route", { mapId: "map_route_1", exits: [{ x: 0, y: 1 }, { x: map.width - 1, y: 1 }] });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("replace:true");
  });

  // 2026-09-24 포켓몬풍 r3: 동굴 파이프라인이 먼저 만든 링크 문(1,1)이 author_wild_route(replace)의
  // 숲 우물에 갇혀 autoplay 가 1번 도로 → 동굴 문으로 못 넘어갔다(check.txt 막힘). 시공은 기존
  // transfer 문까지 흙길로 이어야 한다.
  it("keeps a pre-existing transfer door walk-connected when repainting", () => {
    const { context, troopId } = monsterProject();
    const created = runTool(context, "create_map", { id: "map_route_1", name: "1번 도로", width: 28, height: 22 });
    expect(created.ok, created.summary).toBe(true);
    const targetMap = context.project.startMapId;
    const door = runTool(context, "upsert_event", {
      mapId: "map_route_1",
      event: {
        id: "ev_map_route_1_link", x: 1, y: 1,
        pages: [{ trigger: { kind: "playerTouch" }, conditions: [], priority: "below", overlapForbidden: false, commands: [{ kind: "transfer", mapId: targetMap, x: 1, y: 1 }] }],
      },
    });
    expect(door.ok, door.summary).toBe(true);
    const result = runTool(context, "author_wild_route", {
      mapId: "map_route_1", exits: [{ x: 14, y: 21 }, { x: 14, y: 0 }], grassPatches: 3, encounters: [{ troopId, weight: 5 }],
    });
    expect(result.ok, result.summary).toBe(true);
    expect(result.warnings ?? []).not.toContainEqual(expect.stringContaining("이어지지 않습니다"));

    // 남쪽 출구 (14,21) 에서 문 (1,1) 까지 실제로 걸어 닿는지 BFS 로 확인한다.
    const map = context.project.maps.map_route_1!;
    const seen = new Set<number>([21 * map.width + 14]);
    const queue: Array<{ x: number; y: number }> = [{ x: 14, y: 21 }];
    for (let i = 0; i < queue.length; i++) {
      const p = queue[i]!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = p.x + dx, ny = p.y + dy, key = ny * map.width + nx;
        if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height || seen.has(key)) continue;
        if (!canMove(context.project, map, p.x, p.y, nx, ny)) continue;
        seen.add(key); queue.push({ x: nx, y: ny });
      }
    }
    expect(seen.has(1 * map.width + 1)).toBe(true);
  });
});

describe("monster-collect brief prompt", () => {
  // #2232: 새 수집 게임은 build_monster_game(mode:create)이 검토된 캠페인 전체(도로 풀숲·트레이너 포함)를 짓는다.
  it("names the campaign builder so its schema is exposed on the first turn", async () => {
    const { buildWelcomeGenrePresetPrompt, welcomeGenrePresetById } = await import("@/editor/welcomeGenrePresets");
    const preset = welcomeGenrePresetById("monster-collect")!;
    const prompt = buildWelcomeGenrePresetPrompt(preset, {
      version: 1, presetId: "monster-collect", summary: "첫 체육관까지",
      answers: { scope: { question: "범위", label: "첫 제작 범위", text: "첫 도전장", source: "user" } },
    } as never);
    expect(prompt).toContain("build_monster_game");
  });
});
