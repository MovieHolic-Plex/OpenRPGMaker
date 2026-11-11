import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { normalizeGameBlueprint, type GameBlueprint } from "@/project/gameBlueprint";
import { createBuildRun } from "@/ai/v2/shared/buildRun";
import { buildPuzzleChain, type ChainLink } from "@/ai/v2/story/puzzle";
import { carryBuilt, settleCarriedSteps } from "@/ai/v2/story/blueprintCarry";
import type { ToolContext } from "@/editor/tools/types";
import type { GameEvent } from "@/project/types";

// 2026-11-12 Terra 측정 r1(저장된 판 13개 중 6개): 모델이 청사진을 다시 쓰면(단계 수·장소는 그대로, 사람 이름만 바뀜) 경로 빌더가 새 사람을 세우고
// 앞 경로의 사람은 남았다 — 이야기 줄이 두 벌이 되고, 문·길은 앞 사람의 스위치를 기다렸다.
// 이제 단계가 지어 둔 것(built)을 새 청사진의 같은 단계가 물려받는다. 재는 법(모델 없음): 탐침 carry.mts 와 같은 호출 · 명세 은행의 r1-fun 재생.
// 문서 openwiki/assistant-v2.md 「청사진을 다시 쓰면 지어 둔 것을 물려받는다」.

const CHAIN = "달샘과 잠든 태양";
const blueprint = (place: string, names: readonly string[], gives: readonly string[]): GameBlueprint => normalizeGameBlueprint({
  title: CHAIN, genre: "모험", playerGoal: "샘을 되살리자.", ending: { name: CHAIN, how: "물이 돌아왔다.", feeling: "안도" },
  steps: names.map((name, i) => ({ id: `s${i + 1}`, kind: "talk", who: name, place, event: name, action: `${name}에게 말을 건다`, ...(i ? { needs: gives[i - 1] } : {}), gives: gives[i], feeling: "설렘" })),
});

/** 네 단계 경로를 지어 둔 프로젝트: 나디아(깃발) → 자히르(깃발, 잠김 글이 나디아를 부른다) → 라일라(물건) → 수호자(엔딩). */
function built() {
  const project = createBlankProject();
  const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
  const build = (links: ChainLink[]) => buildPuzzleChain(createBuildRun(ctx), { mapId: ctx.project.startMapId, name: CHAIN, links });
  const first = build([
    { role: "pickup", name: "나디아", person: "마을 사람", at: { x: 3, y: 3 }, lines: ["샘지기를 찾아가 보렴."], reward: { flag: "샘의 부탁" } },
    { role: "pickup", name: "자히르", person: "상인", at: { x: 6, y: 3 }, lines: ["찻집으로 가 봐."], needs: "샘의 부탁", lockedLines: ["먼저 「나디아」에게 말을 걸어 보자.", "「나디아」를 찾자."], reward: { flag: "상인의 단서" } },
    { role: "pickup", name: "라일라", person: "찻집 주인", at: { x: 9, y: 3 }, lines: ["약속할게요."], needs: "상인의 단서", reward: { item: "라일라의 약속" } },
    { role: "ending", name: "수호자", at: { x: 12, y: 3 }, lines: ["끝."], needs: "라일라의 약속" },
  ]);
  expect(first.ok).toBe(true);
  const place = ctx.project.maps[ctx.project.startMapId]!.name || ctx.project.startMapId;
  const prior = blueprint(place, ["나디아", "자히르", "라일라", "수호자"], ["샘의 부탁", "상인의 단서", "라일라의 약속", "엔딩"]);
  prior.steps.forEach((step, i) => { step.built = { mapId: first.eventIds![i]!.mapId, eventId: first.eventIds![i]!.eventId, ...(first.gives?.[i] ?? {}) }; });
  const events = (): GameEvent[] => ctx.project.maps[ctx.project.startMapId]!.events;
  return { ctx, build, prior, place, events };
}
const setSwitches = (ev: GameEvent | undefined): string[] => [...new Set([...JSON.stringify(ev?.pages ?? []).matchAll(/"kind":"setSwitch","switchId":"([^"]+)"/gu)].map((hit) => hit[1]!))];

describe("사슬 빌더는 고리마다 넘기는 것을 알려 준다", () => {
  it("깃발을 주는 고리는 스위치, 물건을 주는 고리는 물건 id, 엔딩 고리는 없음", () => {
    const { prior } = built();
    expect(prior.steps.map((s) => Object.keys(s.built ?? {}).sort().join(","))).toEqual(["eventId,mapId,switchId", "eventId,mapId,switchId", "eventId,itemId,mapId", "eventId,mapId"]);
  });
});

describe("carryBuilt — 새 청사진의 단계가 앞 단계의 지어 둔 것을 물려받는다", () => {
  it("이름만 바꾼 단계는 같은 자리(id)의 것을, 순서가 당겨진 단계는 같은 이름의 것을 받고, 받을 단계가 없는 것은 retired 로 간다", () => {
    const { prior, place } = built();
    const next = carryBuilt(prior, blueprint(place, ["샘지기 아말", "라일라", "수호자"], ["샘의 위기", "라일라의 약속", "엔딩"]));
    expect(next.steps.map((s) => s.built?.eventId)).toEqual([prior.steps[0]!.built!.eventId, prior.steps[2]!.built!.eventId, prior.steps[3]!.built!.eventId]);
    expect(next.steps[0]!.built!.switchId).toBe(prior.steps[0]!.built!.switchId);
    expect(next.retired).toEqual([prior.steps[1]!.built]);
  });

  it("모델이 보낸 built · retired 는 버린다 — 앞 청사진이 없으면 아무것도 물려받지 않는다", () => {
    const { place } = built();
    const forged = blueprint(place, ["가", "나"], ["하나", "엔딩"]);
    forged.steps[0]!.built = { mapId: "map_x", eventId: "ev_x", switchId: "sw_x" };
    forged.retired = [{ mapId: "map_x", eventId: "ev_y" }];
    const next = carryBuilt(undefined, forged);
    expect(next.steps.some((s) => s.built)).toBe(false);
    expect(next.retired).toBeUndefined();
  });

  it("같은 내용을 다시 쓰면 built 까지 같다(「이미 같은 내용」 판정이 그대로 선다)", () => {
    const { prior, place } = built();
    const again = carryBuilt(prior, blueprint(place, ["나디아", "자히르", "라일라", "수호자"], ["샘의 부탁", "상인의 단서", "라일라의 약속", "엔딩"]));
    expect(JSON.stringify(again.steps)).toBe(JSON.stringify(prior.steps));
    expect(again.retired).toBeUndefined();
  });
});

describe("settleCarriedSteps — 경로를 짓기 직전에 물려받은 것을 새 청사진에 맞춘다", () => {
  it("이름을 바꾼 단계: 같은 이벤트가 새 이름이 되고(사람이 늘지 않는다) 그 이름을 부르던 글도 새 이름으로, 빠진 단계의 이벤트는 걷고 그 스위치를 기다리던 조건을 푼다", () => {
    const { ctx, prior, place, events } = built();
    // 자히르(빠질 단계)의 스위치로 잠긴 문 하나.
    const gone = prior.steps[1]!.built!;
    const door = { id: "ev_door", name: "찻집 문", x: 1, y: 1, pages: [{ conditions: [], commands: [{ kind: "text", body: "닫혀 있다." }] }, { conditions: [{ kind: "switch", switchId: gone.switchId, value: true }], commands: [{ kind: "text", body: "열렸다." }] }] } as unknown as GameEvent;
    ctx.project.maps[ctx.project.startMapId]!.events.push(door);
    ctx.project.gameBlueprint = carryBuilt(prior, blueprint(place, ["샘지기 아말", "라일라", "수호자"], ["샘의 위기", "라일라의 약속", "엔딩"]));
    const settled = settleCarriedSteps(ctx.project);
    expect([...settled.renamed]).toEqual([prior.steps[0]!.built!.eventId]);
    expect(events().map((e) => (e as { name?: string }).name)).toEqual(["샘지기 아말", "라일라", "수호자", "찻집 문"]);
    expect((events().find((e) => e.id === "ev_door")!.pages ?? []).map((p) => (p.conditions ?? []).length)).toEqual([0, 0]);
    expect(ctx.project.gameBlueprint!.retired).toBeUndefined();
    // 다시 불러도 같다.
    expect([...settleCarriedSteps(ctx.project).renamed]).toEqual([]);
    expect(events()).toHaveLength(4);
  });

  it("「옛 이름」을 부르던 잠김 글은 새 이름으로 — 조사는 새 이름의 받침에 맞춘다", () => {
    const { ctx, prior, place, events } = built();
    ctx.project.gameBlueprint = carryBuilt(prior, blueprint(place, ["샘지기 아말", "자히르", "라일라", "수호자"], ["샘의 위기", "상인의 단서", "라일라의 약속", "엔딩"]));
    settleCarriedSteps(ctx.project);
    const text = JSON.stringify(events().find((e) => (e as { name?: string }).name === "자히르")!.pages);
    expect(text).toContain("먼저 「샘지기 아말」에게 말을 걸어 보자.");
    expect(text).toContain("「샘지기 아말」을 찾자.");
    expect(text).not.toContain("나디아");
  });

  it("다시 지으면 같은 이벤트가 전에 켜던 스위치를 그대로 켠다 — 깃발 이름이 바뀌어도", () => {
    const { ctx, build, prior, place, events } = built();
    ctx.project.gameBlueprint = carryBuilt(prior, blueprint(place, ["샘지기 아말", "자히르", "라일라", "수호자"], ["샘의 위기", "상인의 단서", "라일라의 약속", "엔딩"]));
    settleCarriedSteps(ctx.project);
    const s1 = ctx.project.gameBlueprint.steps[0]!;
    const again = build([{ role: "pickup", eventId: s1.built!.eventId, person: "샘지기", relook: true, lines: ["샘이 말라 가요."], reward: { flag: "샘의 위기", switchId: s1.built!.switchId } }]);
    expect(again.ok).toBe(true);
    expect(again.gives).toEqual([{ switchId: prior.steps[0]!.built!.switchId }]);
    expect(setSwitches(events().find((e) => e.id === s1.built!.eventId))).toContain(prior.steps[0]!.built!.switchId);
    expect(events()).toHaveLength(4);
  });

  it("모델·사람이 지은 이벤트(ev_chain_ 이 아닌 것)는 이름을 바꾸지도 걷지도 않는다", () => {
    const { ctx, prior, place, events } = built();
    const map = ctx.project.maps[ctx.project.startMapId]!;
    map.events = map.events.map((e) => (e.id === prior.steps[0]!.built!.eventId ? { ...e, id: "ev_hand_nadia" } : e));
    prior.steps[0]!.built = { ...prior.steps[0]!.built!, eventId: "ev_hand_nadia" };
    ctx.project.gameBlueprint = carryBuilt(prior, blueprint(place, ["샘지기 아말", "라일라", "수호자"], ["샘의 위기", "라일라의 약속", "엔딩"]));
    const settled = settleCarriedSteps(ctx.project);
    expect([...settled.renamed]).toEqual([]);
    expect(events().find((e) => e.id === "ev_hand_nadia")).toBeTruthy();
    expect((events().find((e) => e.id === "ev_hand_nadia") as { name?: string }).name).toBe("나디아");
  });
});
