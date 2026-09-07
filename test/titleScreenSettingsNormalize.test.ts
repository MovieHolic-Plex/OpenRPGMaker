import { describe, expect, it } from "vitest";
import { MAX_TITLE_BACKGROUND_LAYERS, normalizeSystemRecords } from "@/project/databaseRecordModel";
import { defaultSystem, defaultTitleScreenSettings } from "@/project/defaults/defaultDatabase";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { collectResourceIds, validateSystemResources } from "@/project/io/resourceReferenceValidation";
import type { TitleBackgroundLayer, TitleScreenSettings } from "@/project/types";

describe("titleScreen settings normalize expansion", () => {
  it("fills missing expansion fields from partial/legacy settings", () => {
    const system = normalizeSystemRecords({
      ...defaultSystem(),
      titleScreen: {
        title: "레거시 타이틀",
        layout: { titleX: 160, titleY: 70, menuX: 160, menuY: 118 },
        menuLabels: { newGame: "새 게임", continueGame: "계속", quit: "게임 종료" },
      } as TitleScreenSettings,
    });

    expect(system.titleScreen?.menuVisibility).toEqual({
      newGame: true,
      continueGame: true,
      quit: true,
    });
    expect(system.titleScreen?.sounds).toBeUndefined();
    expect(system.titleScreen?.titleGraphic).toBeUndefined();
    expect(system.titleScreen?.showInputHint).toBe(true);
  });

  it("forces newGame visibility true even when input is false", () => {
    const system = normalizeSystemRecords({
      ...defaultSystem(),
      titleScreen: {
        ...defaultTitleScreenSettings(),
        menuVisibility: {
          newGame: false,
          continueGame: false,
          quit: false,
        },
      },
    });

    expect(system.titleScreen?.menuVisibility).toEqual({
      newGame: true,
      continueGame: false,
      quit: false,
    });
  });

  it("keeps legacy JSON without resume fields byte-identical (default = visible, no label)", () => {
    // 구 JSON: resume 필드가 아예 없다 → normalize 가 키를 만들어 넣지 않는다.
    const system = normalizeSystemRecords({
      ...defaultSystem(),
      titleScreen: {
        title: "레거시 타이틀",
        layout: { titleX: 160, titleY: 70, menuX: 160, menuY: 118 },
        menuLabels: { newGame: "새 게임", continueGame: "계속", quit: "게임 종료" },
      } as TitleScreenSettings,
    });
    expect(system.titleScreen?.menuVisibility).toEqual({
      newGame: true,
      continueGame: true,
      quit: true,
    });
    expect("resume" in (system.titleScreen?.menuVisibility ?? {})).toBe(false);
    expect("resume" in (system.titleScreen?.menuLabels ?? {})).toBe(false);
  });

  it("preserves an explicit resume visibility boolean and a trimmed resume label", () => {
    const explicit = normalizeSystemRecords({
      ...defaultSystem(),
      titleScreen: {
        ...defaultTitleScreenSettings(),
        menuLabels: { ...defaultTitleScreenSettings().menuLabels, resume: "  지난 모험 계속  " },
        menuVisibility: { newGame: true, continueGame: true, quit: true, resume: false },
      },
    });
    expect(explicit.titleScreen?.menuVisibility?.resume).toBe(false);
    expect(explicit.titleScreen?.menuLabels?.resume).toBe("지난 모험 계속");

    // 공백뿐인 라벨은 버려서 런타임 기본 라벨("이어하기")로 떨어지게 한다.
    const blank = normalizeSystemRecords({
      ...defaultSystem(),
      titleScreen: {
        ...defaultTitleScreenSettings(),
        menuLabels: { ...defaultTitleScreenSettings().menuLabels, resume: "   " },
      },
    });
    expect(blank.titleScreen?.menuLabels?.resume).toBeUndefined();
  });

  it("cleans empty SE ids and omits sounds when all empty", () => {
    const cleaned = normalizeSystemRecords({
      ...defaultSystem(),
      titleScreen: {
        ...defaultTitleScreenSettings(),
        sounds: {
          cursorSeResourceId: "",
          confirmSeResourceId: "  ",
          cancelSeResourceId: "",
        },
      },
    });
    expect(cleaned.titleScreen?.sounds).toBeUndefined();

    const kept = normalizeSystemRecords({
      ...defaultSystem(),
      titleScreen: {
        ...defaultTitleScreenSettings(),
        sounds: {
          cursorSeResourceId: "",
          confirmSeResourceId: "easyrpg-sound-decision",
          cancelSeResourceId: "  ",
        },
      },
    });
    expect(kept.titleScreen?.sounds).toEqual({
      confirmSeResourceId: "easyrpg-sound-decision",
    });
  });

  it("normalizes titleGraphic mode/coords and omits text-only without resource", () => {
    const omitted = normalizeSystemRecords({
      ...defaultSystem(),
      titleScreen: {
        ...defaultTitleScreenSettings(),
        titleGraphic: {
          mode: "text",
          resourceId: "",
          x: 999,
          y: -5,
        },
      },
    });
    expect(omitted.titleScreen?.titleGraphic).toBeUndefined();

    const graphic = normalizeSystemRecords({
      ...defaultSystem(),
      titleScreen: {
        ...defaultTitleScreenSettings(),
        titleGraphic: {
          mode: "not-a-mode" as "text",
          resourceId: "easyrpg-title-title1",
          x: 999,
          y: -5,
        },
      },
    });
    expect(graphic.titleScreen?.titleGraphic).toEqual({
      mode: "text",
      resourceId: "easyrpg-title-title1",
      x: 320,
      y: 0,
    });
  });

  it("defaults showInputHint true and keeps explicit false", () => {
    const missing = normalizeSystemRecords({
      ...defaultSystem(),
      titleScreen: {
        title: "힌트",
        layout: defaultTitleScreenSettings().layout,
        menuLabels: defaultTitleScreenSettings().menuLabels,
      } as TitleScreenSettings,
    });
    expect(missing.titleScreen?.showInputHint).toBe(true);

    const off = normalizeSystemRecords({
      ...defaultSystem(),
      titleScreen: {
        ...defaultTitleScreenSettings(),
        showInputHint: false,
      },
    });
    expect(off.titleScreen?.showInputHint).toBe(false);
  });

  it("keeps blank project titleScreen with expansion defaults", () => {
    const project = createBlankProject();
    expect(project.system.titleScreen?.menuVisibility).toEqual({
      newGame: true,
      continueGame: true,
      quit: true,
    });
    expect(project.system.titleScreen?.showInputHint).toBe(true);
    expect(project.system.titleScreen?.sounds).toBeUndefined();
    expect(project.system.titleScreen?.titleGraphic).toBeUndefined();
  });

  it("omits backgroundLayers/particles/intro entirely for legacy JSON (byte-stable)", () => {
    const system = normalizeSystemRecords({
      ...defaultSystem(),
      titleScreen: {
        title: "레거시 타이틀",
        layout: { titleX: 160, titleY: 70, menuX: 160, menuY: 118 },
        menuLabels: { newGame: "새 게임", continueGame: "계속", quit: "게임 종료" },
      } as TitleScreenSettings,
    });
    const settings = system.titleScreen ?? {};
    expect("backgroundLayers" in settings).toBe(false);
    expect("particles" in settings).toBe(false);
    expect("intro" in settings).toBe(false);
  });

  it("drops invalid layers, omits default-valued fields, and caps layers at 4", () => {
    const system = normalizeSystemRecords({
      ...defaultSystem(),
      titleScreen: {
        ...defaultTitleScreenSettings(),
        backgroundLayers: [
          { resourceId: "  " } as TitleBackgroundLayer, // 리소스 없음 → drop
          { resourceId: "layer-a", scrollXPerSec: 0, scrollYPerSec: Number.NaN, parallax: 1, opacity: 2 }, // 전부 기본/무효 → 필드 omit
          { resourceId: " layer-b ", scrollXPerSec: 9999, scrollYPerSec: -9999, parallax: 9, opacity: -1 }, // 클램프
          { resourceId: "layer-c", scrollXPerSec: 16, opacity: 0.5, parallax: 0.5 },
          { resourceId: "layer-d" },
          { resourceId: "layer-e" }, // 5번째 유효 레이어 → 상한 4 로 잘림
        ],
      },
    });
    const layers = system.titleScreen?.backgroundLayers ?? [];
    expect(layers).toHaveLength(MAX_TITLE_BACKGROUND_LAYERS);
    expect(layers[0]).toEqual({ resourceId: "layer-a" });
    expect(layers[1]).toEqual({ resourceId: "layer-b", scrollXPerSec: 480, scrollYPerSec: -480, parallax: 4, opacity: 0 });
    expect(layers[2]).toEqual({ resourceId: "layer-c", scrollXPerSec: 16, opacity: 0.5, parallax: 0.5 });
    expect(layers[3]).toEqual({ resourceId: "layer-d" });
  });

  it("omits an empty/all-invalid backgroundLayers array", () => {
    const empty = normalizeSystemRecords({
      ...defaultSystem(),
      titleScreen: { ...defaultTitleScreenSettings(), backgroundLayers: [] },
    });
    expect("backgroundLayers" in (empty.titleScreen ?? {})).toBe(false);

    const invalidOnly = normalizeSystemRecords({
      ...defaultSystem(),
      titleScreen: {
        ...defaultTitleScreenSettings(),
        backgroundLayers: [{ resourceId: "" } as TitleBackgroundLayer],
      },
    });
    expect("backgroundLayers" in (invalidOnly.titleScreen ?? {})).toBe(false);
  });

  it("guards the particle preset enum and clamps density to 0..100", () => {
    const invalid = normalizeSystemRecords({
      ...defaultSystem(),
      titleScreen: {
        ...defaultTitleScreenSettings(),
        particles: { preset: "confetti" as "snow", density: 50 },
      },
    });
    expect("particles" in (invalid.titleScreen ?? {})).toBe(false);

    const clamped = normalizeSystemRecords({
      ...defaultSystem(),
      titleScreen: {
        ...defaultTitleScreenSettings(),
        particles: { preset: "snow", density: 999 },
      },
    });
    expect(clamped.titleScreen?.particles).toEqual({ preset: "snow", density: 100 });

    const densityless = normalizeSystemRecords({
      ...defaultSystem(),
      titleScreen: {
        ...defaultTitleScreenSettings(),
        particles: { preset: "fireflies", density: Number.NaN },
      },
    });
    expect(densityless.titleScreen?.particles).toEqual({ preset: "fireflies" });
  });

  it("keeps intro only when it has a real animation and clamps delay/stagger", () => {
    const noneOnly = normalizeSystemRecords({
      ...defaultSystem(),
      titleScreen: {
        ...defaultTitleScreenSettings(),
        intro: { logo: "none", menu: "none", delayMs: 500, staggerMs: 100 },
      },
    });
    expect("intro" in (noneOnly.titleScreen ?? {})).toBe(false);

    const clamped = normalizeSystemRecords({
      ...defaultSystem(),
      titleScreen: {
        ...defaultTitleScreenSettings(),
        intro: { logo: "riseIn", menu: "slideUp", delayMs: 99999, staggerMs: -5 },
      },
    });
    expect(clamped.titleScreen?.intro).toEqual({ logo: "riseIn", menu: "slideUp", delayMs: 10000, staggerMs: 0 });

    const invalidEnum = normalizeSystemRecords({
      ...defaultSystem(),
      titleScreen: {
        ...defaultTitleScreenSettings(),
        intro: { logo: "explode" as "fadeIn", menu: "fadeIn" },
      },
    });
    expect(invalidEnum.titleScreen?.intro).toEqual({ menu: "fadeIn" });
  });

  it("round-trips authored backgroundLayers/particles/intro through serialize→deserialize", () => {
    const project = createBlankProject();
    project.system.titleScreen = {
      ...defaultTitleScreenSettings(),
      backgroundLayers: [
        { resourceId: "easyrpg-title-title1", scrollXPerSec: 16, opacity: 0.6 },
        { resourceId: "oprn-title-field", scrollYPerSec: -8, parallax: 0.5 },
      ],
      particles: { preset: "snow", density: 60 },
      intro: { logo: "riseIn", menu: "slideUp", delayMs: 200, staggerMs: 80 },
    };
    const restored = deserialize(serialize(project));
    expect(restored.system.titleScreen?.backgroundLayers).toEqual(project.system.titleScreen.backgroundLayers);
    expect(restored.system.titleScreen?.particles).toEqual({ preset: "snow", density: 60 });
    expect(restored.system.titleScreen?.intro).toEqual({ logo: "riseIn", menu: "slideUp", delayMs: 200, staggerMs: 80 });
    // 왕복 멱등성 — 두 번째 왕복에서 값이 더 바뀌지 않는다.
    expect(deserialize(serialize(restored))).toEqual(restored);
  });

  it("validates background layer resource ids through system resource validation", () => {
    const project = createBlankProject();
    project.system.titleScreen = {
      ...defaultTitleScreenSettings(),
      backgroundLayers: [{ resourceId: "missing-layer-art" }],
    };
    const ids = collectResourceIds(project);
    expect(() => validateSystemResources(project.system, ids)).toThrow(/backgroundLayers\[0\]/);

    project.system.titleScreen = {
      ...defaultTitleScreenSettings(),
      backgroundLayers: [{ resourceId: "easyrpg-title-title1" }],
    };
    expect(() => validateSystemResources(project.system, ids)).not.toThrow();
  });

  it("validates optional title SE and logo resource ids", () => {
    const project = createBlankProject();
    project.system.titleScreen = {
      ...defaultTitleScreenSettings(),
      sounds: { cursorSeResourceId: "missing-cursor-se" },
      titleGraphic: {
        mode: "graphic",
        resourceId: "missing-title-logo",
        x: 160,
        y: 70,
      },
    };
    const ids = collectResourceIds(project);
    expect(() => validateSystemResources(project.system, ids)).toThrow(/titleScreen\.sounds\.cursorSeResourceId/);

    project.system.titleScreen = {
      ...defaultTitleScreenSettings(),
      titleGraphic: {
        mode: "graphic",
        resourceId: "missing-title-logo",
        x: 160,
        y: 70,
      },
    };
    expect(() => validateSystemResources(project.system, ids)).toThrow(/titleScreen\.titleGraphic\.resourceId/);
  });
});
