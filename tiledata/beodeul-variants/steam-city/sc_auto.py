# 증기 도시 땅 덩이 오토타일(16변형, 칸 번호 = 위 1 + 오른쪽 2 + 아래 4 + 왼쪽 8 — ec_fix·fr_base.edge_depth 규약).
#   autotile-oil-slick    : 젖은 자갈 위 기름 번짐(걷기). 반투명 남보라 막(밑 자갈이 비친다) + 가장자리 무지개 띠(톤 2~3 에 1px).
#   autotile-steam-puddle : 증기 고인 물(막힘). 젖은 테 → 북쪽 패인 그늘 → 김 서린 회청 물 + 물 위 흰 김 줄(손 도트, 번짐 없음).
#   autotile-coal-dust    : 석탄 가루 덩이(걷기). 성긴 알갱이 가장자리 → 속 가루 결 + 석탄 덩이(윗왼 빛).
#   autotile-iron-railing : 검은 무쇠 난간(막힘, fence). 칸 가운데 기둥(놋쇠 공 머리) + 이웃 쪽 창살.
# 가장자리는 불규칙·둥글다(직선·직각 금지): edge_taper(모서리로 갈수록 들어감이 준다) + 잡음 jag + 둥근 모퉁이 rad.
import math
import numpy as np
from PIL import Image, ImageDraw
from sc_base import *
from sc_base import _hash
import sc_ground as SG
from sc_edge import edge_taper, nearest, SHAPES, stamp

HERE = os.path.dirname(os.path.abspath(__file__))
O_ = A(OIL); C_ = A(COND); K_ = A(COAL); S_ = A(SOOT); G_ = A(GST)
SH_ = [A(hx(c)) for c in ('#4a2e52', '#2e4a5e', '#3a5a3a', '#6a5a24', '#6a3a2a')]    # 규격 steampunk.md SHEEN(탁한 무지개)


def H_(x, y, s): return float(hash2(x, y, s))
def _cell(rgb, al): return Image.fromarray(np.dstack([rgb, al]).astype(np.uint8), 'RGBA')


# ================================================================ 1. 기름 번짐(걷기)
OP = dict(inset=2.8, jag=2.6, rad=6.5, seed=2311)
def _om(n): return edge_taper(n, OP['inset'], OP['jag'], OP['rad'], OP['seed'], foot=1.6, ramp=3.2)
OIL_W = tnoise(16, 16, 6, 2317)
def oil_cell(n):
    """기름 번짐(규격 OIL·SHEEN): 속 = 반투명 기름 막(밑 바닥이 흐리게 비친다), 가장자리 = 두껍게 고인 어두운 테 + 남·서 빛 테,
    무지개는 칸마다 짧은 활 하나(탁한 SHEEN 다섯 색) — 점선·격자 없음. 밖 = 젖은 반투명 띠 + 튄 방울."""
    m = _om(n); lab = nearest(n, _om); s = OP['seed']
    rgb = np.zeros((16, 16, 3), int); al = np.zeros((16, 16), int)
    arc = set()
    if n != 15 or True:
        L = 7; cx = 3 + H_(n, 5, s) * 9; cy = 4 + H_(n, 6, s) * 8; ang = H_(n, 7, s) * 3.14; bend = (H_(n, 8, s) - .5) * .5
        for i in range(L):
            a_ = ang + bend * i
            arc.add((int(round(cx + math.cos(a_) * (i - L / 2))), int(round(cy + math.sin(a_) * (i - L / 2) * .6)), i))
    for y in range(16):
        for x in range(16):
            v = m[y, x]; sd = lab[y, x]
            if v < -2.0: continue
            if v < 0:                                                   # 젖은 띠(바닥이 비침) + 튄 방울
                if v > -1.0 and H_(x // 2 + n * 8, y // 2, s + 1) > .35: rgb[y, x] = O_[1]; al[y, x] = 110
                elif H_(x + n * 16, y, s + 1) > .93: rgb[y, x] = O_[1]; al[y, x] = 200
                continue
            if v < 1.0: c = O_[1]; a = 235                               # 고인 어두운 테
            elif v < 1.8: c = O_[5] if sd in ('S', 'W') else O_[3]; a = 220     # 남·서 빛 테 / 북·동
            else:
                c = O_[3] if OIL_W[y, x] > .6 else O_[2]; a = 165            # 얇은 막(반투명)
            rgb[y, x] = c; al[y, x] = a
    for (x, y, i) in arc:
        if 0 <= x < 16 and 0 <= y < 16 and m[y, x] > 2.0: rgb[y, x] = SH_[min(4, i * 5 // 7)]; al[y, x] = 230
    return _cell(rgb, al)


def oil_sheet(): return sheet_from_cells([oil_cell(n) for n in range(16)])


# ================================================================ 2. 증기 고인 물(막힘)
PP = dict(inset=3.2, jag=2.0, rad=7.0, seed=2321)
def _pm(n): return edge_taper(n, PP['inset'], PP['jag'], PP['rad'], PP['seed'], foot=2.4, ramp=3.0)
STEAMW = tnoise(16, 16, 8, 2327)
def puddle_cell(n):
    m = _pm(n); lab = nearest(n, _pm); s = PP['seed']
    rgb = np.zeros((16, 16, 3), int); al = np.zeros((16, 16), int)
    for y in range(16):
        for x in range(16):
            v = m[y, x]; sd = lab[y, x]
            if v < -2.0: continue
            if v < 0:                                                   # 젖은 얼룩(바닥이 비치는 반투명 어둠)
                if H_(x // 2 + n * 8, y // 2, s + 1) > 0.5 - v * 0.15: rgb[y, x] = S_[1]; al[y, x] = 90
                continue
            c = None; a = 255
            if v < 1.0: c = S_[1]; a = 150                               # 젖은 테
            elif sd == 'N':                                              # 북쪽 둑(3/4): 자갈 앞모 2단 + 물에 진 그늘
                if v < 1.8: c = S_[3] if H_(x, y, s + 2) > .3 else S_[2]
                elif v < 2.6: c = S_[1]
                elif v < 3.6: c = C_[1]
            else:
                if v < 1.9: c = C_[5] if sd in ('S', 'W') else C_[3]      # 남·서 물가 빛 테
            if c is None:                                               # 속: 김 서린 회청 물 + 잔물결 + 흰 김 줄(16 주기)
                c = C_[3]
                r = STEAMW[y, x]
                if r > .62: c = C_[4]
                u = (y + int(round(math.sin(2 * math.pi * x / 16) * 1.3))) % 8
                if u == 5 and H_(x // 3, y, s + 3) > .45: c = C_[5]
                elif u == 1 and r < .4: c = C_[2]
                w = (y * 2 + int(round(math.sin(2 * math.pi * x / 16 + .6) * 2.5))) % 16    # 김 줄(물 위에 떠 있는 흰 김)
                if w in (3, 4) and (y // 8) % 2 == 0 and H_(x // 3, y // 2, s + 9) > .5: c = (200, 206, 210) if w == 3 else (166, 174, 182); a = 235
            rgb[y, x] = c; al[y, x] = a
    return _cell(rgb, al)


def puddle_sheet(): return sheet_from_cells([puddle_cell(n) for n in range(16)])


# ================================================================ 3. 석탄 가루 덩이(걷기)
CP = dict(inset=2.2, jag=3.2, rad=7.0, seed=2331)
CG = tnoise(16, 16, 8, 2334)
LUMPS = ((2, 3), (10, 1), (6, 9), (12, 11))
def _cm(n): return edge_taper(n, CP['inset'], CP['jag'], CP['rad'], CP['seed'], foot=.8, ramp=4.0)
def coal_cell(n):
    m = _cm(n); lab = nearest(n, _cm); s = CP['seed']
    rgb = np.zeros((16, 16, 3), int); al = np.zeros((16, 16), int)
    for y in range(16):
        for x in range(16):
            v = m[y, x]; sd = lab[y, x]
            if v < -2.4: continue
            if v < 0:                                                   # 흩어진 알갱이
                h = H_(x + n * 16, y, s + 1)
                if h > 0.84 + (-v) * 0.04: rgb[y, x] = K_[2] if h < .95 else K_[4]; al[y, x] = 255
                continue
            h = H_(x, y, s + 2); g = CG[y, x]
            c = K_[3] if g > .58 else K_[2]
            if h > .93: c = K_[5]
            if v < 1.5:                                                 # 성긴 가장자리(자갈이 비친다)
                if H_(x, y + n * 16, s + 4) < .32 + (1.5 - v) * .25: continue
                c = K_[1] if sd == 'S' else (K_[4] if sd in ('N', 'W') and h > .55 else K_[3])
            elif v < 2.3 and sd == 'S': c = K_[1]
            if v >= 2.4:                                                # 석탄 덩이(3x2, 윗왼 빛) — 칸 안 고정 자리 넷(16 주기, 줄로 안 보이게 흩음)
                for (bx, by) in LUMPS:
                    lx, ly = x - bx, y - by
                    if (lx, ly) in ((0, 0), (1, 0), (2, 0), (0, 1), (1, 1), (2, 1)):
                        c = K_[6] if (lx, ly) == (0, 0) else (K_[5] if ly == 0 else K_[4])
                    elif (lx, ly) in ((1, 2), (2, 2), (3, 1)): c = K_[0]
            rgb[y, x] = c; al[y, x] = 255
    return _cell(rgb, al)


def coal_sheet(): return sheet_from_cells([coal_cell(n) for n in range(16)])


# ================================================================ 4. 무쇠 난간(막힘, fence)
def _composed(draw):
    cells = []
    for n in range(16):
        tc = TC(32, 32, n); draw(tc, n)
        cells.append(tc.fin(.6).crop((8, 8, 24, 24)))
    return sheet_from_cells(cells)


def railing_cell(tc, n):
    """검은 무쇠 난간: 동서 = 앞에서 본 창살(3px 간격 살 + 창끝 + 가로대 둘, 아래 가로대에 고리 장식),
    남북 = 위에서 본 가로대(살 머리 점). 기둥 = 굵은 무쇠 + 놋쇠 공 머리 + 회색 석재 받침."""
    o = 8
    hasN, hasE, hasS, hasW = bool(n & 1), bool(n & 2), bool(n & 4), bool(n & 8)
    for (on, x0, x1) in ((hasW, 0, o + 6), (hasE, o + 10, 32)):
        if not on: continue
        for x in range(x0, x1):
            tc.px(x, o + 6, 'steel', 3); tc.px(x, o + 7, 'steel', 1)
            tc.px(x, o + 12, 'steel', 3); tc.px(x, o + 13, 'steel', 0)
            if x % 3 == 1:
                for y in range(o + 3, o + 15): tc.px(x, y, 'steel', 3 if y < o + 12 else 2)
                tc.px(x, o + 2, 'steel', 4); tc.px(x - 1, o + 3, 'steel', 3); tc.px(x + 1, o + 3, 'steel', 2)
            if x % 6 == 4: tc.px(x, o + 10, 'steel', 3); tc.px(x - 1, o + 11, 'steel', 2); tc.px(x + 1, o + 11, 'steel', 2)
    for (on, y0, y1) in ((hasN, 0, o + 6), (hasS, o + 10, 32)):
        if not on: continue
        for y in range(y0, y1):
            tc.px(o + 6, y, 'steel', 4); tc.px(o + 7, y, 'steel', 3); tc.px(o + 8, y, 'steel', 1)
            if y % 3 == 0: tc.px(o + 7, y, 'steel', 5); tc.px(o + 7, y + 1, 'steel', 0)
    for y in range(o + 2, o + 15):
        tc.px(o + 5, y, 'steel', 4); tc.px(o + 6, y, 'steel', 3); tc.px(o + 7, y, 'steel', 2); tc.px(o + 8, y, 'steel', 1)
    tc.ell(o + 6.5, o + 1.5, 2.0, 2.0, 'brass', lambda x, y: 6 if (x < o + 6 and y < o + 1) else (4 if x < o + 7 else 2))
    for x in range(o + 4, o + 10): tc.px(x, o + 15, 'gst', 4 if x < o + 8 else 2)


def railing_sheet(): return _composed(railing_cell)


SHEETS = {'autotile-oil-slick': oil_sheet, 'autotile-steam-puddle': puddle_sheet, 'autotile-coal-dust': coal_sheet,
          'autotile-iron-railing': railing_sheet}
PASSABLE = {'autotile-oil-slick': True, 'autotile-steam-puddle': False, 'autotile-coal-dust': True, 'autotile-iron-railing': False}


# ================================================================ 시험 그림(check-autotile.png)
def bg_cob(w, h):
    Y, X = np.mgrid[0:h, 0:w]; return Image.fromarray(SG.SO[SG.cob_k(X, Y, 5)].astype(np.uint8), 'RGB').convert('RGBA')
def bg_walk(w, h):
    Y, X = np.mgrid[0:h, 0:w]; return Image.fromarray(SG.BK[SG.walk_k(X, Y, 7)].astype(np.uint8), 'RGB').convert('RGBA')
def bg_cinder(w, h):
    Y, X = np.mgrid[0:h, 0:w]; return Image.fromarray(SG.SO[SG.cinder_k(X, Y, 9)].astype(np.uint8), 'RGB').convert('RGBA')
def bg_plaza(w, h):
    Y, X = np.mgrid[0:h, 0:w]; return Image.fromarray(SG.GS[SG.plaza_k(X, Y, 3)].astype(np.uint8), 'RGB').convert('RGBA')


def check_sheet(path, scale=3):
    rows = [('autotile-oil-slick (walk) on wet cobble', oil_sheet(), bg_cob),
            ('autotile-oil-slick (walk) on iron-plate yard', oil_sheet(), lambda w, h: Image.fromarray(SG.plate_rgb(w, h, 11).astype(np.uint8), 'RGB').convert('RGBA')),
            ('autotile-steam-puddle (blocked) on wet cobble', puddle_sheet(), bg_cob),
            ('autotile-steam-puddle (blocked) on plaza flags', puddle_sheet(), bg_plaza),
            ('autotile-coal-dust (walk) on cinder yard', coal_sheet(), bg_cinder),
            ('autotile-coal-dust (walk) on wet cobble', coal_sheet(), bg_cob),
            ('autotile-iron-railing (fence, blocked) on brick walk', railing_sheet(), bg_walk)]
    blocks = []
    for (title, sh, bgf) in rows:
        raw = Image.new('RGBA', (76, 76), (40, 40, 46, 255)); raw.alpha_composite(bgf(64, 64), (6, 6)); raw.alpha_composite(sh, (6, 6))
        d = ImageDraw.Draw(raw)
        for k in range(1, 4):
            d.line([(6 + k * 16, 6), (6 + k * 16, 69)], fill=(255, 0, 255, 60)); d.line([(6, 6 + k * 16), (69, 6 + k * 16)], fill=(255, 0, 255, 60))
        blocks.append((title, [raw] + [stamp(sh, SHAPES[k], bgf) for k in ('blob5', 'spiral', 'nose_L')]))
    hgt = max(max(i.height for i in ims) for _, ims in blocks)
    W = max(sum(i.width for i in ims) + 10 * len(ims) for _, ims in blocks)
    o = Image.new('RGBA', (W * scale + 10, len(blocks) * (hgt * scale + 24) + 6), (24, 24, 28, 255)); d = ImageDraw.Draw(o)
    for r, (title, ims) in enumerate(blocks):
        y = 6 + r * (hgt * scale + 24); d.text((8, y), title + '   [16 variants | 5x5 blob | spiral | L + nose]', fill=(235, 235, 235, 255))
        x = 6
        for im in ims:
            o.alpha_composite(im.resize((im.width * scale, im.height * scale), Image.NEAREST), (x, y + 16)); x += im.width * scale + 10 * scale
    o.convert('RGB').save(path)


if __name__ == '__main__':
    import sys
    check_sheet(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'check-autotile.png'))
