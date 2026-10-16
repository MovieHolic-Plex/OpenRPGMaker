import { describe, expect, it } from "vitest";
import { jrpgCompletionGaps } from "@/qa/gameCheck/jrpgCompletion";
import { isRateLimitMessage, rateLimitedUnresolved } from "../scripts/lib/piTeamRuntime";
import type { Project } from "@/project/types";

// jrpg-real-1 J04/J05: 기본 제목·빈 시작 마을·부르지 않는 시간 엔딩은 뼈대 엔딩 도달만으로 통과하던 구멍이다.
function jrpg(overrides: Record<string, unknown> = {}): Project {
  const talk = (id: string, x: number) => ({ id, name: id, x, y: 2, pages: [{ id: `${id}_p`, trigger: { kind: "action" }, commands: [{ kind: "text", body: "안녕" }] }] });
  return {
    meta: { title: "버들나루의 봉인" },
    system: { genre: "adventure-jrpg", titleScreen: { title: "버들나루의 봉인" } },
    startMapId: "m1",
    maps: { m1: { id: "m1", name: "마을", events: [talk("a", 1), talk("b", 3)] } },
    endings: [{ id: "ending_first_segment", name: "첫 구간 끝" }, { id: "ending_time", name: "시간의 끝" }],
    commonEvents: [],
    ...overrides,
  } as unknown as Project;
}

describe("jrpgCompletionGaps", () => {
  it("reports default title, empty start town and uninvoked endings", () => {
    const project = jrpg({ meta: { title: "새 게임" }, system: { genre: "adventure-jrpg", titleScreen: { title: "새 게임" } }, maps: { m1: { id: "m1", name: "마을", events: [] } } });
    const gaps = jrpgCompletionGaps(project, "");
    expect(gaps.some((gap) => gap.includes("기본값"))).toBe(true);
    expect(gaps.some((gap) => gap.includes("말을 거는 인물"))).toBe(true);
    expect(gaps.some((gap) => gap.includes("정의만 있고"))).toBe(true);
  });

  it("needs a non-skeleton ending for a time story", () => {
    const project = jrpg({ endings: [{ id: "ending_first_segment", name: "첫 구간 끝" }] });
    expect(jrpgCompletionGaps(project, "시간을 넘나드는 이야기").some((gap) => gap.includes("첫 구간 끝"))).toBe(true);
  });

  it("ignores non-JRPG projects", () => {
    expect(jrpgCompletionGaps({ system: { genre: "monster-collect" }, maps: {}, startMapId: "x" } as unknown as Project, "")).toEqual([]);
  });
});

describe("429 handling in the team runtime", () => {
  it("recognises rate-limit messages", () => {
    expect(isRateLimitMessage("HTTP 429 Too Many Requests")).toBe(true);
    expect(isRateLimitMessage("map not found")).toBe(false);
  });

  it("keeps a cut-off assignment unresolved until the same map succeeds later", () => {
    const cut = { agentId: "builder-1", mapId: "m1", ok: false, summary: "429 rate limit" };
    expect(rateLimitedUnresolved(new Map([["builder-1", cut]]))).toHaveLength(1);
    const retried = new Map([["builder-1", cut], ["builder-2", { agentId: "builder-2", mapId: "m1", ok: true, summary: "done" }]]);
    expect(rateLimitedUnresolved(retried)).toHaveLength(0);
  });
});
