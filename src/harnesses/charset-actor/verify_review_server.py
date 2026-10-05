"""HTTP journal/publication regression contracts, invoked by the automatic CI."""
import json
import tempfile
import threading
from pathlib import Path
from unittest.mock import patch

import harness as H
import review_server as S


def verify(check, isolated_store):
    with tempfile.TemporaryDirectory(prefix='charset-http-') as temp, isolated_store(Path(temp)):
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
