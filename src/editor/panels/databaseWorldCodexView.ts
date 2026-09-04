import { renderWorldPanel } from "@/editor/panels/worldPanel";
import { getPersistedCodexView } from "@/editor/panels/worldManager";
import { el } from "@/util/dom";

export function renderWorldCodexTab(host: HTMLElement): void {
  const persisted = getPersistedCodexView();
  host.append(
    el("p", {
      class: "db-ws-card-hint db-world-codex-lead",
      text: "설정집은 낱장 카드 모음이다. AI가 항상 읽는 한 장(이름·요약)은 「이 세계」 탭에 적는다.",
      dataset: { testid: "db-world-codex-lead" },
    }),
    renderWorldPanel({ embedded: true, initialTab: persisted.tab, initialEntityId: persisted.selectedId ?? undefined }),
  );
}
