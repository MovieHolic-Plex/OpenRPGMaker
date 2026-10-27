// @vitest-environment happy-dom
// 숫자 입력은 대사 상자 안 폼인데 이름이 없었고, 자릿수는 숨긴 칸이라 눌러도 읽히지 않았다.
import { afterEach, describe, expect, it } from "vitest";
import { showNumberInput } from "@/player/dialogueNumberInput";

afterEach(() => {
  document.body.replaceChildren();
});

function open(options: { readonly prompt?: string; readonly showPad?: boolean; readonly digits?: number } = {}) {
  const overlay = document.createElement("div");
  document.body.append(overlay);
  const pending = showNumberInput(overlay, {
    digits: options.digits ?? 4,
    playerTileY: 0,
    mapHeight: 20,
    ...(options.prompt === undefined ? { prompt: "비밀번호" } : { prompt: options.prompt }),
    ...(options.showPad ? { showPad: true } : {}),
  }, {
    applyTextSettings() {},
    resetOverlay() {},
  });
  void pending.catch(() => undefined);
  return overlay;
}

function press(key: string, init: KeyboardEventInit = {}): void {
  document.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init }));
}

function close(overlay: HTMLElement): void {
  overlay.querySelector<HTMLButtonElement>("[data-testid='runtime-input-number-ok']")?.click();
}

describe("number input accessibility", () => {
  it("names the dialog, speaks each digit, and keeps Tab inside", () => {
    const overlay = open();
    const dialog = overlay.querySelector<HTMLElement>("[data-testid='runtime-input-number']");
    expect(dialog?.getAttribute("role")).toBe("dialog");
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    expect(dialog?.getAttribute("aria-labelledby")).toBe("runtime-number-input-title");
    expect(overlay.querySelector("#runtime-number-input-title")?.textContent).toBe("비밀번호");
    expect(overlay.querySelector("[data-testid='runtime-input-number-field']")?.getAttribute("aria-label")).toBe("비밀번호");

    const announcement = overlay.querySelector("[data-testid='runtime-input-number-announcement']");
    expect(announcement?.getAttribute("role")).toBe("status");
    expect(announcement?.getAttribute("aria-live")).toBe("polite");
    expect(announcement?.textContent).toBe("");

    press("1");
    press("2");
    expect(announcement?.textContent).toBe("1 2");
    press("Backspace");
    expect(announcement?.textContent).toBe("1");
    press("Backspace");
    expect(announcement?.textContent).toBe("비어 있음");
    press("Backspace");
    expect(announcement?.textContent).toBe("비어 있음");

    const field = overlay.querySelector<HTMLElement>("[data-testid='runtime-input-number-field']");
    const ok = overlay.querySelector<HTMLElement>("[data-testid='runtime-input-number-ok']");
    field?.focus();
    press("Tab", { shiftKey: true });
    expect(document.activeElement).toBe(ok);
    press("Tab");
    expect(document.activeElement).toBe(field);

    close(overlay);
    expect(overlay.querySelector("[data-testid='runtime-input-number']")).toBeNull();
  });

  it("names the pad's backspace key and announces a pad press", () => {
    const overlay = open({ showPad: true });
    const back = [...overlay.querySelectorAll<HTMLButtonElement>(".number-input-pad-key")].find((button) => button.textContent === "←");
    expect(back?.getAttribute("aria-label")).toBe("한 자리 지우기");
    expect(back?.textContent).toBe("←");

    overlay.querySelector<HTMLButtonElement>(".number-input-pad-key")?.click();
    const announcement = overlay.querySelector("[data-testid='runtime-input-number-announcement']");
    expect(announcement?.textContent).toBe("1");
    back?.click();
    expect(announcement?.textContent).toBe("비어 있음");

    const field = overlay.querySelector<HTMLElement>("[data-testid='runtime-input-number-field']");
    const firstPad = overlay.querySelector<HTMLElement>(".number-input-pad-key");
    field?.focus();
    press("Tab");
    expect(document.activeElement).toBe(firstPad);
    close(overlay);
  });

  it("falls back to the default title when the prompt is blank", () => {
    const overlay = open({ prompt: "  " });
    expect(overlay.querySelector("#runtime-number-input-title")?.textContent).toBe("숫자 입력");
    expect(overlay.querySelector("[data-testid='runtime-input-number-field']")?.getAttribute("aria-label")).toBe("숫자 입력");
    close(overlay);
  });
});
