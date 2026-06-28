import type { MessageWindowSettings } from "@/project/types";
import { clearChildren, el } from "@/util/dom";

type DialogueSurfaceSettings = {
  readonly settings?: MessageWindowSettings;
  readonly playerTileY: number;
  readonly mapHeight: number;
};

export type DialogueNumberInputRequest = DialogueSurfaceSettings & {
  readonly digits: number;
};

type NumberInputSurfaceHelpers = {
  readonly applyTextSettings: (overlay: HTMLElement, box: HTMLElement, request: DialogueNumberInputRequest) => void;
  readonly resetOverlay: (overlay: HTMLElement) => void;
};

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
    const input = el("input", {
      class: "number-input-field",
      attrs: {
        type: "text",
        inputmode: "numeric",
        maxlength: String(digits),
        autocomplete: "off",
        "aria-label": "숫자 입력",
      },
      dataset: { testid: "runtime-input-number-field" },
    }) as HTMLInputElement;
    const maxValue = (10 ** digits) - 1;

    const finish = (): void => {
      document.removeEventListener("keydown", onKey, true);
      const parsed = Number.parseInt(input.value || "0", 10);
      clearChildren(overlay);
      helpers.resetOverlay(overlay);
      resolve(Number.isFinite(parsed) ? Math.min(maxValue, Math.max(0, parsed)) : 0);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault();
        event.stopPropagation();
        input.value = `${input.value}${event.key}`.slice(0, digits);
        return;
      }
      if (event.key === "Backspace") {
        event.preventDefault();
        event.stopPropagation();
        input.value = input.value.slice(0, -1);
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        event.stopPropagation();
        finish();
      }
    };
    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "").slice(0, digits);
    });
    box.addEventListener("submit", (event) => {
      event.preventDefault();
      finish();
    });
    box.append(
      el("div", { class: "number-input-title", text: "숫자 입력" }),
      input,
      el("button", {
        class: "number-input-ok",
        text: "OK",
        attrs: { type: "submit" },
        dataset: { testid: "runtime-input-number-ok" },
      })
    );
    document.addEventListener("keydown", onKey, true);
    overlay.append(box);
    input.focus();
  });
}

function clampNumberInputDigits(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(6, Math.trunc(value)));
}
