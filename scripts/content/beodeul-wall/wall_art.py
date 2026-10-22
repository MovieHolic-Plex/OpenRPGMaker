"""버들항 마을 성벽 손 도트 원본 3판 — 16px 칸, 3/4 탑뷰, 버들항 시트에 실제로 있는 색만(굽기 전에 시트 팔레트로 검사).

2판(#3250)은 사용자 반려·적대 VQA 4/10: 통로가 6~8px 띠, 흉벽이 점선, 망루·성문루가 정면도, 성벽 전체 16색, 그림자 없음.
3판의 기하(한 칸 = 16px, 화면 기준):
  가로 성벽(북·남) = 윗면 2줄(통로 판석 + 흉벽) + 앞면 4줄(64px — 단층 민가 벽·지붕보다 높이 솟은 마을 성벽, r5 에서 3줄 → 4줄).
  세로 성벽(서·동) = 2열 폭 윗면(앞면 없음 — 3/4 에서 옆면은 안 보인다).
  망루 3×8, 성문루 4×8 = 윗면 플랫폼 3줄(흉벽이 네 변을 두른다) + 앞면 5줄(성벽보다 16px 높고 한 줄 앞으로 내민다).
  성문 아치는 두께 있는 터널(안쪽 볼·궁륭 갈빗대·들어 올린 쇠창살·앞쪽이 밝아지는 바닥).
  땅 그림자 조각(2층, 반투명): 앞면 밑·세로 성벽 오른쪽.

빛은 왼쪽 위. 돌은 버들항 왕성 성벽(차가운 밝은 회색·짙은 줄눈), 통로 판석은 왕성 안뜰(따뜻한 분홍 회색).
돌은 고르지 않은 켜(5~7px) + 줄눈 1px, 아래로 갈수록 얼룩·빗물 자국·이끼, 돌마다 윗변 빛·아랫변/오른변 그늘·얼룩·금·이끼. 칸 경계를 넘는 돌은 모든 변형이 같은 모양이라
어느 변형끼리 붙어도 이어진다. 그림은 행 문자열 대신 규칙 함수가 점을 찍는다(농장 3판과 같은 코드 손 도트, 생성 이미지 없음).
"""
import math

from PIL import Image
import re

T = 16


# ================================================================ 색 (모두 beodeul-city-chipset.png 앞 223행에 있는 값)
def hx(s):
    s = s.lstrip("#"); return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16), 255)


COOL = [hx(c) for c in ("#2b3934", "#3e403d", "#595b58", "#757675", "#80817f", "#929491", "#a8aaa7", "#afb1ae", "#c4c6c3", "#d3d5d2", "#dadcd9", "#e5e7e4")]
WARM = [hx(c) for c in ("#3e403d", "#595b58", "#7c7a73", "#aaaaa3", "#adada6", "#bcbbb1", "#cfccc0", "#d9dad4", "#e5e7e4")]
FLAG = [hx(c) for c in ("#3e403d", "#565755", "#7c7a73", "#8d8879", "#9e8d83", "#bcaaa0", "#c2bca7", "#cfccc0", "#d9dad4")]
MOSS = [hx(c) for c in ("#3a582e", "#426a2e", "#618c3b", "#6e9943")]
WOOD = [hx(c) for c in ("#1e150a", "#3d220c", "#452a17", "#633712", "#6f4725", "#885a26", "#b77541")]
IRON = [hx(c) for c in ("#1e150a", "#374243", "#5b6667")]
FIRE = [hx(c) for c in ("#ec9900", "#fbc10d")]
OUT, OUT2, MORT, MORT2 = COOL[0], COOL[1], COOL[2], COOL[3]
# 실루엣 윤곽(풀·땅과 닿는 바깥 선): 버들항 왕성이 돌과 풀 사이에 쓰는 초록 기운 짙은 색 — 중성 회색(OUT2)은 「스티커 윤곽」으로 읽혔다(object-gate 화풍 사실)
EDGE = OUT
# 반투명 그림자(시트에 있는 값)
SH1, SH2, SH3 = (26, 18, 30, 140), (26, 18, 30, 105), (26, 22, 30, 46)
SH0 = (26, 18, 30, 170)
CLEAR = (0, 0, 0, 0)

RAMPS = [COOL, WARM, FLAG]


def _ramp_of(c):
    for r in RAMPS:
        if c in r: return r
    return None


def step(c, n):
    """같은 재질 램프에서 n 단 밝게(+) 또는 어둡게(-)."""
    r = _ramp_of(c)
    if r is None: return c
    i = max(0, min(len(r) - 1, r.index(c) + n))
    return r[i]


def step_any(c, n):
    """램프 밖 색(돌 결 잡색)도 가장 가까운 COOL·WARM 램프 색으로 붙여 n 단 옮긴다 — 그늘이 잡색 돌을 건너뛰어 1배에서 안 보였다(r13)."""
    if c[3] != 255: return c
    if _ramp_of(c) is not None: return step(c, n)
    best = min(((sum((a - b) ** 2 for a, b in zip(c[:3], r[i][:3])), r, i) for r in (COOL, WARM) for i in range(len(r))), key=lambda t: t[0])
    _, r, i = best
    return r[max(0, min(len(r) - 1, i + n))]


def h(*a):
    """결정적 해시(같은 입력 → 같은 값)."""
    v = 2166136261
    for x in a:
        for ch in str(x):
            v = ((v ^ ord(ch)) * 16777619) & 0xFFFFFFFF
        v = ((v ^ 0x9E) * 16777619) & 0xFFFFFFFF
    v ^= v >> 13; v = (v * 0x5bd1e995) & 0xFFFFFFFF; v ^= v >> 15
    return v


class Canvas:
    def __init__(self, w, h, fill=CLEAR):
        self.w, self.h = w, h
        self.p = [[fill] * w for _ in range(h)]

    def get(self, x, y):
        return self.p[y][x] if 0 <= x < self.w and 0 <= y < self.h else CLEAR

    def set(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h: self.p[y][x] = c

    def rect(self, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): self.set(x, y, c)

    def shade(self, x, y, n):
        c = self.get(x, y)
        if c[3] == 255: self.set(x, y, step(c, n))

    def paste(self, other, ox, oy):
        for y in range(other.h):
            for x in range(other.w):
                c = other.p[y][x]
                if c[3]: self.set(ox + x, oy + y, c)

    def crop(self, x0, y0, w, h):
        c = Canvas(w, h)
        for y in range(h):
            for x in range(w): c.p[y][x] = self.get(x0 + x, y0 + y)
        return c

    def mirror(self):
        c = Canvas(self.w, self.h)
        for y in range(self.h): c.p[y] = self.p[y][::-1]
        return c

    def image(self):
        im = Image.new("RGBA", (self.w, self.h))
        im.putdata([c for row in self.p for c in row])
        return im


# ================================================================ 돌 한 덩이
STONE_TONES = [COOL[8], COOL[8], COOL[8], COOL[7], COOL[9], WARM[6], WARM[4], COOL[6], COOL[8], WARM[5]]


def stone(cv, x0, y0, x1, y1, tone, seed, clip=None, crack=False, moss=0, weather=0):
    """돌 하나: 몸 tone, 윗변 한 단 밝게(오른 끝 제외), 왼변 위쪽 밝게, 아랫변·오른변 한 단 어둡게, 얼룩 2~4점.
    clip = (cx0, cx1) 이면 그 열 안만 찍는다(칸 경계를 넘는 돌을 칸마다 같은 모양으로 찍을 때)."""
    def put(x, y, c):
        if clip and not (clip[0] <= x <= clip[1]): return
        cv.set(x, y, c)
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            c = tone
            if weather and h(seed, x - x0, y - y0, "w") % 5 == 0: c = step(tone, -1)
            if y == y0 and x < x1: c = step(tone, 1)
            elif x == x0 and y < y1 and y - y0 <= 2: c = step(tone, 1)
            if y == y1 and x > x0: c = step(tone, -1)
            elif x == x1 and y > y0: c = step(tone, -1)
            put(x, y, c)
    w, hh = x1 - x0 + 1, y1 - y0 + 1
    if w >= 4 and hh >= 4:
        for k in range(2 + h(seed, "n") % 3):
            sx = x0 + 1 + h(seed, k, "x") % max(1, w - 2)
            sy = y0 + 1 + h(seed, k, "y") % max(1, hh - 2)
            put(sx, sy, step(tone, -1 if h(seed, k, "d") % 4 else 1))
    if crack and w >= 6:
        cx = x0 + 2 + h(seed, "c") % max(1, w - 4)
        for i in range(min(hh - 1, 4)):
            put(cx + (i // 2) * (1 if h(seed, "cd") % 2 else -1), y0 + 1 + i, step(tone, -2))
    for k in range(moss):
        mx = x0 + h(seed, k, "mx") % w
        put(mx, y1, MOSS[h(seed, k, "mc") % 2 + 1])
        if h(seed, k, "m2") % 2: put(mx + 1, y1, MOSS[0])


def mortar_row(cv, y, x0, x1, seed):
    for x in range(x0, x1 + 1):
        cv.set(x, y, MORT2 if h(seed, x, y, "mo") % 7 == 0 else MORT)


# ================================================================ 앞면 (한 열 16×64 = 네 칸: 위 u · 가운데 m · 아래 n · 굽도리 l)
FACE_H = 64
FACE_ROWS = ("u", "m", "n", "l")
COURSE_TOP = 4            # 0~3 = 갓돌 띠(string course)
# 켜 높이(돌 높이, 밑에 줄눈 1px) — 고르지 않은 켜가 손으로 쌓은 성벽처럼 읽힌다. y4 ~ y51
COURSE_H = (6, 5, 7, 5, 6, 7, 5)
COURSES = len(COURSE_H)
PLINTH_Y = COURSE_TOP + sum(COURSE_H) + COURSES       # 52 — 52~63 굽도리(내민 기초 켜)
# 칸 경계를 넘는 돌(켜 0·2·4·6): (돌 왼끝 x, 돌 오른끝 x) — 왼끝은 이 칸, 오른끝은 다음 칸(+16)
CROSS = {0: (12, 19), 2: (10, 17), 4: (13, 21), 6: (11, 18)}
CROSS_TONE = {0: COOL[8], 2: WARM[6], 4: COOL[7], 6: COOL[6]}


def course_top(k):
    return COURSE_TOP + sum(COURSE_H[:k]) + k


def face_column(var, *, left="", right="", seed=0):
    """앞면 한 열(16×64). var 0~3 은 칸 안쪽 돌 배치·색·금·이끼·빗물 자국만 다르고, 칸 경계를 넘는 돌은 모든 변형이 같다.
    아래로 갈수록 돌이 어둡고 얼룩지며(빗물·흙), 맨 아래 켜와 굽도리에 이끼가 낀다.
    left: 'end' 모서리 돌 + 윤곽 · 'shadow' 왼쪽 물체 그늘. right: 'end'."""
    cv = Canvas(16, FACE_H)
    s = ("face", var, seed)
    # 갓돌 띠: 윗면 빛 · 몸 · 밑 그늘(앞으로 내민 띠라 아래 줄눈이 짙다)
    for x in range(16):
        cv.set(x, 0, COOL[10]); cv.set(x, 1, COOL[9] if (x + 5) % 8 else COOL[8]); cv.set(x, 2, COOL[7] if (x + 5) % 8 else COOL[6])
        cv.set(x, 3, OUT2 if (x + 5) % 8 in (0, 1) else MORT)
    for k in range(COURSES):
        y0 = course_top(k); hh = COURSE_H[k]; y1 = y0 + hh - 1
        mortar_row(cv, y1 + 1, 0, 15, (s, k))
        depth = k / (COURSES - 1)                 # 0 위 → 1 아래
        if k in CROSS:
            a, b = CROSS[k]
            for off in (0, -16):
                stone(cv, a + off, y0, b + off, y1, CROSS_TONE[k], ("cross", k), clip=(0, 15), weather=1 if depth > 0.5 else 0)
            cv.rect(a - 1, y0, a - 1, y1, MORT); cv.rect(b - 15, y0, b - 15, y1, MORT)
            xs = [b - 15 + 1, a - 2]
            if xs[1] - xs[0] >= 7 and h(s, k, "split") % 3:
                m = xs[0] + 3 + h(s, k, "sp") % max(1, xs[1] - xs[0] - 5)
                cv.rect(m, y0, m, y1, MORT)
                parts = [(xs[0], m - 1), (m + 1, xs[1])]
            else: parts = [tuple(xs)]
        else:
            cv.rect(15, y0, 15, y1, MORT)          # 칸 경계 줄눈
            # 큰 돌 하나 + 작은 돌, 또는 세 덩이 — 변형마다 다르다
            if h(s, k, "three") % 3 == 0:
                j1 = 3 + h(s, k, "j1") % 4; j2 = j1 + 4 + h(s, k, "j2") % 4
                j2 = min(j2, 12)
                cv.rect(j1, y0, j1, y1, MORT); cv.rect(j2, y0, j2, y1, MORT)
                parts = [(0, j1 - 1), (j1 + 1, j2 - 1), (j2 + 1, 14)]
            else:
                j = 3 + h(s, k, "j") % 10
                cv.rect(j, y0, j, y1, MORT)
                parts = [(0, j - 1), (j + 1, 14)]
        for i, (p0, p1) in enumerate(parts):
            if p1 < p0: continue
            tone = STONE_TONES[h(s, k, i, "t") % len(STONE_TONES)]
            if depth > 0.6 and h(s, k, i, "dk") % 2 == 0: tone = step(tone, -1)
            if depth > 0.9 and h(s, k, i, "dk2") % 3 == 0: tone = step(tone, -1)
            stone(cv, p0, y0, p1, y1, tone, (s, k, i), crack=h(s, k, i, "cr") % 7 == 0,
                  moss=(1 + h(s, k, i, "mo") % 2) if (k == COURSES - 1 and h(s, k, i, "m") % 2 == 0) else 0,
                  weather=1 if depth > 0.4 else 0)
            # 깨진 모서리(돌 귀퉁이 한 점이 줄눈 색)
            if p1 - p0 >= 4 and h(s, k, i, "chip") % 4 == 0:
                cx = p0 if h(s, k, i, "cs") % 2 else p1
                cv.set(cx, y0 if h(s, k, i, "cy") % 2 else y1, MORT)
    # 빗물 자국: 갓돌 밑에서 흘러내린 짙은 줄 1~2개(변형마다 자리·길이 다름) — 돌·줄눈 모두 한 단 어둡게, 끝은 성기게
    for n in range(1 + var % 2):
        sx = 2 + h(s, n, "rx") % 12
        ln = 10 + h(s, n, "rl") % 22
        for y in range(COURSE_TOP, min(PLINTH_Y, COURSE_TOP + ln)):
            if y > COURSE_TOP + ln - 6 and y % 2: continue
            cv.shade(sx, y, -2 if y < COURSE_TOP + ln // 2 else -1)
            if h(s, n, y, "rw") % 3 == 0: cv.shade(sx + 1, y, -1)
    # 굽도리 12행: 내민 턱(빛 2행 + 그늘 1행) + 큰 돌 7행(흙물·이끼) + 줄눈 + 짙은 밑
    py = PLINTH_Y
    for x in range(16):
        cv.set(x, py, COOL[10] if x % 8 else COOL[9]); cv.set(x, py + 1, COOL[8]); cv.set(x, py + 2, COOL[5])
    for (p0, p1) in ((0, 6), (8, 14)):
        tone = [COOL[6], COOL[7], WARM[4], COOL[5]][h(s, p0, "pl") % 4]
        stone(cv, p0, py + 3, p1, py + 9, tone, (s, "pl", p0), moss=1 + h(s, p0, "plm") % 3, weather=1)
        for x in range(p0, p1 + 1):          # 흙물: 아래 두 행이 한 단 더 어둡다
            for y in (py + 8, py + 9):
                if h(s, x, y, "mud") % 3: cv.shade(x, y, -1)
    cv.rect(7, py + 3, 7, py + 9, MORT); cv.rect(15, py + 3, 15, py + 9, MORT)
    for x in range(16):
        cv.set(x, py + 10, MORT if h(s, x, "b") % 5 else OUT2); cv.set(x, py + 11, OUT2)
        if h(s, x, "tuft") % 6 == 0: cv.set(x, py + 10, MOSS[1 + h(s, x, "tc") % 2])    # 기초 밑 풀·이끼
    # 굽도리 이끼 덩이(2~4px, 변형마다 자리 다름) — 점 하나가 아니라 덩이로
    for n in range(1 + (var + 1) % 2):
        mx = 1 + h(s, n, "mcx") % 13; my = py + 7 + h(s, n, "mcy") % 3
        for (dx, dy) in ((0, 0), (1, 0), (0, 1), (1, 1), (2, 1), (-1, 1)):
            if h(s, n, dx, dy, "mk") % 4: cv.set(mx + dx, my + dy, MOSS[(dx + dy + n) % 3])
    if var == 3 and not left and not right:      # 물빼기 구멍 + 그 밑으로 흘러내린 물때
        # 내민 돌 물받이(빛 받는 윗면 · 몸 · 짙은 구멍) + 그 밑으로 번진 물때 띠
        dy = course_top(3)
        cv.rect(4, dy, 10, dy, COOL[11]); cv.rect(4, dy + 1, 10, dy + 2, COOL[8]); cv.rect(4, dy + 3, 10, dy + 3, COOL[5])
        cv.set(4, dy + 1, COOL[10]); cv.set(10, dy + 1, COOL[6]); cv.set(10, dy + 2, COOL[6])
        cv.rect(6, dy + 1, 8, dy + 2, OUT); cv.set(7, dy + 1, OUT2)
        for x in range(5, 11): cv.shade(x, dy + 4, -2)
        for y in range(dy + 5, PLINTH_Y):
            for x in (6, 7, 8):
                if cv.get(x, y) in (MORT, MORT2): continue
                if x == 7 or (y < dy + 14 and h(s, x, y, "wt") % 3): cv.shade(x, y, -1)
    if var == 1 and not left and not right:      # 보수한 돌(다른 결의 따뜻한 돌 두 개 — 나중에 갈아 끼운 자리)
        k = 2; y0 = course_top(k); y1 = y0 + COURSE_H[k] - 1
        stone(cv, 4, y0, 9, y1, WARM[5], ("patch", var))
        cv.rect(3, y0, 3, y1, MORT); cv.rect(10, y0, 10, y1, MORT)
    if var == 2 and not left and not right:      # 화살 구멍(갓돌 밑 네 켜)
        arrow_slit(cv, 7, 8, 18)
    if var == 4 and not left and not right:      # 넓은 물때: 갓돌 밑에서 세 켜 아래까지 번진 짙은 얼룩(가운데 짙고 가장자리 성김)
        cx0 = 4 + h(s, "st") % 6
        for y in range(COURSE_TOP, course_top(4)):
            wdt = 2 + (y - COURSE_TOP) // 8
            for x in range(cx0 - wdt // 2, cx0 + wdt // 2 + 2):
                if cv.get(x, y) in (MORT, MORT2): continue
                if abs(x - cx0) <= 1 or h(s, x, y, "sd") % 3: cv.shade(x, y, -1)
    if var == 5 and not left and not right:      # 금: 세 켜를 비스듬히 가르는 금 + 떨어져 나간 귀퉁이
        x = 3 + h(s, "ck") % 4
        for y in range(course_top(1), course_top(4) - 1):
            if cv.get(x, y) not in (MORT, MORT2): cv.shade(x, y, -2)
            if y % 3 == 0: x += 1
        y0 = course_top(5)
        for (dx, dy) in ((0, 0), (1, 0), (0, 1)): cv.set(10 + dx, y0 + dy, MORT2)
    if var == 6 and not left and not right:      # 굽도리에서 타고 오른 담쟁이(이끼 덩굴) — 줄기 + 잎 덩이
        x = 6 + h(s, "iv") % 5
        for y in range(PLINTH_Y + 6, course_top(3), -1):
            cv.set(x, y, MOSS[0] if y % 4 else MOSS[1])
            if h(s, y, "lf") % 3 == 0:
                for (dx, dy) in ((-1, 0), (1, 0), (-1, -1), (2, 0)):
                    cv.set(x + dx, y + dy, MOSS[2 + (dx + y) % 2])
            if y % 5 == 0: x += 1 if h(s, y, "dir") % 2 else -1
            x = max(2, min(13, x))
    if var == 7 and not left and not right:      # 짙게 삭은 켜 하나 + 갈아 끼운 따뜻한 돌
        k = 4; y0 = course_top(k)
        for y in range(y0, y0 + COURSE_H[k]):
            for x in range(16):
                if cv.get(x, y) not in (MORT, MORT2): cv.shade(x, y, -1)
        k = 1; y0 = course_top(k)
        stone(cv, 6, y0, 12, y0 + COURSE_H[k] - 1, WARM[6], ("patch7",))
        cv.rect(5, y0, 5, y0 + COURSE_H[k] - 1, MORT); cv.rect(13, y0, 13, y0 + COURSE_H[k] - 1, MORT)
    if left == "end": _quoins(cv, "L")
    if right == "end": _quoins(cv, "R")
    if left == "shadow": _cast_shadow_left(cv)
    return cv


def _quoins(cv, side):
    """모서리 돌: 켜마다 긴 돌(9px)·짧은 돌(5px)을 번갈아, 바깥 열은 윤곽."""
    for k in range(COURSES):
        y0 = course_top(k); y1 = y0 + COURSE_H[k] - 1
        w = 9 if k % 2 == 0 else 5
        if side == "L":
            x0, x1 = 1, w
            cv.rect(x1 + 1, y0, x1 + 1, y1, MORT)
        else:
            x0, x1 = 15 - w, 14
            cv.rect(x0 - 1, y0, x0 - 1, y1, MORT)
        stone(cv, x0, y0, x1, y1, COOL[9] if k % 2 == 0 else COOL[8], ("q", side, k))
        if side == "R":
            for y in range(y0, y1 + 1): cv.shade(x1, y, -1)
    xo = 0 if side == "L" else 15
    for y in range(FACE_H):
        cv.set(xo, y, EDGE if y < FACE_H - 1 else OUT)
    xi = 1 if side == "L" else 14
    cv.set(xi, 0, COOL[9] if side == "L" else COOL[7]); cv.set(xi, PLINTH_Y, COOL[9] if side == "L" else COOL[7])


def SHADOW_PROFILE(x, y):
    """왼쪽 물체 그늘 세기(r13): 9열 네 단 · 3열 두 단 · 2열 성긴 한 단 — 고른 짙은 덩이로 읽혀야 한다(얕으면 잡색 돌 사이에 묻혔다)."""
    if x < 9: return -4
    if x < 12: return -2
    if x < 14: return -1 if (x + y) % 2 == 0 else -2
    return 0


def _cast_shadow_left(cv):
    """왼쪽에 선 세로 성벽·망루·성문루가 드리운 그늘: 왼쪽 9열(두 단 5열 + 한 단 3열 + 성긴 한 열)."""
    # 3판 r13: 넓고 짙게(망루·성문루는 성벽보다 높다 — 8열 한두 단은 1배에서 안 보였다): 7열 세 단 · 4열 두 단 · 3열 한 단(성긴 끝)
    for y in range(FACE_H):
        for x in range(14):
            n = SHADOW_PROFILE(x, y)
            if n: cv.set(x, y, step_any(cv.get(x, y), n))


# ================================================================ 통로 판석 (윗면)
def flags(cv, x0, y0, x1, y1, seed, rows=(7, 6), shift=0):
    """판석을 [x0,x1]×[y0,y1] 에 깐다. 줄 높이 rows, 줄마다 이음새 하나 또는 둘(자리는 줄 번호로만 정해 칸 16px 주기로 감긴다).
    판석마다 윗변 빛·아랫변/오른변 그늘, 닳은 점, 가끔 금 — 앞면 마름돌(차가운 회색 켜)과 다른 따뜻한 큰 판석이라 윗면으로 읽힌다."""
    y = y0
    r = 0
    while y <= y1:
        hh = rows[r % len(rows)]
        ya, yb = y, min(y1, y + hh - 1)
        p1 = (r * 7 + shift) % 16
        joints = {p1}
        if r % 3 != 1: joints.add((p1 + 7 + (r % 2) * 2) % 16)
        xs = [x for x in range(x0, x1 + 1) if (x % 16) in joints]
        bounds = [x0 - 1] + xs + [x1 + 1]
        for i in range(len(bounds) - 1):
            a, b = bounds[i] + 1, bounds[i + 1] - 1
            if a > b: continue
            key = (seed, r, a % 16, i)
            tone = FLAG[[6, 6, 5, 7, 6, 5, 5, 6, 7][h(*key, "t") % 9]]
            crack = h(*key, "c") % 7 == 0 and b - a >= 5
            cx = a + 2 + h(*key, "cx") % max(1, b - a - 3)
            for yy in range(ya, yb + 1):
                for xx in range(a, b + 1):
                    c = tone
                    if yy == ya and xx < b: c = step(tone, 1)
                    elif xx == a and yy <= ya + 2: c = step(tone, 1)
                    if yy == yb and xx > a: c = step(tone, -1)
                    elif xx == b and yy > ya: c = step(tone, -1)
                    if h(seed, xx % 16, yy, "f") % 5 == 0 and ya < yy < yb: c = step(tone, -1)
                    elif h(seed, xx % 16, yy, "g") % 11 == 0 and ya < yy < yb: c = step(tone, 1)
                    if h(seed, xx % 16, yy, "pit") % 37 == 0 and ya < yy < yb: c = step(tone, -2)
                    if crack and xx == cx + (yy - ya) // 3 and ya < yy < yb: c = step(tone, -2)
                    cv.set(xx, yy, c)
        for x in xs:
            for yy in range(ya, yb + 1): cv.set(x, yy, FLAG[1] if h(seed, x % 16, yy) % 4 else FLAG[2])
        if yb + 1 <= y1:
            for x in range(x0, x1 + 1): cv.set(x, yb + 1, FLAG[1] if h(seed, x % 16, yb, "jr") % 5 else FLAG[2])
        y = yb + 2
        r += 1


# ================================================================ 흉벽
MER_W, CREN_W = 5, 3      # 8px 주기: 톱니 5 + 총안 3


def merlon_col(x):
    return x % 8 < MER_W


def front_parapet(cv, x0, x1, y_top, seed):
    """앞 흉벽(바깥 면이 카메라 쪽): y_top 부터 10행. 톱니 = 윗면 3행 + 앞면 7행, 총안 = 판석 3행 + 흉벽 갓 3행 + 앞면 4행.
    아래로 앞면 갓돌 띠(face_column 0~3행)에 이어진다."""
    for x in range(x0, x1 + 1):
        m = merlon_col(x); k = x % 8
        # 이 빠진 톱니(변형마다 다른 자리): 톱니 윗모서리 한두 점이 떨어져 나가 뒤 판석이 보인다 — 빗살처럼 고른 줄을 깬다
        chip = m and k in (0, MER_W - 1) and h(seed, x // 8, k, "chip") % 3 == 0
        for i in range(10):
            y = y_top + i
            if chip and i == 0: continue
            if chip and i == 1 and h(seed, x // 8, "chip2") % 2 == 0: continue
            if m:
                if i == 0: c = COOL[11] if k < MER_W - 1 else COOL[9]
                elif i <= 2: c = COOL[10] if k < MER_W - 1 else COOL[8]
                elif i == 3: c = COOL[9] if k == 0 else (COOL[8] if k < MER_W - 1 else COOL[6])
                else:
                    c = COOL[8] if k == 0 else (COOL[7] if k < MER_W - 1 else COOL[6])
                    if i == 9: c = MORT
                if k == MER_W - 1 and i >= 3: c = COOL[5] if i < 9 else MORT
            else:
                if i <= 2: continue                       # 총안 사이로 통로가 보인다
                if i == 3: c = COOL[10] if k == MER_W else COOL[9]
                elif i == 4: c = COOL[6]
                elif i == 5: c = COOL[4] if k != MER_W else COOL[5]      # 총안 바닥 그늘(왼쪽 톱니 그림자)
                else:
                    c = COOL[7] if k != MER_W else COOL[6]
                    if i == 9: c = MORT
                if k == MER_W and 3 <= i <= 6: c = step(c, -1)      # 왼쪽 톱니가 드리운 그늘
            cv.set(x, y, c)


def back_parapet(cv, x0, x1, seed, base_y=0):
    """뒤 흉벽(안쪽 면이 카메라 쪽, 북쪽 성벽): 톱니 윗면 0~2 · 안쪽 면 3~10, 총안은 0~2 투명 · 흉벽 갓 3~5 · 면 6~10.
    11 = 흉벽 발치 줄눈, 12~13 = 흉벽이 통로에 드리운 그늘(판석 위에 나중에 어둡게)."""
    for x in range(x0, x1 + 1):
        m = merlon_col(x); k = x % 8
        for i in range(12):
            y = base_y + i
            if m:
                if i == 0: c = EDGE
                elif i <= 2: c = COOL[10] if k < MER_W - 1 else COOL[8]
                elif i == 3: c = COOL[9] if k == 0 else COOL[8]
                else:
                    c = COOL[8] if k == 0 else (COOL[7] if k < MER_W - 1 else COOL[5])
                if i == 11: c = OUT2
                if k == 0 and i > 0: c = step(c, 1) if c not in (OUT2,) else c
            else:
                if i <= 2: continue
                if i == 3: c = EDGE
                elif i == 4: c = COOL[10]
                elif i == 5: c = COOL[8]
                else:
                    c = COOL[6] if k == MER_W else COOL[7]
                    if i == 8: c = MORT2
                if i == 11: c = OUT2
            cv.set(x, y, c)


def side_parapet(cv, x_out, y0, y1, side, wy=0):
    """세로 성벽 흉벽 띠(위에서 본 것): 바깥 윤곽 1 + 흉벽 6열. 8px 주기로 톱니 윗면 3행 + 남쪽 면 2행 + 흉벽 갓 3행.
    side 'W' = 띠가 x_out..x_out+6, 'E' = x_out-6..x_out. wy = 주기 맞춤."""
    for y in range(y0, y1 + 1):
        k = (y + wy) % 8
        for j in range(7):
            x = x_out + j if side == "W" else x_out - j
            if j == 0: c = EDGE; cv.set(x, y, c); continue
            jj = j if side == "W" else 7 - j     # 1(바깥)~6(안쪽) — 빛은 왼쪽이 밝다
            left_lit = (side == "W" and j == 1) or (side == "E" and j == 6)
            right_dark = (side == "W" and j == 6) or (side == "E" and j == 1)
            if k <= 2:      # 톱니 윗면
                c = COOL[11] if k == 0 else COOL[10]
                if left_lit: c = COOL[11]
                if right_dark: c = COOL[8]
            elif k <= 4:    # 톱니 남쪽 면
                c = COOL[7] if k == 3 else COOL[6]
                if left_lit: c = COOL[8]
                if right_dark: c = COOL[5]
            else:           # 총안: 톱니보다 낮은 흉벽 바닥 — 북쪽 톱니가 드리운 그늘이 짙다
                c = (MORT, COOL[4], COOL[6])[k - 5]
                if left_lit: c = step(c, 1)
                if right_dark: c = step(c, -1)
            cv.set(x, y, c)
        # 흉벽 안쪽 가장자리 + 통로에 진 그늘(서쪽 흉벽만: 빛이 서쪽에서 온다)
        xe = x_out + 7 if side == "W" else x_out - 7
        cv.set(xe, y, MORT if k > 4 else OUT2)
        if side == "W":
            cv.shade(xe + 1, y, -2); cv.shade(xe + 2, y, -1)


# ================================================================ 조각: 가로 성벽 윗면 (16×32 = 위·아래 두 칸)
def south_top(var=0, shade_left=False):
    """남쪽 성벽 윗면: 0 뒤 가장자리 윤곽 · 1 턱 빛 · 2~21 판석 · 22~31 앞 흉벽(아래 앞면 갓돌로 이어진다)."""
    cv = Canvas(16, 32)
    flags(cv, 0, 2, 15, 24, ("hs", var))
    for x in range(16):
        cv.set(x, 0, EDGE); cv.set(x, 1, FLAG[7] if x % 6 else FLAG[8])
    front_parapet(cv, 0, 15, 22, ("hs", var))
    if shade_left:
        for y in range(32):
            for x in range(14):
                n = SHADOW_PROFILE(x, y)
                if n: cv.set(x, y, step_any(cv.get(x, y), n))
    return cv


def north_top(var=0, stair=False, shade_left=False):
    """북쪽 성벽 윗면: 0~11 뒤 흉벽(안쪽 면) · 12~13 흉벽 그늘 · 12~29 판석 · 30 앞 턱 빛 · 31 윤곽."""
    cv = Canvas(16, 32)
    flags(cv, 0, 12, 15, 29, ("hn", var), shift=3)
    back_parapet(cv, 0, 15, ("hn", var))
    for x in range(16):
        cv.shade(x, 12, -2); cv.shade(x, 13, -1)
        cv.set(x, 30, FLAG[7] if x % 5 else FLAG[8]); cv.set(x, 31, OUT2)
    if stair:
        # 계단 머리: 앞 턱을 끊고 판석이 계단 맨 윗단으로 이어진다
        for x in range(4, 16):
            cv.set(x, 30, FLAG[6] if x % 6 else FLAG[5]); cv.set(x, 31, FLAG[5])
        cv.set(3, 30, FLAG[3]); cv.set(3, 31, OUT2)
    if shade_left:      # 3판 r13: 북쪽 성벽 통로에도 왼쪽 망루·성문루 그늘(뒤 흉벽 안쪽 면까지)
        for y in range(32):
            for x in range(14):
                n = SHADOW_PROFILE(x, y)
                if n: cv.set(x, y, step_any(cv.get(x, y), n))
    return cv


# ================================================================ 세로 성벽 (32×16 = 두 열, 8px 주기 두 번)
def vert_wall(side, wy=0, var=0):
    """서(W)·동(E) 성벽 윗면 한 줄(32×16): 바깥 흉벽 띠 + 판석 + 안쪽 가장자리."""
    cv = Canvas(32, 16)
    if side == "W":
        flags(cv, 8, 0, 29, 15, ("v", side, var), rows=(8, 7), shift=2)
        side_parapet(cv, 0, 0, 15, "W", wy)
        for y in range(16): cv.set(30, y, FLAG[3]); cv.set(31, y, EDGE)
    else:
        flags(cv, 2, 0, 23, 15, ("v", side, var), rows=(8, 7), shift=9)
        side_parapet(cv, 31, 0, 15, "E", wy)
        for y in range(16): cv.set(1, y, FLAG[7]); cv.set(0, y, EDGE)
    return cv


def vert_end_south(side):
    """세로 성벽 남쪽 끝(틈 위): 판석 끝 + 흉벽이 앞으로 감싼다(앞 흉벽 → 아래 끝 앞면)."""
    cv = vert_wall(side, 0, 9)
    for y in range(6, 16):
        for x in range(32): cv.set(x, y, CLEAR)
    flags(cv, 1 if side == "E" else 8, 6, 30 if side == "W" else 23, 8, ("ve", side))
    for x in range(32):      # 앞 흉벽 총안 사이로 보이는 것은 통로 판석(풀이 비치지 않게)
        for y in range(6, 9):
            if not cv.get(x, y)[3]: cv.set(x, y, FLAG[5] if y < 8 else FLAG[4])
    front_parapet(cv, 0, 31, 6, ("ves", side))
    _close_sides(cv, 6, 15)
    return cv


def vert_end_north(side):
    """세로 성벽 북쪽 끝(틈 아래): 뒤 흉벽(안쪽 면)이 감싼다."""
    cv = vert_wall(side, 0, 7)
    for y in range(0, 12):
        for x in range(32): cv.set(x, y, CLEAR)
    back_parapet(cv, 0, 31, ("ven", side))
    for x in range(32):
        cv.shade(x, 12, -2); cv.shade(x, 13, -1)
    _close_sides(cv, 0, 15)
    return cv


def _close_sides(cv, y0, y1):
    for y in range(y0, y1 + 1):
        if cv.get(0, y)[3]: cv.set(0, y, EDGE)
        if cv.get(cv.w - 1, y)[3]: cv.set(cv.w - 1, y, EDGE)


# ================================================================ 모서리 2×2 (32×32)
def corner(kind):
    """둘레 볼록 모서리. nw·ne: 위 = 뒤 흉벽, 옆 = 세로 흉벽 띠. sw·se: 옆 = 세로 흉벽 띠, 아래 = 앞 흉벽(앞면으로 이어진다)."""
    cv = Canvas(32, 32)
    west = kind in ("nw", "sw")
    fx0, fx1 = (8, 31) if west else (0, 23)
    if kind in ("nw", "ne"):
        flags(cv, fx0, 12, fx1, 31, ("c", kind), rows=(7, 7), shift=2 if west else 9)
        side_parapet(cv, 0 if west else 31, 0, 31, "W" if west else "E")
        back_parapet(cv, 0, 31, ("c", kind))
        for x in range(32):
            cv.shade(x, 12, -2); cv.shade(x, 13, -1)
        # 모서리 톱니: 두 흉벽이 만나는 네모 덩이(윗면 빛 + 안쪽 면)
        cx0 = 0 if west else 24
        for y in range(0, 12):
            for x in range(cx0, cx0 + 8):
                xl = x - cx0
                if y == 0: c = EDGE
                elif y <= 4: c = COOL[11] if (xl < 6 if west else xl > 0) else COOL[9]
                else: c = COOL[8] if (xl > 0) else COOL[9]
                if y == 5: c = COOL[7]
                if y == 11: c = OUT2
                cv.set(x, y, c)
        for y in range(32): cv.set(0 if west else 31, y, EDGE)
        # 안쪽 가장자리: 아래로 세로 성벽의 안쪽 턱이 이어진다
        # 안쪽 꺾임 점(오른쪽 아래): 세로 성벽의 안쪽 턱과 북쪽 성벽 앞 턱이 여기서 만난다 — 그 밖은 판석이 그대로 잇는다
        xo, xi = (31, 30) if west else (0, 1)
        cv.set(xi, 30, FLAG[3] if west else FLAG[7]); cv.set(xo, 30, EDGE)
        cv.set(xi, 31, EDGE); cv.set(xo, 31, EDGE)
    else:
        flags(cv, fx0, 0, fx1, 24, ("c", kind), rows=(7, 7), shift=2 if west else 9)
        side_parapet(cv, 0 if west else 31, 0, 21, "W" if west else "E")
        front_parapet(cv, 0, 31, 22, ("c", kind))
        cx0 = 0 if west else 24
        for y in range(16, 32):
            for x in range(cx0, cx0 + 8):
                xl = x - cx0
                yy = y - 16
                if yy <= 2: c = COOL[11] if xl < 6 else COOL[9]
                elif yy <= 5: c = COOL[10] if xl < 6 else COOL[8]
                else:
                    c = COOL[8] if xl > 0 else COOL[9]
                    if xl == 7: c = COOL[6]
                    if yy == 15: c = MORT
                cv.set(x, y, c)
        for y in range(32): cv.set(0 if west else 31, y, EDGE)
        # 안쪽 꺾임 점(오른쪽 위): 세로 성벽 안쪽 턱과 남쪽 성벽 뒤 가장자리가 만난다
        xo, xi = (31, 30) if west else (0, 1)
        cv.set(xi, 0, EDGE); cv.set(xo, 0, EDGE)
        cv.set(xi, 1, FLAG[3] if west else FLAG[7]); cv.set(xo, 1, EDGE)
    return cv


# ================================================================ 계단 (북쪽 성벽 안쪽 앞면 자리, 16×48)
STAIR_W = 3     # 계단 폭(칸)


def stairs():
    """북쪽 성벽 안쪽 앞면에 붙여 쌓은 옆 계단 3×4(48×64): 왼쪽 아래 땅에서 오른쪽 위 성벽 통로로 8단(단마다 폭 6·높이 8).
    3판 r12: 계단 몸 남쪽 면은 성벽 앞면과 같은 빛을 받는 마름돌(한 단 어둡게) — 거의 검은 몸이 「벽에 뚫린 톱니 구멍」으로 읽혔다.
    디딤판은 위에서 본 판석 네 행(뒤 · 가운데 · 앞 코 빛), 코 밑 그늘 한 행, 단 왼쪽 모서리 빛, 디딤판 뒤 벽에 닿는 줄 그늘."""
    cv = Canvas(16 * STAIR_W, FACE_H)
    for i in range(STAIR_W):
        cv.paste(face_column(0 if i != 1 else 3), 16 * i, 0)      # 화살 구멍 변형(2)은 계단 뒤에 두지 않는다
    Wd = 16 * STAIR_W
    mass = Canvas(Wd, FACE_H)
    masonry(mass, 0, Wd - 1, 0, FACE_H - 1, ("stm",), tones=TOWER_TONES)
    top_of = lambda x: FACE_H - 8 * (min(7, x // 6) + 1)
    for x in range(Wd):
        top = top_of(x)
        if top > 0: cv.set(x, top - 1, OUT2)                                  # 디딤판 뒤가 벽에 닿는 윤곽 줄(r13)
        if top > 1: cv.set(x, top - 2, step_any(cv.get(x, top - 2), -2))         # 그 위 벽에 진 얕은 그늘
        for y in range(top, FACE_H):
            d = y - top
            j = min(7, x // 6)
            if d < 4:                                   # 디딤판(위에서 본 판석)
                c = (WARM[5], WARM[6], WARM[7], WARM[8])[d]
                if x == 6 * j: c = WARM[8]
                if x == 6 * j + 5 and d < 3: c = WARM[4]
                if j == 7 and x > 6 * j + 5: c = (WARM[5], WARM[6], WARM[7], WARM[8])[d]
            elif d == 4:
                c = OUT2                                # 디딤판 코 밑 그늘
            else:
                # 계단 몸 남쪽 면: 마름돌 두 단 어둡게(r13: 한 단이면 뒤 성벽과 같은 돌로 녹아 「희미한 사선 조각」) +
                # 단마다 오른쪽 끝 짙은 줄(챌판 사이 그늘)로 기둥이 갈린다
                # r13: 단마다 챌판(디딤판 밑 8행, 빛 받는 면 −1)과 그 밑 계단 몸(그늘 −4) — 계단 꼴 띠가 생긴다.
                # 줄눈은 디딤판 높이(8행 주기)에 맞춘 가로줄 + 단 경계 세로 짙은 줄(챌판 높이까지만)
                c = step_any(mass.get(x, y), -1 if d < 12 else -4)
                if (FACE_H - y) % 8 == 0: c = OUT2
                if x % 6 == 5 and j < 7 and d < 12: c = OUT2
                if x == 6 * j and d < 12: c = COOL[9]           # 단 앞 모서리 빛
            cv.set(x, y, c)
    for x in range(Wd): cv.set(x, FACE_H - 1, OUT)
    return cv


# ================================================================ 윗면 소품(위에서 내려다본 것 — 윗면이 바닥으로 읽히게)
def trapdoor(cv, hx0, hy0):
    """나무 들창 10×9(쇠 띠·고리) — 오른쪽 아래가 그늘."""
    for y in range(hy0, hy0 + 9):
        for x in range(hx0, hx0 + 10):
            if y in (hy0, hy0 + 8) or x in (hx0, hx0 + 9): c = WOOD[1]
            else:
                c = WOOD[4] if (x - hx0) % 3 else WOOD[3]
                if y == hy0 + 1: c = WOOD[5]
                if y in (hy0 + 3, hy0 + 6): c = IRON[1] if (x - hx0) % 3 else IRON[2]
            cv.set(x, y, c)
    cv.set(hx0 + 7, hy0 + 4, IRON[2]); cv.set(hx0 + 7, hy0 + 5, IRON[0])
    for x in range(hx0 + 1, hx0 + 11): cv.shade(x, hy0 + 9, -2)
    for y in range(hy0 + 1, hy0 + 9): cv.shade(hx0 + 10, y, -2)


def ball(cv, cx, cy):
    """돌 탄환 하나(지름 5): 왼쪽 위 빛·오른쪽 아래 그늘, 바닥 그늘."""
    for dy in range(-2, 3):
        for dx in range(-2, 3):
            if dx * dx + dy * dy > 5: continue
            c = COOL[7]
            if dx + dy <= -2: c = COOL[10]
            elif dx + dy >= 2: c = COOL[4]
            cv.set(cx + dx, cy + dy, c)
    cv.set(cx - 1, cy - 1, COOL[11])
    for dx in range(-1, 4): cv.shade(cx + dx, cy + 3, -2)


def ball_pile(cv, x, y):
    ball(cv, x + 1, y); ball(cv, x, y + 4); ball(cv, x + 4, y + 4)


def barrel(cv, cx, cy):
    """통: 위에서 본 둥근 뚜껑(쇠테) + 앞쪽 몸통 한 줄 + 그늘."""
    for dy in range(-3, 4):
        for dx in range(-3, 4):
            r2 = dx * dx + dy * dy
            if r2 > 10: continue
            c = IRON[2] if r2 >= 7 else (WOOD[5] if (dx + 3) % 3 else WOOD[4])
            if r2 < 7 and dx + dy <= -3: c = WOOD[6]
            cv.set(cx + dx, cy + dy, c)
    for dx in range(-2, 3): cv.set(cx + dx, cy + 4, WOOD[2]); cv.shade(cx + dx + 1, cy + 5, -2)


def crate(cv, x, y, w=8):
    """나무 상자: 윗면(널 결 가로) 5행 + 앞면 3행(짙은 널) + 오른쪽·아래 그늘."""
    for yy in range(y, y + 8):
        for xx in range(x, x + w):
            if yy < y + 5:
                c = WOOD[5] if (yy - y) % 2 == 0 else WOOD[4]
                if yy == y: c = WOOD[6]
                if xx in (x, x + w - 1): c = WOOD[3]
            else:
                c = WOOD[2] if yy < y + 7 else WOOD[1]
                if xx in (x, x + w - 1) or yy == y + 5: c = WOOD[1] if yy > y + 5 else IRON[1]
            cv.set(xx, yy, c)
    for xx in range(x + 1, x + w + 1): cv.shade(xx, y + 8, -2)
    for yy in range(y + 1, y + 8): cv.shade(x + w, yy, -2)


def brazier(cv, cx, cy):
    """화로: 위에서 본 쇠 그릇 테 + 숯·불꽃 + 세 다리 그늘."""
    for dy in range(-3, 4):
        for dx in range(-3, 4):
            r2 = dx * dx + dy * dy
            if r2 > 11: continue
            if r2 >= 6: c = IRON[2] if dx + dy < 0 else IRON[1]
            elif r2 <= 1: c = FIRE[1]
            else: c = FIRE[0] if (dx + dy) % 2 else WOOD[1]
            cv.set(cx + dx, cy + dy, c)
    cv.set(cx, cy - 4, FIRE[0])
    for dx in range(-2, 4): cv.shade(cx + dx, cy + 4, -2)
    # 둘레 판석에 비친 불빛
    for dx, dy in ((-4, 0), (4, -1), (0, -5), (-3, 3), (4, 3)):
        c = cv.get(cx + dx, cy + dy)
        if c in FLAG: cv.set(cx + dx, cy + dy, step(c, 1))


def pennant(cv, x, y):
    """깃대(밑동 x,y 에서 위로 20px) + 오른쪽으로 나부끼는 삼각기 — 윗면 위로 선 세로 물체(3/4 에서 그대로 선다)."""
    for dx in range(-2, 3): cv.shade(x + dx + 2, y + 1, -2)
    cv.set(x - 1, y, IRON[1]); cv.set(x, y, IRON[2]); cv.set(x + 1, y, IRON[1])
    for i in range(1, 21):
        cv.set(x, y - i, WOOD[4] if i % 5 else WOOD[3]); cv.set(x + 1, y - i, WOOD[2])
    cv.set(x, y - 21, GOLD[1])
    for i in range(10):
        for j in range(max(1, 6 - (i * 6) // 10)):
            c = BANNER[3] if j == 0 else (BANNER[2] if j < 3 else BANNER[1])
            if i in (4, 5) and j == 1: c = BANNER[1]
            cv.set(x + 2 + i, y - 20 + j + (1 if i > 6 else 0), c)


PROPS = {"balls": ball_pile, "pennant": pennant, "barrel": barrel, "crate": crate, "brazier": brazier,
         "crate2": lambda cv, x, y: (crate(cv, x + 2, y - 3, 6), crate(cv, x, y + 3, 8))}


# ================================================================ 탑 윗면 플랫폼 (W×48) — 망루·성문루 공용
def platform(W, seed, hatch=True, dress=None):
    """사방 흉벽을 두른 윗면: 뒤 흉벽(0~11) · 옆 흉벽 띠 · 바닥 판석 · 앞 흉벽(38~47, 아래 앞면 띠로 이어진다)."""
    cv = Canvas(W, 48)
    flags(cv, 8, 12, W - 9, 40, seed, rows=(6, 6), shift=4)
    back_parapet(cv, 0, W - 1, seed)
    for x in range(W):
        cv.shade(x, 12, -2); cv.shade(x, 13, -1)
    side_parapet(cv, 0, 4, 37, "W", 4)
    side_parapet(cv, W - 1, 4, 37, "E", 4)
    front_parapet(cv, 0, W - 1, 38, seed)
    # 네 모서리 톱니 덩이
    for (cx0, cy0, top) in ((0, 0, True), (W - 8, 0, True), (0, 36, False), (W - 8, 36, False)):
        for y in range(12):
            for x in range(8):
                X, Y = cx0 + x, cy0 + y
                if Y >= 48: continue
                if y == 0 and top: c = EDGE
                elif y <= 3: c = COOL[11] if x < 6 else COOL[9]
                elif y <= 4: c = COOL[10] if x < 6 else COOL[8]
                else:
                    c = COOL[8] if x > 0 else COOL[9]
                    if x == 7: c = COOL[6]
                    if not top and Y == 47: c = MORT
                    if top and y == 11: c = OUT2
                cv.set(X, Y, c)
    for y in range(48):
        cv.set(0, y, EDGE); cv.set(W - 1, y, EDGE)
    if hatch:
        trapdoor(cv, W // 2 - 5 if hatch is True else hatch, 18)
    for (kind, x, y) in (dress or ()):
        PROPS[kind](cv, x, y)
    return cv


def corbel_band(cv, x0, x1, y0, seed):
    """흉벽 밑 내민 받침돌 띠(6행): 윗줄 갓돌 빛, 받침돌 사이는 짙은 그늘 — 플랫폼이 앞면 위로 내민 두께."""
    for x in range(x0, x1 + 1):
        cv.set(x, y0, COOL[10]); cv.set(x, y0 + 1, COOL[8])
        k = (x - x0) % 8
        for i in range(2, 6):
            if k in (0, 1, 2, 3):
                c = COOL[9] if k == 0 else (COOL[8] if k < 3 else COOL[6])
                if i == 5: c = COOL[6] if k < 3 else COOL[5]
            else:
                c = OUT if i >= 3 else OUT2
            cv.set(x, y0 + i, c)


def masonry(cv, x0, x1, y0, y1, seed, course=None, tones=None):
    """[x0,x1]×[y0,y1] 에 켜 돌쌓기(돌 5~12px, 켜 높이는 성벽 앞면과 같은 고르지 않은 줄, 켜마다 엇갈림, 아래로 갈수록 얼룩)."""
    k = 0
    y = y0
    while y <= y1:
        ch = COURSE_H[k % COURSES]
        if y1 - (y + ch) < 4: ch = y1 - y + 1          # 남은 줄이 한 켜가 못 되면 이 켜를 늘려 끝까지 채운다
        mortar_row(cv, y + ch, x0, x1, (seed, k))
        x = x0 - (h(seed, k, "o") % 7)
        i = 0
        while x <= x1:
            w = 5 + h(seed, k, i, "w") % 8
            a, b = x, x + w - 1
            tl = tones or STONE_TONES
            tone = tl[h(seed, k, i, "t") % len(tl)]
            low = y > y1 - 20
            if low and h(seed, k, i, "dk") % 2 == 0: tone = step(tone, -1)
            stone(cv, a, y, b, y + ch - 1, tone, (seed, k, i), clip=(x0, x1), crack=h(seed, k, i, "c") % 8 == 0, weather=1 if low else 0,
                  moss=1 if (y + ch > y1 - 2 and h(seed, k, i, "m") % 2 == 0) else 0)
            if b - a >= 4 and h(seed, k, i, "chip") % 4 == 0 and x0 <= a and b <= x1:
                cv.set(a if h(seed, k, i, "cs") % 2 else b, y if h(seed, k, i, "cy") % 2 else y + ch - 1, MORT)
            if b + 1 <= x1 and b + 1 >= x0: cv.rect(b + 1, y, b + 1, y + ch - 1, MORT)
            x = b + 2; i += 1
        y += ch + 1; k += 1


def quoin_edges(cv, x0, x1, y0, y1):
    """양 끝 모서리 돌(긴 돌·짧은 돌 번갈아)과 윤곽."""
    k = 0
    y = y0
    while y <= y1:
        ch = COURSE_H[k % COURSES]
        if y1 - (y + ch) < 4: ch = y1 - y + 1
        for side in ("L", "R"):
            w = 8 if (k + (side == "R")) % 2 == 0 else 5
            a, b = (x0 + 1, x0 + w) if side == "L" else (x1 - w, x1 - 1)
            stone(cv, a, y, b, y + ch - 1, COOL[9] if w == 8 else COOL[8], ("qe", side, k))
            if side == "R":
                for yy in range(y, y + ch): cv.shade(b, yy, -1)
            cv.rect(b + 1 if side == "L" else a - 1, y, b + 1 if side == "L" else a - 1, y + ch - 1, MORT)
        y += ch + 1; k += 1
    for y in range(y0, y1 + 1):
        cv.set(x0, y, EDGE); cv.set(x1, y, EDGE)


def plinth(cv, x0, x1, y0, seed):
    """굽도리 10행: 내민 턱 빛 2행 + 큰 돌 5행(이끼) + 줄눈 + 짙은 밑 2행."""
    for x in range(x0, x1 + 1):
        cv.set(x, y0, COOL[10] if (x - x0) % 8 else COOL[9]); cv.set(x, y0 + 1, COOL[8]); cv.set(x, y0 + 2, COOL[6])
    for a in range(x0, x1 + 1, 8):
        b = min(x1, a + 6)
        tone = [COOL[6], COOL[7], WARM[4], COOL[5]][h(seed, a, "pl") % 4]
        stone(cv, a, y0 + 3, b, y0 + 7, tone, (seed, "pl", a), moss=h(seed, a, "m") % 3, weather=1)
        if b + 1 <= x1: cv.rect(b + 1, y0 + 3, b + 1, y0 + 7, MORT)
    for x in range(x0, x1 + 1):
        cv.set(x, y0 + 8, MORT); cv.set(x, y0 + 9, OUT2)


def arrow_slit(cv, x, y, n=9):
    """화살 구멍: 2px 어두운 틈 + 왼쪽 빛 나팔면 + 오른쪽 그늘, 위아래 돌 받침."""
    cv.rect(x - 2, y - 1, x + 3, y - 1, COOL[10]); cv.rect(x - 2, y + n, x + 3, y + n, COOL[9])
    for i in range(n):
        cv.set(x - 1, y + i, COOL[10]); cv.set(x, y + i, OUT); cv.set(x + 1, y + i, OUT2 if i else OUT); cv.set(x + 2, y + i, COOL[5])
    m = y + n // 2
    for dx in (-2, -1, 2, 3): cv.set(x + dx, m, OUT if dx in (-1, 2) else OUT2)
    cv.set(x - 2, m - 1, COOL[10]); cv.set(x + 3, m + 1, COOL[5])


BANNER = [hx(c) for c in ("#1b193b", "#2e2b66", "#464198", "#524cb1", "#5a54be")]
GOLD = [hx(c) for c in ("#694b05", "#aa7a08")]


def banner(cv, x, y):
    """매단 깃발 7×18: 나무 막대 + 보라 천(왼쪽 빛·오른쪽 그늘·주름) + 금빛 문장 + 제비꼬리 끝 + 벽에 진 그림자."""
    for i in range(9): cv.set(x - 1 + i, y, WOOD[4] if 0 < i < 8 else WOOD[1])
    for yy in range(1, 17):
        for i in range(7):
            if yy >= 14 and (i == 3 or (yy == 16 and i in (2, 4))): continue      # 제비꼬리
            c = BANNER[3] if i < 2 else (BANNER[2] if i < 5 else BANNER[1])
            if i == 0: c = BANNER[4]
            if i == 6: c = BANNER[0]
            if i == 4 and yy % 5 == 2: c = BANNER[1]
            cv.set(x + i, y + yy, c)
        cv.shade(x + 7, y + yy, -2)
    for (dx, dy) in ((3, 5), (2, 6), (3, 6), (4, 6), (3, 7), (2, 8), (4, 8), (3, 9)):
        cv.set(x + dx, y + dy, GOLD[1] if dy < 8 else GOLD[0])


def shield(cv, cx, cy):
    """벽에 건 둥근 방패(지름 11): 쇠테 · 사분 문장(보라·금) · 가운데 쇠 돌기 · 벽에 진 그림자."""
    for dy in range(-5, 6):
        for dx in range(-5, 6):
            r2 = dx * dx + dy * dy
            if r2 > 30: continue
            if r2 >= 22: c = IRON[2] if dx + dy < 0 else IRON[1]
            else: c = (BANNER[3] if dx < 0 else BANNER[1]) if (dx < 0) == (dy < 0) else (GOLD[1] if dx < 0 else GOLD[0])
            cv.set(cx + dx, cy + dy, c)
        cv.shade(cx + 6, cy + dy, -2) if dy * dy <= 20 else None
    for dx in range(-3, 5): cv.shade(cx + dx, cy + 6, -2)
    cv.set(cx, cy, IRON[2]); cv.set(cx - 1, cy - 1, COOL[11]); cv.set(cx + 1, cy + 1, IRON[0])


def torch(cv, x, y):
    """벽 횃불: 쇠 받침 + 불꽃 4행 + 둘레 따뜻한 빛 점."""
    pts = [(0, 0, FIRE[1]), (0, 1, FIRE[1]), (-1, 1, FIRE[0]), (1, 1, FIRE[0]), (0, 2, FIRE[0]), (-1, 2, FIRE[0]), (1, 2, FIRE[1]),
           (0, 3, WOOD[6]), (-1, 4, IRON[1]), (0, 4, IRON[2]), (1, 4, IRON[1]), (0, 5, IRON[1]), (0, 6, IRON[0]), (0, -1, FIRE[0])]
    for dx, dy, c in pts: cv.set(x + dx, y + dy, c)
    for dx, dy in ((-2, 1), (2, 1), (-2, 2), (2, 2), (-1, -1), (1, -1), (-2, 3), (2, 3)):
        c = cv.get(x + dx, y + dy)
        if c[3] == 255 and c in COOL: cv.set(x + dx, y + dy, WARM[7] if c in COOL[8:] else WARM[5])


# ================================================================ 망루 3×8 (48×128)
def window(cv, x, y):
    """망루 창 10×12: 둥근 머리 + 쇠살 두 줄 + 창턱 빛 + 오른쪽 그늘."""
    for yy in range(y, y + 12):
        for xx in range(x, x + 10):
            if yy < y + 2 and (xx in (x, x + 9) or (yy == y and xx in (x + 1, x + 8))): continue
            edge = xx in (x, x + 9) or yy in (y, y + 1) and xx in (x + 1, x + 8)
            c = COOL[10] if edge and xx < x + 5 else (COOL[5] if edge else OUT)
            if not edge and xx in (x + 3, x + 6): c = IRON[2]
            if not edge and yy == y + 6: c = IRON[1]
            cv.set(xx, yy, c)
    for xx in range(x - 1, x + 11): cv.set(xx, y + 12, COOL[10] if xx < x + 6 else COOL[8])
    for yy in range(y + 1, y + 13): cv.shade(x + 10, yy, -1)


TOWER_TONES = [WARM[6], WARM[5], COOL[8], WARM[6], WARM[4], COOL[7], WARM[7], WARM[5]]
TOWER_DRESS = (                     # 망루 윗면 변형: (들창 자리, 소품)
    (True, (("pennant", 33, 34),)),            # 3판 r11: 망루마다 실루엣이 다르게(셋 다 상자·통·화로라 같은 도장으로 읽혔다)
    (False, (("brazier", 23, 26),)),
    (False, (("balls", 11, 26), ("crate2", 28, 25))),
)
GT_ROWS = 9
TOWER_FACE_H = 96       # 3판 r8: 앞면 여섯 줄 — 성벽보다 두 줄 높게(한 줄 앞으로 내미니 윗면이 성벽 흉벽보다 한 줄 위에 선다)


def tower(var=0):
    """망루 3×9: 윗면 플랫폼(0~47) + 받침돌 띠 + 앞면 96px(48~143, 화살 구멍 셋·모서리 돌·굽도리). 성벽보다 32px 높고 한 줄 앞으로 내민다."""
    W = 48
    cv = Canvas(W, 48 + TOWER_FACE_H)
    hatch, dress = TOWER_DRESS[var]
    cv.paste(platform(W, ("tw", var), hatch=hatch, dress=dress), 0, 0)
    face = Canvas(W, TOWER_FACE_H)
    FB_ = TOWER_FACE_H - 10
    masonry(face, 1, W - 2, 6, FB_ - 1, ("twf",) if var == 0 else ("twf", var), tones=TOWER_TONES)
    corbel_band(face, 0, W - 1, 0, ("twc",))
    quoin_edges(face, 0, W - 1, 6, FB_ - 1)
    plinth(face, 0, W - 1, FB_, ("twp",) if var == 0 else ("twp", var))
    # 3판 r11: 앞면 구멍 배치도 망루마다(세 구멍 한 줄이 모든 망루에 찍혀 같은 도장으로 읽혔다)
    if var == 0:
        arrow_slit(face, 23, 14, 12); arrow_slit(face, 23, 46, 12); arrow_slit(face, 23, 70, 9)
    elif var == 1:
        arrow_slit(face, 14, 16, 12); arrow_slit(face, 32, 16, 12); arrow_slit(face, 23, 56, 10)
    else:
        window(face, 19, 14); arrow_slit(face, 13, 52, 10); arrow_slit(face, 33, 60, 10)
    # 앞면 오른쪽 끝 두 열은 그늘(빛이 왼쪽 위), 위 받침돌 띠 바로 밑은 내민 플랫폼이 드리운 그늘
    # 모서리 빛·그늘: 왼쪽 두 열 한 단 밝게, 오른쪽 네 열 한 단 · 끝 두 열 두 단 어둡게(네모 탑이 납작한 판으로 읽혔다, r9)
    for y in range(6, FB_):
        for x in (1, 2): face.set(x, y, step(face.get(x, y), 1))
        for x in range(W - 6, W - 1): face.shade(x, y, -1 if x < W - 3 else -2)
    for x in range(1, W - 1):
        face.shade(x, 6, -1)
    cv.paste(face, 0, 48)
    return cv


# ================================================================ 성문루 4×8 (64×128)
ARCH_CX = 31.5          # 아치 가운데(x 31|32 사이)
ARCH_R = 16             # 열린 반폭: x 16~47 = 통로 두 칸(cx 1·2)과 정확히 같다
ARCH_SPRING = 44        # 앞면 y(0=앞면 위) — 이 줄 아래는 곧은 문설주
RING = 5                # 홍예 두께


def _arch_half(fy):
    """앞면 y 에서 열린 반폭(소수). 열림 없으면 -1."""
    if fy >= ARCH_SPRING: return ARCH_R + 0.5
    dy = ARCH_SPRING - fy
    if dy > ARCH_R: return -1
    return (ARCH_R * ARCH_R - dy * dy) ** 0.5 + 0.5


def _ring_half(fy):
    if fy >= ARCH_SPRING: return ARCH_R + 0.5 + RING
    dy = ARCH_SPRING - fy
    R = ARCH_R + RING
    if dy > R: return -1
    return (R * R - dy * dy) ** 0.5 + 0.5


GATE_DRESS = (                      # 성문루 윗면 소품 변형(성문루마다 다르게 고른다)
    (("balls", 11, 30), ("barrel", 52, 32)),
    (("barrel", 11, 33), ("brazier", 52, 33)),
)


def gatehouse(closed=False, var=0):
    """성문루 64×112: 윗면 플랫폼(0~47) + 앞면(48~111). 반환 (위층 그림, 아래층 그림 — 통로 칸(cx 1·2, cy 4~6)의 터널 안).
    아래층 그림의 바닥은 투명(맵 길이 보인다)이고 안쪽으로 갈수록 반투명 그늘이 짙다."""
    W = 64
    up = Canvas(W, 128)
    lo = Canvas(W, 128)
    up.paste(platform(W, ("gh",), hatch=False), 0, 0)
    # 위에서 내려다본 성문루 지붕(3/4 윗면 단서): 쇠창살 구덩이 · 감아올리는 물레 · 돌 탄환 더미 · 통
    # 쇠창살 구덩이(x16~47, 25~31): 위에서 보면 먼 쪽(북) 안벽이 빛을 받아 보이고, 바닥은 어둠, 그 위에 쇠살 격자
    for x in range(16, 48):
        up.set(x, 25, FLAG[1])                                  # 북쪽 가장자리 턱(그늘)
        up.set(x, 26, COOL[5] if (x // 6) % 2 else COOL[4])      # 북쪽 안벽 위 켜(빛)
        up.set(x, 27, MORT if x % 6 == 0 else COOL[3])           # 안벽 아래 켜
        for y in (28, 29, 30):
            up.set(x, y, OUT2 if y == 28 else OUT)               # 구덩이 속 어둠
        if x % 4 == 2:                                           # 세로 쇠살(위에서 본 윗면 빛)
            for y in range(27, 31): up.set(x, y, IRON[2] if y < 29 else IRON[1])
        up.set(x, 29, IRON[1] if x % 4 != 2 else IRON[2])        # 가로 띠쇠
        up.set(x, 31, FLAG[7])                                   # 남쪽 가장자리 턱(빛)
    for y in range(25, 32):
        up.set(15, y, FLAG[2]); up.set(48, y, FLAG[6])
    # 물레(가로로 누운 나무 굴대): 윗면 빛 · 옆면 · 아래 그늘, 감긴 쇠사슬 띠, 양 끝 돌 받침
    for (bx0, bx1) in ((12, 16), (47, 51)):
        for x in range(bx0, bx1):
            up.set(x, 15, COOL[10]); up.set(x, 16, COOL[9]); up.set(x, 17, COOL[8])
            for y in (18, 19, 20): up.set(x, y, COOL[5] if x > bx0 else COOL[6])
            up.set(x, 21, COOL[3])
        up.set(bx0, 15, EDGE); up.set(bx1 - 1, 21, OUT2)
    for x in range(16, 47):
        for y, c in ((16, WOOD[6]), (17, WOOD[5]), (18, WOOD[4]), (19, WOOD[3]), (20, WOOD[1])):
            up.set(x, y, c)
        if x % 7 in (0, 1):                                      # 감긴 쇠사슬
            for y in (16, 17, 18, 19, 20): up.set(x, y, IRON[2] if y < 18 else IRON[1])
    for x in range(14, 50):
        for y in (22, 23): up.shade(x, y, -2 if y == 22 else -1)  # 굴대가 바닥에 드리운 그늘
    for (kind, x, y) in GATE_DRESS[var]:
        PROPS[kind](up, x, y)
    face = Canvas(W, 80)
    masonry(face, 1, W - 2, 6, 69, ("ghf",))
    corbel_band(face, 0, W - 1, 0, ("ghc",))
    quoin_edges(face, 0, W - 1, 6, 69)
    plinth(face, 0, W - 1, 70, ("ghp",))
    for y in range(6, 70): face.shade(W - 3, y, -1)
    # 홍예(아치 테): 쐐기돌 13개(방사 줄눈), 바깥 테 줄눈, 안쪽 모서리 왼쪽 빛·오른쪽 그늘, 맨 위 쐐기돌은 가장 밝다
    import math
    CX = 32.0
    for fy in range(ARCH_SPRING + 1):
        for x in range(W):
            dx, dy = x + 0.5 - CX, ARCH_SPRING + 0.5 - (fy + 0.5)
            rr = (dx * dx + dy * dy) ** 0.5
            if rr < ARCH_R or rr >= ARCH_R + RING: continue
            ang = math.degrees(math.atan2(dy, dx))          # 0 = 오른쪽, 90 = 위, 180 = 왼쪽
            seg = int((ang + 6.92) // 13.85)
            frac = ((ang + 6.92) % 13.85)
            vt = [COOL[9], COOL[8], WARM[6], COOL[9], COOL[7]][h("vs", seg) % 5]
            if seg == 6: vt = COOL[10]
            left = dx < 0
            c = vt
            if rr >= ARCH_R + RING - 1: c = MORT
            elif rr < ARCH_R + 1: c = COOL[11] if left else COOL[5]
            elif rr < ARCH_R + 2: c = step(vt, 1) if left else step(vt, -1)
            if (frac < 1.3 or frac > 12.55) and ARCH_R + 1 <= rr < ARCH_R + RING - 1: c = MORT
            face.set(x, fy, c)
    # 받침돌(홍예가 시작하는 내민 돌)
    for (a, b) in ((10, 15), (48, 53)):
        for x in range(a, b + 1):
            face.set(x, ARCH_SPRING - 1, MORT); face.set(x, ARCH_SPRING, COOL[10] if x < 32 else COOL[8])
            face.set(x, ARCH_SPRING + 1, COOL[8] if x < 32 else COOL[6]); face.set(x, ARCH_SPRING + 2, OUT2)
    # 문설주: 열림 바깥 3px 돌(왼쪽 빛·오른쪽 그늘), 켜마다 줄눈
    for fy in range(ARCH_SPRING + 3, 70):
        for i, x in enumerate((12, 13, 14, 15)):
            face.set(x, fy, [COOL[7], COOL[8], COOL[10], COOL[9]][i] if (fy - ARCH_SPRING) % 6 else MORT)
        for i, x in enumerate((48, 49, 50, 51)):
            face.set(x, fy, [COOL[5], COOL[7], COOL[6], COOL[5]][i] if (fy - ARCH_SPRING) % 6 else MORT)
    # 횃불
    torch(face, 6, 50); torch(face, 57, 50)
    if var == 0: banner(face, 2, 9); banner(face, 54, 9)
    else: shield(face, 6, 16); shield(face, 57, 16)
    # 열림: 위층에서 비우고 아래층(터널)에 그린다. 터널 안 = 궁륭 밑면(갈빗대) + 좌우 안벽 + 바닥 그늘
    for fy in range(80):
        ho = _arch_half(fy)
        if ho < 0: continue
        for x in range(W):
            d = abs(x + 0.5 - (ARCH_CX + 0.5))
            if d >= ho: continue
            face.set(x, fy, CLEAR)
            if closed: continue
            Y = 48 + fy
            dx, dyy = x + 0.5 - 32.0, ARCH_SPRING + 0.5 - (fy + 0.5)
            rr = (dx * dx + dyy * dyy) ** 0.5
            inner = ho - d
            left = dx < 0
            far = ((x + 0.5 - 32.0) ** 2 + (max(0, ARCH_SPRING + 2 - fy)) ** 2) ** 0.5
            if fy <= ARCH_SPRING and rr >= ARCH_R - 4:
                # 궁륭 밑면 띠(벽 두께가 보인다): 왼쪽은 빛, 오른쪽은 그늘, 방사 줄눈
                ang = math.degrees(math.atan2(dyy, dx)); frac = (ang + 6.92) % 13.85
                c = COOL[6] if left else COOL[4]
                if rr >= ARCH_R - 1: c = COOL[7] if left else COOL[5]
                if rr < ARCH_R - 3: c = OUT2
                if frac < 1.3 and rr >= ARCH_R - 3: c = MORT
            elif fy > ARCH_SPRING and inner < 3:
                # 문설주 안벽(터널 옆벽): 왼쪽 조금 밝은 돌, 오른쪽 그늘 돌, 줄눈 없이 — 안쪽 끝 1px 윤곽
                c = (COOL[5] if inner >= 1 else COOL[6]) if left else (COOL[3] if inner >= 1 else COOL[4])
                if inner >= 2: c = OUT2
                if fy >= ARCH_SPRING + 26: c = SH1 if inner >= 1 else c
            elif far < 11.5 and fy <= ARCH_SPRING + 8:
                # 터널 저쪽 출구: 밖의 밝은 땅이 비친다(아래 길이 반투명하게 보인다)
                c = SH2 if far < 10.5 else OUT2
            elif fy <= ARCH_SPRING + 8:
                c = OUT if fy < ARCH_SPRING - 2 else OUT2
            elif fy < ARCH_SPRING + 16: c = SH0
            elif fy < ARCH_SPRING + 24: c = SH1
            elif fy < ARCH_SPRING + 30: c = SH2
            elif fy < ARCH_SPRING + 34: c = SH3 if fy < ARCH_SPRING + 32 else CLEAR      # 성긴 체크 무늬는 띠로 읽혔다(r7) — 두 줄 고른 옅은 그늘로
            else: c = CLEAR
            lo.set(x, Y, c)
    if not closed:
        # 들어 올린 쇠창살: 아치 머리 밑에 가로대 둘과 끝이 뾰족한 세로살(3px 간격)
        for fy in range(ARCH_SPRING - ARCH_R + 1, ARCH_SPRING + 3):
            ho = _arch_half(fy)
            for x in range(W):
                d = abs(x + 0.5 - (ARCH_CX + 0.5))
                if d >= ho - 1: continue
                Y = 48 + fy
                k = (x - 17) % 4
                if fy in (ARCH_SPRING - 6, ARCH_SPRING - 1): lo.set(x, Y, IRON[2] if k != 3 else IRON[1])
                elif k == 1: lo.set(x, Y, IRON[2] if fy < ARCH_SPRING + 2 else IRON[1])
                elif k == 2 and fy < ARCH_SPRING + 1: lo.set(x, Y, IRON[1])
    else:
        # 닫힌 문: 아치 안 한 단 뒤로 물린 널 문짝 두 짝(돌 안벽 2px이 둘레에 보인다), 쇠띠·징·고리
        for fy in range(80):
            ho = _arch_half(fy)
            if ho < 0: continue
            for x in range(W):
                d = abs(x + 0.5 - (ARCH_CX + 0.5))
                if d >= ho: continue
                inner = ho - d
                dx, dyy = x + 0.5 - 32.0, ARCH_SPRING + 0.5 - (fy + 0.5)
                rr = (dx * dx + dyy * dyy) ** 0.5
                if (fy <= ARCH_SPRING and rr >= ARCH_R - 3) or inner < 3:
                    # 문은 아치 안으로 3px 물러나 있다: 둘레에 돌 안벽(왼쪽 빛·오른쪽 그늘)과 그 안쪽 그늘 윤곽
                    c = COOL[6] if dx < 0 else COOL[4]
                    if (fy <= ARCH_SPRING and rr < ARCH_R - 2) or (fy > ARCH_SPRING and inner >= 2): c = OUT2
                else:
                    k = (x - 16) % 4
                    c = WOOD[5] if k == 0 else (WOOD[4] if k in (1, 2) else WOOD[2])
                    if x in (31, 32): c = WOOD[0] if x == 32 else WOOD[2]
                    if fy in (ARCH_SPRING - 2, ARCH_SPRING + 18): c = IRON[2] if k == 1 else IRON[1]
                    if fy in (ARCH_SPRING - 1, ARCH_SPRING + 19): c = IRON[0]
                    if fy >= 78: c = WOOD[0]
                face.set(x, fy, c)
        for (x, y) in ((27, 58), (36, 58)):
            face.set(x, y, IRON[2]); face.set(x - 1, y + 1, IRON[1]); face.set(x + 1, y + 1, IRON[1]); face.set(x, y + 2, IRON[1])
        for x in range(19, 46, 4):
            for y in (ARCH_SPRING + 4, ARCH_SPRING + 28):
                if face.get(x, y) in WOOD: face.set(x, y, IRON[2])
    up.paste(face, 0, 48)
    return up, lo


# ================================================================ 땅 그림자(2층, 반투명)
def shadow(kind):
    """s = 앞면 밑(칸 위쪽 7행), e = 세로 성벽·망루 오른쪽(칸 왼쪽 7열), se = 둘 다."""
    cv = Canvas(16, 16)
    # 3판 r14: 12행 — 네 줄 높이 성벽이 7행 옅은 띠만 드리우니 어두운 풀 위에서 「포장길 연석」으로 읽혔다
    ramp = (SH0, SH0, SH0, SH1, SH1, SH1, SH1, SH2, SH2, SH3, SH3, SH3)
    if kind in ("s", "se"):
        for x in range(16):
            for i, c in enumerate(ramp):
                if i == len(ramp) - 1 and x % 2: continue
                cv.set(x, i, c)
    if kind in ("e", "se"):
        for y in range(16):
            for i, c in enumerate(ramp):
                if i == len(ramp) - 1 and y % 2: continue
                old = cv.get(i, y)
                if old[3] < c[3]: cv.set(i, y, c)
    return cv


def postern_block(side):
    """쪽문 문루(3판 r12): 세로 성벽 위에 솟은 네모 문루. 윗면 두 줄(t 뒤 흉벽 · b 앞 흉벽·살인구멍)은 길 위 두 줄(gy−2·gy−1)에,
    남쪽 앞면은 길 줄과 같은 줄에 선다 — 길이 문루 앞면 양옆의 터널 입(땅 그늘)으로 들어가 앞면 밑을 지난다.
    r11 판은 윗면이 길 줄에 걸쳐 「길이 지붕으로 들어간다」로 읽혔다(r12 major).
    반환 (윗면 32×32, 앞면 32×48 — 길 한 줄이면 f1, 두 줄 이상이면 fu · fm… · fl)."""
    top = Canvas(32, 32)
    # 문루 밑은 세로 성벽 통로 — 흉벽 톱니 사이로 풀이 비쳤다(r14 major): 성벽 윗면을 먼저 깔고 플랫폼을 얹는다
    for yy in (0, 16): top.paste(vert_wall(side, 0, 1), 0, yy)
    pf = platform(32, ("pg",), hatch=False)
    for (sy, dy) in ((0, 0), (32, 16)):
        for y in range(16):
            for x in range(32):
                c = pf.get(x, sy + y)
                if c[3] == 255: top.set(x, dy + y, c)
    # 살인구멍 쇠창살(길 바로 위 문루 바닥)
    for y in range(11, 21):
        for x in range(10, 22):
            if y in (11, 20) or x in (10, 21): c = IRON[1]
            elif (x - 10) % 3 == 0 or (y - 11) % 3 == 0: c = IRON[2] if (x + y) % 2 else IRON[1]
            else: c = OUT
            top.set(x, y, c)
    for x in range(11, 23): top.shade(x, 21, -2)
    for y in range(12, 21): top.shade(22, y, -2)

    def face(h_, seed, cap=True, foot=True, slit=None, torches=False):
        f = Canvas(32, h_)
        y0 = 2 if cap else 0
        masonry(f, 1, 30, y0, h_ - (3 if foot else 1), ("pgf", seed), tones=TOWER_TONES)
        quoin_edges(f, 0, 31, y0, h_ - (3 if foot else 1))
        if cap:
            for x in range(32):
                f.set(x, 0, COOL[10] if x % 7 else COOL[9]); f.set(x, 1, COOL[7])
            for x in range(1, 31): f.shade(x, 2, -1)
        if foot:
            for x in range(32): f.set(x, h_ - 2, MORT); f.set(x, h_ - 1, OUT2)
        if slit: arrow_slit(f, 15, slit[0], slit[1])
        if torches: torch(f, 5, h_ - 12); torch(f, 26, h_ - 12)
        for y in range(h_):
            for x in (28, 29, 30): f.shade(x, y, -1)
        return f
    def arch(f, y_spring, y_bot, half=8, cx=16, ring=2):
        """길이 밑으로 지나는 아치 구멍(r13·r14): 반원 머리 + 홍예석 테(ring px, 돌마다 빛·그늘 번갈아) + 이맛돌 +
        안은 위가 가장 짙고 아래로 갈수록 바닥 빛(밑의 길이 비친다) + 쇠살 이빨 — 납작한 검은 네모로 읽혔다(r14 major)."""
        R = half + ring
        for y in range(y_spring - R, y_bot + 1):
            dy = y_spring - y
            for x in range(cx - R, cx + R):
                dx = x - cx + 0.5
                rr = (dx * dx + dy * dy) ** 0.5 if dy > 0 else abs(dx)
                if rr >= R: continue
                if rr >= half:                                   # 홍예석 테
                    import math
                    seg = int((math.atan2(max(dy, 0) + 0.01, dx) / math.pi) * 7)
                    c = (COOL[10] if dx < 0 else COOL[8]) if seg % 2 == 0 else (COOL[9] if dx < 0 else COOL[6])
                    if rr >= R - 0.6: c = OUT2
                    f.set(x, y, c)
                    continue
                depth = y - (y_spring - half)
                if y >= y_bot - 2: c = CLEAR                     # 바닥: 밑의 길
                elif depth < 3: c = OUT
                elif y < y_bot - 3: c = OUT2                    # 터널 안은 바닥 바로 위까지 짙게(밝은 줄눈 색이면 1배에서 회색 네모, r15)
                else: c = MORT
                if abs(dx) > half - 1.6 and c not in (CLEAR,): c = OUT       # 문설주 안쪽 그늘
                f.set(x, y, c)
        # 쇠살 이빨(올려 둔 내림창살 끝)
        for x in range(cx - half + 2, cx + half - 1, 3):
            for i in range(3): f.set(x, y_spring - half + 3 + i, IRON[2] if i < 2 else IRON[1])
        for x in range(cx - 2, cx + 2): f.set(x, y_spring - R - 1, COOL[10] if x < cx else COOL[8])   # 이맛돌
    # r15: 앞면은 늘 두 줄 이상(32px) — 한 줄 앞면의 6px 아치는 「하수구 구멍」, 48px 판의 가운데 줄을 건너뛴 두 줄 길은 「납작한 검은 네모」였다.
    # 아치 모양은 하나(반폭 7·홍예 3, 머리는 아래에서 30px 위) — 두 줄 판·세 줄 판이 같은 아치를 쓴다
    f2 = face(32, 1, torches=True)
    arch(f2, 18, 31, half=7, ring=3)
    tall = face(48, 2, slit=(4, 7), torches=True)
    arch(tall, 34, 47, half=7, ring=3)
    return top, f2, tall


def mouth(kind):
    """터널 입 그늘(2층 반투명, 길 위): w = 성벽 왼쪽 칸(오른쪽 끝이 짙다) · e = 오른쪽 칸(왼쪽 끝이 짙다) · n = 성문루 뒤(안쪽) 칸(아래 끝이 짙다)."""
    cv = Canvas(16, 16)
    # 8단 감쇠(시트에 있는 반투명 그늘 값) — 6px 고른 띠는 이음매 줄로 읽혔다(r8)
    ramp = (SH0, SH1, SH2, (12, 14, 20, 90), (12, 14, 20, 70), (10, 8, 16, 55), (26, 22, 30, 40), (26, 22, 30, 30))
    for a in range(16):
        for i, c in enumerate(ramp):
            if kind == "w": cv.set(15 - i, a, c)
            elif kind == "e": cv.set(i, a, c)
            else: cv.set(a, 15 - i, c)
    return cv


# ================================================================ 기후 변형(3판 r8): 눈 덮인 성벽 · 사막 사암 성벽 — 같은 그림을 색 규칙으로 옮긴다(버들항 눈·사막 마을이 쓰는 색만)
SNOW = [hx(c) for c in ("#a6bcdc", "#b3bbc3", "#cadaee", "#e6f0fa", "#f6faff", "#ffffff")]
SAND_COOL = [hx(c) for c in ("#3a261c", "#4e3d30", "#7d6249", "#87806a", "#9b8a73", "#b7a471", "#c2b082", "#cbb87c", "#d3c088", "#eccb86", "#f6d498", "#fff0c0")]
SAND_WARM = [hx(c) for c in ("#4e3d30", "#7d6249", "#87806a", "#c2b082", "#cbb87c", "#dcaf6c", "#d3c088", "#eccb86", "#fff0c0")]   # 앞면 돌은 사암 한 결(주황·카키 조각보로 읽혔다, r9) — 따뜻한 돌 하나만 주황
SAND_FLAG = [hx(c) for c in ("#4e3d30", "#724a28", "#7e4a34", "#94562e", "#ac7044", "#cf9558", "#dcaf6c", "#e8b672", "#f6d498")]
DRY = [hx(c) for c in ("#7f725d", "#87806a", "#b7a471", "#c2b082")]
BIOMES = ("snow", "desert")


def _desert_map():
    m = {}
    for src, dst in ((FLAG, SAND_FLAG), (WARM, SAND_WARM), (COOL, SAND_COOL), (MOSS, DRY)):
        for a, b in zip(src, dst): m[a] = b
    return m


def shade_biome(im):
    """기후 판 위에 왼쪽 물체 그늘(SHADOW_PROFILE)을 그 색이 속한 램프 안에서 드리운다. 눈 램프는 두 단까지만(눈 그늘은 옅은 파랑)."""
    im = im.copy(); px = im.load()
    ramps = [SNOW, SAND_FLAG, SAND_COOL, SAND_WARM, COOL, WARM, FLAG]
    for y in range(im.height):
        for x in range(im.width):
            n = SHADOW_PROFILE(x, y)
            c = px[x, y]
            if not n or c[3] != 255: continue
            for r in ramps:
                if c in r:
                    if r is SNOW:       # 눈 그늘은 푸른 SNOW[0] 한 색(SNOW[1] 은 회색이라 그늘이 「회색 돌」로 읽혔다, r16)
                        px[x, y] = SNOW[0] if (n <= -2 or r.index(c) <= 2) else SNOW[2]
                    else:
                        px[x, y] = r[max(0, min(len(r) - 1, r.index(c) + n))]
                    break
            else:
                px[x, y] = step_any(c, n)
    return im


def is_top_piece(name):
    """윗면(위에서 본 면) 조각인가 — 눈이 쌓이는 판석·톱니 윗면."""
    base = name.split(":")[-1]
    if "_pg" in base: return "_pgw_" in base and not base.endswith("_f2u")   # 쪽문 문루: 윗면 pgw t·b · 앞면 pg·pgw f2u
    if base.startswith(("hs", "hn", "c_", "vw", "ve")): return True
    for pre in ("tower", "gate"):
        if base.startswith(pre) and not base.startswith("gatec"):
            cy = int(base.rsplit("_", 1)[1])
            return cy < 3
    return False


def biome_image(img, name, biome):
    """같은 조각을 기후 변형으로: desert = 사암 색 램프로 옮기고 이끼는 마른 풀, snow = 윗면 판석·톱니 윗면·앞면 내민 턱에 눈, 이끼는 눈 덩이."""
    im = img.copy(); px = im.load(); W, H = im.size
    base = name.split(":")[-1]
    if base.startswith("gate") and not base.startswith("gatec") and int(base.rsplit("_", 1)[1]) >= 4:
        # 눈·모래 길은 밝아 반투명 터널 그늘이 옅게 보였다(r8: 터널 바닥 밝기 76~123 vs 회색 판 42~65) — 한 단 짙게
        darker = {SH3: (12, 14, 20, 88), SH2: SH1, SH1: SH0}
        for y in range(H):
            for x in range(W):
                c = px[x, y]
                if 0 < c[3] < 255 and c in darker: px[x, y] = darker[c]
        # 판판한 눈·모래 길 위에도 터널 바닥 돌 결이 보이게: 엇갈린 돌 줄눈(6×5)을 그늘 한 단 짙게(r10 「터널 바닥 두 색」)
        deeper = {(12, 14, 20, 88): SH2, SH1: SH0, SH0: SH0, SH2: SH1}
        for y in range(H):
            for x in range(W):
                c = px[x, y]
                if not (0 < c[3] < 255 and c in deeper): continue
                row = y // 5
                if y % 5 == 4 or (x + (row % 2) * 3) % 6 == 5: px[x, y] = deeper[c]
    if biome == "desert":
        m = _desert_map()
        for y in range(H):
            for x in range(W):
                c = px[x, y]
                if c[3] == 255 and c in m: px[x, y] = m[c]
        return im
    top = is_top_piece(name)
    src = img.load()
    import re as _re
    name = _re.sub(r"^(tower\d?)[we]_", r"\1_", name.split(":")[-1])     # 모서리 망루 바깥 열은 같은 그림 — 같은 눈 결
    name = _re.sub(r"^v[we]_pgw?_", "v_pg_", name)     # 쪽문 문루는 서·동, 길 줄·성벽 줄이 같은 그림 — 같은 눈 결
    # 판석 결은 지운다(눈이 덮는다) — 흉벽 그늘이 만든 어두운 판석만 옅은 파랑 그늘로 남는다(r8: 「판석 격자 위 서리 + 먼지 점」)
    # 통로 눈은 밟혀 다져진 옅은 파랑(SNOW[2]) — 땅 눈(SNOW[3])과 같으면 성벽 윗면이 땅에 녹아 보였다(r9). 흉벽 그늘 쪽은 한 단 더 짙게
    snow_flag = {FLAG[8]: SNOW[2], FLAG[7]: SNOW[2], FLAG[6]: SNOW[2], FLAG[5]: SNOW[2], FLAG[4]: SNOW[1], FLAG[3]: SNOW[1], FLAG[2]: SNOW[2], FLAG[1]: SNOW[2], FLAG[0]: SNOW[0]}
    lintel = False
    for y in range(H):
        row = [src[x, y] for x in range(W)]
        ledge = sum(1 for c in row if c in (COOL[9], COOL[10], COOL[11])) >= 12
        for x in range(W):
            c = src[x, y]
            if c[3] != 255: continue
            if c in MOSS: px[x, y] = SNOW[2 + MOSS.index(c) % 2]; continue
            if top:
                if c == COOL[11]: px[x, y] = SNOW[5]
                elif c == COOL[9] and y > 0 and src[x, y - 1] in (COOL[10], COOL[11]): px[x, y] = SNOW[3]     # 톱니 머리에 두툼히 얹힌 눈
                elif c == COOL[10]: px[x, y] = SNOW[4]
                elif c in FLAG or c in WARM or (c in COOL[2:9] and sum(1 for (dx, dy) in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= x + dx < W and 0 <= y + dy < H and src[x + dx, y + dy] in FLAG) >= 2):
                    # 3판 r16: 통로 눈은 판석 격자와 무관한 결 — 다져진 눈(SNOW[2]) 위 4×4 덩이 바람 눈더미(밝게)·얕은 패임(짙게) + 드문 반짝임.
                    # 예전 판석 줄 그대로 옮긴 규칙은 줄눈 행마다 짙은 줄이 생겨 「가로 주사선 + 분홍 점」(r16 major)이었다.
                    # 흉벽 바로 밑 두 행만 그늘(위 칸이 흉벽 돌이면).
                    above = [src[x, y - k] for k in (1, 2) if y - k >= 0]
                    if any(a_[3] == 255 and a_ not in FLAG and a_ not in WARM and (a_ in COOL[:9] or a_ == EDGE) for a_ in above[:1]) or \
                       (len(above) > 1 and above[0] in FLAG and above[1][3] == 255 and above[1] not in FLAG and above[1] not in WARM and above[1] in COOL[:9]):
                        v = SNOW[0]
                    else:
                        r_ = h("drift", name, (x + 2 * ((y // 4) % 2)) // 4, y // 4) % 9
                        v = SNOW[3] if r_ < 3 else SNOW[2]
                        if v == SNOW[3] and h("drift", name, (x + 2 * (((y - 1) // 4) % 2)) // 4, (y - 1) // 4) % 9 >= 2 and y % 4 == 0: v = SNOW[4]   # 눈더미 윗가장자리 빛
                        if h("spark", name, x, y) % 71 == 0: v = SNOW[4]
                    px[x, y] = v
            elif ledge and c in (COOL[9], COOL[10], COOL[11]):
                px[x, y] = SNOW[5] if c != COOL[9] else SNOW[4]
                # 내민 턱 밑 고드름(턱 몸 세 줄 아래로 1~3점) — 칸 안에서만
                if h("drip", name, x) % 5 == 0:
                    for i in range(1 + h("dl", name, x) % 3):
                        yy = y + 3 + i
                        if yy < H and src[x, yy][3] == 255: px[x, yy] = SNOW[3 - min(i, 1)]
    return im


# ================================================================ 조각 목록
def cut(cv, cx, cy):
    return cv.crop(cx * T, cy * T, T, T)


FACE_VARS = 4


def pieces():
    """(name, img, pass_, star, layer, desc) — 시트 꼬리에 이 순서로 놓는다."""
    out = []

    def P(name, cv, passdirs, desc, star=False, layer="upper"):
        out.append(dict(name=name, img=cv.image() if isinstance(cv, Canvas) else cv, pass_=passdirs, star=star, layer=layer, desc=desc))

    # --- 남쪽 성벽 윗면 2줄(위 a = 통로 뒤쪽, 아래 b = 통로 앞쪽 + 앞 흉벽)
    for v in (0, 1):
        s = south_top(v)
        P(f"hs{v}_a", cut(s, 0, 0), "LRD", f"남쪽 성벽 윗면 위 줄(통로 판석, 변형 {v}). 동서로 걷는다")
        P(f"hs{v}_b", cut(s, 0, 1), "LRU", f"남쪽 성벽 윗면 아래 줄(통로 앞쪽 + 앞 흉벽 톱니, 변형 {v})")
    s = south_top(0, shade_left=True)
    P("hs_sh_a", cut(s, 0, 0), "LRD", "남쪽 성벽 윗면 위 줄 — 왼쪽에 선 망루·성문루 그늘")
    P("hs_sh_b", cut(s, 0, 1), "LRU", "남쪽 성벽 윗면 아래 줄 — 왼쪽 그늘")
    for v in (0, 1):
        n = north_top(v)
        P(f"hn{v}_a", cut(n, 0, 0), "LRD", f"북쪽 성벽 윗면 위 줄(뒤 흉벽 안쪽 면 + 통로, 변형 {v})")
        P(f"hn{v}_b", cut(n, 0, 1), "LRU", f"북쪽 성벽 윗면 아래 줄(통로 + 앞 턱, 변형 {v})")
    P("hn_stair", cut(north_top(0, stair=True), 0, 1), "LRUD", "북쪽 성벽 윗면 아래 줄 — 바로 아래 계단 머리(남쪽으로 내려간다)")
    # --- 볼록 모서리 2×2
    for k, pd in (("nw", ("RD", "RD", "RD", "RD")), ("ne", ("LD",) * 4), ("sw", ("RU",) * 4), ("se", ("LU",) * 4)):
        c = corner(k)
        for cy in range(2):
            for cx in range(2):
                pass_ = {"nw": "LRUD", "ne": "LRUD", "sw": "LRUD", "se": "LRUD"}[k]
                P(f"c_{k}_{cx}{cy}", cut(c, cx, cy), _corner_pass(k, cx, cy), f"성벽 둘레 {k.upper()} 모서리(2×2, 칸 {cx},{cy})")
    # --- 세로 성벽(2열 × 8px 주기 두 줄)
    for side in ("W", "E"):
        nm = "vw" if side == "W" else "ve"
        for r in (0, 1):
            v = vert_wall(side, 0, r)
            P(f"{nm}{r}_0", cut(v, 0, 0), "UDR", f"{'서' if side == 'W' else '동'}쪽 성벽 윗면 왼쪽 열(변형 {r})")
            P(f"{nm}{r}_1", cut(v, 1, 0), "UDL", f"{'서' if side == 'W' else '동'}쪽 성벽 윗면 오른쪽 열(변형 {r})")
        es, en = vert_end_south(side), vert_end_north(side)
        for cx in (0, 1):
            P(f"{nm}_endS_{cx}", cut(es, cx, 0), "UR" if cx == 0 else "UL", f"{'서' if side == 'W' else '동'}쪽 성벽 남쪽 끝(아래에 끝 앞면 세 줄), 열 {cx}")
            P(f"{nm}_endN_{cx}", cut(en, cx, 0), "DR" if cx == 0 else "DL", f"{'서' if side == 'W' else '동'}쪽 성벽 북쪽 끝(뒤 흉벽이 감싼다), 열 {cx}")
    # 앞면은 네 줄(u 위 · m 가운데 · n 아래 · l 굽도리). n 줄은 3판 r5 에서 덧붙였다 — 앞 조각 번호를 지키려고 맨 끝에 놓는다.
    ROWN = {"u": 0, "m": 1, "n": 2, "l": 3}
    ROWD = {"u": "위", "m": "가운데", "n": "아래", "l": "굽도리"}
    fcols = {v: face_column(v) for v in range(FACE_VARS)}
    ends = [("endL", face_column(0, left="end"), "왼쪽 끝(모서리 돌·윤곽)"), ("endR", face_column(1, right="end"), "오른쪽 끝"),
            ("shL", face_column(0, left="shadow"), "왼쪽 물체 그늘")]
    st = stairs()
    gu, gl = gatehouse(False)
    cu, _cl = gatehouse(True)
    tw = tower()
    TOP_PRE = ("", "1")        # 성문루 윗면 변형 이름 앞붙이(gate_ · gate1_)

    def face_pieces(rows):
        for v in range(FACE_VARS):
            for r in rows:
                P(f"f_{r}_{'abcd'[v]}", cut(fcols[v], 0, ROWN[r]), "", f"성벽 앞면 {ROWD[r]} 칸(변형 {'abcd'[v]})")
        for tag, f, d in ends:
            for r in rows:
                P(f"f_{r}_{tag}", cut(f, 0, ROWN[r]), "", f"성벽 앞면 {ROWD[r]} 칸 — {d}")

    def stair_pieces(rows):
        for r in rows:
            for cx in range(STAIR_W):
                P(f"stair_{cx}_{r}", cut(st, cx, ROWN[r]), "UDLR", f"북쪽 성벽 안쪽 옆 계단 3×4({ROWD[r]} 줄, 열 {cx}) — 왼쪽 아래 땅에서 오른쪽 위 통로로 오른다")

    def gate_pieces(cys, var=0):
        g_u, g_l = (gu, gl) if var == 0 else gatehouse(False, var)
        nm = "gate" + TOP_PRE[var]
        for cy in cys:
            for cx in range(4):
                passage = cx in (1, 2)
                if passage:
                    merged = cut(g_l, cx, cy); merged.paste(cut(g_u, cx, cy), 0, 0)
                if passage and cy >= 4:
                    P(f"{nm}_{cx}_{cy}", merged, "UD", "성문루 아치 안 터널(아래층, 걸음 — 바닥은 투명해 길이 보인다)", layer="lower")
                elif passage:
                    P(f"{nm}_{cx}_{cy}", merged, "UD", "성문루 " + ("윗면 플랫폼" if cy < 3 else "아치 머리") + " — 통로 위(★, 사람이 밑으로 지나간다)", star=True)
                else:
                    P(f"{nm}_{cx}_{cy}", cut(g_u, cx, cy), "", "성문루 " + ("윗면 플랫폼(막힘)" if cy < 3 else "앞면 기둥(막힘)"))

    def gatec_pieces(cys):
        for cy in cys:
            for cx in (1, 2):
                P(f"gatec_{cx}_{cy}", cut(cu, cx, cy), "", "닫힌 성문(아치 안 널 문짝 두 짝, 막힘)")

    def tower_pieces(cys, var=0):
        t = tw if var == 0 else tower(var)
        nm = "tower" + ("" if var == 0 else str(var))
        for cy in cys:
            for cx in range(3):
                # 3판 r8: 망루 3×9(윗면 yw−2..yw) — 성벽 통로 두 줄(yw·yw+1)은 망루 윗면 끝줄과 앞면 첫 줄 밑을 지난다
                if cy in (2, 3):
                    P(f"{nm}_{cx}_{cy}", cut(t, cx, cy), "LRUD" if cy == 3 else "LRD", "망루 — 성벽 통로가 망루 밑을 지나간다(★, 동서)", star=True)
                else:
                    P(f"{nm}_{cx}_{cy}", cut(t, cx, cy), "", "망루 " + ("윗면 플랫폼" if cy < 3 else "앞면(화살 구멍·모서리 돌)"))

    face_pieces(("u", "m", "l"))
    stair_pieces(("u", "m", "l"))
    # --- 성문루 4×8
    gate_pieces(range(7))
    gatec_pieces(range(3, 7))
    # --- 망루 3×8
    tower_pieces(range(7))
    # --- 땅 그림자(2층)
    for k, d in (("s", "앞면 밑 땅"), ("e", "세로 성벽·망루 오른쪽 땅"), ("se", "앞면 밑 + 오른쪽 모서리")):
        P(f"sh_{k}", shadow(k), "LRUD", f"성벽 그림자(2층 반투명, {d}). 걸음", layer="lower")
    # --- 통로 판석 변형 2·3(3판 r3 덧붙임 — 반복 무늬를 깬다. 앞 조각 번호는 그대로)
    for v in (2, 3):
        s = south_top(v)
        P(f"hs{v}_a", cut(s, 0, 0), "LRD", f"남쪽 성벽 윗면 위 줄(통로 판석, 변형 {v}). 동서로 걷는다")
        P(f"hs{v}_b", cut(s, 0, 1), "LRU", f"남쪽 성벽 윗면 아래 줄(통로 앞쪽 + 앞 흉벽 톱니, 변형 {v})")
        n = north_top(v)
        P(f"hn{v}_a", cut(n, 0, 0), "LRD", f"북쪽 성벽 윗면 위 줄(뒤 흉벽 안쪽 면 + 통로, 변형 {v})")
        P(f"hn{v}_b", cut(n, 0, 1), "LRU", f"북쪽 성벽 윗면 아래 줄(통로 + 앞 턱, 변형 {v})")
    for side in ("W", "E"):
        nm = "vw" if side == "W" else "ve"
        for r in (2, 3):
            v = vert_wall(side, 0, r)
            P(f"{nm}{r}_0", cut(v, 0, 0), "UDR", f"{'서' if side == 'W' else '동'}쪽 성벽 윗면 왼쪽 열(변형 {r})")
            P(f"{nm}{r}_1", cut(v, 1, 0), "UDL", f"{'서' if side == 'W' else '동'}쪽 성벽 윗면 오른쪽 열(변형 {r})")
    # --- 3판 r5: 앞면 네 줄째(n)·계단 네 줄째·성문루·망루 여덟 줄째(앞 조각 번호는 그대로)
    face_pieces(("n",))
    stair_pieces(("n",))
    gate_pieces((7,))
    gatec_pieces((7,))
    tower_pieces((7,))
    # --- 3판 r8: 망루 아홉 줄째 · 망루/성문루 윗면 소품 변형 · 쪽문 터널 · 터널 입 그늘(앞 조각 번호는 그대로)
    tower_pieces((8,))
    for v in (1, 2): tower_pieces(range(3), v)
    gate_pieces(range(3), 1)
    # 3판 r9: 앞면 변형 e~h(넓은 물때 · 금 · 담쟁이 · 삭은 켜) — 긴 앞면이 4칸 주기로 보였다. 성문루 윗면 변형 1 은 깃발 대신 방패(앞면 기둥 0·3열, 3·4행)
    for v in range(4, 8):
        fc = face_column(v)
        for r in ("u", "m", "n", "l"):
            P(f"f_{r}_{'abcdefgh'[v]}", cut(fc, 0, ROWN[r]), "", f"성벽 앞면 {ROWD[r]} 칸(변형 {'abcdefgh'[v]})")
    # 3판 r9: 모서리 망루 바깥 열 — 성벽 통로 두 줄(cy 2·3)의 바깥쪽 걸음을 막은 조각(그림은 같다). 안 막으면 성 밖 땅에서 망루 밑 통로로 들어왔다
    for cn, cx, drop in (("w", 0, "L"), ("e", 2, "R")):
        for v in range(3):
            t = tw if v == 0 else tower(v)
            P(f"tower{v or ''}{cn}_{cx}_2", cut(t, cx, 2), "LRD".replace(drop, ""), "모서리 망루 바깥 열 — 성벽 통로가 망루 밑을 지나간다(★, 바깥쪽 막힘)", star=True)
        P(f"tower{cn}_{cx}_3", cut(tw, cx, 3), "LRUD".replace(drop, ""), "모서리 망루 바깥 열 — 성벽 통로가 망루 밑을 지나간다(★, 바깥쪽 막힘)", star=True)
    g1u, _g1l = gatehouse(False, 1)
    for cy in (3, 4):
        for cx in (0, 3):
            P(f"gate1_{cx}_{cy}", cut(g1u, cx, cy), "", "성문루 앞면 기둥(막힘) — 방패를 건 변형")
    # 3판 r12: 쪽문 문루 — 윗면 t·b 는 길 위 성벽 줄(pgw, ★ 남북 걸음), 앞면은 길 줄(pg, ★ 사방): 한 줄 길 f1, 두 줄 이상 fu·fm…·fl
    PG_D = {"t": "윗면 뒤 흉벽", "b": "윗면 앞 흉벽·살인구멍", "f2u": "두 줄 앞면 위(아치 머리)", "f2l": "두 줄 앞면 아래(아치 문·횃불)",
            "fu": "세 줄 앞면 위(화살 구멍)", "fm": "세 줄 앞면 가운데(아치 머리)", "fl": "세 줄 앞면 아래(아치 문·횃불)"}
    for side in ("W", "E"):
        nm = "vw" if side == "W" else "ve"
        tp, f2, tall = postern_block(side)
        sd = "서" if side == "W" else "동"
        for cx in (0, 1):
            walk = "UDR" if cx == 0 else "UDL"
            for k, cy in (("t", 0), ("b", 1)):
                P(f"{nm}_pgw_{cx}_{k}", cut(tp, cx, cy), walk, f"{sd}쪽 성벽 쪽문 문루 {PG_D[k]}(열 {cx}) — 길 위 성벽 줄(★)", star=True)
            P(f"{nm}_pgw_{cx}_f2u", cut(f2, cx, 0), walk, f"{sd}쪽 성벽 쪽문 문루 {PG_D['f2u']}(열 {cx}) — 길 한 줄일 때 길 바로 위 성벽 줄(★)", star=True)
            for k, cv_, cy in (("f2u", f2, 0), ("f2l", f2, 1), ("fu", tall, 0), ("fm", tall, 1), ("fl", tall, 2)):
                P(f"{nm}_pg_{cx}_{k}", cut(cv_, cx, cy), "LRUD", f"{sd}쪽 성벽 쪽문 문루 {PG_D[k]}(열 {cx}) — 길이 밑으로 지난다(★)", star=True)
    # 3판 r11: 망루 앞면 변형 1·2(구멍 배치·돌 켜가 다르다) + 그 모서리 망루 바깥 열 첫 앞면 줄
    for v in (1, 2):
        t = tower(v)
        for cy in range(3, GT_ROWS):
            for cx in range(3):
                if cy == 3: P(f"tower{v}_{cx}_{cy}", cut(t, cx, cy), "LRUD", "망루 — 성벽 통로가 망루 밑을 지나간다(★, 동서)", star=True)
                else: P(f"tower{v}_{cx}_{cy}", cut(t, cx, cy), "", f"망루 앞면(변형 {v})")
        for cn, cx, drop in (("w", 0, "L"), ("e", 2, "R")):
            P(f"tower{v}{cn}_{cx}_3", cut(t, cx, 3), "LRUD".replace(drop, ""), "모서리 망루 바깥 열 — 성벽 통로가 망루 밑을 지나간다(★, 바깥쪽 막힘)", star=True)
    for k, d in (("w", "성벽 왼쪽 칸 — 오른쪽이 짙다"), ("e", "성벽 오른쪽 칸 — 왼쪽이 짙다"), ("n", "성문루 안쪽 칸 — 아래가 짙다")):
        P(f"mo_{k}", mouth(k), "LRUD", f"터널 입 그늘(2층 반투명, {d}). 걸음", layer="lower")
    # 3판 r10: 세로 성벽 윗면 변형 4~7(27줄에 다섯 줄만 되풀이됐다)
    for side in ("W", "E"):
        nm = "vw" if side == "W" else "ve"
        for r in range(4, 8):
            v = vert_wall(side, 0, r)
            P(f"{nm}{r}_0", cut(v, 0, 0), "UDR", f"{'서' if side == 'W' else '동'}쪽 성벽 윗면 왼쪽 열(변형 {r})")
            P(f"{nm}{r}_1", cut(v, 1, 0), "UDL", f"{'서' if side == 'W' else '동'}쪽 성벽 윗면 오른쪽 열(변형 {r})")
    # 3판 r13: 북쪽 성벽 통로에 진 왼쪽 망루·성문루 그늘
    n = north_top(0, shade_left=True)
    P("hn_sh_a", cut(n, 0, 0), "LRD", "북쪽 성벽 윗면 위 줄 — 왼쪽에 선 망루·성문루 그늘")
    P("hn_sh_b", cut(n, 0, 1), "LRU", "북쪽 성벽 윗면 아래 줄 — 왼쪽 그늘")
    # --- 3판 r8: 기후 변형 — 눈 덮인 성벽(snow:) · 사막 사암 성벽(desert:). 그림자·터널 입 그늘은 기후와 무관해 복사하지 않는다
    base = list(out)
    by_name = {p["name"]: p for p in base}
    for biome in BIOMES:
        tag = {"snow": "눈 덮인 ", "desert": "사막 사암 "}[biome]
        for p in base:
            if p["name"].startswith(("sh_", "mo_")) or "_endS_" in p["name"] or "_endN_" in p["name"]: continue   # 옛 틈 끝 마감은 쓰지 않는다
            m = re.fullmatch(r"(h[sn])_sh_([ab])", p["name"])
            if m:
                # 통로 그늘은 그늘 없는 판을 기후로 옮긴 뒤 그 기후 램프 안에서 어둡게 — 먼저 어둡게 하고 옮기면 눈이 한 색 회색 판이 됐다(r14 major)
                src = by_name[f"{m.group(1)}0_{m.group(2)}"]
                im = shade_biome(biome_image(src["img"], src["name"], biome))
            else:
                im = biome_image(p["img"], p["name"], biome)
            out.append(dict(p, name=f"{biome}:{p['name']}", img=im, desc=tag + p["desc"]))
    return out


def _corner_pass(k, cx, cy):
    """모서리 2×2 칸 통행: 바깥 두 칸 쪽은 막고, 이어지는 통로 방향만 연다."""
    d = set("LRUD")
    if k in ("nw", "ne") and cy == 0: d.discard("U")
    if k in ("sw", "se") and cy == 1: d.discard("D")
    if k in ("nw", "sw") and cx == 0: d.discard("L")
    if k in ("ne", "se") and cx == 1: d.discard("R")
    return "".join(c for c in "UDLR" if c in d)
