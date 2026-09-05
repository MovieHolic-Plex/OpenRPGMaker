import { detailHero, detailPane, workspaceShell } from "@/editor/panels/databaseWorkspace";
import { renderWorldPanel } from "@/editor/panels/worldPanel";
import { worldCodexSessionFor } from "./worldCodexSession";

export function renderWorldCodexTab(host: HTMLElement, container: HTMLElement = host): void {
  const session = worldCodexSessionFor(container);
  host.append(
    workspaceShell({
      testid: "db-world-codex-workspace",
      header: detailHero({
        eyebrow: "세계관 · 낱장 카드",
        title: "설정집",
        subtitle: "NPC 대사 작성에는 카드 이름·요약이 쓰입니다. 모든 AI 작업에 적용할 규칙은 「이 세계」에 적으세요. 카드 본문·관계는 AI에 전달되지 않습니다.",
        testid: "db-world-codex-lead",
      }),
      detail: detailPane({
        body: [
          renderWorldPanel({ embedded: true, state: session.state }),
        ],
        testid: "db-world-codex-detail",
      }),
    }),
  );
}
