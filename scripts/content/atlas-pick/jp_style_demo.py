#!/usr/bin/env python3
"""일본 세트 「새 결(v2)」 데모 견본 — 32×24칸(512×384px) 거리 한 장을 손으로 찍어 .pxg 로 낸다.

  python3 scripts/content/atlas-pick/jp_style_demo.py            # 그림 → style-demo-jp2/street/dm2-D.pxg (+ palette.pal)
  python3 scripts/content/atlas-pick/jp_style_demo.py --png      # 위에 더해 .pxg 를 pxgrid 로 구워 PNG 도 남김

근거 = tiledata/atlas-pick/jp-style-v2.md, 색 = palette/jp2.pal(make_jp2_palette.py).
규칙(WORKER-JP-KIT.md 와 같다): 보간·난수·그라데이션 함수 없음 — 색 단은 사각형·선·손 도트 모양으로 직접 놓는다.
빛은 왼쪽 위, 윤곽은 재료의 어두운 보라 단(검정 아님), 글씨는 손으로 찍은 7px 도트 글자(가짜 글자 없음),
실제 상표·로고 없음. 한 장이 바닥까지 전부 불투명하므로 반투명(~ - %)은 쓰지 않는다(그림자는 어두운 단으로 굽는다).

칸 배치(y, px): 0~96 가게 줄(윗층 4개 층 + 1층 가게) · 96~128 보도(가드레일·가로수·자판기) · 128~192 차도(횡단보도·맨홀) ·
192~208 아래 보도(신호등) · 208~320 낮은 건물 지붕(물탱크·실외기·계단실) · 320~336 골목 · 336~384 철도(전신주).
각 그리기 함수는 (x, y) 기준점만 받는 독립 조각이라, 나중에 kit 시트(kit_shopfront·kit_bldg·kit_signal·kit_pole·kit_crossing)의
부품 칸으로 그대로 잘라 옮길 수 있다.
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from common import *          # noqa
from pxg_emit import emit

W, H = 512, 384
cv = [[None] * W for _ in range(H)]
OUT_DIR = os.path.join(BASE, 'style-demo-jp2', 'street')

# ─────────────────────────── 기본 도구 ───────────────────────────
def P(x, y, c):
    if c is not None and 0 <= x < W and 0 <= y < H: cv[y][x] = c
def R(x, y, w, h, c):
    for yy in range(y, y + h):
        for xx in range(x, x + w): P(xx, yy, c)
def HL(x, y, w, c): R(x, y, w, 1, c)
def VL(x, y, h, c): R(x, y, 1, h, c)
def FR(x, y, w, h, c): HL(x, y, w, c); HL(x, y + h - 1, w, c); VL(x, y, h, c); VL(x + w - 1, y, h, c)
def SP(x, y, rows, leg):
    """손 도트 모양: 글자 하나 = 화소 하나, '.' 은 그대로 둔다."""
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch != '.': P(x + i, y + j, leg[ch])
def disc(cx, cy, r, c):
    for yy in range(cy - r, cy + r + 1):
        for xx in range(cx - r, cx + r + 1):
            if (xx - cx) ** 2 + (yy - cy) ** 2 <= r * r + r // 2: P(xx, yy, c)
def bevel(x, y, w, h, ramp, t, out=None):
    """빛 왼쪽 위: 위·왼 한 줄 밝게(+1), 아래·오른 한 줄 어둡게(-1). out 이 있으면 바깥 윤곽."""
    R(x, y, w, h, (ramp, t)); HL(x, y, w, (ramp, t + 1)); VL(x, y, h, (ramp, t + 1))
    HL(x, y + h - 1, w, (ramp, t - 1)); VL(x + w - 1, y, h, (ramp, t - 1))
    if out: FR(x - 1, y - 1, w + 2, h + 2, out)
def wire(x0, y0, x1, y1, sag, c):
    n = max(abs(x1 - x0), 1)
    for i in range(n + 1):
        t = i / n; P(x0 + i * (1 if x1 >= x0 else -1), round(y0 + (y1 - y0) * t + sag * 4 * t * (1 - t)), c)

def K(r, t): return (r, t)
SUMI0, SUMI1 = K('sumi', 0), K('sumi', 1)

# ─────────────────────────── 손 도트 글자(7px 높이) ───────────────────────────
G = {   # 6×7 가타카나·한자, 5×7 로마자·숫자. 내가 획 하나씩 찍음.
 'ラ': ['.####.', '......', '######', '....#.', '...#..', '..#...', '.#....'],
 'ー': ['......', '......', '......', '######', '......', '......', '......'],
 'メ': ['.....#', '....#.', '#...#.', '.#.#..', '..#...', '.#.#..', '#...#.'],
 'ン': ['#.....', '.#...#', '.....#', '....#.', '...#..', '.##...', '#.....'],
 'コ': ['######', '.....#', '.....#', '.....#', '.....#', '######', '......'],
 'ヒ': ['.#....', '.#####', '.#....', '.#....', '.#....', '.#...#', '..####'],
 'ホ': ['..#...', '######', '..#...', '.##.#.', '#.#..#', '..#...', '..#...'],
 'テ': ['.####.', '......', '######', '..#...', '..#...', '..#...', '.##...'],
 'ル': ['.#...#', '.#.#.#', '.#.#.#', '.#.#.#', '.#.#.#', '##.#.#', '#..#.#'],
 'サ': ['.#..#.', '######', '.#..#.', '.#..#.', '....#.', '...#..', '..#...'],
 'ケ': ['..#...', '.#....', '######', '....#.', '...#..', '..#...', '.#....'],
 '酒': ['#..####', '.#.#..#', '#..#..#', '.#.####', '#..#..#', '.#.#..#', '#..####'],
 'A': ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
 'B': ['####.', '#...#', '####.', '#...#', '#...#', '#...#', '####.'],
 'C': ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
 'E': ['#####', '#....', '####.', '#....', '#....', '#....', '#####'],
 'F': ['#####', '#....', '####.', '#....', '#....', '#....', '#....'],
 'H': ['#...#', '#...#', '#####', '#...#', '#...#', '#...#', '#...#'],
 'M': ['#...#', '##.##', '#.#.#', '#...#', '#...#', '#...#', '#...#'],
 'N': ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
 'O': ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
 'P': ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
 'R': ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
 'T': ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
 '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
 '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
}
VBAR = ['..#...'] * 7            # 세로쓰기에서 「ー」는 세로 막대

def glyph(x, y, ch, c, bold=False, vertical=False):
    g = VBAR if (vertical and ch == 'ー') else G[ch]
    for j, row in enumerate(g):
        for i, b in enumerate(row):
            if b == '#':
                P(x + i, y + j, c)
                if bold: P(x + i + 1, y + j, c)
def text_w(s, pitch=8): return pitch * len(s) - 1
def text(x, y, s, c, pitch=8, bold=False):
    for k, ch in enumerate(s): glyph(x + k * pitch, y, ch, c, bold)
def vtext(x, y, s, c, pitch=9, bold=True):
    for k, ch in enumerate(s): glyph(x, y + k * pitch, ch, c, bold, vertical=True)

# ─────────────────────────── 창·실외기 ───────────────────────────
def win(x, y, w=18, h=8, kind='lit', var=0):
    """창 하나(유리 w×h + 테두리·문턱). kind: lit(연노랑 불빛) | glass(청록 유리) | dark(꺼진 창)."""
    FR(x - 1, y - 1, w + 2, h + 2, K('usu', 1))
    ramp = {'lit': 'mado', 'glass': 'garasu', 'dark': 'kon'}[kind]
    base = {'lit': 3, 'glass': 2, 'dark': 1}[kind]
    R(x, y, w, h, K(ramp, base))
    HL(x, y, w, K(ramp, base + 1)); VL(x, y, h, K(ramp, base + 1))                       # 빛: 위·왼 밝게
    if kind == 'glass':
        for i in range(min(h, 5)): P(x + 2 + i * 2, y + 1 + i, K('garasu', 5)); P(x + 3 + i * 2, y + 1 + i, K('garasu', 5))   # 비스듬한 반사
        HL(x, y + h - 2, w, K('garasu', 1)); HL(x, y + h - 1, w, K('garasu', 1))
    if kind == 'lit':
        if var % 3 == 0: R(x + 2, y + h - 3, 4, 3, K('mado', 1))                               # 창가 화분·사람 그림자
        if var % 3 == 1: R(x + w - 6, y + 2, 4, h - 2, K('mado', 2))                           # 반쯤 친 커튼
        HL(x, y + h - 1, w, K('mado', 2))
    if w >= 12: VL(x + w // 2, y, h, K('usu', 1))                                              # 가운데 문설주
    HL(x - 1, y + h + 1, w + 2, K('usu', 6)); HL(x - 1, y + h + 2, w + 2, K('usu', 2))          # 문턱 + 그늘

def acunit(x, y):
    """벽걸이 실외기 8×5."""
    R(x, y, 8, 5, K('tekko', 5)); HL(x, y, 8, K('tekko', 5)); HL(x, y + 4, 8, K('tekko', 2)); VL(x + 7, y, 5, K('tekko', 3))
    disc(x + 3, y + 2, 1, K('tekko', 1)); P(x + 3, y + 2, K('tekko', 3)); FR(x - 1, y - 1, 10, 7, K('usu', 1))

def ledge(x, y, w):
    HL(x, y + 14, w, K('usu', 5)); HL(x, y + 15, w, K('usu', 2))

# ─────────────────────────── 세로 간판 ───────────────────────────
def vsign(x, y, s, bg, fg, latin=False):
    n = len(s); h = 9 * n + 3; w = 13 if not latin else 11
    R(x, y, w, h, K(bg, 3)); HL(x, y, w, K(bg, 4)); VL(x, y, h, K(bg, 4)); HL(x, y + h - 1, w, K(bg, 2)); VL(x + w - 1, y, h, K(bg, 2))
    FR(x - 1, y - 1, w + 2, h + 2, SUMI1)
    R(x + w + 1, y + 1, 2, h, K('usu', 2)); HL(x + 1, y + h + 1, w + 1, K('usu', 2))                # 벽에 드리운 그림자
    R(x + w // 2 - 1, y - 3, 3, 2, K('tekko', 3))                                               # 벽 고정 쇠
    if latin:
        for k, ch in enumerate(s): glyph(x + 3, y + 2 + k * 9, ch, K(fg, 5), bold=False)
    else: vtext(x + 3, y + 2, s, K(fg, 5))

# ─────────────────────────── 가게 줄 ───────────────────────────
def upper_A(x):   # 잡거빌딩(윗층 4개 층, 연보라 벽 + 청록·연노랑 창)
    R(x, 0, 128, 64, K('usu', 4)); VL(x, 0, 64, K('usu', 5)); R(x + 120, 0, 8, 64, K('usu', 3))
    for k in range(4):
        ledge(x, 16 * k, 128)
        for i, wx in enumerate((6, 32, 58)):
            win(x + wx, 16 * k + 3, 18, 8, 'glass' if (k + i) % 3 == 0 else ('lit' if (k * 3 + i) % 4 != 1 else 'dark'), k + i)
    acunit(x + 113, 16 * 1 + 4); acunit(x + 113, 16 * 3 + 4)
    vsign(x + 100, 6, 'ラーメン', 'aka', 'shiro'); vsign(x + 84, 20, 'BAR', 'sora', 'shiro', latin=True)

def shop_A(x):    # 1층: 라멘집(붉은 간판판·노렌·초롱) + 건물 입구(유리문·입주 안내판)
    y = 64; R(x, y, 128, 32, K('usu', 3)); HL(x, y, 128, K('usu', 5)); HL(x, y + 1, 128, K('usu', 2))
    # 간판판
    bevel(x + 6, y + 1, 64, 11, 'aka', 2, out=K('aka', 0)); text(x + 22, y + 3, 'ラーメン', K('kii', 4), bold=True)
    HL(x + 7, y + 11, 62, K('aka', 1))
    # 가게 입구 틀 + 따뜻한 안
    R(x + 8, y + 13, 56, 19, K('moku', 2)); R(x + 10, y + 15, 52, 17, K('mado', 2)); HL(x + 10, y + 15, 52, K('mado', 3))
    R(x + 10, y + 27, 52, 2, K('moku', 3)); HL(x + 10, y + 27, 52, K('moku', 4))                    # 카운터
    for i in range(6): R(x + 13 + i * 8, y + 29, 4, 3, K('moku', 1))                                # 의자 다리 그림자
    for i in range(4):                                                                             # 노렌 4장(불투명 천, 갈라진 틈은 어두운 보라)
        fx = x + 10 + i * 13; R(fx, y + 13, 12, 10, K('aka', 3)); HL(fx, y + 13, 12, K('aka', 4)); VL(fx, y + 13, 10, K('aka', 4))
        HL(fx, y + 22, 12, K('aka', 1)); disc(fx + 6, y + 18, 2, K('shiro', 4)); P(fx + 6, y + 18, K('aka', 3))
        VL(fx + 12, y + 13, 10, SUMI1)
    HL(x + 10, y + 12, 52, SUMI1)
    # 초롱
    R(x + 66, y + 14, 6, 9, K('aka', 4)); HL(x + 66, y + 14, 6, K('kii', 3)); HL(x + 66, y + 22, 6, K('kii', 3)); VL(x + 66, y + 15, 7, K('aka', 5)); VL(x + 71, y + 15, 7, K('aka', 2))
    P(x + 68, y + 18, K('kii', 5)); P(x + 69, y + 18, K('kii', 5)); FR(x + 65, y + 13, 8, 11, SUMI1); VL(x + 69, y + 11, 3, SUMI1)
    # 입구
    R(x + 76, y + 6, 34, 26, K('tekko', 3)); FR(x + 76, y + 6, 34, 26, K('tekko', 1))
    for i in range(2):
        bx = x + 79 + i * 12; R(bx, y + 9, 11, 23, K('garasu', 2)); HL(bx, y + 9, 11, K('garasu', 4)); VL(bx, y + 9, 23, K('garasu', 3))
        for j in range(4): P(bx + 2 + j * 2, y + 11 + j, K('garasu', 5)); P(bx + 3 + j * 2, y + 11 + j, K('garasu', 5))
        R(bx + 8 - i * 6, y + 20, 2, 5, K('tekko', 5))
    R(x + 78, y + 7, 30, 2, K('shiro', 4)); text(x + 82, y + 7, 'HOTEL'[:0], K('shiro', 4))
    R(x + 102, y + 9, 7, 22, K('tekko', 1))                                                       # 안내판
    for j, cc in enumerate(('aka', 'sora', 'kii', 'midori', 'pinku')): R(x + 103, y + 10 + j * 4, 5, 3, K(cc, 4))
    HL(x, y + 31, 128, SUMI1)

def upper_B(x):   # 편의점 윗층(흰 타일 + 리본 유리창 + 24H 상자 간판)
    R(x, 0, 128, 64, K('usu', 5)); R(x + 120, 0, 8, 64, K('usu', 4)); VL(x, 0, 64, K('usu', 6))
    for k in range(4):
        ledge(x, 16 * k, 128)
        if k == 1:
            bevel(x + 8, 16 + 2, 36, 11, 'sora', 3, out=SUMI1); text(x + 12, 16 + 4, '24H', K('shiro', 5), pitch=7, bold=True)
            R(x + 46, 16 + 2, 76, 11, K('garasu', 2)); HL(x + 46, 16 + 2, 76, K('garasu', 4))
            for i in range(5): VL(x + 60 + i * 15, 16 + 2, 11, K('usu', 1))
            FR(x + 45, 16 + 1, 78, 13, K('usu', 1))
        else:
            for i in range(4):
                win(x + 6 + i * 30, 16 * k + 3, 24 if k != 1 else 24, 8, 'glass' if (i + k) % 2 == 0 else 'lit', i + k)
    for k in (0, 2, 3): acunit(x + 5, 16 * k + 4) if False else None

def shop_B(x):    # 1층: 편의점 — 초록·흰·하늘 띠 + 유리 진열 + 자동문
    y = 64; R(x, y, 128, 32, K('usu', 3)); HL(x, y, 128, K('usu', 2))
    R(x + 4, y + 1, 120, 12, K('shiro', 5)); R(x + 4, y + 1, 120, 2, K('midori', 3)); R(x + 4, y + 11, 120, 2, K('sora', 3))
    HL(x + 4, y + 3, 120, K('midori', 5)); FR(x + 3, y, 122, 14, SUMI1); HL(x + 4, y + 13 + 1, 120, K('usu', 1))
    text(x + 12, y + 4, 'MART', K('kon', 3), pitch=7); text(x + 60, y + 4, '24', K('daidai', 4), pitch=7, bold=True)
    R(x + 82, y + 4, 36, 6, K('shiro', 5))                                                        # 안쪽 작은 안내 띠(간판 옆 광고)
    for i in range(6): R(x + 84 + i * 6, y + 5, 4, 4, K(('aka', 'kii', 'sora', 'midori', 'pinku', 'daidai')[i], 4))
    def glass(gx, gw):
        FR(gx - 1, y + 15, gw + 2, 17, K('tekko', 2)); R(gx, y + 16, gw, 15, K('shiro', 4)); HL(gx, y + 16, gw, K('shiro', 5))
        for sy in (21, 26):
            HL(gx, y + sy, gw, K('tekko', 3)); HL(gx, y + sy + 1, gw, K('tekko', 1))
            for i in range(gw // 4): R(gx + 1 + i * 4, y + sy - 3, 3, 3, K(('aka', 'kii', 'sora', 'midori', 'pinku', 'daidai')[(i + sy) % 6], 4))
        for i in range(4): P(gx + 2 + i * 2, y + 17 + i, K('shiro', 5)); P(gx + 3 + i * 2, y + 17 + i, K('shiro', 5))
        R(gx, y + 29, gw, 2, K('usu', 2))
    glass(x + 6, 40); glass(x + 82, 38)
    FR(x + 50, y + 15, 30, 17, K('tekko', 1));
    for i in range(2):
        dx = x + 51 + i * 14; R(dx, y + 16, 14, 15, K('garasu', 3)); HL(dx, y + 16, 14, K('garasu', 5)); VL(dx, y + 16, 15, K('garasu', 4))
        for j in range(4): P(dx + 2 + j * 2, y + 18 + j, K('shiro', 5)); P(dx + 3 + j * 2, y + 18 + j, K('shiro', 5))
        R(dx + 11 - i * 8, y + 22, 2, 4, K('tekko', 2))
    R(x + 52, y + 30, 26, 2, K('aka', 2)); HL(x, y + 31, 128, SUMI1)

def upper_C(x):   # 분홍 벽돌 아파트(발코니: 남색 어둠 + 흰 난간)
    R(x, 0, 128, 64, K('momo', 3))
    for k in range(4):
        for j in range(5): HL(x, 16 * k + 3 * j, 128, K('momo', 2))                              # 벽돌 줄눈
        R(x, 16 * k + 13, 128, 3, K('momo', 4)); HL(x, 16 * k + 15, 128, K('momo', 1))            # 발코니 슬래브(분홍 띠)
        for bx, laundry in ((8, k % 2 == 0), (40, k % 2 == 1)):
            R(x + bx, 16 * k + 2, 22, 11, K('kon', 1)); HL(x + bx, 16 * k + 2, 22, K('kon', 2)); FR(x + bx - 1, 16 * k + 1, 24, 13, SUMI1)
            if laundry:
                for q, cc in enumerate(('sora', 'shiro', 'pinku')): R(x + bx + 3 + q * 6, 16 * k + 4, 4, 5, K(cc, 4)); HL(x + bx + 3 + q * 6, 16 * k + 4, 4, K(cc, 5))
                HL(x + bx + 1, 16 * k + 3, 20, K('tekko', 3))
            R(x + bx, 16 * k + 8, 22, 5, K('kon', 0)); HL(x + bx, 16 * k + 8, 22, K('shiro', 4))          # 난간 위 막대
            for q in range(0, 22, 3): VL(x + bx + q, 16 * k + 9, 4, K('shiro', 3))
        win(x + 78, 16 * k + 3, 18, 8, 'lit' if k != 2 else 'glass', k)
        acunit(x + 100, 16 * k + 6)
    R(x + 120, 0, 8, 64, K('momo', 2))

def shop_C(x):    # 1층: 이자카야 — 남색 골함석 처마 + 붉은 벽돌 + 격자창 + 노렌 + 초롱
    y = 64; R(x, y, 128, 32, K('renga', 3))
    for j in range(8):                                                                              # 벽돌 줄(3px 한 줄, 줄마다 반 칸 엇갈림)
        yy = y + 10 + j * 3
        if yy > y + 31: break
        HL(x, yy, 128, K('renga', 2))
        for bx in range((j % 2) * 3, 128, 6): VL(x + bx, yy, 3, K('renga', 2)); P(x + bx + 1, yy + 1, K('renga', 4))
    for xx in range(128):                                                                           # 골함석 처마(세로 골)
        R(x + xx, y, 1, 9, K('kon', 2 if xx % 2 == 0 else 3)); P(x + xx, y, K('kon', 4))
    HL(x, y + 8, 128, SUMI0); HL(x, y + 9, 128, K('renga', 1))
    R(x, y + 10, 128, 1, K('renga', 1))
    # 격자창(고시) + 종이 불빛
    FR(x + 8, y + 13, 36, 15, K('moku', 1)); R(x + 9, y + 14, 34, 13, K('mado', 4)); HL(x + 9, y + 14, 34, K('mado', 5))
    for i in range(1, 9): VL(x + 9 + i * 4, y + 14, 13, K('moku', 3))
    for j in (1, 2): HL(x + 9, y + 14 + j * 4, 34, K('moku', 3))
    R(x + 9, y + 24, 34, 3, K('mado', 3)); HL(x + 8, y + 28, 36, K('moku', 4))
    # 출입문 + 노렌
    R(x + 62, y + 12, 38, 20, K('moku', 2)); R(x + 64, y + 14, 34, 18, K('mado', 4))
    for i in range(1, 8): VL(x + 64 + i * 4, y + 14, 18, K('moku', 3))
    for j in (1, 2, 3): HL(x + 64, y + 14 + j * 4, 34, K('moku', 3))
    for i in range(3):
        fx = x + 63 + i * 12; R(fx, y + 11, 11, 13, K('kon', 3)); HL(fx, y + 11, 11, K('kon', 5)); VL(fx, y + 11, 13, K('kon', 4)); HL(fx, y + 23, 11, K('kon', 1)); VL(fx + 11, y + 11, 13, SUMI1)
    glyph(x + 78, y + 14, '酒', K('shiro', 5))                                                        # 가운데 노렌의 글자
    HL(x + 62, y + 10, 38, SUMI1)
    for lx in (x + 50, x + 106):                                                                    # 초롱 2개
        R(lx, y + 13, 7, 10, K('aka', 4)); HL(lx, y + 13, 7, K('kii', 3)); HL(lx, y + 22, 7, K('kii', 3)); VL(lx, y + 14, 8, K('aka', 5)); VL(lx + 6, y + 14, 8, K('aka', 2))
        HL(lx + 2, y + 17, 3, K('kii', 5)); FR(lx - 1, y + 12, 9, 12, SUMI1); VL(lx + 3, y + 10, 2, SUMI1)
    R(x + 112, y + 26, 10, 6, K('moku', 2)); HL(x + 112, y + 26, 10, K('moku', 4))                    # 술통
    HL(x, y + 31, 128, SUMI1)

def upper_D(x):   # 회색 연보라 사무실 층: 4열 창 + 실외기
    R(x, 0, 128, 64, K('usu', 3)); VL(x, 0, 64, K('usu', 4)); R(x + 120, 0, 8, 64, K('usu', 2))
    for k in range(4):
        ledge(x, 16 * k, 128)
        for i in range(4):
            win(x + 8 + i * 28, 16 * k + 3, 18, 8, 'lit' if (i + 2 * k) % 3 != 1 else 'glass', i + k)
            if (i + k) % 2 == 0: acunit(x + 8 + i * 28 + 21, 16 * k + 8) if i < 3 else None

def shop_D(x):    # 1층: 카페(나무 간판·줄무늬 차양) + 셔터 가게
    y = 64; R(x, y, 128, 32, K('usu', 3)); HL(x, y, 128, K('usu', 2))
    bevel(x + 8, y + 1, 48, 11, 'moku', 3, out=SUMI1); text(x + 12, y + 3, 'コーヒー', K('kinari', 5), bold=True)
    for i in range(12):                                                                             # 줄무늬 차양(붉은 벽돌색 + 흰색)
        R(x + 6 + i * 4, y + 13, 4, 6, K('renga', 3) if i % 2 == 0 else K('shiro', 4)); P(x + 6 + i * 4, y + 13, K('renga', 4) if i % 2 == 0 else K('shiro', 5))
    for i in range(12): R(x + 6 + i * 4, y + 19, 4, 1, K('renga', 1) if i % 2 == 0 else K('usu', 2))
    HL(x + 6, y + 12, 48, SUMI1); HL(x + 6, y + 20, 48, SUMI1)
    FR(x + 8, y + 21, 44, 11, K('moku', 1)); R(x + 9, y + 22, 42, 10, K('mado', 3)); HL(x + 9, y + 22, 42, K('mado', 4))
    for i in range(4): R(x + 12 + i * 9, y + 27, 6, 5, K('moku', 3)); HL(x + 12 + i * 9, y + 27, 6, K('moku', 4))   # 탁자
    for i in range(4): disc(x + 15 + i * 9, y + 25, 1, K('mado', 5))
    R(x + 56, y + 14, 12, 18, K('moku', 2)); R(x + 58, y + 16, 8, 16, K('mado', 3)); P(x + 64, y + 24, K('kii', 5))   # 문
    disc(x + 72, y + 29, 3, K('ki', 3)); R(x + 70, y + 30, 5, 2, K('renga', 3)); P(x + 71, y + 27, K('ki', 5))         # 화분
    # 셔터 가게
    R(x + 76, y + 3, 46, 29, K('tekko', 3)); FR(x + 76, y + 3, 46, 29, K('tekko', 1))
    for j in range(2, 29, 2): HL(x + 77, y + 3 + j, 44, K('tekko', 4) if j % 4 == 0 else K('tekko', 2))
    R(x + 96, y + 27, 6, 3, K('tekko', 1)); R(x + 80, y + 6, 14, 5, K('kii', 3)); text(x + 82, y + 7, 'OPEN'[:0], K('kii', 3))
    HL(x, y + 31, 128, SUMI1)

def sign_vertical_C(x): vsign(x + 108, 10, 'サケ', 'pinku', 'shiro')

# ─────────────────────────── 보도 ───────────────────────────
def sidewalk(y0=96, y1=128, x0=0, x1=512, curb=True):
    for y in range(y0, y1):
        for x in range(x0, x1):
            row = (y - y0) // 8; off = 8 if row % 2 else 0
            P(x, y, K('hodo', 3))
    for y in range(y0, y1):
        r = (y - y0) % 8
        for x in range(x0, x1):
            row = (y - y0) // 8; off = 8 if row % 2 else 0
            if r == 7: P(x, y, K('hodo', 2))
            elif r == 0: P(x, y, K('hodo', 4))
            if (x + off) % 16 == 15: P(x, y, K('hodo', 2))
            elif (x + off) % 16 == 0 and r != 7: P(x, y, K('hodo', 4))
    HL(x0, y0, x1 - x0, K('hodo', 1)); HL(x0, y0 + 1, x1 - x0, K('hodo', 2))                        # 벽 발치 그늘

def curb(y, x0=0, x1=512, down=True):
    R(x0, y, x1 - x0, 1, K('shiro', 3)); R(x0, y + 1, x1 - x0, 1, K('hodo', 5)); R(x0, y + 2, x1 - x0, 1, K('hodo', 1)); R(x0, y + 3, x1 - x0, 1, K('sumi', 1))

def tactile(x0, x1, y):
    R(x0, y, x1 - x0, 4, K('kii', 3)); HL(x0, y, x1 - x0, K('kii', 4)); HL(x0, y + 3, x1 - x0, K('kii', 2))
    for x in range(x0 + 1, x1, 3):
        for yy in (y + 1, y + 2): P(x, yy, K('kii', 2))

def guard_arch(x, w, y=113):
    """가드레일 한 칸: 기둥 둘 + 윗대 + 아치."""
    for px in (x, x + w - 2):
        R(px, y, 2, 12, K('kinari', 4)); VL(px, y, 12, K('kinari', 5)); VL(px + 1, y, 12, K('kinari', 2)); R(px - 1, y + 11, 4, 2, K('conc', 2))
    R(x, y, w, 2, K('kinari', 5)); HL(x, y + 1, w, K('kinari', 3)); HL(x, y - 1, w, K('sumi', 1))
    HL(x + 2, y + 8, w - 4, K('kinari', 3))
    n = (w - 4) // 12                                                                               # 아치 개수(12px 폭)
    span = (w - 4) // max(n, 1)
    for a in range(n):
        ax = x + 2 + a * span
        arc = [(0, 7), (1, 5), (2, 4), (3, 3), (4, 3)]
        for dx, dy in arc:
            for xx in (ax + dx, ax + span - 1 - dx): P(xx, y + 2 + dy - 2 + 0, K('kinari', 4)); P(xx, y + 3 + dy - 2, K('kinari', 2))
        HL(ax + 4, y + 3, span - 8, K('kinari', 4)); HL(ax + 4, y + 4, span - 8, K('kinari', 2))
        VL(ax, y + 5, 3, K('kinari', 4)); VL(ax + span - 1, y + 5, 3, K('kinari', 4))
    HL(x - 1, y + 12, w + 2, K('sumi', 1))

def hedge_box(x, w, y=111):
    R(x, y + 7, w, 6, K('conc', 4)); HL(x, y + 7, w, K('conc', 5)); HL(x, y + 12, w, K('conc', 2)); VL(x, y + 7, 6, K('conc', 5)); VL(x + w - 1, y + 7, 6, K('conc', 2))
    R(x + 1, y, w - 2, 8, K('ki', 3)); HL(x + 1, y, w - 2, K('ki', 4)); R(x + 2, y - 1, w - 4, 1, K('ki', 2))
    for i in range(0, w - 4, 5): R(x + 2 + i, y + 1, 3, 2, K('ki', 5)); P(x + 2 + i, y + 1, K('ki', 6))
    for i in range(2, w - 5, 6): R(x + 2 + i, y + 4, 3, 2, K('ki', 2))
    HL(x, y + 13, w, SUMI1)

def fill_guardrail(x0, x1):
    if x1 - x0 < 18:
        hedge_box(x0, x1 - x0); return
    n = max(1, round((x1 - x0) / 32)); ws = [(x1 - x0) // n + (1 if i < (x1 - x0) % n else 0) for i in range(n)]
    x = x0
    for i, w in enumerate(ws):
        (guard_arch if i % 2 == 0 else hedge_box)(x, w); x += w

def tree(cx, base=118):
    """가로수(작은 형): 어두운 초록 수관 + 왼쪽 위 연두 잎 덩이, 줄기, 화분 틀. 간판을 가리지 않게 폭 26px."""
    cy = 88
    body = [(cx, cy, 10), (cx - 6, cy + 2, 6), (cx + 6, cy + 2, 6), (cx - 3, cy - 6, 6), (cx + 4, cy - 5, 6)]
    for (x, y, r) in body: disc(x, y, r + 1, K('ki', 0))
    for (x, y, r) in body: disc(x, y, r, K('ki', 3))
    for yy in range(cy - 18, cy + 14):                                                              # 아래·오른쪽 그늘 = 놓은 마스크
        for xx in range(cx - 18, cx + 18):
            if cv[yy][xx] == K('ki', 3):
                d = (xx - cx) + (yy - cy)
                if d > 13: P(xx, yy, K('ki', 1))
                elif d > 7: P(xx, yy, K('ki', 2))
    leaf = ['.55.', '5665', '.55.']
    for (dx, dy) in ((-8, -7), (-2, -10), (3, -6), (-8, -1), (-3, -3), (2, 1), (6, -2), (-6, 4)):    # 손으로 놓은 잎 덩이(연두)
        for j, row in enumerate(leaf):
            for i, ch in enumerate(row):
                if ch != '.' and cv[cy + dy + j][cx + dx + i] in (K('ki', 3), K('ki', 2)): P(cx + dx + i, cy + dy + j, K('ki', int(ch) + (1 if dx < 0 else 0)))
    for (dx, dy) in ((4, 6), (-2, 8), (7, 4)):
        R(cx + dx, cy + dy, 3, 2, K('ki', 1))
    R(cx - 2, cy + 10, 4, base - cy - 14, K('moku', 3)); VL(cx - 2, cy + 10, base - cy - 14, K('moku', 4)); VL(cx + 1, cy + 10, base - cy - 14, K('moku', 1))    # 줄기
    R(cx - 9, base - 4, 19, 5, K('conc', 3)); HL(cx - 9, base - 4, 19, K('conc', 5)); HL(cx - 9, base, 19, K('conc', 1)); FR(cx - 10, base - 5, 21, 7, SUMI1)
    R(cx - 7, base - 3, 15, 2, K('moku', 1))

def bike(x, y):
    for wx in (x + 3, x + 15):
        disc(wx, y + 8, 3, SUMI1); disc(wx, y + 8, 2, K('tekko', 4)); P(wx, y + 8, SUMI1)
    for i in range(12): P(x + 3 + i, y + 8 - (i * 5) // 12 - 0, K('sora', 3))
    HL(x + 6, y + 3, 8, K('sora', 4)); VL(x + 14, y + 2, 6, K('sora', 3)); R(x + 13, y + 1, 5, 1, SUMI1); R(x + 3, y + 1, 4, 2, K('aka', 3))
    R(x + 15, y + 5, 4, 3, K('kii', 3))                                                             # 앞 바구니

def standing_sign(x, y):
    R(x, y, 12, 16, K('shiro', 4)); HL(x, y, 12, K('shiro', 5)); VL(x, y, 16, K('shiro', 5)); FR(x - 1, y - 1, 14, 18, SUMI1)
    R(x + 1, y + 1, 10, 4, K('aka', 3)); for_i = 0
    for i in range(3): HL(x + 2, y + 7 + i * 3, 8 - i, K('kon', 3))
    R(x + 1, y + 16, 2, 3, K('tekko', 3)); R(x + 9, y + 16, 2, 3, K('tekko', 3))

def vending(x, y, body):
    """자판기 18×27: 윗 조명 · 진열창(캔 줄) · 버튼 · 꺼내는 구멍."""
    R(x, y, 18, 27, K(body, 3)); FR(x - 1, y - 1, 20, 29, SUMI1); VL(x, y, 27, K(body, 4)); HL(x, y, 18, K(body, 4)); VL(x + 17, y, 27, K(body, 1)); HL(x, y + 26, 18, K(body, 1))
    R(x + 2, y + 2, 14, 3, K('shiro', 5))                                                            # 위 조명 문구판
    for i in range(4): P(x + 3 + i * 3, y + 3, K(body, 3))
    R(x + 2, y + 6, 11, 11, K('kon', 0)); FR(x + 2, y + 6, 11, 11, K('tekko', 3))
    for j in range(3):
        for i in range(4): R(x + 3 + i * 2 + (i // 4), y + 7 + j * 3, 2, 2, K(('aka', 'sora', 'kii', 'midori', 'pinku', 'daidai')[(i + j * 2) % 6], 4))
    for j in range(4): R(x + 14, y + 7 + j * 3, 2, 2, K('shiro', 4)); P(x + 14, y + 7 + j * 3, K('kii', 4))   # 버튼
    R(x + 3, y + 20, 10, 4, K('kon', 0)); HL(x + 3, y + 20, 10, K('tekko', 2))                      # 꺼내는 구멍
    R(x + 19, y + 3, 3, 25, K('hodo', 1))                                                            # 오른쪽 아래 그림자(구운 어두운 단)

# ─────────────────────────── 차도 ───────────────────────────
def road(y0=128, y1=192):
    R(0, y0, W, y1 - y0, K('yoru', 2))
    R(0, y0, W, 4, K('yoru', 1)); HL(0, y0 + 4, W, K('yoru', 3)); R(0, y1 - 4, W, 4, K('yoru', 1)); HL(0, y1 - 5, W, K('yoru', 3))          # 배수 홈
    for (px, py, pw, ph, t) in ((30, 140, 34, 10, 3), (150, 176, 44, 7, 3), (330, 138, 26, 12, 1), (400, 172, 40, 8, 1), (450, 146, 30, 6, 3), (20, 172, 26, 5, 1)):   # 땜질 자국
        R(px, py, pw, ph, K('yoru', t)); FR(px, py, pw, ph, K('yoru', 2 if t == 3 else 0)) if False else None
    for (cx, cy, cl) in ((78, 148, 10), (350, 168, 8), (200, 150, 9), (420, 154, 7)):                # 금
        for i in range(cl): P(cx + i, cy + (i % 3 == 2) - (i % 5 == 4), K('yoru', 1))
    for x in range(0, W, 32):                                                                       # 중앙선(노랑 점선)
        if 226 <= x <= 262: continue
        R(x + 8, 159, 16, 2, K('kii', 3)); HL(x + 8, 159, 16, K('kii', 4)); HL(x + 8, 161, 16, K('kii', 1))
    for x in range(0, W, 24): R(x, y0 + 5, 12, 1, K('shiro', 2))                                     # 가장자리 흰 실선(끊김)
    for x in range(0, W, 24): R(x, y1 - 6, 12, 1, K('shiro', 2))

def crosswalk(x0=236, w=32, y0=134, n=7):
    for i in range(n):
        y = y0 + i * 8; R(x0, y, w, 4, K('shiro', 4)); HL(x0, y, w, K('shiro', 5)); HL(x0, y + 3, w, K('shiro', 3))
        for q in (5, 19): P(x0 + q + i % 3, y + 1, K('shiro', 3)); P(x0 + q + 4 + i % 3, y + 2, K('yoru', 4))    # 닳은 자국
    R(x0 - 6, 133, 3, 26, K('shiro', 4)); R(x0 + w + 3, 162, 3, 26, K('shiro', 4))                    # 정지선

def manhole(cx, cy):
    disc(cx, cy, 9, K('sumi', 1)); disc(cx, cy, 8, K('tekko', 2)); disc(cx, cy, 6, K('tekko', 3))
    for d in range(-5, 6): P(cx + d, cy, K('tekko', 1)); P(cx, cy + d, K('tekko', 1))
    for a, b in ((-4, -4), (4, -4), (-4, 4), (4, 4)): disc(cx + a, cy + b, 1, K('tekko', 4))
    for d in range(-7, 0): P(cx + d // 2 - 3, cy - 6 + (d + 7) // 3, K('tekko', 5))                    # 왼쪽 위 빛
    HL(cx - 3, cy - 2, 6, K('tekko', 4)); HL(cx - 3, cy + 2, 6, K('tekko', 4))
    R(cx + 6, cy + 4, 4, 4, K('yoru', 1))                                                            # 오른쪽 아래 그늘

def signal(px, py):
    """신호등 기둥: 아래 보도에 서고 팔이 차도 위로 뻗음 + 보행 신호."""
    R(px, py, 3, 30, K('tekko', 3)); VL(px, py, 30, K('tekko', 5)); VL(px + 2, py, 30, K('tekko', 1)); R(px - 2, py + 29, 7, 3, K('conc', 3)); HL(px - 2, py + 31, 7, SUMI1)
    HL(px - 32, py + 2, 34, K('tekko', 3)); HL(px - 32, py + 1, 34, K('tekko', 5)); HL(px - 32, py + 3, 34, K('tekko', 1))
    R(px - 31, py + 4, 25, 8, K('tekko', 2)); FR(px - 32, py + 3, 27, 10, SUMI1)
    for i, (cc, t) in enumerate((('midori', 5), ('kii', 2), ('aka', 2))):
        disc(px - 26 + i * 8, py + 8, 2, K(cc, t)); P(px - 27 + i * 8, py + 7, K(cc, min(t + 1, 5)))
    R(px - 6, py + 14, 9, 12, K('tekko', 2)); FR(px - 7, py + 13, 11, 14, SUMI1)
    R(px - 4, py + 15, 5, 5, K('aka', 4)); R(px - 4, py + 21, 5, 4, K('midori', 2))                     # 보행 신호
    P(px - 2, py + 17, K('shiro', 5)); P(px - 2, py + 18, K('shiro', 5))
    R(px + 4, py + 26, 5, 5, K('hodo', 1))

# ─────────────────────────── 낮은 건물 · 지붕 ───────────────────────────
def parapet(x, y, w, h):
    """지붕 가장자리: 크림색 띠(위·왼 밝게, 아래·오른 어둡게) + 어두운 보라 윤곽."""
    R(x, y, w, h, K('kinari', 3)); R(x, y, w, 3, K('kinari', 4)); R(x, y, 3, h, K('kinari', 4)); R(x + w - 3, y, 3, h, K('kinari', 2)); R(x, y + h - 3, w, 3, K('kinari', 2))
    HL(x, y, w, K('kinari', 5)); VL(x, y, h, K('kinari', 5)); FR(x - 1, y - 1, w + 2, h + 2, SUMI1)

def roof_flat(x, y, w, h, ramp, t):
    parapet(x, y, w, h); R(x + 3, y + 3, w - 6, h - 6, K(ramp, t))
    for sx in range(x + 32, x + w - 3, 32): VL(sx, y + 3, h - 6, K(ramp, t - 1)); VL(sx + 1, y + 3, h - 6, K(ramp, t + 1))
    HL(x + 3, y + 3, w - 6, K(ramp, t - 1)); HL(x + 3, y + 4, w - 6, K(ramp, t - 2)); VL(x + 3, y + 3, h - 6, K(ramp, t + 1))

def water_tank(x, y):
    """물탱크(철골 발판 위 원통). 왼쪽 위 빛, 오른쪽 아래로 지붕에 어두운 그림자."""
    R(x + 8, y + 30, 40, 5, K('conc', 1))                                                            # 지붕에 드리운 그림자
    for lx in (x + 2, x + 8, x + 22, x + 28): R(lx, y + 26, 2, 9, K('tekko', 3)); P(lx, y + 26, K('tekko', 5))   # 다리
    for k in range(8): P(x + 2 + k, y + 28 + (k % 2), K('tekko', 2)); P(x + 30 - k, y + 28 + (k % 2), K('tekko', 2))   # 가새
    HL(x, y + 26, 32, K('tekko', 4)); HL(x, y + 27, 32, K('tekko', 1))
    R(x + 2, y + 8, 28, 18, K('tekko', 4)); R(x + 2, y + 8, 6, 18, K('tekko', 5)); R(x + 24, y + 8, 6, 18, K('tekko', 3)); R(x + 28, y + 8, 2, 18, K('tekko', 2))
    for yy in (12, 18, 23): HL(x + 2, y + yy, 28, K('tekko', 2)); HL(x + 2, y + yy - 1, 28, K('tekko', 5))
    R(x + 2, y + 6, 28, 3, K('tekko', 5)); HL(x + 3, y + 5, 26, K('tekko', 3)); R(x + 8, y + 3, 16, 2, K('tekko', 4)); R(x + 14, y + 1, 4, 2, K('tekko', 3))   # 뚜껑·맨홀
    FR(x + 1, y + 7, 30, 20, SUMI1); HL(x + 2, y + 26, 28, SUMI1)
    VL(x + 33, y + 10, 26, K('tekko', 2)); P(x + 33, y + 10, K('tekko', 5))                          # 사다리
    for k in range(6): HL(x + 33, y + 12 + k * 4, 3, K('tekko', 4))

def outdoor_ac(x, y, n=3):
    for i in range(n):
        ux = x + i * 16
        R(ux + 2, y + 8, 14, 3, K('conc', 1))                                                       # 그림자
        R(ux, y, 14, 9, K('shiro', 4)); HL(ux, y, 14, K('shiro', 5)); VL(ux, y, 9, K('shiro', 5)); HL(ux, y + 8, 14, K('shiro', 2)); VL(ux + 13, y, 9, K('shiro', 3))
        disc(ux + 7, y + 4, 3, K('tekko', 1)); disc(ux + 7, y + 4, 2, K('tekko', 3))
        for k in range(3): HL(ux + 5, y + 3 + k, 5, K('tekko', 2))
        P(ux + 3, y + 3, K('tekko', 5)); FR(ux - 1, y - 1, 16, 11, SUMI1)
        R(ux + 4, y + 9, 2, 2, K('tekko', 2)); R(ux + 9, y + 9, 2, 2, K('tekko', 2))

def stairwell(x, y):
    """옥상 계단실 24×20: 위에서 보면 지붕(연보라) + 앞면(문)."""
    R(x + 3, y + 22, 24, 3, K('conc', 1))
    R(x, y + 8, 24, 14, K('usu', 4)); VL(x, y + 8, 14, K('usu', 5)); VL(x + 23, y + 8, 14, K('usu', 2)); FR(x - 1, y + 7, 26, 16, SUMI1)
    R(x, y, 24, 8, K('usu', 5)); HL(x, y, 24, K('usu', 6)); VL(x, y, 8, K('usu', 6)); HL(x, y + 7, 24, K('usu', 3)); FR(x - 1, y - 1, 26, 10, SUMI1)
    R(x + 9, y + 12, 8, 10, K('tekko', 3)); FR(x + 9, y + 12, 8, 10, K('tekko', 1)); R(x + 10, y + 13, 6, 8, K('kon', 3)); P(x + 14, y + 17, K('kii', 4))
    R(x + 3, y + 3, 5, 3, K('tekko', 3)); FR(x + 3, y + 3, 5, 3, SUMI1)                             # 환기 덮개

def antenna(x, y):
    R(x + 5, y + 14, 6, 3, K('conc', 1))                                                            # 그림자
    VL(x, y, 18, K('tekko', 5)); VL(x + 1, y, 18, K('tekko', 2))
    for k, half in enumerate((7, 6, 5, 4)): HL(x - half, y + 2 + k * 3, half * 2 + 2, K('tekko', 4)); HL(x - half + 1, y + 3 + k * 3, half * 2 - 1, K('tekko', 2)) if False else None
    R(x - 2, y + 17, 6, 2, K('conc', 4))
    for k in range(3): P(x - 7 + k, y + 2, K('tekko', 5)); P(x + 8 - k, y + 2, K('tekko', 5))

def vent_box(x, y):
    R(x + 2, y + 5, 8, 2, K('conc', 1)); R(x, y, 9, 6, K('tekko', 4)); HL(x, y, 9, K('tekko', 5)); HL(x, y + 5, 9, K('tekko', 2)); VL(x + 8, y, 6, K('tekko', 3)); FR(x - 1, y - 1, 11, 8, SUMI1)
    for k in range(3): HL(x + 2, y + 1 + k, 5, K('tekko', 2))

def skylight(x, y):
    R(x, y, 26, 14, K('tekko', 3)); FR(x - 1, y - 1, 28, 16, SUMI1)
    for i in range(3):
        for j in range(2): R(x + 1 + i * 8, y + 1 + j * 7, 7, 6, K('garasu', 3)); HL(x + 1 + i * 8, y + 1 + j * 7, 7, K('garasu', 5)); P(x + 3 + i * 8, y + 2 + j * 7, K('shiro', 5)); P(x + 4 + i * 8, y + 3 + j * 7, K('shiro', 5))
    R(x + 3, y + 15, 26, 3, K('ki', 1))

def roof_tile(x, y, w, h):
    parapet(x, y, w, 5); R(x + 1, y + 5, w - 2, h - 5, K('renga', 3))
    for j in range(5, h - 1, 4):
        HL(x + 1, y + j, w - 2, K('renga', 2)); HL(x + 1, y + j + 1, w - 2, K('renga', 4))
        for tx in range((j // 4 % 2) * 3, w - 2, 6): P(x + 1 + tx, y + j + 2, K('renga', 2)); P(x + 1 + tx, y + j + 3, K('renga', 2))
    R(x + 1, y + 5, w - 2, 2, K('kinari', 3)); HL(x + 1, y + 5, w - 2, K('kinari', 5))
    VL(x, y + 5, h - 5, K('renga', 4)); VL(x + w - 1, y + 5, h - 5, K('renga', 1)); FR(x, y, w, h, SUMI1)
    solar(x + 62, y + 30, 40, 24); solar(x + 106, y + 30, 32, 24)
    R(x + w - 26, y + 14, 8, 8, K('conc', 3)); FR(x + w - 27, y + 13, 10, 10, SUMI1); HL(x + w - 26, y + 14, 8, K('conc', 5))                     # 굴뚝
    R(x + 18, y + 22, 18, 14, K('moku', 3)); FR(x + 17, y + 21, 20, 16, SUMI1); R(x + 20, y + 24, 14, 5, K('garasu', 3)); HL(x + 18, y + 22, 18, K('moku', 5))  # 다락 창

def solar(x, y, w, h):
    """지붕 태양광 패널: 남색 판 + 격자 + 왼쪽 위 반사."""
    R(x, y, w, h, K('kon', 2)); FR(x - 1, y - 1, w + 2, h + 2, SUMI1)
    for gx in range(x + 8, x + w, 8): VL(gx, y, h, K('kon', 4))
    for gy in range(y + 6, y + h, 6): HL(x, gy, w, K('kon', 4))
    HL(x, y, w, K('sora', 3)); VL(x, y, h, K('sora', 3)); HL(x, y + h - 1, w, K('kon', 0))
    for gx in range(x + 2, x + w - 4, 8): P(gx, y + 2, K('sora', 4)); P(gx + 1, y + 2, K('sora', 4))

def south_wall(x, y, w, h, kind):
    """낮은 건물 남쪽 벽(발코니·창·실외기)."""
    R(x, y, w, h, K('usu', 4)); R(x, y, w, 1, K('sumi', 1)); R(x + w - 6, y + 1, 6, h - 1, K('usu', 3)); VL(x, y, h, K('usu', 5))
    HL(x, y + 1, w, K('kinari', 3)); HL(x, y + 2, w, K('usu', 2))
    if kind == 'balcony':
        for bx in range(4, w - 34, 44):
            R(x + bx, y + 6, 34, 12, K('kon', 1)); HL(x + bx, y + 6, 34, K('kon', 2)); FR(x + bx - 1, y + 5, 36, 14, SUMI1)
            R(x + bx, y + 14, 34, 4, K('kon', 0)); HL(x + bx, y + 12, 34, K('shiro', 4))
            for q in range(0, 34, 3): VL(x + bx + q, y + 13, 5, K('shiro', 3))
            R(x + bx + 2, y + 7, 4, 4, K('pinku', 3)); R(x + bx + 8, y + 7, 4, 4, K('shiro', 4)); R(x + bx + 24, y + 7, 6, 4, K('sora', 3))   # 널린 빨래
            R(x + bx - 2, y + 19, 38, 3, K('momo', 3)); HL(x + bx - 2, y + 19, 38, K('momo', 5)); HL(x + bx - 2, y + 21, 38, K('momo', 1))
        R(x, y + 24, w, 2, K('usu', 3))
    else:
        for bx in range(6, w - 26, 34): win(x + bx, y + 7, 22, 9, 'lit' if bx % 2 == 0 else 'glass', bx // 34)
        acunit(x + w - 24, y + 22) if w > 60 else None
    HL(x, y + h - 1, w, SUMI1)

def utility_pole(x, top=312):
    """전신주: 콘크리트 기둥 + 가로대 2줄 + 애자 + 변압기 + 발판."""
    R(x + 4, top + 66, 8, 3, K('conc', 1))                                                           # 발치 그림자
    R(x, top, 5, 70, K('conc', 4)); VL(x, top, 70, K('conc', 5)); VL(x + 4, top, 70, K('conc', 2)); VL(x + 1, top, 70, K('conc', 5))
    FR(x - 1, top - 1, 7, 72, SUMI1)
    for k in range(0, 60, 8): P(x - 2, top + 14 + k, K('tekko', 4)); P(x - 3, top + 14 + k, K('tekko', 2))                     # 승주 발판
    R(x - 13, top + 6, 31, 3, K('tekko', 3)); HL(x - 13, top + 6, 31, K('tekko', 5)); HL(x - 13, top + 9, 31, SUMI1); R(x - 9, top + 14, 23, 2, K('tekko', 3)); HL(x - 9, top + 14, 23, K('tekko', 5))
    for ix in (x - 12, x - 4, x + 7, x + 15): R(ix, top + 2, 3, 4, K('tekko', 5)); P(ix, top + 2, K('shiro', 5)); HL(ix, top + 5, 3, K('tekko', 2))
    R(x + 6, top + 20, 9, 14, K('tekko', 3)); FR(x + 5, top + 19, 11, 16, SUMI1); VL(x + 6, top + 20, 14, K('tekko', 5)); HL(x + 6, top + 20, 9, K('tekko', 5)); R(x + 8, top + 22, 5, 3, K('tekko', 2))
    R(x - 10, top + 20, 6, 10, K('conc', 3)); FR(x - 11, top + 19, 8, 12, SUMI1)                    # 가로 상자(조가)

# ─────────────────────────── 장면 조립 ───────────────────────────
def build():
    # 1) 바닥(가장 아래)
    sidewalk(96, 128); curb(124)
    road(128, 192)
    sidewalk(192, 208); R(0, 192, W, 1, K('sumi', 1)); R(0, 192, W, 4, K('hodo', 4)); HL(0, 195, W, K('hodo', 2))
    R(0, 188, W, 4, K('yoru', 1)); HL(0, 187, W, K('yoru', 3)); curb(188, 0, W)
    R(0, 320, W, 16, K('yoru', 2)); R(0, 320, W, 4, K('yoru', 1)); HL(0, 324, W, K('yoru', 3)); R(0, 331, W, 1, K('shiro', 2))
    for x in range(0, W, 22): R(x + 4, 328, 10, 1, K('shiro', 2))
    # 철도 바닥
    R(0, 336, W, 48, K('jari', 2))
    tile = ['.a...b..', '...c...a', 'b...a...', '..c...b.', '.a...c..', '...b..a.']
    leg = {'a': K('jari', 3), 'b': K('jari', 1), 'c': K('jari', 4)}
    for ty in range(336, 384, 6):
        for tx in range(0, W, 8): SP(tx, ty, tile, leg)
    R(0, 336, W, 2, K('jari', 0)); HL(0, 338, W, K('jari', 1))
    for sx in range(2, W, 8):
        R(sx, 350, 4, 30, K('makura', 2)); VL(sx, 350, 30, K('makura', 3)); VL(sx + 3, 350, 30, K('makura', 0))
    for ry in (358, 372):
        HL(0, ry - 1, W, K('tekko', 1)); R(0, ry, W, 2, K('tekko', 5)); HL(0, ry + 2, W, K('tekko', 2)); HL(0, ry + 3, W, K('sumi', 1))
    for sx in range(0, W, 24):                                                                       # 레일 위 볼트 반짝임
        P(sx + 5, 358, K('shiro', 5)); P(sx + 17, 372, K('shiro', 5))
    # 철도 울타리(철망): 기둥 + 위 대 + 마름모 그물
    for x in range(W):
        if (x + 0) % 4 in (0, 1): pass
    for y in range(340, 348):
        for x in range(W):
            if (x + y) % 4 == 0 or (x - y) % 4 == 0: P(x, y, K('tekko', 3))
    HL(0, 339, W, K('tekko', 4)); HL(0, 340, W, K('tekko', 2)); HL(0, 348, W, K('tekko', 2)); HL(0, 349, W, K('sumi', 1))
    for x in range(0, W, 24): R(x, 336, 2, 14, K('tekko', 4)); VL(x + 2, 337, 13, K('tekko', 1))

    # 2) 낮은 건물 지붕(아래줄)
    roof_flat(0, 208, 176, 80, 'conc', 3)
    outdoor_ac(90, 224, 3); water_tank(18, 218); stairwell(132, 250); antenna(76, 222); vent_box(84, 258); vent_box(102, 268); vent_box(60, 272)
    R(152, 232, 10, 10, K('conc', 4)); FR(151, 231, 12, 12, SUMI1); disc(157, 237, 3, K('tekko', 2)); disc(157, 237, 2, K('tekko', 4))            # 지붕 환기팬
    roof_flat(184, 208, 168, 88, 'ki', 3)                                                            # 방수 도장(초록) 옥상
    skylight(200, 224); outdoor_ac(240, 222, 4); stairwell(210, 262); vent_box(290, 260); antenna(324, 222); vent_box(268, 276); vent_box(300, 276); skylight(326, 262)
    R(200, 246, 24, 6, K('kii', 3)); HL(200, 246, 24, K('kii', 4)); FR(199, 245, 26, 8, SUMI1)                                                # 옥상 간판 아랫면(노란 줄)
    roof_tile(360, 216, 152, 72)
    # 골목 · 아래 남쪽 벽
    R(176, 208, 8, 112, K('yoru', 1)); VL(176, 208, 112, K('yoru', 0)); VL(183, 208, 112, K('yoru', 0)); R(352, 208, 8, 112, K('yoru', 1)); VL(352, 208, 112, K('yoru', 0)); VL(359, 208, 112, K('yoru', 0))
    R(360, 208, 152, 8, K('usu', 3)); HL(360, 208, 152, K('sumi', 1))                                # 오른 건물 북쪽 낮은 담
    south_wall(0, 288, 176, 32, 'balcony'); south_wall(184, 296, 168, 24, 'win'); south_wall(360, 288, 152, 32, 'win')
    R(184, 288, 168, 8, K('usu', 3)); HL(184, 288, 168, SUMI1)
    for x in range(184, 352, 6): P(x, 292, K('usu', 2))
    R(184, 288, 168, 1, K('kinari', 4))

    # 3) 골목 소품 + 철도 전신주
    R(210, 322, 16, 8, K('conc', 4)); FR(209, 321, 18, 10, SUMI1); HL(210, 322, 16, K('conc', 5)); R(210, 326, 16, 1, K('conc', 2))
    R(300, 322, 12, 8, K('aka', 3)); FR(299, 321, 14, 10, SUMI1); HL(300, 322, 12, K('aka', 4))
    utility_pole(96); utility_pole(436)

    # 4) 가게 줄 (위)
    upper_A(0); shop_A(0); upper_B(128); shop_B(128); upper_C(256); shop_C(256); upper_D(384); shop_D(384)
    sign_vertical_C(256)
    for bx in (127, 255, 383): VL(bx, 0, 96, SUMI1); VL(bx + 1, 0, 96, K('usu', 2))                  # 건물 사이 경계
    HL(0, 95, W, SUMI1)
    tactile(0, 236, 118 - 0) if False else None
    # 5) 보도 위 것들
    tactile(8, 116, 110); tactile(312, 372, 110)
    fill_guardrail(0, 112); fill_guardrail(140, 236); fill_guardrail(268, 286); fill_guardrail(318, 372); fill_guardrail(404, 512)
    bike(30, 98); standing_sign(76, 96)
    for i, (vx, body) in enumerate(((446, 'aka'), (466, 'sora'), (486, 'midori'))): vending(vx, 82, body)
    for tx in (126, 254, 382): tree(tx)
    crosswalk(); manhole(104, 176)
    signal(290, 176)

    # 6) 전선(가장 위)
    for dy in (0, 1): wire(96 + 14, 314 + dy, 436 - 12, 314 + dy, 12, K('tekko', 4)); wire(96 + 14, 322 + dy, 436 - 12, 322 + dy, 10, K('tekko', 3))
    for dy in (0, 1): wire(96 - 12, 314 + dy, 0, 322 + dy, 3, K('tekko', 4)); wire(436 + 20, 314 + dy, 511, 320 + dy, 3, K('tekko', 4))

def to_rows():
    empty = sum(1 for y in range(H) for x in range(W) if cv[y][x] is None)
    keys = sorted({cv[y][x] for y in range(H) for x in range(W) if cv[y][x] is not None})
    ch = {k: chr(0x100 + i) for i, k in enumerate(keys)}
    legend = {ch[k]: k for k in keys}
    rows = [''.join(ch[cv[y][x]] if cv[y][x] is not None else '.' for x in range(W)) for y in range(H)]
    return rows, legend, empty

def main():
    build()
    # 톤 범위 확인
    import re
    ramps = {}
    for ln in open(os.path.join(PAL_DIR, 'jp2.pal'), encoding='utf-8'):
        m = re.match(r'@rampc\s+(\w+)\s+(.*)', ln)
        if m: ramps[m.group(1)] = len(m.group(2).split())
    bad = {k for row in cv for k in row if k is not None and k[1] >= ramps[k[0]] or (k is not None and k[1] < 0)}
    assert not bad, f'램프 밖 단: {sorted(bad)}'
    rows, legend, empty = to_rows()
    os.makedirs(OUT_DIR, exist_ok=True)
    pxg = os.path.join(OUT_DIR, 'dm2-D.pxg')
    open(pxg, 'w', encoding='utf-8').write(emit(rows, legend, title='jp style v2 demo street 32x24 (dm2-D)'))
    open(os.path.join(OUT_DIR, 'palette.pal'), 'w', encoding='utf-8').write(open(os.path.join(PAL_DIR, 'jp2.pal'), encoding='utf-8').read())
    print(pxg, 'colors', len(legend), 'empty px', empty)
    if '--png' in sys.argv:
        sys.path.insert(0, PXGRID); sys.path.insert(0, HARNESS)
        import pxgrid; pxgrid.render(pxg, pxg[:-4] + '.png'); print('png', pxg[:-4] + '.png')

if __name__ == '__main__':
    main()
