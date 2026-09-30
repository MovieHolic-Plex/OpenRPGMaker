import sys
sys.path.insert(0, '/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick/tiledata/atlas-pick/candidates-horror/blood_pool/work')
from blood import *
SLUG = 'writing_wall'
def rect(m, x0, y0, x1, y1):
    for y in range(y0, y1+1):
        for x in range(x0, x1+1): m.add((x, y))
RING = [".#####.", "#######", "##...##", "##...##", "##...##", "#######", ".#####."]
def text_mask():
    m = set()
    # 도: ㄷ (위 가로, 왼 세로, 아래 가로) + ㅗ
    rect(m, 2, 1, 12, 2); rect(m, 2, 3, 3, 5); rect(m, 2, 6, 12, 7)
    rect(m, 7, 8, 8, 9); rect(m, 1, 10, 13, 11)
    # 와: ㅇ + ㅗ + ㅏ
    ox, oy = 17, 1
    for j, r in enumerate(RING):
        for i, ch in enumerate(r):
            if ch == '#': m.add((ox+i, oy+j))
    rect(m, 19, 8, 20, 9); rect(m, 17, 10, 29, 11)
    rect(m, 26, 0, 27, 9); rect(m, 28, 4, 29, 5)
    return m
def drips(g, spec, tones):
    for x, y0, n in spec:
        for k in range(n):
            g.put(x, y0+k, tones[0] if k < n-2 else tones[1] if k == n-2 else tones[2])
def build(hi, mid, edge, low, glint, eye=False, shade=False):
    g = G(32, 16); m = text_mask()
    paint(g, m, hi=hi, mid=mid, edge=edge, low=low, glint=glint, bleed=1, bleed_lr=1)
    # 획 끝에서 흘러내린 줄 (아래 가로 획 밑에서만)
    drips(g, [(3, 12, 4), (6, 12, 2), (11, 12, 3), (18, 12, 3), (24, 12, 4), (28, 12, 2)], (mid, edge, low))
    for x, y0, n in [(3, 12, 4), (11, 12, 3), (24, 12, 4)]:
        g.put(x, y0+n, mid if n > 3 else edge)   # 끝의 방울
    # 도 ㄷ 아래 가로획에서 안쪽으로도 한 줄 (ㅗ 위)
    drips(g, [(4, 8, 2)], (mid, edge, low))
    for y in range(16):
        for x in range(32):
            if g.get(x, y) == '.' and g.get(x-1, y) in '012345' and g.get(x, y-1) in '012345' and x > 0 and y > 0 and (x + y) % 2 == 0: g.put(x, y, '$')
    if eye:
        for j in range(3):
            for i in range(3): g.put(19+i, 3+j, 'e')
        g.put(20, 4, '1'); g.put(20, 3, 'b'); g.put(19, 3, 'b') if False else None
        g.pts('c', 19, 5, 21, 5)
    if shade:
        for y in range(16):
            for x in range(31):
                if g.get(x, y) in '01' and g.get(x+1, y) == '.': g.put(x+1, y, '-')
    return g
a = build('4', '3', '2', '1', '5')
b = build('5', '2', '1', '0', '5', shade=True)
c = build('4', '3', '2', '1', '5', eye=True)
notes = {
 'A': ('벽 핏글씨 「도와」: 획 2px, 왼쪽 위 밝고 오른쪽 아래 어두운 단, 가로획 밑에서 흘러내린 줄과 끝 방울, $ 번짐', a),
 'B': ('대비 강화: 윗획 blood 5 단, 속 2, 아랫테 0, 오른쪽 접지 반투명 그늘 한 줄', b),
 'C': ('「와」의 ㅇ 안이 눈: 흰자(sheet)에 blood 눈동자, 글씨가 이쪽을 보고 있다', c),
}
finish(SLUG, notes, LG)
