import { el } from "@/util/dom";

export type ToolbarIcon =
  | "new"
  | "open"
  | "save"
  | "import"
  | "export"
  | "database"
  | "resources"
  | "disabled-diamond"
  | "disabled-blocks"
  | "event-test"
  | "panel-left"
  | "panel-right"
  | "lower"
  | "upper"
  | "event"
  | "pencil"
  | "eraser"
  | "bucket"
  | "select"
  | "rectangle"
  | "round-terrain"
  | "hand"
  | "grid"
  | "pin"
  | "link"
  | "layers"
  | "settings"
  | "close"
  | "undo"
  | "redo"
  | "zoom"
  | "zoom-1"
  | "zoom-2"
  | "zoom-4"
  | "zoom-8"
  | "play"
  | "sound"
  | "search"
  | "window"
  | "title"
  | "manual";

export interface ToolbarButtonSpec {
  readonly testId: string;
  readonly label: string;
  readonly title: string;
  readonly icon?: ToolbarIcon;
  readonly active?: boolean;
  readonly disabled?: boolean;
  readonly primary?: boolean;
  readonly onClick: () => void;
}

export function toolbarButton(spec: ToolbarButtonSpec): HTMLButtonElement {
  return el("button", {
    class:
      "rm2k3-tool-button" +
      (spec.primary ? " primary" : "") +
      (spec.icon ? " icon-only" : "") +
      (spec.active ? " active" : ""),
    text: spec.icon ? undefined : spec.label,
    attrs: {
      title: spec.title,
      "aria-label": spec.label,
      ...(spec.active !== undefined ? { "aria-pressed": String(spec.active) } : {}),
      ...(spec.disabled ? { disabled: "true" } : {}),
    },
    children: spec.icon
      ? [
          el("span", { class: `rm-tool-icon rm-tool-icon-${spec.icon}`, attrs: { "aria-hidden": "true" } }),
          el("span", { class: "visually-hidden", text: spec.label }),
        ]
      : undefined,
    dataset: { testid: spec.testId },
    on: { click: spec.onClick },
  }) as HTMLButtonElement;
}

export function separator(): HTMLElement {
  return el("span", { class: "rm2k3-toolbar-separator" });
}
