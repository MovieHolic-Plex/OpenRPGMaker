"""선형 오토타일(autotiles_lines) 공용 도우미 — 팔레트(modern3) · 16x16 캔버스 · 마스크 · 역할 지도(슬래브) · 렌더·검사.
규칙: 반투명 없음(알파 0/255), 난수 없음(전부 좌표 함수), 색은 modern3.pal 의 단만 쓴다."""
import os, sys, json
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'content', 'atlas-pick'))
from modern3_check import load_pal            # noqa: E402

RAMPS = load_pal()
N_, E_, S_, W_ = 1, 2, 4, 8                    # 오토타일 4방 비트 (autotileEngine.ts)

def K(name, t):
    """램프 name 의 단 t (7단 -3..3, 5단 -2..2, 3단 -1..1). 범위 밖이면 끝 단."""
    r = RAMPS[name]; mid = len(r) // 2
    return r[max(0, min(len(r) - 1, mid + t))]

def rgb(h): return ((h >> 16) & 255, (h >> 8) & 255, h & 255)

class Px:
    """16x16 RGBA 캔버스. P(x,y,c) c=None 이면 무시, 범위 밖 무시."""
    def __init__(s, w=16, h=16):
        s.w, s.h = w, h; s.a = np.zeros((h, w, 4), np.uint8)
    def P(s, x, y, c):
        if c is not None and 0 <= x < s.w and 0 <= y < s.h: s.a[y, x] = (*rgb(c), 255)
    def R(s, x0, y0, x1, y1, c):                # 양끝 포함
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): s.P(x, y, c)
    def clear(s, x, y):
        if 0 <= x < s.w and 0 <= y < s.h: s.a[y, x] = 0
    def get(s, x, y):
        if 0 <= x < s.w and 0 <= y < s.h and s.a[y, x, 3]: return (int(s.a[y, x, 0]) << 16) | (int(s.a[y, x, 1]) << 8) | int(s.a[y, x, 2])
        return None
    def img(s): return Image.fromarray(s.a.copy(), 'RGBA')

# ───────────────── 기준 시트(읽기 전용) ─────────────────
_SHEET = {}
def _sheet():
    if not _SHEET:
        cands = [os.path.join(ROOT, 'tiledata/jp-city/sources'), os.path.expanduser('~/gv3-work/chipset')]
        for d in cands:
            p = os.path.join(d, 'jp_shopstreet16.png'); q = os.path.join(d, 'jp_shopstreet16.catalog.json')
            if os.path.exists(p) and os.path.exists(q):
                _SHEET['im'] = Image.open(p).convert('RGBA'); _SHEET['names'] = json.load(open(q, encoding='utf-8'))['names']; _SHEET['src'] = d; break
        else: raise FileNotFoundError('jp_shopstreet16.png 기준 시트가 없다')
    return _SHEET

def ref_cell(name):
    """기준 시트의 칸 이름(예 'st.road_c') → 16x16 RGBA 이미지."""
    s = _sheet(); i = s['names'][name]; x = (i % 16) * 16; y = (i // 16) * 16
    return s['im'].crop((x, y, x + 16, y + 16)).copy()

# ───────────────── 마스크 ─────────────────
DIRS = ((N_, 0, -1, 'N'), (E_, 1, 0, 'E'), (S_, 0, 1, 'S'), (W_, -1, 0, 'W'))
def has(m, b): return bool(m & b)
def arms(m): return ''.join(n for b, _, _, n in DIRS if m & b)
MASK_KO = {0: '외딴 칸', 1: '북 연결 끝', 2: '동 연결 끝', 4: '남 연결 끝', 8: '서 연결 끝', 3: '북동 모서리', 6: '동남 모서리', 12: '남서 모서리', 9: '북서 모서리',
           5: '세로 직선', 10: '가로 직선', 7: '북동남 T', 14: '동남서 T', 13: '남서북 T', 11: '서북동 T', 15: '십자'}

def mask_of(grid, x, y):
    m = 0
    for b, dx, dy, _ in DIRS:
        if (x + dx, y + dy) in grid: m |= b
    return m

def rot90(img, k=1):
    """시계 방향 k 번 90도 회전 (좌우 대칭 그림 전용 — 빛 방향이 있는 그림에는 쓰지 않는다)."""
    return Image.fromarray(np.rot90(np.array(img), -k).copy(), 'RGBA')

ROT_MASK = {N_: E_, E_: S_, S_: W_, W_: N_}
def rot_mask(m, k=1):
    for _ in range(k % 4):
        n = 0
        for b in (N_, E_, S_, W_):
            if m & b: n |= ROT_MASK[b]
        m = n
    return m

# ───────────────── 역할 지도 (슬래브 = 윗면/앞면 덩이) ─────────────────
PAD = 4
class Roles:
    """셀(0..15)을 PAD 만큼 넘겨 확장한 정수 지도. 0 없음, 1 윗면, 2 앞면, 3 기둥 윗면, 4 기둥 앞면.
    이웃 칸과 이어지는 방향은 PAD 까지 뻗어, 윤곽·명암이 칸 경계 너머를 보고 판정한다(이음새 없음)."""
    def __init__(s): s.a = np.zeros((16 + 2 * PAD, 16 + 2 * PAD), np.int8)
    def rect(s, x0, y0, x1, y1, v):
        for y in range(max(y0, -PAD), min(y1, 15 + PAD) + 1):
            for x in range(max(x0, -PAD), min(x1, 15 + PAD) + 1): s.a[y + PAD, x + PAD] = v
    def at(s, x, y):
        if -PAD <= x < 16 + PAD and -PAD <= y < 16 + PAD: return int(s.a[y + PAD, x + PAD])
        return 0
    def put(s, x, y, v):
        if -PAD <= x < 16 + PAD and -PAD <= y < 16 + PAD: s.a[y + PAD, x + PAD] = v

def shade_roles(roles, shader, cx0=0, cx1=15):
    p = Px()
    for y in range(16):
        for x in range(16):
            r = roles.at(x, y)
            if r: p.P(x, y, shader(roles, x, y, r))
    return p.img()

# ───────────────── 렌더 ─────────────────
def compose(cell_img, variant_map, grid, bg=None, size=None):
    """grid: {(x,y)} 집합(선이 지나가는 칸). bg: (x,y)->PIL 16x16 또는 PIL 한 장(전체 반복). 반환 PIL."""
    xs = [c[0] for c in grid]; ys = [c[1] for c in grid]
    W, H = size if size else (max(xs) + 2, max(ys) + 2)
    out = Image.new('RGBA', (W * 16, H * 16), (0, 0, 0, 255))
    for y in range(H):
        for x in range(W):
            b = bg(x, y) if callable(bg) else bg
            if b is not None: out.alpha_composite(b, (x * 16, y * 16))
    for (x, y) in sorted(grid, key=lambda c: (c[1], c[0])):
        m = mask_of(grid, x, y)
        out.alpha_composite(cell_img[variant_map[str(m)]], (x * 16, y * 16))
    return out

def test_grid(w=24, h=18):
    """시드 고정 경로 맵: 긴 직선 · ㄱ자 · 십자 · T · 닫힌 사각형 · 외딴 칸 · 막다른 끝 · 지그재그 · 2칸 두께(대각 접점)."""
    g = set()
    for x in range(1, 12): g.add((x, 1))                              # 긴 가로 직선
    for y in range(1, 8): g.add((11, y))                              # ㄱ자(모서리) + 세로 직선
    for x in range(14, 22): g.add((x, 2))                             # 십자: 가로
    for y in range(0, 7): g.add((17, y))                              # 십자: 세로
    for x in range(1, 8): g.add((x, 10))                              # T: 가로
    for y in range(10, 15): g.add((4, y))                             # T: 아래로
    for x in range(10, 17):                                           # 닫힌 사각형
        g.add((x, 10)); g.add((x, 15))
    for y in range(10, 16): g.add((10, y)); g.add((16, y))
    g.add((20, 12)); g.add((22, 16))                                  # 외딴 칸
    for x in range(1, 4): g.add((x, 16))                              # 막다른 끝(가로)
    g.add((6, 14)); g.add((7, 14)); g.add((7, 15)); g.add((8, 15)); g.add((8, 16)); g.add((9, 16))   # 지그재그
    for y in range(11, 15): g.add((20, y)) if y != 12 else None       # 세로 + 외딴 사이 끊김
    g.add((22, 9)); g.add((22, 8)); g.add((23, 8))
    return g

# ───────────────── 검사 ─────────────────
_OWN = {}
def _owner():
    if not _OWN:
        for n, r in RAMPS.items():
            for i, c in enumerate(r): _OWN.setdefault(c, (n, i))
    return _OWN

def check_cell(img):
    """(문제 목록) — 크기 16x16 RGBA, 알파 0/255, 색 ⊂ modern3, 마커색 없음."""
    bad = []
    if img.size != (16, 16) or img.mode != 'RGBA': bad.append('크기/모드 %s %s' % (img.size, img.mode)); return bad
    a = np.array(img); al = a[..., 3]
    if not np.all((al == 0) | (al == 255)): bad.append('반투명 화소 %d' % int(((al != 0) & (al != 255)).sum()))
    ow = _owner()
    for y in range(16):
        for x in range(16):
            if al[y, x] == 255:
                c = (int(a[y, x, 0]) << 16) | (int(a[y, x, 1]) << 8) | int(a[y, x, 2])
                if c not in ow: bad.append('팔레트 밖 #%06x @%d,%d' % (c, x, y)); break
                if c == 0xe040c0: bad.append('마커색')
    return bad

def edge_report(cells, vmap):
    """칸 경계 일관성: 이웃 쪽으로 이어지는 변(E→x=15열, W→x=0열, N→y=0행, S→y=15행)은 같은 축 직선 조각의 같은 변과 화소까지 같아야 한다
    (어떤 두 조각이 이어져도 직선 둘이 이어진 것과 같다 = 이음새 없음). 기준 직선이 없는 축은 건너뛴다.
    반환 [(마스크, 변, 어긋난 화소수)]."""
    A = lambda m: np.array(cells[vmap[str(m)]])
    ref = {'E': (A(10), (slice(None), 15)), 'W': (A(10), (slice(None), 0)), 'N': (A(5), (0, slice(None))), 'S': (A(5), (15, slice(None)))}
    out = []
    for m in range(16):
        P = A(m)
        for b, _, _, name in DIRS:
            if not m & b: continue
            R, idx = ref[name]
            if (m & 5 == 0 and name in 'NS') or (m & 10 == 0 and name in 'EW'): pass
            d = int((P[idx] != R[idx]).any(axis=-1).sum())
            if d: out.append((m, name, d))
    return out

def seam_rows(cells, vmap):
    """직선 H/V 조각을 3칸 이어 붙였을 때 맞닿는 열/행의 실루엣(알파) 차이 — 참고(무늬가 있으면 0 이 아닐 수 있다)."""
    A = lambda m: np.array(cells[vmap[str(m)]])
    h = int((A(10)[:, 15, 3] != A(10)[:, 0, 3]).sum()); v = int((A(5)[15, :, 3] != A(5)[0, :, 3]).sum())
    return h, v
