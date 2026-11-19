/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it } from "vitest";
import { closeMapContextMenu, openMapContextMenu } from "@/editor/panels/mapContextMenu";

describe("map context menu item layout", () => {
  afterEach(() => {
    closeMapContextMenu();
  });

  it("keeps an empty icon slot so the label is not clipped to the 16px first column", () => {
    openMapContextMenu({
      mapId: "map-1",
      mapName: "테스트",
      point: { x: 10, y: 10 },
      items: [
        {
          action: () => {},
          icon: "",
          id: "create-event",
          label: "이벤트 생성...",
          shortcut: "Enter",
          testId: "event-layer-create-event",
        },
      ],
    });

    const item = document.querySelector<HTMLButtonElement>('[data-testid="event-layer-create-event"]');
    expect(item).not.toBeNull();
    const children = Array.from(item!.children) as HTMLElement[];
    expect(children.map((node) => node.className)).toEqual([
      "map-context-menu-icon",
      "map-context-menu-label",
      "map-context-menu-shortcut",
    ]);
    expect(children[0].getAttribute("aria-hidden")).toBe("true");
    expect(children[1].textContent).toBe("이벤트 생성...");
    expect(children[2].textContent).toBe("Enter");
  });
});
