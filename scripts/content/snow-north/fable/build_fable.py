#!/usr/bin/env python3
"""snow_north 다시 그리기(2026-11-12, Fable 5.2 medium 한 방) — 모델의 답(행 문자열)에서 조각 PNG 를 만든다. 모델을 부르지 않는다.

  python3 scripts/content/snow-north/fable/build_fable.py          # tiledata/snow-north/<묶음>/_gate/sn-<id>.png · autotile/ · _assembled/ · fable/waive-manifest.json
  python3 scripts/content/snow-north/fable/build_fable.py --out D  # 같은 것을 D 아래에(미리 보기)

- 답: fable/answers/<일>.json = {id, w, h, role, legend, rows, door, cells[{name,x,y,w,h}]}. 일 하나 = 호출 한 번. 조각은 일의 칸에서 자르거나 아래 조립식으로 만든다.
- 모든 그림은 팔레트 v2(art/palette.py, 48색·역할별)로 OKLab 가장 가까운 색에 맞춘다(디더 없음).
- 건물 = 지붕(직사각형) + 벽을 위아래로 붙인다. 폭 5칸 이상은 16px 구획(왼 끝·가운데·특징/문·오른 끝)을 코드가 늘어놓는다.
- 오토타일 6그룹(47 모양 + 속 변형 2)은 옛 배치(art/autotile.py Depression.depth)를 그대로 쓰고 속·바깥 그림만 새 바닥 칸에서 읽는다.
- 움직이는 조각의 프레임 2·3, 남북 방향 길, 그늘 눈, 가문비 두 그루, 반대 무늬 깃발은 코드가 만든다.
- 코드 마감(색·처마 선만): 지붕 눈의 줄별 명암과 고르지 않은 처마 눈 턱(roof_finish), 노점 차양의 색 띠 늘리기(awning), 다진 눈의 회색 긁힘 → 푸른 그늘(pack_tile), 눈밭 기본 칸의 되풀이되는 밝은 결 지우기(snow_base).
- 답이 없거나 깨진 조각은 옛 그림(fable/old/sn-<id>.png — 2026-11-12 이전 커밋의 tiledata/snow-north/<묶음>/_gate 를 꺼내 둔다)을 v2 팔레트로 옮겨 남긴다(KEPT 에 적힌다). 지금은 그런 조각이 없어 fable/old 는 저장소에 없다.
"""
import argparse, json, math, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SN = os.path.dirname(HERE)
ROOT = os.path.abspath(os.path.join(SN, '..', '..', '..'))
sys.path.insert(0, os.path.join(SN, 'art'))
import palette as PAL          # noqa: E402
import autotile as AT          # noqa: E402
ANS = os.path.join(HERE, 'answers')
OLD = os.path.join(HERE, 'old')            # 2026-10-14 손 도트 사본(남기는 조각의 원본) — 지금은 쓰이지 않아 저장소에 없다
ANCHOR = os.path.join(HERE, 'anchors')     # 오너가 먼저 받은 Fable 기물 7(fable-oneshot-2026-11-12) — v2 팔레트로 옮겨 굽는다
T = 16


# ───────────────────────── 색 ─────────────────────────
def oklab(rgb):
    c = np.asarray(rgb, float) / 255
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    l = np.cbrt(0.4122214708 * c[..., 0] + 0.5363325363 * c[..., 1] + 0.0514459929 * c[..., 2])
    m = np.cbrt(0.2119034982 * c[..., 0] + 0.6806995451 * c[..., 1] + 0.1073969566 * c[..., 2])
    s = np.cbrt(0.0883024619 * c[..., 0] + 0.2817188376 * c[..., 1] + 0.6299787005 * c[..., 2])
    return np.stack([0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
                     0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s], -1)


def snap(im, role):
    cols = [c for t in PAL.V2_RGB[role].values() for c in t]
    lab = oklab(np.array(cols))
    a = np.array(im.convert('RGBA')); out = a.copy(); cache = {}
    for y in range(a.shape[0]):
        for x in range(a.shape[1]):
            if a[y, x, 3] < 128: out[y, x] = 0; continue
            k = tuple(int(v) for v in a[y, x, :3])
            if k not in cache: cache[k] = cols[int(((lab - oklab(np.array(k))) ** 2).sum(1).argmin())]
            out[y, x, :3] = cache[k]; out[y, x, 3] = 255
    return Image.fromarray(out, 'RGBA')


def ramp_of(rgb, role):
    for m, t in PAL.V2_RGB[role].items():
        if rgb in t: return m, t.index(rgb)
    return None, None


def shade_rgb(rgb, dt, role='ground'):
    m, i = ramp_of(tuple(rgb), role)
    if m is None: return tuple(rgb)
    t = PAL.V2_RGB[role][m]
    return t[max(0, min(len(t) - 1, i + dt))]


def remap(im, fn):
    a = np.array(im.convert('RGBA'))
    for y in range(a.shape[0]):
        for x in range(a.shape[1]):
            if a[y, x, 3]: a[y, x, :3] = fn(tuple(int(v) for v in a[y, x, :3]))
    return Image.fromarray(a, 'RGBA')


# ───────────────────────── 답 읽기 ─────────────────────────
_JOB = {}


def job(jid):
    if jid not in _JOB:
        p = os.path.join(ANS, jid + '.json')
        if not os.path.exists(p): _JOB[jid] = None
        else:
            d = json.load(open(p, encoding='utf-8'))
            a = np.zeros((d['h'], d['w'], 4), np.uint8)
            cols = {}
            for k, v in d['legend'].items():
                r, t = v.split(':'); cols[k] = PAL.V2_RGB[d['role']][r][int(t)]
            for y, row in enumerate(d['rows']):
                for x, ch in enumerate(row):
                    if ch in cols: a[y, x, :3] = cols[ch]; a[y, x, 3] = 255
            if d['role'] == 'ground':        # 바닥 칸의 빈 화소(답의 오타 한두 개)는 왼쪽 이웃 색으로 메운다
                for y, x in zip(*np.nonzero(a[:, :, 3] == 0)): a[y, x] = a[y, x - 1] if x else a[y, x + 1]
            d['img'] = Image.fromarray(a, 'RGBA')
            _JOB[jid] = d
    return _JOB[jid]


class Missing(Exception):
    pass


def J(jid):
    d = job(jid)
    if d is None or d.get('broken'): raise Missing(jid)
    return d['img']


def cut(jid, name):
    d = job(jid)
    if d is None or d.get('broken') or name in (d.get('brokenCells') or []): raise Missing(f'{jid}/{name}')
    c = next(c for c in d['cells'] if c['name'] == name)
    return d['img'].crop((c['x'], c['y'], c['x'] + c['w'], c['y'] + c['h']))


def stack(*ims):
    W = max(i.width for i in ims)
    out = Image.new('RGBA', (W, sum(i.height for i in ims)), (0, 0, 0, 0)); y = 0
    for i in ims:
        out.alpha_composite(i, ((W - i.width) // 2, y)); y += i.height
    return out


def widen(im, order):
    """16px 구획(A=0, B=1, …)을 order 순서로 늘어놓는다."""
    out = Image.new('RGBA', (len(order) * T, im.height), (0, 0, 0, 0))
    for i, ch in enumerate(order):
        k = ord(ch) - 65
        out.alpha_composite(im.crop((k * T, 0, k * T + T, im.height)), (i * T, 0))
    return out


def roll(im, dx=0, dy=0):
    return Image.fromarray(np.roll(np.array(im), (dy, dx), axis=(0, 1)), 'RGBA')


def transpose(im): return im.transpose(Image.TRANSPOSE)
def hflip(im): return im.transpose(Image.FLIP_LEFT_RIGHT)


GLOW = set(PAL.V2_RGB['object']['glow'])


def flicker(im, f):
    """불꽃 프레임: 불빛 화소를 줄마다 좌우로 1px 흔들고(불빛끼리만), 끝 화소의 단을 바꾼다."""
    a = np.array(im); out = a.copy(); g = PAL.V2_RGB['object']['glow']
    h, w = a.shape[:2]
    isg = lambda y, x: 0 <= x < w and a[y, x, 3] and tuple(a[y, x, :3]) in GLOW
    for y in range(h):
        s = (1 if (y // 2 + f) % 2 else -1) * (1 if f == 1 else -1)
        for x in range(w):
            if not isg(y, x): continue
            if isg(y, x - s): out[y, x, :3] = a[y, x - s, :3]
            else:
                i = g.index(tuple(a[y, x, :3])); out[y, x, :3] = g[max(0, min(2, i + (1 if (x + y + f) % 3 == 0 else -1 if (x + y + f) % 3 == 1 else 0)))]
    return Image.fromarray(out, 'RGBA')


def waft(im, f):
    """연기 프레임: 줄마다 사인으로 1px 밀고 1px 위로."""
    a = np.array(im); out = np.zeros_like(a); h, w = a.shape[:2]
    for y in range(h):
        dx = int(round(math.sin((y + f * 5) / 4.0)))
        sy = min(h - 1, y + f)
        out[y] = np.roll(a[sy], dx, axis=0)
    return Image.fromarray(out, 'RGBA')


# ───────────────────────── 조립식 ─────────────────────────
def _h(x, y=0, k=0):
    v = (x * 73856093) ^ (y * 19349663) ^ (k * 83492791)
    return (v ^ (v >> 13)) & 0xffff


def roof_finish(im, rows=None):
    """지붕 조각 마감(코드, 모델 호출 없음 — 감독 2026-11-12: 한 방 지붕 눈이 평평한 띠로 읽혔다). 직사각형 윤곽은 그대로 둔다.
    ① 처마 눈 턱 바로 위 2줄만 한 단 어둡게(턱으로 말려 내려가는 그늘). 나머지 눈은 답 그대로다 — 위 절반을 한 단 밝히는 것도 해 봤지만 흰 종이 + 가로 금으로 읽혀 버렸다.
    ② 처마 눈 턱을 고르지 않게: 턱이 3~7px 폭으로 군데군데 1~2px 처마 그늘 위로 늘어진다(두툼한 눈이 처마를 넘어 온다).
    ③ 윗변·좌우 변 1px 를 먹(ink:1)으로 두른다 — 흰 지붕이 흰 눈밭에 녹지 않게.
    rows: 지붕이 캔버스의 위 rows 줄일 때(통째 그린 작은 건물). 처마 = 그 마지막 4줄(눈 턱 · 턱 밑 · 그늘 2줄)."""
    o = PAL.V2_RGB['object']; sn = o['snow']; sh = o['shade'][1]
    tone = {sh: -1, **{c: i for i, c in enumerate(sn)}}
    col = lambda t: sh if t < 0 else sn[min(3, t)]
    a = np.array(im); h = rows or a.shape[0]; w = a.shape[1]
    lip = h - 4
    for y in range(lip):
        d = -1 if y >= lip - 2 else 0
        if not d: continue
        for x in range(w):
            c = tuple(int(v) for v in a[y, x, :3])
            if a[y, x, 3] and c in tone: a[y, x, :3] = col(max(-1, tone[c] + d))
    x = 2 + _h(w, h) % 4
    while x < w - 4:
        n = 3 + _h(x, w, 1) % 5
        for i in range(n):
            xx = x + i
            if xx >= w - 2 or not a[h - 1, xx, 3]: continue
            deep = n >= 5 and 0 < i < n - 1
            a[lip, xx, :3] = sn[3]; a[lip + 1, xx, :3] = sn[2] if deep else sn[1]
            a[lip + 2, xx, :3] = sn[1] if deep else sn[0]
            if deep: a[lip + 3, xx, :3] = sn[0]
        x += n + 3 + _h(x, w, 2) % 6
    ink = o['ink'][1]; op = a[:, :, 3] > 0
    for y in range(h):
        for x in range(w):
            if op[y, x] and (x == 0 or not op[y, x - 1] or x == w - 1 or not op[y, x + 1] or y == 0 or not op[y - 1, x]): a[y, x, :3] = ink
    return Image.fromarray(a, 'RGBA')


def awning(im):
    """노점 차양(코드): 한 방 그림은 눈이 차양의 위 절반을 덮어 장터가 갈색 상자 줄로 읽혔다. 줄무늬를 위로 늘려(4번째 줄부터) 색 띠를 두 배로 하고,
    눈은 맨 위 3줄과 군데군데 늘어진 덩이로 남긴다. 살림 노점처럼 색 줄이 가는 차양은 4px 줄무늬 한 칸 걸러 오로라 색으로 채운다."""
    o = PAL.V2_RGB['object']; snow = set(o['snow']) | {o['shade'][1]}; acc = {c for k in ('red', 'blue', 'aurora') for c in o[k]}
    a = np.array(im); w = a.shape[1]
    rows = [y for y in range(3, 14) if sum(1 for x in range(w) if tuple(a[y, x, :3]) in snow) < w * 0.25 and sum(1 for x in range(w) if tuple(a[y, x, :3]) in acc) >= 4]
    if not rows: return im
    r0 = rows[0] + (1 if len(rows) > 1 else 0)
    if sum(1 for x in range(w) if tuple(a[r0, x, :3]) in acc) < w * 0.3:      # 가는 색 줄 → 넓은 줄무늬
        hide = set(o['hide'])
        for y in rows:
            for x in range(1, w - 1):
                if (x // 4) % 2 == 0 and tuple(a[y, x, :3]) in hide: a[y, x, :3] = o['aurora'][0]
    for y in range(3, rows[0]):
        for x in range(1, w - 1):
            if tuple(a[y, x, :3]) in snow and not (y <= 4 and _h(x // 3, 7) % 3 == 0): a[y, x, :3] = a[r0, x, :3]
    return Image.fromarray(a, 'RGBA')


def snow_base(im):
    """눈밭 기본 칸(맵의 눈밭 대부분이 이 한 칸이다): 밝은 바람결 줄이 칸마다 같은 자리에 되풀이돼 줄표 무늬로 읽혔다 — 밝은 결을 지우고 옅은 그늘 줄만 남긴다.
    바람결은 드물게 섞이는 변주 칸(snow-b·c·d)에만 남는다."""
    g = PAL.V2_RGB['ground']['snow']
    return remap(im, lambda c: g[2] if c == g[3] else c)


def pack_tile(im):
    """다진 눈 칸: 답은 눈 램프 1단 바탕 + 2단 얼룩 + 회색 긁힘으로 왔다. 회색 긁힘을 눈의 푸른 그늘 단으로 옮겨 «눈밭보다 한 단 어둡고 푸른 눈» 으로만 읽히게 한다."""
    g = PAL.V2_RGB['ground']; grey = set(g['grey'])
    return remap(im, lambda c: g['snow'][0] if c in grey else c)


def _features(im):
    """지붕 캔버스에서 눈이 아닌 것의 덩어리(굴뚝·환기창·지붕창·용마루 장식·풀 포기·처마 선): [(화소 수, x0, x1, y0, y1)]."""
    o = PAL.V2_RGB['object']; fam = set(o['snow']) | set(o['shade'])
    a = np.array(im); h, w = a.shape[:2]
    non = [[bool(a[y, x, 3]) and tuple(int(v) for v in a[y, x, :3]) not in fam for x in range(w)] for y in range(h)]
    seen, out = set(), []
    for y in range(h):
        for x in range(w):
            if not non[y][x] or (x, y) in seen: continue
            st, px = [(x, y)], []; seen.add((x, y))
            while st:
                cx, cy = st.pop(); px.append((cx, cy))
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < w and 0 <= ny < h and non[ny][nx] and (nx, ny) not in seen: seen.add((nx, ny)); st.append((nx, ny))
            out.append((len(px), min(q[0] for q in px), max(q[0] for q in px), min(q[1] for q in px), max(q[1] for q in px)))
    return out


ROOF_PERIOD = 12     # 눈 줄은 6줄마다 한 단, 두 단(벽돌 엇갈림)이 한 주기 — 실측: 12줄 떨어진 화소가 가장 많이 같다
TUFT_PX = 24         # 이보다 작은 덩어리(눈 위로 나온 풀·이엉 포기)는 빼는 줄 안에 통째로 들어가면 같이 뺀다. 굴뚝·환기창·지붕창·용마루 장식은 절대 빼지 않는다


def lower_roof(im, order=None, tail=0):
    """지붕 캔버스(직사각형, 16px 구획)를 낮춘다 — 코드, 모델 호출 없음(오너 2026-11-12: «지붕의 height 그러니까 세로 길이가 너무 길면 또 곤란함»).
    구획마다 굴뚝·환기창·지붕창이 지나지 않는 12줄(눈 줄 한 주기)을 통째로 빼고 그 위를 내린다. 주기를 통째로 빼므로 구획마다 빼는 자리가 달라도 눈 줄이 이어진다.
    굴뚝·환기창·지붕창·용마루 장식은 한 화소도 잘리지 않는다(위 2줄·아래 1줄 여유 — 눈 모자와 그늘). 풀 포기는 빼는 줄 안에 통째로 들면 같이 빠지고, 걸치면 그 자리를 피한다.
    tail: 처마 바로 위(모든 구획 같은 줄, 아무것도 없는 줄)에서 더 빼는 줄 수 — 지붕을 벽 높이에 맞출 때.
    order: widen 순서(이웃 구획끼리 빼는 자리가 같도록 고를 때 쓴다). 돌려주는 캔버스는 높이만 줄었다(roof_finish 는 이 뒤에)."""
    a = np.array(im); h, w = a.shape[:2]; n = w // T; P = ROOF_PERIOD
    feats = [f for f in _features(im) if not (f[2] - f[1] >= w - 2)]           # 폭 전체를 지나는 것(용마루 선·처마 선)은 줄 고르기에서 뺀다 — 그 줄은 아래 범위 밖이다
    lo, hi = 3, (h - 8 if tail else h - 3)                                      # 용마루 3줄 · 처마 쪽(tail 이 있으면 그 4줄 위까지)은 건드리지 않는다
    if tail:
        assert all(f[4] < h - 8 or f[3] >= h - 8 + tail for f in feats), ('처마 위 줄에 무언가 있다', feats)
    def options(k):
        mine = [f for f in feats if f[2] >= k * T and f[1] < (k + 1) * T]
        for f in mine: assert f[1] >= k * T and f[2] < (k + 1) * T, ('구획에 걸친 덩어리', f)
        out = []
        for c in range(lo, hi - P + 1):
            drop, low, ok = 0, 0, True
            for px, x0, x1, y0, y1 in mine:
                big = px > TUFT_PX
                if y1 < c - (1 if big else 0) or y0 >= c + P + (2 if big else 0):               # 빼는 줄 밖(굴뚝은 여유를 둔다)
                    if not big and y1 < c and h - 1 - y1 - P - tail < 8: low += 1                # 풀 포기가 처마 눈 턱에 내려앉는다 — 되도록 그 위쪽 줄을 뺀다
                    continue
                if not big and y0 >= c and y1 < c + P: drop += 1; continue                       # 풀 포기가 통째로 빠진다
                ok = False; break
            if ok: out.append((c, drop, low))
        assert out, ('뺄 12줄이 없다', k, mine)
        return out
    opts = [options(k) for k in range(n)]
    seq = [ord(ch) - 65 for ch in order] if order else list(range(n))
    best = None
    def rec(k, pick):
        nonlocal best
        if k == n:
            cost = sum(1000 * d + 30 * lw for _, d, lw in pick) + sum(6 for i in range(len(seq) - 1) if pick[seq[i]][0] != pick[seq[i + 1]][0]) + sum(abs(c + P / 2 - h / 2) for c, _, _ in pick)
            if best is None or cost < best[0]: best = (cost, list(pick))
            return
        for o in opts[k]: rec(k + 1, pick + [o])
    rec(0, [])
    out = np.zeros((h - P - tail, w, 4), a.dtype)
    for k in range(n):
        c = best[1][k][0]
        rows = [y for y in range(h) if not (c <= y < c + P) and not (tail and h - 8 <= y < h - 8 + tail)]
        out[:, k * T:(k + 1) * T] = a[rows, k * T:(k + 1) * T]
    lower_roof.last = dict(cuts=[o[0] for o in best[1]], dropped=sum(o[1] for o in best[1]), rows=[h, h - P - tail])
    return Image.fromarray(out, 'RGBA')


def pad_top(im, n):
    """위에 빈 n줄 — 지붕을 낮춰도 그림 크기·키트 칸 수·문 칸은 그대로다(맨 위 칸이 빈 칸이 된다)."""
    out = Image.new('RGBA', (im.width, im.height + n), (0, 0, 0, 0)); out.alpha_composite(im, (0, n))
    return out


def R_building(roof, wall, r_order=None, w_order=None, finish=True, rows=None, lower=None):
    """lower=(tail,): 지붕 캔버스를 12줄(+tail) 낮춘다(lower_roof). 그림 크기는 위를 비워 지킨다."""
    def f():
        r = J(roof); cut = 0
        if lower is not None:
            h0 = r.height; r = lower_roof(r, r_order, lower[0]); cut = h0 - r.height
        if r_order: r = widen(r, r_order)
        if finish: r = roof_finish(r, rows)
        return pad_top(stack(r, widen(J(wall), w_order) if w_order else J(wall)), cut)
    return f


# 아래 셋은 옛 키트의 칸 모양(어느 칸이 비어 있었나)을 지키려고 조립을 맞춘 것이다 — 칸이 생기거나 사라지면 저장된 맵에서 그 칸이 비거나 잘린다.
def R_church():
    """통널 교회 80×128: 종탑(가운데 16px) + 윗단 지붕(48 폭) / 아랫단 지붕(80 폭) / 벽.
    지붕 높이(오너 2026-11-12): 아랫단은 그린 40줄에서 눈 줄 한 주기를 뺀 28줄(전에는 40줄을 56줄로 늘려 지붕창이 둘로 보였다), 윗단은 아랫단 위 12줄에 걸친다(지붕창이 통째로 보인다).
    종탑·윗단 화소는 그대로이고 자리만 24줄 내려왔다 — 지붕 덩이 68 → 44줄. 맨 위 24줄이 비어 위쪽 칸들이 빈 칸이 된다(크기 5×8·문 칸 그대로)."""
    out = Image.new('RGBA', (80, 128), (0, 0, 0, 0))
    low = roof_finish(widen(lower_roof(J('b-church-roof'), 'ABCBD'), 'ABCBD'))
    out.alpha_composite(low, (0, 96 - low.height))
    top = J('b-church-top').copy(); a = np.array(top); a[:16, :16] = 0; a[:16, 32:] = 0      # 탑 머리 양옆은 비운다(옛 그림과 같은 화소)
    out.alpha_composite(Image.fromarray(a, 'RGBA'), (16, 96 - low.height + 12 - top.height))
    out.alpha_composite(widen(J('b-church-wall'), 'ABCBD'), (0, 96))
    return out


def R_mill():
    """물방앗간 80×80: 옛 키트는 오른쪽 위 두 칸(물레 쪽)이 비어 있다 — 물레 칸 지붕은 한 단 낮은 달개 지붕으로(위 32줄을 비운다)."""
    r = widen(J('b-mill-roof'), 'ACBBD'); a = np.array(r); a[:32, 64:] = 0
    return stack(roof_finish(Image.fromarray(a, 'RGBA')), widen(J('b-mill-wall'), 'ACBBD'))


def R_pine_pair():
    """가문비 두 그루 48×64: 큰 가문비 둘을 16px 어긋나게 겹친다(뒤 나무는 좌우를 뒤집어 다른 나무로 읽히게). 맨 윗줄 세 칸이 모두 차야 옛 키트와 같다."""
    out = Image.new('RGBA', (48, 64), (0, 0, 0, 0))
    big = cut('t-pine-l', 'pine-l')
    out.alpha_composite(hflip(big), (16, 0)); out.alpha_composite(big, (0, 0))
    return out


def R_snow_shade():
    return remap(snow_base(cut('g-snow', 'snow')), lambda c: shade_rgb(c, -1))


def R_banner_b():
    o = PAL.V2_RGB['object']; sw = {o['blue'][0]: o['red'][0], o['blue'][1]: o['red'][1]}
    return remap(cut('p-fire-racks', 'banner-aurora'), lambda c: sw.get(c, c))


def half(jid, name, top): return lambda: cut(jid, name).crop((0, 0 if top else 16, 16, 16 if top else 32))


C = lambda jid, name=None: (lambda: cut(jid, name)) if name else (lambda: J(jid))
RECIPES = {
    # 바닥
    'snow': lambda: snow_base(cut('g-snow', 'snow')), 'snow-b': C('g-snow', 'snow-b'), 'snow-c': C('g-snow', 'snow-c'), 'snow-d': C('g-snow', 'snow-d'), 'snow-shade': R_snow_shade,
    'pack': lambda: pack_tile(cut('g-pack', 'pack')), 'pack-sled': lambda: pack_tile(cut('g-pack', 'pack-sled')), 'pack-sled-v': lambda: pack_tile(transpose(cut('g-pack', 'pack-sled'))),
    'ice': C('g-ice', 'ice'), 'ice-clear': C('g-ice', 'ice-clear'), 'ice-crack': C('g-ice', 'ice-crack'), 'ice-dust': C('g-ice', 'ice-dust'),
    'tundra': C('g-grass', 'tundra'), 'frost': C('g-grass', 'frost'), 'slush': C('g-wet', 'slush'),
    'boards': C('g-paths', 'boards'), 'boards-v': lambda: transpose(cut('g-paths', 'boards')), 'flagstone': C('g-paths', 'flagstone'), 'hearthstone': C('g-paths', 'hearthstone'),
    'water': C('g-wet', 'water'), 'water-f1': lambda: roll(cut('g-wet', 'water'), dx=5), 'water-f2': lambda: roll(cut('g-wet', 'water'), dx=10),
    # 건물
    'cabin-s': R_building('b-cabin-s-roof', 'b-cabin-s-wall'), 'cabin-m': R_building('b-cabin-m-roof', 'b-cabin-m-wall'),
    'cabin-l': R_building('b-cabin-l-roof', 'b-cabin-l-wall', 'ABCBD', 'ABCBD', lower=(4,)), 'cabin-turf': R_building('b-turf-roof', 'b-turf-wall'),
    'longhouse': R_building('b-long-roof', 'b-long-wall', 'ABBCBBD', 'ABDCBDE', lower=(4,)), 'meadhall': R_building('b-mead-roof', 'b-mead-wall', 'ABBCBD', 'ABCDBE', lower=(4,)),
    'stave-church': R_church, 'sauna': R_building('b-sauna-roof', 'b-sauna-wall'), 'smokehouse': lambda: roof_finish(J('b-smokehouse'), 22), 'fishing-hut': lambda: roof_finish(J('b-fishing-hut'), 20),
    'ice-house': R_building('b-icehouse-top', 'b-icehouse-bot', finish=False), 'watchtower': R_building('b-tower-top', 'b-tower-bot', rows=20), 'storehouse': R_building('b-store-roof', 'b-store-body'),
    'mill': R_mill, 'barn': R_building('b-barn-roof', 'b-barn-wall', 'ABCBD', 'ABCBD', lower=(4,)),
    'smithy': R_building('b-smithy-roof', 'b-smithy-wall'), 'palisade-gate': R_building('b-gate-top', 'b-gate-bot', rows=22),
    'ice-cave': R_building('b-cave-top', 'b-cave-bot', finish=False), 'frozen-falls': R_building('b-falls-top', 'b-falls-bot', finish=False),
    # 나무·바위
    'pine-s': C('t-small', 'pine-s'), 'pine-m': C('t-pine-m', 'pine-m'), 'pine-l': C('t-pine-l', 'pine-l'), 'pine-pair': R_pine_pair, 'birch': C('t-birch', 'birch'), 'birch-s': C('t-small', 'birch-s'),
    'bush': C('t-rocks', 'bush'), 'boulder-s': C('t-rocks', 'boulder-s'), 'stump': C('t-rocks', 'stump'), 'reeds': C('t-rocks', 'reeds'),
    'boulder-l': C('t-boulder-drift', 'boulder-l'), 'drift': C('t-boulder-drift', 'drift'),
    # 야외 소품
    'cairn': C('p-posts', 'cairn'), 'rune-stone': C('p-posts', 'rune-stone'), 'signpost': C('p-posts', 'signpost'), 'lamp-post': C('p-posts', 'lamp-post'),
    'brazier': C('p-fire-racks', 'brazier'), 'brazier-f1': lambda: flicker(cut('p-fire-racks', 'brazier'), 1), 'brazier-f2': lambda: flicker(cut('p-fire-racks', 'brazier'), 2),
    'cauldron': C('p-fire-racks', 'cauldron'), 'ski-rack': C('p-fire-racks', 'ski-rack'), 'banner-aurora': C('p-fire-racks', 'banner-aurora'), 'banner-aurora-b': R_banner_b,
    'woodpile': C('p-wood-hide', 'woodpile'), 'hide-rack': C('p-wood-hide', 'hide-rack'),
    'bonfire': C('p-fire-well', 'bonfire'), 'bonfire-f1': lambda: flicker(cut('p-fire-well', 'bonfire'), 1), 'bonfire-f2': lambda: flicker(cut('p-fire-well', 'bonfire'), 2),
    'well': C('p-fire-well', 'well'), 'tent': C('p-tent', 'tent'), 'crates': C('p-crates', 'crates'), 'barrel': C('p-crates', 'barrel'), 'sacks': C('p-crates', 'sacks'),
    'sled': C('p-sleds', 'sled'), 'sled-wood': C('p-sleds', 'sled-wood'), 'barrels': C('p-sleds', 'barrels'), 'trough': C('p-sleds', 'trough'),
    'boat': C('p-lake', 'boat'), 'fishing-spot': C('p-lake', 'fishing-spot'), 'millstones': C('p-lake', 'millstones'), 'logs': C('p-lake', 'logs'), 'hay': C('p-lake', 'hay'),
    'chopping-block': C('p-small', 'chopping-block'), 'anvil': C('p-small', 'anvil'), 'water-barrel': C('p-small', 'water-barrel'), 'palisade-v': C('p-small', 'palisade-v'),
    'palisade': C('p-fences', 'palisade'), 'fence': C('p-fences', 'fence'), 'fence-v': C('p-fences', 'fence-v'), 'ice-wall': C('p-fences', 'ice-wall'), 'ice-wall-post': C('p-fences', 'ice-wall-post'),
    'smoke': C('p-fences', 'smoke'), 'smoke-f1': lambda: waft(cut('p-fences', 'smoke'), 1), 'smoke-f2': lambda: waft(cut('p-fences', 'smoke'), 2),
    'stall-fish': lambda: awning(cut('p-stall-fish', 'stall-fish')), 'stall-fur': lambda: awning(cut('p-stall-fur', 'stall-fur')), 'stall-wares': lambda: awning(cut('p-stall-wares', 'stall-wares')),
    # 실내
    'floor-plank': C('g-floors', 'floor-plank'), 'floor-stone': C('g-paths', 'floor-stone'), 'floor-ice': C('g-floors', 'floor-ice'), 'floor-sauna': C('g-floors', 'floor-sauna'),
    'ceiling': C('i-walls-other', 'ceiling'), 'ceiling-ice': C('i-walls-other', 'ceiling-ice'),
    'wall-log-u': half('i-walls-log', 'wall-log', 1), 'wall-log-d': half('i-walls-log', 'wall-log', 0), 'wall-plank-u': half('i-walls-other', 'wall-plank', 1), 'wall-plank-d': half('i-walls-other', 'wall-plank', 0),
    'wall-ice-u': half('i-walls-other', 'wall-ice', 1), 'wall-ice-d': half('i-walls-other', 'wall-ice', 0), 'wall-window-u': half('i-walls-log', 'wall-window', 1), 'wall-window-d': half('i-walls-log', 'wall-window', 0),
    'wall-door-u': half('i-walls-log', 'wall-door', 1), 'wall-door-d': half('i-walls-log', 'wall-door', 0),
    'hearth': C('i-hearth-firepit', 'hearth'), 'hearth-f1': lambda: flicker(cut('i-hearth-firepit', 'hearth'), 1), 'hearth-f2': lambda: flicker(cut('i-hearth-firepit', 'hearth'), 2),
    'firepit': C('i-hearth-firepit', 'firepit'), 'firepit-f1': lambda: flicker(cut('i-hearth-firepit', 'firepit'), 1), 'firepit-f2': lambda: flicker(cut('i-hearth-firepit', 'firepit'), 2),
    'bed-fur': C('i-beds', 'bed-fur'), 'bunk-bed': C('i-beds', 'bunk-bed'), 'long-table': C('i-table', 'long-table'), 'bench': C('i-table', 'bench'), 'stool': C('i-table', 'stool'),
    'bar-counter': C('i-bar', 'bar-counter'), 'keg-rack': C('i-keg-stove', 'keg-rack'),
    'sauna-stove': C('i-keg-stove', 'sauna-stove'), 'sauna-stove-f1': lambda: flicker(cut('i-keg-stove', 'sauna-stove'), 1), 'sauna-stove-f2': lambda: flicker(cut('i-keg-stove', 'sauna-stove'), 2),
    'sauna-bench': C('i-sauna', 'sauna-bench'), 'water-bucket': C('i-sauna', 'water-bucket'), 'chest': C('i-sauna', 'chest'),
    'weapon-rack': C('i-wall-things', 'weapon-rack'), 'shelf': C('i-wall-things', 'shelf'), 'drying-herbs': C('i-wall-things', 'drying-herbs'),
    'rug-fur': C('i-rug-pot', 'rug-fur'), 'antler-mount': C('i-rug-pot', 'antler-mount'), 'lantern': C('i-rug-pot', 'lantern'),
    'cauldron-in': C('i-rug-pot', 'cauldron-in'), 'cauldron-in-f1': lambda: flicker(cut('i-rug-pot', 'cauldron-in'), 1), 'cauldron-in-f2': lambda: flicker(cut('i-rug-pot', 'cauldron-in'), 2),
    'ice-crystal': C('i-icecave', 'ice-crystal'), 'ice-pillar': C('i-icecave', 'ice-pillar'), 'frozen-chest': C('i-icecave', 'frozen-chest'), 'stalagmite-ice': C('i-icecave', 'stalagmite-ice'),
}
ANCHORS = ['fish-rack', 'seal-altar', 'spring', 'bundle', 'record-stand', 'scroll', 'chair']     # 오너가 먼저 받은 Fable 기물(v2 팔레트로 옮김)
GROUND_IDS = {'floor-plank', 'floor-stone', 'floor-ice', 'floor-sauna'}


def role_of(it, group):
    return 'ground' if (group == 'terrain' or it['id'] in GROUND_IDS) else 'object'


# ───────────────────────── 오토타일 ─────────────────────────
OLD2NEW = {'snow': [0, 0, 0, 0, 1, 2, 3], 'ice': [0, 0, 0, 0, 1, 2, 3]}     # 옛 둑 단(7단) → v2 단(v2 의 네 단 = 옛 3~6단과 같은 색)
AUTO = dict(      # 그룹 → (속 칸, 속 변형 둘, 바깥 칸)
    pack=('pack', ('pack-b', 'pack-c'), 'snow'), ice=('ice', ('~ice', 'ice-dust'), 'snow'), tundra=('tundra', ('tundra-b', '~tundra'), 'snow'),
    frost=('frost', ('frost-b', '~frost'), 'snow'), slush=('slush', ('slush-b', '~slush'), 'snow'), water=('water', ('water-b', '~water'), 'ice'))
AUTO_SRC = {'pack': 'g-pack', 'pack-b': 'g-pack', 'pack-c': 'g-pack', 'ice': 'g-ice', 'ice-dust': 'g-ice', 'tundra': 'g-grass', 'tundra-b': 'g-grass', 'frost': 'g-grass', 'frost-b': 'g-grass',
            'slush': 'g-wet', 'slush-b': 'g-wet', 'water': 'g-wet', 'water-b': 'g-wet', 'snow': 'g-snow'}


def fill_of(name):
    if name.startswith('~'): return hflip(fill_of(name[1:]))
    im = cut(AUTO_SRC[name], name)
    return pack_tile(im) if name.startswith('pack') else snow_base(im) if name == 'snow' else im


def auto_cell(dep, m, inside, outside, om):
    """옛 Depression.paint 와 같은 규칙(둑 앞면·테·그늘)으로 한 칸. 속·바깥 화소는 새 바닥 칸에서 읽는다."""
    a = np.zeros((16, 16, 4), np.uint8); a[:, :, 3] = 255
    I, O = np.array(inside)[:, :, :3], np.array(outside)[:, :, :3]
    ramp = PAL.V2_RGB['ground'][om]; mp = OLD2NEW[om]
    omt = lambda t: ramp[mp[t]]
    for y in range(16):
        for x in range(16):
            D, eff = dep.depth(m, x, y, 0, 0)
            inn = tuple(int(v) for v in I[y, x]); out = tuple(int(v) for v in O[y, x])
            if eff is None or D >= dep.shadow + 0.5: c = inn
            elif D >= 0:
                if eff == 'N': c = shade_rgb(inn, -(2 if D < 1 else 1))
                elif eff in 'WS' and D < 1: c = shade_rgb(inn, -1)
                else: c = inn
            else:
                e = -D
                if eff == 'N':
                    f = dep.face
                    if e <= f: c = omt(1 + min(3, int(e)))
                    elif e <= f + 1: c = omt(6)
                    else: c = out
                elif eff == 'S': c = omt(3) if e <= 1 else omt(6) if e <= 2 else out
                elif eff == 'W': c = omt(2) if e <= 1 else omt(4) if e <= 2 else out
                else: c = omt(4) if e <= 1 else omt(6) if e <= 2 else out
            a[y, x, :3] = c
    if dep.gid == 'ice' and not (m & 1):        # 북쪽 둑 밑 고드름(옛 _icicles)
        ice = PAL.V2_RGB['ground']['ice']
        for x in range(1, 15):
            if dep.depth(m, x, 7, 0, 0)[1] != 'N': continue
            for y in range(1, 12):
                d0, e0 = dep.depth(m, x, y, 0, 0)
                if e0 == 'N' and d0 >= 0:
                    for k in range((1, 0, 2, 0, 1, 3, 0, 1)[(x * 5 + 3) % 8]): a[y + k, x, :3] = ice[3] if k == 0 else ice[2]
                    break
    return Image.fromarray(a, 'RGBA')


def build_autotiles(out, kept):
    import terrain as TR
    res = {}
    g = AT.sample_mask()
    for a in TR.AUTOTILES:
        gid = a['id']; base, bodies, outer = AUTO[gid]
        d = os.path.join(out, 'autotile', gid); os.makedirs(d, exist_ok=True)
        try:
            inside, outside = fill_of(base), fill_of(outer); bod = [fill_of(b) for b in bodies]
        except Missing as e:
            kept.append(('at-' + gid, f'바닥 답 없음 {e}'))
            for f in os.listdir(os.path.join(OLD, 'autotile', gid)): snap(Image.open(os.path.join(OLD, 'autotile', gid, f)), 'ground').save(os.path.join(d, f))
            snap(Image.open(os.path.join(OLD, 'sn-at-%s.png' % gid)), 'ground').save(os.path.join(out, 'terrain', '_gate', 'sn-at-%s.png' % gid))
            continue
        cells = {m: auto_cell(a['dep'], m, inside, outside, outer) for m in AT.CANON}
        full = 15 | 16 | 32 | 64 | 128
        bcells = [auto_cell(a['dep'], full, b, outside, outer) for b in bod]
        for m, im in cells.items(): im.save(os.path.join(d, 'm%03d.png' % m))
        for k, im in enumerate(bcells): im.save(os.path.join(d, 'b%d.png' % (k + 1)))
        Hh, Ww = len(g), len(g[0])
        S = Image.new('RGBA', (Ww * 16, Hh * 16))
        for y in range(Hh):
            for x in range(Ww):
                if g[y][x]:
                    m = AT.mask_at(g, x, y); cc = cells[m]
                    if m == 255 and AT.h32(x, y, 3) % 4 == 0: cc = bcells[AT.h32(x, y, 4) % len(bcells)]
                else: cc = outside
                S.paste(cc, (x * 16, y * 16))
        S.save(os.path.join(out, 'terrain', '_gate', 'sn-at-%s.png' % gid))
        res[gid] = S
    return res


# ───────────────────────── 전체 ─────────────────────────
def build(out):
    import terrain as TR, buildings as BD, props as PR, interior as IN, gate_assembled as GA
    kept, made, manifest = [], [], []
    for reg in (TR.R, BD.R, PR.R, IN.R):
        d = os.path.join(out, reg.group, '_gate'); os.makedirs(d, exist_ok=True)
        rows = []
        for it in reg.items:
            iid = it['id']; W, Hh = it['w'] * 16, it['h'] * 16
            role = role_of(it, reg.group); src = 'fable'
            try:
                if iid in ANCHORS: im = snap(Image.open(os.path.join(ANCHOR, 'sn-%s.png' % iid)), role); src = 'anchor'
                else: im = RECIPES[iid]()
                assert im.size == (W, Hh), (iid, im.size, (W, Hh))
                im = snap(im, role)
            except (Missing, KeyError) as e:
                im = snap(Image.open(os.path.join(OLD, 'sn-%s.png' % iid)), role); src = 'old'; kept.append((iid, f'답 없음/깨짐 {e}'))
            p = os.path.join(d, 'sn-%s.png' % iid); im.save(p)
            made.append((iid, src))
            rows.append(dict(png=os.path.basename(p), kind=it['kind'], name=it['name'], label='snow-north/sn-' + iid))
            if iid not in PARTS: manifest.append(dict(png=os.path.relpath(p, ROOT), kind=it['kind'], label='sn-' + iid, chipset='snow_north'))
        with open(os.path.join(d, 'items.jsonl'), 'w') as f:
            for r in rows: f.write(json.dumps(r, ensure_ascii=False) + '\n')
    build_autotiles(out, kept)
    with open(os.path.join(out, 'terrain', '_gate', 'items.jsonl'), 'a') as f:
        for a in TR.AUTOTILES:
            p = os.path.join(out, 'terrain', '_gate', 'sn-at-%s.png' % a['id'])
            f.write(json.dumps(dict(png=os.path.basename(p), kind='terrain', name='autotile %s' % a['id'], label='snow-north/sn-at-' + a['id']), ensure_ascii=False) + '\n')
            manifest.append(dict(png=os.path.relpath(p, ROOT), kind='terrain', label='sn-at-' + a['id'], chipset='snow_north'))
    GA.OUT_DIR = os.path.join(out, '_assembled'); GA.SRC = out
    for r in GA.build():
        manifest.append(dict(png=os.path.relpath(os.path.join(GA.OUT_DIR, r['png']), ROOT), kind='structure', label=r['label'].split('/')[-1], chipset='snow_north'))
    return made, kept, manifest


PARTS = {'palisade', 'palisade-v', 'fence', 'fence-v', 'smoke', 'smoke-f1', 'smoke-f2'}      # 조립 그림으로 덮는 부품(bake_sn.PARTS 와 같다)

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--out', default=os.path.join(ROOT, 'tiledata', 'snow-north')); ap.add_argument('--report'); a = ap.parse_args()
    made, kept, manifest = build(a.out)
    if a.report: json.dump(dict(made=made, kept=kept), open(a.report, 'w'), ensure_ascii=False)
    if os.path.abspath(a.out) == os.path.join(ROOT, 'tiledata', 'snow-north'):
        json.dump(dict(items=manifest), open(os.path.join(HERE, 'waive-manifest.json'), 'w'), ensure_ascii=False, indent=0)
    import collections
    print('조각', len(made), dict(collections.Counter(s for _, s in made)), '· 면제 목록', len(manifest))
    for k in kept: print('  옛 그림 유지', k)
