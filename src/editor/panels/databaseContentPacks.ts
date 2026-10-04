import { applyJoseonFolklorePack, joseonFolklorePackStatus } from "@/project/contentPacks/joseonFolklore";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { store } from "@/project/store";
import { canWriteTeamProject } from "@/project/teamAccess";
import { el } from "@/util/dom";

export function renderDatabaseContentPacks(): HTMLElement {
  const status = joseonFolklorePackStatus(store.getCurrent());
  const message = el("p", { text: "전사·도적·주술사·도사와 조선 설화의 아이템·장비·몬스터·기술을 추가합니다.", attrs: { "aria-live": "polite" } });
  const button = el("button", {
    class: "db-overview-assistant-cta", text: status.complete ? "조선 설화 팩 추가됨" : "조선 설화 팩 추가",
    attrs: { type: "button", ...(status.complete || !status.total || !canWriteTeamProject() ? { disabled: "" } : {}) },
    on: { click: async () => {
      if (!canWriteTeamProject()) return;
      button.disabled = true;
      try {
        recordProjectSnapshot();
        let added = 0;
        store.update(project => { added = applyJoseonFolklorePack(project).added; }, { scope: "database" });
        const saved = await store.flush();
        if (saved.kind !== "saved") throw new Error("팩이 추가됐지만 저장을 완료하지 못했습니다. 프로젝트 저장 연결을 확인해 주세요.");
        button.textContent = "조선 설화 팩 추가됨";
        message.textContent = `${added}개 추가했습니다. 상점과 사냥터에서 원하는 항목을 골라 연결하세요.`;
      } catch (error) {
        message.textContent = error instanceof Error ? error.message : String(error);
        message.setAttribute("role", "alert");
        button.disabled = false;
      }
    } },
  }) as HTMLButtonElement;
  return el("section", { class: "db-overview-content-packs", children: [el("h3", { text: "콘텐츠 팩" }), message, button] });
}
