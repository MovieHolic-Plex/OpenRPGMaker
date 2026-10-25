"""wasteland_ruins 공용 그리개 — 잠긴 팔레트(modern_city palette.py build()) · Cv · 재질 윤곽 · 조각 등록부 · 관문 내보내기/영수증 확인.

폐허·황무지(포스트 아포칼립스 정착지 · 좀비 폐허 도시 · 황무지 판잣집 마을) 16px 3/4 탑뷰 칩셋. 코드 손 도트만(생성 이미지·추적·글자·사람 없음).
규약(sf_station·steampunk 관문 교훈):
  · 빛은 왼쪽 위. 서 있는 조각은 «윗면(5~8행 이상, 앞면보다 밝게) + 앞면(아래)». 정면 입면도(윗면 0행)·둥근 옆 바퀴·둥근 창은 떨어진다.
  · 윤곽은 검정이 아니라 맞닿은 재질의 가장 어두운 단(render() 가 OL 표식 화소를 바꾼다, selout).
  · 색은 modern_city 팔레트 램프 안의 값만. 허용 외 색 하나: 반투명 바닥 그림자 (11,18,36,90).
    from wl_core import *
    @piece('drums', '녹슨 드럼통', 1, 1, 'container', en='rusty oil drums', solid=[(0, 0)])
    def _(c): ...
지형 조각은 관문에 «깔아 놓은 표본»(3×3 등)으로 낸다: piece(..., sample=fn) — 표본은 조각 그림에서 결정적으로 만들어지므로
굽기가 같은 표본을 다시 만들어 그 해시의 영수증을 확인한다(조각 화소가 한 화소라도 바뀌면 표본 해시도 바뀐다).
"""
from __future__ import annotations
import json, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'src', 'harnesses', '_core'))
sys.path.insert(0, os.path.join(ROOT, 'src', 'harnesses', 'modern-chipset'))
import palette as MP  # noqa: E402

OUT = os.path.join(ROOT, 'tiledata', 'wasteland-ruins')
GATE_DIR = os.path.join(OUT, '_gate')
T = 16
LABEL_PREFIX = 'wasteland_ruins/'


def _hx(s): return int(s.lstrip('#'), 16)


# ------------------------------------------------------------------ 팔레트 (잠금: modern_city palette.py build() 그대로)
SRC = {name: [_hx(c) for c in cols] for name, _ch, cols, _d in MP.build()}
ALLOWED = {c for r in SRC.values() for c in r}
SHADOW_RGBA = (11, 18, 36, 90)          # modern_city 바닥 그림자(ink #0b1224, 알파 90) — 유일한 반투명 화소
S = SRC

# 재질 램프(어두움 → 밝음): 모두 위 원천 램프의 값을 골라 이은 것이다. 새 색 없음.
MAT = {
    # 풍화 콘크리트: 그늘은 청회(slate), 몸은 갈회(roof), 빛은 중립 회(body)
    'conc':  [S['slate'][0], S['slate'][1], S['roof'][2], S['roof'][3], S['roof'][4], S['body'][3], S['body'][4], S['body'][6]],
    # 다져진 흙·먼지: 갈색(bark) + 먼지 회갈(roof)
    'dirt':  [S['bark'][0], S['bark'][1], S['bark'][2], S['bark'][3], S['roof'][3], S['bark'][4], S['roof'][4], S['body'][3]],
    # 녹: 적갈(wine/brick) → 주황빛 마른 녹(amber)
    'rust':  [S['wine'][0], S['brick'][0], S['brick'][1], S['brick'][2], S['brick'][3], S['brick'][4], S['amber'][1]],
    # 갈색 녹·삭은 쇠(bark 쪽)
    'brust': [S['bark'][0], S['bark'][1], S['brick'][0], S['bark'][2], S['brick'][1], S['bark'][3], S['brick'][2], S['bark'][4]],
    # 함석·골강판(아연): 청회 → 민트 회 빛
    'metal': [S['road'][1], S['slate'][0], S['slate'][1], S['slate'][2], S['slate'][3], S['slate'][4], S['mint'][2], S['mint'][4]],
    # 금 간 아스팔트: 어두운 청회 + 먼지
    'asph':  [S['road'][0], S['slate'][0], S['slate'][1], S['slate'][2], S['roof'][2], S['slate'][3], S['roof'][3]],
    # 바랜 흰 차체
    'body': [S['slate'][1], S['body'][0], S['body'][1], S['body'][2], S['body'][3], S['body'][4], S['body'][5], S['body'][6]],
    # 마대(모래주머니): 바랜 갈회
    'burlap': [S['bark'][1], S['bark'][2], S['roof'][2], S['bark'][3], S['roof'][3], S['roof'][4], S['body'][3]],
    # 판자·목재
    'wood':  [S['bark'][0], S['bark'][1], S['bark'][2], S['bark'][3], S['bark'][4], S['amber'][2]],
    # 방수포: 청록 / 군용 녹색 / 바랜 파랑
    'tarp':  [S['teal'][0], S['teal'][1], S['teal'][2], S['teal'][3], S['teal'][4], S['mint'][1], S['mint'][3]],
    'army':  [S['grove'][0], S['leaf'][0], S['leaf'][1], S['leaf'][2], S['leaf'][3], S['leaf'][4], S['mint'][2]],
    'blue':  [S['road'][1], S['blue'][0], S['blue'][1], S['blue'][2], S['blue'][3], S['blue'][4], S['mint'][3]],
    # 풀·덩굴
    'plant': [S['grove'][0], S['grove'][1], S['leaf'][0], S['canopy'][0], S['leaf'][1], S['canopy'][1], S['leaf'][2], S['canopy'][3], S['leaf'][4]],
    'grass': [S['grove'][1], S['lawn'][0], S['lawn'][1], S['lawn'][2], S['lawn'][3], S['lawn'][4], S['lawn'][6]],
    # 마른 풀
    'dry':   [S['bark'][1], S['bark'][2], S['ginkgo'][0], S['ginkgo'][1], S['amber'][1], S['amber'][3]],
    # 벽돌(무너진 벽돌 더미)
    'brick': [S['wine'][0], S['brick'][0], S['brick'][1], S['brick'][2], S['brick'][3], S['brick'][4]],
    # 불: 깊은 적 → 흰
    'fire':  [S['wine'][1], S['wine'][2], S['brick'][4], S['amber'][0], S['ginkgo'][2], S['amber'][4], S['white'][2]],
    # 깨진 유리
    'glass': [S['teal'][0], S['teal'][1], S['teal'][2], S['teal'][3], S['teal'][4], S['mint'][4], S['white'][1]],
    # 바랜 페인트(차선 조각·표지)
    'paint': [S['ginkgo'][0], S['amber'][0], S['amber'][2], S['amber'][4]],
    'wpaint': [S['body'][2], S['body'][4], S['white'][0], S['white'][1]],
    # 고무·타이어·검댕
    'rubber': [S['ink'][0], S['road'][0], S['slate'][0], S['roof'][0], S['slate'][1], S['roof'][1], S['roof'][2]],
    'soot':  [S['ink'][0], S['road'][0], S['road'][1], S['slate'][0], S['roof'][1], S['roof'][2]],
    # 기름 웅덩이: 짙은 남 + 무지개 빛 한두 점(teal·azalea·amber)
    'oil':   [S['ink'][0], S['road'][0], S['road'][1], S['road'][2], S['teal'][3], S['blue'][4]],
}
for _m, _r in MAT.items():
    for _c in _r: assert _c in ALLOWED, (_m, hex(_c))


def K(mat, i):
    """재질 mat 의 i 단(0 = 가장 어두움). 범위 밖은 끝 단으로 자른다. 음수 i 는 끝에서부터(-1 = 가장 밝음)."""
    r = MAT[mat] if mat in MAT else SRC[mat]
    if i < 0: i = len(r) + i
    return r[max(0, min(len(r) - 1, i))]


def rgb(h): return ((h >> 16) & 255, (h >> 8) & 255, h & 255)


def hsh(x, y, s=0):
    n = (x * 374761393 + y * 668265263 + s * 2147483647) & 0xffffffff
    n = ((n ^ (n >> 13)) * 1274126177) & 0xffffffff
    return (n ^ (n >> 16)) & 0xffff


def h2(x, y, s=0):
    """대각 줄무늬가 덜 생기는 2단 해시(hsh 를 두 번 섞는다)."""
    return hsh(hsh(x, y, s) ^ (x * 7919), y * 104729 + x, s + 1)


OL = 0x010203                       # 윤곽 표식(팔레트 밖) — render() 가 재질 어두운 단으로 바꾼다. 남으면 팔레트 검사가 잡는다.


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
    def get(s, x, y):
        if not s.has(x, y): return None
        r, g, b = (int(v) for v in s.a[y, x, :3]); return (r << 16) | (g << 8) | b
    def clear(s, x, y, w=1, h=1):
        x0, y0, x1, y1 = max(x, 0), max(y, 0), min(x + w, s.w), min(y + h, s.h)
        if x1 > x0 and y1 > y0: s.a[y0:y1, x0:x1] = 0
    def line(s, x0, y0, x1, y1, c):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(n + 1): s.P(round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n), c)
    def poly(s, pts, c):
        for (a, b) in zip(pts, pts[1:]): s.line(a[0], a[1], b[0], b[1], c)
    def ell(s, cx, cy, rx, ry, c, only=None):
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                if ((x - cx) / (rx + .5)) ** 2 + ((y - cy) / (ry + .5)) ** 2 <= 1 and (only is None or only(x, y)): s.P(x, y, c)
    def rows(s, x, y, rows, pal):
        """행 문자열 직접 찍기: pal = {글자: 색}, '.' 와 ' ' 는 건너뛴다, '_' 는 지운다."""
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch in '. ': continue
                if ch == '_': s.clear(x + i, y + j); continue
                s.P(x + i, y + j, pal[ch])
    def outline(s, col=None, diag=False, top=True):
        """불투명 덩이 바깥 4방향(diag=True 면 8방향) 투명 이웃에 윤곽 — 기본은 표식 OL(render 가 재질 윤곽으로 바꾼다).
        top=False: 바로 아래가 그림인 화소(윗면 위 테)는 두지 않는다 — 윗면 위 1px 어두운 테는 판정자가 정면 입면 윤곽으로 읽는다(버들 농장 울타리 실측)."""
        col = OL if col is None else col; m = s.a[..., 3] == 255; out = []
        nb = ((1, 0), (-1, 0), (0, 1), (0, -1)) + (((1, 1), (-1, 1), (1, -1), (-1, -1)) if diag else ())
        for y in range(s.h):
            for x in range(s.w):
                if m[y, x]: continue
                if not top and y + 1 < s.h and m[y + 1, x]: continue
                for dx, dy in nb:
                    xx, yy = x + dx, y + dy
                    if 0 <= xx < s.w and 0 <= yy < s.h and m[yy, xx]: out.append((x, y)); break
        for x, y in out: s.P(x, y, col)
    def shadow(s, pts):
        """투명 화소에만 반투명 바닥 그림자(팔레트 허용 외 색 하나). pts = [(x,y)…] 또는 함수 f(x,y)->bool."""
        it = pts if not callable(pts) else [(x, y) for y in range(s.h) for x in range(s.w) if pts(x, y)]
        for x, y in it:
            if 0 <= x < s.w and 0 <= y < s.h and s.a[y, x, 3] == 0: s.a[y, x] = SHADOW_RGBA
    def image(s): return Image.fromarray(s.a, 'RGBA')


# ------------------------------------------------------------------ 재질 윤곽(sel-out)
OL_BY_SRC = {
    'road': S['road'][0], 'slate': S['slate'][0], 'roof': S['slate'][0], 'body': S['slate'][0], 'white': S['slate'][0],
    'mint': S['teal'][0], 'teal': S['teal'][0], 'blue': S['blue'][0], 'brick': S['wine'][0], 'wine': S['wine'][0],
    'amber': S['bark'][0], 'leaf': S['leaf'][0], 'lawn': S['grove'][1], 'canopy': S['grove'][1], 'grove': S['grove'][0],
    'ginkgo': S['bark'][0], 'bark': S['bark'][0], 'azalea': S['wine'][0], 'ink': S['ink'][0],
}
_SRC_OF = {}
for _n, _r in SRC.items():
    for _c in _r: _SRC_OF.setdefault(_c, _n)


def selout(a):
    al = a[..., 3] == 255
    v = (a[..., 0].astype(np.int64) << 16) | (a[..., 1].astype(np.int64) << 8) | a[..., 2].astype(np.int64)
    olm = al & (v == OL)
    if not olm.any(): return a
    H, W = v.shape; out = a.copy()
    for y, x in zip(*np.nonzero(olm)):
        cnt = {}
        for nb in (((1, 0), (-1, 0), (0, 1), (0, -1)), ((1, 1), (-1, 1), (1, -1), (-1, -1))):
            for dx, dy in nb:
                xx, yy = x + dx, y + dy
                if 0 <= xx < W and 0 <= yy < H and al[yy, xx] and not olm[yy, xx]:
                    r = _SRC_OF.get(int(v[yy, xx]))
                    if r: cnt[r] = cnt.get(r, 0) + 1
            if cnt: break
        col = OL_BY_SRC.get(max(cnt, key=cnt.get), S['slate'][0]) if cnt else S['slate'][0]
        out[y, x, :3] = rgb(col)
    return out


# ------------------------------------------------------------------ 조각 등록부
PIECES: dict = {}


def piece(id_, name, w, h, kind, en='', group='props', solid=(), frames=1, tags=(), desc='', door=None, style=None, sample=None, role=None):
    """등록 데코레이터. 그림 함수 draw(c) (frames>1 이면 draw(c, f)). w,h = 칸 수.
    solid = 막는 칸 [(cx,cy)] (나머지 그림 칸은 ★ 뒤로 지나감). door = 문/입구 칸 (cx,cy) 또는 None.
    style = 관문 화풍 종류(building|roof|wall|tree|ground|water|prop; 없으면 종류 기본값). sample = 관문에 낼 표본 그림 함수 sample(piece_img_by_id, f) -> ndarray."""
    def deco(fn):
        PIECES[id_] = dict(id=id_, name=name, en=en or id_, w=w, h=h, kind=kind, group=group, solid=[tuple(p) for p in solid], frames=frames,
                           tags=list(tags), desc=desc, door=door, style=style, sample=sample, role=role, draw=fn)
        return fn
    return deco


_RCACHE = {}


def render(p, f=0):
    key = (p['id'], f)
    if key not in _RCACHE:
        c = Cv(p['w'] * T, p['h'] * T)
        p['draw'](c, f) if p['frames'] > 1 else p['draw'](c)
        _RCACHE[key] = selout(c.a)
    return _RCACHE[key].copy()


def gate_array(p, f=0):
    """관문에 내는 그림: 표본 함수가 있으면 표본(지형 깔기·오토타일 조립), 없으면 조각 그림 자체."""
    return p['sample'](f) if p['sample'] else render(p, f)


def palette_issues(a, tag):
    al = a[..., 3]; out = []
    semi = (al != 0) & (al != 255)
    if semi.any():
        ys, xs = np.nonzero(semi)
        for y, x in zip(ys, xs):
            if tuple(int(v) for v in a[y, x]) != SHADOW_RGBA: out.append('%s: 허용 밖 반투명 @%d,%d' % (tag, x, y)); break
    ys, xs = np.nonzero(al == 255)
    for y, x in zip(ys, xs):
        v = (int(a[y, x, 0]) << 16) | (int(a[y, x, 1]) << 8) | int(a[y, x, 2])
        if v not in ALLOWED: out.append('%s: 팔레트 밖 #%06x @%d,%d' % (tag, v, x, y)); break
    return out


def gate_name(p, f=0): return p['id'] + ('' if p['frames'] == 1 else '-f%d' % (f + 1))


def gate_png(p, f=0): return os.path.join(GATE_DIR, gate_name(p, f) + '.png')


def style_kind(p):
    if p['style']: return p['style']
    k = p['kind']
    return 'building' if k == 'structure' else 'tree' if k == 'organic' else 'ground' if k in ('terrain', 'flat') else 'prop'


def export(only=None):
    os.makedirs(GATE_DIR, exist_ok=True)
    rows, bad = [], []
    for p in PIECES.values():
        if only and p['id'] not in only: continue
        bad += palette_issues(render(p), p['id'])
        for f in range(p['frames']):
            a = gate_array(p, f); bad += palette_issues(a, p['id'] + ' (관문 그림)')
            Image.fromarray(a, 'RGBA').save(gate_png(p, f))
            rows.append(dict(png=gate_png(p, f), kind=p['kind'], styleKind=style_kind(p), name=p['en'] + ('' if p['frames'] == 1 else ' (frame %d)' % (f + 1)),
                             label=LABEL_PREFIX + gate_name(p, f)))
    return rows, bad


def receipt_of(p, f=0):
    from object_gate import pixel_sha256, read_receipt
    sha = pixel_sha256(Image.fromarray(gate_array(p, f), 'RGBA'))
    return sha, read_receipt(sha)


def status_of(p):
    """'pass' | 'refer' | 'fail' | 'none' | 'kind'(영수증 종류가 다름) — 모든 프레임을 본다."""
    res = []
    for f in range(p['frames']):
        _sha, r = receipt_of(p, f)
        res.append('none' if not r else (r['verdict'] if r.get('kind') == p['kind'] else 'kind'))
    for k in ('none', 'kind', 'fail', 'refer'):
        if k in res: return k
    return 'pass'


def refusal_of(p, context='bundle'):
    """굽기 채택 규칙: 모든 프레임의 관문 그림이 object_gate.refusal(img, kind, context) None 이어야 한다."""
    from object_gate import refusal
    for f in range(p['frames']):
        why = refusal(Image.fromarray(gate_array(p, f), 'RGBA'), kind=p['kind'], context=context)
        if why: return why
    return None


def board(ims, path, W=640, z=4, bg=(58, 52, 46, 255), gap=8, labels=None):
    x = y = rowh = 0; pos = []
    for im in ims:
        if x + im.width > W: x = 0; y += rowh + gap; rowh = 0
        pos.append((x, y)); x += im.width + gap; rowh = max(rowh, im.height)
    Sh = Image.new('RGBA', (W, y + rowh), bg)
    for im, pp in zip(ims, pos): Sh.alpha_composite(im, pp)
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    Sh.resize((Sh.width * z, Sh.height * z), Image.NEAREST).save(path)
    return pos
