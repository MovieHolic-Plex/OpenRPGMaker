import { afterEach, describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults/blankProject";
import { buildV2SystemPrompt } from "@/ai/v2/prompt/systemPrompt";
import { PLACE_SPEC_INDEX, placeSpecCards, placeSpecKindOf } from "@/ai/v2/prompt/placeSpecs";
import { editOnlyRequest } from "@/ai/v2/request/readers";
import { exposeV2Tools } from "@/ai/v2/tools/toolExposure";
import { INTERIOR_CARD } from "@/ai/v2/place/builders/interior";
import { createV2Tools } from "@/ai/v2/tools/verbs";
import { V2Session } from "@/ai/v2/turn/session";
import assert from "node:assert/strict";
import type { PiAssistantV2Env } from "@/ai/v2/shared/env";
import { deserialize, serialize } from "@/project/io";
import { v2BaselineGameKeys } from "@/ai/v2/judge/finishGate";
import { AUTOPLAY_GATE_PREFIX, playProblems } from "@/ai/v2/judge/playCheck";
import { buildQaFixture } from "./fixtures/qaGame/qaGameFixtures";
import type { Project } from "@/project/types";
import { stepGoal, wordlessLine } from "@/ai/v2/story/playerLines";
import { captionLines } from "@/editor/tools/blueprintOpening";
import { normalizeStepText } from "@/project/gameBlueprint";
import { isolateTimers } from "./mergedTeardown";

describe("aiV2LeanPrompt", () => {
  isolateTimers();
  const task = "이제 이 서재에 방탈출 규칙을 넣어 줘. 자물쇠에 4자리 비밀번호를 넣어.";
  afterEach(() => { delete process.env.OPRN_V2_LEAN_PROMPT; });
  /** 이미 지은 게임(이벤트가 있는 맵) — 빈 프로젝트는 첫 장소를 짓는 요청으로 본다. */
  function builtProject() {
    const project = createBlankProject();
    (project.maps[project.startMapId]!.events as unknown[]).push({ id: "ev_desk", name: "책상", x: 1, y: 1, pages: [] });
    return project;
  }
  describe("v2 lean prompt — place specs on demand", () => {
    it("keeps place-building cards out of the system prompt and lists them in one index line", () => {
      const project = builtProject();
      const sys = buildV2SystemPrompt(project, project.startMapId, task).join("\n");
      expect(sys).toContain(PLACE_SPEC_INDEX);
      expect(sys).not.toContain(INTERIOR_CARD);
      expect(sys).not.toContain("[Interior catalog");
    });
    it("place-building and whole-game requests keep the full cards; so does a bare description on an empty project", () => {
      const built = builtProject();
      expect(editOnlyRequest(built, task)).toBe(true);
      expect(editOnlyRequest(built, "마을에 대장간 하나 추가해 줘")).toBe(false);
      expect(editOnlyRequest(built, "새 맵에 동굴을 만들어 줘")).toBe(false);
      expect(editOnlyRequest(built, "방탈출 게임 하나 만들어 줘")).toBe(false);
      // 빈 프로젝트라도 시킨 일이 분명한 작은 요청은 작은 일이다(2026-11-11 B3). 묘사뿐인 글은 첫 장소를 짓는 시작으로 본다.
      expect(editOnlyRequest(createBlankProject(), task)).toBe(true);
      expect(editOnlyRequest(createBlankProject(), "폐업 직전 태엽 장난감 가게")).toBe(false);
      const sys = buildV2SystemPrompt(built, built.startMapId, "마을에 대장간 하나 추가해 줘").join("\n");
      expect(sys).toContain(INTERIOR_CARD);
      expect(sys).not.toContain(PLACE_SPEC_INDEX);
    });
    it("OPRN_V2_LEAN_PROMPT=0 restores the full cards", () => {
      process.env.OPRN_V2_LEAN_PROMPT = "0";
      const project = builtProject();
      const sys = buildV2SystemPrompt(project, project.startMapId, task).join("\n");
      expect(sys).toContain(INTERIOR_CARD);
      expect(sys).not.toContain(PLACE_SPEC_INDEX);
    });
    it("maps place types to spec kinds and gives the interior card with its chipset catalog", () => {
      expect(placeSpecKindOf("cave")).toBe("dungeon");
      expect(placeSpecKindOf("house")).toBe("street");
      expect(placeSpecKindOf(undefined)).toBeUndefined();
      const project = createBlankProject();
      const cards = placeSpecCards("interior", project, project.startMapId, task);
      expect(cards[0]).toBe(INTERIOR_CARD);
      expect(cards[1]).toContain("[Interior catalog");
    });
    it("edit-only requests load place-building verbs on demand", () => {
      const project = builtProject();
      const env = { ctx: { project, currentMapId: project.startMapId, assistantRun: true }, request: { task, provider: "local-cli:claude", mapIds: [], project },
        emit() {}, record() {}, sideChat: async () => "{}", render: async () => "", checkpoint: async () => {}, lazyToolsVia: "call_tool" } as never;
      const exposure = exposeV2Tools(env, createV2Tools(env, new V2Session()));
      const listed = exposure.tools.map((t) => t.name);
      expect(listed).not.toContain("make_place");
      expect(listed).not.toContain("edit_place");
      expect(listed).toContain("add_people");
      expect(listed).toContain("load_tools");
      expect(exposure.lazy.has("make_place")).toBe(true);
      expect(exposure.offered).toContain("edit_place");
    });
    it("the first build call of a kind in a conversation returns its spec instead of building, then builds", async () => {
      const project = builtProject();
      let epoch = 0;
      const env = { ctx: { project, currentMapId: project.startMapId, assistantRun: true }, request: { task, provider: "local-cli:claude", mapIds: [], project },
        emit() {}, record() {}, sideChat: async () => "{}", render: async () => "", checkpoint: async () => {}, contextEpoch: () => epoch } as never;
      const tools = createV2Tools(env, new V2Session());
      const addPeople = tools.find((t) => t.name === "add_people")!;
      const first = await addPeople.execute("a", { people: [{ role: "guard" }] } as never, undefined as never);
      const head = JSON.parse((first.content[0] as { text: string }).text);
      expect(head).toMatchObject({ ok: false, notFailure: true });
      expect((first.content[1] as { text: string }).text).toContain("People spec");
      const second = await addPeople.execute("b", { people: [{ role: "guard" }] } as never, undefined as never);
      expect(JSON.parse((second.content[0] as { text: string }).text).notFailure).toBeUndefined();
      epoch = 1; // conversation was cleared → the spec is given again
      const third = await addPeople.execute("c", { people: [{ role: "guard" }] } as never, undefined as never);
      expect(JSON.parse((third.content[0] as { text: string }).text)).toMatchObject({ notFailure: true });
    });
  });
});

describe("aiV2PeopleShop", () => {
  isolateTimers();
  // 2026-11-11 구조 재점검 5-1: 상점 주인 한 명에 호출 4~6번이 들었다(add_people 에 상점 칸이 없고 상점 도구는 뒤로 밀려 있었다).
  async function addPeople(people: unknown[]) {
    const project = createBlankProject();
    const task = "이 맵에 상점 주인 한 명 세워 줘";
    const env = { ctx: { project, currentMapId: project.startMapId, assistantRun: true }, request: { task, provider: "local-cli:claude", mapIds: [], project },
      emit: () => {}, record: () => {}, sideChat: async () => "{}", render: async () => "", checkpoint: async () => {} } as unknown as PiAssistantV2Env;
    const tool = createV2Tools(env, new V2Session()).find((entry) => entry.name === "add_people");
    assert(tool);
    const res = await tool.execute("call-1", { people } as never, undefined as never);
    const text = (res.content as { type: string; text?: string }[]).find((part) => part.type === "text")?.text ?? "{}";
    return { project: env.ctx.project, result: JSON.parse(text) as { ok: boolean; summary: string; warnings?: string[] } };
  }
  describe("add_people sells — 상점 주인을 한 번에", () => {
    it("있는 아이템은 이름으로 찾아 대사 뒤에 사고파는 상점을 단다", async () => {
      const { project, result } = await addPeople([{ role: "상인", name: "잡화점 주인 보리", where: "광장", firstTalk: ["어서 오세요!"], sells: [{ item: "회복약" }, { item: "해독초", price: 30 }] }]);
      assert(result.ok, result.summary);
      const keeper = project.maps[project.startMapId]!.events.find((event) => event.name === "잡화점 주인 보리");
      assert(keeper?.pages?.length);
      const kinds = keeper.pages[0]!.commands.map((command) => command.kind);
      expect(kinds.indexOf("shop")).toBeGreaterThan(kinds.indexOf("text"));
      const shop = keeper.pages[0]!.commands.find((command) => command.kind === "shop") as { stock: { itemId: string; priceOverride?: number }[]; allowSell: boolean };
      expect(shop.allowSell).toBe(true);
      expect(shop.stock).toEqual([{ itemId: "item_potion" }, { itemId: "item_antidote", priceOverride: 30 }]);
    });

    it("없는 이름은 값만 있는 잡화로 만들고 그 사실을 알린다", async () => {
      const { project, result } = await addPeople([{ role: "상인", name: "지도 장수", sells: [{ item: "마을 지도", price: 15 }] }]);
      assert(result.ok, result.summary);
      const made = project.database.items.find((item) => item.name === "마을 지도");
      expect(made).toMatchObject({ price: 15 });
      expect((result.warnings ?? []).join("\n")).toContain("new plain items were created");
    });

    it("sells 가 없으면 상점을 달지 않는다", async () => {
      const { project, result } = await addPeople([{ role: "촌장", name: "촌장 하르", firstTalk: ["어서 오게."] }]);
      assert(result.ok, result.summary);
      const chief = project.maps[project.startMapId]!.events.find((event) => event.name === "촌장 하르");
      expect(chief?.pages?.[0]?.commands.some((command) => command.kind === "shop")).toBe(false);
    });
  });
});

describe("aiV2PlayCheck", () => {
  isolateTimers();
  // 견본의 사람·물건은 그림 없이 지어져 있다 — 이 관문의 자동 플레이는 보이는 것만 쓰므로(정직한 플레이), 지은 게임이 그렇듯 페이지마다 칩을 입힌다.
  const load = (name: Parameters<typeof buildQaFixture>[0]): Project => {
    const project = deserialize(serialize(buildQaFixture(name)));
    for (const map of Object.values(project.maps)) for (const event of map.events) for (const page of event.pages ?? []) {
      if (!page.graphic?.sprite && !page.graphic?.appearanceId) page.graphic = { ...page.graphic, transparent: false, sprite: { type: "bundled", id: "fixture-chip" } };
    }
    return project;
  };
  const WHOLE_GAME = "마을과 던전이 있는 모험 게임을 만들어 줘";
  describe("v2 finish gate: the game must play through to an ending", () => {
    it("raises a play problem when the auto-play cannot reach the ending", () => {
      const problems = playProblems(load("endingSwitchUnset"));
      expect(problems.length).toBeGreaterThan(0);
      expect(problems[0]!.ko).toContain("[끝까지 플레이 불가]");
      expect(problems[0]!.target!.ref!.length).toBeGreaterThan(0);
      expect(new Set(problems.map((p) => p.target!.ref)).size).toBe(problems.length);
    });

    it("raises nothing for a game whose auto-play reaches the ending", () => {
      expect(playProblems(load("clean"))).toEqual([]);
    });

    it("an ending only the plan can find is not reached: the path's people have no graphic", () => {
      const unseen = playProblems(deserialize(serialize(buildQaFixture("clean"))));
      expect(unseen.length).toBeGreaterThan(0);
      expect(unseen.every((problem) => problem.variant === "unseen")).toBe(true);
    });

    it("the finish gate carries the problem for a whole-game request and not for a small edit", () => {
      const stuck = load("endingSwitchUnset");
      expect([...v2BaselineGameKeys(stuck, WHOLE_GAME)].some((key) => key.startsWith(AUTOPLAY_GATE_PREFIX))).toBe(true);
      expect([...v2BaselineGameKeys(stuck, "이 맵의 상점 주인 이름을 바꿔 줘")].some((key) => key.startsWith(AUTOPLAY_GATE_PREFIX))).toBe(false);
      expect([...v2BaselineGameKeys(load("clean"), WHOLE_GAME)].some((key) => key.startsWith(AUTOPLAY_GATE_PREFIX))).toBe(false);
    });
  });
});

// 플레이어가 읽는 글은 플레이어에게 쓴 칸과 화면에 뜨는 이름으로만 짓는다 — 설계 칸(action · needs · gives · feeling)은 나가지 않는다.
// 왜(2026-11-12 증기의 심장): 목표 줄 «공업지구로 가려면 어떻게 할지 선택한다(파업 노동자 편 / 공장주 편)», 오프닝 자막 «…오르텐 할멈을 찾아가라는»,
// 잠김 대사 «자동인형 정지가 있어야 할 것 같다», 보상 줄 «『자동인형 정지』를 알아냈다».
describe("aiV2PlayerLines", () => {
  isolateTimers();
  const step = (kind: "talk" | "find" | "battle" | "puzzle" | "choice" | undefined, event: string, who?: string, place = "황동 광장") =>
    ({ ...(kind ? { kind } : {}), event, ...(who ? { who } : {}), place, action: "공업지구로 가려면 어떻게 할지 선택한다(파업 노동자 편 / 공장주 편)", gives: "공업지구 통행증", feeling: "갈등과 긴장" });
  describe("stepGoal — 「현재 목표」 줄", () => {
    it("모델이 쓴 goal 이 있으면 그 글이다(끝 마침표만 뗀다)", () => {
      expect(stepGoal({ ...step("choice", "선장 바르가", "선장 바르가"), text: { goal: "선장 바르가에게 건너갈 길을 구하자." } })).toBe("선장 바르가에게 건너갈 길을 구하자");
    });

    it("goal 이 없으면 단계 종류와 이름으로 짓는다 — action 은 쓰지 않는다", () => {
      expect(stepGoal(step("talk", "오르텐 할멈", "오르텐 할멈"))).toBe("오르텐 할멈에게 말을 걸자");
      expect(stepGoal(step("choice", "선장 바르가", "선장 바르가"))).toBe("선장 바르가와 이야기하고 마음을 정하자");
      expect(stepGoal(step("battle", "폭주 자동인형", "폭주 자동인형"))).toBe("폭주 자동인형을 쓰러뜨리자");
      expect(stepGoal(step("puzzle", "압력 밸브"))).toBe("압력 밸브의 번호를 맞히자");
      expect(stepGoal(step("find", "감시탑 일지"))).toBe("감시탑 일지를 살펴보자");
      // 종류를 적지 않은 옛 청사진: 이벤트 이름의 행동 낱말은 뗀다.
      expect(stepGoal(step(undefined, "책상 조사"))).toBe("책상을 살펴보자");
      for (const kind of ["talk", "find", "battle", "puzzle", "choice", undefined] as const) expect(stepGoal(step(kind, "선장 바르가", "선장 바르가"))).not.toContain("선택한다");
    });
  });
  // 잠긴 단계의 안내(lockedHint)는 2026-11-15 에 걷었다 — 잠긴 글은 «왜 아직인가» 만 말하고 갈 곳은 「현재 목표」 줄이 말한다(test/aiV2PlayFixes3 «잠긴 글»).

  describe("wordlessLine — 대사를 받지 못한 사람 단계", () => {
    it("이름으로만 지은 서술 한 줄이다", () => {
      expect(wordlessLine(step("talk", "오르텐 할멈", "오르텐 할멈"))).toBe("(오르텐 할멈과 이야기를 나누었다.)");
      expect(wordlessLine(step("battle", "폭주 자동인형", "폭주 자동인형"))).toBe("(폭주 자동인형이 앞을 막아선다.)");
    });
  });
  describe("captionLines — 오프닝 자막", () => {
    it("긴 안내 문장을 자르지 않고 구절 단위로 나눈다(말줄임 없음)", () => {
      const lines = captionLines("밤마다 멈추지 않는 도시의 대심장을 세우기 위해, 사람들의 단서를 모아 기관실의 폭주 기계를 멈춰라.");
      expect(lines).toEqual(["밤마다 멈추지 않는 도시의 대심장을 세우기 위해,", "사람들의 단서를 모아 기관실의 폭주 기계를 멈춰라."]);
      expect(lines.join("")).not.toContain("…");
    });

    it("쉼표 없는 긴 문장은 어절 사이에서 나누고 낱말을 잃지 않는다", () => {
      const text = "아주 오래전 잠든 태양의 피라미드 깊은 곳에 묻힌 별의 조각을 찾아 마을로 돌아가는 길을 스스로 열어야 한다";
      const lines = captionLines(text);
      expect(lines.length).toBeGreaterThan(1);
      for (const line of lines) expect(Array.from(line).length).toBeLessThanOrEqual(46);
      expect(lines.join(" ")).toBe(text);
    });

    it("긴 구절은 고르게 나눈다 — 끝에 낱말 한두 개만 남기지 않는다", () => {
      expect(captionLines("벽돌 거리의 경보를 조사하고 공방과 선착장의 단서를 따라 중앙 기관실에서 폭주 기관을 멈추자."))
        .toEqual(["벽돌 거리의 경보를 조사하고 공방과 선착장의 단서를 따라", "중앙 기관실에서 폭주 기관을 멈추자."]);
    });

    it("짧은 문장은 그대로 한 줄, 숫자·정답이 든 문장은 싣지 않는다", () => {
      expect(captionLines("촌장과 이야기하고 샘을 되살리자.")).toEqual(["촌장과 이야기하고 샘을 되살리자."]);
      expect(captionLines("금고 번호 4729 를 찾아라. 밤의 저택을 빠져나가자.")).toEqual(["밤의 저택을 빠져나가자."]);
      expect(captionLines(undefined)).toEqual([]);
    });
  });
  describe("단계 글에 남기는 goal · item", () => {
    it("빈 값은 버리고 길이를 자른다", () => {
      expect(normalizeStepText({ goal: "  공방의 오르텐 할멈을 찾아가자 ", item: " 황동 렌치 " })).toEqual({ goal: "공방의 오르텐 할멈을 찾아가자", item: "황동 렌치" });
      expect(normalizeStepText({ goal: " ", item: "" })).toBeUndefined();
    });
  });
});
