/** @vitest-environment happy-dom */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { playBattle } from "@/player/playSceneBattle";
import { createDialogueUI } from "@/player/dialogue";
import { destroyBattleSceneOnHost } from "@/player/battleDom";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import { ACTOR, TROOP, battleCase, choice, m2, mark } from "./battleEventRepairFlow.fixture";

const previousProject = store.getCurrent();
const hosts: HTMLElement[] = [];
const aborters: AbortController[] = [];
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  for (const controller of aborters.splice(0)) controller.abort();
  for (const host of hosts.splice(0)) { destroyBattleSceneOnHost(host); host.remove(); }
  vi.clearAllTimers(); vi.useRealTimers(); store.replaceProject(previousProject);
});
function setup(flow: "gauge" | "strict" = "strict") {
  const { project } = battleCase({ flow, commands: [choice({ options: [
    { text: "First", branch: [mark("first"), m2("m2-107-force-escape")] },
    { text: "Second", branch: [mark("second"), m2("m2-107-force-escape")] },
  ] })] });
  project.system.startActorIds = [ACTOR]; project.session.partyActorIds = [ACTOR];
  store.replaceProject(project);
  const host = document.createElement("div"); document.body.append(host); hosts.push(host);
  const dialogue = createDialogueUI(host);
  const session = startSession(project);
  const battleAbortController = new AbortController(); aborters.push(battleAbortController);
  const scene = { session, tileY: 0, map: { height: 20 }, battleAbortController,
    // An authored gameOver/killPlayer in the troop hands off to the host's game-over screen.
    showGameOverScreen: vi.fn(),
    game: { registry: { get: (key: string) => key === "dialogueHost" ? host : key === "dialogue" ? dialogue : undefined } },
  };
  const step = { kind: "battleProcessing", troopId: TROOP, canEscape: false, canLose: true, battleFlow: flow } as const;
  return { project, host, scene, session, battleAbortController, step };
}
function key(value: string) {
  (document.activeElement ?? document).dispatchEvent(new KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true }));
}
async function openChoice(host: HTMLElement) {
  await vi.advanceTimersByTimeAsync(30_000);
  const defend = host.querySelector<HTMLElement>("[data-testid='actor-command-defend']");
  assert.ok(defend); defend.focus(); key("Enter");
  await vi.advanceTimersByTimeAsync(30_000);
  expect(host.querySelector("[data-testid='runtime-choices']")).not.toBeNull();
}

describe("playBattle cancellation boundary", () => {
  it("abort during entry settles without mounting or writing a result", async () => {
    const { scene, step, host, session, battleAbortController } = setup();
    const before = structuredClone(session.variables);
    const pending = playBattle(scene, step, 0);
    battleAbortController.abort();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(host.querySelector("[data-testid='battle-scene']")).toBeNull();
    expect(await pending).toBeNull();
    expect(session.variables).toEqual(before);
    expect(host.querySelector("[data-testid='battle-transition-overlay']")).toBeNull();
  });

  it.each(["gauge", "strict"] as const)("%s uses real keyboard input and writes back only the chosen branch", async flow => {
    const { scene, step, host, session } = setup(flow);
    const pending = playBattle(scene, step, 0);
    await openChoice(host);
    expect(session.variables.second).toBeUndefined();
    key("ArrowDown"); key("z");
    await vi.advanceTimersByTimeAsync(30_000);
    // 전투 이벤트의 「전투 중단」(m2-107-force-escape)이 끝낸 전투는 「후퇴」 결과 상자 없이 바로 필드로 돌아간다(574cd06132, endedByEvent).
    expect(host.querySelector("[data-testid='battle-result-panel']")).toBeNull();
    expect(await pending).toBe("escape");
    expect(session.variables.second).toBe(1);
    expect(session.variables.first).toBeUndefined();
    expect(session.variables.after).toBeUndefined();
  });

  it("replacing the session while choices are open abandons the old write-back and listener", async () => {
    const { project, scene, step, host, session, battleAbortController } = setup();
    const pending = playBattle(scene, step, 0);
    await openChoice(host);
    const replacement = startSession(project); replacement.variables.second = 71;
    scene.session = replacement; battleAbortController.abort();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(await pending).toBeNull();
    key("ArrowDown"); key("Enter");
    expect(replacement.variables.second).toBe(71);
    expect(session.variables.second).toBeUndefined();
    expect(host.querySelector("[data-testid='runtime-choices']")).toBeNull();
  });

  it("host teardown after accepting a result cancels before reward/state write-back", async () => {
    const { scene, step, host, session } = setup();
    const pending = playBattle(scene, step, 0);
    await openChoice(host);
    key("ArrowDown"); key("Enter");
    // 전투 이벤트가 끝낸 전투는 결과 상자가 없다(574cd06132) — 결과는 마이크로태스크로 바로 호스트에 넘어간다.
    // 그 넘김을 한 번 흘려보낸 뒤(= 결과 수락) 호스트를 걷어도 보상·상태 기록 전에 취소돼야 한다.
    expect(host.querySelector("[data-testid='battle-result-panel']")).toBeNull();
    await Promise.resolve();
    destroyBattleSceneOnHost(host);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(await pending).toBeNull();
    expect(session.variables.second).toBeUndefined();
    expect(host.querySelector("[data-testid='battle-transition-overlay']")).toBeNull();
  });
});
