import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from s3k import C
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
def out(slug, X): return ROOT + '/%s/s3-%s.pxg' % (slug, X)
M = lambda s: ('mmetal', s); G = lambda s: ('mdglass', s); CR = lambda s: ('cream', s)

def tv(c, x, y, w, h, fr_hi, fr, fr_lo, scr, scr_hi, refl, refl2=None, thick=1):
    c.rect(x, y, w, h, fr)
    c.hl(x, y, w, fr_hi); c.vl(x, y, h, fr_hi)
    c.hl(x, y + h - 1, w, fr_lo); c.vl(x + w - 1, y, h, fr_lo)
    c.px(x, y, '.'); c.px(x + w - 1, y, '.'); c.px(x, y + h - 1, '.'); c.px(x + w - 1, y + h - 1, '.')
    sx, sy, sw, sh = x + thick + 1, y + thick + 1, w - 2 * thick - 2, h - 2 * thick - 2
    c.rect(sx, sy, sw, sh, scr)
    c.hl(sx, sy, sw, scr_hi)
    # 사선 반사: 오른쪽 위 -> 왼쪽 아래
    for i in range(sh - 1):
        px, py = sx + sw - 4 - i, sy + 1 + i
        if px >= sx: c.px(px, py, refl)
        if refl2 and px - 1 >= sx and i % 1 == 0: c.px(px - 1, py, refl2) if i > 1 else None
    c.px(x + w // 2, y + h - 1, ('vblue', 5)) if False else None

def speaker(c, x, y, w, h, body, hi, lo, hole, rim):
    c.rect(x, y, w, h, body)
    c.hl(x, y, w, hi); c.vl(x, y, h, hi)
    c.hl(x, y + h - 1, w, lo); c.vl(x + w - 1, y, h, lo)
    c.px(x, y, '.'); c.px(x + w - 1, y, '.')
    for j in range(2, h - 2, 2):
        for i in range(2, w - 2, 2):
            c.px(x + i, y + j, hole)
    c.hl(x + 1, y + 1, w - 2, rim) if False else None

# A
c = C(32, 16)
tv(c, 1, 2, 22, 12, M(6), M(5), M(3), G(1), G(3), G(6))
c.px(11, 13, ('vred', 4))    # 전원 표시등 아랫테
speaker(c, 25, 4, 6, 8, CR(4), CR(5), CR(2), CR(1), None)
c.save(out('class_speaker', 'A'), 'v5 결: 은색 테 벽걸이 TV(짙은 남색 화면·오른쪽 위에서 왼쪽 아래로 창 빛 사선 한 줄) 옆에 크림색 방송 스피커(격자 구멍)')
# B
c = C(32, 16)
tv(c, 1, 2, 22, 12, M(7), M(4), M(1), G(0), G(2), G(7), refl2=G(5))
c.hl(2, 13, 20, M(0)) if False else None
c.px(11, 13, ('vred', 5))
speaker(c, 25, 3, 6, 10, CR(3), CR(5), CR(0), CR(0), None)
c.hl(26, 4, 4, CR(1))
c.save(out('class_speaker', 'B'), '센 명암: 밝은 은테 하이라이트와 아주 짙은 화면, 두 줄 굵은 반사 사선, 어두운 크림 스피커에 깊은 구멍, 빨간 전원 점')
# C
c = C(32, 16)
# 왼쪽: 나팔형 스피커 (윗면 넓고 아래 좁은 원뿔) + 벽 브래킷
for j in range(9):
    w = 3 + j // 2 * 1
    x0 = 5 - w // 2
for j, (xs, xe) in enumerate([(3, 8), (2, 9), (2, 9), (1, 10), (1, 10), (0, 11)]):
    y = 4 + j
    c.hl(xs, y, xe - xs + 1, CR(4))
    c.px(xs, y, CR(5)); c.px(xe, y, CR(2))
for j in range(6):
    xs = [3, 2, 2, 1, 1, 0][j]; xe = [8, 9, 9, 10, 10, 11][j]
    if j % 2 == 1:
        for i in range(xs + 2, xe - 1, 2): c.px(i, 4 + j, CR(1))
c.hl(0, 10, 12, CR(2)); c.hl(1, 11, 10, CR(1)); c.hl(3, 12, 6, CR(0))
c.vl(5, 2, 2, M(3)); c.vl(6, 2, 2, M(5))
# 오른쪽: TV, 팔 브래킷
tv(c, 14, 1, 17, 12, M(6), M(4), M(2), G(1), G(3), G(6))
c.vl(21, 13, 2, M(3)); c.vl(22, 13, 2, M(5)); c.hl(19, 15, 6, M(2))
c.save(out('class_speaker', 'C'), '실루엣 다르게: 왼쪽에 나팔형 방송 스피커(벽 받침대), 오른쪽에 팔 받침으로 세운 작은 TV')
