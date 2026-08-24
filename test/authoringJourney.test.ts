import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

const mocks = vi.hoisted(() => ({ runAuthoringTask: vi.fn() }));
vi.mock("@/editor/authoringTasks", () => ({ runAuthoringTask: mocks.runAuthoringTask }));

const {
  emptyAuthoringJourneyProgress,
  evaluateAuthoringJourney,
  loadAuthoringJourneyProgress,
  saveAuthoringJourneyProgress,
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

  // Break caught: a decorative checklist claims seeded defaults are authored progress.
  it("distinguishes loaded project, committed events, DB changes, reference issues, and manual evidence", () => {
    const project = createBlankProject();
    project.maps[project.startMapId]!.events.push({ id: "committed", name: "Committed", x: 1, y: 1, pages: [] });
    project.system.startActorIds = ["missing-actor"];
    const progress = {
      ...emptyAuthoringJourneyProgress(),
      databaseTouched: true,
      manualCompleted: ["map"] as const,
    };
    const journey = evaluateAuthoringJourney(project, progress);
    expect(journey.find((stage) => stage.id === "project")?.completion).toBe("project");
    expect(journey.find((stage) => stage.id === "map")?.completion).toBe("manual");
    expect(journey.find((stage) => stage.id === "event")?.completion).toBe("committed-event");
    expect(journey.find((stage) => stage.id === "data")?.completion).toBe("database-change");
    expect(journey.find((stage) => stage.id === "data")?.referenceIssueCount).toBeGreaterThan(0);
    expect(journey.find((stage) => stage.id === "test")?.completion).toBeNull();
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
    } finally {
      restore();
    }
  });

  // Break caught: manual checkpoints leak from one Supabase project into another.
  it("stores manual evidence per project scope", () => {
    const storage = new MemoryStorage();
    saveAuthoringJourneyProgress("project-a", { ...emptyAuthoringJourneyProgress(), manualCompleted: ["event"] }, storage);
    expect(loadAuthoringJourneyProgress("project-a", storage).manualCompleted).toEqual(["event"]);
    expect(loadAuthoringJourneyProgress("project-b", storage).manualCompleted).toEqual([]);
  });
});
