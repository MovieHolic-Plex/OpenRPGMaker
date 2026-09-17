import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BGM_STARTER_TRACK_IDS } from "@/assets/bgmStarterTracks";
import { resetEditorUiModeForTests } from "@/editor/editorUiMode";
import { resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import {
  buildOpeningPresetSequence,
  openingPresetCoverResourceId,
  openingPresetDurationSeconds,
  OPENING_PRESETS,
  OPENING_PRESET_TITLE_FALLBACK,
  OPENING_PRESET_TITLE_TOKEN,
} from "@/editor/openingPresets";
import { renderDatabasePanel, setDatabaseActiveTab } from "@/editor/panels/database";
import {
  CINEMATIC_DURATION_MAX_MS,
  CINEMATIC_SCENE_LIMIT,
  normalizeCinematicSequence,
} from "@/project/cinematicSettings";
import { createBlankProject } from "@/project/defaults";
import { collectResourceIds } from "@/project/io/resourceReferenceValidation";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

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
      expect(openingPresetCoverResourceId(preset)).toBeTruthy();
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
    resetEditorUiModeForTests("standard");
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
    const preset = OPENING_PRESETS[0];
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

  it("asks before replacing authored scenes and leaves them alone on cancel", () => {
    const [first, second] = OPENING_PRESETS;
    openTab("opening");
    node(`db-cinematic-preset-${first.id}`).click();
    const applied = store.getCurrent().system.opening;

    const confirm = vi.fn(() => false);
    vi.stubGlobal("confirm", confirm);
    node(`db-cinematic-preset-${second.id}`).click();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(store.getCurrent().system.opening).toEqual(applied);

    confirm.mockReturnValue(true);
    node(`db-cinematic-preset-${second.id}`).click();
    expect(store.getCurrent().system.opening?.scenes).toHaveLength(second.scenes.length);
    expect(store.getCurrent().system.opening).not.toEqual(applied);
  });

  it("stays out of the game over tab, whose menu text is authored per project", () => {
    openTab("game-over");
    expect(findByTestId(host, "db-cinematic-preset-gallery")).toBeNull();
    openTab("opening");
    expect(findByTestId(host, "db-cinematic-preset-gallery")).not.toBeNull();
  });
});
