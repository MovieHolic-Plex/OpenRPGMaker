import { describe, expect, it } from "vitest";
import { flattenWrapperTool, flatWrapperShape } from "@/ai/v2/tools/flatWrapper";
import type { PiToolShape } from "@/ai/piAgent/toolAdapter";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { isPassable } from "@/project/collision";
import type { GameEvent, GameMap, Project } from "@/project/types";
import { reachableCells, hostWords, itemTileWords, singleTileObject } from "@/ai/v2/judge/eventReach";
import { buildingEntrances } from "@/ai/v2/place/entrances";
import { lockBareHouseDoors } from "@/ai/v2/place/lockedDoors";
import { VILLAGE_BUILDER } from "@/ai/v2/place/builders/village";
import type { BuildRun, PlaceBuildResult, PlaceSpec } from "@/ai/v2/shared/types";
import { gatesThatOpenNothing } from "@/ai/v2/judge/puzzleChecks";
import type { ToolContext } from "@/editor/tools/types";
import { createV2Tools } from "@/ai/v2/tools/verbs";
import { V2Session } from "@/ai/v2/turn/session";
import type { PiAssistantV2Env } from "@/ai/v2/shared/env";
import { keepRelaidMapId, keptMapId, keptPlaceResult, renameIdIn, renameMapId } from "@/ai/v2/place/keepMapId";
import { hideRankForLabel, tilesetHasHidingFurniture } from "@/project/chaserHiding";
import { labelHasWord, labelNames } from "@/project/labelWords";
import { dressBareCaveGates } from "@/ai/v2/place/caveGates";
import { doorFloorTransfers } from "@/ai/v2/place/exitTransfers";
import { stage as chaserHiding } from "@/ai/v2/finish/lanes/stages/chaser-hiding";
import { artGapsIn, recordArtGaps, type ArtGap } from "@/project/artGap";
import type { FinishCtx } from "@/ai/v2/finish/types";
import { createBeodeulCityTileset } from "@/project/defaults/beodeulCity";
import { createBuildRun } from "@/ai/v2/shared/buildRun";
import { buildFromLayout } from "@/ai/v2/place/builders/interiorLayoutBuild";
import { effectiveSpec } from "@/ai/v2/place/interiorCatalog";
import { mapMusicVarietyProblems } from "@/ai/v2/judge/mapMusicChecks";
import { gameContentProblems } from "@/ai/v2/judge/gameChecks";
import { v2ExtraToolNames } from "@/ai/v2/request/readers";
import { indexProject } from "@/ai/v2/loop/refs";
import { loadPlaces, savePlaces } from "@/ai/v2/tools/placeMemory";
import { deserialize, serialize } from "@/project/io/serialize";
import { whereHint } from "@/ai/v2/judge/objectiveWhere";
import { normalizeGameBlueprint } from "@/project/gameBlueprint";
import { validateCommandArray } from "@/project/io/shapeCommandFields";
import { objectiveCommand, objectiveTargetOf, setObjectiveTarget } from "@/ai/v2/judge/objectiveCommand";
import { planObjective } from "@/ai/v2/judge/objectivePlan";
import { refreshObjectiveRoutes } from "@/ai/v2/judge/objectiveRoutes";
import type { RawCommand } from "@/qa/gameCheck/walk";
import { V2_TOOL_EN } from "@/ai/v2/tools/toolTextEn";
import { pathCopy, repairPathTroop } from "@/ai/v2/story/pathBattleBudget";
import { isolateTimers } from "./mergedTeardown";

describe("aiV2FlatWrapper", () => {
  isolateTimers();
  const echo = (name: string, parameters: unknown): PiToolShape => ({
    name, label: name, description: name, parameters,
    execute: async (_id, params) => ({ content: [{ type: "text", text: JSON.stringify(params) }] }),
  });
  const run = async (tool: PiToolShape, args: unknown): Promise<unknown> => JSON.parse(((await tool.execute("1", args)).content[0] as { text: string }).text);
  describe("J67 flattened single-wrapper schemas", () => {
    const spec = { type: "object", properties: { spec: { type: "object", properties: { type: { type: "string" }, name: { type: "string" } }, required: ["type", "name"] } }, required: ["spec"] };
    it("shows inner fields at the top and rewraps them", async () => {
      const tool = flattenWrapperTool(echo("make_place", spec));
      expect(Object.keys((tool.parameters as { properties: object }).properties)).toEqual(["type", "name"]);
      expect(await run(tool, { type: "village", name: "a" })).toEqual({ spec: { type: "village", name: "a" } });
    });
    it("still accepts the old wrapped shape", async () => {
      const tool = flattenWrapperTool(echo("make_place", spec));
      expect(await run(tool, { spec: { type: "village", name: "a" } })).toEqual({ spec: { type: "village", name: "a" } });
    });
    it("fills a partial wrapper from flat fields instead of leaving them outside", async () => {
      const tool = flattenWrapperTool(echo("make_place", spec));
      expect(await run(tool, { spec: { type: "village" }, name: "a" })).toEqual({ spec: { type: "village", name: "a" } });
      expect(await run(tool, { spec: { type: "village", name: "안" }, name: "밖" })).toEqual({ spec: { type: "village", name: "안" } });
    });
    it("refuses a flat call missing an inner required field", async () => {
      const tool = flattenWrapperTool(echo("make_place", spec));
      expect(await run(tool, { type: "village" })).toMatchObject({ ok: false });
    });
    it("flattens one person of add_people and keeps the list for several", async () => {
      const people = { type: "object", properties: { mapId: { type: "string" }, people: { type: "array", items: { type: "object", properties: { role: { type: "string" }, mapId: { type: "string" } }, required: ["role"] } } }, required: ["people"] };
      const shape = flatWrapperShape("add_people", people)!;
      expect(Object.keys(shape.parameters.properties!)).toEqual(["mapId", "role", "people"]);
      const tool = flattenWrapperTool(echo("add_people", people));
      expect(await run(tool, { mapId: "m", role: "guard" })).toEqual({ mapId: "m", people: [{ role: "guard" }] });
      expect(await run(tool, { mapId: "m", people: [{ role: "a" }, { role: "b" }] })).toEqual({ mapId: "m", people: [{ role: "a" }, { role: "b" }] });
      expect(await run(tool, { mapId: "m", people: [{ role: "guard" }], name: "경비" })).toEqual({ mapId: "m", people: [{ role: "guard", name: "경비" }] });
      expect(await run(tool, { mapId: "m", people: [{ role: "a", name: "가" }, { role: "b" }], name: "찌꺼기" })).toEqual({ mapId: "m", people: [{ role: "a", name: "가" }, { role: "b" }] });
      expect(await run(tool, { mapId: "m", people: [{ role: "a" }], role: "clerk", name: "다" })).toEqual({ mapId: "m", people: [{ role: "a" }, { role: "clerk", name: "다" }] });
    });
    it("moves extra fields into an open inner object (upsert_event)", async () => {
      const ev = { type: "object", properties: { mapId: { type: "string" }, event: { type: "object", properties: { id: { type: "string" } }, required: ["id"], additionalProperties: true } }, required: ["mapId", "event"] };
      const tool = flattenWrapperTool(echo("upsert_event", ev));
      expect(await run(tool, { mapId: "m", id: "e", name: "문" })).toEqual({ mapId: "m", event: { id: "e", name: "문" } });
    });
    it("leaves other tools alone", () => {
      const t = echo("edit_place", spec);
      expect(flattenWrapperTool(t)).toBe(t);
    });
  });
});

// 「들어갈 수 없다」 한 줄(조사 키)은 칩셋 키트가 적어 둔 건물 입구에만 선다 — 걸어서 지나는 문(성문·아치·목책 문)의 기둥에는 서지 않고, 전에 세운 것은 걷어 낸다.
// 2026-11-11 Terra 게임 둘의 「굳게 닫힌 집 문」 27개가 전부 성문 기둥에 서 있었고, 눈가림 플레이어는 궁전에 들어가지 않았다.
// 같은 날 단계×테마 표: 구성기 칩셋 바깥 맵 36장 가운데 35장에서 진짜 집 문은 하나도 반응하지 않았다(집은 키트 한 덩이라 문 이름표가 없다).
describe("aiV2GateNotHouseDoor", () => {
  isolateTimers();
  const locked = (project: Project, mapId: string) => project.maps[mapId]!.events.filter((e) => e.id.startsWith("ev_locked_door_"));
  const at = (cells: readonly { x: number; y: number }[], e: { x: number; y: number }) => cells.some((c) => c.x === e.x && c.y === e.y);
  function desert(kind: string): { project: Project } {
    const ctx = { project: createBlankProject() };
    expect(runTool(ctx, "create_map", { id: "map_p", name: "사막", width: 48, height: 40, tilesetId: "desert_east" }).ok).toBe(true);
    expect(runTool(ctx, "compose_desert_east_map", { mapId: "map_p", kind, seed: 1 }).ok).toBe(true);
    return ctx;
  }
  /** 이름표가 「…문」으로 끝나는 그림 칸 — 이 궁전 맵에서는 걸어서 지나는 성문 기둥뿐이다(전에는 이것을 문으로 읽었다). */
  function gatePostCells(project: Project, map: GameMap): { x: number; y: number }[] {
    const meta = (project.tilesets[map.tilesetId]?.tileMeta ?? []) as unknown as ({ label?: string } | undefined)[];
    const layers = [map.lowerTiles, (map as unknown as Record<string, ArrayLike<number> | undefined>).lowerOverlayTiles, map.upperTiles, (map as unknown as Record<string, ArrayLike<number> | undefined>).upperOverlayTiles];
    const out: { x: number; y: number }[] = [];
    for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
      if (layers.some((l) => { const t = l?.[y * map.width + x]; return typeof t === "number" && t >= 0 && /문$/u.test(String(meta[t]?.label ?? "").replace(/\s*\([^)]*\)/gu, "").trim()); })) out.push({ x, y });
    }
    return out;
  }
  const triggerKinds = (ev: GameEvent) => [(ev.trigger as { kind?: string }).kind, ...(ev.pages ?? []).map((p) => (p.trigger as { kind?: string }).kind)];
  describe("the «cannot enter» line stands on declared building entrances only", () => {
    it("answers every building door cell a player can stand at, and leaves the gate posts alone", () => {
      const ctx = desert("palace");
      const map = ctx.project.maps.map_p!;
      // 이름표로 읽은 「문」은 이 맵에서 성문뿐이고, 건물 입구와 한 칸도 겹치지 않는다.
      const gatePosts = gatePostCells(ctx.project, map);
      const entrances = buildingEntrances(ctx.project, map);
      expect(gatePosts.length).toBeGreaterThan(0);
      expect(entrances.length).toBeGreaterThan(0);
      expect(gatePosts.some((g) => at(entrances, g))).toBe(false);
      lockBareHouseDoors({ ctx } as unknown as BuildRun, "map_p");
      const lines = locked(ctx.project, "map_p");
      const reach = reachableCells(ctx.project, map)!;
      const standable = entrances.filter((e) => reach[e.front.y * map.width + e.front.x]);
      expect(standable.length).toBeGreaterThan(0);
      expect(lines.length).toBe(standable.length);
      for (const d of lines) {
        expect(at(standable, d)).toBe(true);
        expect(at(gatePosts, d)).toBe(false);
        expect(isPassable(ctx.project, ctx.project.maps.map_p!, d.x, d.y)).toBe(false);
      }
      // 다시 돌려도 같다.
      expect(lockBareHouseDoors({ ctx } as unknown as BuildRun, "map_p")).toEqual([]);
      expect(locked(ctx.project, "map_p").length).toBe(lines.length);
    }, 60_000);

    it("answers the action key, not a bump — and turns the lines an earlier build made answer on touch", () => {
      // 출하 플레이어(scripts/qa/runtime/locked-entrance.scenario.mjs): 막힌 문 칸의 접촉 이벤트는 밀 때마다 대사창을 띄우고 조사 키에는 답하지 않는다.
      const ctx = desert("oasis");
      lockBareHouseDoors({ ctx } as unknown as BuildRun, "map_p");
      const lines = locked(ctx.project, "map_p");
      expect(lines.length).toBeGreaterThan(0);
      for (const d of lines) expect(new Set(triggerKinds(d))).toEqual(new Set(["action"]));
      const map = ctx.project.maps.map_p!;
      const touch = { kind: "playerTouch" } as const;
      ctx.project = { ...ctx.project, maps: { ...ctx.project.maps, map_p: { ...map, events: map.events.map((e) => e.id.startsWith("ev_locked_door_") ? { ...e, trigger: touch, pages: (e.pages ?? []).map((p) => ({ ...p, trigger: touch })) } as GameEvent : e) } } };
      const notes = lockBareHouseDoors({ ctx } as unknown as BuildRun, "map_p");
      expect(notes.join(" ")).toContain("조사 키");
      const again = locked(ctx.project, "map_p");
      expect(again.length).toBe(lines.length);
      for (const d of again) expect(new Set(triggerKinds(d))).toEqual(new Set(["action"]));
    }, 60_000);

    it("removes the ones an earlier build left on gate posts", () => {
      const ctx = desert("palace");
      const map = ctx.project.maps.map_p!;
      const post = gatePostCells(ctx.project, map)[0]!;
      const stray = { id: `ev_locked_door_${post.x}_${post.y}`, name: "굳게 닫힌 집 문", x: post.x, y: post.y, trigger: { kind: "playerTouch" }, commands: [], pages: [] } as unknown as GameEvent;
      ctx.project = { ...ctx.project, maps: { ...ctx.project.maps, map_p: { ...map, events: [...map.events, stray] } } };
      const notes = lockBareHouseDoors({ ctx } as unknown as BuildRun, "map_p");
      expect(notes.join(" ")).toContain(`(${post.x},${post.y})`);
      expect(locked(ctx.project, "map_p").some((e) => e.x === post.x && e.y === post.y)).toBe(false);
    }, 60_000);

    it("skips a door that leads somewhere — and takes its line away once it does —, a map laid as a room, and names no theme", () => {
      const ctx = desert("oasis");
      expect(lockBareHouseDoors({ ctx } as unknown as BuildRun, "map_p", "room")).toEqual([]);
      expect(locked(ctx.project, "map_p")).toEqual([]);
      lockBareHouseDoors({ ctx } as unknown as BuildRun, "map_p", "outdoor");
      const first = locked(ctx.project, "map_p")[0]!;
      // 그 맵이 무엇인지 이 단계는 모른다 — 「집」「동굴」 같은 말을 쓰지 않는다.
      expect(JSON.stringify(locked(ctx.project, "map_p"))).not.toMatch(/집|동굴|잠겨|house|cave/u);
      // 그 문 앞에 이동 칸이 생기면(이제 들어갈 수 있다) 한 줄을 걷어 낸다 — 조사 키가 «들어갈 수 없다»고 답하면 안 된다.
      const map = ctx.project.maps.map_p!;
      const transfer = { id: "ev_in", name: "안으로", x: first.x, y: first.y + 1, trigger: { kind: "playerTouch" }, commands: [], pages: [{ id: "ev_in_p0", conditions: [], trigger: { kind: "playerTouch" }, commands: [{ kind: "transfer", mapId: "map_p", x: 1, y: 1 }] }] } as unknown as GameEvent;
      ctx.project = { ...ctx.project, maps: { ...ctx.project.maps, map_p: { ...map, events: [...map.events, transfer] } } };
      const notes = lockBareHouseDoors({ ctx } as unknown as BuildRun, "map_p", "outdoor");
      expect(notes.join(" ")).toContain(`(${first.x},${first.y})`);
      expect(locked(ctx.project, "map_p").some((d) => d.x === first.x && d.y === first.y)).toBe(false);
      expect(locked(ctx.project, "map_p").length).toBeGreaterThan(0);
    }, 60_000);

    it("leaves a line somebody rewrote alone — a door that opens with a key stays as written", () => {
      const ctx = desert("oasis");
      lockBareHouseDoors({ ctx } as unknown as BuildRun, "map_p");
      const map = ctx.project.maps.map_p!;
      const first = locked(ctx.project, "map_p")[0]!;
      const keyed = { ...first, trigger: { kind: "playerTouch" }, pages: [{ ...first.pages![0]!, trigger: { kind: "playerTouch" }, commands: [{ kind: "fork", condition: { kind: "item", itemId: "item_old_key", present: true }, then: [{ kind: "text", body: "문이 열렸다." }], else: [{ kind: "text", body: "잠겨 있다." }] }] }] } as unknown as GameEvent;
      ctx.project = { ...ctx.project, maps: { ...ctx.project.maps, map_p: { ...map, events: map.events.map((e) => e.id === first.id ? keyed : e) } } };
      expect(lockBareHouseDoors({ ctx } as unknown as BuildRun, "map_p")).toEqual([]);
      expect(ctx.project.maps.map_p!.events.find((e) => e.id === first.id)).toEqual(keyed);
    }, 60_000);

    it("still answers the doors of Beodeul village houses nobody can enter", () => {
      const ctx = { project: createBlankProject() };
      const run = { ctx, calls: [], call: (tool: string, args: Record<string, unknown>) => runTool(ctx, tool, args) } as unknown as BuildRun;
      const built = VILLAGE_BUILDER.build(run, { type: "village", name: "시험", theme: "plain" });
      expect(built.ok, built.summary).toBe(true);
      const mapId = built.mapIds[0]!;
      const map = ctx.project.maps[mapId]!;
      ctx.project = { ...ctx.project, maps: { ...ctx.project.maps, [mapId]: { ...map, events: map.events.filter((e) => !e.id.startsWith("ev_locked_door_")) } } };
      lockBareHouseDoors({ ctx } as unknown as BuildRun, mapId);
      const doors = locked(ctx.project, mapId);
      expect(doors.length).toBeGreaterThan(0);
      const entrances = buildingEntrances(ctx.project, ctx.project.maps[mapId]!);
      for (const d of doors) expect(at(entrances, d)).toBe(true);
    }, 90_000);
  });
});

describe("aiV2GateOpensNothing", () => {
  isolateTimers();
  // 판정 J1(약초 동굴): 다리 레버가 칸을 열지만 다리 없이도 보스 방까지 걸어갔다.
  // 7×3 방, x=3 은 벽 기둥. 레버가 (3,1) 을 바닥으로 바꾼다. 벽에 다른 틈이 있으면 레버는 아무것도 안 연다.
  function corridor(extraGap: boolean): Project {
    const project = createBlankProject() as Project;
    const map = project.maps[project.startMapId]!;
    const open = { up: true, down: true, left: true, right: true };
    const shut = { up: false, down: false, left: false, right: false };
    const tilesetId = "ts_gate_probe";
    project.tilesets[tilesetId] = { ...structuredClone(Object.values(project.tilesets)[0]!), id: tilesetId, passability: [open, shut], passageMarks: undefined } as never;
    const W = 7, H = 3;
    Object.assign(map, { width: W, height: H, tilesetId, lowerTiles: Array(W * H).fill(0), upperTiles: Array(W * H).fill(-1), events: [] });
    for (let y = 0; y < H; y += 1) map.lowerTiles[y * W + 3] = 1;
    if (extraGap) map.lowerTiles[2 * W + 3] = 0;
    delete (map as { layers?: unknown }).layers;
    project.startPos = { x: 0, y: 1 };
    map.events.push({
      id: "ev_lever", name: "다리 레버", x: 1, y: 0,
      pages: [{ conditions: [], trigger: { kind: "action" }, commands: [{ kind: "changeTile", mapId: map.id, layer: "lower", x: 3, y: 1, tile: 0 }, { kind: "setSwitch", switchId: "sw_bridge", value: true }] }],
    } as never);
    return project;
  }
  describe("gatesThatOpenNothing (J1 lever that gates nothing)", () => {
    it("passes a lever whose tile change is the only way across", () => {
      expect(gatesThatOpenNothing(corridor(false))).toEqual([]);
    });
    it("flags a lever when the far side is already reachable through another gap", () => {
      const problems = gatesThatOpenNothing(corridor(true));
      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain("다리 레버");
    });
  });
});

// 실내 공간 검사는 짓기를 막지 않는다 — 2026-11-11 map-vqa 깔기 24판: 실내 요청 10가지의 첫 make_place 거절이 모두 공간 검사였다
// («under-furnished … at least 0.18»). 손으로 지은 견본 방 87개의 59% 가 같은 문턱에 못 미친다(openwiki/assistant-v2.md 같은 날 절).
// 깔 수 있는 배치는 깔고, 성긴 방은 결과의 알림으로 남긴다. 깔개로 놓은 요청 물건은 놓인 것이다.
describe("aiV2InteriorSpaceAdvisory", () => {
  isolateTimers();
  const SLOW = 120_000;
  type Reply = { ok?: boolean; summary?: string; warnings?: string[]; mapIds?: string[] };
  /** 그 판에서 «under-furnished» 로 거절된 첫 호출 그대로(창고 45칸에 선 물건 3개 = 칸당 0.07). */
  const WEAPON_SHOP = {"type": "interior", "name": "무기 가게", "mapId": "", "layout": {"map": {"w": 17, "h": 16}, "landmark": {"id": "counter 3x1", "x": 7, "y": 9, "repeat": {"count": 1, "dx": 0, "dy": 0}, "purpose": "계산대", "wall": ""}, "outer_wall": {"material": "stone", "path": [[0, 0], [16, 0], [16, 15], [0, 15], [0, 0]]}, "walls": [{"id": "back", "material": "stone", "thickness": 1, "stub": false, "path": [[0, 6], [16, 6]], "purpose": "판매실과 창고 구분"}], "doors": [{"wall": "back", "x": 12, "y": 6, "width": 1, "piece": "", "purpose": "창고 출입"}], "rooms": [{"id": "storage", "at": [3, 4], "floor": "boards", "purpose": "무기 재고 창고", "role": "side", "landmark": "sword rack", "stairs": "none", "repeat": false, "jo": 0}, {"id": "shop", "at": [3, 11], "floor": "plank", "purpose": "무기 판매와 진열", "role": "main", "landmark": "counter 3x1", "stairs": "none", "repeat": false, "jo": 0}], "wall_items": [{"id": "sword rack", "x": 2, "y": 3, "repeat": {"count": 1, "dx": 0, "dy": 0}, "purpose": "재고 검", "wall": "outer"}, {"id": "weapon rack", "x": 5, "y": 1, "repeat": {"count": 1, "dx": 0, "dy": 0}, "purpose": "무기 보관", "wall": "outer"}, {"id": "shield", "x": 8, "y": 1, "repeat": {"count": 1, "dx": 0, "dy": 0}, "purpose": "방패 보관", "wall": "outer"}, {"id": "weapon rack", "x": 2, "y": 7, "repeat": {"count": 1, "dx": 0, "dy": 0}, "purpose": "무기 진열", "wall": "back"}, {"id": "shield rack", "x": 5, "y": 7, "repeat": {"count": 1, "dx": 0, "dy": 0}, "purpose": "방패 진열", "wall": "back"}], "rails": [], "regions": [], "openings": [], "entrance": {"x": 8, "y": 15}, "carpets": [], "daises": [], "floor_zones": [], "objects": [{"id": "weapon crate", "x": 4, "y": 4, "repeat": {"count": 1, "dx": 0, "dy": 0}, "purpose": "재고 상자"}, {"id": "barrel", "x": 7, "y": 4, "repeat": {"count": 1, "dx": 0, "dy": 0}, "purpose": "창고 통"}, {"id": "display 2x1", "x": 2, "y": 10, "repeat": {"count": 1, "dx": 0, "dy": 0}, "purpose": "무기 진열대"}, {"id": "armor stand", "x": 14, "y": 10, "repeat": {"count": 1, "dx": 0, "dy": 0}, "purpose": "갑옷 진열"}, {"id": "weapon barrel", "x": 2, "y": 13, "repeat": {"count": 1, "dx": 0, "dy": 0}, "purpose": "무기 진열"}, {"id": "display 2x1", "x": 12, "y": 12, "repeat": {"count": 1, "dx": 0, "dy": 0}, "purpose": "상품 진열대"}], "required": [{"ask": "계산대", "ids": ["counter 3x1"], "missing": ""}, {"ask": "진열대", "ids": ["display 2x1"], "missing": ""}]}};
  /** 깔개(rug red)를 carpets 로 깔고 required 에 적은 알현실 — «붉은 융단이 놓이지 않았다» 와 0.14 < 0.18 로 거절됐다. */
  const THRONE_ROOM = {"type": "interior", "name": "알현실", "mapId": "", "layout": {"map": {"w": 13, "h": 11}, "landmark": {"id": "throne", "x": 5, "y": 3, "repeat": {"count": 1, "dx": 0, "dy": 0}, "purpose": "붉은 융단 끝 왕좌", "wall": ""}, "outer_wall": {"material": "marblewall", "path": [[0, 0], [12, 0], [12, 10], [0, 10], [0, 0]]}, "walls": [], "doors": [], "rooms": [{"id": "hall", "at": [6, 7], "floor": "marble", "purpose": "왕의 알현실", "role": "main", "landmark": "throne", "stairs": "none", "repeat": false, "jo": 0}], "wall_items": [{"id": "banner red", "x": 3, "y": 1, "repeat": {"count": 1, "dx": 0, "dy": 0}, "purpose": "왕실 깃발", "wall": "outer"}, {"id": "banner red", "x": 9, "y": 1, "repeat": {"count": 1, "dx": 0, "dy": 0}, "purpose": "왕실 깃발", "wall": "outer"}], "rails": [], "regions": [], "openings": [], "entrance": {"x": 6, "y": 10}, "carpets": [{"id": "rug red", "x": 5, "y": 5, "w": 3, "h": 5}], "daises": [], "floor_zones": [], "objects": [{"id": "brazier", "x": 3, "y": 3, "repeat": {"count": 1, "dx": 0, "dy": 0}, "purpose": "왕좌 화로"}, {"id": "brazier", "x": 9, "y": 3, "repeat": {"count": 1, "dx": 0, "dy": 0}, "purpose": "왕좌 화로"}, {"id": "column marble", "x": 3, "y": 6, "repeat": {"count": 1, "dx": 0, "dy": 0}, "purpose": "기둥"}, {"id": "column marble", "x": 9, "y": 6, "repeat": {"count": 1, "dx": 0, "dy": 0}, "purpose": "기둥"}, {"id": "statue", "x": 1, "y": 4, "repeat": {"count": 1, "dx": 0, "dy": 0}, "purpose": "조각상"}, {"id": "statue", "x": 11, "y": 4, "repeat": {"count": 1, "dx": 0, "dy": 0}, "purpose": "조각상"}, {"id": "tall vase red", "x": 1, "y": 8, "repeat": {"count": 1, "dx": 0, "dy": 0}, "purpose": "장식"}, {"id": "tall vase red", "x": 11, "y": 8, "repeat": {"count": 1, "dx": 0, "dy": 0}, "purpose": "장식"}, {"id": "royal chest", "x": 2, "y": 7, "repeat": {"count": 1, "dx": 0, "dy": 0}, "purpose": "왕실 상자"}, {"id": "royal chest", "x": 10, "y": 7, "repeat": {"count": 1, "dx": 0, "dy": 0}, "purpose": "왕실 상자"}], "required": [{"ask": "왕좌", "ids": ["throne"], "missing": ""}, {"ask": "붉은 융단", "ids": ["rug red"], "missing": ""}]}};
  function turn(task: string) {
    const project = createBlankProject();
    const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
    const env = { ctx, request: { task, provider: "local-cli:claude", mapIds: [], project } as never, emit: () => {}, record: () => {}, sideChat: async () => JSON.stringify({ score: 7, majors: [] }), checkpoint: async () => {} } as unknown as PiAssistantV2Env;
    const tools = createV2Tools(env, new V2Session());
    const call = async (name: string, args: unknown): Promise<Reply> => {
      const res = await tools.find((t) => t.name === name)!.execute(`c-${name}`, args);
      return JSON.parse((res.content as { type: string; text?: string }[]).find((c) => c.type === "text")!.text!) as Reply;
    };
    return { ctx, call };
  }
  describe("실내 공간 검사 — 알리되 막지 않는다", () => {
    it("성긴 창고가 있는 무기 가게 배치는 깔리고, 성긴 방은 방 크기에 맞는 문턱과 함께 알림으로 남는다", async () => {
      const t = turn("무기 가게 실내 맵을 만들어 줘. 계산대와 진열대가 있어야 해.");
      const made = await t.call("make_place", WEAPON_SHOP);
      expect(made.ok, made.summary).toBe(true);
      expect(made.summary).toContain("laid your layout exactly");
      const map = t.ctx.project.maps[made.mapIds![0]!]!;
      expect([map.width, map.height]).toEqual([17, 16]);
      const open = (made.warnings ?? []).filter((w) => w.startsWith("open (the room is laid"));
      expect(open.some((w) => w.includes('room "storage" is under-furnished') && w.includes("at least 0.12"))).toBe(true);
      expect(open.some((w) => w.includes('room "shop" is under-furnished') && w.includes("at least 0.08"))).toBe(true);
      expect(JSON.stringify(made.warnings)).not.toContain("0.18");
    }, SLOW);

    it("깔개로 깐 «붉은 융단» 은 요청한 물건으로 센다 — 알현실이 한 번에 깔린다", async () => {
      const t = turn("왕의 알현실을 만들어 줘. 붉은 융단 끝에 왕좌가 있어야 해.");
      const made = await t.call("make_place", THRONE_ROOM);
      expect(made.ok, made.summary).toBe(true);
      expect(JSON.stringify(made)).not.toContain("but they are not placed");
    }, SLOW);
  });
});

// 다시 지은 장소가 옛 맵 id 를 지킨다(src/ai/v2/place/keepMapId.ts).
// 왜(2026-11-11 lay-tools 농장·항구): 마을 빌더가 집 보호를 피해 `<id>_r2` 로 다시 짓고 옛 맵을 지워, 할 일 묶음이 없는 맵을 가리키고 검수자가 «시작 맵이 지워졌다» 로 읽었다.
describe("aiV2KeepMapId", () => {
  isolateTimers();
  /** 옛 맵을 지우고 `<id>_r2` 로 다시 지은 뒤의 프로젝트 — 시작 맵과 다른 맵의 이동 명령이 새 id 를 가리킨다. */
  function relaidProject(): { project: Project; from: string; to: string } {
    const base = createBlankProject();
    const to = base.startMapId, from = `${to}_r2`;
    const village = { ...base.maps[to]!, id: from, name: "농장" };
    const other = { ...base.maps[to]!, id: "map_other", name: "들판", events: [{ id: "ev_door", name: "문", x: 1, y: 1, pages: [{ commands: [{ kind: "transfer", mapId: from, x: 3, y: 4 }] }] }] };
    const project = { ...base, startMapId: from, maps: { [from]: village, map_other: other } } as unknown as Project;
    return { project, from, to };
  }
  const result = (from: string, to: string): PlaceBuildResult => ({
    ok: true, mapIds: [from], entrance: { mapId: from, x: 3, y: 4 }, summary: "농장", missingArt: [], calls: [], relaidFrom: to,
    warnings: [`완성된 집 보호로 「${to}」 맵을 덮어 지을 수 없어 새 맵 ${from} 로 다시 짓고 옛 맵을 지웠다 — 이 마을의 mapId 는 이제 ${from} 다.`, "집 3채"],
  });
  const envOf = (project: Project, checkpoint: (label: string) => Promise<void>) => {
    const env = { ctx: { project }, checkpoint } as unknown as PiAssistantV2Env;
    return env;
  };
  describe("renameIdIn · renameMapId", () => {
    it("바뀐 것이 없는 가지는 같은 객체를 돌려준다", () => {
      const leaf = { a: [1, 2, 3], b: "x" };
      const tree = { keep: leaf, hit: { id: "old" } };
      const out = renameIdIn(tree, "old", "new");
      expect(out.keep).toBe(leaf);
      expect(out.hit).toEqual({ id: "new" });
      expect(renameIdIn(leaf, "old", "new")).toBe(leaf);
    });
    it("맵 사전의 키 · 맵 id · 시작 맵 · 다른 맵의 이동 명령을 같이 바꾸고, 타일셋·자산은 그대로 가리킨다", () => {
      const { project, from, to } = relaidProject();
      const renamed = renameMapId(project, from, to)!;
      expect(Object.keys(renamed.maps)).toEqual([to, "map_other"]);
      expect(renamed.maps[to]!.id).toBe(to);
      expect(renamed.maps[to]!.name).toBe("농장");
      expect(renamed.startMapId).toBe(to);
      expect(JSON.stringify(renamed.maps.map_other)).toContain(`"mapId":"${to}"`);
      expect(JSON.stringify(renamed)).not.toContain(from);
      expect(renamed.tilesets).toBe(project.tilesets);
      expect(renamed.assets).toBe(project.assets);
      // 원본은 그대로다.
      expect(project.startMapId).toBe(from);
    });
    it("없는 맵이거나 그 id 를 다른 맵이 쓰면 바꾸지 않는다", () => {
      const { project, from } = relaidProject();
      expect(renameMapId(project, "map_none", "map_x")).toBeUndefined();
      expect(renameMapId(project, from, "map_other")).toBeUndefined();
      expect(renameMapId(project, from, from)).toBeUndefined();
    });
  });
  describe("keepRelaidMapId", () => {
    it("체크포인트가 받아들이면 옛 id 로 되돌리고, 결과·알림도 옛 id 를 말한다", async () => {
      const { project, from, to } = relaidProject();
      const labels: string[] = [];
      const env = envOf(project, async (label) => { labels.push(label); });
      const session = {};
      const built = result(from, to);
      const kept = await keepRelaidMapId(env, session, "edit_place", built);
      expect(labels).toEqual(["edit_place-keep-id"]);
      expect(Object.keys(env.ctx.project.maps)).toContain(to);
      expect(env.ctx.project.maps[from]).toBeUndefined();
      expect(env.ctx.project.startMapId).toBe(to);
      expect(kept.mapIds).toEqual([to]);
      expect(kept.entrance).toEqual({ mapId: to, x: 3, y: 4 });
      expect(kept.relaidFrom).toBeUndefined();
      expect(kept.warnings).toEqual(["집 3채", `Re-laid in place: the map id is still ${to}.`]);
      // 짓기 결과를 따로 든 부르는 쪽도 끝난 뒤의 id 를 읽는다.
      expect(keptMapId(session, from)).toBe(to);
      expect(keptPlaceResult(session, built).mapIds).toEqual([to]);
    });
    it("편집기가 거절하면(워커가 그 변경을 되돌린다) 새 id 그대로 간다", async () => {
      const { project, from, to } = relaidProject();
      const env = envOf(project, async () => { env.ctx.project = project; throw new Error("적용 실패(commit-rejected): 완성된 집"); });
      const session = {};
      const built = result(from, to);
      const kept = await keepRelaidMapId(env, session, "edit_place", built);
      expect(kept).toBe(built);
      expect(env.ctx.project.maps[from]).toBeDefined();
      expect(env.ctx.project.startMapId).toBe(from);
      expect(keptMapId(session, from)).toBe(from);
    });
    it("다시 지은 표시가 없거나 실패한 결과는 건드리지 않는다 — 체크포인트도 부르지 않는다", async () => {
      const { project, from, to } = relaidProject();
      let calls = 0;
      const env = envOf(project, async () => { calls++; });
      const plain: PlaceBuildResult = { ok: true, mapIds: [from], summary: "", warnings: [], missingArt: [], calls: [] };
      expect(await keepRelaidMapId(env, {}, "make_place", plain)).toBe(plain);
      const failed = { ...result(from, to), ok: false };
      expect(await keepRelaidMapId(env, {}, "make_place", failed)).toBe(failed);
      expect(calls).toBe(0);
      expect(env.ctx.project).toBe(project);
    });
  });
});

// 이름표는 낱말로 맞춘다(있는 물건 찾기 = 온전한 낱말 · 새로 깔 그림 = 물건 이름의 끝 낱말) · 그림이 없어 못 한 것은 적는다.
// 2026-11-11 단계×테마 표: 「책상 서랍의 쪽지」 밑에 설원 「목책」 말뚝이 깔렸고(책 ⊂ 책상, 책 ⊂ 목책), 「술통 받침대」가 은신처가 됐다(침대 ⊂ 받침대).
// 봉인 제단·굴 입구는 버들항 조각뿐이라 다른 칩셋에서는 단계가 말없이 지나갔다.
describe("aiV2LabelWordsAndArtGaps", () => {
  isolateTimers();
  type Ctx = { project: Project };
  const runOf = (ctx: Ctx): BuildRun => ({ ctx, calls: [], call: (tool: string, args: Record<string, unknown>) => runTool(ctx, tool, args) }) as unknown as BuildRun;
  const addEvents = (ctx: Ctx, mapId: string, ...events: GameEvent[]) => {
    const map = ctx.project.maps[mapId]!;
    ctx.project = { ...ctx.project, maps: { ...ctx.project.maps, [mapId]: { ...map, events: [...map.events, ...events] } } };
  };
  const transferTo = (id: string, x: number, y: number, mapId: string): GameEvent => ({
    id, name: "", x, y, trigger: { kind: "playerTouch" }, commands: [],
    pages: [{ id: `${id}_p0`, name: "", conditions: [], graphic: { transparent: true }, trigger: { kind: "playerTouch" }, priority: "below", overlapForbidden: false, movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [{ kind: "transfer", mapId, x: 2, y: 2, direction: "down" }] }],
  }) as unknown as GameEvent;
  /** 단계가 받는 것 가운데 이 시험이 쓰는 것만 — 없는 그림 기록은 세션의 보고 줄에 남는다(project/artGap.ts). */
  function stageCtx(ctx: Ctx) {
    const session = { missingArt: new Set<string>() };
    const finish = { env: { ctx, emit: () => undefined }, session, notes: [] as string[] } as unknown as FinishCtx;
    return { finish, session, gaps: () => artGapsIn(session.missingArt) };
  }
  describe("a label is matched by the thing it names", () => {
    it("a label is the thing its name ends with — not a word inside a longer word, nor a word in its description", () => {
      expect(labelNames("목책(통나무 말뚝 울타리)", "책")).toBe(false);
      expect(labelNames("가게 장부 책상", "책")).toBe(false);
      expect(labelNames("술통 받침대", "침대")).toBe(false);
      expect(labelNames("bedside table", "bed")).toBe(false);
      // 괄호 속 설명·꾸미는 말에 든 낱말은 그 물건이 아니다.
      expect(labelNames("안돈(종이 등잔) 0,0", "종이")).toBe(false);
      expect(labelNames("낮은 서류 캐비닛 0,0", "서류")).toBe(false);
      expect(labelNames("헛간부엉이 편지 비행", "편지")).toBe(false);
      expect(labelNames("침대 옆 협탁", "침대")).toBe(false);
      expect(labelNames("책 더미(탁상)", "책 더미")).toBe(true);
      expect(labelNames("탁상 물건 · 책 더미", "책 더미")).toBe(true);
      expect(labelNames("침대(머리맡 왼쪽)", "침대")).toBe(true);
      expect(labelNames("나무 상자 (0,0)", "상자")).toBe(true);
      expect(labelNames("버들항 · 책장 A (0,0)", "책장")).toBe(true);
      expect(labelNames("책장 0,1", "책장")).toBe(true);
      expect(labelNames("가게 장부 책상", "책상")).toBe(true);
      expect(labelNames("wooden bed", "bed")).toBe(true);
      // 영어 이름표는 물건 뒤에 설명이 붙는다.
      expect(labelNames("wooden ship bunk bed with pillow at the north end and a fold", "bed")).toBe(true);
      expect(labelNames("captain's large wooden bed seen from above at 3/4: carved headboard", "bed")).toBe(true);
      expect(labelNames("bedside table with a lamp", "bed")).toBe(false);
      expect(labelNames("pile of books", "book")).toBe(false);
    });

    it("finds a thing already on the map by a whole word anywhere in its label — the variant often follows the noun", () => {
      // 버들항 손 도트 실내의 이름표: 갈래가 뒤에 붙는다. 끝 낱말만 보면 침대·화분·책장을 못 찾는다.
      expect(labelHasWord("침대 초록", "침대")).toBe(true);
      expect(labelHasWord("2인 침대 빨강", "침대")).toBe(true);
      expect(labelHasWord("화분 고사리", "화분")).toBe(true);
      expect(labelHasWord("책장 1w", "책장")).toBe(true);
      expect(labelHasWord("벽난로 불(6프레임) · 1/6프레임", "벽난로")).toBe(true);
      expect(labelHasWord("탁상 물건 · 책 더미", "책 더미")).toBe(true);
      // 긴 낱말 속 글자·괄호 속 재료와 부품은 그 물건이 아니다.
      expect(labelHasWord("목책(통나무 말뚝 울타리)", "책")).toBe(false);
      expect(labelHasWord("술통 받침대", "침대")).toBe(false);
      expect(labelHasWord("선반 기계(무쇠 침대 + 주축대 + 심압대)", "침대")).toBe(false);
      expect(labelHasWord("안돈(종이 등잔) 0,0", "종이")).toBe(false);
      expect(labelHasWord("bedside table", "bed")).toBe(false);
      expect(labelHasWord("책 받침 더미", "책 더미")).toBe(false);
      // 새로 깔 그림은 더 엄하다 — 낱말이 있어도 그 물건의 이름이 아니면 깔지 않는다.
      expect(labelHasWord("낮은 서류 캐비닛 0,0", "서류")).toBe(true);
      expect(labelNames("낮은 서류 캐비닛 0,0", "서류")).toBe(false);
    });

    it("hiding furniture is furniture, not a word that contains one", () => {
      for (const label of ["술통 받침대", "선반 기계(무쇠 침대 + 주축대 + 심압대)", "세운 실린더 증기 기관(받침대 + 뚜껑)", "커튼월 유리", "침대 옆 협탁", "커튼 창"]) expect(hideRankForLabel(label), label).toBeNull();
      // 「X 곁·앞·밑 Y」 는 Y 다 — 침대 곁 탁자는 탁자, 사물함 앞 긴 의자는 의자.
      for (const label of ["침대 곁 탁자", "사물함 앞 긴 의자(나무 판 + 쇠 다리)", "책상 밑 사이드 왜건"]) expect(hideRankForLabel(label), label).toBeNull();
      // 「+」「·」로 이은 물건은 따로 본다 · 괄호 속 부품으로 가구를 버리지 않는다.
      expect(hideRankForLabel("기숙사 책상 + 위 선반(스탠드·책)")).toBe(2);
      expect(hideRankForLabel("개인 사물함(윗면 + 환기 틈 문 + 손잡이 + 이름 램프)")).toBe(0);
      expect(hideRankForLabel("침대 초록")).toBe(1);
      expect(hideRankForLabel("2인 침대 빨강")).toBe(1);
      expect(hideRankForLabel("옷장")).toBe(0);
      expect(hideRankForLabel("철제 캐비닛")).toBe(0);
      expect(hideRankForLabel("병원 침대")).toBe(1);
      expect(hideRankForLabel("두꺼운 커튼")).toBe(2);
      expect(hideRankForLabel("wooden ship bunk bed with pillow at the north end and a fold")).toBe(1);
    });

    it("reads the thing an event name is about: the longest word wins, the last small thing is the thing", () => {
      // 「책상」 안의 「책」은 책이 아니다 — 이 이름은 쪽지다.
      expect(itemTileWords("책상 서랍의 쪽지")).toEqual(["서류", "종이", "편지", "책 더미"]);
      expect(hostWords("책상 서랍의 쪽지")[0]).toEqual(["책상", "desk"]);
      // 이름과 이름표가 같은 겹낱말을 쓰면 그대로 맞는다.
      expect(hostWords("낡은 보물상자")[0]?.[0]).toBe("보물상자");
      expect(itemTileWords("침대 밑 상자")[0]).toBe("상자");
      expect(itemTileWords("잠든 장치")).toEqual([]);
    });

    it("lays no palisade for a book on the snow chipset, no paper lantern for a note on the Edo one", () => {
      const ctx = { project: createBlankProject() };
      expect(runTool(ctx, "create_map", { id: "map_s", name: "설원", width: 48, height: 36, tilesetId: "snow_north" }).ok).toBe(true);
      expect(runTool(ctx, "create_map", { id: "map_e", name: "에도", width: 48, height: 36, tilesetId: "sengoku_edo" }).ok).toBe(true);
      // 에도 칩셋에서는 같은 이름 밑에 「안돈(종이 등잔)」 이 깔렸다 — 종이는 그 등잔의 재료다.
      expect(singleTileObject(ctx.project, ctx.project.maps.map_e!, itemTileWords("책상 서랍의 쪽지"))?.label ?? "").not.toContain("안돈");
      const map = ctx.project.maps.map_s!;
      for (const name of ["책상 서랍의 쪽지", "낡은 기록", "목책 옆 쪽지"]) {
        const words = itemTileWords(name);
        const art = singleTileObject(ctx.project, map, words);
        // 없으면 깔지 않는다. 있으면 그 낱말이 이름표에 온전히 있어야 한다.
        if (art) expect(words.some((w) => labelNames(art.label, w)), `${name} → ${art.label}`).toBe(true);
        expect(art?.label ?? "").not.toContain("목책");
      }
    });
  });
  describe("a stage with no art for this chipset says so", () => {
    const gap: ArtGap = { chipset: "desert_east", want: "altar-seal", wanted: "봉인·제단 그림", where: "사막 7,9", standIn: "none", by: "seal-step-art", note: "「고대의 봉인」" };

    it("writes one record per spot, however often the stage runs", () => {
      const { session, gaps } = stageCtx({ project: createBlankProject() });
      recordArtGaps(session, [gap]);
      recordArtGaps(session, [gap]);
      expect(gaps()).toEqual([gap]);
    });

    it("chaser-hiding: a chaser's map with nothing to hide in", () => {
      const ctx = { project: createBlankProject() };
      expect(runTool(ctx, "create_map", { id: "map_d", name: "사막 방", width: 20, height: 15, tilesetId: "desert_east" }).ok).toBe(true);
      addEvents(ctx, "map_d", { id: "ev_chaser", name: "쫓는 그림자", x: 5, y: 5, trigger: { kind: "eventTouch" }, commands: [], pages: [{ id: "ev_chaser_p0", conditions: [], trigger: { kind: "eventTouch" }, movement: { type: "chase", speed: 3, frequency: 3 }, commands: [{ kind: "gameOver" }] }] } as unknown as GameEvent);
      const { finish, gaps } = stageCtx(ctx);
      chaserHiding.run(finish, "");
      chaserHiding.run(finish, "");
      expect(ctx.project.maps.map_d!.events.some((e) => e.id.startsWith("ev_hide_"))).toBe(false);
      expect(gaps()).toMatchObject([{ chipset: "desert_east", want: "hiding-furniture", wanted: "숨을 가구", where: "사막 방 5,5", standIn: "none", by: "chaser-hiding" }]);
    });

    it("chaser-hiding: when the chipset has beds but none is laid on this map, that is not missing art", () => {
      const ctx = { project: createBlankProject() };
      expect(tilesetHasHidingFurniture(ctx.project, "snow_north")).toBe(true);
      expect(tilesetHasHidingFurniture(ctx.project, "desert_east")).toBe(false);
      expect(runTool(ctx, "create_map", { id: "map_s", name: "설원 방", width: 20, height: 15, tilesetId: "snow_north" }).ok).toBe(true);
      addEvents(ctx, "map_s", { id: "ev_chaser", name: "쫓는 그림자", x: 5, y: 5, trigger: { kind: "eventTouch" }, commands: [], pages: [{ id: "ev_chaser_p0", conditions: [], trigger: { kind: "eventTouch" }, movement: { type: "chase", speed: 3, frequency: 3 }, commands: [{ kind: "gameOver" }] }] } as unknown as GameEvent);
      const { finish, session } = stageCtx(ctx);
      chaserHiding.run(finish, "");
      // 없는 그림 장부에는 안 적는다 — 출하 검사(chaserMapsWithoutHiding)가 조수에게 돌려준다. 단계의 메모에는 남는다.
      expect(session.missingArt.size).toBe(0);
      expect((finish.notes as string[]).some((n) => n.includes("은신처 0곳"))).toBe(true);
    });

    it("cave-gates: a bare dungeon entrance on a chipset the cave-mouth piece was not drawn for", () => {
      const ctx = { project: createBlankProject() };
      expect(runTool(ctx, "create_map", { id: "map_d", name: "사막", width: 30, height: 24, tilesetId: "desert_east" }).ok).toBe(true);
      expect(runTool(ctx, "create_map", { id: "map_c", name: "모래 굴", width: 20, height: 15, tilesetId: "desert_east" }).ok).toBe(true);
      ctx.project = { ...ctx.project, maps: { ...ctx.project.maps, map_c: { ...ctx.project.maps.map_c!, mapRole: "dungeon" } as GameMap } };
      addEvents(ctx, "map_d", transferTo("ev_cave", 12, 10, "map_c"));
      const before = JSON.stringify(ctx.project.maps.map_d);
      const gaps: ArtGap[] = [];
      expect(dressBareCaveGates(runOf(ctx), "map_d", gaps)).toEqual([]);
      expect(gaps).toMatchObject([{ chipset: "desert_east", want: "cave-mouth", wanted: "굴 입구 그림", where: "사막 12,10", standIn: "none", by: "cave-gates" }]);
      expect(JSON.stringify(ctx.project.maps.map_d)).toBe(before);
    });

    it("door-floor-transfers: a room whose chipset declares no door to seat the transfer on", () => {
      const ctx = { project: createBlankProject() };
      expect(runTool(ctx, "create_map", { id: "map_r", name: "찻집", width: 20, height: 15, tilesetId: "desert_east" }).ok).toBe(true);
      expect(runTool(ctx, "create_map", { id: "map_o", name: "거리", width: 20, height: 15, tilesetId: "desert_east" }).ok).toBe(true);
      addEvents(ctx, "map_r", transferTo("ev_out", 8, 7, "map_o"));
      const before = JSON.stringify(ctx.project.maps.map_r);
      const gaps: ArtGap[] = [];
      expect(doorFloorTransfers(runOf(ctx), "map_r", "room", gaps)).toEqual([]);
      expect(gaps).toMatchObject([{ chipset: "desert_east", want: "door-piece", wanted: "벽 문 그림", where: "찻집 8,7", standIn: "none", by: "door-floor-transfers" }]);
      expect(JSON.stringify(ctx.project.maps.map_r)).toBe(before);
      // 바깥으로 깔린 맵은 방 단계의 일이 아니다 — 적지도 않는다.
      const outdoorGaps: ArtGap[] = [];
      expect(doorFloorTransfers(runOf(ctx), "map_r", "outdoor", outdoorGaps)).toEqual([]);
      expect(outdoorGaps).toEqual([]);
    });
  });
});

// 칸 배치 실내 — 거절은 게임이 깨질 때만(2026-11-16 오너 «에셋을 자유롭게», r6 실모델 «갈매나루»).
// 남은 거절 사유를 하나씩 훑어 «게임이 깨지는 것»(바깥 벽이 열림 · 입구를 못 씀 · 방이 입구에서 닿지 않음 · 어디에도 가까운 것이 없는 낱말)만 남기고,
// 나머지(목록을 잘못 고른 기물 · 벽면에 안 닿은 벽 기물 · 표에 없는 깔개 · 문 하나의 흠 · 단·난간·바닥 구역 · 이름표 · 랜드마크 없음 · 끝이 안 닿은 칸막이 ·
// 문을 막은 기물 · 맞지 않는 고침 줄)는 고쳐 깔고 무엇을 고쳤는지 한 줄씩 알린다.
describe("aiV2LayFixNotRefuse", () => {
  isolateTimers();
  const ts = createBeodeulCityTileset();
  const ES = effectiveSpec(ts)!;
  const fresh = () => { const project = createBlankProject(); project.tilesets[ts.id] = createBeodeulCityTileset(); const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true }; return createBuildRun(ctx); };
  /** 두 방 집(가로 칸막이 + 문 하나) — 버들항 낱말만. */
  const house = (patch: Record<string, unknown> = {}) => ({ map: { w: 14, h: 14 }, landmark: { id: "barrel stack", x: 1, y: 11 },
    outer_wall: { material: "log", path: [[0, 0], [13, 0], [13, 13], [0, 13]] }, walls: [{ id: "mid", material: "log", path: [[0, 6], [13, 6]] }],
    doors: [{ wall: "mid", x: 6, y: 6 }], entrance: { x: 6, y: 13 },
    rooms: [{ id: "back", at: [3, 4], floor: "plank", purpose: "store" }, { id: "front", at: [3, 10], floor: "plank", purpose: "shop" }],
    wall_items: [{ id: "window", wall: "outer", x: 2, y: 1 }], objects: [{ id: "crate", x: 10, y: 10 }], ...patch });
  const lay = (layout: unknown) => buildFromLayout(fresh(), { type: "interior", name: "가게", layout, hints: { newMap: true } } as unknown as PlaceSpec, ES, ts.id, undefined);
  describe("칸 배치 실내 — 고쳐 깔고 알린다", () => {
    it.each([
      ["벽붙이를 objects 에 — wall_items 로 옮기고 가장 가까운 벽면 자리로", { objects: [{ id: "crate", x: 10, y: 10 }, { id: "stairs down", x: 4, y: 10 }] }, /^fixed — "stairs down" at \(4,10\) did not touch a wall face; laid at \(\d+,\d+\) on wall "mid"/u],
      ["바닥 기물을 wall_items 에 — objects 로", { wall_items: [{ id: "window", wall: "outer", x: 2, y: 1 }, { id: "crate", wall: "outer", x: 9, y: 4 }] }, /^fixed — "crate" at \(9,4\) is a floor piece: laid from objects instead of wall_items\.$/u],
      ["표에 사각 깔개가 없다 — 가장 가까운 깔개 기물을 그 사각형에", { carpets: [{ id: "rug red", x: 3, y: 9, w: 3, h: 2 }] }, /^swapped carpet "rug red" → "red rug" laid in its rect/u],
      ["모르는 벽의 문 — 그 문만 빼고", { doors: [{ wall: "mid", x: 6, y: 6 }, { wall: "nope", x: 3, y: 6 }] }, /^left out — door \(3,6\): unknown wall "nope"/u],
      ["문짝이 아닌 문짝 — 열린 문으로", { doors: [{ wall: "mid", x: 6, y: 6, piece: "crate" }] }, /^fixed — door \(6,6\): "crate" is not a door piece, laid as an open doorway/u],
      ["모르는 단", { daises: [{ id: "golden dais", x: 3, y: 9, w: 2, h: 2 }] }, /^left out — unknown dais id "golden dais"/u],
      ["모르는 난간", { rails: [{ id: "golden rail", path: [[2, 9], [5, 9]] }] }, /^left out — unknown rail id "golden rail"/u],
      ["바닥 없는 바닥 구역", { floor_zones: [{ floor: "plank", x: 0, y: 0, w: 1, h: 1 }] }, /^left out — floor_zone plank at \(0,0\) 1x1 covers no floor cell/u],
      ["벽 위의 방 이름표", { rooms: [{ id: "back", at: [3, 4], floor: "plank" }, { id: "front", at: [3, 10], floor: "plank" }, { id: "ghost", at: [0, 0], floor: "plank" }] }, /^left out — room label "ghost"/u],
      ["이름표 없는 방 — 이웃 바닥으로 방을 만든다", { rooms: [{ id: "front", at: [3, 10], floor: "plank" }] }, /^fixed — enclosed space \(1,1\)\.\.\(12,5\) \(60 cells\) had no room label; laid as room "space_\d+"/u],
      ["한 공간에 이름표 둘 — 한 방으로", { rooms: [{ id: "back", at: [3, 4], floor: "plank" }, { id: "front", at: [3, 10], floor: "plank" }, { id: "front2", at: [9, 10], floor: "plank" }] }, /^fixed — rooms "front" and "front2" are one connected space/u],
      ["끝이 안 닿은 칸막이 — 선 벽으로", { walls: [{ id: "mid", material: "log", path: [[0, 6], [13, 6]] }, { id: "stubby", material: "log", path: [[9, 7], [9, 10]] }] }, /^fixed — wall "stubby" end \(9,10\) does not touch another wall; laid as a freestanding wall/u],
      ["같은 벽 id 둘 · 두께 3", { walls: [{ id: "mid", material: "log", path: [[0, 6], [13, 6]], thickness: 3 }, { id: "mid", material: "log", path: [[9, 7], [9, 12]] }] }, /^fixed — wall id "mid" is used twice; the second is laid as "mid_\d+"/u],
    ] as const)("%s", (_name, patch, line) => {
      const r = lay(house(patch));
      expect(r.ok, r.summary).toBe(true);
      expect(r.summary).not.toMatch(/laid your layout exactly/u);
      expect(r.warnings.some((w) => line.test(w)), r.warnings.join("\n")).toBe(true);
    });

    it("랜드마크가 없어도 깐다 — 다음에 적으라고 알린다", () => {
      const r = lay(house({ landmark: undefined }));
      expect(r.ok, r.summary).toBe(true);
      expect(r.warnings.some((w) => w.startsWith("no landmark — "))).toBe(true);
    });

    it("translates a v5 partition leaf into the destination chipset and keeps both rooms", () => {
      const run = fresh();
      const v5 = effectiveSpec(run.ctx.project.tilesets.atlas_biome_interior)!;
      const layout = house({ doors: [{ wall: "mid", x: 6, y: 6, piece: "locked door" }] });
      const result = buildFromLayout(run, { type: "interior", name: "Warehouse", layout } as unknown as PlaceSpec, ES, ts.id, undefined, undefined, [v5]);

      expect(result.ok, result.summary).toBe(true);
      expect(result.warnings).toContainEqual(expect.stringMatching(/^swapped piece "locked door" → "door oak"/u));
      expect(run.ctx.project.maps[result.mapIds[0]!]!.locations?.filter((location) => location.tags?.includes("hand-layout-room"))).toHaveLength(2);
    });

    it("문을 막은 기물은 빼고 깔고(그 문이 다시 닿는다) 무엇을 뺐는지 적는다", () => {
      const r = lay(house({ objects: [{ id: "crate", x: 6, y: 9 }, { id: "crate", x: 5, y: 9 }, { id: "crate", x: 7, y: 9 }] }));
      expect(r.ok, r.summary).toBe(true);
      expect(r.summary).toMatch(/laid \d+ of your \d+ pieces — left out/u);
    });

    it("게임이 깨지는 것만 거절한다 — 방 사이 문이 없음 · 바깥 벽이 열림 · 입구가 바닥 줄에 없음", () => {
      for (const patch of [{ doors: [] }, { outer_wall: { material: "log", path: [[0, 0], [13, 0], [13, 13]] } }, { entrance: { x: 6, y: 5 } }]) {
        const r = lay(house(patch));
        expect(r.ok, JSON.stringify(patch)).toBe(false);
        expect(r.summary).toMatch(/^Rejected: the interior layout for "가게"/u);
      }
    });

    it("어디에도 가까운 것이 없는 낱말 하나는 거절하지 않는다 — 그 조각만 빼고 깔고 무엇을 뺐는지 적는다(2026-11-17 r8 «table:fish+fishr»)", () => {
      const r = lay(house({ objects: [{ id: "golden unicorn", x: 10, y: 10 }] }));
      expect(r.ok, r.summary).toBe(true);
      expect(r.summary).toMatch(/left out \(each with its reason in warnings\): "golden unicorn"/u);
    });

    it("r6 「대성당」 두 번째 거절(벽붙이 계단을 objects 에 · 표에 없는 사각 깔개)이 이제 거절 없이 깔리고, 계단은 가장 가까운 빈 벽면에 선다", () => {
      const cathedral = { map: { w: 24, h: 20 }, landmark: { id: "altar", x: 7, y: 4 }, outer_wall: { material: "stone", path: [[0, 0], [23, 0], [23, 19], [0, 19]] },
        walls: [{ id: "w_sac", material: "stone", thickness: 1, path: [[17, 0], [17, 19]] }], doors: [{ wall: "w_sac", x: 17, y: 16, piece: null }], entrance: { x: 8, y: 19 },
        rooms: [{ id: "nave", at: [8, 10], floor: "grey", role: "main" }, { id: "sacristy", at: [20, 10], floor: "plank", role: "side" }],
        wall_items: [{ id: "stained window", wall: "outer", x: 3, y: 1 }, { id: "organ", wall: "outer", x: 1, y: 3 }, { id: "scroll shelf", wall: "outer", x: 19, y: 3 }],
        objects: [{ id: "altar", x: 7, y: 4 }, { id: "pew", x: 2, y: 9, repeat: { count: 4, dx: 0, dy: 2 } }, { id: "stairs down", x: 19, y: 6 }, { id: "writing desk", x: 19, y: 10 }],
        carpets: [{ id: "rug red", x: 7, y: 7, w: 3, h: 11 }] };
      const r = lay(cathedral);
      expect(r.ok, r.summary).toBe(true);
      expect(r.warnings).toContain('fixed — "stairs down" at (19,6) is a wall piece: laid from wall_items instead of objects.');
      expect(r.warnings.some((w) => /^fixed — "stairs down" at \(19,6\) did not touch a wall face; laid at \(\d+,\d+\) on wall "(outer|w_sac)"/u.test(w))).toBe(true);
      expect(r.warnings.some((w) => w.startsWith('swapped carpet "rug red" → "red rug'))).toBe(true);
    });
  });
});

describe("aiV2MapMusicChecks", () => {
  isolateTimers();
  const WHOLE = "용사가 마왕을 잡으러 가는 짧은 RPG 만들어줘";
  /** 이벤트가 있는 지은 맵 n장을 만든다 — bgms[i] 가 있으면 그 곡을 건다(없으면 상속·기본). */
  function mapsProject(n: number, bgms: (string | undefined)[] = []): Project {
    const p = createBlankProject() as Project;
    const start = p.maps[p.startMapId]!;
    const ev = structuredClone(start.events[0] ?? ({ id: "ev", name: "사람", x: 3, y: 3, pages: [{ conditions: [], trigger: { kind: "action" }, commands: [] }] } as never));
    for (let i = 0; i < n; i += 1) {
      const id = `map_story_${i}`;
      const map = structuredClone(start);
      map.id = id; map.name = `이야기 맵 ${i}`;
      map.events = [{ ...structuredClone(ev), id: `ev_${i}`, name: `일 ${i}` } as never];
      if (bgms[i]) map.bgm = { mode: "custom", resourceId: bgms[i]! } as never;
      p.maps[id] = map;
    }
    return p;
  }
  describe("v2 map music variety check (fs-use-tools H5)", () => {
    it("flags three story maps that all play one track, and clears once a map plays another", () => {
      const flat = mapsProject(3, ["cc0-bgm-field", "cc0-bgm-field", "cc0-bgm-field"]);
      expect(mapMusicVarietyProblems(flat)).toHaveLength(1);
      expect(mapMusicVarietyProblems(mapsProject(3, ["cc0-bgm-field", "cc0-bgm-field", "cc0-bgm-dungeon"]))).toEqual([]);
    });

    it("counts maps that inherit the project default as one track", () => {
      expect(mapMusicVarietyProblems(mapsProject(3))).toHaveLength(1);
    });

    it("does not fire for one or two maps", () => {
      expect(mapMusicVarietyProblems(mapsProject(2, ["cc0-bgm-field", "cc0-bgm-field"]))).toEqual([]);
      expect(mapMusicVarietyProblems(mapsProject(1))).toEqual([]);
    });

    it("reaches the finish gate for a whole-game request, not for a music request or a small edit", () => {
      const after = mapsProject(3, ["cc0-bgm-field", "cc0-bgm-field", "cc0-bgm-field"]);
      const before = createBlankProject() as Project;
      const hit = (task: string) => gameContentProblems(before, after, task).some((finding) => finding.judge === "game" && finding.id === "음악 다양성" && finding.severity === "block");
      expect(hit(WHOLE)).toBe(true);
      expect(hit("촌장 대사를 바꿔 줘")).toBe(false);
      expect(hit(`${WHOLE}. 마을은 잔잔한 음악으로 해줘`)).toBe(false);
    });
  });
  describe("v2 whole-game tool exposure (fs-use-tools H5)", () => {
    it("offers recommend_bgm and set_game_audio for a game request that never says music", () => {
      const names = v2ExtraToolNames("귀여운 고양이가 주인공인 탐험 게임 만들어줘");
      expect(names).toContain("recommend_bgm");
      expect(names).toContain("set_game_audio");
    });
    it("does not offer them for a small edit", () => {
      expect(v2ExtraToolNames("촌장 대사를 바꿔 줘")).not.toContain("set_game_audio");
    });
  });
});

describe("aiV2ModernFacility", () => {
  isolateTimers();
  function turn(project = createBlankProject(), session = new V2Session()) {
    const ctx = { project, currentMapId: project.startMapId, assistantRun: true };
    const env = {
      ctx, request: { project, task: "서울에 시설 실내를 지어 줘.", projectKey: "modern-facility", provider: "local-cli:claude", mapIds: [] },
      emit: () => {}, record: () => {}, sideChat: async () => "{}", checkpoint: async () => {},
    } as PiAssistantV2Env;
    const tools = createV2Tools(env, session);
    async function call(name: string, args: unknown) {
      const response = await tools.find((tool) => tool.name === name)!.execute(name, args);
      const result = JSON.parse(response.content.find((entry) => entry.type === "text")!.text) as { ok: boolean; summary: string; mapIds: string[] };
      expect(result.ok, result.summary).toBe(true);
      return result.mapIds[0]!;
    }
    return {
      ctx, session, call, tools,
      make: (spec: Omit<PlaceSpec, "type" | "style">) => call("make_place", { type: "house", style: "kr-modern", ...spec }),
      program: (mapId: string) => (session.placeOf(mapId)?.result.state as { program?: string } | undefined)?.program,
    };
  }
  it.each([
    [{ name: "오래된 아파트", hints: { program: "" } }, "mc_old_apartment", "oa-corridor"],
    [{ name: "Riverside Old Apartment" }, "mc_old_apartment", "oa-room-a"],
    [{ name: "은하 아파트", theme: "낡은 아파트" }, "mc_old_apartment", "oa-stair"],
    [{ name: "서울 만화 카페" }, "mc_manga_cafe", "mg-booths"],
    [{ name: "별빛 치과" }, "mc_dental", "dn-xray"],
    [{ name: "서울 버스 터미널" }, "mc_bus_terminal", "bs-hall"],
    [{ name: "서울 아파트" }, "apartment", "living"],
    [{ name: "온기 카페", theme: "오래된 아파트 근처" }, "cafe", "cafe"],
    [{ name: "동네 편의점" }, "neighborhood-konbini", "konbini-stock"],
    [{ name: "오래된 아파트", hints: { program: "apartment" } }, "apartment", "living"],
  ] satisfies [Omit<PlaceSpec, "type" | "style">, string, string][])(
    "builds %o with its selected %s interior",
    async (spec, expectedProgram, room) => {
      const host = turn();
      const mapId = await host.make(spec);
      expect(host.program(mapId)).toBe(expectedProgram);
      const map = host.ctx.project.maps[mapId]!;
      expect(map.tilesetId).toBe("modern_city");
      expect(map.locations?.some((location) => location.name === room && location.tags?.includes("hand-layout-room"))).toBe(true);
    },
  );
  it("exposes the program hint and accepts an empty selection on the Japanese house path", async () => {
    const host = turn();
    const make = host.tools.find((tool) => tool.name === "make_place")!;
    const edit = host.tools.find((tool) => tool.name === "edit_place")!;
    const hints = { properties: { program: { type: "string" } } };
    expect(make.parameters).toMatchObject({ properties: { hints } });
    expect(edit.parameters).toMatchObject({ properties: { patch: { properties: { set: { properties: { hints } } } } } });
    const mapId = await host.call("make_place", { type: "house", style: "jp-modern", name: "일본 원룸", hints: { program: "" } });
    expect(host.ctx.project.maps[mapId]!.tilesetId).toBe("jp_city");
    expect(host.session.placeOf(mapId)?.result.state).toMatchObject({ args: { layout: { program: "apartment-1k" } } });
  });
  it("keeps the actual program of a pre-change saved place on an unrelated edit", async () => {
    const source = turn();
    const mapId = await source.make({ name: "오래된 아파트", hints: { program: "apartment" } });
    const old = source.session.placeOf(mapId)!;
    // Before catalog selection, the same name produced this generic apartment without a hint.
    source.session.places.set(mapId, { ...old, spec: { ...old.spec, hints: undefined } });
    const saved = savePlaces(source.session, source.ctx.project, indexProject(source.ctx.project));
    const project = deserialize(serialize(source.ctx.project));
    const session = new V2Session();
    expect(loadPlaces(saved, session, project, indexProject(project)).restored).toBe(1);
    const current = turn(project, session);
    const before = project.maps[mapId]!;
    const editedId = await current.call("edit_place", { patch: { mapId, set: { name: "별빛 오래된 아파트" } } });
    expect(editedId).toBe(mapId);
    expect(current.program(mapId)).toBe("apartment");
    expect(current.ctx.project.maps[mapId]!.lowerTiles).toEqual(before.lowerTiles);
    expect(current.ctx.project.maps[mapId]!.upperTiles).toEqual(before.upperTiles);
  });
});

// 목표 꼬리의 출구 자리 말: 어느 맵의 자리인지(「이 맵 …」)와, 가장자리가 아닌 문은 들어서는 쪽을 적는다.
// 2026-11-11 fun-x1 눈가림 플레이: 「초승달 궁전 입구: 동쪽 끝 가운데」 가 «궁전의 동쪽 끝»으로, 맵 북쪽 피라미드의 남쪽 문이 「북쪽」 으로 읽혔다.
describe("aiV2ObjectiveExitWords", () => {
  isolateTimers();
  const gate = (id: string, x: number, y: number, to: string, tx: number, ty: number) => ({ id, x, y, pages: [{ commands: [{ kind: "transfer", mapId: to, x: tx, y: ty }] }] });
  const project = { maps: {
    town: { id: "town", name: "마을", width: 40, height: 30, events: [gate("g1", 39, 15, "field", 0, 15), gate("g2", 20, 8, "tomb", 6, 14)] },
    field: { id: "field", name: "들판", width: 40, height: 30, events: [gate("g3", 0, 15, "town", 38, 15), { id: "e", name: "석상", x: 30, y: 5, pages: [{ commands: [] }] }] },
    tomb: { id: "tomb", name: "무덤", width: 13, height: 16, events: [gate("g4", 6, 15, "town", 20, 9)] },
  } } as unknown as Project;
  describe("objective exit words", () => {
    it("names the map whose edge the exit is on", () => {
      expect(whereHint(project, "town", { mapId: "field", x: 30, y: 5, label: "석상" }, { x: 5, y: 5 })).toBe("들판 입구: 이 맵 동쪽 끝 가운데 → 석상");
    });

    it("says which side a door away from the edge is entered from (the cell the way back lands on)", () => {
      expect(whereHint(project, "town", { mapId: "tomb" }, { x: 5, y: 5 })).toBe("무덤 입구: 이 맵 북쪽 · 남쪽에서 들어간다");
    });

    it("keeps 「바로 옆」 for an exit two cells away and frames only the first leg of a pass-through route", () => {
      expect(whereHint(project, "town", { mapId: "field" }, { x: 38, y: 14 })).toBe("들판 입구: 바로 옆");
      expect(whereHint(project, "tomb", { mapId: "field", x: 30, y: 5, label: "석상" }, { x: 6, y: 3 })).toBe("마을 입구: 이 맵 남쪽 끝 가운데 → 마을에서 동쪽 끝 가운데 → 들판 · 석상");
    });
  });
});

// 끝맺음 「목표 길 안내」 가 단계 목표에 «다음 단계를 넘기는 이벤트»를 묶는다(fields.targetMapId · targetEventId).
// 2026-11-12 r1 눈가림 플레이 · 따라 걷는 자: 이름이 같은 다른 이벤트(r1-farm 「보리」 둘), 이름 있는 말 이벤트 뒤의 이름 없는 보스(r1-fantasy 「광산 수호자」),
// 이름을 글에 안 쓴 단계(fun-x1) 에서 표시가 엉뚱한 곳에 서거나 없었다 — 16게임 1칸 누르기 148/162 → 159/162 (openwiki/assistant-v2.md).
describe("aiV2ObjectiveTargetBinding", () => {
  isolateTimers();
  const page = (commands: unknown[], extra: object = {}) => ({ id: `p${Math.random()}`, trigger: { kind: "action" }, priority: "same", graphic: {}, conditions: [], commands, ...extra });
  const chips = (event: unknown): RawCommand[] => {
    const out: RawCommand[] = [];
    const walk = (value: unknown): void => {
      if (Array.isArray(value)) { value.forEach(walk); return; }
      if (!value || typeof value !== "object") return;
      const record = value as Record<string, unknown>;
      if (record.kind === "m2Command" && (record.fields as { surface?: string } | undefined)?.surface === "objectiveChip") out.push(record as unknown as RawCommand);
      for (const [key, child] of Object.entries(record)) if (key !== "fields") walk(child);
    };
    walk(event);
    return out;
  };
  const targetsOf = (event: unknown) => chips(event).map((command) => objectiveTargetOf(command));
  function twoMaps(): { project: Project; first: Project["maps"][string]; room: Project["maps"][string] } {
    const project = createBlankProject() as Project;
    const first = project.maps[project.startMapId]!;
    const room = { ...structuredClone(first), id: "map_b", name: "보리밭", events: [] as GameEvent[] };
    project.maps[room.id] = room as never;
    first.events.push({ id: "ev_door", name: "문", x: 5, y: 5, pages: [page([{ kind: "transfer", mapId: "map_b", x: 3, y: 3 }], { trigger: { kind: "playerTouch" } })] } as never);
    return { project, first, room: project.maps.map_b! };
  }
  const blueprint = (steps: object[]) => normalizeGameBlueprint({ title: "t", genre: "모험", playerGoal: "보리밭을 되살린다", ending: { name: "끝", how: "끝", feeling: "f" }, steps });
  describe("objective command carries its target as two flat fields", () => {
    it("writes · reads · changes · removes", () => {
      const command = objectiveCommand("보리와 이야기한다", { mapId: "m", eventId: "e" });
      expect(command.fields).toEqual({ surface: "objectiveChip", message: "보리와 이야기한다", durationMs: 0, targetMapId: "m", targetEventId: "e" });
      expect(() => validateCommandArray("commands", [command])).not.toThrow();
      expect(objectiveTargetOf(command)).toEqual({ mapId: "m", eventId: "e" });
      expect(setObjectiveTarget(command, { mapId: "m", eventId: "e" })).toBe(false);
      expect(setObjectiveTarget(command, { mapId: "m", eventId: "e2" })).toBe(true);
      expect(objectiveTargetOf(command)).toEqual({ mapId: "m", eventId: "e2" });
      expect(setObjectiveTarget(command, undefined)).toBe(true);
      expect(command.fields).toEqual({ surface: "objectiveChip", message: "보리와 이야기한다", durationMs: 0 });
      expect(objectiveTargetOf(objectiveCommand("대상 없음"))).toBeUndefined();
    });
  });
  describe("finish: step objectives are bound to the event that advances the next step", () => {
    it("binds the objective whose text is the next step's action; with two namesakes the built event wins", () => {
      const { project, first, room } = twoMaps();
      first.events.push({ id: "ev_elder", name: "촌장", x: 8, y: 8, pages: [page([{ kind: "setSwitch", switchId: "sw_a", value: true }, objectiveCommand("보리에게 수확 이야기를 듣는다 (보리밭 입구: 동쪽 → 보리)")])] } as never);
      room.events.push({ id: "ev_bori_story", name: "보리", x: 4, y: 4, pages: [page([{ kind: "text", body: "수확 이야기" }])] } as never);
      room.events.push({ id: "ev_bori", name: "보리", x: 9, y: 6, pages: [page([{ kind: "text", body: "…" }, { kind: "setSwitch", switchId: "sw_b", value: true }])] } as never);
      project.gameBlueprint = blueprint([
        { id: "s1", place: first.name, event: "촌장", action: "촌장에게 부탁을 듣는다", gives: "부탁", feeling: "f" },
        { id: "s2", place: "보리밭", event: "보리", action: "보리에게 수확 이야기를 듣는다.", needs: "부탁", gives: "엔딩", feeling: "f" },
      ]);
      // 지어 둔 이벤트 기록이 없으면(옛 저장본) 이름이 같은 첫 이벤트.
      refreshObjectiveRoutes(project);
      expect(targetsOf(first.events.find((e) => e.id === "ev_elder"))).toEqual([{ mapId: "map_b", eventId: "ev_bori_story" }]);
      // build_blueprint_path 가 적어 둔 것이 있으면 그 이벤트.
      project.gameBlueprint!.steps[1]!.built = { mapId: "map_b", eventId: "ev_bori" };
      expect(refreshObjectiveRoutes(project)).toBeGreaterThan(0);
      expect(targetsOf(first.events.find((e) => e.id === "ev_elder"))).toEqual([{ mapId: "map_b", eventId: "ev_bori" }]);
      // 다시 돌려도 같다(바꾼 것 없음).
      expect(refreshObjectiveRoutes(project)).toBe(0);
    });

    it("a built event that was removed afterwards falls back to the name", () => {
      const { project, first, room } = twoMaps();
      first.events.push({ id: "ev_elder", name: "촌장", x: 8, y: 8, pages: [page([{ kind: "setSwitch", switchId: "sw_a", value: true }, objectiveCommand("보리에게 수확 이야기를 듣는다")])] } as never);
      room.events.push({ id: "ev_bori", name: "보리", x: 9, y: 6, pages: [page([{ kind: "text", body: "…" }])] } as never);
      project.gameBlueprint = blueprint([
        { id: "s1", place: first.name, event: "촌장", action: "촌장에게 부탁을 듣는다", gives: "부탁", feeling: "f" },
        { id: "s2", place: "보리밭", event: "보리", action: "보리에게 수확 이야기를 듣는다", needs: "부탁", gives: "엔딩", feeling: "f" },
      ]);
      project.gameBlueprint!.steps[1]!.built = { mapId: "map_b", eventId: "ev_gone" };
      refreshObjectiveRoutes(project);
      expect(targetsOf(first.events.find((e) => e.id === "ev_elder"))).toEqual([{ mapId: "map_b", eventId: "ev_bori" }]);
    });

    it("a step locked behind a fight: the target is the event that carries the battle, even when it has no name", () => {
      const { project, first, room } = twoMaps();
      project.database.troops.length = 0; // 이름 붙일 부대가 없다 — 보스 이벤트는 이름 없이 남는다.
      first.events.push({ id: "ev_elder", name: "촌장", x: 8, y: 8, pages: [page([{ kind: "setSwitch", switchId: "sw_a", value: true }, objectiveCommand("광산 수호자를 쓰러뜨린다 (보리밭 입구: 동쪽 → 광산 수호자)")])] } as never);
      // 말 이벤트는 이긴 뒤에만 다음 장면으로 넘어간다(조건 없는 페이지 + 승리 스위치 페이지).
      room.events.push({ id: "ev_guardian_talk", name: "광산 수호자", x: 4, y: 4, pages: [page([{ kind: "text", body: "아직 서 있다." }]), page([{ kind: "text", body: "쓰러졌다." }, { kind: "setSwitch", switchId: "sw_b", value: true }], { conditions: [{ kind: "switch", switchId: "sw_won", value: true }] })] } as never);
      room.events.push({ id: "ev_boss", name: "", x: 14, y: 9, pages: [page([{ kind: "battleProcessing", troopId: "troop_x", canEscape: false, canLose: false }, { kind: "setSwitch", switchId: "sw_won", value: true }])] } as never);
      project.gameBlueprint = blueprint([
        { id: "s1", place: first.name, event: "촌장", action: "촌장에게 부탁을 듣는다", gives: "부탁", feeling: "f" },
        { id: "s2", kind: "battle", place: "보리밭", event: "광산 수호자", action: "광산 수호자를 쓰러뜨린다", needs: "부탁", gives: "엔딩", feeling: "f" },
      ]);
      refreshObjectiveRoutes(project);
      expect(targetsOf(first.events.find((e) => e.id === "ev_elder"))).toEqual([{ mapId: "map_b", eventId: "ev_boss" }]);
    });

    it("an objective that says something else than the next step (a suspect line, a side errand) is not bound", () => {
      const { project, first, room } = twoMaps();
      first.events.push({ id: "ev_elder", name: "촌장", x: 8, y: 8, pages: [page([{ kind: "setSwitch", switchId: "sw_a", value: true }, objectiveCommand("용의자 셋 중 범인을 지목한다 (하린 · 도윤 · 세아)")])] } as never);
      room.events.push({ id: "ev_bori", name: "보리", x: 9, y: 6, pages: [page([{ kind: "text", body: "…" }])] } as never);
      project.gameBlueprint = blueprint([
        { id: "s1", place: first.name, event: "촌장", action: "촌장에게 부탁을 듣는다", gives: "부탁", feeling: "f" },
        { id: "s2", place: "보리밭", event: "보리", action: "보리에게 수확 이야기를 듣는다", needs: "부탁", gives: "엔딩", feeling: "f" },
      ]);
      refreshObjectiveRoutes(project);
      expect(targetsOf(first.events.find((e) => e.id === "ev_elder"))).toEqual([undefined]);
    });

    it("keeps a target the setter wrote, and drops one whose event no longer exists", () => {
      const { project, first, room } = twoMaps();
      room.events.push({ id: "ev_bori", name: "보리", x: 9, y: 6, pages: [page([{ kind: "text", body: "…" }])] } as never);
      first.events.push({ id: "ev_lever", name: "레버", x: 8, y: 8, pages: [page([
        objectiveCommand("「보리」를 찾아가자", { mapId: "map_b", eventId: "ev_bori" }),
        objectiveCommand("「허수아비」를 찾아가자", { mapId: "map_b", eventId: "ev_scarecrow_removed" }),
      ])] } as never);
      refreshObjectiveRoutes(project);
      expect(targetsOf(first.events.find((e) => e.id === "ev_lever"))).toEqual([{ mapId: "map_b", eventId: "ev_bori" }, undefined]);
    });
  });
  describe("set_objective plan passes the target along", () => {
    it("puts the target on the objective it hangs after the event's milestone", () => {
      const { project, first, room } = twoMaps();
      first.events.push({ id: "ev_elder", name: "촌장", x: 8, y: 8, pages: [page([{ kind: "text", body: "부탁하네." }, { kind: "setSwitch", switchId: "sw_a", value: true }])] } as never);
      room.events.push({ id: "ev_bori", name: "보리", x: 9, y: 6, pages: [page([{ kind: "text", body: "…" }])] } as never);
      const plan = planObjective(project, { text: "보리를 찾아가자", eventId: "ev_elder", mapId: first.id, target: { mapId: "map_b", eventId: "ev_bori" } });
      expect(plan.ok).toBe(true);
      expect(plan.events.flatMap(({ event }) => targetsOf(event))).toEqual([{ mapId: "map_b", eventId: "ev_bori" }]);
      const bare = planObjective(project, { text: "보리를 찾아가자", eventId: "ev_elder", mapId: first.id });
      expect(bare.events.flatMap(({ event }) => targetsOf(event))).toEqual([undefined]);
    });
  });
});

describe("aiV2OneCallToolText", () => {
  isolateTimers();
  // 한 호출로 끝나는 도구 넷(시작 상태 · 이벤트 복사 · 한 번 도는 컷신 · 길을 막는 전투)과 2026-11-11 에 고친 도구가 v2 에서 영어 글로 읽히는가.
  // 도구 동작은 test/toolsOneCallGaps.test.ts.

  describe("v2 가 읽는 영어 글", () => {
    it("풀에 넣을 네 도구와 고친 도구에 영어 설명이 있다", () => {
      for (const name of ["set_session_start", "duplicate_event", "script_cutscene", "place_battle_blocker", "place_chest", "place_savepoint", "configure_npc_patrol", "set_map_properties"]) {
        expect(V2_TOOL_EN[name]?.d, name).toBeTruthy();
        expect(/[ㄱ-ㆎ가-힣]/u.test(V2_TOOL_EN[name]!.d), name).toBe(false);
      }
      expect(V2_TOOL_EN.place_savepoint!.d).toContain("mode:'heal'");
      expect(V2_TOOL_EN.configure_npc_patrol!.d).toContain("type:'random'");
      expect(V2_TOOL_EN.place_chest!.p!.contents).toContain("count");
    });
  });
});

describe("aiV2PathBattleCopy", () => {
  isolateTimers();
  // 2026-10-31 script-ab sab-1031 던전 1회차(A·B 둘 다): 길 예산이 보스 무리를 사본으로 바꾸면서 반피 페이지의 enemyId 는 원본에 남아
  // 보스 반피 대사가 끝내 안 떴다. 사본 무리는 자기 적 참조를 모두 사본 적으로 들고 가야 한다.
  function bossProject(): Project {
    const p = createBlankProject() as Project;
    const troop = p.database.troops.find((t) => t.id === "troop_slime")!;
    troop.enemyIds = ["enemy_slime"];
    troop.members = [{ enemyId: "enemy_slime", x: 100, y: 100 }];
    troop.battleEventPages = [
      { id: "half", name: "반피", span: "battle", conditions: [{ kind: "enemyHpBelow", enemyId: "enemy_slime", percent: 50 }], commands: [{ kind: "showText", text: "아직이다!" } as never] },
      { id: "range", name: "구간", span: "battle", conditions: [{ kind: "enemyHp", enemyId: "enemy_slime", minPercent: 0, maxPercent: 30 }, { kind: "enemiesAlive", enemyId: "enemy_slime", atMost: 0 }], commands: [] },
    ];
    troop.battleGuests = [{ actorId: "actor_hero", conditions: [{ kind: "enemyTurn", enemyId: "enemy_slime", turn: 2 }] }];
    return p;
  }
  describe("pathCopy remaps the enemy ids its troop pages reference", () => {
    it("points battle-event page, guest conditions at the copied enemy", () => {
      const p = bossProject();
      const copyId = pathCopy(p, "troop_slime")!;
      const copy = p.database.troops.find((t) => t.id === copyId)!;
      const copiedEnemy = copy.enemyIds[0]!;
      expect(copiedEnemy).toMatch(/^enemy_path_/u);
      expect(p.database.enemies.some((e) => e.id === copiedEnemy)).toBe(true);
      const ids = JSON.stringify([copy.battleEventPages, copy.battleGuests]);
      expect(ids).not.toContain('"enemy_slime"');
      expect((copy.battleEventPages[0]!.conditions[0] as { enemyId: string }).enemyId).toBe(copiedEnemy);
      expect((copy.battleEventPages[1]!.conditions[1] as { enemyId: string }).enemyId).toBe(copiedEnemy);
      expect((copy.battleGuests![0]!.conditions[0] as { enemyId: string }).enemyId).toBe(copiedEnemy);
      // 원본 무리는 그대로.
      const source = p.database.troops.find((t) => t.id === "troop_slime")!;
      expect((source.battleEventPages[0]!.conditions[0] as { enemyId: string }).enemyId).toBe("enemy_slime");
    });

    it("repairs a copy made before the fix, and is idempotent", () => {
      const p = bossProject();
      const copyId = pathCopy(p, "troop_slime")!;
      const copy = p.database.troops.find((t) => t.id === copyId)!;
      const copiedEnemy = copy.enemyIds[0]!;
      // 옛 사본처럼 원본 id 로 되돌린다.
      (copy.battleEventPages[0]!.conditions[0] as { enemyId: string }).enemyId = "enemy_slime";
      repairPathTroop(p, copy);
      expect((copy.battleEventPages[0]!.conditions[0] as { enemyId: string }).enemyId).toBe(copiedEnemy);
      const once = JSON.stringify(copy);
      repairPathTroop(p, copy);
      expect(JSON.stringify(copy)).toBe(once);
      expect(pathCopy(p, "troop_slime")).toBe(copyId);
    });
  });
});
