import "@/player/player.css";
// 세이브 슬롯 키(oprn:save-slot:*)를 읽기 전에 구 접두사를 옮긴다. src/storageBoot.ts 참고.
import "@/storageBoot";
import { installVitePreloadRecovery } from "@/app/moduleLoadRecovery";

installVitePreloadRecovery();
import { PRODUCT_BRAND } from "@/brand";
import { deserialize } from "@/project/io";
import { RPGZZU_EXTENSION } from "@/project/package";
import type { Project } from "@/project/types";
import { renderPlayer } from "@/player/player";
import { renderOprnGameFilePicker } from "@/player/oprnGameFilePicker";
import { readStandalonePayload } from "@/player/standalonePayload";
import { setSaveSlotStorageNamespace } from "@/player/saveSlots";
import { setExportedProject } from "@/player/exportProjectStoreShim";
import {
  resolveExportSaveNamespace,
  type ExportProjectSource,
} from "@/player/exportSaveNamespace";
import { hostExitReturnUrl, parseHostBridge, type HostBridge } from "@/player/hostBridge";
import { stopAllAudio } from "@/player/audio";
import { registerExportAssetBase } from "@/assets/inlineAssetStore";

const app = document.getElementById("app");
if (!app) {
  throw new Error("#app 요소를 찾을 수 없습니다.");
}

interface OpenRpgBootConfig {
  readonly projectUrl?: string;
  readonly saveNamespace?: string;
  /** Private export-QA capability; omitted by all production host shells. */
  readonly qaInstrumentation?: boolean;
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
  const boot = readBootConfig();
  registerExportAssetBase(new URL(".", window.location.href));
  // 단일 HTML 로 내보낸 게임: 프로젝트도 에셋도 이 문서 안에 있다. fetch 가 막히는 file:// 에서
  // 돌아야 하므로 네트워크를 타는 아래 경로보다 **먼저** 본다.
  const standalone = readStandalonePayload();
  if (standalone) {
    startPlayer(root, boot, deserialize(standalone.projectJson), "opened-file");
    return;
  }
  if (new URLSearchParams(window.location.search).has("open")) {
    openGameFilePicker(root, boot, "");
    return;
  }
  const bundled = await loadBundledProject(boot);
  if (bundled.ok) {
    startPlayer(root, boot, bundled.project, "bundled");
    return;
  }
  openGameFilePicker(root, boot, bundled.message);
}

type BundledProjectLoad =
  | { readonly ok: true; readonly project: Project }
  | { readonly ok: false; readonly message: string };

async function loadBundledProject(boot: OpenRpgBootConfig): Promise<BundledProjectLoad> {
  try {
    const response = await fetch(boot.projectUrl ?? new URL("project.json", window.location.href));
    if (response.status === 404) {
      return { ok: false, message: `이 주소에는 번들된 게임이 없습니다. ${RPGZZU_EXTENSION} 게임 파일을 열어 주세요.` };
    }
    if (!response.ok) return { ok: false, message: `project.json 로드 실패 (${response.status})` };
    return { ok: true, project: deserialize(await response.text()) };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

function openGameFilePicker(root: HTMLElement, boot: OpenRpgBootConfig, reason: string): void {
  renderOprnGameFilePicker(root, {
    reason,
    onOpen: (project) => startPlayer(root, boot, project, "opened-file"),
  });
}

function startPlayer(
  root: HTMLElement,
  boot: OpenRpgBootConfig,
  project: Project,
  source: ExportProjectSource,
): void {
  try {
    setExportedProject(project);
    setSaveSlotStorageNamespace(resolveExportSaveNamespace(project, {
      source,
      hostSaveNamespace: boot.saveNamespace,
      pathname: window.location.pathname,
    }));
    document.title = project.meta.title || `${PRODUCT_BRAND} Player`;
    // 호스트(커뮤니티 사이트)가 주입한 returnUrl/hostFeatures — 잘못된 값은 조용히 무시된다.
    const host = parseHostBridge(boot);
    renderPlayer(root, {
      qaInstrumentation: boot.qaInstrumentation === true,
      hostBridge: host,
      onExit: () => exitToHost(root, host),
    });
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
