// qa:game 자동 플레이가 「하루 한 번 만나 호감 +2 → 자고 다음 날」 을 되풀이해 호감 문턱 엔딩까지 가는지.
// 2026-09-24 연애 도그푸딩: 호감 ≥ 6 엔딩 셋이 전부 「변수 켜기 실패」 로 막힘 오판됐다(한 번 +2 로는 안 닿는다).
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { runGameCheck } from "@/qa/gameCheck";
import type { Project } from "@/project/types";

function romance(days: number): Project {
  const ctx: { project: Project } = { project: createBlankProject() };
  const room = ctx.project.startMapId;
  const { x, y } = ctx.project.startPos;
  const ok = (name: string, args: Record<string, unknown>) => { const r = runTool(ctx, name, args); expect(r.ok, `${name} ${r.summary}`).toBe(true); };
  ok("create_map", { id: "map_fest", name: "축제", width: 12, height: 10 });
  ok("upsert_event", { mapId: room, event: { id: "ev_love", x: x + 1, y, pages: [
    { trigger: { kind: "action" }, graphic: { transparent: true }, conditions: [{ kind: "switch", switchId: "sw_met", value: false }], commands: [{ kind: "choices", options: [
      { text: "무심하게", branch: [{ kind: "setVariable", variableId: "var_love", op: "-=", value: 1 }, { kind: "setSwitch", switchId: "sw_met", value: true }] },
      { text: "다정하게", branch: [{ kind: "setVariable", variableId: "var_love", op: "+=", value: 2 }, { kind: "setSwitch", switchId: "sw_met", value: true }] },
    ] }] },
    { trigger: { kind: "action" }, graphic: { transparent: true }, conditions: [{ kind: "switch", switchId: "sw_met", value: true }], commands: [{ kind: "text", body: "내일 봐." }] },
  ] } });
  ok("upsert_event", { mapId: room, event: { id: "ev_bed", x: x - 1, y, pages: [
    { trigger: { kind: "action" }, graphic: { transparent: true }, conditions: [], commands: [{ kind: "setVariable", variableId: "var_day", op: "+=", value: 1 }, { kind: "setSwitch", switchId: "sw_met", value: false }] },
    { trigger: { kind: "action" }, graphic: { transparent: true }, conditions: [{ kind: "variable", variableId: "var_day", op: ">=", value: days }], commands: [{ kind: "transfer", mapId: "map_fest", x: 5, y: 5 }] },
  ] } });
  ok("define_ending", { id: "ending_love", name: "고백", conditions: [] });
  ok("upsert_event", { mapId: "map_fest", event: { id: "ev_confess", x: 6, y: 5, pages: [
    { trigger: { kind: "action" }, graphic: { transparent: true }, conditions: [], commands: [{ kind: "text", body: "…미안." }] },
    { trigger: { kind: "action" }, graphic: { transparent: true }, conditions: [{ kind: "variable", variableId: "var_love", op: ">=", value: 6 }], commands: [{ kind: "triggerEnding", endingId: "ending_love" }] },
  ] } });
  return ctx.project;
}

describe("autoplay day cycles", () => {
  it("repeats the daily meeting and sleeps until the affection ending opens", () => {
    const run = runGameCheck(romance(4)).autoPlay!.runs[0]!;
    expect(run.ok, JSON.stringify(run.steps)).toBe(true);
    expect(run.endingReached).toBe("ending_love");
  });
  it("reports when the calendar is too short to reach the threshold", () => {
    const run = runGameCheck(romance(1)).autoPlay!.runs[0]!;
    expect(run.ok).toBe(false);
  });
});
