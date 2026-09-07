import hashlib
import json
import subprocess
from pathlib import Path
R = Path('/home/main/z-project/rpg-zzu-life-full-p4')
E = R / '.omo/evidence/life-full-20260906/12/ui/build-r5'
U = E.parent
T = R / '.omo/evidence/life-full-20260906/52'

def sha(p):
    with Path(p).open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()

def load(p):
    return json.loads(Path(p).read_text())

def save(n, d):
    p = E / n
    assert not p.exists(), p
    p.write_text(json.dumps(d, indent=2, ensure_ascii=False) + '\n')

def git(*a):
    return subprocess.check_output(['git', *a], cwd=R, text=True).strip()
H = load(U / 'producer-r3/SOURCE-HANDOFF.json')
D = {x['path']: x['sha256'] for x in H['changed'] + H['task52Frozen']}
W = list(H['wikiCurrentSha256'])

def identity():
    old = load(U / 'build-r3/certified-identity.json')
    files = set(git('ls-files', 'src', 'test', 'scripts', 'public', 'vendor', 'package.json', 'package-lock.json', 'tsconfig*.json', 'vite*.ts').splitlines()) | set(D)
    hashes = {f: sha(R / f) for f in sorted(files)}
    assert hashes == old['hashes'], 'Compiled input drift: no permission to fix'
    assert all((hashes[f] == h for f, h in D.items()))
    return {'head': git('rev-parse', 'HEAD'), 'branch': git('branch', '--show-current'), 'index': sha(R / git('rev-parse', '--git-path', 'index')), 'staged': git('diff', '--cached', '--name-only').splitlines(), 'status': git('status', '--porcelain=v1', '-uall'), 'hashes': hashes, 'docs': {f: sha(R / f) for f in W}}
if __name__ == '__main__':
    initial = identity()
    save('initial-identity.json', initial)
    assert initial['head'] == H['head'] and initial['branch'] == H['branch'] and (not initial['staged'])
    assert not set(git('ls-files', '--modified', '--others', '--exclude-standard').splitlines()) - set(D) - set(W)
    inventory = {}
    for n in ['producer-r3', 'build-r3', 'verify-r3', 'fixtures-r4', 'producer-r4', 'build-r4', 'fixtures-r5', 'producer-r5']:
        for p in sorted((U / n).rglob('*')):
            if not p.is_file() or '__pycache__' in p.parts:
                continue
            data = p.read_bytes()
            if p.suffix == '.json':
                json.loads(data)
            inventory[str(p.relative_to(R))] = {'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)}
    save('borrowed-inventory.json', inventory)
    comparisons = []
    for n in ['diagnostics', 'typecheck-app', 'build']:
        b = U / 'build-r3'
        c = load(b / (n + '.command.json'))
        assert int((b / (n + '.exit')).read_text()) == c['directBoundedExit'] == 0
        for stream in ['stdout', 'stderr']:
            assert sha(b / (n + '.' + stream)) == c[stream + 'Sha256']
        for when in ['before', 'after']:
            assert load(b / (n + '.' + when + '.json'))['hashes'] == initial['hashes']
        comparisons.append({'label': n, 'command': c, 'allCompiledInputsEqual': True, 'rerun': False})
    diag = load(U / 'build-r3/diagnostics.stdout')
    assert len(diag['results']) == 14 and all((not x['diagnostics'] for x in diag['results']))
    save('build-reuse.json', {'compiledInputCount': len(initial['hashes']), 'comparisons': comparisons})
    for label, base in [('task52-135', T / 'verify/focused.before.json'), ('core355', R / '.omo/evidence/life-full-20260906/47-48/r3/verify-r2/tests.before.json')]:
        old = load(base)['hashes']
        different = [f for f, h in initial['hashes'].items() if f in old and old[f] != h]
        assert not set(different) - set(D)
        if label == 'task52-135':
            assert not different
        save(label + '-comparison.json', {'receipt': str(base.relative_to(R)), 'sha256': sha(base), 'compared': len(set(old) & set(initial['hashes'])), 'declaredLaterDifferences': different, 'unexpectedDifferences': [], 'rerun': False})
    fx = U / 'fixtures-r4'
    results = {}
    for n, rec in load(fx / 'PUBLIC-MANIFEST.json')['files'].items():
        assert sha(fx / n) == rec['sha256'] and (fx / n).stat().st_size == rec['bytes']
    for kind in ['arena', 'lastExit']:
        proof = load(fx / (kind + '.core-proof.json'))
        raw = load(fx / (kind + '.reloaded.json'))
        h = sha(fx / (kind + '.reloaded.json'))
        assert sha(fx / (kind + '.authored.json')) == h == load(fx / (kind + '.save-receipt.json'))['sha256'] == load(fx / (kind + '.reload-receipt.json'))['serializedReloadSha256']
        assert proof['fixtureBeforeSha256'] == proof['fixtureAfterSha256'] == proof['remoteAfterSha256'] == h
        assert raw['system']['playerFootprint'] == {'width': 3, 'height': 3} and raw['system']['playerPassRows'] == 1 and ('farmPlots' not in raw['session'])
        if kind == 'lastExit':
            d = proof['details']
            assert proof['initial'] == proof['after'] and d['staticAccepted'] and d['nonblockingLiveAccepted'] and (not d['blockingLiveAccepted']) and (d['result'] == {'ok': False, 'reason': 'blocked'})
        results[kind] = {'sha256': h, 'projectId': proof['projectId'], 'details': proof['details'], 'modelOnly': True}
    save('fixture-audit.json', results)
    p4 = U / 'producer-r4'
    c = load(p4 / 'native-qa-2.command.json')
    assert c['exit'] == 0 and c['scriptSha256'] == sha(p4 / 'native/native-qa.mjs')
    assert load(p4 / 'native-qa-2.before.json') == load(p4 / 'native-qa-2.after.json')
    for st in ['stdout', 'stderr']:
        assert c[st + 'Sha256'] == sha(p4 / ('native/native-qa-2.' + st))
    n4 = load(p4 / 'native/native-qa-final-evidence.json')
    assert not n4.get('uncaught') and (not n4.get('cleanupErrors')) and (not n4.get('pageErrors'))
    assert n4 == load(p4 / 'native/native-evidence.json')
    slots = {}
    for name in ['arena-rotated', 'arena-moved', 'last-exit']:
        raw = load(p4 / ('native/raw-slot-' + name + '.json'))
        s = raw.get('session', raw)
        p = load(p4 / ('native/raw-slot-' + name + '.parsed.json'))
        assert s['farmBuildingPlacements'] == p['buildings'] and s['homeDecorationPlacements'] == p['decorations'] and all((s[k] == p[k] for k in ['x', 'y', 'gold', 'inventory']))
        slots[name] = p
    owner = 'ledger:decoration:table:1'
    rot = slots['arena-rotated']['decorations'][owner]
    mov = slots['arena-moved']['decorations'][owner]
    last = slots['last-exit']
    assert (rot['x'], rot['y'], rot['orientation']) == (7, 9, 'left') and mov == {**rot, 'x': 5, 'y': 6}
    assert (last['x'], last['y'], last['gold']) == (1, 2, 500) and last['inventory'] == {'item_hoe': 1, 'item_potion': 8} and (sorted(last['buildings']) == ['r4-block-right', 'r4-block-up']) and (not last['decorations'])
    n3 = load(U / 'producer-r3/native/native-qa-final-evidence.json')
    steps = n3['steps']
    selected = {x['step']: x for x in steps if x['step'] not in ['menu-step', 'walk-step', 'open-spaces-start', 'menu-close-step', 'menu-closed-idle']}
    assert not any((x['step'] in ['rug-walk-down-failed', 'last-exit-face-right'] for x in steps))
    assert selected['hand-slot']['digit'] == '1'
    raw = load(U / 'producer-r3/native/raw-slot-1.json')
    s = raw.get('session', raw)
    assert s['farmBuildingPlacements'] == selected['load-restored']['loadedBuildings']
    assert selected['last-exit-verdict']['lastExitBlocked'] is False
    save('native-composite-audit.json', {'originalSteps': selected, 'supplementarySteps': n4['steps'], 'slots': slots, 'originalRawOwnersEqualLoaded': True, 'originalFailuresNotRelabeled': True, 'r3MovementFallbackObserved': False, 'independentNativeRerun': False})
    save('png-hashes.json', {p: v for p, v in inventory.items() if p.endswith('.png')})
    pub = load(T / 'archive/public-final/PUBLICATION-FINAL.json')
    paths = (T / pub['exact_allowlist']).read_text().splitlines()
    chunks = sum([(T / f).read_text().splitlines() for f in pub['allowlist_chunks']], [])
    assert len(paths) == len(set(paths)) == 1152 and paths == chunks
    assert all((p.startswith('archive/') and '..' not in Path(p).parts and (T / p).is_file() for p in paths))
    save('task52-publication-inventory.json', {'pathBase': str(T), 'count': len(paths), 'files': {str((T / p).relative_to(R)): {'sha256': sha(T / p), 'bytes': (T / p).stat().st_size} for p in paths}})
    print(json.dumps({'compiledInputsEqual': len(initial['hashes']), 'declaredEqual': len(D), 'borrowedFiles': len(inventory), 'task52PublicPaths': len(paths), 'unknownChanges': []}))
