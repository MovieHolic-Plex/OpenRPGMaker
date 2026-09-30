import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from j2_lib import Cv
OUT = 'candidates-jp'
def box(c, x, y, w, h, r, t, lit=1, top=1, dark=1, bot=1):
    """빛(왼쪽 위) 상자: 왼/위 밝게, 오른/아래 어둡게."""
    c.rect(x, y, w, h, f'{r}:{t}')
    if top: c.h_(x, y, w, f'{r}:{t+top}')
    if lit: c.v_(x, y, h, f'{r}:{t+lit}')
    if dark: c.v_(x + w - 1, y, h, f'{r}:{t-dark}')
    if bot: c.h_(x, y + h - 1, w, f'{r}:{t-bot}')
    if top and dark: c.px(x + w - 1, y, f'{r}:{t}')
def outline(c, ramp_dark, keys=None):
    c.edge(lambda r, i, j, dx, dy: ramp_dark.get(r, 0), keys=keys)
def save(c, slug, L, note, out=OUT):
    c.save(f'{out}/{slug}/j2-{L}.pxg', note=note)

# ───────── 붉은 등롱 16x16 (wall)
def lantern(kind):
    c = Cv(16, 16)
    if kind == 'A':
        c.v_(8, 0, 1, 'sumi:2')
        c.rect(4, 1, 8, 2, 'sumi:1'); c.h_(4, 1, 8, 'sumi:3')
        c.ell(8, 8, 5, 5.2, 'akachin:3'); 
        c.h_(5, 4, 6, 'akachin:1'); c.h_(5, 10, 6, 'akachin:1'); c.px(4, 7, 'akachin:1'); c.px(11, 7, 'akachin:1')
        c.rect(4, 13, 8, 2, 'sumi:1'); c.h_(4, 13, 8, 'sumi:2')
        c.v_(4, 5, 7, 'akachin:4'); c.v_(5, 5, 7, 'akachin:4'); c.v_(11, 5, 7, 'akachin:2'); c.v_(10, 5, 7, 'akachin:2')
        glyph(c, 5, 5, 'sumi:0')
        c.px(8, 15, 'sumi:3')
        outline(c, {'akachin': 1, 'sumi': 0}, keys=('akachin',))
        for y in range(4, 13): c.px(12, y, '~') if c.get(12, y) is None else None
    elif kind == 'B':
        c.rect(5, 0, 6, 1, 'sumi:2'); c.rect(4, 1, 8, 2, 'sumi:0'); c.h_(4, 1, 8, 'sumi:2')
        c.ell(8, 8, 5, 5.2, 'akachin:2')
        c.rect(4, 4, 8, 9, 'akachin:3'); c.rect(5, 4, 6, 9, 'akachin:4'); c.rect(5, 5, 6, 5, 'shu:5')      # 속 불빛
        c.v_(4, 5, 7, 'akachin:1'); c.v_(11, 5, 7, 'akachin:0'); c.v_(10, 6, 5, 'akachin:1')
        c.h_(5, 4, 6, 'akachin:1'); c.h_(5, 10, 6, 'akachin:1'); c.px(4, 7, 'akachin:0'); c.px(11, 7, 'akachin:0')
        c.rect(4, 13, 8, 2, 'sumi:0'); c.h_(4, 13, 8, 'sumi:1')
        c.px(8, 15, 'sumi:2')
        glyph(c, 5, 5, 'sumi:0')
        outline(c, {'akachin': 0}, keys=('akachin',))
        for y in range(5, 12):
            if c.get(3, y) is None: c.px(3, y, '%')
            if c.get(12, y) is None: c.px(12, y, '%')
        for y in range(6, 11):
            c.px(2, y, '-'); c.px(13, y, '-')
        for x in range(5, 12): c.px(x, 15, '~') if c.get(x, 15) is None else None
    else:  # C : 통통한 둥근 초롱 + 흰 테 + 술
        c.rect(5, 0, 6, 1, 'sumi:1'); c.rect(3, 1, 10, 2, 'sumi:0'); c.h_(3, 1, 10, 'sumi:2')
        c.ell(8, 7.5, 7, 5.4, 'akachin:3')
        c.rect(3, 3, 10, 1, 'washi:3'); c.rect(3, 12, 10, 1, 'washi:2')       # 위·아래 흰 테
        c.h_(3, 3, 10, 'washi:4'); c.h_(3, 12, 10, 'washi:1')
        c.v_(2, 5, 5, 'akachin:4'); c.v_(3, 4, 7, 'akachin:4'); c.v_(13, 5, 5, 'akachin:2'); c.v_(12, 4, 7, 'akachin:2')
        c.rect(4, 13, 8, 1, 'sumi:0')
        for y in (14, 15):
            for x in (6, 8, 10): c.px(x, y, 'akachin:4' if x == 6 else 'akachin:2')
        glyph(c, 5, 5, 'sumi:0', big=True)
        outline(c, {'akachin': 1}, keys=('akachin',))
        for y in range(5, 12): c.px(14, y, '~') if c.get(14, y) is None else None
    return c

def glyph(c, x, y, k, big=False):
    rows = ['x.xxxx', '.x.x.x', 'x.xxxx', '..x..x', 'x.xxxx'] if not big else ['x.xxxx', '.x.x.x', 'x.xxxx', '..x..x', 'x.xxxx', '..x..x']
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch == 'x': c.px(x + i, y + j, k)

if __name__ == '__main__':
    N = {'A': '강남 결: 짙은 옻 뚜껑·붉은 몸통에 가로 살대 세 줄, 왼쪽 한 단 밝게·오른쪽 한 단 어둡게, 검은 「酒」 한 자(1px 획), 오른쪽 옅은 벽 그늘.',
         'B': '속불빛 강조: 가운데 세로 띠를 밝게(akachin 5), 가장자리는 어둡게, 양옆에 % 불빛 번짐과 - 번짐, 아래 그늘.',
         'C': '실루엣 재해석: 위아래 흰 테를 두른 통통한 둥근 초롱 + 아래 술 세 가닥, 폭 14px 로 벽에서 크게 읽힘.'}
    for L in 'ABC': save(lantern(L), 'akachochin', L, N[L])
