import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { createBuildRun } from "@/ai/v2/buildRun";
import { buildEvent } from "@/ai/v2/events";
import { fallenTierTools } from "@/ai/v2/game";
import type { Project } from "@/project/types";

// 2026-10-25 장난감 가게 고치기 2턴: after 장면이 늘 0번(낮) 페이지 끝에 붙고 「장면 뒤」 페이지가 맨 끝에 놓여 밤 페이지를 가렸다.
function page(id: string, line: string, conditions: unknown[] = []) {
  return { id, name: id, conditions, graphic: { kind: "none" }, trigger: { kind: "action" }, priority: "same", movement: { kind: "fixed" }, commands: [{ kind: "text", body: line }] };
}
function setup() {
  const project = createBlankProject() as Project;
  const mapId = project.startMapId!;
  const map = project.maps[mapId]!;
  (map.events as unknown[]).push({ id: "ev_clara", name: "클라라", x: 3, y: 3, trigger: { kind: "action" }, graphic: { kind: "none" }, priority: "same", movement: { kind: "fixed" }, commands: [], pages: [page("day", "낮 인사"), page("night", "밤 추억", [{ kind: "switch", switchId: "sw_0001", value: true }])] });
  return { project, mapId, run: createBuildRun({ project, currentMapId: mapId }) };
}
const spec = (mapId: string, extra: Record<string, unknown> = {}) => ({ kind: "cutscene", mapId, after: "클라라", beats: [{ do: "say", who: "클라라", text: "그날 밤을 기억해?" }], ...extra }) as never;
const clara = (p: Project, mapId: string) => (p.maps[mapId]!.events ?? []).find((e) => e.id === "ev_clara")!;

describe("v2 add_event after: page choice", () => {
  it("does not attach when the NPC has several talk pages and no afterPage", () => {
    const { run, mapId } = setup();
    const r = buildEvent(run, spec(mapId));
    expect(r.ok).toBe(false);
    expect(r.summary).toContain("afterPage");
    expect(r.summary).toContain("밤 추억");
    const ev = clara(run.ctx.project, mapId);
    expect(ev.pages.map((p) => p.id)).toEqual(["day", "night"]);
    expect(JSON.stringify(ev)).not.toContain("그날 밤을 기억해?");
  });
  it("attaches to the chosen page and keeps later pages winning", () => {
    const { run, mapId } = setup();
    buildEvent(run, spec(mapId, { afterPage: 0 }));
    const ev = clara(run.ctx.project, mapId);
    expect(ev.pages.length).toBe(3);
    expect(JSON.stringify(ev.pages[0]!.commands)).toContain("그날 밤을 기억해?");
    expect(ev.pages[1]!.conditions.some((c) => (c as { kind: string }).kind === "selfSwitch")).toBe(true);
    expect(JSON.stringify(ev.pages[2]!.commands)).toContain("밤 추억");
  });
  it("loads HUD and menu tools for HUD/menu words", () => {
    expect(fallenTierTools("HUD 를 끄고 메뉴에서 스킬·장비를 빼 줘")).toEqual(expect.arrayContaining(["set_field_hud", "configure_field_menu"]));
  });
});
