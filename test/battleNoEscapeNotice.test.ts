import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { commandPanel, type BattleCommandPanelOptions } from "@/player/battleCommandDom";
import { applyBattleDirectorState, commandPromptState } from "@/player/battleDirectorDom";
import { noEscapeNoticeLine } from "@/player/emeraldBattleNarration";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_TROOP_ID } from "@/project/defaults/constants";
import { store } from "@/project/store";
import { installFakeDom, type FakeElement } from "./fakeDom";

let restoreDom: (() => void) | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
});

function panelOptions(runtime: ReturnType<typeof createBattleRuntime>): BattleCommandPanelOptions {
  return {
    runtime,
    submenu: null,
    setSubmenu: () => undefined,
    setDirectorState: () => undefined,
    render: () => undefined,
    runActorCommand: () => undefined,
    beginTargetCommand: () => undefined,
    confirmTargetSelection: () => undefined,
  };
}

describe("blocked escape notice", () => {
  it("tells the player this fight forbids escape, using the project's escape term", () => {
    const project = createBlankProject();
    project.meta.terms.escape = "도주";
    store.replace(project);
    const runtime = createBattleRuntime({
      project,
      troopId: DEFAULT_TROOP_ID,
      canEscape: false,
      canLose: true,
      battleFlow: "strict",
      rng: () => 0.5,
    });
    const snapshot = runtime.snapshot();
    const root = commandPanel(snapshot, panelOptions(runtime)) as unknown as FakeElement;
    const escape = root.querySelector("[data-testid='actor-command-escape']");
    if (!escape) throw new Error("missing escape command");

    expect(escape.dataset.battleCommandInert).toBe("true");
    expect(escape.dataset.battleCommandInertReason).toBe("이 싸움에서는 도주할 수 없습니다.");
    expect(escape.getAttribute("aria-label")).toBe("도주: 이 싸움에서는 도주할 수 없습니다.");
    expect(noEscapeNoticeLine(snapshot)).toBe("이 싸움에서는 도주할 수 없습니다.");

    const scene = document.createElement("div");
    applyBattleDirectorState(scene, { ...commandPromptState(snapshot, noEscapeNoticeLine(snapshot)), flash: true }, snapshot);
    expect(scene.dataset.battleNotice).toBe("true");
    expect(scene.dataset.battleDirectorStep).toBe("command");
    applyBattleDirectorState(scene, commandPromptState(snapshot), snapshot);
    expect(scene.dataset.battleNotice).toBeUndefined();
  });

  it("leaves escape usable when the fight allows it", () => {
    const project = createBlankProject();
    store.replace(project);
    const runtime = createBattleRuntime({
      project,
      troopId: DEFAULT_TROOP_ID,
      canEscape: true,
      canLose: true,
      battleFlow: "strict",
      rng: () => 0.5,
    });
    const root = commandPanel(runtime.snapshot(), panelOptions(runtime)) as unknown as FakeElement;
    const escape = root.querySelector("[data-testid='actor-command-escape']");
    if (!escape) throw new Error("missing escape command");
    expect(escape.dataset.battleCommandInert).toBeUndefined();
  });

  it("keeps the monster-battle sentence for the pokemon skin", () => {
    const project = createBlankProject();
    project.system.battleUiStyle = "pokemon";
    store.replace(project);
    expect(noEscapeNoticeLine({ troopId: "no_such_troop" })).toBe("도망칠 수 없다!");
  });
});
