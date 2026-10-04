import { applyJoseonFolklorePack, joseonFolklorePackStatus } from "@/project/contentPacks/joseonFolklore";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { store } from "@/project/store";
import { canWriteTeamProject } from "@/project/teamAccess";
import { el } from "@/util/dom";

let outcome: {lineage: number; text: string; error: boolean; pending: boolean} | undefined;

export function renderDatabaseContentPacks(): HTMLElement {
  const lineage = store.getVersionToken().lineage;
  if (outcome?.lineage !== lineage) outcome = undefined;
  const status = joseonFolklorePackStatus(store.getCurrent());
  const message = el("p", { text: outcome?.text ?? "전사·도적·주술사·도사와 조선 설화의 아이템·장비·몬스터·기술을 추가합니다.", attrs: { "aria-live": "polite", ...(outcome?.error ? {role:"alert"} : {}) }, dataset: {testid:"db-content-pack-message"} });
  // store.update may replace this view synchronously. Report on the connected view.
  const report = (text: string, error = false, pending = false) => {
    if (store.getVersionToken().lineage !== lineage) return;
    outcome = {lineage, text, error, pending};
    const live = document.querySelector<HTMLElement>('[data-testid="db-content-pack-message"]') ?? message;
    live.textContent = text;
    if (error) live.setAttribute("role", "alert");
    else live.removeAttribute("role");
    const liveButton = document.querySelector<HTMLButtonElement>('[data-testid="db-content-pack-add"]');
    if (liveButton) {
      const complete = joseonFolklorePackStatus(store.getCurrent()).complete;
      liveButton.textContent = pending ? "조선 설화 팩 추가 중…" : complete ? "조선 설화 팩 추가됨" : "조선 설화 팩 추가";
      liveButton.disabled = pending || complete || !canWriteTeamProject();
    }
  };
  const button = el("button", {
    class: "db-overview-assistant-cta", text: outcome?.pending ? "조선 설화 팩 추가 중…" : status.complete ? "조선 설화 팩 추가됨" : "조선 설화 팩 추가",
    attrs: { type: "button", ...(outcome?.pending || status.complete || !status.total || !canWriteTeamProject() ? { disabled: "" } : {}) },
    dataset: {testid:"db-content-pack-add"},
    on: { click: async () => {
      if (!canWriteTeamProject()) return;
      button.disabled = true;
      report("조선 설화 팩을 추가하고 저장하는 중입니다.", false, true);
      try {
        recordProjectSnapshot();
        let added = 0;
        store.update(project => { added = applyJoseonFolklorePack(project).added; }, { scope: "database" });
        const saved = await store.flush();
        if (saved.kind !== "saved") throw new Error("팩이 추가됐지만 저장을 완료하지 못했습니다. 프로젝트 저장 연결을 확인해 주세요.");
        button.textContent = "조선 설화 팩 추가됨";
        report(`${added}개 추가하고 저장했습니다. 상점과 사냥터에서 원하는 항목을 골라 연결하세요.`);
      } catch (error) {
        report(error instanceof Error ? error.message : String(error), true);
        button.disabled = false;
      }
    } },
  }) as HTMLButtonElement;
  return el("section", { class: "db-overview-content-packs", children: [el("h3", { text: "콘텐츠 팩" }), message, button] });
}
