import sys, os; sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'wall_stone_block', 'work'))
from hf7_lib import *

def build(P, dust=False, cobweb=False, rust=False):
    """P: 나무 단 사전 out/postL/postD/top/topLo/back/boardHi/boardLo/base/baseLo, 물건 단 gl/cl/bx/ds"""
    g = G(16, 32)
    W = 'w'
    g.hline(1, 2, 14, W, P['out'])
    for y in range(3, 31):
        g.put(1, y, W, P['out']); g.put(14, y, W, P['out'])
        g.put(2, y, W, P['postL']); g.put(3, y, W, P['postL'] - 1)
        g.put(12, y, W, P['postD']); g.put(13, y, W, P['postD'] - 1)
    # 윗판 y3-4
    g.hline(2, 3, 12, W, P['top']); g.hline(2, 4, 12, W, P['topLo'])
    # 칸 뒤판
    for a, b in ((5, 11), (14, 20), (23, 28)): g.rect(4, a, 8, b - a + 1, W, P['back'])
    # 안쪽 윗 그림자 한 줄
    for a in (5, 14, 23): g.hline(4, a, 8, W, max(0, P['back'] - 1))
    # 선반 판 y12-13, y21-22
    for a in (12, 21):
        g.hline(2, a, 12, W, P['boardHi']); g.hline(2, a + 1, 12, W, P['boardLo'])
    # 바닥 y29-30, 외곽선 y31
    g.hline(2, 29, 12, W, P['base']); g.hline(2, 30, 12, W, P['baseLo']); g.hline(1, 31, 14, W, P['out'])
    g.put(1, 30, W, P['out']); g.put(14, 30, W, P['out'])
    # 물건
    gl = P['gl']; cl = P['cl']; bx = P['bx']
    g.rows(4, 6, 'g', ['.%d.' % gl[0], '.%d.' % gl[0], '%d%d%d' % (gl[2], gl[1], gl[0]), '%d%d%d' % (gl[2], gl[2], gl[1]), '%d%d%d' % (gl[2], gl[2], gl[1]), '%d%d%d' % (gl[1], gl[0], gl[0])])
    g.rows(8, 8, 'c', ['%d%d%d' % (cl[3], cl[3], cl[3]), '%d%d%d' % (cl[2], cl[1], cl[0]), '%d%d%d' % (cl[2], cl[2], cl[1]), '%d%d%d' % (cl[1], cl[0], cl[0])])
    g.rows(10, 7, 'g', ['.%d' % gl[0], '.%d' % gl[0], '%d%d' % (gl[2], gl[1]), '%d%d' % (gl[2], gl[1]), '%d%d' % (gl[1], gl[0])])
    # 2칸: 상자 + 빈 자리 + 항아리
    g.rows(4, 16, 'b', ['%d%d%d%d' % (bx[3], bx[2], bx[2], bx[1]), '%d%d%d%d' % (bx[2], bx[1], bx[1], bx[0]), '%d%d%d%d' % (bx[2], bx[1], bx[1], bx[0]), '%d%d%d%d' % (bx[2], bx[1], bx[1], bx[0]), '%d%d%d%d' % (bx[1], bx[0], bx[0], bx[0])])
    g.rows(10, 17, 'c', ['%d%d' % (cl[3], cl[3]), '%d%d' % (cl[2], cl[1]), '%d%d' % (cl[2], cl[1]), '%d%d' % (cl[1], cl[0])])
    # 3칸: 큰 항아리 + 병
    g.rows(4, 23, 'c', ['.%d%d.' % (cl[3], cl[3]), '%d%d%d%d' % (cl[2], cl[2], cl[1], cl[1]), '%d%d%d%d' % (cl[2], cl[2], cl[1], cl[0]), '%d%d%d%d' % (cl[2], cl[1], cl[1], cl[0]), '%d%d%d%d' % (cl[1], cl[1], cl[0], cl[0]), '%d%d%d%d' % (cl[0], cl[0], cl[0], cl[0])])
    g.rows(9, 24, 'g', ['.%d' % gl[0], '.%d' % gl[0], '%d%d' % (gl[2], gl[1]), '%d%d' % (gl[2], gl[1]), '%d%d' % (gl[1], gl[0])])
    g.rows(11, 26, 'b', ['%d' % bx[2], '%d' % bx[1], '%d' % bx[0]])
    # 썩은 판 : 오른쪽이 처짐
    g.hline(10, 12, 3, W, P['back']); g.hline(10, 14, 2, W, P['boardLo'])
    # 먼지 줄(윗판) + 빈 자리 먼지 점
    g.pts('k', [(5, 3, P['dk']), (6, 3, P['dk']), (7, 3, P['dk']), (9, 3, P['dk'] - 1)])
    g.pts('k', [(8, 20, P['dk'] - 1), (9, 19, P['dk'] - 2)]) if False else None
    g.pts('k', [(8, 12, P['dk'] - 1), (9, 12, P['dk']), (7, 12, P['dk'] - 2)])
    if cobweb:
        g.pts('k', [(4, 5, 5), (5, 5, 4), (6, 5, 4), (7, 5, 3), (4, 6, 4), (5, 6, 3), (4, 7, 3), (6, 6, 2), (4, 8, 2), (5, 7, 2)])
    if rust:
        g.pts('r', [(2, 12, 3), (3, 13, 2), (12, 21, 3), (13, 22, 2), (2, 29, 3), (13, 29, 3), (5, 30, 2)])
        g.pts('w', [(2, 8, P['postL'] - 2), (2, 9, P['postL'] - 2), (13, 25, P['postD'] - 1)])
    return g

A_ = dict(out=0, postL=4, postD=3, top=5, topLo=3, back=1, boardHi=4, boardLo=2, base=3, baseLo=1, gl=(2, 3, 4), cl=(2, 3, 4, 5), bx=(2, 3, 4, 5), dk=5)
B_ = dict(out=0, postL=6, postD=4, top=7, topLo=4, back=1, boardHi=6, boardLo=3, base=4, baseLo=1, gl=(2, 4, 5), cl=(3, 4, 5, 6), bx=(3, 4, 5, 6), dk=5)
C_ = dict(out=0, postL=4, postD=3, top=4, topLo=2, back=1, boardHi=3, boardLo=1, base=2, baseLo=1, gl=(1, 2, 3), cl=(1, 2, 3, 4), bx=(1, 2, 3, 4), dk=5)

def A():
    P = dict(A_); return build(P), {'w': 'vdwood', 'g': 'vgreen', 'c': 'vclay', 'b': 'vwood', 'k': 'dust'}
def B():
    P = dict(B_); return build(P), {'w': 'vwood', 'g': 'vgreen', 'c': 'vclay', 'b': 'vwood', 'k': 'dust'}
def C():
    P = dict(C_); return build(P, cobweb=True, rust=True), {'w': 'rot', 'g': 'hmoss', 'c': 'soil', 'b': 'rot', 'k': 'dust', 'r': 'rust'}
NOTES = {
 'A': 'A(v5 식구·깨끗): 썩은 3칸 선반. 앞면이 주인공(왼 기둥 밝게·오른 기둥 어둡게), 윗판 1~2줄 + 먼지 줄. 칙칙한 병·항아리·상자, 둘째 칸에 빈 자리 하나, 오른쪽 판 처짐. vdwood',
 'B': 'B(어둠에서 읽힘): 나무를 vwood 밝은 쪽(6~7)으로 올려 어두운 바닥·벽 앞에서 윤곽이 서고 칸이 큼직하게 나뉨. 물건 톤 3~6',
 'C': 'C(재질·무늬): rot 썩은 나무 + 거미줄 모서리 + 녹 점 + 곰팡이 병(hmoss)·흙 항아리(soil)',
}
if __name__ == '__main__':
    for c, f in (('A', A), ('B', B), ('C', C)):
        g, mats = f(); emit('shelf_cellar', c, 16, 32, mats, g, NOTES[c])
