#!/usr/bin/env python3
"""desert_east 바닥 — 불투명 16px 타일(kind terrain).

두 갈래:
 1) 한 칸 바닥(sand·road·flag·grass·gravel·mud …) — 무늬는 16 주기로 감겨 이음새가 없다. 모래 물결은 칸을 넘지 않는 짧은 «~» 자국이라
    잔잔한 모래·물결 모래·자갈 모래를 칸마다 섞어도 끊김이 없다.
 2) 모서리 왕 타일(wang corner) 다섯 벌 — 칸의 네 모서리(NW NE SW SE)가 «바탕 A / 덧 B» 중 무엇인지로 16장.
    구성기는 꼭짓점 격자((W+1)×(H+1))에 재질을 정하고 칸마다 네 모서리를 읽어 번호를 고른다. 모서리 값이 같은 변은 A 또는 B 그대로라 이음새가 없다.
    road(다진 길) · grass(오아시스 풀) · water(못 — 북쪽 둑은 앞면이 보인다) · dune(솟은 사구 — 남쪽 모래 비탈 그늘) · flag(사암 포석 — 연석 테).

  python3 terrain.py     # tiledata/desert-east/terrain/_gate/*.png + preview.png
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from px import C, rnd, h32
from kit import Reg, contact, OUT

R = Reg('terrain')


def T(id_, name, tags=(), rules='', **kw):
    return R.add(id_, name, 1, 1, 'terrain', tags=tags, rules=rules, **kw)


def W(x, y): return x % 16, y % 16


def vnoise(x, y, s, cell=4, per=16):
    """주기 per 로 감기는 값 잡음(이중선형, 매끈) 0..1."""
    n = per // cell
    gx, gy = x / cell, y / cell
    x0, y0 = int(math.floor(gx)), int(math.floor(gy)); fx, fy = gx - x0, gy - y0
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy)
    v = lambda i, j: rnd(i % n, j % n, s)
    a = v(x0, y0) * (1 - fx) + v(x0 + 1, y0) * fx
    b = v(x0, y0 + 1) * (1 - fx) + v(x0 + 1, y0 + 1) * fx
    return a * (1 - fy) + b * fy


# ═════════════════════ 한 칸 바닥 함수(x,y 는 칸 안 좌표, 16 주기) ═════════════════════
def sand_base(x, y, s=3):
    """잔잔한 모래: 5단 바탕 + 아주 옅은 덩이 명암 + 낱알 점."""
    x, y = W(x, y)
    t = 4
    r = rnd(x, y, s + 7)
    if r < 0.055: t = 3
    elif r > 0.975: t = 6
    elif r > 0.90: t = 5
    return ('sand', t)


def ripple_marks(x, y, s, n_marks, lo=2, hi=5):
    """칸 안에 들어앉은 «~» 물결 자국: 마루(밝음) 한 줄 + 바로 밑 그늘 한 줄. 자국끼리 겹치지 않게 결정적으로 놓는다.
    반환 dict (x,y)->(mat,t)."""
    out = {}
    k = 0; tries = 0
    while k < n_marks and tries < 60:
        tries += 1
        L = lo + h32(k, tries, s) % (hi - lo + 1)
        x0 = 1 + h32(tries, k, s + 1) % (14 - L)
        y0 = 1 + h32(k + tries, 3, s + 2) % 13
        cells = []
        for i in range(L):
            yy = y0 - (1 if 0 < i < L - 1 and (i + (h32(k, 0, s) & 1)) % 3 == 1 else 0)   # 살짝 휜 등
            cells.append((x0 + i, yy))
        if any((cx + dx, cy + dy) in out for cx, cy in cells for dx in (-1, 0, 1) for dy in (-1, 0, 1, 2)): continue
        for cx, cy in cells:
            out[(cx, cy)] = ('sand', 6 if (cx - x0) < L - 1 else 5)
            out[(cx, cy + 1)] = ('sand', 3)
        k += 1
    return out


def sand_tile(s, marks=2, pebbles=0, lo=2, hi=5):
    rm = ripple_marks(0, 0, s, marks, lo, hi)
    peb = {}
    for k in range(pebbles):
        px_, py_ = 1 + h32(k, 9, s) % 14, 1 + h32(9, k, s) % 13
        if (px_, py_) in rm or (px_, py_ + 1) in rm: continue
        peb[(px_, py_)] = ('rock', 4 if k % 2 else 3); peb[(px_ + 1, py_)] = ('rock', 2) if k % 3 == 0 else peb.get((px_ + 1, py_), None)
        peb[(px_, py_ + 1)] = ('sand', 2)
    def f(x, y):
        if (x, y) in peb and peb[(x, y)]: return peb[(x, y)]
        if (x, y) in rm: return rm[(x, y)]
        return sand_base(x, y, 3)
    return f


def wrap(f):
    def g(c):
        for y in range(16):
            for x in range(16):
                r = f(x, y)
                if r: c.P(x, y, *r)
    return g


SAND_RULE = '사막의 기본 바닥. sand·sand-b·sand-ripple·sand-pebble 을 덩이 잡음으로 섞어 깐다(한 칸만 넓게 반복하지 않는다).'
T('sand', '잔잔한 모래', ['모래', '사막', '바탕'], SAND_RULE)(wrap(sand_tile(11, marks=1)))
T('sand-b', '잔잔한 모래(변주)', ['모래', '사막', '바탕'], SAND_RULE)(wrap(sand_tile(23, marks=2, lo=2, hi=4)))
T('sand-c', '잔잔한 모래(변주 2)', ['모래', '사막', '바탕'], SAND_RULE)(wrap(sand_tile(53, marks=1, lo=2, hi=3)))
T('sand-d', '잔잔한 모래(변주 3)', ['모래', '사막', '바탕'], SAND_RULE)(wrap(sand_tile(67, marks=0)))
T('sand-ripple', '바람 물결 모래', ['모래', '물결', '사막'], '트인 사막·사구 둘레에 덩이로. 길·광장 곁에는 잔잔한 모래.')(wrap(sand_tile(37, marks=4, lo=3, hi=6)))
T('sand-pebble', '자갈 섞인 모래', ['모래', '자갈', '사막'], '바위 둘레·폐허·길 가장자리에 드문드문.')(wrap(sand_tile(41, marks=1, pebbles=4)))


def road(x, y, s=5):
    """다진 흙길: 모래보다 한 단 어둡고 따뜻한 덩이 + 발굽·바퀴에 눌린 점."""
    x, y = W(x, y)
    t = 3
    r = rnd(x, y, s + 9)
    if r > 0.86: t = 4
    if r < 0.05: t = 2
    if r < 0.012: return ('adobe', 3)
    if r > 0.97: return ('sand', 5)
    # 작은 돌: 밝은 윗점 + 밑 그늘
    if rnd(x, y - 1, s + 13) < 0.025: return ('sand', 1)
    if rnd(x, y, s + 13) < 0.025: return ('rock', 4)
    return ('sand', t)


T('road', '다진 흙길', ['길', '흙길', '대상로'], '마을 큰길·대상 행로. 모래와는 road 왕 타일(de-road-*)로 이어 가장자리가 부드럽다.')(wrap(lambda x, y: road(x, y, 5)))
T('road-b', '다진 흙길(변주)', ['길', '흙길'], 'road 와 섞는다.')(wrap(lambda x, y: road(x, y, 19)))


def flag(x, y, s=7, tone=4):
    """사암 포석: 높이 5·6 줄 엇갈림, 돌마다 단 하나씩 다르게, 윗·왼 모서리 밝게, 줄눈 어둡게."""
    x, y = W(x, y)
    rows = (0, 8, 16)
    r = 0 if y < 8 else 1
    ly = y - rows[r]; hgt = rows[r + 1] - rows[r]
    offs = (0, 5)[r]
    widths = ((9, 7), (6, 10))[r]
    xs = (x + offs) % 16; acc = 0; col = 0
    for i, wv in enumerate(widths):
        if xs < acc + wv: col = i; lx = xs - acc; wcur = wv; break
        acc += wv
    if ly == hgt - 1 or lx == wcur - 1: return ('stone', 1)
    v = h32(col, r, s) % 4
    t = tone + (1 if v == 0 else -1 if v == 3 else 0)
    if ly == 0 or lx == 0: t += 1
    if ly == hgt - 2 and lx > 1: t -= 1
    q = rnd(x, y, s + 3)
    if q < 0.05: t -= 1
    return ('stone', max(1, min(6, t)))


T('flag', '사암 포석', ['포석', '광장', '궁전', '바자르'], '광장·궁전 마당·바자르 바닥. 모래와 만나는 가장자리는 flag 왕 타일(연석 테).')(wrap(lambda x, y: flag(x, y, 7)))
T('flag-b', '사암 포석(변주)', ['포석', '광장'], 'flag 와 섞는다.')(wrap(lambda x, y: flag(x, y, 29)))


def grass(x, y, s=5, base=3, dry=0.0):
    x, y = W(x, y)
    n = vnoise(x, y, s + 3, 4)          # 잔 덩이(4화소) — 칸마다 2×2 큰 얼룩이 반복돼 보이지 않게
    if dry and n < dry: return sand_base(x, y, s)
    t = base + 1 if n > 0.7 else base
    # 풀 포기: 밝은 끝 2화소 세로 + 밑동 어둡게(낱낱이, 주기 덩이 없음)
    if rnd(x, y, s + 11) < 0.06 or rnd(x, (y + 1) % 16, s + 11) < 0.06: t = min(5, t + 1)
    xb, yb = W(x, y - 1)
    if rnd(xb, (yb - 1) % 16, s + 11) < 0.06: t = base - 1
    if rnd(x, y, s + 31) < 0.03: t = base - 1
    return ('grass', t)


T('grass', '오아시스 풀밭', ['풀', '오아시스'], '오아시스 못 둘레·야자 밑. 모래와는 grass 왕 타일로 잇는다.')(wrap(lambda x, y: grass(x, y, 5)))
T('grass-b', '오아시스 풀밭(변주)', ['풀', '오아시스'], 'grass 와 섞는다.')(wrap(lambda x, y: grass(x, y, 17)))
T('grass-c', '오아시스 풀밭(변주 2)', ['풀', '오아시스'], 'grass·grass-b 와 섞는다.')(wrap(lambda x, y: grass(x, y, 29)))


def gravel(x, y, s=9):
    """사막 자갈밭(사막 포도): 모래 위 촘촘한 돌 — 어두운 돌·밝은 윗점."""
    x, y = W(x, y)
    b = sand_base(x, y, s)
    cx, cy = x // 3, y // 3
    if rnd(cx, cy, s) < 0.55:
        ox, oy = h32(cx, cy, s + 1) % 2, h32(cx, cy, s + 2) % 2
        lx, ly = x - cx * 3 - ox, y - cy * 3 - oy
        if 0 <= lx < 2 and 0 <= ly < 2:
            return ('rock', (4 if ly == 0 and lx == 0 else 3 if ly == 0 else 2))
        if 0 <= lx < 2 and ly == 2: return ('sand', 2)
    return (b[0], b[1] - 1)


T('gravel', '돌 깔린 사막(자갈밭)', ['자갈', '사막', '황무지'], '바위 언덕 발치·폐허 둘레·마을 밖 황무지에 덩이로.')(wrap(gravel))


def cracked(x, y, s=12):
    """마른 개울 바닥(갈라진 진흙): 주기 보로노이 조각 + 갈라진 틈."""
    x, y = W(x, y)
    pts = [((h32(i, 0, s) % 16), (h32(0, i, s) % 16)) for i in range(7)]
    ds = []
    for i, (px_, py_) in enumerate(pts):
        best = 99
        for ox in (-16, 0, 16):
            for oy in (-16, 0, 16):
                d = abs(x - px_ - ox) + abs(y - py_ - oy) * 1.2
                best = min(best, d)
        ds.append((best, i))
    ds.sort()
    if ds[1][0] - ds[0][0] < 1.1: return ('adobe', 2)
    i = ds[0][1]
    t = 5 if h32(i, 1, s) % 3 else 4
    if ds[1][0] - ds[0][0] < 2.2: t -= 1          # 조각 가장자리 말려 올라 어둡게
    if rnd(x, y, s) < 0.05: t = 6
    return ('adobe', t)


T('mud', '마른 개울 바닥(갈라진 진흙)', ['진흙', '와디', '마른 땅'], '마른 개울·말라 버린 못 자리에 길게.')(wrap(cracked))


# ═════════════════════ 모서리 왕 타일 ═════════════════════
WANG = {}          # set id -> list of (index, fn) ; index = NW*1 + NE*2 + SW*4 + SE*8


def field(cn, x, y, s, amp):
    """칸 안 화소 중심에서 모서리 값의 이중선형 + 감긴 잡음. B 쪽이면 > 0.5."""
    u, v = (x + 0.5) / 16, (y + 0.5) / 16
    nw, ne, sw, se = cn
    f = nw * (1 - u) * (1 - v) + ne * u * (1 - v) + sw * (1 - u) * v + se * u * v
    if amp: f += (vnoise(x, y, s, 8) - 0.5) * amp + (vnoise(x, y, s + 5, 4) - 0.5) * amp * 0.25
    return f


def wang_set(sid, name, A, B, deco, s, amp=0.42, tags=(), rules=''):
    """A(x,y)/B(x,y) = 바탕·덧 그림 함수, deco(isB, x, y, c, near) 가 경계 꾸밈. near(dx,dy) = 그 화소가 B 인가(칸 안 좌표, 칸 밖은 가장자리 값)."""
    for idx in range(16):
        cn = (idx & 1, (idx >> 1) & 1, (idx >> 2) & 1, (idx >> 3) & 1)

        def isB(x, y, cn=cn):
            x = min(15, max(0, x)); y = min(15, max(0, y))
            return field(cn, x, y, s, amp) > 0.5

        def draw(c, isB=isB):
            for y in range(16):
                for x in range(16):
                    b = isB(x, y)
                    r = deco(b, x, y, lambda dx, dy: isB(x + dx, y + dy))
                    if r is None: r = B(x, y) if b else A(x, y)
                    c.P(x, y, *r)
        R.add('%s-%d' % (sid, idx), '%s (모서리 %s)' % (name, ''.join('B' if v else 'A' for v in cn)), 1, 1, 'terrain',
              tags=list(tags) + ['모서리 타일', sid], rules=rules, wang=sid, corners=cn)(draw)
        WANG.setdefault(sid, []).append(idx)


SAND = lambda x, y: sand_base(x, y, 3)


def deco_road(b, x, y, near):
    if not b and (near(0, 1) or near(1, 0) or near(-1, 0) or near(0, -1)): return ('sand', 3)      # 길 가장자리 먼지 테
    if b and not near(0, -1): return ('sand', 4)                                                     # 길 북쪽 가장자리(턱 윗면) 한 줄 밝게
    return None


wang_set('road', '모래↔다진 흙길', SAND, lambda x, y: road(x, y, 5), deco_road, 51,
         tags=['길', '흙길'], rules='꼭짓점 격자에 «길»을 정하고 칸마다 네 모서리로 번호를 고른다(구성기가 한다). 손으로 칠할 때는 모서리 BBBB 가 순수 길.')


def deco_grass(b, x, y, near):
    if b and not near(0, 1): return ('grass', 1)                     # 풀 남쪽 끝 그늘(살짝 솟음)
    if b and not near(0, -1): return ('grass', 4)
    if not b and near(0, -1): return ('sand', 3)                     # 풀 밑 모래 그림자
    if not b and (near(1, 0) or near(-1, 0)) and rnd(x, y, 3) < 0.5: return ('grass', 2)   # 옆 가장자리 풀 포기
    return None


wang_set('grass', '모래↔오아시스 풀', SAND, lambda x, y: grass(x, y, 5), deco_grass, 63,
         tags=['풀', '오아시스'], rules='오아시스 못 둘레 풀밭 가장자리. 구성기가 꼭짓점 재질로 고른다.')


def water_px(x, y, s=4):
    x, y = W(x, y)
    n = vnoise(x, y, s, 8)
    t = 2 if n < 0.55 else 3
    # 짧은 가로 물결(밝은 줄 2~3화소)
    if (y + h32(x // 5, 0, s) % 4) % 5 == 0 and rnd(x // 3, y, s) < 0.35: t = 4
    return ('water', t)


def deco_water(b, x, y, near):
    """B=물. 북쪽 둑: 물 화소 위 1~3 화소가 땅이면 둑 앞면(흙 단). 다른 가장자리는 젖은 테 + 물가 밝은 물거품."""
    if b:
        up = [not near(0, -k) for k in (1, 2, 3)]
        if up[0]: return ('adobe', 4)            # 둑 위 모서리(빛)
        if up[1]: return ('adobe', 2)
        if up[2]: return ('adobe', 1)
        if not near(0, -4): return ('water', 0)  # 둑 밑 물에 진 그림자
        if not near(0, 1) or not near(1, 0) or not near(-1, 0): return ('water', 5)   # 남·옆 물가 물거품
        if not near(0, -4): return ('water', 1)
        return None
    if near(0, 1) or near(1, 0) or near(-1, 0) or near(0, -1): return ('grass', 1)    # 젖은 풀 테
    return None


wang_set('water', '오아시스 풀↔못물', lambda x, y: grass(x, y, 5), water_px, deco_water, 77, amp=0.36,
         tags=['물', '못', '오아시스'], rules='오아시스 못. 물은 풀 안에만 둔다(모래와 바로 닿지 않게 — 풀 띠 1칸 이상). 북쪽 둑은 흙 앞면이 보인다. 물 칸은 걸을 수 없다.')


def dune_top(x, y):
    """솟은 사구 윗면: 바람 물결 마루(주기 8화소, 가로 16화소 굽이 — 칸 이음매에서 이어진다).
    바람받이(마루 아래 북쪽)는 밝게 차오르고, 마루 바로 남쪽 바람그늘은 짧게 어둡다."""
    import math
    ph = (y + 2.2 * math.sin(2 * math.pi * x / 16) + 1.2 * math.sin(2 * math.pi * x / 8 + 1.3)) % 8
    if ph < 1: t = 6                       # 마루 빛
    elif ph < 2.2: t = 3                   # 바람그늘(짧고 짙게)
    elif ph < 3.6: t = 4
    else: t = 5                            # 바람받이 완만한 면
    if t == 5 and rnd(x, y, 9) < 0.06: t = 4
    if t == 4 and rnd(x, y, 11) < 0.05: t = 5
    return ('sand', t)


def deco_dune(b, x, y, near):
    if b:
        if not near(0, 1): return ('sand', 6)                         # 마루 끝 빛 한 줄
        if not near(1, 0) or not near(2, 0): return ('sand', 4)        # 동쪽 바람그늘
        return None
    if near(0, -1): return ('sand', 2)                                # 비탈 앞면(남쪽) — 그늘 짙게
    if near(0, -2): return ('sand', 3)
    if near(0, -3) and (x + y) % 2 == 0: return ('sand', 3)
    return None


wang_set('dune', '모래↔솟은 사구', SAND, dune_top, deco_dune, 89, amp=0.4,
         tags=['사구', '모래 언덕', '사막'], rules='트인 사막에 덩이로 놓아 평평한 모래를 깬다. 걸을 수 있다(낮은 모래 언덕). 마을 안·길 위에는 두지 않는다.')


def deco_flag(b, x, y, near):
    if b:
        if not near(0, -1): return ('stone', 6)          # 연석 윗면
        if not near(0, 1): return ('stone', 2)           # 연석 앞면
        if not near(-1, 0) or not near(1, 0): return ('stone', 3)
        return None
    if near(0, -1): return ('sand', 2)                   # 연석 밑 그림자
    return None


wang_set('flag', '모래↔사암 포석(연석)', SAND, lambda x, y: flag(x, y, 7), deco_flag, 97, amp=0.0,
         tags=['포석', '광장'], rules='광장·궁전 마당 가장자리. 연석 테가 둘린다. 구성기가 꼭짓점 재질로 고른다.')


def wang_sheet(sid):
    """한 벌 16장을 4×4 로(번호 순) — 관문은 이 묶음 그림 하나로 받는다(칸은 그림 안에 화소 그대로)."""
    from PIL import Image
    im = Image.new('RGBA', (64, 64))
    for idx in range(16):
        im.paste(R.render(R.by['%s-%d' % (sid, idx)]).img(), ((idx % 4) * 16, (idx // 4) * 16))
    return im


if __name__ == '__main__':
    import json
    rows = R.export()
    d = os.path.join(OUT, 'terrain', '_gate')
    keep = [r for r in rows if not any(r['png'] == 'de-%s-%d.png' % (sid, i) for sid in WANG for i in range(16))]
    for sid in WANG:
        wang_sheet(sid).save(os.path.join(d, 'de-wang-%s.png' % sid))
        keep.append(dict(png='de-wang-%s.png' % sid, kind='terrain', name='모서리 왕 타일 한 벌(%s, 4×4)' % sid, label='desert-east/de-wang-' + sid))
    for f in os.listdir(d):
        if f.endswith('.png') and f not in {r['png'] for r in keep}: os.remove(os.path.join(d, f))
    with open(os.path.join(d, 'items.jsonl'), 'w') as fh:
        for r in keep: fh.write(json.dumps(r, ensure_ascii=False) + '\n')
    print('terrain', len(R.items))
    ims = [(it['id'], R.render(it).img()) for it in R.items if not it.get('wang')]
    contact(ims, os.path.join(OUT, 'terrain', 'preview.png'), z=4)
