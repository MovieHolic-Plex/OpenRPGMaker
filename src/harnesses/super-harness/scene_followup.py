"""Import a reviewed expansion into the existing bounded art repair loop.

No fabricated FAIL report: retain the original assembly PASS / facility INCOMPLETE,
and explicitly version the facility acceptance scope before queuing real work.
"""
import argparse
import fcntl
import json
from pathlib import Path
import shutil

import art_choices
import art_feedback
import store

ROOT = Path(__file__).resolve().parents[3]


def inputs(path):
    request = json.loads(Path(path).read_text())
    cid = request['concept']
    if not cid or any(c not in 'abcdefghijklmnopqrstuvwxyz0123456789-_' for c in cid):
        raise ValueError('Invalid concept id')
    paths = {key: (ROOT / request[key]).resolve() for key in ('review', 'binding', 'scene', 'plan', 'acceptance')}
    if any(not p.is_relative_to(ROOT) or not p.is_file() for p in paths.values()):
        raise ValueError('Existing repository evidence required')
    report = json.loads(paths['review'].read_text())
    binding = json.loads(paths['binding'].read_text())
    for name in ('scene', 'plan'):
        if binding.get(name + 'Sha256') != art_choices.digest(paths[name]):
            raise ValueError('Scene/plan changed after review: ' + name)
    if report.get('assemblyVerdict') not in ('PASS', 'FAIL') or report.get('facilityVerdict') != 'INCOMPLETE':
        raise ValueError('This intake requires an actual INCOMPLETE facility review')
    limitations = report.get('visualLimitations', [])
    if not limitations or report.get('hardIssues'):
        raise ValueError('Expansion intake expects classified visual limitations and no unclassified hard issues')
    contract = json.loads(paths['acceptance'].read_text())
    ids = {c['id'] for c in contract['criteria']}
    if not contract.get('requiresFacilityVerdict') or not ids:
        raise ValueError('Explicit facility completion contract required')
    fixes = request['fixes']
    if sorted(f['limitation'] for f in fixes) != list(range(len(limitations))):
        raise ValueError('Every visual limitation needs exactly one repair order')
    for fix in fixes:
        if (fix['category'] not in ('asset', 'assembly', 'spec')
                or not fix['criteria'] or not set(fix['criteria']) <= ids
                or any(not str(fix.get(k, '')).strip() for k in ('target', 'change', 'keep'))):
            raise ValueError('Repair target/change/keep and acceptance criterion required')
    if not request.get('scopeChange') or not request.get('group'):
        raise ValueError('Explicit scope change and candidate group required')
    fingerprint = art_choices.fingerprint({'request': request, 'evidence': {k: art_choices.digest(p) for k, p in paths.items()}})
    return request, paths, report, contract, fingerprint


def enqueue(path):
    request, paths, report, contract, fingerprint = inputs(path)
    data = Path(store.DATA)
    cid = request['concept']
    folder = data / 'concepts' / cid
    # Separate CLI processes must not consume the same review twice. The global
    # pause and no-live-job preconditions keep the daemon out of this transition.
    with (data / 'scene-followup.lock').open('w') as lock, store._lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        with store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            db.execute('CREATE TABLE IF NOT EXISTS scene_followups(concept TEXT, fingerprint TEXT, revision INTEGER, status TEXT, PRIMARY KEY(concept,fingerprint))')
            old = db.execute('SELECT * FROM scene_followups WHERE concept=? AND fingerprint=?', (cid, fingerprint)).fetchone()
            if old:
                return dict(old, duplicate=True)
            c = db.execute('SELECT * FROM concepts WHERE id=?', (cid,)).fetchone()
            if not c or c['status'] == 'running':
                raise ValueError('Existing idle concept required')
            if store.setting('paused') != '1' or db.execute("SELECT 1 FROM jobs WHERE concept=? AND status='running'", (cid,)).fetchone():
                raise ValueError('Pause scheduler and finish active concept jobs before importing review')
            revision = c['art_revision'] or 0
            cap = art_feedback.limits(data, cid)
            exhausted = revision >= cap['maxRevisions']
            next_revision = revision if exhausted else revision + 1
            history = folder / 'scene-followup-history' / fingerprint
            history.mkdir(parents=True, exist_ok=True)
            # Never overwrite previous small-scene selection, installation or
            # acceptance evidence when promoting a larger scope.
            for name in ('art-acceptance.json', 'parking-repair-brief.json', 'art-feedback.json', 'art-choices.json',
                         'art-context-review.json', 'art-installation.json', 'art-result.json'):
                source, target = folder / name, history / name
                if source.is_file() and not target.exists():
                    shutil.copy2(source, target)
            art_feedback.write(history / 'concept-before.json', dict(c))
            archived = []
            for name, source in paths.items():
                target = history / ('source-' + name + source.suffix)
                shutil.copy2(source, target)
                archived.append({'path': str(target), 'sha256': art_choices.digest(target), 'label': name})
            fixes = [dict(f, problem=report['visualLimitations'][f['limitation']]) for f in request['fixes']]
            repair = {'group': request['group'], 'candidate': 'expanded-scene', 'required': True,
                      'problems': report['visualLimitations'], 'fixes': fixes, 'failedChecks': {},
                      'archivedEvidence': archived, 'sourceVerdict': report}
            brief = {'scope': contract['id'], 'candidateCount': cap['candidateCount'], 'maxRevisions': cap['maxRevisions'],
                     'purpose': request['scopeChange'], 'required': [c['passWhen'] for c in contract['criteria']],
                     'defer': contract.get('advisoryOnly', []), 'requireCalibration': False,
                     'acceptance': [c['passWhen'] for c in contract['criteria']],
                     'state': 'facility-repair-required'}
            feedback = {'version': 3, 'manifestSha256': fingerprint, 'reviewFingerprint': art_choices.digest(paths['review']),
                        'source': 'reviewed-expansion', 'previousRevision': revision, 'revision': next_revision,
                        'limits': cap, 'status': 'limit-reached' if exhausted else 'queued', 'created': store.now(),
                        'repairs': [repair], 'completionRepairs': [repair], 'preserveGroups': [], 'repairBrief': brief,
                        'policy': {'route': 'spec', 'phase': 'scene', 'repeatedChecks': [], 'reason': request['scopeChange']}}
            art_feedback.write(history / 'request.json', request)
            art_feedback.write(folder / 'art-acceptance.json', contract)
            art_feedback.write(folder / 'parking-repair-brief.json', brief)
            art_feedback.write(folder / 'art-feedback-history' / (fingerprint + '.json'), feedback)
            art_feedback.write(folder / 'art-feedback.json', feedback)
            note = ('시설 미완성 — 누적 수정 한도 소진' if exhausted else
                    f'시설 미완성 → 구조·조명·차량 다양성·출입 동선 수정 {next_revision}/{cap["maxRevisions"]} 대기')
            db.execute('UPDATE concepts SET art_revision=?,art_review_attempt=0,stage=?,status=?,note=?,reasons=?,updated=? WHERE id=?',
                       (next_revision, 'blocked' if exhausted else 'art', 'idle' if exhausted else 'queued', note,
                        json.dumps(report['visualLimitations'], ensure_ascii=False), store.now(), cid))
            db.execute('INSERT INTO scene_followups VALUES(?,?,?,?)', (cid, fingerprint, next_revision, feedback['status']))
            db.execute('INSERT INTO log(at,concept,text) VALUES(?,?,?)', (store.now(), cid, note))
            return {'concept': cid, 'fingerprint': fingerprint, 'revision': next_revision, 'status': feedback['status'],
                    'orders': len(fixes), 'history': str(history)}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('request')
    args = parser.parse_args()
    print(json.dumps(enqueue(args.request), ensure_ascii=False, indent=2))
