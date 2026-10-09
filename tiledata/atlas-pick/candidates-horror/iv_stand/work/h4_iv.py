import sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'wall_paper_torn', 'work'))
from h4lib import Cv, P
CH = os.path.join(HERE, '..', '..')
T = lambda t: P('tin', t)
B = lambda t: P('blood', t)
Mk = lambda t: P('murk', t)

def base(c, d):
    lit = d == 'B'
    hi, lo = (6, 2) if lit else (5, 3)
    # 다섯 발: 가운데 허브에서 갈라짐
    c.rect(7, 26, 8, 27, T(hi)); c.vl(8, 26, 27, T(lo))
    for (x1, y1) in ((2, 28), (13, 28)):
        c.line(7 if x1 < 8 else 8, 27, x1, y1, T(4))
    c.line(7, 28, 4, 30, T(4)); c.line(8, 28, 11, 30, T(3))
    c.vl(7, 28, 29, T(lo + 1)); c.vl(8, 28, 29, T(lo))
    # 아랫면 그늘
    for (x, y) in ((3, 29), (12, 29), (5, 30) if False else (5, 29)):
        pass
    # 바퀴
    for (x, y) in ((1, 29), (2, 29), (13, 29), (14, 29), (3, 31), (4, 31), (11, 31), (12, 31)):
        c.set(x, y, P('void', 2))
    for (x, y) in ((1, 29), (13, 29), (3, 31), (11, 31)):
        c.set(x, y, P('void', 3))
    if d == 'A':
        for (x, y) in ((3, 28), (12, 28), (10, 29)):
            c.set(x, y, P('rust', 3))

def pole(c, d, x0=7, top=8, bot=25):
    lit = d == 'B'
    hi, lo = (6, 2) if lit else (5, 3)
    c.vl(x0, top, bot, T(hi)); c.vl(x0 + 1, top, bot, T(lo))
    if d == 'A':
        for y in (13, 14, 19, 22): c.set(x0 + 1, y, P('rust', 3))
        c.set(x0, 20, P('rust', 4))
    # 높이 조절 마디
    c.hl(x0 - 1, x0 + 2, 17, T(lo + 1)); c.hl(x0 - 1, x0 + 2, 18, T(lo - 1))

def bag(c, x0, y0, w, h, fill_from, d):
    lit = d == 'B'
    # 테
    c.rect(x0, y0, x0 + w - 1, y0 + h - 1, Mk(3))
    c.hl(x0, x0 + w - 1, y0, Mk(6 if lit else 5)); c.vl(x0, y0, y0 + h - 1, Mk(6 if lit else 5))
    c.vl(x0 + w - 1, y0, y0 + h - 1, Mk(2)); c.hl(x0, x0 + w - 1, y0 + h - 1, Mk(2))
    # 속
    c.rect(x0 + 1, y0 + 1, x0 + w - 2, y0 + h - 2, Mk(3))
    for y in range(fill_from, y0 + h - 1):
        c.hl(x0 + 1, x0 + w - 2, y, B(3))
        c.set(x0 + w - 2, y, B(2)); c.set(x0 + 1, y, B(4 if not lit else 5))
    c.hl(x0 + 1, x0 + w - 2, fill_from, B(5) if lit else B(4))
    # 고정 구멍
    c.set(x0 + w // 2, y0, P('void', 1))

def iv(d):
    c = Cv(16, 32)
    if d != 'C':
        c.rect(4, 4, 11, 4, T(5)); c.hl(4, 11, 5, T(2))   # 걸이 가로대
        c.set(4, 4, T(6 if d == 'B' else 5)); c.set(11, 5, T(1))
        c.vl(4, 5, 6, T(3)); c.vl(11, 5, 6, T(3))  # 갈고리
        pole(c, d, 7, 5, 25)
        c.set(7, 4, T(6)); c.set(8, 4, T(4))
        bag(c, 9, 7, 6, 10, 11, d)
        c.vl(11, 5, 6, T(4)); c.vl(12, 5, 6, T(3))
        # 관: 봉지 밑에서 내려와 바닥 근처까지 늘어짐 (기둥 오른쪽)
        for y in range(17, 24): c.set(12 + (1 if y > 19 else 0), y, Mk(5)); 
        for y in range(20, 27): c.set(13, y, Mk(5))
        for y in range(17, 20): c.set(12, y, Mk(5))
        c.set(12, 20, Mk(5)); c.set(13, 21, B(4)); c.set(13, 24, B(3))
        c.set(13, 27, B(4)); c.set(12, 27, B(3)) if False else None
        base(c, d)
        if d == 'B':
            # 오른쪽 아래로 그림자, 왼쪽 위 달빛 번짐
            for x in range(9, 16):
                if not c.get(x, 30): c.set(x, 30, '~')
            for x in range(9, 16):
                if not c.get(x, 31): c.set(x, 31, '-')
            for x in range(14, 16):
                if not c.get(x, 29): c.set(x, 29, '-')
            for y in range(8, 25):
                if not c.get(9, y): c.set(9, y, '-')
            c.set(3, 6, '?'); c.set(2, 7, '?'); c.set(3, 8, '?')
            c.set(9, 17, '$') if False else None
        return c
    # C: 허수아비 형상 — 기둥은 굽고 가로대에서 늘어진 두 봉지가 눈 구멍 난 얼굴처럼 보인다
    hi, lo = 5, 2
    c.vl(7, 3, 25, T(hi)); c.vl(8, 3, 25, T(lo))
    c.set(6, 6, T(hi)); c.set(6, 7, T(4)); c.set(9, 8, T(lo)); c.set(9, 9, T(lo))  # 굽음
    c.hl(1, 14, 8, T(4)); c.hl(1, 14, 9, T(2)); c.set(1, 8, T(5)); c.set(14, 9, T(1))
    # 왼팔에서 늘어진 얼굴 봉지
    bag(c, 1, 10, 5, 8, 12, 'A')
    c.set(2, 13, P('void', 0)); c.set(4, 13, P('void', 0)); c.hl(2, 4, 16, P('void', 0))
    # 오른팔에서 늘어진 긴 봉지(축 늘어짐)
    bag(c, 10, 10, 5, 13, 14, 'A')
    c.set(11, 14, P('void', 0)); c.set(13, 14, P('void', 0)); c.set(12, 16, P('void', 0))
    # 머리 자리: 위로 더 솟은 링
    c.ring(7.5, 3, 2.4, 2.2, T(4))
    for y in range(24, 28):
        c.set(3 + (y - 24), y, B(3)) if False else None
    # 바닥 웅덩이로 이어지는 관
    for y in range(23, 27): c.set(12, y, Mk(5))
    c.set(12, 26, B(3)); c.set(11, 27, B(2)); c.hl(10, 13, 28, B(2)) if False else None
    base(c, 'A')
    return c

N = {
 'A': '16x32 v5 기물 크기: 다섯 발 바퀴 받침, 2px 쇠 기둥, 가로대에 걸린 링거 봉지(테 밝게·속 검붉은 피, 윗 두 줄은 비어 있음), 관이 아래로 늘어져 끝에 핏방울, 기둥·받침에 녹',
 'B': '왼쪽 위 빛: 기둥 왼쪽·봉지 왼쪽 테 밝고 오른쪽 어둡게, 봉지 액체 윗면 반짝, 받침 오른쪽 아래로 ~ - 그림자, 왼쪽 위에 ? 달빛',
 'C': '링거 걸이가 허수아비 자세: 굽은 기둥과 긴 가로대, 양팔에서 눈구멍 난 봉지 둘이 얼굴처럼 늘어지고 오른쪽 봉지는 길게 축 처짐',
}
for d in 'ABC':
    iv(d).emit(f'{CH}/iv_stand/h4-{d}.pxg', f'iv_stand h4-{d}')
    open(f'{CH}/iv_stand/h4-{d}.note', 'w', encoding='utf-8').write(N[d] + '\n')
