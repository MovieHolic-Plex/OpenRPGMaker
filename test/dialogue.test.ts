// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDialogueUI,
  dialogueSpeedDelayMs,
  isDialogueAdvanceKey,
  resolveDialogueText,
} from "@/player/dialogue";
import { dialoguePresentationProfile } from "@/player/dialoguePresentation";
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

  it("타이핑은 이미 떠 있는 글자의 노드를 교체하지 않는다", async () => {
    // 배선까지 확인하는 단정이다. dialogueTextRenderer 자체는 자기 테스트가 지키지만,
    // dialogue.ts 가 다시 전량 재생성으로 돌아가면 글자별 CSS 연출이 매 틱 되감기고
    // 그 회귀는 화면으로도 computed style 로도 보이지 않는다.
    const host = document.createElement("div");
    document.body.append(host);
    const dialogue = createDialogueUI(host);
    const shown = dialogue.showText(textRequest("가나다"));

    await vi.advanceTimersByTimeAsync(24);
    const first = host.querySelector<HTMLElement>(".dialogue-box .body .dialogue-char");
    expect(first?.textContent).toBe("가");

    await vi.advanceTimersByTimeAsync(24);
    const grown = [...host.querySelectorAll<HTMLElement>(".dialogue-box .body .dialogue-char")];
    expect(grown).toHaveLength(2);
    expect(grown[0]).toBe(first);
    expect(dialogueBody(host)).toBe("가나");

    await vi.advanceTimersByTimeAsync(48);
    expect(dialogueBody(host)).toBe("가나다");
    expect(host.querySelectorAll(".dialogue-box .body .dialogue-char")[0]).toBe(first);

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
    // 창은 퇴장 연출을 재생한 뒤에 빠진다 — 진행은 이미 끝났고 DOM 만 남아 있다.
    expect(host.querySelector(".dialogue-box")).not.toBeNull();
    await vi.advanceTimersByTimeAsync(dialoguePresentationProfile("neutral").exitMs);
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

describe("dialogue presentation lifecycle", () => {
  /** 예약을 손으로 발화시키는 schedule — fake timer 없이 결정적으로 검사한다. */
  function manualSchedule() {
    const queue: { readonly callback: () => void; readonly delayMs: number; cancelled: boolean }[] = [];
    const schedule = (callback: () => void, delayMs: number): (() => void) => {
      const entry = { callback, delayMs, cancelled: false };
      queue.push(entry);
      return () => {
        entry.cancelled = true;
      };
    };
    const flush = (): void => {
      for (const entry of [...queue]) {
        if (!entry.cancelled) entry.callback();
      }
      queue.length = 0;
    };
    return { schedule, queue, flush };
  }

  const box = (host: HTMLElement): HTMLElement | null =>
    host.querySelector<HTMLElement>(".dialogue-box");

  it("세션 첫 창만 진입 연출을 재생하고 이어지는 대사는 재생하지 않는다", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const { schedule, flush } = manualSchedule();
    const dialogue = createDialogueUI(host, schedule);

    const first = dialogue.showText(textRequest("첫 줄"));
    expect(box(host)?.dataset.dialoguePhase).toBe("enter");
    expect(box(host)?.dataset.dialogueEmotion).toBe("neutral");

    // 진입이 끝나면 정착 상태로 넘어간다.
    flush();
    expect(box(host)?.dataset.dialoguePhase).toBe("shown");

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await first;

    // cleanup 이 퇴장을 예약했지만 아직 상자는 살아 있다.
    expect(box(host)?.dataset.dialoguePhase).toBe("exit");

    // 같은 세션의 다음 대사 — 예약이 취소되고 진입 연출은 다시 재생되지 않는다.
    const second = dialogue.showText(textRequest("둘째 줄"));
    expect(box(host)?.dataset.dialoguePhase).toBe("shown");
    expect(dialogueBody(host)).not.toContain("첫 줄");

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await second;
    dialogue.hide();
  });

  it("close() 는 퇴장을 재생한 뒤 비우고, hide() 는 즉시 컷이다", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const { schedule, flush } = manualSchedule();
    const dialogue = createDialogueUI(host, schedule);

    const shown = dialogue.showText(textRequest("본문"));
    flush();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await shown;

    dialogue.close();
    expect(box(host)?.dataset.dialoguePhase).toBe("exit");
    flush();
    expect(box(host)).toBeNull();

    // hide() 는 연출을 기다리지 않는다 — 맵 전환처럼 창이 남으면 안 되는 자리용이다.
    const again = dialogue.showText(textRequest("다시"));
    expect(box(host)).not.toBeNull();
    dialogue.hide();
    expect(box(host)).toBeNull();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await again;
  });

  it("연출 상태는 상자에 있어 resetOverlay 의 className 통짜 대입에 지워지지 않는다", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const { schedule, flush } = manualSchedule();
    const dialogue = createDialogueUI(host, schedule);

    const shown = dialogue.showText({ ...textRequest("분노"), emotion: "angry" });
    const current = box(host);
    expect(current?.dataset.dialogueEmotion).toBe("angry");
    expect(current?.dataset.dialogueShake).toBe("1");
    expect(current?.style.getPropertyValue("--dialogue-enter-ms")).toBe(
      `${dialoguePresentationProfile("angry").enterMs}ms`
    );
    // 오버레이는 className 이 통짜로 덮이는 자리다 — 연출 상태가 여기 있으면 안 된다.
    const overlay = host.querySelector<HTMLElement>(".dialogue-overlay");
    expect(overlay?.dataset.dialogueEmotion).toBeUndefined();

    flush();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await shown;
    dialogue.hide();
  });

  it("스크림은 오버레이의 형제로 살고 창과 함께 켜지고 꺼진다", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const { schedule, flush } = manualSchedule();
    const dialogue = createDialogueUI(host, schedule);
    const scrim = host.querySelector<HTMLElement>(".dialogue-scrim");

    // 오버레이 안에 있으면 화면을 덮을 수 없다 — position-top/bottom 에서 높이가 27% 뿐이다.
    expect(scrim?.parentElement).toBe(host);
    expect(scrim?.nextElementSibling?.className).toBe("dialogue-overlay");
    expect(scrim?.dataset.dialogueScrim).toBeUndefined();

    const shown = dialogue.showText({ ...textRequest("놀람"), emotion: "surprised" });
    expect(scrim?.dataset.dialogueScrim).toBe("on");
    expect(scrim?.dataset.dialogueFlash).toBe("1");
    expect(scrim?.className).toContain("position-");
    expect(scrim?.style.getPropertyValue("--dialogue-scrim-opacity")).toBe(
      String(dialoguePresentationProfile("surprised").scrimOpacity)
    );

    flush();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await shown;
    // 퇴장이 시작되면 스크림도 같이 걷힌다.
    expect(scrim?.dataset.dialogueScrim).toBeUndefined();

    // 다음 대사는 놀람이 아니므로 플래시가 남아 있으면 안 된다.
    const again = dialogue.showText(textRequest("보통"));
    expect(scrim?.dataset.dialogueScrim).toBe("on");
    expect(scrim?.dataset.dialogueFlash).toBeUndefined();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await again;
    dialogue.hide();
    expect(scrim?.dataset.dialogueScrim).toBeUndefined();
    expect(scrim?.className).toBe("dialogue-scrim");
  });

  it("reducedMotion 은 움직임을 끄지만 창은 그대로 뜬다", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const { schedule, flush } = manualSchedule();
    const dialogue = createDialogueUI(host, schedule);

    const shown = dialogue.showText({ ...textRequest("조용히"), emotion: "angry", reducedMotion: true });
    const current = box(host);
    expect(current?.dataset.dialogueMotion).toBe("off");
    expect(current?.dataset.dialogueShake).toBeUndefined();
    expect(current?.dataset.dialogueCharReveal).toBeUndefined();
    // 창 자체는 여전히 나타나야 한다 — opacity 0 으로 남으면 대사가 안 보인다.
    expect(current?.dataset.dialoguePhase).toBe("enter");
    flush();
    expect(current?.dataset.dialoguePhase).toBe("shown");

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await shown;
    dialogue.hide();
  });
});

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

