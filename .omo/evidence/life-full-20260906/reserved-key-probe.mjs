import assert from "node:assert/strict";
import { createServer } from "vite";

const server = await createServer({
  configFile: false,
  root: process.cwd(),
  resolve: { alias: { "@": `${process.cwd()}/src` } },
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, watch: null },
  appType: "custom",
});
try {
  const { parseLifeState, LifeReconciliationError } = await server.ssrLoadModule("/src/project/lifeRecovery.ts");
  const text = '{"bundleContributions":{"bundle":{"__proto__":1}}}';
  const input = JSON.parse(text);
  let parsed;
  try {
    parsed = parseLifeState(input);
  } catch (error) {
    if (!(error instanceof LifeReconciliationError)) throw error;
    assert.equal(JSON.stringify(input), text);
    console.log(JSON.stringify({ result: "explicit-refusal", rawUnchanged: true, reason: error.reason }));
  }
  if (parsed) {
    const direct = Object.hasOwn(parsed.bundleContributions?.bundle ?? {}, "__proto__");
    const unresolved = Object.values(parsed.lifeRecovery?.claims ?? {}).some(
      claim => JSON.stringify(claim.unresolved?.record) === JSON.stringify(input.bundleContributions.bundle),
    );
    console.log(JSON.stringify({ result: "parsed", directOwner: direct, unresolvedOwner: unresolved, parsed }));
    assert.equal(JSON.stringify(input), text);
    assert.ok(direct || unresolved, "A positive source amount must retain an owner or explicitly refuse parsing");
  }
} finally {
  await server.close();
  console.log(JSON.stringify({ cleanup: "middleware-only Vite closed", remoteWrites: 0 }));
}
