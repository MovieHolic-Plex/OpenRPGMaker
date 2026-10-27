"""theme-cave-stal-r5 — 자연 동굴 종유석 tc.cave_stalactite. r4 지도 속 적대 검수 FAIL(가는 1px 막대가 빗·울타리로, 벽보다 너무 밝은 크림색)을 고친 판.
r5: 원뿔을 칸당 2개(2칸 3~4개)로 줄이고 뿌리 폭 5~9·끝 최소 2px, 간격·길이를 들쭉날쭉하게. 몸 명암을 벽 앞면 단(rim 1·2·cfloor c·d)으로 낮추고
빛은 왼 가장자리 rim 3 한 줄 + 뿌리 rim 4 몇 점만. 끝은 가장 어두운 단. 아래 r4 설명은 처마 띠 짜임의 내력이다.

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
    (1, 16): [(2, 8, 10), (11, 4, 5)],
    (1, 32): [(1, 6, 7), (9, 9, 11), (22, 5, 6)],
    (2, 16): [(1, 5, 6), (7, 8, 11)],
    (2, 32): [(3, 8, 10), (14, 4, 4), (20, 9, 12)],
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
            ww = max(2, round(cw * (1 - t) ** 0.8 + 0.3))   # 끝도 2px — 1px 막대가 빗살로 읽혔다(r4 지도 검수)
            off = (cw - ww) // 2 + (1 if (i > ln * 0.6 and _h(x0, salt, 7) % 2) else 0)   # 끝이 살짝 휜다
            for j in range(ww):
                X = x0 + off + j
                if not (0 <= X < w):
                    continue
                f = j / max(1, ww - 1)   # 0 왼 … 1 오른
                # 벽 앞면 단에 맞춘 명암: 왼 빛 rim3/2 · 몸 rim2/c · 그늘 rim1/d · 끝으로 갈수록 한 단 어둡게
                if j == 0:
                    ch = '4' if i < 2 else '3' if t < 0.6 else '2'
                elif f > 0.75:
                    ch = 'd' if t > 0.4 or j == ww - 1 else '1'
                elif f > 0.45:
                    ch = '1' if t > 0.55 else 'c'
                else:
                    ch = '3' if t < 0.25 else '2' if t < 0.7 else 'c'
                    if _h(X, y, salt, 4) % 6 == 0:
                        ch = {'3': 'f', '2': 'e', 'c': '1'}[ch]   # 흙·광물 결
                if i == ln - 1:
                    ch = '1' if j == 0 else 'd'   # 끝: 가장 어두운 단(밝은 점 = 빗살 끝으로 읽혔다)
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
NOTES = {('tc.cave_stalactite', 'A1'): '처마 띠 + 굵은 원뿔 둘/셋(뿌리 폭 넓게, 끝 2px), 벽 앞면 단 명암 — 빗살 대신 덩이',
         ('tc.cave_stalactite', 'A2'): '같은 짜임, 원뿔 배치·길이 다름'}


def line_scenes():
    return {}
