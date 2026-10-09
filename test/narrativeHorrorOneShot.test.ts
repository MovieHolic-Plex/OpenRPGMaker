import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";

/**
 * Headless one-shot reproduction contracts for Moon / Witch / Ib template tools.
 */
describe("narrative/horror one-shot reproduction", () => {
  it("Moon: script_cutscene_preset memory + ending", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    const open = runTool(ctx, "script_cutscene_preset", {
      mapId,
      preset: "memory_opening",
      lines: ["그날 밤을 기억한다.", "창밖의 달빛."],
    });
    expect(open.ok, open.summary).toBe(true);
    const end = runTool(ctx, "script_cutscene_preset", {
      mapId,
      preset: "ending_fade",
      endingId: "ending_oneshot_moon",
      endingName: "원샷 달 엔딩",
      lines: ["문을 닫는다."],
    });
    expect(end.ok, end.summary).toBe(true);
    expect(ctx.project.endings?.some((e) => e.id === "ending_oneshot_moon")).toBe(true);
    expect(ctx.project.maps[mapId]!.events.length).toBeGreaterThanOrEqual(1);
  });

  it("Witch: make_horror_loop traps + checkpoint + chase", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    const r = runTool(ctx, "make_horror_loop", {
      mapId,
      origin: { x: 3, y: 3 },
      trapCount: 3,
      includeChase: true,
      chaserAt: { x: 8, y: 3 },
      safeZone: { x: 1, y: 1, w: 2, h: 2 },
    });
    expect(r.ok, r.summary).toBe(true);
    const map = ctx.project.maps[mapId]!;
    const hasKill = map.events.some((e) =>
      (e.pages ?? []).some((p) => (p.commands ?? []).some((c) => c.kind === "killPlayer")),
    );
    const hasCheckpoint = map.events.some((e) =>
      (e.pages ?? []).some((p) => (p.commands ?? []).some((c) => c.kind === "checkpointSave")),
    );
    expect(hasKill).toBe(true);
    expect(hasCheckpoint).toBe(true);
  });

  it("Ib: make_gallery_room hotspots + puzzle switch", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    const itemId = ctx.project.database.items[0]!.id;
    const r = runTool(ctx, "make_gallery_room", {
      mapId,
      origin: { x: 2, y: 2 },
      hotspotCount: 6,
      puzzleKind: "item-gate",
      requiredItemId: itemId,
      solveSwitchId: "sw_oneshot_gallery",
    });
    expect(r.ok, r.summary).toBe(true);
    const data = r.data as { created?: number };
    expect((data.created ?? 0) >= 3).toBe(true);
    expect(ctx.project.switches.some((s) => s.id === "sw_oneshot_gallery")).toBe(true);
  });

  it("writes reproduction report artifact", () => {
    const report = {
      schemaVersion: 1,
      kind: "api-package-test-report",
      generatedAt: new Date().toISOString(),
      slices: ["moon", "witch", "ib"],
      status: "passed",
    };
    mkdirSync(resolve("artifacts"), { recursive: true });
    writeFileSync(resolve("artifacts/narrative-horror-oneshot-report.json"), JSON.stringify(report, null, 2), "utf8");
    expect(report.status).toBe("passed");
  });
});
