#!/usr/bin/env python3
"""kit_shopfront 파일럿 판(pilot-A) — 감독자가 조립기·고르는 화면이 끝까지 도는지 증명하려고 거칠게 찍은 부품 한 벌.
고를 거리가 아니다(k2 는 이것보다 좋아야 한다). 단을 손으로 놓는 사각형·선·도안뿐(보간·잡음 없음).

  python3 tiledata/atlas-pick/candidates-jp/kit_shopfront/work/pilot_shopfront.py   # → ../pilot-A.pxg
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); KIT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(HERE, '..', '..', '..', '..', '..', 'scripts', 'content', 'atlas-pick'))
from pxg_emit import emit

info = json.load(open(os.path.join(KIT, 'info.json'), encoding='utf-8'))
W, H = info['canvas']; AT = {p['slug']: (p['at'][0] * 16, p['at'][1] * 16) for p in info['parts']}
G = [[None] * W for _ in range(H)]

class P:
    """부품 하나 안의 좌표(0,0 = 부품 좌상단)로 그린다."""
    def __init__(s, slug): s.ox, s.oy = AT[slug]
    def px(s, x, y, k):
        G[s.oy + y][s.ox + x] = k
    def rect(s, x, y, w, h, k):
        for j in range(y, y + h):
            for i in range(x, x + w): s.px(i, j, k)
    def art(s, x, y, rows, leg):
        for j, r in enumerate(rows):
            for i, c in enumerate(r):
                if c != '.': s.px(x + i, y + j, leg[c])

def k(r, t): return (r, t)

# ── 정면 공통: 띠 밑 그늘 두 줄 + 문턱 세 줄 ──
def front_frame(p):
    p.rect(0, 0, 16, 1, k('mconc', 1)); p.rect(0, 1, 16, 1, k('mconc', 2))
    p.rect(0, 29, 16, 1, k('mconc', 4)); p.rect(0, 30, 16, 1, k('mconc', 3)); p.rect(0, 31, 16, 1, k('mconc', 2))

def tile_wall(p, x0, x1):
    p.rect(x0, 2, x1 - x0, 27, k('mwhite', 2))
    for y in (9, 17, 25): p.rect(x0, y, x1 - x0, 1, k('mwhite', 1))

# 기둥
p = P('pil_l'); front_frame(p); tile_wall(p, 0, 16)
p.rect(0, 2, 1, 27, k('mwhite', 4)); p.rect(1, 2, 1, 27, k('mwhite', 3)); p.rect(14, 2, 1, 27, k('mwhite', 1)); p.rect(15, 2, 1, 27, k('mconc', 4))
p = P('pil_r'); front_frame(p); tile_wall(p, 0, 16)
p.rect(0, 2, 1, 27, k('mconc', 4)); p.rect(1, 2, 1, 27, k('mwhite', 3)); p.rect(14, 2, 1, 27, k('mwhite', 1)); p.rect(15, 2, 1, 27, k('mwhite', 0))

def glass_frame(p):
    p.rect(0, 2, 16, 1, k('mmetal', 5)); p.rect(0, 3, 1, 25, k('mmetal', 4)); p.rect(0, 27, 16, 2, k('mmetal', 3)); p.rect(0, 27, 16, 1, k('mmetal', 4))

p = P('win_glass'); front_frame(p); glass_frame(p)
p.rect(1, 3, 15, 24, k('mglass', 2)); p.rect(1, 3, 15, 2, k('mglass', 3))
for i in range(7): p.px(3 + i, 16 - i, k('mglass', 5)); p.px(4 + i, 16 - i, k('mglass', 4))
for i in range(4): p.px(9 + i, 22 - i, k('mglass', 4))

p = P('win_shelf'); front_frame(p); glass_frame(p)
p.rect(1, 3, 15, 24, k('mwhite', 3)); p.rect(1, 3, 15, 2, k('mglass', 6))
goods = ['kblue', 'akachin', 'kgreen', 'taxi', 'korange']
for n, y in enumerate((8, 15, 22)):
    p.rect(1, y + 2, 15, 1, k('mmetal', 3))
    for j, x in enumerate(range(2, 15, 3)):
        c = goods[(j + n) % len(goods)]; p.rect(x, y, 2, 2, k(c, 3)); p.px(x, y, k(c, 4))
p.rect(1, 25, 15, 2, k('mwhite', 1))

p = P('win_koshi'); front_frame(p)
p.rect(0, 2, 16, 1, k('sumi', 3)); p.rect(0, 3, 16, 24, k('washi', 3)); p.rect(0, 3, 16, 2, k('washi', 4))
for x in (0, 4, 8, 12): p.rect(x, 3, 1, 24, k('sumi', 2))
p.rect(0, 3, 1, 24, k('sumi', 4)); p.rect(0, 14, 16, 1, k('sumi', 2)); p.rect(0, 26, 16, 3, k('sumi', 1)); p.rect(0, 26, 16, 1, k('sumi', 3))

p = P('wall_plain'); front_frame(p); tile_wall(p, 0, 16)
for y0, off in ((2, 4), (10, 12), (18, 4), (26, 12)):
    p.rect(off, y0, 1, 7 if y0 < 26 else 3, k('mwhite', 1))

def auto_door(p, left):
    front_frame(p)
    p.rect(0, 2, 16, 3, k('mmetal', 3)); p.rect(0, 2, 16, 1, k('mmetal', 5)); p.px(7 if left else 8, 3, k('kgreen', 4))
    p.rect(0, 5, 16, 24, k('mglass', 5)); p.rect(0, 20, 16, 9, k('mglass', 4))
    if left:
        p.rect(0, 5, 1, 24, k('mmetal', 4)); p.rect(15, 5, 1, 24, k('lacq', 1)); p.rect(12, 13, 1, 6, k('mmetal', 6))
    else:
        p.rect(0, 5, 1, 24, k('lacq', 1)); p.rect(15, 5, 1, 24, k('mmetal', 2)); p.rect(3, 13, 1, 6, k('mmetal', 6))
    for i in range(5): p.px(3 + i + (0 if left else 5), 12 - i, k('mglass', 7))
p = P('door_auto_l'); auto_door(p, True)
p = P('door_auto_r'); auto_door(p, False)

def slide_door(p):
    front_frame(p)
    p.rect(0, 2, 16, 27, k('hinoki', 3)); p.rect(0, 2, 1, 27, k('hinoki', 5)); p.rect(15, 2, 1, 27, k('hinoki', 1))
    for (x, y) in ((2, 4), (9, 4), (2, 11), (9, 11)):
        p.rect(x, y, 5, 6, k('mglass', 4)); p.rect(x, y, 5, 1, k('mglass', 5))
    p.rect(1, 18, 14, 1, k('hinoki', 2)); p.rect(2, 20, 12, 8, k('hinoki', 2)); p.rect(2, 20, 12, 1, k('hinoki', 4)); p.rect(7, 2, 1, 27, k('hinoki', 2))
p = P('door_slide'); slide_door(p)
p = P('door_noren'); slide_door(p)
p.rect(0, 2, 16, 1, k('sumi', 2)); p.rect(1, 3, 14, 13, k('ai', 3)); p.rect(1, 3, 1, 13, k('ai', 4)); p.rect(14, 3, 1, 13, k('ai', 2))
for x in (5, 10): p.rect(x, 7, 1, 9, k('ai', 1))
p.rect(1, 15, 14, 1, k('ai', 2)); p.rect(7, 6, 2, 2, k('washi', 5))

p = P('shutter'); front_frame(p)
p.rect(0, 2, 16, 3, k('mmetal', 3)); p.rect(0, 2, 16, 1, k('mmetal', 5))
for y in range(5, 27):
    p.rect(0, y, 16, 1, k('mmetal', 5 if (y - 5) % 3 == 0 else 4 if (y - 5) % 3 == 1 else 3))
p.rect(0, 26, 16, 3, k('mmetal', 2)); p.rect(0, 26, 16, 1, k('mmetal', 4))

# ── 간판 띠 (16×16): 0 = 위층과 만나는 줄, 1 = 상자 윗테, 2~12 = 내용, 13 = 아랫테, 14~15 = 상자 밑면 그늘 ──
def band_frame(p):
    p.rect(0, 0, 16, 1, k('mconc', 2)); p.rect(0, 1, 16, 1, k('mwhite', 4)); p.rect(0, 13, 16, 1, k('mwhite', 1))
    p.rect(0, 14, 16, 1, k('mconc', 1)); p.rect(0, 15, 16, 1, k('mconc', 2))
def content(p, key): p.rect(0, 2, 16, 11, key)

p = P('band_l'); band_frame(p); content(p, k('mwhite', 3)); p.rect(0, 1, 2, 13, k('mwhite', 4)); p.rect(2, 2, 1, 11, k('mwhite', 2))
p = P('band_r'); band_frame(p); content(p, k('mwhite', 3)); p.rect(13, 2, 1, 11, k('mwhite', 2)); p.rect(14, 1, 1, 13, k('mwhite', 1)); p.rect(15, 1, 1, 13, k('mwhite', 0))
p = P('band_cvs'); band_frame(p); content(p, k('mwhite', 3))
for c, y in (('kgreen', 3), ('korange', 6), ('kblue', 9)):
    p.rect(0, y, 16, 3, k(c, 3)); p.rect(0, y, 16, 1, k(c, 4))
p = P('band_izakaya'); band_frame(p); content(p, k('sumi', 2))
p.rect(0, 1, 16, 2, k('kawara', 3)); p.rect(0, 1, 16, 1, k('kawara', 5))
for x in (0, 4, 8, 12): p.px(x, 2, k('kawara', 2))
for (x, y, w) in ((2, 6, 5), (9, 9, 4), (1, 11, 3), (11, 5, 3)): p.rect(x, y, w, 1, k('sumi', 3))
def ramen_bg(p, w):
    p.rect(0, 2, w, 11, k('akachin', 3)); p.rect(0, 3, w, 1, k('taxi', 3)); p.rect(0, 11, w, 1, k('taxi', 2)); p.rect(0, 2, w, 1, k('akachin', 4))
p = P('band_ramen'); band_frame(p); ramen_bg(p, 16)
p = P('band_plain'); band_frame(p); content(p, k('mwhite', 3)); p.rect(0, 2, 16, 1, k('mwhite', 4))

p = P('text_ramen')
for q in (0, 16):
    p.ox = AT['text_ramen'][0] + q; band_frame(p)
p.ox = AT['text_ramen'][0]; ramen_bg(p, 32)
GLY = {
 'ra': ['.####.', '......', '######', '....##', '...##.', '..##..', '##....', '......'],
 'bo': ['......', '......', '......', '######', '######', '......', '......', '......'],
 'me': ['....##', '....#.', '##.##.', '.###..', '..##..', '.####.', '##..##', '#.....'],
 'n':  ['##....', '.##..#', '....##', '....#.', '...##.', '..##..', '###...', '#.....'],
}
for i, g in enumerate(('ra', 'bo', 'me', 'n')):
    p.art(1 + i * 8, 4, GLY[g], {'#': k('taxi', 5)})

p = P('text_sake'); band_frame(p); content(p, k('sumi', 2))
p.art(3, 3, ['#..#######', '.#...#.#..', '....######', '#...#.#.#.', '.#..#.#.#.', '....##.##.', '..#.#...#.', '.#..######', '#...#....#'], {'#': k('washi', 5)})

# ── 차양 (over, 투명): 0~7 줄무늬, 8~9 물결 끝, 10 그늘 번짐 ──
def awning(p, x0, x1):
    for x in range(x0, x1):
        red = (x // 4) % 2 == 0
        for y in range(0, 8):
            t = 4 if y < 2 else 3 if y < 6 else 2
            p.px(x, y, k('akachin', t) if red else k('mwhite', min(t, 3)))
        if x % 4 in (1, 2): p.px(x, 8, k('akachin', 2) if red else k('mwhite', 1))
        p.px(x, 9 if x % 4 in (1, 2) else 8, '-')
    for x in range(x0, x1): p.px(x, 0, k('akachin', 2) if (x // 4) % 2 == 0 else k('mwhite', 2))
p = P('awn_m'); awning(p, 0, 16)
p = P('awn_l'); awning(p, 2, 16); p.rect(1, 1, 1, 8, k('akachin', 5)); p.rect(2, 1, 1, 8, k('akachin', 4))
p = P('awn_r'); awning(p, 0, 14); p.rect(14, 1, 1, 8, k('akachin', 1))

# ── 등롱 (over) ──
p = P('lantern')
p.px(7, 1, k('sumi', 1)); p.px(8, 1, k('sumi', 1)); p.rect(5, 2, 6, 1, k('lacq', 2))
for j, w in enumerate((6, 8, 8, 8, 8, 8, 8, 6)):
    x0 = 8 - w // 2; y = 3 + j
    p.rect(x0, y, w, 1, k('akachin', 3)); p.px(x0, y, k('akachin', 5)); p.px(x0 + 1, y, k('akachin', 4)); p.px(x0 + w - 1, y, k('akachin', 1))
p.rect(5, 6, 6, 1, k('akachin', 2)); p.rect(5, 9, 6, 1, k('akachin', 2)); p.rect(5, 11, 6, 1, k('lacq', 2))
for y in (5, 6, 7, 8): p.px(3, y, '%'); p.px(12, y, '%')

# ── 발깔개 (ground, 불투명: 보도 바탕까지) ──
p = P('entry_mat'); p.rect(0, 0, 16, 16, k('mpave', 4))
for y in (7, 15): p.rect(0, y, 16, 1, k('mpave', 3))
p.rect(1, 2, 14, 11, k('masph', 2)); p.rect(1, 2, 14, 1, k('masph', 4)); p.rect(1, 12, 14, 1, k('masph', 1))
for y in (5, 8): p.rect(2, y, 12, 1, k('masph', 1))

# ── 내보내기 ──
POOL = [c for c in 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@$^&*()[]{}<>?/=+:;,' if c not in '.~-%#']
legend, rev, rows = {}, {}, []
for r in G:
    line = ''
    for c in r:
        if c is None: line += '.'
        elif isinstance(c, str): line += c
        else:
            if c not in rev: ch = POOL[len(rev)]; rev[c] = ch; legend[ch] = c
            line += rev[c]
    rows.append(line)
out = os.path.join(KIT, 'pilot-A.pxg')
open(out, 'w', encoding='utf-8').write(emit(rows, legend, title='kit_shopfront pilot-A (감독자 파일럿 — 조립기·화면 증명용 거친 판)'))
print(out, len(legend), '색')
