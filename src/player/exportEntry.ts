import "@/player/player.css";
import { deserialize } from "@/project/io";
import { renderPlayer } from "@/player/player";
import { setSaveSlotStorageNamespace } from "@/player/saveSlots";
import { exportedProjectId, setExportedProject } from "@/player/exportProjectStoreShim";
import { hostExitReturnUrl, parseHostBridge, type HostBridge } from "@/player/hostBridge";
import { stopAllAudio } from "@/player/audio";

const app = document.getElementById("app");
if (!app) {
  throw new Error("#app 요소를 찾을 수 없습니다.");
}

interface OpenRpgBootConfig {
  readonly projectUrl?: string;
  readonly saveNamespace?: string;
  // 호스트 주입값은 신뢰하지 않는다 — hostBridge.parseHostBridge 가 방어적으로 파싱한다.
  readonly returnUrl?: unknown;
  readonly hostFeatures?: unknown;
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
    // 호스트(커뮤니티 사이트)가 주입한 returnUrl/hostFeatures — 잘못된 값은 조용히 무시된다.
    const host = parseHostBridge(boot);
    renderPlayer(root, { hostBridge: host, onExit: () => exitToHost(root, host) });
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

// 타이틀 "게임 종료": exit 기능 + 유효한 returnUrl 이면 호스트 페이지로 복귀, 아니면 기존 안내 유지.
function exitToHost(root: HTMLElement, host: HostBridge): void {
  const returnUrl = hostExitReturnUrl(host);
  if (returnUrl) {
    stopAllAudio();
    window.location.assign(returnUrl);
    return;
  }
  renderTitleExit(root);
}

function renderTitleExit(root: HTMLElement): void {
  root.textContent = "";
  const panel = document.createElement("section");
  panel.className = "player-export-error";
  panel.textContent = "게임을 종료했습니다. 페이지를 새로고침하면 다시 시작합니다.";
  root.append(panel);
}
