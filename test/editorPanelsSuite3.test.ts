// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderBattleScreenTab } from "@/editor/panels/databaseBattleScreenTab";
import { runTool } from "@/editor/tools";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { store } from "@/project/store";
import { BATTLE_LOOK_PRESET_IDS, BATTLE_LOOK_PRESETS, normalizeBattleLook, patchBattleLook, resolveBattleLook } from "@/project/battleLook";
import { resolveFontStack } from "@/project/fontRegistry";
import { appearanceGenerationController } from "@/editor/characterAppearanceGeneration";
import { openDatabaseModal, requestDatabaseModalClose } from "@/editor/panels/databaseModal";
import { selectCharacterAppearance } from "@/editor/panels/databaseAppearanceView";
import { ensureCurrentMonsterArt, hasCurrentMonsterArt, isCurrentMonsterArt, preloadCurrentMonsterArt } from "@/assets/currentMonsterArt";
import { pixelEnemySheet, setPixelEnemySheetProjectSource } from "@/assets/pixelEnemySheets";
import { enemyPixelCellOrder } from "@/editor/panels/databaseEnemyPixelPreview";
import { applyCurrentMonsterStandIns, standInOriginalArt } from "@/project/defaults/currentMonsterStandIns";
import type { Project } from "@/project/types";
import { isolateTimers } from "./mergedTeardown";

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
