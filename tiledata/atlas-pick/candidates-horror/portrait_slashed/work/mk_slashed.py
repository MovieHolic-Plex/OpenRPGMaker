import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'portrait_eyes', 'work'))
from mk_eyes import make, shadowB
NOTES = {
 'A': "A: portrait_eyes A 와 같은 낡은 액자 — 캔버스를 X 로 그어 찢고, 왼쪽 삼각 조각(얼굴 절반)이 아래로 늘어져 걸려 있다. 찢긴 틈 뒤는 벽이 아니라 캔버스 뒷면의 어둠.",
 'B': "B: portrait_eyes B 와 같은 14칸 액자·오른쪽 아래 그림자 — X 로 찢고 얼굴 조각이 아래로 늘어짐. 찢긴 자리 안쪽 가장자리는 왼쪽 위 빛을 받아 밝고 아래쪽은 어둡다.",
 'C': "C: portrait_eyes C 의 타원 액자 — 세로로 길게 X 를 긋고 긴 얼굴 조각이 아래로 흘러내려 걸려 있다. 얼굴이 원래보다 더 길어 보이는 것이 어긋난 곳.",
}
def slash(c, k):
    # 캔버스 안쪽 = tarn 이 아닌 칸
    inner = [(x, y) for y in range(c.H) for x in range(c.W)
             if c.get(x, y) and not c.get(x, y).startswith(('tarn', '~', '-'))]
    xs = [p[0] for p in inner]; ys = [p[1] for p in inner]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    cx = (x0 + x1 + 1) / 2.0; cy = (y0 + y1 + 1) / 2.0 - (1 if k != 'C' else 0)
    s = (y1 - y0) / float(x1 - x0) * 0.9   # 대각선 기울기(캔버스 모서리에서 모서리까지에 가깝게)
    S = set(inner)
    def d1(x, y): return (y + .5 - cy) - s * (x + .5 - cx)      # \ 방향 거리
    def d2(x, y): return (y + .5 - cy) + s * (x + .5 - cx)      # / 방향 거리
    w = 0.9
    cut = set()
    for (x, y) in inner:
        a, b = abs(d1(x, y)), abs(d2(x, y))
        thick = w + (0.7 if (x % 3 == 0) else 0)              # 톱니
        if a < thick or b < thick * 0.9: cut.add((x, y))
    # 왼쪽 조각: 두 선 사이 왼쪽 삼각
    flap = set()
    for (x, y) in inner:
        if (x, y) in cut: continue
        if d1(x, y) < 0 and d2(x, y) > 0 and x + .5 < cx: flap.add((x, y))   # 왼쪽 쐐기
    orig = {p: c.get(*p) for p in inner}
    drop = 2
    for p in flap: c.px(p[0], p[1], None)
    for p in cut: c.px(p[0], p[1], 'paper:1')
    # 늘어진 조각을 아래로 옮겨 얹는다(캔버스 안쪽에서만)
    moved = set()
    for (x, y) in flap:
        ny = y + drop
        if (x, ny) in S and (x, ny) not in cut:
            c.px(x, ny, orig[(x, y)]); moved.add((x, ny))
        elif (x, ny) in S: c.px(x, ny, orig[(x, y)]); moved.add((x, ny))
    # 조각이 떠난 자리는 캔버스 뒷면의 어둠
    for p in flap:
        if p not in moved: c.px(p[0], p[1], 'paper:1')
    # 조각 가장자리: 종이 단면(밝은 테)
    for (x, y) in moved:
        if (x + 1, y - 1) not in moved and (x, y - 1) not in moved: c.px(x, y, 'paper:4')
    # 찢긴 선 위쪽 가장자리에 말린 캔버스 테(왼쪽 위 빛 → 밝게)
    for (x, y) in cut:
        for (dx, dy) in ((-1, 0), (0, -1)):
            q = (x + dx, y + dy)
            if q in S and q not in cut and q not in moved and c.get(*q) and not c.get(*q).startswith('void'):
                if k != 'C' or True: c.px(q[0], q[1], 'paper:3' if (x + y) % 2 == 0 else 'paper:2')
    return c

if __name__ == '__main__':
    for k in 'ABC':
        c = make(k, True)
        slash(c, k)
        if k == 'B':
            shadowB(c)
        c.save(f'h1-{k}', NOTES[k])
    print('ok')
