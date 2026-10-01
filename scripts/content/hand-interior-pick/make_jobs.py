#!/usr/bin/env python3
"""v5 기물 381개를 우선순위로 줄 세우고 작업자 5명 몫으로 나눈 배정표(jobs.json)를 만들고,
배정된 기물마다 후보 폴더(candidates/<slug>/)를 준비한다: v5.png·v5-x4.png·v5.pxg(현재판을 격자로 옮긴 것)·palette.pal·info.json.

  python3 scripts/content/hand-interior-pick/make_jobs.py                        # 1판: 작업자 10명 × 11개 + 파일럿 2개
  python3 scripts/content/hand-interior-pick/make_jobs.py --workers 5 --per 12   # 작업자 수·몫을 바꿔 1판을 다시 나눈다
  python3 scripts/content/hand-interior-pick/make_jobs.py --round 2              # 다음 판(앞 판 배정·선택된 것은 건너뜀)
  python3 scripts/content/hand-interior-pick/make_jobs.py --prep "bed red"  # 기물 하나만 폴더 준비(새 기물 id 도 된다)
  python3 scripts/content/hand-interior-pick/make_jobs.py --prep-new        # new/items.json 의 새 기물 전부 폴더 준비(새 기물 길)

우선순위 점수 = 예제 방 26곳(v5 rooms4)에 놓인 횟수 + 3 × 나온 방 수 + 크기 보너스(칸 수).
한 판에는 변형 묶음(variantGroup)당 하나만 넣는다(궤짝:양배추·궤짝:당근 … 은 몸통이 같다 — 고른 방향을 뒤에 변형에 옮긴다).
애니메이션 기물(12프레임)과 자동 타일 조각(카운터)은 이 하네스 1차 범위 밖(queue 에 later 로 남긴다).
"""
import argparse, collections, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa

PILOT = ['dining 2x1', 'bed green']   # 감독 에이전트가 직접 찍어 전 과정을 증명한 기물
PER_WORKER = 11
N_WORKERS = 10
CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!$%&+?<>[]{}()^|,;"\'`'

def material_hint(o):
    i = o['id']; c = o['category']
    for keys, mat in ((('pot', 'jar', 'vase', 'urn', 'basin', 'sink', 'bowl'), 'ceramic'),
                      (('bed', 'sofa', 'armchair', 'rug', 'mat', 'banner', 'tapestry', 'curtain', 'fabric', 'mannequin', 'sack', 'cushion'), 'cloth'),
                      (('potted', 'plant', 'fern', 'flower', 'sapling', 'herb'), 'plant'),
                      (('window', 'bottle', 'glass', 'tank'), 'glass'),
                      (('armor', 'shield', 'weapon', 'anvil', 'stove', 'range', 'pans', 'iron', 'cauldron'), 'metal'),
                      (('column marble', 'altar', 'statue', 'font', 'column dwarf', 'fireplace', 'oven'), 'stone')):
        if any(k in i for k in keys):
            return mat
    return 'wood'

def usage():
    rooms4, _ = v5_modules()
    n = collections.Counter(); rooms = collections.defaultdict(set)
    for b, v in rooms4.B.items():
        for m in v['maps']:
            for it in m['items']:
                i = getattr(it[0], 'id', None); n[i] += 1; rooms[i].add(m['key'])
    return n, rooms

def later_reason(o):
    if o['atlas']['frames'] > 1: return 'animated'
    if 'autotile' in o: return 'autotile'
    return None

def prep(o):
    """후보 폴더 준비. v5 현재판 그림 + 그 격자판 + 팔레트(공통 램프 + 이 기물의 v5 색) + info."""
    from PIL import Image
    s = slug(o['id']); d = os.path.join(CAND, s); os.makedirs(d, exist_ok=True)
    im = v5_slot(o); W, H = im.size
    im.save(os.path.join(d, 'v5.png'))
    im.resize((W * 4, H * 4), Image.NEAREST).save(os.path.join(d, 'v5-x4.png'))
    new = bool(o.get('new'))   # 새 기물: v5 그림이 없다 → v5.png·v5.pxg 는 전부 투명한 캔버스(작업자의 출발점), v5 색 없음
    shared = open(SHARED_PAL, encoding='utf-8').read()
    ramp_of = {}
    for line in shared.split('\n'):
        b = line.split('//')[0].split()
        if b[:1] == ['@rampc']:
            for k, hx in enumerate(b[2:]):
                ramp_of.setdefault(hx.lower(), f'{b[1]}:{"0123456789abcde"[k]}')
    px = im.load(); cols = []; key = {}
    for y in range(H):
        for x in range(W):
            c = px[x, y]
            if c[3] and c not in key:
                if len(cols) >= len(CHARS): raise SystemExit(f'{o["id"]}: 색이 너무 많다')
                key[c] = CHARS[len(cols)]; cols.append(c)
    lines = [f'// {o["id"]} — 공통 팔레트(palette/v5.pal) + 이 기물의 v5 색(한 글자씩). 이 파일은 make_jobs.py 가 만든다: 고치지 마라.',
             '// 새 색이 필요하면 공통 램프(@rampc 재료:단)를 쓴다. 검사는 v5 색 밖을 불합격시킨다.', shared.rstrip(), '', '// ---- 이 기물의 v5 색 ----']
    if new: lines[0] = f'// {o["id"]} — 새 기물: 공통 팔레트(palette/v5.pal)만 쓴다(v5 현재판이 없다). 이 파일은 make_jobs.py 가 만든다: 고치지 마라.'
    if new: lines[-1] = '// ---- 새 기물은 v5 색이 없다: 공통 램프만 ----'
    for c in cols:
        hx = '#%02x%02x%02x' % c[:3]
        lines.append(f'{key[c]} {hx}' + (f' {c[3]}' if c[3] < 255 else '') + (f'   // = {ramp_of[hx]}' if hx in ramp_of else ''))
    atomic_write(os.path.join(d, 'palette.pal'), '\n'.join(lines) + '\n')
    rows = [''.join(key[px[x, y]] if px[x, y][3] else '.' for x in range(W)) for y in range(H)]
    atomic_write(os.path.join(d, 'v5.pxg'), '\n'.join([
        (f'// 새 기물 {o["id"]} ({W}x{H}) — v5 에 없는 기물이라 전부 투명한 빈 캔버스다. 방향 A 는 이 파일을 복사해 처음부터 찍는다.' if new else
         f'// v5 현재판 {o["id"]} ({W}x{H}, 패딩 위 {o["atlas"]["padTop"]}px 포함). 방향 A 는 이 파일을 복사해 다듬는다.'),
        f'@size {W} {H}', '@cell 16', '@palette palette.pal', '@block 0 0'] + rows) + '\n')
    a = __import__('numpy').array(im); op = a[..., 3] == 255
    ys, xs = op.nonzero()
    info = dict(id=o['id'], slug=s, name_ko=o['name_ko'], category=o['category_ko'], kind=o['kind'], kind_ko=o['kind_ko'],
                canvas=[W, H], padTop=o['atlas']['padTop'], image=o['image'], footprint=o['footprint'], overhang_px=o['overhang_px'],
                surface=o.get('surface'), description=o['description'], where=o.get('where'), placement=o.get('placement'),
                v5_bbox=[int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())] if len(xs) else None,
                v5_colors=len(cols), material=material_hint(o),
                related=[r['id'] for r in o.get('related', [])])
    if new:   # 새 기물 표지: 검사기는 v5 비교를 건너뛰고, 문맥 그림은 contextRoom 에 임시로 놓는다
        info.update(new=True, contextRoom=o.get('contextRoom'), v5_bbox=None)
    atomic_write(os.path.join(d, 'info.json'), json.dumps(info, ensure_ascii=False, indent=1) + '\n')
    return s

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--round', type=int, default=1); ap.add_argument('--prep'); ap.add_argument('--prep-new', action='store_true', help='새 기물(new/items.json) 전부 폴더 준비')
    ap.add_argument('--per', type=int, default=PER_WORKER)
    ap.add_argument('--workers', type=int, default=N_WORKERS, help='작업자 수(w1…wN)'); a = ap.parse_args()
    WORKERS = [f'w{k + 1}' for k in range(a.workers)]
    meta = load_meta(include_new=False); by = {o['id']: o for o in meta['objects']}   # 우선순위·판 배정은 v5 381개만
    news = load_new_items({o['id'] for o in meta['objects']})
    if a.prep:
        allo = dict(by, **{o['id']: o for o in news})
        if a.prep not in allo: raise SystemExit(f'모르는 기물: {a.prep}')
        print(prep(allo[a.prep])); return
    if a.prep_new:
        for o in news: print(prep(o))
        return
    n, rooms = usage()
    def score(o):
        return n[o['id']] + 3 * len(rooms[o['id']]) + min(6, o['footprint']['w'] * max(1, o['footprint']['h']))
    ranked = sorted(meta['objects'], key=lambda o: (-score(o), o['id']))
    jp = os.path.join(PICK, 'jobs.json')
    old = json.load(open(jp, encoding='utf-8')) if os.path.exists(jp) and a.round > 1 else None
    done = set()
    if old:
        for r in old['rounds']:
            for w, lst in r['workers'].items(): done |= set(lst)
    picks = json.load(open(os.path.join(PICK, 'picks.json'))) if os.path.exists(os.path.join(PICK, 'picks.json')) else {}
    done |= set(picks) | set(PILOT)
    groups = set(); chosen = []
    for o in ranked:
        if later_reason(o) or o['id'] in done: continue
        g = o.get('variantGroup') or o['id']
        if g in groups: continue
        if a.round == 1 and g in {by[p].get('variantGroup') for p in PILOT}: continue
        groups.add(g); chosen.append(o)
        if len(chosen) >= a.per * len(WORKERS): break
    workers = {w: [] for w in WORKERS}
    for k, o in enumerate(chosen):   # 뱀 순서: 1 2 3 4 5 5 4 3 2 1 … 우선순위가 고르게 섞인다
        r, c = divmod(k, len(WORKERS)); w = WORKERS[c if r % 2 == 0 else len(WORKERS) - 1 - c]
        workers[w].append(o['id'])
    rnd = dict(round=a.round, nWorkers=len(WORKERS), per=a.per, workers=workers, pilot=PILOT if a.round == 1 else [])
    queue = [dict(id=o['id'], slug=slug(o['id']), score=score(o), uses=n[o['id']], rooms=len(rooms[o['id']]),
                  group=o.get('variantGroup'), later=later_reason(o)) for o in ranked]
    jobs = dict(version=1, note='작업자별 기물 id 목록(겹침 없음). 절차는 WORKER.md. queue = 381개 전체 우선순위(later = 1차 범위 밖).',
                directions={'A': 'v5 결을 살려 다듬기', 'B': '명암·그림자 강화', 'C': '실루엣·비율 재해석'},
                rounds=(old['rounds'] if old else []) + [rnd], queue=queue)
    for o in chosen + [by[p] for p in rnd['pilot']]:
        prep(o)
    atomic_write(jp, json.dumps(jobs, ensure_ascii=False, indent=1) + '\n')
    for w, lst in workers.items(): print(w, len(lst), lst)
    print('pilot', rnd['pilot'])

if __name__ == '__main__':
    main()
