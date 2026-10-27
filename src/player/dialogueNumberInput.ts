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
        const ch = value[i] ?? "";
        const isCursor = i === value.length && value.length < digits;
        slots.append(
          el("div", {
            class: `number-input-slot${ch ? " filled" : " empty"}${isCursor ? " cursor" : ""}`,
            // Empty slots stay blank (not "0") so unfilled PIN digits are unambiguous.
            text: ch,
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
    const setValue = (next: string): void => {
      const cleaned = next.replace(/\D/g, "").slice(0, digits);
      if (cleaned === value) return;
      value = cleaned;
      syncSlots();
      announcement.textContent = spokenDigits(value);
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
        setValue(`${value}${event.key}`);
        return;
      }
      if (event.key === "Backspace") {
        event.preventDefault();
        event.stopPropagation();
        setValue(value.slice(0, -1));
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
