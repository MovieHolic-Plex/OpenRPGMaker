/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as journey from "@/editor/authoringJourney";
import { createAiSidebarWorkspace } from "@/editor/panels/aiSidebarWorkspace";
import { createBlankProject } from "@/project/defaults";
import { committedEvents } from "@/project/eventDrafts";
import { store } from "@/project/store";
import type { GameEvent } from "@/project/types";

vi.mock("@/editor/authoringTasks", () => ({ runAuthoringTask: vi.fn() }));
vi.mock("@/editor/projectReferenceIssues", () => ({ collectEditorProjectReferenceIssues: () => [] }));
vi.mock("@/editor/panels/ruleAuditPanel", () => ({ ruleAuditViolationCountCached: () => 0, RULE_AUDIT_UPDATED_EVENT: "ux2-audit-update" }));
vi.mock("@/editor/panels/tileToolbarMenus", () => ({ openSidebarInspection: vi.fn() }));
vi.mock("@/editor/panels/leftFavoritesPane", () => ({ createLeftFavoritesPane: () => ({ root: document.createElement("section"), show() {}, dispose() {} }) }));
vi.mock("@/editor/panels/leftLinksPane", () => ({ createLeftLinksPane: () => ({ root: document.createElement("section"), show() {}, dispose() {} }) }));
vi.mock("@/editor/panels/leftWorkshopPane", () => ({ createLeftWorkshopPane: () => ({ root: document.createElement("section"), show() {}, dispose() {} }) }));
vi.mock("@/editor/panels/mapSidebarSection", () => ({ createMapSidebarSection: () => ({ root: document.createElement("section"), show() {}, dispose() {} }) }));

const event = (id: string): GameEvent => ({ id, x: 0, y: 0, trigger: { kind: "action" }, commands: [], pages: [] });

describe("UX2 committed-event count projection", () => {
  afterEach(() => vi.restoreAllMocks());
  it("matches committedEvents for ordinary, new, edit, missing-original and deleted/conflicting drafts without cloning", () => {
    const original = event("original");
    const events: GameEvent[] = [
      event("normal"),
      { ...event("new"), draft: { kind: "new", original } },
      { ...event("edit"), draft: { kind: "edit", original } },
      { ...event("missing"), draft: { kind: "edit" } },
      { ...event("changed"), draft: { kind: "edit", original, conflict: { kind: "remote-change", detectedAt: 1 } } },
      { ...event("deleted"), draft: { kind: "edit", original, conflict: { kind: "remote-delete", detectedAt: 1 } } },
    ];
    const expected = committedEvents(events).length;
    const clone = vi.spyOn(globalThis, "structuredClone");
    const project = createBlankProject();
    project.maps[project.startMapId]!.events = events;
    clone.mockClear();
    const stages = journey.evaluateAuthoringJourney(project, journey.emptyAuthoringJourneyProgress(), []);
    expect(expected).toBe(3);
    expect(stages.find((stage) => stage.id === "event")?.detail).toBe(`커밋 ${expected}개`);
    expect(clone).not.toHaveBeenCalled();
  });

  it("reuses event-array counts across painted map objects and invalidates on replacement arrays", () => {
    const project = createBlankProject();
    const events = [event("one")];
    const readDraft = vi.fn(() => undefined);
    Object.defineProperty(events[0], "draft", { get: readDraft });
    project.maps[project.startMapId]!.events = events;
    const progress = journey.emptyAuthoringJourneyProgress();
    journey.evaluateAuthoringJourney(project, progress, []);
    readDraft.mockClear();
    const map = project.maps[project.startMapId]!;
    const painted = { ...project, maps: { ...project.maps, [map.id]: { ...map, lowerTiles: map.lowerTiles.slice() } } };
    expect(journey.evaluateAuthoringJourney(painted, progress, []).find((stage) => stage.id === "event")?.detail).toBe("커밋 1개");
    expect(readDraft).not.toHaveBeenCalled();
    painted.maps[map.id]!.events = [...events, event("two")];
    expect(journey.evaluateAuthoringJourney(painted, progress, []).find((stage) => stage.id === "event")?.detail).toBe("커밋 2개");
    painted.maps[map.id]!.events = [{ ...event("new"), draft: { kind: "new" } }];
    expect(journey.evaluateAuthoringJourney(painted, progress, []).find((stage) => stage.id === "event")?.completion).toBeNull();
  });
});

describe("UX2 collapsed and unchanged Progress", () => {
  let workspace: ReturnType<typeof createAiSidebarWorkspace>;
  let frames: FrameRequestCallback[];
  const find = (id: string) => workspace.root.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
  const flush = () => { const queued = frames.splice(0); for (const run of queued) run(0); };
  const paint = () => store.updateMapTiles(store.getCurrent().startMapId, (map) => { map.lowerTiles[0] = map.lowerTiles[0] === 0 ? 1 : 0; }, { cells: [{ x: 0, y: 0, layer: "lower" }] });
  beforeEach(() => {
    localStorage.clear();
    store.replace(createBlankProject());
    frames = [];
    vi.stubGlobal("requestAnimationFrame", (run: FrameRequestCallback) => { frames.push(run); return frames.length; });
    workspace = createAiSidebarWorkspace(document.createElement("div"));
    document.body.append(workspace.root);
  });
  afterEach(() => { workspace.dispose(); workspace.root.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("does no evaluation while collapsed, including queued work, and refreshes on reopening", () => {
    find("sidebar-progress").click();
    const evaluate = vi.spyOn(journey, "evaluateAuthoringJourney");
    paint(); // Queue a visible update, then collapse before its frame.
    find("sidebar-progress").click();
    expect(find("left-progress-pane").hidden).toBe(true);
    expect(find("left-progress-pane").parentElement?.hidden).toBe(true);
    paint(); flush();
    expect(evaluate).not.toHaveBeenCalled();
    store.updateMap(store.getCurrent().startMapId, (map) => { map.events.push(event("committed-while-hidden")); });
    flush();
    expect(evaluate).not.toHaveBeenCalled();
    find("sidebar-progress").click();
    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(find("left-progress-pane").hidden).toBe(false);
    expect(find("left-progress-event").textContent).toContain("커밋 1개");
  });

  it("preserves visible stage nodes on unchanged paint output and replaces them after a real event change", () => {
    find("sidebar-progress").click();
    const first = find("left-progress-event");
    paint(); flush(); paint(); flush();
    expect(find("left-progress-event")).toBe(first);
    store.updateMap(store.getCurrent().startMapId, (map) => { map.events.push(event("added")); });
    flush();
    expect(find("left-progress-event")).not.toBe(first);
    expect(find("left-progress-event").textContent).toContain("커밋 1개");
    workspace.dispose();
    const evaluate = vi.spyOn(journey, "evaluateAuthoringJourney");
    paint(); flush();
    expect(evaluate).not.toHaveBeenCalled();
  });
});
