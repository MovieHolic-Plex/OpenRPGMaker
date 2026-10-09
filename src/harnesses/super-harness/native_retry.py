"""Resume only provider-failed native candidates at their original phase/attempt."""
import json
from pathlib import Path
import shutil
import sqlite3
import time
import provider_retry


def failures(root, request):
    root=Path(root)
    if request['harness']=='interior-props':
        with sqlite3.connect((root/request['data']/'harness.sqlite').as_uri()+'?mode=ro',uri=True) as db:
            db.row_factory=sqlite3.Row
            rows=[dict(r) for r in db.execute('SELECT * FROM runs')]
    else:
        state=root/request['runs']/request['round']/'state.json'
        rows=[dict(r,id=k) for k,r in json.loads(state.read_text())['cands'].items()]
    result=[]
    for row in rows:
        review=row.get('review') or {}
        if isinstance(review,str): review=json.loads(review)
        if row['status']=='done' and review.get('verdict') in ('PASS','FAIL','HARD'): continue
        if row['status']=='done' and not row.get('ok') and request['harness']=='interior-props' and not str(row.get('phase','')).startswith('review'): continue
        if request['harness']=='modern-chipset':
            phase='review' if review.get('verdict')=='ERROR' else 'draw'
            log=state.parent/'logs'/f"{row['id']}.a{row.get('attempt') or 1}{'.review' if phase=='review' else ''}.log"
        else:
            phase=row.get('phase') or 'draw'; log=Path(row.get('log') or '')
        result.append(dict(id=row['id'],phase=phase,log=str(log),reason=provider_retry.classify(provider_retry.tail(log)),row=row))
    return result


def reset(root, request):
    root=Path(root); faults=failures(root,request)
    if not faults or any(not f['reason'] for f in faults): raise ValueError('확인된 공급자 오류 후보만 재개할 수 있습니다.')
    archive=root/request['data']/'technical-retries'/str(time.time_ns())
    archive.mkdir(parents=True)
    (archive/'failures.json').write_text(json.dumps(faults,ensure_ascii=False,indent=2))
    for f in faults:
        log=Path(f['log'])
        if log.is_file(): shutil.copy2(log,archive/(str(f['id'])+'-'+log.name))
    if request['harness']=='interior-props':
        with sqlite3.connect(root/request['data']/'harness.sqlite') as db:
            for f in faults:
                # The native review phase reruns its pixel checker. Drawing isn't
                # queued when only the independent reviewer hit a provider error.
                db.execute("UPDATE runs SET status='queued',pid=NULL,error='',ended=NULL WHERE id=? AND status=?",
                           (f['id'],f['row']['status']))
    else:
        path=root/request['runs']/request['round']/'state.json'
        state=json.loads(path.read_text())
        for f in faults:
            row=state['cands'][f['id']]
            row.update(status='queued',error='',resumePhase=f['phase'])
        tmp=path.with_suffix('.retry-tmp');tmp.write_text(json.dumps(state,ensure_ascii=False,indent=2));tmp.replace(path)
    return faults
