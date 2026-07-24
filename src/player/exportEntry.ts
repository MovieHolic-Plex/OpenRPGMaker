import "@/player/player.css";
import { deserialize } from "@/project/io";
import { renderPlayer } from "@/player/player";
import { setSaveSlotStorageNamespace } from "@/player/saveSlots";
import { exportedProjectId, setExportedProject } from "@/player/exportProjectStoreShim";

const app = document.getElementById("app");
if (!app) {
  throw new Error("#app 요소를 찾을 수 없습니다.");
}

interface OpenRpgBootConfig {
  readonly projectUrl?: string;
  readonly saveNamespace?: string;
}

function readBootConfig(): OpenRpgBootConfig {
  const config = (window as unknown as { __OPENRPG_BOOT__?: OpenRpgBootConfig }).__OPENRPG_BOOT__;
  return config ?? {};
}

void bootExportedPlayer(app);

async function bootExportedPlayer(root: HTMLElement): Promise<void> {
  try {
    const boot = readBootConfig();
    const response = await fetch(boot.projectUrl ?? new URL("project.json", window.location.href));
    if (!response.ok) throw new Error(`project.json 로드 실패 (${response.status})`);
    const project = deserialize(await response.text());
    setExportedProject(project);
    const communitySlug = /^\/play\/([^/]+)/.exec(window.location.pathname)?.[1];
    setSaveSlotStorageNamespace(
      boot.saveNamespace
        ?? (communitySlug
          ? `rpgzzu-export:${decodeURIComponent(communitySlug)}`
          : `rpgzzu-export:${exportedProjectId(project)}`),
    );
    document.title = project.meta.title || "RPG ZZU Player";
    renderPlayer(root, { onExit: () => renderTitleExit(root) });
  } catch (error) {
    renderBootError(root, error instanceof Error ? error.message : String(error));
  }
}

function renderBootError(root: HTMLElement, message: string): void {
  root.textContent = "";
  const panel = document.createElement("section");
  panel.className = "player-export-error";
  panel.textContent = `게임을 시작할 수 없습니다: ${message}`;
  root.append(panel);
}

function renderTitleExit(root: HTMLElement): void {
  root.textContent = "";
  const panel = document.createElement("section");
  panel.className = "player-export-error";
  panel.textContent = "게임을 종료했습니다. 페이지를 새로고침하면 다시 시작합니다.";
  root.append(panel);
}
