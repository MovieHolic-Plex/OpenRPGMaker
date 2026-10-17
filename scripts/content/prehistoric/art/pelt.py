"""짐승 가죽 펼친 모양(털 깔개·잠자리·차양 속 털가죽)을 그리는 도우미."""
from px import C, h32  # noqa: F401


def pelt_mask(x, y, cx, cy, rx, ry):
    """짐승 가죽 펼친 모양: 몸통 타원 + 네 다리 자락(대각 모서리) + 머리 자락(위) + 꼬리(아래)."""
    dx = (x + 0.5 - cx) / rx; dy = (y + 0.5 - cy) / ry
    if dx * dx + dy * dy <= 1: return True
    for sx in (-1, 1):
        for sy in (-1, 1):
            # 다리 자락: 몸통 모서리에서 바깥 대각으로 뻗은 짧은 혀 모양
            lx = (x + 0.5 - (cx + sx * rx * 0.78)) ; ly = (y + 0.5 - (cy + sy * ry * 0.62))
            u = lx * sx + ly * sy * 0.6; v = -lx * sy * 0.6 + ly * sx
            if 0 <= u <= rx * 0.42 and abs(v) <= 2.2 - u * 0.25: return True
    hx = (x + 0.5 - cx) / (rx * 0.32); hy = (y + 0.5 - (cy - ry * 1.02)) / (ry * 0.34)
    if hx * hx + hy * hy <= 1: return True
    tx = abs(x + 0.5 - cx); ty = y + 0.5 - (cy + ry * 0.9)
    return 0 <= ty <= ry * 0.42 and tx <= 1.4
def pelt(c, cx, cy, rx, ry, mat='fur', base=3, s=0):
    pts = [(x, y) for y in range(c.h) for x in range(c.w) if pelt_mask(x, y, cx, cy, rx, ry)]
    S = set(pts)
    for (x, y) in pts:
        u = (x + 0.5 - cx) / rx + (y + 0.5 - cy) / ry           # 왼쪽 위 빛
        t = base + (1 if u < -0.55 else 0) - (1 if u > 0.6 else 0)
        # 털결: 짧은 세로 획(2~3줄), 등줄기 쪽으로 기운다
        if h32(x, (y + (x % 3)) // 3, s + 5) % 5 == 0: t += 1
        elif h32(x, (y + (x % 3)) // 3, s + 9) % 6 == 0: t -= 1
        if abs(x + 0.5 - cx) < 1 and abs(y + 0.5 - cy) < ry * 0.8: t -= 1   # 등줄기
        edge = any((x + a, y + b) not in S for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        if edge: t = 0 if (x + y) % 2 else 1                               # 술 진 가장자리
        c.P(x, y, mat, t)
    return S
