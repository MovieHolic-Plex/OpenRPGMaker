"""8방 지면 오토타일(canon 47 + 몸통 변형 2 = 49칸) 공용 도우미 — jp_city `autotiles_ground` 블록 전용.

- 팔레트: tiledata/atlas-pick/palette/modern3.pal (램프 이름 + 단 번호 0.. 로 색을 부른다: C('hodo', 5)).
- 기준 시트: tiledata/jp-city/sources/jp_shopstreet16.png(+.catalog.json) → 없으면 ~/gv3-work/chipset/.
- 가장자리 그리기: 칸의 3x3 이웃 중 canon 마스크가 꺼진 칸이 「바깥」. 픽셀마다 바깥 칸까지의 체비셰프 거리 d 를 재고,
  띠 그리기 함수 style(side, d, s, x, y) 가 색을 정한다(None 이면 몸통 질감). 같은 변의 띠는 s(변을 따라가는 좌표)가
  16 주기라서 이웃 칸과 이어진다.
"""
import hashlib, json, os, re
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[4]
PAL_PATH = ROOT / "tiledata/atlas-pick/palette/modern3.pal"
DIRS = dict(N=1, E=2, S=4, W=8, NE=16, SE=32, SW=64, NW=128)
SIDE_NAMES = ["N", "E", "S", "W", "NE", "SE", "SW", "NW"]


def canon(m):
    n, e, s, w = m & 1, m & 2, m & 4, m & 8
    out = m & 15
    if n and e: out |= m & 16
    if s and e: out |= m & 32
    if s and w: out |= m & 64
    if n and w: out |= m & 128
    return out


CANON = sorted({canon(m) for m in range(256)})
assert len(CANON) == 47

# ───────────────────────── 팔레트 ─────────────────────────
def _load_pal():
    ramps = {}
    for line in open(PAL_PATH, encoding="utf-8"):
        m = re.match(r"@rampc (\S+)\s+(.*)", line)
        if m:
            ramps[m.group(1)] = [tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) for h in m.group(2).split()]
    return ramps


RAMPS = _load_pal()
PAL_SET = {c for r in RAMPS.values() for c in r}
FAMILY = {c: n for n, r in RAMPS.items() for c in r}


def C(name, i):
    r = RAMPS[name]
    return (*r[max(0, min(len(r) - 1, i))], 255)


def h01(x, y, s):
    """위치 해시(난수 아님: 같은 입력 → 같은 값). 0..1."""
    n = (x * 374761393 + y * 668265263 + s * 2246822519) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFFFF) / 0xFFFFFF


# ───────────────────────── 기준 시트 ─────────────────────────
_SHEET = None


def _find(rel_sources, fallback):
    p = ROOT / "tiledata/jp-city/sources" / rel_sources
    return p if p.exists() else Path(os.path.expanduser(fallback))


def sheet():
    global _SHEET
    if _SHEET is None:
        png = _find("jp_shopstreet16.png", "~/gv3-work/chipset/jp_shopstreet16.png")
        cat = _find("jp_shopstreet16.catalog.json", "~/gv3-work/chipset/jp_shopstreet16.catalog.json")
        catalog = json.load(open(cat, encoding="utf-8"))
        _SHEET = (np.array(Image.open(png).convert("RGBA")), catalog)
    return _SHEET


def chip(name):
    """카탈로그 street 이름(예: 'sw', 'road_c') → 16x16x4 uint8 사본."""
    arr, cat = sheet()
    n = cat["names"][cat["street"][name]]
    cols = cat["sheet"]["cols"]
    x, y = (n % cols) * 16, (n // cols) * 16
    return arr[y:y + 16, x:x + 16].copy()


def px(a, x, y):
    return tuple(int(v) for v in a[y % 16, x % 16])


# ───────────────────────── 가장자리 칠하기 ─────────────────────────
def outside_set(m):
    m = canon(m)
    return {n for n in SIDE_NAMES if not (m & DIRS[n])}


def paint_cell(m, tex, style, rank=None, order=("N", "W", "E", "S"), notch=None):
    """canon 마스크 m 의 칸. tex[y][x] = 몸통 질감(16x16x4). style(side,d,s,x,y)→색|None (변 띠).
    notch(nb,x,y)→색|None: 안쪽 모서리(바깥이 대각 한 칸뿐, nb='NE'…) 조각. 없으면 style 로 둘레 띠를 만든다.
    rank(side, diag)→정수(작을수록 먼저, 가까운 바깥이 같을 때). 가장 가까운 바깥 칸이 그 화소를 정한다."""
    out = outside_set(m)
    sides = {n for n in out if len(n) == 1}
    a = tex.copy()
    rank = rank or (lambda side, diag: 0)
    for y in range(16):
        for x in range(16):
            cands = []
            for nb in out:
                if len(nb) == 1:
                    d = {"N": y, "S": 15 - y, "W": x, "E": 15 - x}[nb]
                    cands.append((d, rank(nb, 0), 0, order.index(nb), nb, nb))
                else:
                    vs, hs = nb[0], nb[1]
                    if vs in sides or hs in sides:
                        continue  # 변이 이미 바깥이면 대각은 중복
                    gx = 15 - x if hs == "E" else x
                    gy = 15 - y if vs == "S" else y
                    d = max(gx, gy)
                    if gx > gy: eff = hs
                    elif gy > gx: eff = vs
                    else: eff = min((vs, hs), key=lambda q: (rank(q, 1), order.index(q)))
                    cands.append((d, rank(eff, 1), 1, order.index(eff), eff, nb))
            if not cands: continue
            cands.sort(key=lambda c: c[:4])
            d, _, diag, _, eff, nb = cands[0]
            if diag and notch: c = notch(nb, x, y)
            else: c = style(eff, d, x if eff in "NS" else y, x, y)
            if c is not None:
                a[y, x] = c
    return a


def build_set(tex, style, variants, rank=None, notch=None):
    """[(key, arr)] key = canon 마스크(int) 47개 + 'b1','b2'. variants = (b1, b2) 16x16x4 배열."""
    out = [(m, paint_cell(m, tex, style, rank, notch=notch)) for m in CANON]
    out.append(("b1", variants[0]))
    out.append(("b2", variants[1]))
    return out


def variant_map(local_of):
    """local_of(canon_mask)→local 키. 256키 전부."""
    return {str(m): local_of(canon(m)) for m in range(256)}


# ───────────────────────── 검사 ─────────────────────────
def img_colors(a):
    flat = a.reshape(-1, 4)
    return {tuple(int(v) for v in p) for p in flat}


def check_image(a):
    """(a) 16x16 RGBA, 알파 0/255, 색 ⊂ modern3, 마커색 없음 → 오류 문자열 목록"""
    errs = []
    if a.shape != (16, 16, 4): errs.append(f"shape {a.shape}")
    for p in img_colors(a):
        if p[3] not in (0, 255): errs.append(f"alpha {p}")
        elif p[3] == 255 and p[:3] not in PAL_SET: errs.append("color outside modern3 #%02x%02x%02x" % p[:3])
        if p[:3] == (0xe0, 0x40, 0xc0): errs.append("marker color")
    return sorted(set(errs))


def seam_ratio(a):
    """3x3 반복했을 때 이음선(타일 경계)의 이웃 화소 차 / 타일 안쪽 이웃 화소 차."""
    t = np.tile(a[..., :3].astype(int), (3, 3, 1))
    def diff(p, q): return np.abs(p - q).sum(-1).mean()
    inner_h = np.mean([diff(t[:, x], t[:, x + 1]) for x in range(16, 31) if x % 16 != 15])
    seam_h = np.mean([diff(t[:, x], t[:, x + 1]) for x in (15, 31)])
    inner_v = np.mean([diff(t[y], t[y + 1]) for y in range(16, 31) if y % 16 != 15])
    seam_v = np.mean([diff(t[y], t[y + 1]) for y in (15, 31)])
    return (seam_h + seam_v) / max(1e-6, inner_h + inner_v)


def border_identical(a, base):
    """a 의 둘레 1줄(위·아래·좌·우)이 몸통(base)과 같은가 — 변형을 섞어 깔아도 이어진다는 보장."""
    return all(np.array_equal(a[i], base[i]) for i in (0, 15)) and all(np.array_equal(a[:, i], base[:, i]) for i in (0, 15))


# ───────────────────────── 마스크 맵 (눈 확인) ─────────────────────────
def blob_map(seed, w=32, h=32):
    """시드 고정 지형 모양: 큰 덩이·구멍·좁은 줄·곶. 가장자리 1칸은 비운다. bool[h][w]"""
    import random
    rnd = random.Random(seed)
    g = np.zeros((h, w), bool)
    for _ in range(3):  # 덩이
        cx, cy = rnd.randint(7, w - 8), rnd.randint(7, h - 8)
        rw, rh = rnd.randint(4, 9), rnd.randint(3, 8)
        for y in range(h):
            for x in range(w):
                if ((x - cx) / rw) ** 2 + ((y - cy) / rh) ** 2 <= 1: g[y, x] = True
    for _ in range(3):  # 좁은 줄(1~2칸 폭)
        x0, y0 = rnd.randint(2, w - 3), rnd.randint(2, h - 3)
        ln, horiz, wd = rnd.randint(6, 14), rnd.random() < .5, rnd.choice([1, 1, 2])
        for i in range(ln):
            for k in range(wd):
                x, y = (x0 + i, y0 + k) if horiz else (x0 + k, y0 + i)
                if 1 <= x < w - 1 and 1 <= y < h - 1: g[y, x] = True
    for _ in range(3):  # 곶(막다른 길)
        x0, y0 = rnd.randint(3, w - 4), rnd.randint(3, h - 4)
        dx, dy = rnd.choice([(1, 0), (-1, 0), (0, 1), (0, -1)])
        for i in range(rnd.randint(3, 6)):
            x, y = x0 + dx * i, y0 + dy * i
            if 1 <= x < w - 1 and 1 <= y < h - 1: g[y, x] = True
    for _ in range(4):  # 구멍
        cx, cy = rnd.randint(4, w - 5), rnd.randint(4, h - 5)
        for (ox, oy) in rnd.choice([[(0, 0)], [(0, 0), (1, 0)], [(0, 0), (1, 0), (0, 1), (1, 1)], [(0, 0), (1, 0), (2, 0)]]):
            if g[cy + oy, cx + ox] and sum(g[cy + oy - 1:cy + oy + 2, cx + ox - 1:cx + ox + 2].ravel()) >= 6: g[cy + oy, cx + ox] = False
    g[0, :] = g[-1, :] = False; g[:, 0] = g[:, -1] = False
    return g


def gallery_map():
    """canon 47종을 하나씩 가운데 칸으로 갖는 5x5 조각을 8x6 격자로 늘어놓은 맵(40x30칸, 조각 사이 1칸 이상 비움). bool[30][40]"""
    g = np.zeros((30, 40), bool)
    dirs = dict(N=(0, -1), E=(1, 0), S=(0, 1), W=(-1, 0), NE=(1, -1), SE=(1, 1), SW=(-1, 1), NW=(-1, -1))
    for i, m in enumerate(CANON):
        ox, oy = (i % 8) * 5 + 1, (i // 8) * 5 + 1
        g[oy + 1, ox + 1] = True
        for n, (dx, dy) in dirs.items():
            if m & DIRS[n]: g[oy + 1 + dy, ox + 1 + dx] = True
    return g


def mask_at(g, x, y):
    h, w = g.shape
    def on(dx, dy):
        xx, yy = x + dx, y + dy
        return 0 <= xx < w and 0 <= yy < h and bool(g[yy, xx])
    m = 0
    for name, (dx, dy) in dict(N=(0, -1), E=(1, 0), S=(0, 1), W=(-1, 0), NE=(1, -1), SE=(1, 1), SW=(-1, 1), NW=(-1, -1)).items():
        if on(dx, dy): m |= DIRS[name]
    return m


def depth_at(g, x, y):
    """엔진 shadeAutotileInterior 와 같은 규칙: 체비셰프 2 안에 비멤버가 있으면 얕음(1), 아니면 2. 가장자리(0)는 별도."""
    h, w = g.shape
    depth = 2
    for dy in range(-2, 3):
        for dx in range(-2, 3):
            xx, yy = x + dx, y + dy
            if 0 <= xx < w and 0 <= yy < h and g[yy, xx]: continue
            depth = min(depth, max(abs(dx), abs(dy)) - 1)
    return depth


def cell_hash(x, y):
    n = (x * 374761393) ^ (y * 668265263) ^ 0x2f6b1d
    n &= 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return (n ^ (n >> 16)) & 0xFFFFFFFF


def render_map(g, tiles_by_mask, interior, outside_tex, w=32, h=32):
    """tiles_by_mask: {canon:int → 16x16x4}, interior: [[arr,...],[arr,...]] | None, outside_tex: 16x16x4 반복."""
    img = np.zeros((h * 16, w * 16, 4), np.uint8)
    for y in range(h):
        for x in range(w):
            if g[y, x]:
                m = canon(mask_at(g, x, y))
                t = tiles_by_mask[m]
                if m == 255 and interior:
                    d = depth_at(g, x, y)
                    if d >= 1:
                        tier = interior[min(d - 1, len(interior) - 1)]
                        t = tier[cell_hash(x, y) % len(tier)]
                img[y * 16:y * 16 + 16, x * 16:x * 16 + 16] = t
            else:
                img[y * 16:y * 16 + 16, x * 16:x * 16 + 16] = outside_tex
    return img


def seam_mismatches(g, tiles_by_mask, interior, limit=12, tol=2):
    """이웃한 두 멤버 칸이 맞닿는 선(한 변 16화소)에서 화소 계열(램프)이 다른 화소 수를 센다.
    가장자리 선이 1화소 계단지는 것은 정상이므로 한 선에서 tol(2) 초과로 어긋날 때만 「불량 선」.
    (총 선 수, 불량 선 수, 예시)"""
    h, w = g.shape
    def tile_of(x, y):
        m = canon(mask_at(g, x, y)); t = tiles_by_mask[m]
        if m == 255 and interior:
            d = depth_at(g, x, y)
            if d >= 1:
                tier = interior[min(d - 1, len(interior) - 1)]; t = tier[cell_hash(x, y) % len(tier)]
        return t, m
    tot = bad = 0; ex = []
    fam = lambda p: FAMILY.get(tuple(int(v) for v in p[:3]))
    for y in range(h):
        for x in range(w):
            if not g[y, x]: continue
            ta, ma = tile_of(x, y)
            for (dx, dy) in ((1, 0), (0, 1)):
                xx, yy = x + dx, y + dy
                if xx >= w or yy >= h or not g[yy, xx]: continue
                tb, mb = tile_of(xx, yy)
                diff = 0
                for k in range(16):
                    pa = ta[k, 15] if dx else ta[15, k]
                    pb = tb[k, 0] if dx else tb[0, k]
                    if fam(pa) != fam(pb): diff += 1
                tot += 1
                if diff > tol:
                    bad += 1
                    if len(ex) < limit: ex.append((x, y, "E" if dx else "S", diff, ma, mb))
    return tot, bad, ex


def save_png(a, path, scale=1):
    im = Image.fromarray(a, "RGBA")
    if scale != 1: im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    im.save(path)


def describe_mask(m):
    """canon 마스크 → 한국어 설명(어느 쪽이 열려 있나)."""
    kr = dict(N="북", E="동", S="남", W="서")
    out = outside_set(m)
    sides = [kr[n] for n in "NESW" if n in out]
    diags = [n for n in ("NE", "SE", "SW", "NW") if n in out and n[0] not in out and n[1] not in out]
    dk = dict(NE="북동", SE="남동", SW="남서", NW="북서")
    if m == 255: return "몸통"
    if sides:
        n = len(sides)
        tag = {1: "변", 2: "모서리" if (set(sides) in ({"북", "동"}, {"동", "남"}, {"남", "서"}, {"서", "북"})) else "좁은 줄", 3: "곶", 4: "외딴 한 칸"}[n]
        return f"{'·'.join(sides)} 열림 {tag}" + (f" +안쪽 모서리 {'·'.join(dk[d] for d in diags)}" if diags else "")
    return "안쪽 모서리 " + "·".join(dk[d] for d in diags)
