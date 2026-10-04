import { el } from "@/util/dom";
import "@/styles/shell/window-controls.css";

/** Native fullscreen must have a mouse exit. Browser/team pages do not receive native IPC. */
export function mountWindowControls(): void {
  const control = window.oprn?.windowControl;
  if (!control || document.querySelector(".studio-window-controls")) return;
  const button = (label: string, action: "toggle-fullscreen" | "close") => el("button", {
    text: label, attrs: { type: "button" }, dataset: { testid: `window-${action}` },
    on: { click: () => { void control(action); } },
  });
  document.body.append(el("nav", { class: "studio-window-controls", attrs: { "aria-label": "앱 창" }, children: [
    button("화면 전환", "toggle-fullscreen"), button("앱 닫기", "close"),
  ] }));
}
