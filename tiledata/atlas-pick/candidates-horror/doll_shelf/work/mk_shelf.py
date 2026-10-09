import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'portrait_eyes', 'work'))
from h1_lib import Canvas
NOTES = {
 'A': "A: v5 인형장을 낡게 — 마호가니 틀에 먼지가 앉고 유리문 한 장(오른쪽 위)이 깨져 어둠이 드러난다. 세 칸 선반에 작은 인형 머리 아홉 개, 눈만 까맣다. 틀 왼쪽·위는 먼지로 뿌옇다.",
 'B': "B: 왼쪽 위 빛 — 틀 왼쪽·위 띠는 밝고 오른쪽·아래는 어둡게, 인형 머리도 왼쪽 반이 밝다. 캐비닛을 14칸 폭으로 줄이고 오른쪽으로 반투명 접촉 그림자(~ -).",
 'C': "C: 실루엣 재해석 — 가운데 칸에 머리 하나가 유리를 가득 채울 만큼 크고 나머지 칸은 비었다. 유리에 방사형 금. 어긋난 곳은 가운데 큰 머리.",
}
def head(c, x, y, lit=False, shade=False):
    """3폭 4높이 인형 머리: 머리카락 한 줄, 눈 줄(양옆 까만점), 뺨, 턱."""
    hair = 'mahog:2'; face = 'bisque:5' if lit else 'bisque:4'
    c.hline(x, x + 2, y, hair)
    c.px(x, y + 1, 'void:0'); c.px(x + 1, y + 1, face); c.px(x + 2, y + 1, 'void:0')
    c.hline(x, x + 2, y + 2, face if not shade else 'bisque:3')
    c.px(x + 1, y + 2, 'blood:2')
    c.hline(x, x + 2, y + 3, 'bisque:3')
    c.px(x, y + 3, 'bisque:2') if not lit else None

def cabinet(c, x0, x1, kind):
    W = x1 - x0 + 1
    # 몸틀
    c.rect(x0, 0, x1, 31, 'mahog:3')
    # 윗장식
    c.hline(x0, x1, 0, 'mahog:4'); c.hline(x0, x1, 1, 'mahog:3'); c.hline(x0, x1, 2, 'mahog:2')
    # 유리 안쪽(어둠)
    gx0, gx1 = x0 + 2, x1 - 2
    c.rect(gx0, 3, gx1, 27, 'night:1')
    # 선반
    for sy in (9, 17, 25):
        c.hline(gx0, gx1, sy, 'mahog:4'); c.hline(gx0, gx1, sy + 1, 'mahog:2')
    # 아래 받침
    c.rect(x0, 28, x1, 31, 'mahog:2'); c.hline(x0, x1, 28, 'mahog:4'); c.hline(x0, x1, 31, 'mahog:0')
    c.rect(x0 + 1, 30, x0 + 2, 31, 'mahog:1'); c.rect(x1 - 2, 30, x1 - 1, 31, 'mahog:1')
    return gx0, gx1

def heads_row(c, gx0, gx1, y, kind, skip=()):
    xs = [gx0 + 1 + i * 4 for i in range(3)]
    for i, x in enumerate(xs):
        if i in skip or x + 2 > gx1: continue
        head(c, x, y, lit=(kind == 'B' and i == 0))

def glass_sheen(c, gx0, gx1):
    for (x, y) in ((gx0, 3), (gx0 + 1, 4), (gx0 + 2, 5), (gx0, 12), (gx0 + 1, 13), (gx0, 20), (gx0 + 1, 21)):
        if c.get(x, y) in ('night:1',): c.px(x, y, 'moon:2')

def build(kind):
    c = Canvas('doll_shelf', 16, 32)
    x0, x1 = (0, 15) if kind != 'B' else (0, 13)
    gx0, gx1 = cabinet(c, x0, x1, kind)
    if kind in 'AB':
        for y in (5, 13, 21): heads_row(c, gx0, gx1, y, kind)
        glass_sheen(c, gx0, gx1)
        # 깨진 유리: 오른쪽 위 조각이 사라지고 금
        bx = gx1
        for (x, y) in ((bx, 3), (bx - 1, 3), (bx, 4), (bx - 1, 4), (bx, 5), (bx - 2, 3)):
            c.px(x, y, 'night:0')
        for (x, y) in ((bx - 2, 4), (bx - 1, 5), (bx - 2, 6), (bx - 3, 5), (bx - 3, 7), (bx, 6), (bx - 1, 7)):
            if c.get(x, y) not in (None,): c.px(x, y, 'moon:4')
        # 먼지: 틀 위·왼쪽 + 선반 위
        for x in range(x0, x1 + 1, 2): c.px(x, 0, 'dust:4')
        for y in (4, 8, 13, 22): c.px(x0, y, 'dust:3')
        for x in (gx0 + 1, gx0 + 5, gx0 + 8): c.px(x, 9, 'dust:3'); c.px(x, 17, 'dust:3'); c.px(x, 25, 'dust:3')
        # 틀 안쪽 경계선 어둡게
        c.vline(gx0 - 1, 3, 27, 'mahog:1'); c.vline(gx1 + 1, 3, 27, 'mahog:5' if kind == 'B' else 'mahog:1')
        c.hline(gx0 - 1, gx1 + 1, 2, 'mahog:1')
        if kind == 'A':
            # 낡음: 나무 결 긁힘, 금 간 자리, 아래쪽 습기
            for (x, y) in ((3, 29), (7, 29), (12, 30)): c.px(x, y, 'rot:2')
            for (x, y) in ((14, 12), (14, 13), (14, 14), (1, 17), (1, 18)): c.px(x, y, 'mahog:1')
        if kind == 'B':
            # 왼쪽 위 빛 띠 / 오른쪽 아래 어둠
            c.vline(x0, 1, 27, 'mahog:5'); c.hline(x0, x1, 0, 'mahog:5')
            c.vline(x1, 1, 27, 'mahog:1'); c.hline(x0, x1, 31, 'mahog:0')
            for y in range(3, 28):
                c.px(gx1, y, 'night:0') if c.get(gx1, y) == 'night:1' else None
            # 접촉 그림자
            for y in range(3, 31): c.px(14, y, '~'); c.px(15, y, '-')
            c.px(14, 31, '-'); c.px(15, 31, '-')
    else:
        # C: 가운데 큰 머리
        c.rect(gx0 + 1, 11, gx1 - 1, 24, 'bisque:4') if False else None
        heads_row(c, gx0, gx1, 5, 'C')
        # 가운데 칸 큰 머리 (7폭 7높이)
        cx = (gx0 + gx1) // 2 - 3
        c.hline(cx + 1, cx + 5, 11, 'mahog:2'); c.hline(cx, cx + 6, 12, 'mahog:2')
        c.rect(cx, 13, cx + 6, 16, 'bisque:4'); c.rect(cx, 17, cx + 6, 22, 'bisque:4')
        c.rect(cx + 1, 14, cx + 2, 16, 'void:0'); c.rect(cx + 4, 14, cx + 5, 16, 'void:0')
        c.px(cx + 1, 14, 'dust:6'); c.px(cx + 4, 14, 'dust:6')
        c.hline(cx + 1, cx + 5, 20, 'blood:2'); c.hline(cx + 1, cx + 5, 21, 'void:0')
        for x in (cx + 2, cx + 4): c.px(x, 21, 'wax:5')
        c.hline(cx, cx + 6, 22, 'bisque:2')
        # 유리에 방사형 금
        for (x, y) in ((gx0, 10), (gx0 + 1, 11), (gx1, 10), (gx1 - 1, 11), (gx0, 24), (gx1, 24), (gx1 - 1, 23), (gx0 + 1, 23)):
            c.px(x, y, 'moon:4')
        # 셋째 칸: 옆으로 누운 머리 하나만
        head(c, gx0 + 4, 21, False)
        for y in (3,):
            c.px(gx0 + 3, y, 'moon:2')
        for x in range(x0, x1 + 1, 2): c.px(x, 0, 'dust:4')
        c.vline(gx0 - 1, 3, 27, 'mahog:1'); c.vline(gx1 + 1, 3, 27, 'mahog:1')
        c.hline(gx0 - 1, gx1 + 1, 2, 'mahog:1')
    return c

if __name__ == '__main__':
    for k in 'ABC':
        c = build(k)
        for (x, y) in ((0, 0), (15, 0), (13, 0)) if k == 'B' else ((0, 0), (15, 0)): c.px(x, y, None)
        if k == 'B': c.px(0, 0, None)
        c.save(f'h1-{k}', NOTES[k])
    print('ok')
