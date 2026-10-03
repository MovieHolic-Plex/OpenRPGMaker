"""적대적 리뷰어 기록·상태.  (규칙: ADVERSARIAL.md)

    python3 harness/adversarial.py prep               # 리뷰어용 그림(조각 6배 + 지도 2배) 만들기
    python3 harness/adversarial.py record <json>      # 리뷰어 출력(목록)을 현재 해시에 묶어 기록
    python3 harness/adversarial.py status             # 조각별 렌즈 결과
"""
import hashlib, json, os, sys, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE)); sys.path.insert(0, HERE)
import catalog
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..', '..'))
PATH = os.path.join(HERE, 'adversarial.json')
LENSES = ('culture', 'view')
ADV_DIR = os.path.join(ROOT, 'tiledata/joseon-demo/review/adv')


def piece_hash(cv):
    return hashlib.sha1(cv.a.tobytes()).hexdigest()[:12]


def load():
    try:
        return json.load(open(PATH))
    except FileNotFoundError:
        return {}


def check(name, cv, data=None):
    """현재 해시에 대한 두 렌즈의 keep 여부. (ok, 이유 문자열)"""
    data = data if data is not None else load()
    rec = data.get(name)
    h = piece_hash(cv)
    if not rec or rec.get('hash') != h:
        return False, 'A 적대 리뷰 없음/그림 바뀜'
    bad = []
    for lens in LENSES:
        r = rec.get('lenses', {}).get(lens)
        if not r:
            bad.append(f'{lens} 없음')
        elif r['verdict'] != 'keep':
            top = [d for d in r.get('defects', []) if d.get('severity') in ('blocker', 'major')][:2]
            bad.append(f"{lens}={r['verdict']}({r['score']}) " + '; '.join(d['what'][:60] for d in top))
    return (not bad), 'A ' + ' | '.join(bad) if bad else ''


def prep():
    from PIL import Image
    os.makedirs(ADV_DIR, exist_ok=True)
    for name, cv in catalog.objects().items():
        cv.img().resize((cv.w * 6, cv.h * 6), Image.NEAREST).save(os.path.join(ADV_DIR, name + '.6x.png'))
    print('prep ->', ADV_DIR)


def record(path):
    items = json.load(open(path))
    if isinstance(items, dict):
        items = items.get('reviews', [items])
    objs = catalog.objects()
    data = load()
    n = 0
    for it in items:
        name, lens = it['piece'], it['lens']
        if name not in objs or lens not in LENSES:
            print('skip', name, lens); continue
        h = piece_hash(objs[name])
        rec = data.get(name)
        if not rec or rec.get('hash') != h:
            rec = {'hash': h, 'lenses': {}}
        rec['lenses'][lens] = {'score': it['score'], 'defects': it.get('defects', []), 'verdict': it['verdict'],
                               'date': time.strftime('%Y-%m-%d'), 'round': it.get('round', 1)}
        data[name] = rec; n += 1
    json.dump(data, open(PATH, 'w'), ensure_ascii=False, indent=1)
    print('recorded', n)


def status():
    objs = catalog.objects(); data = load()
    for name, cv in objs.items():
        ok, why = check(name, cv, data)
        print(f'{name:16s} {"KEEP" if ok else "BLOCK"}  {why[:140]}')


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'status'
    {'prep': prep, 'status': status}.get(cmd, lambda: record(sys.argv[2]))()
