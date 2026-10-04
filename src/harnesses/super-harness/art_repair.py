"""Route repeated visual failures back to specifications and bind before/after review."""
from pathlib import Path
import json
import shutil

import art_choices
import art_layout
import store


def read(path, default=None):
    return json.loads(Path(path).read_text()) if Path(path).is_file() else default


def failed_checks(review):
    return {k: v['evidence'] for k, v in review.get('checks', {}).items() if v.get('verdict') == 'FAIL'}


def route(folder, repairs, source):
    history = [read(p) for p in (folder / 'art-feedback-history').glob('*.json')]
    history = [h for h in history if h.get('manifestSha256') != source and h.get('repairs')]
    prior = max(history, key=lambda h: h.get('created', ''), default={})
    old_report = read(folder / 'art-context-history' / (prior.get('manifestSha256', '') + '.json'), {})
    repeated = set()
    for repair in repairs:
        # Repeated axes conservatively trigger a specification review. They are
        # not claimed to prove an identical physical defect across generations.
        old = old_report.get('groups', {}).get(repair['group'], {})
        old_axes = {k for r in old.values() for k in failed_checks(r)}
        repeated.update(set(repair.get('failedChecks', {})) & old_axes)
    axes = {k for r in repairs for k in r.get('failedChecks', {})}
    categories = {f.get('category') for r in repairs for f in r.get('fixes', [])}
    stage = 'spec' if repeated or 'specification' in axes or 'spec' in categories else 'assembly' if 'assembly' in categories else 'asset'
    brief = read(folder / 'parking-repair-brief.json', {})
    approved = read(folder / 'art-calibration.json', {})
    needs_calibration = bool({'style', 'projection'} & repeated) or bool(brief.get('requireCalibration') and not approved)
    return {'route': stage, 'phase': 'calibration' if needs_calibration else 'scene',
            'repeatedChecks': sorted(repeated),
            'reason': '반복 실패/명세 오류는 치수·형태·시점을 재설계한다. 이전 fix의 keep도 재검토 대상이다.' if stage == 'spec'
                      else '실패가 발생한 그림 또는 배치 단계로 돌아간다.'}


def obligations(feedback):
    result = []
    for r in feedback.get('repairs', []) + feedback.get('deferredRepairs', []):
        for key, problem in r.get('failedChecks', {}).items():
            result.append({'id': f"{r['group']}/{r['candidate']}/check/{key}", 'group': r['group'], 'check': key, 'problem': problem})
        for index, fix in enumerate(r.get('fixes', [])):
            result.append({'id': f"{r['group']}/{r['candidate']}/fix/{index}", 'group': r['group'], 'check': 'fix',
                           'problem': fix.get('problem', ''), 'target': fix.get('target', '')})
    # Different generations may report a different defect on the same axis.
    unique = {}
    for item in result:
        item['id'] += '/' + art_choices.fingerprint(item['problem'])[:12]
        unique[item['id']] = item
    return list(unique.values())


def validate_comparison(verdict, request, group_id):
    expected = {r['id']: r for r in request.get('comparisonObligations', []) if r['group'] == group_id}
    comparisons = verdict.get('comparisons', {})
    if set(comparisons) != set(expected): raise ValueError('이전 실패별 해결/미해결 비교가 누락되었습니다.')
    calibration = request.get('approvedLayout', {}).get('layout', {}).get('phase') == 'calibration'
    for key, obligation in expected.items():
        item = comparisons[key]
        status = item.get('status')
        if status not in ('resolved', 'unresolved', 'invalid-prior-claim', 'deferred'):
            raise ValueError('실패 전후 비교 상태 오류')
        if any(len(str(item.get(k, '')).strip()) < 20 for k in ('before', 'after', 'evidence')):
            raise ValueError('실패 전후의 좌표·형태와 판정 근거가 필요합니다.')
        if status == 'unresolved' and verdict['verdict'] == 'PASS':
            raise ValueError('미해결 결함을 남기고 합격할 수 없습니다.')
        if status == 'deferred' and (not calibration or obligation['check'] in ('projection', 'style', 'scale')):
            raise ValueError('시점 표본에서 보류한 공간 항목만 deferred가 가능합니다.')
    expected_images = {r['sha256'] for r in request.get('previousImages', [])}
    for ref in request.get('previousImages', []):
        if art_choices.digest(ref['path']) != ref['sha256']:
            raise ValueError('검수 중 이전 실패 그림이 변경되었습니다.')
    if set(verdict.get('previousImagesSeen', [])) != expected_images:
        raise ValueError('이전 실패 그림을 실제로 비교한 해시 목록이 필요합니다.')


def camera_style(camera):
    return {k: camera[k] for k in ('references', 'groundPlane', 'heightAxis', 'lighting')}


def require_preparation(root, folder, layout, feedback):
    policy = feedback.get('policy', {})
    if policy and layout['phase'] != policy['phase']:
        raise ValueError('현재 수정 단계와 도면 단계가 다릅니다: ' + policy['phase'])
    if policy:
        plan = layout.get('repairPlan', {})
        if plan.get('route') != policy['route'] or len(str(plan.get('changes', '')).strip()) < 30:
            raise ValueError('실패 원인 단계의 구체적인 수정 계획이 필요합니다.')
        if policy['route'] == 'spec' and len(str(plan.get('supersededConstraints', '')).strip()) < 30:
            raise ValueError('반복 실패를 만든 기존 고정 조건과 변경 근거를 명시해야 합니다.')
    approval = read(folder / 'art-calibration.json', {})
    if layout['phase'] == 'scene' and approval:
        if approval.get('gateVersion') != art_layout.VERSION:
            raise ValueError('현재 시점 검수 기준의 표본 승인이 필요합니다.')
        if camera_style(layout['camera']) != approval['cameraStyle']:
            raise ValueError('표본 승인 후 기준 시점이 바뀌었습니다. 시점 표본부터 재검수해야 합니다.')
        sources = {(r['path'], r['sha256']) for r in layout['sources']}
        for ref in approval['sources']:
            art_layout.verified(root, ref)
            if (ref['path'], ref['sha256']) not in sources:
                raise ValueError('합격 시점 표본·판정 해시를 조립 도면에도 묶어야 합니다.')


def finish_calibration(data, cid, state, write, limits):
    """A calibration is never a selectable scene; queue integration within the same total cap."""
    folder = Path(data) / 'concepts' / cid
    snapshot = read(folder / 'art-layout-input.json', {})
    if snapshot.get('layout', {}).get('phase') != 'calibration': return False
    if not state['groups'] or not all(any(c['ready'] for c in g['candidates']) for g in state['groups']): return False
    root = Path(data) / 'art-worktrees' / cid
    manifest = read(folder / 'art-choices.json')
    manifest_sha = art_choices.digest(folder / 'art-choices.json')
    out = root / 'art-output' / 'calibration' / manifest_sha
    out.mkdir(parents=True, exist_ok=True)
    refs = []
    originals = [folder / 'art-context-review.json', folder / 'art-layout-input.json', folder / 'art-choices.json']
    originals += [art_choices.verified(root, r) for g in manifest['groups'] for c in g['candidates'] for r in c['sources'] + c['images']]
    for path in originals:
        sha = art_choices.digest(path)
        target = out / (sha + path.suffix)
        if not target.exists(): shutil.copy2(path, target)
        if art_choices.digest(target) != sha: raise ValueError('시점 표본 보존 해시 불일치')
        ref = {'path': str(target.relative_to(root)), 'sha256': sha}
        if ref not in refs: refs.append(ref)
    approval = {'gateVersion': art_layout.VERSION, 'manifestSha256': manifest_sha,
                'cameraStyle': camera_style(snapshot['layout']['camera']), 'sources': refs}
    write(folder / 'art-calibration.json', approval)
    feedback = read(folder / 'art-feedback.json', {})
    cap = limits(data, cid)
    revision = store.concept(cid).get('art_revision', 0)
    exhausted = revision >= cap['maxRevisions']
    feedback.update(status='limit-reached' if exhausted else 'queued', limits=cap,
                    previousRevision=revision, revision=revision if exhausted else revision + 1,
                    policy={'route': 'integration', 'phase': 'scene', 'repeatedChecks': [],
                            'reason': '시점 표본 합격. 같은 시점으로 작은 주차장에 재조립하고 보류한 공간 결함까지 검수한다.'},
                    calibration=approval)
    write(folder / 'art-feedback.json', feedback)
    write(folder / 'art-feedback-history' / ('calibration-' + manifest_sha + '.json'), feedback)
    store.update_concept(cid, stage='blocked' if exhausted else 'art', status='idle' if exhausted else 'queued',
                         art_revision=feedback['revision'], art_review_attempt=0, reasons=[],
                         note='시점 표본 합격 · 공간 재조립 수정 한도 소진' if exhausted else f'시점 표본 합격 · 공간 재조립 {revision + 1}/{cap["maxRevisions"]} 대기')
    store.log(cid, '시점 표본 합격 → 공간 재조립 (사람 선택 전)')
    return True
