import { describe, expect, it, afterAll, beforeAll } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { isPassable } from "@/project/collision";
import type { GameEvent, GameMap, Project } from "@/project/types";
import { dressInteriorExits, kitOf } from "@/ai/v2/place/exitDress";
import { doorFloorTransfers } from "@/ai/v2/place/exitTransfers";
import { buildingEntrances } from "@/ai/v2/place/entrances";
import { laidOf } from "@/ai/v2/place/laid";
import { pickTransferSpot } from "@/ai/v2/place/transferSpot";
import type { BuildRun, PlaceSpec } from "@/ai/v2/shared/types";
import { builderFor } from "@/ai/v2/place/builders";
import { mapBackgroundGenerationReachable, sheerBackdropLine, sheerKindFor, sheerKindsNearestFirst } from "@/ai/v2/place/builders/sheerTerrain";
import { createBuildRun } from "@/ai/v2/shared/buildRun";
import { V2_CARDS } from "@/ai/v2/prompt/placeSpecs";
import { gameCard } from "@/ai/v2/prompt/gameCard";
import { VILLAGE_CARD, villageKindsLine } from "@/ai/v2/place/builders/village";
import { SHEER_KINDS_CARD_LINE } from "@/ai/v2/place/sheerKindLines";
import { PLACE_SPEC_SCHEMA } from "@/ai/v2/tools/placeSchema";
import { SHEER_KINDS } from "@/editor/tools/sheerTerrainPlan";
import { placeholderSheerArt, setSheerArt } from "@/project/relief/sheerArt";
import { blankMap } from "@/project/blueprintAssembly";
import { factoryArtResourceIds } from "@/project/defaultLeaks";
import { applyShipDefaults } from "@/ai/v2/story/shipDefaults";
import { shipBlockers } from "@/ai/v2/judge/shipChecks";
import { bundledPictureLeft, openingMissing } from "@/ai/v2/judge/shipArtChecks";
import { buildsWholeGame } from "@/ai/v2/request/readers";
import { splitPreexisting } from "@/ai/v2/judge/gates";
import { gateProblems } from "@/ai/v2/judge/finishGate";
import { tagged } from "@/ai/v2/judge/finding";
import { getTool } from "@/editor/tools/toolRegistry";
import { preCheck } from "@/ai/v2/loop/argGuard";
import { isolateTimers } from "./mergedTeardown";

// 방 키트 단계(interior-exits · door-floor-transfers)는 방으로 깔린 맵에만 돌고, 장소 잇기 자리(pickTransferSpot)는 문 그림을 지어내 깔지 않는다.
// 2026-11-11 단계×테마 표: 에도·일본 도시·마법 학교·한국 거리 바깥 맵 9장 모두에서 «…문» 이름 이벤트 하나가 맵 남쪽 줄 전체를 벽으로 바꿨고,
// 잇기 자리는 걸어서 지나는 성문 한가운데였다.
describe("aiV2RoomStagesStayIndoors", () => {
  isolateTimers();
  type Ctx = { project: Project };
  const runOf = (ctx: Ctx): BuildRun => ({ ctx, calls: [], call: (tool: string, args: Record<string, unknown>) => runTool(ctx, tool, args) }) as unknown as BuildRun;
  const tiles = (map: GameMap) => JSON.stringify([map.lowerTiles, (map as unknown as Record<string, unknown>).lowerOverlayTiles, map.upperTiles, (map as unknown as Record<string, unknown>).upperOverlayTiles]);
  function edo(style: string, width: number, height: number): Ctx {
    const ctx = { project: createBlankProject() };
    expect(runTool(ctx, "create_map", { id: "map_e", name: "에도", width, height, tilesetId: "sengoku_edo" }).ok).toBe(true);
    expect(runTool(ctx, "compose_sengoku_edo_map", { mapId: "map_e", style, seed: 1 }).ok).toBe(true);
    const map = ctx.project.maps.map_e!;
    // 시작 칸: 맨 아래 줄의 걸을 수 있는 칸(남쪽 길 끝).
    let start: { x: number; y: number } | undefined;
    for (let x = 0; x < map.width && !start; x++) if (isPassable(ctx.project, map, x, map.height - 1)) start = { x, y: map.height - 1 };
    ctx.project = { ...ctx.project, startMapId: "map_e", startPos: start ?? { x: 0, y: 0 } } as Project;
    return ctx;
  }
  const gateEvent = (x: number, y: number): GameEvent => ({
    id: "ev_gate_sign", name: "낡은 성문", x, y, trigger: { kind: "action" }, commands: [],
    pages: [{ id: "ev_gate_sign_p0", name: "낡은 성문", conditions: [], graphic: { transparent: true }, trigger: { kind: "action" }, priority: "same", overlapForbidden: true, movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [{ kind: "text", body: "굳게 닫혀 있다." }] }],
  }) as unknown as GameEvent;
  describe("room-kit stages run only on maps laid as rooms", () => {
    it("leaves an outdoor street of a room-kit chipset alone, door-named event or not", () => {
      const ctx = edo("village", 54, 42);
      const map0 = ctx.project.maps.map_e!;
      expect(kitOf(ctx.project, map0)).toBeUndefined();
      ctx.project = { ...ctx.project, maps: { ...ctx.project.maps, map_e: { ...map0, events: [...map0.events, gateEvent(ctx.project.startPos.x, ctx.project.startPos.y - 3)] } } };
      const before = tiles(ctx.project.maps.map_e!);
      const start = { ...ctx.project.startPos };
      expect(dressInteriorExits(runOf(ctx), "map_e").notes).toEqual([]);
      expect(doorFloorTransfers(runOf(ctx), "map_e")).toEqual([]);
      expect(tiles(ctx.project.maps.map_e!)).toBe(before);
      expect(ctx.project.startPos).toEqual(start);
    }, 60_000);

    it("trusts what the place record says the map was laid as", () => {
      expect(laidOf({ type: "village", name: "거리" })).toBe("outdoor");
      expect(laidOf({ type: "interior", name: "방" })).toBe("room");
      expect(laidOf({ type: "interior", name: "성하 마을", style: "world:sengoku_edo:castle-town" })).toBe("outdoor");
      expect(laidOf({ type: "dungeon", name: "굴" })).toBeUndefined();
      expect(laidOf(undefined)).toBeUndefined();
      const ctx = edo("village", 54, 42);
      expect(kitOf(ctx.project, ctx.project.maps.map_e!, "outdoor")).toBeUndefined();
    }, 60_000);
  });
  describe("pickTransferSpot", () => {
    it("offers a building entrance only when the other side is a room, and never paints the map", () => {
      const ctx = edo("castle_town", 56, 48);
      expect(runTool(ctx, "create_map", { id: "map_o", name: "다른 거리", width: 30, height: 24, tilesetId: "sengoku_edo" }).ok).toBe(true);
      expect(runTool(ctx, "create_map", { id: "map_r", name: "여관 방", width: 20, height: 16, tilesetId: "sengoku_edo" }).ok).toBe(true);
      ctx.project = { ...ctx.project, maps: { ...ctx.project.maps, map_r: { ...ctx.project.maps.map_r!, climate: { mode: "indoor" } } } } as Project;
      const map = ctx.project.maps.map_e!;
      const before = tiles(map);
      const entrances = buildingEntrances(ctx.project, map);
      expect(entrances.length).toBeGreaterThan(0);
      for (const side of ["south", "north", "east", "west"] as const) {
        // 건너편을 모르거나 바깥 맵이면 집 문을 쓰지 않는다 — 집에 들어갔는데 다른 바깥 맵으로 나오게 된다.
        expect(pickTransferSpot(runOf(ctx), "map_e", { side, outdoor: true })?.doorAt).toBeUndefined();
        expect(pickTransferSpot(runOf(ctx), "map_e", { side, outdoor: true, otherName: "다른 거리" })?.doorAt).toBeUndefined();
        expect(pickTransferSpot(runOf(ctx), "map_e", { side, outdoor: true, otherName: "여관 방", buildingDoor: false })?.doorAt).toBeUndefined();
        // 건너편이 방이라고 적혀 있거나 부르는 쪽이 그렇다고 하면 건물 입구(걸어서 지나는 성문이 아니다).
        for (const spot of [pickTransferSpot(runOf(ctx), "map_e", { side, outdoor: true, otherName: "여관 방" }), pickTransferSpot(runOf(ctx), "map_e", { side, outdoor: true, buildingDoor: true })]) {
          expect(spot?.doorAt).toBeDefined();
          expect(entrances.some((e) => e.x === spot!.doorAt!.x && e.y === spot!.doorAt!.y && e.front.x === spot!.x && e.front.y === spot!.y)).toBe(true);
          expect(isPassable(ctx.project, map, spot!.doorAt!.x, spot!.doorAt!.y)).toBe(false);
          expect(isPassable(ctx.project, map, spot!.x, spot!.y)).toBe(true);
        }
      }
      expect(tiles(ctx.project.maps.map_e!)).toBe(before);
    }, 60_000);

    it("reads building entrances from the kits, blocked cell above a walkable front", () => {
      const ctx = edo("village", 54, 42);
      const map = ctx.project.maps.map_e!;
      const entrances = buildingEntrances(ctx.project, map);
      expect(entrances.length).toBeGreaterThanOrEqual(3);
      for (const e of entrances) {
        expect(isPassable(ctx.project, map, e.x, e.y)).toBe(false);
        expect(isPassable(ctx.project, map, e.front.x, e.front.y)).toBe(true);
        expect(e.kit.length).toBeGreaterThan(0);
      }
    }, 60_000);
  });
});

// 조수 v2 깎아지른 지형 갈래(place/builders/sheerTerrain.ts): 바깥 장소 명세의 hints.kind 가 깎아지른 지형 종류면 마을 빌더 앞에서 이 빌더가 받는다.
// 모르는 kind 는 마을 종류와 같은 잣대로 깎아지른 지형 종류에 더 가까울 때 가장 가까운 종류로 짓고 알린다. 맵 배경은 견본이고, 그림 생성 도구는 v2 경로에 없다고 한 줄로 알린다.
// 종류(id 와 hint)는 모델이 바깥 장소를 고르는 마을 카드 · 땅 그림 답과 숲길 줄에 실린다 — 표(json)에서 만들고, 게임 지시문 상한은 그 카드의 말을 줄여 지킨다.
describe("aiV2SheerKind", () => {
  isolateTimers();
  beforeAll(() => setSheerArt(placeholderSheerArt()));
  afterAll(() => setSheerArt(null));
  const spec = (kind: string, extra: Partial<PlaceSpec> = {}): PlaceSpec => ({ type: "village", name: `절벽 ${kind}`, hints: { kind }, salt: 11, ...extra } as PlaceSpec);
  describe("assistant sheer terrain kind", () => {
    it("a sheer kind id goes to the sheer builder; village kinds and plain villages stay with the village builder", () => {
      for (const k of SHEER_KINDS) expect(builderFor(spec(k.id))?.id, k.id).toBe("sheer-terrain");
      expect(builderFor(spec("fishing-cove"))?.id).toBe("village");
      expect(builderFor({ type: "village", name: "강가 마을" } as PlaceSpec)?.id).toBe("village");
      // a word that matches no kind at all, or a village one better, is the village builder's (it rejects once with the village list)
      expect(builderFor(spec("대장간"))?.id).toBe("village");
      expect(builderFor(spec("zzz"))?.id).toBe("village");
    });

    it("an unknown kind closer to a sheer kind is built as the nearest one and reported (same ranking as village kinds)", () => {
      expect(sheerKindFor(spec("skyplateau"))).toMatchObject({ kind: { id: "sky-plateau" }, asked: "skyplateau" });
      expect(sheerKindFor(spec("waterfall"))).toMatchObject({ kind: { id: "waterfall-terraces" }, asked: "waterfall" });
      expect(sheerKindsNearestFirst("정상")[0]!.id).toBe("summit");
      expect(sheerKindFor(spec("summit"))).toEqual({ kind: expect.objectContaining({ id: "summit" }) });
      const p = createBlankProject() as Project, ctx = { project: p, currentMapId: p.startMapId, lookKey: "sheer-kind" };
      const r = builderFor(spec("skyplateau"))!.build(createBuildRun(ctx), spec("skyplateau"));
      expect(r.ok, r.summary).toBe(true);
      expect(r.warnings.join(" ")).toMatch(/hints\.kind "skyplateau" is not a sheer terrain kind; built as sky-plateau \(nearest\)/u);
      for (const k of SHEER_KINDS) expect(r.warnings.join(" ")).toContain(`${k.id} (`);
    });

    it.each(SHEER_KINDS.map((k) => k.id))("%s: builds a sheer map (3–5 levels; the glade one) on the blank start map, every goal reachable", (kindId) => {
      const kind = SHEER_KINDS.find((k) => k.id === kindId)!;
      const p = createBlankProject() as Project, ctx = { project: p, currentMapId: p.startMapId, lookKey: "sheer-kind" };
      const s = spec(kindId, { salt: 1 });
      const r = builderFor(s)!.build(createBuildRun(ctx), s);
      expect(r.ok, r.summary).toBe(true);
      const map = ctx.project.maps[r.mapIds[0]!]!;
      expect(map.id).toBe(p.startMapId);
      expect([map.width, map.height]).toEqual([...kind.size.medium]);
      expect(map.relief?.style).toBe("sheer");
      const levels = new Set(map.relief!.levels.filter((v) => v > 0)).size;
      // the spirit-forest glade is one level (target scene 4 is flat ground ringed by forest); the cliff kinds are 3–5
      expect(levels).toBeGreaterThanOrEqual(kind.layout === "glade" ? 1 : 3);
      expect(levels).toBeLessThanOrEqual(kind.layout === "glade" ? 1 : 5);
      expect(r.summary).toMatch(/reach ok/u);
      expect(r.entrance).toMatchObject({ mapId: map.id });
      expect(ctx.project.startPos).toMatchObject({ x: r.entrance!.x, y: r.entrance!.y });
      if (kind.void) {
        expect(map.background?.showInEmptyCells).toBe(true);
        expect(r.summary).toContain(`Backdrop: preset ${kind.backdrop!.preset} (generate_map_background unavailable here).`);
      } else {
        expect(map.background).toBeUndefined();
        expect(r.summary).not.toContain("Backdrop");
      }
    });

    it("the backdrop line: a tip with view and prompt where the generator is reachable, the preset otherwise (v2 has no generator)", () => {
      expect(mapBackgroundGenerationReachable()).toBe(false);
      const bg = { preset: "oprn-clouds", view: "surface" as const, prompt: "a sea of soft white clouds" };
      expect(sheerBackdropLine(bg, true)).toBe('Tip: generate_map_background view=surface prompt="a sea of soft white clouds" for a custom backdrop (preset oprn-clouds is set now).');
      expect(sheerBackdropLine(bg, false)).toBe("Backdrop: preset oprn-clouds (generate_map_background unavailable here).");
      expect(sheerBackdropLine(undefined)).toBeUndefined();
    });

    it("the model reads the kinds where it picks an outdoor place: the village card, the land answer and the forest-route line, all made from sheerTerrainKinds.json", () => {
      // 2026-11-17 감독: 실제 조수 네 번(구름 위 고원 · 절벽 숲 · 산 정상 · 정령의 숲 빈터)이 한 번도 깎아지른 지형 종류를 고르지 않았다 —
      // 종류는 make_place 스키마의 hints.kind 설명에만 있었고, 지시문의 마을 카드와 «숲» 이 싣는 숲길 줄에는 없었다.
      const cards = V2_CARDS.join("\n");
      for (const k of SHEER_KINDS) expect(cards).toContain(`${k.id} (${k.hint})`);
      expect(VILLAGE_CARD).toContain(SHEER_KINDS_CARD_LINE);
      for (const theme of ["river", "coast"]) for (const k of SHEER_KINDS) expect(villageKindsLine(theme)!).toContain(`${k.id} (${k.hint})`);
      const forest = gameCard(["forest"]);
      expect(forest).toContain("author_forest_route{");
      expect(forest).toContain("make_place kinds");
      for (const k of SHEER_KINDS) expect(forest).toContain(k.id);
      const kindDesc = (PLACE_SPEC_SCHEMA.properties.hints as { properties: { kind: { description: string } } }).properties.kind.description;
      for (const k of SHEER_KINDS) expect(kindDesc).toContain(k.id);
      // 손으로 쓴 낱말 목록이 아니다: 줄은 표의 id 와 hint 를 그대로 잇는다
      expect(SHEER_KINDS_CARD_LINE).toContain(SHEER_KINDS.map((k) => `${k.id} (${k.hint})`).join(" · "));
    });
  });
});

describe("aiV2ShipGate", () => {
  isolateTimers();
  const WHOLE = "마을 하나 만들어줘. 거기서 시작하는 모험 게임으로";
  const CONTINUE = "아직 다 안 된 것 같아. 처음에 부탁한 대로 끝까지 만들어 줘. 게임을";
  function adventure(): Project {
    const p = createBlankProject() as Project;
    p.meta.title = "새벽의 약속";
    // 이 게임이 올린 타이틀 그림 — 등록(assets.uploaded)돼 있어야 «이 게임의 그림» 이다. 등록되지 않은 id 는 엔진이 싣고 온 번들 그림으로 본다(isBundledPictureId).
    p.assets.uploaded["bg-dawn-village"] = { id: "bg-dawn-village" } as never;
    p.system.titleScreen = { ...p.system.titleScreen!, title: "새벽의 약속", backgroundResourceId: "bg-dawn-village" };
    p.gameBlueprint = {
      request: WHOLE, title: "새벽의 약속", premise: "마을에서 시작하는 모험", playerGoal: "등불을 밝힌다", steps: [],
      ending: { name: "새벽의 약속", how: "등불을 밝혀 마을에 희망을 되찾는다", feeling: "희망" },
    } as never;
    p.endings = [{ id: "e1", name: "새벽의 약속", conditions: [], priority: 0, presentation: { finalTitle: "새벽의 약속", backgroundResourceId: "oprn-still-kingdom-day" }, epilogue: [] } as never];
    return p;
  }
  describe("ship gate keeps checking a continuation turn", () => {
    it("a blueprint remembers the first request, so 'finish it' still counts as building a whole game", () => {
      const p = adventure();
      expect(buildsWholeGame(p, CONTINUE)).toBe(true);
      expect(buildsWholeGame(createBlankProject() as Project, CONTINUE)).toBe(false);
      expect(shipBlockers(p, CONTINUE).map((b) => b.id)).toContain("ending-bg");
    });

    it("an ending that sits on the engine's default opening picture is blocked even when the start project already had it", () => {
      const p = adventure();
      const text = shipBlockers(p, WHOLE).find((b) => b.id === "ending-bg")!;
      const problem = gateProblems([tagged("ship", "ending-bg", text.message)])[0]!;
      const baselineKeys = new Set([problem.textKey!]);
      const split = splitPreexisting([problem], baselineKeys, undefined, undefined);
      expect(split.current).toHaveLength(1);
      expect(split.preexisting).toHaveLength(0);
      const other = gateProblems([tagged("scene", "repeat", "같은 줄")])[0]!;
      expect(splitPreexisting([other], new Set([other.textKey!]), undefined, undefined).preexisting).toHaveLength(1);
    });
  });
  describe("the harness no longer paints the title or ending picture itself", () => {
    it("leaves a default ending picture in place so the ship check keeps blocking the finish", () => {
      const factory = factoryArtResourceIds();
      expect(factory.has("oprn-still-kingdom-day")).toBe(true);
      const p = adventure();
      const applied = applyShipDefaults(p, CONTINUE);
      expect(p.endings[0]!.presentation!.backgroundResourceId).toBe("oprn-still-kingdom-day");
      expect(applied.some((line) => line.includes("그림"))).toBe(false);
      expect(shipBlockers(p, CONTINUE).map((b) => b.id)).toContain("ending-bg");
    });

    it("does not give a bare ending a bundled still either", () => {
      const p = adventure();
      p.endings[0]!.presentation = undefined as never;
      p.endings[0]!.epilogue = [{ kind: "say", text: "끝." } as never];
      applyShipDefaults(p, WHOLE);
      expect(p.endings[0]!.presentation?.backgroundResourceId).toBeUndefined();
      expect(shipBlockers(p, WHOLE).map((b) => b.id)).toContain("ending-screen");
    });

    it("leaves a picture the author chose alone", () => {
      const p = adventure();
      p.endings[0]!.presentation = { finalTitle: "끝", backgroundResourceId: "bg-lantern-night" } as never;
      applyShipDefaults(p, WHOLE);
      expect(p.endings[0]!.presentation!.backgroundResourceId).toBe("bg-lantern-night");
      expect(shipBlockers(p, WHOLE).map((b) => b.id)).not.toContain("ending-bg");
    });
  });
  describe("a finished game must open with an opening", () => {
    it("flags an opening that is switched off or has no scenes, and passes one with scenes or a stage", () => {
      const p = createBlankProject() as Project;
      p.system.opening = { ...p.system.opening!, enabled: false, scenes: [] };
      expect(openingMissing(p).map((b) => b.id)).toEqual(["opening-missing"]);
      p.system.opening = { ...p.system.opening!, enabled: true, scenes: [] };
      expect(openingMissing(p)).toHaveLength(1);
      p.system.opening = { ...p.system.opening!, enabled: true, scenes: [{ id: "s1", kind: "text", narration: "새벽마을의 등불이 꺼졌다.", durationMs: 3000 } as never] };
      expect(openingMissing(p)).toHaveLength(1);
      p.system.opening = { ...p.system.opening!, enabled: true, scenes: [
        { id: "s1", kind: "text", narration: "새벽마을의 등불이 꺼졌다.", durationMs: 3000 } as never,
        { id: "s2", kind: "text", narration: "이안은 낡은 표지판을 향해 걸었다.", durationMs: 3000 } as never,
      ] };
      expect(openingMissing(p)).toHaveLength(0);
      p.system.opening = { ...p.system.opening!, enabled: true, scenes: [
        { id: "s1", kind: "text", narration: "  ", durationMs: 3000 } as never,
        { id: "s2", kind: "text", narration: "", durationMs: 3000 } as never,
      ] };
      expect(openingMissing(p)).toHaveLength(1);
      p.system.opening = { ...p.system.opening!, enabled: true, scenes: [], stage: { mapId: p.startMapId, x: 1, y: 1, eventId: "ev_opening_stage" } as never };
      expect(openingMissing(p)).toHaveLength(0);
    });

    it("shows up in the whole-game ship list and not for a small edit", () => {
      const p = adventure();
      p.system.opening = { ...p.system.opening!, enabled: false, scenes: [] };
      expect(shipBlockers(p, WHOLE).map((b) => b.id)).toContain("opening-missing");
      const blank = createBlankProject() as Project;
      blank.system.opening = { ...blank.system.opening!, enabled: false, scenes: [] };
      expect(shipBlockers(blank, "촌장을 광장으로 옮겨 줘")).toHaveLength(0);
    });
  });
  describe("a bundled still is not this game's picture", () => {
    it("blocks a bundled still on the title and on the ending, and passes the game's own map view", () => {
      const p = adventure();
      p.system.titleScreen = { ...p.system.titleScreen!, backgroundResourceId: "oprn-still-farm-golden" };
      p.endings[0]!.presentation = { finalTitle: "끝", backgroundResourceId: "oprn-pack-still-sky-01" } as never;
      expect(bundledPictureLeft(p).map((b) => b.evidence.split("=")[0])).toEqual(["titleScreen.backgroundResourceId", expect.stringContaining("endings[e1]")]);
      expect(shipBlockers(p, WHOLE).map((b) => b.id)).toContain("bundled-picture");
      const start = p.maps[p.startMapId!]!;
      expect(blankMap(start)).toBe(true);
      p.system.titleScreen = { ...p.system.titleScreen!, backgroundResourceId: `map-view:${p.startMapId}` };
      p.endings[0]!.presentation = { finalTitle: "끝", backgroundResourceId: `map-view:${p.startMapId}` } as never;
      expect(bundledPictureLeft(p).map((b) => b.message)).toEqual([expect.stringContaining("빈 맵"), expect.stringContaining("빈 맵")]);
      start.events.push({ id: "ev_sign", name: "표지판", x: 3, y: 3, pages: [{ conditions: [], trigger: "action", commands: [] }] } as never);
      expect(blankMap(start)).toBe(false);
      expect(bundledPictureLeft(p)).toHaveLength(0);
    });

    it("blocks any engine-bundled picture outside the stills catalog: a pack backdrop, an item icon, a panorama", () => {
      // 실측 2026-11-09 번들 1 측정: 엔딩 그림이 scarloxy-backdrop-forest·oprn-item-treasure-ruby-3·oprn-pano-… 로 끝났는데 스틸 카탈로그 판정이 놓쳤다.
      for (const id of ["scarloxy-backdrop-forest", "oprn-item-treasure-ruby-3", "oprn-pano-sky-01"]) {
        const p = adventure();
        p.endings[0]!.presentation = { finalTitle: "끝", backgroundResourceId: id } as never;
        expect(bundledPictureLeft(p).map((b) => b.evidence), id).toEqual([expect.stringContaining("endings[e1]")]);
      }
      const own = adventure();
      own.assets.uploaded["own-ending"] = { id: "own-ending" } as never;
      own.endings[0]!.presentation = { finalTitle: "끝", backgroundResourceId: "own-ending" } as never;
      expect(bundledPictureLeft(own)).toHaveLength(0);
      own.endings[0]!.presentation = { finalTitle: "끝", backgroundResourceId: `opening-still:forest_title_dark@1000` } as never;
      expect(bundledPictureLeft(own)).toHaveLength(0);
      // 프로젝트에 등록되지 않은 id 는 이름이 무엇이든 이 게임의 그림이 아니다(타이틀도 같다).
      const unregistered = adventure();
      unregistered.system.titleScreen = { ...unregistered.system.titleScreen!, backgroundResourceId: "bg-never-uploaded" };
      expect(bundledPictureLeft(unregistered).map((b) => b.evidence)).toContain("titleScreen.backgroundResourceId=bg-never-uploaded");
    });

    it("lets the romance key art through only in a romance game, and an uploaded or generated picture always", () => {
      const p = adventure();
      p.system.titleScreen = { ...p.system.titleScreen!, backgroundResourceId: "oprn-title-romance-campus" };
      // 생성 그림은 generate_art 가 upsert_resource 로 프로젝트에 등록한다 — 등록된 그림만 «이 게임의 그림» 으로 통과한다.
      p.assets.uploaded["generated-ending-dawn"] = { id: "generated-ending-dawn" } as never;
      p.endings[0]!.presentation = { finalTitle: "끝", backgroundResourceId: "generated-ending-dawn" } as never;
      // 연애 게임이 아니면 연애 키아트도 번들 그림이다(b1 school-1: 학교 추리 엔딩이 oprn-title-romance-school 로 통과했다).
      expect(bundledPictureLeft(p).map((b) => b.evidence.split("=")[0])).toEqual(["titleScreen.backgroundResourceId", expect.stringContaining("endings[e1]")].slice(0, 1));
      p.system.genreLock = { preset: "romance" } as never;
      expect(bundledPictureLeft(p)).toHaveLength(0);
    });

    it("is never excused as a preexisting defect on a continuation turn", () => {
      for (const id of ["bundled-picture", "ending-screen", "ending-bg", "title-image", "opening-missing"]) {
        const problem = gateProblems([tagged("ship", id, "남은 기본값")])[0]!;
        const split = splitPreexisting([problem], new Set([problem.textKey!]), undefined, undefined);
        expect(split.current, id).toHaveLength(1);
        expect(split.preexisting, id).toHaveLength(0);
      }
    });
  });
});

describe("aiV2SkillSchemaFill", () => {
  isolateTimers();
  /** 기록된 실행(2026-11-09 fs-use-tools E1 측정, gpt-6.1-terra)에서 모델이 보낸 모양: 의도한 칸 + 스키마 기본값 채움. */
  function filledSkillArgs(): Record<string, unknown> {
    return {
      skill: {
        id: "skill_castle_imp_flame", name: "임프의 불꽃", scope: "enemy", power: 18, elementId: "fire", type: "normal",
        description: "작은 불꽃으로 적 하나를 공격한다.", successRate: 100, hitRate: 100,
        effect: { kind: "damage", statistic: "mind", affects: "hp" },
        damageFormula: "18", maxPp: 10, gen1CriticalRate: "normal",
        exploitStates: { stateIds: [], bonusPercent: 1, consume: false },
        actionSkill: { kind: "melee", damage: 1, range: 1, speedTilesPerSec: 1, cooldownMs: 1000, durationMs: 1000, itemCost: { itemId: "", amount: 1 }, fieldStatus: { kind: "slow", durationMs: 1000 }, chargeTiers: [] },
        weather: { kind: "sun", turns: 3 }, fixedDamage: { mode: "amount", amount: 1 }, multiHit: { min: 2, max: 2 }, area: { shape: "circle", radius: 1 },
        battleGimmick: { pattern: "fire", durationTurns: 1 }, chargeBreak: { damage: 0, elementIds: [], stateIds: [], message: "", stagger: false },
        comboStaging: { tint: "", shake: "none", slowMo: false, kicker: "", partners: "auto" }, inputSequence: { keys: [], timeLimitMs: 300 },
        weaponAffinity: { elementIds: [], bonusPercent: 0 },
      },
      clearActionSkill: true, clearActionFieldStatus: false, clearActionItemCost: false,
    };
  }
  const schema = () => (getTool("upsert_skill") as unknown as { parameters: unknown }).parameters;
  const skillOf = (out: ReturnType<typeof preCheck>) => (out as { args: { skill: Record<string, unknown> } & Record<string, unknown> }).args;
  describe("upsert_skill schema-fill guard (fs-use-tools E1)", () => {
    it("drops the advanced fillers that were rejected or would silently change the skill, and the rest is accepted by the real tool", () => {
      const project = createBlankProject() as Project;
      const out = preCheck("upsert_skill", schema(), filledSkillArgs(), project);
      expect(out.kind).toBe("ok");
      const args = skillOf(out);
      for (const key of ["exploitStates", "actionSkill", "weather", "fixedDamage", "maxPp", "gen1CriticalRate", "damageFormula", "multiHit", "area", "battleGimmick", "chargeBreak", "comboStaging", "inputSequence", "weaponAffinity"]) {
        expect(args.skill).not.toHaveProperty(key);
      }
      expect(Object.keys(args).filter((k) => k.startsWith("clear"))).toEqual([]);
      expect(args.skill).toMatchObject({ id: "skill_castle_imp_flame", name: "임프의 불꽃", power: 18, elementId: "fire", scope: "enemy" });
      const draft = structuredClone(project);
      (getTool("upsert_skill") as unknown as { run: (d: Project, a: unknown) => unknown }).run(draft, args);
      const saved = draft.database.skills.find((s) => s.id === "skill_castle_imp_flame") as unknown as Record<string, unknown>;
      expect(saved.power).toBe(18);
      expect(saved.multiHit).toBeUndefined();
      expect(saved.area).toBeUndefined();
    });

    it("keeps an advanced field the skill itself asks for", () => {
      const project = createBlankProject() as Project;
      const args = filledSkillArgs();
      const skill = args.skill as Record<string, unknown>;
      skill.name = "연속 베기"; skill.description = "두 번 연타한다.";
      skill.exploitStates = { stateIds: ["state_poison"], bonusPercent: 50, consume: false };
      const kept = skillOf(preCheck("upsert_skill", schema(), args, project)).skill;
      expect(kept.multiHit).toEqual({ min: 2, max: 2 });
      expect(kept.exploitStates).toEqual({ stateIds: ["state_poison"], bonusPercent: 50, consume: false });
    });

    it("keeps gen1-only fields on a gen1 project", () => {
      const project = createBlankProject() as Project;
      (project.system as unknown as { battleModel: string }).battleModel = "gen1";
      const kept = skillOf(preCheck("upsert_skill", schema(), filledSkillArgs(), project)).skill;
      expect(kept.weather).toEqual({ kind: "sun", turns: 3 });
    });

    it("keeps clearActionSkill when the existing skill really has an action profile", () => {
      const project = createBlankProject() as Project;
      const base = project.database.skills[0] as unknown as Record<string, unknown>;
      project.database.skills.push({ ...base, id: "skill_castle_imp_flame", actionSkill: { kind: "melee", damage: 5, range: 2 } } as never);
      const args = { skill: { id: "skill_castle_imp_flame" }, clearActionSkill: true };
      const out = preCheck("upsert_skill", schema(), args, project);
      expect((skillOf(out) as Record<string, unknown>).clearActionSkill).toBe(true);
    });
  });
});
