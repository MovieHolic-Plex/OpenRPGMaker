import { getAudioEngine } from "@/player/audio";
import { advanceBattleRuntime } from "@/battle/battleRuntimeAdvance";
import { PRODUCT_BRAND } from "@/brand";
import { createBattleRuntime } from "@/battle/runtime";
import { mountBattleScene, type BattleDomController } from "@/player/battleDom";
import { mountPlayLoadingOverlay } from "@/player/playLoadingOverlay";
import { describeBootFailure } from "@/player/playBootRecovery";
import { renderPlayer, teardownPlayer, type PlayerRunControls } from "@/player/player";
import { nextSessionRandom, startSession, type PlaySession } from "@/project/session";
import { renderRuntimeDebugPanel } from "@/player/runtimeDebugPanel";
import { projectWithoutEventDrafts } from "@/project/eventDrafts";
import { store } from "@/project/store";
import { openingAuthoringStatus } from "@/project/openingAuthoringStatus";
import type { GameEvent, MapId, Project } from "@/project/types";
import { el } from "@/util/dom";
import { setImageWarmQueueSuspended } from "@/assets/imageWarmQueue";
import { editorPlayBootDiagnosticSink } from "@/app/editorPlayBootDiagnostics";
import { preloadRuntimeStyles } from "@/app/runtimeStyles";
import { validateEventDraft } from "@/editor/eventDraftValidator";
import { prepareEnemyBattleTest } from "@/editor/enemyBattleTest";
import { registerModal, unregisterModal } from "@/editor/ui/modalStack";
import { prepareEventTest, type EventTestPreparation } from "@/editor/eventTestSandbox";
import { toast } from "@/util/toast";
import {
  AUTHORING_TEST_BOOT_SUCCESS_EVENT,
  authoringProjectFingerprint,
} from "@/editor/authoringJourney";
import { STORAGE_PREFIX } from "@/util/appStorage";
import { isEditorGameSuspended, resumeEditorGame, suspendEditorGame } from "@/editor/panels/editorGameSuspension";

let modalRoot: HTMLElement | null = null;
let returnFocusAfterEnemyTest: HTMLElement | null = null;
let removePlayWindowKeydown: (() => void) | null = null;
let releaseEventTestSnapshot: (() => void) | null = null;
// 에디터 전투 테스트가 mount 한 배틀 씬 컨트롤러. closeTestPlayModal 이 destroy()
// 를 호출해 setInterval(200ms 틱) 과 window keydown 리스너 누수를 막는다.
let battleSceneController: BattleDomController | null = null;
// 현재 열린 테스트 플레이 창이 조작하는 런 손잡이. renderPlayer 가 onRunControlsReady 로
// 넘겨주며, 창을 닫으면 버려진다(모듈 전역 가변 상태는 기존 셸 상태와 같은 수준으로만 둔다).
let playRunControls: PlayerRunControls | null = null;
// 타이틀 건너뛰기 체크박스. 저장된 선호를 화면에 드러내는 유일한 노드이므로, 버튼이
// 선호를 바꿀 때마다 같이 맞춰준다(숨은 상태가 다음 실행을 바꾸는 일을 없앤다).
let skipTitleCheckbox: HTMLInputElement | null = null;
// 오프닝 건너뛰기 체크박스. 타이틀 건너뛰기와 같은 규칙으로 저장된 선호를 드러낸다.
let skipOpeningCheckbox: HTMLInputElement | null = null;
// 창이 열려 있는 동안 뒤 편집기를 inert 로 둔다(포커스·클릭이 창 밖으로 새지 않게). 닫을 때 원래 값으로 돌린다.
let releaseBackgroundInert: (() => void) | null = null;
// 게임 메뉴가 열려 있는 동안 제목 막대에 「일시 정지」 상태를 띄우는 관찰자.
let stopPauseWatch: (() => void) | null = null;

/** 작업자가 마지막으로 고른 자동 시작 여부. 기본값은 ON — 편집→테스트 왕복에서 타이틀 걷기를 없앤다. */
const AUTO_START_STORAGE_KEY = `${STORAGE_PREFIX}test-play-auto-start`;

/**
 * 오프닝 시네마틱을 건너뛸지. 기본값은 OFF(= 오프닝 재생) — 타이틀 건너뛰기를 켜도 오프닝은
 * 나오던 기존 동작을 그대로 두고, 반복 테스트에서만 끌 수 있게 한다.
 */
const SKIP_OPENING_STORAGE_KEY = `${STORAGE_PREFIX}test-play-skip-opening`;

export function readTestPlaySkipOpening(): boolean {
  try {
    const stored = window.localStorage.getItem(SKIP_OPENING_STORAGE_KEY);
    if (stored === "1" || stored === "0") return stored === "1";
  } catch {
    /* 저장소를 못 읽으면 아래 기본값을 쓴다. */
  }
  // 고른 적이 없으면: 새 프로젝트가 씨앗으로 받은 기본 오프닝은 건너뛴다 — 만든 맵을 걸어 보려는 첫 테스트가
  // 남의 왕국 오프닝부터 보지 않게 한다(HIG C-93). 직접 만든 오프닝은 그대로 재생한다.
  return openingAuthoringStatus(store.getCurrent()).defaultPlaceholder;
}

function writeTestPlaySkipOpening(skipOpening: boolean): void {
  try {
    window.localStorage.setItem(SKIP_OPENING_STORAGE_KEY, skipOpening ? "1" : "0");
  } catch {
    /* private mode / quota — 선택을 기억하지 못해도 테스트는 계속 돌아야 한다. */
  }
  if (skipOpeningCheckbox) skipOpeningCheckbox.checked = skipOpening;
}

export function readTestPlayAutoStart(): boolean {
  try {
    return window.localStorage.getItem(AUTO_START_STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}

function writeTestPlayAutoStart(autoStart: boolean): void {
  try {
    window.localStorage.setItem(AUTO_START_STORAGE_KEY, autoStart ? "1" : "0");
  } catch {
    /* private mode / quota — 선택을 기억하지 못해도 테스트는 계속 돌아야 한다. */
  }
  if (skipTitleCheckbox) skipTitleCheckbox.checked = autoStart;
}

type TestPlayWindowMode = "fullscreen" | "windowed";

export type OpenTestPlayOptions = {
  /** 자율 이동·자동/병렬 이벤트를 억제한 상태로 연다 — 복구 패널의 «안전 모드로 시작» 이 이 경로를 다시 한다. */
  readonly safeMode?: boolean;
};

export async function openTestPlayModal(
  startOverride?: { mapId: string; x: number; y: number },
  openOptions: OpenTestPlayOptions = {},
): Promise<void> {
  // 어떤 프로젝트를 돌리는지 제목에 드러나야 한다 — 제품명 고정 문구를 쓰면
  // 프로젝트를 여러 개 열어두면 어느 창이 무엇인지 구분이 안 된다.
  const projectTitle = store.getCurrent().meta.title?.trim();
  const title = startOverride
    ? `여기서 테스트 - (${startOverride.mapId} ${startOverride.x},${startOverride.y})`
    : `테스트 실행 - ${projectTitle || PRODUCT_BRAND}`;
  const startProject = store.getCurrent();
  const startMapName = startProject.maps[startOverride?.mapId ?? startProject.startMapId]?.name;
  const body = openTestPlayShell(title, { runControls: true, mapName: startMapName });
  const loading = mountPlayLoadingOverlay(body, "saving");
  try {
    await store.flush();
    loading.setStage("preparing");
    const project = projectWithoutEventDrafts(store.getCurrent());
    const projectFingerprint = authoringProjectFingerprint(project);
    releaseEventTestSnapshot = store.beginReadOnlyProjectSnapshot(project);
    // Phaser preload 가 같은 그림을 바로 읽는다. 여기서 미리 받으면 연결 6개를 워밍이
    // 먼저 차지하고, dev 서버는 no-cache 라 같은 파일을 한 번 더 받는다.
    // Give the browser a paint before heavy player bootstrap.
    await yieldToRuntimeSurface();
    renderPlayer(body, {
      // Authoring surface, not the shipped export player — keep QA hooks/state mirrors.
      qaInstrumentation: true,
      onExit: closeTestPlayModal,
      trackGlobalGame: false,
      startOverride,
      // 배율은 내보낸 게임과 같은 규칙(resolvePlaySurfaceScaleMode)을 따른다 — 테스트 화면과 출하 화면의 도트 굵기가 같아야 한다.
      // 옛 320×240 프로젝트는 fit 이라 1214x640 창에서 27% 만 그리던 문제(2026-08-25)는 되살아나지 않는다.
      autoStartRun: readTestPlayAutoStart(),
      // 런이 시작될 때마다 다시 읽는다 — 창을 열어둔 채 체크박스를 바꿔도 다음 런부터 바로 먹는다.
      shouldPlayOpening: () => !readTestPlaySkipOpening(),
      safeMode: openOptions.safeMode === true,
      // 예비검사가 고친 항목은 부팅을 막지 않고 토스트로만 드러낸다(실제 부팅은 고친 프로젝트로 돌아간다).
      onBootRepairs: (repairs) => toast(`시작 전 자동 복구: ${repairs.join(" · ")}`, "info"),
      onRunControlsReady: (controls) => {
        playRunControls = controls;
      },
      diagnosticSink: editorPlayBootDiagnosticSink,
      onPlayBootSuccess: () => {
        window.dispatchEvent(new CustomEvent(AUTHORING_TEST_BOOT_SUCCESS_EVENT, {
          detail: { projectFingerprint },
        }));
      },
    });
  } catch (error) {
    console.error("[test-play] failed to open test play:", error);
    releaseEventTestSnapshot?.();
    releaseEventTestSnapshot = null;
    presentOpenFailure(loading, "테스트 실행을 열지 못했습니다", error, {
      onRetry: () => void openTestPlayModal(startOverride, openOptions),
      onSafeMode: () => void openTestPlayModal(startOverride, { safeMode: true }),
    });
    return;
  }
  // renderPlayer clears body children (including this overlay) when it mounts.
  // If title path ran, loading is already gone; if not, remove explicitly.
  if (loading.root.isConnected) loading.remove();
}

export async function openSelectedEventTestModal(mapId: MapId, eventId: string): Promise<boolean> {
  const liveProject = store.getCurrent();
  const validation = validateEventDraft(liveProject, mapId, eventId);
  if (!validation.canCommit) {
    toast(`이벤트 테스트를 시작할 수 없습니다. 오류 ${validation.errorCount}개를 먼저 해결하세요.`, "error");
    return false;
  }
  const preparation = prepareEventTest(liveProject, mapId, eventId);
  if (!preparation) return false;

  const title = `이벤트 테스트 - ${eventDisplayName(preparation.event)}`;
  const body = openTestPlayShell(title);
  const loading = mountPlayLoadingOverlay(body, "preparing");
  try {
    releaseEventTestSnapshot = store.beginReadOnlyProjectSnapshot(preparation.project);
    if (validation.warningCount > 0) {
      toast(`경고 ${validation.warningCount}개가 있지만 현재 작업 초안을 테스트합니다.`, "info");
    }
    if (preparation.spawn.diagnostic) toast(preparation.spawn.diagnostic, "info");
    await yieldToRuntimeSurface();
    renderPlayer(body, {
      // Authoring surface, not the shipped export player — keep QA hooks/state mirrors.
      qaInstrumentation: true,
      initialEventTestId: eventId,
      initialSession: selectedEventTestSession(preparation),
      onExit: closeTestPlayModal,
      trackGlobalGame: false,
      diagnosticSink: editorPlayBootDiagnosticSink,
    });
  } catch (error) {
    console.error("[test-play] failed to open selected-event test:", error);
    releaseEventTestSnapshot?.();
    releaseEventTestSnapshot = null;
    loading.setStage("error", "이벤트 테스트를 열지 못했습니다");
    return false;
  }
  if (loading.root.isConnected) loading.remove();
  return true;
}

export async function openTroopBattleTestModal(troopId: string): Promise<void> {
  await openTroopBattleTestModalAfterGate(troopId);
}

export async function openEnemyBattleTestModal(enemyId: string): Promise<void> {
  const prepared = prepareEnemyBattleTest(store.getCurrent(), enemyId);
  if (!prepared) return;
  await openTroopBattleTestModalAfterGate(prepared.troopId, prepared.project, true);
}

async function openTroopBattleTestModalAfterGate(troopId: string, project: Project = store.getCurrent(), nestedEnemyTest = false): Promise<void> {
  const troop = project.database.troops.find((record) => record.id === troopId);
  const body = openTestPlayShell(`전투 테스트 - ${troop?.name ?? troopId}`, { nestedEnemyTest });
  const loading = mountPlayLoadingOverlay(body, "saving");
  try {
    await store.flush();
    loading.setStage("preparing");
    await yieldToRuntimeSurface();
    // The user can close the test while persistence/assets yield to the browser.
    if (!body.isConnected) return;
    loading.remove();
    // 에디터 전투 테스트도 실제 플레이 경로(playSceneBattle) 와 동일한 세션 기반 상태/RNG 를
    // 쓴다. 예전에는 Math.random() 에 party/sessionState 누락으로 (a) 재현 불가능하고,
    // (b) 레벨업 미리보기·배틀 이벤트 조건이 프로젝트 초기 상태 기준으로만 작동했다.
    const session = startSession(project);
    const runtime = createBattleRuntime({
      project,
      troopId,
      canEscape: true,
      canLose: true,
      party: {
        levels: session.actorLevels,
        experience: session.actorExperience,
        names: session.actorNames,
        faceResourceIds: session.actorFaceResourceIds,
        vitals: session.actorVitals,
        paramBonuses: session.actorParamBonuses,
        equipment: session.actorEquipment,
        skillIds: session.actorSkillIds,
        classOverrides: session.classOverrides,
        stateIds: session.actorStateIds,
        partyActorIds: session.partyActorIds,
        battleCommands: session.actorBattleCommands,
      },
      sessionState: {
        switches: session.switches,
        variables: session.variables,
        inventory: session.inventory,
        gold: session.gold,
        partyActorIds: session.partyActorIds,
        actorSkillIds: session.actorSkillIds,
        actorExperience: session.actorExperience,
        actorLevels: session.actorLevels,
        actorBattleCommands: session.actorBattleCommands,
      },
      rng: () => nextSessionRandom(session, "battle"),
    });
    advanceBattleRuntime(runtime);
    // 결과 화면의 "확인" / "Z" / 클릭 / 자동 타이머 모두 onResult 로 수렴한다.
    // 전투가 끝나면 전투 테스트 모달을 닫고 편집기로 돌아간다(과거엔 no-op 이라 결과
    // 화면이 먹통이었다).
    battleSceneController = mountBattleScene({
      host: body,
      runtime,
      onResult: () => closeTestPlayModal(),
      // 명령 첫 단계에서 Esc 는 전투 안에서 할 일이 없다 — 테스트 창에서는 편집기로 돌아가는 키로 쓴다.
      onRootCancel: () => closeTestPlayModal(),
    });
  } catch (error) {
    console.error("[test-play] failed to open troop battle test:", error);
    loading.setStage("error", "전투 테스트를 열지 못했습니다");
  }
}
export function pickRandomTroopId(
  project: Project,
  random: () => number = Math.random
): string | undefined {
  const troops = project.database.troops.filter((troop) => {
    const members = troop.members?.length ?? 0;
    const enemies = troop.enemyIds?.length ?? 0;
    return members > 0 || enemies > 0;
  });
  if (troops.length === 0) {
    return project.system.initialTroopId ?? project.database.troops[0]?.id;
  }
  const index = Math.min(troops.length - 1, Math.max(0, Math.floor(random() * troops.length)));
  return troops[index]?.id;
}

/** Editor quick-test: open a battle against a random authored troop (no field walk). */
export async function openRandomTroopBattleTestModal(
  random: () => number = Math.random
): Promise<void> {
  const project = store.getCurrent();
  const troopId = pickRandomTroopId(project, random);
  if (!troopId) {
    const body = openTestPlayShell("전투 테스트");
    const loading = mountPlayLoadingOverlay(body, "error");
    loading.setStage("error", "적 그룹이 없습니다. 데이터베이스에서 트룹을 추가하세요.");
    return;
  }
  await openTroopBattleTestModalAfterGate(troopId);
}

export function closeTestPlayModal(): void {
  // 배틀 씬 컨트롤러를 먼저 정리한다. mountBattleScene 가 반환한 destroy() 만이
  // 200ms 틱 setInterval 과 window keydown 리스너를 해지한다. 이 단계를 빼면 전투
  // 테스트를 열 때마다 타이머/리스너가 영구 누수된다(renderPlayer 를 거치지 않으므로
  // teardownPlayer 의 teardownShell 은 null 이다).
  battleSceneController?.destroy();
  battleSceneController = null;
  playRunControls = null;
  skipTitleCheckbox = null;
  skipOpeningCheckbox = null;
  removePlayWindowKeydown?.();
  removePlayWindowKeydown = null;
  // Runtime teardown must finish while store.getCurrent() still resolves to the
  // sandbox. Only then expose the canonical editor project again.
  teardownPlayer();
  releaseEventTestSnapshot?.();
  releaseEventTestSnapshot = null;
  if (modalRoot) unregisterModal(modalRoot);
  modalRoot?.remove();
  modalRoot = null;
  releaseBackgroundInert?.();
  releaseBackgroundInert = null;
  stopPauseWatch?.();
  stopPauseWatch = null;
  document.body.classList.remove("is-test-play-open");
  if (returnFocusAfterEnemyTest) {
    const target = returnFocusAfterEnemyTest.isConnected ? returnFocusAfterEnemyTest
      : document.querySelector<HTMLElement>('[data-testid="db-enemy-battle-test"]');
    target?.focus();
  }
  returnFocusAfterEnemyTest = null;
  // 창이 닫혔으니 편집기 게임을 다시 깨운다(열 때 잠재운 것과 짝).
  resumeEditorGame();
  setImageWarmQueueSuspended(false);
}

// 런 조작 버튼은 전체 테스트 플레이 창에만 단다. 전투·이벤트 테스트 셸은 런 손잡이가 없어
// 버튼을 달면 눌러도 아무 일이 없는 죽은 컨트롤이 된다.
function openTestPlayShell(
  title: string,
  shellOptions: { readonly runControls?: boolean; readonly nestedEnemyTest?: boolean; readonly mapName?: string } = {},
): HTMLElement {
  closeTestPlayModal();
  // 편집기 색키 워밍이 이 창의 프리로드와 연결·메인 스레드를 나누지 않게 멈춘다.
  // close 가 큐를 다시 켜므로, 그 다음에 건다.
  setImageWarmQueueSuspended(true);
  void preloadRuntimeStyles();
  // Claim the initiating click/key before persistence and bootstrap yield.
  getAudioEngine().unlock();
  if (shellOptions.nestedEnemyTest && document.activeElement instanceof HTMLElement) {
    returnFocusAfterEnemyTest = document.activeElement;
  }
  const backdrop = el("div", {
    class: "test-play-modal-backdrop",
    attrs: {
      role: "dialog",
      "aria-modal": "true",
      "aria-label": title,
    },
    dataset: { testid: "test-play-modal-backdrop" },
  });
  const windowNode = el("div", {
    class: "test-play-window",
    dataset: { testid: "test-play-window", windowMode: "windowed" },
  });
  const titlebar = el("div", { class: "test-play-titlebar" });
  // 편집 후 재테스트를 창을 닫지 않고 끝낸다: 다시 시작(F5) / 타이틀부터.
  const restartRunButton = el("button", {
    class: "test-play-close",
    text: "다시 시작",
    attrs: { title: "현재 런을 처음부터 다시 시작 (F5)", "aria-label": "테스트 실행 다시 시작" },
    dataset: { testid: "test-play-restart" },
    on: { click: () => restartPlayRun() },
  }) as HTMLButtonElement;
  const bootTitleButton = el("button", {
    class: "test-play-close",
    text: "타이틀부터",
    attrs: { title: "타이틀 화면부터 실행", "aria-label": "테스트 실행 타이틀부터" },
    dataset: { testid: "test-play-title" },
    on: { click: () => bootPlayTitle() },
  }) as HTMLButtonElement;
  // 타이틀 건너뛰기는 저장되는 선호다. 예전에는 다시 시작 / 타이틀부터를 눌러야만 바뀌어서
  // 작업자가 지금 어느 모드인지 볼 수도, 직접 고를 수도 없었다.
  // 체크박스는 감싼 label 글자와 같은 접근 이름을 직접 갖는다(값 「on」 이 이름으로 읽히던 결함, HIG C-89).
  const skipTitleInput = el("input", {
    attrs: { type: "checkbox", "aria-label": "타이틀 건너뛰기" },
    dataset: { testid: "test-play-skip-title" },
  }) as HTMLInputElement;
  skipTitleInput.checked = readTestPlayAutoStart();
  skipTitleInput.addEventListener("change", () => setSkipTitle(skipTitleInput.checked));
  const skipTitleLabel = el("label", {
    class: "test-play-close test-play-skip-title",
    attrs: { title: "체크하면 타이틀 화면을 거치지 않고 바로 플레이한다" },
    dataset: { testid: "test-play-skip-title-label" },
    children: [skipTitleInput, el("span", { text: "타이틀 건너뛰기" })],
  });
  // 오프닝도 같은 선택지다: 타이틀을 건너뛰어도 오프닝은 매 런마다 다시 나왔다.
  const skipOpeningInput = el("input", {
    attrs: { type: "checkbox", "aria-label": "오프닝 건너뛰기" },
    dataset: { testid: "test-play-skip-opening" },
  }) as HTMLInputElement;
  skipOpeningInput.checked = readTestPlaySkipOpening();
  skipOpeningInput.addEventListener("change", () => setSkipOpening(skipOpeningInput.checked));
  const skipOpeningLabel = el("label", {
    class: "test-play-close test-play-skip-title",
    attrs: { title: "체크하면 오프닝 시네마틱을 건너뛰고 바로 플레이한다" },
    dataset: { testid: "test-play-skip-opening-label" },
    children: [skipOpeningInput, el("span", { text: "오프닝 건너뛰기" })],
  });
  const restoreButton = el("button", {
    class: "test-play-close window-control restore",
    text: "창으로 돌아가기",
    attrs: { title: "전체 화면을 끝내고 창으로 돌아가기 (Alt+Enter)" },
    dataset: { testid: "test-play-window-restore" },
  }) as HTMLButtonElement;
  const maximizeButton = el("button", {
    class: "test-play-close window-control maximize",
    text: "전체 화면",
    attrs: { title: "전체 화면 (Alt+Enter)" },
    dataset: { testid: "test-play-window-maximize" },
  }) as HTMLButtonElement;
  // 게임 메뉴가 열려 있는 동안만 보이는 상태 칩. 메뉴가 열리면 플레이어 조작이 멈춘다는 것을 막대에서도 읽는다(IS-085).
  const pauseChip = el("span", {
    class: "test-play-pause",
    text: "조작 일시 정지 · Esc로 계속",
    attrs: { role: "status", hidden: "" },
    dataset: { testid: "test-play-pause" },
  });
  // 창을 닫는 길은 하나다: 결과를 이름에 적은 「편집기로 돌아가기」. 예전엔 「편집으로」와 「×」가 같은 이름으로 두 번 있었다(HIG C-89).
  const exitButton = el("button", {
    class: "test-play-close test-play-exit",
    text: "편집기로 돌아가기",
    attrs: { title: "테스트 창을 닫고 편집기로 돌아가기" },
    dataset: { testid: "mode-edit" },
    on: { click: () => closeTestPlayModal() },
  }) as HTMLButtonElement;
  titlebar.append(
    el("span", {
      class: "test-play-title",
      text: store.getCurrent().meta.publication ? `${title} · 현재 편집기 엔진 미리보기` : title,
      dataset: { testid: "test-play-window-title" },
    }),
    // 지금 무엇을 돌리는지(맵 이름)는 막대에 남긴다 — 편집과 플레이를 헷갈리지 않게(IS-084).
    ...(shellOptions.mapName
      ? [el("span", { class: "test-play-map", text: shellOptions.mapName, attrs: { title: "시작 맵" }, dataset: { testid: "test-play-map" } })]
      : []),
    pauseChip,
    ...(shellOptions.runControls ? [skipTitleLabel, skipOpeningLabel, restartRunButton, bootTitleButton] : []),
    restoreButton,
    maximizeButton,
    exitButton,
  );
  const body = el("div", {
    class: "test-play-modal-body",
    dataset: { testid: "test-play-window-body" },
  });

  windowNode.append(titlebar, body, renderRuntimeDebugPanel());
  backdrop.append(windowNode);
  document.body.append(backdrop);
  // 코치마크 숨김 CSS 가 body:has() 로 문서 전체를 훑지 않게 상태를 body 에 직접 둔다.
  document.body.classList.add("is-test-play-open");
  modalRoot = backdrop;
  releaseBackgroundInert = inertEverythingBut(backdrop);
  stopPauseWatch = watchGameMenuPause(body, pauseChip);
  if (shellOptions.nestedEnemyTest) registerModal(backdrop, closeTestPlayModal);
  // 창은 모달이다: Tab 이 창 밖(편집기)으로 나가지 않고 창 안을 돈다(HIG C-90).
  backdrop.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const controls = Array.from(backdrop.querySelectorAll<HTMLElement>('button, input, select, textarea, summary, [tabindex="0"]'))
      .filter((node) => !node.hasAttribute("disabled") && node.getClientRects().length > 0);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (!first || !last) return;
    const active = document.activeElement;
    const inside = active instanceof HTMLElement && controls.includes(active);
    if (event.shiftKey && (active === first || !inside)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !inside)) {
      event.preventDefault();
      first.focus();
    }
  });
  if (shellOptions.nestedEnemyTest) restoreButton.focus();
  // 모달 뒤의 편집기 게임은 그릴 필요도, 키를 받을 이유도 없다 — 플레이 프레임에 양보한다.
  suspendEditorGame();
  windowNode.dataset.editorGameSuspended = String(isEditorGameSuspended());
  if (shellOptions.runControls) {
    skipTitleCheckbox = skipTitleInput;
    skipOpeningCheckbox = skipOpeningInput;
  }
  restoreButton.addEventListener("click", () => setTestPlayWindowMode(windowNode, "windowed"));
  maximizeButton.addEventListener("click", () => setTestPlayWindowMode(windowNode, "fullscreen"));
  removePlayWindowKeydown = bindPlayWindowHotkeys(windowNode, shellOptions.runControls === true);
  return body;
}

// 자동 시작 선택은 두 버튼이 곧 작업자의 선택이다 — 다음 실행이 같은 방식으로 열린다.
function restartPlayRun(): void {
  writeTestPlayAutoStart(true);
  playRunControls?.restartRun();
}

function bootPlayTitle(): void {
  writeTestPlayAutoStart(false);
  playRunControls?.returnToTitle();
}

// 체크박스는 죽은 설정이 아니다: 지금 열려 있는 창에도 즉시 적용한다(켜면 런 시작, 끄면 타이틀).
function setSkipTitle(skipTitle: boolean): void {
  if (skipTitle) {
    restartPlayRun();
    return;
  }
  bootPlayTitle();
}

// 오프닝 선택도 지금 창에 바로 보여야 한다. 타이틀 선호는 건드리지 않고 현재 시작 방식대로 다시 연다
// (자동 시작이면 런을 다시, 타이틀 모드면 타이틀로 — 다음 «새 게임» 이 새 선택으로 열린다).
function setSkipOpening(skipOpening: boolean): void {
  writeTestPlaySkipOpening(skipOpening);
  if (readTestPlayAutoStart()) {
    playRunControls?.restartRun();
    return;
  }
  playRunControls?.returnToTitle();
}

/** 창 밖 형제를 모두 inert 로 두고, 되돌리는 함수를 돌려준다. 원래 inert 였던 노드는 그대로 둔다. */
function inertEverythingBut(keep: HTMLElement): () => void {
  const changed: HTMLElement[] = [];
  for (const node of Array.from(document.body.children)) {
    if (!(node instanceof HTMLElement) || node === keep || node.inert) continue;
    node.inert = true;
    changed.push(node);
  }
  return () => {
    for (const node of changed) node.inert = false;
  };
}

/** 플레이 화면에 게임 메뉴가 열려 있는 동안 막대의 일시 정지 칩을 보인다. */
function watchGameMenuPause(host: HTMLElement, chip: HTMLElement): () => void {
  const sync = (): void => {
    const open = Array.from(host.querySelectorAll<HTMLElement>(".oprn-status-menu")).some((menu) => menu.getClientRects().length > 0);
    if (chip.hidden === !open) return;
    chip.hidden = !open;
  };
  // 게임 DOM 은 프레임마다 바뀔 수 있다 — 변경은 한 프레임에 한 번만 읽는다.
  let frame = 0;
  const observer = new MutationObserver(() => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      sync();
    });
  });
  observer.observe(host, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "hidden"] });
  return () => {
    observer.disconnect();
    if (frame) cancelAnimationFrame(frame);
  };
}

function setTestPlayWindowMode(windowNode: HTMLElement, mode: TestPlayWindowMode): void {
  windowNode.dataset.windowMode = mode;
}

function bindPlayWindowHotkeys(windowNode: HTMLElement, runControls: boolean): () => void {
  const onKeyDown = (event: KeyboardEvent): void => {
    // F5 는 열린 테스트 플레이 창에서만 잡는다(리스너는 창을 닫을 때 해지된다).
    // preventDefault 없이 두면 브라우저가 편집기를 새로고침해 작업 중 상태가 날아간다.
    if (runControls && event.key === "F5" && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      event.stopImmediatePropagation();
      restartPlayRun();
      return;
    }
    if (!isPlayWindowFullscreenHotkey(event)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    setTestPlayWindowMode(windowNode, nextTestPlayWindowMode(windowNode.dataset.windowMode));
  };
  document.addEventListener("keydown", onKeyDown);
  return () => document.removeEventListener("keydown", onKeyDown);
}

function isPlayWindowFullscreenHotkey(event: KeyboardEvent): boolean {
  return event.altKey && event.key === "Enter";
}

function nextTestPlayWindowMode(mode: string | undefined): TestPlayWindowMode {
  return mode === "fullscreen" ? "windowed" : "fullscreen";
}

function selectedEventTestSession(preparation: EventTestPreparation): PlaySession {
  const session = startSession(preparation.project);
  session.currentMapId = preparation.mapId;
  session.x = preparation.spawn.x;
  session.y = preparation.spawn.y;
  return session;
}

function eventDisplayName(event: GameEvent): string {
  return event.pages?.[0]?.name || event.id;
}

// 창을 여는 도중 터진 실패를 막다른 문구 대신 **기계 이유 + 실제 복구 버튼**으로 돌린다.
//
// 능력 확인이 있는 이유: 이 창을 같이 구동하는 다른 테스트가 `playLoadingOverlay` 모듈을
// setStage 만 갖는 대역으로 바꿔 둔다. 대역이 패널을 못 올려도 실패 이유 보고는 끊기지 않는다.
function presentOpenFailure(
  loading: ReturnType<typeof mountPlayLoadingOverlay>,
  title: string,
  error: unknown,
  actions: { readonly onRetry: () => void; readonly onSafeMode: () => void },
): void {
  const described = describeBootFailure({ kind: "boot-threw", error, detail: "openTestPlayModal" });
  if (typeof loading.showRecovery === "function") {
    loading.showRecovery({
      title,
      reason: described.reason,
      diagnostics: described.diagnostics,
      onRetry: actions.onRetry,
      onSafeMode: actions.onSafeMode,
    });
    return;
  }
  toast(`${title} — ${described.reason}`, "error");
}

function yieldToRuntimeSurface(): Promise<void> {
  return Promise.all([yieldToBrowser(), preloadRuntimeStyles()]).then(() => undefined);
}

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(fallback);
      resolve();
    };
    // Background/minimized editor tabs may throttle requestAnimationFrame
    // indefinitely. Keep the paint opportunity, but never leave Test stuck on
    // the preparation overlay just because the document is not foregrounded.
    const fallback = globalThis.setTimeout(finish, 80);
    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(finish);
      return;
    }
    finish();
  });
}
