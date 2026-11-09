import { describe, expect, it } from "vitest";
import { countMaps, planLinks } from "@/ai/v2/mapCount";
import { mapsMinBlocker } from "@/ai/v2/shipChecks";
import { syncGateItems } from "@/ai/v2/loop/gates";
import { TodoStore } from "@/ai/v2/loop/todoStore";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";
import type { ToolContext } from "@/editor/tools/types";
import type { GameMap, Project } from "@/project/types";

// 2026-11-10 forest-0039(6장 작성)·ninja-0038(4장 작성)이 세는 맵 1/4: 만든 맵이 시작 맵에서 문으로 안 닿았다.
// 안 닿는 맵 무리가 있으면 맵 관문이 이을 호출(create_transfer_pair)을 문구 맨 끝에 싣고 syncGateItems 가 항목의 다음 호출로 넘긴다.
// 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(CI 에서 돈다).

const whole = "마을과 던전이 있는 모험 게임을 만들어 줘";
const WALL = 0;

/** createBlankProject 의 시작 맵을 복제해 한 장 더 만든다 — 같은 배치는 «복사» 라 못 세므로 타일 하나를 바꿔 다르게 한다. */
function cloneMap(project: Project, from: GameMap, id: string, tweak: number): GameMap {
  const copy = JSON.parse(JSON.stringify(from)) as GameMap;
  copy.id = id;
  copy.name = `맵 ${id}`;
  copy.events = [{ id: `${id}_talk`, name: `${id}_talk`, x: 2, y: 2, trigger: { kind: "action" }, commands: [], pages: [{ id: `${id}_p`, conditions: [], trigger: { kind: "action" }, commands: [{ kind: "text", speaker: "누군가", body: "안녕" }] }] } as never];
  copy.lowerTiles = copy.lowerTiles.map((tile, index) => (index === tweak ? (tile === 0 ? 1 : 0) : tile));
  project.maps[id] = copy;
  return copy;
}

function isolatedProject(isolated: number): Project {
  const project = createBlankProject();
  const start = project.maps[project.startMapId]!;
  start.events = start.events.filter((event) => !JSON.stringify(event).includes('"transfer"'));
  start.events.push({ id: "start_talk", name: "start_talk", x: 3, y: 3, trigger: { kind: "action" }, commands: [], pages: [{ id: "p", conditions: [], trigger: { kind: "action" }, commands: [{ kind: "text", speaker: "누군가", body: "안녕" }] }] } as never);
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
    const text = `[출하 차단 maps-min] ${blocker!.message}`;
    const { opened } = syncGateItems(store, [{ key: "game:" + text.replace(/\d+/gu, "#").slice(0, 160), text, source: "gate" }], new Set(), new Set(["create_transfer_pair"]));
    expect(opened).toHaveLength(1);
    expect(opened[0]!.content).not.toContain("Next call");
    const next = store.meta.get(opened[0]!.id)?.nextCall;
    expect(next?.verb).toBe("create_transfer_pair");
    expect(JSON.parse(/\((\{.*\})\)$/u.exec(next!.text)![1]!)).toMatchObject({ a: { mapId: expect.any(String) }, b: { mapId: expect.stringMatching(/^iso_/u) } });
  });

  it("그 호출을 실제 도구로 실행하면 닿는 맵이 늘어난다(도구가 받아들이는 좌표인 증거)", () => {
    const ctx: ToolContext = { project: isolatedProject(2) };
    const before = countMaps(ctx.project);
    const [blocker] = mapsMinBlocker(ctx.project, whole);
    const call = /Next call: (\w+)\((\{.*\})\)\s*$/u.exec(blocker!.message)!;
    const result = runTool(ctx, call[1]!, JSON.parse(call[2]!) as Record<string, unknown>);
    expect(result.ok, result.summary).toBe(true);
    const after = countMaps(ctx.project);
    expect(after.uncounted.filter((u) => u.reason === "unreachable").length).toBeLessThan(before.uncounted.filter((u) => u.reason === "unreachable").length);
  });

  it("안 닿는 맵이 없으면(작거나 이벤트가 없어 못 센 경우) 호출을 싣지 않는다", () => {
    const project = createBlankProject();
    const [blocker] = mapsMinBlocker(project, whole);
    expect(blocker!.message).not.toContain("Next call");
  });
});
