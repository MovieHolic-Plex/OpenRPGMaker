import { ensureCurrentMapLock } from "@/editor/mapEditLocks";
import type { DbConfigField, DbPersistenceStatus } from "@/project/persistenceStatus";
import {
  clearSupabaseProjectConfigDraft,
  resetSupabaseProjectConfigToEnv,
  saveSupabaseProjectConfigDraft,
  supabaseProjectConfigDraft,
  supabaseProjectConfigDraftWithSource,
} from "@/project/supabaseProjectConfig";
import type { SupabaseProjectConfigSource } from "@/project/supabaseProjectConfig";
import {
  listSupabaseProjects,
  type SupabaseProjectListConfig,
  type SupabaseProjectListItem,
} from "@/project/supabaseProjectSync";
import { markSupabaseRecoveredLocation } from "@/project/supabaseRecoveryLocation";
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

// 상태바 "DB 연동" 칩(도그푸딩 결함 ⑫): 어떤 상태에서든 클릭하면 항상 DB 연결 설정이
// 열린다(기존에는 자동저장 오류 상태에서 클릭이 재시도로 소비되어 설정 진입점이 사라졌다).
// 저장 재시도는 칩 안의 별도 [재시도] 버튼으로 분리. 맵 잠금 "가져오기" 버튼과 구분되도록
// 🔌 아이콘 + 버튼 스타일을 명시한다.
export function renderDbConnectionStatus(status: DbPersistenceStatus, onRefresh: StatusRefresh): HTMLElement {
  const autoSave = store.getAutoSaveState();
  const button = el("button", {
    class: `editor-statusbar-cell db-connection-status db-connection-chip-button ${status.kind} autosave-${autoSave.kind}`,
    attrs: { title: dbConnectionStatusButtonTitle(status, autoSave), type: "button" },
    children: [
      el("span", { class: "db-connection-label", text: `🔌 ${dbConnectionStatusText(status)}` }),
      el("span", { class: "db-autosave-state", text: autoSaveStatusText(autoSave), dataset: { testid: "db-autosave-state" } }),
    ],
    dataset: { testid: "db-connection-status" },
    on: {
      click: () => openDbConnectionSettings(onRefresh),
    },
  });
  if (autoSave.kind === "error") {
    button.append(
      el("button", {
        class: "db-autosave-retry-button",
        text: "재시도",
        attrs: { type: "button", title: `저장 실패: ${autoSave.message} — 클릭해서 저장을 다시 시도합니다.` },
        dataset: { testid: "db-autosave-retry" },
        on: {
          click: (event) => {
            event.stopPropagation();
            void store.flush()
              .catch((error) => {
                console.error("[store] manual auto-save retry failed:", error);
              })
              .finally(onRefresh);
          },
        },
      }),
    );
  }
  return button;
}

export function openDbConnectionSettings(onRefresh: StatusRefresh = () => undefined, options: DbConnectionSettingsOptions = {}): void {
  modalRoot?.remove();
  const required = options.required === true;
  const draft = supabaseProjectConfigDraftWithSource();
  const statusLine = el("p", {
    class: "db-config-status-line",
    text: dbConfigStatusText(draft.source, draft),
    dataset: { testid: "db-config-status-line" },
  });
  const form = el("form", {
    class: "db-config-form",
    on: {
      submit: (event) => {
        event.preventDefault();
        void connectFromForm(form, statusLine, onRefresh);
      },
    },
  });
  form.append(
    field("DB URL", "url", draft.url, "http://dbserver:8100"),
    field("Anon key", "anonKey", draft.anonKey, "Supabase anon key"),
    field("Project ID", "projectId", draft.projectId, "rpg-zzu-house-template-gallery"),
    renderProjectPicker(form, statusLine, options.autoLoadProjects === true),
    statusLine,
    renderActions(form, statusLine, onRefresh, required),
  );

  modalRoot = el("div", {
    class: "database-modal-backdrop db-config-backdrop",
    dataset: { testid: "db-config-modal" },
    children: [
      el("section", {
        class: "database-modal-window db-config-window",
        attrs: { role: "dialog", "aria-modal": "true", "aria-label": "DB 연결 설정" },
        children: [
          el("header", {
            class: "database-modal-header",
            children: [
              el("h2", { text: "DB 연결 설정" }),
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
    if (required) return;
    if (event.target === modalRoot) closeDbConnectionSettings();
  });
  document.body.append(modalRoot);
  form.querySelector<HTMLInputElement>("[data-testid='db-config-url']")?.focus();
}

function field(label: string, name: keyof ReturnType<typeof supabaseProjectConfigDraft>, value: string, placeholder: string): HTMLElement {
  return el("label", {
    class: "db-config-field",
    children: [
      el("span", { text: label }),
      el("input", {
        value,
        attrs: {
          autocomplete: name === "anonKey" ? "off" : "on",
          name,
          placeholder,
          spellcheck: "false",
          type: name === "anonKey" ? "password" : "text",
        },
        dataset: { testid: `db-config-${kebabName(name)}` },
      }),
    ],
  });
}

function renderProjectPicker(form: HTMLFormElement, statusLine: HTMLElement, autoLoadProjects: boolean): HTMLElement {
  const list = el("div", {
    class: "db-config-project-list empty",
    text: "DB URL과 Anon key를 입력한 뒤 Supabase 프로젝트를 불러올 수 있습니다.",
    dataset: { testid: "db-config-project-list" },
  });
  const picker = el("section", {
    class: "db-config-project-picker",
    children: [
      el("div", {
        class: "db-config-project-picker-header",
        children: [
          el("span", { text: "Supabase 프로젝트" }),
          el("button", {
            class: "btn",
            text: "목록 불러오기",
            attrs: { type: "button" },
            dataset: { testid: "db-config-load-projects" },
            on: { click: () => void loadProjectOptions(form, list, statusLine) },
          }),
        ],
      }),
      list,
    ],
  });
  if (autoLoadProjects) {
    window.setTimeout(() => {
      void loadProjectOptions(form, list, statusLine);
    }, 0);
  }
  return picker;
}

async function loadProjectOptions(form: HTMLFormElement, list: HTMLElement, statusLine: HTMLElement): Promise<void> {
  const config = projectListConfigFromForm(form);
  if (!config) {
    setStatusLine(statusLine, "Supabase 프로젝트 목록을 보려면 DB URL과 Anon key가 필요합니다.");
    return;
  }
  renderProjectListLoading(list);
  setStatusLine(statusLine, "Supabase 프로젝트 목록을 불러오는 중...");
  try {
    const projects = await listSupabaseProjects(config);
    renderProjectList(form, list, statusLine, projects);
    setStatusLine(statusLine, projects.length > 0 ? "Supabase 프로젝트를 선택할 수 있습니다." : "Supabase projects 테이블에 프로젝트가 없습니다.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    renderProjectListMessage(list, `목록을 불러오지 못했습니다: ${message}`);
    setStatusLine(statusLine, `Supabase 프로젝트 목록 실패: ${message}`);
  }
}

function projectListConfigFromForm(form: HTMLFormElement): SupabaseProjectListConfig | null {
  const url = inputValue(form, "url").replace(/\/+$/, "");
  const anonKey = inputValue(form, "anonKey");
  if (url.length === 0 || anonKey.length === 0) return null;
  return { anonKey, url };
}

function renderProjectListLoading(list: HTMLElement): void {
  renderProjectListMessage(list, "목록을 불러오는 중...");
}

function renderProjectListMessage(list: HTMLElement, message: string): void {
  clearChildren(list);
  list.classList.add("empty");
  list.textContent = message;
}

function renderProjectList(
  form: HTMLFormElement,
  list: HTMLElement,
  statusLine: HTMLElement,
  projects: readonly SupabaseProjectListItem[],
): void {
  clearChildren(list);
  list.classList.toggle("empty", projects.length === 0);
  if (projects.length === 0) {
    list.textContent = "Supabase projects 테이블에 프로젝트가 없습니다.";
    return;
  }
  for (const project of projects) {
    list.append(renderProjectOption(form, statusLine, project));
  }
}

function renderProjectOption(form: HTMLFormElement, statusLine: HTMLElement, project: SupabaseProjectListItem): HTMLElement {
  return el("button", {
    class: "db-config-project-option",
    attrs: { type: "button" },
    dataset: { projectId: project.projectId, testid: "db-config-project-option" },
    on: { click: () => selectProjectId(form, statusLine, project) },
    children: [
      el("strong", { text: project.title }),
      el("code", { text: project.projectId }),
    ],
  });
}

function selectProjectId(form: HTMLFormElement, statusLine: HTMLElement, project: SupabaseProjectListItem): void {
  const control = form.elements.namedItem("projectId");
  if (!(control instanceof HTMLInputElement)) return;
  control.value = project.projectId;
  setStatusLine(statusLine, `프로젝트 선택됨: ${project.title} (${project.projectId})`);
}

function renderActions(form: HTMLFormElement, statusLine: HTMLElement, onRefresh: StatusRefresh, required: boolean): HTMLElement {
  return el("div", {
    class: "db-config-actions",
    children: [
      el("button", {
        class: "btn primary",
        text: "연결 시도",
        attrs: { type: "submit" },
        dataset: { testid: "db-config-connect" },
      }),
      el("button", {
        class: "btn",
        text: "env로 채우기",
        attrs: {
          type: "button",
          title: ".env / .env.local 의 VITE_SUPABASE_* 값으로 폼을 다시 채웁니다",
        },
        dataset: { testid: "db-config-fill-env" },
        on: {
          click: () => {
            const next = resetSupabaseProjectConfigToEnv();
            fillFormFromDraft(form, next);
            setStatusLine(statusLine, dbConfigStatusText(next.source, next));
            toast("env 기본값으로 폼을 채웠습니다.", "ok");
            onRefresh();
          },
        },
      }),
      ...(required ? [] : [el("button", {
        class: "btn",
        text: "저장만",
        attrs: { type: "button" },
        dataset: { testid: "db-config-save" },
        on: { click: () => saveConfigFromForm(form, statusLine, onRefresh) },
      }),
      el("button", {
        class: "btn",
        text: "초기화",
        attrs: { type: "button" },
        dataset: { testid: "db-config-clear" },
        on: {
          click: () => {
            clearSupabaseProjectConfigDraft();
            toast("DB 설정을 초기화했습니다.", "ok");
            closeDbConnectionSettings();
            onRefresh();
          },
        },
      })]),
      ...(required ? [] : [el("button", {
        class: "btn",
        text: "닫기",
        attrs: { type: "button" },
        on: { click: closeDbConnectionSettings },
      })]),
    ],
  });
}

function fillFormFromDraft(form: HTMLFormElement, draft: ReturnType<typeof supabaseProjectConfigDraft>): void {
  const url = form.elements.namedItem("url");
  const anon = form.elements.namedItem("anonKey");
  const project = form.elements.namedItem("projectId");
  if (url instanceof HTMLInputElement) url.value = draft.url;
  if (anon instanceof HTMLInputElement) anon.value = draft.anonKey;
  if (project instanceof HTMLInputElement) project.value = draft.projectId;
}

function dbConfigStatusText(
  source: SupabaseProjectConfigSource,
  draft: ReturnType<typeof supabaseProjectConfigDraft>,
): string {
  const filled = [draft.url ? "URL" : null, draft.anonKey ? "Anon key" : null, draft.projectId ? "Project ID" : null]
    .filter(Boolean)
    .join(", ");
  const fillNote = filled.length > 0 ? ` 채워짐: ${filled}.` : " 아직 비어 있는 항목이 있습니다.";
  return `현재 DB 설정: ${dbConfigSourceLabel(source)}.${fillNote} 저장한 뒤 즉시 연결을 시도합니다.`;
}

async function connectFromForm(form: HTMLFormElement, statusLine: HTMLElement, onRefresh: StatusRefresh): Promise<void> {
  if (connecting) return;
  connecting = true;
  setStatusLine(statusLine, "DB 연결 시도 중...");
  saveConfigFromForm(form, statusLine, onRefresh, false);
  const result = await store.reconnectRemotePersistence();
  connecting = false;
  onRefresh();
  if (result.kind === "connected") {
    markSupabaseRecoveredLocation();
    ensureCurrentMapLock();
    toast("DB 프로젝트를 불러왔습니다.", "ok");
    closeDbConnectionSettings();
    return;
  }
  const message = result.kind === "not-configured" ? "DB URL과 anon key가 필요합니다." : result.message;
  setStatusLine(statusLine, message);
  toast(`DB 연결 실패: ${message}`, "error");
}

function saveConfigFromForm(
  form: HTMLFormElement,
  statusLine: HTMLElement,
  onRefresh: StatusRefresh,
  notify = true,
): void {
  const draft = configDraftFromForm(form);
  saveSupabaseProjectConfigDraft(draft);
  onRefresh();
  if (!notify) return;
  setStatusLine(statusLine, "DB 설정을 저장했습니다.");
  toast("DB 설정을 저장했습니다.", "ok");
}

function configDraftFromForm(form: HTMLFormElement): ReturnType<typeof supabaseProjectConfigDraft> {
  return {
    anonKey: inputValue(form, "anonKey"),
    projectId: inputValue(form, "projectId"),
    url: inputValue(form, "url"),
  };
}

function inputValue(form: HTMLFormElement, name: string): string {
  const control = form.elements.namedItem(name);
  return control instanceof HTMLInputElement ? control.value : "";
}

function setStatusLine(statusLine: HTMLElement, message: string): void {
  clearChildren(statusLine);
  statusLine.textContent = message;
}

function closeDbConnectionSettings(): void {
  modalRoot?.remove();
  modalRoot = null;
}

function dbConnectionStatusText(status: DbPersistenceStatus): string {
  switch (status.kind) {
    case "ready":
      return `DB 연동: 준비됨 (${dbConfigSourceLabel(status.source)})`;
    case "not-configured":
      return `DB 연동: 설정 필요 (${dbConfigSourceLabel(status.source)})`;
    case "disabled":
      return "DB 연동: 꺼짐";
  }
}

function dbConnectionStatusButtonTitle(status: DbPersistenceStatus, autoSave: ReturnType<typeof store.getAutoSaveState>): string {
  return `${dbConnectionStatusTitle(status)} ${autoSaveStatusTitle(autoSave)} 클릭해서 DB 설정/연결을 엽니다.`;
}

function autoSaveStatusText(state: ReturnType<typeof store.getAutoSaveState>): string {
  switch (state.kind) {
    case "idle":
      return "저장 대기 없음";
    case "pending":
      return "● 저장 대기";
    case "saving":
      return "● 저장 중…";
    case "saved":
      return `✓ 저장됨 ${formatAutoSaveTime(state.at)}`;
    case "error":
      return "⚠ 저장 실패";
  }
}

function autoSaveStatusTitle(state: ReturnType<typeof store.getAutoSaveState>): string {
  switch (state.kind) {
    case "idle":
      return "자동저장 대기 중인 변경이 없습니다.";
    case "pending":
      return "변경 사항이 있어 곧 자동저장합니다.";
    case "saving":
      return "변경 사항을 저장하는 중입니다.";
    case "saved":
      return `${formatAutoSaveTime(state.at)}에 저장했습니다.`;
    case "error":
      return `저장 실패: ${state.message}`;
  }
}

function formatAutoSaveTime(at: number): string {
  const date = new Date(at);
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

function dbConnectionStatusTitle(status: DbPersistenceStatus): string {
  switch (status.kind) {
    case "ready":
      return `DB 저장 가능: ${status.url} / ${status.projectId} / ${dbConfigSourceLabel(status.source)}`;
    case "not-configured":
      return `DB 저장 설정 필요: ${status.missing.map(dbConfigFieldLabel).join(", ")} / ${dbConfigSourceLabel(status.source)}`;
    case "disabled":
      return status.reason === "dev-showcase" ? "개발용 URL이라 원격 DB 저장이 꺼져 있습니다." : "프로젝트 불러오기 실패로 원격 DB 저장이 꺼져 있습니다.";
  }
}

function dbConfigSourceLabel(source: SupabaseProjectConfigSource): string {
  switch (source) {
    case "custom":
      return "사용자 설정";
    case "env":
      return ".env 기본값";
    case "legacy":
      return "브라우저 저장값";
  }
}

function dbConfigFieldLabel(field: DbConfigField): string {
  switch (field) {
    case "url":
      return "DB URL";
    case "anonKey":
      return "Anon key";
  }
}

function kebabName(name: keyof ReturnType<typeof supabaseProjectConfigDraft>): string {
  return name === "anonKey" ? "anon-key" : name === "projectId" ? "project-id" : name;
}
