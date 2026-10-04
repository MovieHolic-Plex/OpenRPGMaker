import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'portrait_eyes', 'work'))
from h1_lib import Canvas
NOTES = {
 'A': "A: v5 업라이트 피아노를 낡게 — 뚜껑 위에 먼지가 덮이고 손가락 자국 세 줄, 건반 두 개가 빠져 구멍이 났다. 악보는 누렇게 바랬고 오른쪽에 촛대 하나. 위 8칸은 비움.",
 'B': "B: 왼쪽 위 빛 — 몸통 왼쪽·위 모서리는 밝고 오른쪽·아래는 깊게 어둡다. 건반 위 먼지에 빛 줄. 폭 29칸으로 줄여 오른쪽·아래에 반투명 접촉 그림자(~ -).",
 'C': "C: 실루엣 재해석 — 촛불 두 개가 눈, 들쭉날쭉한 건반이 웃는 이빨. 뚜껑을 왼쪽으로 비스듬히 열어 실루엣이 한쪽으로 기운다. 어긋난 곳은 웃는 건반.",
}
def body(c, x0, x1):
    c.rect(x0, 9, x1, 10, 'mahog:3'); c.hline(x0, x1, 8, 'mahog:5')          # 뚜껑
    c.hline(x0, x1, 11, 'mahog:1')
    c.rect(x0 + 1, 12, x1 - 1, 17, 'mahog:2')                               # 윗패널
    c.rect(x0, 18, x1, 18, 'mahog:1')
    c.rect(x0 + 1, 19, x1 - 1, 22, 'paper:6')                               # 건반 바탕(뒤에서 덮음)
    c.rect(x0, 23, x1, 23, 'mahog:1')
    c.rect(x0, 24, x1, 28, 'mahog:2'); c.hline(x0, x1, 24, 'mahog:3')       # 몸통 아랫판
    c.rect(x0 + 3, 25, x1 - 3, 27, 'mahog:1')                               # 아래 패널 홈
    c.hline(x0 + 3, x1 - 3, 25, 'mahog:0')
    c.rect(x0 + 1, 29, x0 + 3, 31, 'mahog:1'); c.rect(x1 - 3, 29, x1 - 1, 31, 'mahog:1')  # 다리
    c.hline(x0 + 1, x0 + 3, 31, 'mahog:0'); c.hline(x1 - 3, x1 - 1, 31, 'mahog:0')
    c.rect((x0 + x1) // 2 - 2, 29, (x0 + x1) // 2 + 1, 30, 'vbrass:3'); c.hline((x0 + x1) // 2 - 2, (x0 + x1) // 2 + 1, 30, 'vbrass:1')

def keys(c, x0, x1, missing=(), black_missing=()):
    kx = x0 + 2
    for i in range(12):
        xa = kx + i * 2
        if xa + 1 > x1 - 2: break
        if i in missing:
            c.rect(xa, 19, xa + 1, 22, 'void:0'); continue
        c.vline(xa, 19, 22, 'paper:6'); c.vline(xa + 1, 19, 22, 'paper:5')
        c.px(xa + 1, 22, 'paper:3')
    for i in (0, 1, 3, 4, 5, 7, 8, 10):
        if i in black_missing: continue
        xa = kx + i * 2 + 1
        if xa + 1 <= x1 - 2: c.rect(xa, 19, xa + 1, 20, 'void:1'); c.px(xa + 1, 20, 'void:0')

def score_and_candle(c, x0, x1):
    sx = (x0 + x1) // 2 - 3
    c.rect(sx, 12, sx + 6, 17, 'paper:4')
    for y in (13, 15): c.hline(sx + 1, sx + 5, y, 'paper:1')
    for (x, y) in ((sx + 2, 14), (sx + 4, 14), (sx + 3, 16), (sx + 1, 16)): c.px(x, y, 'void:0')
    c.px(sx + 6, 12, 'paper:3'); c.vline(sx + 6, 13, 17, 'paper:2'); c.hline(sx, sx + 6, 17, 'paper:2')
    c.px(sx, 12, 'paper:2')
    cx = x1 - 5
    c.rect(cx, 5, cx, 5, 'flame:4'); c.px(cx, 4, 'flame:3') if False else None
    c.rect(cx, 6, cx, 8, 'wax:5'); c.px(cx, 6, 'flame:5')
    c.rect(cx - 1, 9, cx + 1, 9, 'vbrass:3')
    return cx

def dust(c, x0, x1, kind):
    for x in range(x0 + 1, x1, 2): c.px(x, 8, 'dust:5'); 
    for x in range(x0 + 1, x1):
        c.px(x, 9, 'dust:4' if (x % 2 == 0) else 'dust:3')
    # 손가락 자국 세 줄
    for j in (5, 7, 9): c.vline(x0 + j + 8, 9, 10, 'mahog:3')
    for x in range(x0 + 2, x1 - 1, 3): c.px(x, 18, 'dust:3')
    # 건반 위 먼지 조각
    for x in range(x0 + 3, x1 - 2, 3): c.px(x, 19, 'dust:5') if c.get(x, 19) and c.get(x, 19).startswith('paper') else None

def outline_all(c):
    pass

def build(kind):
    c = Canvas('piano_dusty', 32, 32)
    x0, x1 = (1, 30) if kind == 'A' else ((1, 28) if kind == 'B' else (1, 30))
    body(c, x0, x1)
    if kind == 'C':
        keys(c, x0, x1)
        # 들쭉날쭉한 이빨: 건반 아랫줄을 깎아 웃는 입 모양
        for i, h in enumerate([0, 1, 0, 2, 1, 0, 1, 2, 0, 1, 0, 2]):
            xa = x0 + 2 + i * 2
            for yy in range(22 - h + 1, 23): c.rect(xa, yy, xa + 1, yy, 'void:0') if h else None
        # 비웃는 입 가장자리(올라간 양끝)
        c.px(x0 + 1, 21, 'void:0'); c.px(x1 - 1, 21, 'void:0'); c.px(x0 + 1, 20, 'void:0'); c.px(x1 - 1, 20, 'void:0')
        # 눈 = 촛불 두 개
        for cx in (9, 22):
            c.px(cx, 5, 'flame:4'); c.px(cx, 6, 'flame:5'); c.rect(cx, 7, cx, 10, 'wax:5'); c.rect(cx - 1, 11, cx + 1, 11, 'vbrass:3')
            c.px(cx, 4, 'flame:2') if False else None
        # 비스듬히 열린 뚜껑: 왼쪽 위 삼각
        for i in range(5):
            c.hline(x0, x0 + 4 - i, 8 - i, 'mahog:4') if 8 - i >= 8 - 4 else None
        c.hline(x0, x0 + 3, 7, 'mahog:5'); c.hline(x0, x0 + 2, 6, 'mahog:4') 
        for x in range(x0 + 6, x1 - 5, 2): c.px(x, 8, 'dust:4')
    else:
        keys(c, x0, x1, missing=(3, 8), black_missing=(4, 7, 8))
        cx = score_and_candle(c, x0, x1)
        dust(c, x0, x1, kind)
        c.px(x0 + 2, 26, 'hmoss:1'); c.px(x0 + 3, 27, 'hmoss:1'); c.px(x1 - 6, 27, 'rot:1')
    # 가장자리: 왼쪽 위 밝게 / 오른쪽·아래 어둡게
    if kind == 'B':
        c.vline(x0, 9, 28, 'mahog:5'); c.hline(x0, x1, 8, 'mahog:5')
        c.vline(x1, 9, 28, 'mahog:0'); c.hline(x0, x1, 28, 'mahog:0')
        c.vline(x0 + 1, 12, 17, 'mahog:4'); c.vline(x1 - 1, 12, 17, 'mahog:0')
        for x in range(x0 + 1, x1, 2): c.px(x, 9, 'dust:5')
        for j in range(x0 + 2, x0 + 8): c.px(j, 12, 'mahog:4')
        # 접촉 그림자 (빈 곳에만)
        for y in range(9, 32):
            for x in (x1 + 1, x1 + 2):
                if c.get(x, y) is None and x < 32: c.px(x, y, '~' if x == x1 + 1 else '-')
        for x in range(x0 + 1, x1 + 3):
            if c.get(x, 31) is None: c.px(x, 31, '-')
    else:
        c.vline(x0, 9, 28, 'mahog:4'); c.vline(x1, 9, 28, 'mahog:1')
    # 오른쪽 위 모서리는 둥글게(빈 모서리)
    c.px(x1, 8, None); c.px(x0, 8, None)
    if kind != 'C': c.hline(x0, x1, 8, 'mahog:5') if False else None
    return c

if __name__ == '__main__':
    for k in 'ABC':
        build(k).save(f'h1-{k}', NOTES[k])
    print('ok')
