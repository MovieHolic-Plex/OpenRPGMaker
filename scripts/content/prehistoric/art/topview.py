"""3/4 윗면 부품 — 위에서 내려다본 «면»이 몇 줄 보이게 그리는 도우미(object-gate 1차에서 떨어진 기둥·틀·의자·돌을 다시 그릴 때 만듦).

기둥 끝은 자른 단면 타원(나이테), 가로 통나무는 윗면 세 줄(둥근 통나무를 비스듬히 내려다본 밝은 등) + 앞면, 돌은 가장자리가 또렷한 윗면 판 + 앞 두께.
빛은 왼쪽 위. 윗면은 앞면보다 두 단 밝다.
"""
import math
from px import h32, rnd, NT, MI


def cut_face(c, cx, cy, rx, ry, mat='bark', rings=True, wood='thatch'):
    """기둥·통나무 끝의 자른 면(위에서 본 타원): 껍질 테(재질 어두운 단) + 속 나무(밝은 짚빛) + 나이테 한 바퀴 + 가운데 심."""
    n = NT[MI[mat]]
    for y in range(int(cy - ry - 1), int(cy + ry + 2)):
        for x in range(int(cx - rx - 1), int(cx + rx + 2)):
            dx = (x + 0.5 - cx) / rx; dy = (y + 0.5 - cy) / ry
            d = dx * dx + dy * dy
            if d > 1: continue
            if d > 0.7:
                t = n - 2 if dy < 0 and dx < 0.3 else n - 3 if dy < 0.3 else n - 4
                c.P(x, y, mat, t); continue
            if not rings or wood is None:
                c.P(x, y, mat, n - 1); continue
            wn = NT[MI[wood]]
            t = wn - 2 if dx + dy < -0.2 else wn - 3
            if rings and 0.22 < d < 0.38: t -= 1
            if d < 0.06: t = wn - 4
            c.P(x, y, wood, t)


def post_top(c, x, top, bot, w=5, mat='bark', ry=None):
    """세운 기둥: 몸(왼쪽 빛·오른쪽 그늘·결) + 꼭대기 자른 면 타원(윗면 ry*2 줄)."""
    n = NT[MI[mat]]
    ry = ry if ry is not None else max(2.0, w * 0.4)
    cy = top + ry
    for y in range(int(cy), bot + 1):
        for i in range(w):
            u = (i + 0.5) / w
            t = n - 3 + (1 if u < 0.3 else 0 if u < 0.7 else -1)
            if (i + y // 3) % 5 == 2 and 0.2 < u < 0.8: t -= 1
            c.P(x + i, y, mat, max(0, min(n - 1, t)))
    cut_face(c, x + w / 2, cy, w / 2 + 0.2, ry, mat)


def log_beam(c, x0, x1, y, mat='bark', top=3, front=2, ends=True):
    """가로로 누운 통나무(동서): 위에서 비스듬히 본 둥근 등 top 줄(밝게) + 앞면 front 줄(어둡게) + 밑 그늘. 양 끝은 자른 면."""
    n = NT[MI[mat]]
    for x in range(x0, x1 + 1):
        for j in range(top):
            t = n - 1 if j == 0 else n - 2
            if j == top - 1: t = n - 2 if (x - x0) % 6 else n - 3
            if (x + j * 3) % 9 == 0 and j > 0: t -= 1
            c.P(x, y + j, mat, t)
        for j in range(front):
            c.P(x, y + top + j, mat, n - 4 if j < front - 1 else n - 5)
    if ends:
        r = (top + front) / 2
        for ex in (x0, x1):
            cut_face(c, ex + (0.5 if ex == x0 else 0.5), y + r - 0.5, 1.3, r, mat)


def slab(c, cx, cy, rx, ry, thick, mat='stone', s=0, rough=0.12, top_t=None, edge_up=True):
    """판판한 돌판: 가장자리가 울퉁불퉁한 윗면 타원(밝게, 이끼·금 몇) + 앞 두께 thick 줄(어둡게) + 앞 윗변 빛선."""
    n = NT[MI[mat]]
    tt = top_t if top_t is not None else n - 2
    for y in range(int(cy - ry - 2), int(cy + ry + thick + 2)):
        for x in range(int(cx - rx - 2), int(cx + rx + 2)):
            dx = (x + 0.5 - cx) / rx
            if abs(dx) > 1: continue
            wob = (h32(int(x // 3), 1, s) % 5 - 2) * rough
            # 윗면
            dy = (y + 0.5 - cy) / ry
            if dx * dx + dy * dy <= 1 + wob:
                t = tt + (1 if dx + dy < -0.6 else 0) - (1 if dx > 0.55 else 0)
                if rnd(x // 2, y // 2, s + 3) < 0.07: t -= 1
                c.P(x, y, mat, max(1, min(n - 1, t)))
                continue
            # 앞 두께(윗면 앞 가장자리 아래 thick 줄)
            yb = cy + ry * math.sqrt(max(0.0, 1 - dx * dx))
            if yb <= y + 0.5 <= yb + thick and dx * dx < 0.98:
                k = (y + 0.5 - yb) / max(1, thick)
                t = n - 4 + (1 if dx < -0.4 else 0) - (1 if dx > 0.4 else 0) - (1 if k > 0.7 else 0)
                c.P(x, y, mat, max(1, min(n - 1, t)))
    if edge_up:
        for x in range(int(cx - rx), int(cx + rx) + 1):
            dx = (x + 0.5 - cx) / rx
            if abs(dx) >= 1: continue
            yb = int(cy + ry * math.sqrt(max(0.0, 1 - dx * dx)))
            if c.get(x, yb) and c.get(x, yb)[0] == mat: c.P(x, yb, mat, n - 1 if dx < 0.2 else n - 2)


def ellipse_ring_pts(cx, cy, rx, ry, k, n, phase=0.0):
    a = 2 * math.pi * k / n + phase
    return cx + math.cos(a) * rx, cy + math.sin(a) * ry, math.sin(a)
