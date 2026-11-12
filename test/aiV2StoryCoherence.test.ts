import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { normalizeGameBlueprint } from "@/project/gameBlueprint";
import { createV2Tools } from "@/ai/v2/tools/verbs";
import { V2Session } from "@/ai/v2/turn/session";
import { refreshObjectiveRoutes } from "@/ai/v2/judge/objectiveRoutes";
import { objectiveGaps } from "@/ai/v2/judge/discoverability";
import { fillStaleObjectives } from "@/ai/v2/story/shipObjectiveDefaults";
import { dropWrongPrerequisiteLinesIn } from "@/ai/v2/story/blueprintPathGates";
import type { PiAssistantV2Env } from "@/ai/v2/shared/env";
import type { ToolContext } from "@/editor/tools/types";
import type { GameEvent, Project } from "@/project/types";

// 2026-11-11 눈가림 플레이(fun-x1-gatefix · fun-w3): 잠김 글이 틀린 선행 조건을 말하고(«수호자의 시험을 먼저» — 수호자는 이미 이겼다),
// 목표 글과 꼬리의 대상이 다르고(«번호 쪽지를 살펴보자 → 별의 봉인»), 곁 퀘스트의 도착 칸이 본편 목표 줄을 덮어썼다.
// 재는 법(모델 없음): scripts/qa/assistant-v2/storyCoherenceProbe.mts. 문서 openwiki/assistant-v2.md 「잠김 글·목표 대상은 실제 조건에서 나온다」.

const SLOW = 120_000;
const task = "밤의 학교를 탐험하는 게임 하나 만들어 줘.";

function harness() {
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

const SPOTS = ["현관", "복도", "교실", "도서실", "옥상 계단", "옥상"];
const blueprint = {
  title: "밤의 학교", genre: "모험", playerGoal: "밤의 학교에서 단서를 따라 옥상까지 가자.", ending: { name: "새벽", how: "해가 뜨고 문이 열렸다.", feeling: "안도" },
  steps: [
    { id: "s1", kind: "talk", who: "촌장 하르", place: SPOTS[0], event: "촌장 하르", action: "촌장에게 사정을 듣는다", gives: "촌장의 부탁", feeling: "걱정" },
    { id: "s2", kind: "find", place: SPOTS[1], event: "낡은 일지", action: "일지를 읽는다", needs: "촌장의 부탁", gives: "일지의 기록", feeling: "호기심" },
    { id: "s3", kind: "choice", who: "떠돌이 상인 미라", place: SPOTS[2], event: "떠돌이 상인 미라", action: "상인에게서 고른다", needs: "일지의 기록", gives: "상인의 물건", feeling: "설렘" },
    { id: "s4", kind: "battle", who: "얼음 문지기", place: SPOTS[3], event: "얼음 문지기", action: "문지기를 이긴다", needs: "상인의 물건", gives: "문지기 격파", feeling: "긴장" },
    { id: "s5", kind: "puzzle", place: SPOTS[4], event: "별의 봉인", action: "기록의 숫자로 봉인을 연다", needs: "문지기 격파", gives: "봉인 해제", feeling: "발견" },
    { id: "s6", kind: "talk", who: "별의 정령", place: SPOTS[5], event: "별의 정령", action: "정령에게 소원을 빈다", needs: "봉인 해제", gives: "엔딩", feeling: "안도" },
  ],
};
/** 번호를 두 단계 앞(일지)에서 알려 주는 판과 어디서도 알려 주지 않는 판. */
const stepText = (told: boolean) => [
  { id: "s1", lines: ["어서 오게. 밤마다 종이 저절로 울린다네."] },
  { id: "s2", lines: told ? ["(낡은 일지에 적혀 있다. 봉인을 여는 숫자는 4826.)"] : ["(낡은 일지에는 종탑 이야기가 적혀 있다.)"] },
  { id: "s3", lines: ["뭘로 하시겠어요?"], choices: [{ text: "등불을 산다", lines: ["밤길엔 등불이죠."], later: "등불이 길을 밝혔다." }, { text: "지도를 산다", lines: ["길을 잃진 않겠네요."], later: "지도 덕에 지름길로 왔다." }] },
  { id: "s4", lines: ["여기부터는 못 지나간다."], winLines: ["(문지기가 얼음 속으로 물러난다.)"], doneLines: ["(얼음 조각만 남아 있다.)"] },
  { id: "s5", lines: ["(별 모양 홈에 숫자를 맞추자.)"], lockedLines: ["(문지기의 시험을 먼저 통과해야 한다.)"], ...(told ? { code: "4826" } : {}) },
  { id: "s6", lines: ["네 소원을 들려다오."] },
];
const bodies = (event: GameEvent | undefined, page: number): string[] => ((event?.pages?.[page]?.commands ?? []) as { kind: string; body?: string }[]).filter((c) => c.kind === "text").map((c) => c.body ?? "");

describe("잠김 글은 실제 조건에서 나온다", () => {
  it("번호를 앞선 단계 어디서든 알려 줬으면 같은 번호의 쪽지를 끼우지 않는다 — 자물쇠의 조건은 청사진의 needs 그대로", async () => {
    const { call, eventOf } = harness();
    if (!(await call("write_blueprint", blueprint)).ok) expect((await call("write_blueprint", blueprint)).ok).toBe(true);
    const built = await call("build_blueprint_path", { steps: stepText(true) });
    expect(built.ok).toBe(true);
    expect(built.summary).not.toContain("번호 쪽지");
    expect(eventOf("번호 쪽지")).toBeUndefined();
    // 조건이 청사진 그대로(문지기 격파)라 모델이 그 조건을 보고 쓴 잠김 글을 쓴다.
    expect(bodies(eventOf("별의 봉인"), 0)).toEqual(["(문지기의 시험을 먼저 통과해야 한다.)"]);
  }, SLOW);

  it("함수가 단서 고리를 끼워 조건을 바꿨으면 모델의 잠김 글을 쓰지 않는다 — 조건에서 지은 글만", async () => {
    const { call, eventOf } = harness();
    if (!(await call("write_blueprint", blueprint)).ok) expect((await call("write_blueprint", blueprint)).ok).toBe(true);
    expect((await call("build_blueprint_path", { steps: stepText(false) })).ok).toBe(true);
    // 봉인의 조건은 이제 쪽지다 — «문지기의 시험» 을 말하지 않는다. 문지기에 걸린 것은 쪽지 쪽이다.
    expect(eventOf("번호 쪽지")).toBeDefined();
    expect(bodies(eventOf("별의 봉인"), 0).join(" ")).not.toContain("문지기");
    expect(bodies(eventOf("별의 봉인"), 0)[0]).toContain("번호");
    // 쪽지의 잠김 글은 앞 단계의 상대를 이름으로 가리킨다 — 깃발 이름(«문지기 격파»)은 화면에 내지 않는다.
    expect(bodies(eventOf("번호 쪽지"), 0).join(" ")).toContain("「얼음 문지기」를 쓰러뜨려야 한다.");
    expect(bodies(eventOf("번호 쪽지"), 0).join(" ")).not.toContain("문지기 격파");

  }, SLOW);

  it("단계 이벤트의 글과 목표 줄에 설계 칸(action · needs · gives · feeling)이 나오지 않는다 — 물건은 item 으로 소지품에 들어간다", async () => {
    const { ctx, call, eventOf } = harness();
    if (!(await call("write_blueprint", blueprint)).ok) expect((await call("write_blueprint", blueprint)).ok).toBe(true);
    const text = stepText(true).map((t) => (t.id === "s3" ? { ...t, item: "은빛 등불", goal: "상인 미라에게서 밤길에 쓸 것을 고르자" } : t));
    expect((await call("build_blueprint_path", { steps: text })).ok).toBe(true);
    // 화면에 나가는 글만 모은다: 대사 본문과 목표 줄.
    const lines: string[] = [];
    const collect = (node: unknown): void => {
      if (Array.isArray(node)) { node.forEach(collect); return; }
      if (!node || typeof node !== "object") return;
      const c = node as { kind?: string; body?: unknown; fields?: { surface?: unknown; message?: unknown } };
      if (c.kind === "text" && typeof c.body === "string") lines.push(c.body);
      if (c.fields?.surface === "objectiveChip") lines.push(String(c.fields.message ?? ""));
      Object.values(c).forEach(collect);
    };
    collect(Object.values(ctx.project.maps).flatMap((m) => m.events).map((e) => e.pages));
    const shown = lines.join("\n");
    for (const step of blueprint.steps) {
      expect(shown, `${step.id} action`).not.toContain(step.action);
      expect(shown, `${step.id} feeling`).not.toContain(`${step.feeling}…`);
      // 깃발 이름은 화면에 없다 — 물건 이름인 gives 가 소지품 이름(『…』)으로 나오는 것만 예외다(마지막 단계의 「엔딩」 은 낱말이 흔해 빼고 본다).
      if (step.gives !== "엔딩") expect(shown.replaceAll(`『${step.gives}』`, ""), `${step.id} gives`).not.toContain(step.gives);
    }
    expect(shown).not.toContain("알아냈다");
    expect(shown).not.toContain("있어야 할 것 같다");
    // 목표 줄: 모델이 쓴 goal 이 있으면 그것, 없으면 사람·물건 이름으로 지은 줄.
    expect(shown).toContain("상인 미라에게서 밤길에 쓸 것을 고르자");
    expect(shown).toContain("낡은 일지를 살펴보자");
    expect(shown).toContain("얼음 문지기를 쓰러뜨리자");
    // 건네는 물건은 실제 소지품이고, 다음 단계(문지기)가 그 물건을 확인한다.
    const lamp = ctx.project.database.items.find((item) => item.name === "은빛 등불");
    expect(lamp).toBeDefined();
    expect(JSON.stringify(eventOf("떠돌이 상인 미라")?.pages)).toContain(`"kind":"changeItem","itemId":"${lamp!.id}"`);
    expect(JSON.stringify((eventOf("얼음 문지기")?.pages ?? []).map((p) => p.conditions))).toContain(`"itemId":"${lamp!.id}"`);
  }, SLOW);

  it("앞선 빌드가 남긴 «다른 단계를 먼저 하라» 는 잠김 줄을 뺀다", () => {
    const project = createBlankProject() as Project;
    const map = project.maps[project.startMapId]!;
    const page = (commands: unknown[], conditions: unknown[] = []) => ({ id: `p${Math.random()}`, trigger: { kind: "action" }, priority: "same", graphic: {}, conditions, commands });
    map.events.push({ id: "ev_note", name: "번호 쪽지", x: 2, y: 2, pages: [page([{ kind: "text", body: "4826" }, { kind: "setSwitch", switchId: "sw_note", value: true }])] } as never);
    map.events.push({ id: "ev_seal", name: "별의 봉인", x: 4, y: 2, pages: [page([{ kind: "text", body: "(수호자의 시험을 먼저 통과해야 한다.)" }, { kind: "text", body: "먼저 「번호 쪽지」를 살펴보자." }]), page([{ kind: "setSwitch", switchId: "sw_open", value: true }], [{ kind: "switch", switchId: "sw_note", value: true }])] } as never);
    project.gameBlueprint = normalizeGameBlueprint({ title: "t", genre: "모험", playerGoal: "g", ending: { name: "끝", how: "끝", feeling: "f" }, steps: [
      { id: "s1", kind: "battle", who: "모래 수호자", place: map.name, event: "모래 수호자", action: "이긴다", gives: "격파", feeling: "f" },
      { id: "s2", kind: "puzzle", place: map.name, event: "별의 봉인", action: "연다", needs: "격파", gives: "엔딩", feeling: "f" },
    ] });
    expect(dropWrongPrerequisiteLinesIn(project)).toHaveLength(1);
    expect(bodies(map.events.find((e) => e.id === "ev_seal"), 0)).toEqual(["먼저 「번호 쪽지」를 살펴보자."]);
    expect(dropWrongPrerequisiteLinesIn(project)).toEqual([]);
  });
});

describe("목표의 대상은 글이 이름을 댄 것이다", () => {
  const chip = (message: string) => ({ kind: "m2Command", commandId: "m2-214-ui-command", fields: { surface: "objectiveChip", message, durationMs: 0 } });
  const page = (commands: unknown[], extra: object = {}) => ({ id: `p${Math.random()}`, trigger: { kind: "action" }, priority: "same", graphic: {}, conditions: [], commands, ...extra });

  it("꼬리를 다시 쓸 때 다음 청사진 단계가 아니라 글이 «…를» 로 부른 이벤트를 가리킨다", () => {
    const project = createBlankProject() as Project;
    const first = project.maps[project.startMapId]!;
    const room = { ...structuredClone(first), id: "map_b", name: "별의 방", events: [] as GameEvent[] };
    project.maps[room.id] = room as never;
    first.events.push({ id: "ev_door", name: "문", x: 5, y: 5, pages: [page([{ kind: "transfer", mapId: "map_b", x: 3, y: 3 }])] } as never);
    first.events.push({ id: "ev_guard", name: "모래 수호자", x: 8, y: 8, pages: [page([{ kind: "setSwitch", switchId: "sw_a", value: true }, chip("번호 쪽지를 살펴보자 (별의 방 입구: 동쪽 → 별의 봉인)")])] } as never);
    room.events.push({ id: "ev_note", name: "번호 쪽지", x: 4, y: 4, pages: [page([{ kind: "text", body: "4826" }])] } as never);
    room.events.push({ id: "ev_seal", name: "별의 봉인", x: 6, y: 4, pages: [page([{ kind: "text", body: "봉인" }])] } as never);
    project.gameBlueprint = normalizeGameBlueprint({ title: "t", genre: "모험", playerGoal: "g", ending: { name: "끝", how: "끝", feeling: "f" }, steps: [
      { id: "s1", place: first.name, event: "모래 수호자", action: "이긴다", gives: "격파", feeling: "f" },
      { id: "s2", place: "별의 방", event: "별의 봉인", action: "연다", needs: "격파", gives: "엔딩", feeling: "f" },
    ] });
    expect(refreshObjectiveRoutes(project)).toBe(1);
    const message = JSON.stringify(first.events.find((e) => e.id === "ev_guard"));
    expect(message).toContain("→ 번호 쪽지)");
    expect(message).not.toContain("→ 별의 봉인)");
  });

  it("곁 퀘스트의 진행 페이지는 본편 이정표가 아니다 — 목표를 걸지 않고, 걸려 있던 «찾아가자» 는 뗀다", () => {
    const project = createBlankProject() as Project;
    const map = project.maps[project.startMapId]!;
    (project as unknown as { quests: unknown[] }).quests = [{ key: "q_x", title: "곁 일", giver: { mapId: map.id, eventId: "ev_giver" }, steps: [{ kind: "reach", label: "가기", mapId: map.id, x: 3, y: 3 }] }];
    map.events.push({ id: "ev_start", name: "시작", x: 1, y: 1, pages: [{ ...page([chip("나지라에게 묻자"), { kind: "setSelfSwitch", key: "A", value: true }]), trigger: { kind: "auto" } }, page([], { conditions: [{ kind: "selfSwitch", key: "A", value: true }] })] } as never);
    map.events.push({ id: "ev_giver", name: "하산", x: 2, y: 2, pages: [
      page([{ kind: "setSwitch", switchId: "sw_q_x_started", value: true }]),
      page([{ kind: "fork", condition: { kind: "switch", switchId: "sw_q_x_step0", value: true }, then: [{ kind: "setSwitch", switchId: "sw_q_x_done", value: true }] }], { conditions: [{ kind: "switch", switchId: "sw_q_x_started", value: true }] }),
      page([{ kind: "text", body: "고맙네" }], { conditions: [{ kind: "switch", switchId: "sw_q_x_done", value: true }] }),
    ] } as never);
    map.events.push({ id: "ev_q_x_reach0", x: 3, y: 3, pages: [{ ...page([{ kind: "setSwitch", switchId: "sw_q_x_step0", value: true }, chip("「하산」을 찾아가자")], { conditions: [{ kind: "switch", switchId: "sw_q_x_started", value: true }] }), trigger: { kind: "playerTouch" }, priority: "below", graphic: { transparent: true } }] } as never);
    expect(objectiveGaps(project).filter((gap) => gap.includes("다음 목표를 바꾸지 않는다"))).toEqual([]);
    const notes = fillStaleObjectives(project);
    expect(notes.some((note) => note.includes("ev_q_x_reach0"))).toBe(true);
    expect(JSON.stringify(map.events.find((e) => e.id === "ev_q_x_reach0"))).not.toContain("objectiveChip");
    expect(JSON.stringify(map.events.find((e) => e.id === "ev_giver"))).not.toContain("objectiveChip");
    // 본편 시작 목표는 그대로.
    expect(JSON.stringify(map.events.find((e) => e.id === "ev_start"))).toContain("나지라에게 묻자");
  });
});
