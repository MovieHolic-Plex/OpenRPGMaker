import { describe, expect, it } from "vitest";
import { buildClaudeArgs } from "../scripts/lib/localCliAgent/claude";
import { decideSessionResume, engineSessionReuseOn, sameEngineSession, type EngineSessionFingerprint } from "../src/ai/piAgent/sessionResume";

const print = { systemPrompt: "you are the assistant", toolNames: ["upsert_event", "find_events"], model: "claude-opus-5-5" };

describe("엔진 세션 재사용 판정", () => {
  it("지시문·도구·모델이 모두 같을 때만 앞 대화를 잇는다", () => {
    const decision = decideSessionResume({ requestedSessionId: "abc", previous: print, current: print, engineCanResume: true, reuseEnabled: true });
    expect(decision).toEqual({ kind: "resume", sessionId: "abc" });
  });

  it("지시문이 다르면 잇지 않는다 — 재개된 대화는 처음 시스템 프롬프트를 그대로 쓴다", () => {
    // 2026-11-06 실측: PROMPT-ONE 으로 시작한 대화에 PROMPT-TWO 를 주고 --resume 해도 PROMPT-ONE 이 답했다.
    const decision = decideSessionResume({
      requestedSessionId: "abc", previous: print,
      current: { ...print, systemPrompt: "read-only plan turn" }, engineCanResume: true, reuseEnabled: true,
    });
    expect(decision.kind).toBe("fresh");
    expect(decision.kind === "fresh" && decision.reason).toContain("시스템 지시");
  });

  it("도구 목록이 달라도 잇지 않고, 무엇이 더해지고 빠졌는지 말한다", () => {
    const decision = decideSessionResume({
      requestedSessionId: "abc", previous: print,
      current: { ...print, toolNames: ["upsert_event", "lint_dialogue", "rewrite_dialogue"] }, engineCanResume: true, reuseEnabled: true,
    });
    expect(decision.kind).toBe("fresh");
    const reason = decision.kind === "fresh" ? decision.reason : "";
    expect(reason).toContain("도구 목록");
    expect(reason).toContain("find_events");
    expect(reason).toContain("lint_dialogue");
  });

  it("도구 순서만 바뀐 것은 같은 대화다", () => {
    expect(sameEngineSession(print, { ...print, toolNames: [...print.toolNames].reverse() }).same).toBe(true);
  });

  it("앞 실행 기록이 없거나 재사용이 꺼져 있으면 새로 열고 그 이유를 남긴다", () => {
    expect(decideSessionResume({ requestedSessionId: undefined, previous: undefined, current: print, engineCanResume: true, reuseEnabled: true }).kind).toBe("fresh");
    const off = decideSessionResume({ requestedSessionId: "abc", previous: print, current: print, engineCanResume: true, reuseEnabled: false });
    expect(off.kind === "fresh" && off.reason).toContain("OPRN_ENGINE_SESSION=0");
  });

  it("기본은 켜짐이고 OPRN_ENGINE_SESSION=0 만 끈다", () => {
    expect(engineSessionReuseOn({})).toBe(true);
    expect(engineSessionReuseOn(undefined)).toBe(true);
    expect(engineSessionReuseOn({ OPRN_ENGINE_SESSION: "0" })).toBe(false);
    expect(engineSessionReuseOn({ OPRN_ENGINE_SESSION: "1" })).toBe(true);
  });
});

describe("claude 재개 인자", () => {
  it("재개 id 가 있으면 --resume 로 그 대화를 잇는다", () => {
    const args = buildClaudeArgs("/tmp/mcp.json", "/tmp/sys.md", { resumeSessionId: "fee1-2222" });
    expect(args.slice(args.indexOf("--resume"), args.indexOf("--resume") + 2)).toEqual(["--resume", "fee1-2222"]);
  });

  it("대화를 잇지 않는 실행은 홈에 아무것도 남기지 않는다", () => {
    expect(buildClaudeArgs("/tmp/mcp.json", "/tmp/sys.md", {})).toContain("--no-session-persistence");
  });

  it("재개를 쓰는 실행은 세션을 남겨야 한다 — 남기지 않으면 --resume 이 그 대화를 못 찾는다", () => {
    const resumed = buildClaudeArgs("/tmp/mcp.json", "/tmp/sys.md", { resumeSessionId: "fee1-2222" });
    expect(resumed).not.toContain("--no-session-persistence");
  });
});
