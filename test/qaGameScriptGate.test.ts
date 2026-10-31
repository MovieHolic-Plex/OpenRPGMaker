// qa:game 자동 플레이가 스크립트가 정하는 진행을 «막힘»으로 내지 않는지.
// 2026-10-31 script-ab sab-1031 A 마을: 「평판 ≥ 10 → 촌장 엔딩」의 선행 스위치를 할머니 스크립트가 «약초 세 포기를 가졌으면» 켠다.
// 실제 플레이로는 엔딩까지 가는데 계획기가 스크립트 안의 아이템 조건을 몰라 막힘으로 나왔다.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { runGameCheck } from "@/qa/gameCheck";
import { scriptGatedFailure } from "@/qa/gameCheck/scriptGate";
import type { Project } from "@/project/types";

const SOURCE = "if (game.itemCount('item_herb') >= 3) { game.removeItem('item_herb', 3); game.setSwitch('sw_reward', true); }";

function villageGame(withScript: boolean): Project {
  const ctx: { project: Project } = { project: createBlankProject() };
  const mapId = ctx.project.startMapId;
  const { x, y } = ctx.project.startPos;
  const ok = (name: string, args: Record<string, unknown>) => { const r = runTool(ctx, name, args); expect(r.ok, `${name} ${r.summary}`).toBe(true); };
  ctx.project.switches.push({ id: "sw_reward", name: "보상 받음" } as never);
  ok("define_ending", { id: "ending_hero", name: "마을의 은인", conditions: [] });
  ok("upsert_event", { mapId, event: { id: "ev_grandma", name: "할머니", x: x + 1, y, pages: [{ trigger: { kind: "action" }, conditions: [], commands: [{ kind: "text", body: "고맙구나." }] }] } });
  ok("upsert_event", { mapId, event: { id: "ev_chief", name: "촌장", x: x - 1, y, pages: [
    { trigger: { kind: "action" }, conditions: [], commands: [{ kind: "text", body: "누구신가?" }] },
    { trigger: { kind: "action" }, conditions: [{ kind: "switch", switchId: "sw_reward", value: true }], commands: [{ kind: "triggerEnding", endingId: "ending_hero" }] },
  ] } });
  if (withScript) {
    const grandma = ctx.project.maps[mapId]!.events.find((event) => event.id === "ev_grandma")!;
    grandma.pages[0]!.commands = [{
      kind: "script", name: "약초 의뢰", source: SOURCE, compiled: SOURCE, sourceHash: "test", apiVersion: 1,
      effects: { reads: [{ kind: "item", id: "item_herb" }], writes: [{ kind: "item", id: "item_herb" }, { kind: "switch", id: "sw_reward" }], calls: [], dynamic: [] },
    } as never];
  }
  return ctx.project;
}

describe("qa:game script-gated progress", () => {
  it("reports a script-gated ending as unknown (info), not blocked", () => {
    const report = runGameCheck(villageGame(true));
    const failed = report.autoPlay?.runs.some((run) => !run.ok);
    if (failed) {
      expect(report.findings.some((f) => f.code === "autoplay-failed")).toBe(false);
      expect(report.findings.some((f) => f.code === "autoplay-script-gated" && f.severity === "info")).toBe(true);
    }
    expect(report.findings.filter((f) => f.code.startsWith("autoplay")).every((f) => f.severity !== "blocker")).toBe(true);
  });

  it("finds the script writer through the switch the ending page reads", () => {
    const project = villageGame(true);
    const gate = scriptGatedFailure(project, { mapId: project.startMapId, eventId: "ev_chief" }, "이벤트는 돌았지만 목표가 충족되지 않았습니다");
    expect(gate?.keys.join(" ")).toContain("보상 받음");
  });

  it("leaves games without scripts alone", () => {
    const project = villageGame(false);
    expect(scriptGatedFailure(project, { mapId: project.startMapId, eventId: "ev_chief" }, "이벤트는 돌았지만 목표가 충족되지 않았습니다")).toBeUndefined();
    expect(runGameCheck(project).findings.some((f) => f.code === "autoplay-failed" && f.severity === "blocker")).toBe(true);
  });
});
