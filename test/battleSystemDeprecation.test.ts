import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ACTIVE_BATTLE_SKIN_IDS,
  isDeprecatedBattleSkin,
  listActiveBattleSkinIds,
  listBattleSkinIds,
  resolveSkinId,
} from "@/battle/skins/registry";
import { renderSystemTab } from "@/editor/panels/databaseSystemView";
import { isActionCombatMap } from "@/project/actionCombat";
import { createBlankProject } from "@/project/defaults";
import { projectLint } from "@/project/lint/projectLint";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

const SIDEVIEW_WINDOW_IDS = [
  "octopath", "chrono", "bravely", "ff", "goldensun", "rm2003",
] as const;

function renderSystem(): FakeElement {
  const host = document.createElement("div") as unknown as FakeElement;
  const rerender = (): void => {
    host.replaceChildren();
    renderSystemTab(host as unknown as HTMLElement, rerender);
  };
  rerender();
  return host;
}

function skinOptions(host: FakeElement): FakeElement[] {
  const select = findByTestId(host, "db-field-system-battle-ui-style");
  if (!select) throw new Error("missing skin select");
  return select.children.filter((child) => child.tagName === "OPTION");
}

describe("battle skin registry — 정면 스킨 다섯을 지운 뒤 (2026-10-02)", () => {
  it("8종 전부 활성이고, retro2003이 맨 앞에 온다", () => {
    expect(listActiveBattleSkinIds()).toEqual([...ACTIVE_BATTLE_SKIN_IDS]);
    expect(listActiveBattleSkinIds()).toHaveLength(8);
    expect(listActiveBattleSkinIds().slice(0, 3)).toEqual(["retro2003", "rm2003", "ff"]);
  });

  it("도트 측면 창 모양 스킨은 deprecated 가 아니다", () => {
    for (const id of SIDEVIEW_WINDOW_IDS) expect(isDeprecatedBattleSkin(id), id).toBe(false);
  });

  it("8종 등록, 지운 정면 스킨 저장값은 retro2003 으로 풀린다(저장된 프로젝트 보존)", () => {
    expect(listBattleSkinIds()).toHaveLength(8);
    expect(resolveSkinId("octopath")).toBe("octopath");
    expect(resolveSkinId("vxace")).toBe("retro2003");
    expect(resolveSkinId("rm2000")).toBe("retro2003");
    expect(resolveSkinId("retro2003")).toBe("retro2003");
    expect(isDeprecatedBattleSkin("retro2003")).toBe(false);
  });
});

describe("editor skin dropdown", () => {
  let cleanupDom: (() => void) | undefined;

  beforeEach(() => {
    cleanupDom = installFakeDom();
    store.replace(createBlankProject());
  });

  afterEach(() => {
    cleanupDom?.();
    cleanupDom = undefined;
  });

  it("빈 프로젝트에서 8종을 모두 보여준다", () => {
    const options = skinOptions(renderSystem());
    expect(options.map((option) => option.value)).toEqual([...ACTIVE_BATTLE_SKIN_IDS]);
    expect(options.some((option) => option.textContent.includes("지원 종료"))).toBe(false);
  });

  it("저장된 되살린 스킨은 추가 항목 없이 그대로 선택된다", () => {
    store.update((draft) => {
      draft.system.battleUiStyle = "octopath";
    });
    const host = renderSystem();
    expect(skinOptions(host)).toHaveLength(8);
    expect(findByTestId(host, "db-field-system-battle-ui-style")?.value).toBe("octopath");
  });

  it("지운 정면 스킨이 저장돼 있으면 추가 항목 없이 retro2003 이 선택된다", () => {
    store.update((draft) => {
      (draft.system as { battleUiStyle?: string }).battleUiStyle = "rm2000";
    });
    const host = renderSystem();
    expect(skinOptions(host)).toHaveLength(8);
    expect(findByTestId(host, "db-field-system-battle-ui-style")?.value).toBe("retro2003");
  });
});

describe("action combat support", () => {
  it("supports a correctly opted-in action map without a deprecation warning", () => {
    const project = createBlankProject();
    project.system.actionCombat = { enabled: true };
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("start map missing");
    map.actionCombat = true;

    expect(isActionCombatMap(project, map)).toBe(true);
    expect(projectLint(project).some(issue => issue.code === "deprecated:action-combat")).toBe(false);
  });

  it("액션 전투가 비활성화되었거나 없으면 지원 종료 issue 를 내지 않는다", () => {
    const disabled = createBlankProject();
    disabled.system.actionCombat = { enabled: false };
    const absent = createBlankProject();
    delete absent.system.actionCombat;

    for (const project of [disabled, absent]) {
      expect(projectLint(project).some((issue) => issue.code === "deprecated:action-combat")).toBe(false);
    }
  });

  it("저장된 액션 전투 맵의 런타임 활성 조건은 그대로 유지한다", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("start map missing");
    project.system.actionCombat = { enabled: true };
    map.actionCombat = true;

    expect(isActionCombatMap(project, map)).toBe(true);
    map.actionCombat = false;
    expect(isActionCombatMap(project, map)).toBe(false);
    map.actionCombat = true;
    project.system.actionCombat.enabled = false;
    expect(isActionCombatMap(project, map)).toBe(false);
  });
});

describe("shipped project battle skin authoring", () => {
  it("출하 프로젝트 팩터리는 지원 중인 배틀 스킨만 저작한다", async () => {
    // 데모·쇼케이스 팩터리는 배럴이 아니라 defaultProject 에 있다(배럴은 가벼운 것만 내보낸다).
    const defaults = await import("@/project/defaults/defaultProject");
    const { createModernNocturneProject } = await import("@/project/defaults/modernNocturneGame");
    const { createSkyStairProject } = await import("@/editor/content/skyStairGame");
    const { createVillageShoppingStreetProject } = await import(
      "@/editor/content/villageShoppingStreetProject"
    );
    // Covered: createBlankProject, createDbExtractedHouseTemplateProject, createFarmingDemoProject,
    // createHouseTemplateGalleryProject, createLogCabinShowcaseProject, createMarketTownProject,
    // createRetroHouseShowcaseProject, createSampleAdventureProject,
    // createScarloxyDemoProject, createScarloxyPokemonDemoProject, createSnowMountain60Project,
    // createIcePlain64Project, createTrainingExamplesProject, createShopShowcaseProject,
    // createSmallHouseVariantProject, createTownArchitectureCityProject, createTownArchitectureTestProject,
    // createTownCityShowcaseProject, createTownHouseShowcaseProject, createModernNocturneProject,
    // createSkyStairProject. Factories requiring arguments or network/LegacyDb access are intentionally skipped.
    // createVillageShoppingStreetProject 는 이제 editor 층(@/editor/content/villageShoppingStreetProject)
    // 에 있고 정적 import 로 불러올 수 있다 — 예전의 순환 차단용 CJS require("@/...") 는 vitest 에서
    // vite alias 를 못 풀어 호출 자체가 깨졌고, 번들러는 그 호출을 정적으로 따라가 플레이어 번들에
    // 편집기 도구 그래프를 흘렸다(playerBuild 게이트). 그래서 이 가드에도 이제 포함한다.
    const factories = [
      ["createBlankProject", defaults.createBlankProject],
      ["createVillageShoppingStreetProject", createVillageShoppingStreetProject],
      ["createDbExtractedHouseTemplateProject", defaults.createDbExtractedHouseTemplateProject],
      ["createFarmingDemoProject", defaults.createFarmingDemoProject],
      ["createHouseTemplateGalleryProject", defaults.createHouseTemplateGalleryProject],
      ["createLogCabinShowcaseProject", defaults.createLogCabinShowcaseProject],
      ["createMarketTownProject", defaults.createMarketTownProject],
      ["createRetroHouseShowcaseProject", defaults.createRetroHouseShowcaseProject],
      ["createSampleAdventureProject", defaults.createSampleAdventureProject],
      ["createScarloxyDemoProject", defaults.createScarloxyDemoProject],
      ["createScarloxyPokemonDemoProject", defaults.createScarloxyPokemonDemoProject],
      ["createSnowMountain60Project", defaults.createSnowMountain60Project],
      ["createIcePlain64Project", defaults.createIcePlain64Project],
      ["createTrainingExamplesProject", defaults.createTrainingExamplesProject],
      ["createShopShowcaseProject", defaults.createShopShowcaseProject],
      ["createSmallHouseVariantProject", defaults.createSmallHouseVariantProject],
      ["createTownArchitectureCityProject", defaults.createTownArchitectureCityProject],
      ["createTownArchitectureTestProject", defaults.createTownArchitectureTestProject],
      ["createTownCityShowcaseProject", defaults.createTownCityShowcaseProject],
      ["createTownHouseShowcaseProject", defaults.createTownHouseShowcaseProject],
      ["createModernNocturneProject", createModernNocturneProject],
      ["createSkyStairProject", createSkyStairProject],
    ] as const;

    for (const [name, factory] of factories) {
      const project = factory();
      const skinId = project.system.battleUiStyle;
      expect(
        skinId === undefined || !isDeprecatedBattleSkin(resolveSkinId(skinId)),
        `${name} authors deprecated battle skin ${skinId}`,
      ).toBe(true);
    }
  }, 30_000);
});
