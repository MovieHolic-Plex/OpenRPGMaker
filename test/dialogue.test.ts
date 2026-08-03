// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDialogueUI,
  dialogueSpeedDelayMs,
  isDialogueAdvanceKey,
  resolveDialogueText,
} from "@/player/dialogue";
import { createBlankProject } from "@/project/defaults";

describe("dialogue keyboard controls", () => {
  it("accepts normalized keyboard-only advance keys", () => {
    expect(isDialogueAdvanceKey("Enter")).toBe(true);
    expect(isDialogueAdvanceKey("ENTER")).toBe(true);
    expect(isDialogueAdvanceKey(" ")).toBe(true);
    expect(isDialogueAdvanceKey("Space")).toBe(true);
    expect(isDialogueAdvanceKey("E")).toBe(true);
    expect(isDialogueAdvanceKey("z")).toBe(true);
    expect(isDialogueAdvanceKey("Z")).toBe(true);
    expect(isDialogueAdvanceKey("ArrowDown")).toBe(false);
    // 취소 키는 대사를 진행시키지 않는다 — Esc 만 "진행"으로 새던 결함의 회귀 방지.
    expect(isDialogueAdvanceKey("Escape")).toBe(false);
    expect(isDialogueAdvanceKey("x")).toBe(false);
    expect(isDialogueAdvanceKey("X")).toBe(false);
  });
});

describe("dialogue text codes", () => {
  it("resolves variables, actor names, colors, and escaped backslashes at display time", () => {
    const project = createBlankProject();
    project.database.actors = [{ ...project.database.actors[0]!, id: "hero", name: "Hero" }];
    expect(project.variables[0]?.id).toBe("var_0001");
    const context = {
      session: {
        variables: { var_0001: 42 },
        actorNames: { hero: "Renamed" },
      },
      project,
    };

    expect(resolveDialogueText("Gold \\v[1] / \\n[1] / \\c[2]red / \\\\", context)).toBe("Gold 42 / Renamed / red / \\");
  });

  it("keeps raw-index variable fallback for custom or legacy sessions", () => {
    const project = createBlankProject();
    const context = {
      session: {
        variables: { "1": 7 },
        actorNames: {},
      },
      project,
    };

    expect(resolveDialogueText("\\v[1]", context)).toBe("7");
  });

  it("falls back to database actor names and zero for missing variables", () => {
    const project = createBlankProject();
    project.database.actors = [{ ...project.database.actors[0]!, id: "hero", name: "Hero" }];
    const context = {
      session: { variables: {}, actorNames: {} },
      project,
    };

    expect(resolveDialogueText("\\n[1]:\\v[99]", context)).toBe("Hero:0");
  });
});

describe("dialogue speaker nameplate", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("renders speaker outside the body as a nameplate pill", async () => {
    vi.useFakeTimers();
    const host = document.createElement("div");
    document.body.append(host);
    const dialogue = createDialogueUI(host);
    const shown = dialogue.showText({
      speaker: "March",
      body: "Hello",
      playerTileY: 0,
      mapHeight: 20,
      textContext: {
        session: { variables: {}, actorNames: {}, gold: 0 },
        project: createBlankProject(),
      },
    });

    const box = host.querySelector(".dialogue-box");
    const speaker = host.querySelector('[data-testid="dialogue-speaker"]');
    const body = host.querySelector(".dialogue-box .body");
    expect(box?.classList.contains("has-speaker")).toBe(true);
    expect(speaker?.classList.contains("speaker-nameplate")).toBe(true);
    expect(speaker?.textContent).toBe("March");
    expect(body?.contains(speaker as Node)).toBe(false);

    await vi.advanceTimersByTimeAsync(200);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await shown;
    vi.useRealTimers();
  });
});

describe("dialogue control playback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("maps speed values to bounded character delays", () => {
    expect(dialogueSpeedDelayMs(1)).toBe(8);
    expect(dialogueSpeedDelayMs(3)).toBe(24);
    expect(dialogueSpeedDelayMs(20)).toBe(160);
    expect(dialogueSpeedDelayMs(99)).toBe(160);
  });

  it("executes one-second delay and input pause before continuing", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const dialogue = createDialogueUI(host);
    const shown = dialogue.showText(textRequest(String.raw`A\|B\!C`));

    await vi.advanceTimersByTimeAsync(24);
    expect(dialogueBody(host)).toBe("A");
    await vi.advanceTimersByTimeAsync(24);
    await vi.advanceTimersByTimeAsync(999);
    expect(dialogueBody(host)).toBe("A");
    await vi.advanceTimersByTimeAsync(1);
    expect(dialogueBody(host)).toBe("AB");
    await vi.advanceTimersByTimeAsync(24);
    expect(dialogueBody(host)).toBe("AB");

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await vi.advanceTimersByTimeAsync(0);
    expect(dialogueBody(host)).toBe("ABC");
    await vi.advanceTimersByTimeAsync(24);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await shown;
  });

  it("shows the live session gold window", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const dialogue = createDialogueUI(host);
    const shown = dialogue.showText(textRequest(String.raw`A\$B`, 731));

    await vi.advanceTimersByTimeAsync(48);
    expect(dialogueBody(host)).toBe("AB");
    expect(host.querySelector<HTMLElement>('[data-testid="dialogue-gold-window"]')?.textContent).toContain("731 G");

    await vi.advanceTimersByTimeAsync(24);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await shown;
  });

  it("applies custom speed, instant mode, and normal-speed restoration", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const dialogue = createDialogueUI(host);
    const shown = dialogue.showText(textRequest(String.raw`\s[20]A\>BC\<DE`));

    await vi.advanceTimersByTimeAsync(24);
    expect(dialogueBody(host)).toBe("A");
    await vi.advanceTimersByTimeAsync(159);
    expect(dialogueBody(host)).toBe("A");
    await vi.advanceTimersByTimeAsync(1);
    await vi.advanceTimersByTimeAsync(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(dialogueBody(host)).toBe("ABCD");
    await vi.advanceTimersByTimeAsync(159);
    expect(dialogueBody(host)).toBe("ABCD");
    await vi.advanceTimersByTimeAsync(1);
    expect(dialogueBody(host)).toBe("ABCDE");

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await shown;
  });

  it("closes automatically after an auto-close control", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const dialogue = createDialogueUI(host);
    let resolved = false;
    const shown = dialogue.showText(textRequest(String.raw`자동\^`)).then(() => {
      resolved = true;
    });

    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(0);
    expect(resolved).toBe(true);
    expect(host.querySelector(".dialogue-box")).toBeNull();
    await shown;
  });
});

function textRequest(body: string, gold = 0) {
  return {
    body,
    playerTileY: 0,
    mapHeight: 20,
    textContext: {
      session: { variables: {}, actorNames: {}, gold },
      project: createBlankProject(),
    },
  };
}

function dialogueBody(host: HTMLElement): string {
  return host.querySelector<HTMLElement>(".dialogue-box .body")?.textContent ?? "";
}

describe("dialogue bust face overlay", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("renders large bust above the message window for -bust resources", async () => {
    vi.useFakeTimers();
    const host = document.createElement("div");
    document.body.append(host);
    const dialogue = createDialogueUI(host);
    const shown = dialogue.showText({
      speaker: "Actor1",
      body: "흉상 대사 테스트",
      playerTileY: 0,
      mapHeight: 20,
      face: {
        resourceId: "generated-face-actor1-bust",
        faceIndex: 0,
        position: "left",
        flipHorizontally: false,
      },
      textContext: {
        session: { variables: {}, actorNames: {}, gold: 0 },
        project: createBlankProject(),
      },
    });

    const overlay = host.querySelector(".dialogue-overlay");
    const face = host.querySelector('[data-testid="dialogue-face"]');
    expect(overlay?.classList.contains("has-bust-face")).toBe(true);
    expect(face?.classList.contains("dialogue-face-bust")).toBe(true);
    expect(face?.getAttribute("data-position") ?? face?.classList.contains("dialogue-face-side-left")).toBeTruthy();
    expect(face?.getAttribute("data-face-mode")).toBe("bust");
    expect(host.querySelector(".dialogue-content")?.classList.contains("has-bust")).toBe(true);

    await vi.advanceTimersByTimeAsync(200);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await shown;
  });
});

  it("places whole-image portrait on the right when position is right", async () => {
    vi.useFakeTimers();
    const host = document.createElement("div");
    document.body.append(host);
    const dialogue = createDialogueUI(host);
    const shown = dialogue.showText({
      speaker: "Actor1",
      body: "오른쪽 흉상",
      playerTileY: 0,
      mapHeight: 20,
      face: {
        resourceId: "generated-face-actor1-bust",
        faceIndex: 0,
        position: "right",
        flipHorizontally: false,
      },
      textContext: {
        session: { variables: {}, actorNames: {}, gold: 0 },
        project: createBlankProject(),
      },
    });
    const box = host.querySelector(".dialogue-box");
    const face = host.querySelector('[data-testid="dialogue-face"]');
    expect(box?.classList.contains("bust-right")).toBe(true);
    expect(face?.getAttribute("data-position")).toBe("right");
    expect(face?.classList.contains("dialogue-face-side-right")).toBe(true);
    await vi.advanceTimersByTimeAsync(200);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await shown;
  });

  it("uses full portrait mode for -full resources", async () => {
    vi.useFakeTimers();
    const host = document.createElement("div");
    document.body.append(host);
    const dialogue = createDialogueUI(host);
    const shown = dialogue.showText({
      speaker: "Actor1",
      body: "전신",
      playerTileY: 0,
      mapHeight: 20,
      face: {
        resourceId: "generated-face-actor1-full",
        faceIndex: 0,
        position: "left",
        flipHorizontally: false,
      },
      textContext: {
        session: { variables: {}, actorNames: {}, gold: 0 },
        project: createBlankProject(),
      },
    });
    const face = host.querySelector('[data-testid="dialogue-face"]');
    expect(face?.getAttribute("data-face-mode")).toBe("full");
    expect(face?.classList.contains("dialogue-face-full")).toBe(true);
    await vi.advanceTimersByTimeAsync(200);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await shown;
  });

