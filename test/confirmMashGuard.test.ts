// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { createDialogueUI } from "@/player/dialogue";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { markPlayerPadKey, armDialogueConfirmRelease } from "@/player/confirmMashGuard";
import { isolateTimers } from "./mergedTeardown";

// 필드에서 WASD 로 걷던 플레이어가 선택지에서는 방향키만 쓸 수 있었다.
describe("dialogueChoiceKeys", () => {
  isolateTimers();
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
      // 1e5e3ff99f: ←→(A·D)는 받지 않는다 — 패드 스틱이 대각선이면 ArrowDown 과 ArrowRight 가 한꺼번에 와서
      // 둘 다 「다음」이면 한 줄을 건너뛴다. 세로 목록은 W/S · ↑↓ 만 움직인다.
      press("d");
      expect(selectedId()).toBe("runtime-choice-0");
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
      // 커서는 두 줄 내려왔다(새 누름 1 + 간격을 넘긴 반복 1) — 결정은 그 줄을 고른다.
      press("Enter");
      await expect(pending).resolves.toBe(2);
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
});

describe("dialogueTextCancellation", () => {
  isolateTimers();
  const ownedKeys = new Set<EventListenerOrEventListenerObject>();
  beforeEach(() => {
    vi.useFakeTimers();
    const add = document.addEventListener.bind(document);
    vi.spyOn(document, "addEventListener").mockImplementation((type, listener, options) => {
      if (type === "keydown") ownedKeys.add(listener);
      add(type, listener, options);
    });
  });
  afterEach(() => {
    // RED must not leak the broken production listener into the next scenario.
    for (const listener of ownedKeys) document.removeEventListener("keydown", listener);
    ownedKeys.clear();
    vi.clearAllTimers();
    vi.restoreAllMocks();
    vi.useRealTimers();
    window.dispatchEvent(new Event("blur"));
    document.body.replaceChildren();
  });
  function confirm(key = "Enter", { repeat = false, at = 0, release = false } = {}): void {
    const event = new KeyboardEvent(release ? "keyup" : "keydown", { key, repeat, bubbles: true, cancelable: true });
    Object.defineProperty(event, "timeStamp", { value: at });
    document.dispatchEvent(event);
  }
  function fixture() {
    const host = document.createElement("div");
    document.body.append(host);
    const dialogue = createDialogueUI(host);
    const controller = new AbortController();
    const request = { body: "Ready", playerTileY: 0, mapHeight: 20, signal: controller.signal };
    return { host, dialogue, controller, request };
  }
  describe("dialogue text cancellation", () => {
    it("abort during entry cancels the typewriter and presentation timers immediately", async () => {
      const { dialogue, controller, request, host } = fixture();
      const cancelled = expect(dialogue.showText(request)).rejects.toMatchObject({ name: "AbortError" });
      expect(vi.getTimerCount()).toBeGreaterThan(0);
      controller.abort();
      await cancelled;
      expect(host.querySelector(".dialogue-box")).toBeNull();
      expect(vi.getTimerCount()).toBe(0);
    });

    it.each(["abort", "hide", "close", "replace"] as const)("%s settles text cancellation and detaches its listener", async mode => {
      const { host, dialogue, controller, request } = fixture();
      const results: string[] = [];
      const outcome = dialogue.showText(request).then(
        () => results.push("resolved"),
        (error: unknown) => {
          if (!(error instanceof DOMException)) throw error;
          results.push(error.name);
        },
      );
      // Flush the explicitly controlled typewriter, not an elapsed-time guess.
      await vi.runAllTimersAsync();
      if (mode === "abort") controller.abort();
      else if (mode === "hide") dialogue.hide();
      else if (mode === "close") dialogue.close();
      else {
        const replacement = dialogue.showChoices({
          options: [{ text: "First" }, { text: "Second" }], playerTileY: 0, mapHeight: 20,
        });
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        expect(await replacement).toBe(1);
      }
      await Promise.resolve();
      expect(results, "cancelled text must reject rather than hang or accept a later key").toEqual(["AbortError"]);
      await outcome;
      await vi.runAllTimersAsync();
      expect(host.querySelector(".dialogue-box")).toBeNull();
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
      expect(results).toEqual(["AbortError"]);
      expect(vi.getTimerCount()).toBe(0);
    });

    it("ignores composing advance input", async () => {
      const { dialogue, request } = fixture();
      let finished = false;
      const shown = dialogue.showText(request).then(() => { finished = true; });
      await vi.runAllTimersAsync();
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", isComposing: true }));
      confirm("Enter", { release: true });
      await Promise.resolve();
      expect(finished).toBe(false);
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
      await shown;
      expect(finished).toBe(true);
    });

    it("repeats at 160ms across consecutive text commands in one event", async () => {
      const { dialogue, request } = fixture();
      const first = dialogue.showText(request);
      await vi.runAllTimersAsync();
      confirm("Enter", { at: 1000 });
      await first;

      let finished = false;
      const second = dialogue.showText({ ...request, body: "Still the same event" }).then(() => { finished = true; });
      await vi.runAllTimersAsync();
      confirm("Enter", { repeat: true, at: 1159 });
      await Promise.resolve();
      expect(finished).toBe(false);
      confirm("Enter", { repeat: true, at: 1160 });
      await second;
      expect(finished).toBe(true);
    });

    it.each(["Enter", " ", "z", "e"])("requires release and a fresh %j press after a dialogue boundary", async (key) => {
      const { dialogue, request, host } = fixture();
      const before = dialogue.showText(request);
      await vi.runAllTimersAsync();
      confirm(key, { at: 1000 });
      await before;

      armDialogueConfirmRelease();
      const after = dialogue.showText({ ...request, body: "First line after the boundary" });
      await vi.runAllTimersAsync();
      confirm(key, { repeat: true, at: 2000 });
      confirm(key, { at: 2200 });
      const otherKey = key === "Enter" ? "z" : "Enter";
      confirm(otherKey, { at: 2300 });
      confirm(otherKey, { release: true, at: 2350 });
      expect(host.querySelector(".dialogue-box.page-ready .body")?.textContent).toBe("First line after the boundary");

      confirm(key, { release: true, at: 2400 });
      confirm(key, { repeat: true, at: 2600 });
      expect(host.querySelector(".dialogue-box.page-ready .body")?.textContent).toBe("First line after the boundary");
      confirm(key, { at: 2800 });
      await after;
    });

    it.each(["keyup", "blur", "same event"])("requires a fresh choice press after %s", async (handoff) => {
      const { dialogue, request, host } = fixture();
      const before = dialogue.showText(request);
      await vi.runAllTimersAsync();
      confirm();
      await before;
      if (handoff !== "same event") {
        armDialogueConfirmRelease();
        if (handoff === "blur") window.dispatchEvent(new Event("blur"));
        else confirm("Enter", { release: true });
      }

      const choice = dialogue.showChoices({
        options: [{ text: "First" }, { text: "Second" }], playerTileY: 0, mapHeight: 20,
      });
      confirm("Enter", { repeat: true, at: 1000 });
      expect(host.querySelector(".choice-btn.selected")?.textContent).toBe("First");
      if (handoff === "same event") confirm("Enter", { release: true });
      confirm("Enter", { at: 1200 });
      await expect(choice).resolves.toBe(0);
    });
  });
});
