import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isAiAssistantBridgeConnected,
  registerAiAssistantBridge,
  setAiBridgeLastStatus,
  unregisterAiAssistantBridge,
} from "@/editor/aiAssistantBridge";

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

    const result = await window.__oprnAiBridge!.send("숲을 다듬어줘");
    expect(result).toMatchObject({ ok: true, lastAssistantText: "ok" });
    expect(isAiAssistantBridgeConnected()).toBe(false);
  });
});
