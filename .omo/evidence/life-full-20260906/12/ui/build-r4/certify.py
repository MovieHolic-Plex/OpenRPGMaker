import gzip
import hashlib
from pathlib import Path
from audit import R, E, U, T, D, W, load, save, sha, identity


def digest(data):
    return hashlib.sha256(data).hexdigest()


if __name__ == '__main__':
    current = identity()
    initial = load(E / 'initial-identity.json')
    assert all(current[k] == initial[k] for k in ['head', 'index', 'hashes'])
    assert not current['staged']
    assert all(sha(R / p) == v['sha256'] for p, v in load(E / 'borrowed-inventory.json').items())
    public = load(T / 'archive/public-final/PUBLICATION-FINAL.json')
    archive_results = []
    for index in public['per_file_result_indexes']:
        for entry in load(T / index)['results']:
            result = load(T / entry['result_path'])
            encoded = (T / result['archive_path']).read_bytes()
            decoded = gzip.decompress(encoded)
            assert digest(encoded) == result['archive_sha256']
            assert len(encoded) == result['archive_bytes']
            assert digest(decoded) == result['original_sha256']
            assert len(decoded) == result['original_bytes']
            assert not result['finding_reasons']
            archive_results.append({'path': result['archive_path'], 'encodedSha256': digest(encoded), 'decodedSha256': digest(decoded), 'decodedBytes': len(decoded)})
    assert len(archive_results) == 328
    save('task52-archive-integrity.json', {'allEncodedAndDecodedEqual': True, 'payloadCount': len(archive_results), 'decodedBytes': sum(x['decodedBytes'] for x in archive_results), 'results': archive_results, 'privacyScope': 'Existing per-file public clearance retained; hash verification is not universal privacy or image interpretation.'})
    raw = load(U / 'producer-r3/native/raw-slot-1.json')
    session = raw.get('session', raw)
    rug = session['homeDecorationPlacements']['ledger:decoration:rug:1']
    fixture = load(U / 'producer-r3/native/fixture.json')
    definition = next(x for x in fixture['database']['homeDecorationTypes'] if x['id'] == 'rug')
    assert (rug['x'], rug['y'], rug['orientation']) == (3, 1, 'down')
    assert definition['footprint'] == {'width': 2, 'height': 1} and definition['blocksMovement'] is False
    assert fixture['system']['playerFootprint'] == {'width': 3, 'height': 3} and fixture['system']['playerPassRows'] == 1
    steps = load(U / 'producer-r3/native/native-qa-final-evidence.json')['steps']
    first = next(i for i, x in enumerate(steps) if x['step'] == 'place-rug')
    last = next(i for i, x in enumerate(steps) if x['step'] == 'save-slot')
    positions = [x for x in steps[first:last] if isinstance(x.get('to'), dict) and 'x' in x['to']]
    measured = []
    for step in positions:
        x, y = step['to']['x'], step['to']['y']
        passage = {'left': x - 1, 'right': x + 1, 'top': y, 'bottom': y}
        overlap = passage['left'] <= 4 and passage['right'] >= 3 and y == 1
        measured.append({'step': step['step'], 'at': step['at'], 'foot': step['to'], 'passage': passage, 'overlapsRug': overlap})
    assert measured and not any(x['overlapsRug'] for x in measured)
    labelled = next(x for x in steps if x['step'] == 'walk-onto-rug')
    assert labelled['from'] == {'x': 2, 'y': 2} and labelled['to'] == {'x': 2, 'y': 3}
    save('rug-traversal-audit.json', {'requirement': 'Original DAG native: including walking onto a nonblocking rug then save/resume', 'authority': ['src/project/playerFootprint.ts:playerPassageRect', 'src/project/footprint.ts:passageBounds', 'src/project/spatialPlacements.ts:footprintCells'], 'rugOwner': rug, 'rugDefinition': definition, 'rugCells': [{'x': 3, 'y': 1}, {'x': 4, 'y': 1}], 'labelledStep': labelled, 'loggedMovementAfterPlaceBeforeSave': measured, 'allLoggedPassagesMissRug': True, 'fullBodyOverlapNotEquivalentToPassageTraversal': True, 'r4Scope': 'table arena and last-exit only; no rug traversal', 'verdict': 'missing native nonblocking-rug traversal; no product defect inferred'})
    for n in ['openwiki-index', 'openwiki-index-check', 'openwiki-verify', 'whitespace']:
        assert int((E / (n + '.exit')).read_text()) == 0
    for n in range(4):
        prefix = 'whitespace-new-' + str(n)
        assert int((E / (prefix + '.exit')).read_text()) == 1
        assert not (E / (prefix + '.stdout')).stat().st_size and not (E / (prefix + '.stderr')).stat().st_size
    assert not (E / 'COMMITTED.json').exists()
    save('NEEDS-FIX.json', {'status': 'needs-fix', 'task': 'Task12+Task52 combined delivery', 'commitCreated': False, 'sourceCommit': None, 'head': current['head'], 'branch': current['branch'], 'indexChanged': False, 'compiledInputsEqualToBuildR3': len(current['hashes']), 'declaredCodeTestPathsEqual': len(D), 'blockingCriteria': [{'id': 'native-nonblocking-rug-traversal', 'requirement': 'Original DAG: walk onto a nonblocking rug then save/resume', 'receipt': 'rug-traversal-audit.json', 'observed': 'Rug occupies (3,1),(4,1); labelled walk (2,2)->(2,3) has passRows1 passage x1..3/y3 and does not traverse it. All logged post-place/pre-save passage destinations also miss the rug.', 'needed': 'Source-bound native keyboard movement whose actual passage crosses a known nonblocking rug, followed by menu Save/raw owners/Load retention, with state-driven waits and cleanup. No code change is requested or authorized here.'}], 'closedR4Criteria': ['decoration down-to-left rotation at (7,9)', 'decoration movement to (5,6)', 'stationary last-exit atomic refusal'], 'cliPassed': True, 'oldR3FailuresRemainHistory': True, 'publicationStaged': False, 'remoteActions': False})
    save('final-identity.json', current)
    save('final-cleanup.json', {'privateTmpfsAbsent': not Path('/dev/shm/st_01a07bcd').exists(), 'sharedLockRetained': Path('/tmp/rpg-zzu-life-full-qa-01a0727b.lock').exists(), 'sourceAndIndexPreserved': True, 'olderEvidencePreserved': True, 'serversBrowsersRemoteActions': False, 'archivesDecodedInMemoryOnly': True, 'sourceHashes': D, 'wikiHashes': {f: sha(R / f) for f in W}})
    print('Certification complete: CLI/source/archive gates pass; NEEDS-FIX native nonblocking-rug traversal; no staging or commit.')
