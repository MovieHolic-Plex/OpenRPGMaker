import { describe, expect, it } from "vitest";
import { jrpgCompletionGateApplies, jrpgCompletionGaps } from "@/qa/gameCheck/jrpgCompletion";
import { buildMapGraph, checkMapGraph } from "@/qa/gameCheck/mapGraph";
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
    const bad = jrpg({ startMapId: "m1", maps: { m1: { id: "m1", name: "잿빛 설원 · 저항군 전초기지", structurePlacements: lighthouse, events: [] } } });
    expect(jrpgCompletionGaps(bad, "").some((gap) => gap.includes("씨앗 어촌"))).toBe(true);
    const harbor = jrpg({ startMapId: "m1", maps: { m1: { id: "m1", name: "푸른 항구 마을", structurePlacements: lighthouse, events: [] } } });
    expect(jrpgCompletionGaps(harbor, "").some((gap) => gap.includes("씨앗 어촌"))).toBe(false);
  });

  it("ignores the old seed map once the start moved to a new town and nothing transfers into it (loop-3: protected houses cannot be erased)", () => {
    const lighthouse = [{ kitId: "bd-pick-fishing-port-lighthouse", x: 1, y: 1 }];
    const moved = jrpg({ startMapId: "m2", maps: {
      m1: { id: "m1", name: "잿빛 설원 · 저항군 전초기지", structurePlacements: lighthouse, events: [] },
      m2: { id: "m2", name: "눈 덮인 요새", events: [] },
    } });
    expect(jrpgCompletionGaps(moved, "").some((gap) => gap.includes("씨앗 어촌"))).toBe(false);
    const linked = jrpg({ startMapId: "m2", maps: {
      m1: { id: "m1", name: "잿빛 설원 · 저항군 전초기지", structurePlacements: lighthouse, events: [] },
      m2: { id: "m2", name: "눈 덮인 요새", events: [{ id: "e", x: 0, y: 0, pages: [{ commands: [{ kind: "transfer", mapId: "m1", x: 1, y: 1 }] }] }] },
    } });
    expect(jrpgCompletionGaps(linked, "").some((gap) => gap.includes("씨앗 어촌"))).toBe(true);
    const renamedRetiredSeed = jrpg({ startMapId: "m2", maps: {
      map_blank_start: { id: "map_blank_start", name: "(구) 포구 외곽 — 폐쇄 구역", structurePlacements: lighthouse, events: [] },
      m2: { id: "m2", name: "눈 덮인 요새", events: [{ id: "e", x: 0, y: 0, pages: [{ commands: [{ kind: "transfer", mapId: "map_blank_start", x: 1, y: 1 }] }] }] },
    } });
    expect(jrpgCompletionGaps(renamedRetiredSeed, "").some((gap) => gap.includes("씨앗 어촌"))).toBe(true);
  });

  it("does not emit unreachable-map blocker when startMapId moved off map_blank_start and map_blank_start still has seed events (r3-ff1)", () => {
    const project = {
      startMapId: "m2",
      startPos: { x: 0, y: 0 },
      maps: {
        map_blank_start: { id: "map_blank_start", name: "옛 씨앗 마을", width: 10, height: 10, tilesetId: "t", lowerTiles: new Array(100).fill(0), upperTiles: new Array(100).fill(-1), events: [{ id: "ev_seed", name: "촌장", x: 1, y: 1, pages: [] }] },
        m2: { id: "m2", name: "새 시작 마을", width: 10, height: 10, tilesetId: "t", lowerTiles: new Array(100).fill(0), upperTiles: new Array(100).fill(-1), events: [] },
      },
      tilesets: { t: { id: "t", name: "t", tileWidth: 16, tileHeight: 16, passability: {} } },
    } as unknown as Project;
    // 맵 그래프 검사는 이제 시작 칸 통행도 본다(collision.isPassable) — 옛 `data` 배열 대신 실제 맵 모양(lowerTiles·upperTiles)으로 둔다.
    const findings = checkMapGraph(project, buildMapGraph(project));
    expect(findings.some((finding) => finding.code === "unreachable-map" && finding.where?.mapId === "map_blank_start")).toBe(false);
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

describe("동료 약속 (jrpg-loop-2 ct2)", () => {
  it("requires two joining companions when the request promises companions (ct2 had none)", () => {
    const talk = (id: string, commands: unknown[]) => ({ id, name: id, x: 1, y: 2, pages: [{ id: `${id}_p`, trigger: { kind: "action" }, commands }] });
    const none = jrpg();
    expect(jrpgCompletionGaps(none, "", { task: "시대마다 동료를 만나는 RPG" }).some((gap) => gap.includes("합류하는 인물"))).toBe(true);
    const two = jrpg({ maps: { m1: { id: "m1", name: "마을", events: [talk("a", [{ kind: "changeParty", action: "add", actorId: "x1" }]), talk("b", [{ kind: "changeParty", action: "add", actorId: "x2" }])] } } });
    expect(jrpgCompletionGaps(two, "", { task: "시대마다 동료를 만나는 RPG" }).some((gap) => gap.includes("합류하는 인물"))).toBe(false);
    expect(jrpgCompletionGaps(none, "", { task: "그냥 JRPG" }).some((gap) => gap.includes("합류하는 인물"))).toBe(false);
  });

  it("flags when changeParty add companions are already pre-populated in the starting party (r3-ff1, r3-ct1)", () => {
    const talk = (id: string, commands: unknown[]) => ({ id, name: id, x: 1, y: 2, pages: [{ id: `${id}_p`, trigger: { kind: "action" }, commands }] });
    const prePopulated = jrpg({
      system: { genre: "adventure-jrpg", titleScreen: { title: "버들나루의 봉인" }, startActorIds: ["hero", "x1", "x2"], party: ["hero", "x1", "x2"] },
      maps: { m1: { id: "m1", name: "마을", events: [talk("a", [{ kind: "changeParty", action: "add", actorId: "x1" }]), talk("b", [{ kind: "changeParty", action: "add", actorId: "x2" }])] } },
    });
    const gaps = jrpgCompletionGaps(prePopulated, "", { task: "시대마다 동료를 만나는 RPG" });
    expect(gaps.some((gap) => gap.includes("set_party") && gap.includes("시작 파티"))).toBe(true);
  });

  it("strips [의도 메모] system guidance from options.task so coast/era instructions do not trigger harborExempt or TIME_BRIEF (jrpg-loop-4 ff1, ff2)", () => {
    const seededHarbor = jrpg({
      startMapId: "map_blank_start",
      system: { genre: "adventure-jrpg", titleScreen: { title: "잿불의 성흔" } },
      endings: [{ id: "ending_first_segment", name: "첫 구간 끝", conditions: [] }],
      maps: {
        map_blank_start: {
          id: "map_blank_start",
          name: "잿불 해안 거점 (구 버들항 유적)",
          structurePlacements: [{ kitId: "bd-pick-fishing-port-lighthouse", x: 40, y: 20 }],
          events: [
            { id: "e1", name: "장로", x: 1, y: 1, pages: [{ id: "p1", trigger: { kind: "action" }, commands: [{ kind: "text", body: "가자" }] }] },
            { id: "e2", name: "상인", x: 2, y: 1, pages: [{ id: "p2", trigger: { kind: "action" }, commands: [{ kind: "text", body: "물건" }, { kind: "triggerEnding", endingId: "ending_first_segment" }] }] },
          ],
        },
      },
    });
    const taskWithIntentMemo = "파이널판타지6 같은 게임 만들어 줘. 세계가 한 번 무너지고, 흩어진 동료들을 다시 모으는 이야기로\n\n[의도 메모 — 아래는 사용자 글이 아니라 시스템 지침]\ntheme 은 말에서 고른다: 항구·포구·어촌·바닷가 = coast. 시대·평행세계처럼 같은 지리를 여러 벌 쓰는 게임은 derive_map_variant 를 쓴다.";
    const gaps = jrpgCompletionGaps(seededHarbor, "", { task: taskWithIntentMemo });
    expect(gaps.some((gap) => gap.includes("씨앗 어촌(등대·항구)"))).toBe(true);
    expect(gaps.some((gap) => gap.includes("시간·시대 이야기를 요청했는데"))).toBe(false);
  });
});
