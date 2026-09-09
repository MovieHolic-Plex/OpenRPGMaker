import collections, hashlib, json, pathlib, subprocess
root = pathlib.Path.cwd()
e = root / '.omo/evidence/integration-st01a08238'
def load(name): return json.loads((e / name).read_text())
def rel(name): return pathlib.Path(name).relative_to(root).as_posix()
reports = ['focused-final.json', 'final-fixture-overlay.json', 'soft-confirm-green.json']
latest = {}
for name in reports:
    for result in load(name)['testResults']:
        latest[rel(result['name'])] = (name, result)
expected = set(load('focused-final-manifest.json'))
assert set(latest) == expected, (set(latest) - expected, expected - set(latest))
assert all(result['assertionResults'] for _, result in latest.values())
counts = collections.Counter(a['status'] for _, r in latest.values() for a in r['assertionResults'])
assert counts.get('pending', 0) == counts.get('skipped', 0) == 0
failures = []
for file, (report, result) in latest.items():
    for case in result['assertionResults']:
        if case['status'] != 'failed': continue
        baseline = 'baseline-d2be-stall.json' if file.endswith('aiWorkItemStall.test.ts') else 'baseline-72f-navigation.json'
        controls = [a for r in load(baseline)['testResults'] for a in r['assertionResults'] if a['fullName'] == case['fullName']]
        assert len(controls) == 1 and controls[0]['status'] == 'failed'
        # Assertion error body exactly equal; source/runtime stack coordinates differ by revision.
        body = lambda a: [message.split('\n    at ')[0] for message in a['failureMessages']]
        assert body(case) == body(controls[0]), (case['fullName'], body(case), body(controls[0]))
        failures.append({'file': file, 'name': case['fullName'], 'report': report, 'baseline': baseline,
                         'assertionErrorBody': body(case)})
assert len(failures) == 4
# The three stalled cases themselves remain byte-for-byte d2be, not just matching titles.
stall = 'test/aiWorkItemStall.test.ts'
old = subprocess.check_output(['git', 'show', 'd2be60d92b74e456ea4b9e54e30daafe7fc41fc8:' + stall], text=True)
new = (root / stall).read_text()
start = 'describe("진행이 멈춘 항목은 사람에게 넘긴다", () => {'
end = '  it("(d) 쓰기가 성공하면'
assert old.split(start)[1].split(end)[0] == new.split(start)[1].split(end)[0]
nav = 'test/eventValidationNavigationContract.test.ts'
assert subprocess.check_output(['git', 'show', '72f1f179b39972c3838922746c7641a57e95fce8:' + nav]) == (root / nav).read_bytes()
current_types = load('types-current.json'); baseline_types = load('types-72f1f17.json')
key = lambda d: (d['file'], d['code'], d['message'])
assert not (collections.Counter(map(key, current_types['diagnostics'])) - collections.Counter(map(key, baseline_types['diagnostics'])))
assert not [d for d in current_types['diagnostics'] if d['file'].startswith('src/')]
core = load('focused-final-manifest.json')[:11]
core_counts = collections.Counter(a['status'] for file in core for a in latest[file][1]['assertionResults'])
assert not core_counts.get('failed')
summary = {'kind': 'focused coverage with explicit file overlays, not a single all-green run',
           'files': len(latest), 'counts': dict(counts), 'coreFiles': core, 'coreCounts': dict(core_counts),
           'failures': failures, 'newFailedAssertions': 0, 'unchangedFailingCaseBodies': True,
           'changedFileDiagnostics': {'files': len(current_types['files']), 'sourceErrors': 0,
                'inheritedTestErrors': len(current_types['diagnostics']), 'newDiagnosticSignatures': 0},
           'reports': [{'name': name, 'sha256': hashlib.sha256((e / name).read_bytes()).hexdigest()} for name in reports],
           'sourceOverlay': {file: report for file, (report, _) in sorted(latest.items())}}
(e / 'focused-accounting.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({k:v for k,v in summary.items() if k in ['files', 'counts', 'coreCounts', 'newFailedAssertions', 'changedFileDiagnostics']}, indent=2))
