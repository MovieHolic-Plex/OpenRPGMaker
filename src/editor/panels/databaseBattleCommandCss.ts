import { mountBattleCommandCss, parseBattleCommandCss, BATTLE_COMMAND_CSS_MAX_LENGTH } from "@/project/battleCommandCss";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { store } from "@/project/store";
import { el } from "@/util/dom";
import { sectionCard, restoreFocusAfterRerender } from "./databaseWorkspace";

const PRESET = ".command {\n  color: #f8fafc;\n  background-color: #25324a;\n  border-color: #64748b;\n  border-width: 1px;\n  border-style: solid;\n  border-radius: 8px;\n}\n.command:focus-visible {\n  background-color: #4a57d6;\n}\n.command:disabled {\n  color: #94a3b8;\n}";

// Database renders can be scheduled after a placement edit. Keep unsaved input
// across those renders, but never carry it into another project or saved revision.
let draft: { projectId: string; saved: string; value: string; preview: string } | undefined;

export function battleCommandCssEditor(labels: readonly string[], rerender: () => void): HTMLElement {
  const saved = store.getCurrent().system.battleCommandCss ?? "";
  const projectId = store.getProjectIdentity().id;
  if (!draft || draft.projectId !== projectId || draft.saved !== saved) {
    draft = { projectId, saved, value: saved, preview: saved };
  }
  const state = draft;
  const input = el("textarea", { value: state.value, attrs: {
    id: "db-command-css-input", rows: "9", spellcheck: "false", maxlength: String(BATTLE_COMMAND_CSS_MAX_LENGTH),
    "aria-describedby": "db-command-css-help db-command-css-status",
  }, dataset: { testid: "db-command-css-input" } });
  const status = el("p", { attrs: { id: "db-command-css-status", role: "status", "aria-live": "polite" }, dataset: { testid: "db-command-css-status" } });
  const preview = el("div", { class: "db-command-css-preview", dataset: { testid: "db-command-css-preview" }, children: [
    el("div", { class: "battle-command-menu", children: labels.map((label) => el("button", {
      class: "battle-command", attrs: { type: "button", "aria-label": `${label} 스타일 미리보기` },
      children: [el("span", { class: "battle-command-text", text: label })],
    })) }),
  ] });
  const apply = el("button", { class: "db-ws-btn primary", text: "CSS 적용", attrs: { type: "button" }, dataset: { testid: "db-command-css-apply" } });
  const update = (): void => {
    state.value = input.value;
    const parsed = parseBattleCommandCss(input.value);
    apply.disabled = !parsed.ok || input.value === saved;
    input.setAttribute("aria-invalid", String(!parsed.ok));
    status.textContent = parsed.ok ? (input.value === saved ? "저장된 스타일입니다." : "미리보기에만 반영했습니다. CSS 적용을 눌러 저장하세요.") : parsed.error;
    if (parsed.ok) state.preview = input.value;
    mountBattleCommandCss(preview, state.preview);
  };
  const commit = (css: string): void => {
    const current = store.getCurrent();
    if (store.getProjectIdentity().id !== projectId || (current.system.battleCommandCss ?? "") !== saved) {
      status.textContent = "프로젝트 또는 저장된 CSS가 바뀌었습니다. 전투 명령 탭을 다시 열어 주세요.";
      apply.disabled = true;
      return;
    }
    if (!parseBattleCommandCss(css).ok || css === saved) return;
    recordProjectSnapshot("전투 명령 CSS 변경");
    store.update((project) => {
      if (css.trim()) project.system.battleCommandCss = css;
      else delete project.system.battleCommandCss;
    }, { scope: "database", label: "전투 명령 CSS 변경" });
    rerender();
    restoreFocusAfterRerender("db-command-css-input");
  };
  input.addEventListener("input", update);
  apply.addEventListener("click", () => commit(input.value));
  const button = (label: string, id: string, action: () => void): HTMLButtonElement => el("button", {
    class: "db-ws-btn", text: label, attrs: { type: "button" }, dataset: { testid: id }, on: { click: action },
  });
  update();
  return sectionCard({ title: "메뉴 스타일 · Custom CSS", hint: "프로젝트 공통 · 모든 직업의 전투 명령과 하위 메뉴에 적용됩니다", testid: "db-command-css-editor", children: [
    el("p", { text: "스타일 샘플입니다. 실제 크기와 배치는 전투 방식(도트 측면/몬스터 대치)을 따릅니다. 버튼에 Tab으로 초점을 옮겨 선택 상태를 확인하세요." }),
    preview,
    el("label", { text: "Custom CSS", attrs: { for: "db-command-css-input" } }),
    input,
    el("p", { attrs: { id: "db-command-css-help" }, text: "선택자: .menu · .command · .label · .command:focus-visible · .command:disabled. 속성: color, background-color, border-color/width/style/radius, font-size/weight, letter-spacing, line-height, text-align/shadow, padding(-inline/-block), gap, row-gap, column-gap, box-shadow. URL·전역 선택자·@규칙은 사용할 수 없습니다." }),
    el("div", { class: "db-ws-toolbar", children: [
      apply,
      button("저장된 CSS로", "db-command-css-revert", () => { input.value = saved; update(); }),
      button("다크 프리셋", "db-command-css-preset", () => { input.value = PRESET; update(); }),
      button("기본 모양으로", "db-command-css-reset", () => { input.value = ""; update(); commit(""); }),
    ] }),
    status,
  ] });
}
