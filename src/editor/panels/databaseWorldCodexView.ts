import { detailHero, detailPane, workspaceShell } from "@/editor/panels/databaseWorkspace";
import { renderWorldPanel } from "@/editor/panels/worldPanel";
import { getPersistedCodexView } from "@/editor/panels/worldManager";

export function renderWorldCodexTab(host: HTMLElement): void {
  const persisted = getPersistedCodexView();
  host.append(
    workspaceShell({
      testid: "db-world-codex-workspace",
      header: detailHero({
        eyebrow: "세계관 · 낱장 카드",
        title: "설정집",
        subtitle: "AI가 항상 읽는 한 장(이름·요약)은 「이 세계」 탭에 적는다.",
        testid: "db-world-codex-lead",
      }),
      detail: detailPane({
        body: [
          renderWorldPanel({ embedded: true, initialTab: persisted.tab, initialEntityId: persisted.selectedId ?? undefined }),
        ],
        testid: "db-world-codex-detail",
      }),
    }),
  );
}
