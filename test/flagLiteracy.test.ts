// 채점기가 "잘 저작된 플래그 설계"와 "나쁜 플래그 설계"를 실제로 **분리**하는지 먼저 증명한다.
// 분리를 못 하면 벤치마크 점수는 숫자놀음이 된다. GOOD 은 선언·명명·레지스트리 등록·self-switch
// 로컬 상태·멀티페이지 게이팅·변수 카운터(+=/>=)·크로스이벤트 읽기를 모두 갖추고, BAD 는
// 미선언 스위치 쓰기·이름 없는 기본 슬롯 사용·게이팅 없음·변수 0개·쓰기만 하고 안 읽기를 갖춘다.
import { describe, expect, it } from "vitest";
import { analyzeFlagLiteracy, scoreFlagLiteracy, FLAG_AXES } from "@/benchmark/flags";
import { FLAG_BENCH_TASKS } from "@/benchmark/flags/tasks";
import { createBlankProject } from "@/project/defaults";
import { projectLint } from "@/project/lint/projectLint";
import type { Command, EventPage, GameEvent, Project } from "@/project/types";

function page(id: string, conditions: EventPage["conditions"], commands: Command[]): EventPage {
  return {
    id,
    name: id,
    conditions,
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands,
  };
}

function event(id: string, x: number, y: number, pages: EventPage[]): GameEvent {
  return { id, x, y, trigger: { kind: "action" }, commands: [], pages };
}

function firstMap(project: Project) {
  return project.maps[project.startMapId]!;
}

function nameSwitch(project: Project, id: string, name: string): void {
  const slot = project.switches.find((entry) => entry.id === id);
  if (slot) slot.name = name;
  else project.switches.push({ id, name });
}

function goodProject(): Project {
  const project = createBlankProject();
  nameSwitch(project, "sw_0001", "대장장이 첫 대화 완료");
  nameSwitch(project, "sw_0002", "대장장이 광석 의뢰 수락");
  nameSwitch(project, "sw_0003", "폐광 보스 봉인 해제");
  const counter = project.variables.find((entry) => entry.id === "var_0001");
  if (counter) counter.name = "모은 광석 수";
  project.storyFlags = [
    { id: "smith-intro", kind: "switch", targetId: "sw_0001", description: "대장장이와 첫 대화" },
    { id: "smith-quest", kind: "switch", targetId: "sw_0002", description: "광석 의뢰 진행 중" },
    { id: "boss-sealed", kind: "switch", targetId: "sw_0003", description: "보스 봉인 해제" },
    { id: "ore-count", kind: "variable", targetId: "var_0001", description: "제출한 광석 수" },
  ];

  const smith = event("ev-smith", 3, 3, [
    page(
      "p3",
      [
        { kind: "switch", switchId: "sw_0002", value: true },
        { kind: "variable", variableId: "var_0001", op: ">=", value: 5 },
      ],
      [
        { kind: "text", body: "광석 다 모았구나! 봉인을 풀어주지." },
        { kind: "setSwitch", switchId: "sw_0003", value: true },
        { kind: "setSwitch", switchId: "sw_0002", value: false },
      ]
    ),
    page(
      "p2",
      [{ kind: "switch", switchId: "sw_0002", value: true }],
      [
        { kind: "text", body: "광석은 좀 모았나?" },
        { kind: "setVariable", variableId: "var_0001", op: "+=", value: 1 },
      ]
    ),
    page(
      "p1",
      [
        { kind: "switch", switchId: "sw_0001", value: true },
        { kind: "selfSwitch", key: "A", value: false },
      ],
      [
        { kind: "text", body: "폐광에서 광석 5개만 가져와 주게." },
        { kind: "setSwitch", switchId: "sw_0002", value: true },
        { kind: "setSelfSwitch", key: "A", value: true },
      ]
    ),
    page("p0", [], [
      { kind: "text", body: "나는 이 마을 대장장이다." },
      { kind: "setSwitch", switchId: "sw_0001", value: true },
    ]),
  ]);

  const villager = event("ev-villager", 5, 3, [
    page("p1", [{ kind: "switch", switchId: "sw_0002", value: true }], [{ kind: "text", body: "대장장이 심부름 중이라던데?" }]),
    page("p0", [{ kind: "switch", switchId: "sw_0001", value: true }], [{ kind: "text", body: "대장장이 만나봤어?" }]),
  ]);

  const door = event("ev-boss-door", 7, 3, [
    page("p1", [{ kind: "switch", switchId: "sw_0003", value: true }], [{ kind: "text", body: "문이 열려 있다." }]),
    page("p0", [], [
      {
        kind: "fork",
        condition: { kind: "switch", switchId: "sw_0003", value: false },
        then: [{ kind: "text", body: "단단히 봉인되어 있다." }],
        else: [{ kind: "text", body: "열렸다." }],
      },
    ]),
  ]);

  firstMap(project).events.push(smith, villager, door);
  return project;
}

function badProject(): Project {
  const project = createBlankProject();
  const npc = event("ev-npc", 3, 3, [
    page("p0", [], [
      { kind: "text", body: "안녕." },
      { kind: "setSwitch", switchId: "S_ghost", value: true },
      // 이벤트 로컬 1회성 상태인데 이름 없는 전역 슬롯을 씀 — self-switch 를 써야 하는 자리다.
      { kind: "setSwitch", switchId: "sw_0001", value: true },
    ]),
  ]);
  const npc2 = event("ev-npc2", 5, 3, [
    page("p0", [], [
      { kind: "text", body: "나도 안녕." },
      { kind: "setSwitch", switchId: "sw_0002", value: true },
    ]),
  ]);

  firstMap(project).events.push(npc, npc2);
  return project;
}

describe("flag literacy 채점기", () => {
  it("9개 축을 노출하고 가중치 합이 1이다", () => {
    expect(FLAG_AXES).toHaveLength(9);
    expect(FLAG_AXES.reduce((total, axis) => total + axis.weight, 0)).toBeCloseTo(1, 5);
    expect(new Set(FLAG_AXES.map((axis) => axis.id)).size).toBe(9);
  });

  it("잘 저작된 프로젝트를 나쁜 프로젝트보다 25점 이상 높게 준다", () => {
    const good = scoreFlagLiteracy(goodProject());
    const bad = scoreFlagLiteracy(badProject());
    expect(good.total).toBeGreaterThan(bad.total + 25);
    expect(good.total).toBeLessThanOrEqual(100);
    expect(bad.total).toBeGreaterThanOrEqual(0);
  });

  it("좋은 프로젝트의 핵심 축이 실제로 높다", () => {
    const card = scoreFlagLiteracy(goodProject());
    const byId = new Map(card.axes.map((axis) => [axis.id, axis.score]));
    expect(byId.get("declaration")).toBe(1);
    expect(byId.get("naming")).toBe(1);
    expect(byId.get("registry")).toBe(1);
    expect(byId.get("pageGating")).toBeGreaterThan(0.5);
    expect(byId.get("variableUsage")).toBeGreaterThan(0.5);
    expect(byId.get("conditionalReads")).toBe(1);
    expect(byId.get("scopeChoice")).toBeGreaterThan(0.5);
    expect(byId.get("orphanFlags")).toBe(1);
    expect(["A", "B"]).toContain(card.grade);
  });

  it("나쁜 프로젝트의 결함 축이 실제로 낮다", () => {
    const card = scoreFlagLiteracy(badProject());
    const byId = new Map(card.axes.map((axis) => [axis.id, axis.score]));
    expect(byId.get("declaration")).toBeLessThan(1);
    expect(byId.get("naming")).toBe(0);
    expect(byId.get("registry")).toBe(0);
    expect(byId.get("pageGating")).toBe(0);
    expect(byId.get("variableUsage")).toBe(0);
    expect(byId.get("conditionalReads")).toBe(0);
    expect(byId.get("scopeChoice")).toBeLessThan(0.5);
    expect(byId.get("orphanFlags")).toBe(0);
    expect(["D", "F"]).toContain(card.grade);
  });

  it("미선언 스위치 참조를 dangling 으로 지목한다", () => {
    const metrics = analyzeFlagLiteracy(badProject());
    expect(metrics.danglingSwitchRefs).toContain("S_ghost");
    expect(metrics.danglingVariableRefs).toEqual([]);
    expect(analyzeFlagLiteracy(goodProject()).danglingSwitchRefs).toEqual([]);
  });

  it("self-switch 사용을 별도로 집계한다", () => {
    const good = analyzeFlagLiteracy(goodProject());
    expect(good.selfSwitchWrites).toBeGreaterThan(0);
    expect(good.selfSwitchReads).toBeGreaterThan(0);
    expect(analyzeFlagLiteracy(badProject()).selfSwitchWrites).toBe(0);
  });

  it("변수 산술 op 와 비교 op 를 구분해 센다", () => {
    const good = analyzeFlagLiteracy(goodProject());
    expect(good.variableArithmeticWrites).toBeGreaterThan(0);
    expect(good.variableComparisonReads).toBeGreaterThan(0);
    const bad = analyzeFlagLiteracy(badProject());
    expect(bad.variableArithmeticWrites).toBe(0);
    expect(bad.variableComparisonReads).toBe(0);
  });

  it("기본 20슬롯 풀을 고아 플래그로 오판하지 않는다", () => {
    const blank = analyzeFlagLiteracy(createBlankProject());
    expect(blank.usedSwitchIds).toEqual([]);
    expect(blank.orphanFlagIds).toEqual([]);
  });

  it("모든 축이 근거와 유효 범위 점수를 남긴다", () => {
    for (const axis of scoreFlagLiteracy(goodProject()).axes) {
      expect(axis.detail.length).toBeGreaterThan(0);
      expect(axis.score).toBeGreaterThanOrEqual(0);
      expect(axis.score).toBeLessThanOrEqual(1);
    }
  });
});

describe("flag literacy 벤치마크 태스크", () => {
  it("복잡한 NPC/몬스터 태스크가 6개 이상이고 id 가 유일하다", () => {
    expect(FLAG_BENCH_TASKS.length).toBeGreaterThanOrEqual(6);
    expect(new Set(FLAG_BENCH_TASKS.map((task) => task.id)).size).toBe(FLAG_BENCH_TASKS.length);
  });

  it("각 태스크가 겨냥하는 축을 선언하고 프롬프트가 충분히 구체적이다", () => {
    const axisIds = new Set(FLAG_AXES.map((axis) => axis.id));
    for (const task of FLAG_BENCH_TASKS) {
      expect(task.axes.length).toBeGreaterThan(0);
      for (const axis of task.axes) expect(axisIds.has(axis)).toBe(true);
      expect(task.prompt.length).toBeGreaterThan(80);
      expect(task.title.length).toBeGreaterThan(0);
    }
  });

  it("태스크 초기 프로젝트는 lint error 없이 시작한다", () => {
    for (const task of FLAG_BENCH_TASKS) {
      const errors = projectLint(task.initialProject()).filter((issue) => issue.severity === "error");
      expect(errors, `${task.id}: ${errors.map((issue) => issue.message).join(" / ")}`).toHaveLength(0);
    }
  });

  it("태스크 전체가 9개 축을 모두 최소 한 번은 겨냥한다", () => {
    const covered = new Set(FLAG_BENCH_TASKS.flatMap((task) => task.axes));
    for (const axis of FLAG_AXES) expect(covered.has(axis.id), `축 미커버: ${axis.id}`).toBe(true);
  });
});
