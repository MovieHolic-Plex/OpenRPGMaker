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
    const backdrop = document.createElement("div");
    backdrop.style.cssText = "position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:24px;background:#080b12cc;font-family:system-ui,sans-serif;color:#f5f7fb";
    const modal = document.createElement("section");
    modal.style.cssText = "width:min(900px,100%);max-height:min(760px,calc(100vh - 48px));overflow:auto;border:1px solid #3c4a63;border-radius:22px;background:#171c26;box-shadow:0 30px 90px #0009";
    modal.innerHTML = `<header style="display:flex;justify-content:space-between;align-items:start;padding:24px 28px 18px;border-bottom:1px solid #2b3446"><div><h1 style="margin:0;font-size:23px">프로젝트 열기</h1><p style="margin:7px 0 0;color:#aab5c8;font-size:13px">이 서버에서 작업할 프로젝트를 선택하세요.</p></div><button data-close style="border:0;border-radius:10px;background:#252d3c;color:#b9c4d8;font-size:20px;width:36px;height:36px">×</button></header>`;
    const body = document.createElement("div"); body.style.cssText = "padding:20px 28px 28px";
    const search = document.createElement("input"); search.placeholder = "프로젝트 이름 또는 폴더 경로 검색"; search.style.cssText = "width:100%;padding:12px 14px;border:1px solid #3b4960;border-radius:11px;background:#10151e;color:#fff;font-size:14px;box-sizing:border-box";
    const grid = document.createElement("div"); grid.style.cssText = "display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;margin-top:18px";
    const close = (value: string | null) => { backdrop.remove(); resolve(value); };
    const render = () => { grid.replaceChildren(...projects.filter((p) => `${p.title} ${p.projectDir}`.toLowerCase().includes(search.value.toLowerCase())).map((project) => {
      const card = document.createElement("article"); card.style.cssText = "border:1px solid #334057;border-radius:15px;background:#1d2431;padding:17px";
      card.innerHTML = `<div style="font-weight:700;font-size:16px">${escapeHtml(project.title)}</div><div style="margin-top:7px;color:#8695ac;font:12px ui-monospace,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(project.projectDir)}</div><button style="width:100%;margin-top:18px;border:0;border-radius:10px;padding:10px;background:#6d98ff;color:#091329;font-weight:750;cursor:pointer">이 프로젝트 열기</button>`;
      card.querySelector("button")?.addEventListener("click", () => close(project.projectDir)); return card;
    }) as Element[]); };
    search.addEventListener("input", render); modal.querySelector("[data-close]")?.addEventListener("click", () => close(null)); backdrop.addEventListener("click", (event) => { if (event.target === backdrop) close(null); });
    body.append(search, grid); modal.append(body); backdrop.append(modal); document.body.append(backdrop); search.focus(); render();
  });
}

function escapeHtml(value: string): string { return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char); }
