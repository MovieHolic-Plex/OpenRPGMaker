import type {
  ActorCommand,
  BattleResult,
  BattleRuntime,
  BattleSnapshot,
  TargetedActorCommand,
} from "@/battle/runtime";
import { concreteTargetCommand } from "@/battle/runtime";
import { advanceBattleRuntime } from "@/battle/battleRuntimeAdvance";
import type { BattleAnimationPlayback } from "@/player/battleAnimationDom";
import { mountBattleAnimationPlayback } from "@/player/battleAnimationDom";
import { commandPanel, enemyListPanel, type BattleCommandSubmenu } from "@/player/battleCommandDom";
import {
  actorCommandDirectorState,
  applyBattleDirectorState,
  battleMessageWindow,
  battleEventDirectorState,
  battleResultPanel,
  commandPromptState,
  initialBattleDirectorState,
  resultDirectorState,
  targetSelectDirectorState,
  type BattleDirectorState,
} from "@/player/battleDirectorDom";
import { emitBattleJuice, flashBattleField, spawnDamagePopup } from "@/player/battleJuice";
import { battleField, battlePartyStatus } from "@/player/battleFieldDom";
import { applyBattleSystemGraphic } from "@/player/systemGraphics";

export interface BattleDomOptions {
  readonly host: HTMLElement;
  readonly runtime: BattleRuntime;
  readonly onResult: (result: BattleResult, snapshot: BattleSnapshot) => void;
}

export interface BattleDomController {
  readonly root: HTMLElement;
  destroy(): void;
}

const RESULT_HOLD_MS = 2_200;
// 행동 연출 비트: 메시지가 한 박자 읽히고 타격감이 생긴 뒤 다음 입력으로 넘어간다.
const RESOLVE_HOLD_MS = 850;
const BATTLE_TICK_MS = 200;

export function mountBattleScene(options: BattleDomOptions): BattleDomController {
  options.host.querySelector("[data-testid='battle-scene']")?.remove();
  const root = document.createElement("section");
  root.className = "battle-scene";
  root.dataset.testid = "battle-scene";
  applyBattleSystemGraphic(root);
  options.host.append(root);

  let resultSent = false;
  let resultTimer: number | undefined;
  let resolveTimer: number | undefined;
  let resolveLocked = false;
  let submenu: BattleCommandSubmenu = null;
  let activeAnimation: BattleAnimationPlayback | undefined;
  let directorState: BattleDirectorState | undefined;

  root.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    if (resolveLocked) return;
    const resultConfirm = event.target.closest<HTMLElement>(".battle-result-confirm, .battle-result-panel");
    if (resultConfirm && options.runtime.snapshot().result) {
      finishResultEarly();
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
      if (event.key === "z" || event.key === "Z" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        finishResultEarly();
      }
      return;
    }
    if (resolveLocked) {
      // 연출 중 Z/Enter 로 비트 스킵 → 바로 다음 입력 페이즈.
      if (event.key === "z" || event.key === "Z" || event.key === "Enter") {
        event.preventDefault();
        endResolveLock(true);
      }
      return;
    }
    if (event.key === "c" || event.key === "C" || event.key === "Escape") {
      event.preventDefault();
      handleCancel(snapshot);
      return;
    }
    if (event.key === "x" || event.key === "X") {
      event.preventDefault();
      cycleTarget(snapshot);
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
      emitBattleJuice("command-confirm");
      beginTargetCommand({ kind: "attack" });
    }
  }

  function handleCancel(snapshot: BattleSnapshot): void {
    if (submenu !== null) {
      submenu = null;
      emitBattleJuice("command-cancel");
      render();
      return;
    }
    if (snapshot.phase === "targetSelect") {
      options.runtime.cancelTargetSelection();
      directorState = commandPromptState(options.runtime.snapshot());
      emitBattleJuice("command-cancel");
      render();
    }
  }

  function cycleTarget(snapshot: BattleSnapshot): void {
    if (snapshot.phase !== "targetSelect") return;
    const ids = snapshot.targetSelection?.targetEnemyIds ?? [];
    if (ids.length <= 1) return;
    const current = snapshot.targetSelection?.selectedEnemyId ?? ids[0];
    const index = ids.indexOf(current);
    const nextId = ids[(index + 1) % ids.length];
    options.runtime.setSelectedTargetEnemy(nextId);
    directorState = targetSelectDirectorState(options.runtime.snapshot());
    emitBattleJuice("command-select");
    render();
  }

  function render(): void {
    const snapshot = options.runtime.snapshot();
    directorState = nextDirectorState(snapshot, directorState);
    directorState = battleEventDirectorState(snapshot, directorState);
    activeAnimation?.destroy();
    activeAnimation = undefined;
    root.replaceChildren();
    root.append(
      battleField(snapshot),
      battleMessageWindow(directorState),
      enemyListPanel(snapshot),
      commandPanel(snapshot, {
        runtime: options.runtime,
        submenu,
        setSubmenu: (next) => {
          unlockResolveForInput();
          submenu = next;
          if (next) emitBattleJuice("command-select");
        },
        setDirectorState: (state) => {
          directorState = state;
        },
        render: () => {
          unlockResolveForInput();
          render();
        },
        runActorCommand,
        beginTargetCommand,
        confirmTargetSelection,
      }),
      battlePartyStatus(snapshot)
    );
    const resultPanel = battleResultPanel(snapshot);
    if (resultPanel) root.append(resultPanel);
    applyBattleDirectorState(root, directorState, snapshot);
    root.dataset.battleResolve = resolveLocked ? "true" : "false";
    activeAnimation = mountBattleAnimationPlayback(snapshot);
    if (activeAnimation) {
      root.append(activeAnimation.element);
    }
    const result = snapshot.result;
    if (result && !resultSent) {
      resultSent = true;
      if (result === "victory") {
        emitBattleJuice("victory");
        flashBattleField(root, "victory");
      } else if (result === "defeat") {
        emitBattleJuice("defeat");
        flashBattleField(root, "defeat");
      }
      resultTimer = window.setTimeout(() => {
        options.onResult(result, snapshot);
      }, RESULT_HOLD_MS);
    }
  }

  type ResolveBeat = {
    readonly state: BattleDirectorState;
    readonly command?: ActorCommand;
    readonly before?: BattleSnapshot;
    readonly after?: BattleSnapshot;
    readonly enemyHit?: boolean;
  };

  let pendingBeats: ResolveBeat[] = [];

  /** Skip remaining resolve beat so the next player command is never dropped. */
  function unlockResolveForInput(): void {
    if (!resolveLocked) return;
    window.clearTimeout(resolveTimer);
    resolveTimer = undefined;
    pendingBeats = [];
    resolveLocked = false;
    root.dataset.battleResolve = "false";
  }

  function runActorCommand(command: ActorCommand): void {
    unlockResolveForInput();
    const before = options.runtime.snapshot();
    options.runtime.performActorCommand(command);
    const afterCommand = options.runtime.snapshot();
    const actionState = actorCommandDirectorState(command, before, afterCommand);
    advanceBattleRuntime(options.runtime);
    const afterAdvance = options.runtime.snapshot();
    submenu = null;
    startResolveBeats(buildResolveBeats(command, actionState, before, afterCommand, afterAdvance), afterAdvance);
  }

  function beginTargetCommand(command: TargetedActorCommand): void {
    unlockResolveForInput();
    options.runtime.beginActorCommand(command);
    const snapshot = options.runtime.snapshot();
    if (snapshot.phase === "targetSelect") {
      directorState = targetSelectDirectorState(snapshot);
      submenu = null;
      emitBattleJuice("command-select");
    }
    render();
  }

  function confirmTargetSelection(enemyId: string): void {
    unlockResolveForInput();
    const before = options.runtime.snapshot();
    const pending = before.targetSelection?.command;
    if (before.phase !== "targetSelect" || !pending) return;
    const command = concreteTargetCommand(pending, enemyId);
    options.runtime.selectTargetEnemy(enemyId);
    const afterCommand = options.runtime.snapshot();
    if (afterCommand.phase === "targetSelect") {
      directorState = targetSelectDirectorState(afterCommand);
      render();
      return;
    }
    const actionState = actorCommandDirectorState(command, before, afterCommand);
    advanceBattleRuntime(options.runtime);
    const afterAdvance = options.runtime.snapshot();
    submenu = null;
    startResolveBeats(buildResolveBeats(command, actionState, before, afterCommand, afterAdvance), afterAdvance);
  }

  function buildResolveBeats(
    command: ActorCommand,
    actionState: BattleDirectorState,
    before: BattleSnapshot,
    afterCommand: BattleSnapshot,
    afterAdvance: BattleSnapshot
  ): ResolveBeat[] {
    const beats: ResolveBeat[] = [
      { state: actionState, command, before, after: afterCommand },
    ];
    const enemy = enemyCounterBeat(afterCommand, afterAdvance);
    if (enemy) beats.push(enemy);
    if (afterAdvance.result) {
      beats.push({ state: resultDirectorState(afterAdvance, actionState) });
    }
    return beats;
  }

  function enemyCounterBeat(afterPlayer: BattleSnapshot, afterAdvance: BattleSnapshot): ResolveBeat | undefined {
    const result = afterAdvance.lastActionResult;
    if (!result) return undefined;
    // If last action is still the player's, no enemy follow-up was applied.
    const playerIds = new Set(afterPlayer.actors.map((actor) => actor.recordId));
    if (playerIds.has(result.userRecordId)) return undefined;
    const enemy = afterAdvance.enemies.find((entry) => entry.recordId === result.userRecordId || entry.id === result.userRecordId);
    const target = afterAdvance.actors.find((entry) => entry.id === result.targetId || entry.recordId === result.targetId);
    const enemyName = enemy?.name ?? "적";
    const targetName = target?.name ?? "아군";
    if (!result.hit) {
      return {
        state: {
          step: "impact",
          lines: [`${enemyName}의 공격!`, "빗나갔다!"],
          targetId: result.targetId,
        },
        enemyHit: true,
        after: afterAdvance,
      };
    }
    return {
      state: {
        step: "impact",
        lines: [
          result.skillName ? `${enemyName}의 ${result.skillName}!` : `${enemyName}의 공격!`,
          result.critical
            ? `급소에 맞았다! ${targetName}에게 ${result.amount} 피해!`
            : `${targetName}에게 ${result.amount} 피해!`,
        ],
        targetId: result.targetId,
      },
      enemyHit: true,
      after: afterAdvance,
    };
  }

  function startResolveBeats(beats: ResolveBeat[], afterAdvance: BattleSnapshot): void {
    pendingBeats = beats;
    resolveLocked = true;
    window.clearTimeout(resolveTimer);
    playNextBeat(afterAdvance);
  }

  function playNextBeat(afterAdvance: BattleSnapshot): void {
    const beat = pendingBeats.shift();
    if (!beat) {
      endResolveLock(false);
      return;
    }
    directorState = afterAdvance.result && pendingBeats.length === 0
      ? resultDirectorState(afterAdvance, beat.state)
      : beat.state;
    render();
    window.requestAnimationFrame(() => applyBeatJuice(beat));

    if (afterAdvance.result && pendingBeats.length === 0) {
      resolveLocked = false;
      root.dataset.battleResolve = "false";
      return;
    }
    resolveTimer = window.setTimeout(() => playNextBeat(afterAdvance), RESOLVE_HOLD_MS);
  }

  function applyBeatJuice(beat: ResolveBeat): void {
    if (beat.command) {
      if (beat.command.kind === "defend") {
        emitBattleJuice("defend");
        return;
      }
      if (beat.command.kind === "escape") {
        emitBattleJuice("escape");
        return;
      }
      if (
        beat.command.kind === "attack"
        || beat.command.kind === "skill"
        || beat.command.kind === "item"
        || beat.command.kind === "capture"
      ) {
        emitBattleJuice("attack-swing");
      }
    }

    const after = beat.after;
    const result = after?.lastActionResult;
    const targetId = beat.state.targetId ?? result?.targetId;
    const liveTarget = targetId
      ? root.querySelector<HTMLElement>(`[data-testid='${cssEscape(targetId)}']`)
      : null;
    const anchorNode =
      liveTarget?.querySelector<HTMLElement>(".battle-enemy-image, .battle-actor-sprite")
      ?? liveTarget;
    const anchor = anchorNode?.getBoundingClientRect() ?? null;

    if (result && !result.hit) {
      emitBattleJuice("hit-miss", liveTarget);
      spawnDamagePopup(root, { amount: 0, miss: true, anchor });
      return;
    }
    const amount = Math.max(
      0,
      result?.amount
        ?? (beat.before && after ? damageFromSnapshots(targetId, beat.before, after) : 0)
    );
    if (amount <= 0) return;
    const critical = Boolean(result?.critical);
    emitBattleJuice(critical ? "hit-critical" : "hit-damage", liveTarget);
    flashBattleField(root, critical ? "critical" : "hit");
    spawnDamagePopup(root, { amount, critical, anchor });
  }

  function endResolveLock(fromSkip: boolean): void {
    if (!resolveLocked && !fromSkip) return;
    window.clearTimeout(resolveTimer);
    resolveTimer = undefined;
    pendingBeats = [];
    resolveLocked = false;
    const snapshot = options.runtime.snapshot();
    if (snapshot.result) {
      root.dataset.battleResolve = "false";
      return;
    }
    if (snapshot.phase === "actorCommand") {
      directorState = commandPromptState(snapshot);
    }
    render();
  }

  function finishResultEarly(): void {
    const snapshot = options.runtime.snapshot();
    if (!snapshot.result || !resultSent) return;
    window.clearTimeout(resultTimer);
    resultTimer = undefined;
    options.onResult(snapshot.result, snapshot);
  }

  function nextDirectorState(
    snapshot: BattleSnapshot,
    previous: BattleDirectorState | undefined
  ): BattleDirectorState {
    if (!previous) return initialBattleDirectorState(snapshot);
    if (snapshot.result) return resultDirectorState(snapshot, previous);
    if (snapshot.phase === "targetSelect") return targetSelectDirectorState(snapshot);
    // 연출 비트 중에는 impact/acting 메시지를 유지한다.
    if (resolveLocked && (previous.step === "impact" || previous.step === "acting")) return previous;
    if (snapshot.phase === "actorCommand" && shouldRefreshCommandPrompt(snapshot, previous)) {
      return commandPromptState(snapshot);
    }
    return previous;
  }

  function shouldRefreshCommandPrompt(snapshot: BattleSnapshot, previous: BattleDirectorState): boolean {
    // Submenu / post-resolve: once the player is free again, restore the command prompt.
    if (previous.step === "command") return true;
    if (previous.activeActorRecordId !== snapshot.activeActorId) return true;
    if (!resolveLocked && (previous.step === "acting" || previous.step === "impact")) return true;
    return false;
  }

  render();
  // 포커스를 받아 키 입력이 바로 먹히게.
  window.requestAnimationFrame(() => root.focus({ preventScroll: true }));

  const tickInterval = window.setInterval(() => {
    if (resolveLocked) return;
    const snapshot = options.runtime.snapshot();
    if (snapshot.result || snapshot.phase !== "charging") return;
    advanceBattleRuntime(options.runtime);
    render();
  }, BATTLE_TICK_MS);

  return {
    root,
    destroy(): void {
      window.clearInterval(tickInterval);
      window.removeEventListener("keydown", onWindowKeydown);
      if (resultTimer !== undefined) window.clearTimeout(resultTimer);
      if (resolveTimer !== undefined) window.clearTimeout(resolveTimer);
      activeAnimation?.destroy();
      root.remove();
    },
  };
}

function damageFromSnapshots(
  enemyId: string | undefined,
  before: BattleSnapshot,
  after: BattleSnapshot
): number {
  if (!enemyId) return 0;
  const beforeEnemy = before.enemies.find((enemy) => enemy.id === enemyId);
  const afterEnemy = after.enemies.find((enemy) => enemy.id === enemyId);
  if (!beforeEnemy || !afterEnemy) return 0;
  return Math.max(0, beforeEnemy.hp - afterEnemy.hp);
}

function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(value);
  return value.replace(/["\\]/g, "\\$&");
}
