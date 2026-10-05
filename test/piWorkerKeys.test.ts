// 긴 Pi 실행 도중 호스트가 갱신한 키가 진행 중인 실행에 들어가는지(2026-10-05 팀 실행 18분 40초째 토큰 만료).
import { describe, expect, it } from "vitest";
import { holdWorkerKeys, liveWorkerKeyRings, refreshWorkerKeys } from "../scripts/lib/piWorkerKeys";

describe("워커 요청 키 갱신", () => {
  it("진행 중인 실행의 키 묶음만 갱신하고, 쓰지 않던 제공자는 끼워 넣지 않는다", () => {
    const run = holdWorkerKeys({ "google-antigravity": "old", "openai-codex": undefined }, "google-antigravity", "old");
    expect(refreshWorkerKeys({ "google-antigravity": "new", "anthropic": "x" })).toBe(1);
    expect(run.keys["google-antigravity"]).toBe("new");
    expect("anthropic" in run.keys).toBe(false);
    run.release();
    expect(refreshWorkerKeys({ "google-antigravity": "newer" })).toBe(0);
    expect(run.keys["google-antigravity"]).toBe("new");
  });

  it("providerApiKeys 가 없으면 실행 제공자의 apiKey 로 묶음을 만든다", () => {
    const before = liveWorkerKeyRings();
    const run = holdWorkerKeys(undefined, "google-antigravity", "k1");
    expect(run.keys).toEqual({ "google-antigravity": "k1" });
    expect(liveWorkerKeyRings()).toBe(before + 1);
    refreshWorkerKeys({ "google-antigravity": "k2" });
    expect(run.keys["google-antigravity"]).toBe("k2");
    run.release();
  });
});
