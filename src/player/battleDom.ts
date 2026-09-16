import type {
  ActorCommand,
  BattleResult,
  BattleRuntime,
  BattleSnapshot,
  TargetedActorCommand,
} from "@/battle/runtime";
import { concreteTargetCommand } from "@/battle/runtime";
import { waitForEventKey } from "@/player/eventInput";
import type { BattleEventChoiceSnapshot, BattleEventPauseSnapshot } from "@/battle/types";
import { targetScopeForCommand } from "@/battle/battleTargetResolver";
import type { BattleAnimationPlayback } from "@/player/battleAnimationDom";
import { battleAnimationImpactMs, syncBattleAnimationLayer } from "@/player/battleAnimationDom";
import { createPresentationLedger, type BattlePresentationLedger } from "@/player/battlePresentation";
import { commandPanel, enemyListPanel, syncEnemyListPanel, type BattleCommandSubmenu } from "@/player/battleCommandDom";
import {
  applyBattleDirectorState,
  battleMessageWindow,
  battleEventDirectorState,
  battleResultPanel,
  battleResultRewardRowCount,
  chargingDirectorState,
  commandPromptState,
  resultDirectorState,
  syncBattleMessageWindow,
  syncBattleResultPanel,
  targetSelectDirectorState,
  type BattleDirectorState,
} from "@/player/battleDirectorDom";
import { battleSkinFamily, getBattleSkin, resolveSkinId } from "@/battle/skins/registry";
import { applyActionMotion, battleField, battlePartyStatus, findBattlerNode, playCaptureCinematic, syncBattleField, syncBattleParty, syncSceneBackdropVar } from "@/player/battleFieldDom";
import { emitBattleJuice as emitContextBattleJuice, flashBattleField, playBattleCue as playContextBattleCue, preloadBattleJuiceSamples, type BattleAudioContext, type BattleJuiceEvent } from "@/player/battleJuice";
import { ensureBattleFlashFilter } from "@/player/battleFlashFilter";
import { applyHitIntensity, battlerMaxHp } from "@/player/battleHitIntensityDom";
import { hitIntensity } from "@/player/battleHitIntensity";
import { directionForKey, isAutoBattleKey, isCancelKey, isConfirmKey } from "@/player/keyBindings";
import { unlockBattleSfx } from "@/player/battleSfx";
import {
  createBattleSequencer,
  type DamageFeedback,
} from "@/player/battleSequencer";
import { openBattleTimerScope, clearBattleTimerScope, scheduleBattleTimer } from "@/player/battleTimerScope";
import { applyBattleSystemGraphic } from "@/player/systemGraphics";
import { store } from "@/project/store";
import { bindBattleStageScale } from "@/player/battleStageScale";

export interface BattleDomOptions {
  readonly host: HTMLElement;
  readonly runtime: BattleRuntime;
  readonly audioContext?: BattleAudioContext;
  readonly onResult: (result: BattleResult, snapshot: BattleSnapshot) => void;
  readonly introHold?: boolean;
  readonly showEventText?: (request: Extract<BattleEventPauseSnapshot, { kind: "text" }>, signal: AbortSignal) => Promise<void>;
  readonly showEventChoices?: (request: BattleEventChoiceSnapshot, signal: AbortSignal) => Promise<number>;
  readonly onDestroy?: () => void;
  readonly onError?: (error: unknown) => void;
}

export interface BattleDomController {
  readonly root: HTMLElement;
  destroy(): void;
}

const BATTLE_TICK_MS = 200;
/** 연출 중 확인/취소를 누를 때 걸리는 1회성 빨리감기 배속. */
const SKIP_SPEED = 5.0;

// host 기준으로 활성 전투 컨트롤러를 추적한다. 같은 host에 다시 마운트할 때
// 이전 컨트롤러의 destroy()를 먼저 불러 setInterval(200ms 틱)·window keydown 리스너·
// ResizeObserver 가 중복으로 남는 것을 막는다(결함 1a).
const activeBattleControllers = new WeakMap<HTMLElement, BattleDomController>();

/** 이벤트 대상이 텍스트 입력 요소(input/textarea/select/contenteditable)인지,
 *  또는 그 자손인지 판별한다. 전투 키 가로채기 방지용(결함 2). */
function isTextInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest("input, textarea, select")) return true;
  // isContentEditable 은 상속·"false" 값을 정확히 반영한다.
  const editable = target.closest("[contenteditable]");
  return editable instanceof HTMLElement && editable.isContentEditable;
}

/** host에 마운트된 전투 컨트롤러를 정리한다. 플레이어 teardown 등에서 호출해
 *  전투가 끝나기 전에 플레이를 닫아도 틱·리스너가 새지 않게 한다(결함 1c). */
export function destroyBattleSceneOnHost(host: HTMLElement): void {
  activeBattleControllers.get(host)?.destroy();
  activeBattleControllers.delete(host);
}

export function mountBattleScene(options: BattleDomOptions): BattleDomController {
  // 블라인드 전환 동안 기본 SE 세트를 디코딩해 둔다 — 첫 임팩트부터 소리가 정시에 온다.
  preloadBattleJuiceSamples();
  const playBattleCue = (event: BattleJuiceEvent): void => playContextBattleCue(event, options.audioContext);
  const emitBattleJuice = (event: BattleJuiceEvent, target?: HTMLElement | null): void =>
    emitContextBattleJuice(event, target, options.audioContext);
  // 같은 host에 이전 컨트롤러가 살아있으면 먼저 정리한다.
  // DOM만 지우면 setInterval/window keydown/ResizeObserver가 중복으로 남는다(결함 1a).
  activeBattleControllers.get(options.host)?.destroy();
  activeBattleControllers.delete(options.host);
  options.host.querySelector("[data-testid='battle-scene']")?.remove();
  const root = document.createElement("section");
  root.className = "battle-scene";
  root.dataset.testid = "battle-scene";
  // 전투 UI 스킨 — CSS가 [data-battle-ui-style="pokemon"] 로 레이아웃을 갈아입힌다.
  root.dataset.battleUiStyle = store.getCurrent().system.battleUiStyle === "pokemon" ? "pokemon" : "classic";
  // 스킨 레지스트리 기반 분기 — CSS가 [data-battle-skin="<id>"] 로 등록 스킨을 갈아입힌다.
  // B: 12 vars 테마 엔진 — 레지스트리의 themeVars를 루트에 직접 주입한다(CSS 변수).
  const skinId = resolveSkinId(store.getCurrent().system.battleUiStyle);
  const skin = getBattleSkin(skinId);
  root.dataset.battleSkin = skinId;
  // 창 크롬 묶음 — `_rm2000.css` 의 유리 HUD 는 이 속성으로 스코프해 정면(rm2000)·측면(rm2003) 이 나눠 쓴다.
  root.dataset.battleSkinFamily = battleSkinFamily(skinId);
  root.dataset.battleTransition = skin.transition;
  root.dataset.battleHud = skin.hudTemplate;
  root.dataset.battleLayout = skin.layout;
  // 대상 플래시가 실루엣만 물들이도록 SVG 필터 정의를 루트에 심는다(05-poses-motion.css 가 url(#…) 로 참조).
  ensureBattleFlashFilter(root);
  for (const [key, value] of Object.entries(skin.themeVars)) {
    root.style.setProperty(key, value as string);
  }
  applyBattleSystemGraphic(root);
  options.host.append(root);
  // 논리 해상도(320×240) 스케일링 — 스킨이 그 해상도 기준으로 저작돼 있다.
  const stageScale = bindBattleStageScale(options.host, root);
  // 전투가 소유한 지연 콜백의 스코프를 연다 — teardown 이 남은 것을 한 번에 끊는다.
  openBattleTimerScope();

  const initialSnapshot = options.runtime.snapshot();
  let destroyed = false;
  let choiceController: AbortController | undefined;
  let resultSent = false;
  let submenu: BattleCommandSubmenu = null;
  let targetReturnSubmenu: BattleCommandSubmenu = null;
  let directorState: BattleDirectorState = commandPromptState(initialSnapshot);
  let resultRevealStage = 0;
  let sequenceBusy = false;
  let eventSurfaceOpen = false;
  let lastDamageFeedback: DamageFeedback | undefined;
  let activeAnimation: BattleAnimationPlayback | undefined;
  // 프레젠테이션 HP 원장 — 시퀀스가 도는 동안 화면은 이 원장을 본다.
  // 런타임 스냅샷(즉시 최종 상태)이 연출을 앞지르는 결함의 단일 수정 지점.
  let presentation: BattlePresentationLedger | undefined;
  let commandPanelSignature = "";
  const cursorByContext = new Map<string, string>();
  let lastEnemyActionKey = "";
  // Shift 단독 토글 감지용 — Shift 가 눌린 동안 다른 키가 함께 눌리면 조합키로 본다.
  let shiftHeld = false;
  let shiftCombined = false;

  const field = battleField(initialSnapshot);
  field.dataset.testid = "battle-field";
  const animationLayer = document.createElement("div");
  animationLayer.className = "battle-animation-layer";
  animationLayer.dataset.testid = "battle-animation-layer";
  const messageWindow = battleMessageWindow(directorState);
  const enemyPanel = enemyListPanel(initialSnapshot);
  const partyPanel = battlePartyStatus(initialSnapshot);
  const commandHost = document.createElement("div");
  commandHost.className = "battle-command-host";
  const resultHost = document.createElement("div");
  resultHost.className = "battle-result-host";

  let autoBattle = false;
  let speedMultiplier = 1.0;
  // 연출 중 확인/취소로 켜지는 1회성 빨리감기. 시퀀스가 끝나면 배속이 원래대로 돌아온다.
  let skipping = false;

  // 우상단 자동/배속 버튼 바는 제거했다(감독 지적 3) — 게임 화면 위에 뜬 에디터풍
  // 크롬이었고 런타임은 키보드 전용이다. 자동전투(A)·배속(Shift) 토글은 키로만 받고,
  // 상태는 루트 data 속성으로 노출한다(스킨/테스트가 읽을 수 있게).
  root.append(field, animationLayer, messageWindow, enemyPanel, commandHost, partyPanel, resultHost);
  // 씬이 붙으면 포커스를 씬 안으로 가져온다 — 없으면 인트로·명령 국면 내내 activeElement 가
  // BODY 라 보조기술 컨텍스트가 필드에 남고 씬 스코프 포커스 링이 절대 보이지 않는다.
  queueMicrotask(() => {
    if (root.isConnected && !root.contains(document.activeElement)) root.focus({ preventScroll: true });
  });
  // 필드가 루트에 붙은 뒤에만 배경 변수를 비출 수 있다(battleField 생성 시점에는 부모가 없다).
  syncSceneBackdropVar(field);

  function toggleAutoBattle(): void {
    autoBattle = !autoBattle;
    root.dataset.battleAuto = autoBattle ? "true" : "false";
    if (autoBattle && speedMultiplier === 1.0) {
      setSpeed(1.8);
    }
    syncView();
  }

  function toggleSpeed(): void {
    const nextSpeed = speedMultiplier === 1.0 ? 1.8 : speedMultiplier === 1.8 ? 3.0 : 1.0;
    setSpeed(nextSpeed);
  }

  function setSpeed(spd: number): void {
    speedMultiplier = spd;
    if (!skipping) sequencer.speedMultiplier = spd;
    root.dataset.battleSpeed = spd.toFixed(1);
  }

  /** 이 시퀀스 한 번만 빨리감기. onSequenceBusy(false) 에서 원래 배속으로 되돌린다. */
  function beginSkip(): void {
    if (skipping) return;
    skipping = true;
    sequencer.speedMultiplier = SKIP_SPEED;
    // 이펙트 프레임 간격(battleAnimationFrameMs)은 이 속성만 읽는다 — 안 갱신하면 스킵 중
    // 대사·모션은 5배속인데 이펙트만 원속도로 남아 다음 행동 위에 겹쳤다.
    root.dataset.battleSpeed = SKIP_SPEED.toFixed(1);
    root.dataset.battleSkipping = "true";
  }

  function endSkip(): void {
    if (!skipping) return;
    skipping = false;
    sequencer.speedMultiplier = speedMultiplier;
    root.dataset.battleSpeed = speedMultiplier.toFixed(1);
    root.dataset.battleSkipping = "false";
  }

  const panelOptions: {
    runtime: BattleRuntime;
    submenu: BattleCommandSubmenu;
    setSubmenu(next: BattleCommandSubmenu): void;
    setDirectorState(state: BattleDirectorState): void;
    render(): void;
    runActorCommand(command: ActorCommand): void;
    beginTargetCommand(command: TargetedActorCommand): void;
    confirmTargetSelection(targetId: string): void;
    cancelTargetSelection(): void;
  } = {
    runtime: options.runtime,
    submenu: null,
    setSubmenu(next) {
      submenu = next;
      panelOptions.submenu = next;
    },
    setDirectorState(state) {
      directorState = state;
    },
    render: () => syncView(),
    runActorCommand,
    beginTargetCommand,
    confirmTargetSelection,
    cancelTargetSelection: cancelTargetSelectionAndRestore,
  };

  const sequencer = createBattleSequencer(options.runtime, {
    onEventPause(request) {
      if (request.kind === "text") { eventSurfaceOpen = true; syncView(); }
      const input = new AbortController();
      choiceController = input;
      void Promise.resolve().then(async () => {
        if (destroyed || input.signal.aborted) return;
        const response = request.kind === "inputWait"
          ? { kind: "inputWait" as const, keyCode: await waitForEventKey(input.signal) }
          : await (async () => {
              if (!options.showEventText) throw new Error("Battle text input host missing");
              await options.showEventText(request, input.signal);
              return { kind: "text" as const };
            })();
        if (destroyed || input.signal.aborted || options.runtime.snapshot().eventPause?.id !== request.id) return;
        choiceController = undefined;
        const before = options.runtime.snapshot();
        if (!options.runtime.resumeEventPause(request.id, response)) throw new Error("Invalid battle event pause response");
        presentation = createPresentationLedger(before);
        sequencer.runAfterEventChoice(before, options.runtime.snapshot());
      }).catch(error => {
        if (input.signal.aborted || destroyed) return;
        try {
          if (options.onError) options.onError(error);
          else queueMicrotask(() => { throw error; });
        } finally { controller.destroy(); }
      });
    },
    onEventChoice(request) {
      if (!options.showEventChoices) {
        console.warn("[battle] event choice requires an input host", request.id);
        return;
      }
      eventSurfaceOpen = true;
      syncView();
      const showChoices = options.showEventChoices;
      const input = new AbortController();
      choiceController = input;
      void Promise.resolve().then(() => {
        if (destroyed || input.signal.aborted) return;
        return showChoices(request, input.signal);
      }).then(index => {
        if (index === undefined || destroyed || input.signal.aborted || options.runtime.snapshot().eventChoice?.id !== request.id) return;
        choiceController = undefined;
        const before = options.runtime.snapshot();
        if (!options.runtime.resumeEventChoice(request.id, index)) throw new Error("Invalid battle event choice response");
        presentation = createPresentationLedger(before);
        sequencer.runAfterEventChoice(before, options.runtime.snapshot());
      }).catch(error => {
        if (input.signal.aborted || destroyed) return;
        try {
          if (options.onError) options.onError(error);
          else queueMicrotask(() => { throw error; });
        } finally {
          controller.destroy();
        }
      });
    },
    onCaptureCinematic(targetId, success) {
      return playCaptureCinematic(field, targetId, success);
    },
    onDirectorState(state) {
      directorState = battleEventDirectorState(options.runtime.snapshot(), state);
    },
    onSyncView() {
      syncView();
    },
    onEntryAnimation(animation) {
      // 엔트리 단위 애니메이션 — 잔류하는 snapshot.lastAnimation 대신, 지금 재생 중인
      // 액션의 애니메이션만 레이어에 올린다. animation 이 없으면 레이어를 비운다.
      activeAnimation?.destroy();
      activeAnimation = syncBattleAnimationLayer(
        animationLayer,
        { ...options.runtime.snapshot(), lastAnimation: animation },
        root,
      );
    },
    onDamageFeedback(feedback) {
      lastDamageFeedback = feedback;
      if (feedback) {
        const vitalsBefore = presentation?.vitalsFor(feedback.targetId);
        const wasAlive = !vitalsBefore?.defeated;
        presentation?.applyFeedback(feedback);
        const targetNode =
          field.querySelector<HTMLElement>(`[data-testid="${feedback.targetId}"]`)
          ?? field.querySelector<HTMLElement>(`.battle-enemy[data-record-id="${feedback.targetId}"]`)
          ?? field.querySelector<HTMLElement>(`[data-testid="battle-actor-${feedback.targetId}"]`);
        // 타격 세기 — 대상 최대 HP 대비 피해 비율(+급소·막타)로 넉백·찌그러짐·무대 펀치·흔들림을 차등한다.
        const lethal = wasAlive && Boolean(presentation?.vitalsFor(feedback.targetId)?.defeated);
        const maxHp = vitalsBefore?.maxHp ?? battlerMaxHp(options.runtime.snapshot(), feedback.targetId);
        const intensity = hitIntensity(feedback, maxHp, lethal);
        applyHitIntensity(root, targetNode, intensity);
        // 타격/급소/회복/빗나감 효과음 — 사건 1개에 소리 1개. emitBattleJuice 안의
        // playBattleCue 가 샘플→합성 폴백을 단일 경로로 처리한다. 여기서 합성 보이스를
        // 따로 부르면 한 타격에 소리가 겹친다(예전 결함).
        emitBattleJuice(
          feedback.miss
            ? "hit-miss"
            : feedback.critical
              ? "hit-critical"
              : feedback.healing
                ? "hit-heal"
                : "hit-damage",
          targetNode,
        );
        // 이 타격으로 쓰러졌다면 기절음이 잠시 뒤따른다. 그 사이 전투가 닫힐 수 있으므로
        // id 를 보관해 destroy 가 끊는다 — 예전에는 익명 타이머라 씬이 사라진 뒤에도 살아
        // 공유 오디오 핸들을 만졌다(2026-09-16 실측: 전투 창 41개 중 2개가 파괴 뒤 발화).
        if (wasAlive && presentation?.vitalsFor(feedback.targetId)?.defeated) {
          scheduleBattleTimer(() => {
            if (destroyed) return;
            playBattleCue("faint");
          }, 260);
        }
        if (!feedback.healing && !feedback.miss) flashBattleField(root, feedback.critical ? "critical" : "hit", intensity);
      }
    },
    onHitFeel(active, feedback) {
      root.dataset.battleHitFeel = active ? "true" : "false";
      root.classList.toggle("battle-hit-stop", active);
      if (active && feedback?.critical) root.classList.add("battle-hit-stop-critical");
      else root.classList.remove("battle-hit-stop-critical");
    },
    onActionMotion(beat) {
      applyActionMotion(field, beat);
    },
    animationImpactMs(animation) {
      return battleAnimationImpactMs(animation.animationId);
    },
    onEscapeOutcome(success) {
      // 도주음·BGM 정지는 성공이 **화면에 도달한** 순간에만. 예전엔 명령 확정 시점에 울려
      // 실패해도 "도주음 → 그러나 도망칠 수 없었다" 순서가 됐고 남은 전투가 무음이었다.
      const actorNode = options.runtime.snapshot().activeActorId
        ? findBattlerNode(field, options.runtime.snapshot().activeActorId!)
        : null;
      emitBattleJuice(success ? "escape" : "hit-miss", actorNode ?? undefined);
    },
    onResultStage(stage) {
      // 사용자가 확인키로 전부 공개했으면(revealAllResultRows) 늦게 도착한 낮은 단계가 되감지 않는다.
      resultRevealStage = Math.max(resultRevealStage, stage);
      // 값만 바꾸면 화면은 stage 0 인 채로 남는다 — 보상 행은 `index >= revealStage` 로
      // hidden 이 결정되므로(battleDirectorDom.ts:251) 경험치·골드가 끝까지 안 보였다.
      // 결과 패널이 이미 떠 있을 때만 즉시 다시 그린다(전체 syncView 는 불필요).
      const panel = resultHost.querySelector<HTMLElement>("[data-testid='battle-result-panel']");
      if (panel) syncBattleResultPanel(panel, options.runtime.snapshot(), resultRevealStage);
    },
    onSequenceBusy(busy) {
      sequenceBusy = busy;
      if (!busy) endSkip();
      root.dataset.battleSequenceBusy = busy ? "true" : "false";
      // 시퀀스가 끝나면 원장을 버리고 실제 스냅샷으로 복귀한다.
      if (!busy) presentation = undefined;
      if (!busy && autoBattle) queueMicrotask(() => {
        if (root.isConnected) syncView();
      });
    },
  });

  root.addEventListener("click", (event) => {
    unlockBattleSfx();
    if (!(event.target instanceof Element)) return;
    const snapshot = options.runtime.snapshot();
    // 결과 "화면"에서는 어디를 클릭해도 종료 확정("클릭으로 계속" 프롬프트와 확인 버튼 포함).
    // 단 result 값이 아니라 디렉터 스텝으로 판정한다 — 도주/막타 확정 Enter 가 네이티브
    // 버튼에 click 을 합성하고, 그 click 이 여기로 버블될 때 런타임에는 이미 result 가
    // 서 있어서, 연출·결과 화면을 하나도 못 본 채 즉시 닫혔다(적대 리뷰 4차: 도주 성공
    // 시 "도망치려 한다…" 직후 씬 소멸).
    if (snapshot.result) {
      if (directorState.step === "result" && !resultSent) {
        if (revealAllResultRows(snapshot)) return;
        resultSent = true;
        options.onResult(snapshot.result, snapshot);
      }
      return;
    }
    const target = event.target.closest<HTMLElement>(".battle-field [data-battle-targetable='true'][data-battle-target-id]");
    const targetId = target?.dataset.battleTargetId;
    if (!targetId) return;
    confirmTargetSelection(targetId);
  });

  root.tabIndex = 0;

  // 확인/취소는 정본(keyBindings)만 본다. 전투에만 Space 처리가 없어서 커맨드
  // 버튼에 포커스가 있을 때만 네이티브 활성화로 "우연히" 먹던 결함(적대 리뷰 2),
  // 그리고 전투에만 있던 유령 취소키 C(적대 리뷰 7)를 함께 잘라냈다.
  function isBattleConfirmKey(event: KeyboardEvent): boolean {
    return isConfirmKey(event.key);
  }

  function isBattleCancelKey(event: KeyboardEvent): boolean {
    return isCancelKey(event.key);
  }

  // Enter 는 포커스된 네이티브 버튼을 keydown 에서 스스로 활성화한다. 그 한 번만
  // 통과시키고 루트 핸들러는 비켜선다. Space 는 keydown 을 preventDefault 하면
  // 네이티브 활성화가 취소되므로 여기서 직접 처리해도 이중 발화가 없다.
  // ↑ 이 전제가 거짓이었다(실측). 전투 커맨드 버튼은 포커스가 있어도 Enter keydown 에
  // 네이티부 click 을 단 한 번도 발행하지 않았다 — keydown key=Enter 다음에 click 이벤트가
  // 아예 없었고(z 는 trusted=false click 이 뜨며 정상 동작), 그 사이 루트 핸들러는
  // 뱄서서 있었다. 그래서 keyBindings 의 정본 CONFIRM_KEYS(z·enter·space·e) 가 약속한
  // Enter 확정이 **전투 메뉴에서만 묵묵하게 죽었다**: 대사를 Enter 로 넘기고 전투에 들어온
  // 플레이어가 이어서 Enter 를 눌러도 메뉴가 아무 반응을 하지 않았다(화면 안내는 "Z 확인").
  // 이제 Space 와 동일하게 처리한다 — preventDefault 가 네이티부 활성화를 취소하므로
  // 직접 확정해도 이중 발화가 없다.

  function onKeydown(event: KeyboardEvent): void {
    if (destroyed || options.runtime.snapshot().eventChoice || options.runtime.snapshot().eventPause || event.isComposing) return;
    if (event.repeat && (isBattleConfirmKey(event) || isBattleCancelKey(event))) { event.preventDefault(); return; }
    // 첫 사용자 입력에서 오디오 컨텍스트를 깨운다(autoplay 정책).
    unlockBattleSfx();
    const snapshot = options.runtime.snapshot();
    if (snapshot.result) {
      if (isBattleConfirmKey(event)) {
        event.preventDefault();
        // 클릭 핸들러와 같은 이유로, 결과 연출이 화면에 도달했을 때만 확정한다.
        // 첫 확인 = 보상 전부 공개, 둘째 확인 = 닫기. 막타 연타가 보상을 하나도 못 보고
        // 씬을 닫던 결함(2026-09-14 실측: stage 0 에서 Z → 700ms 뒤 씬 소멸).
        if (directorState.step === "result" && !resultSent) {
          if (revealAllResultRows(snapshot)) return;
          resultSent = true;
          options.onResult(snapshot.result, snapshot);
        }
      }
      return;
    }
    // 자동전투/속도 토글은 연출 중에도 받는다 — 재생을 보다가 끄거나 빨리감기를 켜는
    // 게 바로 이 순간이고, 명령 확정과 달리 비트 재생과 경합하지 않는다(코덱스 리뷰 C6:
    // 화면에 A·Shift 단축키가 표시되어 있는데 연출 중엔 눌러도 반응이 없었다).
    // 자동전투 토글은 F. 예전엔 A 였는데 필드를 WASD 로 걷던 플레이어가 전투에서
    // 좌측 이동을 누르면 자동전투가 켜졌다(적대 리뷰 11 — 화면 안내도 없는 상태였다).
    if (isAutoBattleKey(event.key)) {
      event.preventDefault();
      toggleAutoBattle();
      return;
    }
    if (event.key === "Shift") {
      // Shift 는 조합키다. keydown 시점에는 단독인지 조합인지 알 수 없으므로
      // 상태만 기록하고, keyup 에서 단독이었을 때만 속도를 토글한다(결함 2).
      shiftHeld = true;
      shiftCombined = false;
      return;
    }
    if (sequenceBusy) {
      // 연출 중 확인/취소는 **남은 재생을 빨리감는다**. 예전에는 입력 1회당 2초 넘게
      // 아무 것도 못 하고 기다려야 했고 스킵 수단도 없었다 — 처음엔 연출, 세 번째부터는
      // 지연이다. 배속(Shift) 토글과 달리 이건 이 시퀀스 한 번에만 걸리고 끝나면 복귀한다.
      if (isBattleConfirmKey(event) || isBattleCancelKey(event)) {
        event.preventDefault();
        beginSkip();
      }
      return;
    }
    if (shiftHeld) shiftCombined = true;
    if (isBattleCancelKey(event)) {
      event.preventDefault();
      handleCancel(snapshot);
      return;
    }
    // 방향키 + WASD. 필드는 WASD 로 걷는데 전투 커서만 방향키 전용이던 비대칭을 없앴다.
    const navDir = directionForKey(event.key);
    if (navDir) {
      const direction: 1 | -1 = navDir === "up" || navDir === "left" ? -1 : 1;
      const arrowKey = navDir === "up"
        ? "ArrowUp"
        : navDir === "down"
          ? "ArrowDown"
          : navDir === "left"
            ? "ArrowLeft"
            : "ArrowRight";
      const moved = snapshot.phase === "targetSelect" && snapshot.targetSelection?.side === "enemy"
        ? cycleTarget(snapshot, direction)
        : moveMenuCursor(snapshot, arrowKey);
      if (moved) event.preventDefault();
      return;
    }
    if (isBattleConfirmKey(event)) {
      // preventDefault 로 네이티부 활성화를 잠가 놓고 z 와 같은 커서 모델로 통일한다.
      event.preventDefault();
      handleConfirm(snapshot);
    }
  }
  const rootKeydownEvents = new WeakSet<KeyboardEvent>();
  function onRootKeydown(event: KeyboardEvent): void {
    // Confirm/cancel can synchronously replace the focused command button. Once detached,
    // root.contains(event.target) is false at window bubble time, so remember the event
    // object itself and keep the fallback from processing one physical key twice.
    rootKeydownEvents.add(event);
    onKeydown(event);
  }
  root.addEventListener("keydown", onRootKeydown);
  function onWindowKeydown(event: KeyboardEvent): void {
    if (rootKeydownEvents.has(event)) return;
    if (document.activeElement === root) return;
    if (!root.isConnected) return;
    // A handled navigation key can rebuild the command panel and detach event.target
    // before window bubbling, so prefer the event's original propagation path.
    const originatedInBattle = typeof event.composedPath === "function"
      ? event.composedPath().includes(root)
      : event.target instanceof Element && root.contains(event.target);
    if (originatedInBattle) return;
    // 텍스트 입력 중에는 전투 키를 절대 가로채지 않는다(결함 2).
    // 에디터 입력창에 포커스가 있으면 event.target 이 input/textarea/select 이거나
    // contenteditable 요소(또는 그 자손)다. 여기서 즉시 return 해 타이핑이 삼켜지지 않게 한다.
    if (isTextInputTarget(event.target)) return;
    onKeydown(event);
  }
  window.addEventListener("keydown", onWindowKeydown);
  // Shift 단독 토글: keydown 에서 조합 여부를 기록하고, keyup 에서 단독이었을 때만
  // 속도를 토글한다. Shift+A(대문자)·Shift+Z 같은 조합에서는 토글되지 않는다(결함 2).
  function onWindowKeyup(event: KeyboardEvent): void {
    if (event.key !== "Shift") return;
    if (options.runtime.snapshot().eventChoice || options.runtime.snapshot().eventPause) { shiftHeld = false; shiftCombined = false; return; }
    // 텍스트 입력 중에는 토글하지 않는다. 연출 중에는 허용한다 — 배속은 재생을
    // 보면서 조절하는 컨트롤이다(코덱스 리뷰 C6).
    if (shiftHeld && !shiftCombined && root.isConnected && !isTextInputTarget(event.target)) {
      toggleSpeed();
    }
    shiftHeld = false;
    shiftCombined = false;
  }
  window.addEventListener("keyup", onWindowKeyup);

  function menuContext(snapshot: BattleSnapshot): string {
    if (snapshot.phase === "targetSelect" && snapshot.targetSelection) {
      const command = snapshot.targetSelection.command;
      const commandId = command.kind === "skill"
        ? command.skillId
        : command.kind === "item"
          ? command.itemId
          : command.kind === "capture"
            ? command.captureItemId
            : command.kind;
      return `target:${snapshot.activeActorId ?? ""}:${command.kind}:${commandId}:${snapshot.targetSelection.side}`;
    }
    if (snapshot.phase === "actorCommand" && submenu) {
      const submenuId = submenu.kind === "skill" ? submenu.command.id : submenu.kind;
      return `submenu:${snapshot.activeActorId ?? ""}:${submenu.kind}:${submenuId}`;
    }
    return `command:${snapshot.activeActorId ?? ""}`;
  }

  function enabledMenuButtons(): HTMLButtonElement[] {
    return Array.from(commandHost.querySelectorAll<HTMLButtonElement>("button.battle-command:not(:disabled)"));
  }

  function markMenuCursor(snapshot: BattleSnapshot, preferredTestId?: string): HTMLButtonElement | undefined {
    const buttons = enabledMenuButtons();
    for (const node of root.querySelectorAll<HTMLElement>("[data-battle-command-cursor]")) {
      node.removeAttribute("data-battle-command-cursor");
      node.removeAttribute("aria-current");
      if (node instanceof HTMLButtonElement) node.tabIndex = -1;
    }
    for (const button of commandHost.querySelectorAll<HTMLButtonElement>("button.battle-command")) {
      button.removeAttribute("aria-current");
      button.tabIndex = -1;
    }
    if (buttons.length === 0) return undefined;
    const context = menuContext(snapshot);
    const selectedTargetId = snapshot.targetSelection?.selectedTargetId;
    const selectedTarget = selectedTargetId
      ? buttons.find((button) => button.dataset.battleTargetId === selectedTargetId)
      : undefined;
    const savedId = preferredTestId ?? cursorByContext.get(context);
    const selected = buttons.find((button) => button.dataset.testid === savedId)
      ?? selectedTarget
      ?? buttons[0];
    if (!selected.dataset.testid) return undefined;
    cursorByContext.set(context, selected.dataset.testid);
    selected.dataset.battleCommandCursor = "true";
    selected.setAttribute("aria-current", "true");
    selected.tabIndex = 0;
    return selected;
  }

  /** 대상 목록에서 다시 그려진 선택 행을 스크롤포트 안으로 당긴다. cycleTarget 과 대상 국면의
   *  setMenuCursor 는 syncView() 뒤 곳바로 반환해서 아래 따라가기 블록에 닿지 않는다 —
   *  6체처럼 포트(4행)를 넘는 목록에서 커서를 옮기면 선택 행이 화면 밖에 남았다(2026-09-15
   *  실측: enemy-5/6 선택 시 scrollTop 0, 행 bottom > 포트 bottom). */
  function followTargetCursor(testId?: string): void {
    const repainted = commandHost.querySelector<HTMLElement>('button.battle-command[data-testid^="battle-target-"][aria-pressed="true"]')
      ?? (testId ? commandHost.querySelector<HTMLElement>(`button.battle-command[data-testid="${testId}"]`) : null);
    repainted?.scrollIntoView({ block: "nearest" });
  }

  function setMenuCursor(snapshot: BattleSnapshot, button: HTMLButtonElement, focus: boolean): void {
    if (button.disabled || !commandHost.contains(button)) return;
    const testId = button.dataset.testid;
    if (!testId) return;
    if (cursorByContext.get(menuContext(snapshot)) !== testId) playBattleCue("command-select");
    cursorByContext.set(menuContext(snapshot), testId);
    const selected = markMenuCursor(snapshot, testId);
    const targetId = button.dataset.battleTargetId;
    if (snapshot.phase === "targetSelect" && targetId && snapshot.targetSelection?.selectedTargetId !== targetId) {
      options.runtime.setSelectedTarget(targetId);
      directorState = targetSelectDirectorState(options.runtime.snapshot());
      syncView();
      // 대상 국면은 여기서 조기 반환한다 — 아래 따라가기 블록에 지 않으므로, 다시 그려진
      // 목록에서 선택 행을 직접 스크롤포트 안으로 당긴다. 6체처럼 포트(4행)를 넘는 목록에서
      // 커서를 옮기면 선택 행이 화면 밖에 남았다(2026-09-15 실측: enemy-5/6 선택 시
      // scrollTop 0, 행 bottom > 포트 bottom).
      followTargetCursor(testId);
      return;
    }
    if (focus && selected && document.activeElement !== selected) selected.focus({ preventScroll: true });
    // 스크롤되는 서브메뉴(기술/아이템 목록)에서 커서가 화면 밖 항목으로 내려가면 따라간다.
    // 첫 항목으로 감싸 올라오면 헤더(「스킬」)까지 보이도록 맨 위로 되돌린다.
    if (selected) {
      const menu = selected.closest<HTMLElement>(".battle-command-menu");
      if (menu && enabledMenuButtons()[0] === selected) menu.scrollTop = 0;
      else selected.scrollIntoView({ block: "nearest" });
    }
  }

  /** 적 대상 국면에서 커서가 「뒤로」 행에 있는가. 대상 순환의 마지막 자리 — 화살표로 닿고
   *  확인키가 그 행을 누른다. 예전엔 이 행이 키보드 전용 런타임에서 누를 수 없는 버튼이었고,
   *  어렵게 포커스해도 Enter 가 공격을 확정했다(2026-09-14 실측). */
  let enemyTargetCursorOnCancel = false;

  function targetCancelButton(): HTMLButtonElement | null {
    return commandHost.querySelector<HTMLButtonElement>("button.battle-command[data-testid='battle-target-cancel']:not(:disabled)");
  }

  function cycleTarget(snapshot: BattleSnapshot, direction: 1 | -1): boolean {
    if (snapshot.phase !== "targetSelect" || snapshot.targetSelection?.side !== "enemy") return false;
    const ids = snapshot.targetSelection.targetIds;
    if (ids.length === 0) return false;
    const selectedId = snapshot.targetSelection.selectedTargetId ?? ids[0];
    const selectedIndex = ids.indexOf(selectedId);
    const hasCancel = Boolean(targetCancelButton());
    if (enemyTargetCursorOnCancel) {
      enemyTargetCursorOnCancel = false;
      const nextId = direction > 0 ? ids[0] : ids[ids.length - 1];
      playBattleCue("command-select");
      options.runtime.setSelectedTarget(nextId);
      directorState = targetSelectDirectorState(options.runtime.snapshot());
      syncView();
      followTargetCursor();
      return true;
    }
    const atEnd = direction > 0 ? selectedIndex === ids.length - 1 : selectedIndex <= 0;
    if (hasCancel && atEnd) {
      enemyTargetCursorOnCancel = true;
      playBattleCue("command-select");
      syncView();
      followTargetCursor();
      return true;
    }
    const baseIndex = selectedIndex >= 0 ? selectedIndex : direction > 0 ? -1 : 0;
    const nextId = ids[(baseIndex + direction + ids.length) % ids.length];
    if (nextId !== selectedId) playBattleCue("command-select");
    options.runtime.setSelectedTarget(nextId);
    directorState = targetSelectDirectorState(options.runtime.snapshot());
    syncView();
    followTargetCursor();
    return true;
  }

  /**
   * 화살표 키를 **화면 기하**에 맞춰 움직인다. 커맨드가 2열 그리드로 그려지는 스킨에서
   * ArrowDown 이 "목록상 다음"(시각적으로 오른쪽 칸)으로 가던 어긋남의 수정 지점.
   * 방향 반평면에서 보조축 어긋남에 페널티를 줘 가장 가까운 버튼을 고르고,
   * 그 방향에 아무것도 없으면 반대편 끝으로 감싼다.
   */
  function moveMenuCursor(snapshot: BattleSnapshot, key: string): boolean {
    const buttons = enabledMenuButtons();
    if (buttons.length === 0) return false;
    const current = commandHost.querySelector<HTMLButtonElement>("button.battle-command[data-battle-command-cursor='true']:not(:disabled)")
      ?? markMenuCursor(snapshot);
    if (!current) return false;
    const center = (b: HTMLElement): { x: number; y: number } => {
      const r = b.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    };
    const from = center(current);
    const axis = key === "ArrowUp" || key === "ArrowDown" ? "y" : "x";
    const sign = key === "ArrowDown" || key === "ArrowRight" ? 1 : -1;
    const pick = (candidates: HTMLButtonElement[], directionSign: number): HTMLButtonElement | undefined => {
      let best: HTMLButtonElement | undefined;
      let bestScore = Infinity;
      for (const button of candidates) {
        if (button === current) continue;
        const c = center(button);
        const primary = axis === "y" ? (c.y - from.y) * directionSign : (c.x - from.x) * directionSign;
        const secondary = axis === "y" ? Math.abs(c.x - from.x) : Math.abs(c.y - from.y);
        if (primary < 2) continue;
        const score = primary + secondary * 3;
        if (score < bestScore) {
          bestScore = score;
          best = button;
        }
      }
      return best;
    };
    // 정방향에 없으면 반대편 끝으로 랩 — 반대 방향으로 가장 먼(=primary 최대) 버튼 중
    // 보조축이 가장 맞는 것을 고른다.
    let next = pick(buttons, sign);
    if (!next) {
      let bestScore = -Infinity;
      for (const button of buttons) {
        if (button === current) continue;
        const c = center(button);
        const primary = axis === "y" ? (c.y - from.y) * -sign : (c.x - from.x) * -sign;
        const secondary = axis === "y" ? Math.abs(c.x - from.x) : Math.abs(c.y - from.y);
        if (primary < 2) continue;
        const score = primary - secondary * 3;
        if (score > bestScore) {
          bestScore = score;
          next = button;
        }
      }
    }
    // 기하 정보가 없으면(레이아웃 전·jsdom 등 rect 가 전부 0) 목록 순서로 폴백한다.
    if (!next) {
      const index = buttons.indexOf(current);
      const linearSign = key === "ArrowDown" || key === "ArrowRight" ? 1 : -1;
      next = buttons[(index + linearSign + buttons.length) % buttons.length];
      if (!next || next === current) return false;
    }
    setMenuCursor(snapshot, next, true);
    return true;
  }

  function handleConfirm(snapshot: BattleSnapshot): boolean {
    if (snapshot.phase === "targetSelect" && snapshot.targetSelection?.side === "enemy") {
      // 커서가 「뒤로」 행에 있으면(화살표 순환 또는 포커스 이동으로) 확인키는 그 행을 누른다.
      const cancel = targetCancelButton();
      const cancelHasCursor = Boolean(cancel)
        && (enemyTargetCursorOnCancel || cancel!.dataset.battleCommandCursor === "true" || document.activeElement === cancel);
      enemyTargetCursorOnCancel = false;
      if (cancel && cancelHasCursor) {
        cancel.click();
        return true;
      }
      const targetId = snapshot.targetSelection.selectedTargetId ?? snapshot.targetSelection.targetIds[0];
      if (!targetId) return false;
      confirmTargetSelection(targetId);
      return true;
    }
    const button = commandHost.querySelector<HTMLButtonElement>("button.battle-command[data-battle-command-cursor='true']:not(:disabled)")
      ?? markMenuCursor(snapshot);
    if (!button) return false;
    // 비활성 행(MP 부족·PP 없음)에도 커서는 선다 — 사유를 읽히려고 일부러 그렇게 뒀다.
    // 확인키는 거기서 아무 일도 하지 않고 거절음만 울린다. 메뉴는 열린 채로 둔다.
    if (button.dataset.battleCommandInert === "true") {
      playBattleCue("command-cancel");
      return true;
    }
    button.click();
    return true;
  }

  function handleCancel(snapshot: BattleSnapshot): void {
    enemyTargetCursorOnCancel = false;
    if (snapshot.phase === "targetSelect") {
      playBattleCue("command-cancel");
      cancelTargetSelectionAndRestore();
      return;
    }
    if (submenu !== null) {
      playBattleCue("command-cancel");
      submenu = null;
      panelOptions.submenu = null;
      syncView();
    }
  }

  function cancelTargetSelectionAndRestore(): void {
    if (options.runtime.snapshot().phase !== "targetSelect") return;
    options.runtime.cancelTargetSelection();
    submenu = targetReturnSubmenu;
    panelOptions.submenu = targetReturnSubmenu;
    targetReturnSubmenu = null;
    directorState = commandPromptState(options.runtime.snapshot());
    syncView();
  }

  function onMenuPointerOrFocus(event: Event): void {
    const button = event.target instanceof Element
      ? event.target.closest<HTMLButtonElement>("button.battle-command:not(:disabled)")
      : null;
    if (!button || !commandHost.contains(button)) return;
    setMenuCursor(options.runtime.snapshot(), button, event.type === "focusin");
  }
  commandHost.addEventListener("mouseover", onMenuPointerOrFocus);
  commandHost.addEventListener("focusin", onMenuPointerOrFocus);
  // 확정음 — 키보드(Enter→button.click())와 마우스 클릭이 같은 경로로 울린다.
  commandHost.addEventListener("click", (event) => {
    const button = event.target instanceof Element
      ? event.target.closest<HTMLButtonElement>("button.battle-command:not(:disabled)")
      : null;
    if (!button) return;
    // 비활성 행은 눌러도 확정이 아니다 — 거절음으로 갈라 준다.
    playBattleCue(button.dataset.battleCommandInert === "true" ? "command-cancel" : "command-confirm");
  });

  function syncView(): void {
    if (destroyed) return;
    const snapshot = options.runtime.snapshot();
    const showingResult = Boolean(snapshot.result) && directorState.step === "result";
    if (showingResult) {
      directorState = resultDirectorState(snapshot, directorState);
    } else if (!sequenceBusy) {
      directorState = nextDirectorState(snapshot, directorState);
      directorState = battleEventDirectorState(snapshot, directorState);
    }
    const fieldPresentation = {
      ledger: presentation,
      // 비트 재생 중에도 스냅샷의 잔류 attack/hit pose 는 걷어내고(라운드 마지막 액션
      // 기준이라 엉뚱한 배틀러가 맞은 것처럼 보인다), 지금 impact 대상에게만 hit 를 준다.
      // 시퀀스가 끝난 뒤(결과 화면 포함)에도 걷는다 — 패배 결과에서 살아남은 적이
      // attack 포즈로 박제되던 결함(적대 리뷰 3차).
      calm: !sequenceBusy || !snapshot.result,
      hitTargetId: lastDamageFeedback && !lastDamageFeedback.healing && !lastDamageFeedback.miss
        ? lastDamageFeedback.targetId
        : undefined,
    };
    syncBattleField(field, snapshot, lastDamageFeedback, fieldPresentation);
    syncBattleParty(partyPanel, snapshot, fieldPresentation);
    syncBattleMessageWindow(messageWindow, directorState);
    if (!snapshot.eventPause && !snapshot.eventChoice) eventSurfaceOpen = false;
    // The event surface takes over only after preceding action beats have drained.
    // Transparent text must not reveal the director's previous lines underneath.
    messageWindow.style.visibility = eventSurfaceOpen ? "hidden" : "";
    syncEnemyListPanel(enemyPanel, snapshot.enemies, presentation);
    rebuildCommandPanelIfNeeded(snapshot);
    syncResultHost(snapshot, showingResult);
    applyBattleDirectorState(root, directorState, snapshot);
    // 명령 국면에 들어오면 커서 버튼이 포커스를 갖는다. acting 중 host 가 display:none 이라
    // rebuild 시점의 focus() 가 실패하고, 이후 시그니처가 같아 재포커스가 없었다(실측 BODY).
    if (directorState.step === "command" && !sequenceBusy && !commandHost.contains(document.activeElement)) {
      const cursor = commandHost.querySelector<HTMLButtonElement>("button.battle-command[data-battle-command-cursor='true']:not(:disabled)");
      cursor?.focus({ preventScroll: true });
    }
    if (showingResult || !sequenceBusy) {
      // 애니메이션은 시퀀서의 onEntryAnimation 이 비트 단위로만 올린다. 시퀀스가 돌지
      // 않는 화면(명령 선택·타깃 선택·결과)에는 어떤 액션 애니메이션도 남지 않는다 —
      // 화염 스프라이트가 다음 라운드 커맨드 메뉴까지 타오르던 결함의 수정 지점.
      activeAnimation?.destroy();
      activeAnimation = undefined;
      animationLayer.replaceChildren();
    }
    root.dataset.battleSequenceBusy = sequenceBusy ? "true" : "false";
    root.dataset.battleEventPause = snapshot.eventPause?.kind ?? "";
    root.dataset.battleEventRequest = snapshot.eventPause ? String(snapshot.eventPause.id) : "";
    root.dataset.battleBgmActive = showingResult ? "false" : "true";
    checkAutoBattleStep(snapshot);
  }

  function checkAutoBattleStep(snapshot: BattleSnapshot): void {
    if (!autoBattle || sequenceBusy || snapshot.result) return;
    if (snapshot.phase === "actorCommand") {
      const command = options.runtime.chooseAutoCommand();
      if (command) runActorCommand(command);
    } else if (snapshot.phase === "targetSelect") {
      const selectedId = snapshot.targetSelection?.selectedTargetId ?? snapshot.targetSelection?.targetIds[0];
      if (selectedId) confirmTargetSelection(selectedId);
    }
  }

  function rebuildCommandPanelIfNeeded(snapshot: BattleSnapshot): void {
    if (snapshot.eventChoice || snapshot.eventPause) {
      commandHost.replaceChildren();
      commandPanelSignature = "";
      return;
    }
    const actor = snapshot.actors.find((entry) => entry.recordId === snapshot.activeActorId);
    const submenuId = submenu?.kind === "skill" ? submenu.command.id : submenu?.kind ?? "none";
    const inventorySignature = Object.entries(snapshot.eventState.inventory)
      .filter(([, count]) => count > 0)
      .map(([id, count]) => `${id}:${count}`)
      .join(",");
    const signature = [
      snapshot.phase,
      snapshot.activeActorId ?? "",
      submenuId,
      snapshot.targetSelection?.side ?? "",
      snapshot.targetSelection?.selectedTargetId ?? "",
      snapshot.targetSelection?.targetIds.join(",") ?? "",
      actor?.mp ?? "",
      actor?.maxMp ?? "",
      actor?.skillIds.join(",") ?? "",
      inventorySignature,
      snapshot.forcedSwitchActorId ?? "",
      snapshot.switchCandidateActorIds.join(","),
      snapshot.strictPendingActorIds.join(","),
      snapshot.strictQueuedActorIds.join(","),
    ].join(":");
    const enemyTargeting = snapshot.phase === "targetSelect" && snapshot.targetSelection?.side === "enemy";
    if (!enemyTargeting) enemyTargetCursorOnCancel = false;
    if (signature === commandPanelSignature && commandHost.childElementCount > 0) {
      if (enemyTargeting) syncEnemyTargetCursor(snapshot);
      else markMenuCursor(snapshot);
      return;
    }

    commandPanelSignature = signature;
    commandHost.replaceChildren(commandPanel(snapshot, panelOptions));
    if (enemyTargeting) {
      syncEnemyTargetCursor(snapshot);
      return;
    }
    const selected = markMenuCursor(snapshot);
    if (selected && document.activeElement !== selected) selected.focus({ preventScroll: true });
  }

  /** 적 대상 국면의 커서: 「뒤로」 행이 커서를 갖고 있으면 그 행, 아니면 필드의 선택 적. */
  function syncEnemyTargetCursor(snapshot: BattleSnapshot): void {
    if (!enemyTargetCursorOnCancel) {
      syncFieldTargetCursor(snapshot, true);
      return;
    }
    for (const node of root.querySelectorAll<HTMLElement>("[data-battle-command-cursor]")) {
      node.removeAttribute("data-battle-command-cursor");
      node.removeAttribute("aria-current");
      if (node instanceof HTMLButtonElement) node.tabIndex = -1;
    }
    const cancel = targetCancelButton();
    if (!cancel) {
      enemyTargetCursorOnCancel = false;
      syncFieldTargetCursor(snapshot, true);
      return;
    }
    cancel.dataset.battleCommandCursor = "true";
    cancel.setAttribute("aria-current", "true");
    cancel.tabIndex = 0;
    root.dataset.battleTargetCursor = "cancel";
    if (document.activeElement !== cancel) cancel.focus({ preventScroll: true });
  }

  function syncFieldTargetCursor(snapshot: BattleSnapshot, focus: boolean): HTMLButtonElement | undefined {
    delete root.dataset.battleTargetCursor;
    for (const node of root.querySelectorAll<HTMLElement>("[data-battle-command-cursor]")) {
      node.removeAttribute("data-battle-command-cursor");
      node.removeAttribute("aria-current");
      if (node instanceof HTMLButtonElement) node.tabIndex = -1;
    }
    if (snapshot.phase !== "targetSelect" || snapshot.targetSelection?.side !== "enemy") return undefined;
    const selectedId = snapshot.targetSelection.selectedTargetId ?? snapshot.targetSelection.targetIds[0];
    if (!selectedId) return undefined;
    const target = field.querySelector<HTMLButtonElement>(
      `.battle-enemy[data-battle-target-id="${CSS.escape(selectedId)}"]`,
    );
    if (!target) return undefined;
    target.dataset.battleCommandCursor = "true";
    target.setAttribute("aria-current", "true");
    target.tabIndex = 0;
    if (focus && document.activeElement !== target) target.focus({ preventScroll: true });
    return target;
  }

  /** 결과 카드에 아직 공개되지 않은 보상 행이 있으면 전부 공개하고 true. 없으면 false. */
  function revealAllResultRows(snapshot: BattleSnapshot): boolean {
    const panel = resultHost.querySelector<HTMLElement>("[data-testid='battle-result-panel']");
    if (!panel || !panel.querySelector("[data-revealed='false']")) return false;
    resultRevealStage = battleResultRewardRowCount(snapshot) + 1;
    syncBattleResultPanel(panel, snapshot, resultRevealStage);
    return true;
  }

  function syncResultHost(snapshot: BattleSnapshot, showResult: boolean): void {
    if (!showResult) {
      resultHost.replaceChildren();
      return;
    }
    // 결과 화면 동안은 뒤늦게 뜬 데미지 팝업 잔상을 매 동기화마다 걷어낸다.
    for (const popup of root.querySelectorAll(".battle-damage-popup")) popup.remove();
    // 애니메이션 레이어 정리는 syncView 의 생성 지점에서 함께 처리한다(중복 방지).
    let panel = resultHost.querySelector<HTMLElement>("[data-testid='battle-result-panel']");
    if (!panel) {
      const created = battleResultPanel(snapshot, resultRevealStage);
      if (!created) return;
      resultHost.replaceChildren(created);
      panel = created;
      // 키보드 전용 런타임 — 확인 버튼이 포커스를 받아야 :focus-visible 링과 보조기술 안내가 산다.
      created.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
      // 뒤늦게 살아있는 데미지 팝업이 결과 화면 위로 새지 않도록 정리하고, 결과 연출을 1회 발화.
      for (const popup of root.querySelectorAll(".battle-damage-popup")) popup.remove();
      // 결과 팡파레도 사건 1개 = 소리 1개. emitBattleJuice 가 큐를 울리므로
      // 여기서 합성 보이스를 겹쳐 부르지 않는다(예전 결함).
      emitBattleJuice(snapshot.result === "victory" ? "victory" : snapshot.result === "defeat" ? "defeat" : "escape", root);
      flashBattleField(root, snapshot.result === "victory" ? "victory" : "defeat");
    }
    syncBattleResultPanel(panel, snapshot, resultRevealStage);
  }


  function commandProgressed(before: BattleSnapshot, after: BattleSnapshot): boolean {
    return after.timeline.length !== before.timeline.length
      || after.phase !== before.phase
      || after.activeActorId !== before.activeActorId
      || after.turn !== before.turn
      || after.result !== before.result
      || after.strictQueuedActorIds.join(",") !== before.strictQueuedActorIds.join(",");
  }

  function runActorCommand(command: ActorCommand): void {
    if (sequenceBusy) return;
    const before = options.runtime.snapshot();
    options.runtime.performActorCommand(command);
    const afterCommand = options.runtime.snapshot();
    if (!commandProgressed(before, afterCommand)) {
      syncView();
      return;
    }
    emitSwingJuice(command, before);
    submenu = null;
    targetReturnSubmenu = null;
    panelOptions.submenu = null;
    presentation = createPresentationLedger(before);
    sequencer.runAfterActorCommand(command, before, afterCommand);
  }

  function emitSwingJuice(command: ActorCommand | TargetedActorCommand, snapshot: BattleSnapshot): void {
    const actorNode = snapshot.activeActorId
      ? findBattlerNode(field, snapshot.activeActorId)
      : null;
    if (command.kind === "attack" || command.kind === "skill") {
      emitBattleJuice("attack-swing", actorNode ?? undefined);
    } else if (command.kind === "defend") {
      emitBattleJuice("defend", actorNode ?? undefined);
    }
    // escape 는 결과가 화면에 도달할 때 시퀀서 훅(onEscapeOutcome)이 울린다.
  }

  function beginTargetCommand(command: TargetedActorCommand): void {
    if (sequenceBusy) return;
    const before = options.runtime.snapshot();
    const returnSubmenu = submenu;
    options.runtime.beginActorCommand(command);
    const afterCommand = options.runtime.snapshot();
    if (afterCommand.phase === "targetSelect") {
      targetReturnSubmenu = returnSubmenu;
      directorState = targetSelectDirectorState(afterCommand);
      submenu = null;
      panelOptions.submenu = null;
      syncView();
      return;
    }
    if (!commandProgressed(before, afterCommand)) {
      syncView();
      return;
    }

    // self/all* scopes resolve without opening targetSelect. Build the additive
    // compatibility command only for presentation; the runtime already applied it.
    const scope = targetScopeForCommand(store.getCurrent(), command);
    const side: "actor" | "enemy" = scope === "self" || scope === "ally" || scope === "allAllies" ? "actor" : "enemy";
    const firstTimelineTarget = afterCommand.timeline.slice(before.timeline.length).find((entry) => entry.targetId)?.targetId;
    const fallbackTarget = side === "actor"
      ? before.actors.find((actor) => actor.recordId === before.activeActorId)?.id
      : before.enemies.find((enemy) => !enemy.defeated)?.id;
    const targetId = firstTimelineTarget ?? fallbackTarget;
    if (!targetId) {
      syncView();
      return;
    }
    const concrete = concreteTargetCommand(command, targetId, side);
    emitSwingJuice(concrete, before);
    submenu = null;
    targetReturnSubmenu = null;
    panelOptions.submenu = null;
    presentation = createPresentationLedger(before);
    sequencer.runAfterActorCommand(concrete, before, afterCommand);
  }

  function confirmTargetSelection(targetId: string): void {
    if (sequenceBusy) return;
    const before = options.runtime.snapshot();
    const pending = before.targetSelection?.command;
    const side = before.targetSelection?.side;
    if (before.phase !== "targetSelect" || !pending || !side) return;
    const command = concreteTargetCommand(pending, targetId, side);
    options.runtime.selectTarget(targetId);
    const afterCommand = options.runtime.snapshot();
    if (afterCommand.phase === "targetSelect") {
      directorState = targetSelectDirectorState(afterCommand);
      syncView();
      return;
    }
    if (!commandProgressed(before, afterCommand)) {
      syncView();
      return;
    }
    emitSwingJuice(command, before);
    submenu = null;
    targetReturnSubmenu = null;
    panelOptions.submenu = null;
    presentation = createPresentationLedger(before);
    // 여기서 syncView 를 부르면 busy=false 상태에서 result 가 이미 서 있어 디렉터가 result 로
    // 찍히고 필드가 잠깐 전체화면이 된다 — 그 프레임에 이펙트 앵커가 재어져 막타 이펙트가
    // 138px 아래에 고정됐다(2026-09-14 실측). 첫 비트가 곧바로 동기화하므로 생략한다.
    sequencer.runAfterActorCommand(command, before, afterCommand);
  }

  function nextDirectorState(
    snapshot: BattleSnapshot,
    previous: BattleDirectorState
  ): BattleDirectorState {
    if (snapshot.result) return resultDirectorState(snapshot, previous);
    if (snapshot.phase === "targetSelect") return targetSelectDirectorState(snapshot);
    if (snapshot.phase === "actorCommand" && shouldRefreshCommandPrompt(snapshot, previous)) {
      return commandPromptState(snapshot);
    }
    if (snapshot.phase === "charging" && previous.step === "command") {
      return chargingDirectorState(snapshot);
    }
    return previous;
  }

  function shouldRefreshCommandPrompt(snapshot: BattleSnapshot, previous: BattleDirectorState): boolean {
    return previous.step === "command" || previous.activeActorRecordId !== snapshot.activeActorId;
  }

  syncView();
  if (options.introHold !== false) {
    sequencer.startIntro(initialSnapshot);
  }

  const tickInterval = window.setInterval(() => {
    if (sequenceBusy) return;
    const before = options.runtime.snapshot();
    if (before.result) return;
    if (before.phase !== "charging") {
      if (before.phase === "actorCommand") syncView();
      return;
    }
    options.runtime.tick(BATTLE_TICK_MS);
    const after = options.runtime.snapshot();
    const timelineKey = `${before.timeline.length}:${after.timeline.length}`;
    if ((after.timeline.length > before.timeline.length && timelineKey !== lastEnemyActionKey) || after.eventChoice || after.eventPause || after.result) {
      lastEnemyActionKey = timelineKey;
      presentation = createPresentationLedger(before);
      sequencer.runAfterEnemyAdvance(before, after);
      return;
    }
    syncView();
  }, BATTLE_TICK_MS);

  const controller: BattleDomController = {
    root,
    destroy(): void {
      // 멱등 — 여러 경로(onResult, teardown, 재마운트)에서 중복 호출돼도 안전해야 한다.
      if (destroyed) return;
      destroyed = true;
      clearBattleTimerScope();
      choiceController?.abort();
      options.runtime.cancel();
      window.clearInterval(tickInterval);
      window.removeEventListener("keydown", onWindowKeydown);
      window.removeEventListener("keyup", onWindowKeyup);
      sequencer.cancel();
      activeAnimation?.destroy();
      stageScale.cleanup();
      root.remove();
      if (activeBattleControllers.get(options.host) === controller) activeBattleControllers.delete(options.host);
      options.onDestroy?.();
    },
  };
  activeBattleControllers.set(options.host, controller);
  if (options.introHold === false && (initialSnapshot.eventChoice || initialSnapshot.eventPause || initialSnapshot.result)) {
    sequencer.runAfterEnemyAdvance(initialSnapshot, initialSnapshot);
  }
  return controller;
}
