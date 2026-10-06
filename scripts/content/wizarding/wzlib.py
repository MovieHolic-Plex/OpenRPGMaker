"""wizarding_world 번들 공용 도구 — HP 테마 42색 팔레트·램프·손 도트 캔버스·조각(piece) 등록·검사·검수 시트.

조각 모듈(pieces/<모듈>.py)은 이 파일만 import 해서 그린다. 굽기(bake_wz.py)는 조각 모듈의 REG 를 모아
16px 칸으로 자르고 번호를 핀으로 고정해 공용 타일셋 wizarding_world 로 굽는다. 계약: CONTRACT.md

  K('stone', 2)      → 램프 색(번호가 넘치면 끝값으로 고정)
  c = Cv(w, h)       → 투명 RGBA 캔버스(px). P/R/HL/VL/line/ellipse/poly/box/grain/... 로 그린다
  REG.piece(...)     → 다칸 기물·바닥·벽·애니메이션 조각 등록(데코레이터)
  REG.autotile(...)  → 3×3 패치 + 안쪽 모서리 칸으로 47종 블롭 오토타일 등록
  REG.character(...) → 24×32 걷기 3프레임×4방향 캐릭터 등록
"""
import collections, hashlib, json, math, os, random, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
TD = os.path.join(ROOT, 'tiledata', 'wizarding')
T = 16

# ───────────────────────── 팔레트 (theme brief 42색 그대로) ─────────────────────────
PALETTE_HEX = ['#171923', '#292C38', '#444858', '#697184', '#99A7B7', '#D6E2E7', '#F2F2E8', '#343338', '#555154', '#77716B',
               '#A49A87', '#D0C3A6', '#30252A', '#51372F', '#78503A', '#A8774A', '#CCA36B', '#473A2C', '#75603B', '#AF8A4D',
               '#E4C980', '#1E3434', '#345344', '#57714D', '#91A66B', '#1D3045', '#315473', '#5E859B', '#A0C5CE', '#3C2439',
               '#73344B', '#AE5A69', '#513C67', '#8773A0', '#C9B2DA', '#815645', '#B48162', '#D7AC86', '#EDD0AA', '#E99D52',
               '#FFE0A0', '#82C8B3']


def hx(s):
    return (int(s[1:3], 16), int(s[3:5], 16), int(s[5:7], 16), 255)


PAL = [hx(s) for s in PALETTE_HEX]
PALSET = {p[:3] for p in PAL}

# 램프: 어두움 → 밝음. 0 이 그 재질의 가장 어두운 단(유색 윤곽). 이름은 재질.
RAMPS = {
    'ink':    ['#171923', '#292C38'],                                   # 윤곽·가장 깊은 그늘
    'night':  ['#171923', '#292C38', '#444858', '#697184'],             # 밤·그늘·쇠
    'iron':   ['#171923', '#292C38', '#444858', '#697184', '#99A7B7'],  # 무쇠·철제(가마솥·철문·쇠사슬)
    'snow':   ['#697184', '#99A7B7', '#D6E2E7', '#F2F2E8'],             # 눈·백색 린넨(그늘 → 흰)
    'linen':  ['#697184', '#A49A87', '#D0C3A6', '#D6E2E7', '#F2F2E8'],  # 린넨·양피지 밝은 천
    'stone':  ['#292C38', '#343338', '#555154', '#77716B', '#A49A87', '#D0C3A6'],   # 성채 석재
    'slate':  ['#171923', '#292C38', '#444858', '#697184', '#99A7B7'],  # 슬레이트 지붕(= iron 과 같은 색, 이름만 다름)
    'wood':   ['#171923', '#30252A', '#51372F', '#78503A', '#A8774A', '#CCA36B'],   # 오래된 오크
    'brass':  ['#30252A', '#473A2C', '#75603B', '#AF8A4D', '#E4C980', '#FFE0A0'],   # 황동·금
    'leaf':   ['#171923', '#1E3434', '#345344', '#57714D', '#91A66B'],  # 식생
    'water':  ['#171923', '#1D3045', '#315473', '#5E859B', '#A0C5CE', '#D6E2E7'],   # 호수·유리
    'red':    ['#171923', '#3C2439', '#73344B', '#AE5A69', '#E99D52'],  # 붉은 천·과자(그리핀도르)
    'violet': ['#171923', '#3C2439', '#513C67', '#8773A0', '#C9B2DA'],  # 보랏빛 약품
    'skin':   ['#30252A', '#815645', '#B48162', '#D7AC86', '#EDD0AA'],
    'hair_dark': ['#171923', '#30252A', '#51372F', '#78503A'],
    'hair_red':  ['#30252A', '#73344B', '#A8774A', '#E99D52'],
    'hair_blond':['#473A2C', '#75603B', '#AF8A4D', '#E4C980'],
    'hair_grey': ['#444858', '#77716B', '#A49A87', '#D6E2E7'],
    'fire':   ['#73344B', '#AE5A69', '#E99D52', '#FFE0A0', '#F2F2E8'],
    'glow':   ['#1E3434', '#345344', '#57714D', '#82C8B3', '#F2F2E8'],  # 마법약·마법 잔광
    'choc':   ['#171923', '#30252A', '#51372F', '#78503A', '#A8774A'],  # 초콜릿
    'dirt':   ['#30252A', '#473A2C', '#51372F', '#75603B', '#78503A', '#A8774A'],   # 흙·숲길
    'grass':  ['#1E3434', '#345344', '#57714D', '#91A66B'],
    'house_g': ['#171923', '#73344B', '#AE5A69', '#E4C980'],            # 그리핀도르 붉은+금
    'house_s': ['#171923', '#1E3434', '#345344', '#99A7B7'],            # 슬리데린 녹+은
    'house_r': ['#171923', '#1D3045', '#315473', '#A49A87'],            # 래번클로 청+청동
    'house_h': ['#171923', '#473A2C', '#AF8A4D', '#E4C980'],            # 후플푸프 황+흑
}
RAMPS = {k: [hx(c) for c in v] for k, v in RAMPS.items()}
for _k, _v in RAMPS.items():
    for _c in _v: assert _c[:3] in PALSET, (_k, _c)
CLEAR = (0, 0, 0, 0)
OL = RAMPS['ink'][0]          # 가장 깊은 윤곽 #171923
OL2 = RAMPS['ink'][1]         # 부드러운 윤곽 #292C38


def K(m, t):
    """램프 m 의 t 단(음수는 끝에서). 범위를 넘으면 끝값."""
    r = RAMPS[m]
    if t < 0: t = len(r) + t
    return r[max(0, min(len(r) - 1, t))]


def darker(c, n=1):
    """팔레트 색 c 를 같은 램프 안에서 n 단 어둡게(가장 먼저 c 를 담은 램프 기준)."""
    c = tuple(c)
    for r in RAMPS.values():
        if c in r:
            i = r.index(c); return r[max(0, i - n)]
    return OL


def lighter(c, n=1):
    c = tuple(c)
    for r in RAMPS.values():
        if c in r:
            i = r.index(c); return r[min(len(r) - 1, i + n)]
    return c


# ───────────────────────── 캔버스 ─────────────────────────
class Cv:
    """RGBA 손 도트 캔버스. 좌표는 px, 바깥은 조용히 버린다. a[y, x] = (r,g,b,a)."""

    def __init__(self, w, h):
        self.w, self.h = w, h
        self.a = np.zeros((h, w, 4), np.uint8)

    # 기본
    def P(self, x, y, c):
        x, y = int(x), int(y)
        if 0 <= x < self.w and 0 <= y < self.h: self.a[y, x] = c

    def get(self, x, y):
        if 0 <= x < self.w and 0 <= y < self.h: return tuple(int(v) for v in self.a[y, x])
        return CLEAR

    def opaque(self, x, y):
        return 0 <= x < self.w and 0 <= y < self.h and self.a[y, x, 3] > 0

    def R(self, x, y, w, h, c):
        x0, y0, x1, y1 = max(0, int(x)), max(0, int(y)), min(self.w, int(x + w)), min(self.h, int(y + h))
        if x1 > x0 and y1 > y0: self.a[y0:y1, x0:x1] = c

    def HL(self, x, y, w, c): self.R(x, y, w, 1, c)
    def VL(self, x, y, h, c): self.R(x, y, 1, h, c)

    def clear(self, x, y, w=1, h=1): self.R(x, y, w, h, CLEAR)

    def line(self, x0, y0, x1, y1, c):
        """브레젠험 1px 선(계단 모양 그대로, 안티앨리어싱 없음)."""
        x0, y0, x1, y1 = int(x0), int(y0), int(x1), int(y1)
        dx, dy = abs(x1 - x0), -abs(y1 - y0); sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1); e = dx + dy
        while True:
            self.P(x0, y0, c)
            if x0 == x1 and y0 == y1: break
            e2 = 2 * e
            if e2 >= dy: e += dy; x0 += sx
            if e2 <= dx: e += dx; y0 += sy

    def ellipse(self, cx, cy, rx, ry, c, fill=True):
        """채운 타원(중심 cx,cy 반지름 rx,ry; 0.5 단위 허용). fill=False 면 테두리만."""
        for y in range(int(cy - ry - 1), int(cy + ry + 2)):
            for x in range(int(cx - rx - 1), int(cx + rx + 2)):
                d = ((x + 0.5 - cx) / max(rx, 0.01)) ** 2 + ((y + 0.5 - cy) / max(ry, 0.01)) ** 2
                if d <= 1.0:
                    if fill: self.P(x, y, c)
                    else:
                        out = False
                        for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                            d2 = ((x + ox + 0.5 - cx) / max(rx, .01)) ** 2 + ((y + oy + 0.5 - cy) / max(ry, .01)) ** 2
                            if d2 > 1.0: out = True
                        if out: self.P(x, y, c)

    def poly(self, pts, c):
        """채운 다각형(짝-홀 규칙, 픽셀 중심 판정)."""
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        for y in range(int(min(ys)), int(max(ys)) + 1):
            for x in range(int(min(xs)), int(max(xs)) + 1):
                px, py, inside = x + 0.5, y + 0.5, False
                for i in range(len(pts)):
                    (ax, ay), (bx, by) = pts[i], pts[i - 1]
                    if (ay > py) != (by > py) and px < (bx - ax) * (py - ay) / (by - ay) + ax: inside = not inside
                if inside: self.P(x, y, c)

    def blit(self, other, x, y):
        """다른 캔버스·PIL 이미지를 (x,y)에 덮는다(알파 0 은 건너뜀)."""
        src = other.a if isinstance(other, Cv) else np.array(other.convert('RGBA'))
        h, w = src.shape[:2]
        for j in range(h):
            for i in range(w):
                if src[j, i, 3]: self.P(x + i, y + j, tuple(int(v) for v in src[j, i]))

    def tile(self, src, x, y, w, h):
        """src(16×16 등 작은 Cv·이미지)를 절대 좌표 기준으로 반복해 (x,y,w,h)를 채운다 — 이음새 없는 바닥 질감.
        같은 src 로 오토타일 패치·속 칸·안쪽 모서리 칸을 칠하면 서로 이어진다."""
        s = src.a if isinstance(src, Cv) else np.array(src.convert('RGBA'))
        sh, sw = s.shape[:2]
        for j in range(max(0, y), min(self.h, y + h)):
            for i in range(max(0, x), min(self.w, x + w)):
                v = s[j % sh, i % sw]
                if v[3]: self.a[j, i] = v

    def flip_h(self):
        c = Cv(self.w, self.h); c.a = self.a[:, ::-1].copy(); return c

    def img(self):
        a = self.a.copy(); a[a[:, :, 3] == 0] = 0; return Image.fromarray(a, 'RGBA')

    # 질감
    def grain(self, x, y, w, h, m, base, seed=0, light=0.08, dark=0.10, period=16, cluster=True):
        """재질 알갱이: base 단 바탕에 밝은·어두운 점(16 주기 해시라 이어 깔아도 이음새 없음). cluster 면 2px 덩이."""
        self.R(x, y, w, h, K(m, base))
        for j in range(h):
            for i in range(w):
                gx, gy = (x + i) % period, (y + j) % period
                v = ((gx * 73856093) ^ (gy * 19349663) ^ (seed * 83492791)) & 0xffff
                f = (v % 1000) / 1000
                if f < light: self.P(x + i, y + j, K(m, base + 1))
                elif f < light + dark: self.P(x + i, y + j, K(m, base - 1))
        if cluster:   # 외톨이 점을 이웃 쪽으로 한 칸 더 번지게 해 잡음 대신 덩이로 읽히게
            pass

    def stone_blocks(self, x, y, w, h, m='stone', base=3, row_h=(5, 6), seed=1, mortar=None, period=None):
        """비정형 큰 석재 블록 쌓기(줄마다 높이·길이 다름, 왼위 밝은 모서리·오른아래 어두운 모서리·드문 마모점).
        period 를 주면 x 방향 패턴이 그 폭으로 반복(타일 이음새 없음)."""
        rnd = random.Random(seed)
        mortar = mortar or K(m, base - 2)
        self.R(x, y, w, h, K(m, base))
        yy = 0
        while yy < h:
            rh = rnd.choice(row_h)
            xx = -rnd.randint(0, 8)
            while xx < w:
                bw = rnd.randint(7, 14)
                tone = base + rnd.choice((0, 0, 0, 1, -1))
                x0, x1 = max(0, xx), min(w, xx + bw)
                y1 = min(h, yy + rh)
                if x1 > x0:
                    self.R(x + x0, y + yy, x1 - x0, y1 - yy, K(m, tone))
                    self.HL(x + x0, y + yy, x1 - x0, K(m, tone + 1))           # 윗 모서리 빛
                    self.VL(x + x0, y + yy, y1 - yy, K(m, tone + 1))           # 왼 모서리 빛
                    self.HL(x + x0, y1 - 1, x1 - x0, mortar)                   # 줄눈
                    self.VL(x + x1 - 1, y + yy, y1 - yy, mortar)
                    if rnd.random() < 0.35:
                        self.P(x + x0 + rnd.randint(1, max(1, x1 - x0 - 2)), y + yy + rnd.randint(1, max(1, y1 - yy - 2)), K(m, tone - 1))
                xx += bw
            yy += rh

    def planks(self, x, y, w, h, m='wood', base=3, horizontal=True, width=4, seed=2):
        """판재: 판마다 톤 차, 판 사이 어두운 틈, 드문 옹이·이음."""
        rnd = random.Random(seed)
        self.R(x, y, w, h, K(m, base))
        if horizontal:
            for j in range(0, h, width):
                tone = base + rnd.choice((0, 0, 1, -1))
                self.R(x, y + j, w, min(width, h - j), K(m, tone))
                self.HL(x, y + j + min(width, h - j) - 1, w, K(m, base - 2))
                cut = rnd.randint(4, max(5, w - 4))
                self.VL(x + cut, y + j, min(width, h - j) - 1, K(m, base - 2))
                if rnd.random() < 0.4: self.P(x + rnd.randint(1, w - 2), y + j + 1, K(m, base - 1))
        else:
            for i in range(0, w, width):
                tone = base + rnd.choice((0, 0, 1, -1))
                self.R(x + i, y, min(width, w - i), h, K(m, tone))
                self.VL(x + i + min(width, w - i) - 1, y, h, K(m, base - 2))

    # 입체
    def box(self, x, y, w, h, top, m, base=3, outline=True, front_m=None):
        """3/4 상자: 위 top px 는 윗면(밝게), 그 아래는 남쪽 정면(어둡게). 왼쪽 빛·오른쪽 그늘. outline 은 재질 가장 어두운 단."""
        fm = front_m or m
        self.R(x, y, w, top, K(m, base + 1))
        self.HL(x, y, w, K(m, base + 2)); self.VL(x, y, top, K(m, base + 2))
        self.R(x, y + top, w, h - top, K(fm, base - 1))
        self.HL(x, y + top, w, K(fm, base))                 # 윗면 앞 모서리(빛 받는 모)
        self.VL(x + w - 1, y + top, h - top, K(fm, base - 2))
        if outline: self.outline_rect(x, y, w, h, K(m, 0))

    def outline_rect(self, x, y, w, h, c):
        self.HL(x, y, w, c); self.HL(x, y + h - 1, w, c); self.VL(x, y, h, c); self.VL(x + w - 1, y, h, c)

    def cylinder(self, cx, y, rx, h, top_ry, m, base=3):
        """3/4 원통(통·기둥·솥 몸통): 위 타원 윗면 + 아래로 h 정면, 왼쪽 밝고 오른쪽 어두움."""
        for yy in range(int(y + top_ry), int(y + top_ry + h)):
            for xx in range(int(cx - rx), int(cx + rx)):
                f = (xx + 0.5 - (cx - rx)) / (2 * rx)
                t = base + (1 if f < 0.3 else 0 if f < 0.65 else -1 if f < 0.88 else -2)
                self.P(xx, yy, K(m, t))
        self.ellipse(cx, y + top_ry + h, rx, top_ry, K(m, base - 2))   # 밑 곡선
        for yy in range(int(y + top_ry), int(y + top_ry + h)):
            for xx in range(int(cx - rx), int(cx + rx)):
                f = (xx + 0.5 - (cx - rx)) / (2 * rx)
                t = base + (1 if f < 0.3 else 0 if f < 0.65 else -1 if f < 0.88 else -2)
                self.P(xx, yy, K(m, t))
        self.ellipse(cx, y + top_ry, rx, top_ry, K(m, base + 1))
        self.ellipse(cx, y + top_ry, rx, top_ry, K(m, base + 2), fill=False)

    def outline(self, color=None, inset=False):
        """외곽선. inset=False: 투명 픽셀 중 불투명 이웃(4방)이 있는 곳을 그 이웃 색의 램프 최암단으로 칠한다(유색 윤곽).
        inset=True: 실루엣 가장자리 불투명 픽셀을 한 단 어둡게(덩어리 크기 유지). color 를 주면 그 색으로."""
        a = self.a; op = a[:, :, 3] > 0
        if inset:
            edge = []
            for y in range(self.h):
                for x in range(self.w):
                    if not op[y, x]: continue
                    for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        xx, yy = x + ox, y + oy
                        if not (0 <= xx < self.w and 0 <= yy < self.h) or not op[yy, xx]: edge.append((x, y)); break
            for x, y in edge: self.P(x, y, color or darker(self.get(x, y), 2))
            return
        add = []
        for y in range(self.h):
            for x in range(self.w):
                if op[y, x]: continue
                for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    xx, yy = x + ox, y + oy
                    if 0 <= xx < self.w and 0 <= yy < self.h and op[yy, xx]:
                        add.append((x, y, color or _ramp_floor(tuple(int(v) for v in a[yy, xx])))); break
        for x, y, c in add: self.P(x, y, c)

    def shadow(self, x, y, w, h=2, c=None):
        """접지 그림자(바닥 위 반투명 대신 어두운 팔레트 단) — 아래층 그림 위에 겹칠 때만 쓴다."""
        self.R(x, y, w, h, c or OL2)


def _ramp_floor(c):
    for name in ('wood', 'stone', 'brass', 'leaf', 'water', 'red', 'violet', 'skin', 'iron', 'linen', 'snow', 'dirt'):
        r = RAMPS[name]
        if c in r: return r[0] if r[0] != c else OL
    return OL


# ───────────────────────── 조각 등록 ─────────────────────────
# walk 문자열(행마다 w 글자):
#   S = 막힘(위층, 몸체·밑동)       C = ★ 통행·사람 위에 그림(윗부분·처마·잎)
#   F = 걷는 땅(아래층 불투명)      X = 막힌 땅(아래층 불투명: 물·구덩이)
#   f = 투명 바닥 덧그림(통행·캐릭터 밑)   . = 빈 칸(그림 없음)
WALK_PC = {'S': 'solid', 'C': 'star', 'F': 'floor', 'X': 'solidfloor', 'f': 'flat', '.': 'blank'}
FAMILIES = ('architecture', 'surfaces', 'furniture', 'nature', 'characters', 'creatures', 'vehicles', 'effects')
ROLES = ('building', 'castle', 'fence', 'roof', 'terrain', 'water', 'wall', 'prop')
SPACES = {
    'shared': '공용(성채·공통 가구)', 'owlery': '부엉이 탑', 'potions': '지하 마법약 교실', 'clocktower': '시계탑 기어실',
    'postoffice': '호그스미드 눈 덮인 우체국', 'wandshop': '다이애건 앨리 지팡이 가게', 'library': '도서관 제한 구역',
    'carriage': '금지된 숲 세스트랄 마차 승차장', 'greenhouse': '온실(맨드레이크)', 'infirmary': '병동',
    'quidditch': '퀴디치 선수 터널·경기장', 'boathouse': '검은 호수 보트 창고', 'honeydukes': '허니듀크 지하 창고',
}


class Registry:
    def __init__(self):
        self.pieces = collections.OrderedDict()
        self.autotiles = collections.OrderedDict()
        self.characters = collections.OrderedDict()
        self.examples = []

    def piece(self, id, name, w, h, walk, family, space, desc, rules='', tags=(), role='prop', frames=1, fps=6,
              repeat=False, states=None, anchor=None, access=None, parts=None, ox=0, oy=0):
        """데코레이터. fn(c) 또는 frames>1 이면 fn(c, f) 가 w*16×h*16 캔버스(c)에 그린다(전체 그림, 칸 경계와 무관).
        walk: 행마다 w 글자(S C F X f .). states: 같은 크기 다른 상태 조각 id 묶음 이름(문 닫힘/열림/잠김 등).
        frames>1: 애니메이션 — 칸마다 frames 개 연속 칸으로 굽혀 animationStrips 가 된다."""
        assert id.startswith('wz-'), ('조각 id 는 wz- 로 시작', id)
        assert family in FAMILIES, (id, family)
        assert space in SPACES, (id, space)
        assert role in ROLES, (id, role)
        assert len(walk) == h and all(len(r) == w for r in walk), ('walk 크기', id, w, h, walk)
        assert all(ch in WALK_PC for r in walk for ch in r), ('walk 글자', id, walk)
        assert id not in self.pieces, ('조각 id 중복', id)

        def deco(fn):
            self.pieces[id] = dict(id=id, name=name, w=w, h=h, walk=list(walk), family=family, space=space, desc=desc,
                                   rules=rules, tags=list(tags), role=role, frames=frames, fps=fps, repeat=repeat, states=states,
                                   anchor=anchor, access=access, parts=parts or [], fn=fn)
            return fn
        return deco

    def autotile(self, id, name, family, space, desc, rules='', layer='lower', pc='floor', role='terrain', tags=()):
        """데코레이터. fn() → (patch, icorner): patch = 48×48 Cv(3×3 칸: 가운데가 속, 가장자리가 경계, 바깥 지형까지 구워 넣음),
        icorner = 16×16 Cv(속으로 꽉 찼는데 네 모서리만 안쪽으로 파인 칸 — 대각 이웃만 비었을 때 쓰는 사분면).
        47종 블롭을 사분면(8×8) 합성으로 만든다. pc: floor(불투명 땅) | solidfloor(물 등 막힌 땅) | flat(투명 덧그림)."""
        assert id.startswith('wz-') and id not in self.autotiles

        def deco(fn):
            self.autotiles[id] = dict(id=id, name=name, family=family, space=space, desc=desc, rules=rules, layer=layer,
                                      pc=pc, role=role, tags=list(tags), fn=fn)
            return fn
        return deco

    def character(self, id, name, space, desc, tags=(), family='characters'):
        """데코레이터. fn(c, d, f): 24×32 캔버스 c 에 방향 d('up'|'right'|'down'|'left'), 걷기 프레임 f(0,1,2; 1=선 자세) 를 그린다.
        발 접지점은 프레임 아래 가운데(x 11~12, y 31). 3/4 시점(머리·어깨 윗면이 보이게)."""
        assert id.startswith('wz-') and id not in self.characters

        def deco(fn):
            self.characters[id] = dict(id=id, name=name, space=space, desc=desc, tags=list(tags), family=family, fn=fn)
            return fn
        return deco

    def example(self, id, name, space, w, h, floor, place, desc='', walls=None):
        """공간 예제 맵. floor: 바닥 조각 id(1×1 반복) 또는 오토타일 id. place: [(조각 id, x, y), ...] 앞에서 뒤 순서.
        굽기가 이것으로 참고문서의 전체 아래/위층 배열과 원본 해상도 그림을 만든다."""
        self.examples.append(dict(id=id, name=name, space=space, w=w, h=h, floor=floor, place=list(place), desc=desc))


REG = Registry()
DIRS = ('up', 'right', 'down', 'left')    # EasyRPG CharSet 행 순서(행 0 위 · 1 오른쪽 · 2 아래 · 3 왼쪽)


# ───────────────────────── 렌더·검사 ─────────────────────────
def render_piece(p, frame=0):
    c = Cv(p['w'] * T, p['h'] * T)
    if p['frames'] > 1: p['fn'](c, frame)
    else: p['fn'](c)
    return c


def render_character(ch):
    """72×128 걷기 시트(3열 프레임 × 4행 방향)."""
    sheet = Cv(72, 128)
    for r, d in enumerate(DIRS):
        for f in range(3):
            c = Cv(24, 32); ch['fn'](c, d, f); sheet.blit(c, f * 24, r * 32)
    return sheet


SUBQ = {(0, 0): 'nw', (1, 0): 'ne', (0, 1): 'sw', (1, 1): 'se'}


def canon(m):
    n, e, s, w = m & 1, m & 2, m & 4, m & 8
    out = m & 15
    if n and e and m & 16: out |= 16
    if s and e and m & 32: out |= 32
    if s and w and m & 64: out |= 64
    if n and w and m & 128: out |= 128
    return out


def blob_tile(patch, icorner, m):
    """사분면 합성. patch: 48×48 ndarray, icorner: 16×16 ndarray. m: canon 마스크(N1 E2 S4 W8 NE16 SE32 SW64 NW128)."""
    out = np.zeros((16, 16, 4), np.uint8)
    N, E, S, W = bool(m & 1), bool(m & 2), bool(m & 4), bool(m & 8)
    for (qx, qy) in ((0, 0), (1, 0), (0, 1), (1, 1)):
        vert = N if qy == 0 else S          # 이 사분면 쪽 세로 이웃
        hor = W if qx == 0 else E           # 가로 이웃
        diag = {(0, 0): m & 128, (1, 0): m & 16, (0, 1): m & 64, (1, 1): m & 32}[(qx, qy)]
        if vert and hor and diag: src, sx, sy = patch, 16 + qx * 8, 16 + qy * 8                      # 속
        elif vert and hor: src, sx, sy = icorner, qx * 8, qy * 8                                       # 안쪽 모서리
        elif hor:   # 가로로 이어짐, 세로 쪽은 경계 → 위/아래 변 칸
            src, sx, sy = patch, 16 + qx * 8, (0 if qy == 0 else 32) + qy * 8
        elif vert:  # 세로로 이어짐 → 왼/오른 변 칸
            src, sx, sy = patch, (0 if qx == 0 else 32) + qx * 8, 16 + qy * 8
        else:       # 바깥 모서리
            src, sx, sy = patch, (0 if qx == 0 else 32) + qx * 8, (0 if qy == 0 else 32) + qy * 8
        out[qy * 8:qy * 8 + 8, qx * 8:qx * 8 + 8] = src[sy:sy + 8, sx:sx + 8]
    return out


def autotile_cells(a):
    """오토타일 → (canon 47종 마스크 목록, {canon: 16×16 Image}, patch, icorner)."""
    patch, ic = a['fn']()
    pa, ia = patch.a, ic.a
    assert pa.shape[:2] == (48, 48) and ia.shape[:2] == (16, 16), a['id']
    masks = sorted({canon(m) for m in range(256)})
    assert len(masks) == 47
    return masks, {m: Image.fromarray(blob_tile(pa, ia, m), 'RGBA') for m in masks}, patch, ic


def check_img(img):
    """팔레트·알파 검사. 문제 목록."""
    a = np.asarray(img.convert('RGBA'))
    out = []
    al = a[:, :, 3]
    if ((al != 0) & (al != 255)).any(): out.append('반투명 화소 %d' % int(((al != 0) & (al != 255)).sum()))
    vis = a[al > 0][:, :3]
    bad = collections.Counter(tuple(int(v) for v in c) for c in vis if tuple(int(v) for v in c) not in PALSET)
    if bad: out.append('팔레트 밖 %d색: %s' % (len(bad), ', '.join('#%02x%02x%02x' % c for c, _ in bad.most_common(4))))
    return out


def check_piece(p):
    errs = []
    seen = set()
    for f in range(p['frames']):
        im = render_piece(p, f).img()
        for y in range(p['h']):
            for x in range(p['w']):
                if np.asarray(im)[y * T:(y + 1) * T, x * T:(x + 1) * T, 3].any(): seen.add((x, y))
    for f in range(p['frames']):
        im = render_piece(p, f).img()
        errs += ['f%d %s' % (f, e) for e in check_img(im)]
        for y in range(p['h']):
            for x in range(p['w']):
                cell = np.asarray(im)[y * T:(y + 1) * T, x * T:(x + 1) * T]
                ch = p['walk'][y][x]; empty = not cell[:, :, 3].any(); full = (cell[:, :, 3] == 255).all()
                if ch == '.' and not empty and p['frames'] == 1: errs.append(f'f{f} 칸({x},{y}) walk "." 인데 그림이 있다')
                if ch != '.' and empty and (p['frames'] == 1 or (x, y) not in seen): errs.append(f'f{f} 칸({x},{y}) walk "{ch}" 인데 비었다')
                if ch == '.' and p['frames'] > 1 and (x, y) in seen: errs.append(f'f{f} 칸({x},{y}) 다른 프레임에 그림이 있는데 walk "."')
                if ch in 'FX' and not full: errs.append(f'f{f} 칸({x},{y}) 땅(F/X)은 불투명이어야 한다 → f/S/C 로')
    return errs


def piece_hash(p):
    h = hashlib.sha256()
    for f in range(p['frames']): h.update(render_piece(p, f).img().tobytes())
    h.update(json.dumps([p['w'], p['h'], p['walk'], p['frames']]).encode())
    return h.hexdigest()


# ───────────────────────── 검수 시트 ─────────────────────────
def _scale_actor():
    """사람 축척 표본: 기존 승인 native 학생(24×32) 아래 방향 선 자세."""
    p = os.path.join(TD, 'native', 'wandshop', 'actors', 'trial-student', 'walk.png')
    if not os.path.exists(p): return None
    im = Image.open(p).convert('RGBA')
    return im.crop((24, 64, 48, 96))


def _native_ref():
    """같은 화풍 비교용 승인 native 조각(마법약 작업대·가마솥·지팡이 카운터)."""
    out = []
    for rel, box in (('potions/theme_potions_work_benches.png', (0, 0, 64, 32)), ('potions/theme_potions_iron_cauldrons.png', (0, 0, 64, 16)),
                     ('wandshop/wood_service_counter.png', None), ('wandshop/wandtrial_target.png', None)):
        p = os.path.join(TD, 'native', rel)
        if os.path.exists(p):
            im = Image.open(p).convert('RGBA'); out.append(im.crop(box) if box else im)
    return out


def review_sheet(module, out_path=None, zoom=4, bg=(52, 51, 56, 255)):
    """모듈 조각 전부를 원배율·zoom 배로, 사람 축척 표본·native 비교와 함께 한 장으로. 반환 경로."""
    from PIL import ImageDraw, ImageFont
    try: font = ImageFont.truetype('/usr/share/fonts/truetype/nanum/NanumSquareB.ttf', 12)
    except OSError: font = None
    actor = _scale_actor(); natives = _native_ref()
    cards = []
    for p in REG.pieces.values():
        frames = [render_piece(p, f).img() for f in range(p['frames'])]
        cards.append((p['id'], p['name'], frames, p))
    for a in REG.autotiles.values():
        masks, tiles, patch, ic = autotile_cells(a)
        demo = _autotile_demo(tiles)
        cards.append((a['id'], a['name'] + ' (오토타일 무작위 맵)', [demo], None))
    for ch in REG.characters.values():
        cards.append((ch['id'], ch['name'], [render_character(ch).img()], None))
    W, PAGE_H = 1400, 1300
    pages, x, y, rh = [[]], 8, 8, 0
    for card in cards:
        cid, name, frames, p = card
        fw = sum(f.width * zoom + 6 for f in frames) + (actor.width * zoom + 8 if actor and p else 0)
        fw = max(fw, 7 * min(60, len(cid) + len(name) + 1))
        fh = max(f.height for f in frames) * zoom + 22
        z = zoom
        if fw > W - 16:   # 너무 큰 조각은 배율을 낮춘다
            z = max(1, (W - 16) * zoom // fw); fw = fw * z // zoom; fh = (fh - 22) * z // zoom + 22
        if x + fw > W: x = 8; y += rh + 10; rh = 0
        if y + fh > PAGE_H and pages[-1]: pages.append([]); x, y, rh = 8, 8, 0
        pages[-1].append((card, (x, y), z)); x += fw + 14; rh = max(rh, fh)
    out_path = out_path or os.path.join(TD, 'review', f'{module}.png')
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    stem = out_path[:-4]
    import glob as _g
    for old in _g.glob(stem + '-p*.png'): os.remove(old)
    for pi, page in enumerate(pages):
        H = max(py + max(f.height for f in c[2]) * z + 30 for c, (px, py), z in page) if page else 40
        last = pi == len(pages) - 1
        nat_h = (max([n.height for n in natives] + [0]) * 3 + 30) if last else 0
        S = Image.new('RGBA', (W, H + nat_h), bg)
        d = ImageDraw.Draw(S)
        for (cid, name, frames, p), (px, py), z in page:
            d.text((px, py), f'{cid} {name}'[:60], fill=(230, 230, 230, 255), font=font)
            xx = px
            for f in frames:
                zi = f.resize((f.width * z, f.height * z), Image.NEAREST)
                S.alpha_composite(zi, (xx, py + 14))
                if p:
                    for gx in range(0, f.width + 1, T): d.line([(xx + gx * z, py + 14), (xx + gx * z, py + 14 + f.height * z)], fill=(255, 255, 255, 40))
                    for gy in range(0, f.height + 1, T): d.line([(xx, py + 14 + gy * z), (xx + f.width * z, py + 14 + gy * z)], fill=(255, 255, 255, 40))
                xx += f.width * z + 6
            if actor and p:
                S.alpha_composite(actor.resize((actor.width * z, actor.height * z), Image.NEAREST), (xx + 2, py + 14 + max(0, frames[0].height * z - actor.height * z)))
        if last:
            xx = 8
            d.text((8, H), '비교: 승인된 native 조각(같은 화풍이어야 한다)', fill=(230, 230, 230, 255), font=font)
            for n in natives:
                S.alpha_composite(n.resize((n.width * 3, n.height * 3), Image.NEAREST), (xx, H + 16)); xx += n.width * 3 + 10
        S.save(out_path if pi == 0 else f'{stem}-p{pi + 1}.png')
    return out_path + (f' (+{len(pages) - 1}쪽: {os.path.basename(stem)}-p2.png …)' if len(pages) > 1 else '')


def _autotile_demo(tiles, n=10, seed=7):
    rnd = random.Random(seed)
    g = [[0] * n for _ in range(n)]
    for _ in range(4):
        cx, cy, r = rnd.randint(1, n - 2), rnd.randint(1, n - 2), rnd.randint(1, 3)
        for y in range(n):
            for x in range(n):
                if (x - cx) ** 2 + (y - cy) ** 2 <= r * r: g[y][x] = 1
    im = Image.new('RGBA', (n * T, n * T), (0, 0, 0, 0))
    for y in range(n):
        for x in range(n):
            if not g[y][x]: continue
            m = 0
            for bit, (dx, dy) in ((1, (0, -1)), (2, (1, 0)), (4, (0, 1)), (8, (-1, 0)), (16, (1, -1)), (32, (1, 1)), (64, (-1, 1)), (128, (-1, -1))):
                xx, yy = x + dx, y + dy
                if not (0 <= xx < n and 0 <= yy < n) or g[yy][xx]: m |= bit
            im.alpha_composite(tiles[canon(m)], (x * T, y * T))
    return im


def run_module(module):
    """조각 모듈의 __main__ 에서 부른다: 검사 + 검수 시트 + 칸·프레임 PNG. 오류 수를 종료 코드로."""
    errs = []
    for p in REG.pieces.values():
        errs += [f"{p['id']}: {e}" for e in check_piece(p)]
    for a in REG.autotiles.values():
        masks, tiles, patch, ic = autotile_cells(a)
        for e in check_img(patch.img()) + check_img(ic.img()): errs.append(f"{a['id']}: {e}")
        if a['pc'] in ('floor', 'solidfloor'):
            for m, t in tiles.items():
                if not (np.asarray(t)[:, :, 3] == 255).all(): errs.append(f"{a['id']}: 마스크 {m} 칸에 투명 화소 — pc {a['pc']} 는 불투명이어야"); break
    for ch in REG.characters.values():
        sh = render_character(ch)
        errs += [f"{ch['id']}: {e}" for e in check_img(sh.img())]
        for r in range(4):
            for f in range(3):
                if not sh.a[r * 32:(r + 1) * 32, f * 24:(f + 1) * 24, 3].any(): errs.append(f"{ch['id']}: {DIRS[r]} f{f} 빈 프레임")
    out = review_sheet(module)
    print(f'{module}: 조각 {len(REG.pieces)} · 오토타일 {len(REG.autotiles)} · 캐릭터 {len(REG.characters)} · 예제 {len(REG.examples)} → {out}')
    for e in errs: print('  ✗', e)
    return len(errs)
