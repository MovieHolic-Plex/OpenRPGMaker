import { renderProjectPicker } from "@/editor/panels/dbConnectionProjectPicker";
import { renderOnlineSaveStatus } from "@/editor/panels/dbConnectionStatus";
import type { DbPersistenceStatus } from "@/project/persistenceStatus";
import {
  saveSupabaseSelectedProjectId,
  supabaseProjectConfig,
} from "@/project/supabaseProjectConfig";
import type { SupabaseProjectListItem } from "@/project/supabaseProjectSync";
import { markSupabaseRecoveredLocation } from "@/project/supabaseRecoveryLocation";
import { syncProjectToUrl } from "@/project/projectUrl";
import { createBlankProject } from "@/project/defaults";
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
  const onlineSaveReady = supabaseProjectConfig() !== null;
  const statusLine = el("p", {
    class: "db-config-status-line",
    text: onlineConfigStatusText(onlineSaveReady),
    attrs: { role: "status", "aria-live": "polite" },
    dataset: { testid: "db-config-status-line" },
  });
  const form = el("form", { class: "db-config-form" });
  const projectPicker = renderProjectPicker({
    // 기본적으로 바로 불러온다 — 상태바 경로가 옵션 없이 열려 "불러오는 중" 문구가
    // 영원히 멈춰 있던 결함 수정(2026-08-18 UX 리뷰 P0-3).
    autoLoad: options.autoLoadProjects !== false,
    onCreateProject: async () => createNewProject(statusLine, onRefresh),
    onProjectSelected: async (project) => connectToSelectedProject(statusLine, onRefresh, project),
    onStatus: (message) => setStatusLine(statusLine, message),
  });
  form.append(
    renderIntro(required),
    projectPicker.element,
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
  form.querySelector<HTMLButtonElement>("[data-testid='db-config-create-project']")?.focus();
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
      el("span", { text: "선택한 작업은 이 기기에 기억되고, 저장은 자동으로 처리됩니다." }),
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
  statusLine: HTMLElement,
  onRefresh: StatusRefresh,
  project: SupabaseProjectListItem,
): Promise<void> {
  if (connecting) return;
  connecting = true;
  setStatusLine(statusLine, `${project.title}을 여는 중입니다.`);
  saveSupabaseSelectedProjectId(project.projectId);
  syncProjectToUrl({ projectId: project.projectId, projectName: project.title });
  try {
    const result = await store.reconnectRemotePersistence();
    if (result.kind === "connected") {
      await finishProjectChoice("작업을 열었습니다");
      return;
    }
    setStatusLine(statusLine, "작업을 열지 못했습니다. 잠시 후 새로고침을 눌러 다시 시도하세요.");
    toast("작업을 열지 못했습니다", "error");
  } catch (error) {
    console.error("[db-project-picker] failed to open selected project:", error);
    setStatusLine(statusLine, "작업을 열지 못했습니다. 잠시 후 다시 시도하세요.");
    toast("작업을 열지 못했습니다", "error");
  } finally {
    connecting = false;
    onRefresh();
  }
}

async function createNewProject(statusLine: HTMLElement, onRefresh: StatusRefresh): Promise<void> {
  if (connecting) return;
  if (!supabaseProjectConfig()) {
    setStatusLine(statusLine, "온라인 저장을 준비하지 못했습니다. 잠시 후 다시 시도하세요.");
    toast("온라인 저장을 준비하지 못했습니다", "error");
    return;
  }
  connecting = true;
  setStatusLine(statusLine, "새 작업을 만들고 온라인에 저장하는 중입니다.");
  try {
    const created = await store.loadNewRemoteProject(createBlankProject(), { title: "새 프로젝트" });
    const saved = await store.flush();
    if (!created.projectId || saved.kind !== "saved") {
      setStatusLine(statusLine, "새 작업을 저장하지 못했습니다. 잠시 후 다시 시도하세요.");
      toast("새 작업을 저장하지 못했습니다", "error");
      return;
    }
    await finishProjectChoice("새 작업을 만들었습니다");
  } catch (error) {
    console.error("[db-project-picker] failed to create project:", error);
    setStatusLine(statusLine, "새 작업을 만들지 못했습니다. 잠시 후 다시 시도하세요.");
    toast("새 작업을 만들지 못했습니다", "error");
  } finally {
    connecting = false;
    onRefresh();
  }
}

async function finishProjectChoice(message: string): Promise<void> {
  markSupabaseRecoveredLocation();
  const { focusProjectStartMap } = await import("@/editor/mapSelection");
  focusProjectStartMap();
  toast(message, "ok");
  closeDbConnectionSettings();
}

function onlineConfigStatusText(ready: boolean): string {
  return ready
    ? "온라인 저장이 준비되었습니다."
    : "온라인 저장을 준비하지 못했습니다. 잠시 후 새로고침을 눌러 다시 시도하세요.";
}

function setStatusLine(statusLine: HTMLElement, message: string): void {
  clearChildren(statusLine);
  statusLine.textContent = message;
}

function closeDbConnectionSettings(): void {
  modalRoot?.remove();
  modalRoot = null;
}
