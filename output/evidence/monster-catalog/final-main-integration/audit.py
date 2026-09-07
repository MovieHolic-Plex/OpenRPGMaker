#!/usr/bin/env python3
"""Audit merge preservation and compare every failed assertion with frozen evidence."""
import hashlib, json, pathlib, re, subprocess
root = pathlib.Path(__file__).resolve().parents[4]
out = pathlib.Path(__file__).resolve().parent
ours = '02acae3604b014f8c5a7e9861d03cdda286e35cb'
theirs = '147218a2dcfd5d5996e666395e53626706904a60'
def git(*args):
    return subprocess.check_output(['git', *args], cwd=root).decode().strip()
base = git('merge-base', ours, theirs)
def tree(rev):
    result = {}
    for line in git('ls-tree', '-r', rev).splitlines():
        meta, path = line.split('\t', 1)
        result[path] = meta
    return result
b, o, t, m = [tree(rev) for rev in [base, ours, theirs, git('write-tree')]]
all_paths = set(b) | set(o) | set(t)
ours_changed = {p for p in all_paths if b.get(p) != o.get(p)}
theirs_changed = {p for p in all_paths if b.get(p) != t.get(p)}
overlap = sorted(ours_changed & theirs_changed)
assert overlap == ['DESIGN.md', 'openwiki/INDEX.md', 'openwiki/runtime-project-schema.md'], overlap
violations = []
for p in all_paths - set(overlap):
    expected = t.get(p) if p in theirs_changed else o.get(p)
    if m.get(p) != expected: violations.append(p)
assert not violations, violations
for p in ['DESIGN.md', 'openwiki/runtime-project-schema.md']:
    # Both authored documents must exactly equal git's automatic textual merge.
    tmp = pathlib.Path('/dev/shm/st_01a0793a')
    paths = [tmp / f'{label}-{pathlib.Path(p).name}' for label in ['ours','base','theirs']]
    for path, rev in zip(paths, [ours,base,theirs]):
        path.write_bytes(subprocess.check_output(['git','show',f'{rev}:{p}'], cwd=root))
    expected = subprocess.check_output(['git','merge-file','-p',*[str(path) for path in paths]])
    assert (root / p).read_bytes() == expected, p
immutable = 'output/evidence/monster-catalog/full-suite/'
assert not git('diff', '--cached', '--name-only', ours, '--', immutable)
report = json.loads((out / 'focused.json').read_text())
frozen_path = root / immutable / 'upstream/existing-66/batch-08.json'
frozen = json.loads(frozen_path.read_text())
def failures(report):
    return {(f['name'].split('/test/')[-1], a['fullName']): a['failureMessages']
            for f in report['testResults'] for a in f['assertionResults'] if a['status'] == 'failed'}
def normalized(messages):
    return [message.replace(str(root), '<ROOT>').replace('/dev/shm/st_01a079-existing/pristine', '<ROOT>') for message in messages]
prior = failures(frozen)
comparisons = []
for key, messages in failures(report).items():
    match = key in prior and normalized(messages) == normalized(prior[key])
    assert match, key
    comparisons.append({'file': 'test/'+key[0], 'fullName': key[1], 'exactMessageAndStackMatchAfterRootNormalization': match, 'failureMessages': messages})
assert len(comparisons) == 3
feature_tests = []
upstream_tests = []
for f in report['testResults']:
    path = 'test/' + f['name'].split('/test/')[-1]
    entry = {'file':path, 'tests':len(f['assertionResults']), 'status': f['status']}
    if path in ours_changed: feature_tests.append(entry)
    if path in theirs_changed: upstream_tests.append(entry)
assert all(f['status']=='passed' for f in feature_tests+upstream_tests)
browser = json.loads((out / 'browser/results.json').read_text())
prior_browser_path = root / 'output/evidence/monster-ui/browser/results.json'
prior_browser = json.loads(prior_browser_path.read_text())
assert not browser.get('failure') and browser['remoteWrites']==[] and browser['pageErrors']==[] and browser['httpErrors']==[]
assert set(browser['browserErrors']) <= set(prior_browser['browserErrors'])
assert all(x in prior_browser['failedRequests'] for x in browser['failedRequests'])
result = {
    'featureParent': ours, 'upstreamParent': theirs, 'mergeBase':base,
    'stagedTreeAtAudit': git('write-tree'), 'overlappingPaths': overlap,
    'allNonoverlappingParentBlobsPreserved': True,
    'authoredOverlappingDocumentsEqualAutomaticMerge': True,
    'fullSuiteEvidenceUnchanged': True,
    'vitest': {k:report[k] for k in ['numTotalTests','numPassedTests','numFailedTests','numPendingTests','numTodoTests','success']},
    'featureChangedTests': feature_tests, 'featureChangedTestCount':sum(x['tests'] for x in feature_tests),
    'upstreamChangedTests': upstream_tests, 'upstreamChangedTestCount':sum(x['tests'] for x in upstream_tests),
    'knownFailures': comparisons, 'newFailureCount': 0,
    'baselineEvidence': str(frozen_path.relative_to(root)),
    'baselineEvidenceSHA256': hashlib.sha256(frozen_path.read_bytes()).hexdigest(),
    'baselineCommit': '142db78e9eb3cd762bacd63cb0324c709392f6ed',
    'browser': {'passed':True,'viewportWidths':[v['viewport'] for v in browser['viewports']], 'captures':len(browser['captures']), 'remoteWrites':0, 'pageErrors':0, 'httpErrors':0, 'consoleWarningsAllPresentInPriorEvidence':True, 'priorEvidence':str(prior_browser_path.relative_to(root)), 'serverStopped':browser['serverStopped']},
}
(out / 'audit.json').write_text(json.dumps(result, indent=2, ensure_ascii=False)+'\n')
print(json.dumps({k:v for k,v in result.items() if k not in ['knownFailures','featureChangedTests','upstreamChangedTests']}, indent=2))
