import { advanceBattleRuntime } from "@/battle/battleRuntimeAdvance";
import { PRODUCT_BRAND } from "@/brand";
import { createBattleRuntime } from "@/battle/runtime";
import { mountBattleScene, type BattleDomController } from "@/player/battleDom";
import { mountPlayLoadingOverlay } from "@/player/playLoadingOverlay";
import { renderPlayer, teardownPlayer } from "@/player/player";
import { nextSessionRandom, startSession, type PlaySession } from "@/project/session";
import { renderRuntimeDebugPanel } from "@/player/runtimeDebugPanel";
import { projectWithoutEventDrafts } from "@/project/eventDrafts";
import { store } from "@/project/store";
import type { GameEvent, MapId, Project } from "@/project/types";
import { el } from "@/util/dom";
import { warmBundledPlayAssets } from "@/assets/bundledAssetWarmup";
import { editorPlayBootDiagnosticSink } from "@/app/editorPlayBootDiagnostics";
import { validateEventDraft } from "@/editor/eventDraftValidator";
import { prepareEventTest, type EventTestPreparation } from "@/editor/eventTestSandbox";
import { toast } from "@/util/toast";
import {
  AUTHORING_TEST_BOOT_SUCCESS_EVENT,
  AUTHORING_TEST_GATE_BLOCKED_EVENT,
  authoringProjectFingerprint,
  evaluateAuthoringTestGate,
} from "@/editor/authoringJourney";

let modalRoot: HTMLElement | null = null;
let removePlayWindowKeydown: (() => void) | null = null;
let releaseEventTestSnapshot: (() => void) | null = null;
// 에디터 전투 테스트가 mount 한 배틀 씬 컨트롤러. closeTestPlayModal 이 destroy()
// 를 호출해 setInterval(200ms 틱) 과 window keydown 리스너 누수를 막는다.
let battleSceneController: BattleDomController | null = null;

type TestPlayWindowMode = "fullscreen" | "windowed";

export async function openTestPlayModal(startOverride?: { mapId: string; x: number; y: number }): Promise<void> {
  if (!passesAuthoringTestGate()) return;
  // 어떤 프로젝트를 돌리는지 제목에 드러나야 한다 — 제품명 고정 문구를 쓰면
  // 프로젝트를 여러 개 열어두면 어느 창이 무엇인지 구분이 안 된다.
  const projectTitle = store.getCurrent().meta.title?.trim();
  const title = startOverride
    ? `여기서 테스트 - (${startOverride.mapId} ${startOverride.x},${startOverride.y})`
    : `시연 실행 - ${projectTitle || PRODUCT_BRAND}`;
  const body = openTestPlayShell(title);
  const loading = mountPlayLoadingOverlay(body, "saving");
  try {
    await store.flush();
    loading.setStage("preparing");
    const project = projectWithoutEventDrafts(store.getCurrent());
    const projectFingerprint = authoringProjectFingerprint(project);
    releaseEventTestSnapshot = store.beginReadOnlyProjectSnapshot(project);
    // 타이틀/플레이 전에 canonical 번들 에셋을 브라우저 캐시에 데운다.
    void warmBundledPlayAssets(project);
    // Give the browser a paint before heavy player bootstrap.
    await yieldToBrowser();
    renderPlayer(body, {
      onExit: closeTestPlayModal,
      trackGlobalGame: false,
      startOverride,
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
    loading.setStage("error", "시연 실행를 열지 못했습니다");
    return;
  }
  // renderPlayer clears body children (including this overlay) when it mounts.
  // If title path ran, loading is already gone; if not, remove explicitly.
  if (loading.root.isConnected) loading.remove();
}

export async function openSelectedEventTestModal(mapId: MapId, eventId: string): Promise<boolean> {
  if (!passesAuthoringTestGate()) return false;
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
    void warmBundledPlayAssets(preparation.project);
    await yieldToBrowser();
    renderPlayer(body, {
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
  if (!passesAuthoringTestGate()) return;
  await openTroopBattleTestModalAfterGate(troopId);
}

async function openTroopBattleTestModalAfterGate(troopId: string): Promise<void> {
  const project = store.getCurrent();
  const troop = project.database.troops.find((record) => record.id === troopId);
  const body = openTestPlayShell(`전투 테스트 - ${troop?.name ?? troopId}`);
  const loading = mountPlayLoadingOverlay(body, "saving");
  try {
    await store.flush();
    loading.setStage("preparing");
    await yieldToBrowser();
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
        faceIndices: session.actorFaceIndices,
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
  if (!passesAuthoringTestGate()) return;
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

function passesAuthoringTestGate(): boolean {
  const gate = evaluateAuthoringTestGate(store.getCurrent());
  if (gate.allowed) return true;
  window.dispatchEvent(new CustomEvent(AUTHORING_TEST_GATE_BLOCKED_EVENT, {
    detail: { referenceIssues: gate.referenceIssues },
  }));
  toast(`참조 문제 ${gate.referenceIssues.length}개를 해결해야 테스트할 수 있습니다. 여정의 문제 목록에서 데이터로 이동하세요.`, "error");
  return false;
}

export function closeTestPlayModal(): void {
  // 배틀 씬 컨트롤러를 먼저 정리한다. mountBattleScene 가 반환한 destroy() 만이
  // 200ms 틱 setInterval 과 window keydown 리스너를 해지한다. 이 단계를 빼면 전투
  // 테스트를 열 때마다 타이머/리스너가 영구 누수된다(renderPlayer 를 거치지 않으므로
  // teardownPlayer 의 teardownShell 은 null 이다).
  battleSceneController?.destroy();
  battleSceneController = null;
  removePlayWindowKeydown?.();
  removePlayWindowKeydown = null;
  // Runtime teardown must finish while store.getCurrent() still resolves to the
  // sandbox. Only then expose the canonical editor project again.
  teardownPlayer();
  releaseEventTestSnapshot?.();
  releaseEventTestSnapshot = null;
  modalRoot?.remove();
  modalRoot = null;
}

function openTestPlayShell(title: string): HTMLElement {
  closeTestPlayModal();
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
  const restoreButton = el("button", {
    class: "test-play-close window-control restore",
    text: "창",
    attrs: { title: "창 모드", "aria-label": "시연 실행 창 모드" },
    dataset: { testid: "test-play-window-restore" },
  }) as HTMLButtonElement;
  const maximizeButton = el("button", {
    class: "test-play-close window-control maximize",
    text: "전체",
    attrs: { title: "전체 화면", "aria-label": "시연 실행 전체 화면" },
    dataset: { testid: "test-play-window-maximize" },
  }) as HTMLButtonElement;
  titlebar.append(
    el("span", {
      class: "test-play-title",
      text: title,
      dataset: { testid: "test-play-window-title" },
    }),
    el("button", {
      class: "test-play-close",
      text: "편집으로",
      attrs: { title: "시연 실행 닫기" },
      dataset: { testid: "mode-edit" },
      on: { click: () => closeTestPlayModal() },
    }),
    restoreButton,
    maximizeButton,
    el("button", {
      class: "test-play-close icon",
      text: "x",
      attrs: { title: "닫기" },
      dataset: { testid: "test-play-window-close" },
      on: { click: () => closeTestPlayModal() },
    })
  );
  const body = el("div", {
    class: "test-play-modal-body",
    dataset: { testid: "test-play-window-body" },
  });

  windowNode.append(titlebar, body, renderRuntimeDebugPanel());
  backdrop.append(windowNode);
  document.body.append(backdrop);
  modalRoot = backdrop;
  restoreButton.addEventListener("click", () => setTestPlayWindowMode(windowNode, "windowed"));
  maximizeButton.addEventListener("click", () => setTestPlayWindowMode(windowNode, "fullscreen"));
  removePlayWindowKeydown = bindPlayWindowFullscreenHotkey(windowNode);
  return body;
}

function setTestPlayWindowMode(windowNode: HTMLElement, mode: TestPlayWindowMode): void {
  windowNode.dataset.windowMode = mode;
}

function bindPlayWindowFullscreenHotkey(windowNode: HTMLElement): () => void {
  const onKeyDown = (event: KeyboardEvent): void => {
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
