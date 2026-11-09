import { describe, expect, it } from "vitest";
import { deserialize, serialize } from "@/project/io";
import { v2BaselineGameKeys } from "@/ai/v2/verbs";
import { AUTOPLAY_GATE_PREFIX, playProblems } from "@/ai/v2/playCheck";
import { buildQaFixture } from "./fixtures/qaGame/qaGameFixtures";
import { syncGateItems } from "@/ai/v2/loop/gates";
import { TodoStore } from "@/ai/v2/loop/todoStore";
import type { Project } from "@/project/types";

const load = (name: Parameters<typeof buildQaFixture>[0]): Project => deserialize(serialize(buildQaFixture(name)));
const WHOLE_GAME = "마을과 던전이 있는 모험 게임을 만들어 줘";

describe("v2 finish gate: the game must play through to an ending", () => {
  it("raises a play problem when the auto-play cannot reach the ending", () => {
    const problems = playProblems(load("endingSwitchUnset"));
    expect(problems.length).toBeGreaterThan(0);
    expect(problems[0]!.text).toContain("[끝까지 플레이 불가]");
    expect(problems[0]!.key.length).toBeGreaterThan(0);
    expect(new Set(problems.map((p) => p.key)).size).toBe(problems.length);
  });

  it("raises nothing for a game whose auto-play reaches the ending", () => {
    expect(playProblems(load("clean"))).toEqual([]);
  });

  it("the finish gate carries the problem for a whole-game request and not for a small edit", () => {
    const stuck = load("endingSwitchUnset");
    expect([...v2BaselineGameKeys(stuck, WHOLE_GAME)].some((key) => key.startsWith(AUTOPLAY_GATE_PREFIX))).toBe(true);
    expect([...v2BaselineGameKeys(stuck, "이 맵의 상점 주인 이름을 바꿔 줘")].some((key) => key.startsWith(AUTOPLAY_GATE_PREFIX))).toBe(false);
    expect([...v2BaselineGameKeys(load("clean"), WHOLE_GAME)].some((key) => key.startsWith(AUTOPLAY_GATE_PREFIX))).toBe(false);
  });
});

describe("v2 finish gate: the repair line carries the verified move_event call", () => {
  it("names the event and the tile that really opens the route, and the todo item's next call is exactly that call", () => {
    const project = load("clean");
    const start = project.maps[project.startMapId]!;
    const solid = (id: string, x: number, y: number) => ({
      id, name: id, x, y, trigger: { kind: "action" }, commands: [],
      pages: [{ id: `${id}_p`, name: id, conditions: [], graphic: { transparent: true }, trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [{ kind: "text", body: "막았다" }] }],
    }) as unknown as (typeof start.events)[number];
    start.events.push(solid("block_w", 15, 8), solid("block_e", 17, 8), solid("block_n", 16, 7), solid("block_s", 16, 9));
    const [problem] = playProblems(project);
    expect(problem!.text).toMatch(/ Next call: move_event\(\{"mapId":"[^"]+","eventId":"block_[wens]","x":\d+,"y":\d+\}\)$/u);
    // 실제 경로: 문제 → 할 일 항목(내용은 220자에서 잘린다) → 항목의 다음 호출. 잘린 내용에는 호출이 없어도 meta.nextCall 이 그 호출이다.
    const store = new TodoStore();
    const { opened } = syncGateItems(store, [{ key: problem!.key, text: problem!.text, source: "gate" }], new Set(), new Set(["move_event"]));
    expect(opened).toHaveLength(1);
    expect(opened[0]!.content.length).toBeLessThanOrEqual(221);
    expect(opened[0]!.content).not.toContain("Next call");
    const next = store.meta.get(opened[0]!.id)?.nextCall;
    expect(next?.verb).toBe("move_event");
    expect(JSON.parse(/\((\{.*\})\)$/u.exec(next!.text)![1]!)).toMatchObject({ mapId: expect.any(String), eventId: expect.stringMatching(/^block_/u), x: expect.any(Number), y: expect.any(Number) });
    // 열쇠는 문구 앞쪽만 본다 — 호출은 문장 맨 뒤라 열쇠에 들어가지 않는다.
    expect(problem!.key).not.toContain("Next call");
  });
});
