import { strict as assert } from "node:assert";
import { createBlankMap, createBlankProject } from "@/project/defaults";
import { extractOriginalContext, originalContextWindow } from "@/ai/originalContext";
import { buildIndependentReviewRequest, reviewChanges, reviewMapReferenceRoots } from "@/ai/independentReview";
import { defaultAiConfig } from "@/ai/llmClient";
import { estimateContextTokens } from "@/ai/contextCompaction";

const config = defaultAiConfig();
for (const topology of ["chain", "star"]) {
  const before = createBlankProject();
  assert.deepEqual(before.testPresets ?? [], []);
  const ids = [before.startMapId, ...Array.from({ length: 5 }, (_, i) => `map_${i}`)];
  for (const id of ids.slice(1)) before.maps[id] = { ...createBlankMap(id, 256, 256), id };
  for (const [i, id] of ids.entries()) {
    const map = before.maps[id];
    assert(map);
    const destinations = topology === "star" && i === 0 ? ids.slice(1) : [ids[i + 1] ?? before.startMapId];
    map.events = [{ id: `event_${id}`, x: 1, y: 1, trigger: { kind: "action" },
      commands: destinations.map(mapId => ({ kind: "transfer", mapId, x: 1, y: 1 })) }];
  }
  const after = structuredClone(before);
  const target = after.maps[before.startMapId];
  assert(target);
  assert.deepEqual([target.width, target.height], [20, 15]);
  target.name = "Renamed target";
  const changes = reviewChanges(before, after);
  const mapReferenceRoots = [before.startMapId, ...reviewMapReferenceRoots(before, after, changes)];
  const input = { revision: 1, originalRequest: "Rename the current map", changes,
    before: [extractOriginalContext(before, { snapshotId: "before", currentMapId: before.startMapId, mapReferenceRoots })],
    after: [extractOriginalContext(after, { snapshotId: "after", currentMapId: before.startMapId, mapReferenceRoots })],
    toolResults: [], acceptance: null, requiredProblems: [], images: [] };
  assert.deepEqual(changes.map(change => change.path), ["/maps/map_blank_start"]);
  for (const contexts of [input.before, input.after]) assert.deepEqual(contexts.flatMap(context => context.entries)
    .filter(entry => /^\/maps\/[^/]+$/.test(entry.id)).map(entry => entry.id), ["/maps/map_blank_start"]);
  const request = buildIndependentReviewRequest(config, input);
  const tokens = estimateContextTokens(request.messages) + Math.min(config.maxTokens, 16384);
  assert(tokens <= originalContextWindow(config));
  const user = request.messages[1]?.content;
  assert(Array.isArray(user));
  const text = user.find(part => part.type === "text");
  assert(text?.type === "text");
  console.log(JSON.stringify({ topology, model: config.model, changedPaths: changes.map(change => change.path),
    reviewMapsPerProjection: 1, evidenceChars: text.text.length, requestTokensWithReserve: tokens,
    windowTokens: originalContextWindow(config) }));
}
