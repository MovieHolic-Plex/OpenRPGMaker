// 조수 v2 놓기·방 쓰임 검사(2026-10-25 판정 J5·J6·J31·J40·J42·J64, 사용자 규칙 «차도 한가운데 사람 금지»).
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import type { GameEvent, GameMap, Project } from "@/project/types";
import { counterSide, laneCells, objectEventFit, placementProblems } from "@/ai/v2/placementRules";
import { offPurposeProps, purposeOf, purposeSwap } from "@/ai/v2/roomPurpose";
import { placementContentProblems } from "@/ai/v2/gameChecks";
import { roomSetsFor } from "@/ai/v2/builders/interior";

const COUNTER = 30001, LANE = 30002, WARDROBE = 30003, CHEST = 30004, ARMCHAIR = 30005;

function fixture(): { project: Project; map: GameMap } {
  const project = createBlankProject();
  const map = project.maps[project.startMapId]!;
  const ts = project.tilesets[map.tilesetId]!;
  const open = { up: true, down: true, left: true, right: true };
  const shut = { up: false, down: false, left: false, right: false };
  const meta = ts.tileMeta as unknown as Record<number, unknown>;
  const pass = ts.passability as unknown as Record<number, unknown>;
  meta[COUNTER] = { label: "카운터 2×1 (0,0)" }; pass[COUNTER] = shut;
  meta[LANE] = { label: "차도 · 아스팔트", tags: ["road"] }; pass[LANE] = open;
  meta[WARDROBE] = { label: "옷장 (0,0)" }; pass[WARDROBE] = shut;
  meta[CHEST] = { label: "상자 (0,0)" }; pass[CHEST] = shut;
  meta[ARMCHAIR] = { label: "안락의자 (0,0)" }; pass[ARMCHAIR] = shut;
  map.events = [];
  return { project, map };
}
const at = (map: GameMap, x: number, y: number) => y * map.width + x;
function person(id: string, name: string, x: number, y: number, movement = "fixed"): GameEvent {
  return { id, name, x, y, trigger: { kind: "action" }, commands: [], pages: [{ id: `${id}_p`, name: "", conditions: [], graphic: { appearanceId: "villager" }, trigger: { kind: "action" }, priority: "same", movement: { type: movement, speed: 3, frequency: 3 }, commands: [] }] } as unknown as GameEvent;
}
function inspect(id: string, name: string, x: number, y: number): GameEvent {
  return { id, name, x, y, trigger: { kind: "action" }, commands: [], pages: [{ id: `${id}_p`, name: "", conditions: [], graphic: { transparent: true }, trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [{ kind: "text", body: "…" }] }] } as unknown as GameEvent;
}

describe("v2 방 쓰임", () => {
  it("쓰임 낱말이 방 종류보다 먼저고, 예배당·장난감 가게는 거실 한 벌을 받지 않는다", () => {
    expect(purposeOf("검은 장미 저택 지하 예배당")?.id).toBe("chapel");
    expect(purposeOf("태엽 장난감 가게")?.id).toBe("toyshop");
    expect(purposeOf("2학년 3반 교실")?.id).toBe("classroom");
    const ids = (sets: readonly (readonly { id?: unknown }[])[]) => sets.flat().map((o) => String(o.id));
    expect(ids(roomSetsFor("chapel")).some((id) => /armchair|rug|potted/u.test(id))).toBe(false);
    expect(ids(roomSetsFor("entrance", "태엽 장난감 가게"))).toContain("rocking horse");
    // 쓰임은 아는데 한 벌이 없는 방(학교 복도)은 메우지 않는다 — 거실 한 벌로 떨어지지 않는다.
    expect(roomSetsFor("school-corridor")).toEqual([]);
    // 빌린 재봉 가게 견본의 마네킹은 장난감 가게에서 흔들 목마가 된다(J31). 보건실은 학교가 아니라 병원 쓰임이다(J64).
    expect(purposeSwap(purposeOf("장난감 가게")!, "mannequin", 0, () => true)).toBe("rocking horse");
    expect(purposeOf("보건실")?.id).toBe("hospital");
  });

  it("예배당 방 안의 안락의자를 쓰임에 안 맞는 소품으로 짚는다", () => {
    const { project, map } = fixture();
    (map as unknown as { locations: unknown[] }).locations = [{ id: "r1", name: "chapel", x: 1, y: 1, w: 6, h: 6, tags: ["hand-layout-room"] }];
    map.upperTiles[at(map, 3, 3)] = ARMCHAIR;
    const off = offPurposeProps(project, map);
    expect(off).toHaveLength(1);
    expect(off[0]!.purpose).toBe("예배당");
    expect(off[0]!.props[0]!.label).toBe("안락의자");
  });
});

describe("v2 사람·조사 이벤트 자리", () => {
  it("차도 한가운데 선 사람을 짚는다", () => {
    const { project, map } = fixture();
    for (let x = 0; x < map.width; x++) map.lowerTiles[at(map, x, 8)] = LANE;
    expect(laneCells(project, map).has(at(map, 4, 8))).toBe(true);
    map.events = [person("ev_a", "행인", 4, 8), person("ev_b", "행인", 4, 6)];
    const rows = placementProblems(project, map);
    expect(rows.filter((r) => r.kind === "npc-lane").map((r) => r.eventId)).toEqual(["ev_a"]);
  });

  it("주인이 카운터 앞(남쪽)에 서면 짚고, 뒤(북쪽)면 통과한다", () => {
    const { project, map } = fixture();
    map.upperTiles[at(map, 5, 5)] = COUNTER;
    expect(counterSide(project, map, { x: 5, y: 4 })).toBe("behind");
    expect(counterSide(project, map, { x: 5, y: 6 })).toBe("front");
    map.events = [person("ev_k", "무기점 주인", 5, 6)];
    expect(placementProblems(project, map).map((r) => r.kind)).toContain("npc-counter");
    map.events = [person("ev_k", "무기점 주인", 5, 4)];
    expect(placementProblems(project, map).map((r) => r.kind)).not.toContain("npc-counter");
  });

  it("옷장 이벤트가 옷장 앞 상자 위에 있으면 짚고, 옷장 맨 아래 칸을 알려 준다", () => {
    const { project, map } = fixture();
    map.upperTiles[at(map, 6, 2)] = WARDROBE;
    map.upperTiles[at(map, 6, 3)] = WARDROBE;
    map.upperTiles[at(map, 6, 4)] = CHEST;
    const fit = objectEventFit(project, map, { name: "2층 옷장(숨을 곳)", x: 6, y: 4 });
    expect(fit?.ok).toBe(false);
    expect(fit?.nearest).toEqual({ x: 6, y: 3 });
    expect(objectEventFit(project, map, { name: "옷장", x: 6, y: 3 })?.ok).toBe(true);
  });

  it("출구 바로 앞에 선 사람을 짚고, 끝맺음 검사는 바뀐 이벤트만 본다", () => {
    const { project, map } = fixture();
    const gate = { ...inspect("ev_gate", "", map.width - 1, 7), pages: [{ ...inspect("x", "", 0, 0).pages![0]!, commands: [{ kind: "transfer", mapId: map.id, x: 1, y: 1 }] }] } as unknown as GameEvent;
    map.events = [gate];
    const before = structuredClone(project);
    project.maps[map.id]!.events.push(person("ev_farmer", "농부", map.width - 2, 7, "random"));
    const problems = placementContentProblems(before, project);
    expect(problems.some((p) => p.startsWith("[게임 검사 길막]") && p.includes("농부"))).toBe(true);
    expect(placementContentProblems(project, project)).toEqual([]);
  });
});
