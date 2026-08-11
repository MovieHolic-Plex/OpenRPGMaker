import {
  fillConnectionForm,
  readConnectionForm,
  renderAdvancedConnectionSettings,
} from "@/editor/panels/dbConnectionAdvancedSettings";
import { renderProjectPicker } from "@/editor/panels/dbConnectionProjectPicker";
import { onlineConfigSourceLabel, renderOnlineSaveStatus } from "@/editor/panels/dbConnectionStatus";
import type { DbPersistenceStatus } from "@/project/persistenceStatus";
import {
  resetSupabaseProjectConfigToEnv,
  saveSupabaseProjectConfigDraft,
  supabaseProjectConfigDraftWithSource,
} from "@/project/supabaseProjectConfig";
import type { SupabaseProjectListItem } from "@/project/supabaseProjectSync";
import { markSupabaseRecoveredLocation } from "@/project/supabaseRecoveryLocation";
import { syncProjectToUrl } from "@/project/projectUrl";
import { store } from "@/project/store";
import { clearChildren, el } from "@/util/dom";
import { toast } from "@/util/toast";

type StatusRefresh = () => void;

type DbConnectionSettingsOptions = {
  readonly autoLoadProjects?: boolean;
  readonly required?: boolean;
};

let modalRoot: HTMLElement | null = null;
let connecting = false;

export function renderDbConnectionStatus(status: DbPersistenceStatus, onRefresh: StatusRefresh): HTMLElement {
  return renderOnlineSaveStatus(status, onRefresh, () => openDbConnectionSettings(onRefresh));
}

export function openDbConnectionSettings(
  onRefresh: StatusRefresh = () => undefined,
  options: DbConnectionSettingsOptions = {},
): void {
  modalRoot?.remove();
  const required = options.required === true;
  const draft = supabaseProjectConfigDraftWithSource();
  const statusLine = el("p", {
    class: "db-config-status-line",
    text: onlineConfigStatusText(draft.source, draft.url.length > 0 && draft.anonKey.length > 0),
    attrs: { role: "status", "aria-live": "polite" },
    dataset: { testid: "db-config-status-line" },
  });
  const form = el("form", { class: "db-config-form" });
  const projectPicker = renderProjectPicker(form, {
    autoLoad: options.autoLoadProjects === true,
    onProjectSelected: async (project) => connectToSelectedProject(form, statusLine, onRefresh, project),
    onStatus: (message) => setStatusLine(statusLine, message),
  });
  const advanced = renderAdvancedConnectionSettings(draft, {
    onLoadDefaults: () => {
      const next = resetSupabaseProjectConfigToEnv();
      fillConnectionForm(form, next);
      setStatusLine(statusLine, "앱의 기본 연결 정보를 다시 불러왔습니다.");
      toast("기본 연결 정보를 불러왔습니다", "ok");
      onRefresh();
      void projectPicker.reload();
    },
    onSave: () => {
      saveConfigFromForm(form, onRefresh);
      setStatusLine(statusLine, "이 기기에 연결 정보를 저장했습니다.");
      toast("연결 정보를 저장했습니다", "ok");
      void projectPicker.reload();
    },
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void connectToSelectedProject(form, statusLine, onRefresh);
  });
  form.append(
    renderIntro(required),
    projectPicker.element,
    advanced,
    statusLine,
    renderFooter(required),
  );

  modalRoot = el("div", {
    class: "database-modal-backdrop db-config-backdrop",
    dataset: { testid: "db-config-modal" },
    children: [
      el("section", {
        class: "database-modal-window db-config-window",
        attrs: { role: "dialog", "aria-modal": "true", "aria-labelledby": "db-config-title" },
        children: [
          el("header", {
            class: "database-modal-header",
            children: [
              el("h2", { text: "작업 열기", attrs: { id: "db-config-title" }, dataset: { testid: "db-config-title" } }),
              ...(required ? [] : [el("button", {
                class: "database-modal-close",
                text: "×",
                attrs: { type: "button", "aria-label": "닫기" },
                on: { click: closeDbConnectionSettings },
              })]),
            ],
          }),
          el("div", { class: "database-modal-body db-config-body", children: [form] }),
        ],
      }),
    ],
  });
  modalRoot.addEventListener("mousedown", (event) => {
    if (!required && event.target === modalRoot) closeDbConnectionSettings();
  });
  document.body.append(modalRoot);
  form.querySelector<HTMLButtonElement>("[data-testid='db-config-load-projects']")?.focus();
}

function renderIntro(required: boolean): HTMLElement {
  return el("section", {
    class: "db-config-intro",
    children: [
      el("p", { class: "db-config-eyebrow", text: required ? "시작하기" : "작업 전환" }),
      el("h3", { text: required ? "어떤 작업을 계속할까요?" : "저장된 작업을 선택하세요" }),
      el("p", { text: "작업 카드를 선택하면 바로 편집 화면으로 이동합니다. 저장과 연결은 자동으로 처리됩니다." }),
    ],
  });
}

function renderFooter(required: boolean): HTMLElement {
  return el("footer", {
    class: "db-config-actions",
    children: [
      el("span", { text: "연결 정보는 이 기기에만 저장됩니다." }),
      ...(required ? [] : [el("button", {
        class: "btn",
        text: "닫기",
        attrs: { type: "button" },
        on: { click: closeDbConnectionSettings },
      })]),
    ],
  });
}

async function connectToSelectedProject(
  form: HTMLFormElement,
  statusLine: HTMLElement,
  onRefresh: StatusRefresh,
  project?: SupabaseProjectListItem,
): Promise<void> {
  if (connecting) return;
  const draft = readConnectionForm(form);
  if (!draft.projectId) {
    setStatusLine(statusLine, "열 작업을 목록에서 선택하세요.");
    return;
  }
  connecting = true;
  setStatusLine(statusLine, `${project?.title ?? "선택한 작업"}을 여는 중입니다.`);
  saveConfigFromForm(form, onRefresh);
  const result = await store.reconnectRemotePersistence();
  connecting = false;
  onRefresh();
  if (result.kind === "connected") {
    markSupabaseRecoveredLocation();
    const { focusProjectStartMap } = await import("@/editor/mapSelection");
    focusProjectStartMap();
    toast("작업을 열었습니다", "ok");
    closeDbConnectionSettings();
    return;
  }
  setStatusLine(statusLine, "작업을 열지 못했습니다. ‘연결 문제 해결’을 열어 설정을 확인하세요.");
  toast("작업을 열지 못했습니다", "error");
}

function saveConfigFromForm(form: HTMLFormElement, onRefresh: StatusRefresh): void {
  const draft = readConnectionForm(form);
  saveSupabaseProjectConfigDraft(draft);
  syncProjectToUrl({ projectId: draft.projectId || null, projectName: null });
  onRefresh();
}

function onlineConfigStatusText(source: ReturnType<typeof supabaseProjectConfigDraftWithSource>["source"], ready: boolean): string {
  return ready
    ? `${onlineConfigSourceLabel(source)}으로 온라인 저장을 준비했습니다.`
    : "온라인 저장 설정이 아직 없습니다. 작업 목록이 보이지 않으면 ‘연결 문제 해결’을 확인하세요.";
}

function setStatusLine(statusLine: HTMLElement, message: string): void {
  clearChildren(statusLine);
  statusLine.textContent = message;
}

function closeDbConnectionSettings(): void {
  modalRoot?.remove();
  modalRoot = null;
}
