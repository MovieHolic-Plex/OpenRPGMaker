import { describe, expect, it } from "vitest";
import { countMaps, planLinks } from "@/ai/v2/judge/mapCount";
import { mapsMinBlocker } from "@/ai/v2/judge/shipChecks";
import { syncGateItems } from "@/ai/v2/judge/gates";
import { TodoStore } from "@/ai/v2/loop/todoStore";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";
import type { ToolContext } from "@/editor/tools/types";
import { deserialize, serialize } from "@/project/io";
import type { GameEvent, GameMap, Project } from "@/project/types";

// 2026-11-10 forest-0039(6장 작성)·ninja-0038(4장 작성)이 세는 맵 1/4: 만든 맵이 시작 맵에서 문으로 안 닿았다.
// 안 닿는 맵 무리가 있으면 맵 관문이 이을 호출(create_transfer_pair)을 문구 맨 끝에 싣고 syncGateItems 가 항목의 다음 호출로 넘긴다.
// 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(CI 에서 돈다).

const whole = "마을과 던전이 있는 모험 게임을 만들어 줘";
/** verbs.ts gameProblemTexts 가 출하 차단 줄에 붙이는 꼬리 문장 — 호출은 문구 맨 끝이 아니다. */
const gateText = (message: string): string => `[출하 차단 maps-min] ${message} 고치지 못하면 «완성»이라고 쓰지 말고 남은 기본값으로 보고한다.`;

/**
 * 말 거는 이벤트 하나 — 실제 프로젝트에 있을 수 있는 온전한 페이지로 만든다(name · graphic · priority · movement 포함).
 * 이 칸들이 빠진 페이지는 저장본 읽기(deserialize)가 받지 않고 upsert_event 가 채워 넣으므로 프로젝트 안에 생기지 않는다 —
 * 형을 속여(as never) 빠진 채 넣으면 도구 커밋의 린트가 page.movement.type 을 읽다 죽는다(이 시험이 #4486 부터 빨갛던 까닭).
 */
function talkEvent(id: string, x: number, y: number, pageId: string): GameEvent {
  return {
    id, name: id, x, y, trigger: { kind: "action" }, commands: [],
    pages: [{
      id: pageId, name: id, conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [{ kind: "text", speaker: "누군가", body: "안녕" }],
    }],
  };
}

/** createBlankProject 의 시작 맵을 복제해 한 장 더 만든다 — 같은 배치는 «복사» 라 못 세므로 타일 하나를 바꿔 다르게 한다. */
function cloneMap(project: Project, from: GameMap, id: string, tweak: number): GameMap {
  const copy = JSON.parse(JSON.stringify(from)) as GameMap;
  copy.id = id;
  copy.name = `맵 ${id}`;
  copy.events = [talkEvent(`${id}_talk`, 2, 2, `${id}_p`)];
  copy.lowerTiles = copy.lowerTiles.map((tile, index) => (index === tweak ? (tile === 0 ? 1 : 0) : tile));
  project.maps[id] = copy;
  return copy;
}

function isolatedProject(isolated: number): Project {
  const project = createBlankProject();
  const start = project.maps[project.startMapId]!;
  start.events = start.events.filter((event) => !JSON.stringify(event).includes('"transfer"'));
  start.events.push(talkEvent("start_talk", 3, 3, "p"));
  for (let i = 0; i < isolated; i += 1) cloneMap(project, start, `iso_${i}`, 5 + i);
  return project;
}

describe("안 닿는 맵 무리 — 이을 호출", () => {
  it("시작 맵에서 안 닿는 맵이 있으면 무리와 이을 곳(시작 맵의 빈 바닥 칸)을 계획한다", () => {
    const project = isolatedProject(2);
    const plan = planLinks(project);
    expect(plan.groups.length).toBeGreaterThan(0);
    expect(plan.from?.mapId).toBe(project.startMapId);
    expect(plan.groups.every((group) => group.cell)).toBe(true);
    expect(plan.from!.cell).toMatchObject({ x: expect.any(Number), y: expect.any(Number) });
  });

  it("맵 관문 문구 맨 끝에 create_transfer_pair 호출이 있고, 열쇠(앞 160자)에는 안 들어간다", () => {
    const [blocker] = mapsMinBlocker(isolatedProject(2), whole);
    expect(blocker!.id).toBe("maps-min");
    expect(blocker!.message).toMatch(/ Next call: create_transfer_pair\(\{"a":\{"mapId":"[^"]+","x":\d+,"y":\d+\},"b":\{"mapId":"iso_\d","x":\d+,"y":\d+\}\}\)$/u);
    const key = (text: string) => text.replace(/\d+/gu, "#").replace(/\s+/gu, " ").trim().slice(0, 160);
    expect(key(`[출하 차단 maps-min] ${blocker!.message}`)).not.toContain("Next call");
    expect(key(`[출하 차단 maps-min] ${blocker!.message}`)).not.toContain("iso_");
  });

  it("syncGateItems 를 거치면 항목 내용(220자 절단)에는 호출이 없어도 meta.nextCall 이 그 호출이다", () => {
    const [blocker] = mapsMinBlocker(isolatedProject(2), whole);
    const store = new TodoStore();
    const text = gateText(blocker!.message);
    const { opened } = syncGateItems(store, [{ key: "game:" + text.replace(/\d+/gu, "#").slice(0, 160), text, source: "gate" }], new Set(), new Set(["create_transfer_pair"]));
    expect(opened).toHaveLength(1);
    expect(opened[0]!.content).not.toContain("Next call");
    const next = store.meta.get(opened[0]!.id)?.nextCall;
    expect(next?.verb).toBe("create_transfer_pair");
    expect(JSON.parse(/\((\{.*\})\)$/u.exec(next!.text)![1]!)).toMatchObject({ a: { mapId: expect.any(String) }, b: { mapId: expect.stringMatching(/^iso_/u) } });
  });

  it("그 호출을 실제 도구로 실행하면 닿는 맵이 늘어난다(도구가 받아들이는 좌표인 증거)", () => {
    const ctx: ToolContext = { project: isolatedProject(2) };
    // 시험이 만든 프로젝트는 저장본으로 읽히는 것이어야 한다 — 읽히지 않는 모양으로는 도구가 무엇을 받아들이는지 증명하지 못한다.
    expect(() => deserialize(serialize(ctx.project))).not.toThrow();
    const before = countMaps(ctx.project);
    const [blocker] = mapsMinBlocker(ctx.project, whole);
    const call = /Next call: (\w+)\((\{.*\})\)\s*$/u.exec(blocker!.message)!;
    const result = runTool(ctx, call[1]!, JSON.parse(call[2]!) as Record<string, unknown>);
    expect(result.ok, result.summary).toBe(true);
    const after = countMaps(ctx.project);
    expect(after.uncounted.filter((u) => u.reason === "unreachable").length).toBeLessThan(before.uncounted.filter((u) => u.reason === "unreachable").length);
    expect(() => deserialize(serialize(ctx.project))).not.toThrow(); // 도구가 만든 문 이벤트까지 담고도 읽힌다
  });

  it("안 닿는 맵이 없으면(작거나 이벤트가 없어 못 센 경우) 호출을 싣지 않는다", () => {
    const project = createBlankProject();
    const [blocker] = mapsMinBlocker(project, whole);
    expect(blocker!.message).not.toContain("Next call");
  });
});
