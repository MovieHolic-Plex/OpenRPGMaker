import ast,hashlib,json,pathlib,re,subprocess
E=pathlib.Path(__file__).parent
inp=json.loads((E/'input-selected.json').read_text())
report=(E/'TRIAGE.md').read_text()
rows=re.findall(r'^\| (\d+) \| `([^`]+)` \|',report,re.M)
assert len(rows)==25
assert [p for _,p in rows]==inp['newFailureFiles']
counts=json.loads((E/'original-25-counts.json').read_text())
sourceBytes=pathlib.Path(counts['sourcePath']).read_bytes()
assert hashlib.sha256(sourceBytes).hexdigest()==counts['sourceSha256']==inp['fullReportSha256']
originalFull=json.loads(sourceBytes)
originalByFile={'test/'+r['name'].replace('\\','/').split('/test/')[-1]:r for r in originalFull['testResults']}
ratioRows=re.findall(r'^\| \d+ \| `([^`]+)` \| (\d+)/(\d+) /',report,re.M)
assert len(ratioRows)==25
assert [r['file'] for r in counts['files']]==inp['newFailureFiles']
originalComparison={r['file']:r for r in json.loads((E/'assertion-comparison.json').read_text())}
for (file,failed,collected),count in zip(ratioRows,counts['files']):
    assertions=originalByFile[file]['assertionResults']
    assert file==count['file']
    assert int(collected)==count['collected']==len(assertions)
    assert int(failed)==count['failed']==sum(a['status']=='failed' for a in assertions)
    assert count['passed']==sum(a['status']=='passed' for a in assertions)
    original=originalComparison[file]['original']
    assert len(original)==count['collected']
    assert [(a['name'],a['status'],a['durationMs']) for a in original]==[(a['fullName'],a['status'],a.get('duration')) for a in assertions]
assert counts['totals']=={'files':25,'collected':183,'failed':43,'passed':140,'pendingOrSkipped':0}
assert {key:sum(r[key] for r in counts['files']) for key in ['collected','failed','passed','pendingOrSkipped']}=={key:counts['totals'][key] for key in ['collected','failed','passed','pendingOrSkipped']}
for name,sha in counts['preservedEvidenceSha256'].items():
    assert hashlib.sha256((E/name).read_bytes()).hexdigest()==sha,name
for suffix,sha in [('base',inp['phaseBase']),('current',inp['currentCommit'])]:
    tree=inp['currentWorktree']+'-gate-'+suffix
    assert subprocess.check_output(['git','-C',tree,'rev-parse','HEAD'],text=True).strip()==sha
    assert subprocess.check_output(['git','-C',tree,'status','--short'],text=True)==''
for label,failed in [('base',25),('current',24)]:
    d=json.loads((E/(label+'-25.report.json')).read_text())
    assert d['numTotalTests']==183 and d['numFailedTests']==failed
    names={'test/'+r['name'].split('/test/')[-1] for r in d['testResults']}
    assert names==set(inp['newFailureFiles'])
    assert all(a['status'] in ['passed','failed'] for r in d['testResults'] for a in r['assertionResults'])
    gate=json.loads((E/(label+'-surface.report.json')).read_text())['surface']
    assert len(gate['axes'])==9 and gate['skippedAxes']==[] and gate['exitCode']==1
    for name in [label+'-25',label+'-surface']:
        receipt=json.loads((E/(name+'.receipt.json')).read_text())
        assert receipt['exit']==1
        assert receipt['cwd'].endswith('-gate-'+label)
        assert 'flock' in receipt['command'] and '--timeout' in receipt['command']
        assert '--save-baseline' not in receipt['command']
        assert (E/(name+'.stdout.txt')).is_file() and (E/(name+'.stderr.txt')).is_file()
console=json.loads((E/'console-values-comparison.json').read_text())
assert len(console)==24 and all(r['equal'] for r in console)
surface=json.loads((E/'surface-comparison.json').read_text())
assert len(surface['failures'])==6 and surface['allSixOriginalBaselineCurrentMessagesAndValuesEqual']
assert all(r['exit']==0 and all(o['exit']==0 for o in r['objects'].values()) for r in json.loads((E/'source-equality.json').read_text()))
comparisons=json.loads((E/'assertion-comparison.json').read_text())
assert len(comparisons)==25 and all(not r['introducedFocusedFailures'] for r in comparisons)
cleanup=json.loads((E/'cleanup.json').read_text())
assert cleanup['processGroupCheck']['exit']==1 and all(cleanup['assignedPortsUnused'].values())
assert all(not t['trackedStatus'] for t in cleanup['trees'])
assert not (E/'__pycache__').exists()
for p in E.glob('*.json'):json.loads(p.read_text())
for p in E.glob('*.py'):ast.parse(p.read_text(),filename=str(p))
print(json.dumps({'completeFileRows':25,'originalCollectedTests':183,'originalFailedTests':43,'originalPassedTests':140,'originalReportSha256Verified':True,'preservedEvidenceFiles':len(counts['preservedEvidenceSha256']),'pairedCollectedTests':183,'sharedExactFailureValues':24,'surfaceAxes':9,'surfaceExactFailureBlocks':6,'confirmedIntroducedFocusedFailures':0,'sourceEqualityPathsVerified':len(json.loads((E/'source-equality.json').read_text())),'pinnedTreesClean':True,'taskProcessGroupExited':True,'evidenceJsonAndPythonSyntaxValid':True},indent=2))
