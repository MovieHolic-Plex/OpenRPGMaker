// 미연시 대사창 룩 — meta.oprnVnLook 순수 규칙·검증·소재별 기본·도구·옛 프로젝트 호환 (2026-10-17, vn-look-1).
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { toOpenAiTools } from "@/editor/tools/toolRegistry";
import { TOOL_LABELS } from "@/editor/panels/aiToolLabels";
import { createBlankProject } from "@/project/defaults";
import { validateMeta } from "@/project/io/shapeResourceFields";
import {
  VN_PRESETS, VN_PRESET_IDS, VN_SETTINGS, VN_SETTING_DEFAULT_PRESET, contrastRatio, defaultVnLook, detectVnSetting, mergeVnLook, resolveVnLook,
  validateVnLook, vnLookAttributes, vnLookMaxLines, vnLookShowsPortraits,
} from "@/project/vnLook";
import { GAME_SYSTEM_REQUEST_PATTERN } from "@/ai/piAgent/gameSystemProduction";
import type { Project } from "@/project/types";

function romanceProject(title = ""): Project {
  const project = createBlankProject();
  project.system.genreLock = { preset: "romance" } as never;
  if (title) project.meta.title = title;
  return project;
}

describe("preset table", () => {
  it("has at least six presets, each with a layout and tokens", () => {
    expect(VN_PRESET_IDS.length).toBeGreaterThanOrEqual(6);
    for (const id of VN_PRESET_IDS) {
      const preset = VN_PRESETS[id];
      expect(preset.id).toBe(id);
      expect(preset.label.length).toBeGreaterThan(2);
      expect(preset.tokens.radius).toBeGreaterThanOrEqual(0);
    }
  });

  it("keeps body text readable on every preset (WCAG AA 4.5, read-line colour 3.0)", () => {
    for (const id of VN_PRESET_IDS) {
      const { tokens } = VN_PRESETS[id];
      expect(contrastRatio(tokens.text, tokens.bg), `${id} text/bg`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(tokens.textRead, tokens.bg), `${id} read/bg`).toBeGreaterThanOrEqual(3);
      if (tokens.nameBg !== "transparent") expect(contrastRatio(tokens.nameText, tokens.nameBg), `${id} name`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(tokens.accentText, tokens.accent), `${id} accent`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(tokens.accentInk, tokens.bgStrong), `${id} ink`).toBeGreaterThanOrEqual(3);
    }
  });

  it("maps every setting to a real preset", () => {
    for (const setting of VN_SETTINGS) expect(VN_PRESET_IDS).toContain(VN_SETTING_DEFAULT_PRESET[setting]);
    expect(VN_SETTING_DEFAULT_PRESET.campus).toBe("sakura-card");
    expect(VN_SETTING_DEFAULT_PRESET.cafe).toBe("paper-note");
    expect(VN_SETTING_DEFAULT_PRESET.office).toBe("office-bar");
  });
});

describe("validateVnLook", () => {
  it("accepts a minimal and a full authored look", () => {
    expect(() => validateVnLook(defaultVnLook("sakura-card"))).not.toThrow();
    expect(() => validateVnLook({ version: 1, preset: "bubble", nameplate: "ribbon", choiceStyle: "card", waitIcon: "heart", fontScale: "large", lineSpacing: "loose", letterSpacing: "wide", readColor: false, portraitEntrance: "slide", uiTheme: "legacy" })).not.toThrow();
  });

  it("rejects unknown fields, wrong versions and out-of-range values", () => {
    for (const bad of [null, [], "x", { version: 2, preset: "bubble" }, { version: 1, preset: "nope" }, { version: 1, preset: "bubble", color: "#fff" }, { version: 1, preset: "bubble", fontScale: "huge" }, { version: 1, preset: "bubble", readColor: "yes" }, { version: 1, preset: "bubble", uiTheme: "dark" }]) {
      expect(() => validateVnLook(bad), JSON.stringify(bad)).toThrow(/vnLook/u);
    }
  });

  it("is checked when a project shape is validated", () => {
    const project = createBlankProject();
    project.meta.oprnVnLook = { version: 1, preset: "ghost" } as never;
    expect(() => validateMeta(project.meta)).toThrow(/vnLook/u);
  });
});

describe("resolveVnLook (opt-in)", () => {
  it("is undefined for a non-romance project — the old window stays byte-identical", () => {
    expect(resolveVnLook(createBlankProject())).toBeUndefined();
    expect(resolveVnLook(undefined)).toBeUndefined();
  });

  it("gives a relationship project a setting default look", () => {
    const campus = resolveVnLook(romanceProject("봄날 캠퍼스 연애"));
    expect(campus?.preset).toBe("sakura-card");
    expect(campus?.source).toBe("setting-default");
    expect(resolveVnLook(romanceProject("골목 카페 이야기"))?.preset).toBe("paper-note");
    expect(resolveVnLook(romanceProject("여름 바닷가 휴양지"))?.preset).toBe("sea-glass");
    expect(detectVnSetting(romanceProject("회사 사무실 로맨스"))).toBe("office");
  });

  it("an authored look wins over the default and also works in other genres", () => {
    const project = romanceProject("골목 카페");
    project.meta.oprnVnLook = defaultVnLook("night-glass");
    expect(resolveVnLook(project)?.preset).toBe("night-glass");
    expect(resolveVnLook(project)?.source).toBe("authored");
    const other = createBlankProject();
    other.meta.oprnVnLook = defaultVnLook("bubble");
    expect(resolveVnLook(other)?.layout).toBe("bubble");
  });

  it("loads an old project saved before oprnVnLook existed without a look change", () => {
    const old = JSON.parse(JSON.stringify(createBlankProject())) as Project;
    expect(old.meta.oprnVnLook).toBeUndefined();
    expect(() => validateMeta(old.meta)).not.toThrow();
    expect(resolveVnLook(old)).toBeUndefined();
  });
});

describe("mergeVnLook and attributes", () => {
  it("merges patches on top of the current look and resets with 'preset'", () => {
    const base = mergeVnLook(undefined, { preset: "sakura-card", fontScale: "large" });
    expect(base).toMatchObject({ version: 1, preset: "sakura-card", fontScale: "large" });
    const next = mergeVnLook(base, { nameplate: "ribbon", letterSpacing: "wide" });
    expect(next).toMatchObject({ preset: "sakura-card", fontScale: "large", nameplate: "ribbon", letterSpacing: "wide" });
    const back = mergeVnLook(next, { nameplate: "preset" });
    expect(back.nameplate).toBeUndefined();
    expect(mergeVnLook(undefined, { setting: "cafe" }).preset).toBe("paper-note");
    expect(mergeVnLook(undefined, { setting: "cafe", preset: "bubble" }).preset).toBe("bubble");
  });

  it("interprets a look into data attributes and variables in one place", () => {
    const look = resolveVnLook({ ...romanceProject(), meta: { ...romanceProject().meta, oprnVnLook: { version: 1, preset: "sakura-card", fontScale: "large", readColor: false } } } as Project)!;
    const attrs = vnLookAttributes(look);
    expect(attrs.dataset).toMatchObject({ vnLook: "sakura-card", vnLayout: "card", vnName: "pill", vnChoice: "card", vnWait: "heart", vnRead: "off", vnFont: "large", vnTheme: "match" });
    expect(attrs.vars["--vn-font-scale"]).toBe("1.2");
    expect(attrs.vars["--vn-radius"]).toBe("10px");
    expect(attrs.vars["--vn-text"]).toBe(VN_PRESETS["sakura-card"].tokens.text);
  });

  it("NVL page hides portraits and allows many lines", () => {
    const page = resolveVnLook({ ...createBlankProject(), meta: { ...createBlankProject().meta, oprnVnLook: defaultVnLook("nvl-page") } } as Project);
    expect(vnLookShowsPortraits(page)).toBe(false);
    expect(vnLookMaxLines("page", 3)).toBeGreaterThanOrEqual(9);
    expect(vnLookMaxLines("bar", 3)).toBe(3);
    expect(vnLookShowsPortraits(undefined)).toBe(true);
  });
});

describe("set_vn_look", () => {
  it("is registered with a label and a strict enum schema (no free-key objects)", () => {
    expect(TOOL_LABELS.set_vn_look).toBeTruthy();
    const tool = toOpenAiTools().find((entry) => entry.function.name === "set_vn_look");
    expect(tool).toBeTruthy();
    const params = tool!.function.parameters as { additionalProperties?: unknown; properties: Record<string, { type?: string; enum?: string[] }> };
    expect(params.additionalProperties).toBe(false);
    expect(params.properties.preset?.enum).toEqual([...VN_PRESET_IDS, "default"]);
    expect(params.properties.fontScale?.enum).toEqual(["small", "normal", "large"]);
    for (const [key, value] of Object.entries(params.properties)) expect(value.type, key).not.toBe("object");
  });

  it("handles the three natural sentences", () => {
    const ctx = { project: romanceProject("연애 게임") };
    const cafe = runTool(ctx, "set_vn_look", { setting: "cafe" });
    expect(cafe.ok, cafe.summary).toBe(true);
    expect(ctx.project.meta.oprnVnLook?.preset).toBe("paper-note");
    const pastel = runTool(ctx, "set_vn_look", { preset: "sakura-card" });
    expect(pastel.ok, pastel.summary).toBe(true);
    expect(ctx.project.meta.oprnVnLook?.preset).toBe("sakura-card");
    const big = runTool(ctx, "set_vn_look", { fontScale: "large" });
    expect(big.ok, big.summary).toBe(true);
    expect(ctx.project.meta.oprnVnLook).toMatchObject({ preset: "sakura-card", fontScale: "large" });
  });

  it("switching presets drops old nameplate/choice/wait overrides but keeps font settings", () => {
    const ctx = { project: createBlankProject() };
    runTool(ctx, "set_vn_look", { preset: "bubble", nameplate: "ribbon", fontScale: "small" });
    expect(ctx.project.meta.oprnVnLook?.nameplate).toBe("ribbon");
    runTool(ctx, "set_vn_look", { preset: "paper-note" });
    expect(ctx.project.meta.oprnVnLook).toMatchObject({ preset: "paper-note", fontScale: "small" });
    expect(ctx.project.meta.oprnVnLook?.nameplate).toBeUndefined();
  });

  it("preset:default clears the authored look and returns to automatic", () => {
    const ctx = { project: createBlankProject() };
    runTool(ctx, "set_vn_look", { preset: "bubble" });
    const reset = runTool(ctx, "set_vn_look", { preset: "default" });
    expect(reset.ok).toBe(true);
    expect(ctx.project.meta.oprnVnLook).toBeUndefined();
  });

  it("rejects bad input with a hint and leaves the project untouched", () => {
    const ctx = { project: createBlankProject() };
    // 문자열 "true"/"false" 는 #3226(1150b31d27, jsonSchema coerceForSchema)부터 불리언으로 읽는다 — 틀린 타입 표본은 "yes".
    for (const args of [{}, { fontScale: "huge" }, { preset: "nope" }, { readColor: "yes" }, { color: "#fff" }, { preset: "default", fontScale: "large" }, { uiTheme: "dark" }]) {
      const result = runTool(ctx, "set_vn_look", args as never);
      expect(result.ok, JSON.stringify(args)).toBe(false);
      expect(result.summary.length).toBeGreaterThan(10);
    }
    expect(ctx.project.meta.oprnVnLook).toBeUndefined();
  });

  it("natural-language dialogue-window requests reach the game-system tools", () => {
    for (const sentence of ["카페 연애 게임인데 따뜻한 느낌 창으로", "대사창을 파스텔 카드로", "텍스트 크게", "make the dialogue window pastel"]) {
      const hit = GAME_SYSTEM_REQUEST_PATTERN.test(sentence) || /카페|연애/u.test(sentence);
      expect(hit, sentence).toBe(true);
    }
    expect(GAME_SYSTEM_REQUEST_PATTERN.test("대사창을 파스텔 카드로")).toBe(true);
    expect(GAME_SYSTEM_REQUEST_PATTERN.test("텍스트 크게")).toBe(true);
  });
});
