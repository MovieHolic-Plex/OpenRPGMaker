// 자료집 개요 「퀘스트」 표의 행 모델 — 등록 퀘스트와 제안을 한 목록으로, 상태·보상·이동 대상을 고정 프로젝트로 잰다.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import { pendingQuestCandidates, registerQuestCandidate } from "@/project/quest/questCandidates";
import { buildQuestTableRows, filterQuestTableRows, questTableCounts, resolveQuestJumpTarget } from "@/project/quest/questTable";
import type { GameEvent, Project } from "@/project/types";

const DIR = fileURLToPath(new URL("./fixtures/quest-candidates", import.meta.url));
type FixtureMap = { id: string; name: string; events: GameEvent[] };

function fixture(game: string): Project {
  const raw = JSON.parse(readFileSync(join(DIR, "projects", `${game}.json`), "utf8")) as { maps: Record<string, FixtureMap>; quests: Project["quests"] };
  const ctx = { project: createEmptyToolProject(game) };
  for (const map of Object.values(raw.maps)) {
    const width = Math.max(20, ...map.events.map((event) => event.x + 2));
    const height = Math.max(15, ...map.events.map((event) => event.y + 2));
    const result = runTool(ctx, "create_map", { name: map.name || map.id, width, height, id: map.id });
    if (!result.ok) throw new Error(result.summary);
  }
  for (const map of Object.values(raw.maps)) ctx.project.maps[map.id]!.events = map.events;
  ctx.project.quests = raw.quests;
  return ctx.project;
}

function event(id: string, x: number, commands: GameEvent["pages"][number]["commands"]): GameEvent {
  return {
    id, name: id, x, y: 3,
    pages: [{ id: `${id}_p0`, name: "0", conditions: [], graphic: { transparent: true }, trigger: { kind: "action" }, priority: "same", commands }],
  } as GameEvent;
}

/** 그래프 퀘스트 셋: 정상(시작·보고·보상), 보고 값을 켜는 이벤트가 사라진 것, 공용 이벤트에서만 진행하는 것. */
function graphProject(): Project {
  const ctx = { project: createEmptyToolProject("quest-table") };
  const made = runTool(ctx, "create_map", { name: "광장", width: 20, height: 15, id: "hub" });
  if (!made.ok) throw new Error(made.summary);
  const project = ctx.project;
  project.database.items.push({ id: "it_herb", name: "약초" } as Project["database"]["items"][number]);
  project.maps.hub!.events = [
    event("ev_baker", 2, [{ kind: "setSwitch", switchId: "sw_bread_on", value: true }]),
    event("ev_gate", 5, [
      { kind: "fork", condition: { kind: "switch", switchId: "sw_bread_on", value: true }, then: [
        { kind: "setSwitch", switchId: "sw_bread_done", value: true },
        { kind: "changeGold", op: "+=", amount: 120 },
        { kind: "changeItem", itemId: "it_herb", op: "+=", amount: 2 },
      ], else: [] },
    ]),
  ];
  project.commonEvents = [{ id: "ce_bell", name: "종소리", trigger: "none", commands: [{ kind: "setSwitch", switchId: "sw_bell_on", value: true }] }];
  const node = (id: string, switchId: string) => ({ id, description: id, completesWhen: { kind: "switch" as const, switchId, value: true } });
  project.quests = [
    { kind: "graph", id: "q_bread", title: "빵 나르기", nodes: [node("a", "sw_bread_on"), node("b", "sw_bread_done")], edges: [{ from: "a", to: "b" }] },
    { kind: "graph", id: "q_lost", title: "가 사라진 보고", nodes: [node("a", "sw_bread_on"), node("b", "sw_nobody_sets_this")], edges: [{ from: "a", to: "b" }] },
    { kind: "graph", id: "q_bell", title: "나 종소리", nodes: [node("a", "sw_bell_on")], edges: [] },
  ];
  return project;
}

describe("퀘스트 표 — 행 모델", () => {
  it("그래프 퀘스트의 시작·보고·보상·상태를 이벤트에서 찾는다", () => {
    const rows = buildQuestTableRows(graphProject());
    const summary = rows.map((row) => ({
      id: row.id,
      status: row.status,
      giver: row.giver?.eventId ?? null,
      turnIn: row.turnIn?.eventId ?? null,
      giverJump: row.giverJump.ok ? row.giverJump.eventId : row.giverJump.reason,
      turnInJump: row.turnInJump.ok ? `${row.turnInJump.mapId}/${row.turnInJump.eventId}@${row.turnInJump.x},${row.turnInJump.y}` : row.turnInJump.reason,
      reward: row.reward,
    }));
    expect(summary).toEqual([
      {
        id: "q_lost", status: "unreachable", giver: "ev_baker", turnIn: null,
        giverJump: "ev_baker", turnInJump: "진행 값 sw_nobody_sets_this 을(를) 켜는 이벤트가 없습니다", reward: null,
      },
      {
        id: "q_bell", status: "registered", giver: null, turnIn: null,
        giverJump: "공용 이벤트 「종소리」에서 진행합니다 — 맵 위치가 없습니다",
        turnInJump: "공용 이벤트 「종소리」에서 진행합니다 — 맵 위치가 없습니다", reward: null,
      },
      {
        id: "q_bread", status: "registered", giver: "ev_baker", turnIn: "ev_gate",
        giverJump: "ev_baker", turnInJump: "hub/ev_gate@5,3",
        reward: { gold: 120, items: [{ itemId: "it_herb", name: "약초", count: 2 }] },
      },
    ]);
  });

  it("같은 보상을 두 페이지에 갈래로 두면 한 번만 센다", () => {
    const project = graphProject();
    const gate = project.maps.hub!.events.find((entry) => entry.id === "ev_gate")!;
    gate.pages = [gate.pages[0]!, { ...gate.pages[0]!, id: "ev_gate_p1" }];
    const row = buildQuestTableRows(project).find((entry) => entry.id === "q_bread")!;
    expect(row.reward).toEqual({ gold: 120, items: [{ itemId: "it_herb", name: "약초", count: 2 }] });
  });

  it("Terra 고양이 게임: 퀘스트 0개면 제안 한 행, 등록하면 같은 자리의 등록 행 하나", () => {
    const project = fixture("L6__L__fun-cat-1");
    const before = buildQuestTableRows(project);
    expect(before.map((row) => [row.status, row.title, row.giver?.eventId, row.turnIn?.eventId, row.giverJump.ok, row.turnInJump.ok, row.registrable]))
      .toEqual([["suggested", "도토리의 부탁", before[0]!.candidate!.giver.eventId, before[0]!.candidate!.turnIn.eventId, true, true, true]]);
    expect(before[0]!.confidence).toBe(pendingQuestCandidates(project)[0]!.confidence);

    registerQuestCandidate(project, before[0]!.candidate!);
    const after = buildQuestTableRows(project);
    expect(after.map((row) => [row.status, row.id, row.giverJump.ok, row.turnInJump.ok])).toEqual([["registered", before[0]!.candidate!.id, true, true]]);
    expect(questTableCounts(after)).toEqual({ registered: 1, suggested: 0, unreachable: 0 });
  });

  it("거르기: 등록됨은 닿지 않음까지, 제안은 제안만", () => {
    const project = graphProject();
    const rows = buildQuestTableRows(project);
    expect(filterQuestTableRows(rows, "registered").map((row) => row.id)).toEqual(["q_lost", "q_bell", "q_bread"]);
    expect(filterQuestTableRows(rows, "suggested")).toEqual([]);
    expect(filterQuestTableRows(rows, "all")).toHaveLength(3);
  });
});

describe("퀘스트 표 — 이동 대상", () => {
  it("맵이나 이벤트가 없으면 이유와 함께 막는다", () => {
    const project = graphProject();
    expect(resolveQuestJumpTarget(project, { mapId: "hub", eventId: "ev_gate", mapName: "광장", eventName: "ev_gate" }))
      .toEqual({ ok: true, mapId: "hub", eventId: "ev_gate", x: 5, y: 3 });
    expect(resolveQuestJumpTarget(project, { mapId: "gone", eventId: "ev_gate", mapName: "gone", eventName: "ev_gate" }))
      .toEqual({ ok: false, reason: "맵 gone 이(가) 프로젝트에 없습니다" });
    expect(resolveQuestJumpTarget(project, { mapId: "hub", eventId: "ev_gone", mapName: "광장", eventName: "ev_gone" }))
      .toEqual({ ok: false, reason: "맵 「광장」에 이벤트 ev_gone 이(가) 없습니다" });
    expect(resolveQuestJumpTarget(project, null, "x")).toEqual({ ok: false, reason: "x" });
  });

  it("단계 퀘스트의 부탁 이벤트가 지워지면 닿지 않음으로 분류한다", () => {
    const project = graphProject();
    project.quests = [{ key: "q_step", title: "단계", summary: "", giver: { mapId: "hub", eventId: "ev_deleted" }, steps: [], rewards: { gold: 50 } }];
    const [row] = buildQuestTableRows(project);
    expect([row!.status, row!.giverJump.ok, row!.turnInJump.ok, row!.reward]).toEqual(["unreachable", false, false, { gold: 50, items: [] }]);
  });
});
