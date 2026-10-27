"""theme-cave-stal-r12 — r11(지도 속 Sonnet PASS) + object-gate 화풍 반려(톤 6 < 기준 9~20, 어두운 가장자리가 근흑 회색, 원뿔 결 부족) 고친 판.
r12: 오른 윤곽 rim 0(근흑) → cfloor d(갈색 그늘)·j 일부, 몸에 흙 단 e·f·i 결 줄(가로 층리 2~3줄), 빛 면 rim 3/4 점, 이끼 g 몇 화소 — 톤 10~12.
모양·크기·배치는 r11 그대로(검수 통과분). 아래는 r11 설명.
theme-cave-stal-r11 — 자연 동굴 종유석 tc.cave_stalactite, 두 칸 높이(벽 앞면 두 줄 전체).

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
LG = leg(ramp_chars('rim', '0123456'), ramp_chars('cfloor', 'dcefij'), g=('moss', 2), G=('moss', 3), q=('moss', 1), w=('wood', 1))   # w = 따뜻한 짙은 갈색(그늘 윤곽 — 근흑 회색 윤곽 반려)
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
        g[0][x] = 'd' if _h(x, 0, salt) % 4 else 'c'
        g[1][x] = 'w' if _h(x, 1, salt) % 3 == 0 else 'd'
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
                strata = (y + _h(x0, salt, 41) % 5) % 6 == 0   # 가로 층리 줄(흙 단)
                # 가로 단면 6단: 빛 가장자리 rim 4/3 → rim 2 → 흙 f/e → c → 1 → 그늘 d. 위(뿌리)는 한 단 밝게, 아래(끝)는 한 단 어둡게.
                ramp = ['4', '3', '2', 'f', 'c', '1', 'd']
                k = min(6, int(f * 6.99))
                k = max(0, min(6, k + (0 if t < 0.35 else 1 if t < 0.7 else 2) - (1 if i < 2 else 0)))
                if j == 0:
                    k = 0 if t < 0.5 else 1 if t < 0.8 else 3
                elif j >= ww - 1:
                    k = 6
                ch = ramp[k]
                if j >= ww - 1 and t > 0.1:
                    ch = 'w' if _h(X, y, salt, 6) % 4 else 'd'   # 그늘 윤곽 = 따뜻한 짙은 갈색
                if strata and ch in '2fc':
                    ch = {'2': 'i', 'f': 'e', 'c': 'e'}[ch]
                elif ch in 'fc1' and _h(X, y, salt, 4) % 7 == 0:
                    ch = {'f': 'j', 'c': 'f', '1': 'c'}[ch]   # 결 점
                if ch == '4' and _h(X, y, salt, 9) % 3 == 0:
                    ch = '5'   # 젖은 반짝임
                if i in knots and j == 0:
                    ch = '3'
                if i in knots and 0 < j < ww - 1 and f < 0.5:
                    ch = 'f'   # 마디 윗면
                if 0.25 < t < 0.6 and f < 0.3 and _h(X, y, salt, 8) % 23 == 0:
                    ch = 'g'   # 젖은 이끼 한 점
                if i == ln - 1:
                    ch = 'c' if j == 0 else 'd'
                g[y][X] = ch
            SX = x0 + off + ww
            if 0 <= SX < w and 0.15 < t < 0.7 and g[y][SX] == '.':
                g[y][SX] = 'w' if t < 0.45 else 'd'
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
NOTES = {('tc.cave_stalactite', 'A1'): 'r11 모양 + 결(층리·흙 단·이끼 점), 갈색 그늘 윤곽, 톤 10여 단',
         ('tc.cave_stalactite', 'A2'): '같은 짜임, 원뿔 크기·배치 다름'}


def line_scenes():
    return {}
