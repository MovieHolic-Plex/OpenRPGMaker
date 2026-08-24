import {
  ASSISTANT_TEMPERATURES,
  type AssistantTemperature,
} from "@/editor/assistantTemperature";
import { el } from "@/util/dom";

export type AssistantTemperatureMenuVariant = "header" | "composer";

/** 헤더와 컴포저가 공유하는 아이콘형 대기 화면 선택기. */
export function createAssistantTemperatureMenuSection(options: {
  readonly variant: AssistantTemperatureMenuVariant;
  readonly current: () => AssistantTemperature;
  readonly close: () => void;
  readonly onChange: (next: AssistantTemperature) => void;
}): HTMLElement {
  const prefix = options.variant === "header" ? "ai-temperature" : "ai-command-temperature";
  const itemClass = options.variant === "header" ? "ai-more-menu-item" : "ai-command-menu-item";
  const buttons = ASSISTANT_TEMPERATURES.map((item) =>
    el("button", {
      class: `${itemClass} ai-temperature-option`,
      text: item.icon,
      attrs: {
        type: "button",
        role: "menuitemradio",
        title: item.label,
        "aria-label": item.label,
        "aria-checked": item.id === options.current() ? "true" : "false",
      },
      dataset: { testid: `${prefix}-${item.id}`, temperature: item.id },
      on: {
        click: () => {
          options.close();
          options.onChange(item.id);
          for (const [index, candidate] of ASSISTANT_TEMPERATURES.entries()) {
            buttons[index]?.setAttribute("aria-checked", candidate.id === item.id ? "true" : "false");
          }
        },
      },
    }),
  );

  return el("div", {
    class: "ai-temperature-section",
    attrs: { role: "none" },
    children: [
      el("span", { class: "ai-temperature-label", text: "대기 화면", attrs: { role: "presentation" } }),
      el("div", {
        class: "ai-temperature-picker",
        attrs: { role: "group", "aria-label": "조수 대기 화면" },
        children: buttons,
      }),
    ],
  });
}
