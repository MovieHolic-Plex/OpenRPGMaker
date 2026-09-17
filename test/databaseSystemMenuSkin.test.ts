// 자료집 시스템 탭 「게임 메뉴 디자인」 — ESC 메뉴 스킨 12종을 고르고, 기본값은 저장에서 지운다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderSystemTab } from "@/editor/panels/databaseSystemView";
import { listMenuSkinIds, MENU_SKINS } from "@/player/menuSkins/registry";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

function renderSystem(): FakeElement {
  const host = document.createElement("div") as unknown as FakeElement;
  const rerender = (): void => {
    host.replaceChildren();
    renderSystemTab(host as unknown as HTMLElement, rerender);
  };
  rerender();
  return host;
}

describe("system tab menu skin select", () => {
  let cleanup: (() => void) | undefined;

  beforeEach(() => {
    cleanup = installFakeDom();
    store.replace(createBlankProject());
  });

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  it("스킨 12종을 레지스트리 순서·라벨로 내놓고 기본이 선택돼 있다", () => {
    const host = renderSystem();
    const select = findByTestId(host, "db-field-system-menu-ui-style");
    expect(select).not.toBeNull();
    const options = select!.children.filter((child) => child.tagName === "OPTION");
    expect(options.map((option) => option.getAttribute("value"))).toEqual(listMenuSkinIds());
    expect(options.map((option) => option.textContent)).toEqual(listMenuSkinIds().map((id) => MENU_SKINS[id].label));
    expect(select!.value).toBe("workbench");
    expect(findByTestId(host, "db-system-menu-skin-description")?.textContent).toBe(MENU_SKINS.workbench.description);
    expect(findByTestId(host, "db-system-menu-skin-preview")?.getAttribute("src")).toBe("/assets/ui/menu-skins/workbench.png");
  });

  it("선택을 바꾸면 store 에 반영되고 설명·미리보기가 따라온다, 기본으로 돌리면 키를 지운다", () => {
    const host = renderSystem();
    const select = findByTestId(host, "db-field-system-menu-ui-style")!;
    select.value = "hub";
    select.dispatchEvent(new Event("change"));
    expect(store.getCurrent().system.menuUiStyle).toBe("hub");
    expect(findByTestId(host, "db-system-menu-skin-preview")?.getAttribute("src")).toBe("/assets/ui/menu-skins/hub.png");
    expect(findByTestId(host, "db-system-menu-skin-description")?.textContent).toBe(MENU_SKINS.hub.description);
    select.value = "workbench";
    select.dispatchEvent(new Event("change"));
    expect(store.getCurrent().system.menuUiStyle).toBeUndefined();
  });

  it("저장된 선택으로 다시 열면 그 값이 선택돼 있고 스튜디오 게임 메뉴 카드에도 라벨이 보인다", () => {
    store.update((draft) => {
      draft.system.menuUiStyle = "sheet";
    });
    const host = renderSystem();
    expect(findByTestId(host, "db-field-system-menu-ui-style")?.value).toBe("sheet");
    expect(findByTestId(host, "db-system-studio-card-menu")?.textContent).toContain(MENU_SKINS.sheet.label);
  });
});
