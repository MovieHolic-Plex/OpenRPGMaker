"""chapel/gatehouse 공용 손 도트 붓 — 마름돌·청석·원통·원뿔·뾰족창·문.

난수·잡음 없음: 돌 폭·밝기·기와 변형은 아래 손으로 적은 표(문자열·목록)를 순서대로 읽는다.
빛은 왼쪽 위. 램프 글자는 palette.json(massing) 글자만 쓴다.
"""
import math

# 마름돌(밝은 회색) 램프: 어두운 → 밝은
ST = ['U', 'W', 'Y', 'a', 'e', 'i', 'j', 'k', 'm', 'n', 'r', 's']
# 따뜻한 돌 섞기(같은 밝기 자리 대체): 손으로 고른 돌에만 쓴다
WARM = {'k': 'p', 'm': 'p', 'j': 'g', 'n': 'o', 'r': 'o', 'i': 'f'}
# 청석 램프: 어두운 → 밝은
SL = ['C', 'B', 'E', 'F', 'G', 'H']

# 손으로 적은 표 -------------------------------------------------------------
# 돌 폭(px, 회반죽 1 포함) — 길게 적어 반복이 눈에 안 띄게
WIDTHS = [11, 8, 13, 9, 7, 12, 10, 14, 8, 11, 9, 13, 7, 10, 12, 9, 15, 8, 10, 11,
          9, 12, 8, 14, 10, 7, 13, 11, 9, 10, 12, 8, 11, 14, 9, 7, 12, 10, 13, 9]
# 돌 밝기 (ST 인덱스) — 7·8 이 기본, 6 어두운 돌, 9·10 밝은 돌
TONES = ('78687978698779867897687869787986'
         '97868797687978698786798768797869'
         '87978697869787968798678976879786')
# 따뜻한 돌 표시(1 이면 WARM 대체)
WARMS = ('0001000000100000010000000010000'
         '0100000000001000000100000100000')
# 돌 안 얼룩 점 위치(돌 왼쪽에서 몇 px, 0 이면 없음)
SPECK = '3052041306205314025031406302514'


def _tone(i):
    return int(TONES[i % len(TONES)])


class Ashlar:
    """(u, v) 펼친 좌표 → 돌 화소 색. courses = 줄 높이 목록(회반죽 줄 포함)."""

    def __init__(self, courses, seed=0, widths=None, warm=True, dark=0):
        self.courses = courses
        self.seed = seed
        self.widths = widths or WIDTHS
        self.warm = warm
        self.dark = dark
        self._cache = {}

    def course_at(self, v):
        v = int(v)
        if v < 0:
            return None
        acc = 0
        i = 0
        while True:
            h = self.courses[i % len(self.courses)]
            if v < acc + h:
                return i, v - acc, h
            acc += h
            i += 1

    def stone_at(self, ci, u):
        """줄 ci 에서 펼친 u 위치의 돌: (돌번호, 돌 안 x, 돌 폭)."""
        key = ci
        if key not in self._cache:
            off = (ci * 7 + self.seed * 3) % len(self.widths)
            shift = [0, 5, 2, 8, 4, 1, 7, 3][(ci + self.seed) % 8]
            spans = []
            x = -shift
            k = off
            while x < 400:
                w = self.widths[k % len(self.widths)]
                spans.append((x, w, k + ci * 11))
                x += w
                k += 1
            self._cache[key] = spans
        for x, w, sid in self._cache[key]:
            if x <= u < x + w:
                return sid, u - x, w
        return 0, 0, 10

    def color(self, u, v, shade=0, mortar=None):
        c = self.course_at(v)
        if c is None:
            return None
        ci, lv, h = c
        sid, lu, w = self.stone_at(ci, int(u))
        t = _tone(sid) - self.dark + shade + 1
        if lv == h - 1 or lu == w - 1:
            # 회반죽: 돌보다 셋 어둡게
            return ST[max(0, min(len(ST) - 1, (mortar if mortar is not None else max(2, t - 5))))]
        if lv == 0:
            t += 1
        elif lv == h - 2:
            t -= 1
        if lu == 0 and lv < h - 2:
            t += 1
        elif lu == w - 2:
            t -= 1
        sp = int(SPECK[sid % len(SPECK)])
        if sp and lu == sp and lv == 1 + (sid % 2):
            t -= 2
        if sp and lu == sp + 2 and lv == h - 3 and w > 9:
            t -= 1
        t = max(0, min(len(ST) - 1, t))
        ch = ST[t]
        if self.warm and WARMS[sid % len(WARMS)] == '1' and ch in WARM:
            ch = WARM[ch]
        return ch


def sclamp(t):
    return ST[max(0, min(len(ST) - 1, t))]


def flat_wall(c, x0, y0, w, h, ash, shade=None, mask=None, vy0=None):
    vy0 = y0 if vy0 is None else vy0
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            if mask and not mask(x, y):
                continue
            s = shade(x, y) if shade else 0
            ch = ash.color(x - x0 + 300, y - vy0, s)
            if ch:
                c.put(x, y, ch)


def cyl_shade(dx, r):
    """원통 가로 위치 → 밝기 보정(왼쪽 위 빛)."""
    f = dx / r
    if f < -0.88:
        return -1
    if f < -0.55:
        return 1
    if f < -0.15:
        return 1 if f < -0.35 else 0
    if f < 0.25:
        return 0
    if f < 0.5:
        return -1
    if f < 0.75:
        return -2
    if f < 0.9:
        return -3
    return -4


def cyl_wall(c, cx, r, y0, y1, ash, sag, extra=None, mask=None):
    """원통 앞면: x 는 cx-r..cx+r, 줄눈이 가운데서 sag 만큼 처진다. 바닥(y1)도 같은 곡선."""
    for x in range(int(math.floor(cx - r)), int(math.ceil(cx + r)) + 1):
        dx = x + 0.5 - cx
        if abs(dx) > r:
            continue
        cosv = math.sqrt(max(0.0, 1 - (dx / r) ** 2))
        u = math.asin(max(-1, min(1, dx / r))) * r + 200
        dy = sag * cosv
        ybot = y1 - round(sag * (1 - cosv))
        for y in range(y0 + round(dy) - round(sag), ybot + 1):
            if mask and not mask(x, y):
                continue
            s = cyl_shade(dx, r) + (extra(x, y) if extra else 0)
            ch = ash.color(u, y - y0 - dy + sag, s)
            if ch:
                c.put(x, y, ch)


# 청석 ------------------------------------------------------------------------
# 기와 변형 표: 0 보통, 1 밝음, 2 어두움, 3 이 빠진(가운데 어두운 점)
SLATE_VAR = ('0102003010201000210301002001020'
             '1002010300120002010020103001020'
             '0201001020300102001200103020010')


# 청석 한 장(5×6): 왼쪽 틈(B) + 왼쪽 위 2px 반짝임(H) + 몸(G) + 아래 두 줄 겹침 그늘. 글자 = SL 인덱스
TW, TH = 5, 6
TILE = ['15544',
        '15444',
        '15444',
        '14444',
        '24242',
        '22221']
TILE_BRIGHT = ['15554',
               '15544',
               '15444',
               '15444',
               '24242',
               '22221']
TILE_DARK = ['14444',
             '14443',
             '14433',
             '13333',
             '23232',
             '22221']
TILE_CHIP = ['15544',
             '15444',
             '14214',
             '14444',
             '24242',
             '22221']
TILES = [TILE, TILE_BRIGHT, TILE_DARK, TILE_CHIP]


def slate_px(lu, lv, tw, th, var, shade=0):
    """shade: +1 밝은 쪽(F→G), 0, -1 그늘(H→G, G→F), -2 깊은 그늘(G→E, F→E, H→F)."""
    i = int(TILES[var][lv % TH][lu % TW])
    if shade > 0:
        i = {3: 4}.get(i, i)
    elif shade == -1:
        i = {5: 4, 4: 3}.get(i, i)
    elif shade <= -2:
        i = {5: 3, 4: 2, 3: 2, 2: 1}.get(i, i)
    return max(0, min(len(SL) - 1, i))


def slate_rect(c, x0, y0, w, h, tw=4, th=5, seed=0, shade=None, mask=None):
    tw, th = TW, TH
    for y in range(y0, y0 + h):
        row = (y - y0) // th
        lv = (y - y0) % th
        off = (2 if row % 2 else 0) + seed
        for x in range(x0, x0 + w):
            if mask and not mask(x, y):
                continue
            col = (x - x0 + off) // tw
            lu = (x - x0 + off) % tw
            var = int(SLATE_VAR[(row * 13 + col + seed * 5) % len(SLATE_VAR)])
            s = shade(x, y) if shade else 0
            c.put(x, y, SL[slate_px(lu, lv, tw, th, var, s)])


def cone_param(cx, apex_y, H, hw, ell, x, y):
    """화소 → 원뿔 앞면 (t, f). t: 꼭짓점 0 → 밑 1, f = sin(둘레각). 밖이면 None."""
    dx = x + 0.5 - cx
    yy = y + 0.5 - apex_y
    tmin = abs(dx) / hw
    if tmin > 1 or yy < tmin * H - 0.5:
        return None

    def fy(t):
        q = dx / (hw * t) if t > 0 else 0
        return t * (H + ell * math.sqrt(max(0.0, 1 - q * q)))
    if yy > fy(1.0):
        return None
    lo, hi = max(tmin, 1e-4), 1.0
    for _ in range(30):
        mid = (lo + hi) / 2
        if fy(mid) < yy:
            lo = mid
        else:
            hi = mid
    t = (lo + hi) / 2
    f = dx / (hw * t) if t > 0 else 0
    return t, max(-1.0, min(1.0, f))


# 손으로 적은 기와 표 -------------------------------------------------------
# 장 폭(px, 틈 포함) — 줄마다 다른 자리에서 읽는다
TWIDTHS = [5, 5, 4, 6, 5, 4, 5, 6, 5, 5, 4, 5, 6, 4, 5, 5, 6, 5, 4, 5, 5, 6, 4, 5]
# 장 종류: 0 반짝임 없음 · 1 세로 3 · 2 ㄱ자 · 3 아래 둘 · 4 오른쪽 둘 · 5 어두운 헌 장 · 6 밝은 새 장
TKINDS = ('1203140215120613025104123012'
          '4102315021403126012031420152'
          '2014312503241021306120413205')


def tile_px(lu, lv, w, kind):
    """기와 한 장(폭 w, 높이 TH=6) 안 화소 → SL 인덱스(그늘 전)."""
    if lv == 5:
        return 1 if lu in (0, w - 1) else 2
    if lv == 4:
        return 2 if lu % 2 == 0 else (3 if kind != 5 else 2)
    if lu == 0:
        return 1
    body = 3 if kind == 5 else 4
    if lu == w - 1:
        body -= 1
    hl = {1: [(1, 0), (1, 1), (1, 2)], 2: [(1, 0), (2, 0), (1, 1)], 3: [(1, 1), (1, 2)],
          4: [(2, 0), (2, 1)], 5: [(1, 0)], 6: [(1, 0), (2, 0), (1, 1), (2, 1), (1, 2)]}.get(kind, [])
    if (lu, lv) in hl and lu < w - 1:
        return 4 if kind == 5 else 5
    if kind == 6 and lu < w - 1:
        return 4
    return body


def shade_idx(i, shade):
    if shade > 0:
        return {3: 4, 2: 3 if shade > 1 else 2}.get(i, i)
    if shade == -1:
        return {5: 4, 4: 3}.get(i, i)
    if shade <= -2:
        return {5: 3, 4: 2, 3: 2, 2: 1}.get(i, i)
    return i


class Shingles:
    """줄마다 다른 장 폭·종류로 까는 청석. row 기준 y0, 줄 높이 6."""

    def __init__(self, seed=0):
        self.seed = seed
        self._rows = {}

    def spans(self, row):
        if row not in self._rows:
            k = (row * 5 + self.seed * 7) % len(TWIDTHS)
            x = -[0, 3, 1, 4, 2][(row + self.seed) % 5]
            out = []
            n = 0
            while x < 420:
                w = TWIDTHS[(k + n) % len(TWIDTHS)]
                kind = int(TKINDS[(row * 11 + n * 3 + self.seed) % len(TKINDS)])
                out.append((x, w, kind))
                x += w
                n += 1
            self._rows[row] = out
        return self._rows[row]

    def idx(self, u, v):
        row, lv = int(v) // 6, int(v) % 6
        for x, w, kind in self.spans(row):
            if x <= u < x + w:
                return tile_px(int(u) - x, lv, w, kind)
        return 4


def shingle_fill(c, x0, y0, x1, y1, sh, shade=None, mask=None, ox=0, oy=0):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if mask and not mask(x, y):
                continue
            i = sh.idx(x - x0 + ox + 40, y - y0 + oy)
            s = shade(x, y) if shade else 0
            c.put(x, y, SL[max(0, min(5, shade_idx(i, s)))])


def cone(c, cx, apex_y, base_y, hw, ell, seed=0, rowh=6, tiles=None, tw=5, dens=0):
    """원뿔 지붕(위·앞에서): 꼭짓점 (cx, apex_y), 밑 타원 중심 base_y, 반폭 hw, 타원 반높이 ell.
    기와 줄은 밑 타원과 평행하게 휘고, 장 열은 꼭짓점으로 모인다(줄마다 장 수가 는다). 왼쪽 밝고 오른쪽 어둡다."""
    H = base_y - apex_y
    for y in range(apex_y, base_y + ell + 2):
        for x in range(int(cx - hw) - 1, int(cx + hw) + 2):
            p = cone_param(cx, apex_y, H, hw, ell, x, y)
            if not p:
                continue
            t, f = p
            v = y + 0.5 - apex_y - ell * t * math.sqrt(max(0.0, 1 - f * f))
            row = int(v // rowh)
            lv = int(v % rowh)
            trow = min(1.0, (row + 0.5) * rowh / H)
            n = max(1, int(round(2 * hw * trow / tw)))
            colf = (f + 1) / 2 * n + (0.5 if row % 2 else 0)
            col = int(colf)
            w = tw
            lu = min(w - 1, int((colf - col) * w))
            kind = int(TKINDS[(row * 7 + col * 3 + seed * 5) % len(TKINDS)])
            if kind == 6 and f > 0.2:
                kind = 1
            if kind in (0, 5) and f < 0.3 and (row + col) % 3:
                kind = 1 if kind == 0 else 3      # 원뿔은 빛 받는 쪽 장마다 반짝임(버들항 성 원뿔 결)
            i = tile_px(lu, lv, w, kind)
            if f < -0.55:
                s = 1
            elif f < 0.2:
                s = 0
            elif f < 0.6:
                s = -1
            else:
                s = -2
            c.put(x, y, SL[shade_idx(i, s)])


def outline_edges(c, x0, y0, x1, y1, left='E', right='C', top='C', bottom='C', only=None):
    """불투명 영역의 바깥 테두리 화소를 재질 어두운 단으로 다시 칠한다."""
    g = c.g
    pts = []
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if g[y][x] == '.':
                continue
            if only and g[y][x] not in only:
                continue
            nb = {}
            for nm, (ax, ay) in {'l': (-1, 0), 'r': (1, 0), 't': (0, -1), 'b': (0, 1)}.items():
                xx, yy = x + ax, y + ay
                nb[nm] = not (0 <= xx < c.w and 0 <= yy < c.h) or g[yy][xx] == '.'
            if nb['r']:
                pts.append((x, y, right))
            elif nb['l']:
                pts.append((x, y, left))
            elif nb['t']:
                pts.append((x, y, top))
            elif nb['b']:
                pts.append((x, y, bottom))
    for x, y, ch in pts:
        if ch:
            c.put(x, y, ch)
