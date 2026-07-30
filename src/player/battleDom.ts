import type {
  ActorCommand,
  BattleResult,
  BattleRuntime,
  BattleSnapshot,
  TargetedActorCommand,
} from "@/battle/runtime";
import { concreteTargetCommand } from "@/battle/runtime";
import type { BattleAnimationPlayback } from "@/player/battleAnimationDom";
import { syncBattleAnimationLayer } from "@/player/battleAnimationDom";
import { commandPanel, enemyListPanel, syncEnemyListPanel, type BattleCommandSubmenu } from "@/player/battleCommandDom";
import {
  applyBattleDirectorState,
  battleMessageWindow,
  battleResultRewardRowCount,
  battleEventDirectorState,
  battleResultPanel,
  chargingDirectorState,
  commandPromptState,
  resultDirectorState,
  syncBattleMessageWindow,
  syncBattleResultPanel,
  targetSelectDirectorState,
  type BattleDirectorState,
} from "@/player/battleDirectorDom";
import { resolveSkinId } from "@/battle/skins/registry";
import { applyActionMotion, battleField, battlePartyStatus, findBattlerNode, playCaptureCinematic, syncBattleField, syncBattleParty } from "@/player/battleFieldDom";
import { emitBattleJuice, flashBattleField } from "@/player/battleJuice";
import {
  BATTLE_RESULT_HOLD_MS,
  BATTLE_RESULT_STAGE_MS,
  createBattleSequencer,
  type DamageFeedback,
} from "@/player/battleSequencer";
import { applyBattleSystemGraphic } from "@/player/systemGraphics";
import { store } from "@/project/store";
import { bindBattleStageScale } from "@/player/battleStageScale";

export interface BattleDomOptions {
  readonly host: HTMLElement;
  readonly runtime: BattleRuntime;
  readonly onResult: (result: BattleResult, snapshot: BattleSnapshot) => void;
  readonly introHold?: boolean;
}

export interface BattleDomController {
  readonly root: HTMLElement;
  destroy(): void;
}

const BATTLE_TICK_MS = 200;

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
  // 스킨 레지스트리 기반 분기 — CSS가 [data-battle-skin="<id>"] 로 10종 스킨을 갈아입힌다.
  root.dataset.battleSkin = resolveSkinId(store.getCurrent().system.battleUiStyle);
  applyBattleSystemGraphic(root);
  options.host.append(root);
  // 논리 해상도(320×240) 스케일링 — 스킨이 그 해상도 기준으로 저작돼 있다.
  const stageScale = bindBattleStageScale(options.host, root);

  const initialSnapshot = options.runtime.snapshot();
  let resultSent = false;
  let resultTimer: number | undefined;
  let submenu: BattleCommandSubmenu = null;
  let directorState: BattleDirectorState = commandPromptState(initialSnapshot);
  let resultRevealStage = 0;
  let sequenceBusy = false;
  let lastDamageFeedback: DamageFeedback | undefined;
  let activeAnimation: BattleAnimationPlayback | undefined;
  let commandPanelSignature = "";
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

  const controlsBar = document.createElement("div");
  controlsBar.className = "battle-controls-bar";
  controlsBar.dataset.testid = "battle-controls-bar";

  const autoBtn = document.createElement("button");
  autoBtn.className = "battle-control-btn";
  autoBtn.dataset.testid = "battle-auto-btn";
  autoBtn.textContent = "🤖 AUTO (A)";
  autoBtn.onclick = (e) => {
    e.stopPropagation();
    toggleAutoBattle();
  };

  const speedBtn = document.createElement("button");
  speedBtn.className = "battle-control-btn";
  speedBtn.dataset.testid = "battle-speed-btn";
  speedBtn.textContent = "⚡ 1.0x";
  speedBtn.onclick = (e) => {
    e.stopPropagation();
    toggleSpeed();
  };

  controlsBar.append(autoBtn, speedBtn);
  root.append(field, animationLayer, messageWindow, enemyPanel, commandHost, partyPanel, resultHost, controlsBar);

  function toggleAutoBattle(): void {
    autoBattle = !autoBattle;
    autoBtn.classList.toggle("is-active", autoBattle);
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
    sequencer.speedMultiplier = spd;
    speedBtn.textContent = `⚡ ${spd.toFixed(1)}x`;
    speedBtn.classList.toggle("is-active", spd > 1.0);
  }

  const panelOptions: {
    runtime: BattleRuntime;
    submenu: BattleCommandSubmenu;
    setSubmenu(next: BattleCommandSubmenu): void;
    setDirectorState(state: BattleDirectorState): void;
    render(): void;
    runActorCommand(command: ActorCommand): void;
    beginTargetCommand(command: TargetedActorCommand): void;
    confirmTargetSelection(enemyId: string): void;
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
  };

  const sequencer = createBattleSequencer(options.runtime, {
    onCaptureCinematic(targetId, success) {
      return playCaptureCinematic(field, targetId, success);
    },
    onDirectorState(state) {
      directorState = battleEventDirectorState(options.runtime.snapshot(), state);
    },
    onSyncView() {
      syncView();
    },
    onDamageFeedback(feedback) {
      lastDamageFeedback = feedback;
      if (feedback) {
        const targetNode =
          field.querySelector<HTMLElement>(`[data-testid="${feedback.targetId}"]`)
          ?? field.querySelector<HTMLElement>(`.battle-enemy[data-record-id="${feedback.targetId}"]`)
          ?? field.querySelector<HTMLElement>(`[data-testid="battle-actor-${feedback.targetId}"]`);
        emitBattleJuice(feedback.critical ? "hit-critical" : feedback.healing ? "command-confirm" : "hit-damage", targetNode);
        if (!feedback.healing) flashBattleField(root, feedback.critical ? "critical" : "hit");
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
    onResultStage(stage) {
      resultRevealStage = stage;
    },
    onSequenceBusy(busy) {
      sequenceBusy = busy;
      root.dataset.battleSequenceBusy = busy ? "true" : "false";
    },
  });

  root.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const snapshot = options.runtime.snapshot();
    // 결과 화면에서는 어디를 클릭해도 종료 확정("클릭으로 계속" 프롬프트와 확인 버튼 포함).
    if (snapshot.result) {
      if (!resultSent) {
        resultSent = true;
        window.clearTimeout(resultTimer ?? undefined);
        options.onResult(snapshot.result, snapshot);
      }
      return;
    }
    const target = event.target.closest<HTMLElement>(".battle-enemy[data-battle-targetable='true']");
    if (!target?.dataset.testid) return;
    confirmTargetSelection(target.dataset.testid);
  });

  root.tabIndex = 0;
  function onKeydown(event: KeyboardEvent): void {
    const snapshot = options.runtime.snapshot();
    if (snapshot.result) {
      if (event.key === "z" || event.key === "Z" || event.key === "Enter") {
        event.preventDefault();
        if (!resultSent) {
          resultSent = true;
          window.clearTimeout(resultTimer ?? undefined);
          options.onResult(snapshot.result, snapshot);
        }
      }
      return;
    }
    if (sequenceBusy) return;
    // 자동전투/속도 토글은 연출 중에는 무시한다 — 다른 키와 같은 규칙을 따른다(결함 2).
    if (event.key === "a" || event.key === "A") {
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
    if (shiftHeld) shiftCombined = true;
    if (event.key === "c" || event.key === "C" || event.key === "x" || event.key === "X" || event.key === "Escape") {
      event.preventDefault();
      handleCancel(snapshot);
      return;
    }
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      if (snapshot.phase === "targetSelect") {
        event.preventDefault();
        cycleTarget(snapshot, -1);
      }
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      if (snapshot.phase === "targetSelect") {
        event.preventDefault();
        cycleTarget(snapshot, 1);
      }
      return;
    }
    if (event.key === "z" || event.key === "Z" || event.key === "Enter") {
      event.preventDefault();
      handleConfirm(snapshot);
    }
  }
  root.addEventListener("keydown", onKeydown);
  function onWindowKeydown(event: KeyboardEvent): void {
    if (document.activeElement === root) return;
    if (!root.isConnected) return;
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
    // 텍스트 입력 중·연출 중에는 토글하지 않는다(결함 2).
    if (!sequenceBusy && shiftHeld && !shiftCombined && root.isConnected && !isTextInputTarget(event.target)) {
      toggleSpeed();
    }
    shiftHeld = false;
    shiftCombined = false;
  }
  window.addEventListener("keyup", onWindowKeyup);

  function handleConfirm(snapshot: BattleSnapshot): void {
    if (snapshot.phase === "targetSelect") {
      const selectedId = snapshot.targetSelection?.selectedEnemyId
        ?? snapshot.targetSelection?.targetEnemyIds[0];
      if (selectedId) confirmTargetSelection(selectedId);
      return;
    }
    if (snapshot.phase === "actorCommand" && submenu === null) {
      beginTargetCommand({ kind: "attack" });
    }
  }

  function handleCancel(snapshot: BattleSnapshot): void {
    if (submenu !== null) {
      submenu = null;
      panelOptions.submenu = null;
      syncView();
      return;
    }
    if (snapshot.phase === "targetSelect") {
      options.runtime.cancelTargetSelection();
      directorState = commandPromptState(options.runtime.snapshot());
      syncView();
    }
  }

  function cycleTarget(snapshot: BattleSnapshot, direction: 1 | -1 = 1): void {
    if (snapshot.phase !== "targetSelect") return;
    const ids = snapshot.targetSelection?.targetEnemyIds ?? [];
    if (ids.length <= 1) return;
    const current = snapshot.targetSelection?.selectedEnemyId ?? ids[0];
    const index = ids.indexOf(current);
    const nextId = ids[(index + direction + ids.length) % ids.length];
    options.runtime.setSelectedTargetEnemy(nextId);
    directorState = targetSelectDirectorState(options.runtime.snapshot());
    syncView();
  }

  function syncView(): void {
    const snapshot = options.runtime.snapshot();
    if (snapshot.result) {
      directorState = resultDirectorState(snapshot, directorState);
    } else if (!sequenceBusy) {
      directorState = nextDirectorState(snapshot, directorState);
      directorState = battleEventDirectorState(snapshot, directorState);
    }
    syncBattleField(field, snapshot, lastDamageFeedback);
    syncBattleParty(partyPanel, snapshot);
    syncBattleMessageWindow(messageWindow, directorState);
    syncEnemyListPanel(enemyPanel, snapshot.enemies);
    rebuildCommandPanelIfNeeded(snapshot);
    syncResultHost(snapshot);
    applyBattleDirectorState(root, directorState, snapshot);
    activeAnimation = syncBattleAnimationLayer(animationLayer, snapshot, root);
    root.dataset.battleSequenceBusy = sequenceBusy ? "true" : "false";
    root.dataset.battleBgmActive = snapshot.result ? "false" : "true";
    scheduleAutoResult(snapshot);
    checkAutoBattleStep(snapshot);
  }

  function checkAutoBattleStep(snapshot: BattleSnapshot): void {
    if (!autoBattle || sequenceBusy || snapshot.result) return;
    if (snapshot.phase === "actorCommand") {
      const livingEnemies = snapshot.enemies.filter((e) => !e.defeated);
      if (livingEnemies.length > 0) {
        const target = livingEnemies[Math.floor(Math.random() * livingEnemies.length)];
        runActorCommand({ kind: "attack", targetEnemyId: target.id });
      }
    } else if (snapshot.phase === "targetSelect") {
      const selectedId = snapshot.targetSelection?.selectedEnemyId ?? snapshot.targetSelection?.targetEnemyIds[0];
      if (selectedId) {
        confirmTargetSelection(selectedId);
      }
    }
  }

  function rebuildCommandPanelIfNeeded(snapshot: BattleSnapshot): void {
    const signature = `${snapshot.phase}:${snapshot.activeActorId ?? ""}:${submenu?.kind ?? "none"}:${snapshot.targetSelection?.selectedEnemyId ?? ""}`;
    if (signature === commandPanelSignature && commandHost.childElementCount > 0) return;
    commandPanelSignature = signature;
    commandHost.replaceChildren(commandPanel(snapshot, panelOptions));
    markConfirmCursor(snapshot);
  }

  /** 확인 키(z/Enter)가 지금 발동시키는 명령에 커서 표식을 붙인다.
   *
   *  이 엔진의 전투 명령 메뉴는 attachCursorMenu 를 쓰지 않아 **선택 표식이 DOM 에 전혀
   *  없었다**(실측: `.selected` 0개, activeElement 는 에디터 루트). 그래서 키보드로 z 를 눌러
   *  통상공격이 나가는데도 화면에는 무엇이 선택됐는지 표시가 없었다.
   *
   *  표식은 `handleConfirm` 의 실제 분기와 정확히 일치시킨다 — `actorCommand` 이고 서브메뉴가
   *  닫혀 있을 때 z 는 **통상공격**을 실행한다. 그 조건에서만, 그 버튼에만 붙인다.
   *  서브메뉴 안에서는 z 가 아무 항목도 고르지 않으므로 아무것도 표시하지 않는다. */
  function markConfirmCursor(snapshot: BattleSnapshot): void {
    for (const node of commandHost.querySelectorAll("[data-battle-command-cursor]")) {
      node.removeAttribute("data-battle-command-cursor");
    }
    if (snapshot.phase !== "actorCommand" || submenu !== null) return;
    const attack = commandHost.querySelector<HTMLButtonElement>(
      "button.battle-command[data-testid='actor-command-attack']:not(:disabled)",
    );
    attack?.setAttribute("data-battle-command-cursor", "true");
  }

  function syncResultHost(snapshot: BattleSnapshot): void {
    if (!snapshot.result) {
      resultHost.replaceChildren();
      return;
    }
    // 결과 화면 동안은 뒤늦게 뜬 데미지 팝업 잔상을 매 동기화마다 걷어낸다.
    for (const popup of root.querySelectorAll(".battle-damage-popup")) popup.remove();
    let panel = resultHost.querySelector<HTMLElement>("[data-testid='battle-result-panel']");
    if (!panel) {
      const created = battleResultPanel(snapshot, resultRevealStage);
      if (!created) return;
      resultHost.replaceChildren(created);
      panel = created;
      // 뒤늦게 살아있는 데미지 팝업이 결과 화면 위로 새지 않도록 정리하고, 결과 연출을 1회 발화.
      for (const popup of root.querySelectorAll(".battle-damage-popup")) popup.remove();
      emitBattleJuice(snapshot.result === "victory" ? "victory" : snapshot.result === "defeat" ? "defeat" : "escape", root);
      flashBattleField(root, snapshot.result === "victory" ? "victory" : "defeat");
    }
    syncBattleResultPanel(panel, snapshot, resultRevealStage);
  }

  function scheduleAutoResult(snapshot: BattleSnapshot): void {
    const result = snapshot.result;
    if (!result || resultSent) return;
    resultSent = true;
    // 보상 행이 모두 공개될 시간을 보장한 뒤에도 잠시 머문다(클릭/Z로 즉시 종료 가능).
    const revealMs = (battleResultRewardRowCount(snapshot) + 1) * BATTLE_RESULT_STAGE_MS;
    resultTimer = window.setTimeout(() => {
      options.onResult(result, snapshot);
    }, Math.max(BATTLE_RESULT_HOLD_MS, revealMs + BATTLE_RESULT_HOLD_MS));
  }

  function runActorCommand(command: ActorCommand): void {
    if (sequenceBusy) return;
    const before = options.runtime.snapshot();
    emitSwingJuice(command, before);
    options.runtime.performActorCommand(command);
    const afterCommand = options.runtime.snapshot();
    submenu = null;
    panelOptions.submenu = null;
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
    } else if (command.kind === "escape") {
      emitBattleJuice("escape", actorNode ?? undefined);
    }
  }

  function beginTargetCommand(command: TargetedActorCommand): void {
    if (sequenceBusy) return;
    options.runtime.beginActorCommand(command);
    const snapshot = options.runtime.snapshot();
    if (snapshot.phase === "targetSelect") {
      directorState = targetSelectDirectorState(snapshot);
      submenu = null;
      panelOptions.submenu = null;
    }
    syncView();
  }

  function confirmTargetSelection(enemyId: string): void {
    if (sequenceBusy) return;
    const before = options.runtime.snapshot();
    const pending = before.targetSelection?.command;
    if (before.phase !== "targetSelect" || !pending) return;
    const command = concreteTargetCommand(pending, enemyId);
    emitSwingJuice(command, before);
    options.runtime.selectTargetEnemy(enemyId);
    const afterCommand = options.runtime.snapshot();
    if (afterCommand.phase === "targetSelect") {
      directorState = targetSelectDirectorState(afterCommand);
      syncView();
      return;
    }
    submenu = null;
    panelOptions.submenu = null;
    syncView();
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
    const actionKey = after.lastActionResult
      ? `${after.lastActionResult.targetId}:${after.lastActionResult.amount}:${after.turn}`
      : "";
    if (actionKey && actionKey !== lastEnemyActionKey) {
      lastEnemyActionKey = actionKey;
      sequencer.runAfterEnemyAdvance(before, after);
      return;
    }
    syncView();
  }, BATTLE_TICK_MS);

  let destroyed = false;
  const controller: BattleDomController = {
    root,
    destroy(): void {
      // 멱등 — 여러 경로(onResult, teardown, 재마운트)에서 중복 호출돼도 안전해야 한다.
      if (destroyed) return;
      destroyed = true;
      window.clearInterval(tickInterval);
      window.removeEventListener("keydown", onWindowKeydown);
      window.removeEventListener("keyup", onWindowKeyup);
      if (resultTimer !== undefined) window.clearTimeout(resultTimer);
      sequencer.cancel();
      activeAnimation?.destroy();
      stageScale.cleanup();
      root.remove();
      activeBattleControllers.delete(options.host);
    },
  };
  activeBattleControllers.set(options.host, controller);
  return controller;
}
