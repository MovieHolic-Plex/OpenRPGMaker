import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { normalizeWorld, type WorldEntity } from "@/project/world";
import { createWorldPanelState, deleteWorldEntity, draftFromEntity, saveDraft } from "@/editor/panels/worldManager";
import { renderWorldPanel } from "@/editor/panels/worldPanel";
import { findByTestId, installFakeDom, renderWithFakeDom, type FakeElement } from "./fakeDom";

const now = 1_788_652_800_000;
const hostile = '<img src=x onerror="alert(1)"><script>alert(2)</script>';
let cleanup: () => void;
beforeEach(() => {
  cleanup = installFakeDom();
  vi.spyOn(Date, "now").mockReturnValue(now);
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function documentEntity(overrides: Partial<WorldEntity> = {}): WorldEntity {
  return { id: "w_rule", type: "guideline", name: "Combat", summary: "Action combat", body: "**Action** combat", origin: "ai",
    wiki: { kind: "declaration", basis: "inferred", topic: "combat-mode", combatMode: "action",
      sources: [{ id: "user-1", kind: "user", text: hostile, at: 10 }] }, ...overrides };
}
function load(entities: WorldEntity[]) {
  const project = createBlankProject();
  project.world = normalizeWorld({ entities, relations: [] });
  store.replace(project);
  return project;
}
function edit(entity: WorldEntity) {
  const state = createWorldPanelState({ initialEntityId: entity.id });
  state.editDraft = draftFromEntity(store.getCurrent().world!.entities.find((entry) => entry.id === entity.id)!, []);
  return state;
}
function control(panel: FakeElement, id: string): FakeElement {
  const node = findByTestId(panel, id);
  if (!node) throw new Error(`Missing control: ${id}`);
  return node;
}

describe("sourced codex manual editing", () => {
  it("preserves wiki metadata and source history while recording a chronological manual source", () => {
    const old = documentEntity({ id: "w_old", wiki: { kind: "declaration", basis: "inferred", sources: [{ id: "old", kind: "user", text: "Old rule", at: 1 }] } });
    const entity = documentEntity();
    const current = { ...entity, wiki: { ...entity.wiki!, supersedes: [old.id] } };
    const project = load([old, current]);
    const state = edit(current);
    state.editDraft!.tagsText = "reviewed";
    saveDraft(state, project.world!);
    const saved = store.getCurrent().world!.entities.find((entry) => entry.id === current.id)!;
    expect(saved.wiki).toMatchObject({ kind: "declaration", basis: "explicit", topic: "combat-mode", combatMode: "action", supersedes: [old.id] });
    expect(saved.wiki!.sources[0]).toEqual(current.wiki.sources[0]);
    expect(saved.wiki!.sources[1]).toMatchObject({ kind: "manual", at: now });
    expect(saved.wiki!.sources[1]!.id).not.toBe(saved.wiki!.sources[0]!.id);
    expect(saved.wiki!.sources[1]!.text).toContain(saved.body);
    expect(normalizeWorld(store.getCurrent().world)).toEqual(store.getCurrent().world);
    expect(state.editDraft).toBeNull();
  });

  it("clears stale machine combat mode through the real body input and save controls", () => {
    const entity = documentEntity();
    load([entity]);
    const panel = renderWithFakeDom(() => renderWorldPanel({ initialEntityId: entity.id }));
    control(panel, "world-edit-toggle").click();
    const body = control(panel, "world-edit-body");
    body.value = "Use random encounters instead";
    body.dispatchEvent(new Event("input"));
    control(panel, "world-edit-save").click();
    const saved = store.getCurrent().world!.entities[0]!;
    expect(saved.body).toBe(body.value);
    expect(saved.wiki?.basis).toBe("explicit");
    expect(saved.wiki?.combatMode).toBeUndefined();
    expect(saved.wiki?.sources[0]).toEqual(entity.wiki!.sources[0]);
  });

  it("saves progress edits separately without altering or fabricating application evidence", () => {
    const entity = documentEntity({ wiki: { kind: "progress", basis: "observed", topic: "map-build", sources: [{ id: "apply-1", kind: "application", text: "Placed 3 tiles", at: 10 }] } });
    const project = load([entity]);
    const state = edit(entity);
    state.editDraft!.body = "I think 100 tiles were placed";
    saveDraft(state, project.world!);
    const world = normalizeWorld(store.getCurrent().world);
    expect(world.entities.find((entry) => entry.id === entity.id)).toEqual(entity);
    const note = world.entities.find((entry) => entry.id === state.selectedId)!;
    expect(note.id).not.toBe(entity.id);
    expect(note.body).toBe("I think 100 tiles were placed");
    expect(note.wiki).toMatchObject({ kind: "knowledge", basis: "explicit", topic: "map-build" });
    expect(note.wiki?.sources).toHaveLength(1);
    expect(note.wiki?.sources[0]).toMatchObject({ kind: "manual", at: now });
    expect(note.wiki?.sources[0]?.text).toContain(entity.id);
    expect(note.wiki?.supersedes).toBeUndefined();
  });

  it("protects referenced historical deletion and leaves supersession intact", () => {
    const old = documentEntity({ id: "w_old" });
    const latest = documentEntity({ wiki: { kind: "declaration", basis: "explicit", sources: [{ id: "new", kind: "user", text: "New rule", at: 20 }], supersedes: [old.id] } });
    load([old, latest]);
    expect(deleteWorldEntity(old.id)).toBe(false);
    expect(deleteWorldEntity(latest.id)).toBe(false);
    expect(normalizeWorld(store.getCurrent().world).entities).toEqual([old, latest]);
    expect(document.body.textContent).not.toBe("");
  });

  it("rejects locked and racing drafts without losing pending text", () => {
    const entity = documentEntity({ locked: true });
    const project = load([entity]);
    const state = edit(entity);
    state.editDraft!.body = "Pending";
    saveDraft(state, project.world!);
    expect(state.editError).not.toBe("");
    expect(store.getCurrent().world!.entities[0]).toEqual(entity);
    const unlocked = { ...entity, locked: false };
    load([unlocked]);
    const racing = edit(unlocked);
    racing.editDraft!.body = "Pending";
    store.update((p) => { p.world = { entities: [{ ...unlocked, summary: "Concurrent" }], relations: [] }; });
    saveDraft(racing, project.world!);
    expect(racing.editError).not.toBe("");
    expect(racing.editDraft!.body).toBe("Pending");
    expect(store.getCurrent().world!.entities[0]!.summary).toBe("Concurrent");
  });

  it("makes inferred knowledge explicit and keeps manual sources across repeated saves", () => {
    const entity = documentEntity({ wiki: { kind: "knowledge", basis: "inferred", topic: "village", sources: [{ id: "user-1", kind: "user", text: "Village plan", at: 10 }] } });
    const project = load([entity]);
    const state = edit(entity);
    state.editDraft!.body = "Confirmed village plan";
    saveDraft(state, project.world!);
    const first = store.getCurrent().world!.entities[0]!;
    const next = edit(first);
    next.editDraft!.summary = "Confirmed";
    saveDraft(next, project.world!);
    const saved = store.getCurrent().world!.entities[0]!;
    expect(saved.wiki).toMatchObject({ kind: "knowledge", basis: "explicit", topic: "village" });
    expect(saved.wiki!.sources.slice(0, 2)).toEqual(first.wiki!.sources);
    expect(saved.wiki!.sources.map((source) => source.kind)).toEqual(["user", "manual", "manual"]);
    expect(new Set(saved.wiki!.sources.map((source) => source.id)).size).toBe(3);
  });

  it("retains legacy manual document behavior", () => {
    const entity = documentEntity({ wiki: undefined, origin: "user" });
    const project = load([entity]);
    const state = edit(entity);
    state.editDraft!.body = "Updated";
    saveDraft(state, project.world!);
    expect(store.getCurrent().world!.entities[0]!.wiki).toBeUndefined();
    expect(store.getCurrent().world!.entities[0]!.body).toBe("Updated");
    expect(deleteWorldEntity(entity.id)).toBe(true);
  });

  it("renders parsed provenance, collapsed source text, supersession, body and reference controls safely", () => {
    const old = documentEntity({ id: "w_old" });
    const latest = documentEntity({ wiki: { kind: "declaration", basis: "explicit", sources: [{ id: "new", kind: "user", text: "New", at: 20 }], supersedes: [old.id] } });
    const project = load([old, latest]);
    const mapId = Object.keys(project.maps)[0]!;
    store.update((p) => { p.world = normalizeWorld({ entities: [{ ...old, refs: [{ kind: "map", id: mapId }] }, latest], relations: [] }); });
    const panel = renderWithFakeDom(() => renderWorldPanel({ initialEntityId: old.id }));
    const provenance = control(panel, "world-wiki-provenance");
    expect(provenance.dataset).toMatchObject({ basis: "inferred", kind: "declaration", superseded: "true" });
    const sources = control(panel, "world-wiki-sources");
    expect(sources.tagName.toLowerCase()).toBe("details");
    expect(sources.getAttribute("open")).toBeNull();
    const source = control(panel, "world-wiki-source-0");
    expect(source.textContent).toContain(hostile);
    expect(source.textContent).toContain("user-1");
    expect(source.querySelector("img")).toBeNull();
    expect(source.querySelector("script")).toBeNull();
    expect([source, ...source.querySelectorAll("*")].every((node) => node.innerHTML === "")).toBe(true);
    expect(panel.querySelector(".world-markdown")?.querySelector("strong")?.textContent).toBe("Action");
    expect(findByTestId(panel, `world-ref-jump-map-${mapId}`)).toBeTruthy();
  });
});
