"""Evidence-bound art feedback and bounded regeneration. Never launches a worker itself."""
from pathlib import Path
import json
import shutil

import art_choices
import store
import art_layout

CHECKS = art_layout.SCENE_CHECKS


def read(path, default=None):
    return json.loads(Path(path).read_text()) if Path(path).is_file() else default


def write(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix('.tmp')
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2))
    tmp.replace(path)


def directory(data, cid):
    return Path(data) / 'concepts' / cid


def limits(data, cid):
    brief = read(directory(data, cid) / 'parking-repair-brief.json', {})
    maximum = int(store.setting('max_art_revisions') or 2)
    if 'maxRevisions' in brief: maximum = min(maximum, max(0, int(brief['maxRevisions'])))
    return {'maxRevisions': maximum, 'candidateCount': max(1, int(brief.get('candidateCount', 1))), 'nativeAttempts': 1}


def review_input(data, cid):
    folder = directory(data, cid)
    manifest_path = folder / 'art-choices.json'
    manifest = read(manifest_path, {})
    state = art_choices.view(data, cid)
    contexts = read(folder / 'art-context-review.json', {}).get('groups', {})
    groups = []
    for group in manifest.get('groups', []):
        current = next(g for g in state['groups'] if g['id'] == group['id'])
        if any(c['ready'] for c in current['candidates']): continue
        candidates = []
        for c in group['candidates']:
            visible = next(v for v in current['candidates'] if v['id'] == c['id'])
            prior = contexts.get(group['id'], {}).get(c['id'], {})
            reviewed = (prior.get('fingerprint') == art_choices.fingerprint(c) and prior.get('gateVersion') == art_layout.VERSION
                        and all(k in prior.get('checks', {}) for k in CHECKS))
            if not reviewed and not visible['stale'] and group.get('requiresContextReview'):
                candidates.append(dict(c, fingerprint=art_choices.fingerprint(c)))
        if candidates: groups.append({'id': group['id'], 'title': group['title'], 'candidates': candidates})
    return {'manifestSha256': art_choices.digest(manifest_path), 'groups': groups,
            'root': str(Path(data) / 'art-worktrees' / cid),
            'previousFeedback': read(folder / 'art-feedback.json', {}),
            'repairBrief': read(folder / 'parking-repair-brief.json', {}),
            'approvedLayout': read(folder / 'art-layout-input.json', {}), 'gateVersion': art_layout.VERSION}


def validate_review(data, cid, result, request):
    """Validate evidence shape as well as current manifest before accepting a model verdict."""
    if not isinstance(result, dict) or result.get('manifestSha256') != request['manifestSha256']:
        raise ValueError('조립 검수 입력 해시 누락/불일치')
    if art_choices.digest(directory(data, cid) / 'art-choices.json') != request['manifestSha256']:
        raise ValueError('조립 검수 중 후보가 변경됨')
    expected_groups = {g['id'] for g in request['groups']}
    if set(result.get('groups', {})) != expected_groups: raise ValueError('요청하지 않은 그룹 판정/그룹 누락')
    for group in request['groups']:
        if set(result['groups'][group['id']]) != {c['id'] for c in group['candidates']}:
            raise ValueError('요청 후보와 판정 목록 불일치')
        for c in group['candidates']:
            r = result.get('groups', {}).get(group['id'], {}).get(c['id'], {})
            if r.get('gateVersion') != art_layout.VERSION: raise ValueError('이전 검수 기준으로 승인할 수 없습니다.')
            if r.get('fingerprint') != c['fingerprint'] or r.get('verdict') not in ('PASS', 'FAIL'):
                raise ValueError('후보별 조립 판정 또는 해시 누락')
            expected = {v['sha256'] for v in c['images']}
            if set(r.get('imagesSeen', [])) != expected: raise ValueError('모든 조립 예시 확인 근거 필요')
            checks = r.get('checks', {})
            for key in CHECKS:
                check = checks.get(key, {})
                if check.get('verdict') not in ('PASS', 'FAIL') or len(str(check.get('evidence', '')).strip()) < 12:
                    raise ValueError(f'조립 검수 {key} 관찰 근거 필요')
            failed = any(checks[k]['verdict'] == 'FAIL' for k in CHECKS)
            if failed != (r['verdict'] == 'FAIL'): raise ValueError('세부 판정과 전체 판정 불일치')
            if failed:
                fixes = r.get('fixes')
                if not isinstance(fixes, list) or not fixes: raise ValueError('실패에는 구체적인 수정 지시 필요')
                for fix in fixes:
                    if (fix.get('category') not in ('asset', 'assembly', 'spec') or
                        any(not isinstance(fix.get(k), str) or not fix[k].strip() for k in ('target', 'problem', 'change', 'keep'))):
                        raise ValueError('수정 대상·문제·변경·보존 항목 필요')
    # Recheck image/receipt sources; a unchanged manifest alone is not sufficient.
    state = art_choices.view(data, cid)
    if any(c['stale'] for g in state['groups'] for c in g['candidates']): raise ValueError('검수 대상 파일 해시가 변경됨')
    return result


def queue_repair(data, cid):
    """Consume one rejected generation once. Enqueue only; pause is controlled by the supervisor."""
    with store._lock:
        folder = directory(data, cid)
        manifest_path = folder / 'art-choices.json'
        manifest = read(manifest_path)
        source = art_choices.digest(manifest_path)
        state = art_choices.view(data, cid)
        failed = [g for g in state['groups'] if not any(c['ready'] for c in g['candidates'])]
        if not failed: return False
        previous = read(folder / 'art-feedback.json', {})
        review_fingerprint = art_choices.fingerprint({'version': art_layout.VERSION, 'context': read(folder / 'art-context-review.json', {})})
        if previous.get('manifestSha256') == source and previous.get('reviewFingerprint') == review_fingerprint:
            current = store.concept(cid)
            if current['stage'] == 'art' and current['status'] == 'running':
                store.update_concept(cid, stage='blocked', status='idle', note='같은 실패 후보를 그대로 반환함 — 새 수정 근거 필요')
            return False
        context = read(folder / 'art-context-review.json', {}).get('groups', {})
        repairs = []
        for group in failed:
            for candidate in group['candidates']:
                raw = next(c for g in manifest['groups'] if g['id'] == group['id'] for c in g['candidates'] if c['id'] == candidate['id'])
                review = context.get(group['id'], {}).get(candidate['id'], {})
                matching = review.get('fingerprint') == art_choices.fingerprint(raw)
                fixes = (review.get('fixes', []) if matching else []) + raw.get('repairFixes', [])
                evidence_root = folder / 'art-feedback-history' / source / 'evidence'
                evidence_root.mkdir(parents=True, exist_ok=True)
                archived = []
                for ref in raw['sources'] + raw['images']:
                    original = art_choices.verified(Path(data) / 'art-worktrees' / cid, ref)
                    snapshot = evidence_root / (ref['sha256'] + original.suffix)
                    if not snapshot.exists(): shutil.copy2(original, snapshot)
                    if art_choices.digest(snapshot) != ref['sha256']: raise ValueError('피드백 원본 보존 해시 불일치')
                    archived.append({'path': str(snapshot), 'sha256': ref['sha256'], 'label': ref.get('label', '')})
                repairs.append({'group': group['id'], 'candidate': candidate['id'], 'sources': raw['sources'],
                    'images': raw['images'], 'fingerprint': art_choices.fingerprint(raw),
                    'problems': candidate['reasons'], 'fixes': fixes,
                    'nativePassed': raw['passed'], 'archivedEvidence': archived})
        c = store.concept(cid)
        revision = c.get('art_revision') or 0
        cap = limits(data, cid)
        exhausted = revision >= cap['maxRevisions']
        feedback = {'version': 2, 'manifestSha256': source, 'reviewFingerprint': review_fingerprint, 'previousRevision': revision,
            'revision': revision if exhausted else revision + 1, 'limits': cap,
            'status': 'limit-reached' if exhausted else 'queued', 'repairs': repairs,
            'preserveGroups': [g['id'] for g in state['groups'] if g not in failed],
            'repairBrief': read(folder / 'parking-repair-brief.json', {}), 'created': store.now()}
        # Every revision keeps its exact input; later preparation cannot erase the evidence.
        write(folder / 'art-feedback-history' / (source + '.json'), feedback)
        write(folder / 'art-feedback.json', feedback)
        reasons = [f'{r["group"]}/{r["candidate"]}: {p}' for r in repairs for p in r['problems']]
        store.update_concept(cid, art_revision=feedback['revision'], art_review_attempt=0,
            stage='blocked' if exhausted else 'art', status='idle' if exhausted else 'queued', reasons=reasons,
            note=f'그림 자동 수정 {revision}회 소진 — 사람 확인 필요' if exhausted else f'검수 피드백 반영 재생성 {revision + 1}/{cap["maxRevisions"]} 대기')
        store.log(cid, '조립 검수 반려 → ' + ('자동 수정 상한 도달' if exhausted else f'피드백을 포함한 재생성 {revision + 1}차 대기'))
        return True
