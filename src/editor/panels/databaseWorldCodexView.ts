import { detailPane, workspaceShell } from "@/editor/panels/databaseWorkspace";
import { renderWorldPanel } from "@/editor/panels/worldPanel";
import { worldCodexSessionFor } from "./worldCodexSession";
import { el } from "@/util/dom";

export function renderWorldCodexTab(host: HTMLElement, container: HTMLElement = host): void {
  const session = worldCodexSessionFor(container);
  const workspace = workspaceShell({
      testid: "db-world-codex-workspace",
      header: el("header", {
        class: "world-document-toolbar",
        dataset: { testid: "db-world-codex-lead" },
        children: [
          el("strong", { text: "설정집" }),
          el("span", { class: "world-ai-scope-label", text: "NPC 대사 AI 참고 · 이름과 요약" }),
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
