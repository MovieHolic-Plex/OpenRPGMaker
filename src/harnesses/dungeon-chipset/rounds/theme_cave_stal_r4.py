"""theme-cave-stal-r4 — 자연 동굴 종유석 tc.cave_stalactite. r2·r3 object-gate 화풍 반려(가늘고 성긴 가시 = 명암 3단·정보량 부족).
근본 원인: 투명 칸에 가는 가시만 있어 판정자가 「스티커」로 봤다. 고른 고드름(tc.ice_icicles A2)처럼 **칸 폭 전체의 단단한 바위 처마 띠**(5줄)를
두고, 그 밑에 굵은 원뿔(폭 4~7)을 덩이마다 위→아래 명암 사다리(rim 5→4→3→2→1, 윤곽 cfloor 갈색)와 가로 단면 빛·그늘로 그린다.
처마 띠: 맨 윗줄 빛 턱(rim 5·4) → 바위 몸(rim 3·2 결) → 아랫면 그늘(rim 1·cfloor 1) + 이끼 몇 화소(moss 2·3). 모든 화소는 아래 원뿔 표와 규칙에서 온다.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import theme_climate_lib as lib  # noqa: E402
from theme_climate_lib import Cv, T, hcat, leg, ramp_chars, stamp  # noqa: E402
import theme_cave_stal_r1 as S1  # noqa: E402  장면(출하 동굴 벽)

WAVE = 'theme_climate'
# 0 rim0 … 6 rim6 · c cfloor1 · d cfloor0 · g moss2 · G moss3
LG = leg(ramp_chars('rim', '0123456'), ramp_chars('cfloor', 'dcefij'), g=('moss', 2), G=('moss', 3), q=('moss', 1), r=('cfloor', 6))


def _h(*a):
    v = 2166136261
    for x in a:
        v = ((v ^ (x & 0xffffffff)) * 16777619) & 0xffffffff
    return v


# 원뿔 표: (왼 x, 폭, 길이) — 처마 띠 밑(5행)에서 내려온다. 1칸 = 16 폭, 2칸 = 32 폭.
CONES = {
    (1, 16): [(1, 6, 9), (8, 4, 6), (12, 3, 4)],
    (1, 32): [(0, 5, 7), (6, 7, 10), (14, 4, 5), (19, 6, 9), (26, 4, 6), (30, 2, 3)],
    (2, 16): [(0, 4, 6), (5, 7, 10), (13, 3, 5)],
    (2, 32): [(1, 4, 5), (6, 6, 9), (13, 3, 4), (17, 7, 11), (25, 5, 7)],
}
LEDGE = 5


def draw(n, w, salt):
    g = [['.'] * w for _ in range(16)]
    # 처마 띠: 아랫변이 들쭉날쭉(4~5행)
    for x in range(w):
        bot = LEDGE - (1 if _h(x // 3, salt, 1) % 3 == 0 else 0)
        for y in range(bot):
            v = _h(x, y, salt) % 13
            if y == 0:
                ch = '4' if v < 7 else '5' if v < 9 else '3'
            elif y == 1:
                ch = '3' if v < 6 else '2' if v < 10 else '4'
            elif y == bot - 1:
                ch = '1' if v < 7 else 'c' if v < 10 else 'q' if v < 11 else 'g'
            else:
                ch = '2' if v < 4 else '3' if v < 7 else 'e' if v < 8 else 'i' if v < 9 else '1' if v < 11 else ('G' if v == 11 else 'g')
            g[y][x] = ch
    for x0, cw, ln in CONES[(n, w)]:
        for i in range(ln):
            y = LEDGE - 1 + i
            if y >= 16:
                break
            # 폭이 아래로 줄어든다(삼각), 왼쪽이 빛
            t = i / max(1, ln - 1)
            ww = max(1, round(cw * (1 - t) + 0.4))
            off = (cw - ww) // 2
            for j in range(ww):
                X = x0 + off + j
                if not (0 <= X < w):
                    continue
                f = j / max(1, ww - 1)   # 0 왼 … 1 오른
                # 세로 사다리: 위 밝음 → 아래 어둠, 가로: 왼 빛 → 오른 그늘
                base = 4 - round(2.2 * t)        # 4 → 2
                k = base + (1 if f < 0.25 else 0) - (1 if f > 0.55 else 0) - (1 if f > 0.85 else 0)
                if ww >= 3 and j == ww - 1:
                    ch = 'd' if i % 2 else 'c'
                elif ww >= 3 and j == 0:
                    ch = 'c' if t > 0.5 else str(max(1, min(5, k)))
                else:
                    if _h(X, y, salt, 4) % 7 == 0:
                        k -= 1
                    if (y + X) % 5 == 0 and ww >= 4:
                        k -= 1          # 결 줄
                    ch = str(max(1, min(5, k)))
                if i == ln - 1:
                    ch = '4' if ww == 1 else ch   # 물기 맺힌 끝
                # 흙빛 결: 몸 단 일부를 같은 밝기 근처의 흙 단(cfloor 2~5)으로 — 바위에 섞인 흙·광물 결(색 수 · 정보량)
                hv = _h(X, y, salt, 9) % 6
                if ch in '23' and hv == 0:
                    ch = {'2': 'e', '3': 'f'}[ch]
                elif ch in '34' and hv == 1:
                    ch = {'3': 'i', '4': 'j'}[ch]
                g[y][X] = ch
    return [''.join(r) for r in g]


def parts(n):
    one, two = Cv(16, 16), Cv(32, 16)
    stamp(one, draw(n, 16, 3 + n), LG, 0, 0)
    stamp(two, draw(n, 32, 9 + n), LG, 0, 0)
    return one, two


def mk(n):
    def run():
        one, two = parts(n)
        return hcat(one, two), {'kind': 'objects', 'parts': {'1칸': one, '2칸': two}, 'vignette': S1.scene_cave(one, two)}
    return run


CANDIDATES = {'tc.cave_stalactite': {'A1': mk(1), 'A2': mk(2)}}
NOTES = {('tc.cave_stalactite', 'A1'): '바위 처마 띠(5줄) + 굵은 원뿔 셋/여섯 — 위→아래·왼→오른 명암 6단, 갈색 윤곽, 이끼',
         ('tc.cave_stalactite', 'A2'): '같은 짜임, 원뿔 배치·길이 다름'}


def line_scenes():
    return {}
