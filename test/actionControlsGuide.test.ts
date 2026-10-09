import { describe, expect, it } from "vitest";
import * as bindings from "@/player/keyBindings";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";

function context(): ToolContext {
  return { project: createBlankProject() };
}

describe("action controls guide authoring", () => {
  it("does not invent a portrait for a generated controls guide", () => {
    const ctx = context();
    const result = runTool(ctx, "place_npc", {
      mapId: ctx.project.startMapId, x: 2, y: 2, name: "Controls", guide: "action-controls",
    });

    expect(result.ok, result.summary).toBe(true);
    const guide = ctx.project.maps[ctx.project.startMapId]?.events[0];
    expect(guide?.pages?.[0]?.commands.filter(command => command.kind === "changeFace")).toHaveLength(0);
  });

  it("updates one map-stable guide without moving it when retried elsewhere", () => {
    const ctx = context();
    const mapId = ctx.project.startMapId;
    const args = { mapId, x: 2, y: 2, name: "Controls", guide: "action-controls" };
    const first = runTool(ctx, "place_npc", args);
    expect(first.ok, first.summary).toBe(true);
    const before = structuredClone(ctx.project.maps[mapId]?.events ?? []);

    const retry = runTool(ctx, "place_npc", { ...args, x: 8, y: 8, name: "Arena controls" });

    expect(retry.ok, retry.summary).toBe(true);
    const events = ctx.project.maps[mapId]?.events ?? [];
    expect(events).toHaveLength(before.length);
    const guide = events.find((event) => event.id === `ev_action_controls_${mapId}`);
    expect(guide).toMatchObject({ x: 2, y: 2, name: "Arena controls" });
    expect(guide?.pages).toHaveLength(1);
    expect(guide?.pages?.[0]?.commands.flatMap((command) => command.kind === "text" ? [command.body] : []))
      .toEqual([bindings.ACTION_CONTROLS_GUIDE]);
  });

  it("honors explicit existing identity rather than the map guide or nearby NPC", () => {
    const ctx = context();
    const mapId = ctx.project.startMapId;
    for (const args of [
      { mapId, x: 2, y: 2, name: "Controls", guide: "action-controls" },
      { mapId, x: 6, y: 6, name: "Teacher", id: "teacher", pages: [{ text: "Old lesson" }] },
    ]) expect(runTool(ctx, "place_npc", args).ok).toBe(true);
    const count = ctx.project.maps[mapId]?.events.length;

    const result = runTool(ctx, "place_npc", {
      mapId, x: 3, y: 3, name: "Controls", id: "teacher", guide: "action-controls",
    });

    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.maps[mapId]?.events).toHaveLength(count ?? 0);
    expect(ctx.project.maps[mapId]?.events.find((event) => event.id === "teacher"))
      .toMatchObject({ x: 6, y: 6 });
  });

  it("keeps distinct ordinary NPC ids distinct and requires their authored pages", () => {
    const ctx = context();
    const mapId = ctx.project.startMapId;
    for (const id of ["teacher_a", "teacher_b"]) {
      const result = runTool(ctx, "place_npc", {
        mapId, x: 2, y: 2, name: "Teacher", id, pages: [{ text: id }],
      });
      expect(result.ok, result.summary).toBe(true);
    }
    expect(ctx.project.maps[mapId]?.events.filter((event) => event.id.startsWith("teacher_"))).toHaveLength(2);
    // 2026-09-18: pages 없는 일반 NPC 는 거부 대신 인사 한 줄을 기본으로 받는다(거부 잘 안하게).
    const defaulted = runTool(ctx, "place_npc", { mapId, x: 4, y: 4, name: "No pages" });
    expect(defaulted.ok, defaulted.summary).toBe(true);
    expect((defaulted.diff?.warnings ?? []).some((w) => w.includes("인사 한 줄 기본 적용"))).toBe(true);
  });

  it("derives displayed action keys from the runtime binding predicates", () => {
    expect(bindings.ACTION_CONTROL_BINDINGS).toBeDefined();
    const predicates = {
      move: bindings.isNavKey,
      attack: bindings.isAttackKey,
      dodge: bindings.isDashKey,
      guard: bindings.isGuardKey,
      skill: bindings.isSkillKey,
      cycle: bindings.isSkillCycleKey,
      menu: bindings.isMenuKey,
    };
    for (const binding of bindings.ACTION_CONTROL_BINDINGS) {
      expect(binding.keys.length).toBeGreaterThan(0);
      expect(binding.keys.every(predicates[binding.id])).toBe(true);
    }
  });
});
