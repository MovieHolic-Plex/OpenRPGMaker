import { renderWorldPanel } from "@/editor/panels/worldPanel";
import { el } from "@/util/dom";

export function renderWorldCodexTab(host: HTMLElement): void {
  host.append(
    el("p", {
      class: "db-ws-card-hint db-world-codex-lead",
      text: "설정집은 낱장 카드 모음이다. AI가 항상 읽는 한 장은 「이 세계」 탭에 적는다.",
      dataset: { testid: "db-world-codex-lead" },
    }),
    renderWorldPanel({ embedded: true }),
  );
}
