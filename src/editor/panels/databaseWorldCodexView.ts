import { detailPane, workspaceShell } from "@/editor/panels/databaseWorkspace";
import { renderWorldPanel } from "@/editor/panels/worldPanel";
import { worldCodexSessionFor } from "./worldCodexSession";
import { currentWorld, summarizeWorldLint } from "./worldManager";
import { popoverToggle } from "./worldDocumentProperties";
import { renderWorldAiReachPanel } from "./worldAiReachPanel";
import { store } from "@/project/store";
import { el } from "@/util/dom";

/**
 * 한 줄 요약 — 통계 다섯 칸을 한 줄 글로 접는다. 라벨·값은 따로 번역되는 기존 조각(「문서」「40개」…)을 그대로 쓴다.
 * 검사 지적이 있을 때만 경고색, 문서 수는 툴팁에 둔다.
 */
function summaryLine(): HTMLElement {
  const project = store.getCurrent();
  const world = currentWorld(project);
  const lint = summarizeWorldLint(world, project);
  const attachedCount = Array.from(lint.byEntityId.values()).reduce((sum, issues) => sum + issues.length, 0);
  const attachedCards = lint.byEntityId.size;
  const countBy = (type: string): number => world.entities.filter((entity) => entity.type === type).length;
  const item = (label: string, value: string, tone?: "warn" | "good", hint?: string): HTMLElement => el("span", {
    class: `world-summary-item${tone ? ` tone-${tone}` : ""}`,
    ...(hint ? { attrs: { title: hint } } : {}),
    children: [el("span", { class: "world-summary-label", text: label }), el("strong", { text: value })],
  });
  return el("div", {
    class: "world-summary-line",
    dataset: { testid: "db-world-codex-stats" },
    children: [
      item("문서", `${world.entities.length}개`),
      item("인물", `${countBy("character")}명`),
      item("장소·세력", `${countBy("place") + countBy("faction")}곳`),
      item("사건", `${countBy("event")}건`),
      item("검사 지적", `${attachedCount}건`, attachedCount > 0 ? "warn" : "good", attachedCount > 0 ? `문서 ${attachedCards}개` : "깨끗함"),
    ],
  });
}

export function renderWorldCodexTab(host: HTMLElement, container: HTMLElement = host): void {
  const session = worldCodexSessionFor(container);
  const state = session.state;

  // 「AI가 읽는 것」은 프로젝트 전체 기준이다 — 한 줄 칩으로 접어 두고 누르면 팝오버로 편다.
  const aiSlot = el("span", { class: "world-toolbar-ai-slot", dataset: { testid: "world-ai-slot" } });
  const summarySlot = el("span", { class: "world-summary-slot" });
  let paintedFor: unknown = null;
  const paint = (): void => {
    const project = store.getCurrent();
    // 검색·탭 전환 같은 비저장 다시 그리기에서는 숫자가 그대로다 — 저장이 새 프로젝트 객체를 만들 때만 다시 센다.
    if (paintedFor === project) return;
    paintedFor = project;
    const toggle = popoverToggle(() => state.openPopover, (id) => { state.openPopover = id; }, "ai");
    aiSlot.replaceChildren(renderWorldAiReachPanel({ ...toggle, probe: state.aiProbe, variant: "chip" }));
    summarySlot.replaceChildren(summaryLine());
  };
  paint();
  // 문서를 고칠 때마다 숫자가 달라진다 — 패널이 다시 그려질 때 이 줄도 다시 채운다.
  // 탭 DOM 이 떨어져 나가면(다른 탭으로 이동) 스스로 구독을 푼다.
  const unsubscribe = session.subscribe(() => {
    if (!aiSlot.isConnected) { unsubscribe(); return; }
    paint();
  });

  const workspace = workspaceShell({
      testid: "db-world-codex-workspace",
      header: el("header", {
        class: "world-document-toolbar world-codex-toolbar",
        dataset: { testid: "db-world-codex-lead" },
        children: [
          el("strong", { text: "설정집" }),
          summarySlot,
          aiSlot,
        ],
      }),
      detail: detailPane({
        body: [
          renderWorldPanel({ embedded: true, state }),
        ],
        testid: "db-world-codex-detail",
      }),
    });
  workspace.classList.add("world-document-workspace", "world-codex-workspace");
  host.append(workspace);
}
