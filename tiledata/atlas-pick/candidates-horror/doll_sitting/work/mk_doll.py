import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'portrait_eyes', 'work'))
from h1_lib import Canvas
NOTES = {
 'A': "A: v5 선반 인형을 낡게 — 도자기 얼굴에 금이 가고 드레스는 누렇게 바랬다. 머리 살짝 기울고 커다란 까만 눈 두 개, 한쪽 눈에만 먼지빛 점. 다리를 앞으로 내밀고 앉음.",
 'B': "B: 왼쪽 위 빛 — 얼굴 왼쪽은 밝고 오른쪽은 그늘, 드레스 주름도 오른쪽으로 어두워짐. 오른쪽·아래로 반투명 접촉 그림자(~ -).",
 'C': "C: 실루엣 재해석 — 머리가 몸보다 훨씬 크고 눈은 얼굴의 절반, 입은 귀까지 찢어진 가는 선. 다리는 곧게 벌린 V. 어긋난 곳은 입.",
}
LG = dict(m='mahog:2', M='mahog:1', h='bisque:5', s='bisque:4', t='bisque:3', e='void:0', l='blood:3', d='paper:4', D='paper:3', g='paper:2',
          a='bisque:4', b='void:2', r='blood:2', w='dust:6', L='paper:6')

def shear(c, rows, x0, y0, shifts):
    for j, row in enumerate(rows):
        c.art(x0 + shifts.get(j, 0), y0 + j, [row], LG)

def base(c, kind):
    head = ['....mmmmmm......',
            '...mmmmmmmm.....',
            '...mmhhhhhmm....',
            '...mhhhhhhhhm...',
            '...mheehhheehm..',
            '...mheehhheehm..',
            '...mheehhheehm..',
            '....hhhhhhhhh...',
            '....hhhllhhh....',
            '.....hhhhhh.....']
    # 머리를 살짝 기울임: 위쪽은 오른쪽으로, 아래쪽은 왼쪽으로 한 칸
    sh = {0: 1, 1: 1, 2: 1, 3: 0, 4: 0, 5: 0, 6: 0, 7: -1, 8: -1, 9: -1}
    for j, row in enumerate(head):
        c.art(sh[j], 1 + j, [row], LG)
    body = ['....dddddddd....',
            '...adddDDDdda...',
            '..dddddDDDDdddd.',
            '..LgLgLgLgLgLg..',
            '....aa....aa....',
            '...bbb....bbb...']
    for j, row in enumerate(body):
        c.art(0, 10 + j, [row], LG)

def shade(c, x0, x1, y0, y1, lit_from='left'):
    pass

def build(kind):
    c = Canvas('doll_sitting', 16, 16)
    base(c, kind)
    # 공통: 머리카락 리본
    if kind == 'A':
        c.outline(dtl=3, dbr=4, mins={'bisque': 1, 'paper': 1, 'mahog': 0})
        # 금 (왼쪽 이마에서 눈 사이로) + 얼룩 + 이 빠진 옷단
        for (x, y) in ((6, 3), (6, 4), (7, 5)): c.px(x, y, 'bisque:1')
        c.px(11, 8, 'bisque:2'); c.px(10, 9, 'bisque:2')
        c.px(4, 12, 'hmoss:1'); c.px(11, 13, 'hmoss:2')
        c.px(9, 11, 'paper:2'); c.px(6, 12, 'paper:2')
        c.px(3, 13, None); c.px(11, 14, 'paper:1')
        c.px(5, 5, 'dust:6') if False else None
        c.px(6, 6, 'dust:6')          # 한쪽 눈에만 빛
        c.px(1, 5, 'rot:1'); c.px(2, 6, 'rot:1')   # 리본 잔해
    elif kind == 'B':
        c.outline(dtl=3, dbr=4, mins={'bisque': 1, 'paper': 1, 'mahog': 0})
        # 오른쪽은 한 단 어둡게, 왼쪽 위는 한 단 밝게
        f = c.flat()
        for y in range(16):
            for x in range(16):
                k = c.get(x, y)
                if not k or k[0:3] == 'voi': continue
                r, s = k.split(':'); s = '0123456789abcde'.index(s)
                if x >= 8 and r in ('bisque', 'paper', 'mahog') and s > 1: c.px(x, y, f'{r}:{s-1}')
                elif x <= 5 and y <= 8 and r in ('bisque', 'mahog') and s < 6: c.px(x, y, f'{r}:{s+1}')
        # 접촉 그림자
        for x in range(2, 15): c.px(x, 15, '~') if c.get(x, 15) is None else None
        for y in range(9, 15):
            for x in range(14, 16):
                if c.get(x, y) is None: c.px(x, y, '~' if x == 14 else '-')
    return c

def buildC():
    c = Canvas('doll_sitting', 16, 16)
    # 머리가 큼: 12칸 폭, 눈 4칸 세로, 입은 귀까지
    art = ['................',
           '...mmmmmmmmmm...',
           '..mmmmmmmmmmmm..',
           '..mhhhhhhhhhhm..',
           '..mheeehheeehm..',
           '..mheeehheeehm..',
           '..mheeehheeehm..',
           '..mheeehheeehm..',
           '..mhhhhhhhhhhm..',
           '..mhllllllllhm..',
           '...hhhhhhhhhh...',
           '.....dddddd.....',
           '....adddDDda....',
           '...gLgLgLgLg....',
           '.bb.aa....aa.bb.',
           '.bb..........bb.']
    for j, row in enumerate(art): c.art(0, j, [row], LG)
    return c

if __name__ == '__main__':
    for k in 'AB':
        c = build(k); c.save(f'h1-{k}', NOTES[k])
    c = buildC()
    c.outline(dtl=3, dbr=4, mins={'bisque': 1, 'paper': 1, 'mahog': 0})
    # 하얀 눈 반짝임 한 점씩 + 입 가장자리
    c.px(5, 5, 'dust:6'); c.px(10, 5, 'dust:6')
    c.px(3, 9, 'blood:1'); c.px(12, 9, 'blood:1')
    c.save('h1-C', NOTES['C'])
    print('ok')
