import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ACTIVE_BATTLE_SKIN_IDS,
  isRetiredBattleSkinId,
  listActiveBattleSkinIds,
  listBattleSkinIds,
  resolveSkinId,
} from "@/battle/skins/registry";
import { renderBattleScreenTab } from "@/editor/panels/databaseBattleScreenTab";
import { isActionCombatMap } from "@/project/actionCombat";
import { createBlankProject } from "@/project/defaults";
import { projectLint } from "@/project/lint/projectLint";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

const SIDEVIEW_WINDOW_IDS = [
  "octopath", "chrono", "bravely", "ff", "goldensun", "rm2003",
] as const;

function renderBattleScreen(): FakeElement {
  const host = document.createElement("div") as unknown as FakeElement;
  const rerender = (): void => {
    host.replaceChildren();
    renderBattleScreenTab(host as unknown as HTMLElement);
  };
  rerender();
  return host;
}

describe("battle skin registry — 전투 방식 둘 (2026-10-02)", () => {
  it("새로 고를 수 있는 건 retro2003·pokemon 둘이다", () => {
    expect(listActiveBattleSkinIds()).toEqual([...ACTIVE_BATTLE_SKIN_IDS]);
    expect(listActiveBattleSkinIds()).toEqual(["retro2003", "pokemon"]);
  });

  it("창 색만 다르던 측면 스킨 여섯은 지웠고 저장된 값은 retro2003 으로 풀린다", () => {
    for (const id of SIDEVIEW_WINDOW_IDS) {
      expect(listBattleSkinIds() as string[], id).not.toContain(id);
      expect(resolveSkinId(id), id).toBe("retro2003");
    }
  });

  it("2종 등록, 지운 정면 스킨 저장값은 retro2003 으로 풀린다(저장된 프로젝트 보존)", () => {
    expect(listBattleSkinIds()).toHaveLength(2);
    expect(resolveSkinId("vxace")).toBe("retro2003");
    expect(resolveSkinId("rm2000")).toBe("retro2003");
    expect(isRetiredBattleSkinId("retro2003")).toBe(false);
    expect(isRetiredBattleSkinId("ff")).toBe(true);
  });
});

describe("자료집 전투 화면 탭 — 전투 방식", () => {
  let cleanupDom: (() => void) | undefined;

  beforeEach(() => {
    cleanupDom = installFakeDom();
    store.replace(createBlankProject());
  });

  afterEach(() => {
    cleanupDom?.();
    cleanupDom = undefined;
  });

  it("두 방식만 보이고 빈 프로젝트는 도트 측면이 골라져 있다", () => {
    const host = renderBattleScreen();
    expect(findByTestId(host, "db-battle-method-side")?.attrs["aria-checked"]).toBe("true");
    expect(findByTestId(host, "db-battle-method-monster")?.attrs["aria-checked"]).toBe("false");
  });

  it("몬스터 대치를 누르면 화면과 규칙이 같이 바뀌고, 도트 측면을 누르면 둘 다 기본으로 돌아간다", () => {
    const host = renderBattleScreen();
    findByTestId(host, "db-battle-method-monster")!.click();
    expect(store.getCurrent().system.battleUiStyle).toBe("pokemon");
    expect(store.getCurrent().system.battleModel).toBe("gen1");
    findByTestId(host, "db-battle-method-side")!.click();
    expect(store.getCurrent().system.battleUiStyle).toBeUndefined();
    expect(store.getCurrent().system.battleModel).toBeUndefined();
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
    // Covered: createBlankProject, createScarloxyDemoProject.
    // Factories requiring arguments or network/LegacyDb access are intentionally skipped.
    const factories = [
      ["createBlankProject", defaults.createBlankProject],
      ["createScarloxyDemoProject", defaults.createScarloxyDemoProject],
    ] as const;

    for (const [name, factory] of factories) {
      const project = factory();
      const skinId = project.system.battleUiStyle;
      expect(
        !isRetiredBattleSkinId(skinId),
        `${name} authors retired battle skin ${skinId}`,
      ).toBe(true);
    }
  }, 30_000);
});
