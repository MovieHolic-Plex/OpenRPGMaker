"""r2 매표기 3×2(48×32) 작도 — 공간감: 윗면 비스듬한 조작판(밝은 단 4줄)·기계 사이 1px 틈 그림자·오른 끝 옆면(한 단 어둡게)·뒷벽 운임표(기계보다 한 단 어둡게 물러남).
가로: 왼 윤곽 x=0 · 기계1 x=1..13 · 틈 x=14 · 기계2 x=15..27 · 틈 x=28 · 기계3 x=29..41 · 옆면 x=42..45 · 오른 윤곽 x=46.
색은 (램프, 단)을 손으로 놓는다 — 계산·보간 없음."""
import sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'torii', 'work'))
from j3_lib import Grid, C, sh

XS = [1, 15, 29]; W = 13
LINES = [('kblue', 3), ('akachin', 3), ('kgreen', 3), ('korange', 3), ('taxi', 3)]

def board(g, d, x0, x1, y0, y1):
    """뒷벽 운임표: 기계보다 한 단 어둡게. 색 띠는 노선, 흰 점은 숫자 자리(글자 아님)."""
    bg = ('mconc', 1) if d != 'B' else ('mconc', 0)
    g.rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, bg)
    fr = ('mmetal', 2) if d != 'B' else ('mmetal', 1)
    g.hl(x0, y0, x1 - x0 + 1, sh(fr, 1)); g.hl(x0, y1, x1 - x0 + 1, sh(fr, -1))
    g.vl(x0, y0, y1 - y0 + 1, sh(fr, 1)); g.vl(x1, y0, y1 - y0 + 1, sh(fr, -1))
    n = 3 if y1 - y0 >= 8 else 2
    lit = 0 if d != 'B' else -1
    for r in range(n):
        yy = y0 + 2 + r * 3
        if yy + 1 > y1 - 1: break
        for k in range(6):
            xx = x0 + 3 + k * 7
            if xx + 5 > x1 - 1: break
            c = LINES[(k + r * 2) % 5]
            g.hl(xx, yy, 3, sh(c, lit - 1))            # 노선 색 띠
            g.px(xx + 4, yy, ('washi', 2 if d != 'B' else 1)); g.px(xx + 5, yy, ('washi', 1 if d != 'B' else 0))   # 운임 자리 점
            g.px(xx + 4, yy + 1, ('washi', 1 if d != 'B' else 0))

def machine(g, d, x0, y0, last, tall=False, sign=None, front_h=None):
    """y0 = 윗 윤곽 줄. 판 y0+1..y0+4, 앞면 y0+5..27."""
    bodyF = {'A': 4, 'B': 3, 'C': 4}[d]
    F = C('mmetal', bodyF)
    O = ('mmetal', 1); OD = ('mmetal', 0)
    fy0 = y0 + 5
    fh = 27 - fy0 + 1
    # 윗 윤곽
    g.hl(x0, y0, W, O)
    # 비스듬한 조작판(밝은 단 4줄): 위로 갈수록 밝다
    ptone = {'A': [7, 6, 5, 4], 'B': [6, 5, 4, 3], 'C': [7, 6, 5, 4]}[d]
    for r in range(4):
        g.hl(x0, y0 + 1 + r, W, ('mmetal', ptone[r]))
    # 판 위 버튼(1px 색 점) + 표시 창
    by = y0 + 2
    g.rect(x0 + 1, by, 3, 2, ('lacq', 1)); g.hl(x0 + 1, by, 3, ('neonc', 4)); g.px(x0 + 3, by + 1, ('neonc', 2))
    for i, c in enumerate([('kblue', 4), ('akachin', 4), ('kgreen', 4), ('korange', 4)]):
        g.px(x0 + 5 + i * 2, by, c); g.px(x0 + 5 + i * 2, by + 1, sh(c, -2))
    g.hl(x0, y0 + 4, W, ('mmetal', 3 if d != 'B' else 2))            # 판 앞 턱
    # 앞면
    g.rect(x0, fy0, W, fh, F)
    g.vl(x0, fy0, fh, sh(F, 1)); g.vl(x0 + W - 1, fy0, fh, sh(F, -1))
    # 화면(청록) — 검은 테두리 안
    sx0 = x0 + 2; sw = W - 4
    sy0 = fy0 + 1; sh_ = 5
    g.rect(sx0 - 1, sy0 - 1, sw + 2, sh_ + 2, ('lacq', 1))
    if d == 'B':
        g.rect(sx0, sy0, sw, sh_, ('neonc', 5)); g.hl(sx0, sy0, sw, ('neonc', 4)); g.hl(sx0, sy0 + sh_ - 1, sw, ('neonc', 3))
    else:
        g.rect(sx0, sy0, sw, sh_, ('neonc', 3)); g.hl(sx0, sy0, sw, ('neonc', 4)); g.hl(sx0, sy0 + sh_ - 1, sw, ('neonc', 2))
    # 화면 안 노선 줄(색 점)
    for k in range(3):
        c = LINES[(k + x0) % 5]
        g.hl(sx0 + 1, sy0 + 1 + (k % 2) * 2, 2, sh(c, 1)); g.px(sx0 + 5 + (k % 2), sy0 + 1 + (k % 2) * 2, ('lacq', 1))
    # 지폐 구멍(가로 긴 홈)·동전 구멍(작은 홈)
    iy = sy0 + sh_ + 2
    g.hl(x0 + 2, iy, 6, ('mmetal', 6)); g.hl(x0 + 2, iy + 1, 6, ('lacq', 0))
    g.rect(x0 + 9, iy, 2, 2, ('mmetal', 5)); g.px(x0 + 9, iy + 1, ('lacq', 0)); g.px(x0 + 10, iy + 1, ('lacq', 0))
    # 승차권 배출구(아래 받침 접시)
    oy = iy + 3
    if oy + 3 <= 27:
        g.rect(x0 + 2, oy, W - 4, 27 - oy, ('lacq', 0))
        g.hl(x0 + 2, oy, W - 4, ('mmetal', 6)); g.hl(x0 + 2, oy + 1, W - 4, ('lacq', 2))
    # 아랫띠·발판
    g.hl(x0, 27, W, sh(F, -1))
    g.hl(x0, 28, W, ('mmetal', 3)); g.hl(x0, 29, W, ('mmetal', 1))

def seam(g, d, x, y0):
    """기계 사이 1px 틈 그림자 — 윗 윤곽부터 발판까지."""
    for y in range(y0, 30):
        g.px(x, y, ('lacq', 0) if d != 'B' else ('neonc', 2 if 15 <= y <= 27 else 0))

def side(g, d, y0, top_row=None):
    """오른 끝 옆면 x=42..45, 앞면보다 한 단 어둡게. 판 옆면도 한 단 어둡게."""
    F = C('mmetal', {'A': 4, 'B': 3, 'C': 4}[d]); S = sh(F, -2)
    fy0 = y0 + 5
    g.hl(42, y0, 4, ('mmetal', 1))
    ptone = {'A': [7, 6, 5, 4], 'B': [6, 5, 4, 3], 'C': [7, 6, 5, 4]}[d]
    for r in range(4): g.hl(42, y0 + 1 + r, 4, ('mmetal', ptone[r] - 2))
    g.rect(42, fy0, 4, 27 - fy0 + 1, S)
    g.vl(42, fy0, 27 - fy0 + 1, sh(S, 1)); g.vl(45, fy0, 27 - fy0 + 1, sh(S, -1))
    g.hl(42, 27, 4, sh(S, -1)); g.hl(42, 28, 4, ('mmetal', 2)); g.hl(42, 29, 4, ('mmetal', 0))
    g.vl(46, y0, 30 - y0, ('mmetal', 0))
    g.vl(0, y0, 30 - y0, ('mmetal', 1))

def ground(g, d):
    if d == 'B':
        g.hl(2, 30, 44, '~'); g.hl(3, 31, 42, '-')
        for x0 in XS: g.hl(x0 + 2, 30, 8, '%'); g.hl(x0 + 3, 31, 6, '%')
        g.hl(2, 30, 3, '~')
    else:
        g.hl(1, 30, 46, '~'); g.hl(3, 31, 43, '-')

def make(d):
    g = Grid(48, 32)
    if d != 'C':
        board(g, d, 1, 45, 0, 9)
        for i, x0 in enumerate(XS): machine(g, d, x0, 10, i == 2)
        side(g, d, 10)
        seam(g, d, 14, 10); seam(g, d, 28, 10)
    else:
        board(g, d, 1, 45, 0, 11)
        # 좌우 기계는 낮게(y0=12), 가운데는 노선도 상자를 이고 높게(y0=8)
        machine(g, d, XS[0], 12, False); machine(g, d, XS[2], 12, True)
        machine(g, d, XS[1], 8, False)
        # 가운데 머리 상자(노선도 등): y=4..7, 몸통보다 좌우 1px 넓게 x=14..28
        g.hl(14, 3, 15, ('mmetal', 1))
        g.rect(14, 4, 15, 4, ('mmetal', 4)); g.hl(14, 4, 15, ('mmetal', 6))
        g.rect(15, 5, 13, 2, ('neonc', 3)); g.hl(15, 5, 13, ('neonc', 4))
        for k, c in enumerate(LINES): g.hl(16 + k * 2 + (k // 3), 5 + (k % 2), 2, sh(c, 1))
        g.vl(14, 4, 4, ('mmetal', 5)); g.vl(28, 4, 4, ('mmetal', 2))
        g.hl(14, 7, 15, ('mmetal', 3))
        side(g, d, 12)
        # 오른 옆면은 낮은 기계 기준이다. 가운데 기계 옆(x=28 틈)은 오른 기계 윗면 그림자로 잇는다
        seam(g, d, 14, 12); seam(g, d, 28, 12)
        for y in range(8, 12): g.px(14, y, ('mmetal', 0)); g.px(28, y, ('mmetal', 0))
    ground(g, d)
    return g

NOTES = {
 'A': '강남 결: 뒷벽 어두운 운임표(노선 색 띠) 앞에 회색 기계 셋이 붙어 선다. 각 기계 윗면은 비스듬한 조작판(밝은 4단, 표시창·색 버튼 점), 청록 화면·지폐/동전 구멍·승차권 접시, 기계 사이 1px 틈 그림자, 오른 끝 옆면 4px 한 단 어둡게, 발치 그림자 2줄',
 'B': '명암 강화: 몸체를 한 단 눌러 청록 화면이 밝게 뜨고 두 기계 사이 틈으로 청록 빛이 새며 바닥에 %가 번진다. 운임표는 더 어둡게 물러남, 접지 그림자 2줄+옅은 줄. 밤 역 매표소.',
 'C': '실루엣 재해석: 가운데 기계만 노선도 등 상자를 이고 높이 솟고 좌우 기계는 낮게 붙는다(계단 실루엣). 운임표는 양옆 위로 보이고 오른 끝 옆면 한 단 어둡게.',
}
if __name__ == '__main__':
    for d in 'ABC':
        p = os.path.abspath(os.path.join(HERE, '..', f'r2-{d}.pxg'))
        make(d).emit(p, NOTES[d], header=f'ticket_machine r2-{d}')
