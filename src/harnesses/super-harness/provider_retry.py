"""Durable provider retries, separate from quality revisions and human decisions."""
import fcntl
import os
import hashlib
import json
from pathlib import Path
import re
import time
import store


def init():
    with store.connect() as db:
        db.execute('''CREATE TABLE IF NOT EXISTS provider_retries(
          id INTEGER PRIMARY KEY, concept TEXT, kind TEXT, tag TEXT, count INTEGER NOT NULL,
          due REAL NOT NULL, status TEXT NOT NULL, reason TEXT NOT NULL, phase TEXT,
          epoch TEXT, invocation TEXT NOT NULL, meta TEXT NOT NULL, job INTEGER)''')


# Native runners import the same parser without loading this SQLite store.
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from provider_errors import tail, classify


def epoch(cid):
    c = store.concept(cid) if cid else None
    return hashlib.sha256(json.dumps({k:c.get(k) for k in
        ('feedback','attempt','plan_attempt','art_revision')} if c else {},sort_keys=True).encode()).hexdigest()


def rows(where="status IN ('pending','claiming','running')", args=()):
    init()
    with store.connect() as db:
        return [dict(r) for r in db.execute('SELECT * FROM provider_retries WHERE '+where, args)]


def pending(cid):
    return rows("concept=? AND status IN ('pending','claiming','running')", (cid,))


def pending_meta():
    return [json.loads(r['meta']) for r in rows("status IN ('pending','claiming')")]


def capture(sh, jid, meta, code):
    inv = meta.get('invocation')
    if not code or not inv: return False
    reason = classify(tail(inv['log']))
    if meta['kind'] == 'art-native':
        import native_retry
        faults = native_retry.failures(inv['cmd'][2], json.loads(Path(inv['cmd'][3]).read_text()))
        if not faults or any(not f['reason'] for f in faults): return False
        reason = 'context-overflow' if any(f['reason']=='context-overflow' for f in faults) else faults[0]['reason']
    elif not inv.get('stdin'): return False
    if not reason: return False
    init()
    key = meta.get('providerRetry', jid)
    previous = rows('id=?', (key,))
    count = previous[0]['count']+1 if previous else 1
    counts=dict(meta.get('providerReasonCounts') or {})
    counts[reason]=counts.get(reason,0)+1
    if reason == 'context-overflow' and counts[reason] > 2: return False
    delay = 60 if reason == 'context-overflow' else (120,300,900,1800)[min(count-1,3)]
    retry_after = re.search(r'Retry-After\s*[:=]\s*(\d+)', tail(inv['log']), re.I)
    if retry_after: delay = max(delay, int(retry_after[1]))
    c = store.concept(meta['concept']) if meta.get('concept') else None
    due = time.time()+delay
    data = dict(meta, providerRetry=key, providerReasonCounts=counts)
    with store.connect() as db:
        db.execute('''INSERT OR REPLACE INTO provider_retries
          VALUES(?,?,?,?,?,?,'pending',?,?,?,?,?,?)''',
          (key,meta.get('concept'),meta['kind'],meta['tag'],count,due,reason,c['stage'] if c else None,
           epoch(meta.get('concept')),json.dumps(inv),json.dumps(data),jid))
    if c:
        label = '모델 요청 한도(429)' if reason=='rate-limit' else '문맥 크기 조정' if reason=='context-overflow' else '모델 공급자 일시 오류'
        at=time.strftime('%H:%M:%S',time.localtime(due))
        store.update_concept(c['id'], status='retry-wait', note=f'{label} · {at} 자동 재시도 ({count}차, 품질 수정 횟수 유지)')
    store.log(meta.get('concept'), f'기술 재시도 예약 — {reason}, {delay}초 후, 작업 {jid}')
    return True


def finished(meta):
    key=meta.get('providerRetry')
    if key is not None:
        init()
        with store.connect() as db: db.execute("UPDATE provider_retries SET status='complete' WHERE id=?",(key,))


def cancel(cid):
    init()
    with store.connect() as db: db.execute("UPDATE provider_retries SET status='cancelled' WHERE concept=? AND status='pending'",(cid,))


def tick(sh, ids=None, slots=3):
    # One admission/launch transaction across the HTTP and scoped supervisors.
    with (Path(sh.DATA)/'provider-retry.lock').open('a') as lock:
        try: fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError: return
        _tick(sh, ids, slots)


def _tick(sh, ids, slots):
    # A process dying after reservation cannot strand a retry. Running job
    # metadata is written by start_proc, before the claim is released.
    for r in rows("status='claiming'"):
        jobs=store.jobs("status='running'")
        match=None
        for job in jobs:
            path=Path(sh.DATA)/'job-invocations'/f"{job['id']}.json"
            try: saved=json.loads(path.read_text())
            except (OSError, ValueError): continue
            if saved.get('providerRetry')==r['id']: match=job; break
        with store.connect() as db:
            db.execute("UPDATE provider_retries SET status=?,job=? WHERE id=?",
                       ('running' if match else 'pending',match['id'] if match else r['job'],r['id']))
    for r in rows("status='running'"):
        if ids is not None and r['concept'] not in ids: continue
        c=store.concept(r['concept']) if r['concept'] else None
        if c and not sh.theme_production.current(c['id'],json.loads(r['meta'])):
            finished(json.loads(r['meta']));continue
        if c and (c['stage']!=r['phase'] or epoch(c['id'])!=r['epoch']):
            # A user decision supersedes this retry; never replay an old result.
            finished(json.loads(r['meta']));continue
        j=store.jobs('id=?',(r['job'],),limit=1)
        if j and j[0]['status']=='running':
            import activity
            if activity.process_alive(j[0]): continue
            store.update_job(j[0]['id'],status='lost',ended=store.now())
            j[0]['status']='lost'
        # A finished process is handled by its owning reaper. Lost invocations are recovered only after sh.recover.
        if j and j[0]['status']=='lost':
            with store.connect() as db: db.execute("UPDATE provider_retries SET status='pending',due=? WHERE id=?",(time.time()+120,r['id']))
        elif j and j[0]['ended'] and time.time()-time.mktime(time.strptime(j[0]['ended'],'%Y-%m-%dT%H:%M:%S'))>30:
            # Recover a daemon dying between persisting exit and delivering its callback.
            meta=json.loads(r['meta'])
            saved=Path(sh.DATA)/'job-invocations'/f"{j[0]['id']}.json"
            if saved.exists(): meta=json.loads(saved.read_text())
            code=0 if j[0]['status']=='done' else 1
            if capture(sh,j[0]['id'],meta,code): continue
            finished(meta)
            try: sh.HANDLERS[meta['kind']](meta,code,j[0]['result'])
            except Exception as error:
                if r['concept']: store.update_concept(r['concept'],stage='blocked',status='idle',note='종료 결과 복구 오류',reasons=[str(error)])
    for r in rows("status='pending' ORDER BY due"):

        cid=r['concept']
        if ids is not None and (cid not in ids or cid is None and r['kind'] not in ('seed-discover','theme-plan','theme-review')): continue
        c=store.concept(cid) if cid else None
        if c and not sh.theme_production.current(cid,json.loads(r['meta'])):
            cancel(cid);continue
        if r['kind'] in ('theme-plan','theme-review'):
            m=json.loads(r['meta']);p=sh.theme_production.read(sh.theme_production.folder(m['themeSeed'])/'policy.json')
            if not p or sh.theme_production.token(p)!=m['themePolicyHash']:
                with store.connect() as db: db.execute("UPDATE provider_retries SET status='cancelled' WHERE id=?",(r['id'],))
                continue
        if cid is None and r['kind']=='seed-discover':
            with store.connect() as db:
                seed=db.execute('SELECT active FROM keyword_seeds WHERE id=?',(r['tag'],)).fetchone()
                if not seed or not seed[0]:
                    db.execute("UPDATE provider_retries SET status='cancelled' WHERE id=?",(r['id'],));continue
        if c and (c['stage']!=r['phase'] or epoch(cid)!=r['epoch']):
            cancel(cid); continue
        if r['due']>time.time(): continue
        jobs=store.jobs("status='running'")
        if len(jobs)>=int(store.setting('max_codex')): return
        if cid not in {j['concept'] for j in jobs} and len({j['concept'] for j in jobs})>=slots: continue
        if any(j['kind'] in ('build','review','probe','bake','unbake') for j in jobs): continue
        inv=json.loads(r['invocation']);meta=json.loads(r['meta'])
        with store.connect() as db:
            changed=db.execute("UPDATE provider_retries SET status='claiming' WHERE id=? AND status='pending'",(r['id'],)).rowcount
        if not changed: continue
        try:
            prompt=Path(inv['stdin']).read_text() if inv.get('stdin') else ''
            folder=Path(sh.DATA)/'provider-retries'/str(r['id'])/str(r['count'])
            folder.mkdir(parents=True,exist_ok=True)
            source=folder/'prompt.md'
            if r['reason']=='context-overflow':
                prompt+='\n\n문맥 초과 복구: 새 대화에서 이어간다. 파일 전체나 대형 JSON을 출력하지 말고 rg 후 필요한 절을 최대 120줄씩 읽는다. 같은 파일을 반복해서 읽지 말고 요약과 경로를 기록한다. 원본 그림·검수 조건은 유지한다.\n'
            source.write_text(prompt)
            result=meta.get('result')
            if result and Path(result).is_file():
                import shutil
                shutil.copy2(result,folder/'previous-result.json');Path(result).unlink()
            cmd=list(inv['cmd']);work=inv['cwd']
            if r['kind']=='art-native' and '--resume-technical' not in cmd: cmd.append('--resume-technical')
            if '-C' in cmd:
                work=str(folder/'work');Path(work).mkdir(exist_ok=True);cmd[cmd.index('-C')+1]=work
            jid=sh.start_proc(cid,r['kind'],r['tag'],cmd,work,str(folder/'worker.log'),inv['timeout'],
                              meta,stdin_path=str(source) if inv.get('stdin') else None)
            with store.connect() as db: db.execute("UPDATE provider_retries SET status='running',job=? WHERE id=?",(jid,r['id']))
            if c: store.update_concept(cid,status='running',note=f'기술 오류 자동 재시도 {r["count"]}차 · 품질 수정 횟수 유지')
        except Exception as error:
            with store.connect() as db: db.execute("UPDATE provider_retries SET status='pending',due=? WHERE id=?",(time.time()+120,r['id']))
            store.log(cid,'재시도 시작 오류: '+str(error)[:250])
