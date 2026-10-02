/** @vitest-environment happy-dom */
// 전투 화면 꾸미기는 도트 측면 전투에만 그려진다(2026-10-02). 정면 스킨 위에서 꾸밈을 고르면 저장만 되고 화면은 그대로였다 —
// 자료집과 조수 set_project_settings 가 같은 규칙(sideSkinForBattleLook)으로 측면 스킨으로 갈아탄다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sideSkinForBattleLook } from "@/battle/skins/registry";
import { renderSystemTab } from "@/editor/panels/databaseSystemView";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

function projectWithSkin(uiStyle: string | undefined) {
  const project = createBlankProject();
  if (uiStyle) project.system.battleUiStyle = uiStyle as typeof project.system.battleUiStyle;
  else delete project.system.battleUiStyle;
  return project;
}

describe("sideSkinForBattleLook", () => {
  it("정면은 측면으로, 측면·몬스터 대치는 그대로", () => {
    expect(sideSkinForBattleLook(undefined)).toBe("rm2003");
    expect(sideSkinForBattleLook("rm2000")).toBe("rm2003");
    expect(sideSkinForBattleLook("mv")).toBe("retro2003");
    expect(sideSkinForBattleLook("dragonquest")).toBe("retro2003");
    expect(sideSkinForBattleLook("retro2003")).toBeUndefined();
    expect(sideSkinForBattleLook("octopath")).toBeUndefined();
    expect(sideSkinForBattleLook("pokemon")).toBeUndefined();
  });
});

describe("AI set_project_settings — 정면 스킨 위 battle.look", () => {
  it("스킨을 따로 안 고르면 측면으로 갈아타고 요약에 적는다", () => {
    const context = { project: projectWithSkin("mv") };
    const result = runTool(context, "set_project_settings", { battle: { look: { preset: "gold" } } });
    expect(result.ok).toBe(true);
    expect(context.project.system.battleUiStyle).toBe("retro2003");
    expect(result.summary).toContain("retro2003");
  });

  it("같은 호출에서 정면 스킨을 직접 고르면 그대로 두고 주의를 남긴다", () => {
    const context = { project: projectWithSkin("retro2003") };
    const result = runTool(context, "set_project_settings", { battle: { uiStyle: "mv", look: { preset: "gold" } } });
    expect(result.ok).toBe(true);
    expect(context.project.system.battleUiStyle).toBe("mv");
    expect(result.summary).toContain("주의");
  });

  it("이미 측면이거나 꾸밈을 pixel 로 지우면 스킨을 건드리지 않는다", () => {
    const side = { project: projectWithSkin("octopath") };
    expect(runTool(side, "set_project_settings", { battle: { look: { preset: "ink" } } }).ok).toBe(true);
    expect(side.project.system.battleUiStyle).toBe("octopath");
    const front = { project: projectWithSkin("mv") };
    expect(runTool(front, "set_project_settings", { battle: { look: { preset: "pixel" } } }).ok).toBe(true);
    expect(front.project.system.battleUiStyle).toBe("mv");
  });
});

describe("자료집 — 정면 스킨 위 전투 화면 꾸미기", () => {
  beforeEach(() => store.replace(projectWithSkin("mv")));
  afterEach(() => {
    document.body.innerHTML = "";
  });

  function renderSystem(): HTMLElement {
    const host = document.createElement("div");
    document.body.append(host);
    const rerender = (): void => {
      host.replaceChildren();
      renderSystemTab(host, rerender);
    };
    rerender();
    return host;
  }

  it("경고에 바꾸기 버튼이 있고, 누르면 측면 스킨이 되며 경고가 사라진다", () => {
    const host = renderSystem();
    expect(host.querySelector('[data-testid="db-battle-look-skin-warning"]')).not.toBeNull();
    host.querySelector<HTMLButtonElement>('[data-testid="db-battle-look-switch-side"]')!.click();
    expect(store.getCurrent().system.battleUiStyle).toBe("retro2003");
    expect(host.querySelector('[data-testid="db-battle-look-skin-warning"]')).toBeNull();
  });

  it("프리셋 카드를 누르면 꾸밈과 함께 측면 스킨으로 바뀐다", () => {
    const host = renderSystem();
    host.querySelector<HTMLButtonElement>('[data-testid="db-battle-look-preset-parch"]')!.click();
    expect(store.getCurrent().system.battleLook).toEqual({ preset: "parch" });
    expect(store.getCurrent().system.battleUiStyle).toBe("retro2003");
  });
});
