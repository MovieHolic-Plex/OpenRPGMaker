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

export function mountBattleScene(options: BattleDomOptions): BattleDomController {
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
  root.append(field, animationLayer, messageWindow, enemyPanel, commandHost, partyPanel, resultHost);

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
    onKeydown(event);
  }
  window.addEventListener("keydown", onWindowKeydown);

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
  }

  function rebuildCommandPanelIfNeeded(snapshot: BattleSnapshot): void {
    const signature = `${snapshot.phase}:${snapshot.activeActorId ?? ""}:${submenu?.kind ?? "none"}:${snapshot.targetSelection?.selectedEnemyId ?? ""}`;
    if (signature === commandPanelSignature && commandHost.childElementCount > 0) return;
    commandPanelSignature = signature;
    commandHost.replaceChildren(commandPanel(snapshot, panelOptions));
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

  return {
    root,
    destroy(): void {
      window.clearInterval(tickInterval);
      window.removeEventListener("keydown", onWindowKeydown);
      if (resultTimer !== undefined) window.clearTimeout(resultTimer);
      sequencer.cancel();
      activeAnimation?.destroy();
      root.remove();
    },
  };
}
