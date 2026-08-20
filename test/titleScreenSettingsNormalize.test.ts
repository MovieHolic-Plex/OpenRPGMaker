import { describe, expect, it } from "vitest";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";
import { defaultSystem, defaultTitleScreenSettings } from "@/project/defaults/defaultDatabase";
import { createBlankProject } from "@/project/defaults";
import { collectResourceIds, validateSystemResources } from "@/project/io/resourceReferenceValidation";
import type { TitleScreenSettings } from "@/project/types";

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
    expect(project.system.titleScreen?.titleGraphic).toEqual({
      mode: "both",
      resourceId: "rpg-zzu-title-logo-crest",
      x: 160,
      y: 42,
    });
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
