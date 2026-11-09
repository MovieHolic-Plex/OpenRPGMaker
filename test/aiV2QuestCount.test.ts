import { describe, expect, it } from "vitest";
import { measure } from "../scripts/fs-scale/score.mjs";
import { countQuests, MIN_COUNTED_QUESTS } from "@/ai/v2/questCount";
import { questsMinBlocker } from "@/ai/v2/shipChecks";
import { splitPreexisting } from "@/ai/v2/loop/gates";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";

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
    const text = "[출하 차단 quests-min] 세는 퀘스트가 0/3개다 — 3개 더.";
    const problem = { key: "game:" + text.replace(/\d+/gu, "#"), text, source: "gate" as const };
    const { current, preexisting } = splitPreexisting([problem], new Set([problem.key]), undefined, undefined);
    expect(current).toHaveLength(1);
    expect(preexisting).toHaveLength(0);
  });
});
