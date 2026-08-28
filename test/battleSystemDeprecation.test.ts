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

const DEPRECATED_IDS = [
  "rm2000", "octopath", "chrono", "bravely", "dragonquest",
  "ff", "mother", "goldensun", "mv", "vxace",
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

describe("battle skin deprecation registry", () => {
  it("활성 스킨은 pokemon·rm2003 둘뿐이다", () => {
    expect(listActiveBattleSkinIds()).toEqual(["pokemon", "rm2003"]);
    expect([...ACTIVE_BATTLE_SKIN_IDS]).toEqual(["pokemon", "rm2003"]);
  });

  it("나머지 10종은 deprecated 로 표시된다", () => {
    for (const id of DEPRECATED_IDS) expect(isDeprecatedBattleSkin(id), id).toBe(true);
    expect(isDeprecatedBattleSkin("pokemon")).toBe(false);
    expect(isDeprecatedBattleSkin("rm2003")).toBe(false);
  });

  it("12종 등록과 resolveSkinId 동작은 그대로 유지된다(저장된 프로젝트 보존)", () => {
    expect(listBattleSkinIds()).toHaveLength(12);
    expect(resolveSkinId("octopath")).toBe("octopath");
    expect(resolveSkinId("vxace")).toBe("vxace");
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

  it("빈 프로젝트에서는 활성 스킨 2개만 보여준다", () => {
    const options = skinOptions(renderSystem());
    expect(options.map((option) => option.value)).toEqual(["pokemon", "rm2003"]);
  });

  it("저장된 deprecated 스킨은 '(지원 종료)' 항목으로 남겨 선택을 보존한다", () => {
    store.update((draft) => {
      draft.system.battleUiStyle = "octopath";
    });
    const host = renderSystem();
    const options = skinOptions(host);
    expect(options).toHaveLength(3);
    expect(options.map((option) => option.value)).toContain("octopath");
    const saved = options.find((option) => option.value === "octopath");
    expect(saved?.textContent.endsWith("(지원 종료)")).toBe(true);
    expect(findByTestId(host, "db-field-system-battle-ui-style")?.value).toBe("octopath");
  });
});

describe("action combat deprecation", () => {
  it("활성화된 액션 전투를 지원 종료 warning 으로 보고한다", () => {
    const project = createBlankProject();
    project.system.actionCombat = { enabled: true };
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("start map missing");
    map.actionCombat = true;

    expect(projectLint(project)).toContainEqual(expect.objectContaining({
      severity: "warning",
      code: "deprecated:action-combat",
    }));
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
