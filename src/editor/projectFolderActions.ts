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
    backdrop.style.cssText = "position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:24px;background:rgba(8,11,18,.76);backdrop-filter:blur(14px);font-family:Inter,Pretendard,system-ui,sans-serif;color:#f5f7fb";
    const modal = document.createElement("section");
    modal.style.cssText = "width:min(940px,100%);max-height:min(780px,calc(100vh - 48px));overflow:auto;border:1px solid #44536e;border-radius:24px;background:linear-gradient(145deg,#1b2433,#151a24 70%);box-shadow:0 34px 110px #000b,inset 0 1px #ffffff10";
    modal.innerHTML = `<header style="display:flex;justify-content:space-between;align-items:start;padding:28px 30px 22px;border-bottom:1px solid #303b50"><div><div style="display:flex;align-items:center;gap:10px"><span style="display:grid;place-items:center;width:30px;height:30px;border-radius:9px;background:#6d98ff;color:#081329;font-weight:900">✦</span><h1 style="margin:0;font-size:24px;letter-spacing:-.04em">프로젝트 열기</h1></div><p style="margin:10px 0 0;color:#aab7ca;font-size:13px">이 서버에서 작업할 프로젝트를 선택하세요.</p></div><button data-close aria-label="닫기" style="border:1px solid #3a465c;border-radius:11px;background:#222b3b;color:#c6d0e0;font-size:20px;width:38px;height:38px;cursor:pointer">×</button></header>`;
    const body = document.createElement("div"); body.style.cssText = "padding:20px 30px 28px";
    const toolbar = document.createElement("div"); toolbar.style.cssText = "display:flex;gap:10px;align-items:center";
    const search = document.createElement("input"); search.placeholder = "프로젝트 이름 또는 폴더 경로 검색"; search.setAttribute("aria-label", "프로젝트 검색"); search.style.cssText = "flex:1;min-width:0;padding:13px 15px;border:1px solid #46556f;border-radius:12px;background:#101620;color:#fff;font-size:14px;box-sizing:border-box;outline:none";
    const count = document.createElement("span"); count.style.cssText = "color:#9eacc1;font-size:12px;white-space:nowrap";
    const grid = document.createElement("div"); grid.style.cssText = "display:flex;flex-direction:column;gap:10px;margin-top:20px";
    const close = (value: string | null) => { backdrop.remove(); resolve(value); };
    const render = () => { const visible = projects.filter((p) => `${p.title} ${p.projectDir}`.toLowerCase().includes(search.value.toLowerCase())); count.textContent = `${visible.length}개`; grid.replaceChildren(...visible.map((project) => {
      const card = document.createElement("article"); card.style.cssText = "display:flex;align-items:center;gap:16px;border:1px solid #34425a;border-radius:16px;background:linear-gradient(100deg,#202a3a,#1a2230);padding:12px 14px;transition:transform .15s,border-color .15s;";
      const hue = Math.abs([...project.projectDir].reduce((sum, char) => sum + char.charCodeAt(0), 0)) % 360;
      card.innerHTML = `<div aria-hidden="true" style="display:grid;place-items:center;flex:none;width:92px;height:68px;border-radius:11px;background:linear-gradient(135deg,hsl(${hue} 62% 42%),hsl(${(hue + 48) % 360} 58% 24%));box-shadow:inset 0 1px #ffffff33,0 5px 14px #0004;font-size:26px;font-weight:850;color:#ffffffcc">${escapeHtml(project.title.slice(0, 1) || "?")}</div><div style="min-width:0;flex:1"><div style="display:flex;align-items:center;gap:9px"><div style="font-weight:750;font-size:16px;letter-spacing:-.02em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(project.title)}</div><span style="color:#77dda9;background:#1a4939;border-radius:999px;padding:4px 8px;font-size:11px;white-space:nowrap">사용 가능</span></div><div style="margin-top:8px;color:#8c9ab0;font:12px ui-monospace,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(project.projectDir)}</div><div style="display:flex;gap:16px;color:#9eabc0;font-size:12px;margin-top:9px"><span>서버 프로젝트</span><span>SQLite 정본</span></div></div><button style="flex:none;border:0;border-radius:10px;padding:11px 15px;background:#78a0ff;color:#091329;font-weight:800;cursor:pointer">열기 <span aria-hidden="true">→</span></button>`;
      card.querySelector("button")?.addEventListener("click", () => close(project.projectDir)); return card;
    }) as Element[]); };
    search.addEventListener("input", render); modal.querySelector("[data-close]")?.addEventListener("click", () => close(null)); backdrop.addEventListener("click", (event) => { if (event.target === backdrop) close(null); });
    toolbar.append(search, count); body.append(toolbar, grid); modal.append(body); backdrop.append(modal); document.body.append(backdrop); search.focus(); render();
  });
}

function escapeHtml(value: string): string { return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char); }
