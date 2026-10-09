import { resolve } from 'node:path';

/** Aggregate exit zero cannot prove that a required file executed assertions. */
export function requiredAxisFailures(axes, report, root) {
  return axes.flatMap(axis => {
    const result = report.testResults?.find(file => resolve(root, file.name) === resolve(root, axis.path));
    if (!result) return [`Required axis missing from results: ${axis.path}`];
    const assertions = result.assertionResults ?? [];
    if (!assertions.length) return [`Required axis executed zero assertions: ${axis.path}`];
    const unsuccessful = assertions.filter(assertion => assertion.status !== 'passed');
    if (result.status !== 'passed' || unsuccessful.length) {
      return [`Required axis did not execute successfully without skips: ${axis.path} (${unsuccessful.map(a => a.status).join(', ')})`];
    }
    return [];
  });
}
