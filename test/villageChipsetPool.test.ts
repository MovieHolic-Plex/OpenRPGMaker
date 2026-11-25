import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import type { GameEvent, GameMap, Project } from "@/project/types";
import { counterSide, laneCells, objectEventFit, placementProblems } from "@/ai/v2/place/placementRules";
import { offPurposeProps, purposeOf, purposeSwap } from "@/ai/v2/place/roomPurpose";
import { placementContentProblems } from "@/ai/v2/judge/gameChecks";
import { roomSetsFor } from "@/ai/v2/place/builders/interiorFill";
import { findingLine } from "@/ai/v2/judge/finding";
import { ensureBundledTilesets } from "@/project/defaults/defaultAssets";
import { adventureCompletionProblems } from "@/ai/adventureCompletion";
import { VILLAGE_POOL, isBareVillageRequest, localizeVillagePoolSpec, pickVillageChipset } from "@/ai/villageChipsetPool";
import { VILLAGE_POOL_BUILDER } from "@/ai/v2/place/builders/villagePool";
import { builderFor } from "@/ai/v2/place/builders";
import { INTENT_NOTE_BOUNDARY } from "@/ai/piAgent/monsterGameRequest";
import { isolateTimers } from "./mergedTeardown";

// 조수 v2 놓기·방 쓰임 검사(2026-10-25 판정 J5·J6·J31·J40·J42·J64, 사용자 규칙 «차도 한가운데 사람 금지»).
describe("v2PlacementRoomPurpose", () => {
  isolateTimers();
  // 판정은 Finding 을 낸다 — 이 시험은 보고에 실리는 줄 글을 본다.
  const placementLines = (...args: Parameters<typeof placementContentProblems>): string[] => placementContentProblems(...args).map(findingLine);
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
      const problems = placementLines(before, project);
      expect(problems.some((p) => p.startsWith("[게임 검사 길막]") && p.includes("농부"))).toBe(true);
      expect(placementLines(project, project)).toEqual([]);
    });
  });
});

describe("villageChipsetPool", () => {
  isolateTimers();
  function project() {
    const p = createBlankProject();
    ensureBundledTilesets(p);
    return p;
  }
  describe("테마 없는 마을의 칩셋 풀", () => {
    it("테마·칩셋 낱말이 있으면 풀 밖이고, 마을만 말하면 풀 안이다", () => {
      for (const text of ["조선 마을 만들어 줘", "사막 오아시스 마을", "버들항 마을 만들어 줘", "눈 덮인 마을", "어촌 마을", "숲속 마을", "던전"]) expect(isBareVillageRequest(text), text).toBe(false);
      for (const text of ["마을 하나 만들어 줘", "마을을 만들어줘", "village"]) expect(isBareVillageRequest(text), text).toBe(true);
    });

    it("같은 프로젝트 열쇠는 늘 같은 칩셋을, 열쇠가 다르면 여러 칩셋을 고른다", () => {
      const p = project();
      const picks = Array.from({ length: 200 }, (_, i) => pickVillageChipset(p, `game-${i}`, "마을 하나 만들어 줘"));
      expect(pickVillageChipset(p, "game-7", "마을 하나 만들어 줘")).toEqual(picks[7]);
      const chipsets = new Set(picks.map((pick) => pick?.entry.tilesetId ?? "beodeul_city"));
      expect(chipsets.size).toBe(VILLAGE_POOL.length);
    });

    it("열쇠가 없거나 마을 종류 표가 잡는 요청이면 풀을 끼지 않는다", () => {
      const p = project();
      expect(pickVillageChipset(p, undefined, "마을 하나 만들어 줘")).toBeNull();
      expect(pickVillageChipset(p, "  ", "마을 하나 만들어 줘")).toBeNull();
      for (const text of ["수도원 마을 만들어 줘", "장터 마을 만들어 줘", "엘프 마을 만들어 줘"]) {
        for (let i = 0; i < 30; i += 1) expect(pickVillageChipset(p, `k${i}`, text), text).toBeNull();
      }
    });

    it("풀 칩셋으로 이미 손댄 맵이 있으면 같은 칩셋을 이어 쓴다", () => {
      const p = project();
      const first = Array.from({ length: 80 }, (_, i) => `k${i}`).map((k) => ({ k, pick: pickVillageChipset(p, k, "마을 하나 만들어 줘") })).find((row) => row.pick)!;
      const map = p.maps[p.startMapId]!;
      map.tilesetId = first.pick!.entry.tilesetId;
      map.lowerTiles[0] = map.lowerTiles[0]! + 1;
      expect(pickVillageChipset(p, first.k, "마을 하나 만들어 줘")?.entry.tilesetId).toBe(first.pick!.entry.tilesetId);
    });

    it("이미 손댄 야외 맵이 있으면 칩셋을 바꾸지 않는다", () => {
      const p = project();
      const key = Array.from({ length: 50 }, (_, i) => `k${i}`).find((k) => pickVillageChipset(p, k, "마을 하나 만들어 줘"))!;
      expect(pickVillageChipset(p, key, "마을 하나 만들어 줘")).not.toBeNull();
      const start = p.maps[p.startMapId]!;
      start.lowerTiles[0] = start.lowerTiles[0]! + 1;
      expect(pickVillageChipset(p, key, "마을 하나 만들어 줘")).toBeNull();
    });

    it("v2: 요청 문장이 테마 없는 마을이면 모델이 채운 style·theme 를 무시하고 풀 빌더로 간다", () => {
      const p = project();
      const key = Array.from({ length: 50 }, (_, i) => `k${i}`).find((k) => pickVillageChipset(p, k, "마을 하나 만들어 줘"))!;
      const spec = localizeVillagePoolSpec({ type: "village", name: "시작 마을" }, p, key, "마을 하나 만들어 줘");
      expect(builderFor(spec as never)?.id).toBe(VILLAGE_POOL_BUILDER.id);
      // 실측(2026-11-10): 모델 3판이 모두 style:fantasy·theme:river 를 채워 불렀고 풀이 0번 발동했다.
      const filled = localizeVillagePoolSpec({ type: "village", name: "마을", style: "fantasy", theme: "river", hints: { layout: { houses: [] } } }, p, key, "마을 하나 만들어 줘");
      expect(filled.style).toBe(spec.style);
      expect(builderFor(filled as never)?.id).toBe(VILLAGE_POOL_BUILDER.id);
      // 의도 메모(시스템 지침)는 사용자 글이 아니다 — 메모 속 낱말이 판정을 바꾸지 않는다.
      expect(localizeVillagePoolSpec({ type: "village", name: "마을" }, p, key, `마을 하나 만들어 줘${INTENT_NOTE_BOUNDARY}어촌 숲 북방 author_beodeul_town`).style).toBe(spec.style);
      // 요청 문장에 테마 낱말이 있으면 모델 인자와 상관없이 풀이 끼지 않는다.
      for (const text of ["눈 덮인 마을 만들어 줘", "조선 마을 만들어 줘", "버들항 마을 만들어 줘", "어촌 마을 만들어 줘"]) {
        expect(localizeVillagePoolSpec({ type: "village", name: "마을", style: "fantasy", theme: "river" }, p, key, text).style, text).toBe("fantasy");
      }
      expect(localizeVillagePoolSpec({ type: "dungeon", name: "굴" }, p, key, "마을 하나 만들어 줘").style).toBeUndefined();
    });
  });
  describe("마을 완료 검사", () => {
    it("배치된 집(입구 있는 키트)이 있으면 role 타일이 없어도 마을 구조로 센다", () => {
      const p = project();
      const start = p.maps[p.startMapId]!;
      const ts = p.tilesets[start.tilesetId]!;
      const kit = ts.structureKits!.find((k) => k.kind === "section" && k.parts?.some((part) => part.kind === "entrance"))!;
      const required = { village: true, dungeon: false, party: false, battle: false };
      expect(adventureCompletionProblems(p, required).some((m) => m.includes("건물/벽/지붕 구조"))).toBe(true);
      start.structurePlacements = [{ id: "pl1", kitId: kit.id, x: 1, y: 1, w: kit.width, h: kit.height, before: { lower: [], upper: [] }, afterHash: "" }];
      expect(adventureCompletionProblems(p, required).some((m) => m.includes("건물/벽/지붕 구조"))).toBe(false);
    });
  });
});
