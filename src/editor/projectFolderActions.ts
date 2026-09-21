import { serialize } from "@/project/io";
import type { Project } from "@/project/types";

function startBridge(): NonNullable<Window["oprn"]>["start"] | undefined {
  return typeof window === "undefined" ? undefined : window.oprn?.start;
}

/**
 * 성공하면 데스크톱은 새 폴더를 열고 웹은 새 프로젝트 URL을 설정한다. 호출자는 `window.location.reload()`로 부팅한다.
 * 저장 브리지가 없는 정적 웹 미리보기는 false.
 */
export async function createProjectFolderWithSeed(title: string, seed: Project): Promise<boolean> {
  const bridge = startBridge();
  if (!bridge) return false;
  const created = await bridge.createProject({ title, seed: serialize(seed) });
  return created !== null;
}

/** 기존 폴더를 고르게 한다. 성공 뒤에도 같은 리로드 규칙이 적용된다. */
export async function openProjectFolder(): Promise<boolean> {
  const bridge = startBridge();
  if (!bridge) {
    if (!("showDirectoryPicker" in window)) return false;
    const directory = await (window as Window & { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker();
    const file = await (await directory.getFileHandle("project.json")).getFile();
    const project = JSON.parse(await file.text()) as Project;
    if (!project || typeof project !== "object" || !project.meta) throw new Error("선택한 폴더에 올바른 project.json이 없습니다.");
    const { store } = await import("@/project/store");
    store.replaceProject(project);
    return true;
  }
  const projects = await bridge.recentProjects();
  if (projects.length === 0) throw new Error("이 서버에 열 수 있는 프로젝트 폴더가 없습니다. 먼저 새 프로젝트를 만드세요.");
  const selected = await chooseHostedProject(projects);
  if (!selected) return false;
  const opened = await bridge.openFolder({ projectDir: selected });
  return opened !== null;
}

function chooseHostedProject(projects: readonly { projectDir: string; title: string }[]): Promise<string | null> {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div"); backdrop.className = "project-folder-picker-backdrop";
    const modal = document.createElement("section"); modal.className = "project-folder-picker-modal";
    modal.innerHTML = `<header class="project-folder-picker-header"><div><div class="project-folder-picker-heading"><span class="project-folder-picker-heading-mark">✦</span><h1>프로젝트 열기</h1></div><p class="project-folder-picker-description">이 서버에서 작업할 프로젝트를 선택하세요.</p></div><button class="project-folder-picker-close" data-close aria-label="닫기">×</button></header>`;
    const body = document.createElement("div"); body.className = "project-folder-picker-body";
    const toolbar = document.createElement("div"); toolbar.className = "project-folder-picker-toolbar";
    const search = document.createElement("input"); search.className = "project-folder-picker-search"; search.placeholder = "프로젝트 이름 또는 폴더 경로 검색"; search.setAttribute("aria-label", "프로젝트 검색");
    const count = document.createElement("span"); count.className = "project-folder-picker-count";
    const grid = document.createElement("div"); grid.className = "project-folder-picker-grid";
    const close = (value: string | null) => { backdrop.remove(); resolve(value); };
    const render = () => { const visible = projects.filter((p) => `${p.title} ${p.projectDir}`.toLowerCase().includes(search.value.toLowerCase())); count.textContent = `${visible.length}개`; grid.replaceChildren(...visible.map((project) => {
      const card = document.createElement("article"); card.className = "project-folder-picker-card";
      const hue = Math.abs([...project.projectDir].reduce((sum, char) => sum + char.charCodeAt(0), 0)) % 360;
      card.style.setProperty("--project-card-hue", String(hue));
      card.style.setProperty("--project-card-hue-alt", String((hue + 48) % 360));
      card.innerHTML = `<div class="project-folder-picker-card-mark" aria-hidden="true">${escapeHtml(project.title.slice(0, 1) || "?")}</div><div class="project-folder-picker-card-content"><div class="project-folder-picker-card-title-row"><div class="project-folder-picker-card-title">${escapeHtml(project.title)}</div><span class="project-folder-picker-card-status">사용 가능</span></div><div class="project-folder-picker-card-path">${escapeHtml(project.projectDir)}</div><div class="project-folder-picker-card-meta"><span>서버 프로젝트</span><span>SQLite 정본</span></div></div><button class="project-folder-picker-open">열기 <span aria-hidden="true">→</span></button>`;
      card.querySelector("button")?.addEventListener("click", () => close(project.projectDir)); return card;
    }) as Element[]); };
    search.addEventListener("input", render); modal.querySelector("[data-close]")?.addEventListener("click", () => close(null)); backdrop.addEventListener("click", (event) => { if (event.target === backdrop) close(null); });
    toolbar.append(search, count); body.append(toolbar, grid); modal.append(body); backdrop.append(modal); document.body.append(backdrop); search.focus(); render();
  });
}

function escapeHtml(value: string): string { return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char); }
