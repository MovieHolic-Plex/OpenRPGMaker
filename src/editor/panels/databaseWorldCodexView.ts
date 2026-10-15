import { detailPane, statStrip, workspaceShell } from "@/editor/panels/databaseWorkspace";
import { renderWorldPanel } from "@/editor/panels/worldPanel";
import { worldCodexSessionFor } from "./worldCodexSession";
import { currentWorld, summarizeWorldLint } from "./worldManager";
import { store } from "@/project/store";
import { el } from "@/util/dom";

export function renderWorldCodexTab(host: HTMLElement, container: HTMLElement = host): void {
  const session = worldCodexSessionFor(container);
  const project = store.getCurrent();
  const world = currentWorld(project);
  const lint = summarizeWorldLint(world, project);
  const attachedCount = Array.from(lint.byEntityId.values()).reduce((sum, issues) => sum + issues.length, 0);
  const attachedCards = lint.byEntityId.size;
  const countBy = (type: string): number => world.entities.filter((entity) => entity.type === type).length;
  const stats = statStrip([
    { label: "문서", value: `${world.entities.length}개` },
    { label: "인물", value: `${countBy("character")}명` },
    { label: "장소·세력", value: `${countBy("place") + countBy("faction")}곳` },
    { label: "사건", value: `${countBy("event")}건` },
    {
      label: "검사 지적",
      value: `${attachedCount}건`,
      tone: attachedCount > 0 ? "warn" : "good",
      hint: attachedCount > 0 ? `문서 ${attachedCards}개` : "깨끗함",
    },
  ], { testid: "db-world-codex-stats" });
  const workspace = workspaceShell({
      testid: "db-world-codex-workspace",
      header: el("div", {
        class: "world-codex-lead-wrap",
        children: [
          el("header", {
            class: "world-document-toolbar",
            dataset: { testid: "db-world-codex-lead" },
            children: [
              el("strong", { text: "설정집" }),
              el("span", { class: "world-ai-scope-label", text: "AI 참고 범위는 속성의 「AI가 읽는 것」에서 확인합니다" }),
            ],
          }),
          stats,
        ],
      }),
      detail: detailPane({
        body: [
          renderWorldPanel({ embedded: true, state: session.state }),
        ],
        testid: "db-world-codex-detail",
      }),
    });
  workspace.classList.add("world-document-workspace", "world-codex-workspace");
  host.append(workspace);
}
