// 동굴 맵 놓기(2026-10-25 판정 J25): 마른 바닥 위 배·다리, 이끼 위 출입구, 풀밭에서 바로 동굴로 가는 출입구, 동굴 북벽 창(문틀).
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import type { GameEvent, GameMap, Project } from "@/project/types";
import { inlandBoats, dryBridges, placementProblems } from "@/ai/v2/place/placementRules";
import { placementContentProblems, placementNotices } from "@/ai/v2/judge/gameChecks";
import { composeDungeon } from "@/editor/dungeonKit/beodeul/compose";

const BOAT = 31001, BRIDGE = 31002, WATER = 31003, MOSS = 31004, SAND = 31005;

function fixture(): { project: Project; map: GameMap } {
  const project = createBlankProject();
  const map = project.maps[project.startMapId]!;
  const ts = project.tilesets[map.tilesetId]!;
  const meta = ts.tileMeta as unknown as Record<number, unknown>;
  const pass = ts.passability as unknown as Record<number, unknown>;
  const open = { up: true, down: true, left: true, right: true };
  meta[BOAT] = { label: "버들항 장소 · 작은 배" }; pass[BOAT] = open;
  meta[BRIDGE] = { label: "버들항 장소 · 돌다리 남북 방향 한 칸" }; pass[BRIDGE] = open;
  meta[WATER] = { label: "버들항 던전 · 물 A" }; pass[WATER] = { up: false, down: false, left: false, right: false };
  meta[MOSS] = { label: "버들항 장소 · 발광 이끼" }; pass[MOSS] = open;
  meta[SAND] = { label: "버들항 · 모래톱" }; pass[SAND] = open;
  map.events = [];
  return { project, map };
}
const at = (map: GameMap, x: number, y: number) => y * map.width + x;
function gate(id: string, x: number, y: number, mapId: string): GameEvent {
  return { id, x, y, trigger: { kind: "playerTouch" }, commands: [], pages: [{ id: `${id}_p`, name: "", conditions: [], graphic: { transparent: true }, trigger: { kind: "playerTouch" }, priority: "below", movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [{ kind: "transfer", mapId, x: 1, y: 1 }] }] } as unknown as GameEvent;
}

describe("J25 동굴 놓기", () => {
  it("물에 닿지 않는 다리를 짚고, 뭍 한가운데의 배는 알림으로만 센다 — 물 위·물가·모래 위의 배는 세지 않는다", () => {
    const { project, map } = fixture();
    map.upperTiles[at(map, 3, 3)] = BOAT;
    map.lowerTiles[at(map, 8, 8)] = BRIDGE;
    expect(inlandBoats(project, map)).toEqual([{ x: 3, y: 3 }]);
    expect(dryBridges(project, map)).toEqual([{ x: 8, y: 8 }]);
    // 배는 결함이 아니다(2026-11-16 r6: 시공기가 모래턱에 올린 배를 모델이 두 번 지웠다) — 게임 검사는 배를 말하지 않고, 조언자 알림 한 줄만 남는다
    const before = structuredClone(project);
    before.maps[map.id]!.upperTiles[at(map, 3, 3)] = -1;
    expect(placementContentProblems(before, project).filter((f) => /배 \d+척|boat/iu.test(f.ko))).toEqual([]);
    expect(placementNotices(before, project)).toEqual([expect.stringMatching(/뭍에 배 1척 \(3,3\).*결함이 아니다/u)]);
    // 물가(세 칸 안에 물)에 끌어올린 배
    map.lowerTiles[at(map, 5, 3)] = WATER;
    expect(inlandBoats(project, map)).toEqual([]);
    expect(placementNotices(before, project)).toEqual([]);
    map.lowerTiles[at(map, 5, 3)] = map.lowerTiles[at(map, 0, 0)]!;
    // 모래 위의 배
    const keep = map.lowerTiles[at(map, 3, 3)]!;
    map.lowerTiles[at(map, 3, 3)] = SAND;
    expect(inlandBoats(project, map)).toEqual([]);
    map.lowerTiles[at(map, 3, 3)] = keep;
    expect(inlandBoats(project, map)).toEqual([{ x: 3, y: 3 }]);
    // 물 위의 배 · 물을 건너는 다리
    map.lowerTiles[at(map, 3, 3)] = WATER;
    map.lowerTiles[at(map, 7, 8)] = WATER;
    expect(inlandBoats(project, map)).toEqual([]);
    expect(dryBridges(project, map)).toEqual([]);
  });

  it("이끼 위 출입구와 그림 없이 던전으로 가는 바깥 출입구를 짚는다", () => {
    const { project, map } = fixture();
    const cave = structuredClone(map);
    cave.id = "map_cave"; cave.name = "동굴"; (cave as unknown as { mapRole: string }).mapRole = "dungeon";
    project.maps[cave.id] = cave;
    map.upperTiles[at(map, 5, 5)] = MOSS;
    map.events = [gate("ev_moss", 5, 5, "map_blank_start_other"), gate("ev_cave", 10, 6, cave.id)];
    const kinds = placementProblems(project, map).map((r) => `${r.kind}:${r.eventId}`);
    expect(kinds).toContain("transfer-prop:ev_moss");
    expect(kinds).toContain("door-bare:ev_cave");
  });

  it("자연 굴(cave)은 문 입구를 받아도 북벽 창·성문을 그리지 않는다", () => {
    const project = createBlankProject();
    const ts = project.tilesets.beodeul_city!;
    for (let seed = 1; seed <= 6; seed++) {
      const c = composeDungeon(ts, { type: "cave", seed, entryStair: "door" } as never) as unknown as { upper: number[] };
      const windows = c.upper.filter((t) => t >= 0 && /창/u.test(ts.tileMeta?.[t]?.label ?? "")).length;
      expect(windows).toBe(0);
    }
  });
});
