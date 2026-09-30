#!/usr/bin/env python3
"""강남·현대 세트 v35-A — 1칸=16px=1m(§12) 표준 캔버스에 손으로 다시 찍은 3/4 후보 5종.
좌표 붓(rect/px/hline)으로 한 화소씩 놓는다. 생성 이미지·트레이싱·h34-B 참조 없음.
  python3 scripts/content/atlas-pick/make_v35_modern.py            # 5종 .pxg 를 후보 폴더에 쓴다
캔버스·치수 근거는 tiledata/atlas-pick/size-audit.json 의 basis (F 앞면 · T 윗면 · wpx 폭)."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from pxg_emit import emit
CAND = os.path.abspath(os.path.join(HERE, '..', '..', '..', 'tiledata', 'atlas-pick', 'candidates-modern'))

class G:
    def __init__(s, w, h): s.w, s.H = w, h; s.g = [['.'] * w for _ in range(h)]
    def px(s, x, y, c):
        assert 0 <= x < s.w and 0 <= y < s.H, (x, y, c); s.g[y][x] = c
    def rect(s, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): s.px(x, y, c)
    def h(s, x0, x1, y, c): s.rect(x0, y, x1, y, c)
    def v(s, x, y0, y1, c): s.rect(x, y0, x, y1, c)
    def put(s, x0, y0, rows):
        for j, r in enumerate(rows):
            for i, c in enumerate(r):
                if c != ' ': s.px(x0 + i, y0 + j, c)
    def rows(s): return [''.join(r) for r in s.g]
    def show(s): print('\n'.join(''.join(r) for r in s.g))

def write(slug, g, legend, title, tag='v35-A'):
    rows = g.rows()
    txt = emit(rows, legend, title).replace('@palette palette.pal', '@palette ../../palette/modern3.pal')
    p = os.path.join(CAND, slug, tag + '.pxg')
    open(p, 'w', encoding='utf-8').write(txt)
    print(slug, g.w, 'x', g.H, '->', p)

# ---------------------------------------------------------------- 1. 배달 오토바이 32x32 (폭 29 · F18 · T6)
def scooter():
    g = G(32, 32)
    L = {
        's': ('sumi', 0), 'o': ('sumi', 1), 'n': ('sumi', 2),
        'R': ('aka', 4), 'r': ('aka', 3), 'q': ('aka', 2), 'p': ('aka', 1),
        'w': ('shiro', 3), 'v': ('shiro', 1),
        'T': ('tekko', 5), 't': ('tekko', 4), 'u': ('tekko', 3), 'y': ('tekko', 2), 'z': ('tekko', 1),
        'k': ('kii', 3), 'K': ('kii', 4),
    }
    # 뒷상자 윗면 T=6 (y8..13): 뒤 윤곽선 → 밝은 판 → 앞 가장자리 하이라이트
    g.h(2, 15, 8, 's')
    g.rect(2, 9, 2, 22, 's'); g.rect(15, 9, 15, 22, 's')
    g.rect(3, 9, 14, 12, 'r')
    g.h(3, 14, 9, 'R')                      # 왼쪽 위 빛: 뒤쪽 모서리에 밝은 줄
    g.v(3, 9, 12, 'R')
    g.h(3, 14, 13, 'R')                     # 앞 가장자리 하이라이트
    g.px(14, 9, 'r')
    # 뚜껑 이음(윗면 위 가는 줄) : 뒤에서 세 번째 줄
    g.h(5, 12, 11, 'q')
    # 앞면 F: 상자 옆 (y14..22)
    g.rect(3, 14, 14, 14, 'p')              # 처마 그림자
    g.rect(3, 15, 14, 21, 'q')
    g.h(3, 14, 22, 'p')
    g.v(3, 15, 21, 'r')                     # 왼쪽 밝은 모서리
    g.rect(6, 17, 11, 19, 'w'); g.h(6, 11, 19, 'v')   # 흰 로고 띠
    g.rect(8, 18, 9, 18, 'q')               # 로고 점
    # 시트(등받이 없이 납작) y16..20
    g.h(17, 24, 16, 's'); g.h(17, 24, 17, 't'); g.h(17, 24, 18, 'y'); g.h(17, 24, 19, 'z')
    g.v(16, 17, 19, 's'); g.v(25, 17, 19, 's'); g.h(17, 24, 20, 's')
    # 몸체 덮개(빨강) y21..24
    g.rect(16, 21, 22, 24, 'q'); g.h(16, 22, 21, 'r'); g.v(16, 21, 24, 'r'); g.h(16, 22, 24, 'p')
    g.h(15, 23, 25, 's')
    # 발판 y25..26
    g.rect(13, 25, 24, 25, 't'); g.rect(13, 26, 24, 26, 'y'); g.h(13, 24, 27, 's')
    # 앞 핸들 기둥 + 핸들 + 전조등
    g.rect(26, 14, 27, 27, 'u'); g.v(26, 14, 27, 't'); g.v(28, 14, 27, 's')
    g.h(24, 29, 12, 't'); g.h(24, 29, 13, 'y'); g.h(24, 29, 11, 's'); g.h(24, 29, 14, 's')
    g.rect(29, 15, 30, 18, 'k'); g.px(29, 15, 'K'); g.v(31, 15, 18, 's'); g.h(29, 30, 19, 's')
    # 앞바퀴 흙받이
    g.h(22, 30, 22, 's'); g.h(22, 30, 23, 'q'); g.h(23, 29, 23, 'r'); g.h(22, 29, 24, 'p')
    wheel = ["..sssss..", ".sooooos.", "soouuuoos", "soutttuos", "soutytuos", "soutttuos", "soouuuoos", ".sooooos.", "..sssss.."]
    g.put(3, 23, [r.replace('.', ' ') for r in wheel])   # 뒷바퀴 x3..11 y23..31
    g.put(22, 23 + 0, [r.replace('.', ' ') for r in wheel][0:0])
    g.put(22, 23, [r.replace('.', ' ') for r in wheel][2:])   # 앞바퀴는 흙받이 밑에서 시작
    # 앞바퀴가 위로 흙받이와 겹치지 않도록 윗 두 줄을 흙받이로 대체했으니 바퀴 몸통 y25..31
    return g, L

# ---------------------------------------------------------------- 2. 보행 신호등 16x48 (폭 6 · F40 · T3)
def ped_signal():
    g = G(16, 48)
    L = {
        's': ('sumi', 0), 'o': ('sumi', 1),
        'T': ('tekko', 6), 't': ('tekko', 5), 'a': ('tekko', 4), 'u': ('tekko', 3), 'y': ('tekko', 2), 'z': ('tekko', 1),
        'R': ('aka', 4), 'r': ('aka', 3), 'p': ('aka', 1),
        'G': ('midori', 3), 'g': ('midori', 1), 'h': ('midori', 0),
        'k': ('kii', 3), 'j': ('kii', 1),
    }
    x0, x1 = 5, 10
    # 머리 윗면 T=3 (y5..7)
    g.h(x0, x1, 5, 's')
    g.h(x0 + 1, x1 - 1, 6, 'a'); g.h(x0 + 1, x1 - 1, 7, 'T')
    g.v(x0, 6, 18, 's'); g.v(x1, 6, 18, 's')
    # 앞면: 처마 그림자 + 윗등(빨강, 켜짐) + 칸막이 + 아랫등(초록, 꺼짐)
    g.h(x0 + 1, x1 - 1, 8, 'z')
    g.rect(6, 9, 9, 12, 'p')
    g.put(6, 9, [" rr ", "rrrr", " rr ", "r  r"])   # 서 있는 사람(빨강) — 가로 4 · 세로 4
    g.px(7, 9, 'R'); g.px(8, 9, 'R')
    g.h(6, 9, 13, 'y')
    g.rect(6, 14, 9, 17, 'h')
    g.put(6, 14, [" gg ", "gg  ", " gg ", "g g "])     # 걷는 사람(초록, 꺼진 상태 — 어두운 램프)
    g.h(x0, x1, 18, 's')
    # 기둥 (오른쪽 하나는 어둡게) y19..45
    g.rect(7, 19, 7, 45, 'a'); g.rect(8, 19, 8, 45, 'y')
    g.h(7, 8, 19, 'z')
    # 누름 버튼 상자 y27..30
    g.h(6, 9, 27, 't'); g.px(6, 28, 'u'); g.px(9, 28, 'z'); g.h(7, 8, 28, 'k')
    g.px(6, 29, 'u'); g.px(9, 29, 'z'); g.h(7, 8, 29, 'j'); g.h(6, 9, 30, 'z')
    # 밑판 y45..47
    g.h(6, 9, 45, 'a'); g.h(6, 9, 46, 'y'); g.h(6, 9, 47, 's')
    return g, L

# ---------------------------------------------------------------- 3. 공공자전거 거치대 48x32 (폭 43 · F16 · T6)
def bike_share():
    g = G(48, 32)
    L = {
        's': ('sumi', 0), 'o': ('sumi', 1),
        'T': ('tekko', 6), 't': ('tekko', 5), 'a': ('tekko', 4), 'u': ('tekko', 3), 'y': ('tekko', 2), 'z': ('tekko', 1),
        'H': ('midori', 4), 'G': ('midori', 3), 'g': ('midori', 2), 'f': ('midori', 1), 'e': ('midori', 0),
        'c': ('hodo', 5), 'd': ('hodo', 4), 'b': ('hodo', 2),
        'k': ('kii', 3),
    }
    bike = [
        "....sss......",      # r0  안장 뒤
        "...sttts.....",
        "..ssssssss...",
    ]
    for i in range(3):
        ox = 2 + i * 15
        y0 = 10
        # 안장(바구니 뒤로 솟음) r0..r1
        g.h(ox + 5, ox + 7, y0, 's'); g.h(ox + 4, ox + 8, y0 + 1, 's')
        g.h(ox + 5, ox + 7, y0 + 1, 't')
        # 바구니 윗면 T (r2..r7): 뒤 윤곽 → 밝은 뒷테두리 → 평평한 안쪽 어둠 4행 → 앞 가장자리 밝은 띠(r8)
        g.h(ox + 2, ox + 10, y0 + 2, 's')
        g.rect(ox + 2, y0 + 3, ox + 2, y0 + 8, 's'); g.rect(ox + 10, y0 + 3, ox + 10, y0 + 8, 's')
        g.h(ox + 3, ox + 9, y0 + 3, 'f')
        g.rect(ox + 3, y0 + 4, ox + 9, y0 + 7, 'e')
        g.px(ox + 3, y0 + 4, 'g'); g.px(ox + 4, y0 + 4, 'g')
        g.h(ox + 3, ox + 9, y0 + 8, 'H')
        # 핸들 손잡이 r8..r9 (바구니 앞 가장자리 양쪽)
        g.h(ox + 0, ox + 1, y0 + 8, 's'); g.h(ox + 11, ox + 12, y0 + 8, 's')
        g.h(ox + 0, ox + 1, y0 + 9, 'u'); g.h(ox + 11, ox + 12, y0 + 9, 'y')
        # 바구니 앞면 F (r9..r12) 초록 철망: 체크 무늬
        for yy in range(y0 + 9, y0 + 13):
            for xx in range(ox + 3, ox + 10):
                g.px(xx, yy, 'g' if (xx + yy) % 2 == 0 else 'e')
        g.h(ox + 3, ox + 9, y0 + 9, 'G')
        g.v(ox + 3, y0 + 9, y0 + 12, 'G')
        g.h(ox + 2, ox + 10, y0 + 13, 's')
        g.v(ox + 2, y0 + 9, y0 + 12, 's'); g.v(ox + 10, y0 + 9, y0 + 12, 's')
        # 포크·앞바퀴(정면이라 얇게) r14..r21
        g.v(ox + 5, y0 + 14, y0 + 15, 'u'); g.v(ox + 7, y0 + 14, y0 + 15, 'y')
        g.v(ox + 6, y0 + 14, y0 + 15, 'a')
        g.rect(ox + 5, y0 + 16, ox + 7, y0 + 21, 's')
        g.v(ox + 6, y0 + 16, y0 + 21, 'o'); g.v(ox + 5, y0 + 17, y0 + 20, 'z')
        g.px(ox + 6, y0 + 18, 'a')
        # 앞 조명
        g.px(ox + 6, y0 + 14, 'k')
    # 거치대 레일 (43 폭) r19..r21
    g.h(2, 44, 29, 'd'); g.h(2, 44, 30, 'b'); g.h(2, 44, 31, 's')
    for i in range(3):
        ox = 2 + i * 15
        g.h(ox + 4, ox + 8, 29, 's')      # 도킹 홈
    return g, L

# ---------------------------------------------------------------- 4. 포장마차 32x48 (폭 32 · F32 · T11)
def street_stall():
    g = G(32, 48)
    L = {
        's': ('sumi', 0), 'o': ('sumi', 1), 'n': ('sumi', 2),
        'D': ('daidai', 4), 'd': ('daidai', 3), 'e': ('daidai', 2), 'f': ('daidai', 1),
        'R': ('aka', 4), 'r': ('aka', 3), 'q': ('aka', 2), 'p': ('aka', 1),
        'w': ('shiro', 3), 'v': ('shiro', 2), 'x': ('shiro', 1),
        'M': ('mado', 4), 'm': ('mado', 3), 'l': ('mado', 2), 'j': ('mado', 1),
        'K': ('kinari', 4), 'k': ('kinari', 3), 'i': ('kinari', 2),
        'W': ('ita', 5), 'I': ('ita', 4), 'H': ('ita', 3), 'h': ('ita', 2), 'g': ('ita', 1), 'G': ('ita', 0),
        't': ('tekko', 5), 'u': ('tekko', 4), 'y': ('tekko', 3), 'z': ('tekko', 2), 'Z': ('tekko', 1),
    }
    # 지붕 천막 윗면 T=11 (y5..15)
    g.h(0, 31, 5, 's')
    g.h(1, 30, 6, 'e')                        # 뒤 가장자리 선
    g.rect(1, 7, 30, 13, 'd')
    g.h(1, 30, 7, 'D'); g.v(1, 7, 14, 'D')     # 왼쪽 위 빛
    for xx in (8, 16, 24): g.v(xx, 8, 13, 'e')  # 천막 이음
    g.h(1, 30, 14, 'D'); g.h(1, 30, 13, 'd')   # 앞 가장자리 하이라이트
    g.v(0, 6, 14, 's'); g.v(31, 6, 14, 's')
    g.h(0, 31, 15, 's')
    # 앞 처마 밸런스 y16..19 : 빨강/흰 줄무늬 + 물결 밑단
    for k in range(8):
        c0 = 'q' if k % 2 == 0 else 'v'; c1 = 'p' if k % 2 == 0 else 'x'
        g.rect(k * 4, 16, k * 4 + 3, 18, c0)
        g.h(k * 4, k * 4 + 3, 18, c1)
        if k % 2 == 0: g.rect(k * 4, 16, k * 4, 17, 'r')
        else: g.rect(k * 4, 16, k * 4, 17, 'w')
        g.h(k * 4 + 1, k * 4 + 2, 19, c1)      # 물결 밑단
    g.h(0, 31, 19, 'o'); 
    for k in range(8): g.h(k * 4 + 1, k * 4 + 2, 19, 'q' if k % 2 == 0 else 'v')
    # 처마 밑 그림자 y20..21
    g.rect(1, 20, 30, 21, 'g'); 
    # 안쪽(불 켜진) y22..29 : 노랑 조명 뒷면 + 어묵 솥 + 꼬치
    g.rect(3, 22, 28, 30, 'l')
    g.h(3, 28, 22, 'j'); g.h(3, 28, 23, 'j')                 # 처마 그림자가 뒤벽 윗부분을 누름
    g.rect(3, 24, 28, 29, 'm'); g.rect(4, 25, 20, 27, 'M')    # 조명 번짐
    # 꼬치(어묵) 2px 굵기
    for xx in (7, 10, 13, 16, 19, 22):
        g.rect(xx, 23, xx + 1, 27, 'K'); g.v(xx + 1, 23, 27, 'k'); g.px(xx, 23, 'w')
    # 솥 y26..30
    g.rect(6, 27, 25, 30, 'u'); g.h(6, 25, 27, 't'); g.h(6, 25, 30, 'z')
    g.h(7, 24, 28, 'y')
    g.v(6, 27, 30, 't')
    # 기둥 (양쪽) x1..2 / x29..30, y22..38
    g.rect(1, 22, 2, 38, 'y'); g.v(1, 22, 38, 'u'); g.rect(29, 22, 30, 38, 'z'); g.v(29, 22, 38, 'y')
    g.rect(0, 22, 0, 38, 's'); g.rect(31, 22, 31, 38, 's')
    # 카운터 윗판 y31 (밝은 판) + 앞면 y32..38
    g.h(1, 30, 31, 'W'); g.h(1, 30, 32, 'I')
    g.rect(1, 33, 30, 39, 'H')
    g.h(1, 30, 33, 'h')                                    # 윗판 밑 그림자 선
    for xx in (9, 17, 25): g.v(xx, 34, 39, 'h')            # 널판 이음
    g.v(1, 34, 39, 'I')
    # 메뉴 간판 빨강 y35..38 x11..20
    g.rect(11, 35, 20, 38, 'q'); g.h(11, 20, 35, 'r'); g.h(11, 20, 38, 'p')
    g.h(13, 15, 36, 'w'); g.h(17, 18, 36, 'w'); g.h(13, 18, 37, 'v')
    # 카운터 밑 이음 y40 어둠 + 수레 하부 y40..42
    g.rect(1, 40, 30, 42, 'g'); g.h(1, 30, 40, 'G')
    g.rect(11, 41, 20, 44, 'o')
    g.rect(0, 40, 0, 42, 's'); g.rect(31, 40, 31, 42, 's')
    # 바퀴 x3..10 / x21..28  y41..47
    wheel = [
        "..ssss..",
        ".soooos.",
        "sozuuzos",
        "sozutzos",
        "sozuuzos",
        ".soooos.",
        "..ssss..",
    ]
    wr = [r.replace('.', ' ') for r in wheel]
    g.put(3, 41, wr); g.put(21, 41, wr)
    # 바퀴 축 아래 접지선 y47 : 바퀴만 닿는다 → 바닥 판 y47 x3..10 이미 wheel[6]
    g.rect(12, 43, 19, 43, 'z')
    return g, L

# ---------------------------------------------------------------- 5. 광장 조형물 16x48 (폭 16 · F29 · T10)
def sculpture():
    g = G(16, 48)
    L = {
        's': ('sumi', 0), 'o': ('sumi', 1), 'n': ('sumi', 2),
        'W': ('conc', 6), 'C': ('conc', 5), 'c': ('conc', 4), 'd': ('conc', 3), 'e': ('conc', 2), 'f': ('conc', 1),
        'H': ('hodo', 5), 'h': ('hodo', 4), 'i': ('hodo', 3), 'j': ('hodo', 2),
        'T': ('tekko', 6), 't': ('tekko', 5), 'a': ('tekko', 4), 'u': ('tekko', 3), 'y': ('tekko', 2), 'z': ('tekko', 1),
        'K': ('kinari', 4), 'k': ('kinari', 3), 'l': ('kinari', 1),
    }
    # 윗면 T=10 (y9..18)
    g.h(0, 15, 9, 's')
    g.rect(0, 10, 0, 18, 's'); g.rect(15, 10, 15, 18, 's')
    g.rect(1, 10, 14, 17, 'C')
    g.h(1, 14, 10, 'W'); g.v(1, 10, 17, 'W')
    g.h(1, 14, 18, 'W')                       # 앞 가장자리 하이라이트
    # 윗면: 거친 화강암 판 — 안쪽 모서리를 한 단 깎은 면 + 흠집 두 곳 (구멍·원형 없음)
    g.rect(2, 11, 13, 16, 'C')
    g.px(5, 13, 'c'); g.px(6, 13, 'c'); g.px(10, 14, 'd'); g.px(9, 14, 'd'); g.px(4, 15, 'd')
    # 앞면 F=29 (y19..47): 위쪽 돌기둥 + 맨 아래 받침 단
    g.h(1, 14, 19, 'f')
    g.rect(1, 20, 14, 39, 'd')
    g.v(1, 20, 39, 'c'); g.v(2, 20, 39, 'C')                # 왼쪽 밝은 모서리
    g.v(13, 20, 39, 'e'); g.v(14, 20, 39, 'f')              # 오른쪽 그늘
    g.rect(0, 19, 0, 47, 's'); g.rect(15, 19, 15, 47, 's')
    # 강철 갈고리(S자 상감) — 왼쪽 위에서 시작해 오른쪽 아래로 휘어 내려간다
    hook = [
        "  ttttt   ",
        " taaaaay  ",
        "ta     ay ",
        "ta     ay ",
        "ta        ",
        " ta       ",
        "  taa     ",
        "    tay   ",
        "     tay  ",
        "      ta  ",
        "      ta  ",
        "     ta   ",
        "   tta    ",
        "  ta      ",
        "  ta      ",
    ]
    for j, r in enumerate(hook):
        for i, ch in enumerate(r):
            if ch != ' ': g.px(3 + i, 22 + j, {'t': 'o', 'a': 's', 'y': 'o'}[ch])
    # 돌결 (짧은 가로 홈)
    g.h(9, 12, 24, 'e'); g.h(3, 5, 31, 'e'); g.h(10, 12, 33, 'e'); g.h(4, 6, 37, 'e')
    # 받침 단: 살짝 어두운 띠 + 동판 + 맨 밑 접지 단
    g.h(1, 14, 40, 'e'); g.rect(1, 41, 14, 43, 'f')
    g.rect(4, 41, 11, 43, 'k'); g.h(4, 11, 41, 'K'); g.h(4, 11, 43, 'l'); g.h(5, 10, 42, 'l')
    g.h(1, 14, 44, 'e')
    g.rect(1, 45, 14, 46, 'd'); g.h(1, 14, 45, 'c')
    g.h(0, 15, 44, 's') if False else None
    g.h(0, 15, 47, 's')
    return g, L

# ---------------------------------------------------------------- 3B. 공유 자전거 거치대 v35-B : 낮은 벽 앞에 자전거가 꽂힌 채 (48x32)
def _line(g, x0, y0, x1, y1, c):
    """좌표 붓: 두 점 사이를 한 화소씩 잇는다(정수 보간)."""
    n = max(abs(x1 - x0), abs(y1 - y0), 1)
    for i in range(n + 1):
        g.px(x0 + round((x1 - x0) * i / n), y0 + round((y1 - y0) * i / n), c)

RING = [
    "..ooo..",
    ".ou.uo.",
    "ou...uo",
    "o..W..o",
    "o.....o",
    ".o...oo",
    "..ooo..",
]

def _bike(g, ox, oy):
    """옆(왼쪽이 앞)에서 조금 위로 본 자전거 17x14. 바퀴는 속이 빈 고리(뒤 벽이 비쳐 보인다), 초록 프레임, 위에서 본 안장·핸들."""
    for i, r in enumerate(RING):
        for j, c in enumerate(r):
            if c != '.':
                g.px(ox + j, oy + 7 + i, c)          # 앞바퀴 (x0..6)
                g.px(ox + 10 + j, oy + 7 + i, c)     # 뒷바퀴 (x10..16)
    def L(x0, y0, x1, y1, c): _line(g, ox + x0, oy + y0, ox + x1, oy + y1, c)
    F, R, BB = (3, 10), (13, 10), (8, 11)
    L(BB[0], BB[1], 11, 4, 'G')                  # 시트튜브
    L(11, 5, 4, 6, 'G')                          # 톱튜브
    L(4, 6, BB[0], BB[1], 'g')                   # 다운튜브(어둡게)
    L(BB[0], BB[1], R[0], R[1], 'g')             # 체인스테이
    L(11, 5, R[0], R[1], 'G')                    # 시트스테이
    L(4, 5, F[0], F[1], 'H')                     # 앞 포크(밝게)
    g.px(ox + 8, oy + 12, 'c')                   # 페달 축
    # 안장 윗면(위에서 본다): 어두운 판 + 위쪽 밝은 테
    g.h(ox + 10, ox + 13, oy + 2, 'a'); g.h(ox + 10, ox + 13, oy + 3, 't'); g.px(ox + 9, oy + 3, 's'); g.px(ox + 14, oy + 3, 's'); g.h(ox + 10, ox + 13, oy + 1, 's')
    # 핸들 바(가로 막대를 위에서 본다) + 손잡이 + 앞등
    g.h(ox + 2, ox + 6, oy + 3, 't'); g.h(ox + 2, ox + 6, oy + 2, 's'); g.px(ox + 1, oy + 3, 's'); g.px(ox + 7, oy + 3, 's')
    g.px(ox + 4, oy + 4, 'k')

def bike_share_b():
    g = G(48, 32)
    L = {
        's': ('sumi', 0), 'o': ('sumi', 1), 'n': ('sumi', 2),
        'T': ('tekko', 6), 't': ('tekko', 5), 'a': ('tekko', 4), 'u': ('tekko', 3), 'y': ('tekko', 2), 'z': ('tekko', 1),
        'H': ('midori', 4), 'G': ('midori', 3), 'g': ('midori', 2), 'f': ('midori', 1), 'e': ('midori', 0),
        'c': ('hodo', 5), 'd': ('hodo', 4), 'b': ('hodo', 2),
        'k': ('kii', 3), 'W': ('conc', 6), 'C': ('conc', 5), 'x': ('conc', 2), 'X': ('conc', 1), 'w': ('conc', 3), 'v': ('conc', 4),
    }
    # 낮은 안전벽(뒤): 윗면 T6 + 앞면. 왼쪽 위 빛: 윗면이 가장 밝다.
    g.h(1, 37, 10, 's')
    g.rect(1, 11, 37, 16, 'W')
    g.h(1, 37, 17, 'C')                              # 앞 가장자리 하이라이트
    g.rect(1, 18, 37, 29, 'v')
    g.h(1, 37, 18, 'w')
    g.rect(1, 11, 1, 29, 's'); g.rect(37, 11, 37, 29, 's')
    g.h(2, 36, 30, 'X')
    # 벽 앞에 서서 앞바퀴를 홈에 꽂은 자전거 두 대
    g.h(1, 37, 30, 'd'); g.h(1, 37, 31, 's')      # 거치 레일 (접지)
    _bike(g, 3, 17)
    _bike(g, 20, 17)
    # 오른쪽 끝의 작은 단말기 (폭 6)
    tx = 39
    g.h(tx, tx + 5, 15, 's')
    g.rect(tx, 16, tx, 30, 's'); g.rect(tx + 5, 16, tx + 5, 30, 's')
    g.h(tx + 1, tx + 4, 16, 'W'); g.h(tx + 1, tx + 4, 17, 'C'); g.h(tx + 1, tx + 4, 18, 'C')
    g.h(tx + 1, tx + 4, 19, 'a')
    g.rect(tx + 1, 20, tx + 4, 24, 'e'); g.h(tx + 1, tx + 4, 20, 'f'); g.h(tx + 1, tx + 4, 21, 'G')
    g.px(tx + 1, 22, 'H'); g.px(tx + 2, 22, 'H'); g.px(tx + 1, 23, 'g')
    g.rect(tx + 1, 25, tx + 4, 26, 'z'); g.px(tx + 2, 25, 'k')
    g.rect(tx + 1, 27, tx + 4, 28, 'u'); g.h(tx + 1, tx + 4, 27, 'a')
    g.h(tx, tx + 5, 29, 's'); g.h(tx, tx + 5, 30, 'd'); g.h(tx, tx + 5, 31, 's')
    return g, L

ITEMS = {
    'gn_delivery_scooter': scooter, 'mo_ped_signal': ped_signal, 'gn_bike_share': bike_share,
    'gn_street_stall': street_stall, 'mo_sculpture': sculpture,
}
VARIANT = {'gn_bike_share:B': ('gn_bike_share', 'v35-B', bike_share_b)}
if __name__ == '__main__':
    only = sys.argv[1:] or list(ITEMS)
    for key in only:
        slug, tag, fn = VARIANT.get(key, (key, 'v35-A', ITEMS.get(key)))
        g, L = fn()
        if os.environ.get('SHOW'): g.show()
        write(slug, g, L, f'{slug} {tag} 3/4 (1칸=16px=1m)', tag)
