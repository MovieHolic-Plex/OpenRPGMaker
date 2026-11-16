// 확인 빌드 r6 의 브라우저 플레이(포구 마을 「갈매나루」 · 「역 앞 상점가」)에서 찾은 조수 결함 다섯 — 안내 글 · 오프닝 · 퀘스트 대사 · 엔딩 도구.
// 증거: assistant-fable-runs/r6/DEFECTS.md «플레이에서 찾은 조수 결함» P3 · P7 · P8 · P9 · P10. P9 는 test/defineEndingKeepsFields.test.ts,
// P10 의 알림 띠는 test/objectiveCardTouchControls.test.ts · test/fieldHudBudget.test.ts 에 있다.
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { normalizeGameBlueprint } from "@/project/gameBlueprint";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import type { GameEvent, Project } from "@/project/types";
import type { PiAssistantV2Env } from "@/ai/v2/shared/env";
import { createV2Tools } from "@/ai/v2/tools/verbs";
import { V2Session } from "@/ai/v2/turn/session";
import { namesNextStep, nextStepLine, stepGoalAt } from "@/ai/v2/story/playerLines";
import { fillStaleObjectives } from "@/ai/v2/story/shipObjectiveDefaults";
import { refreshObjectiveRoutes } from "@/ai/v2/judge/objectiveRoutes";
import { OBJECTIVE_LINE_WIDTH, objectivePlaceNote, objectiveTextNotes, objectiveTextWidth, planObjective } from "@/ai/v2/judge/objectivePlan";
import { objectiveSentence } from "@/player/objectiveTarget";
import { applyBlueprintOpening, openingCaptionLines, openingGoalText } from "@/editor/tools/blueprintOpening";

type Obj = Record<string, unknown>;
const SLOW = 120_000;
const move = { type: "fixed" as const, speed: 3, frequency: 3 };
const page = (id: string, conditions: unknown[], commands: unknown[], more: Obj = {}) => ({ id, name: id, conditions, graphic: {}, trigger: { kind: "action" }, priority: "same", movement: move, commands, ...more });
const say = (speaker: string, body: string) => ({ kind: "text", speaker, body });
const person = (id: string, name: string, x: number, y: number, pages: unknown[]) => ({ id, name, x, y, trigger: { kind: "action" }, commands: [], pages }) as unknown as GameEvent;
const door = (id: string, name: string, x: number, y: number, to: { mapId: string; x: number; y: number }) =>
  person(id, name, x, y, [page(`${id}_0`, [], [{ kind: "transfer", ...to, direction: "up", fade: "black" }], { trigger: { kind: "playerTouch" }, priority: "below" })]);
const step = (id: string, kind: string, who: string, place: string, gives: string) => ({ id, kind, who, place, event: who, action: `${who} 단계`, gives, feeling: "긴장" });

/** 목표 명령들 — [이벤트 id, 쪽 id, 화면에 보이는 문장(필드 안내를 끈 게임), 대상 이벤트 id, 저장된 글]. */
function objectives(project: Project): { eventId: string; pageId: string; shown: string; target: string | undefined; raw: string }[] {
  const out: { eventId: string; pageId: string; shown: string; target: string | undefined; raw: string }[] = [];
  for (const map of Object.values(project.maps)) for (const event of map.events) for (const pg of event.pages ?? []) for (const command of pg.commands as unknown as { fields?: Obj }[]) {
    if (command.fields?.surface !== "objectiveChip") continue;
    const raw = String(command.fields.message);
    out.push({ eventId: event.id, pageId: pg.id, shown: objectiveSentence(project, raw), target: command.fields.targetEventId as string | undefined, raw });
  }
  return out;
}

/** 갈매나루 → 대성당 → 옛 지하 묘지. 어부는 스위치를 켜고(이정표), 신부는 제 스위치만 켜고, 병사는 아무것도 남기지 않는다 — r6 「갈매나루」 의 모양. */
function harbour(): Project {
  const ctx: ToolContext = { project: createBlankProject() };
  ctx.project.maps[ctx.project.startMapId]!.name = "갈매나루";
  for (const [id, name] of [["m_cathedral", "대성당"], ["m_crypt", "옛 지하 묘지"]] as const) expect(runTool(ctx, "create_map", { id, name, width: 20, height: 15 }, { dryRun: false }).ok).toBe(true);
  const p = ctx.project as Project;
  const town = p.maps[p.startMapId]!, cathedral = p.maps.m_cathedral!, crypt = p.maps.m_crypt!;
  town.events.push(
    person("ev_maru", "어부 마루", 4, 4, [page("maru_0", [], [say("어부 마루", "대성당 밑에서 종소리가 들려."), { kind: "setSwitch", switchId: "sw_heard", value: true }])]),
    door("ev_to_cathedral", "대성당 문", 10, 1, { mapId: "m_cathedral", x: 5, y: 12 }),
  );
  cathedral.events.push(
    person("ev_priest", "신부 안셀름", 6, 5, [
      page("priest_locked", [], [say("신부 안셀름", "아직은 때가 아닙니다.")]),
      page("priest_open", [{ kind: "switch", switchId: "sw_heard", value: true }], [say("신부 안셀름", "이 열쇠로 지하 묘지에 갈 수 있습니다."), { kind: "setSelfSwitch", key: "A", value: true }]),
      page("priest_done", [{ kind: "switch", switchId: "sw_heard", value: true }, { kind: "selfSwitch", key: "A", value: true }], [say("신부 안셀름", "주님의 가호가 함께하기를.")]),
    ]),
    door("ev_to_crypt", "지하 계단", 15, 2, { mapId: "m_crypt", x: 3, y: 3 }),
  );
  crypt.events.push(
    person("ev_soldier", "해골 병사", 8, 8, [page("soldier_0", [], [say("해골 병사", "지나가려면 나를 쓰러뜨려라!")])]),
    person("ev_boss", "검은 종지기", 15, 12, [page("boss_0", [], [say("검은 종지기", "돌아가라…"), { kind: "triggerEnding", endingId: "ending_dawn" }])]),
  );
  p.gameBlueprint = normalizeGameBlueprint({
    title: "갈매나루의 종", genre: "모험", playerGoal: "갈매나루 사람들의 이야기를 듣고 지하의 종소리를 멎게 하자.",
    steps: [step("s1", "talk", "어부 마루", "갈매나루", "종소리 소문"), step("s2", "talk", "신부 안셀름", "대성당", "지하 묘지 열쇠"), step("s3", "battle", "해골 병사", "옛 지하 묘지", "길목 개방"), step("s4", "battle", "검은 종지기", "옛 지하 묘지", "엔딩")],
    ending: { name: "새벽의 종소리", how: "보스를 이기면", feeling: "안도" },
  });
  return p;
}

// P3 — 목표 줄이 «「강지기 할아버지」를 찾아가자» 처럼 사람 이름뿐이고(길 꼬리는 필드 안내를 끈 게임에서 숨는다), 신부와 말한 뒤에도 목표가 그대로였다.
describe("P3 목표 줄은 누구를 · 어디서 말하고, 단계가 끝나면 다음으로 넘어간다", () => {
  it("다른 맵으로 가야 하는 단계의 목표 줄은 그 맵 이름을 문장에 싣는다 — 모델이 쓴 goal 은 고치지 않는다", () => {
    const keeper = { kind: "talk" as const, who: "강지기 할아버지", event: "강지기 할아버지", place: "강지기의 집" };
    expect(stepGoalAt(keeper, "강지기의 집")).toBe("강지기의 집에서 강지기 할아버지에게 말을 걸자");
    // 같은 맵이면(장소를 주지 않으면) 이름만.
    expect(stepGoalAt(keeper)).toBe("강지기 할아버지에게 말을 걸자");
    expect(stepGoalAt({ kind: "battle", who: "해골 병사", event: "해골 병사", place: "옛 지하 묘지" }, "옛 지하 묘지")).toBe("옛 지하 묘지에서 해골 병사를 쓰러뜨리자");
    // 줄이 이미 그 장소 이름을 담고 있으면(「어물전 주인 해순」) 되풀이하지 않는다.
    expect(stepGoalAt({ kind: "talk", who: "어물전 주인 해순", event: "어물전 주인 해순", place: "어물전" }, "어물전")).toBe("어물전 주인 해순에게 말을 걸자");
    // 모델이 쓴 goal(누구를 · 어디서 · 왜)은 그 글 그대로다.
    expect(stepGoalAt({ kind: "talk", who: "신부", event: "신부", place: "대성당", text: { goal: "등불을 알아볼 신부를 대성당에서 찾자." } }, "대성당")).toBe("등불을 알아볼 신부를 대성당에서 찾자");
  });

  it("끝맺음이 거는 다음 목표는 «<맵>에서 <누구>에게 …» 이고, 이정표를 남기지 않는 단계(말만 하는 신부 · 싸움) 뒤에도 다음 단계로 넘어간다", () => {
    const p = harbour();
    const notes = fillStaleObjectives(p);
    const hung = objectives(p);
    // 어부(스위치를 켠다) 뒤: 사람 이름뿐인 «「신부 안셀름」을 찾아가자» 가 아니라 어디서 누구에게.
    expect(hung.find((o) => o.eventId === "ev_maru")).toMatchObject({ pageId: "maru_0", shown: "대성당에서 신부 안셀름에게 말을 걸자", target: "ev_priest" });
    // 신부(제 스위치만 켠다) 뒤: 잠긴 쪽(priest_locked)도 끝난 뒤의 쪽(priest_done)도 아닌, 단계가 열렸을 때 도는 쪽에 건다.
    expect(hung.filter((o) => o.eventId === "ev_priest")).toEqual([expect.objectContaining({ pageId: "priest_open", shown: "옛 지하 묘지에서 해골 병사를 쓰러뜨리자", target: "ev_soldier" })]);
    // 병사(아무것도 남기지 않는다) 뒤: 같은 맵의 다음 상대 — 장소를 되풀이하지 않는다.
    expect(hung.find((o) => o.eventId === "ev_soldier")).toMatchObject({ shown: "검은 종지기를 쓰러뜨리자", target: "ev_boss" });
    // 엔딩을 부르는 마지막 단계에는 걸지 않는다.
    expect(hung.some((o) => o.eventId === "ev_boss")).toBe(false);
    expect(notes.filter((line) => line.includes("이정표 없는 단계"))).toHaveLength(2);
    // 화면에 «찾아가자» 꼴의 이름뿐인 목표는 없다.
    expect(hung.some((o) => /^「[^」]+」[을를] 찾아가자$/u.test(o.shown))).toBe(false);
    // 두 번 불러도 같다.
    expect(fillStaleObjectives(p)).toEqual([]);
    expect(objectives(p)).toEqual(hung);
  });

  it("where 로 준 대상은 목표가 들고 다닌다 — 끝맺음이 글에 지나가며 나온 다른 맵 이름으로 꼬리를 붙이지 않는다", () => {
    const text = "광장의 어부 마루에게 대성당 밑 종소리 소문을 물어보자.";
    const hang = (p: Project, target?: { mapId: string; eventId: string }) => {
      const plan = planObjective(p, { at: "start", text, where: "어부 마루", ...(target ? { target } : {}) });
      expect(plan.ok, plan.summary).toBe(true);
      for (const { mapId, event } of plan.events) p.maps[mapId]!.events.push(event as unknown as GameEvent);
      refreshObjectiveRoutes(p);
      return objectives(p).find((o) => o.eventId === "ev_objective_start")!;
    };
    // set_objective 가 where 의 이벤트를 대상으로 싣는다: 어부 마루는 이 맵에 있다 — «(대성당 입구: …)» 가 붙지 않는다.
    const withTarget = harbour();
    expect(hang(withTarget, { mapId: withTarget.startMapId, eventId: "ev_maru" })).toMatchObject({ raw: text, target: "ev_maru" });
    // 대상이 없던 옛 글은 글에 나온 맵 이름으로 꼬리가 붙는다(r6 에서 화면 밖에 남아 있던 틀린 꼬리).
    expect(hang(harbour()).raw).toContain("대성당 입구");
  });

  it("대사가 다음 사람·장소를 말했는지 이름의 낱말로 본다 — 말하지 않았으면 잇는 서술 한 줄", () => {
    const clerk = { kind: "talk" as const, who: "편의점 점원", event: "편의점 점원", place: "역 앞 상점가 편의점 앞" };
    const bookseller = { kind: "talk" as const, who: "서점 주인", event: "서점 주인", place: "역 앞 상점가 서점 앞" };
    // 「서점 주인」 을 «서점 할아버지» 라고 불러도 말한 것이다(게임 2 의 대사).
    expect(namesNextStep(["우유 달라고 야옹거리더니 서점 쪽으로 가던데요.", "서점 할아버지한테 가 보세요."], bookseller, clerk)).toBe(true);
    // 두 단계가 함께 쓰는 낱말(«상점가»)은 다음 갈 곳을 말한 것이 아니다.
    expect(namesNextStep(["상점가는 늘 붐비지."], bookseller, clerk)).toBe(false);
    // 게임 1: 강지기는 등불만 건네고 어물전 이야기를 하지 않았다.
    expect(namesNextStep(["이 낡은 등불을 가져가게. 어둠 속에서 길을 비춰 줄 걸세."], { kind: "choice", who: "어물전 주인 해순", event: "어물전 주인 해순", place: "어물전" }, { kind: "talk", who: "강지기 할아버지", event: "강지기 할아버지", place: "강지기의 집" })).toBe(false);
    expect(nextStepLine({ kind: "battle", who: "해골 병사", event: "해골 병사", place: "옛 지하 묘지" }, "옛 지하 묘지")).toBe("(이제 옛 지하 묘지에서 해골 병사를 쓰러뜨리자.)");
    expect(nextStepLine(bookseller)).toBe("(이제 서점 주인에게 말을 걸자.)");
  });
});

function harness(task: string) {
  const project = createBlankProject();
  const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
  const env: PiAssistantV2Env = { ctx, request: { task, provider: "local-cli:claude", mapIds: [], project } as never, emit: () => {}, record: () => {}, sideChat: async () => "{}", render: async () => "", checkpoint: async () => {} };
  const tools = createV2Tools(env, new V2Session());
  const call = async (name: string, args: unknown): Promise<{ ok?: boolean; summary?: string }> => {
    const res = await tools.find((t) => t.name === name)!.execute(`c-${name}`, args);
    const text = (res.content as { type: string; text?: string }[]).find((c) => c.type === "text")!.text!;
    try { return JSON.parse(text.split("\n[")[0]!) as { ok?: boolean; summary?: string }; } catch { return { ok: false, summary: text }; }
  };
  const eventOf = (name: string) => Object.values(ctx.project.maps).flatMap((m) => m.events).find((e) => e.name === name);
  return { ctx, call, eventOf };
}
const texts = (event: GameEvent | undefined, pageIndex: number): string[] => ((event?.pages?.[pageIndex]?.commands ?? []) as unknown as { kind: string; body?: string }[]).filter((c) => c.kind === "text").map((c) => c.body ?? "");

describe("P3 · P8 청사진 도구 — 대사는 다음 갈 곳을 잇고, 오프닝 글을 받는다", () => {
  const blueprint = {
    title: "밤의 학교", genre: "모험", playerGoal: "밤의 학교에서 단서를 따라 옥상까지 가자.",
    ending: { name: "새벽", how: "해가 뜨고 문이 열렸다.", feeling: "안도", closing: ["해가 떴다.", "문이 열렸다."] },
    steps: [
      { id: "s1", kind: "talk", who: "촌장 하르", place: "현관", event: "촌장 하르", action: "촌장에게 사정을 듣는다", gives: "촌장의 부탁", feeling: "걱정" },
      { id: "s2", kind: "talk", who: "사서 유나", place: "복도", event: "사서 유나", action: "사서에게 묻는다", needs: "촌장의 부탁", gives: "일지의 기록", feeling: "호기심" },
      { id: "s3", kind: "battle", who: "얼음 문지기", place: "도서실", event: "얼음 문지기", action: "문지기를 이긴다", needs: "일지의 기록", gives: "문지기 격파", feeling: "긴장" },
      { id: "s4", kind: "talk", who: "별의 정령", place: "옥상", event: "별의 정령", action: "정령에게 소원을 빈다", needs: "문지기 격파", gives: "엔딩", feeling: "안도" },
    ],
  };

  it("write_blueprint 는 opening(오프닝에서 읽는 글)을 받아 청사진에 남기고, 없으면 알린다 — 다시 써도 물려받는다", async () => {
    const { ctx, call } = harness("밤의 학교를 탐험하는 게임 하나 만들어 줘.");
    let wrote = await call("write_blueprint", blueprint);
    if (!wrote.ok) wrote = await call("write_blueprint", blueprint);
    expect(wrote.ok, wrote.summary).toBe(true);
    expect(wrote.summary).toContain("opening is empty");
    expect(wrote.summary).toContain("no answer, no game words");
    const opening = ["밤의 학교에는 아무도 없어야 한다.", "그런데 종이 저절로 울린다."];
    const again = await call("write_blueprint", { ...blueprint, opening });
    expect(again.ok, again.summary).toBe(true);
    expect(again.summary).not.toContain("opening is empty");
    expect(ctx.project.gameBlueprint?.opening).toEqual(opening);
    // 이름 맞추기 다시 쓰기(opening 을 빼고 보냄)가 오프닝 글을 지우지 않는다.
    expect((await call("write_blueprint", { ...blueprint, playerGoal: "밤의 학교에서 종소리의 까닭을 찾아 옥상까지 가자." })).ok).toBe(true);
    expect(ctx.project.gameBlueprint?.opening).toEqual(opening);
  }, SLOW);

  it("build_blueprint_path: 다음 사람을 말하지 않는 대사 뒤에 잇는 서술 한 줄을 붙이고 알린다 — 다음 사람을 말한 대사는 그대로 둔다", async () => {
    const { call, eventOf } = harness("밤의 학교를 탐험하는 게임 하나 만들어 줘.");
    let wrote = await call("write_blueprint", blueprint);
    if (!wrote.ok) wrote = await call("write_blueprint", blueprint);
    expect(wrote.ok, wrote.summary).toBe(true);
    const built = await call("build_blueprint_path", { steps: [
      { id: "s1", lines: ["어서 오게. 밤마다 종이 저절로 울린다네."] },
      { id: "s2", lines: ["종 이야기라면 도서실 일지에 있어요.", "얼음 문지기가 도서실을 막고 있으니 조심하세요."] },
      { id: "s3", lines: ["여기부터는 못 지나간다."], winLines: ["(문지기가 얼음 속으로 물러난다.)"] },
      { id: "s4", lines: ["네 소원을 들려다오."] },
    ] });
    expect(built.ok, built.summary).toBe(true);
    // 촌장은 사서 이야기를 하지 않았다 — 그 대사 뒤에 다음 단계의 목표 줄과 같은 문장이 서술로 붙는다.
    expect(texts(eventOf("촌장 하르"), 0)).toEqual(["어서 오게. 밤마다 종이 저절로 울린다네.", "(이제 사서 유나에게 말을 걸자.)"]);
    // 사서는 «얼음 문지기» 를 말했다 — 덧붙이지 않는다. 싸움 단계의 싸우기 전 말에도 붙이지 않는다.
    expect(texts(eventOf("사서 유나"), 1)).toEqual(["종 이야기라면 도서실 일지에 있어요.", "얼음 문지기가 도서실을 막고 있으니 조심하세요."]);
    expect(texts(eventOf("얼음 문지기"), 1)).toEqual(["여기부터는 못 지나간다."]);
    // 무엇을 덧붙였는지 결과 글이 말한다(모델이 읽는 글 — 영어).
    expect(built.summary).toContain("The lines of s1 did not say who or where next");
    expect(built.summary).not.toMatch(/The lines of [^.]*s2/u);
  }, SLOW);
});

// P7 — 수녀가 제 이름표 밑에서 «수녀가 부두 사람들에게 촛불 나눔을 부탁한다.» 고 말하고, 수락하면 «고맙네! 잘 부탁하지.» 라고 답했다.
describe("P7 create_quest — 요약문은 의뢰인의 대사가 아니다", () => {
  const compile = (dialogue?: Obj) => {
    const ctx: ToolContext = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    const def = {
      key: "q_candle", title: "성당의 촛불", summary: "수녀가 부두 사람들에게 촛불 나눔을 부탁한다.", order: "sequence",
      giver: { create: { mapId, x: 5, y: 5, name: "수녀" } },
      steps: [{ kind: "talk", target: { create: { mapId, x: 8, y: 5, name: "광장의 할머니" } }, lines: ["정말 고맙습니다."] }],
      rewards: { gold: 40 }, ...(dialogue ? { dialogue } : {}),
    };
    const result = runTool(ctx, "create_quest", { def }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    const giver = ctx.project.maps[mapId]!.events.find((e) => e.id === "ev_q_candle_giver")!;
    const offer = giver.pages!.find((pg) => pg.id.endsWith("_offer"))!.commands as unknown as Obj[];
    const accept = ((offer.find((c) => c.kind === "choices") as { options: { branch: Obj[] }[] }).options[0]!.branch).filter((c) => c.kind === "text");
    return { warnings: result.diff?.warnings ?? [], line: offer[0]!, accept };
  };

  it("dialogue 를 주지 않으면 요약문은 이름표 없는 서술로 뜨고, 수락 답은 정해진 말투가 아니라 서술 한 줄이다 — 결과 글이 알린다", () => {
    const { warnings, line, accept } = compile();
    expect(line).toEqual({ kind: "text", body: "수녀가 부두 사람들에게 촛불 나눔을 부탁한다." });
    expect(accept).toEqual([{ kind: "text", body: "의뢰 '성당의 촛불'을 받았다." }]);
    const note = warnings.find((w) => w.startsWith("Quest '성당의 촛불'"));
    expect(note).toContain("giver «수녀» has no words of their own for offer, accepted");
    expect(note).toContain("The summary is shown as narration");
    expect(note).toContain("def.dialogue{offer, accepted");
  });

  it("dialogue.offer · accepted 를 주면 그 사람의 이름표 밑에서 그 말을 한다 — 알릴 것이 없다", () => {
    const { warnings, line, accept } = compile({ offer: "부두 사람들에게 촛불을 나눠 주실 수 있을까요?", accepted: "고마워요. 주님의 은총이 함께하기를." });
    expect(line).toEqual({ kind: "text", speaker: "수녀", body: "부두 사람들에게 촛불을 나눠 주실 수 있을까요?" });
    expect(accept).toEqual([{ kind: "text", speaker: "수녀", body: "고마워요. 주님의 은총이 함께하기를." }]);
    expect(warnings.some((w) => w.startsWith("Quest '"))).toBe(false);
  });
});

// P8 — 오프닝이 목표 문장을 둘로 자른 것 + 맵 이름 카드였다: 찾는 게임이 시작 전에 «라멘집에서 고양이를 찾자.» 고 답을 말하고, «보스» 가 그대로 나왔다.
describe("P8 청사진 기본 오프닝 — 오프닝 글은 청사진의 opening, 목표 문장은 답·게임 낱말이 없을 때만", () => {
  const CAT_GOAL = "상점가 사람들에게 잃어버린 고양이 '미케'의 행방을 물어 단서를 모으고, 라멘집에서 고양이를 찾자.";
  function street(opening?: string[], playerGoal = CAT_GOAL): Project {
    const project = createBlankProject() as Project;
    const start = project.maps[project.startMapId]!;
    start.name = "역 앞 상점가";
    start.lowerTiles[3] = (start.lowerTiles[0] ?? 0) + 1; // 그릴 것이 있는 맵
    for (const [id, name, at] of [["map_ramen", "라멘집 다이키", 7], ["map_book", "서점", 9]] as const) {
      const copy = { ...structuredClone(start), id, name, events: [] as GameEvent[] };
      copy.lowerTiles[at] = (copy.lowerTiles[0] ?? 0) + 1;
      project.maps[id] = copy as never;
    }
    project.gameBlueprint = normalizeGameBlueprint({
      title: "상점가의 미케", genre: "모험", playerGoal, ...(opening ? { opening } : {}),
      steps: [step("s1", "talk", "전단지 아주머니", "역 앞 상점가", "단서"), step("s2", "talk", "서점 주인", "서점", "단서 둘"), step("s3", "find", "미케", "라멘집 다이키 안쪽 구석", "엔딩")],
      ending: { name: "미케, 집으로", how: "찾으면", feeling: "포근함" },
    });
    return project;
  }
  const narration = (project: Project): string[] => (project.system.opening?.scenes ?? []).map((scene) => String((scene as { narration?: string }).narration ?? ""));
  const shown = (project: Project): string => JSON.stringify(project.system.opening?.scenes ?? []);

  it("목표 문장에서 읽어도 되는 문장만 고른다 — 찾는 게임의 답(마지막 단계의 장소)과 게임 낱말이 든 문장은 문장째 뺀다", () => {
    expect(openingGoalText(street().gameBlueprint!)).toBe("");
    // 찾는 것의 이름(«고양이»)은 답이 아니다 — 장소를 말하지 않는 문장은 남는다.
    expect(openingGoalText(street(undefined, "상점가 사람들을 도와 잃어버린 고양이를 찾아 주자.").gameBlueprint!)).toBe("상점가 사람들을 도와 잃어버린 고양이를 찾아 주자.");
    const harbourGoal = (playerGoal: string) => normalizeGameBlueprint({
      title: "갈매나루의 종", genre: "모험", playerGoal, steps: [step("s1", "talk", "어부", "갈매나루", "소문"), step("s2", "battle", "검은 종지기", "옛 지하 묘지", "엔딩")], ending: { name: "끝", how: "h", feeling: "f" },
    });
    // 게임 1: «보스» 는 게임을 가리키는 낱말이다.
    expect(openingGoalText(harbourGoal("갈매나루 사람들의 이야기를 들어 대성당 지하 열쇠를 얻고, 옛 지하 묘지 맨 안쪽의 보스를 쓰러뜨려 마을을 지키자."))).toBe("");
    // 싸워 끝나는 게임이 상대와 장소를 이야기의 말로 부르면 그대로 읽는다(답이 아니다).
    expect(openingGoalText(harbourGoal("마을 사람들의 이야기를 듣자. 옛 지하 묘지의 종지기를 쓰러뜨려 마을을 지키자."))).toBe("마을 사람들의 이야기를 듣자. 옛 지하 묘지의 종지기를 쓰러뜨려 마을을 지키자.");
  });

  it("opening 이 없으면: 답을 말하는 문장도, 답인 장소의 장면도 오프닝에 나오지 않는다", () => {
    const project = street();
    const [note] = applyBlueprintOpening(project);
    expect(note).toContain("opening 없음");
    expect(narration(project).join(" ")).not.toContain("라멘집");
    expect(narration(project).join(" ")).not.toContain("찾자");
    // 마지막 단계(찾기)의 맵은 장면으로도 보이지 않는다.
    expect(shown(project)).not.toContain("map_ramen");
    expect(narration(project)).toContain("역 앞 상점가");
  }, SLOW);

  it("opening 이 있으면 그 글이 오프닝이다 — 걸러 내지 않고, 긴 줄만 구절에서 나눈다", () => {
    const opening = ["전학 온 첫날, 낯선 상점가 전봇대에 전단지가 붙어 있다.", "하얀 꼬리의 고양이 '미케'를 찾는다는 글씨가 비에 번져 있다."];
    const project = street(opening);
    const [note] = applyBlueprintOpening(project);
    expect(note).toContain("청사진 opening 2줄");
    expect(narration(project)).toEqual(opening);
    expect(openingCaptionLines(["아주 긴 한 줄이 들어오면 구절 단위로 나뉘어야 한다, 예컨대 이 문장처럼 쉼표가 있고 길이가 마흔여섯 자를 훌쩍 넘는 경우에는 두 줄이 된다."]))
      .toEqual(["아주 긴 한 줄이 들어오면 구절 단위로 나뉘어야 한다,", "예컨대 이 문장처럼 쉼표가 있고", "길이가 마흔여섯 자를 훌쩍 넘는 경우에는 두 줄이 된다."]);
    // 숫자가 든 줄도 모델이 플레이어에게 쓴 글이면 그대로 싣는다(목표 문장과 달리 걸러 내지 않는다).
    expect(openingCaptionLines(["  종은 새벽 4시에 울린다.  "])).toEqual(["종은 새벽 4시에 울린다."]);
  }, SLOW);
});

// P10 — 52자 시작 목표가 화면에서 «… 먼저 역 앞 전단지…» 로 끊겼고, set_objective 는 아무 말 없이 받았다.
describe("P10 set_objective — 목표 줄에 다 안 들어가는 글을 알린다(받기는 한다)", () => {
  const LONG = "상점가 사람들에게 잃어버린 고양이를 본 적 있는지 물어보자. 먼저 역 앞 전단지 아주머니에게.";

  it("글의 화면 폭을 한글 글자 수로 잰다 — 구석의 목표 줄 두 줄은 36자", () => {
    expect(OBJECTIVE_LINE_WIDTH).toBe(36);
    // r6 a1 실측: 이 글이 102px(한글·낫표 14자 × 7px + 빈칸 둘 × 2px) 이었다.
    expect(objectiveTextWidth("「강지기 할아버지」를 찾아가자")).toBeCloseTo(14.6, 5);
    expect(objectiveTextWidth("Ask Varga")).toBeCloseTo(8 * 0.55 + 0.3, 5);
    expect(objectiveTextWidth(LONG)).toBeGreaterThan(OBJECTIVE_LINE_WIDTH);
  });

  it("넘치는 글은 걸고, 화면에서 잘리는 뒷부분을 적어 알린다 — 들어가는 글에는 알릴 것이 없다", () => {
    const plan = planObjective(createBlankProject() as Project, { at: "start", text: LONG });
    expect(plan.ok, plan.summary).toBe(true);
    expect(plan.summary).toContain(LONG);
    expect(plan.notes).toHaveLength(1);
    // 플레이에서 보인 것은 «… 먼저 역 앞 전단지…» 였다 — 잘린 것은 그 뒤다.
    expect(plan.notes![0]).toContain("«아주머니에게.» is cut off there");
    expect(plan.notes![0]).toContain("about 36 Korean characters");
    expect(planObjective(createBlankProject() as Project, { at: "start", text: "광장의 어부 마루에게 대성당 밑 종소리 소문을 물어보자." }).notes).toBeUndefined();
    expect(objectiveTextNotes("촌장에게 말을 걸자", "촌장에게 말을 걸자")).toEqual([]);
  });

  it("80자를 넘는 글은 잘라 걸고 잘랐다고 알린다", () => {
    const plan = planObjective(createBlankProject() as Project, { at: "start", text: "가".repeat(95) });
    expect(plan.ok).toBe(true);
    expect(plan.summary).toContain(`「${"가".repeat(80)}」`);
    expect(plan.notes![0]).toContain("longer than 80 characters and was cut");
  });

  it("대상이 다른 맵에 있는데 글이 그 장소를 말하지 않으면 알린다 — 필드 안내를 켠 게임과 같은 맵 대상에는 알리지 않는다", () => {
    const p = harbour();
    const priest = { mapId: "m_cathedral", eventId: "ev_priest" };
    const [note] = objectivePlaceNote(p, "신부 안셀름에게 종소리를 물어보자", p.startMapId, priest);
    expect(note).toContain("«대성당»");
    expect(note).toContain("«대성당에서 …»");
    expect(objectivePlaceNote(p, "대성당의 신부 안셀름에게 종소리를 물어보자", p.startMapId, priest)).toEqual([]);
    expect(objectivePlaceNote(p, "어부 마루에게 소문을 물어보자", p.startMapId, { mapId: p.startMapId, eventId: "ev_maru" })).toEqual([]);
    p.system.fieldGuides = "on";
    expect(objectivePlaceNote(p, "신부 안셀름에게 종소리를 물어보자", p.startMapId, priest)).toEqual([]);
  });
});
