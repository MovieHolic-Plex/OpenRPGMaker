import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { capResultImages, CLI_CONTEXT_EXHAUSTED_PREFIX, compactCliToolList, isCliApiErrorText, isCliContextExhaustedError, isCliContextExhaustedText, schemaShapeProblem } from "@/ai/piAgent/cliContextBudget";
import { createBlankProject } from "@/project/defaults";
import { createPiToolset } from "@/ai/piAgent/toolAdapter";
import { PiCharsetSelectionGate } from "@/ai/piAgent/charsetSelectionGate";
import { charsetPreviewCandidates, drawCharsetPreview } from "@/ai/charsetPreview";
import { resolveGraphic } from "@/editor/tools/eventCompile";
import { requestPiCheckpoint, resolvePiCheckpoint } from "../scripts/lib/piCheckpointBroker";
import { runPiAgentViaCompanion } from "@/ai/piAgent/client";
import type { PiAgentEvent } from "@/ai/piAgent/protocol";
import type { Project, TilesetLook, Command, GameEvent } from "@/project/types";
import { CLI_CALL_TOOL, cliListNeedsAnnounce, unwrapCallTool } from "../src/ai/piAgent/cliToolFreeze";
import { isolateTimers } from "./mergedTeardown";
import { CAMPUS_CONCEPT_HINT, CAMPUS_DETAIL_LINE, CAMPUS_EXPOSED_TOOLS, CAMPUS_INTERIOR_LINE, CAMPUS_POINTER_LINE, CAMPUS_ROOM_KINDS, CAMPUS_TILESET_ID, campusPromptLines, campusTargetFor, describesCampus, formatCampusNote, hasCampusTileset, namesCampusTileset, scopeUsesCampus } from "@/ai/campusPolicy";
import { jpCityTargetFor } from "@/ai/jpCityPolicy";
import { buildPiIntentNote } from "@/ai/piAgent/executionRoute";
import { planStart, startPlanPrompt } from "@/project/startVariety";
import { BUILDABLE_CONCEPT_TILESETS } from "@/concepts/format";
import roomTable from "@/assets/modernCampusRoomTable.json";
import jpSpec from "@/assets/jpInteriorSpec.json";
import references from "@/assets/modernCampusInteriorReferences.json";
import { declaredIntent } from "./intentFixture";
import { otherGameLooks, rememberGameLooks } from "@/ai/piAgent/gameLooks";
import { runTool } from "@/editor/tools";

describe("aiCliContextBudget", () => {
  isolateTimers();
  // 큰 하위 스키마 — 깊은 칸의 description 은 stripDeep 이 걷으므로(J79) 크기를 enum 값(손대지 않는 자리)으로 만든다.
  const command = { type: "object", description: "명령", properties: Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`k${i}`, { type: "string", enum: [`긴 선택지 ${"가".repeat(80)} ${i}`] }])) };
  describe("compactCliToolList (J79)", () => {
    it("drops deep descriptions but keeps top-level ones", () => {
      const [tool] = compactCliToolList([{ name: "a", description: "도구", inputSchema: { type: "object", properties: { x: { type: "string", description: "윗칸", properties: { y: { type: "string", description: "깊은" } } } } } }]);
      const schema = tool!.inputSchema as { properties: { x: { description?: string; properties: { y: { description?: string } } } } };
      expect(schema.properties.x.description).toBe("윗칸");
      expect(schema.properties.x.properties.y.description).toBeUndefined();
      expect(tool!.description).toBe("도구");
    });
    it("replaces a large sub-schema repeated by a later tool with a pointer", () => {
      const wrap = { type: "object", properties: { cmd: { type: "array", items: command } } };
      const out = compactCliToolList([{ name: "upsert_event", description: "", inputSchema: wrap }, { name: "place_npc", description: "", inputSchema: wrap }]);
      expect(JSON.stringify(out[0]!.inputSchema).length).toBeGreaterThan(3000);
      expect(JSON.stringify(out[1]!.inputSchema)).toContain("형식은 upsert_event");
      expect(JSON.stringify(out[1]!.inputSchema).length).toBeLessThan(400);
    });
  });
  describe("capResultImages (J79)", () => {
    const img = { type: "image", data: "x", mimeType: "image/png" };
    it("keeps one image for multi-image verbs and notes the rest", () => {
      const out = capResultImages("inspect", [{ type: "text", text: "ok" }, img, img, img]);
      expect(out.filter((p) => p.type === "image")).toHaveLength(1);
      expect(JSON.stringify(out.at(-1))).toContain("3장");
    });
    it("leaves other tools and single images alone", () => {
      expect(capResultImages("view_map", [img, img])).toHaveLength(2);
      expect(capResultImages("inspect", [img])).toHaveLength(1);
    });
  });
  describe("CLI context-limit reply is a failure (J79)", () => {
    it("recognises the thrash text and the prefixed error", () => {
      expect(isCliContextExhaustedText("Autocompact is thrashing: the context refilled")).toBe(true);
      expect(isCliContextExhaustedText("Prompt is too long")).toBe(true);
      expect(isCliContextExhaustedText("게임을 다 지었습니다. Autocompact is thrashing 은 없었습니다")).toBe(false);
      expect(isCliContextExhaustedError(`${CLI_CONTEXT_EXHAUSTED_PREFIX} Autocompact is thrashing`)).toBe(true);
      expect(isCliContextExhaustedError("rate limited")).toBe(false);
    });
  });
  describe("compactCliToolList keeps an argument named description (J79 review)", () => {
    it("only strips description strings, not a property schema keyed 'description'", () => {
      const [tool] = compactCliToolList([{ name: "a", description: "", inputSchema: { type: "object", properties: { item: { type: "object", properties: { description: { type: "string" } } } } } }]);
      expect(JSON.stringify(tool!.inputSchema)).toContain("\"description\":{\"type\":\"string\"}");
    });
  });
  describe("schema-aware compaction (J79b)", () => {
    const bigProps = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`k${i}`, { type: "string", enum: [`값${i}`, "x".repeat(60)] }]));
    it("never replaces a properties map or a default value with a pointer", () => {
      const list = compactCliToolList([
        { name: "a", description: "", inputSchema: { type: "object", properties: { x: { type: "object", properties: bigProps } } } },
        { name: "b", description: "", inputSchema: { type: "object", properties: { y: { type: "object", properties: bigProps, default: { note: "x".repeat(4000) } } } } },
        { name: "c", description: "", inputSchema: { type: "object", properties: { z: { type: "object", properties: bigProps } } } },
      ]);
      for (const tool of list) expect(schemaShapeProblem(tool.inputSchema)).toBeUndefined();
      expect(JSON.stringify(list[1]!.inputSchema)).not.toContain("형식은");
      expect(JSON.stringify(list[2]!.inputSchema)).toContain("형식은 a 도구의 x 칸");
    });
    it("reads a provider error reply as a failure, not a report", () => {
      expect(isCliApiErrorText("API Error: 400 Invalid request. Please check your request parameters.")).toBe(true);
      expect(isCliApiErrorText("게임을 다 지었습니다")).toBe(false);
    });
  });
});

describe("aiPiAgentSuite", () => {
  isolateTimers();
  describe("charsetSelectionEvidence", () => {
    isolateTimers();
    const GOLEM = 'charset:tex_easyrpg_charset_monster2:4';
    const KING = 'charset:tex_easyrpg_charset_people3:0';
    const result = { ok: true, summary: '골렘', data: { matches: [{ selectionId: GOLEM, label: '스톤 골렘' }] } } as const;
    function credit(gate: PiCharsetSelectionGate, shape = 'responses', image = 'golem-png', success = true) {
      gate.offer('list_npc_graphics', result, 'golem-png');
      const text = JSON.stringify(result);
      gate.payload(shape === 'gemini' ? { contents: [{ parts: [{ functionResponse: { name: 'list_npc_graphics', response: { output: text } } }, { inlineData: { mimeType: 'image/png', data: image } }] }] }
        : shape === 'anthropic' ? { messages: [{ content: [{ type: 'tool_result', content: [{ type: 'text', text }, { type: 'image', source: { type: 'base64', media_type: 'image/png', data: image } }] }] }] }
        : { input: [{ type: 'function_call_output', output: text }, { type: 'input_image', image_url: `data:image/png;base64,${image}` }] });
      gate.complete(success);
    }
    function changed() {
      const before = createBlankProject(), after = structuredClone(before), mapId = before.startMapId;
      after.maps[mapId]!.events.push({ id: 'golem', name: '골렘', x: 4, y: 4, pages: [{ id: 'golem-page', graphic: resolveGraphic({ selectionId: GOLEM }) }] } as never);
      return { before, after, mapId };
    }
    describe('charset selection evidence', () => {
      it('credits Gemini multimodal function responses with a legend inside the JSON envelope', () => {
        // Actual pi-ai google-shared serializer: all text blocks are joined, images
        // are nested in functionResponse.parts on Gemini 3+ (including Antigravity).
        const wire = (output: string) => ({ request: { contents: [{ role: 'user', parts: [{ functionResponse: {
          name: 'list_npc_graphics', response: { output }, parts: [{ inlineData: { mimeType: 'image/png', data: 'golem-png' } }],
        } }] }] } });
        // 8bb7dc7886: the gate reads the result envelope on its own line, so a legend appended after it ("\n1: …") still credits the picture.
        for (const output of [`${JSON.stringify(result)}\n1: 스톤 골렘`, JSON.stringify({ ...result, imageLegend: '1: 스톤 골렘' })]) {
          const { before, after } = changed(), gate = new PiCharsetSelectionGate();
          gate.offer('list_npc_graphics', result, 'golem-png');
          expect(gate.afterWrite(before, after)?.ok).toBe(false);
          gate.payload(wire(output));
          expect(gate.complete(true)).toEqual([GOLEM]);
          expect(gate.afterWrite(before, after)).toBeNull();
        }
      });
      it.each(['responses', 'gemini', 'anthropic'])('accepts the exact pictured candidate after a successful %s turn', shape => {
        const { before, after } = changed(), gate = new PiCharsetSelectionGate();
        expect(gate.afterWrite(before, after)?.ok).toBe(false);
        credit(gate, shape);
        expect(gate.afterWrite(before, after)).toBeNull();
      });
      it.each(['wrong-image', 'aborted', 'text-only', 'truncated'])('rejects %s reading evidence', variant => {
        const { before, after } = changed(), gate = new PiCharsetSelectionGate();
        if (variant === 'wrong-image' || variant === 'aborted') credit(gate, 'responses', variant === 'wrong-image' ? 'king-png' : 'golem-png', variant !== 'aborted');
        else {
          gate.offer('list_npc_graphics', result, 'golem-png');
          gate.payload({ input: [{ type: 'function_call_output', output: JSON.stringify(variant === 'truncated' ? { ok: true, dataTruncated: true, data: result.data } : result) },
            ...(variant === 'truncated' ? [{ type: 'input_image', image_url: 'data:image/png;base64,golem-png' }] : [])] });
          gate.complete(true);
        }
        expect(gate.afterWrite(before, after)?.ok).toBe(false);
      });
      it('rejects king substitution and slot/frame confusion after viewing a golem', () => {
        const { before, after, mapId } = changed(), gate = new PiCharsetSelectionGate(); credit(gate);
        const graphic = after.maps[mapId]!.events.at(-1)!.pages![0]!.graphic;
        graphic.sprite = { type: 'bundled', id: 'tex_easyrpg_charset_people3' }; graphic.pattern = 25;
        expect(gate.afterWrite(before, after)?.summary).toContain('「왕」');
        graphic.sprite.id = 'tex_easyrpg_charset_monster2'; graphic.pattern = 4;
        expect(gate.afterWrite(before, after)?.ok).toBe(false);
        expect(() => resolveGraphic({ selectionId: KING, query: '골렘' })).toThrow(/후보가 아닙니다/);
      });
      it('resolves a selected slot without manual frame arithmetic', () => {
        expect(resolveGraphic({ selectionId: GOLEM, query: '골렘' })).toEqual({ sprite: { type: 'bundled', id: 'tex_easyrpg_charset_monster2' }, direction: 'down', pattern: 73 });
      });
      it('provides pictured candidates for uploaded sheets and gates their native graphics', async () => {
        const before = createBlankProject(), after = structuredClone(before);
        before.assets.uploaded.custom_golem = { id: 'custom_golem', kind: 'charset', name: '내 골렘', dataUrl: 'data:image/png;base64,fixture', meta: {} };
        after.assets.uploaded = structuredClone(before.assets.uploaded);
        const list = createPiToolset({ project: before }).find(tool => tool.name === 'list_resources')!;
        const response = await list.execute('custom', { kind: 'charset', query: 'custom_golem' });
        const candidates = charsetPreviewCandidates('list_resources', response.details.data);
        expect(candidates).toHaveLength(8);
        const matches = (response.details.data as { matches: { nativeGraphic: unknown }[] }).matches;
        after.maps[after.startMapId]!.events.push({ id: 'custom', name: '골렘', x: 4, y: 4,
          pages: [{ id: 'page', graphic: matches[4]!.nativeGraphic }] } as never);
        const gate = new PiCharsetSelectionGate();
        expect(gate.afterWrite(before, after)?.ok).toBe(false);
        gate.offer('list_resources', response.details, 'custom-image');
        gate.payload({ input: [{ type: 'function_call_output', output: response.content[0]!.type === 'text' ? response.content[0]!.text : '' },
          { type: 'input_image', image_url: 'data:image/png;base64,custom-image' }] });
        gate.complete(true);
        expect(gate.afterWrite(before, after)).toBeNull();
      });
      it('keeps existing graphics on text/position edits, including reordered events', () => {
        const { after } = changed(), edited = structuredClone(after);
        edited.maps[edited.startMapId]!.events.reverse();
        const golem = edited.maps[edited.startMapId]!.events.find(e => e.id === 'golem')!;
        golem.x++; golem.name = '다른 이름';
        expect(new PiCharsetSelectionGate().afterWrite(after, edited)).toBeNull();
      });
      it('rolls a failed write back atomically and shares evidence with discovered tools', async () => {
        const ctx = { project: createBlankProject() }, gate = new PiCharsetSelectionGate();
        const initial = ctx.project;
        const tools = createPiToolset(ctx, { charsetGate: gate });
        const place = tools.find(t => t.name === 'place_npc')!;
        const args = { mapId: initial.startMapId, id: 'golem', name: '골렘', x: 4, y: 4, graphic: { selectionId: GOLEM, query: '골렘' }, pages: [{ lines: ['안녕.'] }] };
        await expect(place.execute('fail', args)).rejects.toThrow(/선택을 되돌렸습니다/);
        expect(ctx.project).toBe(initial);
        credit(gate);
        await expect(place.execute('ok', args)).resolves.toBeTruthy();
        expect(ctx.project.maps[initial.startMapId]!.events.find(e => e.id === 'golem')!.pages![0]!.graphic.pattern).toBe(73);
      });
      it('renders the actual golem source cell at a visible scale, in result order', () => {
        const data = new Uint8ClampedArray(288 * 256 * 4);
        for (let i = 0; i < data.length; i += 4) { data[i] = 1; data[i + 3] = 255; }
        // Independent RM2000 coordinates: slot 4, down middle frame = (24,192), 24x32.
        for (let y = 192; y < 224; y++) for (let x = 24; x < 48; x++) { const i = (y * 288 + x) * 4; data[i] = 120; data[i + 1] = 80; data[i + 2] = 40; }
        const candidates = charsetPreviewCandidates('list_npc_graphics', result.data);
        const image = drawCharsetPreview(candidates, () => ({ width: 288, height: 256, data }));
        const i = (22 * image.width + 8) * 4;
        expect([...image.data.slice(i, i + 4)]).toEqual([120, 80, 40, 255]);
        expect(image.width).toBe(112); expect(image.height).toBe(154);
        expect(charsetPreviewCandidates('list_resources', { matches: [{ id: GOLEM, label: '스톤 골렘' }] })).toEqual(candidates);
      });
      it('keeps a full browse page within the render protocol image size', () => {
        const sheet = { width: 288, height: 256, data: new Uint8ClampedArray(288 * 256 * 4) };
        const candidates = Array.from({ length: 50 }, (_, i) => ({ selectionId: `charset:sheet:${i % 8}`, textureKey: 'sheet', characterIndex: i % 8, label: '후보' }));
        const image = drawCharsetPreview(candidates, () => sheet);
        expect(image.width).toBe(504); expect(image.height).toBe(480);
      });
    });
  });
  describe("piCheckpointProtocol", () => {
    isolateTimers();
    const project = { maps: {} } as Project;
    describe("checkpoint transport", () => {
      it("does not release a worker until a one-use matching decision arrives", async () => {
        let event!: Extract<PiAgentEvent, { type: "checkpoint" }>;
        let released = false;
        const pending = requestPiCheckpoint({ project, label: "stage", toolName: "paint_tiles" }, e => { event = e as typeof event; }, new AbortController().signal).then(() => { released = true; });
        await Promise.resolve();
        expect(released).toBe(false);
        expect(resolvePiCheckpoint("foreign", { ok: true })).toBe(false);
        expect(resolvePiCheckpoint(event.checkpointId, { ok: true })).toBe(true);
        await pending;
        expect(released).toBe(true);
        // 재전달은 409 대신 이미 받은 결정으로 인정한다(piCheckpointBroker `resolved` 집합, 재연결 workerJson). 두 번 풀리지는 않는다.
        expect(resolvePiCheckpoint(event.checkpointId, { ok: true })).toBe(true);
      });
      it("abort retires the pending capability", async () => {
        const controller = new AbortController();
        let id = "";
        const pending = requestPiCheckpoint({ project, label: "stage", toolName: "paint_tiles" }, e => { if (e.type === "checkpoint") id = e.checkpointId; }, controller.signal);
        controller.abort();
        await expect(pending).rejects.toThrow("중단");
        expect(resolvePiCheckpoint(id, { ok: true })).toBe(false);
      });
      it("client acknowledges only after local application and sends the accepted project", async () => {
        let send!: (event: PiAgentEvent) => void;
        let close!: () => void;
        let release!: () => void;
        let reached!: () => void;
        const atCheckpoint = new Promise<void>(resolve => { reached = resolve; });
        const acks: Record<string, unknown>[] = [];
        const encoder = new TextEncoder();
        const done = { type: "done", project, changedKeys: [], stats: { ms: 1, turns: 1, toolCalls: 1, toolErrors: 0 } } as const;
        const task = runPiAgentViaCompanion({ provider: "google-antigravity", task: "edit", mapIds: [], project }, {
          onCheckpoint: async () => { reached(); await new Promise<void>(resolve => { release = resolve; }); return project; },
          fetchImpl: (async (_url, init) => {
            const body = JSON.parse(String(init?.body));
            if (body.checkpointId) { acks.push(body); send(done); close(); return new Response("{}", { status: 200 }); }
            return new Response(new ReadableStream({ start(c) {
              send = event => c.enqueue(encoder.encode(JSON.stringify(event) + "\n")); close = () => c.close();
              send({ type: "checkpoint", checkpointId: "one", project, label: "stage", toolName: "paint_tiles" });
            } }));
          }) as typeof fetch,
        });
        await atCheckpoint;
        expect(acks).toHaveLength(0);
        release();
        await task;
        expect(acks).toEqual([{ checkpointId: "one", ok: true, project }]);
      });
    });
  });
  describe("cliToolFreeze", () => {
    isolateTimers();
    describe("local CLI tool-list freeze", () => {
      it("does not re-announce when tools were only added (they run through call_tool)", () => {
        expect(cliListNeedsAnnounce(["todo", "get_event"], ["todo", "get_event", "upsert_enemy"])).toBe(false);
      });
      it("re-announces when a listed tool is gone (a wholesale swap such as the polish round)", () => {
        expect(cliListNeedsAnnounce(["todo", "get_event"], ["rewrite_dialogue", "lint_dialogue"])).toBe(true);
        expect(cliListNeedsAnnounce([CLI_CALL_TOOL, "todo"], ["todo"])).toBe(false);
      });
      it("unwraps call_tool to the inner tool and strips the CLI prefix", () => {
        expect(unwrapCallTool({ name: "mcp__oprn__upsert_enemy", args: { enemy: { id: "e1" } } })).toEqual({ name: "upsert_enemy", args: { enemy: { id: "e1" } } });
        expect(unwrapCallTool({ name: "get_script_api" })).toEqual({ name: "get_script_api", args: {} });
        expect("error" in unwrapCallTool({ args: {} })).toBe(true);
        expect("error" in unwrapCallTool({ name: CLI_CALL_TOOL, args: {} })).toBe(true);
      });
    });
  });
});

// modern_campus 조수 연결(campusPolicy) + 실내 방 표 — 이 파일은 작성 시 실행하지 않았다(not run).
// 칩셋이 번들에 구워지기 전이라 프로젝트에 칩셋이 «있는» 상태는 합성 정의로 만든다(번들 이미지 id tex_modern_campus).
describe("campusPolicy", () => {
  isolateTimers();
  const START = "map_blank_start";
  const create = declaredIntent({ mode: "create", space: "outdoor" });
  /** 캠퍼스 칩셋을 «가진» 프로젝트 — 번들 id 만 맞춘 최소 정의(tileset 본문은 정책이 읽지 않는다). */
  function withCampus() {
    const project = createBlankProject();
    (project.tilesets as Record<string, unknown>)[CAMPUS_TILESET_ID] = { id: CAMPUS_TILESET_ID, name: "캠퍼스", image: { type: "bundled", id: "tex_modern_campus" } };
    project.maps["campus_map"] = { ...project.maps[START]!, id: "campus_map", tilesetId: CAMPUS_TILESET_ID } as never;
    return project;
  }
  describe("낱말", () => {
    it.each(["학교 하나 만들어줘", "학원물 배경", "대학 캠퍼스", "교실 장면", "동아리 방이 있는 교정", "기숙사가 있는 고등학교", "college campus", "school classroom"])("%s", (text) => {
      expect(describesCampus(text)).toBe(true);
    });
    it.each(["일본풍 학교 만들어줘", "일본 소학교 거리", "마법 학교 성", "jp_city 학교", "숲속 마을", "항구 도시"])("%s 는 아니다", (text) => {
      expect(describesCampus(text)).toBe(false);
    });
    it("칩셋 이름", () => {
      expect(namesCampusTileset("modern_campus 로 맵 만들어줘")).toBe(true);
      expect(namesCampusTileset("캠퍼스 칩셋")).toBe(true);
      expect(namesCampusTileset("학교 만들어줘")).toBe(false);
    });
  });
  describe("campusTargetFor — 칩셋이 프로젝트에 있을 때만", () => {
    it("칩셋이 없으면 이름을 불러도 낱말이 있어도 null", () => {
      const blank = createBlankProject();
      delete (blank.tilesets as Record<string, unknown>)[CAMPUS_TILESET_ID];   // 번들 배선 뒤 새 프로젝트는 칩셋을 갖고 태어난다 — 없는 프로젝트를 만든다
      expect(hasCampusTileset(blank)).toBe(false);
      expect(campusTargetFor(blank, create, "학교 만들어줘", START, false)).toBeNull();
      expect(campusTargetFor(blank, create, "modern_campus 로 학교", START, false)).toBeNull();
    });
    it("칩셋이 있으면 학교 낱말·칩셋 이름 생성 요청이 새 맵으로 간다", () => {
      const project = withCampus();
      expect(hasCampusTileset(project)).toBe(true);
      expect(campusTargetFor(project, create, "대학 캠퍼스 만들어줘", START, false)).toEqual({});
      expect(campusTargetFor(project, create, "modern_campus 맵 하나", START, false)).toEqual({});
    });
    it("보는 맵이 이미 캠퍼스면 수정도 그 맵", () => {
      const project = withCampus();
      const modify = declaredIntent({ mode: "modify", space: "outdoor" });
      expect(campusTargetFor(project, modify, "벤치 더해줘", "campus_map", true)).toEqual({ mapId: "campus_map", lived: true });
    });
    it("일본풍 학교·마법 학교·학교 낱말 없는 요청·실내·질문은 가지 않는다", () => {
      const project = withCampus();
      expect(campusTargetFor(project, create, "일본풍 학교 만들어줘", START, false)).toBeNull();
      expect(campusTargetFor(project, create, "마법 학교 만들어줘", START, false)).toBeNull();
      expect(campusTargetFor(project, create, "항구 마을 만들어줘", START, false)).toBeNull();
      expect(campusTargetFor(project, declaredIntent({ mode: "question", space: "interior" }), "교실이 뭐야", START, false)).toBeNull();
      expect(campusTargetFor(project, declaredIntent({ mode: "question", space: "outdoor" }), "학교가 뭐야", START, false)).toBeNull();
    });
    it("학교 실내(교실·복도·기숙사 방)는 실내 길 — 판타지 실내로 새지 않는다(2026-10-14 실측)", () => {
      const project = withCampus();
      expect(campusTargetFor(project, declaredIntent({ mode: "create", space: "interior" }), "교실 만들어줘", START, false)).toEqual({ indoor: true });
      expect(campusTargetFor(project, declaredIntent({ mode: "create", space: "unclear" }), "고등학교 교실과 복도", START, false)).toEqual({ indoor: true });
      expect(campusTargetFor(project, declaredIntent({ mode: "create", space: "unclear" }), "기숙사 방", START, false)).toEqual({ indoor: true });
      expect(campusTargetFor(project, declaredIntent({ mode: "create", space: "unclear" }), "대학교 캠퍼스 만들어줘", START, false)).toEqual({});
      const note = formatCampusNote({ indoor: true }, null);
      expect(note).toContain("build_hand_interior_room");
      expect(note).toContain("dorm-room");
      expect(note).toContain("atlas_biome_interior");
    });
    it("일본 학교는 칩셋이 둘 다 있어도 jp_city 쪽이 이긴다(호출자가 jp 먼저 부른다)", () => {
      const project = withCampus();
      (project.tilesets as Record<string, unknown>)["jp_city"] = { id: "jp_city", name: "일본 도시", image: { type: "bundled", id: "tex_jp_city" } };
      expect(jpCityTargetFor(project, create, "일본풍 학교 만들어줘", START, false)).toEqual({});
      expect(campusTargetFor(project, create, "일본풍 학교 만들어줘", START, false)).toBeNull();
    });
  });
  describe("시스템 프롬프트 줄", () => {
    it("칩셋이 없으면 아무 줄도 없다(없는 칩셋을 있다고 말하지 않는다)", () => {
      const blank = createBlankProject();
      delete (blank.tilesets as Record<string, unknown>)[CAMPUS_TILESET_ID];
      expect(campusPromptLines(blank, [START])).toEqual([]);
    });
    it("칩셋이 있으면 포인터, 범위에 캠퍼스 맵이 있으면 상세·실내 줄까지", () => {
      const project = withCampus();
      expect(scopeUsesCampus(project, [START])).toBe(false);
      expect(campusPromptLines(project, [START])).toEqual([CAMPUS_POINTER_LINE]);
      expect(scopeUsesCampus(project, ["campus_map"])).toBe(true);
      expect(campusPromptLines(project, ["campus_map"])).toEqual([CAMPUS_POINTER_LINE, CAMPUS_DETAIL_LINE, CAMPUS_INTERIOR_LINE]);
    });
    it("문장은 PAW 게이트 낱말(현대·모던·modern)과 겹치지 않는다 — 식별자 modern_campus 는 예외", () => {
      for (const raw of [CAMPUS_POINTER_LINE, CAMPUS_DETAIL_LINE, CAMPUS_INTERIOR_LINE, formatCampusNote({}, null), formatCampusNote({ mapId: "m", lived: true }, null)]) {
        const text = raw.replaceAll("modern_campus", "");
        expect(text).not.toMatch(/현대|모던|modern|contemporary/iu);
      }
      expect(CAMPUS_POINTER_LINE).toContain("jp_city");
      expect(CAMPUS_POINTER_LINE).toContain("wizarding_world");
      expect(CAMPUS_POINTER_LINE).toContain("build_hand_interior_room");
      expect(CAMPUS_DETAIL_LINE).toContain("접근칸");
    });
    it("노출 도구에 실내 조립·참고문서·땅 도구가 있다", () => {
      for (const tool of ["list_tileset_references", "read_tileset_reference", "build_hand_interior_room", "list_hand_interior_parts", "create_map", "check_reachability", "compose_campus_grounds", "link_campus_interior", "stamp_tileset_object"]) expect(CAMPUS_EXPOSED_TOOLS).toContain(tool);
    });
    it("의도 노트가 캠퍼스 대상이면 jp_city·버들항 노트 대신 캠퍼스 노트가 간다", () => {
      const project = withCampus();
      const note = buildPiIntentNote({ project, intent: create, targetMap: null, selection: null, campus: {}, requestText: "대학 캠퍼스" });
      expect(note).toContain("캠퍼스 칩셋");
      expect(note).not.toContain("compose_jp_city_street");
    });
  });
  describe("컨셉 힌트·시작 맵", () => {
    it("활성화됨 — 힌트가 정책 표와 지을 수 있는 타일셋 목록에 같이 있다", () => {
      expect(CAMPUS_CONCEPT_HINT["현대 학원·캠퍼스"]).toBe(CAMPUS_TILESET_ID);
      expect((BUILDABLE_CONCEPT_TILESETS as readonly string[]).includes(CAMPUS_TILESET_ID)).toBe(true);
    });
    it("컨셉이 modern_campus 를 가리키면 시작 맵 프롬프트가 캠퍼스 길을 말한다(버들항 아님)", () => {
      const plan = planStart({ seedText: "concept:campus-x", tilesetHint: CAMPUS_TILESET_ID });
      expect(plan.tilesetId).toBe(CAMPUS_TILESET_ID);
      expect(plan.prebuildTown).toBe(false);
      const prompt = startPlanPrompt(plan);
      expect(prompt).toContain("build_hand_interior_room");
      expect(prompt).toContain("modern_campus");
      expect(prompt).not.toContain("author_beodeul_town({theme");
    });
  });
  describe("실내 방 표(modernCampusRoomTable.json) — 방 12종·재사용/새 조각 id", () => {
    const spec = jpSpec as unknown as { objects: Record<string, unknown>; floors: Record<string, unknown>; walls: Record<string, unknown> };
    const table = roomTable as unknown as { kinds: Record<string, { ko: string; alias: string[] }>; buildings: Record<string, string>; examples: [string, string, string, [string, number][]][]; newObjectIds: string[]; floors: string[]; walls: string[]; dropped: string[] };

    it("요구한 방 12종이 모두 있고 낱말이 겹치지 않는다", () => {
      for (const kind of CAMPUS_ROOM_KINDS) expect(table.kinds[kind], kind).toBeTruthy();
      const seen = new Map<string, string>();
      for (const [kind, v] of Object.entries(table.kinds)) for (const alias of v.alias) {
        const key = alias.toLowerCase();
        expect(seen.get(key) === undefined || seen.get(key) === kind, `${alias} 가 ${seen.get(key)} 와 ${kind} 에 중복`).toBe(true);
        seen.set(key, kind);
      }
    });
    it("예제의 가구 id 는 새 조각이거나 jp_city 사양에 있는 재사용 id 다(없는 id 를 지어내지 않는다)", () => {
      const fresh = new Set(table.newObjectIds);
      for (const [map, building, kind, objects] of table.examples) {
        expect(table.buildings[building], map).toBeTruthy();
        expect(table.kinds[kind], `${map}/${kind}`).toBeTruthy();
        for (const [id] of objects) expect(fresh.has(id) || id in spec.objects, `${map}: ${id}`).toBe(true);
      }
    });
    it("버린 조각은 새 조각 목록에 없다", () => {
      for (const id of table.dropped) expect(table.newObjectIds).not.toContain(id);
      expect(table.newObjectIds.length).toBeGreaterThanOrEqual(40);
    });
    it("새 조각 id 는 mc- 로 시작하고 재사용 jp 사양 id 와 겹치지 않는다", () => {
      for (const id of [...table.newObjectIds, ...table.floors, ...table.walls]) { expect(id.startsWith("mc-")).toBe(true); expect(id in spec.objects || id in spec.floors || id in spec.walls).toBe(false); }
    });
  });
  describe("참고문서 번들(modernCampusInteriorReferences.json)", () => {
    const cats = references as unknown as { id: string; documents: { id: string; markdown: string }[]; images: { id: string; dataUrl: string }[] }[];
    it("용도 하나·문서 6·그림 7, id 는 mci- 머리, 그림은 경로(바이트 없음)", () => {
      expect(cats).toHaveLength(1);
      const cat = cats[0]!;
      expect(cat.documents.length).toBe(6);
      expect(cat.images.length).toBe(7);
      for (const doc of cat.documents) expect(doc.id.startsWith("mci-")).toBe(true);
      for (const image of cat.images) { expect(image.id.startsWith("mci-")).toBe(true); expect(image.dataUrl.startsWith("/assets/modern-campus-references/")).toBe(true); }
    });
    it("완성 예제에 전체 물건 배열·접근칸·이벤트 분리·변조 오류 코드가 있다", () => {
      const docs = new Map(cats[0]!.documents.map((d) => [d.id, d.markdown]));
      for (const id of ["mci-ex-school-class-wing", "mci-ex-school-special-wing", "mci-ex-school-cafeteria-club-wing", "mci-ex-dorm-1f", "mci-ex-dorm-2f"]) {
        const md = docs.get(id)!;
        expect(md, id).toContain("전체 물건 배열");
        expect(md).toContain("접근칸");
        expect(md).toContain("이벤트 없음");
      }
      const rules = docs.get("mci-rules")!;
      for (const code of ["door-not-in-gap", "overlap", "hang-not-on-face", "exit-blocked", "door-access-blocked", "not-on-floor"]) expect(rules).toContain(code);
      expect(rules).toContain("기숙사 층 연결");
    });
  });
});

// 이 기기의 다른 게임 겉모습 기록(src/ai/piAgent/gameLooks.ts) — 새 게임이 «이미 만든 게임들이 덜 쓴» 겉모습을 먼저 고르게 하는 재료.
// 기록이 없거나 저장소를 못 쓰면 빈 목록이다(고르기는 게임 열쇠 해시로 돌아간다).
describe("gameLooks", () => {
  isolateTimers();
  const lookOf = (stand: string): TilesetLook => ({ textureKey: "tex_beodeul_looks", stand, standKey: "tex_beodeul_stands" });
  const projectWith = (looks: Record<string, TilesetLook | undefined>): Pick<Project, "tilesets"> =>
    ({ tilesets: Object.fromEntries(Object.entries(looks).map(([id, look]) => [id, { id, ...(look ? { look } : {}) }])) } as unknown as Pick<Project, "tilesets">);
  describe("game looks — 이 기기의 다른 게임 겉모습 기록", () => {
    let store: Map<string, string>;
    beforeEach(() => {
      store = new Map();
      vi.stubGlobal("localStorage", {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => { store.set(key, value); },
        removeItem: (key: string) => { store.delete(key); },
      });
    });
    afterEach(() => { vi.unstubAllGlobals(); });

    it("적은 게임의 겉모습은 다른 게임에게만 보인다 — 제 것은 빠지고, 다시 적으면 바뀐다", () => {
      rememberGameLooks("game-a", projectWith({ beodeul_city: lookOf("oakwood") }));
      rememberGameLooks("game-b", projectWith({ beodeul_city: lookOf("pinewood"), other: undefined }));
      expect(otherGameLooks("game-a")).toEqual([lookOf("pinewood")]);
      expect(otherGameLooks("game-b")).toEqual([lookOf("oakwood")]);
      expect(otherGameLooks("game-c").map((look) => look.stand).sort()).toEqual(["oakwood", "pinewood"]);
      rememberGameLooks("game-a", projectWith({ beodeul_city: lookOf("citrus") }));
      expect(otherGameLooks("game-b")).toEqual([lookOf("citrus")]);
    });

    it("겉모습이 없는 프로젝트는 적지 않고(전에 적은 것은 남는다), 열쇠가 없으면 아무것도 하지 않는다", () => {
      rememberGameLooks("game-a", projectWith({ beodeul_city: lookOf("oakwood") }));
      rememberGameLooks("game-a", projectWith({ beodeul_city: undefined }));
      rememberGameLooks(undefined, projectWith({ beodeul_city: lookOf("pinewood") }));
      rememberGameLooks("  ", projectWith({ beodeul_city: lookOf("pinewood") }));
      expect(otherGameLooks("game-z")).toEqual([lookOf("oakwood")]);
      expect(otherGameLooks(undefined)).toEqual([]);
    });

    it("스물넷까지만 기억한다 — 가장 오래된 게임부터 잊는다", () => {
      for (let n = 0; n < 30; n += 1) rememberGameLooks(`game-${n}`, projectWith({ beodeul_city: lookOf(`stand-${n}`) }));
      const stands = otherGameLooks("someone-else").map((look) => look.stand);
      expect(stands.length).toBe(24);
      expect(stands).not.toContain("stand-0");
      expect(stands).toContain("stand-29");
    });

    it("저장소가 없거나 깨진 값이면 빈 목록이다", () => {
      store.set("oprn-game-looks-v1", "{not json");
      expect(otherGameLooks("game-a")).toEqual([]);
      vi.stubGlobal("localStorage", undefined);
      expect(() => rememberGameLooks("game-a", projectWith({ beodeul_city: lookOf("oakwood") }))).not.toThrow();
      expect(otherGameLooks("game-b")).toEqual([]);
    });
  });
});

// 2026-09-23 「등대지기의 겨울」 재시험(origin/main a5b552712 이후)에서 게임을 끝낼 수 없던 결함들의 회귀.
// 동료 합류·보스전 선택지가 빈 분기, 구출 후 페이지를 여는 스위치·엔딩 호출 없음, 마을 맵 「빈 맵」, 같은 이름의 빈 맵 고아.
describe("jrpgDogfoodRetestRegressions", () => {
  isolateTimers();
  function blank(): { ctx: { project: Project }; mapId: string } {
    const project = createBlankProject();
    return { ctx: { project }, mapId: project.startMapId };
  }
  function eventOf(project: Project, mapId: string, id: string): GameEvent {
    const event = project.maps[mapId]!.events.find(entry => entry.id === id);
    if (!event) throw new Error(`missing event ${id}`);
    return event;
  }
  function choicesOf(event: GameEvent): Extract<Command, { kind: "choices" }> {
    const command = event.pages![0]!.commands.find(entry => entry.kind === "choices");
    if (!command || command.kind !== "choices") throw new Error("no choices command");
    return command;
  }
  function warningsOf(result: unknown): string {
    return ((result as { diff?: { warnings?: string[] } }).diff?.warnings ?? []).join("\n");
  }
  function companionArgs(mapId: string, actorId: string, key: "commands" | "branch"): Record<string, unknown> {
    return {
      mapId, x: 3, y: 3, id: "ev_companion_kyle", name: "떠돌이 어부 소년 카일",
      pages: [
        {
          lines: ["루나, 안색이 안 좋네."],
          choices: [
            { text: "동행을 제안한다", [key]: [{ kind: "changeParty", actorId, action: "add" }, { kind: "setSelfSwitch", key: "A", value: true }] },
            { text: "잠시 기다려달라고 한다" },
          ],
        },
        { conditions: [{ kind: "selfSwitch", key: "A", value: true }], lines: ["등대 불꽃을 되찾으러 가자!"] },
      ],
    };
  }
  describe("defect 1 — choices lose their branches", () => {
    it("place_npc keeps a choice sent with the native `branch` key (was silently dropped) and says so", () => {
      const { ctx, mapId } = blank();
      const actorId = ctx.project.database.actors[1]!.id;
      const result = runTool(ctx, "place_npc", companionArgs(mapId, actorId, "branch"));
      expect(result.ok, result.summary).toBe(true);
      const choices = choicesOf(eventOf(ctx.project, mapId, "ev_companion_kyle"));
      expect(choices.options[0]!.branch).toEqual([
        { kind: "changeParty", actorId, action: "add" },
        { kind: "setSelfSwitch", key: "A", value: true },
      ]);
      expect(warningsOf(result)).toContain("branch를 선택지 commands로 읽었습니다");
    });

    it("the Pi tool path (createPiToolset → place_npc) keeps the branch too", async () => {
      const project = createBlankProject();
      const ctx = { project };
      const actorId = project.database.actors[1]!.id;
      const [tool] = createPiToolset(ctx, { toolNames: ["place_npc"] });
      await tool!.execute("call_1", companionArgs(project.startMapId, actorId, "branch"), undefined as never);
      const choices = choicesOf(eventOf(ctx.project, project.startMapId, "ev_companion_kyle"));
      expect(choices.options[0]!.branch.map(command => command.kind)).toEqual(["changeParty", "setSelfSwitch"]);
    });

    it("run_scene_test can drive the choice and proves the join", () => {
      const { ctx, mapId } = blank();
      const actorId = ctx.project.database.actors[1]!.id;
      expect(runTool(ctx, "place_npc", companionArgs(mapId, actorId, "branch")).ok).toBe(true);
      const event = eventOf(ctx.project, mapId, "ev_companion_kyle");
      const scene = runTool(ctx, "run_scene_test", {
        mapId, start: { x: event.x, y: event.y + 1 },
        steps: [{ kind: "face", dir: "up" }, { kind: "interact", eventId: event.id }, { kind: "choose", index: 0 }, { kind: "expect", partyIncludes: actorId }],
      });
      expect((scene.data as { ok: boolean; failureReason?: string }).ok, (scene.data as { failureReason?: string }).failureReason).toBe(true);
    });

    it("warns when every branch of a choice is empty — choosing does nothing", () => {
      const { ctx, mapId } = blank();
      const result = runTool(ctx, "place_npc", {
        mapId, x: 3, y: 3, id: "ev_blizzard_boss", name: "눈보라 정령",
        pages: [{ lines: ["크크크..."], choices: [{ text: "정령과 맞선다!" }, { text: "물러선다" }] }],
      });
      expect(result.ok, result.summary).toBe(true);
      expect(warningsOf(result)).toMatch(/「정령과 맞선다!」\/「물러선다」의 분기가 모두 비어/u);
    });

    it("upsert_event moves options[].commands onto branch instead of rejecting or emptying it", () => {
      const { ctx, mapId } = blank();
      const actorId = ctx.project.database.actors[1]!.id;
      const result = runTool(ctx, "upsert_event", {
        mapId,
        event: {
          id: "ev_kyle_native", x: 4, y: 4, trigger: { kind: "action" },
          pages: [{
            conditions: [], graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" }, pattern: 0 },
            commands: [{ kind: "choices", options: [
              { text: "동행", commands: [{ kind: "changeParty", actorId, action: "add" }] },
              { text: "대기", branch: [] },
            ] }],
          }],
        },
      });
      expect(result.ok, result.summary).toBe(true);
      expect(choicesOf(eventOf(ctx.project, mapId, "ev_kyle_native")).options[0]!.branch).toEqual([{ kind: "changeParty", actorId, action: "add" }]);
      expect(warningsOf(result)).toContain("branch 로 옮겼습니다");
    });
  });
  describe("defect 2 — rescue page that nothing opens, ending nothing triggers", () => {
    const grandpa = (mapId: string) => ({
      mapId,
      event: {
        id: "ev_harmont_keeper", x: 5, y: 5, trigger: { kind: "action" },
        pages: [
          { conditions: [], graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" }, pattern: 25 }, commands: [{ kind: "text", body: "어서 정령을 물리쳐다오!" }] },
          { conditions: [{ kind: "switch", switchId: "sw_catalog_lighthouse_lit", value: true }], graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" }, pattern: 25 }, commands: [{ kind: "text", body: "너희가 날 구해주었구나!" }] },
        ],
      },
    });

    it("upsert_event warns that no command in the project turns the page's switch on", () => {
      const { ctx, mapId } = blank();
      const result = runTool(ctx, "upsert_event", grandpa(mapId));
      expect(result.ok, result.summary).toBe(true);
      expect(warningsOf(result)).toContain("sw_catalog_lighthouse_lit");
      expect(warningsOf(result)).toContain("setSwitch 가 아직 없습니다");
    });

    it("the warning disappears once a boss victory branch sets the switch", () => {
      const { ctx, mapId } = blank();
      const troopId = ctx.project.database.troops[0]!.id;
      const boss = runTool(ctx, "place_npc", {
        mapId, x: 8, y: 8, id: "ev_boss", name: "눈보라 정령",
        pages: [{ lines: ["크크크"], choices: [
          { text: "맞선다", commands: [{ kind: "battleProcessing", troopId, canEscape: false, canLose: false, victoryBranch: [{ kind: "setSwitch", switchId: "sw_catalog_lighthouse_lit", value: true }] }] },
          { text: "물러선다" },
        ] }],
      });
      expect(boss.ok, `${boss.summary} ${JSON.stringify(boss.issues ?? [])}`).toBe(true);
      const result = runTool(ctx, "upsert_event", grandpa(mapId));
      expect(result.ok, result.summary).toBe(true);
      expect(warningsOf(result)).not.toContain("sw_catalog_lighthouse_lit");
    });

    it("define_ending warns while no event calls triggerEnding", () => {
      const { ctx } = blank();
      const result = runTool(ctx, "define_ending", { id: "ending_light", name: "등대의 불", conditions: [] });
      expect(result.ok, result.summary).toBe(true);
      expect(warningsOf(result)).toContain("triggerEnding");
    });
  });
  // Removed describe "defect 3 — village keeps the placeholder": author_village was removed from the tool registry on purpose.

  describe("defect 4 — empty duplicate map left by create_map + room pipeline", () => {
    // Removed it "run_dungeon_room_pipeline adopts a create_map": run_dungeon_room_pipeline was removed from the tool registry on purpose.

    // Removed it "an authored map is still protected (map-exists)": run_dungeon_room_pipeline was removed from the tool registry on purpose.

    it("create_map warns when a blank map with the same name already exists", () => {
      const { ctx } = blank();
      expect(runTool(ctx, "create_map", { id: "map_lighthouse_top", name: "서리불꽃 등대 꼭대기", width: 20, height: 15 }).ok).toBe(true);
      const second = runTool(ctx, "create_map", { id: "map_lighthouse_peak", name: "서리불꽃 등대 꼭대기", width: 20, height: 16 });
      expect(second.ok).toBe(true);
      expect(warningsOf(second)).toContain("map_lighthouse_top");
    });
  });
});
