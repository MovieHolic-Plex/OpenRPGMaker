import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { normalizeGameBlueprint } from "@/project/gameBlueprint";
import { createBuildRun } from "@/ai/v2/shared/buildRun";
import { buildBlueprintPath } from "@/ai/v2/story/blueprintPath";
import { findingEn } from "@/ai/v2/judge/findingEn";
import { playProblems } from "@/ai/v2/judge/playCheck";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { settleStepPages, stepPagesOf } from "@/project/blueprintStepPages";
import { eventSight, thingWord } from "@/project/eventSight";
import { resolveEventPage } from "@/project/io";
import type { GameEvent, Project } from "@/project/types";
import { runAutoPlay } from "@/qa/gameCheck/autoPlay";
import { HONEST_CAUSES, codeShown, honestCauseOf } from "@/qa/gameCheck/honestPlay";

// 2026-11-12 r1w-fun 「불씨를 되찾아서」(Haiku 가 지은 게임): 눈가림 판정자는 청사진 7단계 중 2단계에서 막혔고(엔딩 없음), 자동 플레이는 «엔딩 도달» 이었다.
//  (a) «주술사에게 숫자를 전해 듣는다» talk 단계에 code 가 있다고 주술사가 번호 자물쇠가 됐고, 번호는 그림 없는 «번호 쪽지» 에 적혔다.
//  (b) create_quest 가 단계의 사람에게 얹은 의뢰 페이지가 단계의 연 페이지를 가렸다 — 주술사는 의뢰 대사만 되풀이했다.
//  (c) 자동 플레이는 계획표의 좌표로 그림 없는 쪽지를 찾아가 «완료» 를 냈다.
// 재는 법(모델 없음): /tmp 탐침 minimal.mts(이 파일과 같은 호출) · rebuild.mts(r1w-fun 의 사슬·의뢰를 다시 짓는다). 문서 openwiki/assistant-v2.md 「길을 따라갈 수 없는 경로」.

const TELLS = "3862";
function built(shamanLines: readonly string[] = [`조상의 숫자는 ${TELLS}다.`], chestCode: string | undefined = TELLS) {
  const project = createBlankProject();
  const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
  const place = project.maps[project.startMapId]!.name || project.startMapId;
  ctx.project.gameBlueprint = normalizeGameBlueprint({
    title: "불씨", genre: "모험", playerGoal: "불씨를 되찾자.", ending: { name: "불씨의 귀환", how: "상자를 연다.", feeling: "안도", closing: ["불이 돌아왔다."] },
    steps: [
      { id: "s1", kind: "talk", who: "촌장", place, event: "촌장", action: "촌장에게 임무를 받는다", gives: "임무", feeling: "엄숙", text: { lines: ["주술사에게 가거라."] } },
      { id: "s2", kind: "talk", who: "주술사", place, event: "주술사", action: "주술사에게 숫자를 듣는다", needs: "임무", gives: "숫자를 들었다", feeling: "신비", text: { lines: [...shamanLines], code: TELLS } },
      { id: "s3", kind: "find", place, event: "거대 두개골", action: "두개골에서 뼈 열쇠를 찾는다", needs: "숫자를 들었다", gives: "item:뼈 열쇠", feeling: "압도", text: { lines: ["눈구멍 안쪽에 뼈 열쇠가 있다."] } },
      { id: "s4", kind: "puzzle", place, event: "봉인 상자", action: "봉인 상자를 연다", needs: "item:뼈 열쇠", gives: "상자가 열렸다", feeling: "떨림", text: { lines: ["숫자 네 자리를 맞춰야 한다."], ...(chestCode ? { code: chestCode } : {}) } },
      { id: "s5", kind: "talk", who: "정령", place, event: "정령", action: "정령에게 불씨를 받는다", needs: "상자가 열렸다", gives: "ending", feeling: "안도", text: { lines: ["불씨를 가져가라."] } },
    ],
  });
  const result = buildBlueprintPath(createBuildRun(ctx));
  expect(result.ok).toBe(true);
  const map = () => ctx.project.maps[ctx.project.startMapId]!;
  const named = (name: string): GameEvent => map().events.find((ev) => ev.name === name)!;
  const steps = () => ctx.project.gameBlueprint!.steps;
  return { ctx, map, named, steps };
}
const json = (value: unknown): string => JSON.stringify(value);
const texts = (ev: GameEvent): string[] => [...json(ev.pages).matchAll(/"body":"((?:[^"\\]|\\.)*)"/gu)].map((hit) => hit[1]!);
const play = (project: Project, honest: boolean) => runAutoPlay(project, { budgetMs: 30_000, honest }).runs[0]!;

/** 단계가 열려 있을 때(앞 단계들이 넘긴 것을 가졌고 이 단계는 아직) 그 이벤트의 어느 페이지가 도는가 — [연 페이지 자리, 도는 페이지 자리]. */
function openPages(project: Project): [string, number, number][] {
  const switches: Record<string, boolean> = {}, inventory: Record<string, number> = {};
  const out: [string, number, number][] = [];
  for (const step of project.gameBlueprint!.steps) {
    const b = step.built!;
    const ev = project.maps[b.mapId]!.events.find((entry) => entry.id === b.eventId)!;
    const live = stepPagesOf(project, b.mapId, ev)!.liveIndex;
    const active = resolveEventPage(ev, { switches: { ...switches }, variables: {}, inventory: { ...inventory }, partyActorIds: [], gold: 0 });
    out.push([step.id, live, ev.pages!.indexOf(active!)]);
    for (const hit of json(ev.pages![live]!.commands).matchAll(/"kind":"setSwitch","switchId":"([^"]+)","value":true/gu)) switches[hit[1]!] = true;
    if (b.itemId) inventory[b.itemId] = 1;
  }
  return out;
}

describe("(a) 번호를 알려 주는 사람은 번호를 말한다 — 자물쇠는 여는 물건에 달린다", () => {
  it("talk 단계의 code 는 그 사람의 대사가 되고, 번호 쪽지도 사람 자물쇠도 생기지 않는다", () => {
    const { map, named } = built();
    expect(map().events.some((ev) => ev.name === "번호 쪽지")).toBe(false);
    expect(json(named("주술사").pages)).not.toContain('"inputNumber"');
    expect(texts(named("주술사")).some((line) => line.includes(TELLS))).toBe(true);
    expect(json(named("봉인 상자").pages)).toContain('"inputNumber"');
  });

  it("대사에 번호가 없으면 한 줄을 덧붙인다 — 읽은 글에 번호가 있어야 뒤의 자물쇠를 연다", () => {
    const { named } = built(["조상의 숫자를 알려 주마."]);
    expect(texts(named("주술사")).some((line) => line.includes(`「${TELLS}」`))).toBe(true);
  });

  it("자물쇠 단계가 code 를 안 줬으면 앞에서 알려 준 번호가 정답이다", () => {
    const { named } = built(undefined, undefined);
    expect(json(named("봉인 상자").pages)).toContain(`"value":${TELLS}`);
  });

  it("경로가 거쳐야 하는 그림 없는 조사 칸은 늘 빛난다 — 넘긴 뒤의 페이지는 빛나지 않는다", () => {
    const { ctx, map, named } = built();
    const skull = named("거대 두개골");
    expect(skull.pages!.map((page) => Boolean(page.glow))).toEqual([true, true, false]);
    expect(eventSight(ctx.project, map(), skull, skull.pages![1]).seen).toBe("glow");
    expect(eventSight(ctx.project, map(), skull, { ...skull.pages![1]!, glow: undefined }).seen).toBe("none");
    // 사람은 제 그림으로 보인다.
    expect(eventSight(ctx.project, map(), named("주술사"), named("주술사").pages![1]).seen).toBe("graphic");
  });

  it("물건 낱말은 이름의 마지막 어절이다", () => {
    expect(thingWord("낡은 책상")).toBe("책상");
    expect(thingWord("번호 쪽지")).toBe("쪽지");
    expect(thingWord("문")).toBeUndefined();
  });
});

describe("(b) 단계의 사람에게 얹은 페이지는 그 단계가 열려 있는 동안 연 페이지를 가리지 못한다", () => {
  function withQuests() {
    const made = built();
    const { ctx, map, named } = made;
    const quest = (key: string, giver: string, targets: readonly string[]) => runTool(ctx, "create_quest", { def: {
      key, title: `${giver}의 부탁`, summary: `${giver}의 부탁을 들어준다.`, order: "sequence", giver: { mapId: map().id, eventId: named(giver).id },
      steps: targets.map((target, i) => ({ kind: "talk", label: `${target}에게 전한다 ${i}`, target: { mapId: map().id, eventId: named(target).id }, lines: [`${target}: 전해 들었네.`] })),
    } }, { dryRun: false });
    const results = [quest("q_a", "촌장", ["주술사", "정령"]), quest("q_b", "주술사", ["촌장", "정령"]), quest("q_c", "정령", ["촌장", "주술사"])];
    return { ...made, results };
  }

  it("의뢰 셋을 얹어도 단계마다 열려 있을 때 도는 페이지는 연 페이지다", () => {
    const { ctx, results } = withQuests();
    expect(results.map((r) => r.ok)).toEqual([true, true, true]);
    for (const [id, live, runs] of openPages(ctx.project)) expect([id, runs]).toEqual([id, live]);
  });

  it("넘긴 뒤가 있는 단계의 의뢰 페이지는 «넘긴 뒤» 를 기다리고, 엔딩을 부르는 단계의 것은 «열리기 전» 에만 돈다 — 페이지 자리는 그대로다", () => {
    const { ctx, map, named, steps } = withQuests();
    const chief = named("촌장"), owner = stepPagesOf(ctx.project, map().id, chief)!;
    expect(owner.doneSwitchId).toBeTruthy();
    for (const page of chief.pages!.slice(owner.liveIndex + 1)) expect(page.conditions.some((c) => c.kind === "switch" && c.switchId === owner.doneSwitchId && c.value === true)).toBe(true);
    const spirit = named("정령"), last = stepPagesOf(ctx.project, map().id, spirit)!;
    expect(last.doneSwitchId).toBeUndefined();
    expect(last.notOpen).toBeTruthy();
    // 자리를 옮기지 않는다 — 모델이 pageIndex 로 부르는 다음 호출이 다른 페이지를 고치지 않게.
    expect(last.liveIndex).toBe(1);
    expect(spirit.pages!.length).toBeGreaterThan(2);
    for (const page of spirit.pages!.slice(last.liveIndex + 1)) expect(page.conditions.some((c) => json(c) === json(last.notOpen))).toBe(true);
    // 의뢰 제안 페이지는 단계의 연 페이지를 한 번 더 돌리지 않는다 — 단계가 넘기는 스위치를 켜는 페이지는 연 페이지 하나뿐이다.
    const gives = steps()[0]!.built!.switchId!;
    expect(chief.pages!.filter((page) => json(page.commands).includes(`"switchId":"${gives}","value":true`)).length).toBe(1);
    // 엔딩 명령도 연 페이지 하나에만.
    expect(spirit.pages!.filter((page) => json(page.commands).includes('"triggerEnding"')).length).toBe(1);
  });

  it("다시 맞춰도 바뀌지 않는다 · 의뢰를 얹은 뒤에도 기계·정직 플레이 모두 엔딩에 닿는다", () => {
    const { ctx } = withQuests();
    const before = json(ctx.project.maps);
    expect(settleStepPages(ctx.project)).toEqual([]);
    expect(json(ctx.project.maps)).toBe(before);
    expect(play(ctx.project, false).ok).toBe(true);
    expect(play(ctx.project, true).ok).toBe(true);
  });

  it("조수가 단계의 사람에게 덧붙인 페이지(add_event_page)도 넘긴 뒤를 기다린다", () => {
    const { ctx, map, named } = built();
    const added = runTool(ctx, "add_event_page", { mapId: map().id, eventId: named("촌장").id, page: { conditions: [], commands: [{ kind: "text", body: "날씨가 좋구나." }] } }, { dryRun: false });
    expect(added.ok).toBe(true);
    const chief = named("촌장"), owner = stepPagesOf(ctx.project, map().id, chief)!;
    expect(chief.pages!.at(-1)!.conditions).toEqual([{ kind: "switch", switchId: owner.doneSwitchId, value: true }]);
    for (const [id, live, runs] of openPages(ctx.project)) expect([id, runs]).toEqual([id, live]);
  });
});

describe("(c) 정직한 자동 플레이 — 보이는 것과 읽은 글만 쓴다", () => {
  it("지금 빌더가 지은 경로는 기계·정직 플레이 모두 엔딩에 닿는다", () => {
    const { ctx } = built();
    expect(play(ctx.project, false).endingReached).toBeTruthy();
    expect(play(ctx.project, true).endingReached).toBeTruthy();
  });

  it("그림 없는 조사 칸(반짝임뿐)은 기계 플레이만 찾아간다 — 정직한 플레이는 그 목표에서 멈추고 까닭을 적는다", () => {
    const { ctx } = built();
    const project = structuredClone(ctx.project);
    for (const ev of project.maps[project.startMapId]!.events) for (const page of ev.pages ?? []) delete page.glow;
    expect(play(project, false).ok).toBe(true);
    const honest = play(project, true);
    expect(honest.ok).toBe(false);
    expect(honestCauseOf(honest.failure?.detail)).toBe("unseen");
    expect(honest.failure?.detail).toContain("거대 두개골");
  });

  it("번호를 알려 준 글이 없으면 자물쇠에서 멈춘다", () => {
    const { ctx } = built();
    const project = structuredClone(ctx.project);
    const map = project.maps[project.startMapId]!;
    map.events = JSON.parse(json(map.events).replaceAll(`${TELLS}다`, "비밀이다")) as GameEvent[];
    const honest = play(project, true);
    expect(honest.ok).toBe(false);
    expect(honestCauseOf(honest.failure?.detail)).toBe("code");
  });

  it("끝맺음 관문의 «끝까지 플레이되는가» 는 정직한 플레이다 — 멈춘 까닭이 갈래가 되고 모델이 받는 글이 갈린다", () => {
    const { ctx } = built();
    expect(playProblems(ctx.project)).toEqual([]);
    const project = structuredClone(ctx.project);
    for (const ev of project.maps[project.startMapId]!.events) for (const page of ev.pages ?? []) delete page.glow;
    const problems = playProblems(project);
    expect(problems.map((f) => [f.judge, f.id, f.variant, f.severity])).toEqual([["play", "autoplay", "unseen", "block"]]);
    expect(findingEn(problems[0]!)).toContain("[play autoplay unseen]");
    expect(findingEn({ ...problems[0]!, variant: undefined })).toContain("[play autoplay]");
  });

  it("번호는 통째로 · 조각으로 · 자리별로 읽혀도 읽은 것이다", () => {
    expect(codeShown("3862", ["조상의 숫자는 3862다."])).toBe(true);
    expect(codeShown("3862", ["숫자는 3 8 6 2."])).toBe(true);
    expect(codeShown("3862", ["앞 조각 「38」", "뒤 조각 「62」"])).toBe(true);
    expect(codeShown("7294", ["7 _ 9 _", "_ 2 _ 4"])).toBe(true);
    expect(codeShown("3862", ["번호를 알아야 열 수 있다.", "1층에서 2명이 기다린다."])).toBe(false);
    expect(honestCauseOf(`${HONEST_CAUSES.unnamed}: …`)).toBe("unnamed");
    expect(honestCauseOf("걸어갈 길이 없습니다")).toBeUndefined();
  });
});
