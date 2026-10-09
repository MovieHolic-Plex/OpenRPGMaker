# 선술집 지하·주방 — 땅 덩이 오토타일 셋(16변형, 칸 번호 = 위1 + 오른2 + 아래4 + 왼8, 왼쪽 위 칸이 0).
#  물 웅덩이(젖은 돌바닥에 고인 얕은 물) · 재(난로에서 쏟아진 잿가루와 숯) · 짚 덩이(창고 바닥에 깐 짚).
# 윤곽은 공용 깊이장 tiledata/beodeul-kits/autotile_edge.edge_fields(큰 혹 + 잔 혹, 칸 끝 얕게, 볼록 모서리 둥글게)를 읽기만 하고 쓴다.
# 속 무늬는 모두 주기 16 으로 감겨 속 칸끼리 이음새가 없다. 위층 투명 덧그림(밑 바닥이 비친다).
from tc_base import *
from tc_base import _hash
from autotile_edge import edge_fields

def sheet(cellfn):
    sh = new(64, 64)
    for n in range(16): sh.alpha_composite(cellfn(n), (n % 4 * 16, n // 4 * 16))
    return sh

def _img(o):
    return Image.fromarray(np.clip(np.rint(o), 0, 255).astype(np.uint8), 'RGBA')

# ---------------------------------------------------------------- 물 웅덩이
def puddle_cell(n, seed=1501):
    m, dN, dE, dS, dW = edge_fields(n, inset=3.0, jag=3.2, rad=7.0, seed=seed)
    o = np.zeros((16, 16, 4))
    for y in range(16):
        for x in range(16):
            v = m[y, x]
            if v < -1.4: continue
            if v < 0:                                                                       # 젖은 둘레(반투명, 감사 문턱 64 아래)
                if (x + y) % 2 == 0: o[y, x] = PUD[1] + (56,)
                continue
            if v < 1.0: o[y, x] = PUD[1] + (255,); continue                                 # 물가 어두운 테
            north = dN[y, x] < 2.6 and dN[y, x] <= m[y, x] + .01
            if north: o[y, x] = mix(PUD[1], PUD[2], .5) + (255,); continue                  # 북쪽 물가 그늘(턱 그림자)
            c = PUD[3] if v > 2.0 else PUD[2]
            if (x * 3 + y * 5) % 13 == 0 and v > 2: c = PUD[2]
            if v > 2.2 and y % 3 == 1 and hash2(x // 3, y, seed + 3) > .78: c = PUD[5]      # 가로로 긴 하늘빛 반사
            elif v > 2.2 and hash2(x, y, seed + 4) > .985: c = PUD[6]
            if v < 1.8 and dS[y, x] < 2.2 and dS[y, x] <= m[y, x] + .01: c = PUD[4]         # 남쪽 물가 밝은 테
            o[y, x] = c + (255,)
    return _img(o)

def hash2(x, y, s):
    return _hash(x % 16, y % 16, s)

# ---------------------------------------------------------------- 재
def ash_cell(n, seed=1531):
    m = edge_fields(n, inset=3.0, jag=3.4, rad=7.0, seed=seed)[0]
    o = np.zeros((16, 16, 4))
    for y in range(16):
        for x in range(16):
            v = m[y, x]
            if v < -1.8: continue
            if v < 0:                                                                       # 드문 재 점(반투명)
                if hash2(x, y, seed + 1) < .12 and v > -1.0: o[y, x] = ASHG[3] + (54,)
                continue
            if v < 1.0:                                                                     # 가장자리: 한 단 어두운 테(재 더미 그늘)
                o[y, x] = ASHG[2] + (255,)
                continue
            r = hash2(x, y, seed + 3)
            n2 = (hash2(x // 4, y // 4, seed + 5) + hash2((x + 2) // 4, (y + 2) // 4, seed + 6)) / 2
            c = ASHG[3] if n2 < .62 else mix(ASHG[2], ASHG[3], .5)
            if r < .05: c = ASHG[1]                                                         # 숯 부스러기
            elif r < .09: c = ASHG[2]
            elif r > .96: c = ASHG[4]
            elif .957 < r <= .96 and v > 4: c = FIRE[2]                                     # 아주 드문 불씨
            o[y, x] = c + (255,)
    return _img(o)

# ---------------------------------------------------------------- 짚
_SF = None
def _straw_field(seed=1561, k=30):
    """주기 16 짚 결: 짧은 짚 줄기(길이 3~6, 가로·사선) 화소 지도 (색, 줄기 번호). 칸 끝에서 감겨 이어진다."""
    rng = np.random.default_rng(seed)
    col = np.zeros((16, 16, 4)); pid = np.full((16, 16), -1)
    dirs = ((1, 0), (1, 1), (1, -1), (1, 2), (1, -2), (0, 2))                              # (가로 한 걸음, 세로 반 걸음)
    for i in range(k):
        x, y = int(rng.integers(0, 16)), int(rng.integers(0, 16))
        ax, ay = dirs[int(rng.integers(0, len(dirs)))]
        ln = int(rng.integers(3, 7)); tone = int(rng.integers(2, 5))
        for t in range(ln):
            px_ = (x + t * ax) % 16; py_ = (y + (t * ay) // 2) % 16
            col[py_, px_] = STRAW[clamp(tone + (1 if t == 0 else 0) - (1 if t == ln - 1 else 0), 1, 6)] + (255,); pid[py_, px_] = i
            sy = (py_ + 1) % 16
            if col[sy, px_, 3] == 0: col[sy, px_] = STRAW[1] + (255,); pid[sy, px_] = i
    return col, pid

def straw_cell(n, seed=1571):
    global _SF
    if _SF is None: _SF = _straw_field()
    col, pid = _SF
    m = edge_fields(n, inset=3.0, jag=3.2, rad=7.0, seed=seed)[0]
    o = np.zeros((16, 16, 4))
    for y in range(16):
        for x in range(16):
            v = m[y, x]
            if v < -1.2:
                continue
            has = col[y, x, 3] > 0
            if v < 0:                                                                       # 바깥으로 삐친 짚 몇 가닥
                if has and hash2(int(pid[y, x]), 3, seed + 1) < .25: o[y, x] = col[y, x]
                continue
            if v < 1.4:                                                                     # 성긴 가장자리
                if has and hash2(int(pid[y, x]), 4, seed + 2) < .8: o[y, x] = col[y, x]
                elif min(x, 15 - x, y, 15 - y) <= 1 and (x + y) % 2 == 0: o[y, x] = STRAW[1] + (255,)
                continue
            if has: o[y, x] = col[y, x]
            else: o[y, x] = (STRAW[1] if hash2(x, y, seed + 5) < .5 else STRAW[2]) + (255,)  # 깔린 짚 바탕
    return _img(o)

def sheets():
    return sheet(puddle_cell), sheet(ash_cell), sheet(straw_cell)

# ---------------------------------------------------------------- 시험 그림 (5x5 덩이·나선·코 L자·들쭉날쭉)
SHAPES = {
    'blob5': ['#####'] * 5,
    'spiral': ['#######', '#.....#', '#.###.#', '#.#.#.#', '#.#...#', '#.#####'],
    'Lnose': ['###....', '###....', '#######', '#######', '...##..', '...##..'],
    'ragged': ['.##..', '####.', '.####', '..###', '.##..'],
}
def compose(sheet_, rows, floor='tc_flag'):
    h, w = len(rows) + 2, max(len(r) for r in rows) + 2
    cells = {(x + 1, y + 1) for y, r in enumerate(rows) for x, ch in enumerate(r) if ch == '#'}
    o = Image.new('RGBA', (w * 16, h * 16))
    for y in range(h):
        for x in range(w): o.alpha_composite(dlib.floor_tile(floor, x, y), (x * 16, y * 16))
    for (x, y) in cells:
        mk_ = autotile_mask(cells, x, y)
        o.alpha_composite(atile_img(sheet_, mk_), (x * 16, y * 16))
    return o

def check_sheet(path, named):
    """[이름 | 16변형 시트 | 5x5 | 나선 | 코 L자 | 들쭉날쭉] 줄마다 한 오토타일, 2배."""
    rows = []
    for name, sh, floor in named:
        ims = [sh] + [compose(sh, SHAPES[k], floor) for k in ('blob5', 'spiral', 'Lnose', 'ragged')]
        rows.append((name, ims))
    W = max(sum(im.width for im in ims) + 16 * len(ims) for _, ims in rows) + 16
    H = sum(max(im.height for im in ims) + 28 for _, ims in rows) + 8
    o = Image.new('RGBA', (W, H), (24, 24, 30, 255)); d = ImageDraw.Draw(o); y = 8
    for name, ims in rows:
        d.text((8, y), name, fill=(220, 220, 228, 255)); y += 14; x = 8
        for im in ims: o.alpha_composite(im, (x, y)); x += im.width + 16
        y += max(im.height for im in ims) + 14
    o.resize((W * 2, H * 2), Image.NEAREST).save(path)
