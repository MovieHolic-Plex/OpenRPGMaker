// Fails the exported-player build when editor-only code or an AI-provider host reaches the player bundle.
//
// The exported player (player.html / player.js) ships to players. It must never carry the editor's AI
// plumbing: provider hosts, the harness registry, workshop/object-gen kits, or the assistant (src/ai).
// 2026-10-27: src/project/gameDesignBrief.ts imported the full harness registry to normalise one saved
// contract, which pulled every harness editor runner and the workshop object-gen kit (with an
// api.openai.com host list) into the player through src/project/io.ts. That schema code now uses the
// light src/harnesses/_core/contracts.ts; this guard keeps the next such edge from shipping silently.
// Both player builds (vite.player.config.ts, vite.standalone.config.ts) run it.

/** Module ids (posix paths) that must never be part of the player graph. */
export const PLAYER_FORBIDDEN_MODULES = Object.freeze([
  { label: "editor-ai-assistant", pattern: /\/src\/ai\//u },
  { label: "harness-registry", pattern: /\/src\/harnesses\/_core\/registry\.ts$/u },
  { label: "workshop-kit", pattern: /\/src\/harnesses\/_core\/workshop\//u },
  { label: "harness-editor-runner", pattern: /\/src\/harnesses\/[^/]+\/editor\//u },
  { label: "editor-workshop", pattern: /\/src\/editor\/workshop\//u },
  { label: "remote-database-client", pattern: /(?:legacyDbProject(?:Config|Sync)|tileMetadataDb)/iu },
]);

/** Text that must never appear in a player .js/.css/.html artifact. */
export const PLAYER_FORBIDDEN_HOSTS = Object.freeze([
  {
    label: "ai-provider-host",
    pattern:
      /(?:api\.(?:openai|anthropic|x|mistral|groq|together|cohere|deepseek)\.(?:com|ai|xyz)|generativelanguage\.googleapis\.com|cloudcode-pa\.googleapis\.com|aiplatform\.googleapis\.com|openrouter\.ai)/iu,
  },
]);

const TEXT_ARTIFACT = /\.(?:css|html|js|mjs)$/u;

function importerChain(ctx, id, root) {
  const chain = [id];
  const seen = new Set(chain);
  let current = id;
  while (chain.length < 24) {
    const info = ctx.getModuleInfo(current);
    const next = [...(info?.importers ?? []), ...(info?.dynamicImporters ?? [])].find((candidate) => !seen.has(candidate));
    if (!next) break;
    chain.push(next);
    seen.add(next);
    current = next;
  }
  return chain.map((entry) => entry.replaceAll("\\", "/").replace(root, "")).join(" <- ");
}

/** @returns {import("vite").Plugin} */
export function playerBundleGuardPlugin() {
  const root = process.cwd().replaceAll("\\", "/");
  return {
    name: "oprn-player-bundle-guard",
    apply: "build",
    buildEnd(error) {
      if (error) return;
      const problems = [];
      for (const rawId of this.getModuleIds()) {
        const id = rawId.replaceAll("\\", "/");
        const rule = PLAYER_FORBIDDEN_MODULES.find((candidate) => candidate.pattern.test(id));
        if (rule) problems.push(`${rule.label}: ${importerChain(this, rawId, root)}`);
      }
      if (problems.length > 0) {
        this.error(`editor-only modules reached the exported player:\n  ${problems.slice(0, 12).join("\n  ")}`);
      }
    },
    generateBundle(_options, bundle) {
      const problems = [];
      for (const [fileName, output] of Object.entries(bundle)) {
        if (!TEXT_ARTIFACT.test(fileName)) continue;
        const text = output.type === "chunk" ? output.code : typeof output.source === "string" ? output.source : "";
        for (const rule of PLAYER_FORBIDDEN_HOSTS) {
          // Report only the label and file, never the matched text.
          if (rule.pattern.test(text)) problems.push(`${rule.label}: ${fileName}`);
        }
      }
      if (problems.length > 0) {
        this.error(`AI-provider hosts reached the exported player:\n  ${problems.join("\n  ")}`);
      }
    },
  };
}
