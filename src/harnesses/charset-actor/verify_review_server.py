"""HTTP journal/publication regression contracts, invoked by the automatic CI."""
import json
import tempfile
import threading
from pathlib import Path
from unittest.mock import patch

import harness as H
import review_server as S
import studio
import catalog_sources as CS
from PIL import Image


def verify(check, isolated_store):
    with tempfile.TemporaryDirectory(prefix='charset-http-') as temp, isolated_store(Path(temp)):
        producer = H.DATA / 'runs/producer'
        producer.mkdir(parents=True)
        H.write_json_atomic(producer / 'driver.json', dict(pid=42, par=2))
        with patch.object(H, '_alive', side_effect=lambda pid: pid in (42, 43)):
            studio.reserve_artists(2)
            check('studio-reserves-slots-before-production-layout-exists', studio.active_productions() == [dict(run='producer', par=2)])
            other = H.DATA / 'runs/other'
            other.mkdir()
            H.write_json_atomic(other / 'driver.json', dict(pid=43))
            H.write_json_atomic(other / 'production.json', dict(par=2))
            try:
                studio.reserve_artists(1)
            except ValueError:
                check('studio-blocks-overlapping-producers-over-four-artists', True)
            else:
                check('studio-blocks-overlapping-producers-over-four-artists', False)
            studio.reserve_artists(2, exclude='producer')
            check('studio-resume-excludes-its-own-reservation', True)
            H.write_json_atomic(other / 'driver.json', dict(pid=0, par=4))
            check('studio-ended-producer-releases-slots', studio.active_productions() == [dict(run='producer', par=2)])
        opaque = Image.new('RGBA', (2, 1), (0, 0, 0, 0))
        opaque.putpixel((1, 0), (0, 0, 0, 255))
        flat = CS.normalize(opaque)
        check('catalog-keeps-opaque-black-separate-from-transparent-black', flat.getpixel((0, 0)) == CS.C.KEY and flat.getpixel((1, 0)) == (0, 0, 0))
        opaque.putpixel((1, 0), (*CS.C.KEY, 255))
        try:
            CS.normalize(opaque)
        except ValueError:
            check('catalog-refuses-body-using-output-transparent-key', True)
        else:
            check('catalog-refuses-body-using-output-transparent-key', False)
        assets = CS.editor_catalog()
        check('catalog-reads-all-six-editor-monster-sheets', sum(a['group'] == 'Monster' for a in assets) == 6)
        check('catalog-includes-scarloxy-and-farm-provider-assets', sum(a['group'] == 'Scarloxy' for a in assets) == 2 and sum(a['group'] == 'Farm' for a in assets) == 2)
        source = CS.create()
        frozen = CS.R.load(H.DATA / 'recipes' / source['id'], check_tools=True)
        check('catalog-frozen-sources-retain-all-20-walking-sheets', source['sheets'] == 20 and source['seeds'] >= 100)
        started = []

        def launch(root, par, batch_size):
            started.append(dict(run=root.name, par=par, batchSize=batch_size))
            return dict(run=root.name, pid=0)

        with patch.object(studio, 'launch', side_effect=launch):
            collection = studio.create(dict(allSources=True, count=100, par=2, catalogRecipe=source['id']))
        plans = [json.loads((H.run_dir(r['run']) / 'manifest.json').read_text()) for r in started]
        check('catalog-plans-100-instead-of-dropping-eight-animals', sum(len(m['characters']) for m in plans) == collection['count'] == 100)
        check('catalog-splits-animal-policy-without-dropping-body-checks', len(plans) == 2 and plans[0]['motionPolicy'] == CS.M.VERSION and plans[1]['animalPolicy'] == 1 and plans[1]['motionPolicy'] is None)
        chosen = [r['catalogReference'] for r in plans[0]['characters']]
        check('catalog-100-plan-visits-every-walking-sheet', len({r['assetId'] for r in chosen}) == 20)
        check('catalog-single-character-artists-retain-global-two-slot-budget', sum(r['par'] for r in started) == 2 and all(r['batchSize'] == 1 for r in started))
        check('catalog-reference-is-not-a-fake-human-acceptance', all('acceptance' not in s for s in frozen['seeds']) and not H.DECISIONS.exists())
        w = H.DATA / 'runs/fixture/candidate__gpt-r1'
        w.mkdir(parents=True)
        (w / 'meta.json').write_text(json.dumps(dict(pid=0)))
        (w / 'out.chr.txt').write_text('isolated journal fixture')
        gate = dict(version=3, sourceSha256='a'*64, baseSha256='b'*64, strength='free', ok=True, fails=[])
        op = dict(id='fixture/candidate__gpt-r1', decision='accept', mutationId='first', inspected=H.binding(gate))
        state = S.ReviewState(start_workers=False)
        entered, release, published = threading.Event(), threading.Event(), threading.Event()
        fail = True

        def publish():
            nonlocal fail
            entered.set()
            release.wait(5)
            if fail:
                fail = False
                raise RuntimeError('isolated publication failure')
            receipt = dict(count=len(H._decisions()), reloaded=True)
            H.write_json_atomic(H.DATA / 'shared-library.json', receipt)
            (H.DATA / 'shared-library-error.json').unlink(missing_ok=True)
            published.set()
            return receipt

        with patch.object(H, 'current_gate', return_value=gate), \
             patch.object(H, 'quality', return_value=dict(eligible=True)), \
             patch.object(H, 'human_review', return_value=True), \
             patch.object(H, 'sync_human_decision'), \
             patch.object(H, 'publish_shared_library', side_effect=publish):
            try:
                code, receipt = state.decide(op)
                check('review-ack-reloads-fsynced-journal', code == 200 and H._decisions()[op['id']] == receipt)
                check('review-no-publication-on-choice-thread', not entered.is_set())
                code, duplicate = state.decide(op)
                check('review-retry-does-not-append', code == 200 and duplicate == receipt and len(H.DECISIONS.read_text().splitlines()) == 1)
                check('review-mutation-conflict-rejected', state.decide(dict(op, decision='reject'))[0] == 409)
                check('review-stale-binding-rejected', state.decide(dict(op, mutationId='stale', inspected={}))[0] == 409)
                check('review-traversal-rejected', state.decide(dict(op, id='../candidate'))[0] in (400, 404))
                clear = dict(op, decision='clear', mutationId='clear')
                state.decide(clear)
                state.decide(op)
                check('review-old-accept-retry-preserves-clear', H._decisions().get(op['id']) is None and len(H.DECISIONS.read_text().splitlines()) == 2)
                with patch.object(H, 'quality', return_value=dict(eligible=False)):
                    check('review-invalid-accept-does-not-append', state.decide(dict(op, mutationId='blocked'))[0] == 409 and len(H.DECISIONS.read_text().splitlines()) == 2)

                revision = S.item_revision()
                H.write_json_atomic(H.DATA / 'review-publication.json', {})
                H.write_json_atomic(H.DATA / 'shared-library.json', {})
                check('review-publication-does-not-invalidate-item-snapshot', S.item_revision() == revision)
                (w / 'desc.json').write_text('{}')
                check('review-pixel-evidence-change-invalidates-item-snapshot', S.item_revision() != revision)

                state.ready.set()
                worker = threading.Thread(target=state.publication_loop, daemon=True)
                state.workers.append(worker)
                worker.start()
                check('review-background-publication-started', entered.wait(2))
                code, rejected = state.decide(dict(op, decision='reject', mutationId='reject'))
                check('review-choice-responds-during-blocked-publication', code == 200 and not release.is_set() and H._decisions()[op['id']] == rejected)
                release.set()
                check('review-publication-failure-retries-from-journal', published.wait(6))
                check('review-publication-error-never-undoes-choice', H._decisions()[op['id']] == rejected)
            finally:
                release.set()
                state.close()
