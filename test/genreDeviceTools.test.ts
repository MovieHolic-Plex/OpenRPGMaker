import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { runCheck } from "@/harnesses/assistant-capability/node/smallJobs/checks";
import { buildFixture, type FixtureId } from "@/harnesses/assistant-capability/node/smallJobs/fixtures";
import { applyCalls, type SmallJob } from "@/harnesses/assistant-capability/node/smallJobs/suite";
import { effectiveFieldHud, normalizeFieldHud, resolvedHudWidgets } from "@/project/fieldHud";
import type { Command } from "@/project/types";

// 좁은 장치 도구 넷(호감 · 가진 물건 내밀기 · 제한 시간 · 화면 게이지) — 이벤트 명령을 손으로 조립하던 장치를 한 호출로.
// 2026-11-11 셋째 묶음 Terra 기준선: 선물 36호출 · 고백 32 · 내밀기 27. 판정은 그 묶음의 기계 검사(결과만 본다)를 그대로 쓴다.

const JOBS = (JSON.parse(readFileSync("harness-data/assistant-capability/small-jobs-3.json", "utf8")) as { jobs: SmallJob[] }).jobs;
const NARROW = JOBS.flatMap((job) => (job.accept ?? []).filter((way) => way.note.startsWith("좁은 도구 한 호출")).map((way) => [job.id, job, way.calls] as const));
const V = "map_ember_village", INN = "ev_ember_inn", GUARD = "ev_ember_guard", FIELD = "map_blank_start";
const starter = (): ToolContext => ({ project: buildFixture("starter") });
const commandsOf = (ctx: ToolContext, eventId: string): Command[] => ctx.project.maps[V]!.events.find((event) => event.id === eventId)!.pages![0]!.commands;
const kinds = (commands: readonly Command[]): string[] => commands.map((command) => (command.kind === "label" ? `label:${command.name}` : command.kind));
const bare = (commands: readonly Command[]) => commands.map((command) => { const { id: _id, ...rest } = command as Command & { id?: string }; return rest; });

describe("좁은 도구 한 호출이 그 일의 판정을 통과한다", () => {
  it("일곱 가지 일에 그 풀이가 적혀 있다", () => {
    // Break: 묶음에서 풀이가 빠지면 아래 표가 비어 조용히 통과한다.
    expect(NARROW.map(([id]) => id).sort()).toEqual(["affection-grows-starter", "affection-two-pages-built", "confess-ending-starter", "evidence-present-starter", "gift-affection-starter", "hunger-hud-starter", "time-limit-starter"]);
  });
  it.each(NARROW)("%s", (_id, job, calls) => {
    const fixture = buildFixture(job.fixture as FixtureId);
    const verdict = runCheck(job.check, job.allow, fixture, applyCalls(fixture, calls));
    expect(verdict.pass, verdict.reason).toBe(true);
  }, 60_000);
});

describe("set_npc_affection", () => {
  it("있던 명령은 뒤에 그대로 두고, 다시 부르면 호감 토막만 갈아 끼운다", () => {
    const ctx = starter();
    const old = bare(commandsOf(ctx, INN));
    expect(runTool(ctx, "set_npc_affection", { mapId: V, eventId: INN, talkGain: 1, milestones: [{ atLeast: 3, lines: ["차"] }] }).ok).toBe(true);
    const once = kinds(commandsOf(ctx, INN));
    expect(once).toEqual(["label:affection:begin", "changeFriendship", "fork", "label:affection:end", ...kinds(old as Command[])]);
    // Break: 표시가 없으면 두 번째 호출이 토막을 하나 더 쌓아 말을 걸 때마다 호감이 두 번 오른다.
    expect(runTool(ctx, "set_npc_affection", { mapId: V, eventId: INN, talkGain: 2, milestones: [{ atLeast: 5, lines: ["케이크"] }] }).ok).toBe(true);
    const twice = commandsOf(ctx, INN);
    expect(kinds(twice)).toEqual(once);
    expect(twice.find((command) => command.kind === "changeFriendship")).toMatchObject({ delta: 2 });
    expect(JSON.stringify(twice)).toContain("케이크");
    expect(JSON.stringify(twice)).not.toContain("\"차\"");
    expect(bare(twice.slice(-old.length))).toEqual(old);
  });

  it("호감 열쇠를 돌려준다 — 다른 이벤트가 같은 열쇠로 읽는다", () => {
    const ctx = starter();
    const result = runTool(ctx, "set_npc_affection", { mapId: V, eventId: INN, npcKey: "masa", talkGain: 1 });
    expect(result.data).toMatchObject({ npcKey: "masa", condition: { kind: "friendshipAtLeast", npcKey: "masa" } });
    expect(commandsOf(ctx, INN).find((command) => command.kind === "changeFriendship")).toMatchObject({ npcKey: "masa" });
  });

  it("없는 아이템 · 없는 엔딩 · 빈 호출은 거절하고 아무것도 바꾸지 않는다", () => {
    const ctx = starter();
    const before = JSON.stringify(ctx.project);
    const bad = [
      runTool(ctx, "set_npc_affection", { mapId: V, eventId: INN, gifts: [{ itemId: "없는 물건", gain: 2 }] }),
      runTool(ctx, "set_npc_affection", { mapId: V, eventId: INN }),
      runTool(ctx, "set_npc_affection", { mapId: V, eventId: INN, talkGain: 1, confess: { atLeast: 3, endingId: "ending_nope" } }),
      runTool(ctx, "set_npc_affection", { mapId: V, eventId: "ev_nope", talkGain: 1 }),
    ];
    expect(bad.map((result) => result.ok)).toEqual([false, false, false, false]);
    // 고칠 길(먼저 부를 도구)이 글의 앞쪽에 있다 — 실행기가 200자에서 자른다. Break(첫 판): 아이템 목록 뒤에 적어 «upsert_item 으로 먼저 만들라»가 잘려 나갔다.
    expect(bad[0]!.summary).toContain("upsert_item");
    expect(bad[2]!.summary).toContain("define_ending");
    expect(JSON.stringify(ctx.project)).toBe(before);
  });
});

describe("set_present_reactions", () => {
  it("평소 말 뒤에 붙고, 다시 부르면 하나만 남는다 · 스위치를 등록한다", () => {
    const ctx = starter();
    const n = commandsOf(ctx, GUARD).length;
    expect(runTool(ctx, "set_present_reactions", { mapId: V, eventId: GUARD, reactions: [{ itemId: "낡은 열쇠", lines: ["a"], switchId: "sw_confessed" }], otherLines: ["b"] }).ok).toBe(true);
    expect(runTool(ctx, "set_present_reactions", { mapId: V, eventId: GUARD, reactions: [{ itemId: "item_old_key", lines: ["c"] }], otherLines: ["d"] }).ok).toBe(true);
    const commands = commandsOf(ctx, GUARD);
    expect(commands).toHaveLength(n + 3);
    expect(kinds(commands).slice(-3)).toEqual(["label:present:begin", "presentItem", "label:present:end"]);
    expect(ctx.project.switches.some((entry) => entry.id === "sw_confessed")).toBe(true);
  });

  it("없는 아이템은 거절하고 아무것도 바꾸지 않는다", () => {
    const ctx = starter();
    const before = JSON.stringify(ctx.project);
    expect(runTool(ctx, "set_present_reactions", { mapId: V, eventId: GUARD, reactions: [{ itemId: "없는 물건", lines: ["?"] }] }).ok).toBe(false);
    expect(JSON.stringify(ctx.project)).toBe(before);
  });
});

describe("set_time_limit", () => {
  it("다시 부르면 새로 짓는다(이벤트 둘 그대로) · 멈춤 스위치는 타이머를 세우는 페이지가 된다", () => {
    const ctx = starter();
    const n = ctx.project.maps[FIELD]!.events.length;
    expect(runTool(ctx, "set_time_limit", { mapId: FIELD, seconds: 30 }).ok).toBe(true);
    expect(runTool(ctx, "set_time_limit", { mapId: FIELD, seconds: 45, stopSwitchId: "sw_found_key" }).ok).toBe(true);
    const events = ctx.project.maps[FIELD]!.events;
    expect(events).toHaveLength(n + 2);
    const start = events.find((event) => event.id.endsWith("_start"))!, end = events.find((event) => event.id.endsWith("_end"))!;
    expect(start.pages![0]!.commands[0]).toMatchObject({ kind: "timer", action: "set", seconds: 45 });
    expect(end.pages).toHaveLength(2);
    expect(end.pages![1]!.commands[0]).toMatchObject({ kind: "timer", action: "stop" });
    // Break: 두 진행 이벤트가 같은 칸이거나 다른 이벤트 위에 서면 편집기에서 겹쳐 보이지 않는다.
    expect(`${start.x},${start.y}`).not.toBe(`${end.x},${end.y}`);
    expect(events.filter((event) => event.x === start.x && event.y === start.y)).toHaveLength(1);
  });

  it("없는 엔딩은 거절하고 아무것도 바꾸지 않는다", () => {
    const ctx = starter();
    const before = JSON.stringify(ctx.project);
    const result = runTool(ctx, "set_time_limit", { mapId: FIELD, seconds: 30, endingId: "ending_nope" });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("define_ending");
    expect(JSON.stringify(ctx.project)).toBe(before);
  });
});

describe("add_hud_gauge", () => {
  it("화면에 뜨던 HUD 는 그대로 두고 게이지 하나를 더한다 · 같은 이름으로 다시 부르면 그 게이지를 고친다", () => {
    const ctx = starter();
    const shown = resolvedHudWidgets(normalizeFieldHud(effectiveFieldHud(ctx.project) ?? ctx.project.system.fieldHud)).map((widget) => widget.id);
    expect(runTool(ctx, "add_hud_gauge", { label: "배고픔", initial: 100 }).ok).toBe(true);
    expect(runTool(ctx, "add_hud_gauge", { label: "배고픔", initial: 80, max: 120 }).ok).toBe(true);
    const widgets = ctx.project.system.fieldHud!.widgets!;
    // Break: widgets 를 [게이지] 로만 쓰면 프리셋 HUD(체력 · 시계 · 도구)가 통째로 사라진다.
    expect(shown.filter((id) => !widgets.some((widget) => widget.id === id))).toEqual([]);
    const gauges = widgets.filter((widget) => widget.source === "variable");
    expect(gauges).toHaveLength(1);
    expect(gauges[0]).toMatchObject({ label: "배고픔", max: 120 });
    expect(ctx.project.session.variables[gauges[0]!.variableId!]).toBe(80);
  });

  it("둘째 게이지는 같은 모서리의 첫째 아래에 놓인다", () => {
    const ctx = starter();
    runTool(ctx, "add_hud_gauge", { label: "배고픔", initial: 100 });
    expect(runTool(ctx, "add_hud_gauge", { label: "산소", initial: 50 }).ok).toBe(true);
    const [first, second] = ctx.project.system.fieldHud!.widgets!.filter((widget) => widget.source === "variable");
    expect(second!.anchor).toBe(first!.anchor);
    expect(second!.y).toBeGreaterThanOrEqual(first!.y + first!.height);
  });
});
