"""풍차 둥근 갓(위에서 비스듬히 본 돔): 작은 나무 비늘이 줄마다 밑 타원과 나란히 휘고(줄 = 수평 원의 투영),
줄의 비늘 수는 그 줄 둘레에 비례해 꼭대기로 갈수록 줄어든다. 왼쪽 밝음 → 오른쪽 어둠 계단. 난수 없음."""
import math

WOOD_BANDS = [('σ', 'ξ', 'η'), ('ξ', 'μ', 'ζ'), ('μ', 'η', 'ε'), ('η', 'ζ', 'δ'), ('ζ', 'ε', 'γ'), ('ε', 'δ', '-')]


def band(f):
    if f < -0.86:
        return 1
    for lim, b in ((-0.5, 0), (-0.12, 1), (0.25, 2), (0.58, 3), (0.82, 4)):
        if f < lim:
            return b
    return 5


def dome(c, cx, apex_y, base_y, hw, ell, th=3, sw=3.4, start=0, bands=WOOD_BANDS):
    """apex_y 꼭대기, base_y 앞 가운데가 아닌 '처마 원 중심' 높이. 처마 앞끝은 base_y+ell."""
    H = base_y - apex_y
    pts = {}
    for y in range(apex_y, base_y + ell + 1):
        for x in range(int(cx - hw) - 1, int(cx + hw) + 2):
            dx = x + 0.5 - cx
            t = min(1.0, max(0.0, (y + 0.5 - apex_y) / H))
            half = hw * math.sqrt(max(0.0, 1 - (1 - t) ** 2))     # 돔 윤곽
            if half < 0.5 or abs(dx) > half:
                continue
            f = dx / half
            bump = ell * (half / hw) * math.sqrt(max(0.0, 1 - f * f))
            if y > base_y + bump:
                continue
            v = y + 0.5 - apex_y - bump * 0.9
            row = int(v // th)
            lv = int(v % th)
            n = max(2, int(round(math.pi * half / sw)))
            ang = math.asin(max(-1.0, min(1.0, f)))
            p = (ang / math.pi + 0.5) * n + (0.5 if (row + start) % 2 else 0.0)
            col = int(math.floor(p))
            fr = p - col
            b = band(dx / hw * 1.05)
            hi, body, sh = bands[b]
            var = '0102000120010020'[(row * 3 + col * 5 + start) % 16]
            if var == '1' and b >= 1:
                body = hi
            elif var == '2' and b <= 4:
                body = sh
            if lv == th - 1:
                ch = sh
            elif fr < 0.22:
                ch = hi if lv == 0 else body
            elif fr > 0.85:
                ch = sh
            else:
                ch = body
            pts[(x, y)] = ch
    for (x, y), ch in pts.items():
        c.put(x, y, ch)
    return pts


def dome_eave(c, cx, base_y, hw, ell):
    """처마 앞 두께 2줄 + 밑 그늘 1줄(밑 타원 앞 반쪽)."""
    for x in range(int(cx - hw), int(cx + hw) + 1):
        dx = x + 0.5 - cx
        if abs(dx) > hw:
            continue
        f = dx / hw
        y = int(round(base_y + ell * math.sqrt(max(0, 1 - f * f))))
        b = band(f)
        c.put(x, y, ['η', 'η', 'ζ', 'ε', 'δ', 'γ'][b])
        c.put(x, y + 1, ['ε', 'ε', 'δ', 'γ', '-', '-'][b])
