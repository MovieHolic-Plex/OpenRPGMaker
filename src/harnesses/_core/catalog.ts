/** Serializable view of the canonical registry for non-TypeScript supervisors.
 * Entrypoints describe native access only; they do not certify an orchestration adapter.
 * Never serialize executable loaders or schema-normalization functions.
 */
import type { HarnessManifest } from "./manifest";

export function renderHarnessCatalog(harnesses: readonly HarnessManifest[]): string {
  return JSON.stringify({
    version: 1,
    source: "src/harnesses/_core/registry.ts",
    executionPolicy: "Native entrypoints do not imply supervisor execution, approval, publication, or project installation support. Verify each adapter and preserve scope.genre.",
    harnesses: harnesses.map((harness) => ({
      id: harness.id,
      title: harness.title,
      summary: harness.summary,
      scope: harness.scope,
      triggers: harness.triggers,
      seed: harness.seed,
      doc: harness.doc,
      stages: harness.stages,
      entrypoints: harness.entrypoints,
      workshopRunner: Boolean(harness.workshop),
    })),
  }, null, 2) + "\n";
}
