import { describe, expect, it } from "vitest";
import { buildIndependentReviewRequest, reviewChanges, reviewEvidenceContexts, reviewMapReferenceRoots,
  type ReviewInput } from "@/ai/independentReview";
import { estimateContextTokens } from "@/ai/contextCompaction";
import type { IntentDeclaration } from "@/ai/intentDeclaration";
import { defaultAiConfig } from "@/ai/llmClient";
import { extractOriginalContext, originalContextWindow } from "@/ai/originalContext";
import { createBlankMap, createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";
import { independentReviewPayload } from "./independentReviewFixture";

/** Declare a switch/variable space and seed the authored start state for every id,
 * the way the editor writes it (measured: a 43-map village declares 1,000 of each). */
function declareFlagSpace(project: Project, count: number): void {
  project.switches = Array.from({ length: count }, (_, i) => ({ id: `sw_${i}`, name: `Switch ${i}` }));
  project.variables = Array.from({ length: count }, (_, i) => ({ id: `var_${i}`, name: `Variable ${i}` }));
  project.session = { ...project.session,
    switches: Object.fromEntries(project.switches.map(entry => [entry.id, false])),
    variables: Object.fromEntries(project.variables.map(entry => [entry.id, 0])) };
}

const context = (project: Project, intent: IntentDeclaration | null = null) =>
  extractOriginalContext(project, { snapshotId: "s", currentMapId: project.startMapId,
    mapReferenceRoots: [project.startMapId], intent });
const entryIds = (project: Project, intent: IntentDeclaration | null = null): string[] =>
  context(project, intent).entries.map(entry => entry.id);

const declaredIntent = (collections: readonly string[]): IntentDeclaration => ({
  mode: "modify", space: "none", facility: null, targetMapId: null, useSelection: false,
  clarify: null, clarifyOptions: [], needsPlan: false, resetsContext: false, tools: [],
  readBeforeWrite: { project: true, collections, references: true },
});

describe("review evidence scale", () => {
  it("delivers the flag space through the project summary, not one record per id", () => {
    const project = createBlankProject();
    declareFlagSpace(project, 400);
    const evidence = context(project);
    const ids = evidence.entries.map(entry => entry.id);

    // /summary already names every declaration, so per-record entries only repeat it.
    expect(ids.filter(id => id.startsWith("/database/switches/"))).toEqual([]);
    expect(ids.filter(id => id.startsWith("/database/variables/"))).toEqual([]);
    expect(JSON.stringify(evidence.entries.find(entry => entry.id === "/summary")?.value))
      .toContain('"sw_7"');
  });

  it("keeps an authored non-default start value as a reference", () => {
    const project = createBlankProject();
    declareFlagSpace(project, 400);
    project.session.switches.sw_7 = true;
    project.session.variables.var_9 = 5;
    const evidence = context(project);
    const ids = evidence.entries.map(entry => entry.id);

    // Only the enumeration stops being a reference; an authored seed value still is one.
    expect(ids).toContain("/database/switches/sw_7");
    expect(ids).toContain("/database/variables/var_9");
    expect(ids).not.toContain("/database/switches/sw_6");
    expect(ids).not.toContain("/database/variables/var_8");
    // Relevance narrows; the reviewable value does not — the complete start state stays.
    expect(evidence.entries.find(entry => entry.id === "/session")?.value).toEqual(project.session);
  });

  it("still includes flag records an intent explicitly declares", () => {
    const project = createBlankProject();
    declareFlagSpace(project, 400);
    const ids = entryIds(project, declaredIntent(["switches"]));

    expect(ids).toContain("/database/switches/sw_7");
    expect(ids.filter(id => id.startsWith("/database/variables/"))).toEqual([]);
  });
});

describe("review evidence contexts", () => {
  const withMaps = (count: number): { before: Project; after: Project; mapIds: string[] } => {
    const before = createBlankProject();
    declareFlagSpace(before, 400);
    const mapIds = [before.startMapId];
    for (let i = 0; i < count - 1; i++) {
      const id = `map_extra_${i}`;
      before.maps[id] = { ...createBlankMap(id, 40, 40), id };
      mapIds.push(id);
    }
    const after = structuredClone(before);
    for (const id of mapIds) after.maps[id] = { ...after.maps[id]!, name: `Renamed ${id}` };
    return { before, after, mapIds };
  };

  const evidence = (project: Project, mapIds: string[], roots: readonly unknown[], prefix: string) =>
    reviewEvidenceContexts(project, { snapshotId: `${prefix}-1`, mapIds,
      targetMapId: mapIds[0]!, mapReferenceRoots: roots, intent: null });

  it("carries every reviewed map in one context per side", () => {
    const { before, after, mapIds } = withMaps(4);
    const roots = reviewMapReferenceRoots(before, after, reviewChanges(before, after));
    const contexts = evidence(after, mapIds, roots, "after");

    expect(contexts).toHaveLength(1);
    const ids = contexts[0]!.entries.map(entry => entry.id);
    for (const mapId of mapIds) {
      expect(ids).toContain(`/maps/${mapId}`);
      expect(ids).toContain(`/maps/${mapId}/tiles`);
    }
    expect(contexts[0]!.target.mapId).toBe(mapIds[0]);
  });

  it("pays the shared project payload once instead of once per map", () => {
    const config = defaultAiConfig();
    const envelope = (count: number): number => {
      const { before, after, mapIds } = withMaps(count);
      const changes = reviewChanges(before, after);
      const roots = reviewMapReferenceRoots(before, after, changes);
      const input: ReviewInput = { revision: 1, originalRequest: "Rename every map", changes,
        before: evidence(before, mapIds, roots, "before"), after: evidence(after, mapIds, roots, "after"),
        toolResults: [], acceptance: null, requiredProblems: [], images: [] };
      return estimateContextTokens(buildIndependentReviewRequest(config, input).messages);
    };

    const one = envelope(1);
    const six = envelope(6);
    // Five more maps may add their own map entries, never five more copies of the
    // project-wide payload. Per-map fan-out made this ratio ~6x and overflowed the window.
    expect(six).toBeLessThan(one * 2);
    expect(six + Math.min(config.maxTokens, 16384)).toBeLessThanOrEqual(originalContextWindow(config));
  });

  it("fits once an unchanged context map is left out of the evidence", () => {
    // The target map is where the user is standing, not what this review judges. A large
    // unchanged one can still overflow the envelope on its own, which is what the session's
    // single shrink-and-retry drops — required evidence for the changed map is untouched.
    const before = createBlankProject();
    declareFlagSpace(before, 400);
    const target = before.startMapId;
    before.maps[target] = { ...createBlankMap(target, 512, 512), id: target };
    before.maps.map_small = { ...createBlankMap("map_small", 8, 8), id: "map_small" };
    const after = structuredClone(before);
    after.maps.map_small = { ...after.maps.map_small!, name: "Renamed small" };

    const changes = reviewChanges(before, after);
    const roots = reviewMapReferenceRoots(before, after, changes);
    const build = (mapIds: string[], targetMapId: string) => buildIndependentReviewRequest(defaultAiConfig(), {
      revision: 1, originalRequest: "Rename the small map", changes, toolResults: [],
      before: reviewEvidenceContexts(before, { snapshotId: "before-1", mapIds, targetMapId,
        mapReferenceRoots: roots, intent: null }),
      after: reviewEvidenceContexts(after, { snapshotId: "after-1", mapIds, targetMapId,
        mapReferenceRoots: roots, intent: null }),
      acceptance: null, requiredProblems: [], images: [] });

    expect(() => build([target, "map_small"], target)).toThrow("independent-review-window-exceeded");
    // Narrowing the reviewed set is not enough on its own: a context always includes its own
    // target map, so the shrink has to move the target onto a changed map as well.
    expect(() => build(["map_small"], target)).toThrow("independent-review-window-exceeded");

    const shrunk = build(["map_small"], "map_small");
    const entryIds = independentReviewPayload(shrunk)?.after.flatMap(c => c.entries.map(entry => entry.id));
    expect(entryIds).toContain("/maps/map_small");
    expect(entryIds).not.toContain(`/maps/${target}`);
  });

  it("fits a review on a 200K reviewer window that per-map fan-out overflowed", () => {
    const config = { ...defaultAiConfig(), providerId: "google-antigravity", model: "claude-opus-4-5" };
    expect(originalContextWindow(config)).toBe(200_000);
    const { before, after, mapIds } = withMaps(4);
    const changes = reviewChanges(before, after);
    const roots = reviewMapReferenceRoots(before, after, changes);

    const request = buildIndependentReviewRequest(config, { revision: 1, originalRequest: "Rename every map",
      changes, before: evidence(before, mapIds, roots, "before"), after: evidence(after, mapIds, roots, "after"),
      toolResults: [], acceptance: null, requiredProblems: [], images: [] });
    expect(estimateContextTokens(request.messages) + Math.min(config.maxTokens, 16384))
      .toBeLessThanOrEqual(200_000);
  });
});
