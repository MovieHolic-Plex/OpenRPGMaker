import { describe, expect, it } from "vitest";
import {
  HORROR_MYSTERY_MAP_IDS,
  HORROR_MYSTERY_PROJECT_ID,
  createHorrorMysteryPrototypeProject,
} from "@/project/examples/horrorMysteryPrototype";
import type { Command, Project } from "@/project/types";
import {
  evaluateHorrorExperienceQa,
  type HorrorBrowserEvidence,
  type HorrorQaScenario,
} from "@/testing/horrorExperienceQa";
import { createHorrorMysteryQaScenarios } from "@/testing/horrorMysteryQaPlan";

const browserEvidence: HorrorBrowserEvidence = {
  projectId: HORROR_MYSTERY_PROJECT_ID,
  observedAt: "2026-08-24T10:30:00.000Z",
  route: `http://127.0.0.1:9815/?projectId=${HORROR_MYSTERY_PROJECT_ID}`,
  title: {
    resourceId: "horror-mystery-blue-gallery",
    imageLoaded: true,
  },
  desktopTouchPadVisible: false,
  mapStart: {
    mapId: HORROR_MYSTERY_MAP_IDS.chase,
    x: 13,
    y: 6,
    passable: true,
  },
  consoleErrorCount: 0,
};

function removeLethalAudioAndRecovery(project: Project): void {
  project.maps[HORROR_MYSTERY_MAP_IDS.chase]!.safeZones = [];
  for (const event of project.maps[HORROR_MYSTERY_MAP_IDS.chase]!.events) {
    for (const page of event.pages ?? []) {
      const hasKill = page.commands.some((command) => command.kind === "killPlayer");
      if (hasKill) {
        page.commands = page.commands.filter((command): command is Command => command.kind !== "playAudio");
      }
    }
  }
}

describe("automated horror experience QA", () => {
  it("discovers the persisted gallery exit even when generated event ids differ from the local manifest", () => {
    const { project, manifest } = createHorrorMysteryPrototypeProject();
    const exit = project.maps[HORROR_MYSTERY_MAP_IDS.gallery]!.events.find(
      (event) => event.id === manifest.gallery.exitEventId,
    );
    expect(exit).toBeDefined();
    exit!.id = "remote-generated-exit-id";

    const scenarios = createHorrorMysteryQaScenarios(project, manifest);
    const criticalPath = scenarios.find((scenario) => scenario.role === "critical-path");

    expect(criticalPath).toBeDefined();
    expect(evaluateHorrorExperienceQa(project, scenarios, browserEvidence).scenarios
      .find((scenario) => scenario.role === "critical-path")?.ok).toBe(true);
  });

  it("runs multiple player-behavior scenarios and gives the complete prototype a strong pass", () => {
    const { project, manifest } = createHorrorMysteryPrototypeProject();
    const scenarios = createHorrorMysteryQaScenarios(project, manifest);

    const report = evaluateHorrorExperienceQa(project, scenarios, browserEvidence);

    expect(scenarios.map((scenario) => scenario.role)).toEqual(expect.arrayContaining([
      "locked-gate-feedback",
      "wrong-answer-recovery",
      "critical-path",
      "trap-death-retry",
      "chaser-death-retry",
      "truth-ending",
      "alternate-ending",
    ]));
    expect(report.scenarios.every((scenario) => scenario.ok)).toBe(true);
    expect(report.scenarios.find((scenario) => scenario.role === "critical-path")?.finalState.mapId)
      .toBe(HORROR_MYSTERY_MAP_IDS.finale);
    expect(report.blockers).toEqual([]);
    expect(report.totalScore).toBeGreaterThanOrEqual(90);
    expect(report.verdict).toBe("strong-pass");
    expect(report.axes.map((axis) => axis.id)).toEqual([
      "stability",
      "mystery",
      "feedback",
      "tension",
      "payoff",
    ]);
  });

  it("blocks a build that kills silently and removes its recovery zone", () => {
    const { project, manifest } = createHorrorMysteryPrototypeProject();
    removeLethalAudioAndRecovery(project);

    const report = evaluateHorrorExperienceQa(
      project,
      createHorrorMysteryQaScenarios(project, manifest),
      browserEvidence,
    );

    expect(report.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "tension:lethal-sound-missing" }),
      expect.objectContaining({ id: "tension:no-safe-zone" }),
    ]));
    expect(report.verdict).toBe("fail");
    expect(report.axes.find((axis) => axis.id === "tension")?.score).toBeLessThan(15);
  });

  // NAME THE BREAK: removing the transfer-target reachability scan must fail this.
  // A transfer command pointing at a map id that does not exist in project.maps must
  // be reported as a blocker instead of silently tolerated by the QA.
  it("blocks a build whose transfer targets a map that does not exist", () => {
    const { project, manifest } = createHorrorMysteryPrototypeProject();
    const galleryExit = project.maps[HORROR_MYSTERY_MAP_IDS.gallery]!.events.find(
      (event) => event.id === manifest.gallery.exitEventId,
    )!;
    for (const page of galleryExit.pages ?? []) {
      for (const command of page.commands) {
        if (command.kind === "transfer" && command.mapId === HORROR_MYSTERY_MAP_IDS.chase) {
          command.mapId = "map_missing_target";
        }
      }
    }

    const report = evaluateHorrorExperienceQa(
      project,
      createHorrorMysteryQaScenarios(project, manifest),
      browserEvidence,
    );

    expect(report.blockers).toContainEqual(expect.objectContaining({
      id: "reachability:missing-transfer-target",
    }));
    expect(report.verdict).toBe("fail");
  });

  // NAME THE BREAK: removing the ending-trigger reachability scan must fail this.
  // A defined ending whose only trigger lives on a map that is not structurally
  // reachable from the start map must be reported as a blocker.
  it("blocks a defined ending whose trigger sits only on a map unreachable from start", () => {
    const { project, manifest } = createHorrorMysteryPrototypeProject();
    const chaseExit = project.maps[HORROR_MYSTERY_MAP_IDS.chase]!.events.find(
      (event) => event.id === manifest.chase.exitEventId,
    )!;
    for (const page of chaseExit.pages ?? []) {
      for (const command of page.commands) {
        if (command.kind === "transfer" && command.mapId === HORROR_MYSTERY_MAP_IDS.finale) {
          command.mapId = HORROR_MYSTERY_MAP_IDS.gallery;
        }
      }
    }

    const report = evaluateHorrorExperienceQa(
      project,
      createHorrorMysteryQaScenarios(project, manifest),
      browserEvidence,
    );

    expect(report.blockers.filter((blocker) => blocker.id === "reachability:unreachable-ending"))
      .toHaveLength(2);
    expect(report.verdict).toBe("fail");
  });

  it("still reaches both endings and stays a strong pass when the graph is fully connected", () => {
    const { project, manifest } = createHorrorMysteryPrototypeProject();

    const report = evaluateHorrorExperienceQa(
      project,
      createHorrorMysteryQaScenarios(project, manifest),
      browserEvidence,
    );

    expect(report.blockers).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "reachability:missing-transfer-target" }),
      expect.objectContaining({ id: "reachability:unreachable-ending" }),
    ]));
    expect(report.verdict).toBe("strong-pass");
  });

  it("does not call the game working when one mandatory runtime scenario fails", () => {
    const { project, manifest } = createHorrorMysteryPrototypeProject();
    const scenarios = createHorrorMysteryQaScenarios(project, manifest);
    const brokenScenario: HorrorQaScenario = {
      ...scenarios[0]!,
      id: "deliberately-broken-contract",
      input: {
        ...scenarios[0]!.input,
        steps: [
          ...scenarios[0]!.input.steps,
          { kind: "expect", switchOn: "switch_that_does_not_exist" },
        ],
      },
    };

    const report = evaluateHorrorExperienceQa(
      project,
      [brokenScenario, ...scenarios.slice(1)],
      browserEvidence,
    );

    expect(report.scenarios.find((scenario) => scenario.id === brokenScenario.id)?.ok).toBe(false);
    expect(report.blockers).toContainEqual(expect.objectContaining({
      id: `scenario:${brokenScenario.id}`,
    }));
    expect(report.verdict).toBe("fail");
  });
});
