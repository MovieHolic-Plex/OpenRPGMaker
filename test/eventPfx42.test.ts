import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseEventDraft, type EventDraft, type EventDraftResult } from "@/ai/eventDraftAuthoring";
import { EventAiQueue, type EventAiQueueDeps } from "@/editor/eventAiQueue/eventAiQueue";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { GameEvent, Project, Command, EventPageCondition, EventPage, EventPageGraphic, GameMap } from "@/project/types";
import { ToolReadEvidence } from "@/ai/toolReadEvidence";
import { compileSimplePages, CRYSTAL_ICON_ID, resolveGraphic, compileSimplePage, resolveGraphicQuery, charsetGraphic } from "@/editor/tools/eventCompile";
import { normalizeArgsForSchema } from "@/editor/tools/jsonSchema";
import { COMMAND_SCHEMA, CONDITION_SCHEMA, SIMPLE_PAGE_SCHEMA } from "@/editor/tools/schemaShapes";
import { getTool } from "@/editor/tools/toolRegistry";
import { runTool } from "@/editor/tools/toolRunner";
import { COMMAND_KINDS, CONDITION_KINDS } from "@/project/commandKindRegistry";
import { deserialize, serialize } from "@/project/io";
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
import { renderCommandList } from "@/editor/panels/eventEditor/commandList";
import { clearCommandInspector, resetCommandInspectorView, setCommandInspectorHost } from "@/editor/panels/eventEditor/commandInspector";
import type { CommandListActions } from "@/editor/panels/eventEditor/types";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";
import { editorState } from "@/editor/editorState";
import { renderEventEditorContent } from "@/editor/panels/eventEditor/content";
import { _resetEventDraftVaultForTest } from "@/project/eventDraftVault";
import { PAGE_COMMAND_BUTTONS, TRIGGER_OPTIONS } from "@/editor/panels/eventEditor/options";

// AI 이벤트 작업함 계약: 동시 실행 상한, 칸 중복 거부, 배치 한 번 = 이벤트 하나, 그새 찬 칸은 배치 안 함.
// 생성기는 이벤트 전체(페이지·셀프 스위치 조건·모습)를 검증된 모양으로 돌려준다.
describe("eventAiQueue", () => {
  isolateTimers();
  const CHEST_JSON = JSON.stringify({
    name: "보물상자",
    pages: [
      { name: "처음", graphic: "charset:tex_easyrpg_charset_object1:6", trigger: "action", priority: "same", conditions: [],
        commands: [{ kind: "text", body: "열었다.", speaker: "" }, { kind: "changeItem", itemId: "item_potion", op: "+=", amount: 2 }, { kind: "setSelfSwitch", key: "A", value: true }] },
      { name: "빈 상자", graphic: "charset:tex_easyrpg_charset_object1:6", trigger: "action", priority: "same",
        conditions: [{ kind: "selfSwitch", key: "A", value: true }], commands: [{ kind: "text", body: "비어 있다.", speaker: "" }] },
    ],
  });
  describe("parseEventDraft", () => {
    it("이벤트 한 개 전체를 페이지·조건·모습까지 받는다", () => {
      const project = createBlankProject();
      const parsed = parseEventDraft(project, project.startMapId, CHEST_JSON);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;
      expect(parsed.draft.title).toBe("보물상자");
      expect(parsed.draft.event.pages).toHaveLength(2);
      expect(parsed.draft.event.pages?.[1]?.conditions).toEqual([{ kind: "selfSwitch", key: "A", value: true }]);
      expect(parsed.draft.event.pages?.[0]?.graphic.sprite?.id).toBe("tex_easyrpg_charset_object1");
      expect(parsed.draft.pages[0]?.triggerLabel).toBe("조사하면");
    });

    it("없는 아이템·없는 모습은 자가수정이 읽을 오류로 돌려준다", () => {
      const project = createBlankProject();
      const bad = JSON.stringify({ name: "상자", pages: [{ graphic: "charset:nope:0", trigger: "action", commands: [] }] });
      const parsed = parseEventDraft(project, project.startMapId, bad);
      expect(parsed.ok).toBe(false);
      if (parsed.ok) return;
      expect(parsed.errors.join(" ")).toContain("모습 목록에 없습니다");
      const badItem = JSON.stringify({ name: "상자", pages: [{ graphic: "none", commands: [{ kind: "changeItem", itemId: "item_missing", op: "+=", amount: 1 }] }] });
      const second = parseEventDraft(project, project.startMapId, badItem);
      expect(second.ok).toBe(false);
    });
  });
  function draftFor(prompt: string): EventDraftResult {
    const project = createBlankProject();
    const parsed = parseEventDraft(project, project.startMapId, CHEST_JSON);
    if (!parsed.ok) throw new Error("fixture");
    return { ...parsed.draft, title: prompt, attempts: 1 };
  }
  describe("EventAiQueue", () => {
    let project: Project;
    let running = 0;
    let peak = 0;
    let release: (() => void)[] = [];
    let placed: GameEvent[] = [];

    function deps(): EventAiQueueDeps {
      return {
        getProject: () => project,
        loadConfig: () => ({ model: "m", authMode: "chatgpt" }) as never,
        generate: async ({ request }) => {
          running += 1;
          peak = Math.max(peak, running);
          await new Promise<void>((resolve) => release.push(resolve));
          running -= 1;
          return draftFor(request.prompt);
        },
        place: (job, draft: EventDraft) => {
          const map = project.maps[job.mapId]!;
          if (map.events.some((event) => event.x === job.x && event.y === job.y)) return null;
          const event = { ...draft.event, id: "ev_" + job.id, x: job.x, y: job.y } as GameEvent;
          map.events.push(event);
          placed.push(event);
          return event.id;
        },
      };
    }

    beforeEach(() => {
      project = createBlankProject();
      store.replace(project);
      running = 0;
      peak = 0;
      release = [];
      placed = [];
    });

    afterEach(() => {
      for (const resolve of release) resolve();
    });

    const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

    it("동시 실행 수를 넘지 않고, 끝나는 대로 다음 것을 시작한다", async () => {
      const queue = new EventAiQueue(deps());
      queue.setConcurrency(3);
      for (let index = 0; index < 8; index += 1) queue.enqueue(project.startMapId, index, 2, "상자 " + index);
      await flush();
      expect(queue.counts().running).toBe(3);
      expect(queue.counts().queued).toBe(5);
      release.shift()?.();
      await flush();
      await flush();
      expect(queue.counts().ready).toBe(1);
      expect(queue.counts().running).toBe(3);
      while (release.length) { release.shift()?.(); await flush(); await flush(); }
      expect(queue.counts().ready).toBe(8);
      expect(peak).toBe(3);
    });

    it("같은 칸·이벤트가 있는 칸에는 부탁을 받지 않는다", () => {
      const queue = new EventAiQueue(deps());
      project.maps[project.startMapId]!.events.push({ id: "ev_existing", x: 1, y: 1, trigger: { kind: "action" }, commands: [] });
      expect(queue.enqueue(project.startMapId, 1, 1, "상자")).toBeNull();
      expect(queue.enqueue(project.startMapId, 2, 1, "상자")).not.toBeNull();
      expect(queue.enqueue(project.startMapId, 2, 1, "상자")).toBeNull();
    });

    it("모두 배치는 확인 대기만 배치하고, 그새 찬 칸은 막힘으로 돌린다", async () => {
      const queue = new EventAiQueue(deps());
      const a = queue.enqueue(project.startMapId, 3, 3, "a")!;
      const b = queue.enqueue(project.startMapId, 4, 3, "b")!;
      queue.enqueue(project.startMapId, 5, 3, "c");
      await flush();
      release.shift()?.();
      release.shift()?.();
      await flush();
      await flush();
      // 사람이 b 칸에 먼저 이벤트를 놓았다.
      project.maps[project.startMapId]!.events.push({ id: "ev_human", x: 4, y: 3, trigger: { kind: "action" }, commands: [] });
      expect(queue.placeAllReady()).toBe(1);
      expect(queue.get(a.id)?.state).toBe("placed");
      expect(queue.get(b.id)?.state).toBe("failed");
      expect(queue.counts().running).toBe(1);
      expect(placed).toHaveLength(1);
    });

    it("버리면 진행 중 호출의 결과를 받지 않는다", async () => {
      const queue = new EventAiQueue(deps());
      const job = queue.enqueue(project.startMapId, 6, 6, "a")!;
      await flush();
      queue.discard(job.id);
      release.shift()?.();
      await flush();
      expect(queue.list()).toHaveLength(0);
    });
  });
});

describe("eventCompile", () => {
  isolateTimers();
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
});

describe("eventEditorOptions", () => {
  isolateTimers();
  /**
   * 계약: **명령 행 한 번 클릭 = 선택(세 번째 칼럼 인스펙터 채움), 두 번 클릭 = 편집 모달.**
   *
   * 회귀 배경: content.ts 는 "선택한 명령" 인스펙터 칼럼을 만들고
   * setCommandInspectorHost() 로 등록하지만, commandList.ts 의 행 클릭이 곧바로
   * 편집 모달을 열어버려서 인스펙터가 열릴 경로가 없었다. showCommandInspector() 는
   * 재렌더 복원 분기(`sameInspectorPath(path, selectedCommandPath())`) 안에서만
   * 불렸고, 그 조건은 showCommandInspector() 자신이 세우는 값이라 영원히 거짓이었다.
   */
  describe("eventEditorInspectorSelection", () => {
    isolateTimers();
    const noopActions: CommandListActions = {
      addCommand: () => {},
      insertCommand: () => {},
      replaceCommand: () => {},
      deleteCommand: () => {},
      moveCommand: () => {},
      moveCommandTo: () => {},
    };
    const COMMANDS: Command[] = [
      { kind: "text", body: "약초를 고르고 계신가요?" },
      { kind: "text", body: "오늘 약초는 다 팔렸어요." },
    ];
    const EDIT_DIALOG = '[data-testid="event-command-edit-dialog"]';
    describe("이벤트 편집기 — 명령 선택과 인스펙터", () => {
      let restoreDom: (() => void) | undefined;
      let inspectorHost: FakeElement;
      let listRoot: FakeElement;

      function renderList(): void {
        renderCommandList(listRoot as unknown as HTMLElement, COMMANDS, [], noopActions);
      }

      function headAt(index: number): FakeElement {
        const head = listRoot.querySelectorAll(".cmd-head")[index];
        if (!head) throw new Error(`expected .cmd-head at ${index}`);
        return head;
      }

      function selectedPaths(): string[] {
        // fakeDom 셀렉터는 복합 클래스(.cmd-item.selected)를 모른다 — 클래스 목록으로 직접 고른다.
        return listRoot
          .querySelectorAll(".cmd-item")
          .filter((item) => item.className.split(/\s+/u).includes("selected"))
          .map((item) => item.dataset.cmdPath ?? "");
      }

      beforeEach(() => {
        restoreDom = installFakeDom();
        store.replace(createBlankProject());
        // content.ts 와 같은 순서: 인스펙터 칼럼 등록 → 화면 비우기 → 리스트 렌더.
        inspectorHost = new FakeElement("div");
        inspectorHost.dataset.testid = "event-editor-inspector";
        document.body.append(inspectorHost as unknown as HTMLElement);
        setCommandInspectorHost(inspectorHost as unknown as HTMLElement);
        resetCommandInspectorView();
        listRoot = new FakeElement("div");
        document.body.append(listRoot as unknown as HTMLElement);
        renderList();
      });

      afterEach(() => {
        clearCommandInspector();
        setCommandInspectorHost(undefined);
        restoreDom?.();
      });

      it("한 번 클릭하면 인스펙터가 채워지고 편집 모달은 열리지 않는다", () => {
        expect(inspectorHost.hidden).toBe(true);

        headAt(0).dispatchEvent(new Event("click"));

        expect(inspectorHost.hidden).toBe(false);
        expect(inspectorHost.childNodes.length).toBeGreaterThan(0);
        expect(findByTestId(inspectorHost, "event-inspector-body")).toBeTruthy();
        expect(inspectorHost.dataset.commandPath).toBe("[0]");
        expect(document.querySelector(EDIT_DIALOG)).toBeNull();
        // 툴바 이동/복사가 쓰는 선택 표시도 같이 선다.
        expect(selectedPaths()).toEqual(["[0]"]);
      });

      it("두 번 클릭하면 편집 모달이 열린다", () => {
        headAt(0).dispatchEvent(new Event("dblclick"));

        expect(document.querySelector(EDIT_DIALOG)).not.toBeNull();
      });

      it("다른 행을 클릭하면 인스펙터가 그 행으로 옮겨간다", () => {
        headAt(0).dispatchEvent(new Event("click"));
        headAt(1).dispatchEvent(new Event("click"));

        expect(inspectorHost.dataset.commandPath).toBe("[1]");
        expect(document.querySelector(EDIT_DIALOG)).toBeNull();
        expect(selectedPaths()).toEqual(["[1]"]);
      });

      it("재렌더 후에도 선택한 행의 인스펙터가 복원된다", () => {
        headAt(0).dispatchEvent(new Event("click"));

        resetCommandInspectorView();
        renderList();

        expect(inspectorHost.hidden).toBe(false);
        expect(findByTestId(inspectorHost, "event-inspector-body")).toBeTruthy();
        expect(inspectorHost.dataset.commandPath).toBe("[0]");
      });

      it("닫기 버튼은 인스펙터를 다시 비운다", () => {
        headAt(0).dispatchEvent(new Event("click"));
        findByTestId(inspectorHost, "event-inspector-close")?.click();

        expect(inspectorHost.hidden).toBe(true);
        expect(inspectorHost.childNodes.length).toBe(0);
      });
    });
  });
  describe("eventEditorMemoryOpeningTemplate", () => {
    isolateTimers();
    let restoreDom: () => void = () => undefined;
    function emptyPage(): EventPage {
      return {
        id: "page-1",
        name: "회상",
        conditions: [],
        graphic: {},
        trigger: { kind: "action" },
        priority: "below",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [],
      };
    }
    function gameEvent(page: EventPage): GameEvent {
      return { id: "event-1", x: 3, y: 3, trigger: page.trigger, commands: [], pages: [page] };
    }
    function renderEmptyEventEditor(): string {
      const project = createBlankProject();
      const mapId = project.startMapId;
      project.maps[mapId].events = [gameEvent(emptyPage())];
      store.replaceProject(project);
      editorState.set({ currentMapId: mapId, selectedEventId: "event-1", selectedEventPageId: "page-1" });
      const host = new FakeElement("div") as unknown as HTMLElement;
      document.body.append(host);
      renderEventEditorContent(host, mapId, "event-1");
      return mapId;
    }
    function activePage(mapId: string): EventPage {
      const pages = store.getCurrent().maps[mapId].events[0]?.pages ?? [];
      const page = pages.find((entry) => entry.id === "page-1");
      if (!page) throw new Error("page-1 사라짐");
      return page;
    }
    beforeEach(() => {
      vi.stubEnv("VITE_LEGACY_DB_URL", "http://dbserver:8100");
      vi.stubEnv("VITE_LEGACY_DB_ANON_KEY", "test-anon-key");
      vi.stubEnv("VITE_LEGACY_DB_PROJECT_ID", "event-editor-memory-opening");
      _resetEventDraftVaultForTest();
      restoreDom = installFakeDom();
      store.replaceProject(createBlankProject());
    });
    afterEach(() => {
      _resetEventDraftVaultForTest();
      vi.unstubAllEnvs();
      restoreDom();
    });
    describe("empty-event 회상 오프닝 template", () => {
      it("Given an empty event page, When the 회상 오프닝 CTA is clicked, Then the page holds the memory_opening cutscene", () => {
        const mapId = renderEmptyEventEditor();
        const button = document.querySelector<HTMLElement>('[data-testid="event-template-memory-opening"]');
        expect(button).not.toBeNull();

        button?.click();

        const commands = activePage(mapId).commands;
        expect(commands.length).toBeGreaterThan(3);
        expect(commands.some((command) => command.kind === "text")).toBe(true);
        expect(commands.some((command) => command.kind === "wait" && command.ms >= 100)).toBe(true);
        expect(commands.some((command) => command.kind === "showPicture")).toBe(true);
        expect(commands.some((command) => command.kind === "playAudio")).toBe(true);
        // 프리셋이 만든 별도 「컷신」 페이지는 남기지 않는다 — 보고 있던 빈 페이지가 채워진다.
        expect(store.getCurrent().maps[mapId].events[0]?.pages?.length).toBe(1);
      });

      it("Given an empty event page, When the CTA is clicked, Then no command edit dialog blocks the author", () => {
        renderEmptyEventEditor();
        const button = document.querySelector<HTMLElement>('[data-testid="event-template-memory-opening"]');
        expect(button).not.toBeNull();
        button?.click();
        expect(document.querySelector('[data-testid="event-command-edit-dialog"]')).toBeNull();
      });
    });
  });
  describe("eventEditorOptions", () => {
    isolateTimers();
    describe("event editor trigger options", () => {
      it("shows parallel as an implemented trigger option", () => {
        const parallelOption = TRIGGER_OPTIONS.find((option) => option.value === "parallel");

        expect(parallelOption).toMatchObject({ value: "parallel", label: "뒤에서 계속 실행" });
        expect(parallelOption?.description).toContain("반복");
      });

      it("shows RM2003 player and event touch triggers separately without the legacy touch alias", () => {
        expect(TRIGGER_OPTIONS.map((option) => option.value)).toEqual([
          "action",
          "playerTouch",
          "eventTouch",
          "auto",
          "parallel",
          "locationTransition",
        ]);
        for (const option of TRIGGER_OPTIONS) {
          expect(option.description, option.label).toBeTruthy();
          expect(option.description).not.toBe(option.label);
        }
      });
    });
    describe("event editor command shortcuts", () => {
      it("exposes ending as a direct authoring command", () => {
        expect(PAGE_COMMAND_BUTTONS).toContainEqual({
          kind: "ending",
          testId: "command-add-ending",
          label: "엔딩",
        });
      });
    });
  });
});
