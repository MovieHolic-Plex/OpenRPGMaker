import { createHash } from "node:crypto";
import { runInNewContext } from "node:vm";
import type { RuntimeManifest } from "../../src/project/gameRelease";
import type { ReleaseDependencyCollector } from "../../src/project/releaseDependencies";

/** Execute only the operator-retained collector, never code from an upload. */
export async function operatorRuntimeWithCollector(manifest: RuntimeManifest, bytes: Uint8Array): Promise<RuntimeManifest & { collectDependencies: ReleaseDependencyCollector }> {
  const proof = manifest.files.find((file) => file.path === "web/dependency-collector.js");
  if (!proof || proof.bytes !== bytes.byteLength || bytes.byteLength > 4 * 1024 * 1024
    || createHash("sha256").update(bytes).digest("hex") !== proof.sha256) throw new Error("runtime-unavailable");
  const source = new TextDecoder().decode(bytes);
  return {
    ...manifest,
    collectDependencies: (projectJson: string) => runInNewContext(
      `${source}\nOPRN_RELEASE_COLLECTOR.collectReleaseDependencies(projectJson)`,
      { projectJson, TextEncoder, TextDecoder, atob },
      { timeout: 5000, contextCodeGeneration: { strings: false, wasm: false } },
    ) as ReturnType<ReleaseDependencyCollector>,
  };
}
