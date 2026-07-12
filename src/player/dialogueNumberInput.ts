import type { MessageWindowSettings } from "@/project/types";
import { clearChildren, el } from "@/util/dom";

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
        slots.append(
          el("div", {
            class: `number-input-slot${ch ? " filled" : ""}${i === value.length ? " cursor" : ""}`,
            text: ch || "0",
          })
        );
      }
      hidden.value = value;
    };

    const setValue = (next: string): void => {
      value = next.replace(/\D/g, "").slice(0, digits);
      syncSlots();
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
      if (event.key === "Enter" || event.key === " ") {
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
        dataset: { testid: "runtime-input-number-title" },
      }),
      slots,
      hidden,
    ];

    if (request.showPad) {
      children.push(buildNumberPad(digits, () => value, setValue, finish));
    }

    children.push(
      el("button", {
        class: "number-input-ok",
        text: "OK",
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
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "←", "0", "OK"] as const;
  for (const key of keys) {
    const btn = el("button", {
      class: `number-input-pad-key${key === "OK" ? " ok" : ""}${key === "←" ? " back" : ""}`,
      text: key,
      attrs: { type: "button" },
    });
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      if (key === "OK") {
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
