"""Replay only a stored layout-response error through the current native handler.

Never changes FAIL to PASS, resets attempts, or draws directly. A live supervisor
may still own an older module; this adapter keeps its persisted errors recoverable.
"""
from copy import deepcopy
from pathlib import Path


def recover_context(sh, cid):
    """Replay an unchanged completed scene verdict after a recorder repair."""
    c = sh.store.concept(cid)
    if not c or c['stage'] != 'blocked' or c['note'] != '조립 검수 실행 오류 — 2회 실패':
        return False
    if sh.store.jobs("concept=? AND status='running'", (cid,)):
        return False
    jobs = sh.store.jobs("concept=? AND kind='art-context-review'", (cid,), limit=1)
    if not jobs or jobs[0]['status'] != 'done' or not isinstance(jobs[0].get('result'), dict):
        return False
    job = jobs[0]
    request = sh.read_json(sh.cdir(cid, 'art-context-input.json'))
    marker = Path(sh.cdir(cid, 'art-context-response-errors', f'replayed-job-{job["id"]}.json'))
    if marker.exists():
        return False
    # Current candidate/source hashes and all original FAIL judgments must still
    # pass the current protocol. An invalid report cannot be rescued by replay.
    try:
        sh.art_feedback.validate_review(sh.DATA, cid, deepcopy(job['result']), request)
    except (ValueError, OSError, KeyError, TypeError):
        return False
    sh.write_json(marker, {'at': sh.store.now(), 'job': job['id'], 'original': job['result'],
                          'priorReasons': c['reasons'], 'manifestSha256': request['manifestSha256']})
    sh.store.update_concept(cid, stage='art-context-review', status='queued',
                            note='보존된 검수 응답 처리 재개', reasons=[])
    sh.on_art_context_review({'concept': cid, 'context_input': request,
                              'adjudication': job['tag'] == 'adjudicate'}, 0, deepcopy(job['result']))
    sh.store.log(cid, f'조립 검수 응답 복구: 작업 {job["id"]} 판정·그림 횟수 보존')
    return True


def recover(sh, cid):
    c = sh.store.concept(cid)
    if not c or c['stage'] != 'blocked' or c['note'] != '제작 전 도면 검수 오류':
        return False
    if sh.store.jobs("concept=? AND status='running'", (cid,)):
        return False
    jobs = sh.store.jobs("concept=? AND kind='art-layout-review'", (cid,), limit=1)
    if not jobs or jobs[0]['status'] != 'done':
        return False
    job = jobs[0]
    result = job.get('result')
    request = sh.read_json(sh.cdir(cid, 'art-execution.json'))
    root = Path(sh.DATA) / 'art-worktrees' / cid
    layout = sh.art_layout.build_input(root, request)
    if not isinstance(result, dict) or result.get('fingerprint') != layout['fingerprint']:
        return False
    marker = Path(sh.cdir(cid, 'art-layout-response-errors', f'replayed-job-{job["id"]}.json'))
    if marker.exists():
        return False
    # Preserve the failed response before running the same validation/transition path.
    sh.write_json(marker, {'at': sh.store.now(), 'job': job['id'], 'original': result})
    meta = {'concept': cid, 'kind': 'art-layout-review', 'tag': job['tag'],
            'adjudication': job['tag'] == 'adjudicate'}
    sh.on_art_layout_review(meta, 0, deepcopy(result))
    current = sh.store.concept(cid)
    sh.store.log(cid, f'검수 응답 복구: 작업 {job["id"]} 원본 보존 → {current["note"]}')
    return True
