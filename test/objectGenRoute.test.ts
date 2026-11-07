import { describe, expect, it } from "vitest";
// @ts-expect-error -- 순수 .mjs 모듈(호스트 스크립트용), 타입 선언 없음
import { chooseObjectGenRoute, OPUS_DRAW_MODEL, TERRA_DRAW_MODEL } from "../scripts/lib/objectGenRoute.mjs";

describe("chooseObjectGenRoute — Claude 우선, 없으면 ChatGPT 구독", () => {
  it("Claude Code 가 있으면 Opus 5.5 medium 이 그리고 3/4 영수증을 받는다", () => {
    const route = chooseObjectGenRoute({ hasClaude: true, codexLogin: true });
    expect(route).toMatchObject({ ok: true, route: "claude", model: OPUS_DRAW_MODEL, effort: "medium", gate: "receipt" });
  });

  it("Claude Code 가 없으면 Codex 로그인으로 Terra high 가 그리고 영수증은 unavailable 로 알린다", () => {
    const route = chooseObjectGenRoute({ hasClaude: false, codexLogin: true });
    expect(route).toMatchObject({ ok: true, route: "codex", model: TERRA_DRAW_MODEL, effort: "high", gate: "unavailable" });
    expect(route.note).toBeTruthy();
  });

  it("OpenAI 호환 주소가 있으면 그 경로를 쓰고, Claude 가 있으면 영수증은 계속 받는다", () => {
    expect(chooseObjectGenRoute({ hasClaude: false, codexLogin: true, chatUrl: "http://127.0.0.1:10200/v1" })).toMatchObject({ ok: true, route: "openai-compat", gate: "unavailable" });
    expect(chooseObjectGenRoute({ hasClaude: true, codexLogin: true, chatUrl: "http://127.0.0.1:10200/v1" })).toMatchObject({ ok: true, route: "openai-compat", gate: "receipt" });
  });

  it("둘 다 없으면(Codex 로그인 없음) 그리지 않는다", () => {
    expect(chooseObjectGenRoute({ hasClaude: true, codexLogin: false }).ok).toBe(false);
    expect(chooseObjectGenRoute({ hasClaude: false, codexLogin: false }).ok).toBe(false);
  });
});
