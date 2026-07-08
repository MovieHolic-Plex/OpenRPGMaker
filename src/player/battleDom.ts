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

const ANIMATION_HOLD_MS = 1_500;
// 세미 액티브 틱 주기. charging 단계 게이지 자동 충전을 위한 폴링 간격.
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
  let submenu: BattleCommandSubmenu = null;
  let activeAnimation: BattleAnimationPlayback | undefined;
  let directorState: BattleDirectorState | undefined;

  root.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const target = event.target.closest<HTMLElement>(".battle-enemy[data-battle-targetable='true']");
    if (!target?.dataset.testid) return;
    confirmTargetSelection(target.dataset.testid);
  });

  // 키보드 조작(Z/X/C). 화면에 표시된 안내와 실제 동작을 일치시킨다.
  // Z=확정, X=대상 변경(다음 적), C=취소.
  root.tabIndex = 0;
  function onKeydown(event: KeyboardEvent): void {
    const snapshot = options.runtime.snapshot();
    if (snapshot.result) {
      // 결과 화면: Z(또는 Enter/Space)로 계속 진행 → onResult 즉시 호출.
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
    if (event.key === "c" || event.key === "C") {
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
  // 화면이 포커스를 받지 않아도 동작하도록 window 레벨에서도 수신(중복 방지는 focus 체크).
  function onWindowKeydown(event: KeyboardEvent): void {
    if (document.activeElement === root) return;
    if (!root.isConnected) return;
    onKeydown(event);
  }
  window.addEventListener("keydown", onWindowKeydown);

  // Z: 현재 단계에서의 확정 동작.
  function handleConfirm(snapshot: BattleSnapshot): void {
    if (snapshot.phase === "targetSelect") {
      const selectedId = snapshot.targetSelection?.selectedEnemyId
        ?? snapshot.targetSelection?.targetEnemyIds[0];
      if (selectedId) confirmTargetSelection(selectedId);
      return;
    }
    if (snapshot.phase === "actorCommand" && submenu === null) {
      // 기본 동작: 통상 공격으로 대상 선택 진입.
      beginTargetCommand({ kind: "attack" });
    }
  }

  // C: 취소. 서브메뉴 닫기 → 대상 선택 취소 순.
  function handleCancel(snapshot: BattleSnapshot): void {
    if (submenu !== null) {
      submenu = null;
      render();
      return;
    }
    if (snapshot.phase === "targetSelect") {
      options.runtime.cancelTargetSelection();
      directorState = commandPromptState(options.runtime.snapshot());
      render();
    }
  }

  // X: 대상을 다음 적으로 순환(대상 선택 단계에서만).
  function cycleTarget(snapshot: BattleSnapshot): void {
    if (snapshot.phase !== "targetSelect") return;
    const ids = snapshot.targetSelection?.targetEnemyIds ?? [];
    if (ids.length <= 1) return;
    const current = snapshot.targetSelection?.selectedEnemyId ?? ids[0];
    const index = ids.indexOf(current);
    const nextId = ids[(index + 1) % ids.length];
    options.runtime.setSelectedTargetEnemy(nextId);
    directorState = targetSelectDirectorState(options.runtime.snapshot());
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
          submenu = next;
        },
        setDirectorState: (state) => {
          directorState = state;
        },
        render,
        runActorCommand,
        beginTargetCommand,
        confirmTargetSelection,
      }),
      battlePartyStatus(snapshot)
    );
    const resultPanel = battleResultPanel(snapshot);
    if (resultPanel) root.append(resultPanel);
    applyBattleDirectorState(root, directorState, snapshot);
    activeAnimation = mountBattleAnimationPlayback(snapshot);
    if (activeAnimation) {
      root.append(activeAnimation.element);
    }
    const result = snapshot.result;
    if (result && !resultSent) {
      resultSent = true;
      resultTimer = window.setTimeout(() => {
        options.onResult(result, snapshot);
      }, ANIMATION_HOLD_MS);
    }
  }

  function runActorCommand(command: ActorCommand): void {
    const before = options.runtime.snapshot();
    options.runtime.performActorCommand(command);
    const afterCommand = options.runtime.snapshot();
    directorState = actorCommandDirectorState(command, before, afterCommand);
    advanceBattleRuntime(options.runtime);
    const afterAdvance = options.runtime.snapshot();
    directorState = resultDirectorState(afterAdvance, directorState);
    submenu = null;
    render();
  }

  function beginTargetCommand(command: TargetedActorCommand): void {
    options.runtime.beginActorCommand(command);
    const snapshot = options.runtime.snapshot();
    if (snapshot.phase === "targetSelect") {
      directorState = targetSelectDirectorState(snapshot);
      submenu = null;
    }
    render();
  }

  function confirmTargetSelection(enemyId: string): void {
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
    directorState = actorCommandDirectorState(command, before, afterCommand);
    advanceBattleRuntime(options.runtime);
    const afterAdvance = options.runtime.snapshot();
    directorState = resultDirectorState(afterAdvance, directorState);
    submenu = null;
    render();
  }

  function nextDirectorState(
    snapshot: BattleSnapshot,
    previous: BattleDirectorState | undefined
  ): BattleDirectorState {
    if (!previous) return initialBattleDirectorState(snapshot);
    if (snapshot.result) return resultDirectorState(snapshot, previous);
    if (snapshot.phase === "targetSelect") return targetSelectDirectorState(snapshot);
    if (snapshot.phase === "actorCommand" && shouldRefreshCommandPrompt(snapshot, previous)) return commandPromptState(snapshot);
    return previous;
  }

  function shouldRefreshCommandPrompt(snapshot: BattleSnapshot, previous: BattleDirectorState): boolean {
    return previous.step === "command" || previous.activeActorRecordId !== snapshot.activeActorId;
  }

  render();

  // 세미 액티브 틱: charging 단계에서 게이지가 자동 충전되어 적이 자동 행동.
  // actorCommand(플레이어 입력 대기) 중에는 정지한다(advanceBattleRuntime 이 알아서 멈춤).
  const tickInterval = window.setInterval(() => {
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
      activeAnimation?.destroy();
      root.remove();
    },
  };
}
