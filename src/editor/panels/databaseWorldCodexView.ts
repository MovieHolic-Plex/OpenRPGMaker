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
  const countBy = (type: string): number => world.entities.filter((entity) => entity.type === type).length;
  const stats = statStrip([
    { label: "낱장 카드", value: `${world.entities.length}장` },
    { label: "인물", value: `${countBy("character")}명` },
    { label: "장소·세력", value: `${countBy("place") + countBy("faction")}곳` },
    { label: "사건", value: `${countBy("event")}건` },
    {
      label: "검사 지적",
      value: `${lint.all.length}건`,
      tone: lint.all.length > 0 ? "warn" : "good",
      hint: lint.all.length > 0 ? "카드에 표시" : "깨끗함",
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
              el("span", { class: "world-ai-scope-label", text: "NPC 대사 AI 참고 · 이름과 요약" }),
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
