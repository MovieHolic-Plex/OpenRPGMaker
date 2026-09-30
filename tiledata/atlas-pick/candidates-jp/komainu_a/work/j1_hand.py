# 고마이누: 영역 글자 격자(M 갈기, H 얼굴, B 몸, L 앞다리, T 꼬리, c 갈기 곱슬줄, e 눈, o 입속, f 송곳니, n 코, h 뿔)
# → 왼쪽 위 빛 규칙으로 단을 정한다(난수 없음). 음형은 별도 격자(거울 아님).
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../house_roof/work'))
from j1_lib import C
D = os.path.join(os.path.dirname(__file__), '..')

def base(c, strong):
    c.hl(0, 24, 16, 'ishi', 6 if strong else 5); c.hl(0, 25, 16, 'ishi', 4)
    c.rect(0, 26, 16, 5, 'ishi', 3)
    c.vl(0, 26, 5, 'ishi', 4); c.vl(1, 26, 5, 'ishi', 4)
    c.vl(14, 26, 5, 'ishi', 2); c.vl(15, 26, 5, 'ishi', 1)
    c.hl(0, 26, 16, 'ishi', 2)
    if strong: c.hl(0, 27, 16, 'ishi', 2); c.hl(2, 30, 12, 'ishi', 2)
    c.hl(0, 31, 16, 'ishi', 1)
    for (x, y, t) in ((2, 30, 2), (3, 30, 3), (4, 30, 2), (3, 29, 2), (11, 30, 2), (12, 30, 1), (12, 29, 2)):
        c.px(x, y, 'moss', t)

def shade(c, rows, strong=False, body=3):
    H = len(rows); Wd = 16
    def g(x, y):
        return rows[y][x] if 0 <= x < Wd and 0 <= y < H else '.'
    solid = lambda ch: ch != '.'
    for y in range(H):
        for x in range(Wd):
            ch = rows[y][x]
            if ch == '.': continue
            if ch == 'e': c.px(x, y, 'ishi', 0); continue
            if ch == 'o': c.px(x, y, 'ishi', 0); continue
            if ch == 'f': c.px(x, y, 'ishi', 6); continue
            if ch == 'n': c.px(x, y, 'ishi', 0); continue
            if ch == 'c': c.px(x, y, 'ishi', 1); continue
            if ch == 'd': c.px(x, y, 'ishi', 1); continue
            if ch == 'h': c.px(x, y, 'ishi', 5); continue
            t = body
            up, lf, dn, rt = g(x, y - 1), g(x - 1, y), g(x, y + 1), g(x + 1, y)
            hi = 3 if strong else 2
            if not solid(up): t = 2 + 0                    # 윗 가장자리 선(같은 재질 어둡게)
            if not solid(lf): t = 2
            if solid(up) and g(x, y - 2) == '.' and solid(lf): t = body + hi   # 위 가장자리 안쪽 밝은 띠
            if solid(lf) and g(x - 2, y) == '.' and solid(up) : t = max(t, body + hi - 1)
            if not solid(dn): t = 0 if strong else 1
            if not solid(rt): t = min(t, 1) if solid(dn) else 0
            # 영역 경계(갈기/얼굴, 몸/앞다리)에서 오른쪽·아래 쪽 영역은 그늘
            if ch != up and up not in '.' and ch in 'HL' : t = min(t, 2)
            if ch != lf and lf not in '.' and ch in 'HL' : t = min(t, 2)
            if ch == 'L': t = max(t - 0, t)
            if ch == 'T': t = min(t + 0, 4)
            c.px(x, y, 'ishi', max(0, min(6, t)))

# 아형(입 벌림): 오른쪽을 본다.  d = 짙은 틈선, w = 밝은 모서리
A = [
"................",  #0
"....MMMMMM......",  #1
"..MMMMMMMMMM....",  #2
".MMMcMMMMMMMM...",  #3
".MMMMMMcMMMMMM..",  #4
"MMMcMMMMMHHHHHM.",  #5
"MMMMMMcHHHHHHHH.",  #6
"MMcMMMHHHHeHHHHH",  #7
"MMMMMMHHHHHHHHHn",  #8
"MMMcMMMHHHHHHHHH",  #9
".MMMMMMHHoooooo.",  #10
".MMcMMMMHfHfHHH.",  #11
"TMMMMMMMMHooooH.",  #12
"TTMMMMMMMMHHHH..",  #13
"TTTBBBBBBBBBBB..",  #14
"T.TBBBBBBBdLLL..",  #15
"T.BBBBBBBBdLLL..",  #16
".TBBBBBBBBdLLL..",  #17
".BBBBBBBBBdLLL..",  #18
"BBBBBBBBBBdLLL..",  #19
"BBBBBBBBBBdLLL..",  #20
"BBBBBBBBBBdLLL..",  #21
"BBBBBBBBBBdLLLL.",  #22
"BBBBBBBBBBdLLLL.",  #23
]
def curls(c, rows, strong=False):
    """갈기(M)·꼬리(T)를 3칸 곱슬 덩이로 굴린다: 덩이 왼쪽 위 밝게, 오른쪽 아래 어둡게(벽돌 배열)."""
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch not in 'MT': continue
            u = (x + (2 if (y // 3) % 2 else 0)) % 4; v = y % 3
            v0 = c.at(x, y)
            if not isinstance(v0, tuple): continue
            t = v0[1]
            if u == 0 and v == 0: t += 2 if strong else 1
            elif u == 0 or v == 0: t += 1
            elif u >= 2 or v == 2: t -= 1
            c.px(x, y, 'ishi', max(1, min(6, t)))

def haunch(c, rows, strong=False, cx=4.5):
    """엉덩이(B): 둥근 허벅지 — 왼쪽 위 밝게, 오른쪽·아래 어둡게."""
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch != 'B': continue
            v0 = c.at(x, y)
            if not isinstance(v0, tuple): continue
            dx = (x - cx) / 4.6; dy = (y - 19) / 5.2
            l = -(dx * .7 + dy * .7)
            t = 3 + int(round(l * (3.2 if strong else 2.4)))
            if dx * dx + dy * dy > .9: t -= 1
            c.px(x, y, 'ishi', max(1, min(6, t)))

U = [   # 음형: 왼쪽을 봄(거울 아님 — 뿔·입 다묾·갈기가 뒤로 늘어짐)
"................",  #0
"......h.........",  #1
"....MMhMMMM.....",  #2
"...MMMhMMMMMMM..",  #3
"..HHHHMMMMMMMMM.",  #4
".HHHHHHMMcMMMMMM",  #5
".HHHHHHHMMMMMMcM",  #6
"HHHeHHHHMMcMMMMM",  #7
"nHHHHHHHMMMMMMMM",  #8
"HHHHHHHHMMMcMMMM",  #9
".ooooooHMMMMMMM.",  #10
".HHHHHHHMMcMMMM.",  #11
"..HHHHHMMMMMMMMT",  #12
"...HHHHMMMMMMMTT",  #13
"..BBBBBBBBBBBTTT",  #14
"..LLLdBBBBBBBB.T",  #15
"..LLLdBBBBBBBBB.",  #16
"..LLLdBBBBBBBBT.",  #17
"..LLLdBBBBBBBBB.",  #18
"..LLLdBBBBBBBBBB"[:16],  #19
"..LLLdBBBBBBBBBB"[:16],  #20
"..LLLdBBBBBBBBBB"[:16],  #21
".LLLLdBBBBBBBBBB"[:16],  #22
".LLLLdBBBBBBBBBB"[:16],  #23
]
CA = [  # C 아형: 정면 얼굴(입 벌림)과 곱슬 갈기 고리
"................",  #0
".....MMMMMM.....",  #1
"...MMMMMMMMMM...",  #2
"..MMMMMMMMMMMM..",  #3
".MMMMMHHHHMMMMM.",  #4
".MMMMHHHHHHMMMM.",  #5
"MMMMHeHHHHeHMMMM",  #6
"MMMMHHHHHHHHMMMM",  #7
"MMMMHHHnnHHHMMMM",  #8
"MMMMMHHHHHHMMMMM",  #9
".MMMMHooooHMMMM.",  #10
".MMMMHofofoHMMM.",  #11
".MMMMMHoooHMMMM.",  #12
"..MMMMMHHHMMMM..",  #13
"...MMMBBBBMMM...",  #14
"....BBBBBBBB....",  #15
"....BBBBBBBB....",  #16
"...BBBBBBBBBB...",  #17
"...BBBBBBBBBB...",  #18
"...BBBBBBBBBB...",  #19
"..BBBBBBBBBBBB..",  #20
"..LLLdBBBBLLLL..",  #21
"..LLLdBBBBLLLL..",  #22
".LLLLdBBBBLLLLL.",  #23
]
CU = [  # C 음형: 정면, 입 다묾, 이마에 뿔
"................",
".......hh.......",
"...MMMMhhMMMM...",
"..MMMMMMMMMMMM..",
".MMMMMHHHHMMMMM.",
".MMMMHHHHHHMMMM.",
"MMMMHeHHHHeHMMMM",
"MMMMHHHHHHHHMMMM",
"MMMMHHHnnHHHMMMM",
"MMMMMHHHHHHMMMMM",
".MMMMHooooooMMM.",
".MMMMMHHHHHMMMM.",
"..MMMMMHHHMMMM..",
"...MMMMHHHMMM...",
"....MMBBBBMM....",
"....BBBBBBBB....",
"....BBBBBBBB....",
"...BBBBBBBBBB...",
"...BBBBBBBBBB...",
"...BBBBBBBBBB...",
"..BBBBBBBBBBBB..",
"..LLLdBBBBLLLL..",
"..LLLdBBBBLLLL..",
".LLLLdBBBBLLLLL.",
]
for _g in (U, CA, CU):
    for _r in _g: assert len(_r) == 16, _r

def shadowB(c):
    # B 방향: 몸 그림자가 받침 윗면 오른쪽에 떨어진다 + 발치 접지 그늘
    for x in range(9, 16):
        c.px(x, 24, 'ishi', 3); c.px(x, 25, 'ishi', 2)
    for x in range(0, 16): c.px(x, 25, 'ishi', 3 if x < 9 else 2)

def build(kind, grid, strong, haunch_cx=None, plain=False):
    c = C(16, 32); base(c, strong); shade(c, grid, strong)
    if not plain: haunch(c, grid, strong, cx=haunch_cx if haunch_cx is not None else 4.5)
    curls(c, grid, strong)
    if strong: shadowB(c)
    return c

def outline_soft(c):
    pass

if __name__ == '__main__':
    NOTE = {
     'komainu_a': ('강남식 4~5단 돌톤, 오른쪽을 보는 입 벌린 사자개, 3칸 곱슬 갈기와 둥근 엉덩이, 받침 하단 이끼', '같은 짜임에 명암 대비를 세게: 윗 가장자리 하이라이트 2단, 받침 윗면 밝게 + 몸 그림자가 오른쪽 받침에 떨어짐', '정면을 보는 큰 얼굴(입 벌림) + 곱슬 갈기 고리, 아기자기한 작은 몸 — 얼굴을 한 칸에서도 읽히게 재해석'),
     'komainu_un': ('아형의 짝: 왼쪽을 보는 입 다문 음형, 이마 뿔, 갈기가 뒤로 늘어지고 꼬리 큰 술 — 거울이 아닌 별도 격자', '같은 짜임에 명암 대비를 세게: 윗 가장자리 하이라이트 2단, 받침 윗면 밝게 + 몸 그림자가 오른쪽 받침에 떨어짐', '정면을 보는 큰 얼굴(입 다묾) + 이마 뿔 + 곱슬 갈기 고리 — 아형 C 와 한 벌')}
    import shutil
    for slug, A_, B_, C_ in (('komainu_a', A, A, CA), ('komainu_un', U, U, CU)):
        hc = None if slug == 'komainu_a' else 11.5
        out = os.path.join(D, '..', slug)
        build(slug, A_, False, hc).save(os.path.join(out, 'j1-A.pxg'))
        build(slug, B_, True, hc).save(os.path.join(out, 'j1-B.pxg'))
        build(slug, C_, False, plain=True).save(os.path.join(out, 'j1-C.pxg'))
        for k, n in zip('ABC', NOTE[slug]):
            open(os.path.join(out, f'j1-{k}.note'), 'w', encoding='utf-8').write(n + '\n')
