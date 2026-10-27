"""theme-cave-stal-r11 — 자연 동굴 종유석 tc.cave_stalactite, 두 칸 높이(벽 앞면 두 줄 전체).

r4~r8 지도 속 적대 검수가 모두 C(재질·1배 가시성)에서 막혔다. 근본 원인: 벽 앞면 윗줄 한 칸(16px)에 원뿔을 넣으면 길이 12px·뿌리 10px 이 한계라
밝게 그리면 「붙인 얼룩」, 벽 단으로 그리면 1배에서 안 보인다(r5·r8 검수 「2~3칸 길이로」). r11 은 키트를 1×2·2×2 로 키워 벽 앞면 두 줄을 다 쓴다:
뿌리 = 바위 턱 바로 밑(윗줄 맨 위), 끝 = 아랫줄 바닥 바로 위. 길이 24~30px · 뿌리 폭 9~13px 이라 벽 단 색으로도 덩이가 선다.
색: 몸 = 벽 앞면 중간 단(cfloor c · rim 1), 빛 가장자리·뿌리 = rim 2·3, 그늘 = cfloor d · rim 0, 처마 밑 그늘 띠, 벽 위 드리운 그림자 한 줄.
실루엣: 원뿔마다 마디 둘(폭이 한 줄 부풀었다 좁아짐), 끝 1/3 이 한쪽으로 휜다. 2칸 = 크기·모양이 다른 원뿔 둘(같은 이 두 개 금지, r8 검수).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import theme_climate_lib as lib  # noqa: E402
from theme_climate_lib import Cv, T, hcat, leg, ramp_chars, stamp  # noqa: E402
import theme_cave_stal_r1 as S1  # noqa: E402  장면(출하 동굴 벽)

WAVE = 'theme_climate'
LG = leg(ramp_chars('rim', '0123456'), ramp_chars('cfloor', 'dcefij'), g=('moss', 2), G=('moss', 3), q=('moss', 1))
H = 2 * T


def _h(*a):
    v = 2166136261
    for x in a:
        v = ((v ^ (x & 0xffffffff)) * 16777619) & 0xffffffff
    return v


# (왼 x, 뿌리 폭, 길이, 기울기 ±1) — 1칸 = 16 폭, 2칸 = 32 폭, 높이 32.
CONES = {
    (1, 16): [(2, 11, 28, 1)],
    (1, 32): [(1, 12, 29, -1), (18, 9, 19, 1)],
    (2, 16): [(3, 10, 24, -1)],
    (2, 32): [(2, 8, 17, 1), (14, 13, 30, -1)],
}
LEDGE = 2


def draw(n, w, salt):
    g = [['.'] * w for _ in range(H)]
    for x in range(w):
        g[0][x] = 'd' if _h(x, 0, salt) % 4 else '1'
        g[1][x] = '0' if _h(x, 1, salt) % 3 else 'd'
    for x0, cw, ln, lean_dir in CONES[(n, w)]:
        knots = {4 + _h(x0, salt, 31) % 4, 12 + _h(x0, salt, 32) % 5}
        for i in range(ln):
            y = LEDGE - 1 + i
            if y >= H - 1:
                break
            t = i / max(1, ln - 1)
            bump = 2 if i in knots else 1 if (i - 1) in knots else 0
            lean = lean_dir * (0 if t < 0.5 else 1 if t < 0.78 else 2)
            ww = max(2, round(cw * (1 - t) ** 0.9 + 0.3) + (bump if t < 0.8 else 0))
            off = (cw - ww) // 2 + lean
            for j in range(ww):
                X = x0 + off + j
                if not (0 <= X < w):
                    continue
                f = j / max(1, ww - 1)
                if i < 2 and f < 0.65:
                    ch = '3' if (i == 0 and f < 0.4) else '2'
                elif j == 0:
                    ch = '2' if t < 0.7 else 'c'
                elif j == 1 and ww >= 6:
                    ch = 'c' if t < 0.8 else '1'
                elif j >= ww - 1:
                    ch = '0'
                elif f > 0.66:
                    ch = 'd'
                elif f < 0.45:
                    ch = 'c' if t < 0.6 else '1'
                    if _h(X, y, salt, 4) % 7 == 0:
                        ch = 'e' if ch == 'c' else 'd'
                else:
                    ch = '1' if t < 0.7 else 'd'
                if i in knots and j == 0:
                    ch = '3'   # 마디 윗면 빛
                if i == ln - 1:
                    ch = 'c' if j == 0 else 'd'
                g[y][X] = ch
            SX = x0 + off + ww
            if 0 <= SX < w and 0.15 < t < 0.7 and g[y][SX] == '.':
                g[y][SX] = '0'
    return [''.join(r) for r in g]


def parts(n):
    one, two = Cv(16, H), Cv(32, H)
    stamp(one, draw(n, 16, 3 + n), LG, 0, 0)
    stamp(two, draw(n, 32, 9 + n), LG, 0, 0)
    return one, two


def mk(n):
    def run():
        one, two = parts(n)
        return hcat(one, two), {'kind': 'objects', 'parts': {'1칸': one, '2칸': two}, 'vignette': S1.scene_cave(one, two)}
    return run


CANDIDATES = {'tc.cave_stalactite': {'A1': mk(1), 'A2': mk(2)}}
NOTES = {('tc.cave_stalactite', 'A1'): '두 칸 높이(벽 앞면 두 줄) 긴 원뿔 — 마디·휜 끝, 벽 단 몸, 뿌리 빛, 처마 그늘 띠, 드리운 그림자',
         ('tc.cave_stalactite', 'A2'): '같은 짜임, 원뿔 크기·배치 다름'}


def line_scenes():
    return {}
