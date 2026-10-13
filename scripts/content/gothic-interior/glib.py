"""gothic_manor 실내 조각 — 자체완결 16px 손 도트 페인터(코드 도트). 램프는 beodeul_city 보다 채도·명도 한 단계 낮춘 청회색·검붉음·고사목 갈색."""
import numpy as np

def H(s): return tuple(int(s[i:i+2], 16) for i in (1, 3, 5)) + (255,)
RAMPS = {  # 어두움 -> 밝음 (6단)
    'stone': [H(x) for x in ('#1c2029', '#2b303c', '#3d4452', '#535c6c', '#6e7889', '#8b95a5')],
    'wood':  [H(x) for x in ('#1f1713', '#2f2219', '#43301f', '#5a4128', '#75563a', '#917049')],
    'red':   [H(x) for x in ('#240c10', '#3a1218', '#531a22', '#6e242e', '#8a3340', '#a4505a')],
    'brass': [H(x) for x in ('#2a2012', '#44331a', '#63502a', '#85703c', '#a68e52', '#c4ad72')],
    'glass': [H(x) for x in ('#1e2b30', '#2f424a', '#44606a', '#5f8089', '#82a3aa', '#a9c6c9')],
    'bone':  [H(x) for x in ('#3a342c', '#5a5244', '#7d7360', '#9c917a', '#bdb298', '#d8cfb6')],
    'blood': [H(x) for x in ('#1a0507', '#2e0a0e', '#4a0f14', '#6b1519', '#8c1d20', '#a6302e')],
    'flame': [H(x) for x in ('#6b2a12', '#b0541c', '#d98a2c', '#f0c354', '#fbe9a0', '#fff6cf')],
    'green': [H(x) for x in ('#101d18', '#1a2e26', '#27443a', '#365c4e', '#4a7866', '#648f7c')],
    'night': [H(x) for x in ('#0b0f1a', '#141b2c', '#1f2a40', '#2e3d5a', '#44587c', '#6a82a8')],
}
R_ = RAMPS

def hsh(x, y, s=0):
    n = (x * 374761393 + y * 668265263 + s * 2147483647) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return (n ^ (n >> 16)) & 0xFFFF

class Cv:
    def __init__(s, w, h): s.w, s.h = w, h; s.a = np.zeros((h, w, 4), np.uint8)
    def P(s, x, y, c):
        if 0 <= x < s.w and 0 <= y < s.h: s.a[y, x] = c
    def R(s, x, y, w, h, c):
        for j in range(h):
            for i in range(w): s.P(x + i, y + j, c)
    def HL(s, x, y, w, c): s.R(x, y, w, 1, c)
    def VL(s, x, y, h, c): s.R(x, y, 1, h, c)
    def ell(s, cx, cy, rx, ry, c):
        for j in range(-ry, ry + 1):
            for i in range(-rx, rx + 1):
                if (i / (rx + .4)) ** 2 + (j / (ry + .4)) ** 2 <= 1: s.P(cx + i, cy + j, c)
    def speck(s, x, y, w, h, c, p, seed=1, only=None):
        for j in range(y, y + h):
            for i in range(x, x + w):
                if 0 <= i < s.w and 0 <= j < s.h and s.a[j, i, 3] and hsh(i, j, seed) % 100 < p:
                    if only is None or tuple(s.a[j, i]) == only: s.a[j, i] = c
    def outline(s, k=.42):
        m = s.a[:, :, 3] > 0; out = s.a.copy()
        for j in range(s.h):
            for i in range(s.w):
                if not m[j, i]: continue
                edge = any(not (0 <= i + di < s.w and 0 <= j + dj < s.h) or not m[j + dj, i + di] for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)))
                if edge:
                    up = not (j > 0 and m[j - 1, i])
                    f = k + .22 if up else k
                    out[j, i, :3] = (s.a[j, i, :3] * f).astype(np.uint8)
        s.a = out
    def img(s):
        from PIL import Image
        return Image.fromarray(s.a, 'RGBA')

def box3(c, x, y, w, top, front, tr, fr, seed=3):
    """3/4 상자: 윗면 top행(뒤 가장자리 어둡게·앞 가장자리 밝게·결) + 앞면 front행(왼쪽 밝게·오른쪽 어둡게·밑 그늘)."""
    t, f = R_[tr], R_[fr]
    c.R(x, y, w, top, t[4]); c.HL(x, y, w, t[1]); c.HL(x, y + 1, w, t[2])
    c.HL(x + 1, y + top - 1, w - 2, t[5]); c.HL(x, y + top - 2, w, t[4]); c.speck(x, y + 2, w, top - 4, t[5], 22, seed); c.speck(x, y + 2, w, top - 3, t[3], 16, seed + 1)
    c.VL(x, y + 1, top - 1, t[5]); c.VL(x + w - 1, y + 1, top - 1, t[3])
    c.R(x, y + top, w, front, f[2]); c.HL(x, y + top, w, f[1]); c.VL(x, y + top, front, f[3]); c.VL(x + 1, y + top, front, f[3]); c.VL(x + w - 1, y + top, front, f[1]); c.VL(x + w - 2, y + top, front, f[1])
    c.HL(x, y + top + front - 1, w, f[0]); c.HL(x, y + top + front - 2, w, f[1])
    c.speck(x + 2, y + top, w - 4, front - 2, f[3], 12, seed + 2); c.speck(x + 2, y + top + 1, w - 4, front - 3, f[1], 14, seed + 3)

def pad16(c):
    from PIL import Image
    im = c.img(); w = -(-im.width // 16) * 16; h = -(-im.height // 16) * 16
    o = Image.new('RGBA', (w, h), (0, 0, 0, 0)); o.paste(im, ((w - im.width) // 2, h - im.height)); return o
