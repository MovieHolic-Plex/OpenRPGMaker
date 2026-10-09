"""봉인·납품·중복·검토 대기 제한의 격리 계약. 실제 선택과 모델을 호출하지 않는다."""
import copy
import json
import tempfile
import threading
import time
from pathlib import Path
from unittest.mock import patch

import bulk as B
import chr as C
import delivery as D
import harness as H
import recipes as R
import motion as M


def verify(check, isolated_store):
    def rejects(label, action):
        try:
            action()
        except (ValueError, OSError):
            check(label, True)
        else:
            check(label, False)

    with tempfile.TemporaryDirectory(prefix='charset-production-') as tmp, isolated_store(Path(tmp)):
        p, frames = H.base_of('Actor1:0')
        q = dict(p)
        for symbol, rgb in p.items():
            if rgb is not None:
                q[symbol] = (rgb[0] ^ 1, rgb[1], rgb[2])
        source = H.run_dir('seed-fixture')
        source.mkdir(parents=True)
        w = source / 'seed__gpt-r1'
        w.mkdir()
        row = dict(key='seed', base='Actor1:0', brief='fixture', strength='free', reviewMode='human')
        H.write_json_atomic(source / 'manifest.json', dict(characters=[row]))
        H.write_json_atomic(w / 'meta.json', dict(run=source.name, brief='seed', base=row['base'], strength='free',
                                                 reviewMode='human', animationMode=H.FRAME_AUTHOR_MODE,
                                                 engine='gpt', **H.ENGINES['gpt'], pid=0))
        (w / 'base.chr.txt').write_text(C.dump(p, {}, frames))
        (w / 'out.chr.txt').write_text(C.dump(q, {}, frames))
        attrs = dict(kind='사람', age='불명', hair='검증용', clothing='검증용')
        H.write_json_atomic(w / 'desc.json', dict(label='격리 픽셀', attributes=attrs))
        H.record_model_frames(w)
        gate = H.make_views(w / 'out.chr.txt', w / 'views', row['base'], 'free')
        H.write_json_atomic(w / 'published.json', H.binding(gate))
        acceptance = dict(id=f'{source.name}/{w.name}', decision='accept', inspected=H.binding(gate), at=H.now())
        H.DECISIONS.write_text(json.dumps(acceptance)+'\n')
        result = R.create(source.name)
        recipe = H.DATA / 'recipes' / result['id']
        frozen = R.load(recipe, check_tools=True)
        check('recipe-keeps-current-human-binding', len(frozen['seeds']) == 1 and frozen['seeds'][0]['acceptance'] == acceptance)
        check('recipe-exact-seed-not-quantized', (recipe / 'seeds/000/out.chr.txt').read_bytes() == (w / 'out.chr.txt').read_bytes())
        with H.DECISIONS.open('a') as file:
            file.write(json.dumps(dict(acceptance, inspected=dict(acceptance['inspected'], sourceSha256='stale')))+'\n')
        rejects('recipe-refuses-stale-human-selection', lambda: R.create(source.name))
        H.DECISIONS.write_text(json.dumps(acceptance)+'\n')
        original = (recipe / 'seeds/000/out.chr.txt').read_bytes()
        (recipe / 'seeds/000/out.chr.txt').write_bytes(original + b'\n')
        rejects('recipe-refuses-modified-frozen-pixels', lambda: R.load(recipe))
        (recipe / 'seeds/000/out.chr.txt').write_bytes(original)
        real_sha = R.sha
        with patch.object(R, 'sha', side_effect=lambda path: 'changed' if Path(path) == H.HERE / 'harness.py' else real_sha(path)):
            rejects('recipe-refuses-runtime-tool-drift', lambda: R.load(recipe, check_tools=True))
        root = H.run_dir('variation-fixture')
        root.mkdir(parents=True)
        manifest = R.bind(root, result['id'], 5)
        manifest['productionPolicy'] = dict(maxReviewPending=2, repairRounds=0)
        H.write_json_atomic(root / 'manifest.json', manifest)
        wrong = copy.deepcopy(manifest)
        wrong['characters'][0]['seed'] = -1
        rejects('recipe-refuses-negative-seed-index', lambda: R.verify_run(root, wrong))
        wrong = copy.deepcopy(manifest)
        wrong.pop('motionPolicy')
        rejects('recipe-refuses-removing-motion-policy', lambda: R.verify_run(root, wrong))
        wrong = copy.deepcopy(manifest)
        wrong['characters'][0].pop('motionPolicy')
        rejects('recipe-refuses-row-motion-policy-drift', lambda: R.verify_run(root, wrong))
        for index in (0, 1):
            batch, rows = B.prepare_batch(root.name, [manifest['characters'][index]], index + 1)
            row = rows[0]
            target = batch / row['folder']
            bp, bf = H.base_of(row['base'])
            new_pal = dict(bp)
            for symbol, rgb in bp.items():
                if rgb is not None:
                    new_pal[symbol] = (rgb[0] ^ 2, rgb[1], rgb[2])
            (target / 'out.chr.txt').write_text(C.dump(new_pal, {}, bf))
            H.write_json_atomic(target / 'desc.json', dict(label='격리 변주', attributes=attrs))
            H.write_json_atomic(target / 'meta.json', dict(run=root.name, brief=row['key'], base=row['base'], seed=row['seed'],
                                                          strength='free', reviewMode='human', animationMode=H.FRAME_AUTHOR_MODE,
                                                          engine='gpt', **H.ENGINES['gpt'], pid=0, recipe=manifest['recipe'], motionPolicy=M.VERSION))
            H.record_model_frames(target)
            gate = H.make_views(target / 'out.chr.txt', target / 'views', row['base'], 'free')
            if index:
                rejects('delivery-refuses-identical-pixel-duplicate', lambda: D.publish(target, gate))
                check('duplicate-is-never-published', not (target / 'published.json').exists())
                continue
            D.publish(target, gate)
            check('delivery-ready-after-source-and-four-background-readback', H.human_ready(target, gate))
            check('delivery-binds-motion-source-and-region-evidence', M.fresh(target, gate))
            meta_file = target / 'meta.json'
            saved_meta = meta_file.read_bytes()
            modified_meta = json.loads(saved_meta); modified_meta.pop('motionPolicy')
            H.write_json_atomic(meta_file, modified_meta)
            check('delivery-missing-worker-motion-policy-not-ready', not H.human_ready(target, gate))
            meta_file.write_bytes(saved_meta)
            for filename in ('views/walk_checker.gif', 'base.chr.txt', 'desc.json', 'model-frames.json',
                             'views/motion.json', 'views/motion.png', 'views/motion.gif'):
                path = target / filename
                raw = path.read_bytes()
                path.write_bytes(raw + b'corrupt')
                check('delivery-refuses-modified-' + filename, not H.human_ready(target, gate))
                path.write_bytes(raw)
            check('delivery-restored-bytes-restore-readiness', H.human_ready(target, gate))
            import studio
            import zipfile
            H.DECISIONS.write_text(json.dumps(dict(acceptance, id=f'{root.name}/{target.name}', inspected=H.binding(gate)))+'\n')
            export = studio.export_kept(root.name)
            with zipfile.ZipFile(H.DATA / 'downloads' / Path(export['url']).name) as archive:
                names = archive.namelist()
                check('variation-export-preserves-ancestor-RTP-license', 'licenses/easyrpg/COPYING' in names)
                check('variation-export-preserves-frozen-recipe', f'sources/recipes/{result["id"]}/recipe.json' in names)
        # Scheduler proof uses no model and no choice journal. It counts both reserved jobs and completed GIFs.
        schedule = H.run_dir('buffer-fixture')
        schedule.mkdir()
        H.write_json_atomic(schedule / 'manifest.json', manifest)
        held = dict(awaiting=0, started=0)
        lock = threading.Lock()
        errors = []

        def pending(_):
            with lock:
                return held['awaiting']

        def worker(*_):
            with lock:
                held['started'] += 1
                held['awaiting'] += 1

        def wait_for(phase, started):
            deadline = time.monotonic() + 8
            while time.monotonic() < deadline:
                state_file = schedule / 'production-state.json'
                if state_file.exists() and json.loads(state_file.read_text())['phase'] == phase and held['started'] == started:
                    return True
                time.sleep(.05)
            return False

        with patch.object(B, 'awaiting', side_effect=pending), patch.object(B, 'produce_batch', side_effect=worker):
            thread = threading.Thread(target=lambda: errors.extend(B.produce_with_buffer(schedule, manifest['characters'], 2)))
            thread.start()
            try:
                check('production-waits-at-two-pending-GIFs', wait_for('waiting-review', 2))
                with lock:
                    held['awaiting'] -= 1
                check('production-continues-after-one-review-slot-opens', wait_for('waiting-review', 3))
            finally:
                H.write_json_atomic(schedule / 'pause-request.json', dict(at=H.now()))
                thread.join(8)
            check('waiting-production-pauses-without-generating-remaining', not thread.is_alive() and held['started'] == 3 and not errors)

