import type { MessageWindowSettings } from "@/project/types";
import { clearChildren, el } from "@/util/dom";
import { isConfirmKey } from "@/player/keyBindings";

type DialogueSurfaceSettings = {
  readonly settings?: MessageWindowSettings;
  readonly playerTileY: number;
  readonly mapHeight: number;
};

export type DialogueNumberInputRequest = DialogueSurfaceSettings & {
  readonly digits: number;
  readonly prompt?: string;
  readonly showPad?: boolean;
};

type NumberInputSurfaceHelpers = {
  readonly applyTextSettings: (overlay: HTMLElement, box: HTMLElement, request: DialogueNumberInputRequest) => void;
  readonly resetOverlay: (overlay: HTMLElement) => void;
};

const NUMBER_INPUT_TITLE_ID = "runtime-number-input-title";

/** Digits spaced so a screen reader speaks each one, not a hundreds number. Empty is a word. */
function spokenDigits(value: string): string {
  return value ? value.split("").join(" ") : "비어 있음";
}

function tabbable(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>("button, input, select, textarea")].filter((el) => {
    if (el.hasAttribute("disabled") || el.hidden) return false;
    const tabindex = el.getAttribute("tabindex");
    return tabindex === null || Number(tabindex) >= 0;
  });
}

/**
 * 숫자 입력의 확정 단추. 이름 입력의 「지우기」처럼 게임 글자는 한국어다.
 * 편집기 미리보기는 카탈로그가 이 말을 OK·確認·确认 으로 옮긴다.
 */
export const NUMBER_INPUT_CONFIRM_LABEL = "확인";

/** 조작 안내 한 줄. 숫자 키를 몰라도 방향키와 결정 키만으로 넣을 수 있다. */
export const NUMBER_INPUT_HINT = "↑↓ 숫자 · ←→ 자리 · 숫자 키 바로 입력 · Enter 확인";

/**
 * RM2K3-style numeric entry: per-digit slots (not a free text field).
 * Free-text number inputs looked broken under the pixel window skin/font;
 * discrete cells keep each digit crisp and match name-entry UX.
 */
export function showNumberInput(
  overlay: HTMLElement,
  request: DialogueNumberInputRequest,
  helpers: NumberInputSurfaceHelpers
): Promise<number> {
  return new Promise<number>((resolve) => {
    clearChildren(overlay);
    helpers.resetOverlay(overlay);
    const box = el("form", {
      class: "dialogue-box number-input-box",
      dataset: { testid: "runtime-input-number" },
      attrs: {
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": NUMBER_INPUT_TITLE_ID,
      },
    }) as HTMLFormElement;
    helpers.applyTextSettings(overlay, box, request);

    const digits = clampNumberInputDigits(request.digits);
    const titleText = request.prompt?.trim() || "숫자 입력";
    // 자리별 칸 + 커서. 숫자 키는 커서 자리에 쓰고 다음 자리로, ↑↓ 는 커서 자리 숫자를 바꾸고, ←→ 는 자리를 옮긴다.
    // 예전에는 숫자 키만 받아 방향키·패드 사용자는 넣을 방법이 없었고, 네 칸이 다 빈칸이라 지금 값·자리를 몰랐다(장부 hud #35 막음).
    // 값은 앞에서부터 채운 글자다(뒤 빈칸은 버린다, 사이 빈칸은 0) — 「12」를 치면 예전처럼 12.
    const slotValues: string[] = Array.from({ length: digits }, () => "");
    let cursor = 0;
    let value = "";

    // Hidden field keeps existing Playwright fill/type paths working.
    const hidden = el("input", {
      class: "number-input-typing",
      attrs: {
        type: "text",
        inputmode: "numeric",
        maxlength: String(digits),
        autocomplete: "off",
        "aria-label": titleText,
      },
      dataset: { testid: "runtime-input-number-field" },
    }) as HTMLInputElement;

    const slots = el("div", {
      class: "number-input-slots",
      dataset: { testid: "runtime-input-number-slots" },
      attrs: { "aria-hidden": "true" },
    });

    const syncSlots = (): void => {
      clearChildren(slots);
      for (let i = 0; i < digits; i += 1) {
        const ch = slotValues[i] ?? "";
        const isCursor = i === cursor;
        slots.append(
          el("div", {
            class: `number-input-slot${ch ? " filled" : " empty"}${isCursor ? " cursor" : ""}`,
            // 빈 칸은 「0」이 아니라 밑줄 자리표 — 아직 안 넣은 자리와 0 을 구별한다.
            text: ch || "_",
            attrs: ch ? undefined : { "aria-hidden": "true" },
          })
        );
      }
      hidden.value = value;
    };

    // Digit cells are aria-hidden, and keystrokes write the off-screen field in
    // script, so this live region is what gets spoken. The empty start stays
    // quiet — the dialog name already says the prompt.
    const announcement = el("div", {
      class: "number-input-announcement",
      dataset: { testid: "runtime-input-number-announcement" },
      attrs: { role: "status", "aria-live": "polite", "aria-atomic": "true" },
    });
    const valueOfSlots = (): string => {
      let last = -1;
      for (let i = 0; i < digits; i += 1) if (slotValues[i]) last = i;
      return slotValues.slice(0, last + 1).map((ch) => ch || "0").join("");
    };
    const commit = (): void => {
      const next = valueOfSlots();
      const changed = next !== value;
      value = next;
      syncSlots();
      if (changed) announcement.textContent = spokenDigits(value);
    };
    /** 문자열 통째로 넣기(숨김 칸 fill·패드). 커서는 끝 다음 자리. */
    const setValue = (next: string): void => {
      const cleaned = next.replace(/\D/g, "").slice(0, digits);
      for (let i = 0; i < digits; i += 1) slotValues[i] = cleaned[i] ?? "";
      cursor = Math.min(cleaned.length, digits - 1);
      commit();
    };
    /** 커서 자리에 숫자를 쓴다. 앞의 빈 자리는 0 으로 채워 보이는 칸과 값이 같게 한다. */
    const writeDigit = (digit: string, advance: boolean): void => {
      for (let i = 0; i < cursor; i += 1) if (!slotValues[i]) slotValues[i] = "0";
      slotValues[cursor] = digit;
      if (advance && cursor < digits - 1) cursor += 1;
      commit();
    };
    const typeDigit = (digit: string): void => {
      // 마지막 자리까지 다 찬 뒤의 숫자 키는 무시한다(예전과 같다) — ↑↓·←→ 로 고친다.
      if (cursor === digits - 1 && slotValues[cursor] && value.length === digits) return;
      writeDigit(digit, true);
    };
    const stepDigit = (delta: 1 | -1): void => {
      const current = Number.parseInt(slotValues[cursor] || "0", 10);
      writeDigit(String((current + delta + 10) % 10), false);
    };
    const moveCursor = (delta: 1 | -1): void => {
      const next = Math.max(0, Math.min(digits - 1, cursor + delta));
      if (next === cursor) return;
      cursor = next;
      syncSlots();
    };
    const erase = (): void => {
      if (slotValues[cursor]) slotValues[cursor] = "";
      else if (cursor > 0) { cursor -= 1; slotValues[cursor] = ""; }
      commit();
    };

    const finish = (): void => {
      document.removeEventListener("keydown", onKey, true);
      const parsed = Number.parseInt(value || "0", 10);
      const maxValue = 10 ** digits - 1;
      clearChildren(overlay);
      helpers.resetOverlay(overlay);
      resolve(Number.isFinite(parsed) ? Math.min(maxValue, Math.max(0, parsed)) : 0);
    };

    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Tab") {
        const items = tabbable(box);
        if (items.length === 0) return;
        event.preventDefault();
        event.stopPropagation();
        const current = items.indexOf(document.activeElement as HTMLElement);
        if (current < 0) {
          (event.shiftKey ? items[items.length - 1] : items[0])?.focus();
          return;
        }
        const delta = event.shiftKey ? -1 : 1;
        items[(current + delta + items.length) % items.length]?.focus();
        return;
      }
      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault();
        event.stopPropagation();
        typeDigit(event.key);
        return;
      }
      if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        event.stopPropagation();
        erase();
        return;
      }
      const arrow = event.key === "ArrowUp" ? "up" : event.key === "ArrowDown" ? "down" : event.key === "ArrowLeft" ? "left" : event.key === "ArrowRight" ? "right" : null;
      if (arrow) {
        event.preventDefault();
        event.stopPropagation();
        if (arrow === "up") stepDigit(1);
        else if (arrow === "down") stepDigit(-1);
        else moveCursor(arrow === "left" ? -1 : 1);
        return;
      }
      if (isConfirmKey(event.key)) {
        event.preventDefault();
        event.stopPropagation();
        finish();
      }
    };

    hidden.addEventListener("input", () => {
      setValue(hidden.value);
    });
    box.addEventListener("submit", (event) => {
      event.preventDefault();
      finish();
    });

    const children: HTMLElement[] = [
      el("div", {
        class: "number-input-title",
        text: titleText,
        attrs: { id: NUMBER_INPUT_TITLE_ID },
        dataset: { testid: "runtime-input-number-title" },
      }),
      slots,
      el("div", {
        class: "number-input-hint",
        text: NUMBER_INPUT_HINT,
        dataset: { testid: "runtime-input-number-hint" },
      }),
      hidden,
      announcement,
    ];

    if (request.showPad) {
      children.push(buildNumberPad(digits, () => value, setValue, finish));
    }

    children.push(
      el("button", {
        class: "number-input-ok",
        text: NUMBER_INPUT_CONFIRM_LABEL,
        attrs: { type: "submit" },
        dataset: { testid: "runtime-input-number-ok" },
      })
    );

    box.append(...children);
    document.addEventListener("keydown", onKey, true);
    overlay.append(box);
    syncSlots();
    hidden.focus();
  });
}

function buildNumberPad(
  digits: number,
  getValue: () => string,
  setValue: (next: string) => void,
  finish: () => void
): HTMLElement {
  const pad = el("div", {
    class: "number-input-pad",
    dataset: { testid: "runtime-input-number-pad" },
  });
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "←", "0", NUMBER_INPUT_CONFIRM_LABEL] as const;
  for (const key of keys) {
    const btn = el("button", {
      class: `number-input-pad-key${key === NUMBER_INPUT_CONFIRM_LABEL ? " ok" : ""}${key === "←" ? " back" : ""}`,
      text: key,
      attrs: { type: "button", ...(key === "←" ? { "aria-label": "한 자리 지우기" } : {}) },
    });
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      if (key === NUMBER_INPUT_CONFIRM_LABEL) {
        finish();
        return;
      }
      if (key === "←") {
        setValue(getValue().slice(0, -1));
        return;
      }
      setValue(`${getValue()}${key}`.slice(0, digits));
    });
    pad.append(btn);
  }
  return pad;
}

function clampNumberInputDigits(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(6, Math.trunc(value)));
}
