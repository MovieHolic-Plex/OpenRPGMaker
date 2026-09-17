import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Project } from "@/project/types";
import type { PiCommandSurface } from "@/editor/panels/aiPiAgentCommand";
const h = vi.hoisted(() => ({
  current: null as unknown, calls: [] as any[], confirms: 0, confirm: true,
  prompt: null as null | { apply(): void; discard(): void },
}));
vi.mock("@/editor/tools/applyChangesetToStore", () => ({
  captureProposalBase: (project: unknown) => ({ project }),
  applyProposedProject: async (project: unknown, options: any) => {
    if (options.base.project !== h.current) return { ok: false, reason: "stale-base" };
    h.calls.push(options); h.current = project;
    options.onApplied?.({ applied: project, commitProject: project });
    return { ok: true, applied: project };
  },
}));
vi.mock("@/project/authoredProjectBaseline", () => ({ AuthoredProjectBaseline: class {} }));
vi.mock("@/editor/tools/spatialToolState", () => ({ adoptSpatialToolProof() {} }));
vi.mock("@/editor/ui/modal", () => ({ showConfirm: async () => { h.confirms++; return h.confirm; } }));
vi.mock("@/editor/panels/aiChangePreview", () => ({ openWideChangeViewer() {} }));
vi.mock("@/editor/panels/aiPendingReview", () => ({ createPendingReviewPrompt: (actions: any) => {
  h.prompt = actions;
  return { root: { remove() {}, querySelector() { return { textContent: "" }; } } };
} }));
import { createPiPublication } from "@/editor/panels/aiPiPublication";
const initial = () => ({ maps: { a: { id: "a", events: [], name: "before" }, b: { id: "b", events: [], name: "B" } } }) as unknown as Project;
const surface = (signal?: AbortSignal) => ({ appendCard() {}, appendBubble() {}, setStatus() {}, getCurrentMapId: () => "a", signal }) as PiCommandSurface;
const checkpoint = (project: Project, toolName = "paint_tiles") => ({ project, toolName, label: "지형" });
beforeEach(() => { h.current = initial(); h.calls = []; h.confirms = 0; h.confirm = true; h.prompt = null; });
describe("publication authority", () => {
  it.each(["yolo", "auto", "default"] as const)("%s publishes real changes and groups undo", async mode => {
    const base = h.current as Project;
    const pub = createPiPublication(base, mode, surface());
    const next = structuredClone(base); next.maps.a!.name = "first";
    await pub.publish(checkpoint(next));
    expect(h.current).toBe(next);
    const last = structuredClone(next); last.maps.a!.name = "second";
    await pub.publish(checkpoint(last));
    expect(h.current).toBe(last);
    expect(h.calls.map(c => c.skipSnapshot)).toEqual([false, true]);
  });
  it("DEFAULT asks before destructive mutation; refusal leaves the store unchanged", async () => {
    h.confirm = false;
    const base = h.current as Project;
    const next = structuredClone(base); delete next.maps.b;
    await expect(createPiPublication(base, "default", surface()).publish(checkpoint(next, "remove_map"))).rejects.toThrow("취소");
    expect(h.current).toBe(base); expect(h.confirms).toBe(1); expect(h.calls).toHaveLength(0);
  });
  it.each(["yolo", "auto"] as const)("%s does not ask for map deletion", async mode => {
    const base = h.current as Project;
    const next = structuredClone(base); delete next.maps.b;
    await createPiPublication(base, mode, surface()).publish(checkpoint(next, "remove_map"));
    expect(h.confirms).toBe(0); expect(h.current).toBe(next);
  });
  it("step waits before mutation and abort leaves no change", async () => {
    const base = h.current as Project;
    const next = structuredClone(base); next.maps.a!.name = "draft";
    const controller = new AbortController();
    const pub = createPiPublication(base, "step", surface(controller.signal));
    const pending = pub.publish(checkpoint(next));
    await Promise.resolve(); await Promise.resolve();
    expect(h.prompt).not.toBeNull(); expect(h.current).toBe(base);
    controller.abort();
    await expect(pending).rejects.toThrow("중단");
    expect(h.current).toBe(base);
  });
  it("human edit between milestones is not adopted as new authority", async () => {
    const base = h.current as Project;
    const pub = createPiPublication(base, "yolo", surface());
    const next = structuredClone(base); next.maps.a!.name = "first";
    await pub.publish(checkpoint(next));
    const human = structuredClone(next); human.maps.a!.name = "human"; h.current = human;
    const last = structuredClone(next); last.maps.a!.name = "second";
    await expect(pub.publish(checkpoint(last))).rejects.toThrow("stale-base");
    expect(h.current).toBe(human);
  });
});

it("review mode rejects unexpected streaming publications", async () => {
  const base = h.current as Project;
  const next = structuredClone(base); next.maps.a!.name = "unexpected";
  await expect(createPiPublication(base, "review", surface()).publish(checkpoint(next))).rejects.toThrow("검토 후 적용");
  expect(h.current).toBe(base); expect(h.calls).toHaveLength(0);
});
