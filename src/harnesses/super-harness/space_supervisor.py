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
import finish_priority

# These phases write only concept artifacts or its own art worktree. Shared
# assembly/probe/publication keep exclusive access until independently isolated.
PARALLEL_STAGES = frozenset(('plan', 'plan-review', 'survey', 'material-review',
    'art', 'art-layout-review', 'art-context-review', 'art-demo'))
PARALLEL_KINDS = PARALLEL_STAGES | {'art-native', 'seed-discover'}


def admission(concept, jobs, slots, max_jobs):
    """Persisted running records reserve slots, including a pending reap."""
    priority = finish_priority.reason(concept)
    if priority: return priority
    if any(j['concept'] == concept['id'] for j in jobs):
        return 'same-concept'
    if concept['stage'] not in PARALLEL_STAGES:
        return 'shared-stage' if jobs else None
    if any(j['kind'] not in PARALLEL_KINDS for j in jobs):
        return 'shared-stage'
    if len({j['concept'] for j in jobs}) >= slots:
        return 'space-capacity'
    need = 2 if concept['stage'] == 'plan-review' else 1
    if len(jobs) + need > max_jobs:
        return 'worker-capacity'
    return None


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
    keywords = os.environ.get('SUPER_HARNESS_KEYWORDS') == '1'
    if (not ids and not keywords) or any(not store.concept(cid) for cid in ids):
        raise ValueError('실행할 기존 공간 id를 명시해야 합니다.')
    folder = Path(sh.DATA) / 'monitoring' / os.environ.get('SUPER_HARNESS_RUNNER_ID', 'requested-spaces')
    folder.mkdir(parents=True, exist_ok=True)
    lock = (folder / 'run.lock').open('w')
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    cli = Path.home() / '.npm-global/bin/codex'
    if cli.is_file():
        sh.CODEX = str(cli)
        sh.ENV['SUPER_HARNESS_CODEX_BIN'] = sh.CODEX
    handlers = {'plan': sh.start_plan, 'plan-review': sh.start_plan_reviews, 'survey': sh.start_survey,
                'material-review': sh.start_material_review, 'art': sh.start_art,
                'art-demo': sh.start_art_demo, 'art-layout-review': sh.start_art_layout_review, 'art-context-review': sh.start_art_context_review,
                'build': sh.start_build, 'review': sh.start_reviews, 'probe': sh.step_probe, 'bake': sh.start_bake}
    base_ids = list(ids)
    cursor = 0
    slots = max(1, int(os.environ.get('SUPER_HARNESS_SPACE_PARALLEL', '3')))
    # Bound inner prop pools too: three spaces must not fan out to 96 workers.
    sh.ENV['PROP_HARNESS_PAR'] = os.environ.get('SUPER_HARNESS_SPACE_PROP_PAR', '4')
    draining = False
    def drain(*_):
        nonlocal draining
        draining = True
    signal.signal(signal.SIGUSR1, drain)
    def stop(*_): raise KeyboardInterrupt
    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    try:
        while True:
            try:
                sh.reap()
                ids = list(dict.fromkeys(base_ids + (sh.keyword_seeds.members() if keywords else [])))
                # Required/child spaces must run too; do not resume unrelated concepts.
                known = {c['id']: c for c in store.concepts()}
                scope = set(ids)
                while True:
                    linked = {r for cid in scope for r in known[cid].get('requires', []) if r in known}
                    linked.update(c['id'] for c in known.values() if c.get('parent') in scope and c['stage'] != 'discarded')
                    if linked <= scope: break
                    scope.update(linked)
                ids += sorted(scope - set(ids))
                # The main scheduler owns global runs. This service owns only the
                # named requests while global discovery remains paused.
                waits = {}
                if not draining and store.setting('paused') == '1':
                    with finish_priority.admissions():
                        sh.provider_retry.tick(sh, ids + ([None] if keywords else []), slots)
                        if keywords: sh.keyword_seeds.tick(sh, slots)
                        sh.release_waiting(ids)
                        for cid in ids:
                            if store.concept(cid)['stage'] == 'discovered':
                                store.update_concept(cid, stage='plan', status='queued')
                        ids = finish_priority.order(ids)
                        start = 0 if finish_priority.waiting() else cursor
                        exclusive = next((c['id'] for c in (store.concept(cid) for cid in ids)
                            if c['stage'] in handlers and c['stage'] not in PARALLEL_STAGES
                            and c['status'] != 'running'), None)
                        for offset in range(len(ids)):
                            index = (start + offset) % len(ids)
                            cid = ids[index]
                            if store.jobs("concept=? AND status='running'", (cid,)): continue
                            if sh.provider_retry.pending(cid):
                                waits[cid] = 'provider-backoff'
                                continue
                            recover(cid)
                            c = store.concept(cid)
                            if c['stage'] in ('art-review', 'art-context-review') and sh.art_demo.required(sh.DATA, cid):
                                sh.advance_art_review(cid)
                                c = store.concept(cid)
                            if c['stage'] not in handlers or (c['status'] == 'running' and c['stage'] != 'probe'): continue
                            if exclusive and cid != exclusive:
                                waits[cid] = 'shared-stage'
                                continue
                            reason = admission(c, store.jobs("status='running'"), slots,
                                               int(store.setting('max_codex')))
                            if reason:
                                waits[cid] = reason
                                continue
                            handlers[c['stage']](c)
                            cursor = (index + 1) % len(ids)
                concepts = [store.concept(cid) for cid in ids]
                sh.write_json(folder / 'latest.json', {'at': store.now(), 'pid': os.getpid(),
                    'concepts': [{k: c.get(k) for k in ('id','title','stage','status','note','art_revision')} for c in concepts],
                    'parallelSpaces': slots, 'waits': waits, 'draining': draining,
                    'scope': '공간별 준비·검수 병렬. 공용 조립·시험·반영 직렬. 사용자 Allow/Deny 대기는 유지.'})
            except Exception as error:
                store.log(None, f'지정 공간 운영 오류: {type(error).__name__}: {str(error)[:250]}')
            if draining and not sh.PROCS and not sh.BAKING.locked():
                break
            time.sleep(5)
    except KeyboardInterrupt:
        pass
    finally:
        for jid in list(sh.PROCS): sh.kill(jid)
        (folder / 'latest.json').unlink(missing_ok=True)


if __name__ == '__main__':
    store.init()
    main(sys.argv[1:])
