import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'portrait_eyes', 'work'))
from h1_lib import Canvas
NOTES = {
 'A': "A: v5 나무 계단(48x48, 7단 띠)을 낡게 — 같은 폭·같은 단 수. 가운데 두 단(4·5번째 띠)이 부러져 왼쪽에서 오른쪽 3/4까지 구멍(void), 부러진 널 조각이 삐죽. 왼쪽 난간 기둥 하나 빠짐, 단 끝마다 먼지. 올라가는 길은 오른쪽에만 남았다.",
 'B': "B: 왼쪽 위 빛 — 단 윗모서리는 밝고 챌판은 깊게 어둡다. 구멍 안쪽은 위 단의 그림자가 떨어져 더 깊고, 왼쪽 난간이 오른쪽보다 밝다. 빠진 기둥 자리에 반투명 그림자 한 줄.",
 'C': "C: 실루엣 재해석 — 구멍을 벌어진 입처럼 크게: 위 널 끝이 이빨처럼 아래로, 아래 널 끝이 위로 솟는다. 단 전체가 한쪽으로 살짝 무너져 오른쪽 아래가 처진다. 어긋난 곳은 구멍 입 모양.",
}
BANDS = [6 + 6 * k for k in range(7)]  # 6,12,...  (5행 단, 사이 줄 5,11,..)
def tread(c, r0, k, x0=4, x1=43, kind='A'):
    lit = 3 + (k // 2)   # 아래로 갈수록 밝다(가까움)
    top = min(6, lit + 2); face = lit + 1
    for x in range(x0, x1 + 1):
        c.px(x, r0, f'rot:{top}')
        c.px(x, r0 + 1, f'rot:{face}'); c.px(x, r0 + 2, f'rot:{face - 1 if (x % 5 != 2) else face - 2}')
        c.px(x, r0 + 3, f'rot:{max(1, face - 2)}'); c.px(x, r0 + 4, 'rot:1')
    # 나뭇결 대시
    for x in range(x0 + 1 + (k % 3) * 2, x1, 7): c.px(x, r0 + 1, f'rot:{face - 2}'); c.px(x + 1, r0 + 1, f'rot:{face - 2}')
    # 못
    for x in (x0 + 2, x1 - 2): c.px(x, r0 + 2, 'tin:2')
def frame(c, kind):
    # 난간 기둥
    L = ['mahog:1', 'mahog:3', 'mahog:4', 'mahog:5'] if kind == 'B' else ['mahog:1', 'mahog:2', 'mahog:3', 'mahog:4']
    R = ['mahog:4', 'mahog:3', 'mahog:2', 'mahog:0'] if kind != 'B' else ['mahog:3', 'mahog:2', 'mahog:1', 'mahog:0']
    for y in range(0, 48):
        for i in range(4):
            c.px(i, y, L[i]); c.px(44 + i, y, R[i])
    for y in (5, 11, 17, 23, 29, 35, 41, 47):
        for i in range(4): c.px(i, y, 'mahog:1' if i < 3 else 'mahog:2'); c.px(44 + i, y, 'mahog:2' if i == 0 else 'mahog:0')
        for x in range(4, 44): c.px(x, y, 'rot:0')
    # 위 어둠
    for y in range(0, 5):
        for x in range(4, 44): c.px(x, y, 'void:1' if y < 4 else 'void:2')
    # 위에 거미줄 먼지
    for (x, y) in ((5, 0), (6, 1), (7, 2), (42, 0), (41, 1), (40, 2), (5, 2), (43, 3)): c.px(x, y, 'dust:1')
    for i in range(6): c.px(4 + i, 4 - min(4, i), 'dust:2') if False else None
def dust_ends(c, r0):
    for (x, dy) in ((4, 0), (5, 0), (6, 1), (43, 0), (42, 0), (41, 1)):
        c.px(x, r0 + dy, 'dust:4' if dy == 0 else 'dust:3')
    c.px(4, r0 + 1, 'dust:3'); c.px(43, r0 + 1, 'dust:2')
def hole(c, kind):
    # 4,5번째 띠 (k=3,4): 행 24..34
    ya, yb = 24, 34
    if kind == 'C':
        x0, x1 = 8, 40
    else:
        x0, x1 = 10, 32
    # 구멍 기본 모양(들쭉날쭉): 행마다 좌우 끝
    for y in range(ya, yb + 1):
        if y in (29,):  # 띠 사이 줄도 뚫림
            pass
        for x in range(x0, x1 + 1):
            c.px(x, y, 'void:0' if (y + x) % 7 else 'void:1')
    # 안쪽 깊이: 더 안쪽은 void, 가장자리에 널 단면
    if kind == 'C':
        # 위 가장자리 아래로 뻗는 이빨(널 끝), 아래 가장자리 위로 솟는 이빨
        for i, x in enumerate(range(x0 + 1, x1, 4)):
            h = 3 + (i % 2)
            for d in range(h):
                for xx in (x, x + 1):
                    c.px(xx, ya + d, f'rot:{5 - d}' if d < h - 1 else 'rot:2')
            c.px(x, ya + h, 'rot:1')
        for i, x in enumerate(range(x0 + 3, x1 - 1, 4)):
            h = 3 + ((i + 1) % 2)
            for d in range(h):
                for xx in (x, x + 1):
                    c.px(xx, yb - d, f'rot:{4 - d}' if d < h - 1 else 'rot:2')
            c.px(x, yb - h, 'rot:1')
        # 양끝 처짐: 오른쪽 아래 한 단 기울어짐
        for x in range(36, 44):
            c.px(x, 47, 'rot:1'); 
    else:
        # 위쪽 끝 널이 꺾여 늘어짐(왼쪽), 삐죽한 조각
        jag_top = {10: 2, 12: 4, 14: 1, 16: 3, 19: 2, 22: 5, 25: 3, 27: 1, 29: 4, 31: 2}
        for x, h in jag_top.items():
            for d in range(h):
                c.px(x, ya + d, f'rot:{5 - d}' if d < h - 1 else 'rot:2')
                c.px(x + 1, ya + d, f'rot:{4 - d}' if d < h - 1 else 'rot:2')
        jag_bot = {11: 2, 14: 3, 17: 1, 20: 2, 24: 3, 28: 2, 30: 1}
        for x, h in jag_bot.items():
            for d in range(h):
                c.px(x, yb - d, f'rot:{4 - d}' if d < h - 1 else 'rot:1')
        # 휘어 내려온 부러진 널(구멍 안 왼쪽 위에서 오른쪽 아래로)
        for i in range(9):
            c.px(13 + i, 26 + i // 2, 'rot:3'); c.px(13 + i, 27 + i // 2, 'rot:2')
        # 안쪽 아래 단 그림자로 반쯤 보이는 아래 단 윗면(먼지)
        for x in range(14, 30): c.px(x, yb, 'dust:1') if c.get(x, yb) and c.get(x, yb).startswith('void') else None
    # 구멍 옆 깨진 가장자리 단면(밝은 나무 속살)
    for y in range(ya, yb + 1):
        if kind != 'C': c.px(x0 - 1, y, 'rot:5' if y % 3 else 'rot:3')
        else: c.px(x0 - 1, y, 'rot:5' if y % 3 else 'rot:3')
    if kind != 'C': c.px(x1 + 1, 25, 'rot:5'); c.px(x1 + 1, 28, 'rot:5'); c.px(x1 + 1, 32, 'rot:5')
def broken_post(c, kind):
    # 왼쪽 난간 기둥 하나 빠짐: 띠 2(행 18..22)와 띠 3(행 24..28) 사이 왼쪽 난간 -> 투명
    for y in range(19, 29):
        for x in range(0, 4):
            c.px(x, y, None)
    # 부러진 밑동
    for x in range(0, 4): c.px(x, 29, 'mahog:2' if x % 2 else 'mahog:1')
    c.px(0, 28, 'mahog:2'); c.px(1, 28, 'mahog:3'); c.px(3, 27, 'mahog:2')
    c.px(0, 18, 'mahog:3'); c.px(2, 18, 'mahog:4'); c.px(3, 18, 'mahog:5'); c.px(1, 18, 'mahog:2')
    if kind == 'B':
        for y in range(20, 29):
            c.px(0, y, '~'); c.px(1, y, '-')
    # 다음 단 끝(구멍 옆) 안쪽 기둥 자국
def build(kind):
    c = Canvas('stairs_broken', 48, 48)
    frame(c, kind)
    for k, r0 in enumerate(BANDS):
        tread(c, r0, k, kind=kind)
        dust_ends(c, r0)
    if kind == 'B':
        # 빛: 단 윗줄 밝게, 챌판 어둡게, 왼쪽이 오른쪽보다 밝다
        for k, r0 in enumerate(BANDS):
            for x in range(4, 44):
                lf = 1 if x < 16 else (0 if x < 30 else -1)
                c.px(x, r0, f'rot:{min(6, 5 + lf + (1 if k > 3 else 0))}')
                c.px(x, r0 + 1, f'rot:{max(1, 3 + lf)}'); c.px(x, r0 + 2, f'rot:{max(1, 2 + lf)}')
                c.px(x, r0 + 3, f'rot:{1}'); c.px(x, r0 + 4, 'rot:0')
        for k, r0 in enumerate(BANDS):
            for x in (4, 5, 6): c.px(x, r0, 'dust:5')
    hole(c, kind)
    broken_post(c, kind)
    # 위쪽 모서리 비움
    c.px(47, 0, None); c.px(46, 0, None); c.px(47, 1, None)
    c.px(0, 0, None); c.px(1, 0, None)
    if kind == 'B':
        # 구멍 안쪽 깊은 그림자(단 윗줄 아래에 더 어두운 줄)
        for x in range(11, 33): c.px(x, 30, 'void:0'); c.px(x, 31, 'void:0')
    c.outline if False else None
    return c
if __name__ == '__main__':
    for k in 'ABC':
        build(k).save(f'h1-{k}', NOTES[k])
    print('ok')
