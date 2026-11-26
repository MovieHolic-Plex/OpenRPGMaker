import { describe, expect, it, beforeEach } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import type { Project, TilesetDef, GameMap } from "@/project/types";
import { createBlankProject } from "@/project/defaults";
import { referenceOwner, referencePageStarts } from "@/project/tilesetReferences";
import { TilesetReferenceEvidence } from "@/ai/tilesetReferenceEvidence";
import type { ToolContext } from "@/editor/tools/types";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { isPassable } from "@/project/collision";
import { layerTileAt } from "@/project/mapLayers";
import { isolateTimers } from "./mergedTeardown";

describe("suggestGroupFromRange", () => {
  isolateTimers();
  describe("suggest_group_from_range", () => {
    it("suggests an autotile 3x3 grammar for a 3 by 3 terrain block", () => {
      const result = runTool(ctx(makeTileset({ count: 9, tilesPerRow: 3 })), "suggest_group_from_range", {
        rect: { h: 3, w: 3, x: 0, y: 0 },
        tilesetId: "range_tileset",
      });

      expect(result.ok).toBe(true);
      expect(dataOf(result).suggestion.patternGrammar.kind).toBe("autotile_3x3");
      expect(dataOf(result).suggestion.role).toBe("terrain");
      expect(dataOf(result).tileIds).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    });

    it("suggests a vertical expandable grammar for a two-cell vertical range", () => {
      const result = runTool(ctx(makeTileset({ count: 8, tilesPerRow: 4 })), "suggest_group_from_range", {
        rect: { h: 2, w: 1, x: 1, y: 0 },
        tilesetId: "range_tileset",
      });

      expect(result.ok).toBe(true);
      expect(dataOf(result).suggestion.patternGrammar.kind).toBe("vertical_expandable");
      expect(dataOf(result).suggestion.parts.map((part) => part.role)).toEqual(["top", "bottom"]);
      expect(dataOf(result).tileIds).toEqual([1, 5]);
    });

    it("suggests single prop for one upper-layer tile", () => {
      const result = runTool(ctx(makeTileset({ count: 4, priority: "upper", tilesPerRow: 4 })), "suggest_group_from_range", {
        rect: { h: 1, w: 1, x: 2, y: 0 },
        tilesetId: "range_tileset",
      });

      expect(result.ok).toBe(true);
      expect(dataOf(result).suggestion.patternGrammar.kind).toBe("single");
      expect(dataOf(result).suggestion.role).toBe("prop");
      expect(dataOf(result).tileIds).toEqual([2]);
    });

    it("clips a bottom-edge rect to existing tile ids", () => {
      const result = runTool(ctx(makeTileset({ count: 10, tilesPerRow: 4 })), "suggest_group_from_range", {
        rect: { h: 2, w: 2, x: 2, y: 1 },
        tilesetId: "range_tileset",
      });

      expect(result.ok).toBe(true);
      expect(dataOf(result).tileIds).toEqual([6, 7]);
    });
  });
  type SuggestionPart = {
    readonly role: string;
    readonly tileIds: readonly number[];
  };
  type SuggestGroupFromRangeData = {
    readonly suggestion: {
      readonly parts: readonly SuggestionPart[];
      readonly patternGrammar: { readonly kind: string };
      readonly role: string;
    };
    readonly tileIds: readonly number[];
  };
  function dataOf(result: ReturnType<typeof runTool>): SuggestGroupFromRangeData {
    if (!result.ok || !isSuggestData(result.data)) throw new Error("missing suggest data");
    return result.data;
  }
  function isSuggestData(value: unknown): value is SuggestGroupFromRangeData {
    if (typeof value !== "object" || value === null) return false;
    const record = recordValue(value);
    return Array.isArray(record.tileIds) && typeof record.suggestion === "object" && record.suggestion !== null;
  }
  function recordValue(value: object): Record<string, unknown> {
    return Object.fromEntries(Object.entries(value));
  }
  function ctx(tileset: TilesetDef): { project: Project } {
    return { project: projectWithTileset(tileset) };
  }
  function projectWithTileset(tileset: TilesetDef): Project {
    const project = createBlankProject();
    project.tilesets[tileset.id] = tileset;
    return project;
  }
  function makeTileset(args: {
    readonly count: number;
    readonly priority?: "lower" | "upper";
    readonly tilesPerRow: number;
  }): TilesetDef {
    return {
      count: args.count,
      id: "range_tileset",
      image: { id: "tex_tiles_default", type: "bundled" },
      name: "Range tileset",
      passability: Array.from({ length: args.count }, () => ({ down: true, left: true, right: true, up: true })),
      priority: Array.from({ length: args.count }, () => args.priority ?? "lower"),
      terrain: Array.from({ length: args.count }, () => 0),
      tileMeta: Array.from({ length: args.count }, () => ({ description: "", label: "" })),
      tileSize: 16,
      tilesPerRow: args.tilesPerRow,
    };
  }
});

// 한꺼번에 읽기: read_tileset_reference 에 documentId·imageId 를 빼면 용도의 이미지 전부와 MD 쪽을 한 응답에 준다.
// 2026-10-04 실측(버들항 길 깔기): 배치 관문이 물 용도 15건(MD 2쪽·이미지 13장)을 요구했고, 모델은 두 건 읽고 길을 포기했다.
describe("tilesetReferenceBundleRead", () => {
  isolateTimers();
  type Bundle = { documents: { id: string; offset: number }[]; images: { id: string }[]; remaining: unknown[]; after: string[] };
  function fixture() {
    const ctx: ToolContext = { project: createBlankProject() };
    const found = Object.values(ctx.project.tilesets)
      .map(tileset => ({ tileset, group: referenceOwner(ctx.project, tileset).referenceDocuments?.find(g => g.documents.length > 0 && g.images.length > 0) }))
      .find(entry => entry.group);
    if (!found) throw new Error("fixture: no bundled tileset with documents and images");
    return { ctx, tileset: found.tileset, group: found.group! };
  }
  describe("read_tileset_reference 한꺼번에 읽기", () => {
    it("모든 쪽을 이어 읽으면 낱장 읽기와 같은 쪽을 모두 받고, 이미지는 첫 묶음에만 온다", () => {
      const { ctx, tileset, group } = fixture();
      const seen = new Set<string>();
      let after: string[] = [];
      let imageCount = -1;
      for (let round = 0; round < 50; round++) {
        const result = runTool(ctx, "read_tileset_reference", { tilesetId: tileset.id, categoryId: group.id, ...(after.length ? { after } : {}) });
        expect(result.ok).toBe(true);
        const data = result.data as Bundle;
        if (round === 0) imageCount = data.images.length;
        else expect(data.images).toHaveLength(0);
        for (const document of data.documents) seen.add(`${document.id}:${document.offset}`);
        expect(JSON.stringify(data).length).toBeLessThanOrEqual(32_000);
        after = data.after;
        if (!data.remaining.length) break;
        expect(data.documents.length).toBeGreaterThan(0);
      }
      expect(imageCount).toBe(group.images.length);
      const expected = group.documents.flatMap(doc => referencePageStarts(doc.markdown).map(offset => `${doc.id}:${offset}`));
      expect([...seen].sort()).toEqual(expected.sort());
    });

    it("관문은 묶음으로 읽은 쪽을 읽은 것으로 치고, 남은 것은 이미지 전달뿐이다", () => {
      const { ctx, tileset, group } = fixture();
      const mapId = ctx.project.startMapId;
      ctx.project.maps[mapId]!.tilesetId = tileset.id;
      const evidence = new TilesetReferenceEvidence();
      const args = { mapId, layer: "lower", mode: "cells", tile: 12, cells: [{ x: 1, y: 1 }], referencePurpose: group.id };
      const first = evidence.beforeWrite(ctx.project, "paint_tiles", args);
      expect(first?.summary).toContain(`categoryId:"${group.id}"})`);
      let after: string[] = [];
      for (let round = 0; round < 50; round++) {
        const result = runTool(ctx, "read_tileset_reference", { tilesetId: tileset.id, categoryId: group.id, ...(after.length ? { after } : {}) });
        evidence.observe(result);
        const data = result.data as Bundle;
        after = data.after;
        if (!data.remaining.length) break;
      }
      const blocked = evidence.beforeWrite(ctx.project, "paint_tiles", args);
      expect(blocked?.summary).toContain(`(${group.images.length}건)`);
      expect(blocked?.summary).toContain("이미지 입력 전달 필요");
    });

    it("documentId 와 imageId 를 둘 다 주면 거절한다", () => {
      const { ctx, tileset, group } = fixture();
      const result = runTool(ctx, "read_tileset_reference", { tilesetId: tileset.id, categoryId: group.id, documentId: group.documents[0]!.id, imageId: group.images[0]!.id });
      expect(result.ok).toBe(false);
    });
  });
});

// 2026-09-24 헤드리스 r0735: 모델이 목록을 보기 전에 documentId 를 지어내
// 「MD 문서를 찾을 수 없습니다」만 받았다. 오류가 고를 수 있는 ID 를 함께 말해야 한다.
describe("tilesetReferenceUnknownIds", () => {
  isolateTimers();
  describe("read_tileset_reference unknown ids", () => {
    it("accepts a zero image offset and rejects pagination into an image", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const entry = Object.values(ctx.project.tilesets)
        .map(tileset => ({ tileset, group: referenceOwner(ctx.project, tileset).referenceDocuments?.find(g => g.images.length > 0) }))
        .find(candidate => candidate.group)!;
      const args = { tilesetId: entry.tileset.id, categoryId: entry.group!.id, imageId: entry.group!.images[0]!.id };
      const omitted = runTool(ctx, "read_tileset_reference", args);
      const zero = runTool(ctx, "read_tileset_reference", { ...args, offset: 0 });
      expect(omitted.ok).toBe(true);
      expect(zero).toEqual(omitted);
      expect(runTool(ctx, "read_tileset_reference", { ...args, offset: 1 }).ok).toBe(false);
    });

    it("lists valid document ids when the documentId is unknown", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const withDocs = Object.values(ctx.project.tilesets)
        .map(tileset => ({ tileset, group: referenceOwner(ctx.project, tileset).referenceDocuments?.find(g => g.documents.length > 0) }))
        .find(entry => entry.group);
      expect(withDocs, "a bundled tileset with reference documents").toBeDefined();
      const { tileset, group } = withDocs!;
      const result = runTool(ctx, "read_tileset_reference", { tilesetId: tileset.id, categoryId: group!.id, documentId: `${group!.id}-guide-made-up` });
      expect(result.ok).toBe(false);
      expect(result.summary).toContain(group!.documents[0]!.id);
    });

    it("lists valid category ids when the categoryId is unknown", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const tileset = Object.values(ctx.project.tilesets).find(t => (referenceOwner(ctx.project, t).referenceDocuments ?? []).length > 0)!;
      const first = referenceOwner(ctx.project, tileset).referenceDocuments![0]!.id;
      const result = runTool(ctx, "read_tileset_reference", { tilesetId: tileset.id, categoryId: "nope", documentId: "x" });
      expect(result.ok).toBe(false);
      expect(result.summary).toContain(first);
    });
  });
});

// 챗봇 툴 확장(2026-07-04): upsert_skill/equipment/class/state/common_event
// + get_database_records + set_tile_passability.
describe("toolsExtended", () => {
  isolateTimers();
  function ctx(): ToolContext {
    return { project: createBlankProject() };
  }
  describe("DB upsert 확장 툴", () => {
    it("upsert_skill이 스킬을 추가한다", () => {
      const context = ctx();
      const result = runTool(context, "upsert_skill", { skill: { id: "skill_fire", name: "파이어", power: 30 } });
      expect(result.ok, result.summary).toBe(true);
      const record = context.project.database.skills.find((entry) => entry.id === "skill_fire");
      expect(record?.name).toBe("파이어");
      expect(record?.power).toBe(30);
    });

    it("upsert_equipment이 장비를 추가한다", () => {
      const context = ctx();
      const result = runTool(context, "upsert_equipment", { equipment: { id: "eq_sword", name: "청동검", slot: "weapon", price: 120 } });
      expect(result.ok, result.summary).toBe(true);
      expect(context.project.database.equipment.some((entry) => entry.id === "eq_sword")).toBe(true);
    });

    it("upsert_class가 클래스를 추가한다", () => {
      const context = ctx();
      const result = runTool(context, "upsert_class", { class: { id: "class_mage", name: "마법사" } });
      expect(result.ok, result.summary).toBe(true);
      expect(context.project.database.classes.some((entry) => entry.id === "class_mage")).toBe(true);
    });

    it("upsert_state가 상태를 추가하고 같은 id로 수정한다", () => {
      const context = ctx();
      expect(runTool(context, "upsert_state", { state: { id: "state_burn", name: "화상" } }).ok).toBe(true);
      const modified = runTool(context, "upsert_state", { state: { id: "state_burn", name: "화상", priority: 5 } });
      expect(modified.ok).toBe(true);
      const records = context.project.database.states.filter((entry) => entry.id === "state_burn");
      expect(records).toHaveLength(1);
      expect(records[0].priority).toBe(5);
    });

    it("upsert_common_event가 커먼 이벤트를 추가한다", () => {
      const context = ctx();
      const result = runTool(context, "upsert_common_event", {
        id: "ce_greet",
        name: "인사",
        trigger: "none",
        commands: [{ kind: "text", body: "안녕하세요" }],
      });
      expect(result.ok, result.summary).toBe(true);
      const record = context.project.commonEvents.find((entry) => entry.id === "ce_greet");
      expect(record?.trigger).toBe("none");
      expect(record?.commands).toHaveLength(1);
    });

    it("upsert_common_event commands 단수 객체 입력은 배열로 승격하고 warning을 남긴다", () => {
      const context = ctx();
      const result = runTool(context, "upsert_common_event", {
        id: "ce_single",
        name: "단수",
        trigger: "none",
        commands: { kind: "text", body: "한 줄" },
      });

      expect(result.ok, result.summary).toBe(true);
      expect(result.diff?.warnings.join("\n")).toContain("common_event.ce_single.commands 단일 커맨드 객체를 Command[] 배열로 감쌌습니다");
      const record = context.project.commonEvents.find((entry) => entry.id === "ce_single");
      expect(record?.commands).toEqual([{ kind: "text", body: "한 줄" }]);
    });

    it("upsert_common_event와 run_lint가 런타임 지원 제한 warning을 노출한다", () => {
      const context = ctx();
      const result = runTool(context, "upsert_common_event", {
        id: "ce_comment",
        name: "주석",
        trigger: "none",
        commands: [{ kind: "m2Command", commandId: "m2-088-comment", fields: { comment: "런타임 무효과" } }],
      });

      expect(result.ok, result.summary).toBe(true);
      expect(result.summary).toContain("런타임 제한 커맨드 1건");
      expect(result.data).toMatchObject({ unsupportedCommands: 1 });
      expect(result.issues?.some((issue) => issue.severity === "warning" && issue.code === "runtime-support:m2-088-comment")).toBe(true);

      const lint = runTool(context, "run_lint", {});
      expect(lint.ok, lint.summary).toBe(true);
      const data = lint.data as { issues: Array<{ code: string; severity: string }> };
      expect(data.issues.some((issue) => issue.severity === "warning" && issue.code === "runtime-support:m2-088-comment")).toBe(true);
    });

    it("upsert_common_event는 잘못된 커맨드를 거부한다", () => {
      const context = ctx();
      const result = runTool(context, "upsert_common_event", {
        id: "ce_bad",
        name: "불량",
        commands: [
          { kind: { command: "text" }, body: "객체 kind" },
          { body: "kind 없음" },
        ],
      });
      expect(result.ok).toBe(false);
      expect(result.issues?.[0]?.code).toBe("invalid-args");
      const message = result.issues?.[0]?.message ?? "";
      expect(message).toContain("common_event.ce_bad.commands[0].kind");
      expect(message).toContain("common_event.ce_bad.commands[1].kind");
      expect(message).toContain("기대 형식 string");
      expect(message).toContain("커맨드 kind는 문자열");
      expect(message).toContain("event_command_assist나 고수준 툴");
      expect(message).toContain("올바른 1커맨드 예시 JSON: {\"commands\":[{\"kind\":\"text\",\"body\":\"안녕하세요\"}]}");
    });
  });
  describe("get_database_records", () => {
    it("컬렉션별 id/name 목록을 반환한다", () => {
      const context = ctx();
      for (const collection of ["items", "actors", "switches", "maps", "commonEvents"]) {
        const result = runTool(context, "get_database_records", { collection });
        expect(result.ok, `${collection}: ${result.summary}`).toBe(true);
        const records = (result.data as { records: { id: string; name: string }[] }).records;
        expect(Array.isArray(records)).toBe(true);
      }
    });

    it("maps 컬렉션은 실제 맵 id를 담는다", () => {
      const context = ctx();
      const result = runTool(context, "get_database_records", { collection: "maps" });
      const records = (result.data as { records: { id: string }[] }).records;
      expect(records.some((entry) => entry.id === context.project.startMapId)).toBe(true);
    });

    it("알 수 없는 컬렉션은 실패한다", () => {
      expect(runTool(ctx(), "get_database_records", { collection: "nope" }).ok).toBe(false);
    });
  });
  describe("set_tile_passability", () => {
    it("타일 통행성을 4방향 일괄 변경한다", () => {
      const context = ctx();
      // 342(FLOOR)는 겉보기와 달리 통행 불가로 검증된 함정 타일 — 통행 가능으로 바꿔 본다.
      const result = runTool(context, "set_tile_passability", { tile: 342, passable: true });
      expect(result.ok, result.summary).toBe(true);
      const map = context.project.maps[context.project.startMapId];
      const flags = context.project.tilesets[map.tilesetId].passability[342];
      expect(flags).toEqual({ up: true, down: true, left: true, right: true });
    });

    it("범위 밖 타일 인덱스는 실패한다", () => {
      const result = runTool(ctx(), "set_tile_passability", { tile: 99999, passable: false });
      expect(result.ok).toBe(false);
      expect(result.summary).toContain("범위 밖");
    });
  });
});

// 2026-09-24 연애 도그푸딩: 조수가 공략 인물에 event.graphic(sprite)을 줬는데 도구가 버려 세 인물이 투명·발밑이 됐다.
// 대사가 「오늘 이미 만났나」 fork 안에만 있어 대화 페이지로도 안 잡혔고, 「한여름」 은 사물로 오판됐다.
describe("upsertEventLevelGraphic", () => {
  isolateTimers();
  const SPRITE = { sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" }, direction: "down", pattern: 25 };
  const talkInFork = [{ kind: "fork", condition: { kind: "switch", switchId: "sw_met", value: true },
    then: [{ kind: "text", body: "한여름:\n내일 또 보자!" }], else: [{ kind: "text", body: "한여름:\n어? 왔어?" }] }];
  function page(ctx: { project: ReturnType<typeof createBlankProject> }, id: string) {
    return ctx.project.maps[ctx.project.startMapId]!.events.find((event) => event.id === id)!.pages![0]!;
  }
  describe("upsert_event 인물 그림", () => {
    it("이벤트 최상위 graphic 을 그림 없는 페이지에 입힌다", () => {
      const ctx = { project: createBlankProject() };
      const r = runTool(ctx, "upsert_event", { mapId: ctx.project.startMapId, event: { id: "ev_summer", name: "한여름", x: 3, y: 3, graphic: SPRITE, pages: [{ trigger: { kind: "action" }, commands: talkInFork }] } });
      expect(r.ok, r.summary).toBe(true);
      expect(page(ctx, "ev_summer").graphic).toMatchObject({ pattern: 25, sprite: { id: "tex_easyrpg_charset_people1" } });
      expect(page(ctx, "ev_summer").priority).toBe("same");
    });
    it("없는 sprite id 는 tex_ 접두로 맞추고, 못 맞추면 버려도 이벤트는 저장된다", () => {
      const ctx = { project: createBlankProject() };
      const fixed = runTool(ctx, "upsert_event", { mapId: ctx.project.startMapId, event: { id: "ev_a", name: "한여름", x: 3, y: 3, graphic: { ...SPRITE, sprite: { type: "bundled", id: "easyrpg_charset_people1" } }, pages: [{ trigger: { kind: "action" }, commands: talkInFork }] } });
      expect(fixed.ok, fixed.summary).toBe(true);
      expect(page(ctx, "ev_a").graphic?.sprite?.id).toBe("tex_easyrpg_charset_people1");
      const bogus = runTool(ctx, "upsert_event", { mapId: ctx.project.startMapId, event: { id: "ev_b", name: "윤서하", x: 5, y: 3, graphic: { ...SPRITE, sprite: { type: "bundled", id: "no_such_sheet" } }, pages: [{ trigger: { kind: "action" }, commands: talkInFork }] } });
      expect(bogus.ok, bogus.summary).toBe(true);
      expect(page(ctx, "ev_b").graphic?.sprite?.id).not.toBe("no_such_sheet");
    });
    it("fork 안 대사·「이름:」 본문이면 그림 없어도 인물로 보고 주민 그림을 세운다", () => {
      const ctx = { project: createBlankProject() };
      const r = runTool(ctx, "upsert_event", { mapId: ctx.project.startMapId, event: { id: "ev_summer", name: "한여름", x: 3, y: 3, pages: [{ trigger: { kind: "action" }, commands: talkInFork }] } });
      expect(r.ok, r.summary).toBe(true);
      expect(page(ctx, "ev_summer").graphic?.sprite).toBeDefined();
      expect(page(ctx, "ev_summer").priority).toBe("same");
    });
  });
});

// 버들항 도로(author_wild_route) — 2026-10-06 「1번 도로가 엉망진창」 수정의 계약.
// 시내 포석·계단 길·덤불 점박이·막다른 길 토막, 그리고 조수가 도로에 찍은 항구·농장 소품.
describe("wildRouteBeodeul", () => {
  isolateTimers();
  function routeProject(seed: number): { ctx: ToolContext; map: GameMap } {
    const project = createBlankProject();
    project.database.troops.push({ id: "troop_wild", name: "야생", members: [] } as unknown as Project["database"]["troops"][number]);
    const ctx: ToolContext = { project };
    expect(runTool(ctx, "create_map", { id: "map_route", name: "1번 도로", width: 24, height: 36, tilesetId: "beodeul_city" }, { dryRun: false }).ok).toBe(true);
    const result = runTool(ctx, "author_wild_route", {
      mapId: "map_route", exits: [{ x: 12, y: 35 }, { x: 12, y: 0 }], seed, encounters: [{ troopId: "troop_wild", weight: 1 }],
    }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    expect(result.warnings ?? []).toEqual([]);   // 출구끼리 걸어서 이어진다
    return { ctx, map: ctx.project.maps.map_route! };
  }
  beforeEach(() => {
    resetMapEditHistory();
  });
  describe("버들항 도로", () => {
    it.each([1, 15])("seed %i: 모랫길·숲 벽·필드 표시", (seed) => {
      const { ctx, map } = routeProject(seed);
      const tileset = ctx.project.tilesets.beodeul_city!;
      const sand = new Set(tileset.autotileGroups!.find(group => group.name === "버들항 모랫길")!.memberTileIds);
      const paving = new Set(tileset.autotileGroups!.find(group => group.name === "버들항 길 포석")!.memberTileIds);
      const path = map.lowerTiles.map((tile, index) => (sand.has(tile) ? index : -1)).filter(index => index >= 0);
      expect(path.length).toBeGreaterThan(30);
      expect(map.lowerTiles.some(tile => paving.has(tile))).toBe(false);

      // 막다른 모랫길 토막(4칸 이하 덩이, 출구 아님)이 없다.
      const onPath = new Set(path);
      const seen = new Set<number>();
      for (const start of path) {
        if (seen.has(start)) continue;
        const piece = [start];
        seen.add(start);
        for (let i = 0; i < piece.length; i++) {
          const at = piece[i]!, x = at % map.width;
          for (const next of [at - map.width, at + map.width, x > 0 ? at - 1 : -1, x < map.width - 1 ? at + 1 : -1]) {
            if (next >= 0 && onPath.has(next) && !seen.has(next)) { seen.add(next); piece.push(next); }
          }
        }
        const touchesEdge = piece.some(index => Math.floor(index / map.width) === 0 || Math.floor(index / map.width) === map.height - 1);
        if (!touchesEdge) expect(piece.length, `seed ${seed} 토막 ${piece.slice(0, 4).join(",")}`).toBeGreaterThan(4);
      }

      // 숲 벽: 맵의 절반 이상이 나무·덤불로 덮인다(예전 흩뿌림은 3할 남짓). 나무 composer 는 2~4층에 겹쳐 쌓는다(2026-10-20).
      const covered = map.lowerTiles.filter((_, i) => ([2, 3, 4] as const).some(L => layerTileAt(map, L, i) >= 0)).length;
      expect(covered / (map.width * map.height)).toBeGreaterThan(0.5);
      expect(map.mapRole).toBe("field");

      // 일반 RPG(몬스터 수집 아님): 조우 풀숲·풀숲 로케이션이 없고 조우는 맵 전체, 짙은 풀 속 칸만으로 된 네모 판이 없다(2026-10-21 사용자 정정).
      expect((map.locations ?? []).some(location => location.id.startsWith("loc_wild_grass_"))).toBe(false);
      expect(map.encounterTable?.every(entry => !entry.conditions?.locationId)).toBe(true);
      const dark = tileset.autotileGroups!.find(group => group.id === "beodeul_dark_grass_woodland")!;
      const edge = new Set(dark.memberTileIds);
      // 숲 벽은 2026-10-24(#3314)부터 수관 오토타일이다 — 나무 composer 와 그 밑에 깔던 짙은 풀을 버렸다. 그래서 «나무 밑 짙은 풀이 가장자리 모양으로 풀린다» 는
      // 짙은 풀이 깔렸을 때만 묻는다(속 칸이 있으면 가장자리 칸도 있다). 지금 지키는 것은 수관 쪽이다: 수관이 이웃에 맞춰 여러 모양으로 풀리고
      // (2026-10-20 의 결함 — 같은 수관 그림이 바둑판처럼 되풀이됐다), 덮인 칸은 길섶 소품 몇 칸 말고는 걸어 들어갈 수 없는 벽이다.
      if (map.lowerTiles.some(tile => tile === 11628)) expect(map.lowerTiles.some(tile => edge.has(tile))).toBe(true);
      const canopyShapes = new Set<number>();
      let walkableCovered = 0;
      for (let i = 0; i < map.width * map.height; i++) {
        const upper = ([2, 3, 4] as const).map(L => layerTileAt(map, L, i)).filter(tile => tile >= 0);
        if (!upper.length) continue;
        upper.forEach(tile => canopyShapes.add(tile));
        if (isPassable(ctx.project, map, i % map.width, Math.floor(i / map.width))) walkableCovered++;
      }
      expect(canopyShapes.size).toBeGreaterThan(30);
      expect(walkableCovered).toBeLessThan(covered * 0.05);
      const core = (i: number) => map.lowerTiles[i] === 11628;
      for (let y = 0; y + 2 < map.height; y++) for (let x = 0; x + 2 < map.width; x++) {
        const i = y * map.width + x;
        // 속 칸(11628) 3×3 이 덮개 없이 드러나면(2~4층 비어 있음) 네모 판이다
        const bare3 = [0, 1, 2].every(dy => [0, 1, 2].every(dx => core(i + dy * map.width + dx) && ([2, 3, 4] as const).every(L => layerTileAt(map, L, i + dy * map.width + dx) < 0)));
        expect(bare3, `seed ${seed} (${x},${y})`).toBe(false);
      }
    });

    it("도로 맵에는 항구·농장 소품을 찍지 않고 숲길 소품은 찍는다", () => {
      const { ctx } = routeProject(1);
      const port = runTool(ctx, "stamp_object", { objectId: "kit:beodeul_city/bd-pick-fishing-port-lobster-pots", mapId: "map_route", x: 1, y: 1 }, { dryRun: false });
      expect(port.ok).toBe(false);
      expect(port.issues?.[0]?.code).toBe("settlement-prop-on-route");
      const town: ToolContext = { project: createBlankProject() };
      const onTown = runTool(town, "stamp_object", { objectId: "kit:beodeul_city/bd-pick-fishing-port-lobster-pots", mapId: town.project.startMapId, x: 2, y: 2 }, { dryRun: false });
      expect(onTown.ok, onTown.summary).toBe(true);
    });

    it("길 위 짐(짐수레·자루 더미)은 도로 맵에도 찍을 수 있고 장터 노점은 막는다", () => {
      const { ctx } = routeProject(1);
      const stall = runTool(ctx, "stamp_object", { objectId: "kit:beodeul_city/bd-pick-walled-market-cloth-stall", mapId: "map_route", x: 1, y: 1 }, { dryRun: false });
      expect(stall.issues?.[0]?.code).toBe("settlement-prop-on-route");
      const wagon = runTool(ctx, "stamp_object", { objectId: "kit:beodeul_city/bd-pick-walled-market-wagon", mapId: "map_route", x: 1, y: 1, onOverlap: "nearest" }, { dryRun: false });
      expect(wagon.issues?.some((i) => i.code === "settlement-prop-on-route") ?? false, wagon.summary).toBe(false);
    });
  });
});
