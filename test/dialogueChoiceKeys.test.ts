// @vitest-environment happy-dom
// 필드에서 WASD 로 걷던 플레이어가 선택지에서는 방향키만 쓸 수 있었다.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDialogueUI } from "@/player/dialogue";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { markPlayerPadKey } from "@/player/confirmMashGuard";

const session = { variables: {}, actorNames: {}, gold: 0 };

function press(key: string): void {
  document.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
}

/** OS 자동반복으로 배달된 키. 실제 키보드는 isTrusted 지만 테스트에서는 repeat 만으로 그 자리를 잡는다. */
function repeatKey(key: string): void {
  const event = new KeyboardEvent("keydown", { key, repeat: true, bubbles: true, cancelable: true });
  Object.defineProperty(event, "isTrusted", { value: true });
  document.dispatchEvent(event);
}

/** 게임패드·가상패드가 보내는 반복은 플레이어 입력 표시가 붙어 온다. */
function padRepeatKey(key: string): void {
  document.dispatchEvent(markPlayerPadKey(new KeyboardEvent("keydown", { key, repeat: true, bubbles: true, cancelable: true })));
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

  it("does not spin the cursor when a direction key is held down", async () => {
    store.replaceProject(createBlankProject());
    const host = document.createElement("div");
    document.body.append(host);
    const dialogue = createDialogueUI(host);
    const pending = dialogue.showChoices({
      options: [{ text: "숲" }, { text: "마을" }, { text: "성" }, { text: "항구" }],
      playerTileY: 0,
      mapHeight: 20,
      textContext: { session, project: store.getCurrent() },
    });

    expect(selectedId()).toBe("runtime-choice-0");
    press("ArrowDown");
    expect(selectedId()).toBe("runtime-choice-1");
    // 누르고 있는 동안 브라우저가 보내는 자동반복(초당 30번쯤)이 커서를 한 바퀴 돌리면 안 된다.
    // 자동반복은 33ms 간격으로 오지만 커서는 사람이 훑는 속도로만 내려간다.
    let fakeNow = performance.now();
    const clock = vi.spyOn(performance, "now").mockImplementation(() => fakeNow);
    try {
      for (const step of [33, 33, 33]) {
        fakeNow += step;
        repeatKey("ArrowDown");
      }
      expect(selectedId()).toBe("runtime-choice-1");
      fakeNow += 101; // 같은 키를 계속 누르고 있어도 사람이 훑는 간격이 지나면 한 줄 내려간다
      repeatKey("ArrowDown");
      expect(selectedId()).toBe("runtime-choice-2");
    } finally {
      clock.mockRestore();
    }
    press("Enter");
    await expect(pending).resolves.toBe(1);
  });

  it("still walks the list while a gamepad stick is held", async () => {
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

    padRepeatKey("ArrowDown");
    expect(selectedId()).toBe("runtime-choice-1");
    // 스틱을 계속 밀면 한 줄씩 내려간다(누른 채로도 목록을 훑을 수 있어야 한다).
    let fakeNow = performance.now();
    const clock = vi.spyOn(performance, "now").mockImplementation(() => fakeNow);
    try {
      fakeNow += 160;
      padRepeatKey("ArrowDown");
    } finally {
      clock.mockRestore();
    }
    expect(selectedId()).toBe("runtime-choice-2");
    press("Enter");
    await expect(pending).resolves.toBe(2);
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
