import { describe, expect, it } from "vitest";
import { runTool, type ToolContext, getTool } from "@/editor/tools";
import { createBlankProject, DEFAULT_ITEM_ID, TILE } from "@/project/defaults";
import type { Project, GameEvent, GameMap, MapLayoutPlan } from "@/project/types";
import { withRetiredEasyRpgTilesets, startOnRetiredCombinedTown } from "./support/retiredEasyRpgTilesets";
import { createHorrorPhase3Fixture, HORROR_FLAG_SWITCH, HORROR_TRUE_ENDING } from "./fixtures/horrorPhase3Fixture";
import { createGalleryPhase4Fixture, GALLERY_ENDING_ID, GALLERY_EXIT_SWITCH, GALLERY_ORDER_SWITCH } from "./fixtures/galleryPhase4Fixture";
import assert from "node:assert/strict";
import { isolateTimers } from "./mergedTeardown";

// 켜는 곳이 뒤 페이지 조건도 함께 켜서 앞 페이지가 영영 안 나오는 경우 — 2026-09-24 갤러리 호러 쓸쓸한 엔딩 소실.
describe("eventPageSetterShadow", () => {
  isolateTimers();
  function exitEvent(): Record<string, unknown> {
    return { id: "ev_exit", x: 3, y: 3, pages: [
      { trigger: { kind: "action" }, conditions: [], commands: [{ kind: "text", body: "굳어 있다." }] },
      { trigger: { kind: "action" }, conditions: [{ kind: "switch", switchId: "sw_gave_rose", value: true }], commands: [{ kind: "text", body: "혼자 나간다." }] },
      { trigger: { kind: "action" }, conditions: [{ kind: "switch", switchId: "sw_met_doll", value: true }], commands: [{ kind: "text", body: "함께 나간다." }] },
    ] };
  }
  function doll(branchGive: unknown[]): Record<string, unknown> {
    return { id: "ev_doll", x: 5, y: 5, pages: [{ trigger: { kind: "action" }, conditions: [], commands: [{ kind: "choices", prompt: "장미를?", options: [
      { text: "준다", branch: branchGive },
      { text: "거절", branch: [{ kind: "setSwitch", switchId: "sw_met_doll", value: true }] },
    ] }] }] };
  }
  describe("setter-shadowed event pages", () => {
    it("warns when every setter of an earlier page also opens a later page", () => {
      const ctx: { project: Project } = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      expect(runTool(ctx, "upsert_event", { mapId, event: exitEvent() }).ok).toBe(true);
      const result = runTool(ctx, "upsert_event", { mapId, event: doll([
        { kind: "setSwitch", switchId: "sw_gave_rose", value: true }, { kind: "setSwitch", switchId: "sw_met_doll", value: true },
      ]) });
      expect(result.ok, result.summary).toBe(true);
      expect(JSON.stringify(result)).toContain("페이지 2(sw_gave_rose)는 영영 실행되지 않습니다");
    });

    it("stays quiet when the give branch leaves the later switch off", () => {
      const ctx: { project: Project } = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      runTool(ctx, "upsert_event", { mapId, event: exitEvent() });
      const result = runTool(ctx, "upsert_event", { mapId, event: doll([{ kind: "setSwitch", switchId: "sw_gave_rose", value: true }]) });
      expect(result.ok).toBe(true);
      expect(JSON.stringify(result)).not.toContain("영영 실행되지 않습니다");
    });
  });
});

// fill_region 으로 맵 전체를 한 바닥으로 채우면 「빈 판」 다음 단계를 경고로 알린다 — 2026-09-24 꿈 세계 도그푸딩.
describe("fillRegionBareBoardHint", () => {
  isolateTimers();
  const MAP_ID = "map_blank_start";
  function interiorContext(): ToolContext {
    const project = withRetiredEasyRpgTilesets(createBlankProject());
    const map = project.maps[MAP_ID]!;
    map.tilesetId = "easyrpg_chipset_interior";
    map.lowerTiles.fill(0);
    map.upperTiles.fill(0);
    return { project };
  }
  const warningsOf = (result: ReturnType<typeof runTool>) => (result.diff?.warnings ?? []).join("\n");
  describe("fill_region 빈 판 안내", () => {
    it("맵 전체를 한 바닥으로 채우면 place_props 로 사물을 깔라고 알린다", () => {
      const ctx = interiorContext();
      const map = ctx.project.maps[MAP_ID]!;
      const result = runTool(ctx, "fill_region", { mapId: MAP_ID, rect: { x: 0, y: 0, w: map.width, h: map.height }, material: "실내 나무 바닥" });
      expect(result.ok, result.summary).toBe(true);
      expect(warningsOf(result)).toContain("빈 판");
      expect(warningsOf(result)).toContain("place_props");
    });

    it("작은 영역만 채우면 알리지 않는다", () => {
      const ctx = interiorContext();
      const result = runTool(ctx, "fill_region", { mapId: MAP_ID, rect: { x: 2, y: 2, w: 4, h: 3 }, material: "실내 나무 바닥" });
      expect(result.ok, result.summary).toBe(true);
      expect(warningsOf(result)).not.toContain("빈 판");
    });
  });
});

// fill_region 이 오토타일이 아닌 실내 바닥(나무 바닥·돌바닥·카펫)도 채운다 — 2026-09-24 꿈 세계 도그푸딩.
// 실내 칩셋 방을 만들며 「실내 나무 바닥」「실내 돌바닥」「붉은 카펫」이 전부 「면 채우기 재료가 아닙니다」로 거부됐다.
describe("fillRegionFlatFloor", () => {
  isolateTimers();
  const MAP_ID = "map_blank_start";
  const INTERIOR = "easyrpg_chipset_interior";
  function interiorContext(): ToolContext {
    const project = withRetiredEasyRpgTilesets(createBlankProject());
    const map = project.maps[MAP_ID]!;
    map.tilesetId = INTERIOR;
    map.lowerTiles.fill(0);
    map.upperTiles.fill(0);
    return { project };
  }
  const at = (ctx: ToolContext, x: number, y: number) => {
    const map = ctx.project.maps[MAP_ID]!;
    return map.lowerTiles[y * map.width + x];
  };
  describe("fill_region 실내 바닥", () => {
    it("실내 나무 바닥으로 방 바닥을 채운다", () => {
      const ctx = interiorContext();
      const result = runTool(ctx, "fill_region", { mapId: MAP_ID, rect: { x: 2, y: 2, w: 6, h: 4 }, material: "실내 나무 바닥" });
      expect(result.ok, result.summary).toBe(true);
      for (let y = 2; y < 6; y++) for (let x = 2; x < 8; x++) expect(at(ctx, x, y)).toBe(72);
      expect(at(ctx, 1, 2)).toBe(0);
    });

    it("실내 돌바닥도 채운다", () => {
      const ctx = interiorContext();
      const result = runTool(ctx, "fill_region", { mapId: MAP_ID, rect: { x: 1, y: 1, w: 3, h: 3 }, material: "실내 돌바닥" });
      expect(result.ok, result.summary).toBe(true);
      expect(at(ctx, 2, 2)).toBe(12);
    });

    it("3×3 테두리 카펫은 가장자리에 테두리, 안쪽에 몸통을 깐다", () => {
      const ctx = interiorContext();
      const result = runTool(ctx, "fill_region", { mapId: MAP_ID, rect: { x: 3, y: 3, w: 4, h: 3 }, material: "붉은 카펫" });
      expect(result.ok, result.summary).toBe(true);
      expect(at(ctx, 3, 3)).toBe(375); // 왼위
      expect(at(ctx, 4, 3)).toBe(376); // 위
      expect(at(ctx, 6, 3)).toBe(377); // 오른위
      expect(at(ctx, 3, 4)).toBe(405); // 왼
      expect(at(ctx, 5, 4)).toBe(406); // 몸통
      expect(at(ctx, 6, 5)).toBe(437); // 오른아래
    });

    it("벽 재료는 여전히 거부한다", () => {
      const ctx = interiorContext();
      const result = runTool(ctx, "fill_region", { mapId: MAP_ID, rect: { x: 1, y: 1, w: 3, h: 3 }, material: "크림 회벽" });
      expect(result.ok).toBe(false);
    });
  });
});

// 실내 둘을 잇는 문은 다시 짓기 뒤에도 방 입구에 남고, 다른 맵으로 이어진 사다리를 빼앗지 않는다
// (2026-11-04 조수 대조 B1 Opus r3: 감방 계단 ↔ 막사 입구 문이 막사 다시 짓기 때 밤 광장으로 가는 사다리 탈 자리로 끌려가,
// 감방에서 올라오면 사다리 앞에 내리고 광장에서 오면 막사 입구에 내렸다 — scene-transfer-off-door·scene-transfer-pair).
describe("handInteriorRebuildKeepsEntranceDoor", () => {
  isolateTimers();
  describe("build_hand_interior_room 다시 짓기 — 실내끼리 잇는 입구 문", () => {
    it("입구 문과 그 착지를 사다리로 옮기지 않는다", () => {
      const ctx = { project: createBlankProject() };
      const outdoor = ctx.project.startMapId;
      const parts = runTool(ctx, "list_hand_interior_parts", {}).data as { floors?: ({ id: string } | string)[]; walls?: ({ id: string } | string)[] };
      const pick = (x: { id: string } | string | undefined) => (typeof x === "string" ? x : x?.id);
      const room = (mapId: string, name: string, plan: string[], objects: { id: string; x: number; y: number }[] = []) => ({
        tileset: "atlas_biome_interior", mapId, name, plan, floor: pick(parts.floors?.[0]), wall: pick(parts.walls?.[0]), objects,
      });
      expect(runTool(ctx, "build_hand_interior_room", room("cell", "감방", ["########", "#......#", "#......#", "#......#", "###.####"])).ok).toBe(true);
      const bar = room("barracks", "막사", ["##########", "#........#", "#........#", "#........#", "#........#", "#........#", "####.#####"], [{ id: "ship ladder", x: 7, y: 3 }]);
      expect(runTool(ctx, "build_hand_interior_room", bar).ok).toBe(true);
      expect(runTool(ctx, "create_transfer_pair", { a: { mapId: "cell", x: 3, y: 4 }, b: { mapId: "barracks", x: 4, y: 6 } }).ok).toBe(true);
      expect(runTool(ctx, "create_transfer_pair", { a: { mapId: "barracks", x: 7, y: 3 }, b: { mapId: outdoor, x: 5, y: 5 } }).ok).toBe(true);
      const gates = () => ctx.project.maps.barracks!.events
        .map((e) => `${e.x},${e.y}->${(e.pages ?? []).flatMap((p) => p.commands).find((c) => c.kind === "transfer")?.mapId ?? ""}`).sort();
      const before = gates();
      expect(before).toEqual(["4,6->cell", `7,3->${outdoor}`].sort());
      expect(runTool(ctx, "build_hand_interior_room", { ...bar, replace: true }).ok).toBe(true);
      expect(gates()).toEqual(before);
      const fromCell = ctx.project.maps.cell!.events.flatMap((e) => (e.pages ?? []).flatMap((p) => p.commands))
        .filter((c): c is Extract<typeof c, { kind: "transfer" }> => c.kind === "transfer");
      expect(fromCell.map((c) => `${c.mapId}(${c.x},${c.y})`)).toEqual(["barracks(4,5)"]);
    });
  });
});

// 실내를 다시 지어도 벽에 박힌 사다리에 단 바깥 출구는 사다리에 남는다(2026-11-03 조수 대조 B1 Opus:
// 막사 끝 사다리 ↔ 밤 광장 출구가 edit_place 다시 짓기 뒤 막사 입구로 끌려가 사다리는 아무 데도 안 가고 입구가 광장으로 나갔다).
describe("handInteriorRebuildKeepsLadderExit", () => {
  isolateTimers();
  describe("build_hand_interior_room 다시 짓기", () => {
    it("사다리 그림 칸의 바깥 출구를 가장자리 틈으로 옮기지 않는다", () => {
      const ctx = { project: createBlankProject() };
      const outdoor = ctx.project.startMapId;
      const parts = runTool(ctx, "list_hand_interior_parts", {});
      const data = parts.data as { floors?: ({ id: string } | string)[]; walls?: ({ id: string } | string)[] };
      const pick = (x: { id: string } | string | undefined) => (typeof x === "string" ? x : x?.id);
      const args = {
        tileset: "atlas_biome_interior", mapId: "barracks", name: "막사",
        plan: ["##########", "#........#", "#........#", "#........#", "#........#", "#........#", "####.#####"],
        floor: pick(data.floors?.[0]), wall: pick(data.walls?.[0]),
        objects: [{ id: "ship ladder", x: 2, y: 3 }],
      };
      expect(runTool(ctx, "build_hand_interior_room", args).ok).toBe(true);
      expect(runTool(ctx, "create_transfer_pair", { a: { mapId: "barracks", x: 2, y: 3 }, b: { mapId: outdoor, x: 5, y: 5 } }).ok).toBe(true);
      const exits = () => ctx.project.maps.barracks!.events
        .filter((e) => (e.pages ?? []).some((p) => p.commands.some((c) => c.kind === "transfer" && c.mapId === outdoor)))
        .map((e) => `${e.x},${e.y}`);
      expect(exits()).toEqual(["2,3"]);
      const again = runTool(ctx, "build_hand_interior_room", { ...args, replace: true });
      expect(again.ok, again.summary).toBe(true);
      expect(exits()).toEqual(["2,3"]);
    });
  });
});

describe("horrorPhase3Scene", () => {
  isolateTimers();
  type SceneToolData = {
    ok: boolean;
    failureReason?: string;
    finalState: {
      x: number;
      y: number;
      gameOver: boolean;
      endingsReached: readonly string[];
    };
  };
  describe("Phase 3 horror skeleton scene fixture", () => {
    it("트랩을 밟으면 gameOver가 되고 체크포인트 리트라이로 시작 위치를 복원한다", () => {
      const project = createHorrorPhase3Fixture();
      const result = runTool(
        { project },
        "run_scene_test",
        {
          mapId: project.startMapId,
          start: { x: 2, y: 2 },
          steps: [
            { kind: "move", dir: "right" },
            { kind: "expect", gameOver: true },
            { kind: "retryCheckpoint" },
            { kind: "expect", gameOver: false, playerAt: { x: 2, y: 2, mapId: project.startMapId } },
          ],
        }
      );

      expect(result.ok, result.summary).toBe(true);
      const data = result.data as SceneToolData;
      expect(data.ok, data.failureReason ?? JSON.stringify(data.finalState)).toBe(true);
      expect(data.finalState).toMatchObject({
        x: 2,
        y: 2,
        gameOver: false,
      });
    });

    it("조건 분기 엔딩이 priority 선택 후 endingReached 기대값을 만족한다", () => {
      const project = createHorrorPhase3Fixture();
      const result = runTool(
        { project },
        "run_scene_test",
        {
          mapId: project.startMapId,
          start: { x: 2, y: 2 },
          steps: [
            { kind: "interact" },
            { kind: "expect", switchOn: HORROR_FLAG_SWITCH, endingReached: HORROR_TRUE_ENDING },
          ],
        }
      );

      expect(result.ok, result.summary).toBe(true);
      const data = result.data as SceneToolData;
      expect(data.ok, data.failureReason ?? JSON.stringify(data.finalState)).toBe(true);
      expect(data.finalState.endingsReached).toEqual([HORROR_TRUE_ENDING]);
    });
  });
});

// 맵 인터뷰 재질문 버그 스모크(#7): 이미 설정한 타일이 계속 재질문되는 원인을 도구 계층에서 격리한다.
// set_tile_metadata → analyze_map_tile_usage의 described 전이가 도구 계층에서 정상인지 확인.
describe("interviewReask.smoke", () => {
  isolateTimers();
  type UsageData = { tiles: Array<{ tile: number; described: boolean; knownVia: string | null }>; coverage: { used: number; described: number } };
  function analyze(ctx: { project: ReturnType<typeof createBlankProject> }, mapId: string): UsageData {
    const res = runTool(ctx, "analyze_map_tile_usage", { mapId, includeDescribed: true });
    expect(res.ok, JSON.stringify(res.issues)).toBe(true);
    return res.data as UsageData;
  }
  function forgetTileMeta(ctx: { project: ReturnType<typeof createBlankProject> }, mapId: string, tile: number): void {
    const tileset = ctx.project.tilesets[ctx.project.maps[mapId]!.tilesetId]!;
    tileset.tileMeta![tile] = { description: "", label: "", source: "unknown" };
  }
  describe("맵 인터뷰 재질문 스모크(#7)", () => {
    it("set_tile_metadata로 라벨을 확정하면 그 타일은 described=true가 되어 재질문 목록에서 빠진다", () => {
      const ctx = { project: createBlankProject() };
      expect(runTool(ctx, "create_map", { id: "m1", name: "t", width: 12, height: 12 }).ok).toBe(true);
      // 기본 칩셋(beodeul_city, 2026-10-07 정리 뒤)은 칸마다 번들 설명이 있어 200 도 이미 described 다 —
      // 설명 없는 칸(업로드 칩셋과 같은 상태)으로 만들어 재질문 전이를 본다.
      forgetTileMeta(ctx, "m1", 200);
      // 내부(테두리 제외)에 임의 타일 200를 깐다.
      expect(runTool(ctx, "paint_tiles", { mapId: "m1", from: { x: 3, y: 3 }, to: { x: 5, y: 5 }, mode: "rect", layer: "lower", tile: 200 }).ok).toBe(true);

      const before = analyze(ctx, "m1");
      const stat72Before = before.tiles.find((t) => t.tile === 200);
      expect(stat72Before, "타일 200가 사용 통계에 있어야 한다").toBeDefined();

      // 사용자 확정으로 라벨 기록.
      const meta = runTool(ctx, "set_tile_metadata", { confirmedByUser: true, entries: [{ tile: 200, label: "장식 타일", description: "테스트용 장식" }] });
      expect(meta.ok, JSON.stringify(meta.issues)).toBe(true);

      const after = analyze(ctx, "m1");
      const stat72After = after.tiles.find((t) => t.tile === 200);
      expect(stat72After?.described, "확정 후 200은 described=true여야 한다").toBe(true);
      expect(stat72After?.knownVia).toBe("user");
      expect(after.coverage.described).toBeGreaterThan(before.coverage.described);
    });

    it("describe되지 않은 타일만 질문 목록에 오른다(includeDescribed=false)", () => {
      const ctx = { project: createBlankProject() };
      runTool(ctx, "create_map", { id: "m1", name: "t", width: 12, height: 12 });
      runTool(ctx, "paint_tiles", { mapId: "m1", from: { x: 3, y: 3 }, to: { x: 4, y: 4 }, mode: "rect", layer: "lower", tile: 200 });
      runTool(ctx, "set_tile_metadata", { confirmedByUser: true, entries: [{ tile: 200, label: "장식 타일" }] });
      const res = runTool(ctx, "analyze_map_tile_usage", { mapId: "m1" }); // includeDescribed 기본 false
      const listed = (res.data as UsageData).tiles;
      expect(listed.some((t) => t.tile === 200), "설명된 200은 질문 목록에서 빠져야 한다").toBe(false);
    });
  });
});

describe("investigationTools", () => {
  isolateTimers();
  type ToolData = {
    readonly created?: number;
    readonly skipped?: number;
    readonly eventIds?: readonly string[];
    readonly ok?: boolean;
    readonly failureReason?: string;
    readonly finalState?: {
      readonly switchesOn: readonly string[];
      readonly variables: Record<string, number>;
    };
  };
  function startMap(project: Project): GameMap {
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("start map missing");
    return map;
  }
  function existingEvent(id: string, x: number, y: number): GameEvent {
    return { id, x, y, trigger: { kind: "action" }, commands: [], pages: [] };
  }
  function assertTool(result: { readonly ok: boolean; readonly summary: string; readonly issues?: unknown }): void {
    expect(result.ok, `${result.summary} ${JSON.stringify(result.issues ?? [])}`).toBe(true);
  }
  function puzzleSnapshot(map: GameMap): unknown {
    return map.events.map((event) => ({
      id: event.id,
      x: event.x,
      y: event.y,
      pages: (event.pages ?? []).map((page) => ({
        id: page.id,
        name: page.name,
        conditions: page.conditions,
        trigger: page.trigger,
        commands: page.commands,
      })),
    }));
  }
  describe("place_examine_hotspots", () => {
    it("일괄 생성 중 좌표 중복/맵 밖/기존 이벤트 겹침은 항목별 skip warning으로 반환한다", () => {
      const ctx = { project: createBlankProject() };
      const map = startMap(ctx.project);
      map.events.push(existingEvent("ev_existing", 3, 3));

      const result = runTool(ctx, "place_examine_hotspots", {
        mapId: map.id,
        hotspots: [
          { at: { x: 1, y: 1 }, name: "책상", lines: ["서랍이 비어 있다."] },
          { at: { x: 1, y: 1 }, name: "중복 책상", lines: ["겹친다."] },
          { at: { x: 99, y: 1 }, name: "밖" },
          { at: { x: 3, y: 3 }, name: "기존 자리" },
        ],
      });

      assertTool(result);
      expect(result.summary).toContain("조사 핫스팟 1개 생성, 3개 스킵");
      expect(result.data).toMatchObject({ created: 1, skipped: 3 });
      expect(result.diff?.warnings?.filter((warning) => warning.includes("skip"))).toHaveLength(3);
      expect(result.diff?.warnings?.some((warning) => warning.startsWith("보이지 않는 조사 지점 1개(책상)"))).toBe(true);
      expect(result.diff?.warnings?.some((warning) => warning.includes("보석 표식"))).toBe(false);
      const placed = startMap(ctx.project).events.find((event) => event.id === "ev_examine_1");
      expect(placed?.pages?.[0]?.graphic).toEqual({ transparent: true });
      expect(startMap(ctx.project).events.map((event) => event.id)).toContain("ev_examine_1");
    });

    it("graphic:{transparent:true} 는 투명으로 두고, 본문 「이름:」 은 그 줄의 화자로 옮긴다", () => {
      const ctx = { project: createBlankProject() };
      const map = startMap(ctx.project);
      const result = runTool(ctx, "place_examine_hotspots", {
        mapId: map.id,
        hotspots: [{
          at: { x: 4, y: 4 },
          name: "긁힌 LP판",
          graphic: { transparent: true },
          lines: ["서하온: 첫 소절만 남아 있다.", "[잔류 사념: 그 멜로디가 뭐였더라]"],
        }],
      });
      assertTool(result);
      const event = startMap(ctx.project).events.find((entry) => entry.id === "ev_examine_1");
      expect(event?.pages?.[0]?.graphic).toEqual({ transparent: true });
      expect(event?.pages?.[0]?.commands).toEqual([
        { kind: "text", speaker: "서하온", body: "첫 소절만 남아 있다." },
        { kind: "text", speaker: "긁힌 LP판", body: "[잔류 사념: 그 멜로디가 뭐였더라]" },
      ]);
      expect(result.diff?.warnings?.some((warning) => warning.includes("보이지 않는 조사 지점"))).toBe(true);
    });

    it("once:true는 self-switch A 기반 1회성 페이지 구조를 만든다", () => {
      const ctx = { project: createBlankProject() };
      const map = startMap(ctx.project);
      const result = runTool(ctx, "place_examine_hotspots", {
        mapId: map.id,
        hotspots: [{ at: { x: 2, y: 2 }, name: "은색 상자", lines: ["상자가 닫혔다."], once: true }],
      });

      assertTool(result);
      const eventId = ((result.data as ToolData).eventIds ?? [])[0];
      const event = startMap(ctx.project).events.find((entry) => entry.id === eventId);
      expect(event?.pages).toHaveLength(2);
      expect(event?.pages?.[0]).toMatchObject({
        id: "ev_examine_1_once",
        conditions: [{ kind: "selfSwitch", key: "A", value: false }],
        commands: [
          { kind: "text", speaker: "은색 상자", body: "상자가 닫혔다." },
          { kind: "setSelfSwitch", key: "A", value: true },
        ],
      });
      expect(event?.pages?.[1]).toMatchObject({
        id: "ev_examine_1_done",
        conditions: [{ kind: "selfSwitch", key: "A", value: true }],
        commands: [],
      });
    });

    // 2026-09-24 감성 스토리 r3: usedIds 가 현재 맵 전용이라 두 번째 맵에도 ev_examine_1 이 중복
    // 생성됐다. once 페이지의 selfSwitch 는 전역 eventId 키라 — 맵1 조사 직후 맵2의 같은 id 이벤트가
    // «이미 조사함» 페이지로 고정돼 조사 스위치가 안 켜졌다(자동 플레이「페이지 1 대신 다른 페이지」실패).
    it("다른 맵에 place_examine_hotspots 를 다시 부르면 id 가 프로젝트 전역에서 고유하다", () => {
      const ctx = { project: createBlankProject() };
      const first = startMap(ctx.project);
      const second = runTool(ctx, "create_map", { id: "map_second_memory", name: "두 번째 기억", width: 12, height: 10 });
      assertTool(second);
      const firstIds = ((runTool(ctx, "place_examine_hotspots", {
        mapId: first.id,
        hotspots: [{ at: { x: 4, y: 4 }, name: "첫 기억 벤치", lines: ["비에 젖었다."], once: true }],
      }).data) as ToolData).eventIds ?? [];
      const secondIds = ((runTool(ctx, "place_examine_hotspots", {
        mapId: "map_second_memory",
        hotspots: [{ at: { x: 4, y: 4 }, name: "두 번째 기억 벤치", lines: ["劣화했다."], once: true }],
      }).data) as ToolData).eventIds ?? [];

      expect(firstIds).toHaveLength(1);
      expect(secondIds).toHaveLength(1);
      expect(secondIds[0]).not.toBe(firstIds[0]);
      const allIds = Object.values(ctx.project.maps).flatMap((map) => map.events.map((event) => event.id));
      expect(new Set(allIds).size).toBe(allIds.length);
    });
  });
  describe("compile_puzzle", () => {
    it("퍼즐 4종을 기존 이벤트 커맨드 트리로 컴파일한다", () => {
      const ctx = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      assertTool(runTool(ctx, "compile_puzzle", {
        mapId,
        puzzleId: "snap_seq",
        kind: "switch-sequence",
        nodes: [
          { at: { x: 2, y: 2 }, name: "왼쪽 종" },
          { at: { x: 3, y: 2 }, name: "오른쪽 종" },
        ],
        order: [0, 1],
        onSolve: { setSwitch: "sw_snap_seq", message: "문이 열렸다." },
      }));
      assertTool(runTool(ctx, "compile_puzzle", {
        mapId,
        puzzleId: "snap_password",
        kind: "password",
        at: { x: 5, y: 2 },
        name: "암호 석판",
        answer: "1234",
        prompt: "네 자리 숫자를 넣는다.",
        onSolve: { setSwitch: "sw_snap_password", message: "석판이 빛났다." },
      }));
      assertTool(runTool(ctx, "compile_puzzle", {
        mapId,
        puzzleId: "snap_gate",
        kind: "item-gate",
        at: { x: 7, y: 2 },
        name: "잠긴 함",
        requiredItemId: DEFAULT_ITEM_ID,
        consumeItem: true,
        lockedMessage: "열쇠가 필요하다.",
        unlockedMessage: "함이 열렸다.",
        onSolve: { setSwitch: "sw_snap_gate" },
      }));
      assertTool(runTool(ctx, "compile_puzzle", {
        mapId,
        puzzleId: "snap_push",
        kind: "push-switches",
        plates: [{ at: { x: 9, y: 2 } }, { at: { x: 10, y: 2 } }],
        all: true,
        onSolve: { setSwitch: "sw_snap_push", message: "철문이 내려앉았다." },
      }));

      expect(puzzleSnapshot(startMap(ctx.project))).toMatchInlineSnapshot(`
      [
        {
          "id": "ev_snap_seq_seq_1",
          "pages": [
            {
              "commands": [
                {
                  "condition": {
                    "kind": "variable",
                    "op": "==",
                    "value": 0,
                    "variableId": "var_snap_seq_step",
                  },
                  "else": [
                    {
                      "body": "순서가 틀렸다. 처음부터 다시 해야 한다.",
                      "kind": "text",
                    },
                    {
                      "kind": "setVariable",
                      "op": "=",
                      "value": 0,
                      "variableId": "var_snap_seq_step",
                    },
                  ],
                  "kind": "fork",
                  "then": [
                    {
                      "kind": "setVariable",
                      "op": "=",
                      "value": 1,
                      "variableId": "var_snap_seq_step",
                    },
                    {
                      "body": "어딘가에서 작은 소리가 났다.",
                      "kind": "text",
                    },
                  ],
                },
              ],
              "conditions": [
                {
                  "kind": "switch",
                  "switchId": "sw_snap_seq",
                  "value": false,
                },
              ],
              "id": "ev_snap_seq_seq_1_active",
              "name": "왼쪽 종",
              "trigger": {
                "kind": "action",
              },
            },
            {
              "commands": [],
              "conditions": [
                {
                  "kind": "switch",
                  "switchId": "sw_snap_seq",
                  "value": true,
                },
              ],
              "id": "ev_snap_seq_seq_1_solved",
              "name": "왼쪽 종 해결 후",
              "trigger": {
                "kind": "action",
              },
            },
          ],
          "x": 2,
          "y": 2,
        },
        {
          "id": "ev_snap_seq_seq_2",
          "pages": [
            {
              "commands": [
                {
                  "condition": {
                    "kind": "variable",
                    "op": "==",
                    "value": 1,
                    "variableId": "var_snap_seq_step",
                  },
                  "else": [
                    {
                      "body": "순서가 틀렸다. 처음부터 다시 해야 한다.",
                      "kind": "text",
                    },
                    {
                      "kind": "setVariable",
                      "op": "=",
                      "value": 0,
                      "variableId": "var_snap_seq_step",
                    },
                  ],
                  "kind": "fork",
                  "then": [
                    {
                      "kind": "setVariable",
                      "op": "=",
                      "value": 2,
                      "variableId": "var_snap_seq_step",
                    },
                    {
                      "body": "문이 열렸다.",
                      "kind": "text",
                    },
                    {
                      "kind": "setSwitch",
                      "switchId": "sw_snap_seq",
                      "value": true,
                    },
                  ],
                },
              ],
              "conditions": [
                {
                  "kind": "switch",
                  "switchId": "sw_snap_seq",
                  "value": false,
                },
              ],
              "id": "ev_snap_seq_seq_2_active",
              "name": "오른쪽 종",
              "trigger": {
                "kind": "action",
              },
            },
            {
              "commands": [],
              "conditions": [
                {
                  "kind": "switch",
                  "switchId": "sw_snap_seq",
                  "value": true,
                },
              ],
              "id": "ev_snap_seq_seq_2_solved",
              "name": "오른쪽 종 해결 후",
              "trigger": {
                "kind": "action",
              },
            },
          ],
          "x": 3,
          "y": 2,
        },
        {
          "id": "ev_snap_password_password",
          "pages": [
            {
              "commands": [
                {
                  "body": "네 자리 숫자를 넣는다.",
                  "kind": "text",
                },
                {
                  "digits": 4,
                  "kind": "inputNumber",
                  "variableId": "var_snap_password_password",
                },
                {
                  "condition": {
                    "kind": "variable",
                    "op": "==",
                    "value": 1234,
                    "variableId": "var_snap_password_password",
                  },
                  "else": [
                    {
                      "body": "암호가 틀렸다.",
                      "kind": "text",
                    },
                    {
                      "kind": "setVariable",
                      "op": "=",
                      "value": 0,
                      "variableId": "var_snap_password_password",
                    },
                  ],
                  "kind": "fork",
                  "then": [
                    {
                      "body": "석판이 빛났다.",
                      "kind": "text",
                    },
                    {
                      "kind": "setSwitch",
                      "switchId": "sw_snap_password",
                      "value": true,
                    },
                  ],
                },
              ],
              "conditions": [
                {
                  "kind": "switch",
                  "switchId": "sw_snap_password",
                  "value": false,
                },
              ],
              "id": "ev_snap_password_password_active",
              "name": "암호 석판",
              "trigger": {
                "kind": "action",
              },
            },
            {
              "commands": [],
              "conditions": [
                {
                  "kind": "switch",
                  "switchId": "sw_snap_password",
                  "value": true,
                },
              ],
              "id": "ev_snap_password_password_solved",
              "name": "암호 석판 해결 후",
              "trigger": {
                "kind": "action",
              },
            },
          ],
          "x": 5,
          "y": 2,
        },
        {
          "id": "ev_snap_gate_gate",
          "pages": [
            {
              "commands": [
                {
                  "condition": {
                    "itemId": "item_potion",
                    "kind": "item",
                    "present": true,
                  },
                  "else": [
                    {
                      "body": "열쇠가 필요하다.",
                      "kind": "text",
                    },
                  ],
                  "kind": "fork",
                  "then": [
                    {
                      "body": "함이 열렸다.",
                      "kind": "text",
                    },
                    {
                      "amount": 1,
                      "itemId": "item_potion",
                      "kind": "changeItem",
                      "op": "-=",
                    },
                    {
                      "kind": "setSwitch",
                      "switchId": "sw_snap_gate",
                      "value": true,
                    },
                  ],
                },
              ],
              "conditions": [
                {
                  "kind": "switch",
                  "switchId": "sw_snap_gate",
                  "value": false,
                },
              ],
              "id": "ev_snap_gate_gate_active",
              "name": "잠긴 함",
              "trigger": {
                "kind": "action",
              },
            },
            {
              "commands": [],
              "conditions": [
                {
                  "kind": "switch",
                  "switchId": "sw_snap_gate",
                  "value": true,
                },
              ],
              "id": "ev_snap_gate_gate_solved",
              "name": "잠긴 함 해결 후",
              "trigger": {
                "kind": "action",
              },
            },
          ],
          "x": 7,
          "y": 2,
        },
        {
          "id": "ev_snap_push_plate_1",
          "pages": [
            {
              "commands": [
                {
                  "key": "A",
                  "kind": "setSelfSwitch",
                  "value": true,
                },
                {
                  "kind": "setSwitch",
                  "switchId": "sw_snap_push_plate_1",
                  "value": true,
                },
                {
                  "condition": {
                    "kind": "switch",
                    "switchId": "sw_snap_push_plate_1",
                    "value": true,
                  },
                  "else": [],
                  "kind": "fork",
                  "then": [
                    {
                      "condition": {
                        "kind": "switch",
                        "switchId": "sw_snap_push_plate_2",
                        "value": true,
                      },
                      "else": [],
                      "kind": "fork",
                      "then": [
                        {
                          "body": "철문이 내려앉았다.",
                          "kind": "text",
                        },
                        {
                          "kind": "setSwitch",
                          "switchId": "sw_snap_push",
                          "value": true,
                        },
                      ],
                    },
                  ],
                },
              ],
              "conditions": [
                {
                  "kind": "switch",
                  "switchId": "sw_snap_push",
                  "value": false,
                },
                {
                  "key": "A",
                  "kind": "selfSwitch",
                  "value": false,
                },
              ],
              "id": "ev_snap_push_plate_1_fresh",
              "name": "발판 1",
              "trigger": {
                "kind": "playerTouch",
              },
            },
            {
              "commands": [],
              "conditions": [
                {
                  "kind": "switch",
                  "switchId": "sw_snap_push",
                  "value": false,
                },
                {
                  "key": "A",
                  "kind": "selfSwitch",
                  "value": true,
                },
              ],
              "id": "ev_snap_push_plate_1_pressed",
              "name": "발판 1 눌림",
              "trigger": {
                "kind": "playerTouch",
              },
            },
            {
              "commands": [],
              "conditions": [
                {
                  "kind": "switch",
                  "switchId": "sw_snap_push",
                  "value": true,
                },
              ],
              "id": "ev_snap_push_plate_1_solved",
              "name": "발판 1 해결 후",
              "trigger": {
                "kind": "playerTouch",
              },
            },
          ],
          "x": 9,
          "y": 2,
        },
        {
          "id": "ev_snap_push_plate_2",
          "pages": [
            {
              "commands": [
                {
                  "key": "A",
                  "kind": "setSelfSwitch",
                  "value": true,
                },
                {
                  "kind": "setSwitch",
                  "switchId": "sw_snap_push_plate_2",
                  "value": true,
                },
                {
                  "condition": {
                    "kind": "switch",
                    "switchId": "sw_snap_push_plate_1",
                    "value": true,
                  },
                  "else": [],
                  "kind": "fork",
                  "then": [
                    {
                      "condition": {
                        "kind": "switch",
                        "switchId": "sw_snap_push_plate_2",
                        "value": true,
                      },
                      "else": [],
                      "kind": "fork",
                      "then": [
                        {
                          "body": "철문이 내려앉았다.",
                          "kind": "text",
                        },
                        {
                          "kind": "setSwitch",
                          "switchId": "sw_snap_push",
                          "value": true,
                        },
                      ],
                    },
                  ],
                },
              ],
              "conditions": [
                {
                  "kind": "switch",
                  "switchId": "sw_snap_push",
                  "value": false,
                },
                {
                  "key": "A",
                  "kind": "selfSwitch",
                  "value": false,
                },
              ],
              "id": "ev_snap_push_plate_2_fresh",
              "name": "발판 2",
              "trigger": {
                "kind": "playerTouch",
              },
            },
            {
              "commands": [],
              "conditions": [
                {
                  "kind": "switch",
                  "switchId": "sw_snap_push",
                  "value": false,
                },
                {
                  "key": "A",
                  "kind": "selfSwitch",
                  "value": true,
                },
              ],
              "id": "ev_snap_push_plate_2_pressed",
              "name": "발판 2 눌림",
              "trigger": {
                "kind": "playerTouch",
              },
            },
            {
              "commands": [],
              "conditions": [
                {
                  "kind": "switch",
                  "switchId": "sw_snap_push",
                  "value": true,
                },
              ],
              "id": "ev_snap_push_plate_2_solved",
              "name": "발판 2 해결 후",
              "trigger": {
                "kind": "playerTouch",
              },
            },
          ],
          "x": 10,
          "y": 2,
        },
      ]
    `);
    });

    it("solvability 위반은 한국어 사유로 거부한다", () => {
      const orderCtx = { project: createBlankProject() };
      const order = runTool(orderCtx, "compile_puzzle", {
        mapId: orderCtx.project.startMapId,
        puzzleId: "bad_order",
        kind: "switch-sequence",
        nodes: [{ at: { x: 2, y: 2 }, name: "종" }],
        order: [1],
        onSolve: {},
      });
      expect(order.ok).toBe(false);
      expect(order.issues?.[0]?.message).toContain("범위");

      const passwordCtx = { project: createBlankProject() };
      const password = runTool(passwordCtx, "compile_puzzle", {
        mapId: passwordCtx.project.startMapId,
        puzzleId: "bad_password",
        kind: "password",
        at: { x: 2, y: 2 },
        answer: "",
        onSolve: {},
      });
      expect(password.ok).toBe(false);
      expect(password.issues?.[0]?.message).toContain("비어");

      const itemCtx = { project: createBlankProject() };
      const itemGate = runTool(itemCtx, "compile_puzzle", {
        mapId: itemCtx.project.startMapId,
        puzzleId: "bad_item",
        kind: "item-gate",
        at: { x: 2, y: 2 },
        requiredItemId: "item_missing",
        onSolve: {},
      });
      expect(itemGate.ok).toBe(false);
      expect(itemGate.issues?.[0]?.message).toContain("DB에 존재하지 않습니다");

      // TILE.WATER 는 합본 마을 번호다 — 2026-10-07 정리 뒤 기본이 beodeul_city 라 옛 저장본처럼 시작 맵을 합본 마을에 둔다.
      const openPlateCtx = { project: startOnRetiredCombinedTown(createBlankProject()) };
      const openPlateMap = startMap(openPlateCtx.project);
      openPlateMap.lowerTiles[2 + 2 * openPlateMap.width] = TILE.WATER;
      const openPlate = runTool(openPlateCtx, "compile_puzzle", {
        mapId: openPlateMap.id,
        puzzleId: "adjusted_plate",
        kind: "push-switches",
        plates: [{ at: { x: 2, y: 2 } }],
        all: true,
        onSolve: {},
      });
      expect(openPlate.ok).toBe(true);
      expect(openPlate.diff?.warnings.some((warning) => warning.includes("위치 자동 조정"))).toBe(true);

      const blockedPlateCtx = { project: startOnRetiredCombinedTown(createBlankProject()) };
      const blockedPlateMap = startMap(blockedPlateCtx.project);
      // 자동 조정은 입구에서 걸어 닿는 칸을 반경 10칸까지 찾는다(nearestPassableCell, b65ac788a4 #4050) — 닿을 칸이 아예 남지 않게 맵 전체를 물로 막는다.
      for (let y = 0; y < blockedPlateMap.height; y += 1) {
        for (let x = 0; x < blockedPlateMap.width; x += 1) blockedPlateMap.lowerTiles[x + y * blockedPlateMap.width] = TILE.WATER;
      }
      const blockedPlate = runTool(blockedPlateCtx, "compile_puzzle", {
        mapId: blockedPlateMap.id,
        puzzleId: "blocked_plate",
        kind: "push-switches",
        plates: [{ at: { x: 2, y: 2 } }],
        all: true,
        onSolve: {},
      });
      expect(blockedPlate.ok).toBe(true);
      expect(blockedPlate.data).toMatchObject({ created: 0, skipped: 1 });
      expect(blockedPlate.diff?.warnings.some((warning) => warning.includes("총 1개 skip"))).toBe(true);
    });
  });
  describe("Phase 4 조사/퍼즐 run_scene_test 통합", () => {
    function createSceneProject(): Project {
      const ctx = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      assertTool(runTool(ctx, "compile_puzzle", {
        mapId,
        puzzleId: "scene_seq",
        kind: "switch-sequence",
        nodes: [
          { at: { x: 2, y: 2 }, name: "첫 종" },
          { at: { x: 3, y: 2 }, name: "둘째 종" },
        ],
        order: [0, 1],
        onSolve: { setSwitch: "sw_scene_seq" },
      }));
      assertTool(runTool(ctx, "place_examine_hotspots", {
        mapId,
        hotspots: [{ at: { x: 4, y: 4 }, name: "작은 열쇠", itemId: DEFAULT_ITEM_ID, once: true }],
      }));
      assertTool(runTool(ctx, "compile_puzzle", {
        mapId,
        puzzleId: "scene_gate",
        kind: "item-gate",
        at: { x: 5, y: 4 },
        name: "잠긴 문",
        requiredItemId: DEFAULT_ITEM_ID,
        lockedMessage: "잠겨 있다.",
        unlockedMessage: "문이 열린다.",
        onSolve: { setSwitch: "sw_scene_gate" },
      }));
      assertTool(runTool(ctx, "compile_puzzle", {
        mapId,
        puzzleId: "scene_push",
        kind: "push-switches",
        plates: [{ at: { x: 6, y: 6 } }, { at: { x: 7, y: 6 } }],
        all: true,
        onSolve: { setSwitch: "sw_scene_push" },
      }));
      return ctx.project;
    }

    it("순서 퍼즐은 정순 해결 시 스위치를 켠다", () => {
      const project = createSceneProject();
      const result = runTool({ project }, "run_scene_test", {
        mapId: project.startMapId,
        start: { x: 2, y: 2 },
        steps: [
          { kind: "interact" },
          { kind: "expect", variableEquals: { variableId: "var_scene_seq_step", value: 1 }, switchOff: "sw_scene_seq" },
          { kind: "move", dir: "right" },
          { kind: "interact" },
          { kind: "expect", switchOn: "sw_scene_seq" },
        ],
      });

      assertTool(result);
      expect((result.data as ToolData).ok, (result.data as ToolData).failureReason).toBe(true);
    });

    it("순서 퍼즐은 오답 입력 시 진행도를 리셋한다", () => {
      const project = createSceneProject();
      const result = runTool({ project }, "run_scene_test", {
        mapId: project.startMapId,
        start: { x: 2, y: 2 },
        steps: [
          { kind: "interact" },
          { kind: "expect", variableEquals: { variableId: "var_scene_seq_step", value: 1 } },
          { kind: "interact" },
          { kind: "expect", variableEquals: { variableId: "var_scene_seq_step", value: 0 }, switchOff: "sw_scene_seq" },
        ],
      });

      assertTool(result);
      expect((result.data as ToolData).ok, (result.data as ToolData).failureReason).toBe(true);
    });

    it("item-gate는 아이템 없이 잠기고 지급 후 통과한다", () => {
      const project = createSceneProject();
      const result = runTool({ project }, "run_scene_test", {
        mapId: project.startMapId,
        start: { x: 5, y: 4 },
        steps: [
          { kind: "interact" },
          { kind: "expect", switchOff: "sw_scene_gate" },
          { kind: "move", dir: "left" },
          { kind: "interact" },
          { kind: "move", dir: "right" },
          { kind: "interact" },
          { kind: "expect", switchOn: "sw_scene_gate" },
        ],
      });

      assertTool(result);
      expect((result.data as ToolData).ok, (result.data as ToolData).failureReason).toBe(true);
    });

    it("push-switches는 모든 발판을 밟으면 해결 스위치를 켠다", () => {
      const project = createSceneProject();
      const result = runTool({ project }, "run_scene_test", {
        mapId: project.startMapId,
        start: { x: 5, y: 6 },
        steps: [
          { kind: "move", dir: "right" },
          { kind: "expect", switchOff: "sw_scene_push" },
          { kind: "move", dir: "right" },
          { kind: "expect", switchOn: "sw_scene_push" },
        ],
      });

      assertTool(result);
      expect((result.data as ToolData).ok, (result.data as ToolData).failureReason).toBe(true);
    });
  });
  describe("갤러리 방 Phase 4 fixture", () => {
    it("조사 핫스팟 12개, 순서 퍼즐, item-gate, 엔딩 스위치를 포함한다", () => {
      const project = createGalleryPhase4Fixture();
      const map = startMap(project);

      expect(map.name).toBe("갤러리 방");
      expect(map.events.filter((event) => event.id.startsWith("ev_examine_"))).toHaveLength(12);
      expect(map.events.some((event) => event.id === "ev_gallery_order_seq_1")).toBe(true);
      expect(map.events.some((event) => event.id === "ev_gallery_exit_gate")).toBe(true);
      expect(project.switches.map((entry) => entry.id)).toEqual(expect.arrayContaining([GALLERY_ORDER_SWITCH, GALLERY_EXIT_SWITCH]));
      expect(project.endings?.find((ending) => ending.id === GALLERY_ENDING_ID)).toMatchObject({
        conditions: [{ kind: "switch", switchId: GALLERY_EXIT_SWITCH, value: true }],
      });
    });
  });
});

describe("layoutRegionTools", () => {
  isolateTimers();
  // mapLayoutPlan.test.ts 의 fixture plan 을 그대로 긁어 와서 blank 프로젝트 맵에 얹는다.
  const FIXTURE_PLAN: MapLayoutPlan = {
    version: 1,
    kind: "test",
    seed: 1,
    regions: [
      {
        id: "house-blue",
        role: "house",
        label: "파랑 지붕 석벽 집 (ㄱ자)",
        x: 20,
        y: 20,
        w: 8,
        h: 8,
        kitId: "blue-stone",
        shape: "L",
        tags: ["house", "blue-stone", "centerish"],
      },
      {
        id: "market",
        role: "market",
        label: "중앙 상점(장터 데크)",
        x: 22,
        y: 16,
        w: 9,
        h: 8,
        tags: ["market", "shop", "centerish"],
      },
      {
        id: "forest",
        role: "forest",
        label: "동쪽 곡선 숲",
        x: 44,
        y: 12,
        w: 6,
        h: 32,
        tags: ["forest", "curved"],
      },
    ],
  };
  function projectWithPlan(): ReturnType<typeof createBlankProject> {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("blank 프로젝트에 시작 맵이 없습니다.");
    map.layoutPlan = FIXTURE_PLAN;
    return project;
  }
  describe("find_layout_regions tool", () => {
    it("registers the tool in the registry", () => {
      const tool = getTool("find_layout_regions");
      expect(tool).toBeDefined();
      expect(tool?.name).toBe("find_layout_regions");
      expect(tool?.mode).toBe("read");
    });

    it("center shop query returns the market region", () => {
      const tool = getTool("find_layout_regions");
      if (!tool) throw new Error("find_layout_regions 툴이 없습니다.");
      const result = tool.run(projectWithPlan(), { mapId: "map_blank_start", query: "가운데 상점" });
      const regions = (result.data as { regions: Array<{ role: string; id: string }> }).regions;
      expect(regions.length).toBeGreaterThan(0);
      expect(regions.some((r) => r.role === "market")).toBe(true);
      // 중앙 쿼리라 맵 중앙(market)이 첫 번째로 정렬된다.
      expect(regions[0]?.id).toBe("market");
    });

    it("returns [] for a query matching nothing", () => {
      const tool = getTool("find_layout_regions");
      if (!tool) throw new Error("find_layout_regions 툴이 없습니다.");
      const result = tool.run(projectWithPlan(), { mapId: "map_blank_start", query: "존재하지않는것" });
      expect((result.data as { regions: unknown[] }).regions).toEqual([]);
    });

    it("returns [] and notes missing layoutPlan when map has none", () => {
      const tool = getTool("find_layout_regions");
      if (!tool) throw new Error("find_layout_regions 툴이 없습니다.");
      const result = tool.run(createBlankProject(), { mapId: "map_blank_start", query: "가운데 상점" });
      expect((result.data as { regions: unknown[] }).regions).toEqual([]);
      expect(result.summary).toContain("layoutPlan");
    });
  });
});

describe("mirrorRegion", () => {
  isolateTimers();
  function setup() {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const map = project.maps[mapId];
    // 3×2 영역 (1,1)~(3,2)에 식별 가능한 타일 패턴을 깐다
    const at = (x: number, y: number) => y * map.width + x;
    map.lowerTiles[at(1, 1)] = 101;
    map.lowerTiles[at(2, 1)] = 102;
    map.lowerTiles[at(3, 1)] = 103;
    map.lowerTiles[at(1, 2)] = 104;
    map.lowerTiles[at(2, 2)] = 105;
    map.lowerTiles[at(3, 2)] = 106;
    map.upperTiles[at(1, 1)] = 201;
    map.lowerTileStacks = { [at(1, 1)]: [301, 302] };
    map.events.push({
      id: "ev_m",
      x: 1,
      y: 2,
      trigger: { kind: "action" },
      commands: [],
      pages: [],
    } as never);
    return { project, mapId, map, at };
  }
  describe("mirror_region", () => {
    it("horizontal: 타일·스택·이벤트 x좌표를 좌우 대칭한다", () => {
      const { project, mapId, map, at } = setup();
      getTool("mirror_region")!.run(project, { mapId, x: 1, y: 1, w: 3, h: 2, axis: "horizontal" });
      expect(map.lowerTiles[at(1, 1)]).toBe(103);
      expect(map.lowerTiles[at(2, 1)]).toBe(102);
      expect(map.lowerTiles[at(3, 1)]).toBe(101);
      expect(map.lowerTiles[at(3, 2)]).toBe(104);
      expect(map.upperTiles[at(3, 1)]).toBe(201); // upper도 대칭
      expect(map.lowerTileStacks?.[at(3, 1)]).toEqual([301, 302]); // 스택 이동
      expect(map.lowerTileStacks?.[at(1, 1)]).toBeUndefined();
      const event = map.events.find((entry) => entry.id === "ev_m")!;
      expect(event.x).toBe(3); // 1 → 3 (영역 [1,3] 대칭)
      expect(event.y).toBe(2);
    });

    it("vertical: y좌표를 상하 대칭한다", () => {
      const { project, mapId, map, at } = setup();
      getTool("mirror_region")!.run(project, { mapId, x: 1, y: 1, w: 3, h: 2, axis: "vertical" });
      expect(map.lowerTiles[at(1, 1)]).toBe(104);
      expect(map.lowerTiles[at(1, 2)]).toBe(101);
    });

    it("영역이 맵과 겹치지 않으면 ToolError", () => {
      const { project, mapId } = setup();
      expect(() =>
        getTool("mirror_region")!.run(project, { mapId, x: 999, y: 999, w: 2, h: 2, axis: "horizontal" })
      ).toThrow();
    });
  });
});

describe("moveEventWhere", () => {
  isolateTimers();
  // 2026-11-11 구조 재점검 3-3: 화면 검수 결함에는 칸 좌표가 없는데 move_event 는 x,y 가 필수라 모델이 «옮길 좌표를 확인하지 못했다»로 막혔다.
  function person(id: string, name: string, x: number, y: number): GameEvent {
    return {
      id, name, x, y, trigger: { kind: "action" }, commands: [], placementRole: "npc",
      pages: [{ id: "p", name, conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [{ kind: "text", body: "…" }] }],
    } as GameEvent;
  }
  function fixture() {
    const ctx = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    const map = ctx.project.maps[mapId];
    assert(map);
    map.events.push(person("ev_merchant", "상인", 5, 5), person("ev_chief", "촌장", 9, 4));
    const where = () => { const e = ctx.project.maps[mapId]!.events.find((entry) => entry.id === "ev_merchant")!; return { x: e.x, y: e.y }; };
    return { ctx, mapId, where };
  }
  describe("move_event — 좌표 없이 옮기기", () => {
    it("x,y 는 필수가 아니다", () => {
      expect(getTool("move_event")?.parameters.required).toEqual(["mapId", "eventId"]);
    });

    it("dx,dy 는 지금 칸 기준이다 — «두 칸 왼쪽»", () => {
      const { ctx, mapId, where } = fixture();
      const result = runTool(ctx, "move_event", { mapId, eventId: "ev_merchant", dx: -2 });
      assert(result.ok, result.summary);
      expect(where()).toEqual({ x: 3, y: 5 });
      expect(result.data).toMatchObject({ x: 3, y: 5, from: { x: 5, y: 5 } });
    });

    it("where 는 자리 낱말로 칸을 고르고 고른 칸을 돌려준다 — 다른 이벤트 이름도 기준이 된다", () => {
      const { ctx, mapId, where } = fixture();
      const result = runTool(ctx, "move_event", { mapId, eventId: "ev_merchant", where: "촌장 옆" });
      assert(result.ok, result.summary);
      const at = where();
      expect(Math.abs(at.x - 9) + Math.abs(at.y - 4)).toBeLessThanOrEqual(2);
      expect(at).not.toEqual({ x: 9, y: 4 });
      expect(result.data).toMatchObject({ x: at.x, y: at.y, how: expect.stringContaining("촌장") });
    });

    it("그 맵에 없는 자리 낱말은 옮기지 않고 거절한다(시작 근처로 보내지 않는다)", () => {
      const { ctx, mapId, where } = fixture();
      const result = runTool(ctx, "move_event", { mapId, eventId: "ev_merchant", where: "용의 둥지 옆" });
      expect(result.ok).toBe(false);
      expect(result.summary).toContain("Nothing was moved");
      expect(where()).toEqual({ x: 5, y: 5 });
    });

    it("목적지가 없으면 세 가지 방법을 일러 준다", () => {
      const { ctx, mapId, where } = fixture();
      const result = runTool(ctx, "move_event", { mapId, eventId: "ev_merchant" });
      expect(result.ok).toBe(false);
      expect(result.summary).toMatch(/dx and dy/u);
      expect(result.summary).toMatch(/where/u);
      expect(where()).toEqual({ x: 5, y: 5 });
    });
  });
});
