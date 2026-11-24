// @vitest-environment happy-dom
// 작업 스트림(목업 v4, qa1124): 실행기 이벤트열 리플레이 → 조수별 레인·도구 줄·할 일·끝 화면. 지어낸 진행률·문장이 없어야 한다.
import { describe, expect, it } from "vitest";
import type { PiAgentEvent } from "@/ai/piAgent/protocol";
import { createAiLiveStatus } from "@/editor/panels/aiLiveStatus";
import { createAiRunStream } from "@/editor/panels/aiRunStream";
import { createRunTimeline, summarizeToolArgs } from "@/editor/panels/aiRunTimeline";
import type { Project } from "@/project/types";

const at = (ms: number) => ({ at: 1_000_000 + ms });
const wrap = (agentId: string, event: PiAgentEvent): PiAgentEvent => ({ type: "agent_event", agentId, event });

/** piTeamRuntime 이 내는 순서 그대로: team_start → 팀장 도구 → agent_spawn ×2 → 일꾼 이벤트 → agent_done → done. */
function teamFirstBuild(): PiAgentEvent[] {
  return [
    { type: "team_start", task: "회상 게임", roles: [], ...at(0) },
    { type: "tool_start", id: "o1", name: "assign_map_agent", args: { mapId: "m2", task: "바닷가 포구" }, ...at(100) },
    { type: "tool_end", id: "o1", name: "assign_map_agent", ok: true, summary: "시공 1 → 바닷가 포구", ...at(200) },
    { type: "agent_spawn", agentId: "builder-1", role: "builder", mapId: "m2", mapName: "바닷가 포구", task: "마을", ...at(210) },
    { type: "agent_spawn", agentId: "builder-2", role: "builder", mapId: "m3", mapName: "등대 안", task: "실내", ...at(220) },
    wrap("builder-1", { type: "tool_start", id: "b1", name: "author_beodeul_town", args: { mapId: "m2", name: "바닷가 포구", theme: "coast", houseCount: 4, width: 44, height: 36 }, ...at(300) }),
    wrap("builder-2", { type: "delta", kind: "text", text: "등대 안은 1층 거실 하나로 짓겠습니다.", ...at(320) }),
    wrap("builder-2", { type: "delta", kind: "thinking", text: "internal reasoning", ...at(330) }),
    wrap("builder-1", { type: "tool_end", id: "b1", name: "author_beodeul_town", ok: true, summary: "새 맵 44×36 · 집 4 · 다리 1", durationMs: 1400, ...at(1700) }),
    wrap("builder-1", { type: "map_delta", maps: [{ mapId: "m2", layers: [{ layer: "lower", cells: Array.from({ length: 1584 }, (_, i) => ({ i, t: 1 })) }] }] as never, ...at(1710) }),
    wrap("builder-1", { type: "checkpoint", checkpointId: "c1", constructionLogs: [{ mapId: "m2", width: 44, height: 36, toolName: "author_beodeul_town", elapsedMs: 1400, planClasses: {}, steps: [{ kind: "paint", label: "바닥", cells: [1] }] }] } as never),
    wrap("builder-1", { type: "tool_start", id: "b2", name: "get_map_region", args: { mapId: "m2" }, ...at(1800) }),
    wrap("builder-1", { type: "tool_end", id: "b2", name: "get_map_region", ok: true, summary: "읽음", ...at(1810) }),
    { type: "agent_done", agentId: "builder-1", ok: true, summary: "마을을 지었다", stats: {} as never, changedKeys: [], spills: [], conflicts: [], ...at(2000) },
  ];
}

describe("createRunTimeline (event replay)", () => {
  it("builds one lane per assistant with real args, raw tool name, result text, duration and changed cells", () => {
    const timeline = createRunTimeline({ now: () => 1_000_000 });
    for (const event of teamFirstBuild()) timeline.apply(event);
    const snap = timeline.snapshot();
    expect(snap.team).toBe(true);
    expect(snap.lanes.map((lane) => [lane.title, lane.rawName, lane.mapName])).toEqual([["팀장", "orchestrator", null], ["시공 1", "builder-1", "바닷가 포구"], ["시공 2", "builder-2", "등대 안"]]);
    const town = snap.rows.find((row) => row.name === "author_beodeul_town")!;
    expect(town).toMatchObject({ laneId: "builder-1", state: "done", durationMs: 1400, result: "새 맵 44×36 · 집 4 · 다리 1", changedCells: 1584, realMs: 1400 });
    expect(town.args).toBe("width×height: 44×36 · mapId: m2 · name: 바닷가 포구 · theme: coast · houseCount: 4");
    expect(snap.rows.find((row) => row.name === "get_map_region")?.quiet).toBe(true);
  });

  it("shows only model text the runner actually sent — thinking is not shown", () => {
    const timeline = createRunTimeline();
    for (const event of teamFirstBuild()) timeline.apply(event);
    const lane = timeline.snapshot().lanes.find((l) => l.id === "builder-2")!;
    expect(lane.text).toBe("등대 안은 1층 거실 하나로 짓겠습니다.");
    expect(timeline.snapshot().lanes.find((l) => l.id === "builder-1")!.text).toBe("");
  });

  it("releases the map owner when the worker is done and keeps the running worker's map", () => {
    const timeline = createRunTimeline();
    for (const event of teamFirstBuild()) timeline.apply(event);
    expect(timeline.snapshot().mapOwners).toEqual({ m3: "builder-2" });
  });

  it("keeps the model's todo list as written and follows its start/done", () => {
    const timeline = createRunTimeline();
    timeline.apply({ type: "tool_start", id: "t", name: "todo", args: { op: "init", list: [{ phase: "장소", items: [{ content: "바닷가 포구" }, { content: "등대 안" }] }] } });
    timeline.apply({ type: "tool_start", id: "t2", name: "todo", args: { op: "start", task: "t1" } });
    timeline.apply({ type: "tool_start", id: "t3", name: "todo", args: { op: "done", task: "바닷가 포구" } });
    timeline.apply({ type: "tool_start", id: "t4", name: "todo", args: { op: "start", task: "t2" } });
    expect(timeline.snapshot().todos.map((t) => [t.text, t.state])).toEqual([["바닷가 포구", "done"], ["등대 안", "now"]]);
    expect(timeline.snapshot().rows).toEqual([]);
  });

  it("running rows carry no invented result or progress", () => {
    const timeline = createRunTimeline();
    timeline.apply({ type: "tool_start", id: "x", name: "make_place", args: { type: "village" } });
    const row = timeline.snapshot().rows[0]!;
    expect(row.state).toBe("running");
    expect(row.result).toBeUndefined();
    expect(row.durationMs).toBeUndefined();
  });

  it("summarizes args without rewriting values", () => {
    expect(summarizeToolArgs({ objectId: "kit:beodeul_city/성당", x: 1, y: 15, layer: "upper", cells: [1, 2, 3] })).toBe("objectId: kit:beodeul_city/성당 · x: 1 · y: 15 · layer: upper · cells: 3개");
  });
});

describe("createAiRunStream", () => {
  const base = { maps: {} } as unknown as Project;

  it("ends a first MVP build with «MVP까지 만들었어요» and never leaves the opening line behind", () => {
    const stream = createAiRunStream({ live: createAiLiveStatus({ baseProject: base }), team: true, firstMvp: true });
    stream.status("요청을 읽고 있어요");
    for (const event of teamFirstBuild()) stream.event(event);
    stream.event({ type: "done", project: base, stats: {} as never, changedKeys: [] });
    stream.finish(true);
    const text = stream.root.textContent ?? "";
    expect(stream.root.querySelector("[data-testid=ai-run-stream-end]")?.textContent).toContain("MVP까지 만들었어요");
    expect(stream.root.querySelector("[data-testid=ai-live-status-line]")?.textContent).not.toContain("요청을 읽고 있어요");
    expect(text).toContain("author_beodeul_town");
    expect(text).toContain("마을 짓기");
    expect(text).not.toMatch(/%|진행률/u);
  });

  it("says it stopped when the runner stopped early instead of claiming the MVP", () => {
    const stream = createAiRunStream({ live: createAiLiveStatus({ baseProject: base }), firstMvp: true });
    stream.event({ type: "done", project: base, stats: {} as never, changedKeys: [], stoppedEarly: "사용 한도" });
    stream.finish(true);
    const end = stream.root.querySelector("[data-testid=ai-run-stream-end]")?.textContent ?? "";
    expect(end).toContain("도중에 멈췄어요");
    expect(end).not.toContain("MVP까지");
  });
});
