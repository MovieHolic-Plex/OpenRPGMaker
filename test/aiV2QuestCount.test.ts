import { describe, expect, it } from "vitest";
import { measure } from "../scripts/fs-scale/score.mjs";
import { countQuests, MIN_COUNTED_QUESTS } from "@/ai/v2/judge/questCount";
import { questsMinBlocker, shipBlockers } from "@/ai/v2/judge/shipChecks";
import { splitPreexisting } from "@/ai/v2/judge/gates";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";
import { gateProblems } from "@/ai/v2/judge/finishGate";
import { tagged, findingLine } from "@/ai/v2/judge/finding";
import { REQUESTED_FEATURES, requestedFeatureGaps } from "@/ai/v2/judge/requestedFeatures";
import { requestedFeatureWord } from "@/ai/v2/request/readers";
import { normalizeGameBlueprint } from "@/project/gameBlueprint";
import type { PiAgentRequest } from "@/ai/piAgent/protocol";
import { combatProblems } from "@/ai/v2/judge/combatChecks";
import { gameContentProblems } from "@/ai/v2/judge/gameChecks";
import { vqaEnabled } from "@/ai/v2/turn/support";
import * as readers from "@/ai/v2/request/readers";
import { restoreEventFromBefore } from "@/ai/v2/story/restoreEvent";
import { isolateTimers } from "./mergedTeardown";

describe("aiV2QuestCount", () => {
  isolateTimers();
  // 2026-11-10 리드: 맵 다음은 퀘스트 — 끝맺음 관문이 세는 퀘스트 3개를 강제한다. 세는 규칙은 완성도 척도(scripts/fs-scale/score.mjs questFacts)와 같아야 한다.
  // 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(CI 에서 돈다).

  type Step = { kind: string; label?: string; description?: string };
  const quest = (key: string, title: string, steps: Step[]) => ({ key, title, steps });
  const withQuests = (quests: unknown[]): Project => ({ ...createBlankProject(), quests } as unknown as Project);
  const whole = "마을과 던전이 있는 모험 게임을 만들어 줘";
  const cases: Record<string, unknown[]> = {
    "없음": [],
    "공식 예시 그대로(단계 1개, label 없음)": [quest("q_ex", "촌장의 부탁", [{ kind: "talk" }])],
    "단계 둘인데 label 이 없다": [quest("q_a", "무라벨", [{ kind: "talk" }, { kind: "talk" }])],
    "label 이 같은 두 단계": [quest("q_b", "같은 글", [{ kind: "talk", label: "만난다 1" }, { kind: "talk", label: "만난다 2" }])],
    "label 이 다른 두 단계": [quest("q_c", "좋은 퀘스트", [{ kind: "talk", label: "촌장을 만난다" }, { kind: "talk", label: "약초꾼에게 전한다" }])],
    "그래프형(nodes.description)": [{ key: "q_g", title: "그래프", nodes: [{ description: "시작한다" }, { description: "끝낸다" }] }],
    "제목이 같은 두 퀘스트": [
      quest("q_d1", "같은 제목", [{ kind: "talk", label: "가" }, { kind: "talk", label: "나" }]),
      quest("q_d2", "같은 제목", [{ kind: "talk", label: "다" }, { kind: "talk", label: "라" }]),
    ],
    "세 개": [
      quest("q1", "하나", [{ kind: "talk", label: "가" }, { kind: "talk", label: "나" }]),
      quest("q2", "둘", [{ kind: "talk", label: "다" }, { kind: "talk", label: "라" }]),
      quest("q3", "셋", [{ kind: "talk", label: "마" }, { kind: "talk", label: "바" }]),
    ],
  };
  describe("세는 퀘스트 — 완성도 척도(score.mjs questFacts)와 같은 규칙", () => {
    for (const [name, quests] of Object.entries(cases)) {
      it(`${name}: 센 개수가 척도와 같다`, () => {
        expect(countQuests(withQuests(quests)).counted.length).toBe(measure(withQuests(quests), undefined).quests);
      });
    }
    it("공식 예시(label 없음)는 세지 않고 이유를 적는다 — 이 함정이 관문 문구의 예시 호출이 label 2개를 보이는 이유", () => {
      const { counted, uncounted } = countQuests(withQuests(cases["공식 예시 그대로(단계 1개, label 없음)"]!));
      expect(counted).toEqual([]);
      expect(uncounted[0]).toMatchObject({ reason: "steps" });
      expect(uncounted[0]!.detail).toContain("label");
    });
  });
  describe("quests-min 출하 차단", () => {
    it("모자라면 개수·모자란 수·예시 호출·안 센 퀘스트 이유를 문구에 싣는다", () => {
      const [b] = questsMinBlocker(withQuests(cases["공식 예시 그대로(단계 1개, label 없음)"]!), whole);
      expect(b!.id).toBe("quests-min");
      expect(b!.message).toContain(`0/${MIN_COUNTED_QUESTS}개`);
      expect(b!.message).toContain("create_quest");
      expect(b!.message).toContain("label");
      expect(b!.message).toContain("q_ex");
    });
    it("세는 퀘스트가 최소 수 이상이면 차단이 없다", () => {
      expect(questsMinBlocker(withQuests(cases["세 개"]!), whole)).toEqual([]);
    });
    it("방 하나짜리 게임은 1개면 통과한다", () => {
      const task = "방 하나만 있는 방탈출 게임 만들어줘";
      expect(questsMinBlocker(withQuests(cases["label 이 다른 두 단계"]!), task)).toEqual([]);
      expect(questsMinBlocker(withQuests([]), task)).toHaveLength(1);
    });
    it("안 센 퀘스트 이름이 달라도 할 일 항목의 열쇠(문구 앞 160자, 숫자는 #)는 같다", () => {
      const key = (text: string) => text.replace(/\d+/gu, "#").replace(/\s+/gu, " ").trim().slice(0, 160);
      const [x] = questsMinBlocker(withQuests([quest("q_x", "창고 정리", [{ kind: "talk" }])]), whole);
      const [y] = questsMinBlocker(withQuests([quest("q_y", "아주 긴 이름의 지하 통로 탐사", [{ kind: "talk" }])]), whole);
      expect(key(`[출하 차단 ${x!.id}] ${x!.message}`)).toBe(key(`[출하 차단 ${y!.id}] ${y!.message}`));
      expect(x!.message).toContain("창고 정리");
      expect(y!.message).toContain("지하 통로");
    });
    it("이어 하는 턴에서도 «기존 결함» 으로 면제되지 않는다", () => {
      const problem = gateProblems([tagged("ship", "quests-min", "세는 퀘스트가 0/3개다 — 3개 더.")])[0]!;
      const { current, preexisting } = splitPreexisting([problem], new Set([problem.textKey!]), undefined, undefined);
      expect(current).toHaveLength(1);
      expect(preexisting).toHaveLength(0);
    });
  });
});

describe("aiV2RequestedFeatures", () => {
  isolateTimers();
  const want = (text: string) => REQUESTED_FEATURES.filter((f) => requestedFeatureWord(f.id, text) !== undefined).map((f) => f.id);
  describe("requested feature coverage (J71/J73)", () => {
    it("reads chaser, darkness and hiding from a horror request", () => {
      expect(want("밤의 학교에서 쫓아오는 귀신을 피해 탈출하는 공포 게임. 복도는 캄캄하고 사물함에 숨을 수 있다")).toEqual(["chaser", "darkness", "hiding"]);
    });
    it("does not read them from look-alike words or negations", () => {
      expect(want("범인을 쫓는 탐정 게임. 숨어 있는 비밀을 찾는다. dark fantasy")).toEqual([]);
      expect(want("추격자 없이 퍼즐만 있는 게임")).toEqual([]);
    });
    it("blocks a whole game that lacks a requested chaser and darkness, and clears once built", () => {
      const project = createBlankProject() as Project;
      const task = "검은 장미 저택 공포 게임을 만들어 줘. 쫓아오는 것이 있고 어둡게.";
      expect(requestedFeatureGaps(project, task).map((b) => b.evidence.split(":")[0])).toEqual(["chaser", "darkness"]);
      expect(shipBlockers(project, task).some((b) => b.id === "requested-feature-missing")).toBe(true);
      const map = Object.values(project.maps)[0]!;
      map.defaultLighting = { ambient: 0.85, sources: [] };
      map.events = [{ id: "ghost", name: "그것", x: 1, y: 1, pages: [{ id: "p1", movement: { type: "chase" }, commands: [] }] } as never];
      expect(requestedFeatureGaps(project, task)).toEqual([]);
    });
    it("treats dim lighting under 0.5 as not dark", () => {
      const project = createBlankProject() as Project;
      Object.values(project.maps)[0]!.defaultLighting = { ambient: 0.2, sources: [] };
      expect(requestedFeatureGaps(project, "어두운 복도 게임 만들어 줘").map((b) => b.evidence.split(":")[0])).toEqual(["darkness"]);
    });
  });
  describe("requested feature negation (J73 review)", () => {
    it("reads 「않」 as not wanted and 「아니면」 as still wanted", () => {
      expect(want("어둡지 않은 밝은 게임 만들어 줘")).toEqual([]);
      expect(want("쫓아오는 귀신이나 아니면 괴물이 나오는 게임")).toEqual(["chaser"]);
    });
  });
});

// 끝맺음 검사가 읽는 «바란 것»(request/readers.ts)과, 게임 하나를 잇는 «계속» 턴이 게임 하나를 짓는 턴으로 다뤄지는가(2026-11-11 B7).
describe("aiV2RequestReaders", () => {
  isolateTimers();
  // 판정은 Finding 을 낸다 — 이 시험은 보고에 실리는 줄 글을 본다.
  const combatLines = (...args: Parameters<typeof combatProblems>): string[] => combatProblems(...args).map(findingLine);
  const gameLines = (...args: Parameters<typeof gameContentProblems>): string[] => gameContentProblems(...args).map(findingLine);
  type TextReader = "asksChaseNotBattleMusic" | "asksWorkingShop" | "asksTimedWhereabouts" | "asksOpenField" | "namesRandomEncounters" | "asksCure" | "asksClueForLock"
    | "asksAfterStep" | "asksShownFlashback" | "asksActEnd" | "asksLetterbox" | "saysNewGame" | "asksOpening" | "asksComboSkill" | "asksPerDay"
    | "asksSettingOnly" | "asksStoreOnly" | "asksToBeTold";
  describe("readers moved out of the judge files keep their words", () => {
    const rows: readonly (readonly [TextReader, string, boolean])[] = [
      ["asksChaseNotBattleMusic", "추격할 때 긴박한 음악 넣어 줘", true],
      ["asksChaseNotBattleMusic", "추격 음악이랑 전투 음악 바꿔 줘", false],
      ["asksWorkingShop", "무기점에서 검을 살 수 있게 해 줘", true],
      ["asksWorkingShop", "가게 간판을 달아 줘", false],
      ["asksTimedWhereabouts", "촌장은 밤에는 집 안에 있게 해 줘", true],
      ["asksOpenField", "숲에 늑대를 둬", true],
      ["asksOpenField", "마을 광장 옆 숲에 늑대를 둬", false],
      ["namesRandomEncounters", "숲에서는 랜덤으로 몬스터가 나와", true],
      ["namesRandomEncounters", "숲길에서는 무작위 조우는 없어", false],
      ["asksCure", "독을 치료하는 약초", true],
      ["asksClueForLock", "일기에 적힌 숫자로 금고 비밀번호를 맞추게", true],
      ["asksAfterStep", "동굴에 다녀오면 촌장이 열쇠를 준다", true],
      ["asksShownFlashback", "어릴 적 회상 장면이 나오게", true],
      ["asksActEnd", "1막 끝에서 멈춰", true],
      ["asksLetterbox", "레터박스를 넣어", true],
      ["saysNewGame", "새 게임 만들고 싶어", true],
      ["asksOpening", "오프닝을 바꿔", true],
      ["asksComboSkill", "둘이 같이 쓰는 필살기를 만들어", true],
      ["asksPerDay", "날마다 대사가 달라지게", true],
      ["asksSettingOnly", "휴대폰에서 탭하면 걷게 해 줘", true],
      ["asksSettingOnly", "도움말 표지판을 세워 줘", false],
      ["asksStoreOnly", "내 게임 평가에 답글 달아 줘", true],
      ["asksToBeTold", "이 게임 뭐가 부족한지 알려 줘", true],
      ["asksToBeTold", "촌장을 광장으로 옮겨 줘", false],
    ];
    it.each(rows)("%s(«%s») = %s", (reader, task, want) => {
      expect(readers[reader](task)).toBe(want);
    });

    // asksDataChange·asksBattleDataRemoval 은 2026-11-16 에 지웠다(db-review B #9): 자료집 변경은 낱말로 막지 않고 보고한다(databaseChangeReport).
    it("the request-word exemptions for database edits are gone", () => {
      expect("asksDataChange" in readers).toBe(false);
      expect("asksBattleDataRemoval" in readers).toBe(false);
    });

    it("requestedFeatureWord returns the matched word, and nothing when the feature is refused", () => {
      expect(readers.requestedFeatureWord("darkness", "어두운 복도를 걷는 게임")).toBe("어두운 복도");
      expect(readers.requestedFeatureWord("darkness", "어둡지 않게 해 줘")).toBeUndefined();
      expect(readers.requestedFeatureWord("chaser", "추격자 없이 조용한 게임")).toBeUndefined();
    });
  });
  /** 게임 하나로 시작한 프로젝트(청사진의 첫 요청이 게임 하나) — 전투 하나, 회복 길 없음. */
  function builtGame(blueprint = true): Project {
    const p = createBlankProject() as Project;
    const map = p.maps[p.startMapId]!;
    map.events.push({
      id: "ev_trial", name: "검술 시험관", x: 3, y: 3,
      pages: [{ ...structuredClone(map.events[0]?.pages?.[0] ?? {}), conditions: [], trigger: { kind: "action" }, commands: [{ kind: "battleProcessing", troopId: "troop_slime", canEscape: false, canLose: false }] }],
    } as never);
    if (blueprint) p.gameBlueprint = normalizeGameBlueprint({
      title: "시험 게임", genre: "판타지 RPG", playerGoal: "샘을 되찾자.", request: "판타지 RPG 게임 하나 만들어 줘.",
      steps: [{ id: "s1", place: "시작", event: "촌장", action: "촌장에게 묻는다", gives: "실마리", needs: [], feeling: "궁금함" }, { id: "s2", place: "시작", event: "샘", action: "샘을 살핀다", gives: "끝", needs: ["실마리"], feeling: "안도" }],
      ending: { name: "끝", how: "샘을 살핀다", feeling: "안도" },
    });
    return p;
  }
  const request = (task: string, project: Project, readOnly = false) => ({ task, project, ...(readOnly ? { readOnly } : {}) }) as PiAgentRequest;
  describe("a turn that carries on a whole-game project is a whole-game turn for the judges", () => {
    const CONTINUE = "계속 해 줘", SMALL = "촌장 대사를 바꿔 줘", WHOLE = "판타지 RPG 게임 하나 만들어 줘.";

    it("screen review is on for «계속» on a whole-game project, off for a small edit there and off for «계속» with no game to carry on", () => {
      expect(vqaEnabled(request(CONTINUE, builtGame()))).toBe(true);
      expect(vqaEnabled(request(WHOLE, builtGame(false)))).toBe(true);
      expect(vqaEnabled(request(SMALL, builtGame()))).toBe(false);
      expect(vqaEnabled(request(CONTINUE, builtGame(false)))).toBe(false);
      expect(vqaEnabled(request(CONTINUE, builtGame(), true))).toBe(false);
    });

    it("combat checks run on the carry-on turn even when this turn did not touch combat", () => {
      const game = builtGame();
      expect(combatLines(game, structuredClone(game), CONTINUE).some((p) => p.startsWith("[출하 차단 no-healing]"))).toBe(true);
      expect(combatLines(game, structuredClone(game), SMALL)).toEqual([]);
      const loose = builtGame(false);
      expect(combatLines(loose, structuredClone(loose), CONTINUE)).toEqual([]);
    });

    it("whole-game content checks (title and HUD choices) run on the carry-on turn, not on a small edit", () => {
      const game = builtGame();
      const carried = gameLines(game, structuredClone(game), CONTINUE);
      const whole = gameLines(game, structuredClone(game), WHOLE);
      expect(carried.length).toBeGreaterThan(0);
      // 이어 하기 턴이 받는 것은 게임 하나 요청이 받는 것 가운데 일부다(요청 글의 낱말로만 켜지는 검사는 빠진다).
      for (const p of carried) expect(whole).toContain(p);
      expect(gameLines(game, structuredClone(game), SMALL)).toEqual([]);
    });
  });
});

describe("aiV2RestoreEvent", () => {
  isolateTimers();
  const withEvent = (): Project => {
    const p = createBlankProject() as Project;
    const map = Object.values(p.maps)[0]!;
    map.events = [{ id: "ev_memory", name: "깨어난 손님의 기억", x: 12, y: 6, pages: [{ id: "p0", conditions: { switchId: "sw_v2scene_329777_shown" }, movement: { type: "fixed" }, commands: [{ kind: "showText", text: "a" }, { kind: "showText", text: "b" }, { kind: "showText", text: "c" }] }] } as never];
    return p;
  };
  describe("restore_event (toy-shop advisor turn 2)", () => {
    it("re-adds a deleted event exactly as it was before the request", () => {
      const before = withEvent();
      const after = structuredClone(before);
      Object.values(after.maps)[0]!.events = [];
      const r = restoreEventFromBefore(before, after, "ev_memory");
      expect(r.ok).toBe(true);
      expect(Object.values(after.maps)[0]!.events).toEqual(Object.values(before.maps)[0]!.events);
    });
    it("overwrites a rewritten event and accepts the event name", () => {
      const before = withEvent();
      const after = structuredClone(before);
      const ev = Object.values(after.maps)[0]!.events![0]! as unknown as { name?: string; pages: { conditions: unknown }[] };
      ev.name = undefined; ev.pages[0]!.conditions = { switchId: "sw_0003" };
      expect(restoreEventFromBefore(before, after, "깨어난 손님의 기억").ok).toBe(true);
      expect(Object.values(after.maps)[0]!.events).toEqual(Object.values(before.maps)[0]!.events);
    });
    it("refuses an id that did not exist before and lists what did", () => {
      const before = withEvent();
      const r = restoreEventFromBefore(before, structuredClone(before), "ev_nope");
      expect(r.ok).toBe(false);
      expect(r.summary).toContain("ev_memory");
    });
  });
});
