/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { inspectProjectSuggestions, selectProjectSuggestions } from "@/ai/projectSuggestions";
import { createProjectSuggestions, type SuggestionSnapshot } from "@/editor/panels/aiProjectSuggestions";

function fixture() {
  const project = createBlankProject();
  const mapId = project.startMapId;
  const map = project.maps[mapId]!;
  map.events = [{ id: "door", name: "동쪽 문", x: 2, y: 3, trigger: "action", commands: [{ kind: "transfer", mapId: "missing", x: 0, y: 0 }] }];
  return { project, mapId, projectId: "project-a", active: true } satisfies SuggestionSnapshot;
}
afterEach(() => { vi.useRealTimers(); document.body.replaceChildren(); });

describe("grounded project suggestions", () => {
  it("reads without mutating and removes repaired candidates", () => {
    const s = fixture(); const before = JSON.stringify(s.project);
    expect(inspectProjectSuggestions(s.project, s.mapId)[0]?.title).toContain("이동");
    expect(JSON.stringify(s.project)).toBe(before);
    s.project.maps[s.mapId]!.events[0]!.commands = [];
    expect(inspectProjectSuggestions(s.project, s.mapId)).toEqual([]);
  });
  it("does not recommend encounters in peaceful maps", () => {
    const s = fixture(); s.project.maps[s.mapId]!.events = [];
    s.project.maps[s.mapId]!.encounterRate = 0;
    expect(inspectProjectSuggestions(s.project, s.mapId).some(c => c.id === "encounters")).toBe(false);
  });
  it("suggests an empty shop only when stock and service alternatives are absent", () => {
    const s = fixture();
    const event = s.project.maps[s.mapId]!.events[0]!;
    // Existing authored DB records are enough; this fixture only changes the event.
    expect(s.project.database.items.length).toBeGreaterThan(0);
    event.commands = [{ kind: "shop", itemIds: [] }];
    expect(inspectProjectSuggestions(s.project, s.mapId)[0]?.id).toContain("shop:");
    event.commands = [{ kind: "shop", itemIds: [s.project.database.items[0]!.id] }];
    expect(inspectProjectSuggestions(s.project, s.mapId)).toEqual([]);
  });
  it("uses active page definitions, not stale root commands", () => {
    const s = fixture(); const event = s.project.maps[s.mapId]!.events[0]!;
    event.pages = [{ id: "p", trigger: "action", commands: [] }];
    expect(inspectProjectSuggestions(s.project, s.mapId)).toEqual([]);
  });
  it("rejects ungrounded model output and duplicate selections", () => {
    const s = fixture(); const candidates = inspectProjectSuggestions(s.project, s.mapId);
    const id = candidates[0]!.id;
    expect(selectProjectSuggestions(JSON.stringify(["invented", id, id]), candidates)).toEqual(candidates);
    expect(selectProjectSuggestions("make a town", candidates)).toEqual([]);
  });
  it("scopes fingerprints to relevant facts", () => {
    const s = fixture(); const before = inspectProjectSuggestions(s.project, s.mapId)[0]!.fingerprint;
    s.project.maps[s.mapId]!.lowerTiles[0] = 123;
    expect(inspectProjectSuggestions(s.project, s.mapId)[0]!.fingerprint).toBe(before);
    s.project.maps[s.mapId]!.events[0]!.name = "서쪽 문";
    expect(inspectProjectSuggestions(s.project, s.mapId)[0]!.fingerprint).not.toBe(before);
  });
});

describe("background suggestion lifecycle", () => {
  function setup(analyze = vi.fn(async (_s: SuggestionSnapshot, c: ReturnType<typeof inspectProjectSuggestions>) => JSON.stringify(c.map(v => v.id)))) {
    vi.useFakeTimers();
    let snapshot = fixture();
    const request = vi.fn(), locate = vi.fn();
    const ui = createProjectSuggestions({ snapshot: () => snapshot, request, locate, analyze, intervalMs: 10, cooldownMs: 100 });
    document.body.append(ui.root);
    return { ui, analyze, request, locate, get: () => snapshot, set: (s: SuggestionSnapshot) => { snapshot = s; } };
  }
  it("renders at most once for unchanged state and only requests work after click", async () => {
    const t = setup(); await vi.advanceTimersByTimeAsync(20);
    expect(t.ui.root.querySelectorAll("article")).toHaveLength(1);
    expect(t.request).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(500);
    expect(t.analyze).toHaveBeenCalledTimes(1);
    [...t.ui.root.querySelectorAll("button")].find(b => b.textContent === "AI와 이어가기")!.click();
    expect(t.request).toHaveBeenCalledTimes(1); t.ui.dispose();
  });
  it("dismisses until related facts change, isolated by project", async () => {
    const t = setup(); await vi.advanceTimersByTimeAsync(20);
    [...t.ui.root.querySelectorAll("button")].find(b => b.textContent === "넘기기")!.click();
    t.get().project.maps[t.get().mapId]!.lowerTiles[0] = 333;
    await vi.advanceTimersByTimeAsync(120);
    expect(t.ui.root.querySelectorAll("article")).toHaveLength(0);
    t.set({ ...t.get(), projectId: "other-project" });
    await vi.advanceTimersByTimeAsync(20);
    expect(t.ui.root.querySelectorAll("article")).toHaveLength(1); t.ui.dispose();
  });
  it("ignores delayed results after project switches and aborts on disposal", async () => {
    let resolve!: (v: string) => void; let signal: AbortSignal | undefined;
    const analyze = vi.fn((_s: SuggestionSnapshot, _c: ReturnType<typeof inspectProjectSuggestions>, abort?: AbortSignal) => { signal = abort; return new Promise<string>(r => { resolve = r; }); });
    const t = setup(analyze); await vi.advanceTimersByTimeAsync(20);
    const ids = inspectProjectSuggestions(t.get().project, t.get().mapId).map(c => c.id);
    t.set({ ...t.get(), projectId: "new-project" });
    await vi.advanceTimersByTimeAsync(20);
    expect(signal?.aborted).toBe(true);
    resolve(JSON.stringify(ids)); await vi.advanceTimersByTimeAsync(10);
    expect(t.ui.root.querySelectorAll("article")).toHaveLength(0);
    t.ui.dispose(); await vi.advanceTimersByTimeAsync(500);
    expect(analyze).toHaveBeenCalledTimes(1);
  });
  it("does not call AI during conversation or when paused", async () => {
    const t = setup(); t.set({ ...t.get(), active: false });
    await vi.advanceTimersByTimeAsync(100); expect(t.analyze).not.toHaveBeenCalled();
    t.set({ ...t.get(), active: true });
    [...t.ui.root.querySelectorAll("button")].find(b => b.textContent === "잠시 멈추기")!.click();
    await vi.advanceTimersByTimeAsync(100); expect(t.analyze).not.toHaveBeenCalled(); t.ui.dispose();
  });
  it("reconsiders dismissed suggestions only after relevant edits and cooldown", async () => {
    const t = setup(); await vi.advanceTimersByTimeAsync(20);
    [...t.ui.root.querySelectorAll("button")].find(b => b.textContent === "넘기기")!.click();
    t.get().project.maps[t.get().mapId]!.events[0]!.name = "바뀐 출구";
    await vi.advanceTimersByTimeAsync(30);
    expect(t.analyze).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(100);
    expect(t.analyze).toHaveBeenCalledTimes(2);
    expect(t.ui.root.textContent).toContain("바뀐 출구"); t.ui.dispose();
  });
  it("retries after a reply arrives during a brief input pause", async () => {
    let resolve!: (value: string) => void;
    const analyze = vi.fn((_s: SuggestionSnapshot, _c: ReturnType<typeof inspectProjectSuggestions>) =>
      new Promise<string>(r => { resolve = r; }));
    const t = setup(analyze); await vi.advanceTimersByTimeAsync(10);
    t.set({ ...t.get(), active: false });
    resolve("[]"); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    t.set({ ...t.get(), active: true });
    await vi.advanceTimersByTimeAsync(120);
    expect(analyze).toHaveBeenCalledTimes(2); t.ui.dispose();
  });
  it("aborts the active request when the panel is disposed", async () => {
    let signal: AbortSignal | undefined;
    const t = setup(vi.fn((_s: SuggestionSnapshot, _c: ReturnType<typeof inspectProjectSuggestions>, abort?: AbortSignal) => {
      signal = abort; return new Promise<string>(() => {});
    }));
    await vi.advanceTimersByTimeAsync(20); t.ui.dispose();
    expect(signal?.aborted).toBe(true);
  });
  it("shows a truthful local fallback when the AI connection fails", async () => {
    const t = setup(vi.fn(async () => { throw Error("offline"); }));
    await vi.advanceTimersByTimeAsync(20);
    expect(t.ui.root.textContent).toContain("기본 확인 결과");
    expect(t.ui.root.querySelectorAll("article")).toHaveLength(1); t.ui.dispose();
  });
});
