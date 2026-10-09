import { describe, expect, it } from 'vitest';
import { requiredAxisFailures } from '../scripts/lib/surface-axis-results.mjs';

const root = '/repo';
const axes = [{ path: 'test/databaseAllTabsRenderWalk.test.ts' }];
const other = { name: '/repo/test/other.test.ts', status: 'passed', assertionResults: [{ status: 'passed' }] };
const db = { name: `/repo/${axes[0].path}`, status: 'passed', assertionResults: [{ status: 'passed' }] };

describe('required database surface execution', () => {
  it('accepts successful nonempty per-file execution', () => {
    expect(requiredAxisFailures(axes, { testResults: [other, db] }, root)).toEqual([]);
  });
  it('rejects a missing DB result while other axes pass', () => {
    expect(requiredAxisFailures(axes, { testResults: [other] }, root)).toHaveLength(1);
  });
  it('rejects zero DB execution while other axes pass', () => {
    expect(requiredAxisFailures(axes, { testResults: [other, { ...db, assertionResults: [] }] }, root)).toHaveLength(1);
  });
  it.each(['pending', 'skipped', 'todo', 'failed'])('rejects %s DB assertions even with a passed aggregate', status => {
    expect(requiredAxisFailures(axes, { success: true, testResults: [other, { ...db, assertionResults: [{ status }] }] }, root)).toHaveLength(1);
  });
});
