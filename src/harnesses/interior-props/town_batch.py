#!/usr/bin/env python3
"""Town 300: reproducible specs, explicit register/queue, resumable rounds.

PROP_HARNESS_CONTENT_ROOT must point at the live catalog when operating it.
python src/harnesses/interior-props/town_batch.py validate|register|queue|status|watch
Queue creates two human-review candidates per object; it never selects art.
"""
import argparse, collections, datetime, fcntl, hashlib, importlib, json, os, sys, time
from pathlib import Path
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))
harness = importlib.import_module('src.harnesses.interior-props.harness')
from common import NEW_ITEMS, atomic_write, new_item_object, objects_by_id, slug, spec_top_lint
store = harness.store
MANIFEST = ROOT / 'harness-data/interior-props/town-300.txt'
BATCH = 'town-300-20261005'
THEMES = {'modern': '현대', 'medieval': '중세 RPG', 'chrono': '시간여행 판타지', 'ff6': '증기마도 판타지'}

def definitions():
    out = []
    for line in MANIFEST.read_text().splitlines():
        if not line or line.startswith('#'): continue
        if line.startswith('@'):
            group, label, room = line[1:].split('|'); theme = group.split()[0]; continue
        item, ko, dims, shape = line.split('|'); w, d, ht = map(int, dims.split(',')); H = ht * 16
        top = 12 if d >= 2 else 4
        desc = (f'{ko}: {shape}. 남쪽 위에서 내려다본 3/4 시점, 발밑 {w}×{d}칸, 캔버스 {w*16}×{H}px. '
                f'꼭대기 윗면 {top}행 이상을 실제 면으로 보여 주고 그 아래 남쪽 정면을 구분한다. '
                '측면도·아이소메트릭 마름모 바닥 금지. 투명 배경, 사람·읽을 수 있는 글자·로고 없음. '
                '설명된 핵심 장치의 외곽선을 우선하고 작은 장식은 줄인다. 기존 손 도트 공용 기물과 재질·팔레트를 맞춘다.')
        refs = ['work 2x1', 'counter 2x1'] if theme == 'modern' else ['work 2x1', 'barrel']
        entry = dict(id=item, name_ko=ko, name_en=item, category='town_'+theme, category_ko=THEMES[theme]+' · 마을 300',
                     kind=('flat' if item == 'root cellar hatch' else 'floor'), footprint={'w':w, 'h':d}, canvas=[w*16,H], description=desc,
                     contextRoom=room, tags=[THEMES[theme], label, ko, BATCH], use=['search'],
                     place=f'{label}의 작업·서비스 자리. 앞에 접근 가능한 한 칸을 남기고 출입구·주 통로를 막지 않는다.',
                     pair=[], refs=refs)
        if w*d >= 6:
            entry['blockout'] = {'top':[H-28,H-17], 'front':[H-16,H-1], 'cover':0.7}
        out.append(entry)
    assert len(out) == 300
    assert collections.Counter(e['category'] for e in out) == {'town_modern':90,'town_medieval':90,'town_chrono':60,'town_ff6':60}
    assert len({slug(e['id']) for e in out}) == len(out)
    assert len({e['name_ko'] for e in out}) == len(out)
    return out

def validate(entries):
    by = objects_by_id(); slugs = {slug(i):i for i in by}; names = {o['name_ko']:i for i,o in by.items()}
    for e in entries:
        if e['id'] in by:
            if BATCH not in by[e['id']].get('tags',[]): raise ValueError('Existing id: '+e['id'])
        elif slug(e['id']) in slugs or e['name_ko'] in names:
            raise ValueError('Existing slug/name: '+e['id'])
        assert all(r in by for r in e['refs']), e['id']
        errors = spec_top_lint(new_item_object(e))
        if errors: raise ValueError('\n'.join(errors))
    return entries

def register(entries):
    path = Path(NEW_ITEMS); original = path.read_text(); data = json.loads(original)
    known = {e['id']:e for e in data['items']}; added = []
    for e in entries:
        if e['id'] in known:
            if known[e['id']] != e: raise ValueError('Definition drift: '+e['id'])
        else: added.append(e)
    if added:
        backup = Path(store.DATA)/'batch-backups'/BATCH
        backup.mkdir(parents=True, exist_ok=True)
        (backup/(hashlib.sha256(original.encode()).hexdigest()+'.json')).write_text(original)
        data['items'].extend(added)
        if path.read_text() != original: raise RuntimeError('Catalog changed concurrently; rerun')
        atomic_write(str(path), json.dumps(data,ensure_ascii=False,indent=1)+'\n')
    print(json.dumps({'registered':len(entries),'added':len(added),'catalog':str(path)},ensure_ascii=False),flush=True)

def summary(entries):
    ids = {e['id'] for e in entries}
    rounds = [r for r in store.rounds() if r['item'] in ids and r['note'].startswith('['+BATCH+']')]
    rids = {r['id'] for r in rounds}; runs = [r for r in store.runs() if r['round'] in rids]
    return {'batch':BATCH,'definitions':len(entries),'rounds':len(rounds),'briefs':sum(bool(r['brief']) for r in rounds),
            'candidates':len(runs),'status':dict(collections.Counter(r['status'] for r in runs)),
            'roundIds':[r['id'] for r in rounds], 'manifestSha256':hashlib.sha256(MANIFEST.read_bytes()).hexdigest()}

def watch_transient(entries):
    """Only this batch, only explicit 429 failures, at most five retries/run.

    The pool owns running work. This supervisor never kills workers or changes
    artistic verdicts. Delay is derived from durable ended/history timestamps.
    """
    ids = {e['id'] for e in entries}
    while True:
        pending = False; retried = []
        for r in store.runs():
            if r['item'] not in ids or not r['rnote'].startswith('['+BATCH+']'): continue
            if r['status'] in ('queued','running'): pending = True; continue
            review = json.loads(r.get('review') or '{}')
            if not (r['status']=='failed' or (r['status']=='done' and review.get('verdict')=='ERROR')): continue
            log = Path(r['log']) if r.get('log') else None
            if not log or not log.is_file(): continue
            # Read only the tail, never copy model logs/credentials into evidence.
            with log.open('rb') as f:
                f.seek(max(0,log.stat().st_size-8192)); tail=f.read().decode(errors='replace')
            if '429 Too Many Requests' not in tail: continue
            history=json.loads(r.get('history') or '[]')
            retries=sum(h.get('stage')=='transport-429-retry' for h in history)
            if retries >= 5: continue
            ended=datetime.datetime.fromisoformat(r['ended']).timestamp() if r.get('ended') else time.time()
            pending=True
            if time.time()-ended < min(900,60*(2**retries)): continue
            history.append(dict(stage='transport-429-retry',attempt=r.get('attempt') or 1,at=store.now(),retry=retries+1))
            # Only terminal rows are touched; preserve art attempt and round id.
            store.update_run(r['id'],status='queued',pid=None,ended=None,error='',review='',
                             history=json.dumps(history,ensure_ascii=False))
            retried.append(r['id'])
        if retried: print(json.dumps({'transportRetries':retried,'at':store.now()}),flush=True)
        if not pending: return
        harness.ensure_pool()
        time.sleep(30)

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('action',choices=['validate','register','queue','status','watch']);a=p.parse_args()
    entries=definitions()
    if a.action=='watch':
        Path(store.DATA).mkdir(parents=True,exist_ok=True)
        with open(Path(store.DATA)/(BATCH+'-watch.lock'),'a') as lock:
            fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
            watch_transient(entries)
        return
    if a.action=='status': print(json.dumps(summary(entries),ensure_ascii=False));return
    Path(store.DATA).mkdir(parents=True,exist_ok=True)
    with open(Path(store.DATA)/(BATCH+'.lock'),'a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        validate(entries)
        if a.action=='validate':print('300 definitions valid');return
        register(entries)
        if a.action=='queue':
            groups=[entries[:90],entries[90:180],entries[180:240],entries[240:]]
            for index in range(90):
                for group in groups:
                    if index >= len(group):continue
                    e=group[index]; marker='['+BATCH+']'
                    existing=[r for r in store.rounds(e['id']) if r['note'].startswith(marker)]
                    if existing:
                        assert len(existing)==1, e['id']
                        r=existing[0]
                        if not r['brief']:
                            brief=importlib.import_module('src.harnesses.interior-props.brief')
                            brief.make(r['id'],e['id'],note=r['note'])
                    else:
                        harness.draw([e['id']],n=2,note=marker+' '+e['place'],start_pool=False)
                    harness.ensure_pool()
        print(json.dumps(summary(entries),ensure_ascii=False),flush=True)
if __name__=='__main__':main()
