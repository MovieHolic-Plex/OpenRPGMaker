import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { hudIsStoryTemplate, hudTitleChoiceProblems } from "@/ai/v2/judge/hudTitleChecks";
import { STORY_SETUP_HUD, applyStorySetupDefaults } from "@/ai/v2/genreDefaults";
import { reconcileFieldHud } from "@/ai/v2/story/shipLookDefaults";
import { hudOnScreen, resolvedHudWidgets, normalizeFieldHud } from "@/project/fieldHud";
import { runTool } from "@/editor/tools";
import { gameContentProblems } from "@/ai/v2/judge/gameChecks";
import type { Project } from "@/project/types";
import { findingLine } from "@/ai/v2/judge/finding";

// 판정은 Finding 을 낸다 — 이 시험은 보고에 실리는 줄 글을 본다.
const hudTitleLines = (...args: Parameters<typeof hudTitleChoiceProblems>): string[] => hudTitleChoiceProblems(...args).map(findingLine);
const gameLines = (...args: Parameters<typeof gameContentProblems>): string[] => gameContentProblems(...args).map(findingLine);

const WHOLE = "용사가 마왕을 잡으러 가는 짧은 RPG 만들어줘";
const hud = (p: Project) => hudTitleLines(p).filter((m) => m.startsWith("[게임 검사 HUD 선택]"));
const title = (p: Project) => hudTitleLines(p).filter((m) => m.startsWith("[게임 검사 타이틀 모양]"));

describe("v2 HUD / title choice (fs-use-tools HUD; 2026-11-11 the HUD is derived, not asked)", () => {
  it("no longer asks the model to pick a HUD — the template is recognised but is not a gate problem", () => {
    const p = createBlankProject() as Project;
    p.system.fieldHud = { ...STORY_SETUP_HUD } as never;
    expect(hudIsStoryTemplate(p)).toBe(true);
    expect(hud(p)).toEqual([]);
    const before = createBlankProject() as Project;
    expect(gameLines(before, p, WHOLE).some((m) => m.startsWith("[게임 검사 HUD 선택]"))).toBe(false);
  });

  it("matches what applyStorySetupDefaults really writes (the constant is the fingerprint)", () => {
    const p = createBlankProject() as Project;
    p.system.fieldHud = undefined as never;
    applyStorySetupDefaults(p, "이야기 게임 만들어줘", true);
    expect(p.system.fieldHud).toBeDefined();
    expect(hudIsStoryTemplate(p)).toBe(true);
  });

  it("the finish step picks for a game still on the template: no health loss → nothing but the objective line", () => {
    const p = createBlankProject() as Project;
    for (const map of Object.values(p.maps)) { map.encounterRate = 0; map.events = []; }
    (p.database as { commonEvents?: unknown[] }).commonEvents = [];
    p.system.fieldHud = { ...STORY_SETUP_HUD };
    expect(reconcileFieldHud(p, "이야기 게임").length).toBe(1);
    expect(resolvedHudWidgets(p.system.fieldHud!)).toEqual([]);
    expect(p.system.fieldHud!.objective).toBe(true);
    expect(reconcileFieldHud(p, "이야기 게임")).toEqual([]);
  });

  it("vitals:false hides every body gauge, not only health (the lone «마력» bar)", () => {
    const sources = (vitals: boolean) => resolvedHudWidgets(normalizeFieldHud({ theme: "adventure", vitals, objective: true })).filter((w) => w.kind === "gauge").map((w) => w.source);
    expect(sources(true)).toEqual(["hp", "mp", "stamina"]);
    expect(sources(false)).toEqual([]);
  });

  it("set_field_hud leaves out gauges the game never changes and says what is on screen; they return once the game uses them", () => {
    const ctx = { project: createBlankProject() as Project };
    for (const map of Object.values(ctx.project.maps)) { map.encounterRate = 0; map.events = []; }
    (ctx.project.database as { commonEvents?: unknown[] }).commonEvents = [];
    const result = runTool(ctx, "set_field_hud", { theme: "adventure" });
    expect(result.ok, result.summary).toBe(true);
    const data = result.data as { onScreen: string[]; unused: string[] };
    expect(data.unused.map((u) => u.split(" ")[0]).sort()).toEqual(["hp", "mp", "stamina"]);
    expect(data.onScreen.some((line) => line.includes("gauge"))).toBe(false);
    expect(hudOnScreen(ctx.project.system.fieldHud!).some((line) => line.includes("gauge"))).toBe(false);
    // 전투와 마력 드는 기술이 생기면 끝맺음이 체력·마력을 되돌린다(스태미나는 액션 전투가 아니라 그대로 빠진다).
    const map = Object.values(ctx.project.maps)[0]!;
    map.events = [{ id: "ev_fight", name: "적", x: 1, y: 1, trigger: { kind: "action" }, commands: [], pages: [{ id: "p0", conditions: [], trigger: { kind: "action" }, commands: [{ kind: "battleProcessing" }] }] }] as never;
    const skills = (ctx.project.database as unknown as { skills: { mpCost?: unknown }[] }).skills;
    if (!skills.length) skills.push({} as never);
    skills[0]!.mpCost = { flat: 5, percentMax: 0 };
    ctx.project.system.actionCombat = { ...(ctx.project.system.actionCombat ?? {}), enabled: true } as never;
    expect(reconcileFieldHud(ctx.project, "용사 액션 RPG").length).toBe(1);
    expect(resolvedHudWidgets(ctx.project.system.fieldHud!).filter((w) => w.kind === "gauge").map((w) => w.source)).toEqual(["hp", "mp", "stamina"]);
    expect(reconcileFieldHud(ctx.project, "용사 액션 RPG")).toEqual([]);
  });

  it("an action-combat HUD (adventure) picked for a turn-based game is replaced by the derived one", () => {
    const p = createBlankProject() as Project;
    const map = Object.values(p.maps)[0]!;
    map.events = [{ id: "ev_fight", name: "적", x: 1, y: 1, trigger: { kind: "action" }, commands: [], pages: [{ id: "p0", conditions: [], trigger: { kind: "action" }, commands: [{ kind: "battleProcessing" }] }] }] as never;
    p.system.fieldHud = normalizeFieldHud({ theme: "adventure", vitals: true, objective: true });
    expect(reconcileFieldHud(p, "용사가 마왕을 잡는 RPG").length).toBe(1);
    expect(p.system.fieldHud!.theme).toBe("classic");
    expect(p.system.fieldHud!.objective).toBe(true);
    expect(reconcileFieldHud(p, "용사가 마왕을 잡는 RPG")).toEqual([]);
  });

  it("an authored widget list (petal life, affection gauge) is left alone", () => {
    const p = createBlankProject() as Project;
    p.system.fieldHud = normalizeFieldHud({ theme: "horror", vitals: false, objective: true, widgets: [{ id: "life", source: "variable", variableId: "v1", shape: "petals", label: "" }] });
    const before = JSON.stringify(p.system.fieldHud);
    expect(reconcileFieldHud(p, "공포")).toEqual([]);
    expect(JSON.stringify(p.system.fieldHud)).toBe(before);
  });

  it("flags a title screen with neither lettering style nor menu style, clears once either is chosen", () => {
    const p = createBlankProject() as Project;
    p.system.titleScreen = { ...(p.system.titleScreen as object), logoStyle: undefined, menuStyle: undefined } as never;
    expect(title(p)).toHaveLength(1);
    p.system.titleScreen = { ...(p.system.titleScreen as object), logoStyle: "stone" } as never;
    expect(title(p)).toEqual([]);
    p.system.titleScreen = { ...(p.system.titleScreen as object), logoStyle: undefined, menuStyle: "plain" } as never;
    expect(title(p)).toEqual([]);
  });

});
