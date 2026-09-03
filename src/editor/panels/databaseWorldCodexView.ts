import { renderWorldPanel } from "@/editor/panels/worldPanel";

export function renderWorldCodexTab(host: HTMLElement): void {
  host.append(renderWorldPanel({ embedded: true }));
}
