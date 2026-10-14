#!/usr/bin/env python3
"""modern_campus 바닥 — 불투명 16px 이음새 없는 타일(kind terrain). 모든 무늬는 16 주기로 감긴다.
  python3 terrain.py            # 내보내기 + 시트
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from px import C, rnd, h32, tex_brick
from kit import Reg, contact, OUT

R = Reg('terrain')


def T(id_, name, tags=(), rules='', **kw):
    return R.add(id_, name, 1, 1, 'terrain', tags=tags, rules=rules, **kw)


def wrap(f):
    def g(c):
        for y in range(16):
            for x in range(16):
                r = f(x, y)
                if r: c.P(x, y, *r)
    return g


def W(x, y): return x % 16, y % 16


# ── 잔디 ──
def vnoise(x, y, s, cell=4, per=16):
    """주기 per 로 감기는 값 잡음(격자 cell, 이중선형) 0..1."""
    n = per // cell
    gx, gy = x / cell, y / cell
    x0, y0 = int(gx) % n, int(gy) % n; fx, fy = gx - int(gx), gy - int(gy)
    v = lambda i, j: rnd(i % n, j % n, s)
    a = v(x0, y0) * (1 - fx) + v(x0 + 1, y0) * fx
    b = v(x0, y0 + 1) * (1 - fx) + v(x0 + 1, y0 + 1) * fx
    return a * (1 - fy) + b * fy


def grass(x, y, s=5, base=4, flowers=0.0):
    x, y = W(x, y)
    n = vnoise(x, y, s) * 0.65 + vnoise(x, y, s + 3, cell=8) * 0.35
    t = base - 1 if n < 0.30 else base + 1 if n > 0.74 else base
    # 풀 포기: 밝은 끝 + 그 밑 어두운 밑동
    if rnd(x, y, s + 11) < 0.075: t = min(base + 1, t + 1)
    xb, yb = W(x, y - 1)
    if rnd(xb, yb, s + 11) < 0.075: t = base - 1
    if flowers and rnd(x, y, s + 29) < flowers:
        return ('shiro', 4) if rnd(x, y, s + 31) < 0.6 else ('kii', 4)
    return ('ki', t)


T('lawn', '캠퍼스 잔디', ['잔디', '교정'], '넓은 잔디. lawn-b 와 섞어 깔면 무늬 반복이 안 보인다.')(wrap(lambda x, y: grass(x, y, 5)))
T('lawn-b', '캠퍼스 잔디(변주)', ['잔디', '교정'], 'lawn 과 칸마다 섞는다.')(wrap(lambda x, y: grass(x, y, 17)))
T('lawn-flower', '토끼풀 꽃 잔디', ['잔디', '꽃'], '잔디 가장자리·나무 밑에 드문드문.')(wrap(lambda x, y: grass(x, y, 23, flowers=0.035)))
T('lawn-shade', '그늘진 잔디(나무 밑)', ['잔디', '그늘'], '큰 나무 발밑 칸과 그 남동쪽 칸에.')(wrap(lambda x, y: grass(x, y, 41, base=3)))


# ── 포석 ──
def basket(x, y):
    """붉은 벽돌 바구니 짜기: 8×8 블록마다 가로 벽돌 둘 / 세로 벽돌 둘 번갈아."""
    x, y = W(x, y)
    bx, by = x // 8, y // 8; lx, ly = x % 8, y % 8
    horiz = (bx + by) % 2 == 0
    a, b = (ly, lx) if horiz else (lx, ly)
    k = a // 4; aa = a % 4
    if aa == 3 or b == 7: return ('renga', 2)
    v = h32(bx * 2 + k, by, 7) % 4
    t = 4 if v < 2 else 3 if v == 2 else 5
    if aa == 0 and b < 6: t += 1
    if aa == 2 and b > 4: t -= 1
    return ('renga', min(t, 6))


T('pave-brick', '붉은 벽돌 포석(바구니 짜기)', ['포석', '광장', '교정'], '정문 광장·건물 앞 마당. 한 장소에 바닥 재질은 하나만.')(wrap(basket))


def granite(x, y):
    x, y = W(x, y)
    row = y // 8; xs = (x + (4 if row % 2 else 0)) % 16; col = xs // 8
    lx, ly = xs % 8, y % 8
    if ly == 7 or lx == 7: return ('hodo', 2)
    base = 4 + (h32(col, row, 3) % 3 == 0) - (h32(col, row, 4) % 4 == 0)
    r = rnd(x, y, 9)
    t = base - 1 if r < 0.12 else base + 1 if r > 0.9 else base
    if ly == 0 or lx == 0: t = base + 1
    return ('hodo', min(6, t))


T('pave-granite', '화강암 판석', ['포석', '광장'], '중앙 광장·분수 둘레·동상 앞.')(wrap(granite))


def path_conc(x, y):
    x, y = W(x, y)
    if y == 15 or x == 15: return ('conc', 3)
    if y == 0 or x == 0: return ('conc', 5)
    r = rnd(x, y // 2, 13)
    t = 4 if r < 0.75 else 5 if r < 0.92 else 3
    if (x + y * 3) % 11 == 0 and rnd(x, y, 2) < 0.4: t = 3
    return ('conc', t)


T('pave-path', '콘크리트 산책길', ['길', '보행로'], '건물 사이 보행로. 잔디 가장자리 curb 조각과 잇는다.')(wrap(path_conc))


def sidewalk(x, y):
    """보도블록: 8×4 엇갈림, 회색·연분홍 섞임."""
    x, y = W(x, y)
    row = y // 4; xs = (x + (4 if row % 2 else 0)) % 16; col = xs // 8
    lx, ly = xs % 8, y % 4
    if ly == 3 or lx == 7: return ('hodo', 2)
    pink = h32(col, row, 21) % 5 == 0
    m = 'pinku' if pink else 'hodo'
    t = (2 if pink else 4) + (1 if ly == 0 else 0)
    if pink: t = 3 if ly == 0 else 2
    if not pink and rnd(x, y, 5) < 0.1: t -= 1
    return (m, t) if not pink else ('kawara', 5 if ly == 0 else 4)


T('sidewalk', '보도블록', ['보도', '길'], '학교 밖 차도 옆 인도.')(wrap(sidewalk))


def tactile(x, y):
    x, y = W(x, y)
    if x in (0, 15) or y in (0, 15): return ('kii', 1)
    if x % 4 == 2 and y % 4 == 2: return ('kii', 4)
    if x % 4 == 3 and y % 4 == 3: return ('kii', 1)
    return ('kii', 3)


T('tactile', '점자 블록(노랑)', ['보도', '점자블록'], '횡단보도 앞·정문 앞 한 줄.')(wrap(tactile))


# ── 차도 ──
def asphalt(x, y, s=31):
    x, y = W(x, y)
    r = rnd(x // 2 + (y % 2), y // 2, s); q = rnd(x, y, s + 1)
    t = 3 if r < 0.7 else 2
    if q < 0.05: t = 4
    elif q > 0.95: t = 1
    return ('yoru', t)


T('asphalt', '아스팔트 차도', ['차도', '주차장'], '교내 진입로·주차장.')(wrap(asphalt))
T('asphalt-dash', '차도 흰 점선(가로)', ['차도', '차선'], '두 차선 사이 가로줄 — 동서로 잇는다.')(wrap(lambda x, y: ('shiro', 3 if y == 7 else 2) if y in (7, 8) and x % 16 < 9 else asphalt(x, y)))
T('asphalt-yellow', '중앙선 황색 실선 두 줄(가로)', ['차도', '중앙선'], '차도 가운데 가로줄.')(wrap(lambda x, y: ('kii', 3) if y % 16 in (5, 9) else ('kii', 2) if y % 16 in (6, 10) else asphalt(x, y)))
T('crosswalk', '횡단보도', ['차도', '횡단보도'], '세로로 건너는 흰 띠 — 차도를 가로질러 한 줄.')(wrap(lambda x, y: (('shiro', 4 if y % 16 else 3) if x % 8 < 5 else asphalt(x, y)) if x % 8 < 5 and rnd(x, y, 3) > 0.04 else asphalt(x, y)))
T('parking-line', '주차 칸 선(세로)', ['주차장'], '주차장 칸 사이 — 칸 왼쪽에 흰 세로선.')(wrap(lambda x, y: ('shiro', 3) if x % 16 in (1, 2) and y % 16 > 1 else asphalt(x, y)))


# ── 운동장 ──
def track(x, y):
    x, y = W(x, y)
    r = rnd(x // 2, y // 2, 51); q = rnd(x, y, 52)
    t = 3 if r < 0.75 else 4
    if q < 0.05: t = 2
    return ('kawara', t)


T('track', '육상 트랙(붉은 우레탄)', ['운동장', '트랙'], '운동장 둘레 띠, 폭 3~4칸.')(wrap(track))
T('track-line', '트랙 레인 선(가로)', ['운동장', '트랙'], '트랙 띠 안에서 레인을 가르는 가로줄.')(wrap(lambda x, y: ('shiro', 3 if (x % 16) % 8 else 2) if y % 16 == 7 else track(x, y)))
T('track-line-v', '트랙 레인 선(세로)', ['운동장', '트랙'], '트랙이 남북으로 돌 때.')(wrap(lambda x, y: ('shiro', 3) if x % 16 == 7 else track(x, y)))


def turf(x, y, light=True):
    x, y = W(x, y)
    base = 5 if light else 4
    r = rnd(x, y, 61 if light else 62)
    t = base - 1 if r < 0.14 else base
    if rnd(x, y - 1, 63) < 0.05: t = base + (0 if base == 6 else 1)
    return ('ki', t)


T('turf-a', '인조잔디 구장(밝은 줄)', ['운동장', '축구장'], '구장은 turf-a·turf-b 를 세로 띠로 번갈아(1칸씩) 깐다.')(wrap(lambda x, y: turf(x, y, True)))
T('turf-b', '인조잔디 구장(어두운 줄)', ['운동장', '축구장'], 'turf-a 와 세로 띠로 번갈아.')(wrap(lambda x, y: turf(x, y, False)))
T('turf-line-h', '구장 흰 선(가로)', ['운동장', '축구장'], '터치라인·하프라인.')(wrap(lambda x, y: ('shiro', 4 if x % 2 else 3) if y % 16 in (7, 8) else turf(x, y)))
T('turf-line-v', '구장 흰 선(세로)', ['운동장', '축구장'], '골라인·하프라인 세로.')(wrap(lambda x, y: ('shiro', 4 if y % 2 else 3) if x % 16 in (7, 8) else turf(x, y)))
T('turf-line-c', '구장 흰 선 교차', ['운동장', '축구장'], '하프라인과 터치라인이 만나는 칸.')(wrap(lambda x, y: ('shiro', 4) if (x % 16 in (7, 8) or y % 16 in (7, 8)) else turf(x, y)))


def dirt(x, y):
    x, y = W(x, y)
    n = vnoise(x, y, 71) * 0.6 + vnoise(x, y, 74, cell=8) * 0.4; q = rnd(x, y, 72)
    t = 2 if n < 0.3 else 4 if n > 0.72 else 3
    if rnd(x, y, 75) < 0.06: t = 4
    if rnd(x, y - 1, 75) < 0.06: t = 2
    if q < 0.02: return ('hodo', 5)
    if q > 0.98: return ('soil', 1)
    return ('soil', t)


T('dirt', '흙 운동장', ['운동장', '흙'], '한국 학교 운동장 바닥. 넓게.')(wrap(dirt))
T('dirt-line', '흙 운동장 흰 선(가로, 석회)', ['운동장', '흙'], '흙 운동장 위 석회 선.')(wrap(lambda x, y: ('shiro', 3 if rnd(x, y, 5) > 0.2 else 2) if y % 16 in (7, 8) and rnd(x, y, 6) > 0.08 else dirt(x, y)))


def bed(x, y):
    x, y = W(x, y)
    r = rnd(x // 2, y // 2, 81); q = rnd(x, y, 82)
    t = 1 if r < 0.55 else 2
    if q < 0.06: t = 3
    return ('soil', t)


T('bed-soil', '화단 흙(덮개 나무껍질)', ['화단'], '화단 안쪽 — 관목·꽃 소품을 얹는다.')(wrap(bed))


# ── 잔디 경계석(잔디가 한 칸 안쪽, 경계석이 길 쪽 변) ──
def curb_cell(x, y, n=False, s=False, w=False, e=False, inner=None):
    """잔디 칸에 경계석: 변마다 3px 화강암. 남쪽 변은 윗면 2 + 앞면 1(어둡게), 북쪽 변은 윗면 + 뒤 그늘."""
    x, y = x % 16, y % 16
    g = grass(x, y, 5)
    if s and y >= 13: return ('hodo', 6 if y == 13 else 5 if y == 14 else 2)
    if n and y <= 2: return ('hodo', 5 if y == 0 else 4 if y == 1 else 2)
    if w and x <= 2: return ('hodo', 6 if x == 0 else 5 if x == 1 else 3)
    if e and x >= 13: return ('hodo', 3 if x == 15 else 5 if x == 14 else 4)
    if inner:
        # 안쪽 모서리: 한 귀퉁이 3×3 만 경계석
        cx, cy = inner
        if (x <= 2 if cx == 'w' else x >= 13) and (y <= 2 if cy == 'n' else y >= 13):
            return ('hodo', 5)
    # 경계석 안쪽 1px 접촉 그늘
    if (s and y == 12) or (n and y == 3) or (w and x == 3) or (e and x == 12): return ('ki', 2)
    return g


for key, kw, ko in [('n', dict(n=True), '북'), ('s', dict(s=True), '남'), ('w', dict(w=True), '서'), ('e', dict(e=True), '동'),
                    ('nw', dict(n=True, w=True), '북서'), ('ne', dict(n=True, e=True), '북동'), ('sw', dict(s=True, w=True), '남서'), ('se', dict(s=True, e=True), '남동'),
                    ('in-nw', dict(inner=('w', 'n')), '안쪽 북서'), ('in-ne', dict(inner=('e', 'n')), '안쪽 북동'),
                    ('in-sw', dict(inner=('w', 's')), '안쪽 남서'), ('in-se', dict(inner=('e', 's')), '안쪽 남동')]:
    T('curb-' + key, '잔디 경계석(%s 변)' % ko, ['잔디', '경계석'],
      '잔디 구역 가장자리 칸 — 경계석이 %s쪽 길과 맞닿는다. 잔디 사각 둘레를 변·모서리 조각으로 감싼다.' % ko)(wrap(lambda x, y, kw=kw: curb_cell(x, y, **kw)))


def sheet(path=None, z=4):
    items = [(it['id'], R.render(it).img()) for it in R.items]
    return contact(items, path or os.path.join(OUT, 'terrain', 'preview.png'), z=z)


if __name__ == '__main__':
    R.export(); sheet()
    print(len(R.items), 'terrain')
