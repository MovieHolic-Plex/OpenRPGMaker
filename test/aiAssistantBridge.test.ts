import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isAiAssistantBridgeConnected,
  registerAiAssistantBridge,
  setAiBridgeLastStatus,
  unregisterAiAssistantBridge,
  sendAiAssistantMessage,
  type AiAssistantBridgeHandlers,
  type AiBridgeTurnResult,
  whenAiAssistantBridgeSettled,
} from "@/editor/aiAssistantBridge";
import { bounded, deferred } from "./aiEpochFixture";

describe("aiAssistantBridge", () => {
  afterEach(() => {
    unregisterAiAssistantBridge();
    vi.unstubAllGlobals();
  });

  it("registers window API and returns send/status/audit from handlers", async () => {
    const windowStub = {
      location: { search: "?aiBridge=0" },
      setTimeout: () => 0,
      clearTimeout: () => undefined,
    };
    vi.stubGlobal("window", windowStub);
    vi.stubGlobal("import", { meta: { env: { DEV: false } } });

    registerAiAssistantBridge({
      send: async (text) => ({
        ok: true,
        status: {
          ready: true,
          turnBusy: false,
          configReady: true,
          lastStatus: "완료",
          bridgeConnected: false,
          panelMounted: true,
        },
        audit: [{ kind: "user", text, at: "t0" }],
        harness: { messages: [] },
        lastAssistantText: "ok",
      }),
      getStatus: () => ({
        ready: true,
        turnBusy: false,
        configReady: true,
        lastStatus: "대기",
        bridgeConnected: false,
        panelMounted: true,
      }),
      getAudit: () => [{ kind: "status", text: "대기" }],
      getHarness: () => ({ messages: [1] }),
      abort: () => undefined,
    });

    setAiBridgeLastStatus("검토 대기");
    expect(window.__oprnAiBridge).toBeDefined();
    expect(window.__oprnAiBridge?.status().lastStatus).toBe("검토 대기");
    expect(window.__oprnAiBridge?.audit()).toEqual([{ kind: "status", text: "대기" }]);
    expect(window.__oprnAiBridge?.harness()).toEqual({ messages: [1] });

    const bridge = window.__oprnAiBridge;
    if (!bridge) throw new Error("Bridge missing");
    const result = await bridge.send("숲을 다듬어줘");
    expect(result).toMatchObject({ ok: true, lastAssistantText: "ok" });
    expect(isAiAssistantBridgeConnected()).toBe(false);
  });

  it("retires old registration sends and abort callbacks before a replacement accepts B", async () => {
    vi.stubGlobal("window", { location: { search: "?aiBridge=0" } });
    const response = deferred<AiBridgeTurnResult>();
    const status = { ready: true, turnBusy: false, configReady: true, lastStatus: "ready", bridgeConnected: false, panelMounted: true };
    const a: AiAssistantBridgeHandlers = { send: () => response.promise, getStatus: () => status,
      getAudit: () => [], getHarness: () => null, abort: vi.fn() };
    registerAiAssistantBridge(a);
    const oldApi = window.__oprnAiBridge;
    if (!oldApi) throw new Error("A bridge missing");
    const pendingA = oldApi.send("A");
    const b: AiAssistantBridgeHandlers = { ...a, send: vi.fn(async text => ({ ok: true, status,
      audit: [{ kind: "user", text }], harness: { owner: "B" } })), abort: vi.fn() };
    registerAiAssistantBridge(b);
    try {
      expect(await bounded(pendingA)).toMatchObject({ ok: false, audit: [], harness: null });
      expect(await sendAiAssistantMessage("B")).toMatchObject({ ok: true, audit: [{ kind: "user", text: "B" }] });
      oldApi.abort(); oldApi.abort();
      expect(b.abort).not.toHaveBeenCalled();
      expect(await oldApi.send("late A")).toMatchObject({ ok: false });
      response.resolve({ ok: true, status, audit: [{ kind: "assistant", text: "A_LATE" }], harness: { owner: "A" } });
      await response.promise;
      expect(b.send).toHaveBeenCalledTimes(1);
      expect(window.__oprnAiBridge?.harness()).toBeNull();
    } finally { response.resolve({ ok: false, status, audit: [], harness: null }); await bounded(pendingA); }
  });

  it.each(["resolve", "reject"])("cleanup prevents a late hello %s from reconnecting or scheduling another poll", async ending => {
    const hello = deferred<Response>();
    const entered = deferred<void>();
    const handled = deferred<void>();
    const schedule = vi.fn(() => 1);
    vi.stubGlobal("window", { location: { search: "?aiBridge=1" }, setTimeout: schedule, clearTimeout: vi.fn() });
    const fetch = vi.fn<typeof globalThis.fetch>(() => { entered.resolve(); return hello.promise.finally(() => handled.resolve()); });
    vi.stubGlobal("fetch", fetch);
    registerAiAssistantBridge({ send: async () => { throw new Error("No send expected"); },
      getStatus: () => ({ ready: true, turnBusy: false, configReady: true, lastStatus: "ready", bridgeConnected: false, panelMounted: true }),
      getAudit: () => [], getHarness: () => null, abort: vi.fn() });
    try {
      await bounded(entered.promise); unregisterAiAssistantBridge();
      if (ending === "resolve") hello.resolve(Response.json({}));
      else hello.reject(new Error("Late owned transport error"));
      await bounded(handled.promise);
      await bounded(whenAiAssistantBridgeSettled());
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(schedule).not.toHaveBeenCalled();
      expect(isAiAssistantBridgeConnected()).toBe(false);
    } finally { hello.resolve(Response.json({})); await bounded(whenAiAssistantBridgeSettled()); }
  });

  it("deduplicates actual HTTP command IDs without replaying a send", async () => {
    const tick = deferred<() => void>();
    const secondPost = deferred<void>();
    let posts = 0;
    const schedule = vi.fn((callback: () => void) => { tick.resolve(callback); return 1; });
    vi.stubGlobal("window", { location: { search: "?aiBridge=1" }, setTimeout: schedule, clearTimeout: vi.fn() });
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async input => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("/hello")) return Response.json({});
      if (path.endsWith("/next")) return Response.json({ command: { id: "same-command", type: "send", text: "A" } });
      if (path.endsWith("/result")) { if (++posts === 2) secondPost.resolve(); return Response.json({}); }
      throw new Error(`Unexpected bridge request ${path}`);
    }));
    const status = { ready: true, turnBusy: false, configReady: true, lastStatus: "ready", bridgeConnected: false, panelMounted: true };
    const send = vi.fn(async (text: string) => ({ ok: true, status, audit: [{ kind: "user", text }], harness: null }));
    registerAiAssistantBridge({ send, getStatus: () => status, getAudit: () => [], getHarness: () => null, abort: vi.fn() });
    try {
      const next = await bounded(tick.promise); next();
      await bounded(secondPost.promise);
      expect(send).toHaveBeenCalledTimes(1);
      expect(posts).toBe(2);
    } finally { unregisterAiAssistantBridge(); await bounded(whenAiAssistantBridgeSettled()); }
  });
});
