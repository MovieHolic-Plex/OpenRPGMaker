import { filterRecentProjects, withoutRecentProject, type RecentProjectSort } from "../../electron/shared/recentProjects";
import type { RecentProjectEntry } from "../../electron/shared/start";
import { formatLastOpenedTime } from "@/project/recentProjectTime";
import { getLocale } from "@/i18n";
import { el } from "@/util/dom";
import { serialize } from "@/project/io";
import { ensureSharedContent, loadSharedContent } from "@/project/sharedContent";
import type { Project } from "@/project/types";
import { loadWithOpeningDialog } from "@/editor/ui/loadWithOpeningDialog";

function startBridge(): NonNullable<Window["oprn"]>["start"] | undefined {
  return typeof window === "undefined" ? undefined : window.oprn?.start;
}

/**
 * 성공하면 데스크톱은 새 폴더를 열고 웹은 새 프로젝트 URL을 설정한다. 호출자는 `window.location.reload()`로 부팅한다.
 * 저장 브리지가 없는 정적 웹 미리보기는 false.
 */
export async function createProjectFolderWithSeed(title: string, seed: Project, projectDir?: string): Promise<boolean> {
  const bridge = startBridge();
  if (!bridge) return false;
  // A seed can predate bootstrap loading (or come from a copied project). Refresh
  // before the first write; a failed host read must not create an incomplete folder.
  // Packaged app:// currently has no shared-content endpoint, unlike HTTP hosts.
  const required = window.location.protocol === "http:" || window.location.protocol === "https:";
  await loadSharedContent({ required, scope: "defaults" });
  ensureSharedContent(seed);
  const created = await bridge.createProject({ title, seed: serialize(seed), ...(projectDir ? { projectDir } : {}) });
  return created !== null;
}

/** 기존 폴더를 고르게 한다. 성공 뒤에도 같은 리로드 규칙이 적용된다. */
export async function openProjectFolder(): Promise<boolean> {
  const bridge = startBridge();
  if (!bridge) {
    if (!("showDirectoryPicker" in window)) return false;
    let directory: FileSystemDirectoryHandle;
    try {
      directory = await (window as Window & { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker();
    } catch (error) {
      // 사용자가 폴더 선택 창을 닫은 것 — 오류가 아니다. 브라우저 영문 예외 원문을 토스트로 보이지 않는다.
      if (error instanceof DOMException && error.name === "AbortError") return false;
      throw error;
    }
    const file = await (await directory.getFileHandle("project.json")).getFile();
    const project = JSON.parse(await file.text()) as Project;
    if (!project || typeof project !== "object" || !project.meta) throw new Error("선택한 폴더에 올바른 project.json이 없습니다.");
    const { store } = await import("@/project/store");
    store.replaceProject(project);
    return true;
  }
  const projects = await loadWithOpeningDialog("프로젝트 열기", () => bridge.recentProjects());
  if (!projects) return false;
  const forgetRecent = bridge.forgetRecent;
  if (!forgetRecent && projects.length === 0) throw new Error("이 서버에 열 수 있는 프로젝트 폴더가 없습니다. 먼저 새 프로젝트를 만드세요.");
  const selection = await chooseProject(forgetRecent ? projects.filter((entry) => entry.hiddenReason !== "temporary") : projects, forgetRecent);
  if (!selection) return false;
  const opened = await bridge.openFolder(selection === "browse" ? undefined : { projectDir: selection.projectDir });
  return opened !== null;
}

function chooseProject(
  entries: readonly RecentProjectEntry[],
  forget?: (entry: { projectDir: string }) => Promise<boolean>,
): Promise<RecentProjectEntry | "browse" | null> {
  return new Promise((resolve) => {
    let projects = entries;
    const opener = document.activeElement;
    const close = (value: RecentProjectEntry | "browse" | null): void => {
      backdrop.remove();
      if (opener instanceof HTMLElement) opener.focus();
      resolve(value);
    };
    const search = el("input", { class: "project-folder-picker-search", attrs: {
      type: "search", placeholder: "프로젝트 이름 또는 폴더 경로 검색", "aria-label": "프로젝트 검색",
    } });
    const sort = el("select", { class: "project-folder-picker-search project-folder-picker-sort", attrs: { "aria-label": "프로젝트 정렬" }, children: [
      el("option", { attrs: { value: "opened" }, text: "최근 연 순" }),
      el("option", { attrs: { value: "name" }, text: "이름 순" }),
    ] });
    const count = el("span", { class: "project-folder-picker-count" });
    const grid = el("div", { class: "project-folder-picker-grid" });
    const error = el("p", { attrs: { role: "alert", hidden: "" } });
    const render = (): void => {
      const order: RecentProjectSort = sort.value === "name" ? "name" : "opened";
      const visible = filterRecentProjects(projects, search.value, order, getLocale());
      count.textContent = `${visible.length}개`;
      grid.replaceChildren(...visible.map((project) => {
        const missing = project.hiddenReason === "missing";
        const activity = formatLastOpenedTime(project.lastOpenedAt, getLocale());
        const action = el("button", { class: "project-folder-picker-open", attrs: { type: "button" }, text: missing ? "목록에서 제거" : "열기" });
        action.addEventListener("click", () => {
          if (!missing) { close(project); return; }
          if (!forget) return;
          action.disabled = true;
          error.hidden = true;
          void forget({ projectDir: project.projectDir }).then((forgotten) => {
            if (!forgotten) throw new Error("목록에서 지우지 못했습니다.");
            projects = withoutRecentProject(projects, project.projectDir);
            render();
            search.focus();
          }).catch(() => {
            error.textContent = "목록에서 지우지 못했습니다.";
            error.hidden = false;
            action.disabled = false;
          });
        });
        const card = el("article", { class: "project-folder-picker-card" + (missing ? " is-missing" : ""), children: [
          el("div", { class: "project-folder-picker-card-mark", attrs: { "aria-hidden": "true", translate: "no" }, text: [...project.title][0] || "?" }),
          el("div", { class: "project-folder-picker-card-content", children: [
            el("div", { class: "project-folder-picker-card-title-row", children: [
              el("div", { class: "project-folder-picker-card-title", attrs: { translate: "no" }, text: project.title }),
              ...(forget ? [] : [el("span", { class: "project-folder-picker-card-status", text: "사용 가능" })]),
            ] }),
            el("div", { class: "project-folder-picker-card-path", attrs: { title: project.projectDir, translate: "no" }, text: project.projectDir }),
            el("div", { class: "project-folder-picker-card-meta", text: missing ? "찾을 수 없음" : forget
              ? activity || "열기 기록 없음" : "서버 프로젝트 · SQLite 정본" }),
          ] }),
          action,
        ] });
        const hue = Math.abs([...project.projectDir].reduce((sum, char) => sum + char.charCodeAt(0), 0)) % 360;
        card.style.setProperty("--project-card-hue", String(hue));
        card.style.setProperty("--project-card-hue-alt", String((hue + 48) % 360));
        return card;
      }));
      if (!visible.length) grid.append(el("p", { text: search.value.trim() ? "검색 결과가 없습니다." : "최근 프로젝트가 없습니다." }));
    };
    const modal = el("section", { class: "project-folder-picker-modal", attrs: { role: "dialog", "aria-modal": "true", "aria-label": "프로젝트 열기" }, children: [
      el("header", { class: "project-folder-picker-header", children: [
        el("div", { children: [
          el("div", { class: "project-folder-picker-heading", children: [
            ...(forget ? [] : [el("span", { class: "project-folder-picker-heading-mark", attrs: { "aria-hidden": "true" }, text: "✦" })]),
            el("h1", { text: "프로젝트 열기" }),
          ] }),
          ...(forget ? [] : [el("p", { class: "project-folder-picker-description", text: "이 서버에서 작업할 프로젝트를 선택하세요." })]),
        ] }),
        el("button", { class: "project-folder-picker-close", attrs: { type: "button", "aria-label": "닫기" }, text: "×", on: { click: () => close(null) } }),
      ] }),
      el("div", { class: "project-folder-picker-body", children: [
        el("div", { class: "project-folder-picker-toolbar", children: [
          search, ...(forget ? [sort] : []), count,
          ...(forget ? [el("button", { class: "project-folder-picker-open", attrs: { type: "button" }, text: "폴더 열기…", on: { click: () => close("browse") } })] : []),
        ] }),
        error, grid,
      ] }),
    ] });
    const backdrop = el("div", { class: "project-folder-picker-backdrop", children: [modal], on: {
      click: (event) => { if (event.target === backdrop) close(null); },
      keydown: (event) => { if ((event as KeyboardEvent).key === "Escape") { event.stopPropagation(); close(null); } },
    } });
    search.addEventListener("input", render);
    sort.addEventListener("change", render);
    document.body.append(backdrop);
    render();
    search.focus();
  });
}
