// set_dialogue_system · configure_field_menu(백로그) 도구, 모델 스키마, 엔딩 에필로그 표시 (2026-10-17).
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { toOpenAiTools } from "@/editor/tools/toolRegistry";
import { TOOL_LABELS } from "@/editor/panels/aiToolLabels";
import { createBlankProject } from "@/project/defaults";
import { fieldMenu } from "@/project/fieldMenu";
import { resolveDialogueSystem, romanceDialogueSystem } from "@/project/dialogueSystem";
import { createInterpreter } from "@/player/interpreter";
import { startSession } from "@/project/session";
import { PiGameSystemProduction } from "@/ai/piAgent/gameSystemProduction";

function romanceCtx() {
  const project = createBlankProject();
  project.system.genreLock = { preset: "romance" } as never;
  return { project };
}

describe("set_dialogue_system", () => {
  it("is registered with a label and a strict schema (enums, no free-key objects)", () => {
    expect(TOOL_LABELS.set_dialogue_system).toBeTruthy();
    const tool = toOpenAiTools().find((entry) => entry.function.name === "set_dialogue_system");
    expect(tool).toBeTruthy();
    const params = tool!.function.parameters as { additionalProperties?: unknown; properties: Record<string, { type?: string; enum?: string[]; additionalProperties?: unknown; properties?: Record<string, { enum?: string[] }> }> };
    expect(params.additionalProperties).toBe(false);
    expect(params.properties.language?.enum).toEqual(["ko", "en", "ja", "zh", "auto"]);
    expect(params.properties.preset?.enum).toEqual(["romance", "default"]);
    expect(params.properties.defaults?.additionalProperties).toBe(false);
    expect(params.properties.defaults?.properties?.skipScope?.enum).toEqual(["read", "all"]);
    expect(params.properties.defaults?.properties?.textSpeed?.enum).toEqual(["slow", "normal", "fast"]);
    // 모델 제공자(Gemini)가 400 을 내는 자유 키 객체·빈 enum 이 없다.
    const walk = (node: unknown): void => {
      if (!node || typeof node !== "object") return;
      const record = node as Record<string, unknown>;
      if (record.type === "object") expect(record.additionalProperties, JSON.stringify(record).slice(0, 80)).not.toBe(true);
      if (Array.isArray(record.enum)) { expect(record.enum.length).toBeGreaterThan(0); expect(record.enum).not.toContain(""); }
      Object.values(record).forEach(walk);
    };
    walk(params);
    const menuTool = toOpenAiTools().find((entry) => entry.function.name === "configure_field_menu");
    walk(menuTool?.function.parameters);
    const menuParams = menuTool?.function.parameters as { properties: Record<string, { enum?: string[]; items?: { enum?: string[] } }> };
    expect(menuParams.properties.preset?.enum).toContain("romance");
    expect(menuParams.properties.remove?.items?.enum).toContain("backlog");
  });

  it("turns a JRPG project's reading tools on and shows the effective system", () => {
    const ctx = { project: createBlankProject() };
    expect(resolveDialogueSystem(ctx.project)).toBeUndefined();
    const result = runTool(ctx, "set_dialogue_system", { backlog: true, auto: true, skip: true, hideButton: false, backlogLimit: 150, defaults: { skipScope: "all", windowOpacity: 0.8 } });
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.meta.oprnDialogueSystem).toMatchObject({ backlog: { enabled: true, limit: 150 }, hideButton: { enabled: false }, defaults: { skipScope: "all", windowOpacity: 0.8 } });
    const data = result.data as { dialogueSystem: { source: string } };
    expect(data.dialogueSystem.source).toBe("authored");
  });

  it("only changes the supplied fields on top of the relationship default", () => {
    const ctx = romanceCtx();
    const result = runTool(ctx, "set_dialogue_system", { auto: false });
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.meta.oprnDialogueSystem).toEqual({ ...romanceDialogueSystem(), auto: { enabled: false } });
  });

  it("preset default clears the authoring and falls back to automatic resolution", () => {
    const ctx = romanceCtx();
    runTool(ctx, "set_dialogue_system", { skip: false });
    expect(ctx.project.meta.oprnDialogueSystem).toBeTruthy();
    expect(runTool(ctx, "set_dialogue_system", { preset: "default" }).ok).toBe(true);
    expect(ctx.project.meta.oprnDialogueSystem).toBeUndefined();
    expect(resolveDialogueSystem(ctx.project)?.skip.enabled).toBe(true);
    const plain = { project: createBlankProject() };
    expect(runTool(plain, "set_dialogue_system", { preset: "default" }).ok).toBe(true);
    expect(resolveDialogueSystem(plain.project)).toBeUndefined();
  });

  it.each([
    [{ backlogLimit: 5 }, /backlogLimit/],
    [{ backlogLimit: 9999 }, /backlogLimit/],
    [{ backlogLimit: 50.5 }, /backlogLimit/],
    // 문자열 "true"/"false" 는 불리언으로 읽는다(jsonSchema 강제 변환, #3226) — 뜻이 둘인 문자열만 거부된다.
    [{ backlog: "yes" }, /boolean/],
    [{ language: "fr" }, /language/],
    [{ preset: "visualnovel" }, /preset/],
    [{ defaults: { skipScope: "some" } }, /skipScope/],
    [{ defaults: { textSpeed: "instant" } }, /textSpeed/],
    [{ defaults: { windowOpacity: 0.1 } }, /windowOpacity/],
    [{ defaults: { windowOpacity: "half" } }, /windowOpacity/],
    [{ defaults: { volume: 1 } }, /volume/],
    [{ defaults: [] }, /defaults/],
    [{ allowEndingSkip: true }, /allowEndingSkip/],
  ])("rejects %j with a fix hint and leaves the project untouched", (args, hint) => {
    const ctx = { project: createBlankProject() };
    const before = JSON.stringify(ctx.project.meta);
    const result = runTool(ctx, "set_dialogue_system", args as never);
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).toMatch(hint);
    expect(JSON.stringify(ctx.project.meta)).toBe(before);
  });

  it("reads the strings \"true\"/\"false\" as booleans (schema coercion, #3226)", () => {
    const ctx = { project: createBlankProject() };
    expect(runTool(ctx, "set_dialogue_system", { backlog: "true" } as never).ok).toBe(true);
    expect(ctx.project.meta.oprnDialogueSystem?.backlog.enabled).toBe(true);
  });

  it("counts as a requested game-system change that needs a review pass", () => {
    const ctx = { project: createBlankProject() };
    const production = new PiGameSystemProduction();
    const result = runTool(ctx, "set_dialogue_system", { backlog: true });
    production.record("set_dialogue_system", result, ctx.project);
    expect(production.requested).toBe(true);
    expect(production.inspect(ctx.project).length).toBeGreaterThan(0);
  });
});

describe("configure_field_menu with backlog", () => {
  it("romance preset carries the backlog entry", () => {
    const ctx = { project: createBlankProject() };
    const result = runTool(ctx, "configure_field_menu", { preset: "romance" });
    expect(result.ok, result.summary).toBe(true);
    expect(fieldMenu(ctx.project)?.entries.map((entry) => entry.command)).toEqual(["relationships", "quests", "items", "gallery", "endings", "backlog", "save", "load", "options", "to-title"]);
    expect(resolveDialogueSystem(ctx.project)?.backlog.enabled).toBe(true);
  });

  it("custom add inserts before save and switches the backlog on with a notice; remove drops it", () => {
    const ctx = { project: createBlankProject() };
    runTool(ctx, "configure_field_menu", { preset: "collector" });
    const added = runTool(ctx, "configure_field_menu", { preset: "custom", add: [{ command: "backlog", label: "백로그" }] });
    expect(added.ok, added.summary).toBe(true);
    const commands = fieldMenu(ctx.project)!.entries.map((entry) => entry.command);
    expect(commands.indexOf("backlog")).toBeLessThan(commands.indexOf("save"));
    expect(added.summary).toContain("백로그를 켰습니다");
    expect(ctx.project.meta.oprnDialogueSystem?.backlog.enabled).toBe(true);
    const removed = runTool(ctx, "configure_field_menu", { preset: "custom", remove: ["backlog"] });
    expect(removed.ok, removed.summary).toBe(true);
    expect(fieldMenu(ctx.project)!.entries.map((entry) => entry.command)).not.toContain("backlog");
  });

  it("explicit entries with a backlog row also enable it, and bad rows are rejected", () => {
    const ctx = { project: createBlankProject() };
    expect(runTool(ctx, "configure_field_menu", { preset: "custom", entries: [{ command: "items", label: "가방" }, { command: "backlog", label: "백로그" }, { command: "save", label: "저장" }] }).ok).toBe(true);
    expect(ctx.project.meta.oprnDialogueSystem?.backlog.enabled).toBe(true);
    const bad = runTool({ project: createBlankProject() }, "configure_field_menu", { preset: "custom", add: [{ command: "history", label: "기록" }] } as never);
    expect(bad.ok).toBe(false);
    const empty = runTool({ project: createBlankProject() }, "configure_field_menu", { preset: "custom" });
    expect(empty.ok).toBe(false);
    expect(JSON.stringify(empty)).toMatch(/add\/remove|entries/);
    const noBase = runTool({ project: createBlankProject() }, "configure_field_menu", { preset: "custom", add: [{ command: "backlog", label: "백로그" }] });
    expect(noBase.ok).toBe(false);
    expect(JSON.stringify(noBase)).toMatch(/preset/);
  });

  it("review flags a backlog menu entry whose system was switched off", () => {
    const ctx = { project: createBlankProject() };
    runTool(ctx, "configure_field_menu", { preset: "romance" });
    runTool(ctx, "set_dialogue_system", { backlog: false });
    const review = runTool(ctx, "review_game_systems", {});
    expect(JSON.stringify(review.data)).toContain("백로그");
  });
});

describe("ending epilogue text is marked for the skip rules", () => {
  it("epilogue say-beats surface as endingEpilogue text steps; ordinary text does not", () => {
    const project = createBlankProject();
    project.endings = [{ id: "ending_a", name: "끝", conditions: [], priority: 0, epilogue: [{ kind: "say", speaker: "하루", text: "그리고 그날부터." }] as never }];
    const session = startSession(project);
    const interpreter = createInterpreter([{ kind: "text", speaker: "하루", body: "평범한 대사" }, { kind: "triggerEnding", endingId: "ending_a" }], session, project);
    const first = interpreter.start();
    expect(first).toMatchObject({ kind: "text", body: "평범한 대사" });
    expect((first as { endingEpilogue?: boolean }).endingEpilogue).toBeUndefined();
    const epilogue = interpreter.resume();
    expect(epilogue).toMatchObject({ kind: "text", endingEpilogue: true });
    expect((epilogue as { body: string }).body).toContain("그리고 그날부터.");
  });
});
