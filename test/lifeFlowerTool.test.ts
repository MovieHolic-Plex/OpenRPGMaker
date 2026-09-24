// set_life_flower — 이브식 「꽃잎 = 체력」 한 벌이 실제 런타임에서 줄고·회복되고·0장에 게임 오버가 나는지.
// 2026-09-24 갤러리 호러 도그푸딩: 함정마다 `setVariable -= 1` 만 흩뿌려져 시작값 0·게임 오버 없음·꽃잎 HUD 없음.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { runSceneTest } from "@/testing/sceneTestRunner";
import type { Project } from "@/project/types";

function setup(extra: Record<string, unknown> = {}): { project: Project } {
  const ctx: { project: Project } = { project: createBlankProject() };
  const life = runTool(ctx, "set_life_flower", { name: "푸른 수국", max: 3, ...extra });
  expect(life.ok, `${life.summary} ${JSON.stringify(life.issues)}`).toBe(true);
  const mapId = ctx.project.startMapId;
  const { x, y } = ctx.project.startPos;
  for (const [id, dx, commonEventId] of [["ev_hand", 1, "ce_life_damage"], ["ev_vase", -1, "ce_life_restore"]] as const) {
    const placed = runTool(ctx, "upsert_event", { mapId, event: {
      id, x: x + dx, y,
      pages: [{ trigger: { kind: "action" }, conditions: [], commands: [{ kind: "callCommonEvent", commonEventId }] }],
    } });
    expect(placed.ok, placed.summary).toBe(true);
  }
  return ctx;
}

describe("set_life_flower", () => {
  it("starts full, shows petals instead of the default HUD, loses and restores petals, and ends at zero", () => {
    const ctx = setup();
    const project = ctx.project;
    expect(project.session.variables.var_life_petals).toBe(3);
    const hud = project.system.fieldHud!;
    expect(hud.theme).toBe("horror");
    expect(hud.widgets?.[0]).toMatchObject({ source: "variable", variableId: "var_life_petals", shape: "petals", max: 3 });
    expect(hud.widgets?.some(widget => widget.source === "hp")).toBe(false);

    const mapId = project.startMapId;
    const start = project.startPos;
    const hand = project.maps[mapId]!.events.find(event => event.id === "ev_hand")!;
    const vase = project.maps[mapId]!.events.find(event => event.id === "ev_vase")!;
    const hit = [{ kind: "face", dir: hand.x > start.x ? "right" : "left" }, { kind: "interact", eventId: "ev_hand" }] as const;
    const heal = [{ kind: "face", dir: vase.x > start.x ? "right" : "left" }, { kind: "interact", eventId: "ev_vase" }] as const;
    const result = runSceneTest(project, { mapId, start, steps: [
      ...hit, ...hit, { kind: "expect", variableEquals: { variableId: "var_life_petals", value: 1 }, gameOver: false },
      ...heal, { kind: "expect", variableEquals: { variableId: "var_life_petals", value: 3 } },
      ...hit, ...hit, ...hit, { kind: "expect", gameOver: true },
    ] });
    expect(result.ok, `${result.failureReason} ${JSON.stringify(result.finalState.variables)}`).toBe(true);
  });

  it("runs the named bad ending at zero when defeatEndingId is given", () => {
    const ctx: { project: Project } = { project: createBlankProject() };
    const ending = runTool(ctx, "define_ending", { id: "ending_trapped", name: "그림 속에 남다", conditions: [] });
    expect(ending.ok, ending.summary).toBe(true);
    const life = runTool(ctx, "set_life_flower", { max: 1, defeatEndingId: "ending_trapped" });
    expect(life.ok, life.summary).toBe(true);
    const damage = ctx.project.commonEvents.find(event => event.id === "ce_life_damage")!;
    expect(JSON.stringify(damage.commands)).toContain("\"endingId\":\"ending_trapped\"");
  });

  it("rejects an unknown defeat ending instead of wiring a dead reference", () => {
    const ctx: { project: Project } = { project: createBlankProject() };
    const life = runTool(ctx, "set_life_flower", { defeatEndingId: "ending_missing" });
    expect(life.ok).toBe(false);
    expect(life.summary).toContain("ending_missing");
  });
});

describe("horror-gallery preset prompt", () => {
  it("names set_life_flower so the first request exposes it", async () => {
    const { buildWelcomeGenrePresetPrompt, welcomeGenrePresetById } = await import("@/editor/welcomeGenrePresets");
    const { mentionedToolSchemas } = await import("@/ai/planToolExposure");
    const prompt = buildWelcomeGenrePresetPrompt(welcomeGenrePresetById("horror-gallery")!);
    const names = (mentionedToolSchemas(prompt) as { function: { name: string } }[]).map(tool => tool.function.name);
    expect(names).toContain("set_life_flower");
  });
});

describe("qa gameCheck gallery life rules", () => {
  const brief = "꽃잎 5장이 체력이다. 0장이면 게임오버.";
  it("flags scattered petal decrements with no start value, defeat, restore or HUD", async () => {
    const { checkGallery } = await import("@/qa/gameCheck/gallery");
    const ctx: { project: Project } = { project: createBlankProject() };
    const { x, y } = ctx.project.startPos;
    runTool(ctx, "upsert_event", { mapId: ctx.project.startMapId, event: { id: "ev_trap", x: x + 1, y, pages: [{ trigger: { kind: "playerTouch" }, conditions: [], commands: [{ kind: "setVariable", variableId: "v_petals", op: "-=", value: 1 }] }] } });
    const codes = checkGallery(ctx.project, brief).map(finding => finding.code).sort();
    expect(codes).toEqual(["gallery-life-no-defeat", "gallery-life-no-restore", "gallery-life-not-shown", "gallery-life-starts-empty"]);
  });
  it("accepts the set_life_flower wiring", async () => {
    const { checkGallery } = await import("@/qa/gameCheck/gallery");
    expect(checkGallery(setup().project, brief)).toEqual([]);
  });
});
