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
import { installDesktopShellBridge, type DesktopShellBootConfig } from "@/player/desktopShellBridge";
import { stopAllAudio } from "@/player/audio";
import { registerExportAssetBase } from "@/assets/inlineAssetStore";
import { exportAssetBaseFor } from "@/player/exportAssetBase";
import { installExportUploadedAssets } from './exportUploadedAssets';
import { repairFaceMatches } from "@/project/faceMatchRepair";
import { isEmeraldMonsterStyle } from "@/project/emeraldMonsterStyle";
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
  /** Private runtime-QA checkpoint (scripts/qa/runtime/checkpoints). Ignored unless qaInstrumentation is true. */
  readonly qaCheckpoint?: unknown;
  // 호스트 주입값은 신뢰하지 않는다 — hostBridge.parseHostBridge 가 방어적으로 파싱한다.
  readonly returnUrl?: unknown;
  readonly hostFeatures?: unknown;
  readonly desktopShell?: DesktopShellBootConfig;
}

function readBootConfig(): OpenRpgBootConfig {
  const config = (window as unknown as { __OPENRPG_BOOT__?: OpenRpgBootConfig }).__OPENRPG_BOOT__;
  return config ?? {};
}

void bootExportedPlayer(app);

async function bootExportedPlayer(root: HTMLElement): Promise<void> {
  const boot = await withDevCheckpointParam(readBootConfig());
  // The private editor probe and any hosted build (player under /export-player/) read public game
  // resources from the editor host, one directory above that bundle — see exportAssetBase.ts.
  const probeAssets = boot.qaInstrumentation === true && boot.actionCombatProbe !== undefined;
  registerExportAssetBase(exportAssetBaseFor(document.baseURI, { editorProbe: probeAssets }));
  const rawDemoParam = new URLSearchParams(window.location.search).get("demo");
  const demoParam = rawDemoParam === "fallen-star" ? "chrono-bell" : rawDemoParam === "astra-horizon" ? "emerald-crown" : rawDemoParam;
  if (demoParam === "chrono-bell" || demoParam === "emerald-crown" || demoParam === "shitamachi-fourth-season" || demoParam === "first-love") {
    // 정적 import 하면 ?demo= 가 없는 일반 player.html 부팅에도 에디터 toolRegistry(1,800개 모듈) 전체가 로드된다.
    const { createFlagshipDemoProject } = await import("@/project/flagship");
    void startPlayer(root, boot, createFlagshipDemoProject(demoParam).project, "bundled");
    return;
  }
  // 단일 HTML 로 내보낸 게임: 프로젝트도 에셋도 이 문서 안에 있다. fetch 가 막히는 file:// 에서
  // 돌아야 하므로 네트워크를 타는 아래 경로보다 **먼저** 본다.
  const standalone = readStandalonePayload();
  if (standalone) {
    void startPlayer(root, boot, deserialize(standalone.projectJson), "opened-file");
    return;
  }
  if (new URLSearchParams(window.location.search).has("open")) {
    openGameFilePicker(root, boot, "");
    return;
  }
  const bundled = await loadBundledProject(boot);
  if (bundled.ok) {
    void startPlayer(root, boot, bundled.project, "bundled");
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

/**
 * 수동 QA 용: vite dev 서버에서만 `player.html?demo=…&qaCheckpoint=<세트>:<id>` 를 받는다.
 * 출하 빌드에서는 import.meta.env.DEV 가 거짓이라 이 분기가 통째로 빠진다.
 */
async function withDevCheckpointParam(boot: OpenRpgBootConfig): Promise<OpenRpgBootConfig> {
  if (!import.meta.env.DEV) return boot;
  const param = new URLSearchParams(window.location.search).get("qaCheckpoint");
  if (!param) return boot;
  const [setName, id] = param.split(":");
  const response = await fetch(`/scripts/qa/runtime/checkpoints/${encodeURIComponent(setName ?? "")}.json`);
  if (!response.ok) throw new Error(`QA 체크포인트 세트 ${setName} 를 읽지 못했다 (${response.status})`);
  const set = (await response.json()) as { checkpoints?: { id: string }[] };
  const checkpoint = set.checkpoints?.find((entry) => entry.id === id);
  if (!checkpoint) throw new Error(`QA 체크포인트 ${setName}:${id} 가 없다`);
  return { ...boot, qaInstrumentation: true, qaCheckpoint: checkpoint };
}

/** QA 체크포인트 세션. 계측이 켜진 부팅에서만 만든다 — 아니면 일반 타이틀 부팅이다. */
async function qaCheckpointStart(boot: OpenRpgBootConfig, project: Project) {
  if (boot.qaInstrumentation !== true || boot.qaCheckpoint === undefined) return undefined;
  const { parseQaCheckpointBoot, sessionFromQaCheckpoint } = await import("@/player/qaCheckpoint");
  const checkpoint = parseQaCheckpointBoot(boot.qaCheckpoint);
  if (!checkpoint) throw new Error("QA 체크포인트 모양이 틀렸다(id 필요)");
  return {
    initialSession: sessionFromQaCheckpoint(project, checkpoint),
    ...(checkpoint.startEventId ? { initialEventTestId: checkpoint.startEventId } : {}),
  };
}

function openGameFilePicker(root: HTMLElement, boot: OpenRpgBootConfig, reason: string): void {
  renderOprnGameFilePicker(root, {
    reason,
    onOpen: (project) => void startPlayer(root, boot, project, "opened-file"),
  });
}

async function startPlayer(
  root: HTMLElement,
  boot: OpenRpgBootConfig,
  project: Project,
  source: ExportProjectSource,
): Promise<void> {
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
    installDesktopShellBridge(root, boot.desktopShell);
    const probe = boot.qaInstrumentation === true ? boot.actionCombatProbe : undefined;
    const qaStart = await qaCheckpointStart(boot, project);
    renderPlayer(root, {
      ...(qaStart ?? {}),
      // 배율은 프로젝트가 정한다(resolvePlaySurfaceScaleMode): 해상도를 저장한 프로젝트·몬스터 수집 게임은 정수 배율+여백,
      // 해상도를 안 정한 옛 320×240 프로젝트는 창에 맞춤. 저작자는 DB 시스템 「화면 맞춤」으로 바꾼다.
      // 마우스·터치로도 메뉴·전투를 연다(D15). 몬스터 수집 게임만 — 다른 게임은 기존 키보드 전용 계약을 지킨다.
      pointerInput: isEmeraldMonsterStyle(project),
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
