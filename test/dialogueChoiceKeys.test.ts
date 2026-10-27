// @vitest-environment happy-dom
// 필드에서 WASD 로 걷던 플레이어가 선택지에서는 방향키만 쓸 수 있었다.
import { afterEach, describe, expect, it } from "vitest";
import { createDialogueUI } from "@/player/dialogue";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

const session = { variables: {}, actorNames: {}, gold: 0 };

function press(key: string): void {
  document.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
}

function selectedId(): string | null {
  return document.querySelector(".choice-btn.selected")?.getAttribute("data-testid") ?? null;
}

describe("choice cursor keys", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("moves the cursor with WASD the same way arrow keys do, then confirms that row", async () => {
    store.replaceProject(createBlankProject());
    const host = document.createElement("div");
    document.body.append(host);
    const dialogue = createDialogueUI(host);
    const pending = dialogue.showChoices({
      options: [{ text: "숲" }, { text: "마을" }, { text: "성" }],
      playerTileY: 0,
      mapHeight: 20,
      textContext: { session, project: store.getCurrent() },
    });

    expect(selectedId()).toBe("runtime-choice-0");
    press("s");
    expect(selectedId()).toBe("runtime-choice-1");
    press("w");
    expect(selectedId()).toBe("runtime-choice-0");
    press("d");
    expect(selectedId()).toBe("runtime-choice-1");
    press("a");
    expect(selectedId()).toBe("runtime-choice-0");
    press("W");
    expect(selectedId()).toBe("runtime-choice-2");
    press("ArrowDown");
    expect(selectedId()).toBe("runtime-choice-0");
    press("S");
    expect(selectedId()).toBe("runtime-choice-1");
    press("Enter");
    await expect(pending).resolves.toBe(1);
  });

  it("still confirms the highlighted row with E", async () => {
    store.replaceProject(createBlankProject());
    const host = document.createElement("div");
    document.body.append(host);
    const dialogue = createDialogueUI(host);
    const pending = dialogue.showChoices({
      options: [{ text: "숲" }, { text: "마을" }],
      playerTileY: 0,
      mapHeight: 20,
      textContext: { session, project: store.getCurrent() },
    });

    press("e");
    await expect(pending).resolves.toBe(0);
  });
});
