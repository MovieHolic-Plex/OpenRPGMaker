// Test-only source mutation. The real HTTP read still executes; no source file is edited.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import appConfig from '../../vite.config.ts';
import { recoveryTransform } from './ai-harness-recovery.mjs';

export default async (env) => {
  const config = await appConfig(env);
  if (process.env.QA_SCENARIO === 'recovery') config.plugins.push({
    name: 'qa-p4-native-recovery-boundaries', enforce: 'pre', transform: recoveryTransform,
  });
  // Installed only by the late-cancel runner. Bind the served observation wrapper
  // to both original and transformed bytes; never change a product file on disk.
  if (process.env.QA_SCENARIO === 'late-cancel') config.plugins.push({
    name: 'qa-p3-proposal-completion', enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('/src/editor/panels/aiProposalCard.ts')) return;
      const target = '    applyProposal,\n';
      assert.equal(code.split(target).length, 2, 'Observe exactly one proposal-host API boundary');
      const observed = 'import { observeProposalCall } from "/scripts/qa/ai-harness-p3-completion.mjs";\n'
        + code.replace(target, '    applyProposal: observeProposalCall(applyProposal, () => controller.session),\n');
      const hash = text => createHash('sha256').update(text).digest('hex');
      console.log('QA_PROPOSAL_OBSERVER=' + JSON.stringify({ sourceHash: hash(code), transformedHash: hash(observed) }));
      return { code: observed, map: null };
    },
  });
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
