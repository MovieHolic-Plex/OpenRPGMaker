"""Operate explicitly requested spaces, including bounded technical recovery.

No quality PASS, candidate choice, revision reset or global resume is synthesized.
Usage: python3 space_supervisor.py cemetery sewer classroom
"""
import fcntl
import json
import os
from pathlib import Path
import signal
import sys
import time

import sh
import store
import art_feedback
import review_recovery


def recover(cid):
    """Known orchestration faults only; quality failures keep their own budget."""
    with store._lock:
        c = store.concept(cid)
        if not c or c['stage'] != 'blocked' or store.jobs("concept=? AND status='running'", (cid,)):
            return False
        history = Path(sh.cdir(cid, 'operator-recovery.json'))
        record = sh.read_json(history, {'attempts': []})
        if len(record['attempts']) >= 2:
            return False
        note = c.get('note', '')
        if note not in ('제작 전 도면 검수 오류', '제작 전 도면 입력 변경/오류',
                        '칩 제작 미완료 — 하네스 결과·그림 근거 없음'):
            return False
        jobs = store.jobs("concept=? AND kind IN ('art','art-layout-review')", (cid,), limit=1)
        if not jobs or any(a['job'] == jobs[0]['id'] for a in record['attempts']):
            return False
        job = jobs[0]
        if note.startswith('칩 제작 미완료'):
            if job['tag'] != 'prepare' or Path(sh.cdir(cid, 'art-result.json')).exists():
                return False
            if not art_feedback.ensure_layout_feedback(sh.DATA, cid):
                return False
        # Preserve cause and job identity before replaying/queueing; restart cannot
        # spend an unlimited number of repairs on the same failed response.
        record['attempts'].append({'at': store.now(), 'job': job['id'], 'note': note, 'reasons': c['reasons']})
        sh.write_json(history, record)
        if note == '제작 전 도면 검수 오류':
            try:
                if review_recovery.recover(sh, cid):
                    return True
            except (ValueError, KeyError, OSError, TypeError):
                pass  # Changed input goes back to preparation, never to PASS.
        art_feedback.ensure_layout_feedback(sh.DATA, cid)
        store.update_concept(cid, stage='art', status='queued', reasons=c['reasons'],
                             note='시스템 입력 복구 완료 · 원래 공간의 수정 준비 대기')
        store.log(cid, '운영 자동 복구: 원인과 작업 기록 보존 → 준비 단계 재개 (그림 회차 유지)')
        return True


def main(ids):
    if not ids or any(not store.concept(cid) for cid in ids):
        raise ValueError('실행할 기존 공간 id를 명시해야 합니다.')
    folder = Path(sh.DATA) / 'monitoring' / 'requested-spaces'
    folder.mkdir(parents=True, exist_ok=True)
    lock = (folder / 'run.lock').open('w')
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    cli = Path.home() / '.npm-global/bin/codex'
    if cli.is_file():
        sh.CODEX = str(cli)
        sh.ENV['SUPER_HARNESS_CODEX_BIN'] = sh.CODEX
    handlers = {'plan': sh.start_plan, 'plan-review': sh.start_plan_reviews, 'survey': sh.start_survey,
                'material-review': sh.start_material_review, 'art': sh.start_art,
                'art-layout-review': sh.start_art_layout_review, 'art-context-review': sh.start_art_context_review,
                'build': sh.start_build, 'review': sh.start_reviews, 'probe': sh.step_probe, 'bake': sh.start_bake}
    cursor = 0
    def stop(*_): raise KeyboardInterrupt
    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    try:
        while True:
            try:
                sh.reap()
                # The main scheduler owns global runs. This service owns only the
                # named requests while global discovery remains paused.
                if store.setting('paused') == '1' and not sh.PROCS:
                    for offset in range(len(ids)):
                        index = (cursor + offset) % len(ids)
                        cid = ids[index]
                        if store.jobs("concept=? AND status='running'", (cid,)): continue
                        recover(cid)
                        c = store.concept(cid)
                        if c['stage'] not in handlers or (c['status'] == 'running' and c['stage'] != 'probe'): continue
                        # Serial native/preparation work across all supervisors.
                        if store.jobs("kind IN ('art','art-native','art-layout-review','art-context-review') AND status='running'"):
                            continue
                        handlers[c['stage']](c)
                        cursor = (index + 1) % len(ids)
                        break
                concepts = [store.concept(cid) for cid in ids]
                sh.write_json(folder / 'latest.json', {'at': store.now(), 'pid': os.getpid(),
                    'concepts': [{k: c.get(k) for k in ('id','title','stage','status','note','art_revision')} for c in concepts],
                    'scope': '사용자가 요청한 공간만 제작·기술 오류 복구. 사용자 Allow/Deny 대기는 유지.'})
            except Exception as error:
                store.log(None, f'지정 공간 운영 오류: {type(error).__name__}: {str(error)[:250]}')
            time.sleep(5)
    except KeyboardInterrupt:
        pass
    finally:
        for jid in list(sh.PROCS): sh.kill(jid)
        (folder / 'latest.json').unlink(missing_ok=True)


if __name__ == '__main__':
    store.init()
    main(sys.argv[1:])
