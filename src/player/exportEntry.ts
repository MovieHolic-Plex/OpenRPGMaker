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
import { getAudioEngine, stopAllAudio } from "@/player/audio";
import { fetchTextWithProgress, mountBootLoader, readLoadingInfo, type BootLoader } from "@/player/bootLoader";
import { backgroundUrls, enableScenePreload, firstPlayableUrls, preloadUrls } from "@/player/scenePreload";
import { registerExportAssetBase } from "@/assets/inlineAssetStore";
import { exportAssetBaseFor } from "@/player/exportAssetBase";
import { rebaseRuntimeCssAssetUrls } from "@/player/rebaseCssAssetUrls";
import { installExportUploadedAssets } from './exportUploadedAssets';
import { warmPlayGameRuntime } from "@/player/createPlayGame";
import { repairFaceMatches } from "@/project/faceMatchRepair";
import { installFocusGuard } from "@/player/focusGuard";
import { isEmeraldMonsterStyle } from "@/project/emeraldMonsterStyle";
import { isTouchDevice } from "@/player/touchPad";
import type { ActionCombatRuntimeResult } from "@/testing/actionCombatProof";
import {
  askContinueFromOlderVersion,
  continueFromOlderVersion,
  declineOlderVersion,
  parseStoreGameBoot,
  renderStoreEmbedBlocked,
  shouldOfferContinue,
  storeGameEmbedderAllowed,
  storeGameSaveNamespace,
  type StoreGameBoot,
} from "@/player/storeGameHost";

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
  /** 스토어에서 바로 플레이하는 판본(storeGameHost.ts). 판본별 세이브·품는 곳 확인·이어서 하기. */
  readonly storeGame?: unknown;
  /** "auto": 터치 기기에서 가상 패드를 붙인다(스토어 웹 게임). */
  readonly touchControls?: unknown;
}

function readBootConfig(): OpenRpgBootConfig {
  const config = (window as unknown as { __OPENRPG_BOOT__?: OpenRpgBootConfig }).__OPENRPG_BOOT__;
  return config ?? {};
}

installFocusGuard(app);
void bootExportedPlayer(app);

async function bootExportedPlayer(root: HTMLElement): Promise<void> {
  const boot = await withDevCheckpointParam(readBootConfig());
  const storeGame = parseStoreGameBoot(boot.storeGame);
  if (storeGame && !storeGameEmbedderAllowed(storeGame)) {
    renderStoreEmbedBlocked(root, storeGame);
    return;
  }
  // The private editor probe and any hosted build (player under /export-player/) read public game
  // resources from the editor host, one directory above that bundle — see exportAssetBase.ts.
  const probeAssets = boot.qaInstrumentation === true && boot.actionCombatProbe !== undefined;
  const assetBase = exportAssetBaseFor(document.baseURI, { editorProbe: probeAssets });
  registerExportAssetBase(assetBase);
  rebaseRuntimeCssAssetUrls(assetBase);
  const rawDemoParam = new URLSearchParams(window.location.search).get("demo");
  const demoParam = rawDemoParam === "fallen-star" ? "chrono-bell" : rawDemoParam === "astra-horizon" ? "emerald-crown" : rawDemoParam;
  if (demoParam === "chrono-bell" || demoParam === "emerald-crown" || demoParam === "shitamachi-fourth-season" || demoParam === "first-love") {
    const loader = mountBootLoader(root, { title: document.title });
    const demo = await loadFlagshipDemo(demoParam, assetBase, (bytes) => loader.projectProgress(bytes));
    if (!demo.ok) { loader.remove(); renderBootError(root, demo.message); return; }
    loader.setInfo({ title: demo.project.meta.title });
    await prepareFirstScreen(loader, demo.project, autoStartFor(boot));
    void startPlayer(root, boot, demo.project, "bundled");
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
  // 웹 판본: 그림·소리보다 화면이 먼저 뜨지 않게, 타이틀과 첫 맵이 쓰는 파일을 다 받은 뒤 「시작하기」로 연다(bootLoader.ts).
  const loader = mountBootLoader(root, { title: storeGame?.title ?? "" });
  const projectUrl = new URL(boot.projectUrl ?? "project.json", window.location.href);
  void readLoadingInfo(projectUrl).then((info) => loader.setInfo(storeGame ? { ...info, title: storeGame.title } : info));
  const bundled = await loadBundledProject(projectUrl, (bytes) => loader.projectProgress(bytes));
  if (!bundled.ok) {
    loader.remove();
    openGameFilePicker(root, boot, bundled.message);
    return;
  }
  if (storeGame) {
    loader.root.style.visibility = "hidden";
    await offerOlderVersionSave(root, storeGame);
    loader.root.style.visibility = "";
  }
  await prepareFirstScreen(loader, bundled.project, autoStartFor(boot));
  void startPlayer(root, boot, bundled.project, "bundled");
}

function autoStartFor(boot: OpenRpgBootConfig): boolean {
  return boot.qaInstrumentation === true || boot.desktopShell !== undefined;
}

/**
 * 타이틀·오프닝·첫 맵이 쓰는 파일(scenePreload.firstPlayableUrls)과 글꼴을 다 받고 「시작하기」를 기다린다.
 * 누르는 순간 소리 잠금을 푼다(그 입력이 사용자 제스처다). 나머지 파일은 시작한 뒤 뒤에서 받는다.
 */
async function prepareFirstScreen(loader: BootLoader, project: Project, autoStart: boolean): Promise<void> {
  enableScenePreload();
  // 올린 그림(ref)의 주소는 해석기가 있어야 나온다 — 목록을 만들기 전에 붙인다(startPlayer 도 다시 부른다).
  installExportUploadedAssets(project);
  const urls = firstPlayableUrls(project);
  const fonts = typeof document.fonts?.forEach === "function" ? [...document.fonts] : [];
  let fontsDone = 0;
  let last = { doneFiles: 0, totalFiles: urls.length, bytes: 0 };
  const report = (): void => loader.filesProgress(last.doneFiles + fontsDone, last.totalFiles + fonts.length, last.bytes);
  await Promise.all([
    preloadUrls(urls, { concurrency: 12, priority: "high", retainAudio: true, onProgress: (progress) => { last = progress; report(); } }),
    ...fonts.map((face) => face.load().catch(() => undefined).finally(() => { fontsDone += 1; report(); })),
    // 엔진 코드(Phaser·PlayScene 조각)도 시작 전에 받아 둔다 — 「새 게임」 뒤 기다림을 없앤다.
    warmPlayGameRuntime().catch(() => undefined),
  ]);
  // QA 계측 부팅·데스크톱 셸(자동 재생 제한 없음)은 누르기를 기다리지 않는다.
  if (!autoStart) await loader.waitForStart();
  document.documentElement.dataset.preloadStartedAt = String(Math.round(performance.now()));
  // 사용자 입력 안에서 소리 잠금을 푼다 — 타이틀 BGM 이 기다림 없이 처음부터 나온다.
  getAudioEngine().unlock();
  loader.remove();
  // 시작한 뒤: 가까운 맵부터 나머지를 낮은 우선순위로 받는다(맵 이동 때 기다림을 줄인다).
  const background = backgroundUrls(project, project.startMapId);
  setTimeout(() => {
    // QA 가 «뒤에서 받은 것» 과 «화면이 늦게 부른 것» 을 가르는 기준 시각(측정용, 비밀 아님).
    document.documentElement.dataset.preloadBackgroundAt = String(Math.round(performance.now()));
    // 나머지 전부(가까운 맵 → 전투·메뉴·엔딩)를 낮은 우선순위로. 화면이 부르는 파일은 high 라 이 줄에 밀리지 않는다.
    void preloadUrls(background, { concurrency: 6, priority: "low" }).then((done) => {
      document.documentElement.dataset.preloadBackgroundDoneAt = String(Math.round(performance.now()));
      document.documentElement.dataset.preloadBackgroundFiles = `${done.doneFiles}/${done.totalFiles}`;
    });
  }, 1500);
}

type BundledProjectLoad =
  | { readonly ok: true; readonly project: Project }
  | { readonly ok: false; readonly message: string };

async function loadBundledProject(projectUrl: URL, onBytes: (bytes: number) => void): Promise<BundledProjectLoad> {
  try {
    const response = await fetchTextWithProgress(projectUrl, onBytes);
    if (response.status === 404) {
      return { ok: false, message: `이 주소에는 번들된 게임이 없습니다. ${OPRN_EXTENSION} 게임 파일을 열어 주세요.` };
    }
    if (!response.ok) return { ok: false, message: `project.json 로드 실패 (${response.status})` };
    return { ok: true, project: deserialize(response.text) };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * 대표 데모(?demo=)는 빌드가 구워 둔 프로젝트를 읽는다(scripts/content/bake-flagship-demos.mts → dist/demos/<id>.play.json,
 * 공용 에셋 assets/ 옆이라 에셋 기준 주소로 찾는다).
 * 예전에는 여기서 에디터 데모 빌더(약 15MB JS + 도구 레지스트리)를 받아 모든 맵을 브라우저에서 지었다 —
 * 2026-10-23 실측: 타이틀까지 first-love 23초, shitamachi 33초, chrono-bell 134초(메인 스레드 131초).
 * dev 서버(QA 하네스)에는 구운 파일이 없으므로 그때만 예전처럼 짓는다. 출하 빌드에서는 import.meta.env.DEV 가
 * 거짓이라 빌더 import 가 통째로 빠지고, 내보낸 게임 zip 에도 데모 빌더 청크가 실리지 않는다.
 */
async function loadFlagshipDemo(id: string, assetBase: URL, onBytes: (bytes: number) => void): Promise<BundledProjectLoad> {
  if (import.meta.env.DEV) {
    const { createFlagshipDemoProject } = await import("@/project/flagship");
    return { ok: true, project: createFlagshipDemoProject(id as Parameters<typeof createFlagshipDemoProject>[0]).project };
  }
  try {
    const response = await fetchTextWithProgress(new URL(`demos/${encodeURIComponent(id)}.play.json`, assetBase), onBytes);
    if (!response.ok) return { ok: false, message: `데모 ${id} 를 읽지 못했습니다 (${response.status})` };
    return { ok: true, project: deserialize(response.text) };
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

/**
 * 스토어 웹 게임: 이 판본 세이브가 없고 옛 판본 세이브가 있으면 이어서 할지 묻는다(한 번만).
 * 저장소에 손댈 수 없는 환경(사파리 비공개 창 등)에서도 부팅은 막지 않는다.
 */
async function offerOlderVersionSave(root: HTMLElement, storeGame: StoreGameBoot): Promise<void> {
  let storage: Storage;
  try {
    storage = window.localStorage;
  } catch {
    return;
  }
  try {
    const older = shouldOfferContinue(storage, storeGame);
    if (!older) return;
    const choice = await askContinueFromOlderVersion(root, storeGame, older);
    if (choice === "continue") continueFromOlderVersion(storage, storeGame, older);
    else declineOlderVersion(storage, storeGame);
  } catch (error) {
    console.warn("[oprn] 옛 판본 세이브 확인을 건너뜁니다:", error);
  }
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
    const storeGame = parseStoreGameBoot(boot.storeGame);
    const saveNamespace = storeGame && source === "bundled" ? storeGameSaveNamespace(storeGame) : resolveExportSaveNamespace(project, {
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
      touchInput: isTouchDevice(),
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
