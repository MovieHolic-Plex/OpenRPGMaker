import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { execFileSync } from "node:child_process";

// Offline runner evidence, never the real-provider Q6 or remote sample publication.
for (const key of ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY", "VITE_SUPABASE_PROJECT_ID", "SUPABASE_URL", "SUPABASE_ANON_KEY"]) process.env[key] = "";
const { values } = parseArgs({ options: { evidence: { type: "string" } }, strict: true });
assert.ok(values.evidence, "A run-owned evidence directory is required");
const directory = values.evidence;
const [{ runTool }, { applyProposedProject }, { cloneDetachedDraft }, { store }, history, fixture, domain, { sha256HexTextSync }] = await Promise.all([
  import("../../src/editor/tools/toolRunner"), import("../../src/editor/tools/applyChangesetToStore"),
  import("../../src/editor/detachedDraftMemory"), import("../../src/project/store"), import("../../src/editor/mapEditHistory"),
  import("../../test/support/spatialSpaceCompilerFixture"), import("../../src/project/spatial/domain"), import("../../src/util/sha256"),
]);
const project = fixture.spaceCompilerFixture();
const document = fixture.fixtureDocument(project);
const source = domain.own(document.library.spaces, fixture.spaceDesign);
project.spatialAuthoring = { ...document, library: { ...document.library, spaces: { ...document.library.spaces,
  [source.id]: { ...source, objectSlots: source.objectSlots.map(slot => slot.id === "beds" ? { ...slot, quantity: 1 } : slot) },
} } };
store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
store.replace(project);
history.resetMapEditHistory();
const baseline = JSON.stringify(store.getCurrent());
const ctx = { project: cloneDetachedDraft(store.getCurrent()) };
const transcript: { readonly name: string; readonly args: Record<string, unknown>; readonly result: unknown }[] = [];
function call(name: string, args: Record<string, unknown>) {
  const result = runTool(ctx, name, args);
  transcript.push({ name, args, result });
  assert.equal(result.ok, true, JSON.stringify(result));
  return result;
}
call("list_spatial_designs", { kind: "space" });
const lookup = call("get_spatial_design", { kind: "space", id: source.id });
const body = domain.designNode(fixture.fixtureDocument(ctx.project).library, { kind: "space", id: source.id });
assert.equal(body.kind, "space");
const edited = { ...body.design, revision: 2, objectSlots: body.design.objectSlots.map(slot => slot.id === "beds" ? { ...slot, quantity: 2 } : slot) };
call("upsert_spatial_design", { kind: "space", expectedRevision: 1, space: edited });
const preview = call("preview_spatial_build", { kind: "space", id: source.id, occurrenceId: "transcript-room", seed: 23 });
assert.ok(typeof preview.data === "object" && preview.data !== null && "previewId" in preview.data && typeof preview.data.previewId === "string");
call("apply_spatial_build", { previewId: preview.data.previewId });
assert.equal(JSON.stringify(store.getCurrent()), baseline, "Tools must leave live state untouched before proposal acceptance");
const proposed = cloneDetachedDraft(ctx.project);
const accepted = await applyProposedProject(proposed, { source: "agent", summary: "Canonical two-bed room", toolNames: transcript.map(call => call.name) });
transcript.push({ name: "applyProposedProject", args: { source: "agent" }, result: accepted.ok ? { ok: true, commit: accepted.commit } : accepted });
assert.equal(accepted.ok, true, JSON.stringify(accepted));
const current = store.getCurrent();
const acceptedDocument = fixture.fixtureDocument(current);
assert.equal(domain.own(acceptedDocument.occurrences, "transcript-room").source.revision, 2);
const beds = Object.values(acceptedDocument.occurrences).filter(occurrence => occurrence.parentId === "transcript-room" && occurrence.source.id === "bed-design");
assert.equal(beds.length, 2);
assert.ok(beds.every(bed => bed.bindings.length > 0));
assert.deepEqual(acceptedDocument.occurrences[fixture.spaceRoot], document.occurrences[fixture.spaceRoot]);
const acceptedJson = JSON.stringify(current);
assert.equal(history.undoMapEdit(), true);
assert.equal(JSON.stringify(store.getCurrent()), baseline);
assert.equal(history.redoMapEdit(), true);
assert.equal(JSON.stringify(store.getCurrent()), acceptedJson);
const rejected = runTool({ project: cloneDetachedDraft(current) }, "apply_spatial_build", { previewId: "forged" });
assert.equal(rejected.ok, false);
transcript.push({ name: "apply_spatial_build", args: { previewId: "forged" }, result: rejected });
const paths = execFileSync("git", ["ls-files", "-m", "-o", "--exclude-standard"], { encoding: "utf8" }).trim().split("\n")
  .filter(path => /^(src|test|scripts)\//.test(path));
const sourceHashes = Object.fromEntries(await Promise.all(paths.map(async path => [path, sha256HexTextSync(await readFile(path, "utf8"))])));
await mkdir(directory, { recursive: true });
const report = { mode: "offline-real-tool-runner", provider: null, base: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  sourceHashes, fixtureSHA256: sha256HexTextSync(baseline), acceptedSHA256: sha256HexTextSync(acceptedJson),
  transcript, beds: beds.map(bed => ({ id: bed.id, source: bed.source, bindings: bed.bindings })),
  sourceLookupSucceeded: lookup.ok, undoRedoExact: true, remoteWrites: 0, visualAcceptance: "parent-owned", realProviderQ6: "not-run" };
await writeFile(`${directory}/tool-transcript.json`, `${JSON.stringify(report, null, 2)}\n`);
await writeFile(`${directory}/accepted-project.json`, `${acceptedJson}\n`);
history.resetMapEditHistory();
console.log(JSON.stringify({ status: "passed", transcript: `${directory}/tool-transcript.json`, calls: transcript.length, bedCount: beds.length, undoRedoExact: true }));
