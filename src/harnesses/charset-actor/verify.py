"""캐릭터 하네스의 픽셀·판정·저장 계약만 확인한다. 모델/API/프로젝트 DB를 호출하지 않는다."""
import argparse
import copy
import importlib.util
import json
import tempfile
from pathlib import Path
from contextlib import contextmanager
from types import SimpleNamespace
from unittest.mock import patch

import chr as C
import harness as H


@contextmanager
def isolated_store(root):
    names = ['DATA', 'DECISIONS', 'EXPORT', 'ACCEPTED', 'ACCEPTED_LOCAL', 'LOCAL_BRIEFS']
    previous = {n: getattr(H, n) for n in names}
    try:
        H.DATA = root
        H.DECISIONS = root / 'decisions.jsonl'
        H.EXPORT = root / 'decisions.json'
        H.ACCEPTED = root / 'accepted-repo'
        H.ACCEPTED_LOCAL = root / 'accepted-local'
        H.LOCAL_BRIEFS = root / 'briefs-local.json'
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

    # People1:1의 원본 치마 무늬가 새 조끼의 깃을 몸통 옆에서 가져오던 실제 사례.
    # standing (9,22)의 옷 색이 down 0 (9,23)에서도 그대로 이어져야 한다.
    pp, pf = H.base_of('People1:1')
    vest = copy.deepcopy(pf)
    row = list(vest['down', 1][22]); row[9] = '~'; vest['down', 1][22] = ''.join(row)
    vp = dict(pp); vp['~'] = (52, 76, 107)
    walked = C.propagate(pf, vest, pp, vp)
    check('walking-vest-keeps-stable-torso-color', walked['down', 0][23][9] == '~')
    check('walking-preserves-standing-drawings', all(walked[d, 1] == vest[d, 1] for d in C.DIRS))
    check('walking-preserves-original-RTP', C.propagate(pf, pf, pp, pp) == pf)

    # 사용자 데이터·결정·공용 자산을 건드리지 않는 별도 저장 대상.
    with tempfile.TemporaryDirectory(prefix='charset-verify-') as temp, isolated_store(Path(temp)):
        import bulk as B
        manifest = H.DATA / 'failed-manifest.json'
        H.write_json_atomic(manifest, dict(run='failed-production', characters=[dict(key='fixture', name='fixture', base='Actor1:0', strength='weak')]))
        failed = False
        with patch.object(B, 'produce_batch', side_effect=RuntimeError('review interrupted')):
            try:
                B.main(SimpleNamespace(manifest=manifest, par=1, batch_size=4))
            except RuntimeError:
                failed = True
        check('failed-batch-does-not-report-completion', failed and not (H.run_dir('failed-production') / 'catalog.json').exists())
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
        H.write_json_atomic(w / 'review' / 'verdict.json', dict(verdict='FAIL', score=3, discard=True,
                                                             fatal=['historical defect'], inspected=H.binding(gate), issues=[]))
        check('old-fatal-is-reinspection-pending', H.quality(w)['pending'] and not H.quality(w)['discard'])
        gate = H.make_views(w / 'out.chr.txt', w / 'views', 'Actor1:0', 'weak')
        H.write_json_atomic(w / 'review' / 'verdict.json', dict(verdict='PASS', score=8, issues=[]))
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
        check('RTP-authors-and-license-travel-with-pack', all((root / 'pack' / 'licenses' / 'easyrpg' / name).read_bytes() == (H.RTP / name).read_bytes()
                                                            for name in ('AUTHORS.md', 'COPYING')))
        (w / 'out.chr.txt').write_text(C.dump(q, {}, f, header='another change'))
        H.write_json_atomic(w / 'review' / 'verdict.json', dict(verdict='FAIL', score=3, discard=True,
                                                             fatal=['historical defect'], inspected=H.binding(gate), issues=[]))
        rejected = False
        try:
            export.export('fixture', discard_failed=True)
        except ValueError:
            rejected = True
        check('stale-review-not-permanently-discarded', rejected and w.exists() and not (root / 'discarded.json').exists())
        record = dict(key='fixture', dir=w.name, archive=str(H.DATA / 'quarantine' / w.name), state='pending')
        export.finish_discard(root, record)
        check('pending-discard-recovers', record['state'] == 'complete' and not w.exists() and Path(record['archive']).exists())
        import studio as S
        root = H.run_dir('human-fixture')
        w = root / 'human__gpt-r1'; w.mkdir(parents=True)
        (w / 'out.chr.txt').write_text(C.dump(q, {}, f))
        H.write_json_atomic(w / 'meta.json', dict(base='Actor1:0', brief='human', strength='free', reviewMode='human',
                                                model='gpt-6.1-sol', effort='high', label='GPT high', pid=0))
        H.write_json_atomic(root / 'manifest.json', dict(reviewMode='human', characters=[dict(key='human')]))
        gate = H.make_views(w / 'out.chr.txt', w / 'views', 'Actor1:0', 'free')
        check('human-unpublished-not-selectable', not H.quality(w)['eligible'])
        H.write_json_atomic(w / 'published.json', H.binding(gate))
        check('human-ready-without-model-review', H.quality(w)['eligible'])
        H.write_json_atomic(w / 'review' / 'verdict.json', dict(verdict='FAIL', score=0, discard=True, fatal=['model dislike'], issues=[]))
        H.bind_review(w, gate)
        check('human-aesthetics-not-model-cull', H.quality(w)['eligible'] and not H.quality(w)['discard'])
        check('human-unsafe-key-still-blocked', C.gate(unsafe, f, (p, f), strength='free')['discard'])
        blank = copy.deepcopy(f); blank['right', 0] = ['.'*24]*32
        check('human-empty-frame-blocked', C.gate(p, blank, (p, f), strength='free')['discard'])
        cut_head = copy.deepcopy(f); cut_head['down', 1] = ['.'*24 if y <= cut else row for y,row in enumerate(f['down',1])]
        check('human-cut-head-still-blocked', C.gate(p, cut_head, (p, f), strength='free')['discard'])
        empty_rejected = False
        try:
            S.export_kept('human-fixture')
        except ValueError:
            empty_rejected = True
        check('human-undecided-not-exported', empty_rejected)
        rec = dict(id='human-fixture/'+w.name, decision='accept', inspected=H.binding(gate), at=H.now())
        H.DECISIONS.write_text(json.dumps(rec)+'\n')
        H.export_decisions()
        check('human-accepted-outside-repo', (H.ACCEPTED_LOCAL / 'human__gpt-r1__human-fixture.png').exists() and not list(H.ACCEPTED.glob('human*')))
        check('human-decision-not-mirrored-into-repo', not json.loads(H.EXPORT.read_text())['decisions'])
        result = S.export_kept('human-fixture')
        import zipfile
        with zipfile.ZipFile(H.DATA / result['url'].removeprefix('/')) as archive:
            check('human-kept-only-ZIP', result['count']==1 and archive.testzip() is None and 'licenses/easyrpg/AUTHORS.md' in archive.namelist())
            catalog = json.loads(archive.read('characters.json'))
            check('human-ZIP-contains-decision-binding', catalog['characters'][0]['acceptance']['inspected']==H.binding(gate))
        (w / 'out.chr.txt').write_text(C.dump(q, {}, f, header='updated human candidate'))
        check('human-old-accept-not-reused', H.effective_decision(w, rec) is None)
        rejected = dict(rec, decision='reject')
        check('human-old-reject-not-reused', H.effective_decision(w, rejected) is None)
        H.export_decisions()
        check('human-stale-accepted-copy-removed', not (H.ACCEPTED_LOCAL / 'human__gpt-r1__human-fixture.png').exists())
        # 재개가 사람이 이미 본 현재 GIF를 다시 굽지 않는다.
        gate = H.make_views(w / 'out.chr.txt', w / 'views', 'Actor1:0', 'free')
        H.write_json_atomic(w / 'published.json', H.binding(gate))
        row = dict(key='human', name='human', brief='', base='Actor1:0', strength='free', reviewMode='human')
        batch = root / '_batches' / '01'; batch.mkdir(parents=True)
        assigned = dict(row, folder='../../'+w.name)
        before = (w / 'views' / 'walk.gif').stat().st_mtime_ns
        with patch.object(B, 'prepare_batch', return_value=(batch,[assigned])), patch.object(B, 'review_batch', side_effect=AssertionError('model review forbidden')):
            B.produce_batch('human-fixture',[row],1)
        check('human-resume-preserves-published-GIF', (w / 'views' / 'walk.gif').stat().st_mtime_ns==before)
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
