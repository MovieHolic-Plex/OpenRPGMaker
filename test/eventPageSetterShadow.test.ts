// 켜는 곳이 뒤 페이지 조건도 함께 켜서 앞 페이지가 영영 안 나오는 경우 — 2026-09-24 갤러리 호러 쓸쓸한 엔딩 소실.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";

function exitEvent(): Record<string, unknown> {
  return { id: "ev_exit", x: 3, y: 3, pages: [
    { trigger: { kind: "action" }, conditions: [], commands: [{ kind: "text", body: "굳어 있다." }] },
    { trigger: { kind: "action" }, conditions: [{ kind: "switch", switchId: "sw_gave_rose", value: true }], commands: [{ kind: "text", body: "혼자 나간다." }] },
    { trigger: { kind: "action" }, conditions: [{ kind: "switch", switchId: "sw_met_doll", value: true }], commands: [{ kind: "text", body: "함께 나간다." }] },
  ] };
}
function doll(branchGive: unknown[]): Record<string, unknown> {
  return { id: "ev_doll", x: 5, y: 5, pages: [{ trigger: { kind: "action" }, conditions: [], commands: [{ kind: "choices", prompt: "장미를?", options: [
    { text: "준다", branch: branchGive },
    { text: "거절", branch: [{ kind: "setSwitch", switchId: "sw_met_doll", value: true }] },
  ] }] }] };
}

describe("setter-shadowed event pages", () => {
  it("warns when every setter of an earlier page also opens a later page", () => {
    const ctx: { project: Project } = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    expect(runTool(ctx, "upsert_event", { mapId, event: exitEvent() }).ok).toBe(true);
    const result = runTool(ctx, "upsert_event", { mapId, event: doll([
      { kind: "setSwitch", switchId: "sw_gave_rose", value: true }, { kind: "setSwitch", switchId: "sw_met_doll", value: true },
    ]) });
    expect(result.ok, result.summary).toBe(true);
    expect(JSON.stringify(result)).toContain("페이지 2(sw_gave_rose)는 영영 실행되지 않습니다");
  });

  it("stays quiet when the give branch leaves the later switch off", () => {
    const ctx: { project: Project } = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    runTool(ctx, "upsert_event", { mapId, event: exitEvent() });
    const result = runTool(ctx, "upsert_event", { mapId, event: doll([{ kind: "setSwitch", switchId: "sw_gave_rose", value: true }]) });
    expect(result.ok).toBe(true);
    expect(JSON.stringify(result)).not.toContain("영영 실행되지 않습니다");
  });
});
