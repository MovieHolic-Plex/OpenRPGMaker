import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { commandPanel, type BattleCommandPanelOptions } from "@/player/battleCommandDom";
import { applyBattleDirectorState, commandPromptState } from "@/player/battleDirectorDom";
import { noEscapeInlineReason, noEscapeNoticeLine } from "@/player/emeraldBattleNarration";
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
    // 버튼 안 한 줄은 짧은 형태 — 전체 문장은 2열 메뉴에서 「도주할 수…」로 잘렸다(1.36 VQA #4 #5 #8 #9 #27). 전체 문장은 위 배너가 말한다.
    expect(escape.dataset.battleCommandInertReason).toBe("도주 불가");
    expect(escape.getAttribute("aria-label")).toBe("도주: 도주 불가");
    expect(noEscapeInlineReason(snapshot)).toBe("도주 불가");
    expect(noEscapeNoticeLine(snapshot)).toBe("이 싸움에서는 도주할 수 없습니다.");

    const scene = document.createElement("div");
    applyBattleDirectorState(scene, { ...commandPromptState(snapshot, noEscapeNoticeLine(snapshot)), flash: true }, snapshot);
    expect(scene.dataset.battleNotice).toBe("true");
    expect(scene.dataset.battleDirectorStep).toBe("command");
    applyBattleDirectorState(scene, commandPromptState(snapshot), snapshot);
    expect(scene.dataset.battleNotice).toBeUndefined();
  });

  it("keeps a short inline reason but moves a long root reason to the cursor hint line (no spill onto the next row)", () => {
    const project = createBlankProject();
    project.meta.terms.escape = "도주";
    store.replace(project);
    const runtime = createBattleRuntime({ project, troopId: DEFAULT_TROOP_ID, canEscape: false, canLose: true, battleFlow: "strict", rng: () => 0.5 });
    const root = commandPanel(runtime.snapshot(), panelOptions(runtime)) as unknown as FakeElement;
    expect(root.querySelector("[data-testid='actor-command-escape-reason']")?.textContent).toBe("도주 불가");

    project.meta.terms.escape = "후퇴 후 재집결";
    store.replace(project);
    const longRoot = commandPanel(runtime.snapshot(), panelOptions(runtime)) as unknown as FakeElement;
    const escape = longRoot.querySelector("[data-testid='actor-command-escape']");
    expect(escape?.dataset.battleCommandInertReason).toBe("후퇴 후 재집결 불가");
    expect(longRoot.querySelector("[data-testid='actor-command-escape-reason']")).toBeNull();
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
