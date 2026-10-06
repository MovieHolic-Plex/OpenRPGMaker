"""Read current native/source/browser/root evidence; never manufactures approval."""
from pathlib import Path
from datetime import datetime, timezone
import argparse, fcntl, hashlib, json, sys

parser = argparse.ArgumentParser()
parser.add_argument('--out', required=True, type=Path)
parser.add_argument('--expect-passed', type=int)
args = parser.parse_args()
repo = Path.cwd()
sys.path.insert(0, str(repo / 'src/harnesses/battle-monster/node'))
from accept_batch import request
from pipeline import canonical, sha

def read(path):
    return json.loads(path.read_text())

work = repo / 'qa-runs/battle-monster-fifty-wave'
evidence = repo / 'verify-shots/battle-monster-fifty'
archive = repo / 'harness-data/battle-monster/authored/fifty-20261006'
with (archive / '.archive.lock').open('a') as lock:
    fcntl.flock(lock, fcntl.LOCK_SH)
    audit = read(work / 'batch-audit.json')
    rows = [r for r in audit['items'] if r['passed']]
    count = len(rows)
    assert count == audit['passedSpecies']
    if args.expect_passed is not None:
        assert count == args.expect_passed, ('Current qualified count differs', count, args.expect_passed)
    assert audit['expectedSpecies'] == 50
    assert audit['posesVerified'] == 18 * count
    assert audit['motionGifsVerified'] == 8 * count
    manifest = read(archive / 'manifest.json')
    assert manifest['archivedPassedSpecies'] == count
    archived = {r['key']: r for r in manifest['items']}
    root_checked = []
    for row in rows:
        key, binding = row['key'], row['binding']
        assert row['nativePngAndGifReread'] and row['review']['recommendation'] == 'keep'
        assert archived[key]['binding'] == binding and archived[key]['sourceArchiveReread']
        for relative, digest in row['sourceHashes'].items():
            source = archive / key / relative
            actual = sha(canonical(read(source))) if relative == 'brief.json' else sha(source.read_bytes())
            assert actual == digest, (key, relative)
        ident = key.split('/')[0]
        root_path = evidence / ('root-review-' + ident + '.json')
        if root_path.exists():
            root = read(root_path)
        else:
            pilot = read(evidence / 'pilot-root-review.json')
            assert pilot['passed'] and pilot['rootReadActual18PosePngPerSpecies']
            root = next((r for r in pilot['items'] if r['monster'] == ident), None)
            assert root is not None, 'Actual root native review still pending: ' + key
        assert root['passed'] and root['binding'] == binding
        assert root.get('nativePoses') == 18 or root.get('rootViewedActual18PosePng')
        live = repo / 'qa-runs/harnesses/battle-monster' / key
        for relative, digest in root.get('actualPreviewHashes', {}).items():
            assert hashlib.sha256((live / relative).read_bytes()).hexdigest() == digest
        if root.get('lightPngSha256'):
            assert sha((live / 'preview/suite/light.png').read_bytes()) == root['lightPngSha256']
        for writer, digest in root.get('nativeWriterFilesRead', {}).items():
            assert sha((live / 'source' / writer).read_bytes()) == digest, (key, writer, 'reviewed writer changed')
            assert sha((archive / key / 'source' / writer).read_bytes()) == digest, (key, writer, 'archived writer changed')
        if root.get('actualUnresizedNativeContact'):
            assert sha((repo / root['actualUnresizedNativeContact']).read_bytes()) == root['nativeContactPngSha256'], key
        assert root.get('actualIndependentReviewJob', root.get('reviewJob')) == row['review']['jobId']
        root_checked.append(key)
    matches, browser_files = set(), set()
    current = {r['key']: r['binding'] for r in rows}
    for path in evidence.glob('browser-proof-*.json'):
        proof = read(path)
        if proof.get('errors') or not proof.get('noChoiceButtonsClicked'):
            continue
        bindings = {s['key']: s['bindings'].get('suite') for s in proof.get('finalSelection', [])}
        for item in proof.get('items', []):
            key = item['key']
            valid = (key in current and bindings.get(key) == current[key]
                     and item.get('choice') == 'allow' and item.get('pauseResume')
                     and item.get('motionTiles') == 8 and item.get('nativeGifImages', 0) >= 8
                     and {m['width'] for m in item.get('mobile', [])} >= {320, 375}
                     and all(not m['overflow'] for m in item.get('mobile', [])))
            if valid:
                matches.add(key)
                browser_files.add(str(path.relative_to(repo)))
    assert matches == set(current)
    baseline = read(work / 'before-ledger.json')['decisions']
    decisions = read(repo / 'harness-data/battle-monster/ledger.json')['decisions']
    assert decisions[:len(baseline)] == baseline
    delegated = [r for r in decisions[len(baseline):] if r.get('by') == 'user-delegated-goal']
    assert len(delegated) >= 3 * count
    state = request('http://127.0.0.1:18346', '/api/state')
    selected = {s['key']: s['bindings'] for s in state['selection']}
    before = read(evidence / 'before-state.json')['selection']
    assert all(selected.get(s['key']) == s['bindings'] for s in before)
    assert all(selected.get(key, {}).get('suite') == binding for key, binding in current.items())
    result = {'at': datetime.now(timezone.utc).isoformat(), 'expectedSpecies': 50,
              'passedSpecies': count, 'allSpeciesComplete': count == 50 and audit['passed'],
              'posesVerified': 18 * count, 'motionGifsVerified': 8 * count, 'audit': audit,
              'sourceArchiveRereadSpecies': count, 'actualRootReviewSpecies': len(root_checked),
              'actualBrowserVerifiedSpecies': len(matches), 'browserEvidenceFiles': sorted(browser_files),
              'originalDecisionPrefixPreserved': True, 'originalSelectionBindingsPreserved': True,
              'newDelegatedDecisionRows': len(delegated), 'totalDecisionRows': len(decisions),
              'humanMouseClickClaim': False}
    args.out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print('Verified current root/source/native/selected/browser evidence:', count, '/50')
