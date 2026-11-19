// 연결된 로컬 CLI 가 여럿일 때의 자동 추천 — ChatGPT(Codex CLI)가 먼저다(오너 결정 2026-11-19: 기본 AI 는 ChatGPT).
// 화면 순서(LOCAL_CLI_IDS: claude → codex → gemini)와 추천 순서는 따로다. 추천만 바뀌고 저장된 선택은 건드리지 않는다.
import { describe, expect, it } from "vitest";
import { LOCAL_CLI_DEFAULT_ORDER, pickDefaultLocalCli } from "../scripts/lib/localCliAgent/registry";
import type { LocalCliId, LocalCliStatus } from "../scripts/lib/localCliAgent/types";

const row = (id: LocalCliId, state: LocalCliStatus["state"], routine: string, deep: string): LocalCliStatus => ({
  id, label: id, state, stateLabel: state, found: state !== "not-installed", billing: "subscription", models: [],
  defaults: { routine, deep }, install: { command: "", help: "", url: "" }, login: { command: "", help: "" },
});

describe("pickDefaultLocalCli", () => {
  it("prefers Codex (ChatGPT) over Claude and Gemini when several are ready, whatever the row order", () => {
    expect(LOCAL_CLI_DEFAULT_ORDER).toEqual(["codex", "claude", "gemini"]);
    const rows = [row("claude", "ready", "claude-opus-5-5", "claude-opus-5-5"), row("codex", "ready", "gpt-6-luna", "gpt-6.1-sol"), row("gemini", "ready", "auto", "auto")];
    expect(pickDefaultLocalCli(rows)).toEqual({ provider: "local-cli:codex", routineModel: "gpt-6-luna", deepModel: "gpt-6.1-sol" });
    expect(pickDefaultLocalCli([...rows].reverse())?.provider).toBe("local-cli:codex");
  });

  it("falls back to Claude, then Gemini, when Codex is not ready, and to nothing when none is", () => {
    expect(pickDefaultLocalCli([row("claude", "ready", "claude-opus-5-5", "claude-opus-5-5"), row("codex", "login-required", "", ""), row("gemini", "ready", "auto", "auto")])?.provider).toBe("local-cli:claude");
    expect(pickDefaultLocalCli([row("claude", "not-installed", "", ""), row("codex", "error", "", ""), row("gemini", "ready", "auto", "auto")])?.provider).toBe("local-cli:gemini");
    expect(pickDefaultLocalCli([row("codex", "login-required", "", "")])).toBeUndefined();
  });
});
