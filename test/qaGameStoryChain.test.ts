import { describe, expect, it } from "vitest";
import { runGameCheck } from "@/qa/gameCheck";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";

// 회상 스토리: 기억 1(시작 맵)의 메멘토 → 문 열림 → 기억 2(잠긴 맵)의 메멘토 → 엔딩.
// 기억 2 로 가는 문은 스위치 조건 페이지에만 있다 — 자동 플레이가 그 문을 여는 사슬을 스스로 세워야 한다.
function memoryChain() {
  const ctx = { project: createBlankProject() };
  const start = ctx.project.startMapId;
  expect(runTool(ctx, "create_map", { id: "map_memory_2", name: "두 번째 기억", width: 12, height: 10 }).ok).toBe(true);
  const [m1, gate, m2] = ctx.project.switches.slice(0, 3).map((entry) => entry.id) as [string, string, string];
  expect(runTool(ctx, "define_ending", { id: "ending_song", name: "마지막 소절", conditions: [] }).ok).toBe(true);
  const ok = (name: string, args: Record<string, unknown>) => { const r = runTool(ctx, name, args); expect(r.ok, r.summary).toBe(true); };
  ok("script_cutscene", { mapId: start, eventId: "ev_m1", x: 3, y: 3, beats: [{ kind: "say", text: "턴테이블" }, { kind: "switch", switchId: m1 }] });
  ok("script_cutscene", { mapId: start, eventId: "ev_gate", x: 8, y: 8, trigger: "auto", once: true, requiresSwitches: [m1], beats: [{ kind: "switch", switchId: gate }] });
  ok("script_cutscene", { mapId: start, eventId: "ev_door", x: 10, y: 3, requiresSwitches: [gate], beats: [{ kind: "transfer", mapId: "map_memory_2", x: 5, y: 5 }] });
  ok("script_cutscene", { mapId: "map_memory_2", eventId: "ev_m2", x: 2, y: 2, beats: [{ kind: "switch", switchId: m2 }] });
  ok("script_cutscene", { mapId: "map_memory_2", eventId: "ev_song", x: 8, y: 6, requiresSwitches: [m2], beats: [{ kind: "say", text: "자장가" }, { kind: "ending", endingId: "ending_song" }] });
  return deserialize(serialize(ctx.project));
}

describe("qa gameCheck — 잠긴 맵으로 이어지는 회상 사슬", () => {
  it("다음 기억으로 가는 문을 여는 선행 목표를 세워 엔딩까지 걷는다", () => {
    const report = runGameCheck(memoryChain(), { autoPlayBudgetMs: 20_000 });
    const run = report.autoPlay!.runs[0]!;
    expect(run.failure?.detail).toBeUndefined();
    expect(run.ok).toBe(true);
    expect(run.endingReached).toBe("ending_song");
    expect(report.findings.filter((f) => f.severity === "blocker").map((f) => f.code)).toEqual([]);
  });
});
