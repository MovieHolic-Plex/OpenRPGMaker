"""봉우리 몸통·외딴 칸 그리기 (torus 16x16)."""
from w3lib import *

def draw_peak(put, cx, ay, h, w, pal, jagL=(), jagR=(), ridge_sh=(), creases=(), snow=None, wrap=True, snowc=None):
    """put(x,y,pix). i=0..h 줄. jagL/jagR: 줄별 반폭 가감(dict i->d). ridge_sh: dict i->능선 이동. creases: [(i,dx,char)].
    snow: dict dx->눈 아래 경계 i(포함). 눈 경계 줄은 v(눈 그림자)로 톱니."""
    for i in range(h + 1):
        y = ay + i
        hw = w * (i + 0.7) / (h + 0.7)
        hl = max(0, int(round(hw))) + jagL.get(i, 0) if isinstance(jagL, dict) else int(round(hw))
        hr = max(0, int(round(hw))) + jagR.get(i, 0) if isinstance(jagR, dict) else int(round(hw))
        rg = ridge_sh.get(i, 0) if isinstance(ridge_sh, dict) else 0
        for dx in range(-hl, hr + 1):
            x = cx + dx
            if dx == -hl and hl > 0: c = 'M'
            elif dx == hr and hr > 0: c = 'O'
            elif dx < rg: c = 'L'
            elif dx == rg: c = 'h'
            else: c = 'R'
            if i == h: c = 'D' if dx >= rg else 'M'
            if i >= h - 1 and c == 'L': c = 'M'
            if snow is not None:
                lim = snow.get(dx)
                if lim is not None and i <= lim and abs(dx) < max(hl, hr) + 0:
                    if i == lim: c = 'v' if dx >= rg else 'u'
                    else: c = 'W' if dx < rg else ('V' if dx > rg else 'H')
                    if dx == -hl or dx == hr: c = 'v' if dx > 0 else 'u'
            put(x, y, c)
    for (i, dx, c) in creases:
        put(cx + dx, ay + i, c)
