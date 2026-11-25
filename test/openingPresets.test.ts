import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BGM_STARTER_TRACK_IDS, STARTER_TITLE_SE_IDS } from "@/assets/bgmStarterTracks";
import { resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { buildOpeningPresetSequence, openingPresetCoverResourceId, openingPresetDurationSeconds, OPENING_PRESETS, OPENING_PRESET_TITLE_FALLBACK, OPENING_PRESET_TITLE_TOKEN } from "@/editor/openingPresets";
import { renderDatabasePanel, setDatabaseActiveTab } from "@/editor/panels/database";
import { CINEMATIC_DURATION_MAX_MS, CINEMATIC_SCENE_LIMIT, normalizeCinematicSequence } from "@/project/cinematicSettings";
import { createBlankProject } from "@/project/defaults";
import { collectResourceIds, validateSystemResources } from "@/project/io/resourceReferenceValidation";
import { store } from "@/project/store";
import * as modal from "@/editor/ui/modal";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";
import { MAX_TITLE_BACKGROUND_LAYERS, normalizeSystemRecords } from "@/project/databaseRecordModel";
import { defaultSystem, defaultTitleScreenSettings } from "@/project/defaults/defaultDatabase";
import { deserialize, serialize } from "@/project/io";
import type { TitleBackgroundLayer, TitleScreenSettings } from "@/project/types";
import { isolateTimers } from "./mergedTeardown";

describe("openingPresets", () => {
  isolateTimers();
  let restoreDom: () => void;
  let host: FakeElement;
  function node(id: string, root = host): FakeElement {
    const result = findByTestId(root, id);
    expect(result, `missing DOM control ${id}`).not.toBeNull();
    return result!;
  }
  function openTab(target: "opening" | "game-over"): void {
    node(`db-tab-${target}`).click();
  }
  function mount(): void {
    resetMapEditHistory();
    setDatabaseActiveTab("system");
    host = document.createElement("div") as unknown as FakeElement;
    document.body.append(host as unknown as Node);
    renderDatabasePanel(host as unknown as HTMLElement);
  }
  describe("opening preset catalogue", () => {
    // 등록되지 않은 리소스 id 는 그림만 비는 게 아니라 프로젝트 **역직렬화 자체를 실패**시킨다
    // (resourceReferenceValidation 의 validateOptionalResource 가 assert 로 던진다).
    it("only references resources a project can actually deserialize", () => {
      const known = collectResourceIds(createBlankProject());
      for (const preset of OPENING_PRESETS) {
        for (const scene of preset.scenes) {
          if (scene.resourceId) expect(known, `${preset.id}: ${scene.resourceId}`).toContain(scene.resourceId);
        }
        if (preset.musicResourceId) {
          expect(known, `${preset.id}: ${preset.musicResourceId}`).toContain(preset.musicResourceId);
          // CDN 미설정 환경에서도 소리가 나야 «눌렀더니 화려하다»가 성립한다.
          expect(BGM_STARTER_TRACK_IDS).toContain(preset.musicResourceId);
        }
      }
    });

    it("keeps every preset self-playing and within the authoring limits", () => {
      expect(OPENING_PRESETS.length).toBeGreaterThan(0);
      expect(new Set(OPENING_PRESETS.map(preset => preset.id)).size).toBe(OPENING_PRESETS.length);
      for (const preset of OPENING_PRESETS) {
        expect(preset.scenes.length).toBeGreaterThan(1);
        expect(preset.scenes.length).toBeLessThanOrEqual(CINEMATIC_SCENE_LIMIT);
        // 카드가 그림으로 팔리는 기능이다 — 대표 그림 없는 프리셋은 고를 근거가 없다.
        // 예외: 「편지로 시작하는 이야기」(written-prologue)는 그림 없는 명조 서문이 의도다 — 그런 프리셋은 장면마다 글자 연출(presentation.preset)을 가져야 한다.
        if (!openingPresetCoverResourceId(preset)) expect(preset.scenes.every(scene => scene.presentation?.preset)).toBe(true);
        expect(openingPresetDurationSeconds(preset)).toBeGreaterThan(0);
        for (const scene of preset.scenes) {
          // 0이면 키를 눌러야 넘어간다 — 프리셋은 가만히 둬도 흘러가야 한다.
          expect(scene.durationMs).toBeGreaterThan(0);
          expect(scene.durationMs).toBeLessThanOrEqual(CINEMATIC_DURATION_MAX_MS);
          if (scene.resourceId) expect(scene.motion).toBeTruthy();
        }
        expect(preset.scenes.some(scene => scene.narration.includes(OPENING_PRESET_TITLE_TOKEN))).toBe(true);
      }
    });

    it("builds an enabled sequence with the project title and fresh scene ids", () => {
      const preset = OPENING_PRESETS[0];
      const built = buildOpeningPresetSequence(preset, { title: "은빛 회랑" });

      expect(built.enabled).toBe(true);
      expect(built.skippable).toBe(true);
      expect(built.musicResourceId).toBe(preset.musicResourceId);
      expect(built.scenes).toHaveLength(preset.scenes.length);
      expect(built.scenes.some(scene => scene.narration.includes("은빛 회랑"))).toBe(true);
      expect(built.scenes.some(scene => scene.narration.includes(OPENING_PRESET_TITLE_TOKEN))).toBe(false);
      // 저장 경로가 다시 손대지 않는 모양이어야 한다(공백·빈 값 정리로 장면이 바뀌면 안 된다).
      expect(normalizeCinematicSequence(built)).toEqual(built);

      const again = buildOpeningPresetSequence(preset, { title: "은빛 회랑" });
      const ids = built.scenes.map(scene => scene.id);
      expect(again.scenes.map(scene => scene.id).some(id => ids.includes(id))).toBe(false);
    });

    it("falls back to a readable title card when the project has no title", () => {
      for (const title of [undefined, "", "   "]) {
        const built = buildOpeningPresetSequence(OPENING_PRESETS[0], { title });
        expect(built.scenes.some(scene => scene.narration.includes(OPENING_PRESET_TITLE_FALLBACK))).toBe(true);
      }
    });
  });
  describe("opening preset gallery in the Database editor", () => {
    beforeEach(() => {
      restoreDom = installFakeDom();
      const project = createBlankProject();
      project.meta.title = "달빛 서약";
      delete project.system.opening;
      store.replace(project);
      mount();
    });

    afterEach(() => {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
      restoreDom();
    });

    it("fills an empty opening from one click and undoes in one step", () => {
      // 그림 장면이 있는 프리셋으로 잰다 — 첫 프리셋(written-prologue)은 글자만 있는 서문이다.
      const preset = OPENING_PRESETS.find(entry => openingPresetCoverResourceId(entry))!;
      openTab("opening");
      node(`db-cinematic-preset-${preset.id}`).click();

      const opening = store.getCurrent().system.opening;
      expect(opening?.enabled).toBe(true);
      expect(opening?.musicResourceId).toBe(preset.musicResourceId);
      expect(opening?.scenes).toHaveLength(preset.scenes.length);
      expect(opening?.scenes.filter(scene => scene.kind === "image")).not.toHaveLength(0);
      expect(opening?.scenes.some(scene => scene.narration.includes("달빛 서약"))).toBe(true);

      // 장면마다 되돌리기가 쌓이면 실수로 누른 작성자가 네 번을 눌러야 한다.
      expect(undoMapEdit()).toBe(true);
      expect(store.getCurrent().system.opening).toBeUndefined();
    });

    it("asks before replacing authored scenes and leaves them alone on cancel", async () => {
      const [first, second] = OPENING_PRESETS;
      openTab("opening");
      node(`db-cinematic-preset-${first.id}`).click();
      const applied = store.getCurrent().system.opening;

      // 확인은 window.confirm 이 아니라 편집기 모달(showConfirm)이다 — 그 결정을 대신 내려 준다.
      const confirm = vi.spyOn(modal, "showConfirm").mockResolvedValue(false);
      node(`db-cinematic-preset-${second.id}`).click();
      await Promise.resolve(); await Promise.resolve();
      expect(confirm).toHaveBeenCalledTimes(1);
      expect(store.getCurrent().system.opening).toEqual(applied);

      confirm.mockResolvedValue(true);
      node(`db-cinematic-preset-${second.id}`).click();
      await vi.waitFor(() => expect(store.getCurrent().system.opening?.scenes).toHaveLength(second.scenes.length));
      expect(store.getCurrent().system.opening).not.toEqual(applied);
    });

    it("stays out of the game over tab, whose menu text is authored per project", () => {
      openTab("game-over");
      expect(findByTestId(host, "db-cinematic-preset-gallery")).toBeNull();
      openTab("opening");
      expect(findByTestId(host, "db-cinematic-preset-gallery")).not.toBeNull();
    });
  });
});

describe("titleScreenSettingsNormalize", () => {
  isolateTimers();
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
      // 새 프로젝트는 타이틀 메뉴 SE 3칸을 설치된 파일로 채운다(titleScreenMusic.test.ts 계약, 2026-11-24).
      expect(project.system.titleScreen?.sounds).toEqual({
        cursorSeResourceId: STARTER_TITLE_SE_IDS.cursor,
        confirmSeResourceId: STARTER_TITLE_SE_IDS.confirm,
        cancelSeResourceId: STARTER_TITLE_SE_IDS.cancel,
      });
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
});
