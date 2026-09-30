#!/usr/bin/env python3
"""kit_torii 후보 k8-A/B/C 부품 시트. 단을 손으로 놓는 사각형·열·도안뿐(보간·잡음 없음).
  python3 tiledata/atlas-pick/candidates-jp/kit_torii/work/k8_torii.py   # → ../k8-A.pxg k8-B.pxg k8-C.pxg
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); KIT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(HERE, '..', '..', '..', '..', '..', 'scripts', 'content', 'atlas-pick'))
from pxg_emit import emit

info = json.load(open(os.path.join(KIT, 'info.json'), encoding='utf-8'))
W, H = info['canvas']; AT = {p['slug']: (p['at'][0] * 16, p['at'][1] * 16) for p in info['parts']}

class P:
    def __init__(s, G, slug): s.G, s.ox, s.oy = G, *AT[slug]
    def px(s, x, y, k):
        if 0 <= x < 16 and 0 <= y < 16: s.G[s.oy + y][s.ox + x] = k
    def rect(s, x, y, w, h, k):
        for j in range(y, y + h):
            for i in range(x, x + w): s.px(i, j, k)
    def art(s, x, y, rows, leg):
        for j, r in enumerate(rows):
            for i, c in enumerate(r):
                if c != '.': s.px(x + i, y + j, leg[c])

L = lambda t: ('lacq', t)
S = lambda t: ('shu', t)

# 大 (8x7) — 가운데 세로 2px, 가로 한 줄, 갈래 1px. 편액 글자(실제 한자)
DAI = ['...##...', '########', '...##...', '..#..#..', '.#....#.', '.#....#.', '#......#']

# ── 방향 정의 ───────────────────────────────────────────────
def spec(d):
    if d == 'A':   # 강남 결: 표준 묘진형, 중간 대비, 오른·아래 테가 한 단 어둡게
        return dict(
            base=3, cap=[4, 3, 3, 2, 1], band=[1, 4, 3, 3, 2], shim=[0, 3, 2],
            rise=[2, 2, 2, 1, 1, 1, 0, 0], shim_from=9, end_l=(2, 2), end_r=(0, 0),
            pil={5: 2, 6: 5, 7: 4, 8: 3, 9: 2, 10: 1},
            nuki=[5, 3, 3, 1], nuki_y=0, tip_l=12, tip_r=3, nuki_end_l=2, nuki_end_r=0)
    if d == 'B':   # 명암 강화: 윗면 두 줄 밝게, 아랫면·오른쪽 확 어둡게, 굵은 기둥, 접지 그림자
        return dict(
            base=4, cap=[5, 4, 3, 2, 1, 0], band=[0, 5, 4, 4, 3, 2], shim=[0, 4, 2],
            rise=[3, 3, 3, 2, 2, 1, 1, 0], shim_from=9, end_l=(2, 2), end_r=(0, 0),
            pil={4: 2, 5: 5, 6: 5, 7: 4, 8: 3, 9: 3, 10: 2, 11: 0},
            nuki=[6, 4, 3, 2, 0], nuki_y=0, tip_l=11, tip_r=4, nuki_end_l=2, nuki_end_r=0)
    # C: 신메이형 — 곧은 가사기(휨 없음), 얇은 검은 캡 + 두꺼운 주홍 몸, 시마키 없음, 누키는 기둥 안쪽에 짧게
    return dict(
        base=4, cap=[4, 2, 1], band=[0, 5, 4, 4, 3, 3, 2, 2, 1], shim=[],
        rise=[0] * 8, shim_from=99, end_l=(2, 2), end_r=(0, 0),
        pil={4: 1, 5: 4, 6: 4, 7: 3, 8: 3, 9: 2, 10: 1},
        nuki=[5, 3, 1], nuki_y=0, tip_l=13, tip_r=2, nuki_end_l=2, nuki_end_r=0)

def draw(d):
    G = [[None] * W for _ in range(H)]
    sp = spec(d)
    pil = sp['pil']; px0, px1 = min(pil), max(pil)

    # ── 가사기 ──
    def kas(p, side):
        for x in range(16):
            r = 0
            if side == 'l': r = sp['rise'][x] if x < 8 else 0
            if side == 'r': r = sp['rise'][15 - x] if x >= 8 else 0
            y = sp['base'] - r
            end = (side == 'l' and x == 0) or (side == 'r' and x == 15)
            for t in sp['cap']:
                tone = (sp['end_l'][0] if side == 'l' else sp['end_r'][0]) if end else t
                p.px(x, y, L(tone)); y += 1
            for t in sp['band']:
                tone = (sp['end_l'][1] if side == 'l' else sp['end_r'][1]) if end else t
                p.px(x, y, S(tone)); y += 1
            # 시마키(아래 덧단): 시트 아래 끝 y13~15. 끝 부품은 안쪽 반만
            sh = sp['shim']
            if sh:
                on = (side == 'm') or (side == 'l' and x >= sp['shim_from']) or (side == 'r' and x <= 15 - sp['shim_from'])
                if on:
                    yy = 13
                    for t in sh:
                        edge = (side == 'l' and x == sp['shim_from']) or (side == 'r' and x == 15 - sp['shim_from'])
                        p.px(x, yy, S(1 if edge and side == 'l' else (0 if edge else t))); yy += 1
    for side, slug in (('l', 'kasagi_l'), ('m', 'kasagi_m'), ('r', 'kasagi_r')):
        kas(P(G, slug), side)

    # ── 기둥 (열마다 한 단) ──
    def pillar(p, y0=0, y1=15):
        for x, t in pil.items(): p.rect(x, y0, 1, y1 - y0 + 1, S(t))
    pillar(P(G, 'hashira'))

    # ── 누키 ──
    ny, nk = sp['nuki_y'], sp['nuki']
    def beam(p, x0, x1, endl=None, endr=None):
        for x in range(x0, x1 + 1):
            for j, t in enumerate(nk):
                tone = t
                if x == x0 and endl is not None: tone = endl
                if x == x1 and endr is not None: tone = endr
                p.px(x, ny + j, S(tone))
    beam(P(G, 'nuki_m'), 0, 15)
    beam(P(G, 'nuki_l'), sp['tip_l'], 15, endl=sp['nuki_end_l'])
    beam(P(G, 'nuki_r'), 0, sp['tip_r'], endr=sp['nuki_end_r'])
    p = P(G, 'nuki_p'); beam(p, 0, 15); pillar(p)

    # ── 편액 ──
    p = P(G, 'gaku')
    if d == 'C':
        p.rect(7, 0, 2, 4, S(2)); p.px(7, 0, S(4)); p.rect(8, 0, 1, 4, S(1))   # 가는 걸이 기둥
        p.rect(2, 4, 12, 12, ('hinoki', 3))
        p.rect(2, 4, 12, 1, ('hinoki', 4)); p.rect(2, 4, 1, 12, ('hinoki', 4))
        p.rect(2, 15, 12, 1, ('hinoki', 1)); p.rect(13, 4, 1, 12, ('hinoki', 1))
        p.rect(3, 5, 10, 10, L(2)); p.rect(3, 5, 10, 1, L(1)); p.rect(3, 5, 1, 10, L(1))
        p.art(4, 7, DAI, {'#': ('washi', 5)})
    else:
        deep = (d == 'B')
        p.rect(7, 0, 2, 5, S(3)); p.rect(8, 0, 1, 5, S(1)); p.px(7, 0, S(5 if deep else 4))
        p.rect(3, 5, 10, 11, L(3)); p.rect(3, 5, 10, 1, L(4)); p.rect(3, 5, 1, 11, L(4))
        p.rect(3, 15, 10, 1, L(0 if deep else 1)); p.rect(12, 5, 1, 11, L(0 if deep else 1))
        p.rect(4, 6, 8, 9, ('washi', 4))
        p.rect(4, 6, 1, 9, ('washi', 5)); p.rect(11, 6, 1, 9, ('washi', 3)); p.rect(4, 14, 8, 1, ('washi', 3))
        p.art(4, 7, DAI, {'#': ('sumi', 0 if deep else 1)})
        if deep:
            p.rect(13, 7, 1, 9, '-')          # 오른쪽으로 번지는 그림자
    # ── 기둥 밑동 ──
    p = P(G, 'hashira_base')
    pillar(p, 0, 8)
    for x in pil: p.px(x, 8, S(max(0, pil[x] - 1)))     # 받침 바로 위 한 단 어둡게
    if d == 'C':   # 돌 초석
        p.rect(2, 9, 11, 1, ('ishi', 5)); p.rect(2, 10, 11, 4, ('ishi', 4)); p.rect(2, 10, 1, 4, ('ishi', 5))
        p.rect(12, 10, 1, 4, ('ishi', 2)); p.rect(2, 13, 11, 1, ('ishi', 2)); p.rect(3, 12, 3, 1, ('ishi', 3)); p.px(9, 11, ('ishi', 5))
        p.px(2, 9, ('ishi', 3)); p.px(12, 9, ('ishi', 2))
        p.rect(4, 14, 11, 1, '~'); p.rect(6, 15, 10, 1, '-')
    elif d == 'B':   # 가메바라 크게 + 그림자 세 줄
        p.rect(4, 9, 8, 1, L(5)); p.rect(3, 10, 10, 1, L(4))
        p.rect(2, 11, 12, 2, L(3)); p.rect(2, 11, 1, 2, L(4)); p.rect(13, 11, 1, 2, L(0))
        p.rect(2, 13, 12, 1, L(1)); p.rect(13, 13, 1, 1, L(0)); p.rect(3, 10, 1, 1, L(5)); p.rect(12, 10, 1, 1, L(2))
        p.rect(4, 14, 12, 1, '~'); p.rect(5, 15, 11, 1, '~')
    else:
        p.rect(4, 9, 8, 1, L(5)); p.rect(3, 10, 10, 3, L(3)); p.rect(3, 10, 1, 3, L(4)); p.rect(12, 10, 1, 3, L(1))
        p.rect(3, 13, 10, 1, L(1)); p.px(3, 10, L(5)); p.px(12, 10, L(2))
        p.rect(4, 14, 11, 1, '~'); p.rect(6, 15, 10, 1, '-')

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
    out = os.path.join(KIT, f'k8-{d}.pxg')
    open(out, 'w', encoding='utf-8').write(emit(rows, legend, title=f'kit_torii k8-{d}'))
    print(out, len(legend), '색')

for d in 'ABC': draw(d)
