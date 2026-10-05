"""Two human decisions: example preferences and approval of an exact result.

Deny never discards a concept. Existing pause, material and visual gates still apply.
"""
from pathlib import Path
import shutil

import art_choices
import art_feedback
import store


def preferences(c):
    return {(e['group'], e['candidate'], e['fingerprint']): e['decision']
            for e in c.get('feedback', []) if e.get('kind') == 'example-decision'}


def decide_example(data, cid, body):
    with store._lock:
        state = art_choices.view(data, cid)
        if state['stage'] != 'art-review' or state['installation']:
            raise ValueError('새 예시를 준비 중이거나 이미 등록된 결과입니다. 화면을 새로고침해 주세요.')
        c = store.concept(cid)
        if c['status'] == 'running' or store.jobs("concept=? AND status='running'", (cid,), limit=1):
            raise ValueError('그림이 변경 중입니다. 제작이 끝나면 다시 확인해 주세요.')
        group = next((g for g in state['groups'] if g['id'] == body.get('group')), None)
        candidate = next((v for v in group['candidates'] if v['id'] == body.get('candidate')), None) if group else None
        decision = body.get('decision')
        if decision not in ('allow', 'deny') or not candidate or not candidate['eligible']:
            raise ValueError('현재 확인할 수 있는 예시가 아닙니다.')
        if candidate['fingerprint'] != body.get('fingerprint'):
            raise ValueError('그림이 바뀌었습니다. 새 예시를 확인해 주세요.')
        expected = [{'path': im['path'], 'v': im['v']} for im in candidate['images']]
        if body.get('images') != expected or not expected:
            raise ValueError('보고 있는 예시와 현재 그림이 다릅니다. 새로고침해 주세요.')
        text = body.get('text', '')
        if not isinstance(text, str) or len(text) > 2000: raise ValueError('수정 의견은 2000자 이내로 입력해 주세요.')
        text = text.strip()
        prefs = preferences(c)
        key = (group['id'], candidate['id'], candidate['fingerprint'])
        if prefs.get(key) == decision and not text:
            return state  # Double click/retry does not spend another revision.
        prefs[key] = decision
        entry = dict(kind='example-decision', at=store.now(), group=group['id'], candidate=candidate['id'],
                     fingerprint=candidate['fingerprint'], images=candidate['images'], decision=decision,
                     text=f'데모 {group["title"]}/{candidate["id"]}: {decision.upper()}' + (' — 수정 요청: ' + text if text else ''))
        # Keep an already allowed selection; multiple Allow preferences are valid.
        if decision == 'allow' and not any(v['selected'] for v in group['candidates']):
            art_choices.choose(data, cid, dict(body, action='choose-art'))
        elif decision == 'deny' and candidate['selected']:
            art_choices.choose(data, cid, dict(body, action='clear-art'))
            alternative = next((v for v in group['candidates'] if v['eligible'] and
                                prefs.get((group['id'], v['id'], v['fingerprint'])) == 'allow'), None)
            if alternative:
                art_choices.choose(data, cid, dict(action='choose-art', group=group['id'],
                                                  candidate=alternative['id'], fingerprint=alternative['fingerprint']))
        store.update_concept(cid, feedback=c['feedback'] + [entry])
        store.log(cid, entry['text'])
        available = [v for v in group['candidates'] if v['eligible']]
        if available and all(prefs.get((group['id'], v['id'], v['fingerprint'])) == 'deny' for v in available):
            queue_alternatives(data, cid, group, available)
        return art_choices.view(data, cid)


def queue_alternatives(data, cid, group, candidates):
    """Use the native art queue and its existing cumulative repair budget."""
    folder = Path(data) / 'concepts' / cid
    c = store.concept(cid)
    cap = art_feedback.limits(data, cid)
    revision = c.get('art_revision', 0)
    exhausted = revision >= cap['maxRevisions']
    previous = art_feedback.read(folder / 'art-feedback.json', {})
    source = art_choices.digest(folder / 'art-choices.json')
    archive = folder / 'example-decision-history' / source
    archive.mkdir(parents=True, exist_ok=True)
    repairs = []
    for candidate in candidates:
        evidence = []
        for im in candidate['images']:
            original = art_choices.safe(data, im['path'])
            path = archive / (im['v'] + original.suffix)
            if not path.exists(): shutil.copy2(original, path)
            if art_choices.digest(path) != im['v']: raise ValueError('거절한 예시 보존에 실패했습니다.')
            evidence.append({'path': str(path), 'sha256': im['v']})
        repairs.append({'group': group['id'], 'candidate': candidate['id'], 'archivedEvidence': evidence,
                        'failedChecks': {}, 'problems': ['사용자가 이 예시를 거절함'],
                        'fixes': [{'category': 'asset', 'target': group['title'],
                                   'problem': '사용자가 표시된 예시를 모두 거절함. 구체적인 결함은 지정하지 않음.',
                                   'change': '거절한 실제 그림을 비교하고 구별되는 새 예시를 제작한다. 같은 그림을 재제출하지 않는다.',
                                   'keep': '다른 Allow 예시와 기술 검수 기준을 보존한다.'}]})
    preserve = [g['id'] for g in art_choices.view(data, cid)['groups'] if g['id'] != group['id']]
    feedback = dict(previous, preserveGroups=preserve, manifestSha256=source, created=store.now(), repairs=repairs,
                    limits=cap, previousRevision=revision, revision=revision if exhausted else revision + 1,
                    status='limit-reached' if exhausted else 'queued',
                    policy={'route': 'asset', 'phase': 'scene', 'repeatedChecks': [],
                            'reason': '사용자가 예시를 모두 거절하여 다른 예시를 제작한다.'})
    art_feedback.write(archive / 'feedback.json', feedback)
    art_feedback.write(folder / 'art-feedback.json', feedback)
    store.update_concept(cid, stage='blocked' if exhausted else 'art', status='idle' if exhausted else 'queued',
                         art_revision=feedback['revision'], art_review_attempt=0,
                         note='새 예시 제작 한도 도달 · 운영 조치 필요' if exhausted else '거절한 예시를 바탕으로 새 예시 제작 대기',
                         reasons=[])
    store.log(cid, '예시 전체 Deny → ' + ('제작 한도 도달 (공간 보존)' if exhausted else '새 예시 제작 큐'))


def result_view(data, c, images):
    """Bind approval to bytes, never to a mutable image URL or an old PASS."""
    folder = Path(data) / 'concepts' / c['id']
    visible = [dict(im, v=art_choices.digest(art_choices.safe(data, im['path']))) for im in images]
    files = [folder / 'card.json', folder / 'examples' / 'check.json']
    files += sorted((folder / 'examples').rglob('*.json'))
    files += sorted((folder / 'reviews').glob(f'{c["attempt"]}-*.json'))
    judge = folder / f'judge-a{c["attempt"]}.json'
    if judge.is_file(): files.append(judge)
    files += sorted((folder / 'probe').glob(f'a{c["attempt"]}-*/score/score.json'))
    token = art_choices.fingerprint({'attempt': c['attempt'], 'images': visible,
                                    'sources': {str(p.relative_to(folder)): art_choices.digest(p) for p in files if p.is_file()}})
    approval = art_feedback.read(folder / 'result-review.json', {})
    return {'images': visible, 'fingerprint': token, 'canDecide': bool(visible) and
            (c['stage'] == 'done' or (c['stage'] == 'result-review' and approval.get('fingerprint') == token)),
            'stage': c['stage'], 'id': c['id'], 'title': c['title'], 'paused': store.setting('paused') == '1'}


def decide_result(data, cid, body, images):
    with store._lock:
        c = store.concept(cid)
        state = result_view(data, c, images)
        if not state['canDecide'] or state['fingerprint'] != body.get('fingerprint'):
            raise ValueError('현재 승인할 수 있는 결과가 아닙니다. 새 결과를 확인해 주세요.')
        decision = body.get('decision')
        text = body.get('text', '')
        if decision not in ('allow', 'deny', 'modify') or not isinstance(text, str) or len(text) > 2000:
            raise ValueError('결과 결정이 올바르지 않습니다.')
        if decision == 'modify' and not text.strip():
            raise ValueError('어떻게 고칠지 한 줄만 적어 주세요.')
        entry = dict(kind='result-decision', at=store.now(), decision=decision, fingerprint=state['fingerprint'],
                     images=state['images'], text=text.strip() or ('이 결과를 승인함' if decision == 'allow' else '이 결과를 거절함. 그림을 비교하고 다른 결과를 제작할 것.'))
        if c['stage'] == 'done' and decision == 'allow':
            store.update_concept(cid, feedback=c['feedback'] + [entry])
            store.log(cid, '사람 결과 ALLOW · 기존 등록 결과 확인')
            return {'ok': True, 'message': 'Allow를 저장했습니다. 이미 등록된 결과입니다.'}
        store.update_concept(cid, feedback=c['feedback'] + [entry], reasons=[] if decision == 'allow' else [entry['text']],
                             stage='bake' if decision == 'allow' else 'build', status='queued',
                             attempt=c['attempt'] if decision == 'allow' else c['attempt'] + 1,
                             note='결과 Allow · 등록 대기' if decision == 'allow' else '결과 의견을 반영해 다시 제작 대기')
        store.log(cid, '사람 결과 ' + decision.upper())
        return {'ok': True, 'message': ('승인했습니다. 등록을 기다립니다.' if decision == 'allow' else '새 결과 제작을 요청했습니다.') +
                (' 전체 작업이 일시 정지되어 있어 실행은 대기 중입니다.' if store.setting('paused') == '1' else '')}
