// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderBattleScreenTab } from "@/editor/panels/databaseBattleScreenTab";
import { runTool } from "@/editor/tools";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { store } from "@/project/store";
import { BATTLE_HIT_FEEL_IDS, resolveBattleHitFeel } from "@/project/battleHitFeel";
import { SWING_LEAD_MS, hurtShakeIntensity, spawnSlashTrail, vibrateStruck } from "@/player/battleHitFeelDom";
import { BATTLE_LOOK_PRESET_IDS, BATTLE_LOOK_PRESETS, normalizeBattleLook, patchBattleLook, resolveBattleLook } from "@/project/battleLook";
import { resolveFontStack } from "@/project/fontRegistry";
import { getMapEditHistoryDepth } from "@/editor/mapEditHistory";
import { createBattleScreenPreview } from "@/editor/panels/battleScreenPreview";
import { BATTLE_PREVIEW_COMBO_SKILL_ID, BATTLE_PREVIEW_SCENES, BATTLE_PREVIEW_TROOP_ID, prepareBattleScreenDemo } from "@/editor/panels/battleScreenPreviewDemo";
import { bgmNeedsDownload, listAudioResources } from "@/assets/audioResourceCatalog";
import { findBgmRuntimeEntry } from "@/assets/bgmCatalogRuntime";
import { STARTER_DEFAULT_BGM_ID } from "@/assets/bgmStarterTracks";
import { audioPlayback } from "@/editor/panels/audioResourcePresentation";
import { listDatabaseResourceOptions } from "@/editor/panels/databaseResourcePickerDialog";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { openAudioTestDialog } from "@/editor/panels/audioTestDialog";
import { getAudioEngine, playAudioCommand, stopAllAudio } from "@/player/audio";
import { resolveAudioSource } from "@/player/audio/audioResources";
import { installPreviewMedia, previewMedia, mediaEvent } from "./support/previewMedia";
import { appearanceGenerationController } from "@/editor/characterAppearanceGeneration";
import { openDatabaseModal, requestDatabaseModalClose } from "@/editor/panels/databaseModal";
import { selectCharacterAppearance } from "@/editor/panels/databaseAppearanceView";
import { ensureCurrentMonsterArt, hasCurrentMonsterArt, isCurrentMonsterArt, preloadCurrentMonsterArt } from "@/assets/currentMonsterArt";
import { pixelEnemySheet, setPixelEnemySheetProjectSource } from "@/assets/pixelEnemySheets";
import { enemyPixelCellOrder } from "@/editor/panels/databaseEnemyPixelPreview";
import { applyCurrentMonsterStandIns, standInOriginalArt } from "@/project/defaults/currentMonsterStandIns";
import type { Project } from "@/project/types";
import { createVirtualList, type VirtualList } from "@/editor/panels/databaseListVirtualizer";
import { isolateTimers } from "./mergedTeardown";

/**
 * 타격감 프리셋(2026-09-27): system.battleHitFeel = impact(기본·생략) | light | calm.
 * 저장 계약(기본 생략·무효값 → 기본), 자료집 시스템 탭 선택, AI set_project_settings, 런타임 DOM 층(아군 피격 흔들림 바닥 ·
 * 히트스톱 진동 · 베기 궤적)을 묶는다. 화면 증거는 output/combat-qa/hitfeel-*(player.html 프로브).
 */
describe("battleHitFeelPreset", () => {
  isolateTimers();
  describe("system.battleHitFeel — 저장 계약", () => {
    it("새 프로젝트는 묵직하게(impact)로 열리고 JSON 에 키가 없다", () => {
      const project = createBlankProject();
      expect(resolveBattleHitFeel(project.system.battleHitFeel)).toBe("impact");
      expect(serialize(project)).not.toContain("battleHitFeel");
    });

    it("light · calm 은 왕복을 보존하고 impact 는 생략된다", () => {
      for (const feel of ["light", "calm"] as const) {
        const project = createBlankProject();
        project.system.battleHitFeel = feel;
        const wire = serialize(project);
        expect(wire).toContain(`"battleHitFeel":"${feel}"`);
        expect(deserialize(wire).system.battleHitFeel).toBe(feel);
      }
      const base = createBlankProject();
      expect(normalizeSystemRecords({ ...base.system, battleHitFeel: "impact" }).battleHitFeel).toBeUndefined();
    });

    it("모르는 값은 기본으로 풀린다", () => {
      const obj = JSON.parse(serialize(createBlankProject()));
      obj.system.battleHitFeel = "wobbly";
      const restored = deserialize(JSON.stringify(obj));
      expect(restored.system.battleHitFeel).toBeUndefined();
      expect(resolveBattleHitFeel(restored.system.battleHitFeel)).toBe("impact");
    });
  });
  // 타격감 선택은 시스템 탭에서 자료집 「전투 화면」 탭의 타격감 카드로 옮겨졌다(databaseBattleScreenTab.ts).
  describe("자료집 전투 화면 탭 — 타격감 선택", () => {
    beforeEach(() => {
      store.replace(createBlankProject());
    });
    afterEach(() => {
      document.body.innerHTML = "";
    });

    function renderSystem(): HTMLElement {
      const host = document.createElement("div");
      document.body.append(host);
      renderBattleScreenTab(host);
      return host;
    }

    function hitFeelSelect(host: HTMLElement): HTMLSelectElement {
      const select = host.querySelector<HTMLSelectElement>('[data-testid="db-field-system-battle-hit-feel"]');
      if (!select) throw new Error("타격감 선택이 없다");
      return select;
    }

    it("세 프리셋을 내놓고 기본은 묵직하게다", () => {
      const select = hitFeelSelect(renderSystem());
      expect([...select.options].map((option) => option.value)).toEqual([...BATTLE_HIT_FEEL_IDS]);
      expect(select.value).toBe("impact");
    });

    it("고르면 프로젝트에 저장되고, 기본으로 돌리면 키가 사라진다", () => {
      const host = renderSystem();
      const select = hitFeelSelect(host);
      select.value = "calm";
      select.dispatchEvent(new Event("change"));
      expect(store.getCurrent().system.battleHitFeel).toBe("calm");
      const again = hitFeelSelect(host);
      again.value = "impact";
      again.dispatchEvent(new Event("change"));
      expect("battleHitFeel" in store.getCurrent().system).toBe(false);
    });
  });
  describe("AI set_project_settings battle.hitFeel", () => {
    it("light 를 저장하고 impact 로 되돌리면 지운다", () => {
      const context = { project: createBlankProject() };
      expect(runTool(context, "set_project_settings", { battle: { hitFeel: "light" } }).ok).toBe(true);
      expect(context.project.system.battleHitFeel).toBe("light");
      expect(runTool(context, "set_project_settings", { battle: { hitFeel: "impact" } }).ok).toBe(true);
      expect(context.project.system.battleHitFeel).toBeUndefined();
    });
  });
  describe("런타임 타격감 층", () => {
    afterEach(() => {
      document.body.innerHTML = "";
    });

    it("묵직하게는 아군 피격 흔들림을 최소 heavy 로 올리고, 다른 프리셋은 피해 비율 그대로 둔다", () => {
      expect(hurtShakeIntensity("impact", "graze")).toBe("heavy");
      expect(hurtShakeIntensity("impact", "normal")).toBe("heavy");
      expect(hurtShakeIntensity("impact", "crushing")).toBe("crushing");
      expect(hurtShakeIntensity("impact", undefined)).toBeUndefined();
      expect(hurtShakeIntensity("light", "graze")).toBe("graze");
      expect(hurtShakeIntensity("calm", "normal")).toBe("normal");
    });

    it("진동은 translate 로만 떨고 잦아들어 제자리로 돌아온다", () => {
      const sprite = document.createElement("img");
      const calls: { frames: Keyframe[]; options: KeyframeAnimationOptions }[] = [];
      sprite.animate = ((frames: Keyframe[], options: KeyframeAnimationOptions) => {
        calls.push({ frames, options });
        return {} as Animation;
      }) as typeof sprite.animate;
      vibrateStruck(sprite, "normal");
      expect(calls).toHaveLength(1);
      const offsets = calls[0]!.frames.map((frame) => Number.parseFloat(String(frame.translate)));
      expect(offsets[0]).toBe(0);
      expect(offsets.at(-1)).toBe(0);
      expect(Math.abs(offsets[1]!)).toBeGreaterThan(Math.abs(offsets[offsets.length - 2]!));
      expect(offsets.some((value) => value < 0)).toBe(true);
      expect(calls[0]!.frames.every((frame) => frame.transform === undefined)).toBe(true);
    });

    it("베기 궤적은 적 노드에 붙었다가 스스로 사라진다", async () => {
      const enemy = document.createElement("button");
      enemy.className = "battle-enemy";
      document.body.append(enemy);
      spawnSlashTrail(enemy);
      expect(enemy.querySelector('[data-testid="battle-slash-trail"]')).not.toBeNull();
      await new Promise((resolve) => setTimeout(resolve, SWING_LEAD_MS + 260));
      expect(enemy.querySelector('[data-testid="battle-slash-trail"]')).toBeNull();
    });
  });
});

/**
 * 전투 화면 꾸미기(2026-10-01): system.battleLook = { preset?, 칸별 덮어쓰기 } (project/battleLook.ts).
 * 저장 계약(pixel 프리셋 그대로면 생략·프리셋과 같은 칸은 지움·무효값 버림), 자료집 전투 화면 탭(2026-10-02 시스템 탭에서 옮김), AI set_project_settings battle.look 을 묶는다.
 * 화면 증거는 verify-shots/battle-look/<프리셋>/(player.html 프로브).
 */
describe("battleLook", () => {
  isolateTimers();
  describe("system.battleLook — 저장 계약", () => {
    it("새 프로젝트는 도트 창 프리셋이고 JSON 에 키가 없다", () => {
      const project = createBlankProject();
      expect(resolveBattleLook(project.system.battleLook).preset).toBe("pixel");
      expect(serialize(project)).not.toContain("battleLook");
    });

    it("프리셋과 바꾼 칸만 왕복을 보존한다", () => {
      const project = createBlankProject();
      project.system.battleLook = { preset: "gold", window: "parch", accent: "#E8A0B8", light: 2 };
      const restored = deserialize(serialize(project)).system.battleLook;
      // light 2 는 gold 프리셋 값이라 저장하지 않는다.
      expect(restored).toEqual({ preset: "gold", window: "parch", accent: "#e8a0b8" });
      const base = createBlankProject();
      expect(normalizeSystemRecords({ ...base.system, battleLook: { preset: "pixel" } }).battleLook).toBeUndefined();
    });

    it("모르는 프리셋·칸 값은 버린다", () => {
      expect(normalizeBattleLook({ preset: "chrome", party: "floating", light: 5, accent: "gold", font: "comic-sans" })).toBeUndefined();
      expect(normalizeBattleLook({ preset: "pop", command: "nowhere" })).toEqual({ preset: "pop" });
    });

    it("프리셋 12종은 모두 풀리고 칸을 바꾸면 사용자 설정이 된다", () => {
      expect(BATTLE_LOOK_PRESET_IDS).toHaveLength(12);
      for (const id of BATTLE_LOOK_PRESET_IDS) {
        const look = resolveBattleLook({ preset: id });
        expect(look.preset).toBe(id);
        expect(look.customized).toBe(false);
        expect(look.window).toBe(BATTLE_LOOK_PRESETS[id].axes.window);
      }
      const custom = resolveBattleLook(patchBattleLook({ preset: "ink" }, { party: "cards" }));
      expect(custom).toMatchObject({ preset: "ink", party: "cards", customized: true });
    });

    it("글꼴: 고르지 않으면 창 꾸밈 기본, 고르면 그 글꼴, 고전 창은 프로젝트 픽셀 글꼴", () => {
      expect(resolveBattleLook({ preset: "ink" }).fontStack).toBe(resolveFontStack("myeongjo"));
      expect(resolveBattleLook({ preset: "ink", font: "neodgm" }).fontStack).toBe(resolveFontStack("neodgm"));
      expect(resolveBattleLook({ preset: "line" }).fontStack).toBeUndefined();
      expect(resolveBattleLook({ preset: "line" }).retroWindow).toBe(true);
      expect(resolveBattleLook({ preset: "veil" }).retroWindow).toBe(false);
    });
  });
  describe("자료집 전투 화면 탭 — 전투 화면 꾸미기", () => {
    beforeEach(() => {
      store.replace(createBlankProject());
    });
    afterEach(() => {
      document.body.innerHTML = "";
    });

    function renderSystem(): HTMLElement {
      const host = document.createElement("div");
      document.body.append(host);
      renderBattleScreenTab(host);
      return host;
    }

    it("프리셋 카드 12장, 고르면 저장되고 pixel 로 돌리면 키가 빠진다", () => {
      const host = renderSystem();
      expect(host.querySelectorAll('[data-testid^="db-battle-look-preset-"]')).toHaveLength(12);
      expect(host.querySelector('[data-testid="db-battle-look-preset-pixel"]')?.getAttribute("aria-pressed")).toBe("true");
      host.querySelector<HTMLButtonElement>('[data-testid="db-battle-look-preset-gold"]')!.click();
      expect(store.getCurrent().system.battleLook).toEqual({ preset: "gold" });
      expect(host.querySelector('[data-testid="db-battle-look-preset-gold"]')?.getAttribute("aria-pressed")).toBe("true");
      host.querySelector<HTMLButtonElement>('[data-testid="db-battle-look-preset-pixel"]')!.click();
      expect(store.getCurrent().system.battleLook).toBeUndefined();
    });

    it("칸을 바꾸면 그 칸만 저장되고 「사용자 설정」·되돌리기가 뜬다", () => {
      const host = renderSystem();
      host.querySelector<HTMLButtonElement>('[data-testid="db-battle-look-preset-ink"]')!.click();
      const party = host.querySelector<HTMLSelectElement>('[data-testid="db-battle-look-party"]')!;
      party.value = "cards";
      party.dispatchEvent(new Event("change"));
      expect(store.getCurrent().system.battleLook).toEqual({ preset: "ink", party: "cards" });
      expect(host.querySelector('[data-testid="db-battle-look-status"]')?.textContent).toContain("사용자 설정");
      host.querySelector<HTMLButtonElement>('[data-testid="db-battle-look-reset"]')!.click();
      expect(store.getCurrent().system.battleLook).toEqual({ preset: "ink" });
    });

    it("강조색은 「꾸밈 기본」을 끄면 저장되고 켜면 지워진다", () => {
      const host = renderSystem();
      const usesDefault = (): HTMLInputElement => host.querySelector<HTMLInputElement>('[data-testid="db-battle-look-accent-default"]')!;
      const color = (): HTMLInputElement => host.querySelector<HTMLInputElement>('[data-testid="db-battle-look-accent"]')!;
      expect(usesDefault().checked).toBe(true);
      color().value = "#88ccff";
      usesDefault().checked = false;
      usesDefault().dispatchEvent(new Event("change"));
      expect(store.getCurrent().system.battleLook).toEqual({ accent: "#88ccff" });
      usesDefault().checked = true;
      usesDefault().dispatchEvent(new Event("change"));
      expect(store.getCurrent().system.battleLook).toBeUndefined();
    });
  });
  describe("AI set_project_settings — battle.look", () => {
    it("프리셋으로 갈아타면 바꾼 칸을 버리고, 칸만 주면 프리셋 위에 덮는다", () => {
      const context = { project: createBlankProject() };
      expect(runTool(context, "set_project_settings", { battle: { look: { preset: "ink", party: "cards", accent: "#D9B86C" } } }).ok).toBe(true);
      expect(context.project.system.battleLook).toEqual({ preset: "ink", party: "cards", accent: "#d9b86c" });
      expect(runTool(context, "set_project_settings", { battle: { look: { turnOrder: true, accent: "" } } }).ok).toBe(true);
      expect(context.project.system.battleLook).toEqual({ preset: "ink", party: "cards", turnOrder: true });
      expect(runTool(context, "set_project_settings", { battle: { look: { preset: "pixel" } } }).ok).toBe(true);
      expect(context.project.system.battleLook).toBeUndefined();
    });

    it("모르는 프리셋·칸·글꼴·색·스킨은 거절한다", () => {
      const context = { project: createBlankProject() };
      expect(runTool(context, "set_project_settings", { battle: { look: { preset: "chrome" } } }).ok).toBe(false);
      expect(runTool(context, "set_project_settings", { battle: { look: { party: "floating" } } }).ok).toBe(false);
      expect(runTool(context, "set_project_settings", { battle: { look: { light: 3 } } }).ok).toBe(false);
      expect(runTool(context, "set_project_settings", { battle: { look: { font: "comic-sans" } } }).ok).toBe(false);
      expect(runTool(context, "set_project_settings", { battle: { look: { accent: "gold" } } }).ok).toBe(false);
      expect(runTool(context, "set_project_settings", { battle: { uiStyle: "octopath-2" } }).ok).toBe(false);
    });
  });
});

/**
 * 자료집 「전투 화면」 탭의 실시간 미리보기(qa1124 항목 6): 프로젝트를 쓰지 않고, 풀면 전투 부품을 남기지 않는다.
 * 화면 증거(500ms 안 갱신·390 접이식·가로 넘침 0)는 /tmp/fix1124-battle-screen-qa 의 실제 앱 측정이 맡는다.
 */
describe("battleScreenPreview", () => {
  isolateTimers();
  const settle = (): Promise<void> => new Promise((resolve) => queueMicrotask(resolve));
  describe("전투 화면 미리보기 — 프로젝트를 쓰지 않는다", () => {
    beforeEach(() => {
      store.replace(createBlankProject());
    });
    afterEach(() => {
      document.body.innerHTML = "";
      vi.restoreAllMocks();
    });

    it("데모 부대·연계기·적 값은 복제본에만 들어가고 저장소 프로젝트는 그대로다", () => {
      const source = store.getCurrent();
      const before = serialize(source);
      for (const scene of BATTLE_PREVIEW_SCENES) {
        const demo = prepareBattleScreenDemo(source, scene);
        expect(demo, scene).toBeDefined();
        expect(demo!.project).not.toBe(source);
        expect(demo!.project.database.troops.some((troop) => troop.id === BATTLE_PREVIEW_TROOP_ID)).toBe(true);
      }
      const combo = prepareBattleScreenDemo(source, "combo")!;
      expect(combo.project.database.skills.some((skill) => skill.id === BATTLE_PREVIEW_COMBO_SKILL_ID)).toBe(true);
      expect(source.database.troops.some((troop) => troop.id === BATTLE_PREVIEW_TROOP_ID)).toBe(false);
      expect(source.database.skills.some((skill) => skill.id === BATTLE_PREVIEW_COMBO_SKILL_ID)).toBe(false);
      expect(serialize(source)).toBe(before);
    });

    it("마운트·장면 바꾸기·해제 뒤에도 직렬화 해시와 되돌리기 기록이 같고, 풀면 전투 부품·타이머·창 키 리스너가 없다", async () => {
      const before = serialize(store.getCurrent());
      const depth = getMapEditHistoryDepth();
      const intervals = new Set<number>();
      const realSet = window.setInterval.bind(window);
      const realClear = window.clearInterval.bind(window);
      vi.spyOn(window, "setInterval").mockImplementation(((...args: Parameters<typeof window.setInterval>) => {
        const id = realSet(...args);
        intervals.add(id);
        return id;
      }) as typeof window.setInterval);
      vi.spyOn(window, "clearInterval").mockImplementation(((id?: number) => {
        if (id !== undefined) intervals.delete(id);
        realClear(id);
      }) as typeof window.clearInterval);
      const windowKeys = vi.spyOn(window, "addEventListener");

      const preview = createBattleScreenPreview("attack");
      document.body.append(preview.element);
      await settle();
      expect(preview.isMounted()).toBe(true);
      expect(preview.element.querySelectorAll(".battle-scene")).toHaveLength(1);

      preview.replay("hit");
      expect(preview.element.querySelectorAll(".battle-scene")).toHaveLength(1);
      expect(preview.element.dataset.previewScene).toBe("hit");
      // 창 단위 키 입력은 받지 않는다 — 편집기의 타이핑·단축키가 보이지 않는 전투를 움직이면 안 된다.
      expect(windowKeys.mock.calls.filter(([type]) => type === "keydown" || type === "keyup")).toHaveLength(0);

      preview.dispose();
      expect(preview.isMounted()).toBe(false);
      expect(preview.isDisposed()).toBe(true);
      expect(preview.element.querySelectorAll(".battle-scene")).toHaveLength(0);
      expect([...intervals]).toEqual([]);
      expect(serialize(store.getCurrent())).toBe(before);
      expect(getMapEditHistoryDepth()).toBe(depth);
    });
  });
});

describe("bgmOnDemandPicker", () => {
  isolateTimers();
  const catalogCount = (options: readonly { readonly id: string }[]): number => options.filter(entry => findBgmRuntimeEntry(entry.id)).length;
  function installOnly(): void {
    const installed = findBgmRuntimeEntry(STARTER_DEFAULT_BGM_ID);
    if (!installed) throw new Error("Missing starter registry entry");
    vi.stubGlobal("__OPRN_INSTALLED_BGM_FILES__", [installed.fileName]);
    vi.stubEnv("VITE_BGM_CDN_BASE", "");
  }
  function desktop(flag: boolean | undefined): void {
    window.oprn = { ...(flag === undefined ? {} : { bgmOnDemand: flag }) } as unknown as Window["oprn"];
  }
  afterEach(() => { delete window.oprn; vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  describe("데스크톱 BGM 피커 — 카탈로그 전체를 받을 수 있음으로 본다", () => {
    it("데스크톱(on-demand)에서는 피커 옵션이 카탈로그 281곡 전부이고 앱에 없는 곡만 받기 필요다", () => {
      installOnly();
      desktop(true);
      const project = createBlankProject();
      expect(catalogCount(listDatabaseResourceOptions("music", project))).toBe(281);
      expect(catalogCount(listAudioResources("music", project))).toBe(281);
      expect(bgmNeedsDownload("cc0-bgm-rtp-fld-001")).toBe(true);
      expect(bgmNeedsDownload(STARTER_DEFAULT_BGM_ID)).toBe(false);
      expect(audioPlayback("cc0-bgm-rtp-fld-001", project).playable).toBe(true);
    });

    it("웹(브리지 없음)·플래그 없는 브리지는 설치된 곡만 보이고 배지도 없다", () => {
      installOnly();
      for (const flag of [undefined, false] as const) {
        if (flag === undefined) delete window.oprn; else desktop(flag);
        const project = createBlankProject();
        expect(catalogCount(listDatabaseResourceOptions("music", project))).toBe(1);
        expect(bgmNeedsDownload("cc0-bgm-rtp-fld-001")).toBe(false);
        expect(audioPlayback("cc0-bgm-rtp-fld-001", project).playable).toBe(false);
      }
      desktop(undefined);
      expect(catalogCount(listDatabaseResourceOptions("music", createBlankProject()))).toBe(1);
    });
  });
});

describe("cc0AudioPlayback", () => {
  isolateTimers();
  function projectPick() {
    return { assets: store.getCurrent().assets };
  }
  describe("CC0 / bundled audio playback path", () => {
    beforeEach(() => {
      store.replace(createBlankProject());
      stopAllAudio();
      document.querySelectorAll("[data-testid='audio-test-dialog']").forEach((node) => node.remove());
    });

    afterEach(() => {
      document.querySelector<HTMLButtonElement>('[data-testid="audio-test-close"]')?.click();
      stopAllAudio();
      document.querySelectorAll("[data-testid='audio-test-dialog']").forEach((node) => node.remove());
      vi.restoreAllMocks();
    });

    it("resolves browser-playable wav files that exist on disk", () => {
      const cases = [
        ["easyrpg-sound-decision1", "public/assets/easyrpg/sound/Decision1.wav"],
        ["cc0-music-field-loop", "public/assets/cc0/audio/field-loop.wav"],
        ["cc0-sound-ui-confirm", "public/assets/cc0/audio/ui-confirm.wav"],
      ] as const;
      for (const [id, file] of cases) {
        const url = resolveAudioSource(id, projectPick());
        expect(url, id).toBeTruthy();
        expect(url!.startsWith("/assets/")).toBe(true);
        const bytes = readFileSync(resolve(process.cwd(), file));
        expect(bytes.subarray(0, 4).toString("ascii")).toBe("RIFF");
        expect(bytes.subarray(8, 12).toString("ascii")).toBe("WAVE");
      }
    });

    it("playAudioCommand routes SE/BGM to the audio engine with resolved urls", () => {
      const engine = getAudioEngine();
      const play = vi.spyOn(engine, "play").mockImplementation(() => undefined);
      engine.unlock();

      playAudioCommand({ resourceId: "easyrpg-sound-decision1", loop: false }, store.getCurrent());
      playAudioCommand({ resourceId: "cc0-music-field-loop", loop: true }, store.getCurrent());

      expect(play).toHaveBeenCalledWith(
        "se",
        "easyrpg-sound-decision1",
        "/assets/easyrpg/sound/Decision1.wav",
        false
      );
      expect(play).toHaveBeenCalledWith(
        "bgm",
        "cc0-music-field-loop",
        "/assets/cc0/audio/field-loop.wav",
        true
      );
    });

    it("audio test dialog auditions the first CC0 field loop without using gameplay audio", async () => {
      installPreviewMedia();
      const engine = getAudioEngine();
      const play = vi.spyOn(engine, "play").mockImplementation(() => undefined);
      openAudioTestDialog();
      const dialog = document.querySelector('[data-testid="audio-test-dialog"]');
      expect(dialog).toBeTruthy();
      // index 1 = first real track after (꺼짐) — CC0 field loop is listed first
      (dialog!.querySelector('[data-testid="audio-test-option-1"]') as HTMLButtonElement).click();
      const playBtn = dialog!.querySelector('[data-testid="audio-test-play"]') as HTMLButtonElement;
      expect(playBtn).toBeTruthy();
      const media = previewMedia();
      const requested = mediaEvent(media, "play");
      playBtn.click(); await requested;
      expect(media.getAttribute("src")).toBe("/assets/cc0/audio/field-loop.wav");
      expect(media.loop).toBe(true);
      expect(playBtn.getAttribute("aria-pressed")).toBe("false");
      media.dispatchEvent(new Event("playing"));
      expect(playBtn.getAttribute("aria-pressed")).toBe("true");
      expect(play).not.toHaveBeenCalled();
    });
  });
});

describe("characterAppearanceLifecycle", () => {
  isolateTimers();
  beforeEach(() => {
    const project = createBlankProject();
    project.database.characterAppearances = [
      { id: "first", name: "First", description: "" },
      { id: "second", name: "Second", description: "" },
    ];
    store.replace(project);
    selectCharacterAppearance("first");
    openDatabaseModal("characterAppearances");
  });
  afterEach(() => {
    requestDatabaseModalClose("battleTest");
    appearanceGenerationController.cancel();
    vi.unstubAllGlobals();
  });
  function click(testid: string): void {
    const element = document.querySelector(`[data-testid="${testid}"]`);
    if (!(element instanceof HTMLButtonElement)) throw new TypeError(`Missing button ${testid}`);
    element.click();
  }
  function deferred<T>() {
    let settle: (value: T) => void = () => { throw new TypeError("Promise not initialized"); };
    const promise = new Promise<T>((resolve) => { settle = resolve; });
    return { promise, resolve: (value: T) => settle(value) };
  }
  describe("appearance generation view lifecycle", () => {
    it.each([
      "appearance-row-second",
      "appearance-add",
      "appearance-duplicate",
      "appearance-delete",
      "db-tab-actors",
      "database-modal-close",
    ])("cancels generation and ignores late output when activating %s", async (action) => {
      const response = deferred<Response>();
      const started = deferred<void>();
      vi.stubGlobal("fetch", () => { started.resolve(); return response.promise; });
      const assetsBefore = Object.keys(store.getCurrent().assets.uploaded);
      const generation = appearanceGenerationController.generate({ appearanceId: "first", slot: "face" });
      await started.promise;
      expect(appearanceGenerationController.getState().status).toBe("generating");

      click(action);

      const statusAfterAction = appearanceGenerationController.getState().status;
      response.resolve(new Response(JSON.stringify({ image: {
        dataUrl: "data:image/png;base64,AAAA", mimeType: "image/png", model: "test", provider: "test",
      } }), { status: 200 }));
      await generation;
      expect(statusAfterAction).toBe("idle");
      expect(appearanceGenerationController.getState().status).toBe("idle");
      expect(Object.keys(store.getCurrent().assets.uploaded)).toEqual(assetsBefore);
      expect(store.getCurrent().database.characterAppearances?.every((record) => !record.face)).toBe(true);
    });
  });
});

describe("currentMonsterArtDefaults", () => {
  isolateTimers();
  // qa1124 항목 4(오너 2026-11-24 «최신 몬스터들 반영»): 새 프로젝트 기본 적이 현행 id 를 쓰는데 그림이 설치되지 않아
  // 자료집·전투에 옛 3×3 그림이 보였고, 편집기 칸 표는 시트 격자와 상관없이 9칸만 그렸다.

  describe("기본 적의 현행 몬스터 그림", () => {
    it("로드 정규화가 현행 id 적 전부에 5×4 그림을 넣고, 같은 id 의 사용자 업로드는 건드리지 않는다", async () => {
      await preloadCurrentMonsterArt();
      const project = createBlankProject() as Project;
      const currentIds = [...new Set(project.database.enemies.map((e) => e.monsterResourceId).filter(isCurrentMonsterArt))] as string[];
      expect(currentIds.length).toBeGreaterThan(0);
      const keep = currentIds[0]!;
      const userAsset = { id: keep, name: "내 그림", kind: "monster" as const, dataUrl: "data:image/png;base64,AAAA", meta: { width: 1, height: 1 } };
      project.assets.uploaded[keep] = userAsset;

      expect(ensureCurrentMonsterArt(project)).toBe(true);
      expect(project.assets.uploaded[keep]).toBe(userAsset);
      setPixelEnemySheetProjectSource(() => project);
      try {
        for (const id of currentIds.slice(1)) {
          expect(hasCurrentMonsterArt(project, id), id).toBe(true);
          expect(pixelEnemySheet(id)?.grid, id).toBe("5x4");
        }
      } finally {
        setPixelEnemySheetProjectSource(undefined);
      }
      // 두 번째 로드는 아무것도 하지 않는다(정규화 표식이 «바뀜»으로 남지 않게).
      expect(ensureCurrentMonsterArt(project)).toBe(false);
    });

    it("새 프로젝트 기본 적은 모두 현행 그림이고, 옛 그림을 이미 바꾼 적은 대역하지 않는다", () => {
      const project = createBlankProject() as Project;
      expect(project.database.enemies.filter((e) => !isCurrentMonsterArt(e.monsterResourceId)).map((e) => e.id)).toEqual([]);
      const red = project.database.enemies.find((e) => e.id === "enemy_slime_red")!;
      expect(red.monsterResourceId).toBe("generated-enemy-slime-green");
      expect(standInOriginalArt(red)).toBe("generated-enemy-slime-red");

      const saved = [{ ...red, monsterResourceId: "generated-enemy-slime-red" }, { ...red, id: "enemy_slime_blue", monsterResourceId: "my-upload" }];
      expect(applyCurrentMonsterStandIns(saved)).toBe(1);
      expect(saved.map((e) => e.monsterResourceId)).toEqual(["generated-enemy-slime-green", "my-upload"]);
      expect(standInOriginalArt(saved[1])).toBeUndefined();
    });

    it("칸 표는 시트 격자를 따른다: 3×3 9칸 · 4×4 15칸(예약 칸 제외) · 5×4 20칸 · 비운 칸은 빠진다", () => {
      expect(enemyPixelCellOrder({})).toHaveLength(9);
      expect(enemyPixelCellOrder({ grid: "4x4" })).toHaveLength(15);
      expect(enemyPixelCellOrder({ grid: "5x4" })).toHaveLength(20);
      expect(enemyPixelCellOrder({ grid: "5x4", missingCells: [18, 19] })).toHaveLength(18);
    });
  });
});

describe("databaseListVirtualizerLifecycle", () => {
  isolateTimers();
  const observers: TrackedResizeObserver[] = [];
  class TrackedResizeObserver {
    readonly observe = vi.fn();
    readonly disconnect = vi.fn();
    constructor(readonly callback: ResizeObserverCallback) { observers.push(this); }
    fire(): void { this.callback([], this as unknown as ResizeObserver); }
  }
  const lists: VirtualList<number>[] = [];
  beforeEach(() => {
    observers.length = 0;
    vi.stubGlobal("ResizeObserver", TrackedResizeObserver);
  });
  afterEach(() => {
    for (const list of lists.splice(0)) list.dispose();
    document.body.replaceChildren();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  function makeList(retain = true, onScroll = vi.fn()) {
    const container = document.createElement("div");
    Object.defineProperty(container, "clientHeight", { value: 96 });
    document.body.append(container);
    const renderRow = vi.fn((id: number) => {
      const button = document.createElement("button");
      button.dataset.id = String(id);
      button.textContent = String(id);
      return button;
    });
    const list = createVirtualList({
      container, items: Array.from({ length: 200 }, (_, i) => i),
      rowHeight: 32, overscan: 1, renderRow, onScroll,
      ...(retain ? { getRowKey: (id: number) => String(id) } : {}),
    });
    lists.push(list);
    const host = container.querySelector<HTMLElement>(".db-virtual-rows")!;
    const row = (id: number) => host.querySelector<HTMLButtonElement>(`[data-id="${id}"]`)!;
    const scroll = (offset: number) => {
      container.scrollTop = offset;
      container.dispatchEvent(new Event("scroll"));
    };
    return { list, container, host, row, scroll, renderRow, onScroll };
  }
  describe("virtual row identity, focus and ownership", () => {
    it("keeps overlapping buttons connected and focused as the window advances both ways", () => {
      const { container, host, row, scroll, renderRow } = makeList();
      const focused = row(2);
      focused.focus();
      const remove = vi.spyOn(focused, "remove");
      scroll(64);
      expect(row(2)).toBe(focused);
      expect(document.activeElement).toBe(focused);
      expect(remove).not.toHaveBeenCalled();
      expect(row(0)).toBeNull();
      expect(host.children).toHaveLength(5);
      scroll(0);
      expect(row(2)).toBe(focused);
      expect(document.activeElement).toBe(focused);
      expect(container.scrollTop).toBe(0);
      // Only newly entering rows are authored again.
      expect(renderRow).toHaveBeenCalledTimes(7);
    });

    it("recovers focus when its resource leaves the window without reversing the scroll", () => {
      const { container, host, row, scroll } = makeList();
      const focused = row(1);
      focused.focus();
      scroll(3200);
      expect(focused.isConnected).toBe(false);
      expect(document.activeElement).toBe(host.firstElementChild);
      expect(container.scrollTop).toBe(3200);
      expect(host.children).toHaveLength(5);
    });

    it("restores focus by resource key after replacement/reordering and refreshes row content", () => {
      const { list, row } = makeList();
      const old = row(2);
      old.focus();
      old.textContent = "obsolete";
      list.setItems([2, 0, 1, 3, 4]);
      expect(row(2)).not.toBe(old);
      expect(row(2).textContent).toBe("2");
      expect(document.activeElement).toBe(row(2));
    });

    it("does not take focus from controls outside the rows", () => {
      const { scroll, list } = makeList();
      const search = document.createElement("input");
      document.body.append(search);
      search.focus();
      scroll(3200);
      list.setItems([1, 2, 3]);
      expect(document.activeElement).toBe(search);
    });

    it("reveals and focuses an unmounted row in either direction and rejects invalid indexes", () => {
      const { list, row, container } = makeList();
      expect(list.focusRow(100)).toBe(true);
      expect(document.activeElement).toBe(row(100));
      expect(container.scrollTop).toBe(3136);
      expect(list.focusRow(0)).toBe(true);
      expect(document.activeElement).toBe(row(0));
      expect(container.scrollTop).toBe(0);
      for (const index of [-1, 200, 1.5, NaN]) expect(list.focusRow(index)).toBe(false);
      expect(document.activeElement).toBe(row(0));
    });

    it("preserves the replacement behavior of callers without retention keys", () => {
      const { row, scroll, list } = makeList(false);
      const original = row(2);
      scroll(64);
      expect(row(2)).not.toBe(original);
      const refreshed = row(2);
      list.setItems(Array.from({ length: 200 }, (_, i) => i));
      expect(row(2)).not.toBe(refreshed);
    });

    it("disconnects the observer and scroll listener once and makes stale work inert", () => {
      const { list, container, host, scroll, onScroll, renderRow } = makeList();
      const observer = observers[0]!;
      const removeListener = vi.spyOn(container, "removeEventListener");
      expect(observer.observe).toHaveBeenCalledWith(container);
      list.dispose();
      list.dispose();
      renderRow.mockClear();
      scroll(3200);
      observer.fire(); // Already queued delivery after disconnect.
      list.render();
      list.setItems([1, 2, 3]);
      list.scrollToIndex(0);
      expect(list.focusRow(0)).toBe(false);
      expect(observer.disconnect).toHaveBeenCalledTimes(1);
      expect(removeListener).toHaveBeenCalledWith("scroll", expect.any(Function));
      expect(onScroll).not.toHaveBeenCalled();
      expect(renderRow).not.toHaveBeenCalled();
      expect(container.scrollTop).toBe(3200);
      expect(host.children).toHaveLength(0);
    });
  });
});
