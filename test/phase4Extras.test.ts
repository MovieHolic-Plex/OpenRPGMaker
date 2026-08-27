import { beforeAll, describe, expect, it } from "vitest";

// `@/editor/tools` 는 에디터 툴 배럴 전체(수백 모듈)를 끌어온다. 테스트 본문 안에서
// 처음 import 하면 그 변환 비용이 15s testTimeout 안에 들어가야 해서, 머신이 바쁠 때
// 제품 코드와 무관하게 시간초과로 빨개진다. 모듈 적재는 검증 대상이 아니므로
// hookTimeout(90s) 아래의 beforeAll 에서 한 번만 지불한다(test/editScenePaintHistory.test.ts 와 같은 패턴).
let tools: typeof import("@/editor/tools");
let emberQuest: typeof import("@/project/defaults/emberQuestGame");

beforeAll(async () => {
  [tools, emberQuest] = await Promise.all([
    import("@/editor/tools"),
    import("@/project/defaults/emberQuestGame"),
  ]);
});

describe("testPresets 직렬화 왕복", () => {
  it("project.testPresets가 serialize→deserialize를 통과하고 보존된다", async () => {
    const { serialize, deserialize } = await import("@/project/io");
    const { createEmberQuestProject, EMBER_MAP, EMBER_SWITCH } = emberQuest;
    const project = createEmberQuestProject();
    project.testPresets = [
      {
        id: "preset_q1done",
        name: "Q1 완료 상태",
        switches: { [EMBER_SWITCH.q1Started]: true },
        variables: { var_ember_moon_herbs: 2 },
        inventory: { item_old_key: 1 },
        gold: 250,
        startMapId: EMBER_MAP.mine,
        startPos: { x: 13, y: 18 },
      },
    ];

    const round = deserialize(serialize(project));
    expect(round.testPresets).toEqual(project.testPresets);
  });

  it("존재하지 않는 맵을 startMapId로 참조하는 프리셋은 거부된다", async () => {
    const { serialize, deserialize } = await import("@/project/io");
    const { createEmberQuestProject } = emberQuest;
    const project = createEmberQuestProject();
    project.testPresets = [{ id: "bad", name: "나쁜 프리셋", startMapId: "map_does_not_exist" }];
    expect(() => deserialize(serialize(project))).toThrow();
  });
});

describe("play_walkthrough schema contract", () => {
  it("publishes one provider-safe do/expect object shape with every runner field", async () => {
    const { getTool } = tools;
    const scenarioItems = getTool("play_walkthrough")?.parameters.properties?.scenario?.items;

    expect(scenarioItems?.required ?? []).not.toContain("kind");
    expect(scenarioItems?.oneOf).toBeUndefined();
    expect(Object.keys(scenarioItems?.properties ?? {}).sort()).toEqual([
      "count", "do", "eventId", "expect", "index", "itemId", "mapId", "op",
      "present", "switchId", "value", "variableId", "x", "y",
    ].sort());
    expect(scenarioItems?.additionalProperties).toBe(false);
  });
});

describe("play_walkthrough 툴", () => {
  it("잿불의 유산 완주 시나리오로 완주 성공을 반환한다", async () => {
    const { runTool } = tools;
    const { createEmberQuestProject } = emberQuest;
    const { EMBER_WALKTHROUGH } = await import("@/testing/emberWalkthrough");
    const ctx = { project: createEmberQuestProject() };
    const result = runTool(ctx, "play_walkthrough", { scenario: EMBER_WALKTHROUGH as unknown[], seed: 20260704 });

    expect(result.ok).toBe(true);
    const data = result.data as { ok: boolean; reachedEnding: boolean; finalState: { switchesOn: string[] } };
    expect(data.ok).toBe(true);
    expect(data.reachedEnding).toBe(true);
    expect(data.finalState.switchesOn).toContain("sw_ember_q1_clear");
    // 읽기 툴이므로 프로젝트를 변형하지 않는다.
    expect(ctx.project.session.gold).toBe(100);
  }, 15_000);

  it("파손 시나리오에서 실패 스텝을 데이터로 리포트한다", async () => {
    const { runTool } = tools;
    const { createEmberQuestProject } = emberQuest;
    const ctx = { project: createEmberQuestProject() };
    // 존재하지 않는 이벤트를 interact → 실패.
    const result = runTool(ctx, "play_walkthrough", { scenario: [{ do: "interact", eventId: "ev_missing" }] as unknown[] });
    const data = result.data as { ok: boolean; failedStepIndex: number; failureReason: string };
    expect(data.ok).toBe(false);
    expect(data.failedStepIndex).toBe(0);
    expect(data.failureReason).toContain("이벤트 없음");
  });
});
