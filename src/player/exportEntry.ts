import "@/player/player.css";
// Standalone legacy migration only; community boot never scans global save storage.
import "@/player/exportStorageBoot";
import { installVitePreloadRecovery } from "@/app/moduleLoadRecovery";
import { syncProjectFontTheme } from "@/app/fontTheme";

installVitePreloadRecovery();
import { PRODUCT_BRAND } from "@/brand";
import { deserialize } from "@/project/io";
import { OPRN_EXTENSION } from "@/project/package";
import type { Project } from "@/project/types";
import { renderPlayer } from "@/player/player";
import { renderOprnGameFilePicker } from "@/player/oprnGameFilePicker";
import { readStandalonePayload } from "@/player/standalonePayload";
import { adoptLegacyExportSaves, setSaveSlotStorageNamespace } from "@/player/saveSlots";
import { setExportedProject } from "@/player/exportProjectStoreShim";
import {
  resolveExportSaveNamespace,
  resolveCommunitySaveScope,
  type ExportProjectSource,
} from "@/player/exportSaveNamespace";
import { hostExitReturnUrl, parseHostBridge, type HostBridge } from "@/player/hostBridge";
import { stopAllAudio } from "@/player/audio";
import { registerExportAssetBase } from "@/assets/inlineAssetStore";
import { installExportUploadedAssets } from './exportUploadedAssets';
import { repairFaceMatches } from "@/project/faceMatchRepair";
import type { ActionCombatRuntimeResult } from "@/testing/actionCombatProof";

const app = document.getElementById("app");
if (!app) {
  throw new Error("#app 요소를 찾을 수 없습니다.");
}

interface OpenRpgBootConfig {
  readonly projectUrl?: string;
  readonly saveNamespace?: string;
  /** Private export-QA capability; omitted by all production host shells. */
  readonly qaInstrumentation?: boolean;
  readonly actionCombatProbe?: { readonly runId: string; readonly mapId: string };
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
  // The private editor probe loads the shipped player bundle, but public game
  // resources belong to the editor host, one directory above that bundle.
  const probeAssets = boot.qaInstrumentation === true && boot.actionCombatProbe !== undefined;
  registerExportAssetBase(new URL(probeAssets ? "../" : ".", document.baseURI));
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
      return { ok: false, message: `이 주소에는 번들된 게임이 없습니다. ${OPRN_EXTENSION} 게임 파일을 열어 주세요.` };
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
    installExportUploadedAssets(project);
    // 옛 저장본에서 내보낸 게임도 에디터와 같은 얼굴을 보여 준다(faceMatchRepair.ts — 걷기 그림의 짝으로 교정).
    repairFaceMatches(project);
    setExportedProject(project);
    // 에디터 boot 를 거치지 않는 웹·단일 HTML 플레이어도 저장된 공통 글꼴을 쓴다.
    syncProjectFontTheme(project);
    const saveNamespace = resolveExportSaveNamespace(project, {
      source,
      hostSaveNamespace: boot.saveNamespace,
      pathname: window.location.pathname,
    });
    setSaveSlotStorageNamespace(saveNamespace);
    // 개명 전 접두사로 남은 이 게임의 세이브를 한 번 복사한다. 저장소 접근이 막힌 환경에서도 부팅은 막지 않는다.
    try {
      adoptLegacyExportSaves(window.localStorage, saveNamespace);
    } catch (error) {
      console.warn("[oprn] 옛 세이브 입양을 건너뜁니다:", error);
    }
    document.title = project.meta.title || `${PRODUCT_BRAND} Player`;
    // 호스트(커뮤니티 사이트)가 주입한 returnUrl/hostFeatures — 잘못된 값은 조용히 무시된다.
    const host = parseHostBridge(boot);
    const probe = boot.qaInstrumentation === true ? boot.actionCombatProbe : undefined;
    renderPlayer(root, {
      surfaceScaleMode: 'fit',
      saveIsolationScope: resolveCommunitySaveScope(window.location.pathname),
      qaInstrumentation: boot.qaInstrumentation === true,
      hostBridge: host,
      onExit: () => exitToHost(root, host),
      ...(probe ? {
        startOverride: { mapId: probe.mapId, ...project.startPos },
        onPlayBootSuccess: () => {
          const qaWindow = window as Window & { __oprnRunActionCombatProof?: () => Promise<ActionCombatRuntimeResult> };
          const run = qaWindow.__oprnRunActionCombatProof;
          if (!run) return;
          void run().then((result) => {
            window.parent.postMessage({ type: "oprn:combat-proof", runId: probe.runId, mapId: probe.mapId, ...result }, new URL(document.baseURI).origin);
          });
        },
      } : {}),
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
