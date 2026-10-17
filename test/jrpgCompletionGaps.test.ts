import { describe, expect, it } from "vitest";
import { jrpgCompletionGateApplies, jrpgCompletionGaps } from "@/qa/gameCheck/jrpgCompletion";
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

  it("a project with no database does not throw out of the balance check (jrpg-real-1 J06 gate is best-effort)", () => {
    expect(() => jrpgCompletionGaps(jrpg(), "")).not.toThrow();
  });

  it("ignores non-JRPG projects", () => {
    expect(jrpgCompletionGaps({ system: { genre: "monster-collect" }, maps: {}, startMapId: "x" } as unknown as Project, "")).toEqual([]);
  });
});

describe("채팅 한 줄 JRPG 요청 (jrpg-loop-1)", () => {
  it("applies to a chat-line JRPG request, not to an unrelated small edit", () => {
    expect(jrpgCompletionGateApplies(jrpg(), "크로노 트리거처럼 시간여행 JRPG 만들어 줘")).toBe(true);
    expect(jrpgCompletionGateApplies({ system: {} } as unknown as Project, "파이널판타지6 같은 게임 만들어 줘")).toBe(true);
    expect(jrpgCompletionGateApplies(jrpg(), "여관 하나만 더 지어 줘")).toBe(false);
    expect(jrpgCompletionGateApplies(jrpg(), "이 게임을 처음부터 다시 만들어 줘")).toBe(true);
  });

  it("flags an opening that is only the title card", () => {
    const only = jrpg({ system: { genre: "adventure-jrpg", titleScreen: { title: "버들나루의 봉인" }, opening: { enabled: true, scenes: [{ id: "s", kind: "text", narration: "— 새 게임 —", durationMs: 4200 }] } } });
    expect(jrpgCompletionGaps(only, "").some((gap) => gap.includes("오프닝"))).toBe(true);
    const written = jrpg({ system: { genre: "adventure-jrpg", titleScreen: { title: "버들나루의 봉인" }, opening: { enabled: true, scenes: [{ id: "s", kind: "text", narration: "옛날 옛적에 별이 떨어졌다.", durationMs: 4200 }, { id: "t", kind: "text", narration: "— 버들나루의 봉인 —", durationMs: 4200 }] } } });
    expect(jrpgCompletionGaps(written, "").some((gap) => gap.includes("오프닝"))).toBe(false);
    const off = jrpg({ system: { genre: "adventure-jrpg", titleScreen: { title: "버들나루의 봉인" }, opening: { enabled: false, scenes: [{ id: "s", kind: "text", narration: "— 새 게임 —" }] } } });
    expect(jrpgCompletionGaps(off, "").some((gap) => gap.includes("오프닝"))).toBe(false);
  });

  it("flags the seed fishing village (lighthouse) left under a non-harbor name — 6 of 6 loop projects kept it", () => {
    const lighthouse = [{ kitId: "bd-pick-fishing-port-lighthouse", x: 1, y: 1 }];
    const bad = jrpg({ maps: { m1: { id: "m1", name: "잿빛 설원 · 저항군 전초기지", structurePlacements: lighthouse, events: [] } } });
    expect(jrpgCompletionGaps(bad, "").some((gap) => gap.includes("씨앗 어촌"))).toBe(true);
    const harbor = jrpg({ maps: { m1: { id: "m1", name: "푸른 항구 마을", structurePlacements: lighthouse, events: [] } } });
    expect(jrpgCompletionGaps(harbor, "").some((gap) => gap.includes("씨앗 어촌"))).toBe(false);
  });

  it("uses the request text as part of the brief for the time-ending check", () => {
    const project = jrpg({ endings: [{ id: "ending_first_segment", name: "첫 구간 끝" }] });
    expect(jrpgCompletionGaps(project, "", { task: "과거와 미래를 오가는 RPG 만들어 줘" }).some((gap) => gap.includes("첫 구간 끝"))).toBe(true);
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

describe("요청한 규모 — 탈것·붕괴 전후 (jrpg-loop-1 D13)", () => {
  const ask = "마법으로 평화롭던 세계가 무너져서 폐허가 된 뒤에 동료 모아서 반격하는 JRPG. 비공정 같은 탈것도 있으면 좋겠어요";
  it("비공정을 말했는데 탈것이 없고 붕괴 후 맵도 없으면 둘 다 막는다", () => {
    const gaps = jrpgCompletionGaps(jrpg(), "", { task: ask });
    expect(gaps.some((gap) => gap.includes("place_vehicle"))).toBe(true);
    expect(gaps.some((gap) => gap.includes("derive_map_variant"))).toBe(true);
  });
  it("비행선을 세우고 붕괴 후 맵을 만들면 통과한다", () => {
    const project = jrpg({
      system: { genre: "adventure-jrpg", titleScreen: { title: "버들나루의 봉인" }, vehicles: [{ id: "airship", characterIndex: 2, mapId: "m1", x: 1, y: 1 }] },
      maps: { m1: { id: "m1", name: "마을", events: [] }, m2: { id: "m2", name: "마을 (붕괴 후)", defaultLighting: { ambient: 0.5, color: "#223" }, events: [] } },
    });
    const gaps = jrpgCompletionGaps(project, "", { task: ask });
    expect(gaps.some((gap) => gap.includes("place_vehicle"))).toBe(false);
    expect(gaps.some((gap) => gap.includes("derive_map_variant"))).toBe(false);
  });
  it("이름만 「폐허」인 맵은 붕괴 후로 세지 않는다(jrpg-loop-2 ff2)", () => {
    const project = jrpg({
      system: { genre: "adventure-jrpg", titleScreen: { title: "버들나루의 봉인" }, vehicles: [{ id: "airship", characterIndex: 2, mapId: "m1", x: 1, y: 1 }] },
      maps: { m1: { id: "m1", name: "마을", events: [] }, m2: { id: "m2", name: "에덴의 폐허 거점", events: [] } },
    });
    expect(jrpgCompletionGaps(project, "", { task: ask }).some((gap) => gap.includes("derive_map_variant"))).toBe(true);
  });
});

