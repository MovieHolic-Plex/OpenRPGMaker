import { COVER_HEIGHT, COVER_WIDTH, paintProjectCover } from "@/editor/panels/projectPickerCover";
import { supabaseProjectConfig } from "@/project/supabaseProjectConfig";
import {
  listSupabaseProjects,
  type SupabaseProjectListConfig,
  type SupabaseProjectListItem,
} from "@/project/supabaseProjectSync";
import { clearChildren, el } from "@/util/dom";

type ProjectPickerOptions = {
  readonly autoLoad: boolean;
  readonly onCreateProject: () => Promise<void>;
  readonly onProjectSelected: (project: SupabaseProjectListItem) => Promise<void>;
  readonly onStatus: (message: string) => void;
};

export type ProjectPickerController = {
  readonly element: HTMLElement;
  readonly reload: () => Promise<void>;
};

export function renderProjectPicker(options: ProjectPickerOptions): ProjectPickerController {
  const list = el("div", {
    class: "db-config-project-list empty",
    // autoLoad가 꺼진 호출에서 "불러오는 중"이 영원히 남던 거짓 문구 수정 —
    // 실제 로딩은 loadProjectOptions가 시작할 때 바꿔 준다.
    text: "새로고침을 누르면 저장된 작업을 불러옵니다.",
    attrs: { "aria-live": "polite" },
    dataset: { testid: "db-config-project-list" },
  });
  const reload = async (): Promise<void> => loadProjectOptions(list, options);
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
          el("div", {
            class: "db-config-project-picker-actions",
            children: [
              el("button", {
                class: "btn primary",
                text: "새 작업 만들기",
                attrs: { type: "button" },
                dataset: { testid: "db-config-create-project" },
                on: { click: () => void options.onCreateProject() },
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
        ],
      }),
      list,
    ],
  });
  // 헤드리스(fakeDom) 환경 가드 — autoLoad 기본화 이후 window 부재에서 터지지 않게.
  if (options.autoLoad && typeof window !== "undefined" && typeof window.setTimeout === "function") {
    window.setTimeout(() => void reload(), 0);
  }
  return { element, reload };
}

async function loadProjectOptions(
  list: HTMLElement,
  options: ProjectPickerOptions,
): Promise<void> {
  const config = projectListConfig();
  if (!config) {
    renderProjectListMessage(list, "온라인 저장을 준비하지 못했습니다. 잠시 후 새로고침을 눌러 다시 시도하세요.");
    options.onStatus("온라인 저장을 준비하지 못했습니다. 앱 관리자에게 자동으로 확인이 필요한 문제입니다.");
    return;
  }
  list.setAttribute("aria-busy", "true");
  renderProjectListMessage(list, "작업 목록을 불러오는 중입니다.");
  options.onStatus("저장된 작업을 확인하고 있습니다.");
  try {
    // 15초 상한 — 응답 없는 서버에서 무한 로딩으로 멈추지 않고 오류+재시도로 떨어진다.
    const projects = typeof window !== "undefined" && typeof window.setTimeout === "function"
      ? await Promise.race([
        listSupabaseProjects(config),
        new Promise<never>((_, reject) => {
          window.setTimeout(() => reject(new Error("project list timeout")), 15000);
        }),
      ])
      : await listSupabaseProjects(config);
    renderProjectList(list, projects, config, options);
    options.onStatus(projects.length > 0 ? "열 작업을 선택하세요." : "아직 저장된 작업이 없습니다.");
  } catch {
    renderProjectListMessage(list, "작업 목록을 불러오지 못했습니다. 잠시 후 새로고침을 눌러 다시 시도하세요.");
    options.onStatus("작업 목록을 불러오지 못했습니다. 잠시 후 다시 시도하세요.");
  } finally {
    list.setAttribute("aria-busy", "false");
  }
}

function projectListConfig(): SupabaseProjectListConfig | null {
  const config = supabaseProjectConfig();
  return config ? { anonKey: config.anonKey, url: config.url } : null;
}

function renderProjectList(
  list: HTMLElement,
  projects: readonly SupabaseProjectListItem[],
  config: SupabaseProjectListConfig,
  options: ProjectPickerOptions,
): void {
  clearChildren(list);
  list.classList.toggle("empty", projects.length === 0);
  if (projects.length === 0) {
    renderEmptyProjectList(list);
    return;
  }
  for (const project of projects) {
    list.append(renderProjectOption(project, config, options));
  }
}

function renderEmptyProjectList(list: HTMLElement): void {
  list.append(el("div", {
    class: "db-config-project-empty",
    children: [
      el("strong", { text: "아직 저장된 작업이 없습니다." }),
      el("p", {
        children: [
          el("span", { text: "위의 ‘새 작업 만들기’를 누르면 바로 시작할 수 있습니다." }),
          el("span", { text: "온라인 저장은 앱이 자동으로 준비합니다." }),
        ],
      }),
    ],
  }));
}

function renderProjectOption(
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

function renderProjectListMessage(list: HTMLElement, message: string): void {
  clearChildren(list);
  list.classList.add("empty");
  list.textContent = message;
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
