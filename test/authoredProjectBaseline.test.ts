import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AuthoredProjectBaseline } from "@/project/authoredProjectBaseline";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";
import { store } from "@/project/store";
import { applyProposedProject, captureProposalBase } from "@/editor/tools/applyChangesetToStore";
import * as history from "@/editor/mapEditHistory";
import * as commits from "@/project/projectCommitLog";

beforeEach(() => {
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 201 })));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const edits: readonly { readonly name: string; readonly edit: (project: Project) => void }[] = [
  { name: "database", edit: project => {
    const potion = project.database.items.find(item => item.id === "item_potion");
    if (!potion) throw new Error("Missing potion fixture");
    potion.price = 9876;
  } },
  { name: "system", edit: project => { project.system.titleScreen = { ...project.system.titleScreen, title: "Manual title" }; } },
  { name: "authored start state", edit: project => { project.session.gold = 9876; } },
  { name: "world registration", edit: project => { project.world = { entities: [{ id: "npc", type: "character", name: "NPC", summary: "Manual character", origin: "user" }], relations: [] }; } },
  { name: "world relation", edit: project => { project.world = { entities: [], relations: [{ a: "npc", b: "place", kind: "locatedIn" }] }; } },
];

it.each(edits)("rejects stale $name at the shared boundary without history, commits or store mutation", async ({ name, edit }) => {
  const original = createBlankProject();
  store.replace(original);
  const baseline = new AuthoredProjectBaseline(original);
  const base = captureProposalBase(original);
  const proposed = structuredClone(original);
  proposed.meta.title = "Detached draft";
  store.update(edit);
  const live = structuredClone(store.getCurrent());
  history.resetMapEditHistory();
  const snapshot = vi.spyOn(history, "recordProjectSnapshot");
  const commit = vi.spyOn(commits, "recordProjectCommit");
  const replace = vi.spyOn(store, "replace");
  const manualBaseline = vi.spyOn(commits, "resetManualProjectCommitBaseline");
  expect(await applyProposedProject(proposed, { base, baseline, source: "agent", summary: "Detached draft", toolNames: [] }))
    .toMatchObject({ ok: false, reason: name.startsWith("world") ? "stale-baseline" : "stale-base" });
  expect(store.getCurrent()).toEqual(live);
  expect(history.getMapEditHistoryEntries()).toEqual([]);
  for (const spy of [snapshot, commit, replace, manualBaseline]) expect(spy).not.toHaveBeenCalled();
});

it("captures immutable values rather than trusting a mutable baseline Project", () => {
  const project = createBlankProject();
  const baseline = new AuthoredProjectBaseline(project);
  const original = structuredClone(project);
  project.meta.title = "Mutated original reference";
  expect(baseline.matches(project)).toBe(false);
  expect(baseline.matches(original)).toBe(true);
  expect(Object.isFrozen(baseline)).toBe(true);
});

it("keeps draft authority bounded for large documents while detecting a tail edit", () => {
  const project = createBlankProject();
  project.meta.title = "숲🌲".repeat(100_000);
  store.replace(project);
  const baseline = new AuthoredProjectBaseline(project);
  const base = captureProposalBase(project);
  // Retained authority must not contain copies of the large authored document.
  expect(JSON.stringify(baseline).length).toBeLessThan(256);
  expect(base.content.length).toBe(64);
  expect(base.world.length).toBe(64);
  expect(baseline.matches(structuredClone(project))).toBe(true);
  project.meta.title += "changed";
  expect(baseline.matches(project)).toBe(false);
});

it.each([false, true])("keeps the wiki exception explicit and does not let reset discard newer documents (reset=%s)", async resetProject => {
  const original = createBlankProject();
  store.replace(original);
  const baseline = new AuthoredProjectBaseline(original);
  const base = captureProposalBase(original);
  const proposed = structuredClone(original);
  proposed.meta.title = "Reviewed title";
  store.update(project => { project.world = { entities: [{ id: "w_wiki", type: "concept", name: "Manual wiki", summary: "Keep me", origin: "user", locked: true,
    wiki: { kind: "knowledge", basis: "explicit", sources: [{ id: "manual", kind: "manual", text: "Keep me", at: 1 }] } }], relations: [] }; });
  const world = structuredClone(store.getCurrent().world);
  history.resetMapEditHistory();
  const result = await applyProposedProject(proposed, { base, baseline, source: "agent", summary: "Title", toolNames: ["set_title_screen"], resetProject });
  expect(result.ok).toBe(!resetProject);
  expect(store.getCurrent().world?.entities).toEqual(expect.arrayContaining(world?.entities ?? []));
  expect(history.getMapEditHistoryEntries()).toHaveLength(resetProject ? 0 : 2); // authoring plus the coordinator's observed receipt
  if (!resetProject) expect(store.getCurrent().meta.title).toBe("Reviewed title");
});
