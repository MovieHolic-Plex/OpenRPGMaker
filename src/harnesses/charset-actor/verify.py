"""캐릭터 하네스의 픽셀·판정·저장 계약만 확인한다. 모델/API/프로젝트 DB를 호출하지 않는다."""
import argparse
import copy
import importlib.util
import json
import tempfile
from pathlib import Path
from contextlib import contextmanager

import chr as C
import harness as H


@contextmanager
def isolated_store(root):
    names = ['DATA', 'DECISIONS', 'EXPORT', 'ACCEPTED', 'ACCEPTED_LOCAL']
    previous = {n: getattr(H, n) for n in names}
    try:
        H.DATA = root
        H.DECISIONS = root / 'decisions.jsonl'
        H.EXPORT = root / 'decisions.json'
        H.ACCEPTED = root / 'accepted-repo'
        H.ACCEPTED_LOCAL = root / 'accepted-local'
        yield
    finally:
        for name, value in previous.items():
            setattr(H, name, value)


def verify():
    evidence = {'gateVersion': C.GATE_VERSION, 'checks': []}

    def check(name, condition):
        if not condition:
            raise AssertionError(name)
        evidence['checks'].append(name)

    for sheet in H.BASE_SHEETS:
        for slot in range(8):
            p, _, f = C.from_actor(H.RTP / 'charset' / f'{sheet}.png', slot)
            check(f'original:{sheet}:{slot}', C.gate(p, f, (p, f), check_changed=False)['ok'])
    p, f = H.base_of('Actor1:0')
    for key in [('down', 1), ('left', 2)]:
        bad = copy.deepcopy(f)
        op = C._opaque(bad[key])
        x, y = next((x, y) for x, y in C._head_core(op)
                    if all((x + dx, y + dy) in op for dx, dy in [(1, 0), (-1, 0), (0, 1), (0, -1)]))
        row = list(bad[key][y]); row[x] = '.'; bad[key][y] = ''.join(row)
        g = C.gate(p, bad, (p, f), check_changed=False)
        check(f'hole:{key}', not g['ok'] and g['discard'])
    bad = copy.deepcopy(f)
    core = C._head_core(C._opaque(f['down', 1]))
    cut = sorted({y for _, y in core})[len({y for _, y in core}) // 2]
    bad['down', 1] = ['.' * C.FW if y <= cut else row for y, row in enumerate(bad['down', 1])]
    check('cut-head', C.gate(p, bad, (p, f), check_changed=False)['discard'])
    unsafe = dict(p); unsafe[next(c for c in p if c != '.')] = (3, 143, 150)
    check('editor-key-tolerance', C.gate(unsafe, f, (p, f), check_changed=False)['discard'])
    aliases = dict(p)
    mapping = {}
    available = [c for c in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@%^&*()_+=[]{}' if c not in p]
    for c, alias in zip([c for c in p if c != '.'][:16], available):
        aliases[alias] = p[c]; mapping[c] = alias
    idle = {k: list(f[k[0], 1]) for k in f}
    for d in C.DIRS:
        idle[d, 2] = [''.join(mapping.get(c, c) for c in row) for row in idle[d, 2]]
    alias_gate = C.gate(aliases, idle, (p, f), check_changed=False)
    check('RGB-alias-cannot-fake-motion', all(alias_gate['metrics'][f'walk_motion_{d}'] == 0 for d in C.DIRS))

    # 사용자 데이터·결정·공용 자산을 건드리지 않는 별도 저장 대상.
    with tempfile.TemporaryDirectory(prefix='charset-verify-') as temp, isolated_store(Path(temp)):
        root = H.run_dir('fixture')
        w = root / 'fixture__gpt-r1'; w.mkdir(parents=True)
        q = {c: None if rgb is None else (rgb[0], min(255, rgb[1] + 1), rgb[2]) for c, rgb in p.items()}
        (w / 'out.chr.txt').write_text(C.dump(q, {}, f))
        H.write_json_atomic(w / 'meta.json', dict(base='Actor1:0', brief='fixture', strength='weak', model='gpt-6.1-sol', effort='high', pid=0))
        H.write_json_atomic(w / 'desc.json', dict(label='fixture', role='fixture', tags=[], appearance='fixture', fits='fixture'))
        gate = H.make_views(w / 'out.chr.txt', w / 'views', 'Actor1:0', 'weak')
        H.write_json_atomic(w / 'review' / 'verdict.json', dict(verdict='PASS', score=8, issues=[], fatal=[], discard=False))
        H.bind_review(w, gate)
        check('fresh-reviewed-ready', H.quality(w)['eligible'])
        for value in [dict(verdict='PASS', score=7, issues=[]), dict(verdict='PASS', score=8, issues=[{'severity': 'high'}]),
                      dict(verdict='PASS', score=10, discard=True, issues=[])]:
            H.write_json_atomic(w / 'review' / 'verdict.json', value); H.bind_review(w, gate)
            check('visual-rule:' + str(value), not H.quality(w)['eligible'])
        H.write_json_atomic(w / 'review' / 'verdict.json', dict(verdict='PASS', score=8, issues=[])); H.bind_review(w, gate)
        (w / 'out.chr.txt').write_text(C.dump(q, {}, f, header='changed file'))
        check('old-PASS-not-reused', H.read_verdict(w).get('stale') and H.quality(w)['pending'])
        check('old-images-not-current', not H.views_fresh(w, H.current_gate(w)))
        gate = H.make_views(w / 'out.chr.txt', w / 'views', 'Actor1:0', 'weak')
        H.bind_review(w, gate)
        check('rebake-and-reinspect-ready', H.quality(w)['eligible'])
        with H.run_lock(root):
            blocked = False
            try:
                with H.run_lock(root):
                    pass
            except RuntimeError:
                blocked = True
            check('duplicate-production-blocked', blocked)
        spec = importlib.util.spec_from_file_location('bulk_export', H.HERE / 'bulk-export.py')
        export = importlib.util.module_from_spec(spec); spec.loader.exec_module(export)
        job = dict(key='fixture', name='fixture', genre='한국풍', role='fixture', gender='여', age='청년', base='Actor1:0')
        H.write_json_atomic(root / 'manifest.json', dict(characters=[job], sourceOriginal=str(H.ACTOR1), genres=['한국풍']))
        export.export('fixture')
        check('one-sprite-export', json.loads((root / 'pack' / 'characters.json').read_text())['count'] == 1)
        (w / 'out.chr.txt').write_text(C.dump(q, {}, f, header='another change'))
        rejected = False
        try:
            export.export('fixture', discard_failed=True)
        except ValueError:
            rejected = True
        check('stale-review-not-permanently-discarded', rejected and w.exists() and not (root / 'discarded.json').exists())
        record = dict(key='fixture', dir=w.name, archive=str(H.DATA / 'quarantine' / w.name), state='pending')
        export.finish_discard(root, record)
        check('pending-discard-recovers', record['state'] == 'complete' and not w.exists() and Path(record['archive']).exists())
    return evidence


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    result = verify()
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(dict(gateVersion=result['gateVersion'], passed=len(result['checks'])), ensure_ascii=False))
