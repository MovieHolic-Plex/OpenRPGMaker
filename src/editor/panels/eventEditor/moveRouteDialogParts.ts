import { el } from "@/util/dom";
import type { MoveCommand } from "@/project/types";
import type { MoveRouteCommandContext } from "./moveRouteCommandCatalog";

export function renderTopBar(
  initialFrequency: number,
  onFrequencyChange: (frequency: number) => void,
  parameters: MoveRouteCommandContext & {
    readonly onSwitchId: (value: string) => void;
    readonly onSpriteId: (value: string) => void;
    readonly onSoundId: (value: string) => void;
  }
): HTMLElement {
  return el("div", {
    class: "event-page-move-route-top",
    children: [
      el("fieldset", {
        class: "event-page-move-route-event",
        children: [
          el("legend", { text: "이벤트" }),
          el("select", {
            attrs: { disabled: "" },
            children: [el("option", { text: "이 이벤트" })],
          }),
        ],
      }),
      el("fieldset", {
        class: "event-page-move-route-frequency",
        children: [el("legend", { text: "빈도" }), renderFrequencyRadios(initialFrequency, onFrequencyChange)],
      }),
      renderParameterPanel(parameters),
    ],
  });
}

export function renderFooter(close: () => void, onOk: () => void): HTMLElement {
  return el("div", {
    class: "event-page-move-route-footer",
    children: [
      routeFooterButton("확인", "event-page-move-route-ok", onOk),
      routeFooterButton("취소", "event-page-move-route-cancel", close),
      routeFooterButton("도움말", "event-page-move-route-help", close),
    ],
  });
}

export function checkboxLabel(input: HTMLInputElement, label: string): HTMLElement {
  return el("label", { children: [input, el("span", { text: label })] });
}

export function routeUtilityButton(label: string, testId: string): HTMLButtonElement {
  return el("button", {
    class: "event-page-move-route-utility",
    text: label,
    attrs: { type: "button" },
    dataset: { testid: testId },
  });
}

export function updateDeleteState(
  deleteButton: HTMLButtonElement,
  deleteAllButton: HTMLButtonElement,
  moves: readonly MoveCommand[],
  selectedIndex: number
): void {
  deleteButton.disabled = selectedIndex < 0 || selectedIndex >= moves.length;
  deleteAllButton.disabled = moves.length === 0;
}

function renderFrequencyRadios(initialFrequency: number, onChange: (frequency: number) => void): HTMLElement {
  const wrap = el("div", { class: "event-page-move-route-frequency-radios" });
  for (let value = 1; value <= 8; value += 1) {
    const radio = el("input", {
      attrs: { type: "radio", name: "event-page-move-route-frequency", value: String(value) },
      dataset: { testid: `event-page-move-route-frequency-${value}` },
    });
    radio.checked = value === initialFrequency;
    radio.addEventListener("change", () => {
      if (radio.checked) onChange(value);
    });
    wrap.append(el("label", { children: [radio, el("span", { text: String(value) })] }));
  }
  return wrap;
}

function renderParameterPanel(parameters: MoveRouteCommandContext & {
  readonly onSwitchId: (value: string) => void;
  readonly onSpriteId: (value: string) => void;
  readonly onSoundId: (value: string) => void;
}): HTMLElement {
  return el("fieldset", {
    class: "event-page-move-route-parameters",
    children: [
      el("legend", { text: "매개변수" }),
      parameterInput("스위치 ID", "event-page-move-route-switch-id", parameters.switchId, parameters.onSwitchId),
      parameterInput("그래픽 ID", "event-page-move-route-graphic-id", parameters.spriteId, parameters.onSpriteId),
      parameterInput("효과음 ID", "event-page-move-route-sound-id", parameters.soundId, parameters.onSoundId),
    ],
  });
}

function parameterInput(
  label: string,
  testId: string,
  value: string,
  onChange: (value: string) => void
): HTMLElement {
  const input = el("input", {
    attrs: { type: "text" },
    value,
    dataset: { testid: testId },
    on: {
      input: (event) => {
        if (event.currentTarget instanceof HTMLInputElement) onChange(event.currentTarget.value.trim());
      },
    },
  });
  return el("label", { children: [el("span", { text: label }), input] });
}

function routeFooterButton(label: string, testId: string, onClick: () => void): HTMLButtonElement {
  return el("button", {
    class: "event-page-move-route-footer-button",
    text: label,
    attrs: { type: "button" },
    dataset: { testid: testId },
    on: { click: onClick },
  });
}
