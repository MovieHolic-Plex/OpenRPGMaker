import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

const mocks = vi.hoisted(() => ({ runAuthoringTask: vi.fn() }));
vi.mock("@/editor/authoringTasks", () => ({ runAuthoringTask: mocks.runAuthoringTask }));

const {
  authoringProjectFingerprint,
  emptyAuthoringJourneyProgress,
  evaluateAuthoringTestGate,
  evaluateAuthoringJourney,
  loadAuthoringJourneyProgress,
  recordAuthoringJourneyChange,
  recordSuccessfulTestBoot,
  saveAuthoringJourneyProgress,
  setManualJourneyStage,
} = await import("@/editor/authoringJourney");
const { renderAuthoringJourney } = await import("@/editor/panels/authoringJourneyStrip");

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

describe("genre-neutral authoring journey", () => {
  beforeEach(() => mocks.runAuthoringTask.mockReset());

  // Break caught: a decorative checklist claims an acknowledgement is authored completion.
  it("distinguishes authored evidence, reference issues, and non-completing manual acknowledgement", () => {
    const project = createBlankProject();
    project.maps[project.startMapId]!.events.push({
      id: "committed",
      x: 1,
      y: 1,
      trigger: { kind: "action" },
      commands: [],
      pages: [],
    });
    project.system.startActorIds = ["missing-actor"];
    const progress = {
      ...emptyAuthoringJourneyProgress(),
      databaseTouched: true,
      manualAcknowledged: ["map"] as const,
    };
    const journey = evaluateAuthoringJourney(project, progress);
    expect(journey.find((stage) => stage.id === "project")?.completion).toBe("project");
    expect(journey.find((stage) => stage.id === "map")?.completion).toBeNull();
    expect(journey.find((stage) => stage.id === "map")?.acknowledgement).toBe("acknowledged");
    expect(journey.find((stage) => stage.id === "event")?.completion).toBe("committed-event");
    expect(journey.find((stage) => stage.id === "data")?.completion).toBe("database-change");
    expect(journey.find((stage) => stage.id === "data")?.referenceIssueCount).toBeGreaterThan(0);
    expect(journey.find((stage) => stage.id === "test")?.completion).toBeNull();
  });

  // Break caught: a successful old run remains green after the authored project changes.
  it.each([
    { scope: "map", mapId: "map-1" } as const,
    { scope: "database", collection: "items" } as const,
    { scope: "system" } as const,
    { scope: "project" } as const,
  ])("invalidates Test evidence after an authored $scope change", (change) => {
    const tested = recordSuccessfulTestBoot(
      emptyAuthoringJourneyProgress(),
      "fingerprint-before",
      "fingerprint-before",
      [],
    );

    const changed = recordAuthoringJourneyChange(tested, change);

    expect(changed.testedProjectFingerprint).toBeNull();
  });

  // Break caught: persisted boot evidence from a different revision completes the current project.
  it("requires Test evidence to match the current authored fingerprint", () => {
    const project = createBlankProject();
    const progress = recordSuccessfulTestBoot(
      emptyAuthoringJourneyProgress(),
      "different-revision",
      "different-revision",
      [],
    );

    const testStage = evaluateAuthoringJourney(project, progress)
      .find((stage) => stage.id === "test");

    expect(authoringProjectFingerprint(project)).not.toBe("different-revision");
    expect(testStage?.completion).toBeNull();
  });

  // Break caught: a late player-ready signal promotes Test while references are broken.
  it("rejects a success signal when its revision is stale or references are broken", () => {
    const empty = emptyAuthoringJourneyProgress();
    expect(recordSuccessfulTestBoot(empty, "old", "current", []).testedProjectFingerprint).toBeNull();
    expect(recordSuccessfulTestBoot(empty, "current", "current", ["broken ref"]).testedProjectFingerprint).toBeNull();
  });

  // Break caught: Test launch surfaces disagree about whether dangling references block play.
  it("returns the exact reference issue list from the shared Test gate", () => {
    const project = createBlankProject();
    project.system.startActorIds = ["missing-actor"];

    const gate = evaluateAuthoringTestGate(project);

    expect(gate.allowed).toBe(false);
    expect(gate.referenceIssues.length).toBeGreaterThan(0);
    expect(gate.referenceIssues.some((issue: string) => issue.includes("missing-actor"))).toBe(true);
  });

  it("stays collapsed to a toggle until opened", () => {
    const restore = installFakeDom();
    try {
      const root = renderAuthoringJourney(createBlankProject(), emptyAuthoringJourneyProgress());
      const toggle = findByTestId(root as unknown as FakeElement, "authoring-journey-toggle");
      const strip = root.querySelector(".authoring-journey-strip") as FakeElement | null;
      expect(toggle?.getAttribute("aria-expanded")).toBe("false");
      expect(root.classList.contains("is-open")).toBe(false);
      expect(strip?.hidden).toBe(true);
      toggle?.click();
      expect(toggle?.getAttribute("aria-expanded")).toBe("true");
      expect(root.classList.contains("is-open")).toBe(true);
      expect(strip?.hidden).toBe(false);
    } finally {
      restore();
    }
  });

  // Break caught: pressing Test immediately paints a completion check without mounting the player.
  it("launches real tasks but exposes no click-to-complete control for Test", () => {
    const restore = installFakeDom();
    try {
      const root = renderAuthoringJourney(createBlankProject(), emptyAuthoringJourneyProgress());
      findByTestId(root as unknown as FakeElement, "authoring-journey-task-test")?.click();
      expect(mocks.runAuthoringTask).toHaveBeenCalledWith("test");
      expect(findByTestId(root as unknown as FakeElement, "authoring-journey-manual-test")).toBeNull();
      expect(findByTestId(root as unknown as FakeElement, "authoring-journey-stage-test")?.dataset.completion).toBe("pending");
    } finally {
      restore();
    }
  });

  it("blocks Test launch while project references are broken", () => {
    const restore = installFakeDom();
    try {
      const project = createBlankProject();
      project.system.startActorIds = ["missing-actor"];
      const root = renderAuthoringJourney(project, emptyAuthoringJourneyProgress());
      const testButton = findByTestId(root as unknown as FakeElement, "authoring-journey-task-test");
      expect(testButton?.disabled).toBe(true);
      expect(testButton?.getAttribute("aria-disabled")).toBe("true");
      expect(findByTestId(root as unknown as FakeElement, "authoring-journey-reference-issue-0")).toBeTruthy();
      findByTestId(root as unknown as FakeElement, "authoring-journey-repair-references")?.click();
      expect(mocks.runAuthoringTask).toHaveBeenCalledWith("data");
    } finally {
      restore();
    }
  });

  // Break caught: acknowledgement is persisted under the old completion field and rendered as proof.
  it("stores acknowledgement separately from completion and migrates the legacy field safely", () => {
    const storage = new MemoryStorage();
    const acknowledged = setManualJourneyStage(emptyAuthoringJourneyProgress(), "event", true);
    saveAuthoringJourneyProgress("project-a", acknowledged, storage);
    expect(loadAuthoringJourneyProgress("project-a", storage).manualAcknowledged).toEqual(["event"]);
    expect(loadAuthoringJourneyProgress("project-a", storage).testedProjectFingerprint).toBeNull();

    storage.setItem("oprn:authoring-journey:v1:legacy", JSON.stringify({ manualCompleted: ["map"] }));
    const migrated = loadAuthoringJourneyProgress("legacy", storage);
    expect(migrated.manualAcknowledged).toEqual(["map"]);
    expect(evaluateAuthoringJourney(createBlankProject(), migrated).find((stage) => stage.id === "map")?.completion).toBeNull();
  });
});
