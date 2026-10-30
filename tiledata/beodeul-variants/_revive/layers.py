# 웨이브 장소 되살리기 2단계 — 원본 그림 + 장면 상태 → 칸마다 아래층·위층 그림, 통행(4방향).
#   아래층 = 원본 칸 그대로(물체가 그려진 그림 전체). 위층 = 원본에서 「키 큰 물체」 화소만(나머지 투명).
#   위층이 아래층 위에 같은 화소로 덮이므로 겹쳐 그리면 원본과 화소 0 차이. 캐릭터는 그 사이에 그려진다.
#   python3 layers.py <place> [--diag]
import sys, os, json, pickle
import numpy as np
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__))
TALL = 24          # 이 높이(px) 이상 물체만 위층 후보(풀포기·돌멩이는 땅에 남는다)
MATCH = 0.5        # 물체 불투명 화소 중 원본과 같은 비율 — 이 이상이면 원본에도 있는 물체

def load(place):
    st = pickle.load(open(os.path.join(HERE, 'state', place + '.pkl'), 'rb'))
    O = np.array(Image.open(os.path.join(HERE, 'orig', st['orig'])).convert('RGBA'))
    return st, O

def _orient_score(O, a, x, y, tol=150):
    H, W = O.shape[:2]; h, w = a.shape[:2]
    x0, y0 = max(0, x), max(0, y); x1, y1 = min(W, x + w), min(H, y + h)
    if x1 <= x0 or y1 <= y0: return 0.0, None
    sub = a[y0 - y:y1 - y, x0 - x:x1 - x]; m = sub[..., 3] >= 128
    if m.sum() == 0: return 0.0, None
    d = np.abs(O[y0:y1, x0:x1, :3].astype(int) - sub[..., :3].astype(int)).sum(2)
    return float((d[m] <= tol).mean()), (m, (x0, y0, x1, y1))

def object_masks(st, O):
    H, W = O.shape[:2]
    up = np.zeros((H, W), bool)        # 위층 화소
    present, absent = [], []
    for o in st['objs']:
        a = o['a']; x, y = o['x'], o['y']
        h, w = a.shape[:2]
        x0, y0 = max(0, x), max(0, y); x1, y1 = min(W, x + w), min(H, y + h)
        if x1 <= x0 or y1 <= y0: continue
        sub = a[y0 - y:y1 - y, x0 - x:x1 - x]
        if (sub[..., 3] >= 128).sum() == 0: continue
        if o['kind'] == 'top' and sub[..., 3][sub[..., 3] > 0].mean() < 200: continue   # 안개 같은 반투명 덧그림은 땅에 둔다
        # 스크립트를 다시 돌린 조각은 색이 조금 다르고(의존 복구) 좌우 뒤집기가 난수라 다를 수 있다 → 허용 오차 + 두 방향
        r1, k1 = _orient_score(O, a, x, y); r2, k2 = _orient_score(O, a[:, ::-1], x, y)
        r, k = (r1, k1) if r1 >= r2 else (r2, k2)
        (present if r >= MATCH else absent).append((o, r, (x0, y0, x1, y1)))
        if r >= MATCH and (h >= TALL or o['kind'] == 'top'):
            m, (bx0, by0, bx1, by1) = k
            up[by0:by1, bx0:bx1] |= m   # 물체 실루엣(원본 화소를 위층으로 올린다)
    return up, present, absent

def passability(st, walk):
    H, W = walk.shape
    lev, sc, link = st['lev'], set(map(tuple, st['stairs'])), set(map(tuple, st['link']))
    flags = np.zeros((H, W, 4), bool)  # up, down, left, right
    for y in range(H):
        for x in range(W):
            if not walk[y, x]: continue
            for k, (dx, dy) in enumerate(((0, -1), (0, 1), (-1, 0), (1, 0))):
                nx, ny = x + dx, y + dy
                if not (0 <= nx < W and 0 <= ny < H): flags[y, x, k] = True; continue   # 맵 가장자리(출구)는 열어 둔다
                if not walk[ny, nx]: continue
                a, b = (x, y) in sc, (nx, ny) in sc
                if lev[ny, nx] != lev[y, x] and not (a or b) and not ((x, y) in link and (nx, ny) in link): continue
                if (a or b) and dx != 0 and not (a and b): continue
                flags[y, x, k] = True
    return flags

def segment_ice(st, O):
    """빙하기 설원: 원본(웨이브 3)이 스크립트(웨이브 5 보정 뒤)와 물체 배치가 달라 물체 목록을 못 쓴다.
    땅만 렌더한 색 표(+ 물체 그림자 곱) 밖의 화소 = 물체. 연결 덩이마다 크기로 막힘·위층을 정한다. 지형(빙하·빙벽·물·다리)은 스크립트 것."""
    from scipy import ndimage as ndi
    H, W = st['H'], st['W']
    key = lambda a: (a[..., 0].astype(np.int64) << 16) | (a[..., 1].astype(np.int64) << 8) | a[..., 2].astype(np.int64)
    G = st['ground'].astype(int)
    pal = np.unique(np.concatenate([key(G).ravel(), key(np.floor(G * np.array([0.55, 0.55, 0.66])).astype(int)).ravel()]))
    obj = ~np.isin(key(O[..., :3].astype(int)), pal)
    lab, n = ndi.label(obj, structure=np.ones((3, 3)))
    walk = np.ones((H, W), bool)
    for (y, x) in st['extra']['gl']: walk[y, x] = False
    for (y, x) in st['extra']['face']: walk[y, x] = False
    for (x, y) in st['extra'].get('water', []): walk[y, x] = False
    up = np.zeros(obj.shape, bool)
    for i, sl in enumerate(ndi.find_objects(lab), 1):
        if sl is None: continue
        comp = ndi.binary_fill_holes(lab[sl] == i)
        h, w = comp.shape; cnt = int(comp.sum())
        y0, x0 = sl[0].start, sl[1].start
        if h < 12 or cnt < 60: continue                     # 풀포기·잔돌: 땅
        full = np.zeros(obj.shape, bool); full[sl] = comp
        cf = full.reshape(H, 16, W, 16).mean(axis=(1, 3))     # 칸마다 덮인 비율
        if h >= TALL: up |= full
        # 밑동: 덩이 화소 중 바로 아래가 덩이 밖인 화소(아랫변). 칸 아래 반에 6개 이상이면 그 칸은 막힘(숲 덩이 속 나무마다 밑동이 잡힌다)
        bot = full & ~np.vstack([full[1:], np.zeros((1, full.shape[1]), bool)])
        lowhalf = np.zeros((16, 16), bool); lowhalf[7:] = True
        bc = (bot.reshape(H, 16, W, 16) & lowhalf[None, :, None, :]).sum(axis=(1, 3))
        walk[bc >= 6] = False
        by = (y0 + h - 1 - 3) // 16                          # 덩이 맨 밑 칸 줄
        walk[by][cf[by] >= 0.12] = False
        if w > 48: walk[cf >= 0.55] = False                  # 넓은 숲 덩이: 거의 덮인 칸은 막는다
    for (x, y) in st['extra'].get('path', []): walk[y, x] = True   # 눈길(발자국 길)은 늘 걷는다 — 엄니 문 밑도
    for (x, y) in st['extra'].get('walk_ok', []): walk[y, x] = True
    return walk, up

def build(place, crop=None):
    st, O = load(place)
    walk = st['walk'].copy()
    if place == 'ice-age-field':
        walk, up = segment_ice(st, O); present, absent = [], []
    else:
        up, present, absent = object_masks(st, O)
    flags = passability(st, walk)
    return dict(st=st, O=O, walk=walk, up=up, flags=flags, present=present, absent=absent)

def reach(r, start):
    from collections import deque
    f = r['flags']; H, W = r['walk'].shape
    seen = {tuple(start)}; q = deque([tuple(start)])
    while q:
        x, y = q.popleft()
        for k, (dx, dy) in enumerate(((0, -1), (0, 1), (-1, 0), (1, 0))):
            nx, ny = x + dx, y + dy
            if f[y, x, k] and 0 <= nx < W and 0 <= ny < H and (nx, ny) not in seen:
                seen.add((nx, ny)); q.append((nx, ny))
    return seen

def diag(place):
    r = build(place)
    seen = reach(r, r['st']['entry'])
    miss = {k: v for k, v in r['st']['marks'].items() if tuple(v) not in seen and 0 <= v[1] < r['walk'].shape[0] and r['walk'][v[1], v[0]]}
    print(place, 'walk', int(r['walk'].sum()), 'reached', len(seen), 'walkable marks unreached', miss)
    O, walk, up = r['O'], r['walk'], r['up']
    H, W = walk.shape
    im = Image.fromarray(O).convert('RGB')
    ov = np.array(im).astype(float)
    bl = np.kron(~walk, np.ones((16, 16), bool))
    ov[bl] = ov[bl] * 0.6 + np.array([255, 0, 0]) * 0.4
    ov[up] = ov[up] * 0.5 + np.array([0, 160, 255]) * 0.5
    im2 = Image.fromarray(ov.astype(np.uint8)); d = ImageDraw.Draw(im2)
    for o, rr, (x0, y0, x1, y1) in r['absent']:
        if o['a'].shape[0] >= 12: d.rectangle((x0, y0, x1 - 1, y1 - 1), outline=(255, 0, 255))
    out = Image.new('RGB', (W * 16 * 2 + 8, H * 16)); out.paste(im, (0, 0)); out.paste(im2, (W * 16 + 8, 0))
    os.makedirs(os.path.join(HERE, 'diag'), exist_ok=True)
    out.save(os.path.join(HERE, 'diag', place + '.png'))
    print(place, 'present', len(r['present']), 'absent', len(r['absent']), 'upper px', int(up.sum()),
          'absent tall', sum(1 for o, _, _ in r['absent'] if o['a'].shape[0] >= TALL))

if __name__ == '__main__':
    diag(sys.argv[1])
