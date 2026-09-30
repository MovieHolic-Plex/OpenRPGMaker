import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from hf4_lib import *
MATS = {'m': 'mahog', 'r': 'vred', 'b': 'vblue', 'g': 'vgreen', 't': 'tarn', 's': 'sheet'}
FAM = {'r': 'abcde', 'b': 'fghij', 'g': 'klmno'}       # 글자 = (재료, 단 0~4)
def legend():
    lg = mahog_legend()
    for f, cs in FAM.items():
        for t, ch in enumerate(cs): lg[ch] = (f, t)
    lg['T'] = ('t', 3); lg['U'] = ('t', 2); lg['S'] = ('s', 2)
    return lg
def bc(fam, t): return FAM[fam][max(0, min(4, t))]

def book(c, x, yb, w, h, fam, t, gap_top_lit=True, band=None):
    """x 부터 폭 w, 밑줄 yb, 높이 h 인 책 한 권. 왼쪽 밝게 오른쪽 어둡게, 윗줄 한 단 밝게."""
    top = yb - h + 1
    for dx in range(w):
        tone = t + (1 if dx == 0 and w > 1 else (-1 if dx == w - 1 and w > 1 else 0))
        for y in range(top, yb + 1): c.px(x + dx, y, bc(fam, tone))
    if gap_top_lit:
        for dx in range(w): c.px(x + dx, top, bc(fam, t + 1))
    if band and h >= 5 and w >= 2:
        for dx in range(w): c.px(x + dx, top + band, 'T')

def shelf(c, ytop, ybot, specs, back):
    """칸 안쪽(x3~12) 을 back 으로 채우고 책을 왼쪽부터 깐다. spec (w,h,fam,t) 또는 (w,) = 빈 자리."""
    c.rect(3, ytop, 12, ybot, back)
    x = 3
    for s in specs:
        if len(s) == 1: x += s[0]; continue
        w, h, fam, t = s[:4]; band = s[4] if len(s) > 4 else None
        book(c, x, ybot, w, h, fam, t, band=band); x += w
    assert x == 13, x

def frame(c, crown, board_rows, plinth):
    pass

def base_body(c, post_l, post_r, wood_hi):
    # x0/x15 윤곽 1, 왼쪽 기둥 x1~2, 오른쪽 기둥 x13~14
    for y in range(4, 29):
        c.px(0, y, '1'); c.px(15, y, '1')
        c.px(1, y, post_l[0]); c.px(2, y, post_l[1])
        c.px(13, y, post_r[0]); c.px(14, y, post_r[1])

def boards(c, ys, top_t, front_t, under_t):
    """선반 널 두 줄(윗면 1px + 앞면 1px)을 x3~12 에 깔고, 그 밑 한 줄을 그림자로."""
    for y in ys:
        c.hline(y, 3, 12, top_t); c.hline(y + 1, 3, 12, front_t)

def A():
    c = Cv(16, 32, legend(), MATS)
    c.hline(0, 1, 14, '1')
    c.row(1, 0, '1' + '6' * 14 + '1'); c.row(2, 0, '1' + '5' * 14 + '1'); c.row(3, 0, '1' + '3' * 14 + '1')
    base_body(c, ('5', '4'), ('3', '2'), '5')
    boards(c, (11, 20), '6', '3', '1')
    shelf(c, 4, 10, [(2, 6, 'r', 3), (1, 5, 'b', 2), (2, 6, 'g', 2), (1, 4, 'r', 2), (2, 5, 'b', 3), (2, 6, 'r', 2)], '1')
    shelf(c, 13, 19, [(1, 5, 'g', 2), (2, 6, 'b', 2), (2, 5, 'r', 3), (2,), (2, 6, 'g', 3), (1, 4, 'b', 2)], '1')
    shelf(c, 22, 27, [(2, 5, 'r', 1), (2, 4, 'g', 1), (1, 5, 'b', 1), (2, 5, 'r', 2), (1, 4, 'g', 1), (2, 5, 'b', 1)], '1')
    c.row(28, 0, '1' + '5' * 14 + '1')                         # 밑널 윗면
    c.row(29, 0, '1' + '4' * 14 + '1'); c.row(30, 1, '1' + '2' * 12 + '1'); c.row(31, 2, '1' * 12)
    c.emit('bookshelf_manor', 'A', 'A: v5 계열 깨끗하게 — 마호가니 틀(왼쪽 기둥 밝음), 널 세 단에 책 6권씩 세 색을 탁하게(3·2단), 높이 4~6 섞음, 둘째 단 가운데 빈 자리, 아래 단은 한 단 더 탁하게(1·2단)')
    return c

def B():
    c = Cv(16, 32, legend(), MATS)
    c.hline(0, 1, 14, '1')
    c.row(1, 0, '1' + '6' * 14 + '1'); c.row(2, 0, '1' + '6' * 14 + '1'); c.row(3, 0, '1' + '2' * 14 + '1')
    base_body(c, ('6', '5'), ('4', '2'), '6')
    boards(c, (11, 20), '6', '3', '0')
    shelf(c, 4, 10, [(3, 6, 'r', 3), (2, 5, 'b', 3), (3, 6, 'g', 3), (2, 4, 'r', 3)], '0')
    shelf(c, 13, 19, [(2, 5, 'g', 3), (3, 6, 'b', 3), (3,), (2, 5, 'r', 3)], '0')
    shelf(c, 22, 27, [(3, 5, 'r', 2), (2, 4, 'g', 2), (3, 5, 'b', 2), (2, 4, 'r', 2)], '0')
    c.row(28, 0, '1' + '6' * 14 + '1')
    c.row(29, 0, '1' + '4' * 14 + '1'); c.row(30, 1, '1' + '2' * 12 + '1'); c.row(31, 2, '1' * 12)
    c.emit('bookshelf_manor', 'B', 'B: 어두운 방용 — 책 폭 2~3px 로 굵게 네 권씩, 책 3단(빨·파·초)이 뒤판 0단 검정 위에 뜸, 널 윗면·기둥 밝은 면 6단, 앞 두께 3 → 밑 0 으로 크게 벌림')
    return c

def C():
    c = Cv(16, 32, legend(), MATS)
    c.hline(0, 3, 12, '1')                                      # 계단식 갓돌
    c.row(1, 2, '1' + '5' * 10 + '1')
    c.row(2, 0, '1' + '6' * 14 + '1')
    c.row(3, 0, '1' + ''.join('32'[i % 2] for i in range(14)) + '1')   # 이빨 장식(치열)
    base_body(c, ('5', '4'), ('3', '2'), '5')
    for y in range(4, 29):                                       # 기둥 결 — 세로로 어두운 줄이 끊겨 흐름
        if y % 4 == 1: c.px(2, y, '3'); c.px(13, y, '1')
        if y % 5 == 2: c.px(1, y, '4')
    boards(c, (11, 20), '5', '3', '1')
    c.hline(12, 3, 12, '3')
    for x in (5, 8, 11): c.px(x, 12, '2')                       # 널 앞면 이음 점
    for x in (5, 8, 11): c.px(x, 21, '2')
    shelf(c, 4, 10, [(2, 6, 'r', 3, 1), (1, 5, 'b', 2), (2, 6, 'g', 2, 2), (1, 4, 'r', 2), (2, 5, 'b', 3, 1), (2, 6, 'r', 2, 2)], '2')
    shelf(c, 13, 19, [(1, 5, 'g', 2), (2, 6, 'b', 2, 1), (2, 5, 'r', 3, 1), (2,), (2, 6, 'g', 3, 2), (1, 4, 'b', 2)], '2')
    # 셋째 단: 왼쪽에 누운 책 더미(폭 5·4), 오른쪽은 선 책
    c.rect(3, 22, 12, 27, '2')
    c.rect(3, 26, 7, 27, 'b'); c.hline(26, 3, 7, 'i'); c.hline(27, 3, 7, 'h')
    c.rect(4, 24, 7, 25, 'k'); c.hline(24, 4, 7, 'm'); c.hline(25, 4, 7, 'k')
    for y in (26, 27): c.px(3, y, 'T' if y == 26 else 'U')       # 누운 책 배 쪽 금테
    c.px(4, 24, 'T')
    x = 8
    for (w, h, fam, t) in [(2, 5, 'r', 2), (1, 4, 'g', 2), (2, 5, 'r', 1)]:
        book(c, x, 27, w, h, fam, t, band=1); x += w
    assert x == 13
    c.row(28, 0, '1' + '5' * 14 + '1')
    for x in (4, 9, 12): c.px(x, 28, '6')
    c.row(29, 0, '1' + '4' * 6 + '3' + '4' * 7 + '1')
    c.row(30, 1, '1' + '2' * 12 + '1'); c.row(31, 2, '1' * 12)
    c.emit('bookshelf_manor', 'C', 'C: 마녀의 집 결 — 계단식 갓돌 + 이빨 장식, 기둥 결과 널 앞면 이음 점, 책등 금테(tarn) 띠, 셋째 단은 누운 책 더미 + 선 책, 뒤판 2단')
    return c

if __name__ == '__main__':
    for f in (A, B, C):
        c = f(); print(c.show()); print()
