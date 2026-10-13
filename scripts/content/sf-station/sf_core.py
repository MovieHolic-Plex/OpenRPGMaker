"""sf_station 공용 그리개 — 팔레트 잠금(7단 램프) · Cv · 입체 도우미 · 조각 등록부 · 관문 내보내기/영수증 확인.

SF(우주 정거장 · 식민지 · 연구소 · 사이버 네온 거리) 16px 3/4 시점 칩셋 sf_station 의 모든 조각이 이 모듈 하나로 그린다.
규약(jp_city street_hand · gothic gx_core 와 같다): 빛은 왼쪽 위, 서 있는 조각은 «깊은 윗면 판(5행+, 밝은 결) + 뒤 모서리 어두운 윤곽 + 어두운 앞면»,
뭉툭하게(얇은 기둥은 관문이 정면 입면도로 떨어뜨린다). 반투명 화소·생성 이미지·사람·글자·상표 없음. 네온·화면은 램프 색 점/띠일 뿐이다(글자 금지).

    from sf_core import *
    @piece('hab-dome', '거주 돔', 4, 4, 'structure', group='outdoor', solid=[(0,3),(1,3),(2,3),(3,3)])
    def _(c): ...
관문 실측 교훈(2026-10-14, gemini-3.8-flash ×4 과반):
  · 큰 정면 벽·문·건물은 윗면이 직사각형이면 «정면 입면도» 로 떨어진다. 윗면을 사다리꼴로(뒤로 갈수록 양옆이 좁아짐) 그리는 tcube() 가 통과한다(airlock/pod-car).
  · 가구·상자·콘솔·랙·자판기는 cube(): 윗면 5행+, 앞면보다 3단 이상 밝게, 앞면 윗줄 밝은 턱. 윗면 위에 화면·매트·장비를 올리면 더 잘 읽힌다.
  · 둥근 몸통은 cyl(): 윗면 타원 + 아래 가장자리가 타원 호. 돔은 위선·경선을 호로(직선 금지).
  · 얇은 기둥·가는 틀은 떨어진다 → 굵은 받침 상자 + 윗면 있는 몸통으로 뭉툭하게. 윗면이 앞면과 같은 색이면 떨어진다.
산출: tiledata/sf-station/<group>/_gate/sf-<id>[.fN].png (투명, 관문 입력) + manifest.json. 관문은 `sf_all.py gate` 가 batch 를 만들어 부른다.
"""
from __future__ import annotations
import json, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'src', 'harnesses', '_core'))
OUT = os.path.join(ROOT, 'tiledata', 'sf-station')
T = 16


def _h(s): return [int(x, 16) for x in s.split()]

# ------------------------------------------------------------------ 팔레트 (잠금: 이름·순서는 추가만, 값은 바꾸지 않는다)
# 7단(-3…+3, 어두움→밝음). 줄 A(정거장): 청회색 선체 · 흰 세라믹 · 주황 경고 · 시안 계기. 줄 B(네온 거리): 남색 아스팔트 · 마젠타/시안 네온. 달: 회색 레골리스.
RAMPS = {
 'hull':   _h('1c2230 2a3345 3b475e 4f5f7a 667896 8396b2 a3b4cb'),   # 청회색 선체
 'white':  _h('3c4452 59626f 7c8693 a0a9b4 c3cad2 dde2e7 f0f3f5'),   # 흰 세라믹 패널
 'deck':   _h('14181f 1c222c 262d3a 303948 3c4757 495668 586679'),   # 어두운 갑판 바닥
 'navy':   _h('0c1020 131a30 1b2542 253256 31416c 405484 51689d'),   # 밤 아스팔트·남색 구조
 'orange': _h('3a1808 5e2a0c 8a3f12 b85a1c d9792a f09a40 ffc26a'),   # 경고 주황
 'yellow': _h('3a3008 5e4e0c 8a7414 b89a1e d9bc2c f0d84a ffee86'),   # 위험 띠 노랑
 'cyan':   _h('08303a 0c4a5a 12687e 1c8aa4 2cb0cc 5cd0e4 a0ecf6'),   # 계기판·홀로 시안
 'magenta': _h('3a0c34 5e1252 861a76 b0289c d63cbe f06ad8 ff9eea'),  # 네온 마젠타
 'violet': _h('1c1040 2c1a66 40288c 5a3cb4 785ad6 9c84f0 c4b2ff'),   # 네온 보라
 'green':  _h('0c2a14 144a22 1e6c32 2c9044 44b45c 6ed07c a4eca8'),   # 터미널 녹색
 'plant':  _h('0e2418 163826 1f5034 2a6a44 388a58 52a870 80c894'),   # 수경 재배 잎
 'glass':  _h('0a1020 111c34 1a2c4c 264268 365c88 4c7aa8 6e9ccc'),   # 어두운 푸른 유리
 'conc':   _h('1a1a22 26262f 34343f 44444f 565662 6a6a78 80808f'),   # 거리 콘크리트
 'rust':   _h('2a1208 441e0c 66301a 8a4626 b0603a d07e52 ec9e72'),   # 녹·구리 배관
 'regolith': _h('24242a 34343a 46464e 5a5a64 70707c 888894 a2a2ae'), # 달 레골리스
 'cable':  _h('08080c 101016 181820 20202a 2a2a36 363644 444454'),   # 케이블·검은 장비
 'glow':   _h('a8e8ff cef6ff ffffff'),                                # 발광 흰(램프 중심)
 'star':   _h('04050c 080a18 0e1228 2a3050 6a7aa0 a0b0d0 ffffff'),   # 우주 공허 + 별점
 'shadow': _h('06070e 0c0e1a 141828'),                                # 윤곽·접지 그림자
}
OL = RAMPS['shadow'][0]
ALLOWED = {c for r in RAMPS.values() for c in r}


def K(name, t=0):
    r = RAMPS[name]; mid = len(r) // 2
    return r[max(0, min(len(r) - 1, mid + t))]


def rgb(h): return ((h >> 16) & 255, (h >> 8) & 255, h & 255)


def hsh(x, y, s=0):
    n = (x * 374761393 + y * 668265263 + s * 2147483647) & 0xffffffff
    n = ((n ^ (n >> 13)) * 1274126177) & 0xffffffff
    return (n ^ (n >> 16)) & 0xffff


class Cv:
    def __init__(s, w, h): s.w, s.h = w, h; s.a = np.zeros((h, w, 4), np.uint8)
    def P(s, x, y, c):
        if 0 <= x < s.w and 0 <= y < s.h and c is not None: s.a[y, x] = (*rgb(c), 255)
    def R(s, x, y, w, h, c):
        x0, y0, x1, y1 = max(x, 0), max(y, 0), min(x + w, s.w), min(y + h, s.h)
        if x1 > x0 and y1 > y0 and c is not None: s.a[y0:y1, x0:x1] = (*rgb(c), 255)
    def HL(s, x, y, w, c): s.R(x, y, w, 1, c)
    def VL(s, x, y, h, c): s.R(x, y, 1, h, c)
    def has(s, x, y): return 0 <= x < s.w and 0 <= y < s.h and s.a[y, x, 3] == 255
    def clear(s, x, y, w=1, h=1):
        x0, y0, x1, y1 = max(x, 0), max(y, 0), min(x + w, s.w), min(y + h, s.h)
        if x1 > x0 and y1 > y0: s.a[y0:y1, x0:x1] = 0
    def line(s, x0, y0, x1, y1, c):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(n + 1): s.P(round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n), c)
    def ell(s, cx, cy, rx, ry, c, only=None):
        for y in range(cy - ry, cy + ry + 1):
            for x in range(cx - rx, cx + rx + 1):
                if ((x - cx) / (rx + .5)) ** 2 + ((y - cy) / (ry + .5)) ** 2 <= 1 and (only is None or only(x, y)): s.P(x, y, c)
    def outline(s, col=None):
        """불투명 덩이 바깥 4방향 이웃 투명 화소에 윤곽(OL) — 캔버스 가장자리 밖은 건드리지 않는다."""
        col = OL if col is None else col; m = s.a[..., 3] == 255; out = []
        for y in range(s.h):
            for x in range(s.w):
                if not m[y, x]:
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        xx, yy = x + dx, y + dy
                        if 0 <= xx < s.w and 0 <= yy < s.h and m[yy, xx]: out.append((x, y)); break
        for x, y in out: s.P(x, y, col)
    def image(s): return Image.fromarray(s.a, 'RGBA')


# ------------------------------------------------------------------ 입체 도우미
def cube(c, x, y, w, top, front, mat, tt=3, ft=-1, lip=True, sides=True, ol=True, tex=None, topmat=None):
    """윗면 top 행 + 앞면 front 행 상자. 윗면은 앞면보다 확실히 밝게(tt-ft ≥ 3 단), 뒤 모서리 어둡게, 앞면 윗줄에 밝은 턱(lip)으로 윗면/앞면을 가른다.
    tex='panel'|'grate'|'plate' 이면 윗면에 결을 넣는다. topmat 으로 윗면 재질만 바꿀 수 있다."""
    tm = topmat or mat
    c.R(x, y, w, top, K(tm, tt)); c.HL(x, y, w, K(tm, tt - 3)); c.HL(x, y + 1, w, K(tm, tt - 1)) if top > 3 else None
    c.HL(x, y + top - 1, w, K(tm, tt + 1))
    c.VL(x, y + 1, top - 1, K(tm, tt + 1)); c.VL(x + w - 1, y + 1, top - 1, K(tm, tt - 1))
    if tex: top_tex(c, x, y + 2, w, max(1, top - 3), tm, tex, tt)
    c.R(x, y + top, w, front, K(mat, ft)); c.VL(x, y + top, front, K(mat, ft + 1)); c.VL(x + w - 1, y + top, front, K(mat, ft - 1))
    c.HL(x, y + top + front - 1, w, K(mat, ft - 2))
    if lip: c.HL(x, y + top, w, K(mat, ft + 3))
    if not ol: return
    e = 1 if sides else 0
    c.HL(x - e, y - 1, w + 2 * e, OL); c.HL(x - e, y + top + front, w + 2 * e, OL)
    if sides: c.VL(x - 1, y - 1, top + front + 2, OL); c.VL(x + w, y - 1, top + front + 2, OL)


def top_tex(c, x, y, w, h, mat, kind='panel', tt=2):
    """윗면 결: panel = 4칸 이음선 + 리벳, grate = 가로 격자, plate = 점선 판."""
    if kind == 'panel':
        for i in range(4, w - 1, 6): c.VL(x + i, y, h, K(mat, tt - 1))
        for i in range(2, w - 1, 6): c.P(x + i, y, K(mat, tt + 2))
    elif kind == 'grate':
        for j in range(0, h, 2): c.HL(x + 1, y + j, w - 2, K(mat, tt + 1) if j % 4 == 0 else K(mat, tt - 1))
    elif kind == 'plate':
        for i in range(1, w - 1, 2): c.P(x + i, y + h // 2, K(mat, tt + 2))


def face_tex(c, x, y, w, h, mat, ft=0, seam=8, rivets=True, s=0):
    """앞면 판넬 결: seam 칸마다 세로 이음 + 위 줄 리벳."""
    for i in range(seam, w - 1, seam): c.VL(x + i, y, h, K(mat, ft - 1)); c.VL(x + i + 1, y, h, K(mat, ft + 1)) if i + 1 < w - 1 else None
    if rivets:
        for i in range(2, w - 1, seam): c.P(x + i, y + 1, K(mat, ft + 2))


def led(c, x, y, col='cyan', t=3):
    c.P(x, y, K(col, t)); c.P(x, y - 1, K(col, t - 2)) if False else None


def screen(c, x, y, w, h, col='cyan', s=0, kind='graph'):
    """계기 화면: 어두운 바탕 + 램프색 막대/점(글자 없음)."""
    c.R(x, y, w, h, K('cable', -1)); c.HL(x, y, w, K('cable', 2)); c.VL(x, y, h, K('cable', 1))
    if kind == 'graph':
        for i in range(1, w - 1):
            v = 1 + hsh(i, s, 3) % max(1, h - 2)
            c.VL(x + i, y + h - 1 - v, v, K(col, 1 + (i % 2)))
    elif kind == 'lines':
        for j in range(1, h - 1, 2): c.HL(x + 1, y + j, max(1, w - 2 - (hsh(j, s, 5) % 3)), K(col, 2))
    elif kind == 'radar':
        c.ell(x + w // 2, y + h // 2, max(1, w // 2 - 1), max(1, h // 2 - 1), K(col, -1)); c.P(x + w // 2, y + h // 2, K(col, 3)); c.P(x + w // 2 + 1, y + h // 2 - 1, K(col, 2))
    elif kind == 'solid':
        c.R(x + 1, y + 1, w - 2, h - 2, K(col, 1)); c.HL(x + 1, y + 1, w - 2, K(col, 3))
    elif kind == 'warn':
        c.R(x + 1, y + 1, w - 2, h - 2, K('orange', 0)); c.HL(x + 1, y + 1, w - 2, K('orange', 3))


def hazard(c, x, y, w, h, a='yellow', b='cable', diag=4):
    for j in range(h):
        for i in range(w):
            c.P(x + i, y + j, K(a, 1) if ((i + j) // (diag // 2)) % 2 == 0 else K(b, 0))


def rivet_row(c, x, y, w, mat, step=4, t=2):
    for i in range(1, w - 1, step): c.P(x + i, y, K(mat, t))


def cyl(c, cx, ytop, rx, ry, bh, mat, tt=3, ft=-1, ol=True, bands=0, rim=True):
    """둥근 몸통: 위 타원 윗면(ry 행) + 앞 원통면(아래 가장자리가 타원 호). 왼쪽 빛, 윗면이 앞면보다 밝다."""
    # 앞 원통면: 열마다 ytop … ytop + bh + dy(x)
    for x in range(cx - rx, cx + rx + 1):
        u = (x - cx) / (rx + .5)
        if abs(u) > 1: continue
        dy = int(round(ry * (1 - u * u) ** .5))
        t = ft + (1 if u < -0.45 else -1 if u > 0.45 else 0) + (1 if abs(u) < 0.12 else 0)
        for y in range(ytop, ytop + bh + dy + 1):
            c.P(x, y, K(mat, t))
        c.P(x, ytop + bh + dy, K(mat, ft - 2))
    for k in range(bands):
        for x in range(cx - rx, cx + rx + 1):
            u = (x - cx) / (rx + .5)
            if abs(u) > 1: continue
            dy = int(round(ry * (1 - u * u) ** .5)); yy = ytop + (bh * (k + 1)) // (bands + 1) + dy
            c.P(x, yy, K(mat, ft - 2))
    # 윗면 타원(앞면 위에 덮는다)
    for y in range(ytop - ry, ytop + ry + 1):
        for x in range(cx - rx, cx + rx + 1):
            d = ((x - cx) / (rx + .5)) ** 2 + ((y - ytop) / (ry + .5)) ** 2
            if d <= 1:
                t = tt + (1 if (x - cx) < -rx // 2 and y < ytop else 0) - (2 if d > .78 and y < ytop - ry // 2 else 0)
                c.P(x, y, K(mat, t))
    if rim:
        for x in range(cx - rx, cx + rx + 1):
            u = (x - cx) / (rx + .5)
            if abs(u) > 1: continue
            dy = int(round(ry * (1 - u * u) ** .5)); c.P(x, ytop + dy, K(mat, ft + 3)); c.P(x, ytop - dy, K(mat, tt - 3))
    if ol: c.outline()


def dome(c, cx, cy, rx, ry, mat='glass', ribs=3, s=0):
    """유리 돔 윗면: 타원 + 곡선 리브(경선은 위로 휘고 위선은 호) + 반사점. 위선·경선 모두 직선으로 긋지 않는다(직선은 정면 입면도로 읽힌다)."""
    for y in range(cy - ry, cy + ry + 1):
        for x in range(cx - rx, cx + rx + 1):
            d = ((x - cx) / (rx + .5)) ** 2 + ((y - cy) / (ry + .5)) ** 2
            if d <= 1:
                t = 1 + (1 if (x - cx) * 0.6 + (y - cy) < -rx // 3 else 0) - (1 if d > .8 else 0) + (1 if d < .3 else 0)
                c.P(x, y, K(mat, t))
    for k in range(1, ribs + 1):                       # 위선: 같은 중심의 작은 타원 호
        f = k / (ribs + 1)
        for x in range(cx - int(rx * f), cx + int(rx * f) + 1):
            u = (x - cx) / (rx * f + .5)
            if abs(u) > 1: continue
            dy = int(round(ry * f * (1 - u * u) ** .5)); c.P(x, cy + dy, K('hull', 1)); c.P(x, cy - dy, K('hull', 0))
    for k in range(-ribs // 2 + (0 if ribs % 2 else 1), ribs // 2 + 1):   # 경선: 위 끝에서 모여 아래로 퍼지는 호
        for t in range(-ry, ry + 1):
            u = t / (ry + .5); w = rx * (1 - u * u) ** .5
            x = int(round(cx + w * (k / (ribs / 2 + 1)))); y = cy + t
            if c.has(x, y): c.P(x, y, K('hull', 1))
    for k in range(3): c.P(cx - rx // 2 + k, cy - ry // 2 + (k % 2), K('glow', 0))


def plinth(c, x, y, w, h=3, mat='hull'):
    c.R(x, y, w, h, K(mat, -1)); c.HL(x, y, w, K(mat, 2)); c.HL(x, y + h - 1, w, K(mat, -3))


def door_panel(c, x, y, w, h, mat='hull', lamp='cyan', open_=0):
    """에어록/격벽 문 정면: 두 장 미닫이(가운데 틈) + 창 + 위 램프 + 아래 위험 띠."""
    c.R(x - 2, y - 2, w + 4, h + 2, K('hull', -1)); c.HL(x - 2, y - 2, w + 4, K('hull', 2))
    c.R(x, y, w, h, K('hull', 1))
    hw = w // 2
    c.R(x + 1, y + 1, hw - 1, h - 2, K('white', -1)); c.R(x + hw + 1, y + 1, hw - 1, h - 2, K('white', -2))
    c.VL(x + hw, y, h, K('cable', -1)); c.VL(x + hw - 1, y + 1, h - 2, K('hull', -2))
    c.R(x + 2, y + 3, hw - 3, 4, K('glass', 0)); c.HL(x + 2, y + 3, hw - 3, K('glass', 2))
    c.R(x + hw + 2, y + 3, hw - 3, 4, K('glass', -1)); c.HL(x + hw + 2, y + 3, hw - 3, K('glass', 1))
    hazard(c, x + 1, y + h - 3, w - 2, 2)
    c.R(x + hw - 1, y - 1, 2, 1, K(lamp, 3)); c.P(x + 1, y + 1, K('orange', 3))


# ------------------------------------------------------------------ 조각 등록부
PIECES: dict = {}


def piece(id_, name, w, h, kind, group='outdoor', solid=(), frames=1, tags=(), walk=None, desc='', line='A'):
    """등록 데코레이터. 그림 함수는 draw(c) (frames>1 이면 draw(c, f)). w,h 칸 수(16px).
    solid = 통행 막는 칸 [(cx,cy)] — terrain/flat 은 비워 둔다(걷는 바닥). walk = 지나가는(솟은) 칸을 명시하고 싶을 때."""
    def deco(fn):
        PIECES[id_] = dict(id=id_, name=name, w=w, h=h, kind=kind, group=group, solid=[tuple(p) for p in solid], frames=frames, tags=list(tags), desc=desc, line=line, draw=fn)
        return fn
    return deco


def render(p, f=0):
    c = Cv(p['w'] * T, p['h'] * T)
    p['draw'](c, f) if p['frames'] > 1 else p['draw'](c)
    return c.a


def palette_issues(a, tag):
    al = a[..., 3]; out = []
    if not np.all((al == 0) | (al == 255)): out.append('%s: 반투명 화소' % tag)
    ys, xs = np.nonzero(al == 255)
    for y, x in zip(ys, xs):
        v = (int(a[y, x, 0]) << 16) | (int(a[y, x, 1]) << 8) | int(a[y, x, 2])
        if v not in ALLOWED: out.append('%s: 팔레트 밖 #%06x @%d,%d' % (tag, v, x, y)); break
    return out


def pieces_of(group=None, only=None):
    return [p for p in PIECES.values() if (not group or p['group'] == group) and (not only or p['id'] in only)]


def png_path(p, f=0):
    n = 'sf-' + p['id'] + ('' if p['frames'] == 1 else '.f%d' % f)
    return os.path.join(OUT, p['group'], '_gate', n + '.png')


def export(group=None, only=None):
    from object_gate import pixel_sha256  # noqa: F401
    rows, man, bad = [], [], []
    for p in pieces_of(group, only):
        os.makedirs(os.path.dirname(png_path(p)), exist_ok=True)
        for f in range(p['frames']):
            a = render(p, f); bad += palette_issues(a, p['id'])
            Image.fromarray(a, 'RGBA').save(png_path(p, f))
            rows.append(dict(png=png_path(p, f), kind=p['kind'], name=p['name'], label='sf-station/%s' % os.path.basename(png_path(p, f))[:-4]))
        man.append({k: v for k, v in p.items() if k != 'draw'})
    for b in bad: print('  x', b)
    return rows, man, bad


def status_of(p):
    from object_gate import pixel_sha256, read_receipt
    res = []
    for f in range(p['frames']):
        r = read_receipt(pixel_sha256(Image.fromarray(render(p, f), 'RGBA')))
        res.append('none' if not r else (r['verdict'] if r.get('kind') == p['kind'] else 'kind'))
    return 'pass' if all(x == 'pass' for x in res) else ('none' if 'none' in res else 'fail')


def sheet(ims, path, W=240, z=4, bg=(60, 62, 80, 255), gap=6):
    x = y = rowh = 0; pos = []
    for im in ims:
        if x + im.width > W: x = 0; y += rowh + gap; rowh = 0
        pos.append((x, y)); x += im.width + gap; rowh = max(rowh, im.height)
    S = Image.new('RGBA', (W, y + rowh), bg)
    for im, pp in zip(ims, pos): S.alpha_composite(im, pp)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    S.resize((S.width * z, S.height * z), Image.NEAREST).save(path)


# ------------------------------------------------------------------ 지붕 윗면 장식(윗면이 «면»으로 읽히게: 이음선 + 환기구 + 해치 + 그림자 지는 상자)
def roof_detail(c, x, y, w, h, mat='hull', seed=0, hatch=True, vents=True, pipes=False, tt=3):
    """윗면 [x,x+w)×[y,y+h) 위에 얹는 장식. 가로 이음선(원근으로 위가 촘촘), 세로 이음, 환기 격자, 해치, 옆 파이프. 모든 것이 윗면 안에 놓인다."""
    for j in range(2, h - 1, 4): c.HL(x + 1, y + j, w - 2, K(mat, tt - 1))
    for i in range(5 + seed % 3, w - 2, 9): c.VL(x + i, y + 1, h - 2, K(mat, tt - 1))
    if vents and w >= 12 and h >= 6:
        vx = x + 2 + (seed * 3) % 4
        c.R(vx, y + 2, 7, 3, K('cable', 0)); [c.HL(vx + 1, y + 2 + k, 5, K('hull', 1)) for k in (0, 2)]
    if hatch and w >= 20 and h >= 8:
        hx = x + w - 15 - (seed % 3); hy = y + 2
        c.R(hx, hy, 9, h - 5, K(mat, tt - 2)); c.R(hx + 1, hy + 1, 7, h - 7, K(mat, tt + 1)); c.P(hx + 4, hy + (h - 5) // 2, K('orange', 2)); c.HL(hx, hy + h - 5, 9, K(mat, tt - 3))
    if pipes:
        c.HL(x + 1, y + h - 3, w - 2, K('rust', 1)); c.HL(x + 1, y + h - 2, w - 2, K('rust', -2))


def tcube(c, x, y, w, top, front, mat, ins=4, tt=3, ft=-2, topmat=None, ol=True, seams=True, s=0):
    """사다리꼴 윗면 상자: 윗면이 뒤(위)로 갈수록 양옆 ins 만큼 좁아진다(원근) + 앞면 직사각형. 관문이 윗면을 «뒤로 물러나는 면»으로 읽는 가장 확실한 단서
    (jp_city 기와 지붕·gothic hip 과 같은 방식). 윗면 이음선도 사다리꼴 안쪽을 따라 간다."""
    tm = topmat or mat
    for r in range(top):
        t = r / max(1, top - 1); l = int(round(ins * (1 - t))); xs = x + l; xe = x + w - l
        for xx in range(xs, xe):
            tone = tt - (1 if r < 2 else 0) + (1 if r >= top - 2 else 0)
            if xx - xs < 2: tone += 1
            if xe - 1 - xx < 2: tone -= 1
            c.P(xx, y + r, K(tm, tone))
        if seams and r % 5 == 3: c.HL(xs + 1, y + r, max(0, xe - xs - 2), K(tm, tt - 2))
    if seams:
        for i in range(w // 4, w - 2, 9):
            for r in range(2, top - 1):
                l = int(round(ins * (1 - r / max(1, top - 1))))
                if x + l < x + i < x + w - l - 1: c.P(x + i, y + r, K(tm, tt - 2))
    c.R(x, y + top, w, front, K(mat, ft)); c.VL(x, y + top, front, K(mat, ft + 1)); c.VL(x + w - 1, y + top, front, K(mat, ft - 1))
    c.HL(x, y + top, w, K(mat, ft + 3)); c.HL(x, y + top + front - 1, w, K(mat, ft - 2))
    if ol: c.outline()


# ------------------------------------------------------------------ 재질 후처리(2026-10-14 공예 보강): 평평한 면 색만 바꾼다 — 창·문·간판은 그대로 둔다
def _col_at(c, x, y):
    if not c.has(x, y): return None
    r, g, b = (int(v) for v in c.a[y, x, :3]); return (r << 16) | (g << 8) | b


def texture_face(c, x, y, w, h, mat, ft, seam=8, band=12, seed=0, grime=3, light=2, stains=True, rivets=True):
    """앞면 [x,x+w)×[y,y+h) 의 «평평한 벽색 K(mat,ft)» 화소에만 결을 넣는다:
    세로 판 이음(어두운 줄 + 오른쪽 밝은 줄) · 층 띠(어두운 줄 + 아래 밝은 턱) · 이음 교차점 리벳 · 아래 grime 그러데이션 · 왼쪽 빛 · 얼룩 점.
    창·문·네온처럼 다른 색으로 이미 칠한 화소는 건드리지 않으므로 그림을 다 그린 뒤 마지막에 부른다."""
    base = K(mat, ft); todo = []
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            if _col_at(c, xx, yy) == base: todo.append((xx, yy))
    for xx, yy in todo:
        rx, ry = xx - x, yy - y; t = ft
        if seam and rx > 0 and rx % seam == 0: t = ft - 1
        elif seam and rx > 1 and rx % seam == 1: t = ft + 1
        if band and ry > 0 and ry % band == 0: t = ft - 1
        elif band and ry > 1 and ry % band == 1: t = ft + 1
        if rivets and seam and band and ry % band == 3 and rx % seam in (3, seam - 3): t = ft + 2
        if grime and ry >= h - grime: t = min(t, ft - 1) if ry < h - 1 else ft - 2
        if light and rx < light and t == ft: t = ft + 1
        if stains and t == ft:
            n = hsh(xx, yy, seed + 71) % 29
            if n == 0: t = ft - 1
            elif n == 1 and ry > h // 2: t = ft - 1
        if t != ft: c.P(xx, yy, K(mat, t))


def halo(c, x, y, w, h, col, under, r=2):
    """네온·창 둘레 빛 번짐: 사각 (x,y,w,h) 바깥 r 화소 안의 «under 색» 화소를 램프 어두운 단으로 물들인다(거리 1 = -2, 거리 2 = -3 체커)."""
    under = set(under)
    for yy in range(y - r, y + h + r):
        for xx in range(x - r, x + w + r):
            if x <= xx < x + w and y <= yy < y + h: continue
            d = max(x - xx, xx - (x + w - 1), y - yy, yy - (y + h - 1))
            cc = _col_at(c, xx, yy)
            if cc not in under: continue
            if d == 1: c.P(xx, yy, K(col, -2))
            elif d == 2 and (xx + yy) % 2 == 0: c.P(xx, yy, K(col, -3))


def window(c, wx, wy, ww, wh, col=None, seed=0, frame=None, sill=None, blinds=False):
    """창 하나: 어두운 틀 + (켜짐: 위 상인방 그림자·천장등 띠·아래 밝은 바닥빛·블라인드 / 꺼짐: 유리 그러데이션 + 대각 반사) + 가운데 살 + 아래 밝은 창턱."""
    frame = K('navy', -3) if frame is None else frame
    c.R(wx - 1, wy - 1, ww + 2, wh + 2, frame)
    if col is None:
        for j in range(wh): c.HL(wx, wy + j, ww, K('glass', -2 if j == 0 else -1 if j < wh - 1 else 0))
        for k in range(min(ww, wh) - 1): c.P(wx + ww - 2 - k, wy + 1 + k, K('glass', 1 if k == 0 else 0)) if k < 3 else None
    else:
        for j in range(wh):
            t = -1 if j == 0 else 3 if j == 1 else 2 if j == wh - 1 else 1
            if blinds and j > 1 and j % 2 == 0 and j < wh - 1: t = 0
            c.HL(wx, wy + j, ww, K(col, t))
        if ww >= 4: c.VL(wx, wy + 1, wh - 1, K(col, 0))
    if ww >= 7: c.VL(wx + ww // 2, wy, wh, frame)
    if sill is not None: c.HL(wx - 1, wy + wh + 1, ww + 2, sill)
