// 바로 깔기 실행기 — 모델 계획 → 결정적 적용 → 실패만 한 번 수리 → 모델 없으면 낱말 규칙 폴백.
// 스토어·모델은 주입한다(runStampPlaceWith). 실제 도구는 돌리지 않는다.
import { describe, expect, it } from "vitest";
import type { AiConfig, ChatRequest, ChatResult } from "@/ai/llmClient";
import type { ToolResult } from "@/editor/tools/types";
import { runStampPlaceWith, type StampChatFn, type StampRunDeps } from "@/editor/stampPlaceRunner";
import { createBlankProject } from "@/project/defaults";

const CONFIG = { authMode: "apiKey", baseUrl: "x", model: "m", liteModel: "lite", apiKey: "k", maxTokens: 512, maxToolCalls: 4 } as AiConfig;

function reply(content: string): ChatResult {
  return { message: { role: "assistant", content }, finishReason: "stop" } as ChatResult;
}

type Call = { name: string; args: Record<string, unknown> };

function harness(options: {
  readonly replies?: readonly string[];
  readonly ready?: boolean;
  readonly chatError?: Error;
  readonly fail?: (call: Call) => string | null;
}) {
  const project = createBlankProject();
  const mapId = project.startMapId;
  const requests: ChatRequest[] = [];
  const applied: Call[][] = [];
  const queue = [...(options.replies ?? [])];
  const chat: StampChatFn = async (_config, req) => {
    requests.push(req);
    if (options.chatError) throw options.chatError;
    const next = queue.shift();
    if (next === undefined) throw new Error("no more replies");
    return reply(next);
  };
  const deps: StampRunDeps = {
    getProject: () => project,
    apply: (calls) => {
      applied.push(calls.map((call) => ({ name: call.name, args: call.args })));
      return calls.map((call): ToolResult => {
        const error = options.fail?.(call) ?? null;
        return error ? { ok: false, summary: "", issues: [{ message: error } as never] } : { ok: true, summary: `${call.name} 완료` };
      });
    },
    chat,
    getConfig: () => CONFIG,
    isModelReady: () => options.ready ?? true,
    timeoutMs: 1000,
  };
  return { project, mapId, requests, applied, deps };
}

describe("runStampPlaceWith", () => {
  it("applies several model steps in one batch", async () => {
    const h = harness({
      replies: [JSON.stringify({ steps: [
        { tool: "fill_region", args: { rect: { x: 0, y: 0, w: 5, h: 5 }, material: "흙", shape: "circle" }, label: "흙 원" },
        { tool: "fill_region", args: { rect: { x: 5, y: 0, w: 5, h: 5 }, material: "물", shape: "circle" }, label: "물 원" },
        { tool: "place_props", args: { area: { x: 10, y: 0, w: 3, h: 5 }, material: "침엽수", density: "impassable" }, label: "나무" },
      ] })],
    });
    const result = await runStampPlaceWith({ text: "땅을 동그랗게, 물을 동그랗게 옆에 나무", mapId: h.mapId, selection: null }, h.deps);
    expect(result).toMatchObject({ ok: true, applied: 3, usedModel: true });
    expect(result.lines).toHaveLength(3);
    expect(h.applied).toHaveLength(1);
    expect(h.applied[0]!.map((call) => call.name)).toEqual(["fill_region", "fill_region", "place_props"]);
    expect(h.applied[0]!.every((call) => call.args.mapId === h.mapId)).toBe(true);
    // 계획 호출 하나, 사실에 실제 재료 라벨.
    expect(h.requests).toHaveLength(1);
    const payload = JSON.parse(String(h.requests[0]!.messages[1]!.content)) as { fillMaterials: unknown[] };
    expect(Array.isArray(payload.fillMaterials)).toBe(true);
  });

  it("repairs a failing step once with the tool error", async () => {
    const h = harness({
      replies: [
        JSON.stringify({ steps: [
          { tool: "fill_region", args: { material: "땅으로" }, label: "땅" },
          { tool: "place_props", args: { material: "침엽수", density: "dense" }, label: "나무" },
        ] }),
        JSON.stringify({ steps: [{ tool: "fill_region", args: { material: "흙" }, label: "흙" }] }),
      ],
      fail: (call) => (call.args.material === "땅으로" ? "라벨/설명이 \"땅으로\" 인 타일을 찾지 못했습니다." : null),
    });
    const result = await runStampPlaceWith({ text: "땅으로 깔고 나무", mapId: h.mapId, selection: null }, h.deps);
    expect(result).toMatchObject({ ok: true, applied: 2, usedModel: true });
    expect(h.requests).toHaveLength(2);
    const repairAsk = String(h.requests[1]!.messages.at(-1)!.content);
    expect(repairAsk).toContain("땅으로");
    expect(h.applied).toHaveLength(2);
    expect(h.applied[1]!.map((call) => call.args.material)).toEqual(["흙"]);
    expect(result.lines.some((line) => line.includes("실패"))).toBe(true);
  });

  it("reports a step that still fails after repair and keeps the rest", async () => {
    const h = harness({
      replies: [
        JSON.stringify({ steps: [
          { tool: "fill_region", args: { material: "용암" }, label: "용암" },
          { tool: "place_props", args: { material: "침엽수", density: "dense" }, label: "나무" },
        ] }),
        JSON.stringify({ steps: [{ tool: "fill_region", args: { material: "마그마" }, label: "마그마" }] }),
      ],
      fail: (call) => (call.name === "fill_region" ? "재료 없음" : null),
    });
    const result = await runStampPlaceWith({ text: "용암 깔고 나무", mapId: h.mapId, selection: null }, h.deps);
    expect(result).toMatchObject({ ok: false, applied: 1, usedModel: true });
    expect(h.requests).toHaveLength(2); // 수리는 한 번뿐.
    expect(result.lines.some((line) => line.startsWith("고쳐도"))).toBe(true);
  });

  it("falls back to the regex planner when the model is not configured", async () => {
    const h = harness({ ready: false });
    const result = await runStampPlaceWith({ text: "숲", mapId: h.mapId, selection: null }, h.deps);
    expect(result.usedModel).toBe(false);
    expect(h.requests).toHaveLength(0);
    expect(result.lines[0]).toContain("낱말 규칙");
    expect(h.applied[0]![0]!.name).toBe("place_props");
  });

  it("falls back to the regex planner when the model call fails", async () => {
    const h = harness({ chatError: new Error("502") });
    const result = await runStampPlaceWith({ text: "길", mapId: h.mapId, selection: null }, h.deps);
    expect(result.usedModel).toBe(false);
    expect(result.lines[0]).toContain("502");
    expect(h.applied[0]![0]!.name).toBe("paint_road");
  });

  it("falls back when the model returns no usable steps", async () => {
    const h = harness({ replies: [JSON.stringify({ steps: [{ tool: "delete_map" }] })] });
    const result = await runStampPlaceWith({ text: "물", mapId: h.mapId, selection: null }, h.deps);
    expect(result.usedModel).toBe(false);
    expect(h.applied[0]![0]!.name).toBe("fill_region");
  });

  it("skips the model for empty text (숲)", async () => {
    const h = harness({ replies: [] });
    const result = await runStampPlaceWith({ text: "  ", mapId: h.mapId, selection: null }, h.deps);
    expect(h.requests).toHaveLength(0);
    expect(result).toMatchObject({ ok: true, usedModel: false, applied: 1 });
  });

  it("keeps model rects inside the selection", async () => {
    const h = harness({ replies: [JSON.stringify({ steps: [{ tool: "fill_region", args: { rect: { x: 0, y: 0, w: 99, h: 99 }, material: "물" } }] })] });
    await runStampPlaceWith({ text: "물", mapId: h.mapId, selection: { mapId: h.mapId, x: 2, y: 3, width: 4, height: 5 } }, h.deps);
    expect(h.applied[0]![0]!.args.rect).toEqual({ x: 2, y: 3, w: 4, h: 5 });
  });

  it("stops without applying when aborted during planning", async () => {
    const controller = new AbortController();
    const h = harness({});
    const deps: StampRunDeps = {
      ...h.deps,
      chat: async (_config, req) => {
        controller.abort();
        await Promise.resolve();
        if (req.signal?.aborted) throw new Error("aborted");
        return reply("{}");
      },
    };
    const result = await runStampPlaceWith({ text: "물", mapId: h.mapId, selection: null, signal: controller.signal }, deps);
    expect(result).toMatchObject({ ok: false, applied: 0 });
    expect(h.applied).toHaveLength(0);
  });
});
