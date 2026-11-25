import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { buildAiActivityLogRecord, clearAiActivityLogs, extractCommitIdsFromAudit, getAiActivityLog, listAiActivityLogs, recordAiActivity } from "@/ai/activityLog";
import type { AuditEntry } from "@/ai/assistantSession";
import { TOOL_REASON_KEY, harnessToolReason, injectToolReasonSchema, isUsableToolReason, missingToolReasonResult, preferRicherActivityRecord, reasonForUiAction, splitToolCallReason, toolCallsFromAudit } from "@/ai/toolReason";
import { toOpenAiTools } from "@/editor/tools";
import { isolateTimers } from "./mergedTeardown";

describe("aiActivityDiagnostics", () => {
  isolateTimers();
  describe("AI activity diagnostics", () => {
    it("성공으로 끝난 의도 재질문도 QA 경고로 분류한다", () => {
      const record = buildAiActivityLogRecord({
        channel: "chat",
        instruction: "집 2채와 실내 방 하나를 만들어줘",
        result: { ok: true, stoppedReason: "final", proposedCalls: 0 },
        audit: [
          {
            kind: "status",
            text: "의도 확인(house-vs-interior): 실내·야외 표지가 동시에 있음",
            at: "2026-08-23T00:00:00.000Z",
          },
        ],
      });

      expect(record.diagnostics.severity).toBe("warning");
      expect(record.diagnostics.kinds).toContain("intent-clarification");
    });

    it("ok:false 툴은 턴 결과가 true여도 오류와 툴 이름을 남긴다", () => {
      const record = buildAiActivityLogRecord({
        channel: "chat",
        instruction: "적을 만들어줘",
        result: { ok: true, stoppedReason: "final" },
        toolCalls: [
          { name: "upsert_enemy", args: {}, ok: false, summary: "enemy.id is required" },
        ],
      });

      expect(record.diagnostics.severity).toBe("error");
      expect(record.diagnostics.kinds).toContain("tool-failure");
      expect(record.diagnostics.failedTools).toEqual(["upsert_enemy"]);
    });


    // 진행 중(pending)인 턴을 실패로 진단하면 아직 끝나지 않은 작업이 오류로 집계된다 —
    // 사용자 QA 원장 LOG-004 는 같은 행에 `result.pending:true` 와 `diagnostics.severity:error`,
    // `턴 실패: unknown` 이 함께 기록된 것을 실측으로 남겼다(docs/qa/saesol-three-hour-ai-authoring.md:135-142).
    // 사람이 읽는 요약은 이미 "진행 중" 이다(activityLogText.ts 의 pending 분기) — 진단도 같아야 한다.
    it("진행 중인 턴은 실패 진단을 만들지 않는다", () => {
      const record = buildAiActivityLogRecord({
        channel: "chat",
        instruction: "마을을 만들어줘",
        result: { ok: false, pending: true },
      });

      expect(record.diagnostics.severity).toBe("ok");
      expect(record.diagnostics.kinds).not.toContain("turn-error");
      expect(record.diagnostics.messages.some(message => message.includes("턴 실패"))).toBe(false);
    });

    it("실패한 완료 게이트는 WorkPlan 오류로 분류한다", () => {
      const record = buildAiActivityLogRecord({
        channel: "chat",
        instruction: "계획을 완료해줘",
        result: { ok: true, stoppedReason: "final" },
        toolCalls: [{ name: "complete_work_item", args: { itemId: "L1-a" }, ok: false, summary: "필수 툴 미실행" }],
      });

      expect(record.diagnostics.kinds).toEqual(expect.arrayContaining(["tool-failure", "work-plan"]));
    });

    it("노출 툴 목록의 complete_work_item·skip_work_item 문자열은 WorkPlan 실패가 아니다", () => {
      const record = buildAiActivityLogRecord({
        channel: "chat",
        instruction: "현재 맵을 설명해줘",
        result: { ok: true, stoppedReason: "final" },
        audit: [{
          kind: "status",
          text: "tools:exposed 3 — get_map_region,complete_work_item,skip_work_item",
          at: "2026-08-23T00:00:00.000Z",
        }],
      });

      expect(record.diagnostics).toEqual({ severity: "ok", kinds: [], messages: [], failedTools: [] });
    });
    // 2026-08-29 실측: `run_interior_room_pipeline` 실패 3건의 진단이 전부 이 한 줄이었다.
    //   run_interior_room_pipeline: 'run_interior_room_pipeline' 커밋 거부(무결성 오류)
    // 커밋 거부 summary 는 어느 lint 가 터졌든 고정 문구라 그 줄만으로는 원인을 알 수 없다.
    // 정작 원인(`시작 위치가 통행 불가 타일입니다: (10, 12)`)은 audit[].issues 에 이미 있었고,
    // toolCalls 가 먼저 밋밋한 줄을 넣으면 audit 쪽 줄이 이름 중복으로 건너뛰어졌다.
    it("커밋 거부의 실제 lint 메시지를 진단 한 줄에 싣는다", () => {
      const record = buildAiActivityLogRecord({
        channel: "chat",
        instruction: "이 맵을 집으로 만들어라",
        result: { ok: true, stoppedReason: "final" },
        toolCalls: [{
          name: "run_interior_room_pipeline",
          args: { mapId: "map_gallery_main" },
          ok: false,
          summary: "'run_interior_room_pipeline' 커밋 거부(무결성 오류)",
        }],
        audit: [{
          kind: "tool",
          name: "run_interior_room_pipeline",
          args: { mapId: "map_gallery_main" },
          ok: false,
          summary: "'run_interior_room_pipeline' 커밋 거부(무결성 오류)",
          issues: ["시작 위치가 통행 불가 타일입니다: (10, 12)"],
          at: "2026-08-29T09:32:41.367Z",
        }],
      });

      const message = record.diagnostics.messages.find((entry) => entry.startsWith("run_interior_room_pipeline:"));
      expect(message, `messages: ${JSON.stringify(record.diagnostics.messages)}`).toBeDefined();
      // 핵심: 좌표까지 그대로 남아야 한다. 이게 없으면 코드를 역추적해야 한다.
      expect(message).toContain("시작 위치가 통행 불가 타일입니다: (10, 12)");
      // 도구 이름과 원래 summary 도 유지한다.
      expect(message).toContain("커밋 거부");
    });

    it("issue 가 많으면 앞 3건만 싣고 나머지는 개수로 알린다 — 요약이 로그가 되면 안 된다", () => {
      const record = buildAiActivityLogRecord({
        channel: "chat",
        instruction: "실내를 다시 지어줘",
        result: { ok: true, stoppedReason: "final" },
        audit: [{
          kind: "tool",
          name: "run_interior_room_pipeline",
          args: {},
          ok: false,
          summary: "커밋 거부(무결성 오류)",
          issues: ["첫째", "둘째", "셋째", "넷째", "다섯째"],
          at: "2026-08-29T09:32:41.367Z",
        }],
      });

      const message = record.diagnostics.messages[0]!;
      expect(message).toContain("첫째");
      expect(message).toContain("셋째");
      expect(message).not.toContain("넷째");
      expect(message).toContain("+2건");
    });

    it("issue 가 없는 실패는 예전 형식 그대로 남긴다", () => {
      const record = buildAiActivityLogRecord({
        channel: "chat",
        instruction: "적을 만들어줘",
        result: { ok: true, stoppedReason: "final" },
        toolCalls: [{ name: "upsert_enemy", args: {}, ok: false, summary: "enemy.id is required" }],
      });

      expect(record.diagnostics.messages).toEqual(["upsert_enemy: enemy.id is required"]);
    });

    it("문제 없는 턴은 ok로 분류한다", () => {
      const record = buildAiActivityLogRecord({
        channel: "chat",
        instruction: "현재 맵을 설명해줘",
        result: { ok: true, stoppedReason: "final" },
      });

      expect(record.diagnostics).toEqual({ severity: "ok", kinds: [], messages: [], failedTools: [] });
    });
  });
});

// 활동 로그 행이 «빠짐없이 남고 찾을 수 있는가» 를 잠근다.
//
// 실측 배경 (2026-08-30): 채팅 턴 1행에 audit 이 정확히 200칸으로 잘려 **첫 칸이 이미 턴 중간의
// `tools:escalated`** 였다. 사람 발언과 플래너 결정이 사라진 것이고, 잘렸다는 표시도 없어서
// "원래 그만큼이었다" 로 읽혔다. 툴도 114회 중 67개만 남았다. 그리고 남은 것조차 payload 안에만
// 있어 "set_event 를 부른 턴" 을 알려면 169KB 를 받아 grep 해야 했다.
describe("aiActivityLogIndex", () => {
  isolateTimers();
  function stubStorage(): void {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => storage.clear(),
    });
  }
  describe("ai activity record — 예산 절단과 평탄 색인", () => {
    beforeEach(() => {
      stubStorage();
      clearAiActivityLogs();
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    it("keeps well past the old 200/80 caps when the rows are small", () => {
      const audit: AuditEntry[] = Array.from({ length: 900 }, (_, index) => ({
        kind: "status",
        text: `step ${index}`,
      }));
      const toolCalls = Array.from({ length: 300 }, (_, index) => ({
        name: `tool_${index}`,
        args: { index },
        ok: true,
        summary: "ok",
      }));
      const record = buildAiActivityLogRecord({
        channel: "chat",
        instruction: "많이 해줘",
        result: { ok: true },
        audit,
        toolCalls,
      });
      // 칸수 상한이 사라졌다 — 짧은 행 900개는 전부 들어간다(옛 상한이면 200/80).
      expect(record.audit).toHaveLength(900);
      expect(record.toolCalls).toHaveLength(300);
      expect(record.truncated).toBeUndefined();
    });

    it("marks what the byte budget dropped instead of trimming silently", () => {
      // 한 칸은 clipText 로 4,000자에서 잘리므로 칸당 약 4KB 다 — 150칸이면 audit 예산(384KB)을 넘긴다.
      const fat = "가".repeat(20_000);
      const rows = 150;
      const audit: AuditEntry[] = Array.from({ length: rows }, (_, index) => ({
        kind: "status",
        text: `${index}:${fat}`,
      }));
      const record = buildAiActivityLogRecord({
        channel: "chat",
        instruction: "무거운 턴",
        result: { ok: true },
        audit,
      });
      expect(record.audit.length).toBeLessThan(rows);
      expect(record.truncated?.audit).toBe(rows - record.audit.length);
      // 양 끝을 남긴다 — 버리는 건 가운데다. 첫 칸(사람 발언·플래너 결정 자리)이 사라지는 게
      // 이 작업의 출발점이었던 실패다.
      expect((record.audit[0] as { text: string }).text.startsWith("0:")).toBe(true);
      expect(record.audit.at(-1)?.kind).toBe("status");
      expect((record.audit.at(-1) as { text: string }).text.startsWith(`${rows - 1}:`)).toBe(true);
      // 가운데가 정말 빠졌는지 — 연속이면 절단이 아니라 그냥 다 담긴 것이다.
      const indices = record.audit.map((entry) => Number((entry as { text: string }).text.split(":")[0]));
      expect(indices.some((value, at) => at > 0 && value !== (indices[at - 1] as number) + 1)).toBe(true);
    });

    it("keeps both ends of a 100+ tool turn and still indexes what it dropped", () => {
      // 계획의 절단 회귀 항목: 툴 100개 넘는 턴에서 표기가 되고 앞부분이 살아 있는지.
      // 한 호출을 예산(128KB)의 1/20 쯤으로 부풀려 120개면 확실히 넘긴다.
      const fat = "가".repeat(4_000);
      const toolCalls = Array.from({ length: 120 }, (_, index) => ({
        name: `tool_${index}`,
        args: { note: fat },
        ok: index % 10 !== 0,
        summary: `${index}:${fat}`,
      }));
      const record = buildAiActivityLogRecord({
        channel: "chat",
        instruction: "다 깔아줘",
        result: { ok: true },
        toolCalls,
      });

      expect(record.toolCalls.length).toBeLessThan(120);
      expect(record.truncated?.toolCalls).toBe(120 - record.toolCalls.length);
      expect(record.toolCalls[0]?.name).toBe("tool_0"); // 첫 호출이 남는다
      expect(record.toolCalls.at(-1)?.name).toBe("tool_119"); // 마지막 호출도 남는다
      // 색인은 절단 전 전체에서 만든다 — 가운데로 버려진 툴도 SQL 로 찾을 수 있어야 한다.
      expect(record.index.toolNames).toHaveLength(120);
      expect(record.index.toolNames).toContain("tool_60");
      expect(record.index.failedToolNames).toContain("tool_60");
    });

    it("builds the flat index that SQL containment can hit", () => {
      const record = buildAiActivityLogRecord({
        channel: "chat",
        instruction: "석상에 말걸면 어케됨?",
        mapId: "map_blank_start",
        result: { ok: false },
        toolCalls: [
          { name: "paint_road", args: {}, ok: true, summary: "깔았다" },
          { name: "complete_work_item", args: {}, ok: false, summary: "거부" },
        ],
        audit: [
          { kind: "user", text: "석상에 말걸면 어케됨?\n\n[컨텍스트] 맵: 빈 맵" },
          { kind: "tool", name: "set_event", args: { mapId: "map_town" }, ok: true, summary: "이벤트" },
          { kind: "status", text: "마일스톤 적용: 석상 commit=bc9eb432-1111-2222-3333-444455556666" },
        ],
        uiActions: [
          { at: "2026-08-30T04:00:00.000Z", seq: 1, surface: "panel", action: "turn-rewind" },
          { at: "2026-08-30T04:00:01.000Z", seq: 2, surface: "panel", action: "turn-rewind" },
        ],
      });

      expect(record.index.toolNames).toContain("paint_road");
      expect(record.index.toolNames).toContain("set_event");
      expect(record.index.failedToolNames).toEqual(["complete_work_item"]);
      expect(record.index.uiActions).toEqual(["turn-rewind"]); // 중복 제거
      expect(record.index.mapIds).toEqual(["map_blank_start", "map_town"]);
      expect(record.index.commitIds).toEqual(["bc9eb432-1111-2222-3333-444455556666"]);
      // 기계 footer 를 뗀 사람 문장만 색인한다 — 붙이면 모든 행이 같은 맵 이름으로 시작한다.
      expect(record.index.userTexts).toEqual(["석상에 말걸면 어케됨?"]);
      // 커밋 id 는 구조적으로도 결과에 실린다(예전에는 audit 텍스트를 정규식으로 긁어야 했다).
      expect(record.result.commitIds).toEqual(["bc9eb432-1111-2222-3333-444455556666"]);
    });

    it("keeps ui actions on the row and caps them without hiding the count", () => {
      const uiActions = Array.from({ length: 460 }, (_, index) => ({
        at: `2026-08-30T04:00:${String(index % 60).padStart(2, "0")}.000Z`,
        seq: index + 1,
        surface: "panel",
        action: `click:btn-${index}`,
      }));
      const record = buildAiActivityLogRecord({
        channel: "chat",
        instruction: "많이 눌렀다",
        result: { ok: true },
        uiActions,
      });
      expect(record.uiActions).toHaveLength(400);
      expect(record.truncated?.uiActions).toBe(60);
      expect(record.uiActions?.at(-1)?.action).toBe("click:btn-459");
    });

    it("upserts the pending row into the finished row under one id", async () => {
      const id = "11111111-2222-3333-4444-555555555555";
      await recordAiActivity({
        id,
        channel: "chat",
        instruction: "니 추천대로",
        result: { ok: false, pending: true },
      });
      expect(getAiActivityLog(id)?.result.pending).toBe(true);

      await recordAiActivity({
        id,
        channel: "chat",
        instruction: "니 추천대로",
        result: { ok: true, proposedCalls: 3 },
        audit: [{ kind: "user", text: "니 추천대로" }],
      });
      const finished = getAiActivityLog(id);
      expect(finished?.result.pending).toBeUndefined();
      expect(finished?.result.proposedCalls).toBe(3);
      // 행이 늘지 않는다 — 시작·종료가 같은 id 로 덮인다.
      expect(listAiActivityLogs().filter((row) => row.id === id)).toHaveLength(1);
      expect(listAiActivityLogs()).toHaveLength(1);
    });

    it("records the orphaned turn instead of dropping it", async () => {
      const record = await recordAiActivity({
        channel: "chat",
        instruction: "늦게 도착한 턴",
        result: { ok: false, orphaned: true, stoppedReason: "ownership-lost" },
      });
      expect(record.result.orphaned).toBe(true);
      expect(record.result.stoppedReason).toBe("ownership-lost");
      expect(getAiActivityLog(record.id)?.result.orphaned).toBe(true);
    });

    it("writes a ui channel row that carries the pressed action names", async () => {
      const { recordAiUiActionBatch } = await import("@/ai/activityLog");
      const record = await recordAiUiActionBatch([
        { at: "2026-08-30T04:10:00.000Z", seq: 10, surface: "context-panel", action: "context-compact" },
        { at: "2026-08-30T04:10:02.000Z", seq: 11, surface: "panel", action: "dock-switch" },
      ]);
      expect(record?.channel).toBe("ui");
      // instruction 이 DB 의 유일한 평문 검색 축이다(`instruction=ilike.*dock-switch*`).
      expect(record?.instruction).toBe("[ui] context-compact, dock-switch");
      expect(record?.index.uiActions).toEqual(["context-compact", "dock-switch"]);
      expect(await recordAiUiActionBatch([])).toBeNull();
    });

    it("extracts commit ids from status lines through one shared helper", () => {
      expect(
        extractCommitIdsFromAudit([
          { kind: "status", text: "적용 commit=aaaaaaaa-1111-2222-3333-444444444444" },
          { kind: "status", text: "적용 commit=aaaaaaaa-1111-2222-3333-444444444444" },
          { kind: "user", text: "commit=cccccccc-1111-2222-3333-444444444444" },
        ]),
      ).toEqual(["aaaaaaaa-1111-2222-3333-444444444444"]);
    });
  });
});

describe("toolReason", () => {
  isolateTimers();
  describe("tool call reason", () => {
    it("injects a required reason field onto any tool schema", () => {
      const next = injectToolReasonSchema({
        type: "object",
        properties: { mapId: { type: "string" } },
        required: ["mapId"],
        additionalProperties: false,
      });
      expect(next.properties?.[TOOL_REASON_KEY]?.type).toBe("string");
      expect(next.required).toContain("mapId");
      expect(next.required).toContain(TOOL_REASON_KEY);
    });

    it("exposes reason on every OpenAI tool schema", () => {
      const tools = toOpenAiTools();
      expect(tools.length).toBeGreaterThan(0);
      for (const tool of tools) {
        const required = tool.function.parameters.required ?? [];
        expect(required, tool.function.name).toContain(TOOL_REASON_KEY);
        expect(tool.function.parameters.properties?.[TOOL_REASON_KEY]?.type, tool.function.name).toBe("string");
      }
    });

    it("splits reason out of tool args so the runner never sees it", () => {
      const split = splitToolCallReason({
        mapId: "map_hub",
        reason: "기존 구조물이 허브 맵 시공을 막고 있어서 자리를 비운다",
      });
      expect(split.missing).toBe(false);
      expect(split.reason).toBe("기존 구조물이 허브 맵 시공을 막고 있어서 자리를 비운다");
      expect(split.args).toEqual({ mapId: "map_hub" });
    });

    it("rejects blank reasons", () => {
      expect(isUsableToolReason("  ")).toBe(false);
      expect(splitToolCallReason({ mapId: "m" }).missing).toBe(true);
      expect(missingToolReasonResult("tile_erase").ok).toBe(false);
      expect(missingToolReasonResult("tile_erase").summary).toMatch(/reason/);
    });

    it("names harness and UI actions so they are never silent", () => {
      expect(harnessToolReason("verification", "play_walkthrough")).toMatch(/검증/);
      expect(harnessToolReason("spec-npc", "헬레나")).toMatch(/헬레나/);
      expect(reasonForUiAction({ action: "click:ai-chat-send", label: "보내기" })).toBe("사용자 클릭: 보내기");
    });
  });
  describe("activity log keeps reasons and does not clobber richer rows", () => {
    beforeEach(() => {
      const storage = new Map<string, string>();
      vi.stubGlobal("localStorage", {
        getItem: (k: string) => storage.get(k) ?? null,
        setItem: (k: string, v: string) => {
          storage.set(k, v);
        },
        removeItem: (k: string) => {
          storage.delete(k);
        },
        clear: () => storage.clear(),
      });
      clearAiActivityLogs();
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    it("stores tool reasons on the record and the flat index", () => {
      const record = buildAiActivityLogRecord({
        channel: "chat",
        instruction: "막힌 진행을 찾아줘",
        result: { ok: true },
        toolCalls: [
          {
            name: "tile_erase",
            args: { mapId: "map_hub" },
            ok: true,
            summary: "754칸",
            reason: "다음에 author_village 를 찍을 자리를 비운다",
          },
        ],
        audit: [
          {
            kind: "tool",
            name: "tile_erase",
            args: { mapId: "map_hub" },
            ok: true,
            summary: "754칸",
            reason: "다음에 author_village 를 찍을 자리를 비운다",
          },
        ],
      });
      expect(record.toolCalls[0]?.reason).toBe("다음에 author_village 를 찍을 자리를 비운다");
      expect(record.index.reasons).toContain("다음에 author_village 를 찍을 자리를 비운다");
    });

    it("maps audit tool rows into persistable tool calls with reasons", () => {
      const calls = toolCallsFromAudit([
        { kind: "user", text: "검토해줘" },
        {
          kind: "tool",
          name: "tile_erase",
          args: { mapId: "map_hub" },
          ok: true,
          summary: "정리",
          reason: "겹친 실패물을 지운다",
        },
      ]);
      expect(calls).toEqual([
        {
          name: "tile_erase",
          args: { mapId: "map_hub" },
          ok: true,
          summary: "정리",
          reason: "겹친 실패물을 지운다",
        },
      ]);
    });

    it("does not let a late empty pending start overwrite a richer same-id row", () => {
      const rich = buildAiActivityLogRecord({
        id: "turn-1",
        channel: "chat",
        instruction: "검토해줘",
        result: { ok: false, pending: true },
        toolCalls: [
          {
            name: "tile_erase",
            args: {},
            ok: true,
            summary: "754",
            reason: "재시공 전 청소",
          },
        ],
      });
      const emptyStart = buildAiActivityLogRecord({
        id: "turn-1",
        channel: "chat",
        instruction: "검토해줘",
        result: { ok: false, pending: true },
      });
      const kept = preferRicherActivityRecord(rich, emptyStart);
      expect(kept.toolCalls).toHaveLength(1);
      expect(kept.toolCalls[0]?.reason).toBe("재시공 전 청소");
    });

    it("recordAiActivity upsert keeps the richer local row", async () => {
      await recordAiActivity({
        id: "turn-race",
        channel: "chat",
        instruction: "검토해줘",
        result: { ok: false, pending: true },
        toolCalls: [{ name: "tile_erase", args: {}, ok: true, summary: "ok", reason: "자리 비움" }],
      });
      await recordAiActivity({
        id: "turn-race",
        channel: "chat",
        instruction: "검토해줘",
        result: { ok: false, pending: true },
      });
      const latest = buildAiActivityLogRecord({
        id: "ignored",
        channel: "chat",
        instruction: "x",
        result: { ok: true },
      });
      // Re-read through the same helper the UI uses.
      const { getAiActivityLog } = await import("@/ai/activityLog");
      const stored = getAiActivityLog("turn-race");
      expect(stored?.toolCalls[0]?.reason).toBe("자리 비움");
      expect(latest.id).toBe("ignored");
    });
  });
});
