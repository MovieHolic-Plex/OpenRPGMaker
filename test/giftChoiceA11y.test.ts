// @vitest-environment happy-dom
// 선물하기·물건 제시 창: 보이는 제목이 대화상자 이름이고, 커서가 옮기면 그 물건만 알린다.
import { afterEach, describe, expect, it } from "vitest";
import { playGiftSelection } from "@/player/playSceneGift";
import { playPresentItem } from "@/player/playScenePresentItem";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_ITEM_ID } from "@/project/defaults/constants";
import { deserialize, serialize } from "@/project/io";
import { DEFAULT_MESSAGE_WINDOW_SETTINGS, startSession } from "@/project/session";
import { store } from "@/project/store";
import type { GameEvent } from "@/project/types";

function sceneFixture(inventory: Record<string, number>): PlaySceneContext {
  store.replace(deserialize(serialize(createBlankProject())));
  const project = store.getCurrent();
  const host = document.createElement("div");
  document.body.append(host);
  const dialogue = {
    showText: async () => undefined,
    showChoices: async () => 0,
    showNumberInput: async () => 0,
    hide() {},
    close() {},
  };
  const scene = {
    session: startSession(project, 1),
    map: project.maps[project.startMapId],
    tileX: 0,
    tileY: 0,
    game: { registry: { get: (key: string) => (key === "dialogueHost" ? host : key === "dialogue" ? dialogue : undefined) } },
    syncRuntimeState() {},
  } as unknown as PlaySceneContext;
  scene.session.inventory = inventory;
  return scene;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("gift and present-item dialog accessibility", () => {
  it("names the gift dialog and announces the item under the cursor", async () => {
    const scene = sceneFixture({ [DEFAULT_ITEM_ID]: 2 });
    const event: GameEvent = {
      id: "npc",
      x: 1,
      y: 1,
      characterId: "resident",
      trigger: { kind: "action" },
      commands: [],
    };
    const pending = playGiftSelection(scene, event);
    const dialog = document.querySelector<HTMLElement>("[data-testid='gift-scene']");
    const title = document.getElementById("runtime-gift-title");
    expect(dialog?.getAttribute("role")).toBe("dialog");
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    expect(dialog?.getAttribute("aria-labelledby")).toBe(title?.id);
    expect(title?.textContent).toBe("선물하기");
    expect(document.querySelector("[data-testid='gift-item-list']")?.getAttribute("aria-label")).toBe("선물할 물건");
    expect(document.querySelector("[data-testid='gift-item-item_potion']")?.getAttribute("aria-label")).toBe("회복약 2개");

    const status = document.querySelector<HTMLElement>("[data-testid='gift-announcement']");
    expect(status?.getAttribute("role")).toBe("status");
    expect(status?.getAttribute("aria-live")).toBe("polite");
    expect(status?.textContent).toBe("회복약 2개");
    expect(document.activeElement).toBe(dialog);

    document.querySelector<HTMLButtonElement>("[data-testid='gift-cancel']")?.click();
    await pending;
    expect(document.querySelector("[data-testid='gift-scene']")).toBeNull();
  });

  it("names the present-item dialog with the question and speaks the next item", async () => {
    const scene = sceneFixture({});
    const pending = playPresentItem(scene, {
      kind: "presentItem",
      prompt: "증거를 제시하라",
      items: [
        { itemId: "item_knife", count: 1 },
        { itemId: "item_letter", count: 2 },
      ],
      settings: DEFAULT_MESSAGE_WINDOW_SETTINGS,
    });
    const dialog = document.querySelector<HTMLElement>("[data-testid='present-item-scene']");
    const title = document.getElementById("runtime-present-title");
    expect(dialog?.getAttribute("role")).toBe("dialog");
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    expect(dialog?.getAttribute("aria-labelledby")).toBe(title?.id);
    expect(title?.textContent).toBe("증거를 제시하라");
    expect(document.querySelector("[data-testid='present-item-list']")?.getAttribute("aria-label")).toBe("보여줄 물건");
    expect(document.querySelector("[data-testid='present-item-item_knife']")?.getAttribute("aria-label")).toBe("item_knife 1개");
    expect(document.querySelector("[data-testid='present-item-item_letter']")?.getAttribute("aria-label")).toBe("item_letter 2개");

    const status = document.querySelector<HTMLElement>("[data-testid='present-item-announcement']");
    expect(status?.textContent).toBe("item_knife 1개");
    expect(document.activeElement).toBe(dialog);

    dialog?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(status?.textContent).toBe("item_letter 2개");

    document.querySelector<HTMLButtonElement>("[data-testid='present-item-cancel']")?.click();
    await expect(pending).resolves.toBeUndefined();
    expect(document.querySelector("[data-testid='present-item-scene']")).toBeNull();
  });
});
