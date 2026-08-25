import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createZoneFeedbackModel,
  interactionPromptLabel,
  updateZoneFeedback,
} from "@/player/zoneFeedback";
import {
  createPlaySceneZoneFeedback,
  createZoneFeedbackDom,
  destroyPlaySceneZoneFeedback,
  feedbackSuppressedByOverlay,
  syncPlaySceneZoneFeedback,
  type ZoneFeedbackScene,
} from "@/player/playSceneZoneFeedback";
import { ensureM2Runtime } from "@/player/interpreter/m2RuntimeState";
import type { M2UiCommandState } from "@/project/sessionRuntimeTypes"
import { createBlankProject } from "@/project/defaults/defaultProject";
import { startSession, type PlaySession } from "@/project/session";
import type { Command, EventPage } from "@/project/types";
import { installFakeDom } from "./fakeDom";

const CHECKPOINT_EVENT = "oprn:checkpoint-feedback";

function actionPage(commands: readonly Command[]): EventPage {
  return {
    id: "page-1",
    name: "interaction",
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [...commands],
  };
}

function command(surface: string, message: string, durationMs = 1600): M2UiCommandState {
  return { surface, message, durationMs };
}

function feedbackScene(session: PlaySession, host: HTMLElement): ZoneFeedbackScene {
  return {
    session,
    facing: "up",
    tileX: 0,
    tileY: 0,
    activeRuntimeEvents: () => [],
    game: { registry: { get: (key: string) => key === "dialogueHost" ? host : undefined } },
  };
}

let restoreDom: (() => void) | null = null;

beforeEach(() => {
  restoreDom = installFakeDom();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
});

describe("zone feedback model", () => {
  it("consumes only appended UI commands and never replays entries present at mount", () => {
    // Given
    const entries = [command("banner", "오래된 지역")];
    const initial = createZoneFeedbackModel(entries);
    entries.push(command("banner", "거울호"));

    // When
    const first = updateZoneFeedback(initial, { entries, nowMs: 100, prompt: null, suppressed: false });
    const second = updateZoneFeedback(first.model, { entries, nowMs: 200, prompt: null, suppressed: false });

    // Then
    expect(first.view.banner).toBe("거울호");
    expect(second.view.banner).toBe("거울호");
    expect(first.model.cursor).toBe(2);
    expect(second.model.cursor).toBe(2);
  });

  it("deduplicates repeated appended feedback and expires banners after 1.5 seconds", () => {
    // Given
    const entries: M2UiCommandState[] = [];
    const initial = createZoneFeedbackModel(entries);
    entries.push(command("banner", "왕관 능선"), command("banner", "왕관 능선"));

    // When
    const active = updateZoneFeedback(initial, { entries, nowMs: 0, prompt: null, suppressed: false });
    const expired = updateZoneFeedback(active.model, { entries, nowMs: 1500, prompt: null, suppressed: false });

    // Then
    expect(active.view.banner).toBe("왕관 능선");
    expect(active.effects).toEqual([]);
    expect(active.model.seenCount).toBe(1);
    expect(expired.view.banner).toBeNull();
  });

  it.each([
    ["수정 봉인 0/2", "수정 봉인 0/2"],
    ["수정 봉인 1/2", "수정 봉인 1/2"],
    ["수정 봉인 2/2", null],
  ])("shows only incomplete objective progress for %s", (message, expected) => {
    // Given
    const entries: M2UiCommandState[] = [];
    const initial = createZoneFeedbackModel(entries);
    entries.push(command("objectiveChip", message));

    // When
    const result = updateZoneFeedback(initial, { entries, nowMs: 0, prompt: null, suppressed: false });

    // Then
    expect(result.view.objective).toBe(expected);
  });

  it("emits one checkpoint chime effect for a new checkpoint toast", () => {
    // Given
    const entries: M2UiCommandState[] = [];
    const initial = createZoneFeedbackModel(entries);
    entries.push(command("toast", "체크포인트 · 원정 기지"));

    // When
    const first = updateZoneFeedback(initial, { entries, nowMs: 0, prompt: null, suppressed: false });
    const repeated = updateZoneFeedback(first.model, { entries, nowMs: 10, prompt: null, suppressed: false });

    // Then
    expect(first.effects).toEqual([{ kind: "checkpointChime" }]);
    expect(repeated.effects).toEqual([]);
  });

  it("resets its cursor without replay when a saved session replaces the UI array", () => {
    // Given
    const currentEntries: M2UiCommandState[] = [];
    const initial = createZoneFeedbackModel(currentEntries);
    currentEntries.push(command("toast", "현재 세션"));
    const current = updateZoneFeedback(initial, { entries: currentEntries, nowMs: 0, prompt: null, suppressed: false });
    const loadedEntries = [command("banner", "저장된 과거"), command("toast", "저장된 과거")];

    // When
    const loaded = updateZoneFeedback(current.model, { entries: loadedEntries, nowMs: 10, prompt: null, suppressed: false });

    // Then
    expect(loaded.model.cursor).toBe(2);
    expect(loaded.view.banner).toBeNull();
    expect(loaded.view.toast).toBeNull();
    expect(loaded.effects).toEqual([]);
  });

  it("consumes the first command when a session creates its UI log after scene mount", () => {
    // Given
    const firstEntries = [command("banner", "첫 지역")];
    const attached = createZoneFeedbackModel(firstEntries, "consumeExisting");

    // When
    const result = updateZoneFeedback(attached, { entries: firstEntries, nowMs: 0, prompt: null, suppressed: false });

    // Then
    expect(result.view.banner).toBe("첫 지역");
  });
});

describe("interaction prompt labels", () => {
  it.each([
    [[{ kind: "checkpointSave", label: "기지" } satisfies Command], "Z 휴식"],
    [[{ kind: "battleProcessing", troopId: "troop", canEscape: true, canLose: false } satisfies Command], "Z 전투"],
    [[{ kind: "transfer", mapId: "map", x: 1, y: 1 } satisfies Command], "Z 오르기"],
    [[{ kind: "text", body: "살펴본다" } satisfies Command], "Z 조사"],
  ])("classifies an effective action page", (commands, expected) => {
    // Given
    const page = actionPage(commands);

    // When
    const label = interactionPromptLabel(page);

    // Then
    expect(label).toBe(expected);
  });

  it("returns no prompt when the effective page is missing", () => {
    // Given / When
    const label = interactionPromptLabel(undefined);

    // Then
    expect(label).toBeNull();
  });
});

describe("zone feedback DOM", () => {
  it("mounts compact live regions only while feedback is visible", () => {
    // Given
    const host = document.createElement("div");
    const dom = createZoneFeedbackDom(host);

    // When
    dom.render({ banner: "거울호", toast: null, objective: "수정 봉인 1/2", prompt: "Z 조사", suppressed: false }, []);

    // Then
    expect(host.querySelector("[data-testid='zone-feedback']")).not.toBeNull();
    expect(host.querySelector("[data-testid='zone-feedback-banner']")?.getAttribute("aria-label")).toBe("지역 알림");
    expect(host.querySelector("[data-testid='zone-feedback-objective']")?.textContent).toBe("수정 봉인 1/2");
    expect(host.querySelector("[data-testid='zone-feedback-prompt']")?.textContent).toBe("Z 조사");

    dom.render({ banner: null, toast: null, objective: null, prompt: null, suppressed: false }, []);
    expect(host.querySelector("[data-testid='zone-feedback']")).toBeNull();
  });

  it.each(["dialogue", "battle", "title", "gameOver", "statusMenu"])("removes the overlay while %s suppresses it", () => {
    // Given
    const host = document.createElement("div");
    const dom = createZoneFeedbackDom(host);

    // When
    dom.render({ banner: "숨겨야 함", toast: null, objective: null, prompt: null, suppressed: true }, []);

    // Then
    expect(host.querySelector("[data-testid='zone-feedback']")).toBeNull();
  });

  it.each([
    "dialogue-box",
    "battle-scene",
    "title-screen",
    "game-over-screen",
    "main-menu",
    "status-menu",
    "shop-scene",
    "inn-scene",
    "chest-scene",
    "ending-screen",
  ])(
    "detects the %s modal as a suppressing overlay",
    (testId) => {
      // Given
      const host = document.createElement("div");
      const modal = document.createElement("div");
      modal.dataset.testid = testId;
      host.append(modal);

      // When
      const suppressed = feedbackSuppressedByOverlay(host);

      // Then
      expect(suppressed).toBe(true);
    },
  );

  it("dispatches an accessible checkpoint feedback signal once", () => {
    // Given
    const host = document.createElement("div");
    const dom = createZoneFeedbackDom(host);
    let signals = 0;
    host.addEventListener(CHECKPOINT_EVENT, () => {
      signals += 1;
    });

    // When
    dom.render({ banner: null, toast: "체크포인트", objective: null, prompt: null, suppressed: false }, [{ kind: "checkpointChime" }]);
    dom.render({ banner: null, toast: "체크포인트", objective: null, prompt: null, suppressed: false }, []);

    // Then
    expect(signals).toBe(1);
    expect(host.querySelector("[data-testid='zone-feedback-toast']")?.getAttribute("role")).toBe("status");
  });
});

describe("PlayScene zone feedback lifecycle", () => {
  it("renders the first command created after late M2 runtime initialization", () => {
    // Given
    const host = document.createElement("div");
    const session = startSession(createBlankProject());
    const scene = feedbackScene(session, host);
    const feedback = createPlaySceneZoneFeedback(session);
    syncPlaySceneZoneFeedback(scene, feedback, 0);

    // When
    ensureM2Runtime(session).ui.push(command("banner", "Late ridge arrival"));
    syncPlaySceneZoneFeedback(scene, feedback, 16);

    // Then
    expect(host.querySelector("[data-testid='zone-feedback-banner']")?.textContent).toBe("Late ridge arrival");
  });

  it("does not replay saved UI history after a session replacement", () => {
    // Given
    const host = document.createElement("div");
    const current = startSession(createBlankProject());
    const scene = feedbackScene(current, host);
    const feedback = createPlaySceneZoneFeedback(current);
    syncPlaySceneZoneFeedback(scene, feedback, 0);
    const loaded = startSession(createBlankProject());
    ensureM2Runtime(loaded).ui.push(command("banner", "Saved history"));

    // When
    scene.session = loaded;
    syncPlaySceneZoneFeedback(scene, feedback, 16);

    // Then
    expect(host.querySelector("[data-testid='zone-feedback']")).toBeNull();
    ensureM2Runtime(loaded).ui.push(command("toast", "Fresh checkpoint"));
    syncPlaySceneZoneFeedback(scene, feedback, 16);
    expect(host.querySelector("[data-testid='zone-feedback-toast']")?.textContent).toBe("Fresh checkpoint");
  });

  it("removes mounted feedback during teardown", () => {
    // Given
    const host = document.createElement("div");
    const session = startSession(createBlankProject());
    const scene = feedbackScene(session, host);
    const feedback = createPlaySceneZoneFeedback(session);
    ensureM2Runtime(session).ui.push(command("banner", "Visible feedback"));
    syncPlaySceneZoneFeedback(scene, feedback, 16);

    // When
    destroyPlaySceneZoneFeedback(feedback);

    // Then
    expect(host.querySelector("[data-testid='zone-feedback']")).toBeNull();
    expect(feedback.dom).toBeNull();
    expect(feedback.host).toBeNull();
  });

  it.each(["shop-scene", "inn-scene", "chest-scene", "ending-screen"])(
    "suppresses feedback while the %s overlay is active",
    (testId) => {
      // Given
      const host = document.createElement("div");
      const modal = document.createElement("div");
      modal.dataset.testid = testId;
      host.append(modal);
      const session = startSession(createBlankProject());
      const scene = feedbackScene(session, host);
      const feedback = createPlaySceneZoneFeedback(session);
      ensureM2Runtime(session).ui.push(command("banner", "Hidden feedback"));

      // When
      syncPlaySceneZoneFeedback(scene, feedback, 16);

      // Then
      expect(host.querySelector("[data-testid='zone-feedback']")).toBeNull();
    },
  );
});

describe("standalone player zone feedback CSS", () => {
  it("owns zone feedback through the shared player runtime closure exactly once", () => {
    // Given
    const runtimeClosure = readFileSync(resolve("src/styles/runtime/playerRuntime.css"), "utf8");
    const editorEntry = readFileSync(resolve("src/styles/index.css"), "utf8");

    // When
    const closureImports = runtimeClosure.match(/@import\s+"\.\/zoneFeedback\.css";/gu) ?? [];
    const directEditorImports = editorEntry.match(/@import\s+"\.\/runtime\/zoneFeedback\.css";/gu) ?? [];

    // Then
    expect(closureImports).toHaveLength(1);
    expect(directEditorImports).toHaveLength(0);
  });
});
