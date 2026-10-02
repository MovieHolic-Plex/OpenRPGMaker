import { cssMixBlendMode, isBlendModeName } from "@/project/blendMode";
import { remainingEnemyCollapseMs } from "@/player/battleEnemyCollapse";
import { battleEntrySkillRecord, hasRetroChoreography, retroClassSkillBeatMs, retroClassSkillWeight, hasRetroSkillContract, retroSkillForEntry, retroSkillRecipe, startRetroSpecialSkill } from "@/player/retroSkillChoreography";
import type { BattleActionWeight } from "@/player/battleActionBeats";
import { retroTimelineEntry, retroCommandPose, initRetroMotion, isTravellingEffect, preloadRetroMotionSe, repaintRetroBattler, retroActionMotion, retroDamage, retroEnemyReach, retroHitRelease, retroVictory, retroWalk } from "@/player/battleRetroMotion";
import type { BattleTimelineEntrySnapshot } from "@/battle/types";
import type {
  ActorCommand,
  BattleResult,
  BattleRuntime,
  BattleSnapshot,
  TargetedActorCommand,
} from "@/battle/runtime";
import { mountOnFieldBackdrop, type OnFieldAnchors } from "@/player/battleOnField";
import { concreteTargetCommand } from "@/battle/runtime";
import { BATTLE_START_FORMATION_BANNERS } from "@/battle/battleFormation";
import { createInputSequenceTracker, inputKeyLabel, type SkillInputResult } from "@/battle/battleInputSequence";
import type { SkillInputKey, SkillInputSequence } from "@/project/types";
import { waitForEventKey } from "@/player/eventInput";
import type { BattleEventChoiceSnapshot, BattleEventPauseSnapshot } from "@/battle/types";
import { targetScopeForCommand } from "@/battle/battleTargetResolver";
import type { BattleAnimationPlayback } from "@/player/battleAnimationDom";
import { battleAnimationImpactMs, battleAnimationLeadPlan, preloadAllBattleAnimationSounds, preloadBattleAnimationSounds, syncBattleAnimationLayer } from "@/player/battleAnimationDom";
import { createPresentationLedger, type BattlePresentationLedger } from "@/player/battlePresentation";
import { commandPanel, enemyListPanel, syncEnemyListPanel, type BattleCommandSubmenu } from "@/player/battleCommandDom";
import {
  advanceBattleResultLevelUps,
  applyBattleDirectorState,
  battleMessageWindow,
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
import { applyActionMotion, applyFieldBackdrop, battleField, battlePartyStatus, blinkBattlerNode, findBattlerNode, playCaptureCinematic, spawnHitSparks, syncBattleField, syncBattleParty, syncSceneBackdropVar } from "@/player/battleFieldDom";
import { emitBattleJuice as emitContextBattleJuice, fadeBattleCue, flashBattleField, playBattleCue as playContextBattleCue, preloadBattleJuiceSamples, type BattleAudioContext, type BattleCueShape, type BattleJuiceEvent } from "@/player/battleJuice";
import { ensureBattleFlashFilter } from "@/player/battleFlashFilter";
import { applyHitIntensity, battlerMaxHp } from "@/player/battleHitIntensityDom";
import { hitIntensity } from "@/player/battleHitIntensity";
import { SWING_LEAD_MS, hurtShakeIntensity, spawnSlashTrail, vibrateStruck } from "@/player/battleHitFeelDom";
import { resolveBattleHitFeel } from "@/project/battleHitFeel";
import { resolveBattleLook } from "@/project/battleLook";
import { applyBattleLook, syncBattleTurnOrder } from "@/player/battleLookDom";
import { battlerSpriteNode } from "@/player/battleFieldDom";
import { playBattleImpactLayer, playBattleSfx } from "@/player/battleSfx";
import { pokemonActionMotion, pokemonDamageBlink, pokemonHitPower, pokemonHudBuzz, preloadPokemonMotionSounds, type PokemonMoveContext } from "@/player/battlePokemonMotion";
import { pokemonMoveColor, pokemonMoveMotion, pokemonStrikeFromBelow } from "@/battle/pokemonMoveMotion";
import { AUTO_BATTLE_KEY_LABEL, SPEED_KEY_LABEL, directionForKey, isAutoBattleKey, isCancelKey, isConfirmKey } from "@/player/keyBindings";
import { unlockBattleSfx } from "@/player/battleSfx";
import {
  createBattleSequencer,
  type DamageFeedback,
} from "@/player/battleSequencer";
import { openBattleTimerScope, clearBattleTimerScope, scheduleBattleTimer } from "@/player/battleTimerScope";
import { applyBattleSystemGraphic } from "@/player/systemGraphics";
import { store } from "@/project/store";
import { bindBattleStageScale } from "@/player/battleStageScale";
import { applyRollingHpSurvival, createRollingHpMeter, startRollingHpTicker } from "@/player/rollingHp";
import { syncBattleScreenFilter } from "@/player/battleScreenFilter";

/** 포켓몬 스킨의 동작 템포(배율). 05-poses-motion.css·20-pokemon-skin.css 의 포켓몬 전환 길이도 이 배율로 줄여 두었다. */
export const POKEMON_MOTION_TEMPO = 1.5;

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
  /** system.battleBackdrop === "field" 일 때 필드 화면 스냅샷(dataURL). 없으면 트룹/지형 배경. */
  readonly fieldBackdropUrl?: string;
  /** system.battlePresentation === "onField": 배틀러를 필드 스프라이트 자리에 세우고 스냅샷을 캔버스와 1:1 로 깐다. */
  readonly onField?: OnFieldAnchors;
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
/** 포켓몬 피해 박자 뒤 다음 행동까지의 여유 */
const POKEMON_DAMAGE_TAIL_MS = 90;
/** 결과 문장을 읽는 박자(3세대 waitmessage 64프레임의 약 2/3) — 문장이 HP 가 다 준 **뒤**에 나오므로 그만큼 머문다. */
const POKEMON_RESULT_READ_FRAMES = 40;
/** 상성별 타격음 모양 — 3세대 SE_KOUKA_L/M/H 를 같은 타격 샘플의 크기·높이로 옮겼다. */
const POKEMON_EFFECTIVENESS_SHAPE: Readonly<Record<"weak" | "normal" | "super", BattleCueShape>> = {
  weak: { volume: 0.6, rate: 1.22 },
  normal: { volume: 1, rate: 1 },
  super: { volume: 1.3, rate: 0.88 },
};

export function destroyBattleSceneOnHost(host: HTMLElement): void {
  activeBattleControllers.get(host)?.destroy();
  activeBattleControllers.delete(host);
}

export function mountBattleScene(options: BattleDomOptions): BattleDomController {
  // 블라인드 전환 동안 기본 SE 세트를 디코딩해 둔다 — 첫 임팩트부터 소리가 정시에 온다.
  preloadBattleJuiceSamples();
  // 기술 이펙트의 타이밍 소리도 — 행동 시작 때(preloadBattleAnimationSounds) 받으면 3배속에서는 approach 가 60~110ms 라
  // 디코딩이 끝나기 전에 착탄이 와서 요소 재생(0.2~0.4초 늦음)으로 떨어졌다.
  preloadAllBattleAnimationSounds();
  const playBattleCue = (event: BattleJuiceEvent): void => playContextBattleCue(event, options.audioContext);
  const emitBattleJuice = (event: BattleJuiceEvent, target?: HTMLElement | null, shape?: BattleCueShape): void =>
    emitContextBattleJuice(event, target, options.audioContext, shape);
  // 같은 host에 이전 컨트롤러가 살아있으면 먼저 정리한다.
  // DOM만 지우면 setInterval/window keydown/ResizeObserver가 중복으로 남는다(결함 1a).
  activeBattleControllers.get(options.host)?.destroy();
  activeBattleControllers.delete(options.host);
  options.host.querySelector("[data-testid='battle-stage']")?.remove();
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
  const retroMotion = skin.motionStyle === "retro";
  // 포켓몬 스킨의 동작 템포 — 돌진·넉백·이펙트를 1.5배 빠르게 돈다(사용자 요청 2026-10-02). 히트스톱·대사는 그대로.
  const motionTempo = root.dataset.battleUiStyle === "pokemon" ? POKEMON_MOTION_TEMPO : 1;
  if (motionTempo !== 1) root.dataset.battleMotionTempo = String(motionTempo);
  // 포켓몬 스킨은 돌진·착탄·넉백을 그림 단위 안무(battlePokemonMotion)로 그린다.
  const pokemonMotion = root.dataset.battleUiStyle === "pokemon" && !retroMotion;
  // 포켓몬 안무의 이펙트 재생 계획 — animationImpactMs 가 정하고 onEntryAnimation 이 씬 루트에 건너뛸 프레임 수로 넘긴다.
  let animationPlan: { animationId: string; skipFrames: number; skippedMs: number } | undefined;
  if (pokemonMotion) preloadPokemonMotionSounds();
  // 지금 재생 중인 타임라인 엔트리의 기술 움직임 종류(접촉·발사체·…). onTimelineEntry 가 비트보다 먼저 온다.
  let pokemonMove: PokemonMoveContext = { motion: "contact", color: "#ffffff", fromBelow: false };
  if (retroMotion) root.dataset.battleMotion = "retro";
  // 창 크롬 묶음 — `_rm2000.css` 의 유리 HUD 는 이 속성으로 스코프해 정면(rm2000)·측면(rm2003) 이 나눠 쓴다.
  root.dataset.battleSkinFamily = battleSkinFamily(skinId);
  root.dataset.battleTransition = skin.transition;
  root.dataset.battleHud = skin.hudTemplate;
  root.dataset.battleLayout = skin.layout;
  // Active ATB(system.atbMode) — gauge 흐름에서만 켜진다. CSS·QA 가 이 속성으로 구분한다.
  const activeAtb = store.getCurrent().system.atbMode === "active" && options.runtime.snapshot().battleFlow === "gauge";
  root.dataset.battleAtbMode = activeAtb ? "active" : "wait";
  // 타격감 프리셋(project/battleHitFeel.ts). `data-battle-hit-feel` 은 히트스톱 중 여부(true/false)로 이미 쓰이므로
  // 이름을 나눈다 — QA 스펙 셋이 그 값을 읽는다. CSS(22-hit-feel.css)가 이 속성으로 갈라진다.
  const hitFeel = resolveBattleHitFeel(store.getCurrent().system.battleHitFeel);
  root.dataset.battleHitFeelPreset = hitFeel;
  // 대상 플래시가 실루엣만 물들이도록 SVG 필터 정의를 루트에 심는다(05-poses-motion.css 가 url(#…) 로 참조).
  ensureBattleFlashFilter(root);
  for (const [key, value] of Object.entries(skin.themeVars)) {
    root.style.setProperty(key, value as string);
  }
  applyBattleSystemGraphic(root);
  const stage = document.createElement("div");
  stage.className = "battle-stage";
  stage.dataset.testid = "battle-stage";
  stage.append(root);
  options.host.append(stage);
  // Fit the 640×480 UI inside an opaque, host-sized battle surface.
  const stageScale = bindBattleStageScale(options.host, root);
  // 전투가 소유한 지연 콜백의 스코프를 연다 — teardown 이 남은 것을 한 번에 끊는다.
  openBattleTimerScope();

  const initialSnapshot = options.runtime.snapshot();
  let destroyed = false;
  /** 포켓몬 피해 박자: 대상별로 돌고 있는 박자의 마무리(숫자 끝값·HP 지연 해제·쓰러짐 보류 해제).
   *  같은 대상의 다음 피드백과 배속 전환이 먼저 부른다(finishPokemonPhase). setSpeed 가 마운트 중에도 불리므로 위에 둔다. */
  const pokemonPhaseFinishers = new Map<string, () => void>();
  /** impact · 평타 확정 뒤 처음 오는 접근 비트에 베기 궤적과 휘두름 소리를 한 번 둔다. */
  let swingArmed = false;
  // 방금 확정한 직업 스킬(훔치기 등 special 결과만 남는 기술의 연출 시작점).
  let pendingRetroSkillId: string | undefined;
  let pendingRetroSkillUserId: string | undefined;
  let choiceController: AbortController | undefined;
  let resultSent = false;
  let submenu: BattleCommandSubmenu = null;
  let targetReturnSubmenu: BattleCommandSubmenu = null;
  let directorState: BattleDirectorState = commandPromptState(initialSnapshot);
  let resultRevealStage = 0;
  let finaleCelebrated: BattleSnapshot["result"] | undefined;
  let sequenceBusy = false;
  /** 시퀀서가 재생을 시작한 마지막 타임라인 엔트리. 이보다 뒤의 상태 변화는 아직 화면에 오지 않았다. */
  let playedTimelineSequence = -1;
  /** 입력 커맨드 기술의 프롬프트. 열려 있는 동안 키 입력은 이 판정기로만 간다. */
  let inputPrompt: { press(key: SkillInputKey): void } | undefined;
  let eventSurfaceOpen = false;
  let lastDamageFeedback: DamageFeedback | undefined;
  /** 지금 걸려 있는 히트스톱의 타격. 정지가 풀리는 순간 이 대상을 깜빡인다. */
  let hitStopFeedback: DamageFeedback | undefined;
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
  // 롤링 HP(system.battleRollingHp): 아군 HP 표시가 미터처럼 굴러간다. 규칙 엔진은 건드리지 않고,
  // 결과 확정 때 applyRollingHpSurvival 이 미터에 남은 HP 로 결산한다.
  const rollingHpSystem = store.getCurrent().system;
  const rollingHp = rollingHpSystem.battleRollingHp === true
    ? createRollingHpMeter({ perSecond: rollingHpSystem.battleRollingHpPerSecond })
    : undefined;
  if (rollingHp) root.dataset.battleRollingHp = "true";
  let lastFieldPresentation: Parameters<typeof syncBattleParty>[2];
  const rollingHpTicker = rollingHp
    ? startRollingHpTicker(rollingHp, () => {
      if (destroyed) return;
      const snapshot = options.runtime.snapshot();
      syncBattleField(field, snapshot, undefined, lastFieldPresentation);
      syncBattleParty(partyPanel, snapshot, lastFieldPresentation);
    })
    : undefined;
  const animationLayer = document.createElement("div");
  animationLayer.className = "battle-animation-layer";
  animationLayer.dataset.testid = "battle-animation-layer";
  // 이펙트 겹치기(BattleAnimationRecord.blendMode): 이펙트 노드는 이 층 안에서만 섞인다 — 층이 z-index 로 자기
  // 스태킹 컨텍스트라 노드에만 걸면 투명한 층과 섞여 아무 일도 없다(2026-10-02 실측). 섞는 이펙트가 들어 있는 동안
  // 층 자체에 같은 방식을 걸어 필드(배경·배틀러)와 섞는다. 대가: 그동안 같은 층의 다른 이펙트도 같이 섞인다(드묾).
  const animationBlendObserver = new MutationObserver(() => {
    const blended = animationLayer.querySelector<HTMLElement>(":scope > .battle-animation[data-blend]")?.dataset.blend;
    animationLayer.style.mixBlendMode = isBlendModeName(blended) ? cssMixBlendMode(blended) : "";
    if (isBlendModeName(blended)) animationLayer.dataset.blend = blended;
    else delete animationLayer.dataset.blend;
  });
  animationBlendObserver.observe(animationLayer, { childList: true });
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

  // Keyboard controls stay keyboard-only. This is a status line, not a button bar.
  const playbackStatus = document.createElement("div");
  playbackStatus.className = "battle-playback-status";
  playbackStatus.dataset.testid = "battle-playback-status";
  playbackStatus.setAttribute("role", "status");
  playbackStatus.setAttribute("aria-live", "polite");
  playbackStatus.setAttribute("aria-atomic", "true");
  root.append(field, animationLayer, messageWindow, enemyPanel, commandHost, partyPanel, resultHost, playbackStatus);
  // 전투 화면 꾸미기(project/battleLook.ts) — 도트 측면 전투에만. 칸 값은 루트 data·CSS 변수, 연출 겹은 필드 안.
  const battleLook = retroMotion ? resolveBattleLook(store.getCurrent().system.battleLook) : undefined;
  if (battleLook) applyBattleLook(root, field, battleLook);
  if (retroMotion) {
    initRetroMotion(field, initialSnapshot);
    preloadRetroMotionSe();
  }
  syncPlaybackStatus();
  // 씬이 붙으면 포커스를 씬 안으로 가져온다 — 없으면 인트로·명령 국면 내내 activeElement 가
  // BODY 라 보조기술 컨텍스트가 필드에 남고 씬 스코프 포커스 링이 절대 보이지 않는다.
  queueMicrotask(() => {
    if (root.isConnected && !root.contains(document.activeElement)) root.focus({ preventScroll: true });
  });
  // 필드가 루트에 붙은 뒤에만 배경 변수를 비출 수 있다(battleField 생성 시점에는 부모가 없다).
  syncSceneBackdropVar(field);
  if (options.fieldBackdropUrl) {
    applyFieldBackdrop(field, options.fieldBackdropUrl, initialSnapshot.backdropResourceId);
    root.dataset.battleBackdropKind = "field";
  }
  if (options.onField) {
    root.dataset.battlePresentation = "onField";
    // 스테이지 전체에 스냅샷을 캔버스 사각형 그대로 깐다 — 필드 배경(cover)은 전장 박스에 맞춰 잘리므로
    // 필드 위 전투에서는 전장 배경을 비우고 스테이지 뒤판이 캔버스와 같은 자리에 그린다.
    if (options.fieldBackdropUrl) mountOnFieldBackdrop(stage, options.onField.canvas, options.fieldBackdropUrl);
  }

  // 개시 진형 배너: 첫 인트로 메시지에 한 줄만 덧붙인다(보통 개시는 그대로).
  let formationBannerShown = false;
  function withFormationBanner(state: typeof directorState): typeof directorState {
    if (formationBannerShown || state.step !== "intro") return state;
    formationBannerShown = true;
    const formation = initialSnapshot.formation;
    if (!formation || formation === "normal") return state;
    root.dataset.battleFormation = formation;
    return { ...state, lines: [...state.lines, BATTLE_START_FORMATION_BANNERS[formation]] };
  }

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
    finishAllPokemonPhases();
    speedMultiplier = spd;
    if (!skipping) sequencer.speedMultiplier = spd;
    root.dataset.battleSpeed = (skipping ? SKIP_SPEED : spd).toFixed(1);
    syncPlaybackStatus();
  }

  function syncPlaybackStatus(): void {
    const text = `${AUTO_BATTLE_KEY_LABEL} 자동 ${autoBattle ? "켜짐" : "꺼짐"} · ${SPEED_KEY_LABEL} ${speedMultiplier}×${skipping ? " · 넘기는 중" : ""}`;
    if (playbackStatus.textContent !== text) playbackStatus.textContent = text;
  }

  /** 이 시퀀스 한 번만 빨리감기. onSequenceBusy(false) 에서 원래 배속으로 되돌린다. */
  function beginSkip(): void {
    if (skipping) return;
    finishAllPokemonPhases();
    skipping = true;
    sequencer.speedMultiplier = SKIP_SPEED;
    // 이펙트 프레임 간격(battleAnimationFrameMs)은 이 속성만 읽는다 — 안 갱신하면 스킵 중
    // 대사·모션은 5배속인데 이펙트만 원속도로 남아 다음 행동 위에 겹쳤다.
    root.dataset.battleSpeed = SKIP_SPEED.toFixed(1);
    root.dataset.battleSkipping = "true";
    syncPlaybackStatus();
  }

  function endSkip(): void {
    if (!skipping) return;
    skipping = false;
    sequencer.speedMultiplier = speedMultiplier;
    root.dataset.battleSpeed = speedMultiplier.toFixed(1);
    root.dataset.battleSkipping = "false";
    syncPlaybackStatus();
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
      directorState = withFormationBanner(state);
    },
    onTimelineEntry(entry) {
      playedTimelineSequence = Math.max(playedTimelineSequence, entry.sequence);
      if (pokemonMotion) {
        const skill = entry.skillId || entry.skillName ? battleEntrySkillRecord(entry) : undefined;
        pokemonMove = { motion: pokemonMoveMotion(skill), color: pokemonMoveColor(skill), fromBelow: pokemonStrikeFromBelow(skill), actionId: entry.actionId };
        // QA·스타일 훅: 지금 엔트리의 움직임 종류
        root.dataset.battleMoveMotion = pokemonMove.motion;
        // 이펙트는 착탄 순간에 마운트된다 — 그때 디코딩하면 첫 효과음이 늦는다. 행동이 시작될 때 미리.
        preloadBattleAnimationSounds(entry.animation?.animationId);
      }
      if (retroMotion) retroTimelineEntry(field, entry);
      // 훔치기처럼 결과가 특수 메시지 한 줄뿐인 직업 스킬은 시각 비트가 없다 — 그 메시지에서 연출을 시작한다.
      if (retroMotion && entry.kind === "special") {
        const pending = entry.side === "actor" && entry.userRecordId === pendingRetroSkillUserId ? pendingRetroSkillId : undefined;
        const skillId = entry.skillId ?? pending;
        if (pending) pendingRetroSkillId = undefined;
        if (skillId) startRetroSpecialSkill(field, entry, skillId, sequencer.speedMultiplier, repaintRetroBattler);
      }
      // 연출이 화면에 도달한 반격·부활의 흔적 — QA 와 스킨 CSS 가 읽는다.
      if (entry.kind === "counter") root.dataset.battleCounterSeen = "true";
      if (entry.kind === "revive") root.dataset.battleReviveSeen = "true";
    },
    onSyncView() {
      syncView();
    },
    onEntryAnimation(animation) {
      // 엔트리 단위 애니메이션 — 잔류하는 snapshot.lastAnimation 대신, 지금 재생 중인
      // 액션의 애니메이션만 레이어에 올린다. animation 이 없으면 레이어를 비운다.
      activeAnimation?.destroy();
      const skipFrames = animation && animationPlan?.animationId === animation.animationId ? animationPlan.skipFrames : 0;
      if (skipFrames > 0) root.dataset.battleAnimationSkipFrames = String(skipFrames);
      else delete root.dataset.battleAnimationSkipFrames;
      activeAnimation = syncBattleAnimationLayer(
        animationLayer,
        { ...options.runtime.snapshot(), lastAnimation: retroMotion && (hasRetroChoreography(field) || isTravellingEffect(animation)) ? undefined : animation },
        root,
      );
    },
    onDamageFeedback(feedback) {
      lastDamageFeedback = feedback;
      // 상태 이름 팝업(label)은 표시 전용 — 타격 세기·효과음·플래시를 건드리지 않는다. 단 HP 를 실은 label
      // (선고로 쓰러지는 upkeep: 숫자 대신 상태 이름)은 원장에 반영해야 쓰러진 적이 다시 서 있지 않는다.
      if (feedback?.label) {
        if (feedback.amount > 0) presentation?.applyFeedback(feedback);
        return;
      }
      if (feedback) {
        const vitalsBefore = presentation?.vitalsFor(feedback.targetId);
        const wasAlive = !vitalsBefore?.defeated;
        // 원장 객체는 applyFeedback 이 제자리에서 고친다 — 맞기 전 HP 는 지금 떠 둔다.
        const hpBefore = vitalsBefore?.hp;
        presentation?.applyFeedback(feedback);
        // 파티 몬스터는 런타임 id(mon:…)로 맞는다 — 직접 조회하면 null 이라 내 몬스터가 맞을 때 깜빡임·넉백이 빠졌다(2026-10-02 실측).
        const targetNode = findBattlerNode(field, feedback.targetId);
        // 같은 대상의 앞 피해 박자가 아직 돌면(배속 전환·연속 타격·회복) 먼저 끝낸다 — 숫자 세기·HP 지연·쓰러짐 보류가 겹치지 않게.
        finishPokemonPhase(feedback.targetId);
        // 타격 세기 — 대상 최대 HP 대비 피해 비율(+급소·막타)로 넉백·찌그러짐·무대 펀치·흔들림을 차등한다.
        const lethal = wasAlive && Boolean(presentation?.vitalsFor(feedback.targetId)?.defeated);
        const maxHp = vitalsBefore?.maxHp ?? battlerMaxHp(options.runtime.snapshot(), feedback.targetId);
        const intensity = hitIntensity(feedback, maxHp, lethal);
        applyHitIntensity(root, targetNode, intensity);
        if (retroMotion) retroDamage(targetNode, feedback, lethal);
        // 포켓몬 스킨의 피해는 기술 연출(착탄 떨림·별) 뒤에 따로 온다(3세대 순서) — 아래 일반 경로를 타지 않는다.
        if (usesPokemonDamagePhase(feedback)) {
          playPokemonDamagePhase(feedback, targetNode, maxHp, lethal, hpBefore, presentation?.vitalsFor(feedback.targetId)?.hp);
          return;
        }
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
          // 포켓몬 스킨: 같은 타격 샘플도 세기에 따라 크기·높이가 다르다(약하면 작고 높게, 세면 크고 낮게)
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
        if (!feedback.healing && !feedback.miss) {
          const hurt = options.runtime.snapshot().actors.some((actor) => actor.id === feedback.targetId || actor.recordId === feedback.targetId);
          flashBattleField(root, feedback.critical ? "critical" : "hit", hurt ? hurtShakeIntensity(hitFeel, intensity) : intensity, { hurt });
          // 타격음 아래 저음 한 겹 — 샘플은 사건 1개 = 소리 1개(battleJuice) 그대로다. 이 저음은 그 위의 별도 층이다.
          // 포켓몬 스킨은 저음층이 타격 세기를 따른다(4 피해와 15 피해가 같은 소리였다).
          if (hitFeel === "impact" && intensity) {
            if (pokemonMotion) playBattleImpactLayer(pokemonHitPower(feedback.amount, maxHp, feedback.critical), feedback.critical);
            else playBattleSfx("thud");
          }
          // 막타는 격파 조각(spawnDeathShards)이 이미 튄다 — 두 파편이 겹치면 뭉개진다.
          if (intensity && targetNode && !lethal) spawnHitSparks(targetNode, intensity);
        }
      }
    },
    onHitFeel(active, feedback) {
      // 정지(히트스톱)가 풀리는 순간 맞은 쪽이 세 번 깜빡인다. 정지 중에는 22-hit-feel.css 가
      // 대상을 흰 실루엣으로 붙잡고 있으므로, 점멸은 그 뒤의 "반응" 이다.
      if (active) hitStopFeedback = feedback;
      else if (hitStopFeedback) {
        const struck = hitStopFeedback;
        hitStopFeedback = undefined;
        const node = findBattlerNode(field, struck.targetId);
        if (retroMotion && node?.classList.contains("battle-actor")) retroHitRelease(node);
        // 포켓몬 안무는 넉백이 끝난 뒤 스스로 깜빡인다(battlePokemonMotion.releaseTarget).
        else if (node && !pokemonMotion && !node.classList.contains("defeated") && !prefersReducedMotion()) blinkBattlerNode(node);
      }
      // 히트스톱이 걸리는 순간 맞은 쪽이 떨기 시작한다(impact). 멈춘 화면이 사진이 아니라 충격으로 읽힌다.
      // 포켓몬 안무는 맞은 그림을 직접 밀고 떨게 한다 — 진동을 겹치면 같은 translate 를 서로 덮는다.
      if (active && hitFeel === "impact" && feedback && !pokemonMotion && !prefersReducedMotion()) {
        const node = findBattlerNode(field, feedback.targetId);
        const strength = node?.dataset.hitIntensity;
        if (node && (strength === "graze" || strength === "normal" || strength === "heavy" || strength === "crushing")) {
          vibrateStruck(battlerSpriteNode(node), strength);
        }
      }
      root.dataset.battleHitFeel = active ? "true" : "false";
      root.classList.toggle("battle-hit-stop", active);
      if (active && feedback?.critical) root.classList.add("battle-hit-stop-critical");
      else root.classList.remove("battle-hit-stop-critical");
    },
    onActionMotion(beat) {
      if (retroMotion) {
        // 시퀀서의 배속으로 실제 비트 길이를 맞춰 칸 전환이 다음 비트에 넘어가지 않게 한다.
        const timed = beat && beat.durationMs > 0
          ? { ...beat, durationMs: Math.max(10, Math.round(beat.durationMs / Math.max(0.2, sequencer.speedMultiplier))) } : beat;
        retroActionMotion(field, timed, options.runtime.snapshot());
      }
      else applyActionMotion(field, beat);
      if (pokemonMotion) {
        const lungeMs = Number.parseFloat(getComputedStyle(root).getPropertyValue("--motion-lunge-ms")) || 160;
        // 착탄 세기 = 최대 HP 대비 피해(pokemonHitPower)
        const hitFeedback = beat?.kind === "impact" ? beat.feedback : undefined;
        const hitMaxHp = hitFeedback ? battlerMaxHp(options.runtime.snapshot(), hitFeedback.targetId) : 0;
        const power = hitFeedback ? pokemonHitPower(hitFeedback.amount, hitMaxHp, hitFeedback.critical) : 0.3;
        pokemonActionMotion(field, beat, lungeMs, pokemonMove, { power, critical: Boolean(hitFeedback?.critical) });
        // 고르기 확인음(Decision1, 크게 들리는 길이 약 0.5초)은 행동이 시작돼도 울려 착탄 소리와 꼬리가 겹쳤다 —
        // 움직임이 시작되면 150ms 동안 거둔다. 짧은 「딸깍」은 남는다(2026-10-02 적대적 QA).
        if (beat?.kind === "approach") fadeBattleCue("command-confirm", 150);
      }
      // 아군 공격의 접근 비트 끝(착탄 SWING_LEAD_MS 전)에 베기 궤적과 휘두름 소리를 둔다. 예전엔 휘두름
      // 소리가 명령 확정 순간(착탄 ~0.5초 전)에 울고 화면은 그동안 멈춰 있었다.
      // 포켓몬 스킨은 베기 궤적을 그리지 않는다(몬스터 몸통박치기에 칼 획이 지나갔다). 휘두름 소리는 남긴다.
      if ((hitFeel === "impact" || pokemonMotion) && swingArmed && beat?.kind === "approach" && beat.userMotion === "lunge" && beat.targetId) {
        swingArmed = false;
        const targetId = beat.targetId;
        scheduleBattleTimer(() => {
          if (destroyed) return;
          const target = findBattlerNode(field, targetId);
          if (!target || !target.classList.contains("battle-enemy")) return;
          playBattleCue("attack-swing");
          if (!pokemonMotion) spawnSlashTrail(target);
        }, Math.max(0, beat.durationMs - SWING_LEAD_MS));
      }
    },
    animationImpactMs(animation, approachMs) {
      if (pokemonMotion) {
        // 접촉·발사체: 이펙트는 「닿는 순간」 착탄 프레임부터 — 일찍 띄우면 발사체가 날아가는 동안 상대 몸에서 불길이 먼저
        // 피었고, 몸통박치기는 저작 타격 별이 착탄 85ms 전에 먼저 떴다(2026-10-02 녹화). 착탄 「팍」은 안무(impactBurst)가 그린다.
        // 현장 발생·범위·보조: 이펙트 자체가 다가감(내리꽂는 번개·솟는 가시·떨어지는 운석)이라 approach 안에 들어가는 만큼 앞당겨 튼다.
        // 어느 쪽이든 못 들어간 앞 프레임은 건너뛴다 — 0번부터 돌면 착탄 효과음이 타격 뒤 160~420ms 에 한 번 더 났다.
        const bodyCarriesApproach = pokemonMove.motion === "contact" || pokemonMove.motion === "projectile";
        const plan = battleAnimationLeadPlan(animation.animationId, bodyCarriesApproach ? 0 : approachMs * motionTempo);
        animationPlan = { animationId: animation.animationId, skipFrames: plan.skipFrames, skippedMs: plan.skippedMs };
        // 1ms = 시퀀서 오프셋이 approach 길이가 된다(착탄 순간 마운트).
        return plan.leadMs > 0 ? plan.leadMs : 1;
      }
      return battleAnimationImpactMs(animation.animationId);
    },
    impactPresentationMs(_entry, feedback) {
      if (!feedback || !usesPokemonDamagePhase(feedback)) return 0;
      // 계획 시점의 원장은 아직 맞기 전 HP 다 — 실제로 줄 HP 로 바 길이를 잡는다. 배속은 시퀀서가 이 값에 곱한다.
      const vitals = presentation?.vitalsFor(feedback.targetId);
      const maxHp = vitals?.maxHp ?? battlerMaxHp(options.runtime.snapshot(), feedback.targetId);
      const plan = pokemonDamagePlan(Math.min(feedback.amount, vitals?.hp ?? feedback.amount), maxHp, 1);
      return plan.delayMs + plan.blinkMs + plan.drainMs + POKEMON_DAMAGE_TAIL_MS + plan.readMs;
    },
    // 건너뛴 앞 프레임만큼 이펙트가 짧게 돈다 — 시퀀서가 recover 를 실제 끝에 맞춘다.
    animationRemainingMs(animation) {
      if (!pokemonMotion || !animation.durationMs) return undefined;
      const skipped = animationPlan?.animationId === animation.animationId ? animationPlan.skippedMs : 0;
      return Math.max(0, animation.durationMs - skipped);
    },
    onEscapeOutcome(success) {
      // 도주음·BGM 정지는 성공이 **화면에 도달한** 순간에만. 예전엔 명령 확정 시점에 울려
      // 실패해도 "도주음 → 그러나 도망칠 수 없었다" 순서가 됐고 남은 전투가 무음이었다.
      const actorNode = options.runtime.snapshot().activeActorId
        ? findBattlerNode(field, options.runtime.snapshot().activeActorId!)
        : null;
      emitBattleJuice(success ? "escape" : "hit-miss", actorNode ?? undefined);
    },
    onResultPending(result) {
      if (retroMotion && result === "victory") retroVictory(field);
      showFinaleStamp(result);
    },
    collapseHoldMs: () => remainingEnemyCollapseMs(field),
    motionTempo: () => motionTempo,
    describeEffectiveness: pokemonMotion,
    // 도트 측면 전투: 근접 공격은 대상 적 앞까지 실제로 걸어간다. 비트 길이를 걸음 거리에 맞춘다.
    ...(retroMotion ? {
      // 직업 스킬 48종은 타임라인 길이(첫 착탄·대상별 간격·남은 연출)를 비트로 준다. 필살기는 약 2.5초다.
      actorApproachMs: (entry: BattleTimelineEntrySnapshot) => retroClassSkillBeatMs(field, entry, "approach", options.runtime.snapshot().timeline)
        ?? retroSkillForEntry(entry)?.approachMs ?? retroWalk(field, entry)?.approachMs,
      actorRecoverMs: (entry: BattleTimelineEntrySnapshot) => retroClassSkillBeatMs(field, entry, "recover", options.runtime.snapshot().timeline)
        ?? retroSkillForEntry(entry)?.recoverMs ?? retroWalk(field, entry)?.recoverMs,
      // 몬스터 스킬 42종은 같은 타임라인 훅(첫 착탄·대상별 간격·남은 연출). 그 밖의 도트 적 근접은 대상 아군 앞까지 뛰어/날아간다.
      enemyApproachMs: (entry: BattleTimelineEntrySnapshot) => retroClassSkillBeatMs(field, entry, "approach", options.runtime.snapshot().timeline)
        ?? retroEnemyReach(field, entry)?.approachMs,
      enemyRecoverMs: (entry: BattleTimelineEntrySnapshot) => retroClassSkillBeatMs(field, entry, "recover", options.runtime.snapshot().timeline)
        ?? retroEnemyReach(field, entry)?.recoverMs,
      // 연출 레코드의 무게 손잡이(light/normal/heavy) — 접근·멈춤·회복 배율이 같이 바뀐다.
      actionWeight: (entry: BattleTimelineEntrySnapshot, base: BattleActionWeight) => retroClassSkillWeight(field, entry, base, options.runtime.snapshot().timeline),
    } : {}),
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
        if (advanceResultLevelUps()) return;
        resultSent = true;
        options.onResult(snapshot.result, applyRollingHpSurvival(snapshot.result, snapshot, rollingHp));
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
    if (shiftHeld && event.key !== "Shift") shiftCombined = true;
    if (event.repeat && (isBattleConfirmKey(event) || isBattleCancelKey(event) || isAutoBattleKey(event.key) || event.key === "Shift")) { event.preventDefault(); return; }
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
          // 도트 결과: 둘째 확인부터는 레벨 업한 사람을 한 명씩 보인다. 다 보이면 닫는다.
          if (advanceResultLevelUps()) return;
          resultSent = true;
          options.onResult(snapshot.result, applyRollingHpSurvival(snapshot.result, snapshot, rollingHp));
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
    if (inputPrompt) {
      const dir = directionForKey(event.key);
      const key: SkillInputKey | undefined = dir ?? (isBattleConfirmKey(event) ? "confirm" : isBattleCancelKey(event) ? "cancel" : undefined);
      if (key) {
        event.preventDefault();
        inputPrompt.press(key);
      }
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
    // 메뉴를 처음 열 때는 **쓸 수 있는** 첫 행에 선다. 비활성 행에도 커서가 설 수 있다는
    // 계약(aria-disabled 경로)은 그대로다 — 화살표로 가서 사유를 읽을 수 있다. 다만 기본
    // 자리로 삼지는 않는다: gen1 전투는 「공격」이 영구 비활성인데(“사용 가능한 기술이 있어
    // 통상 공격을 쓸 수 없습니다”) 커서가 그 위에서 시작해, 확인키를 눌러도 아무 일도
    // 일어나지 않는 화면이 첫인상이었다(실측 2026-09-17, monster-collect 프리셋).
    // 전부 비활성이면 예전처럼 첫 행에 선다 — 그때는 사유를 읽는 것이 유일하게 할 일이다.
    const firstUsable = buttons.find((button) => button.dataset.battleCommandInert !== "true");
    const selected = buttons.find((button) => button.dataset.testid === savedId)
      ?? selectedTarget
      ?? firstUsable
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

  /** 시퀀서가 아직 재생하지 않은 stateAdded/stateRemoved 를 되돌린 배지 목록(표시 전용). */
  function pendingStateView(snapshot: BattleSnapshot): ((battlerId: string, stateIds: readonly string[]) => readonly string[]) | undefined {
    const pending = snapshot.timeline.filter((entry) => entry.sequence > playedTimelineSequence
      && (entry.kind === "stateAdded" || entry.kind === "stateRemoved") && entry.targetId && entry.stateId);
    if (pending.length === 0) return undefined;
    return (battlerId, stateIds) => {
      let view = [...stateIds];
      // 뒤에서부터 되감는다 — 같은 상태가 붙었다 풀린 경우에도 재생 전 모습으로 돌아간다.
      for (const entry of [...pending].reverse()) {
        if (entry.targetId !== battlerId || !entry.stateId) continue;
        if (entry.kind === "stateAdded") view = view.filter((id) => id !== entry.stateId);
        else if (!view.includes(entry.stateId)) view.push(entry.stateId);
      }
      return view;
    };
  }

  function syncView(): void {
    if (destroyed) return;
    const snapshot = options.runtime.snapshot();
    const showingResult = Boolean(snapshot.result) && directorState.step === "result";
    if (showingResult) {
      directorState = resultDirectorState(snapshot, directorState);
    } else if (!sequenceBusy) {
      directorState = nextDirectorState(snapshot, directorState);
    }
    const fieldPresentation = {
      ledger: presentation,
      retainDepartedEnemies: sequenceBusy,
      // 비트 재생 중에도 스냅샷의 잔류 attack/hit pose 는 걷어내고(라운드 마지막 액션
      // 기준이라 엉뚱한 배틀러가 맞은 것처럼 보인다), 지금 impact 대상에게만 hit 를 준다.
      // 시퀀스가 끝난 뒤(결과 화면 포함)에도 걷는다 — 패배 결과에서 살아남은 적이
      // attack 포즈로 박제되던 결함(적대 리뷰 3차).
      calm: !sequenceBusy || !snapshot.result,
      hitTargetId: lastDamageFeedback && !lastDamageFeedback.healing && !lastDamageFeedback.miss && !lastDamageFeedback.label
        ? lastDamageFeedback.targetId
        : undefined,
      onField: options.onField,
      rollingHp,
      stateView: sequenceBusy ? pendingStateView(snapshot) : undefined,
    };
    // 결과 화면이 뜨면 미터를 멈춘다 — 이 순간 남은 HP 가 결산 값이다. 패배는 결산하지 않으므로
    // 미터를 실제 HP(0)에 붙인다: 전멸 화면에 굴러가던 HP 와 「쓰러지는 중」이 남지 않게.
    if (showingResult) {
      if (snapshot.result === "defeat") rollingHp?.settle();
      else rollingHp?.freeze();
    }
    lastFieldPresentation = fieldPresentation;
    syncBattleField(field, snapshot, lastDamageFeedback, fieldPresentation);
    if (retroMotion) {
      for (const node of field.querySelectorAll<HTMLElement>(".battle-actor")) {
        retroCommandPose(node, !sequenceBusy && (snapshot.phase === "actorCommand" || snapshot.phase === "targetSelect")
          && node.dataset.recordId === snapshot.activeActorId && !node.classList.contains("defeated"));
      }
    }
    syncBattleParty(partyPanel, snapshot, fieldPresentation);
    if (battleLook?.turnOrder) syncBattleTurnOrder(root, snapshot);
    rollingHpTicker?.kick();
    // 전투 이벤트의 Tint Screen(색조·채도·흑백·세피아).
    syncBattleScreenFilter(field, snapshot.eventState.screen);
    syncBattleMessageWindow(messageWindow, directorState);
    if (!snapshot.eventPause && !snapshot.eventChoice) eventSurfaceOpen = false;
    // The event surface takes over only after preceding action beats have drained.
    // Transparent text must not reveal the director's previous lines underneath.
    messageWindow.style.visibility = eventSurfaceOpen ? "hidden" : "";
    playbackStatus.hidden = eventSurfaceOpen || showingResult;
    syncPlaybackStatus();
    syncEnemyListPanel(enemyPanel, snapshot.enemies, presentation, sequenceBusy);
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
    if (!autoBattle || sequenceBusy || inputPrompt || snapshot.result) return;
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
    // Gauge charging alone does not rebuild menus. Eligibility changes at the
    // ready boundary, and when skills, resources or blocking states change.
    const eligibilitySignature = JSON.stringify({
      partyGauge: snapshot.partyGauge,
      actors: snapshot.actors.map((member) => ({
        id: member.recordId, ready: member.gauge >= 100, hp: member.hp,
        maxHp: member.maxHp, mp: member.mp, maxMp: member.maxMp,
        classId: member.classId, stateIds: member.stateIds, skillIds: member.skillIds,
        skillPp: member.skillPp, skillCooldowns: member.skillCooldowns,
        resource2: member.resource2, limitGauge: member.limitGauge,
        equipmentEffects: member.equipmentEffects,
      })),
    });
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
      eligibilitySignature,
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
    // 시퀀스(인트로·액션 비트)가 도는 동안 명령 패널은 숨어 있다. 여기서 focus() 하면 숨은 버튼에 포커스를 주려고
    // 동기 레이아웃만 강제된다(첫 전투 진입 focus 64ms 실측). 명령 국면이 되면 syncView 가 커서 버튼에 포커스를 준다.
    if (selected && !sequenceBusy && document.activeElement !== selected) selected.focus({ preventScroll: true });
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

  /** 도트 결과의 다음 레벨 업 창을 열었으면 true. 레벨 업 창이 없거나 다 봤으면 false. */
  function advanceResultLevelUps(): boolean {
    const panel = resultHost.querySelector<HTMLElement>("[data-testid='battle-result-panel']");
    return panel ? advanceBattleResultLevelUps(panel) : false;
  }

  /** 결과 홀드 동안 필드 한가운데 찍히는 도장. 결과 패널이 뜨면 걷는다(syncResultHost).
   *  결과 소리·플래시는 도장과 같은 순간에 한 번 울린다 — 패널이 뜰 때까지 기다리면 막타와
   *  팡파레 사이가 1.5초 비었다(2026-09-25 녹화). 도주는 자기 연출이 있어 도장을 찍지 않는다. */
  function showFinaleStamp(result: NonNullable<BattleSnapshot["result"]>): void {
    if (result === "escape" || finaleCelebrated === result) return;
    root.querySelector(".battle-finale-stamp")?.remove();
    const stamp = document.createElement("div");
    stamp.className = "battle-finale-stamp";
    stamp.dataset.testid = "battle-finale-stamp";
    stamp.dataset.battleResult = result;
    stamp.setAttribute("aria-hidden", "true");
    const text = document.createElement("span");
    text.className = "battle-finale-stamp-text";
    text.textContent = result === "victory" ? "승리!" : "전멸…";
    stamp.append(text);
    field.append(stamp);
    root.dataset.battleFinale = result;
    finaleCelebrated = result;
    emitBattleJuice(result === "victory" ? "victory" : "defeat", root);
    flashBattleField(root, result === "victory" ? "victory" : "defeat");
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
      const created = battleResultPanel(snapshot, resultRevealStage, options.audioContext);
      if (!created) return;
      resultHost.replaceChildren(created);
      panel = created;
      // 키보드 전용 런타임 — 확인 버튼이 포커스를 받아야 :focus-visible 링과 보조기술 안내가 산다.
      created.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
      // 뒤늦게 살아있는 데미지 팝업이 결과 화면 위로 새지 않도록 정리하고, 결과 연출을 1회 발화.
      for (const popup of root.querySelectorAll(".battle-damage-popup")) popup.remove();
      // 결과 팡파레도 사건 1개 = 소리 1개. emitBattleJuice 가 큐를 울리므로
      // 여기서 합성 보이스를 겹쳐 부르지 않는다(예전 결함).
      // 도장만 걷는다. data-battle-finale 은 전투가 닫힐 때까지 둔다 — 지우면 결과 패널이 뜨는 순간
      // 승리 줌(1.035)과 전멸 흑백이 한 프레임에 원상으로 튀었다.
      field.querySelector(".battle-finale-stamp")?.remove();
      if (finaleCelebrated !== snapshot.result) {
        emitBattleJuice(snapshot.result === "victory" ? "victory" : snapshot.result === "defeat" ? "defeat" : "escape", root);
        flashBattleField(root, snapshot.result === "victory" ? "victory" : "defeat");
      }
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
    if (sequenceBusy || inputPrompt) return;
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

  /** 포켓몬 3세대 피해 박자(pokeemerald: attackanimation → effectivenesssound + hitanimation → healthbarupdate).
   *  기술 연출이 끝난 뒤(13프레임) 상성 타격음과 함께 맞은 쪽이 8번 깜빡이고 HP 상자가 떨며, 깜빡임이 끝나야 HP 가
   *  일정 속도(바 전체 48프레임)로 준다. 동작 템포(1.5배)와 배속(speed)만큼 줄인다 — 시퀀서 지연은 배속으로 줄어드는데
   *  이 박자만 그대로면 빨리 감기·건너뛰기에서 다음 행동이 앞 박자 위로 올라왔다. `lostHp` 는 실제로 준 HP(초과 피해 제외). */
  function pokemonDamagePlan(lostHp: number, maxHp: number, speed: number): { delayMs: number; blinkMs: number; drainMs: number; readMs: number; frameMs: number } {
    const frame = 1000 / 60 / ((motionTempo > 0 ? motionTempo : 1) * Math.max(0.2, speed));
    const share = Math.min(1, Math.max(0, lostHp) / Math.max(1, maxHp));
    return {
      delayMs: 13 * frame,
      blinkMs: 32 * frame,
      drainMs: Math.max(frame, Math.round(share * 48) * frame),
      readMs: POKEMON_RESULT_READ_FRAMES * frame,
      frameMs: frame,
    };
  }

  /** 3세대 피해 박자를 타는 피해인가 — onDamageFeedback 과 impactPresentationMs 가 **같은 판정**을 써야 recover 비트가
   *  실제 박자와 맞는다(예전엔 독 틱(label)이 비트만 늘려 빈 시간이 생기고, MP 피해가 HP 박자를 돌렸다). */
  function usesPokemonDamagePhase(feedback: DamageFeedback | undefined): boolean {
    if (!pokemonMotion || !feedback) return false;
    return !feedback.label && !feedback.miss && !feedback.healing && !feedback.blocked
      && (feedback.resource ?? "hp") === "hp" && feedback.amount > 0;
  }

  function finishPokemonPhase(targetId: string): void {
    const finish = pokemonPhaseFinishers.get(targetId);
    if (!finish) return;
    pokemonPhaseFinishers.delete(targetId);
    finish();
  }
  function finishAllPokemonPhases(): void {
    for (const targetId of [...pokemonPhaseFinishers.keys()]) finishPokemonPhase(targetId);
  }

  /** 3세대는 HP 숫자도 바와 같이 센다(MoveBattleBar → UpdateHpTextInHealthbox). 예전엔 숫자가 착탄 순간 바로 바뀌고
   *  바는 0.5초 뒤에 줄어 서로 어긋났다. 세는 동안 battleFieldDom.setVitalNode 는 data-hp-countdown 을 보고 숫자를 건드리지 않는다.
   *  돌려준 함수는 세기를 멈추고 끝값을 적는다. */
  function countPokemonHp(hud: HTMLElement | null | undefined, from: number, to: number, startMs: number, drainMs: number, frameMs: number): () => void {
    const value = hud?.querySelector<HTMLElement>(".battle-actor-hp .battle-vital-value");
    if (!value || !(from > to)) return () => undefined;
    const token = String((Number(value.dataset.hpCountdown) || 0) + 1);
    value.dataset.hpCountdown = token;
    value.textContent = ` ${from}`;
    const ticks = Math.max(1, Math.round(drainMs / frameMs));
    for (let k = 1; k <= ticks; k += 1) {
      const shown = Math.round(from - (from - to) * (k / ticks));
      scheduleBattleTimer(() => {
        if (value.dataset.hpCountdown !== token) return;
        value.textContent = ` ${shown}`;
        if (k === ticks) delete value.dataset.hpCountdown;
      }, startMs + k * (drainMs / ticks));
    }
    return () => {
      if (value.dataset.hpCountdown !== token) return;
      delete value.dataset.hpCountdown;
      value.textContent = ` ${to}`;
    };
  }

  function playPokemonDamagePhase(feedback: DamageFeedback, targetNode: HTMLElement | null, maxHp: number, lethal: boolean, hpBefore: number | undefined, hpAfter: number | undefined): void {
    const tier = (feedback.effectiveness ?? 1) > 1 ? "super" : (feedback.effectiveness ?? 1) < 1 ? "weak" : "normal";
    root.dataset.battleLastEffectiveness = tier;
    // 감소 모션: 박자(지연·깜빡임·떨림·세기)는 빼고 상성 타격음과 기절음만 바로 — 정보는 남긴다.
    if (prefersReducedMotion()) {
      emitBattleJuice("hit-damage", targetNode, POKEMON_EFFECTIVENESS_SHAPE[tier]);
      if (lethal) playBattleCue("faint");
      return;
    }
    const lostHp = hpBefore !== undefined && hpAfter !== undefined ? hpBefore - hpAfter : feedback.amount;
    const speed = sequencer.speedMultiplier;
    const plan = pokemonDamagePlan(lostHp, maxHp, speed);
    const pace = (motionTempo > 0 ? motionTempo : 1) * Math.max(0.2, speed);
    const drainAt = plan.delayMs + plan.blinkMs;
    const drainEnd = drainAt + plan.drainMs;
    // 결과 문장(「…에게 5 피해!」·상성)은 HP 가 다 준 뒤에 — 3세대 순서는 기술 → 맞음 → HP 감소 → resultmessage 다.
    // 예전엔 피해 숫자가 착탄 순간 먼저 나와서, 바가 줄기도 전에 결과를 읽어 버렸다. 20-pokemon-skin.css ⑦ 이 둘째 줄을 숨긴다.
    const holdToken = String((Number(root.dataset.pkmnResultHold) || 0) + 1);
    root.dataset.pkmnResultHold = holdToken;
    const releaseResult = (): void => { if (root.dataset.pkmnResultHold === holdToken) delete root.dataset.pkmnResultHold; };
    // 바 전환은 스타일이 다시 계산되는 다음 프레임에 시작해 타이머보다 한 프레임쯤 늦다 — 문장은 두 프레임 더 기다린다.
    scheduleBattleTimer(releaseResult, drainEnd + 2 * plan.frameMs);
    const actor = options.runtime.snapshot().actors.find((one) => one.id === feedback.targetId || one.recordId === feedback.targetId);
    // 포켓몬 스킨에서 화면에 보이는 적 HP 상자는 필드의 .battle-enemy-hud(숨김)가 아니라 정보 패널의 행이다.
    // 예전엔 숨은 HUD 를 잡아서 적 HP 가 착탄 순간 바로 줄고 상자도 떨지 않았다(2026-10-02 실측).
    const enemyRow = actor ? null : root.querySelector<HTMLElement>(`.battle-enemy-list-row[data-enemy-id="${targetNode?.dataset.testid ?? feedback.targetId}"]`);
    const hud = actor
      ? root.querySelector<HTMLElement>(`.battle-actor-status[data-record-id="${actor.recordId}"]`)
      : enemyRow ?? targetNode?.querySelector<HTMLElement>(".battle-enemy-hud");
    // 떨리는 건 상자 전체(3세대 healthbox) — 적이 하나면 패널이 곧 상자다.
    const enemyPanel = enemyRow?.closest<HTMLElement>(".battle-enemy-list-panel");
    const buzzBox = enemyPanel && enemyPanel.querySelectorAll(".battle-enemy-list-row").length === 1 ? enemyPanel : hud;
    // HP 바는 깜빡임이 끝난 뒤 일정 속도로 — 20-pokemon-skin.css ⑥ 의 HP 전환이 이 변수를 읽는다.
    const clearDrain = (): void => {
      hud?.style.removeProperty("--pkmn-hp-drain-delay");
      hud?.style.removeProperty("--pkmn-hp-drain-ms");
    };
    if (hud) {
      hud.style.setProperty("--pkmn-hp-drain-delay", `${Math.round(drainAt)}ms`);
      hud.style.setProperty("--pkmn-hp-drain-ms", `${Math.round(plan.drainMs)}ms`);
      scheduleBattleTimer(clearDrain, drainEnd + 120);
    }
    const stopCount = actor && hpBefore !== undefined
      ? countPokemonHp(hud, hpBefore, hpAfter ?? Math.max(0, hpBefore - feedback.amount), drainAt, plan.drainMs, plan.frameMs)
      : () => undefined;
    // 쓰러짐은 HP 가 다 준 뒤(3세대 tryfaintmon). 막타 순간 원장이 defeated 를 세우면 쓰러짐 연출·적 HP 행 숨김이
    // 바가 줄기도 전에 돌고, 깜빡임이 사라지던 그림을 도로 켰다 — 원장의 쓰러짐 표시를 그때까지 미룬다.
    const releaseDefeat = lethal ? presentation?.deferDefeat(feedback.targetId) : undefined;
    let fainted = false;
    let struck = false;
    const motions: Animation[] = [];
    const faint = (): void => {
      if (fainted || !releaseDefeat) return;
      fainted = true;
      releaseDefeat();
      if (destroyed) return;
      syncView();
      playBattleCue("faint");
    };
    if (releaseDefeat) scheduleBattleTimer(faint, drainEnd + 80);
    // 상성별 타격음(3세대 SE_KOUKA_L/M/H): 별로 = 작고 높게, 보통, 굉장 = 크고 낮게 + 한 번 더(「빠-밤」).
    // 급소는 소리를 바꾸지 않는다(3세대 Cmd_effectivenesssound) — 「급소에 맞았다!」 문장이 말한다.
    const strikeSound = (): void => {
      emitBattleJuice("hit-damage", targetNode, POKEMON_EFFECTIVENESS_SHAPE[tier]);
      if (tier === "super") scheduleBattleTimer(() => { if (!destroyed) emitBattleJuice("hit-damage", targetNode, { volume: 0.9, rate: 0.78 }); }, 55 / Math.max(0.2, speed));
      if (hitFeel === "impact" && tier !== "weak") playBattleImpactLayer(pokemonHitPower(lostHp, maxHp, feedback.critical), feedback.critical);
    };
    scheduleBattleTimer(() => {
      if (destroyed || struck) return;
      struck = true;
      strikeSound();
      for (const motion of [pokemonDamageBlink(targetNode, pace), pokemonHudBuzz(buzzBox, pace)]) if (motion) motions.push(motion);
    }, plan.delayMs);
    // 배속이 바뀌거나(넘기기 시작) 같은 대상이 또 맞으면 남은 박자를 지금 끝낸다 — 시퀀서는 남은 지연을 새 배속으로
    // 다시 거는데 이 박자는 처음 배속 그대로라, 넘기기 중 다음 행동이 앞 박자 위로 올라와 결과 문장이 통째로 묻혔다(2026-10-02 실측).
    const finisher = (): void => {
      if (!struck && !destroyed) {
        struck = true;
        strikeSound();
      }
      for (const motion of motions) motion.finish();
      // HP 바·잔상의 CSS 전환(지연이 걸린 채 대기 중일 수 있다)을 끝값으로 — 변수를 지워도 이미 시작된 전환은 그대로 돈다.
      for (const transition of hud?.getAnimations?.({ subtree: true }) ?? []) {
        if (typeof CSSTransition !== "undefined" && transition instanceof CSSTransition) transition.finish();
      }
      stopCount();
      clearDrain();
      releaseResult();
      faint();
    };
    pokemonPhaseFinishers.set(feedback.targetId, finisher);
    // 다 끝난 뒤에는 마무리할 것이 없다 — 그사이 같은 대상의 새 박자가 들어왔으면 그것은 지우지 않는다.
    scheduleBattleTimer(() => { if (pokemonPhaseFinishers.get(feedback.targetId) === finisher) pokemonPhaseFinishers.delete(feedback.targetId); }, drainEnd + 160);
  }

  function emitSwingJuice(command: ActorCommand | TargetedActorCommand, snapshot: BattleSnapshot): void {
    const actorNode = snapshot.activeActorId
      ? findBattlerNode(field, snapshot.activeActorId)
      : null;
    const skillRecord = command.kind === "skill" ? store.getCurrent().database.skills.find((skill) => skill.id === command.skillId) : undefined;
    // 지난 명령의 무장이 남아 있으면(막힌 행동·비트 없는 행동) 다음 돌진에서 엉뚱한 휘두름이 났다 — 명령마다 새로 정한다.
    swingArmed = false;
    pendingRetroSkillId = retroMotion && hasRetroSkillContract(skillRecord) ? skillRecord?.id : undefined;
    pendingRetroSkillUserId = snapshot.activeActorId;
    if (retroMotion && command.kind === "skill" && (retroSkillRecipe(skillRecord) || hasRetroSkillContract(skillRecord))) {
      swingArmed = false; // The recipe owns release SE; the old animation and generic swing are silent.
      return;
    }
    if (command.kind === "attack" || command.kind === "skill") {
      // impact 의 평타는 휘두름 소리를 착탄 직전(onActionMotion)으로 옮기고 베기 궤적을 같이 긋는다. 여기서도
      // 울면 한 행동에 두 번 운다. 스킬은 자기 애니메이션이 있어 예전 자리(확정 순간)를 지킨다.
      // 포켓몬 스킨: 확정 순간의 휘두름 소리는 착탄 0.28초 전, 아직 웅크리는 중에 났고 화염·낙뢰에도 칼 바람 소리가 났다
      // (2026-10-02 소리 악보). 몸으로 치는 기술만 돌진 직전에 울리고, 쏘거나 부르는 기술은 자기 이펙트 소리만 낸다.
      const pokemonRanged = pokemonMotion && command.kind === "skill" && pokemonMoveMotion(skillRecord) !== "contact";
      // 포켓몬 스킨은 타격감 프리셋(light 포함)과 무관하게 돌진 직전에 울린다 — light 에서 확정 순간으로 돌아가면 같은 어긋남이 난다.
      swingArmed = !pokemonRanged && (pokemonMotion || (hitFeel === "impact" && command.kind === "attack"));
      if (!swingArmed && !pokemonRanged) emitBattleJuice("attack-swing", actorNode ?? undefined);
    } else if (command.kind === "defend") {
      emitBattleJuice("defend", actorNode ?? undefined);
    }
    // escape 는 결과가 화면에 도달할 때 시퀀서 훅(onEscapeOutcome)이 울린다.
  }

  function skillInputSequenceFor(command: TargetedActorCommand): SkillInputSequence | undefined {
    if (command.kind !== "skill" || command.inputResult) return undefined;
    return store.getCurrent().database.skills.find((skill) => skill.id === command.skillId)?.inputSequence;
  }

  /**
   * 입력 커맨드 프롬프트: 키 순서를 보여 주고 제한 시간 안에 모두 맞게 누르면 성공.
   * 틀린 키·시간 초과는 실패. 결과는 명령의 inputResult 로 런타임에 넘어가 위력 배율이 된다.
   */
  function openInputPrompt(sequence: SkillInputSequence, onDone: (result: SkillInputResult) => void): void {
    const owner = options.runtime.snapshot();
    const tracker = createInputSequenceTracker(sequence, Date.now());
    const overlay = document.createElement("div");
    overlay.className = "battle-input-prompt";
    overlay.dataset.testid = "battle-input-prompt";
    overlay.setAttribute("role", "status");
    overlay.setAttribute("aria-live", "assertive");
    const title = document.createElement("p");
    title.className = "battle-input-prompt-title";
    title.textContent = `입력! (${(sequence.timeLimitMs / 1000).toFixed(1)}초)`;
    const keys = document.createElement("div");
    keys.className = "battle-input-prompt-keys";
    const keyNodes = sequence.keys.map((key, index) => {
      const node = document.createElement("span");
      node.className = "battle-input-prompt-key";
      node.dataset.testid = `battle-input-prompt-key-${index}`;
      node.textContent = inputKeyLabel(key);
      return node;
    });
    keys.append(...keyNodes);
    overlay.append(title, keys);
    root.append(overlay);
    let finished = false;
    const finish = (result: SkillInputResult): void => {
      if (finished) return;
      finished = true;
      inputPrompt = undefined;
      window.clearTimeout(timer);
      overlay.dataset.result = result;
      overlay.remove();
      const snapshot = options.runtime.snapshot();
      if (destroyed || snapshot.result || snapshot.activeActorId !== owner.activeActorId
        || snapshot.turn !== owner.turn || snapshot.phase !== owner.phase) {
        if (!destroyed) syncView();
        return;
      }
      onDone(result);
    };
    const timer = scheduleBattleTimer(() => finish(tracker.expire(Number.POSITIVE_INFINITY) === "success" ? "success" : "fail"), sequence.timeLimitMs);
    inputPrompt = {
      press(key) {
        const state = tracker.press(key, Date.now());
        keyNodes.forEach((node, index) => { node.dataset.done = index < tracker.index ? "true" : "false"; });
        if (state !== "pending") finish(state);
      },
    };
  }

  function beginTargetCommand(command: TargetedActorCommand): void {
    if (sequenceBusy || inputPrompt) return;
    // 입력 커맨드 기술이 대상 선택 없이 바로 나가는 스코프(자신·전체)면 여기서 입력을 받는다.
    const promptSequence = skillInputSequenceFor(command);
    if (promptSequence && command.kind === "skill") {
      const scope = targetScopeForCommand(store.getCurrent(), command);
      if (scope === "self" || scope === "allAllies" || scope === "allEnemies") {
        openInputPrompt(promptSequence, (inputResult) => beginTargetCommand({ ...command, inputResult }));
        return;
      }
    }
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

  function confirmTargetSelection(targetId: string, inputResult?: SkillInputResult): void {
    if (sequenceBusy || inputPrompt) return;
    const before = options.runtime.snapshot();
    const pending = before.targetSelection?.command;
    const side = before.targetSelection?.side;
    if (before.phase !== "targetSelect" || !pending || !side) return;
    // 입력 커맨드 기술: 대상을 고른 뒤 입력을 받고, 판정을 실은 명령으로 실행한다.
    const promptSequence = inputResult ? undefined : skillInputSequenceFor(pending);
    if (promptSequence && before.targetSelection?.targetIds.includes(targetId)) {
      openInputPrompt(promptSequence, (result) => confirmTargetSelection(targetId, result));
      return;
    }
    const command = concreteTargetCommand(pending.kind === "skill" && inputResult ? { ...pending, inputResult } : pending, targetId, side);
    if (inputResult) {
      options.runtime.cancelTargetSelection();
      options.runtime.performActorCommand(command);
    } else {
      options.runtime.selectTarget(targetId);
    }
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

  // 인트로는 startIntro 가 인트로 상태로 syncView 를 부른다. 그 앞에 명령 상태로 한 번 더 그리면 전투 DOM 전체를
  // 명령 화면으로 만들고 포커스·레이아웃까지 한 뒤 곧바로 인트로로 갈아엎는다(첫 전투 진입 115–128ms 의 절반 가량).
  if (options.introHold !== false) sequencer.startIntro(initialSnapshot);
  else syncView();

  const tickInterval = window.setInterval(() => {
    if (sequenceBusy || inputPrompt) return;
    const before = options.runtime.snapshot();
    if (before.result) return;
    // Active ATB: 명령·대상 메뉴가 열려 있어도 시간이 흐른다. 런타임이 적만 행동시키고 메뉴를 되돌려 준다.
    const menuTime = activeAtb && (before.phase === "actorCommand" || before.phase === "targetSelect") && !eventSurfaceOpen;
    if (before.phase !== "charging" && !menuTime) {
      if (before.phase === "actorCommand") syncView();
      return;
    }
    options.runtime.tick(BATTLE_TICK_MS);
    const after = options.runtime.snapshot();
    const timelineKey = `${before.timeline.length}:${after.timeline.length}`;
    if ((after.timeline.length > before.timeline.length && timelineKey !== lastEnemyActionKey) || after.eventChoice || after.eventPause || after.result) {
      lastEnemyActionKey = timelineKey;
      // QA 증거: 메뉴가 열린 채로 적이 행동했다(Active ATB).
      if (menuTime) root.dataset.battleEnemyActedDuringMenu = "true";
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
      animationBlendObserver.disconnect();
      clearBattleTimerScope();
      rollingHpTicker?.stop();
      choiceController?.abort();
      options.runtime.cancel();
      window.clearInterval(tickInterval);
      window.removeEventListener("keydown", onWindowKeydown);
      window.removeEventListener("keyup", onWindowKeyup);
      sequencer.cancel();
      activeAnimation?.destroy();
      stageScale.cleanup();
      stage.remove();
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

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// 도트 측면 전투에서는 날아가는 이펙트(화살·투사체)를 그리지 않는다 — 판정은 battleRetroMotion.isTravellingEffect.
// 대상 위에서 제자리로 터지는 이펙트(불꽃·치유 빛·베기)는 남는다. 빠진 이펙트의 소리는 시전 방출음이 대신한다.
