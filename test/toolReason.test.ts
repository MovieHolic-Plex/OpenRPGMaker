import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TOOL_REASON_KEY,
  harnessToolReason,
  injectToolReasonSchema,
  isUsableToolReason,
  missingToolReasonResult,
  preferRicherActivityRecord,
  reasonForUiAction,
  splitToolCallReason,
  toolCallsFromAudit,
} from "@/ai/toolReason";
import { buildAiActivityLogRecord, clearAiActivityLogs, recordAiActivity } from "@/ai/activityLog";
import { toOpenAiTools } from "@/editor/tools";

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
