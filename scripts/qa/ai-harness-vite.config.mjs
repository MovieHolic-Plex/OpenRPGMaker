// Test-only source mutation. The real HTTP read still executes; no source file is edited.
import assert from 'node:assert/strict';
import appConfig from '../../vite.config.ts';

export default async (env) => {
  const config = await appConfig(env);
  const mutation = process.env.AI_HARNESS_MUTATION;
  assert.ok(!mutation || mutation === 'false-verified', 'Unknown QA mutation');
  if (mutation) config.plugins.push({
    name: 'qa-p1-false-verified', enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('/src/ai/assistantSession.ts')) return;
      const guards = [
        '      if (proof.kind !== "verified") return fail(proof.kind === "mismatch" ? `mismatch-${proof.reason}` : proof.kind, proof);',
        '      if (!proof.isCurrent || !store.isPersistenceReceiptCurrent(receipt)) return fail("stale", proof);',
      ];
      for (const guard of guards) {
        assert.equal(code.split(guard).length, 2, 'Mutation must match the exact current verifier guard once');
        code = code.replace(guard, '// QA mutation: promote the actual failed read to success.');
      }
      console.log('QA_MUTATION_APPLIED=false-verified');
      return { code, map: null };
    },
  });
  return config;
};
