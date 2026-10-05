"""Replay only a stored layout-response error through the current native handler.

Never changes FAIL to PASS, resets attempts, or draws directly. A live supervisor
may still own an older module; this adapter keeps its persisted errors recoverable.
"""
from copy import deepcopy
from pathlib import Path


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
