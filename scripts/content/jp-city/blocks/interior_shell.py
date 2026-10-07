#!/usr/bin/env python3
"""jp_city 블록 interior_shell — 일본 실내 구조: 바닥(짜임 주기)·벽면(2줄)·천장 띠·공허.
  python3 scripts/content/jp-city/blocks/interior_shell.py     # selftest + tiledata/jp-city/blocks/interior_shell/_all-x3.png
틀(그림자 변형·칸 자르기·사양)은 interior/ikit.py. 여기는 표면 그림만 그린다(세계 좌표 그림 — 주기 안에서 칸마다 같은 무늬가 되풀이되면 안 된다).
바닥은 대비를 낮게(4~5단 램프 안), 벽은 2줄(위 줄 밝게·아래 줄 한 단 어둡게)+맨 아래 걸레받이. 위 4줄 그늘은 틀이 얹는다.
무작위는 전부 좌표 해시(결정적) — 실행할 때마다 같은 그림. 해시 입력은 주기 안 좌표라 이음매가 없다."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'interior'))
from ikit import Registry, K, OL, default_ceiling, run_block, ROOT   # noqa: E402,F401

BLOCK = 'interior_shell'
R = Registry(BLOCK, '일본 실내 구조')
R.add_void()

_KC = {}


def kc(ramp, t):
    """K 를 부르되 램프 범위를 벗어나면 가장 가까운 단으로(램프마다 5단/7단이 다르다)."""
    key = (ramp, t)
    if key not in _KC:
        tt = t
        while True:
            try: _KC[key] = K(ramp, tt); break
            except Exception:
                if tt == 0: raise
                tt += -1 if tt > 0 else 1
    return _KC[key]


def hs(x, y, s=0):
    """좌표 해시 0..65535."""
    n = (x * 374761393 + y * 668265263 + s * 2246822519 + 12345) & 0xffffffff
    n = ((n ^ (n >> 13)) * 1274126177) & 0xffffffff
    return (n ^ (n >> 16)) & 0xffff


def rnd(x, y, s, per):
    """per/1000 확률로 참."""
    return hs(x, y, s) % 1000 < per


@R.ceiling('default', '기본 천장 띠', desc='벽 위 어두운 천장 띠, 실내 쪽 밝은 테두리')
def _ceil(c, bits): default_ceiling(c, bits)


# ───────────── 바닥 ─────────────
def _planks(ramp, hi, mid, lo, seed):
    """널 마루: 널 폭 4px(가로 줄), 줄마다 이음새 두 개. 128×64 주기.

    이음새: 같은 칸 줄(16px = 널 4줄) 안의 이웃 줄과는 10px 이상, 칸 줄 경계(널 줄 3|4·7|8·11|12·15|0)에서는
    x 를 16 으로 나눈 나머지가 3 이상 어긋나게 고른다 — 바닥은 칸 줄마다 16px 배수로 밀려 깔리므로(lay rowShift)
    경계 너머 이음새와의 거리는 나머지만 남는다. 안 지키면 짙은 틱이 쌍으로 붙어 반복 표지가 됐다(관문 11회차).
    광택: 널 셋 중 하나에, 널 한 장 안에서만 이음새에서 3px 이상 떨어진 짧은 줄(4~9px, 절반은 한 칸 건너 점선).
    널 전체·긴 줄 광택은 칸을 넘는 밝은 띠가 되어 넓은 바닥에서 줄 서 보였다(2026-10-07 두 번)."""
    def d(c):
        W, H = c.w, c.h
        rows = H // 4

        def gap(p, q, m):
            dd = abs(p - q) % m
            return min(dd, m - dd)

        def fits(cand, other, boundary):
            return all((gap(p % 16, q % 16, 16) >= 3) if boundary else (gap(p, q, W) >= 10) for p in other for q in cand)

        seams = []
        for r in range(rows):
            for k in range(200):
                a = (r * 37 + 11 + hs(r, k, seed) % 97) % W
                b = (a + 48 + hs(r, k + 500, seed) % 32) % W
                ok = not seams or fits((a, b), seams[r - 1], r % 4 == 0)
                if ok and r == rows - 1: ok = fits((a, b), seams[0], True)
                if ok: break
            seams.append((a, b))
        for y in range(H):
            r = y // 4; yy = y % 4
            a, b = seams[r]
            for x in range(W):
                # 이 점이 속한 널(이음새 사이 구간)을 id 로, 널 시작·길이
                if a < b: bid = 0 if a <= x < b else 1
                else: bid = 0 if (x >= a or x < b) else 1
                s0, e0 = (a, b) if bid == 0 else (b, a)
                length = (e0 - s0) % W
                pos = (x - s0) % W
                col = mid
                if yy == 0 and hs(r, bid, seed + 5) % 3 == 0:
                    ln = 4 + hs(r, bid, seed + 8) % 6
                    st = 3 + hs(r, bid, seed + 7) % max(1, length - ln - 6)
                    dotted = hs(r, bid, seed + 9) % 2 == 1
                    if st <= pos < st + ln and (not dotted or (pos - st) % 2 == 0): col = hi
                if yy == 3: col = lo                          # 널 사이 홈
                if x == a or x == b:                          # 이음새(머리 맞댐)
                    col = lo
                elif yy in (1, 2) and rnd(x // 4, r, seed + 9, 55) and (x % 4) == 1:
                    col = lo                                  # 성긴 나뭇결 점
                c.P(x, y, col)
    return d


@R.floor('flooring', '플로어링(나무 마루)', cols=8, rows=4, tags=('거실', 'LDK', '복도', '양실'), desc='밝은 나무 널 마루(フローリング) — 양실·LDK·복도.', lay='rowShift')
def _flooring(c): _planks('yuka', kc('yuka', 1), kc('yuka', 0), kc('yuka', -1), 1)(c)


@R.floor('flooring-dark', '짙은 플로어링', cols=8, rows=4, tags=('거실', '복도', '침실'), desc='짙은 나무 마루 — 복도·양실.', lay='rowShift')
def _flooring_dark(c): _planks('ita', kc('ita', 1), kc('ita', 0), kc('ita', -1), 2)(c)


# 다다미: 4×4칸 주기(토러스) 안에 8장(1장 = 1×2칸 = 16×32px). 가로 4장·세로 4장이 풍차처럼 엇갈려 十 교차가 없다(어디서나 T 접합).
# 주기 가장자리를 가로지르는 장은 세계 좌표(%64)로 그려 3×3 로 이어 붙여도 잘리지 않는다.
_TAT = [(0, 0, 'H'), (2, 0, 'V'), (3, 3, 'V'), (3, 1, 'H'), (1, 1, 'V'), (0, 2, 'V'), (2, 2, 'H'), (1, 3, 'H')]
# (x, y) = 장의 왼쪽/위쪽 칸(주기 안, 가장자리 넘김 포함), 순서 = 아래 격자 번호
_TAT_GRID = ((0, 0, 1, 2), (3, 4, 1, 3), (5, 4, 6, 6), (5, 7, 7, 2))


HERI_W = 2                                                        # 긴 변 헤리(縁) 두께 2px


@R.floor('tatami', '다다미', cols=4, rows=4, tags=('화실', '和室'), desc='다다미(畳) — 화실. 한 장 = 1×2칸, 긴 변에만 2px 헤리(縁), 풍차 엇갈림.')
def _tatami(c):
    heri = kc('midori', -2)                                       # 검은빛 초록 헤리 — 매트 경계가 한눈에 읽힌다
    heri_in = kc('midori', -1)
    seam = kc('kinari', -2)
    for y in range(c.h):
        for x in range(c.w):
            mid = _TAT_GRID[(y // 16) % 4][(x // 16) % 4]
            mx, my, o = _TAT[mid]
            # 장의 왼쪽 위 기준 좌표 (주기 %64 로 감싸기 — 가장자리를 넘는 장도 이어진다)
            lx = (x - mx * 16) % 64; ly = (y - my * 16) % 64
            if o == 'H': e0 = ly; e1 = 15 - ly; s0 = lx; s1 = 31 - lx
            else: e0 = lx; e1 = 15 - lx; s0 = ly; s1 = 31 - ly
            ed = min(e0, e1)
            if ed < HERI_W: col = heri if ed == 0 else heri_in    # 긴 변: 바깥 1px 어두운 초록 + 안쪽 1px 한 단 밝은 초록
            elif min(s0, s1) == 0: col = seam                     # 짧은 변: 헤리 없음, 가는 이음선 1px
            else:
                # 결: 긴 방향으로 1px 간격 가는 줄, 아주 낮은 대비
                stripe = (e0 + (mid % 2)) % 2
                col = kc('kinari', 1) if stripe else kc('kinari', 0)
                if rnd(s0 // 3, e0, 30 + mid, 40): col = kc('kinari', 0) if stripe else kc('kinari', 1)
            c.P(x, y, col)


@R.floor('cushion', '쿠션 플로어', cols=4, rows=4, tags=('부엌', '화장실', '탈의실'), desc='비닐 쿠션 플로어 — 부엌·화장실·탈의실.')
def _cushion(c):
    base = kc('kinari', 1); dot = kc('kinari', 0)
    for y in range(c.h):
        for x in range(c.w):
            # 엇갈린 작은 십자 무늬(8px 격자, 줄마다 반 칸 엇갈림) — 아주 옅게
            row = y // 8
            lx = (x + (4 if row % 2 else 0)) % 8; ly = y % 8
            col = base
            if (lx, ly) in ((3, 3), (2, 3), (4, 3), (3, 2), (3, 4)): col = dot
            elif rnd(x, y, 7, 25): col = dot
            c.P(x, y, col)


@R.floor('bathtile', '욕실 바닥 타일', cols=4, rows=4, tags=('욕실',), desc='작은 미끄럼 방지 타일 — 욕실.')
def _bathtile(c):
    g = kc('conc', -1)
    for y in range(c.h):
        for x in range(c.w):
            tx, ty = x // 4, y // 4
            if x % 4 == 0 or y % 4 == 0: col = g
            else:
                col = kc('conc', 1) if hs(tx, ty, 11) % 4 else kc('conc', 0)
                if x % 4 == 1 and y % 4 == 1: col = kc('shiro', 0)      # 윗왼 모서리 반사
                elif x % 4 == 3 and y % 4 == 3: col = kc('conc', 0)
            c.P(x, y, col)


@R.floor('tataki', '현관 타타키', cols=4, rows=4, tags=('현관',), desc='현관 신발 벗는 곳 바닥(돌·타일). 마루보다 한 단 낮다.')
def _tataki(c):
    g = kc('hodo', -1); a = kc('hodo', 0); b = kc('hodo', 1)
    for y in range(c.h):
        for x in range(c.w):
            # 16×16 돌판, 판마다 톤이 조금 다르다, 줄눈은 1px
            tx, ty = x // 16, y // 16
            lx, ly = x % 16, y % 16
            if lx == 0 or ly == 0: col = g
            else:
                col = a if hs(tx, ty, 21) % 3 else b
                if lx == 1 or ly == 1: col = b if col == a else a      # 판 윗왼 모서리 살짝
                if rnd(x, y, 22, 70): col = g if rnd(x, y, 23, 500) else b       # 모래알
            c.P(x, y, col)


@R.floor('carpet', '카펫', cols=4, rows=4, tags=('침실', '아이방', '원룸'), desc='털 짧은 카펫 — 양실 침실·아이방. 낮은 채도의 먹감청 한 색.')
def _carpet(c):
    # 채도를 눌렀다: 팥색(aka)은 이불의 붉은색과 부딪혀 한 덩어리로 읽혔다 → 어두운 청회색(garasu 낮은 단) 한 색, 4톤 저대비 짜임.
    # 마루(갈색)·타타키(밝은 보라회색)와 명도·색상이 모두 다르다. 얼룩·무작위 점 없음.
    base = kc('garasu', -2); hi = kc('garasu', -1); lo = kc('garasu', -3)
    for y in range(c.h):
        for x in range(c.w):
            col = base
            # 4×4 칸마다 2px 짧은 결, 칸이 바뀔 때 가로·세로가 번갈아(바구니 짜임)
            cx, cy = x // 4, y // 4; lx, ly = x % 4, y % 4
            if (cx + cy) % 2 == 0:
                if ly == 1 and lx in (1, 2): col = hi
                elif ly == 3 and lx in (1, 2): col = lo
            else:
                if lx == 1 and ly in (1, 2): col = hi
                elif lx == 3 and ly in (1, 2): col = lo
            c.P(x, y, col)


# ───────────── 벽면(2줄 = 32px) ─────────────
def _wall_tone(x, y, up, low, split=16, band=3):
    """위 줄 색 up, 아래 줄 색 low — 경계 band 줄은 체크 디더."""
    if y < split - band: return up
    if y >= split + band: return low
    return up if ((x + y) % 2 == 0) == (y < split) else low


def _baseboard(c, rim, hi, mid, lo, h=4):
    """맨 아래 걸레받이: 윗선 하이라이트·몸통·바닥선."""
    for x in range(c.w):
        c.P(x, c.h - h, hi)
        for y in range(c.h - h + 1, c.h - 1): c.P(x, y, mid)
        c.P(x, c.h - 1, lo)


@R.wall('cloth', '흰 벽지(クロス)', cols=4, tags=('거실', '양실', 'LDK'), desc='흰 비닐 벽지 — 아랫단에 걸레받이.')
def _cloth(c):
    up = kc('shiro', 0); low = kc('shiro', -1); hi = kc('shiro', 1)
    for y in range(32):
        for x in range(c.w):
            col = _wall_tone(x, y, up, low)
            if x % 4 == 1 and y % 3 != 0 and rnd(x, y, 41, 120): col = low if col == up else col   # 비닐 결: 세로 짧은 점
            elif rnd(x, y, 42, 40): col = hi if col == up else up
            c.P(x, y, col)
    for x in range(c.w): c.P(x, 27, kc('shiro', -1))       # 걸레받이 위 그림자 줄
    _baseboard(c, None, kc('ita', 1), kc('ita', 0), kc('ita', -2))


@R.wall('cloth-beige', '베이지 벽지', cols=4, tags=('거실', '침실'), desc='연한 베이지 벽지 — 침실·아이방.')
def _cloth_beige(c):
    up = kc('kinari', 1); low = kc('kinari', 0); dk = kc('kinari', -1)
    for y in range(32):
        for x in range(c.w):
            col = _wall_tone(x, y, up, low)
            if x % 2 == 0 and rnd(x // 2, y // 2, 51, 150): col = low if col == up else dk      # 가는 세로 섬유
            c.P(x, y, col)
    for x in range(c.w): c.P(x, 27, dk)
    _baseboard(c, None, kc('ita', 1), kc('ita', 0), kc('ita', -2))


@R.wall('juraku', '화실 흙벽(聚楽)', cols=4, tags=('화실', '和室'), desc='모래 섞인 흙벽 + 나무 기둥(柱)·나게시(長押) — 화실.')
def _juraku(c):
    up = kc('kinari', 0); low = kc('kinari', -1)
    for y in range(32):
        for x in range(c.w):
            base = _wall_tone(x, y, up, low)
            col = base
            n = hs(x, y, 61) % 100
            if n < 7: col = kc('kinari', 1) if base == up else kc('kinari', 0)       # 밝은 모래알
            elif n < 13: col = kc('kinari', -1) if base == up else kc('kinari', -2)   # 어두운 알
            c.P(x, y, col)
    # 나게시(長押): 위 줄 가운데 가로 띠 3px + 아래 그림자 1px
    ny = 7
    for x in range(c.w):
        c.P(x, ny, kc('ita', 1)); c.P(x, ny + 1, kc('ita', 0)); c.P(x, ny + 2, kc('ita', -1))
        c.P(x, ny + 3, kc('kinari', -2))
    # 기둥(柱): 주기에 하나, 폭 4px — 왼쪽 밝고 오른쪽 어둡다
    px = 27
    for y in range(32):
        c.P(px, y, kc('ita', 1)); c.P(px + 1, y, kc('ita', 0)); c.P(px + 2, y, kc('ita', 0)); c.P(px + 3, y, kc('ita', -1))
        c.P(px + 4, y, kc('kinari', -2))                       # 오른쪽 그림자(빛이 왼쪽 위)
        if y % 7 == 3: c.P(px + 1, y, kc('ita', -1)); c.P(px + 2, y + 1 if y < 31 else y, kc('ita', 1))   # 나뭇결
    # 다타미요세(畳寄せ): 얇은 나무 걸레받이 3px
    for x in range(c.w):
        c.P(x, 28, kc('kinari', -2))
        if px <= x <= px + 3: continue
        c.P(x, 29, kc('ita', 1)); c.P(x, 30, kc('ita', 0)); c.P(x, 31, kc('ita', -2))
    for y in (29, 30, 31):                                      # 기둥 밑동은 기둥 색 그대로
        for x in range(px, px + 4):
            c.P(x, y, kc('ita', 1 if x == px else (-1 if x == px + 3 else 0)) if y < 31 else kc('ita', -2))


@R.wall('bathwall', '욕실 벽 패널', cols=4, tags=('욕실',), desc='욕실 벽 패널/타일.')
def _bathwall(c):
    up = kc('shiro', 1); low = kc('shiro', 0); grout = kc('shiro', -1)
    for y in range(32):
        for x in range(c.w):
            # 큰 패널 16×16 — 줄눈 1px, 윗왼 모서리 반사 한 점
            lx, ly = x % 16, y % 16
            base = _wall_tone(x, y, up, low)
            col = base
            if lx == 0 or ly == 0: col = grout
            elif lx == 1 and ly in (1, 2): col = kc('shiro', 1)
            elif ly == 1 and lx in (1, 2, 3): col = kc('shiro', 1)
            c.P(x, y, col)
    for x in range(c.w):
        c.P(x, 28, kc('conc', 1)); c.P(x, 29, kc('conc', 0)); c.P(x, 30, kc('conc', -1)); c.P(x, 31, kc('conc', -2))


@R.wall('kitchen-panel', '부엌 벽 패널', cols=4, tags=('부엌',), desc='조리대 뒤 키친 패널(타일 무늬).')
def _kitchen(c):
    up = kc('shiro', 1); low = kc('shiro', 0); grout = kc('conc', 0)
    for y in range(32):
        for x in range(c.w):
            # 8×8 작은 타일, 줄눈은 회색 1px, 줄마다 반 칸 엇갈림 없이 격자
            lx, ly = x % 8, y % 8
            base = _wall_tone(x, y, up, low)
            col = base
            if lx == 0 or ly == 0: col = grout
            elif lx == 1 and ly == 1: col = kc('shiro', 1) if base == low else kc('shiro', 1)
            elif lx == 7 and ly == 7: col = kc('conc', 1)
            c.P(x, y, col)
    for x in range(c.w): c.P(x, 31, kc('conc', -1))


def build(): return R.build()
def selftest(): return R.selftest()


if __name__ == '__main__':
    sys.exit(1 if run_block(R, os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks', BLOCK)) else 0)
