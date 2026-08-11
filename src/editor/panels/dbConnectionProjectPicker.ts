import { COVER_HEIGHT, COVER_WIDTH, paintProjectCover } from "@/editor/panels/projectPickerCover";
import { syncProjectToUrl } from "@/project/projectUrl";
import { resolveBrowserSupabaseUrl } from "@/project/supabaseProxyPath";
import {
  listSupabaseProjects,
  type SupabaseProjectListConfig,
  type SupabaseProjectListItem,
} from "@/project/supabaseProjectSync";
import { clearChildren, el } from "@/util/dom";

type ProjectPickerOptions = {
  readonly autoLoad: boolean;
  readonly onProjectSelected: (project: SupabaseProjectListItem) => Promise<void>;
  readonly onStatus: (message: string) => void;
};

export type ProjectPickerController = {
  readonly element: HTMLElement;
  readonly reload: () => Promise<void>;
};

export function renderProjectPicker(
  form: HTMLFormElement,
  options: ProjectPickerOptions,
): ProjectPickerController {
  const list = el("div", {
    class: "db-config-project-list empty",
    text: "저장된 작업을 불러오는 중입니다.",
    attrs: { "aria-live": "polite" },
    dataset: { testid: "db-config-project-list" },
  });
  const reload = async (): Promise<void> => loadProjectOptions(form, list, options);
  const element = el("section", {
    class: "db-config-project-picker",
    dataset: { testid: "db-config-project-picker" },
    children: [
      el("div", {
        class: "db-config-project-picker-header",
        children: [
          el("div", {
            children: [
              el("strong", { text: "내 작업" }),
              el("span", { text: "계속 편집할 작업을 선택하세요." }),
            ],
          }),
          el("button", {
            class: "btn",
            text: "새로고침",
            attrs: { type: "button" },
            dataset: { testid: "db-config-load-projects" },
            on: { click: () => void reload() },
          }),
        ],
      }),
      list,
    ],
  });
  if (options.autoLoad) window.setTimeout(() => void reload(), 0);
  return { element, reload };
}

async function loadProjectOptions(
  form: HTMLFormElement,
  list: HTMLElement,
  options: ProjectPickerOptions,
): Promise<void> {
  const config = projectListConfigFromForm(form);
  if (!config) {
    renderProjectListMessage(list, "온라인 저장 설정을 찾지 못했습니다. 아래의 ‘연결 문제 해결’을 확인하세요.");
    options.onStatus("작업 목록을 불러오려면 이 앱의 온라인 저장 설정이 필요합니다.");
    return;
  }
  list.setAttribute("aria-busy", "true");
  renderProjectListMessage(list, "작업 목록을 불러오는 중입니다.");
  options.onStatus("저장된 작업을 확인하고 있습니다.");
  try {
    const projects = await listSupabaseProjects(config);
    renderProjectList(form, list, projects, config, options);
    options.onStatus(projects.length > 0 ? "열 작업을 선택하세요." : "아직 저장된 작업이 없습니다.");
  } catch {
    renderProjectListMessage(list, "작업 목록을 불러오지 못했습니다. 연결 문제 해결에서 설정을 확인하세요.");
    options.onStatus("작업 목록을 불러오지 못했습니다. 잠시 후 다시 시도하세요.");
  } finally {
    list.setAttribute("aria-busy", "false");
  }
}

function projectListConfigFromForm(form: HTMLFormElement): SupabaseProjectListConfig | null {
  const raw = inputValue(form, "url").replace(/\/+$/u, "");
  const anonKey = inputValue(form, "anonKey");
  if (raw.length === 0 || anonKey.length === 0) return null;
  const url = resolveBrowserSupabaseUrl(raw, {
    isDev: import.meta.env.DEV === true,
    pageProtocol: typeof window === "undefined" ? undefined : window.location?.protocol,
  });
  return { anonKey, url };
}

function renderProjectList(
  form: HTMLFormElement,
  list: HTMLElement,
  projects: readonly SupabaseProjectListItem[],
  config: SupabaseProjectListConfig,
  options: ProjectPickerOptions,
): void {
  clearChildren(list);
  list.classList.toggle("empty", projects.length === 0);
  if (projects.length === 0) {
    renderEmptyProjectList(form, list);
    return;
  }
  for (const project of projects) {
    list.append(renderProjectOption(form, project, config, options));
  }
}

function renderEmptyProjectList(form: HTMLFormElement, list: HTMLElement): void {
  list.append(el("div", {
    class: "db-config-project-empty",
    children: [
      el("strong", { text: "아직 저장된 작업이 없습니다." }),
      el("p", {
        children: [
          el("span", { text: "관리자에게 작업을 요청하세요." }),
          el("span", { text: "연결 문제는 아래에서 해결할 수 있습니다." }),
        ],
      }),
      el("button", {
        class: "btn",
        text: "연결 문제 해결",
        attrs: { type: "button" },
        dataset: { testid: "db-config-empty-help" },
        on: { click: () => revealAdvancedConnectionSettings(form) },
      }),
    ],
  }));
}

function revealAdvancedConnectionSettings(form: HTMLFormElement): void {
  const details = form.querySelector<HTMLDetailsElement>("[data-testid='db-config-advanced']");
  if (!details) return;
  details.open = true;
  details.querySelector<HTMLElement>("summary")?.focus();
}

function renderProjectOption(
  form: HTMLFormElement,
  project: SupabaseProjectListItem,
  config: SupabaseProjectListConfig,
  options: ProjectPickerOptions,
): HTMLElement {
  const canvas = el("canvas", {
    class: "db-config-project-cover-canvas",
    attrs: { width: String(COVER_WIDTH), height: String(COVER_HEIGHT), role: "presentation" },
  });
  const coverTag = el("span", { class: "db-config-project-cover-tag", text: "미리보기 준비 중" });
  void paintProjectCover(canvas, config, project.projectId, project.updatedAt).then((kind) => {
    coverTag.textContent = kind === "map" ? "대표 맵" : "기본 표지";
    coverTag.classList.toggle("is-fallback", kind === "fallback");
  });

  return el("button", {
    class: "db-config-project-option",
    attrs: { type: "button", "aria-label": `${project.title} 열기` },
    dataset: { projectId: project.projectId, testid: "db-config-project-option" },
    on: {
      click: () => {
        selectProjectId(form, project);
        options.onStatus(`${project.title} 작업을 여는 중입니다.`);
        void options.onProjectSelected(project);
      },
    },
    children: [
      el("span", { class: "db-config-project-cover", children: [canvas, coverTag] }),
      el("span", {
        class: "db-config-project-meta",
        children: [
          el("strong", { text: project.title }),
          el("span", {
            class: "db-config-project-stats",
            children: [
              el("span", { text: `맵 ${project.mapCount}` }),
              el("span", { text: `타일셋 ${project.tilesetCount}` }),
              el("span", { class: "db-config-project-when", text: relativeUpdatedAt(project.updatedAt) }),
            ],
          }),
        ],
      }),
    ],
  });
}

function selectProjectId(form: HTMLFormElement, project: SupabaseProjectListItem): void {
  const control = form.elements.namedItem("projectId");
  if (!(control instanceof HTMLInputElement)) return;
  control.value = project.projectId;
  syncProjectToUrl({ projectId: project.projectId, projectName: project.title });
}

function renderProjectListMessage(list: HTMLElement, message: string): void {
  clearChildren(list);
  list.classList.add("empty");
  list.textContent = message;
}

function inputValue(form: HTMLFormElement, name: string): string {
  const control = form.elements.namedItem(name);
  return control instanceof HTMLInputElement ? control.value : "";
}

function relativeUpdatedAt(iso: string | null): string {
  if (!iso) return "저장 시각 미상";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "저장 시각 미상";
  const seconds = Math.max(0, (Date.now() - then) / 1000);
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))}분 전`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}시간 전`;
  if (seconds < 86400 * 14) return `${Math.round(seconds / 86400)}일 전`;
  if (seconds < 86400 * 60) return `${Math.round(seconds / (86400 * 7))}주 전`;
  return `${Math.round(seconds / (86400 * 30))}개월 전`;
}
