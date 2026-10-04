import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from portrait import *
NOTES = {
 'A': "A: v5 액자를 낡게 — 청동 액자 위 먼지·도금 벗겨짐, 캔버스 금과 곰팡이, 창백한 여인, 흰자 있는 두 눈. 어두운 방에서도 눈만 먼저 읽힌다.",
 'B': "B: 왼쪽 위 빛 — 액자 위·왼 띠는 밝고 아래·오른쪽은 어둡게, 오른쪽·아래로 반투명 접촉 그림자(~ -). 액자를 14칸으로 줄여 그림자 자리를 남김. 캔버스 왼쪽 위에 유리 빛 줄.",
 'C': "C: 실루엣 재해석 — 타원 액자, 얼굴이 너무 길고 눈이 너무 크며 좌우 높이가 다르고 입은 꿰맨 선. 어긋난 곳은 눈 높이.",
}
def chiaro(c):
    # B: 왼쪽 위에서 오는 빛 — 왼쪽 배경은 밝게, 오른쪽 반쪽은 깊은 그늘, 얼굴 오른쪽 절반은 어둡게
    for y in range(2, 28):
        for x in range(2, 12):
            k = c.get(x, y)
            if k is None: continue
            r, s_ = k.split(':'); s_ = int(s_)
            if r in ('velv', 'damask'):
                c.px(x, y, f'{r}:{s_ + (2 if x < 6 and y < 16 else 0) - (1 if x >= 8 else 0)}')
            elif r == 'bisque' and x >= 7 and not (x in (7, 8) and False):
                c.px(x, y, f'bisque:{max(1, s_ - 2)}')
            elif r == 'bisque' and x <= 5:
                c.px(x, y, f'bisque:{min(6, s_ + 1)}')
            elif r == 'void' and x <= 4 and y < 12:
                c.px(x, y, 'void:3')
            elif r == 'damask' and x >= 8:
                c.px(x, y, 'damask:0')
    # 눈은 어둠 속에서도 남게 흰자만 되살린다
    for (x, y) in ((4, 11), (5, 11), (4, 12), (7, 11), (8, 11), (8, 12)):
        pass
def make(k, slashed=False):
    c = build(k, slashed)
    if k == 'B': chiaro(c)
    return c

def shadowB(c):
    for y in range(1, 30): c.px(14, y, '~'); c.px(15, y, '-')
    for x in range(1, 14): c.px(x, 30, '~'); c.px(x, 31, '-') if x > 1 else None
    c.px(14, 30, '~'); c.px(14, 31, '-'); c.px(15, 30, '-')

if __name__ == '__main__':
    for k in 'ABC':
        c = make(k)
        if k == 'B':
            shadowB(c)
            for (x, y) in ((3, 3), (4, 4), (5, 5), (3, 4), (4, 5)):
                if c.get(x, y) in ('velv:1', 'damask:1'): c.px(x, y, 'velv:3')
        c.save(f'h1-{k}', NOTES[k])
    print('ok')
