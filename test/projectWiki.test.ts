import { describe, expect, it } from "vitest";
import { createProjectWikiCoordinator } from "@/editor/projectWikiCoordinator";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import type { ProjectWikiPatch } from "@/project/world";
import type { ExtractProjectWikiInput } from "@/ai/projectWikiClient";

function patch(input: ExtractProjectWikiInput): ProjectWikiPatch {
  return { upserts: [{
    id: "w_combat", type: "guideline", name: "Combat", summary: "Contact battles",
    wiki: { kind: "declaration", basis: "explicit", combatMode: "contact", sourceIds: input.sources.map((source) => source.id) },
  }] };
}

describe("editor-owned wiki checkpoints", () => {
  it("backfills all available history in bounded batches without dropping early decisions", async () => {
    const project = createEmptyToolProject("History");
    const sources = Array.from({ length: 40 }, (_, index) => ({
      id: `history-${index}`, kind: "user" as const, text: `Fact ${index}`, at: index + 1,
    }));
    const coordinator = createProjectWikiCoordinator({
      getProject: () => project, getIdentity: () => "history-project", history: async () => sources,
      extract: async (input) => {
        if (input.sources.length > 16) throw new Error("history extraction payload exceeds its batch budget");
        return { upserts: input.sources.map((source) => ({
          id: `w_${source.id}`, type: "concept" as const, name: source.text, summary: source.text,
          wiki: { kind: "knowledge" as const, basis: "explicit" as const, topic: source.id, sourceIds: [source.id] },
        })) };
      },
      updateWorld: (world) => { project.world = world; },
      flush: async () => ({ kind: "saved" }),
    });

    const added = await coordinator.backfill();

    expect(added).toBe(40);
    expect(project.world?.entities.map((entity) => entity.wiki?.sources[0]?.id)).toEqual(sources.map((source) => source.id));
    expect(await coordinator.backfill()).toBe(0);
  });
  it("records actual applied state without depending on model prose", async () => {
    const project = createEmptyToolProject("Applied");
    project.world = { entities: [{
      id: "w_rule", type: "guideline", name: "Rule", summary: "Contact", origin: "ai",
      wiki: { kind: "declaration", basis: "explicit", combatMode: "contact",
        sources: [{ id: "u0", kind: "user", text: "Use contact battles", at: 1 }] },
    }], relations: [] };
    const coordinator = createProjectWikiCoordinator({
      getProject: () => project, getIdentity: () => "project",
      extract: async () => { throw new Error("applied evidence must not depend on invented model fields"); },
      updateWorld: (world) => { project.world = world; },
      flush: async () => ({ kind: "saved" }),
    });

    await coordinator.observe("Applied title edit", ["set_title_screen"]);

    const observed = project.world?.entities.find((entity) => entity.wiki?.kind === "progress");
    expect(observed?.wiki?.basis).toBe("observed");
    const source = JSON.parse(observed?.wiki?.sources[0]?.text ?? "{}");
    expect(source.appliedTools).toEqual(["set_title_screen"]);
    expect(source.actionCombatEnabled).toBe(false);
  });
  it("persists extracted user decisions before resolving the authoring barrier", async () => {
    const project = createEmptyToolProject("Wiki");
    const order: string[] = [];
    const coordinator = createProjectWikiCoordinator({
      getProject: () => project, getIdentity: () => "project-one", history: async () => [],
      extract: async (input) => { order.push("extract"); return patch(input); },
      updateWorld: (world) => { project.world = world; order.push("apply"); },
      flush: async () => { order.push("saved"); return { kind: "saved" }; },
    });

    const world = await coordinator.prepare({ text: "Use contact battles", mapId: null, composerMode: "do" });

    expect(order).toEqual(["extract", "apply", "saved"]);
    expect(world?.entities[0]?.wiki?.sources[0]?.text).toBe("Use contact battles");
    expect(world?.entities[0]?.wiki?.combatMode).toBe("contact");
  });

  it("rejects a project switch while the model is running without mutating the new project", async () => {
    const project = createEmptyToolProject("Original");
    let identity = "original";
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let started: (() => void) | undefined;
    const entered = new Promise<void>((resolve) => { started = resolve; });
    const coordinator = createProjectWikiCoordinator({
      getProject: () => project, getIdentity: () => identity, history: async () => [],
      extract: async (input) => { started?.(); await gate; return patch(input); },
      updateWorld: (world) => { project.world = world; },
      flush: async () => ({ kind: "saved" }),
    });
    const pending = coordinator.prepare({ text: "Use contact battles", mapId: null, composerMode: "do" });
    await entered;

    identity = "different-project";
    release?.();

    await expect(pending).rejects.toMatchObject({ reason: "project-changed" });
    expect(project.world).toBeUndefined();
  });

  it("does not claim a disabled or failed remote save is a completed checkpoint", async () => {
    const project = createEmptyToolProject("Wiki");
    const coordinator = createProjectWikiCoordinator({
      getProject: () => project, getIdentity: () => "project", history: async () => [],
      extract: async (input) => patch(input),
      updateWorld: (world) => { project.world = world; },
      flush: async () => ({ kind: "disabled" }),
    });

    const pending = coordinator.prepare({ text: "Use contact battles", mapId: null, composerMode: "do" });

    await expect(pending).rejects.toMatchObject({ reason: "save" });
    expect(project.world?.entities[0]?.wiki?.basis).toBe("explicit");
  });

  it("keeps question mode read-only while exposing existing wiki", async () => {
    const project = createEmptyToolProject("Wiki");
    project.world = { entities: [], relations: [] };
    const coordinator = createProjectWikiCoordinator({
      getProject: () => project, getIdentity: () => "project",
      extract: async () => { throw new Error("question must not extract or write"); },
    });

    const result = await coordinator.prepare({ text: "What is this game?", mapId: null, composerMode: "ask" });

    expect(result).toBe(project.world);
  });
});
