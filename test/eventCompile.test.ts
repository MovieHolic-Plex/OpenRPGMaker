import { describe, expect, it, afterEach } from "vitest";
import { ToolReadEvidence } from "@/ai/toolReadEvidence";
import { compileSimplePages, CRYSTAL_ICON_ID, resolveGraphic, compileSimplePage, resolveGraphicQuery, charsetGraphic } from "@/editor/tools/eventCompile";
import { normalizeArgsForSchema } from "@/editor/tools/jsonSchema";
import { COMMAND_SCHEMA, CONDITION_SCHEMA, SIMPLE_PAGE_SCHEMA } from "@/editor/tools/schemaShapes";
import { getTool } from "@/editor/tools/toolRegistry";
import { runTool } from "@/editor/tools/toolRunner";
import { COMMAND_KINDS, CONDITION_KINDS } from "@/project/commandKindRegistry";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import type { Command, EventPageCondition, EventPage, EventPageGraphic, GameEvent, GameMap, Project } from "@/project/types";
import { charsetGraphicKey, queryNpcGraphics, resolveNpcGraphic } from "@/assets/charsetQuery";
import { CHARSET_ASSETS } from "@/assets/charsetCatalog";
import { CHARSET_SEMANTICS, findCharsetSemantic } from "@/assets/charsetSemantics";
import { decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import { resolvePlaceableOverlayGraphic } from "@/player/placeableOverlayGraphics";
import { stripSpeakerEcho } from "@/project/dialogueSpeakerEcho";
import { reviewedFaceIdForCharset } from "@/assets/reviewedCharsetFaces";
import type { ToolContext } from "@/editor/tools/types";
import { clearToolImageEventSpriteCache, resolveRegionEventSprites } from "@/ai/toolImageEventSprites";
import { installCurrentMonsterArt, preloadCurrentMonsterArt } from "@/assets/currentMonsterArt";
import { renderToolImages, type RenderedToolImage } from "@/ai/toolImageRenderer";
import { renderHarmonyMapImages } from "@/ai/ultrabrainImage";
import { decodeDataUrlPng, installToolImageRasterDom, pixelDiffRatio, type PngRaster } from "./toolImageRasterDom";
import { isolateTimers } from "./mergedTeardown";

describe("aiCommandSchemaContract", () => {
  isolateTimers();
  describe("advertised command and condition contract", () => {
    it("advertises only executable kinds in command positions", () => {
      expect(COMMAND_SCHEMA.properties?.kind?.enum).toEqual([...COMMAND_KINDS]);
      const conditionOnly = CONDITION_KINDS.filter(kind => !COMMAND_KINDS.some(command => command === kind));
      for (const kind of conditionOnly) expect(COMMAND_SCHEMA.properties?.kind?.enum).not.toContain(kind);
    });

    it("exposes canonical operators, ending selection and item presence", () => {
      expect(COMMAND_SCHEMA.properties?.op).toMatchObject({ type: "string", enum: expect.arrayContaining(["=", "+=", "-="]) });
      expect(COMMAND_SCHEMA.properties?.endingId).toMatchObject({ type: "string" });
      expect(CONDITION_SCHEMA.properties?.present).toMatchObject({ type: "boolean" });
    });

    it("exposes polymorphic values without a false single-type constraint", () => {
      // Provider schemas forbid unions; kind-specific shape validators own the types.
      for (const schema of [COMMAND_SCHEMA, CONDITION_SCHEMA]) {
        expect(schema.properties).toHaveProperty("value");
        expect(schema.properties?.value?.type).toBeUndefined();
      }
      const commands: Command[] = [
        { kind: "setSwitch", switchId: "sw_1", value: false },
        { kind: "setSwitch", switchId: "sw_1", value: "toggle" },
        { kind: "setVariable", variableId: "var_1", op: "=", value: 1.5 },
        { kind: "setVariable", variableId: "var_1", op: "=", value: { kind: "var", id: "var_2" } },
      ];
      expect(normalizeArgsForSchema(SIMPLE_PAGE_SCHEMA, { commands })).toEqual({ commands });
    });

    it.each(["upsert_event", "place_npc", "upsert_common_event", "define_ending"])("find_tools returns the registered %s schema", name => {
      const tool = getTool(name);
      expect(tool).toBeDefined();
      const result = runTool({ project: createBlankProject() }, "find_tools", { query: name, limit: 1 });
      expect(result.ok, result.summary).toBe(true);
      expect(result.data).toMatchObject({ matches: [{ name, parameters: tool?.parameters }] });
    });
  });
  function fixture() {
    const context = { project: createBlankProject() };
    const switchId = context.project.switches[0]?.id;
    const variableId = context.project.variables[0]?.id;
    if (!switchId || !variableId) throw new Error("Blank project needs flag slots");
    const ending = runTool(context, "define_ending", { id: "ending_schema", name: "Schema ending", conditions: [] });
    expect(ending.ok, ending.summary).toBe(true);
    const commands: Command[] = [
      { kind: "changeItem", itemId: "item_potion", op: "-=", amount: 1 },
      { kind: "setSwitch", switchId, value: true },
      { kind: "setSwitch", switchId, value: "toggle" },
      { kind: "setVariable", variableId, op: "=", value: 2.5 },
      { kind: "triggerEnding", endingId: "ending_schema" },
      { kind: "triggerEnding" },
    ];
    const conditions: EventPageCondition[] = [
      { kind: "item", itemId: "item_potion", present: true },
      { kind: "switch", switchId, value: false },
      { kind: "variable", variableId, op: ">=", value: 0 },
    ];
    return { context, commands, conditions, mapId: context.project.startMapId };
  }
  describe("canonical commands through authoring and persistence", () => {
    it("compiles and serializes item removal, typed values, item presence and both ending invocations", () => {
      const { context, mapId, commands, conditions } = fixture();
      const pages = compileSimplePages("ev_schema", "Schema", [{ conditions, commands }], { transparent: true }, { injectFace: false });
      expect(pages[0]?.commands).toEqual(commands);
      expect(pages[0]?.conditions).toEqual(conditions);
      const result = runTool(context, "upsert_event", {
        mapId, event: { id: "ev_schema", x: 3, y: 3, pages },
      });
      expect(result.ok, result.summary).toBe(true);
      const reloaded = deserialize(serialize(context.project));
      const event = reloaded.maps[mapId]?.events.find(entry => entry.id === "ev_schema");
      expect(event?.pages?.[0]?.commands).toEqual(commands);
      expect(event?.pages?.[0]?.conditions).toEqual(conditions);
    });

    it.each([
      { kind: "switch", switchId: "sw_1", value: true },
      { kind: "removeItem", itemId: "item_potion", amount: 1 },
      { kind: "setSwitch", switchId: "sw_1", value: 1 },
      { kind: "setVariable", variableId: "var_1", op: "=", value: "toggle" },
    ])("rejects invalid command $kind atomically rather than dropping effects", invalid => {
      const { context, mapId, commands } = fixture();
      const before = serialize(context.project);
      const result = runTool(context, "upsert_event", {
        mapId, event: { id: "ev_invalid", x: 3, y: 3, commands: [...commands, invalid] },
      });
      expect(result.ok, result.summary).toBe(false);
      expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "invalid-args" })]));
      expect(serialize(context.project)).toBe(before);
    });

    it.each([
      { kind: "switch", switchId: "sw_1" },
      { kind: "variable", variableId: "var_1", op: ">=" },
      { kind: "item", itemId: "item_potion" },
      // The string "true" is now read as a boolean (#3226, jsonSchema.ts); a non-boolean word stays a type error.
      { kind: "item", itemId: "item_potion", present: "yes" },
    ])("rejects missing or mistyped condition values for $kind atomically", condition => {
      const { context, mapId, commands } = fixture();
      const before = serialize(context.project);
      const result = runTool(context, "place_npc", {
        mapId, id: "ev_invalid", name: "Schema", x: 3, y: 3,
        pages: [{ commands, conditions: [condition] }],
      });
      expect(result.ok, result.summary).toBe(false);
      expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "invalid-args" })]));
      expect(serialize(context.project)).toBe(before);
    });

    it("still requires reference reads before the canonical item-removal write", () => {
      const { context, mapId, commands } = fixture();
      const args = { mapId, event: { id: "ev_schema", x: 3, y: 3, commands } };
      const evidence = new ToolReadEvidence();
      evidence.begin({ project: false, collections: [], references: true });
      expect(evidence.beforeWrite(context.project, "upsert_event", args)?.ok).toBe(false);
      const readArgs = { collection: "items", ids: ["item_potion"], include: "full" };
      evidence.observe("get_database_records", readArgs, runTool(context, "get_database_records", readArgs));
      expect(evidence.beforeWrite(context.project, "upsert_event", args)).toBeNull();
    });
  });
});

// 2026-11-07 물건 2(Object2) 원본 화소 재대조의 회귀 못 — 「ai 조수가 자꾸 이거 왜 보석이라 판단하는거임?」.
// 6번은 회색 바위다. 수정·보석은 칩 시트에 없으므로 번들 수정 그림(cc0-jetrel-crystal)으로 선다.
describe("charsetObjectSemantics", () => {
  isolateTimers();
  const OBJECT2 = "tex_easyrpg_charset_object2";
  const keys = (query: string) => queryNpcGraphics(query, 100).map((match) => charsetGraphicKey(match.entry));
  describe("물건 2 칸 의미는 그려진 그림과 같다", () => {
    it("보석·크리스탈·수정·보물 질의는 바위 칸을 고르지 않는다", () => {
      for (const query of ["보석", "크리스탈", "수정", "보물", "gem", "crystal"]) {
        expect(keys(query), query).not.toContain(`${OBJECT2}#6`);
        expect(keys(query), query).not.toContain(`${OBJECT2}#5`);
      }
      for (const query of ["보석", "크리스탈"]) {
        expect(resolveNpcGraphic(query)?.textureKey, query).not.toBe(OBJECT2);
      }
    });

    it("바위·돌·광산 수레·레버는 맞는 물건 2 칸을 고른다", () => {
      expect(keys("바위")).toEqual(expect.arrayContaining([`${OBJECT2}#5`, `${OBJECT2}#6`]));
      expect(keys("돌")).toEqual(expect.arrayContaining([`${OBJECT2}#5`, `${OBJECT2}#6`]));
      expect(charsetGraphicKey(resolveNpcGraphic("회색 바위")!)).toBe(`${OBJECT2}#6`);
      expect(charsetGraphicKey(resolveNpcGraphic("광산 수레")!)).toBe(`${OBJECT2}#7`);
      expect(keys("레버").slice(0, 2).sort()).toEqual([`${OBJECT2}#0`, `${OBJECT2}#1`]);
      expect(keys("서랍장")).not.toContain(`${OBJECT2}#7`);
    });

    it("place_savepoint 기본 그림은 바위가 아니라 수정 그림이다", () => {
      const project = createBlankProject();
      const result = getTool("place_savepoint")!.run(project, { mapId: project.startMapId, x: 2, y: 2 });
      const event = project.maps[project.startMapId]!.events.find((entry) => entry.id === (result.data as { eventId: string }).eventId)!;
      expect(event.pages![0]!.graphic.sprite).toEqual({ type: "bundled", id: CRYSTAL_ICON_ID });
    });

    it("수정 아이콘 id 를 graphic 으로 주면 칩 시트로 바꾸지 않는다", () => {
      expect(resolveGraphic({ textureKey: CRYSTAL_ICON_ID })).toEqual({ sprite: { type: "bundled", id: CRYSTAL_ICON_ID } });
    });

    it("보관 상자는 광산 수레로 서지 않는다", () => {
      const project = createBlankProject();
      const result = getTool("place_storage_chest")!.run(project, { mapId: project.startMapId, x: 4, y: 4, name: "창고" });
      const event = project.maps[project.startMapId]!.events.find((entry) => entry.id === (result.data as { eventId: string }).eventId)!;
      const graphic = event.pages![0]!.graphic;
      expect(`${graphic.sprite?.id}#${decodeCharsetFrameIndex(graphic.pattern ?? 0).characterIndex}`).not.toBe(`${OBJECT2}#7`);
    });

    it("채집 표식(gem)은 바위 칩이 아니라 수정 그림이다", () => {
      expect(resolvePlaceableOverlayGraphic("gem")?.texture).toBe(CRYSTAL_ICON_ID);
    });

    it("모든 의미 행은 실제 번들 시트의 0~7 칸을 가리킨다", () => {
      const sheets = new Set(CHARSET_ASSETS.map((asset) => asset.textureKey));
      for (const entry of CHARSET_SEMANTICS) {
        expect(sheets.has(entry.textureKey), entry.textureKey).toBe(true);
        expect(entry.characterIndex).toBeGreaterThanOrEqual(0);
        expect(entry.characterIndex).toBeLessThanOrEqual(7);
      }
    });
  });
});

describe("dialogueSpeakerEcho", () => {
  isolateTimers();
  describe("stripSpeakerEcho — 이름표와 같은 이름이 본문 앞에 또 붙은 줄", () => {
    it("「이름: 따옴표 본문」 은 이름과 바깥 따옴표를 걷는다", () => {
      expect(stripSpeakerEcho('한지훈: "반가워!"', "한지훈")).toBe("반가워!");
      expect(stripSpeakerEcho("서연：“오랜만이야.”", "서연")).toBe("오랜만이야.");
    });
    it("[이름] 머리표 줄도 걷는다", () => {
      expect(stripSpeakerEcho("[서연]\n안녕", "서연")).toBe("안녕");
    });
    it("여러 줄 본문은 이름만 걷고 따옴표는 그대로 둔다", () => {
      expect(stripSpeakerEcho('서연: "…오랜만이야."\n두번째 줄', "서연")).toBe('"…오랜만이야."\n두번째 줄');
    });
    it("이름표가 「서연 (소꿉친구 반장)」 이고 본문이 「서연: …」 이어도 걷는다(줄임 이름)", () => {
      expect(stripSpeakerEcho('서연: "아, 왔구나!"', "서연 (소꿉친구 반장)")).toBe("아, 왔구나!");
      expect(stripSpeakerEcho("도윤: 어서 오세요", "바리스타 선배 도윤")).toBe("어서 오세요");
    });
    it("이름이 다르거나 본문 속에 있으면 건드리지 않는다", () => {
      expect(stripSpeakerEcho("서연이: 안녕", "서연")).toBe("서연이: 안녕");
      expect(stripSpeakerEcho("그는 서연: 이라 불렀다", "서연")).toBe("그는 서연: 이라 불렀다");
      expect(stripSpeakerEcho("한지훈: 안녕", "서연")).toBe("한지훈: 안녕");
    });
    it("이름만 있던 본문은 비우지 않는다", () => {
      expect(stripSpeakerEcho("서연:", "서연")).toBe("서연:");
    });
    it("화자가 없으면 그대로다", () => {
      expect(stripSpeakerEcho("안녕", undefined)).toBe("안녕");
    });
    it("compileSimplePage / compileSimplePages 가 lines 와 commands 의 화자 머리표를 저장 시점에 걷는다", () => {
      const page = compileSimplePage(
        "ev_p0",
        "한서연 (도서관 선배)",
        {
          lines: ['한서연: "반가워!"'],
          commands: [{ kind: "text", speaker: "한서연", body: "한서연: 안녕" }],
        },
        { transparent: true },
        { injectFace: false },
      );
      expect(page.commands).toEqual([
        { kind: "text", speaker: "한서연 (도서관 선배)", body: "반가워!" },
        { kind: "text", speaker: "한서연", body: "안녕" },
      ]);
      const pages = compileSimplePages(
        "ev",
        "한서연",
        [{ lines: ['한서연: "반가워!"'], commands: [{ kind: "text", speaker: "한서연", body: "한서연: 안녕" }] }],
        { transparent: true },
        { injectFace: false },
      );
      expect(pages[0]?.commands).toEqual([
        { kind: "text", speaker: "한서연", body: "반가워!" },
        { kind: "text", speaker: "한서연", body: "안녕" },
      ]);
    });
  });
});

// 실사용 감사 로그(2026-07-04) 회귀: place_npc가 graphic.query="people1"로 실패했고
// 실패 요약에 원인이 없어 추적이 어려웠다. 시트명 질의 해석 + 실패 요약 원인 포함을 고정한다.
describe("placeNpcGraphicQuery", () => {
  isolateTimers();
  describe("place_npc graphic.query", () => {
    it("resolveGraphicQuery('people1')가 people1 시트 그래픽을 만든다", () => {
      const graphic = resolveGraphicQuery("people1");
      expect(graphic.sprite).toEqual({ type: "bundled", id: "tex_easyrpg_charset_people1" });
    });

    it("감사 로그의 place_npc 호출이 이제 성공한다", () => {
      const project = createBlankProject();
      const ctx: ToolContext = { project };
      const result = runTool(ctx, "place_npc", {
        mapId: project.startMapId,
        x: 2,
        y: 2,
        id: "npc_garden_1",
        name: "정원사 로빈",
        graphic: { query: "people1" },
        movement: "random",
        pages: [{ text: "아름다운 정원이군요." }],
      });
      expect(result.ok, result.summary).toBe(true);
    });

    it("자유 질의 old woman으로 노년 여성 그래픽을 배치한다", () => {
      const project = createBlankProject();
      const ctx: ToolContext = { project };
      const result = runTool(ctx, "place_npc", {
        mapId: project.startMapId,
        x: 2,
        y: 2,
        id: "npc_old_woman",
        name: "노년 여성",
        graphic: { query: "old woman" },
        pages: [{ text: "어서 오렴." }],
      });
      expect(result.ok, result.summary).toBe(true);
      const event = ctx.project.maps[project.startMapId].events.find((candidate) => candidate.id === "npc_old_woman");
      const graphic = event?.pages?.[0]?.graphic;
      const textureKey = graphic?.sprite?.id;
      const characterIndex = decodeCharsetFrameIndex(graphic?.pattern ?? 0).characterIndex;
      expect(findCharsetSemantic(textureKey ?? "", characterIndex)).toMatchObject({ gender: "female", age: "elder" });
    });

    it("그래픽 해석 실패는 주민 그림으로 대체하지 않고 graphic-not-found 로 거절한다", () => {
      // 2026-09-27: 대체+경고를 되돌렸다 — 조수가 경고를 읽지 않아 「가시덫」「제단」이 마을 사람으로 저장됐다.
      const project = createBlankProject();
      const ctx: ToolContext = { project };
      const result = runTool(ctx, "place_npc", {
        mapId: project.startMapId,
        x: 2,
        y: 2,
        id: "npc_fail",
        name: "실패 NPC",
        graphic: { query: "존재하지않는그래픽xyz" },
        pages: [{ text: "..." }],
      });
      expect(result.ok).toBe(false);
      expect(result.issues?.[0]?.code).toBe("graphic-not-found");
      expect(result.issues?.[0]?.message).toContain("존재하지않는그래픽xyz");
      expect(ctx.project.maps[project.startMapId]?.events.find((event) => event.id === "npc_fail")).toBeUndefined();
    });

    it("default villager graphics diversify across sequential placements", () => {
      const project = createBlankProject();
      const ctx: ToolContext = { project };
      const keys = new Set<string>();
      for (let i = 0; i < 6; i += 1) {
        const result = runTool(ctx, "place_npc", {
          mapId: project.startMapId,
          x: 1 + (i % 3),
          y: 1 + Math.floor(i / 3),
          id: `npc_div_${i}`,
          name: `주민 ${i}`,
          pages: [{ text: "안녕." }],
        });
        expect(result.ok, result.summary).toBe(true);
        const event = ctx.project.maps[project.startMapId].events.find((e) => e.id === `npc_div_${i}`);
        const g = event?.pages?.[0]?.graphic;
        const textureKey = g?.sprite?.id ?? "";
        const characterIndex = decodeCharsetFrameIndex(g?.pattern ?? 0).characterIndex;
        keys.add(`${textureKey}#${characterIndex}`);
      }
      // 6명 전부 같은 people1#0이면 실패 — 최소 2종 이상
      expect(keys.size).toBeGreaterThanOrEqual(2);
    });

    it("places matching changeFace for diversified charset slots", () => {
      const project = createBlankProject();
      const ctx: ToolContext = { project };
      const faces = new Set<string>();
      for (let i = 0; i < 4; i += 1) {
        const id = `npc_face_${i}`;
        const result = runTool(ctx, "place_npc", {
          mapId: project.startMapId,
          x: 1 + i,
          y: 2,
          id,
          name: `주민F${i}`,
          pages: [{ text: "안녕." }],
        });
        expect(result.ok, result.summary).toBe(true);
        const event = ctx.project.maps[project.startMapId].events.find((e) => e.id === id);
        const cmds = event?.pages?.[0]?.commands ?? [];
        const face = cmds.find((c) => c.kind === "changeFace");
        const g = event?.pages?.[0]?.graphic;
        const characterIndex = decodeCharsetFrameIndex(g?.pattern ?? 0).characterIndex;
        // 정답지는 공용 대응표다. 짝이 없는 그림은 얼굴이 없어야 한다.
        const paired = reviewedFaceIdForCharset(g?.sprite?.id ?? "", characterIndex);
        if (!paired) { expect(face, `${id} 에 짝 없는 얼굴이 붙었다`).toBeUndefined(); continue; }
        expect(face, `missing changeFace for ${id}`).toBeTruthy();
        if (face && face.kind === "changeFace") {
          faces.add(face.resourceId);
          expect(face.resourceId).toBe(paired);
        }
      }
      expect(faces.size).toBeGreaterThanOrEqual(1);
    });
  });
});

describe("toolImageEventRender", () => {
  isolateTimers();
  let restoreDom: (() => void) | null = null;
  afterEach(() => {
    restoreDom?.();
    restoreDom = null;
    clearToolImageEventSpriteCache();
  });
  describe("show_map_region event depiction", () => {
    it('renders a catalog pocket watch as a static object and ignores inherited charset frame numbers', async () => {
      restoreDom = installToolImageRasterDom();
      const project = seededProject(), map = requireMap(project);
      const empty = await renderRegion(project, map.id);
      placeNpc(map, multiPageEvent('watch', 4, 3, [pageGraphic('p0', {
        sprite: {type:'bundled',id:'cc0-jetrel-clock'}, pattern:79,
      })]));
      const watch = await renderRegion(project, map.id);
      expect(pixelDiffRatio(empty.raster, watch.raster)).toBeGreaterThan(0);
      requirePage(requireEvent(map, 'watch'), 0).graphic.pattern = 0;
      expect((await renderRegion(project, map.id)).dataUrl).toBe(watch.dataUrl);
    });
    it("Ultrabrain preserves whole-map detail and events at the far edge within its image budget", async () => {
      restoreDom = installToolImageRasterDom();
      const project = seededProject(), map = requireMap(project);
      map.width = 100; map.height = 80;
      map.lowerTiles = Array(8000).fill(0); map.upperTiles = Array(8000).fill(-1);
      placeNpc(map, multiPageEvent("edge", 99, 79, [pageGraphic("p0", charsetGraphic("tex_easyrpg_charset_people1", 0))]));
      const before = (await renderHarmonyMapImages(project, map))[0]!;
      const raster = decodeDataUrlPng(before.dataUrl);
      expect(raster.width).toBeGreaterThan(1000);
      expect(raster.width).toBeLessThanOrEqual(1536);
      expect(raster.height / raster.width).toBeCloseTo(0.8);
      requireEvent(map, "edge").x = 97;
      const after = (await renderHarmonyMapImages(project, map))[0]!;
      expect(after.dataUrl).not.toBe(before.dataUrl);
    });
    it("changes pixels when a charset event moves inside the region", async () => {
      restoreDom = installToolImageRasterDom();
      const project = seededProject();
      const map = requireMap(project);
      placeNpc(map, multiPageEvent("ev_move", 2, 2, [
        pageGraphic("p0", charsetGraphic("tex_easyrpg_charset_people1", 0)),
      ]));

      const before = await renderRegion(project, map.id);
      const event = requireEvent(map, "ev_move");
      event.x = 7;
      event.y = 4;
      const after = await renderRegion(project, map.id);

      expect(before.dataUrl.length).toBeGreaterThan(100);
      expect(after.dataUrl.length).toBeGreaterThan(100);
      expect(after.dataUrl).not.toBe(before.dataUrl);
      expect(pixelDiffRatio(before.raster, after.raster)).toBeGreaterThan(0.001);
    });

    it("changes pixels when the single-page event graphic slot changes", async () => {
      restoreDom = installToolImageRasterDom();
      const project = seededProject();
      const map = requireMap(project);
      placeNpc(map, multiPageEvent("ev_gfx", 4, 3, [
        pageGraphic("p0", charsetGraphic("tex_easyrpg_charset_people1", 0)),
      ]));

      const before = await renderRegion(project, map.id);
      const page = requirePage(requireEvent(map, "ev_gfx"), 0);
      page.graphic = charsetGraphic("tex_easyrpg_charset_people1", 6);
      const after = await renderRegion(project, map.id);

      expect(after.dataUrl).not.toBe(before.dataUrl);
      expect(pixelDiffRatio(before.raster, after.raster)).toBeGreaterThan(0.001);
    });

    it("depicts a later page graphic when earlier pages are transparent-only", async () => {
      restoreDom = installToolImageRasterDom();
      const project = seededProject();
      const map = requireMap(project);
      placeNpc(map, multiPageEvent("ev_page2", 5, 4, [
        pageGraphic("p0", { transparent: true }),
        pageGraphic("p1", charsetGraphic("tex_easyrpg_charset_people1", 3)),
      ]));

      const withGraphic = await renderRegion(project, map.id);
      const emptyProject = seededProject();
      const emptyMap = requireMap(emptyProject);
      const empty = await renderRegion(emptyProject, emptyMap.id);

      expect(withGraphic.dataUrl).not.toBe(empty.dataUrl);
      expect(pixelDiffRatio(withGraphic.raster, empty.raster)).toBeGreaterThan(0.001);
    });

    it("draws the page active at game start when pages have distinct visuals", async () => {
      restoreDom = installToolImageRasterDom();
      const project = seededProject();
      const map = requireMap(project);
      const shared = charsetGraphic("tex_easyrpg_charset_people1", 0);
      placeNpc(map, multiPageEvent("ev_pages", 3, 3, [
        pageGraphic("p0", shared),
        pageGraphic("p1", structuredClone(shared)),
      ]));

      const before = await renderRegion(project, map.id);
      // 조건 없는 두 페이지면 런타임은 마지막 페이지(p1)를 켠다 — 그 그림이 바뀌면 화면도 바뀐다.
      requirePage(requireEvent(map, "ev_pages"), 1).graphic = charsetGraphic("tex_easyrpg_charset_people1", 6);
      const after = await renderRegion(project, map.id);
      expect(after.dataUrl).not.toBe(before.dataUrl);
      expect(pixelDiffRatio(before.raster, after.raster)).toBeGreaterThan(0.001);
    });

    // 2026-09-23 도그푸딩: 프로젝트 전체 검수가 닫힘/열림 2페이지 보물상자 하나로 「검수 불가」가 됐다.
    it("renders a standard two-page chest (closed/opened self switch) as its closed start page", async () => {
      restoreDom = installToolImageRasterDom();
      const project = seededProject();
      const map = requireMap(project);
      // place_chest 와 같은 모양: 닫힘(A=false) / 열림(A=true), 페이지마다 다른 프레임.
      const closed = { ...pageGraphic("closed", charsetGraphic("tex_easyrpg_charset_people1", 0)), conditions: [{ kind: "selfSwitch" as const, key: "A" as const, value: false }] };
      const opened = { ...pageGraphic("opened", charsetGraphic("tex_easyrpg_charset_people1", 3)), conditions: [{ kind: "selfSwitch" as const, key: "A" as const, value: true }] };
      const chest = multiPageEvent("chest_cave_potion", 4, 3, [closed, opened]);
      placeNpc(map, chest);

      const withChest = await renderRegion(project, map.id);
      const empty = await renderRegion(seededProject(), map.id);
      expect(pixelDiffRatio(withChest.raster, empty.raster)).toBeGreaterThan(0.001);
      await expect(renderHarmonyMapImages(project, map)).resolves.toHaveLength(1);

      // 열림 페이지 그림만 바꾸면 시작 화면은 그대로다 — 닫힘(시작) 페이지를 그린다는 증거.
      requirePage(chest, 1).graphic = charsetGraphic("tex_easyrpg_charset_people1", 6);
      const openedChanged = await renderRegion(project, map.id);
      expect(openedChanged.dataUrl).toBe(withChest.dataUrl);
    });

    it("draws an enemy picture installed in the project (uploaded monster) as the runtime does: the whole portrait in a two-tile box", async () => {
      // 2026-11-12 r1s-fun: v2 가 현행 세트 적 그림을 프로젝트에 넣자(업로드 kind monster) 그 적이 선 맵 셋이 통째로
      // «map-event-rendering-unavailable» 이라 화면 검수가 그 맵을 못 봤다. 번들 그림만 알던 줄이 업로드 앞에서 비켰기 때문이다.
      restoreDom = installToolImageRasterDom();
      const project = seededProject(), map = requireMap(project);
      const empty = await renderRegion(project, map.id);
      const id = "generated-enemy-spirit-fire";
      placeNpc(map, multiPageEvent("foe", 4, 4, [pageGraphic("p0", { sprite: { type: "bundled", id }, direction: "down", pattern: 0 })]));
      const bundled = await renderRegion(project, map.id);
      expect(pixelDiffRatio(empty.raster, bundled.raster)).toBeGreaterThan(0.001);

      await preloadCurrentMonsterArt();
      expect([...installCurrentMonsterArt(project, [id])]).toEqual([id]);
      expect(project.assets.uploaded[id]?.kind).toBe("monster");
      const sprites = resolveRegionEventSprites(project, map, { x: 0, y: 0, w: 10, h: 8 }, 16);
      expect(sprites.ok && sprites.sprites.map((sprite) => [sprite.eventId, sprite.wholeImage, sprite.destW, sprite.destH])).toEqual([["foe", true, 32, 32]]);
      const installed = await renderRegion(project, map.id);
      expect(pixelDiffRatio(empty.raster, installed.raster)).toBeGreaterThan(0.001);
      // 넣은 그림은 번들 3×3 시트의 그림과 다른 그림이다(현행 세트).
      expect(pixelDiffRatio(bundled.raster, installed.raster)).toBeGreaterThan(0);
    });

    it("fails closed instead of tile-only proof when a claimed graphic is unsupported", async () => {
      restoreDom = installToolImageRasterDom();
      const project = seededProject();
      const map = requireMap(project);
      placeNpc(map, multiPageEvent("ev_bad", 3, 3, [
        pageGraphic("p0", {
          sprite: { type: "bundled", id: "tex_not_a_real_charset_sheet" },
          pattern: 0,
        }),
      ]));

      await expect(renderToolImages(project, "show_map_region", regionPayload(map.id)))
        .rejects.toThrow("map-event-rendering-unavailable");
    });

    it("keeps tile-only group samples working without a map", async () => {
      restoreDom = installToolImageRasterDom();
      const project = createBlankProject();
      const map = requireMap(project);
      const images = await renderToolImages(project, "render_group_sample", {
        samples: [{ h: 1, label: "현재", lower: [0], upper: [-1], w: 1 }],
        tilesetId: map.tilesetId,
      });
      expect(images).toHaveLength(1);
      const image = requireRendered(images);
      expect(image.dataUrl.startsWith("data:image/png")).toBe(true);
    });
  });
  type RenderedRegion = { readonly dataUrl: string; readonly raster: PngRaster };
  async function renderRegion(project: Project, mapId: string): Promise<RenderedRegion> {
    const result = runTool({ project }, "show_map_region", { mapId, x: 0, y: 0, w: 10, h: 8 });
    expect(result.ok, result.summary).toBe(true);
    const images = await renderToolImages(project, "show_map_region", result.data);
    const image = requireRendered(images);
    return { dataUrl: image.dataUrl, raster: decodeDataUrlPng(image.dataUrl) };
  }
  function regionPayload(mapId: string): unknown {
    const lower = Array.from({ length: 8 }, () => Array.from({ length: 10 }, () => 0));
    const upper = Array.from({ length: 8 }, () => Array.from({ length: 10 }, () => -1));
    return { mapId, x: 0, y: 0, w: 10, h: 8, lower, upper };
  }
  function seededProject(): Project {
    const project = createBlankProject();
    const map = requireMap(project);
    map.width = 12;
    map.height = 10;
    map.lowerTiles = Array.from({ length: map.width * map.height }, () => 0);
    map.upperTiles = Array.from({ length: map.width * map.height }, () => -1);
    map.events = [];
    return project;
  }
  function requireMap(project: Project): GameMap {
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("start map missing");
    return map;
  }
  function requireEvent(map: GameMap, id: string): GameEvent {
    const event = map.events.find((entry) => entry.id === id);
    if (!event) throw new Error(`event missing: ${id}`);
    return event;
  }
  function requirePage(event: GameEvent, index: number): EventPage {
    const page = event.pages?.[index];
    if (!page) throw new Error(`page missing: ${event.id}#${index}`);
    return page;
  }
  function requireRendered(images: readonly RenderedToolImage[]): RenderedToolImage {
    const image = images[0];
    if (!image) throw new Error("expected rendered image");
    return image;
  }
  function placeNpc(map: GameMap, event: GameEvent): void {
    map.events.push(event);
  }
  function multiPageEvent(id: string, x: number, y: number, pages: readonly EventPage[]): GameEvent {
    return {
      id,
      x,
      y,
      trigger: { kind: "action" },
      commands: [],
      pages: [...pages],
    };
  }
  function pageGraphic(id: string, graphic: EventPageGraphic): EventPage {
    return {
      id,
      name: id,
      conditions: [],
      graphic,
      trigger: { kind: "action" },
      priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [],
    };
  }
});
