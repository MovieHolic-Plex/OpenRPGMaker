import collections
import hashlib
import json
import pathlib
import shlex

E = pathlib.Path(__file__).resolve().parent
ROOT = E.parents[2]
BASE = pathlib.Path('/home/main/z-project/rpg-zzu-ai-acceptance-live-baseline/output/evidence/acceptance-live-baseline/full-vitest.json')
CANDIDATE = ROOT / 'output/evidence/acceptance-live-candidate/full-vitest.json'
COMPARISON = ROOT / 'output/evidence/acceptance-live-candidate/comparison.json'

def load(path):
    return json.loads(path.read_text())

def cases(report):
    result = {}
    occurrences = collections.Counter()
    for suite in report['testResults']:
        file = 'test/' + suite['name'].split('/test/', 1)[1]
        for case in suite['assertionResults']:
            key = (file, case['fullName'])
            occurrences[key] += 1
            result[(*key, occurrences[key])] = case
    return result

baseline, candidate, final = map(lambda p: cases(load(p)), [BASE, CANDIDATE, E / 'affected-final.json'])
files = sorted({key[0] for key in final})
restored = []
remaining = []
new_failures = []
for key, case in final.items():
    entry = dict(file=key[0], name=key[1], occurrence=key[2])
    if candidate[key]['status'] == 'failed' and case['status'] == 'passed':
        restored.append(entry)
    if case['status'] == 'failed':
        remaining.append({**entry, 'baselineStatus': baseline[key]['status'],
                          'baselineFailureMessages': baseline[key]['failureMessages'],
                          'finalFailureMessages': case['failureMessages']})
        if baseline[key]['status'] != 'failed':
            new_failures.append(entry)

per_file = []
for file in files:
    def counts(cases_):
        return dict(collections.Counter(case['status'] for key, case in cases_.items() if key[0] == file))
    per_file.append(dict(file=file, baseline=counts(baseline), candidate=counts(candidate), final=counts(final),
                         candidateFailuresNowPassing=sum(entry['file'] == file for entry in restored)))

receipts = []
for exit_file in sorted(E.glob('*.exit')):
    name = exit_file.stem
    log = (E / f'{name}.log').read_text()
    cli = next((line[2:] for line in log.splitlines() if line.startswith('> node scripts/run-vitest.mjs')), None)
    receipt = dict(name=name, directExitCode=int(exit_file.read_text()), command=shlex.split(cli) if cli else None,
                   networkNamespace=cli is not None and name != 'representative-red')
    report_file = E / f'{name}.json'
    if report_file.exists() and 'testResults' in load(report_file):
        report = load(report_file)
        receipt['counts'] = {field: report[field] for field in ['numPassedTests', 'numFailedTests', 'numPendingTests']}
    receipts.append(receipt)

direct = [entry for entry in load(COMPARISON)['newFailureReasons'] if 'customSelect.ts:407' in entry['reason']]
summary = dict(
    baselineHead=load(COMPARISON)['baselineHead'], candidateHead=load(COMPARISON)['candidateHead'],
    authorityHashes={str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in [BASE, CANDIDATE, COMPARISON]},
    perFile=per_file, restoredCases=restored, remainingFailures=remaining,
    remainingIntroducedFailuresInAffectedScope=new_failures,
    directCustomSelectReasonRecords=len(direct),
    directCustomSelectReasonsStillPresent=sum('customSelect.ts:407' in '\n'.join(case['failureMessages']) for case in final.values()),
    runs=receipts,
    sourceHashes={file: hashlib.sha256((ROOT / file).read_bytes()).hexdigest() for file in [
        'test/fakeDom.ts', 'test/fakeDomSelectContracts.test.ts', 'test/weightedBranchUx.test.ts', 'test/aiChatObservability.test.ts']},
    scope='Focused repair only; no full-suite run. Baseline failures are retained verbatim. Final matched whole-suite validation is lead-owned.',
)
(E / 'summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({key: summary[key] for key in ['directCustomSelectReasonRecords', 'directCustomSelectReasonsStillPresent', 'remainingIntroducedFailuresInAffectedScope']}, ensure_ascii=False))
print('Restored:', len(restored), 'Remaining baseline failures:', len(remaining))
for row in per_file:
    print(row)
