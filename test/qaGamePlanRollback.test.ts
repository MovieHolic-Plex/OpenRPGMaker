// 자동 플레이 계획: 문 후보 하나가 중간에 실패하면 그 시도가 남긴 선행 표식(planned·unresolved)도
// 함께 되돌아야 한다. goals 만 되돌리면 다음 후보는 «이미 계획됨」으로 건너뛰고 실제 세터 목표 없이
// 계획이 끝나, 런타임의 문이 (현재 스위치 상태로는) 열리지 않는다
// (2026-09-24 감성 스토리 r3: 계획 5단·유령 preamble 24건·자동 플레이「recordshop → busstop_v3 문 없음」).
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { runGameCheck } from "@/qa/gameCheck";
import type { Project } from "@/project/types";

function decoyDoorChain() {
  const ctx: { project: Project } = { project: createBlankProject() };
  const start = ctx.project.startMapId;
  const { x, y } = ctx.project.startPos;
  const ok = (name: string, args: Record<string, unknown>) => {
    const r = runTool(ctx, name, args);
    expect(r.ok, `${name}: ${r.summary}`).toBe(true);
  };
  ok("create_map", { id: "map_orphan", name: "못 가는 폐가", width: 12, height: 10 });
  ok("create_map", { id: "map_hall", name: "마당", width: 12, height: 10 });
  ok("create_map", { id: "map_goal", name: "기억의 방", width: 12, height: 10 });
  const [swX, swY] = ctx.project.switches.slice(0, 2).map((entry) => entry.id);
  ok("define_ending", { id: "ending_decoy", name: "끝", conditions: [] });
  ok("upsert_event", { mapId: start, event: { id: "ev_set_x", x: x + 1, y, pages: [{ trigger: { kind: "action" }, conditions: [], commands: [{ kind: "setSwitch", switchId: swX, value: true }] }] } });
  ok("upsert_event", { mapId: start, event: { id: "ev_set_y", x: x + 1, y: y + 1, pages: [{ trigger: { kind: "action" }, conditions: [], commands: [{ kind: "setSwitch", switchId: swY, value: true }] }] } });
  ok("upsert_event", { mapId: start, event: { id: "ev_free", x: x - 2, y, pages: [{ trigger: { kind: "playerTouch" }, conditions: [], commands: [{ kind: "transfer", mapId: "map_hall", x: 5, y: 5 }] }] } });
  // 들어오는 문이 하나도 없는 고아 맵의 문 — 선행 조건 수가 같아 계획이 이 문을 먼저 시도한다.
  ok("upsert_event", { mapId: "map_orphan", event: { id: "ev_decoy", x: 5, y: 3, pages: [
    { trigger: { kind: "action" }, conditions: [], commands: [{ kind: "text", body: "못 가는 문" }] },
    { trigger: { kind: "playerTouch" }, conditions: [{ kind: "switch", switchId: swX, value: true }], commands: [{ kind: "transfer", mapId: "map_goal", x: 5, y: 5 }] },
  ] } });
  // 진짜 길: swX + swY 를 기다린다. 계획은 swX setter 목표까지 되돌려 잃으면 런타임에서 못 연다.
  ok("upsert_event", { mapId: "map_hall", event: { id: "ev_real", x: 7, y: 5, pages: [
    { trigger: { kind: "action" }, conditions: [], commands: [{ kind: "text", body: "잠겨 있다." }] },
    { trigger: { kind: "playerTouch" }, conditions: [{ kind: "switch", switchId: swX, value: true }, { kind: "switch", switchId: swY, value: true }], commands: [{ kind: "transfer", mapId: "map_goal", x: 5, y: 5 }] },
  ] } });
  ok("upsert_event", { mapId: "map_goal", event: { id: "ev_end", x: 7, y: 5, pages: [{ trigger: { kind: "action" }, conditions: [], commands: [{ kind: "triggerEnding", endingId: "ending_decoy" }] }] } });
  return { project: deserialize(serialize(ctx.project)), swX: swX!, swY: swY! };
}

describe("qa gameCheck — 실패한 문 후보의 계획 흔적 되돌리기", () => {
  it("고아 맵 문 후보가 실패해도 세터 목표는 남고 유령 preamble 가 없다", () => {
    const { project, swX } = decoyDoorChain();
    const report = runGameCheck(project, { autoPlayBudgetMs: 20_000 });
    const run = report.autoPlay!.runs[0]!;
    expect(run.ok, JSON.stringify(run.steps)).toBe(true);
    expect(run.endingReached).toBe("ending_decoy");
    // swX setter 는 고아 문 시도에서 계획됐다가 되돌려진 뒤, 진짜 문 후보에서 다시 계획되어야 한다.
    expect(report.autoPlay!.plan.join(" ")).toContain(swX);
    // 실패한 후보의 «찾지 못했습니다» 는 후보가 바뀐 순간 사라져야 한다(유령 preamble 금지).
    expect(run.steps.filter((step) => step.goal === "계획")).toEqual([]);
  });
});
