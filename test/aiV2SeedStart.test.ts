import { describe, expect, it } from "vitest";
import { createCapabilityFixtureProject } from "../src/harnesses/assistant-capability/node/capabilityFixture";
import { runTool } from "@/editor/tools/toolRunner";
import { mergeMapBundles } from "@/ai/piAgent/mapBundle";
import { recordProjectSnapshot, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { store } from "@/project/store";
import { REGION_PLACE_KINDS, regionPlaceKindFromText } from "@/editor/tools/regionPlaceTools";
import type { Command, GameMap, Project } from "@/project/types";
import { createPiToolset } from "@/ai/piAgent/toolAdapter";
import { PiCharsetSelectionGate } from "@/ai/piAgent/charsetSelectionGate";
import { createBlankProject } from "@/project/defaults";
import { isPassable } from "@/project/collision";
import type { ToolContext } from "@/editor/tools/types";
import { createV2Tools } from "@/ai/v2/tools/verbs";
import { withTodoLoop } from "@/ai/v2/loop/todoTools";
import { coveredCell } from "@/ai/v2/place/underRoof";
import { isRoadGround } from "@/ai/v2/place/surface";
import { roadEntranceStart } from "@/ai/v2/place/startSpot";
import { V2Session } from "@/ai/v2/turn/session";
import type { PiAssistantV2Env } from "@/ai/v2/shared/env";
import { buildFixture } from "@/harnesses/assistant-capability/node/smallJobs/fixtures";
import { isolateTimers } from "./mergedTeardown";

// 영역 지시 레시피(build_region_place) — 「여기 상점 만들어 줘」 한 번이 외관·실내·왕복 문·주인·상점까지 짓고,
// 바깥 맵은 영역 안만 바뀌며, 실패하면 아무것도 남지 않는다.
describe("regionPlaceTools", () => {
  isolateTimers();
  const REGION = { x: 14, y: 8, width: 13, height: 12 };
  function setup(): { ctx: { project: Project; currentMapId: string; assistantRun: boolean }; mapId: string } {
    const ctx = { project: createCapabilityFixtureProject(), currentMapId: "", assistantRun: true };
    const made = runTool(ctx, "create_map", { name: "시험 마을", width: 40, height: 30, tilesetId: "beodeul_city" });
    const mapId = (made.data as { mapId: string }).mapId;
    ctx.currentMapId = mapId;
    return { ctx, mapId };
  }
  function commandsOf(map: GameMap): Command[] {
    return map.events.flatMap((event) => (event.pages ?? []).flatMap((page) => page.commands ?? []));
  }
  function transfersTo(map: GameMap, target: string): number {
    return commandsOf(map).filter((command) => command.kind === "transfer" && command.mapId === target).length;
  }
  function outsideChanges(before: GameMap, after: GameMap): number {
    let changed = 0;
    for (let y = 0; y < after.height; y += 1) {
      for (let x = 0; x < after.width; x += 1) {
        const inRegion = x >= REGION.x && y >= REGION.y && x < REGION.x + REGION.width && y < REGION.y + REGION.height;
        const i = y * after.width + x;
        if (!inRegion && (before.lowerTiles[i] !== after.lowerTiles[i] || before.upperTiles[i] !== after.upperTiles[i])) changed += 1;
      }
    }
    return changed;
  }
  describe("build_region_place", () => {
    it("상점: 외관·새 실내 맵·양방향 문·이 게임 품목의 상점 주인을 한 번에 짓고 영역 밖은 그대로다", () => {
      const { ctx, mapId } = setup();
      const base = structuredClone(ctx.project);
      const before = structuredClone(ctx.project.maps[mapId]!);
      const out = runTool(ctx, "build_region_place", { mapId, region: REGION, kind: "shop" });
      expect(out.ok, out.summary).toBe(true);
      const data = out.data as { interiorMapId: string; createdMapIds: string[]; parts: Record<string, boolean> };
      expect(data.parts).toEqual({ exterior: true, interior: true, link: true, keeper: true, service: true });
      const outside = ctx.project.maps[mapId]!;
      const inside = ctx.project.maps[data.interiorMapId]!;
      expect(inside).toBeDefined();
      expect(data.createdMapIds).toEqual([data.interiorMapId]);
      expect(outsideChanges(before, outside)).toBe(0);
      expect(transfersTo(outside, data.interiorMapId)).toBeGreaterThan(0);
      expect(transfersTo(inside, mapId)).toBeGreaterThan(0);
      // 영역 턴의 맵 묶음 병합이 새 실내 맵을 「범위 밖」으로 버리지 않는다 — 바깥 맵 아래 트리에 매단다.
      const merged = mergeMapBundles(base, [{ mapIds: [mapId], project: ctx.project }]);
      expect(merged.project.maps[data.interiorMapId]).toBeDefined();
      expect(merged.spills).toEqual([]);
      const shop = commandsOf(inside).find((command) => command.kind === "shop");
      expect(shop && shop.kind === "shop" ? shop.itemIds.length : 0).toBeGreaterThan(0);
      const known = new Set(ctx.project.database.items.map((item) => item.id));
      if (shop?.kind === "shop") for (const id of shop.itemIds) expect(known.has(id), id).toBe(true);
    });

    it("조수 경로(칩 관문)에서도 레시피가 고른 주인 칩 때문에 첫 호출이 거절되지 않는다", async () => {
      // 2026-11-25 assistant-measure-r2: 영역 6판 모두 첫 호출이 「캐릭터 그림 선택을 되돌렸습니다」로 거절돼 모델 두 차례를 더 썼다.
      for (const kind of ["shop", "inn", "dungeon_entrance"]) {
        const { ctx, mapId } = setup();
        const tool = createPiToolset(ctx, { charsetGate: new PiCharsetSelectionGate() }).find((t) => t.name === "build_region_place")!;
        const before = Object.keys(ctx.project.maps).length;
        await expect(tool.execute(`call-${kind}`, { mapId, region: REGION, kind }), kind).resolves.toBeTruthy();
        expect(Object.keys(ctx.project.maps).length, kind).toBeGreaterThan(before);
      }
    });

    it("조수 턴 적용과 같은 프로젝트 스냅샷 한 칸이라 되돌리기 한 번에 실내 맵까지 사라진다", () => {
      const { ctx, mapId } = setup();
      store.replace(structuredClone(ctx.project));
      resetMapEditHistory();
      const out = runTool(ctx, "build_region_place", { mapId, region: REGION, kind: "inn" });
      expect(out.ok, out.summary).toBe(true);
      const interiorMapId = (out.data as { interiorMapId: string }).interiorMapId;
      recordProjectSnapshot("영역 지시", mapId);
      store.replace(ctx.project);
      expect(store.getCurrent().maps[interiorMapId]).toBeDefined();
      expect(undoMapEdit()).toBe(true);
      expect(store.getCurrent().maps[interiorMapId]).toBeUndefined();
      expect(transfersTo(store.getCurrent().maps[mapId]!, interiorMapId)).toBe(0);
    });

    it("여관은 숙박 명령, 던전 입구는 새 던전 맵과 영역 안 입구를 만든다", () => {
      const inn = setup();
      const innOut = runTool(inn.ctx, "build_region_place", { mapId: inn.mapId, region: REGION, kind: "inn" });
      expect(innOut.ok, innOut.summary).toBe(true);
      const innMap = inn.ctx.project.maps[(innOut.data as { interiorMapId: string }).interiorMapId]!;
      expect(commandsOf(innMap).some((command) => command.kind === "inn")).toBe(true);

      const dungeon = setup();
      const base = structuredClone(dungeon.ctx.project);
      const before = structuredClone(dungeon.ctx.project.maps[dungeon.mapId]!);
      const out = runTool(dungeon.ctx, "build_region_place", { mapId: dungeon.mapId, region: REGION, kind: "dungeon_entrance" });
      expect(out.ok, out.summary).toBe(true);
      const created = (out.data as { createdMapIds: string[] }).createdMapIds;
      expect(created).toHaveLength(1);
      expect(transfersTo(dungeon.ctx.project.maps[dungeon.mapId]!, created[0]!)).toBeGreaterThan(0);
      expect(outsideChanges(before, dungeon.ctx.project.maps[dungeon.mapId]!)).toBe(0);
      // 던전 맵과 세계 그래프 간선까지 영역 턴의 맵 묶음 병합을 그대로 넘는다.
      expect(mergeMapBundles(base, [{ mapIds: [dungeon.mapId], project: dungeon.ctx.project }]).spills).toEqual([]);
    });

    it.each([
      ["warehouse", "bd-house-ware0"], ["stable", "bd-house-cstable"], ["school", "bd-house-h122_0"],
      ["guard_post", "bd-pick-mountain-pass-guard-post"], ["windmill", "bd-house-mill1"], ["lighthouse", "bd-pick-fishing-port-lighthouse"],
    ])("%s 는 그 모양의 버들항 키트(%s) 외관으로 서고 실내·왕복 문·주인까지 짓는다", (kind, kitId) => {
      {
        const { ctx, mapId } = setup();
        const base = structuredClone(ctx.project);
        const before = structuredClone(ctx.project.maps[mapId]!);
        const out = runTool(ctx, "build_region_place", { mapId, region: REGION, kind });
        expect(out.ok, `${kind}: ${out.summary}`).toBe(true);
        const data = out.data as { interiorMapId: string; exterior: { source: string }; parts: Record<string, boolean> };
        expect(data.exterior.source, kind).toBe(kitId);
        expect(data.parts, kind).toEqual({ exterior: true, interior: true, link: true, keeper: true, service: true });
        expect(outsideChanges(before, ctx.project.maps[mapId]!), kind).toBe(0);
        expect(transfersTo(ctx.project.maps[mapId]!, data.interiorMapId), kind).toBeGreaterThan(0);
        expect(transfersTo(ctx.project.maps[data.interiorMapId]!, mapId), kind).toBeGreaterThan(0);
        expect(mergeMapBundles(base, [{ mapIds: [mapId], project: ctx.project }]).spills, kind).toEqual([]);
      }
    });

    it.each(["bridge", "gate", "farm", "market"])("%s 는 새 맵 없이 영역 안에만 서고 사람 하나를 영역 안에 세운다", (kind) => {
      const { ctx, mapId } = setup();
      const base = structuredClone(ctx.project);
      const before = structuredClone(ctx.project.maps[mapId]!);
      const out = runTool(ctx, "build_region_place", { mapId, region: REGION, kind });
      expect(out.ok, out.summary).toBe(true);
      const data = out.data as { createdMapIds: string[]; keeper: { x: number; y: number }; parts: Record<string, boolean> };
      expect(data.createdMapIds).toEqual([]);
      expect(data.parts.exterior && data.parts.keeper).toBe(true);
      expect(Object.keys(ctx.project.maps).sort()).toEqual(Object.keys(base.maps).sort());
      expect(outsideChanges(before, ctx.project.maps[mapId]!)).toBe(0);
      expect(data.keeper.x >= REGION.x && data.keeper.y >= REGION.y && data.keeper.x < REGION.x + REGION.width && data.keeper.y < REGION.y + REGION.height).toBe(true);
      expect(mergeMapBundles(base, [{ mapIds: [mapId], project: ctx.project }]).spills).toEqual([]);
    });

    it("숲은 영역 안에만 나무를 심고 가운데 남북 오솔길을 비워 둔다", () => {
      const { ctx, mapId } = setup();
      const before = structuredClone(ctx.project.maps[mapId]!);
      const out = runTool(ctx, "build_region_place", { mapId, region: REGION, kind: "forest" });
      expect(out.ok, out.summary).toBe(true);
      const after = ctx.project.maps[mapId]!;
      expect(outsideChanges(before, after)).toBe(0);
      expect((out.data as { createdMapIds: string[] }).createdMapIds).toEqual([]);
      let planted = 0;
      for (let i = 0; i < after.upperTiles.length; i += 1) if (before.upperTiles[i] !== after.upperTiles[i] || before.lowerTiles[i] !== after.lowerTiles[i]) planted += 1;
      expect(planted).toBeGreaterThan(30);
      const pathX = REGION.x + Math.floor(REGION.width / 2) - 1;
      for (let y = REGION.y; y < REGION.y + REGION.height; y += 1) for (const x of [pathX, pathX + 1]) {
        const i = y * after.width + x;
        expect(after.upperTiles[i], `${x},${y}`).toBe(before.upperTiles[i]);
      }
    });

    it("시장 상인은 이 게임 품목으로 판다", () => {
      const { ctx, mapId } = setup();
      const out = runTool(ctx, "build_region_place", { mapId, region: REGION, kind: "market" });
      expect(out.ok, out.summary).toBe(true);
      const shop = commandsOf(ctx.project.maps[mapId]!).find((command) => command.kind === "shop");
      const known = new Set(ctx.project.database.items.map((item) => item.id));
      expect(shop?.kind === "shop" ? shop.itemIds.length : 0).toBeGreaterThan(0);
      if (shop?.kind === "shop") for (const id of shop.itemIds) expect(known.has(id), id).toBe(true);
    });

    it("등대·풍차는 키트가 들어가지 않으면 살림집으로 대신하지 않고 거부한다", () => {
      const { ctx, mapId } = setup();
      const out = runTool(ctx, "build_region_place", { mapId, region: { x: 14, y: 8, width: 9, height: 6 }, kind: "lighthouse" });
      expect(out.ok).toBe(false);
      expect(out.summary).toMatch(/등대/);
    });

    it("건물이 들어가지 않는 좁은 영역은 거부하고 프로젝트를 건드리지 않는다", () => {
      const { ctx, mapId } = setup();
      const mapsBefore = Object.keys(ctx.project.maps).sort();
      const tilesBefore = [...ctx.project.maps[mapId]!.lowerTiles];
      const out = runTool(ctx, "build_region_place", { mapId, region: { x: 2, y: 2, width: 3, height: 3 }, kind: "shop" });
      expect(out.ok).toBe(false);
      expect(Object.keys(ctx.project.maps).sort()).toEqual(mapsBefore);
      expect(ctx.project.maps[mapId]!.lowerTiles).toEqual(tilesBefore);
    });

    it("사람 말을 레시피 종류로 읽는다", () => {
      expect(regionPlaceKindFromText("여기 상점 만들어 줘")).toBe("shop");
      expect(regionPlaceKindFromText("대장간 지어줘")).toBe("smithy");
      expect(regionPlaceKindFromText("여관 하나")).toBe("inn");
      expect(regionPlaceKindFromText("동굴 입구 만들어")).toBe("cave_entrance");
      expect(regionPlaceKindFromText("나무 심어 줘")).toBeNull();
      expect(regionPlaceKindFromText("창고 지어 줘")).toBe("warehouse");
      expect(regionPlaceKindFromText("마구간 하나")).toBe("stable");
      expect(regionPlaceKindFromText("학교 세워 줘")).toBe("school");
      expect(regionPlaceKindFromText("경비 초소 세워 줘")).toBe("guard_post");
      expect(regionPlaceKindFromText("풍차 세워 줘")).toBe("windmill");
      expect(regionPlaceKindFromText("등대 세워 줘")).toBe("lighthouse");
      expect(regionPlaceKindFromText("강 위에 다리 놓아 줘")).toBe("bridge");
      expect(regionPlaceKindFromText("사다리 놓아 줘")).toBeNull();
      expect(regionPlaceKindFromText("성문 세워 줘")).toBe("gate");
      expect(regionPlaceKindFromText("농장 만들어 줘")).toBe("farm");
      expect(regionPlaceKindFromText("여기 텃밭 좀 놓아 줘")).toBeNull();
      expect(regionPlaceKindFromText("시장 열어 줘")).toBe("market");
      expect(regionPlaceKindFromText("묘지 만들어 줘")).toBeNull();
      expect(regionPlaceKindFromText("여기 숲 만들어 줘")).toBe("forest");
      expect(new Set(REGION_PLACE_KINDS).size).toBe(REGION_PLACE_KINDS.length);
    });
  });
});

// 빈 시작 맵이 게임에 남지 않는다 — 2026-11-11 map-vqa 깔기 24판: 야영지·알현실·숲→동굴 요청에서 첫 장소를 깐 뒤에도 빈 시드 맵이 남아
// 시작이 그 위에 서거나(숲→동굴: 동굴 출구가 빈 맵으로 이어졌다), 마을 요청은 시작 칸이 지붕 뒤에 섰다.
// 첫 장소를 짓는 쓰기 뒤에 빈 시드 맵을 치우고 시작을 그 장소로 옮긴다. 치운 맵 id 로 온 뒤따른 호출은 시작 맵으로 고쳐 받는다.
describe("aiV2SeedStart", () => {
  isolateTimers();
  const SLOW = 120_000;
  function turn(task: string, project = createBlankProject()) {
    const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
    const env = { ctx, request: { task, provider: "local-cli:claude", mapIds: [], project } as never, emit: () => {}, record: () => {}, sideChat: async () => JSON.stringify({ score: 7, majors: [] }), checkpoint: async () => {},
      preferToolNextTurn: () => {}, clearToolPreference: () => {} } as unknown as PiAssistantV2Env;
    const session = new V2Session();
    const tools = withTodoLoop(env, session.todo, session.loop, createV2Tools(env, session), session.hooks);
    const call = async (name: string, args: unknown): Promise<{ ok: boolean; body: string }> => {
      const body = await tools.find((t) => t.name === name)!.execute(`c-${name}`, args)
        .then((r) => (r.content as { type: string; text?: string }[]).filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n"), (e: Error) => JSON.stringify({ ok: false, summary: e.message }));
      let ok = !/^Rejected:/u.test(body);
      try { const j = JSON.parse(body.split("\n")[0]!) as { ok?: boolean; notFailure?: boolean }; ok = j.ok !== false || j.notFailure === true; } catch { /* 거절 글은 JSON 이 아니다 */ }
      return { ok, body };
    };
    const todo = (name: string, placeKind: string) => call("todo", { op: "init", list: [{ phase: "p", items: [{ content: `${name} 만들기`, id: "place", check: { kind: "place", name, placeKind, fresh: true } }] }] });
    return { ctx, call, todo };
  }
  describe("첫 장소를 지으면 빈 시작 맵은 사라진다", () => {
    it("마을을 지으면 시작이 그 마을의 걷는 칸(지붕 밑이 아닌 곳)으로 가고 빈 시드 맵이 지워진다", async () => {
      const t = turn("마을을 만들어 줘.");
      await t.todo("새벽 마을", "village");
      const made = await t.call("make_place", { type: "village", name: "새벽 마을", size: "small" });
      expect(made.ok, made.body.slice(0, 600)).toBe(true);
      const project = t.ctx.project, map = project.maps[project.startMapId]!;
      expect(map.name).toBe("새벽 마을");
      expect(project.maps.map_blank_start).toBeUndefined();
      expect(isPassable(project, map, project.startPos.x, project.startPos.y)).toBe(true);
      expect(coveredCell(project, map, project.startPos.x, project.startPos.y)).toBe(false);
      // 들어오는 길이 있는 맵이면 시작은 그 길 위다.
      const road = roadEntranceStart(project, map);
      if (road) expect(isRoadGround(project, map, project.startPos.x, project.startPos.y)).toBe(true);
    }, SLOW);

    it("치워진 빈 시작 맵 id 로 온 호출은 시작 맵으로 고쳐 받고 그렇게 알린다", async () => {
      const t = turn("마을을 만들어 줘.");
      await t.todo("새벽 마을", "village");
      await t.call("make_place", { type: "village", name: "새벽 마을", size: "small" });
      const seen = await t.call("inspect", { mapId: "map_blank_start" });
      expect(seen.ok, seen.body.slice(0, 400)).toBe(true);
      expect(seen.body).toContain("was removed when the first place was built");
      expect(seen.body).toContain(t.ctx.project.startMapId);
    }, SLOW);
  });
  // 2026-11-12 Haiku 작은 일 셋째 묶음(password-safe · life-petals · ending-by-talks): 시작 맵이 「잿불 마을」 인 프로젝트의 둘째 맵 「동쪽 들판」
  // (id 는 map_blank_start, 아직 풀밭 한 장)을 짓기 도구가 끝날 때마다 지웠다 — 모델이 create_map 으로 되살리면 또 지웠다.
  // 자리표시 맵은 «이 요청이 시작될 때 게임이 시작하던 빈 맵» 뿐이다.
  describe("시작이 다른 맵에 있는 프로젝트의 빈 맵은 치우지 않는다", () => {
    it("시작 맵이 따로 있는 프로젝트에서 쓰기 도구가 끝나도 map_blank_start(「동쪽 들판」)와 시작 맵이 그대로다", async () => {
      const project = buildFixture("starter");
      const start = project.startMapId;
      expect(start).not.toBe("map_blank_start");
      expect(project.maps.map_blank_start?.name).toBe("동쪽 들판");
      // 시작 맵에 무언가 지어진 뒤(바닥이 한 가지가 아니다)의 쓰기 — 측정에서 지워진 때와 같은 상태.
      const tiles = project.maps[start]!.lowerTiles;
      tiles[0] = tiles[0]! + 1;
      const t = turn("마을에 약초꾼을 세워 줘.", project);
      await t.call("todo", { op: "init", list: [{ phase: "p", items: [{ content: "약초꾼 세우기", id: "person", check: { kind: "person", name: "약초꾼" } }] }] });
      const made = await t.call("add_people", { mapId: start, people: [{ role: "약초꾼", name: "약초꾼", where: "광장", firstTalk: ["약초가 필요하니?"] }] });
      expect(made.ok, made.body.slice(0, 600)).toBe(true);
      expect(made.body).not.toContain("[Start map]");
      expect(t.ctx.project.maps.map_blank_start?.name).toBe("동쪽 들판");
      expect(t.ctx.project.startMapId).toBe(start);
    }, SLOW);
  });
});
