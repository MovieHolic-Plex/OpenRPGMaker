import { ensureCurrentMapLock } from "@/editor/mapEditLocks";
import type { DbConfigField, DbPersistenceStatus } from "@/project/persistenceStatus";
import {
  clearSupabaseProjectConfigDraft,
  saveSupabaseProjectConfigDraft,
  supabaseProjectConfigDraft,
  supabaseProjectConfigDraftWithSource,
} from "@/project/supabaseProjectConfig";
import type { SupabaseProjectConfigSource } from "@/project/supabaseProjectConfig";
import {
  listSupabaseProjects,
  pingSupabaseProject,
  type SupabaseProjectListConfig,
  type SupabaseProjectListItem,
} from "@/project/supabaseProjectSync";
import { markSupabaseRecoveredLocation } from "@/project/supabaseRecoveryLocation";
import { store } from "@/project/store";
import { clearChildren, el } from "@/util/dom";
import { toast } from "@/util/toast";

type StatusRefresh = () => void;

type DbHealthState =
  | { readonly kind: "checking" }
  | { readonly kind: "healthy" }
  | { readonly kind: "missing" }
  | { readonly kind: "unreachable"; readonly message: string };

type DbConnectionSettingsOptions = {
  readonly autoLoadProjects?: boolean;
  readonly required?: boolean;
};

const DB_HEALTH_PING_INTERVAL_MS = 15_000;

let modalRoot: HTMLElement | null = null;
let connecting = false;
let dbHealthState: DbHealthState = { kind: "checking" };
let dbHealthConfigKey: string | null = null;
let dbHealthTimer: number | null = null;
let dbHealthInFlight = false;
let dbHealthRefresh: StatusRefresh = () => undefined;

export function renderDbConnectionStatus(status: DbPersistenceStatus, onRefresh: StatusRefresh): HTMLElement {
  ensureDbHealthPolling(status, onRefresh);
  const health = dbHealthForStatus(status);
  const button = el("button", {
    class: `editor-statusbar-cell db-connection-status ${dbConnectionStatusClass(status, health)}`,
    text: dbConnectionStatusText(status, health),
    attrs: { title: `${dbConnectionStatusTitle(status, health)} 클릭해서 DB 설정/연결을 엽니다.`, type: "button" },
    dataset: { testid: "db-connection-status" },
    on: { click: () => openDbConnectionSettings(onRefresh) },
  });
  return button;
}

export function resetDbConnectionHealthForTests(): void {
  stopDbHealthPolling();
  dbHealthState = { kind: "checking" };
  dbHealthConfigKey = null;
  dbHealthInFlight = false;
  dbHealthRefresh = () => undefined;
}

export function openDbConnectionSettings(onRefresh: StatusRefresh = () => undefined, options: DbConnectionSettingsOptions = {}): void {
  modalRoot?.remove();
  const required = options.required === true;
  const draft = supabaseProjectConfigDraftWithSource();
  const statusLine = el("p", {
    class: "db-config-status-line",
    text: `현재 DB 설정: ${dbConfigSourceLabel(draft.source)}. 저장한 뒤 즉시 연결을 시도합니다.`,
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
            resetDbConnectionHealth();
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

async function connectFromForm(form: HTMLFormElement, statusLine: HTMLElement, onRefresh: StatusRefresh): Promise<void> {
  if (connecting) return;
  connecting = true;
  setStatusLine(statusLine, "DB 연결 시도 중...");
  saveConfigFromForm(form, statusLine, onRefresh, false);
  const result = await store.reconnectRemotePersistence();
  connecting = false;
  onRefresh();
  if (result.kind === "connected") {
    setDbHealthState({ kind: "healthy" });
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
  resetDbConnectionHealth();
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

function ensureDbHealthPolling(status: DbPersistenceStatus, onRefresh: StatusRefresh): void {
  if (status.kind !== "ready" || typeof window === "undefined") {
    stopDbHealthPolling();
    return;
  }
  dbHealthRefresh = onRefresh;
  const nextConfigKey = `${status.url}\n${status.projectId}\n${status.source}`;
  if (dbHealthConfigKey !== nextConfigKey) {
    dbHealthConfigKey = nextConfigKey;
    dbHealthState = { kind: "checking" };
    void refreshDbHealth(nextConfigKey);
  }
  if (dbHealthTimer === null) {
    dbHealthTimer = window.setInterval(() => {
      const configKey = dbHealthConfigKey;
      if (configKey) void refreshDbHealth(configKey);
    }, DB_HEALTH_PING_INTERVAL_MS);
  }
}

async function refreshDbHealth(configKey: string): Promise<void> {
  if (dbHealthInFlight) return;
  dbHealthInFlight = true;
  try {
    const result = await pingSupabaseProject();
    if (dbHealthConfigKey !== configKey) return;
    switch (result.kind) {
      case "healthy":
        setDbHealthState({ kind: "healthy" });
        break;
      case "missing":
        setDbHealthState({ kind: "missing" });
        break;
      case "not-configured":
        setDbHealthState({ kind: "unreachable", message: "DB 설정이 비어 있습니다." });
        break;
    }
  } catch (error) {
    if (dbHealthConfigKey !== configKey) return;
    setDbHealthState({ kind: "unreachable", message: error instanceof Error ? error.message : "알 수 없는 오류" });
  } finally {
    dbHealthInFlight = false;
  }
}

function setDbHealthState(next: DbHealthState): void {
  if (dbHealthStateKey(dbHealthState) === dbHealthStateKey(next)) return;
  dbHealthState = next;
  dbHealthRefresh();
}

function dbHealthStateKey(state: DbHealthState): string {
  return state.kind === "unreachable" ? `${state.kind}:${state.message}` : state.kind;
}

function resetDbConnectionHealth(): void {
  dbHealthState = { kind: "checking" };
  dbHealthConfigKey = null;
}

function stopDbHealthPolling(): void {
  if (dbHealthTimer !== null) {
    window.clearInterval(dbHealthTimer);
    dbHealthTimer = null;
  }
}

function dbHealthForStatus(status: DbPersistenceStatus): DbHealthState {
  return status.kind === "ready" ? dbHealthState : { kind: "checking" };
}

function dbConnectionStatusClass(status: DbPersistenceStatus, health: DbHealthState): string {
  return status.kind === "ready" ? `${status.kind} ${health.kind}` : status.kind;
}

function dbConnectionStatusText(status: DbPersistenceStatus, health: DbHealthState): string {
  switch (status.kind) {
    case "ready":
      return dbHealthStatusText(health);
    case "not-configured":
      return "DB: 설정 필요";
    case "disabled":
      return "DB: 꺼짐";
  }
}

function dbHealthStatusText(health: DbHealthState): string {
  switch (health.kind) {
    case "checking":
      return "DB: 확인 중";
    case "healthy":
      return "DB: healthy";
    case "missing":
      return "DB: 프로젝트 없음";
    case "unreachable":
      return "DB: 끊김";
  }
}

function dbConnectionStatusTitle(status: DbPersistenceStatus, health: DbHealthState): string {
  switch (status.kind) {
    case "ready":
      return `${dbHealthStatusTitle(health)} (${status.url} / ${status.projectId} / ${dbConfigSourceLabel(status.source)})`;
    case "not-configured":
      return `DB 저장 설정 필요: ${status.missing.map(dbConfigFieldLabel).join(", ")} / ${dbConfigSourceLabel(status.source)}`;
    case "disabled":
      return status.reason === "dev-showcase" ? "개발용 URL이라 원격 DB 저장이 꺼져 있습니다." : "프로젝트 불러오기 실패로 원격 DB 저장이 꺼져 있습니다.";
  }
}

function dbHealthStatusTitle(health: DbHealthState): string {
  switch (health.kind) {
    case "checking":
      return "DB 설정은 저장되어 있고, 실제 연결 상태를 확인하는 중입니다.";
    case "healthy":
      return "방금 DB ping이 성공했습니다. 원격 저장/불러오기를 시도할 수 있습니다.";
    case "missing":
      return "DB 서버는 응답했지만 현재 Project ID를 찾지 못했습니다.";
    case "unreachable":
      return `DB ping 실패: ${health.message}`;
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
