"""실내 벽 묶음 셋 — 저택 다마스크 벽지(manor) · 지하 마름돌(stone) · 미술관 회벽(gallery).

묶음마다: 북벽 n(1×4) · 창 n-window · 번개 창 n-lightning(3프레임) · 벽 촛대 n-sconce(3프레임) · 모서리 nw/ne(1×4) ·
서/동 윗면 띠 w/e(1×1) · 남벽 갓 s(1×1) · 남쪽 모서리 sw/se(1×1) · 문 door1(1×4 열림) · door2(2×4 열림).
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from gmlib import REG, Cv, K, run_module   # noqa: E402
from gmdraw import *                         # noqa: E402,F403
from _int import north_wall, side_strip, south_cap, lancet_window, doorway, cap_top, CAP   # noqa: E402

MODULE = 'int_walls'
SETS = dict(manor=('damask', '저택 붉은 다마스크 벽지(오크 징두리 판벽)', 'hall'),
            stone=('stone', '지하 축축한 마름돌 벽', 'cellar'),
            gallery=('plaster', '미술관 회녹색 회벽(금 그림 레일)', 'gallery'))


def _reg(set_id, face, ko, space):
    P = f'gm-w{set_id[0]}-'
    tags = ['벽', ko.split('(')[0]]

    @REG.piece(P + 'n', f'{ko} 북벽', 1, 4, ['S', 'S', 'S', 'S'], 'architecture', space, role='wall', repeat=True,
               tags=tags + ['북벽'], desc=f'{ko} — 북벽 1칸: 0행 벽 윗면(두께), 1~3행 실내 쪽 벽면, 맨 아래 걸레받이. 가로로 이어 칠한다.',
               rules='방 북쪽 0~3행에 가로로 이어 칠한다. 창·촛대·문 조각을 군데군데 섞는다.')
    def _n(c, face=face):
        north_wall(c, face)

    @REG.piece(P + 'n-window', f'{ko} 북벽 첨두 창', 1, 4, ['S', 'S', 'S', 'S'], 'architecture', space, role='wall',
               tags=tags + ['창'], desc=f'{ko} — 달빛 비치는 납살 첨두 창(깊은 돌 창틀·창턱).', rules='북벽 사이 3~4칸마다.')
    def _w(c, face=face):
        north_wall(c, face); lancet_window(c, 8, 10, 18, 46)

    @REG.piece(P + 'n-lightning', f'{ko} 북벽 번개 치는 창(3프레임)', 1, 4, ['S', 'S', 'S', 'S'], 'architecture', space, role='wall',
               frames=3, fps=2, tags=tags + ['창', '번개', '애니메이션'], desc=f'{ko} — 첨두 창 너머로 번개가 번쩍인다(어둠·번쩍·어둠).', rules='방마다 하나 — 공포 연출.')
    def _wl(c, f, face=face):
        north_wall(c, face); lancet_window(c, 8, 10, 18, 46, flash=(f == 1))
        if f == 1:
            for k in range(6): c.P(6 + (k % 2), 22 + k * 3, K('glow', 6))
        pass

    @REG.piece(P + 'n-sconce', f'{ko} 북벽 촛대(깜빡임 3프레임)', 1, 4, ['S', 'S', 'S', 'S'], 'architecture', space, role='wall',
               frames=3, fps=5, tags=tags + ['촛대', '촛불', '애니메이션'], desc=f'{ko} — 벽에 박은 무쇠 촛대와 깜빡이는 초 두 자루, 벽에 번진 불빛.', rules='창 사이·문 양옆.')
    def _sc(c, f, face=face):
        north_wall(c, face)
        for (dx, dy) in ((-4, 0), (4, 0)):
            x = 8 + dx
            r = 5 + (f % 2)
            for yy in range(24, 36):
                for xx in range(x - r, x + r + 1):
                    d2 = (xx - x) ** 2 + (yy - 28) ** 2
                    if 0 <= xx < 16 and (d2 < (r - 2) ** 2 or (d2 < r * r and (xx + yy) % 2 == 0)): c.P(xx, yy, K('glow', 1 if d2 < 6 else 0))
        c.R(5, 33, 7, 2, K('iron', 4)); c.HL(5, 33, 7, K('iron', 5)); c.R(7, 35, 3, 5, K('iron', 2)); c.HL(6, 39, 5, K('iron', 3))
        for x in (4, 12):
            c.R(x - 1, 29, 2, 4, K('bone', 6)); c.P(x, 29, K('bone', 4))
            fl = [(0, -1), (0, -2), (-1 if f == 2 else 0, -3)]
            for (fx, fy) in fl: c.P(x - 1 + fx + (1 if f == 1 else 0), 29 + fy, K('glow', 5 if fy > -3 else 6))
            c.P(x - 1, 27, K('glow', 4))
        pass

    if set_id == 'manor':   # 지하 마름돌 벽난로는 관문 반려(정면 입면도) — 저택 벽난로만 남긴다
        @REG.piece(P + 'n-fireplace', f'{ko} 북벽 벽난로(불꽃 3프레임)', 3, 4, ['SSS', 'SSS', 'SSS', 'SSS'], 'architecture', space, role='wall',
                   frames=3, fps=6, tags=tags + ['벽난로', '불', '애니메이션'],
                   desc=f'{ko} — 벽에 박힌 조각 돌 벽난로: 선반 윗면(촛대 둘·해골), 첨두 아궁이 속 일렁이는 불과 장작, 앞 돌 바닥판.',
                   rules='북벽 줄 안 3칸(창·문과 겹치지 않게). 앞 한 줄에 깔개·안락의자. 아랫줄은 막힌다.')
        def _fp(c, f, face=face):
            north_wall(c, face, w=48)
            c.R(3, 12, 42, 46, K('stone', 3)); c.VL(3, 12, 46, K('stone', 5)); c.VL(4, 12, 46, K('stone', 4)); c.VL(44, 12, 46, K('stone', 1))
            for x in (3, 37): c.HL(x, 40, 8, K('stone', 2)); c.HL(x, 49, 8, K('stone', 2))
            c.R(1, 22, 46, 5, K('stone', 6)); c.HL(1, 22, 46, K('stone', 2)); c.HL(1, 26, 46, K('stone', 5))      # 선반 윗면
            c.R(1, 27, 46, 3, K('stone', 3)); c.HL(1, 29, 46, K('stone', 1))                                     # 선반 앞턱
            for x in (6, 41):
                c.R(x - 1, 16, 2, 7, K('bone', 6)); c.P(x - 1, 15, K('glow', 6 if f != 1 else 5)); c.HL(x - 2, 22, 4, K('gold', 4))
            c.R(21, 17, 6, 5, K('bone', 5)); c.P(22, 19, K('ink', 1)); c.P(25, 19, K('ink', 1)); c.HL(22, 21, 4, K('bone', 3))
            prof, _ = arch_profile(26)
            for i in range(26):
                for y in range(34 + prof[i] // 2, 58): c.P(11 + i, y, K('ink', 1))
                c.P(11 + i, 33 + prof[i] // 2, K('stone', 6))
            for k in range(9):
                x = 14 + k * 2 + (f + k) % 2
                h = 6 + ((k * 5 + f * 3) % 7)
                for y in range(55 - h, 55):
                    t = 6 if y > 55 - h * .4 else 5 if y > 55 - h * .7 else 3
                    c.P(x, y, K('glow', t)); c.P(x + 1, y, K('glow', max(2, t - 1)))
            c.R(15, 54, 18, 3, K('wood', 2)); c.HL(15, 54, 18, K('wood', 4))
            c.R(0, 58, 48, 6, K('stone', 5)); c.HL(0, 58, 48, K('stone', 6)); c.HL(0, 63, 48, K('stone', 2))      # 앞 돌 바닥판

    @REG.piece(P + 'nw', f'{ko} 북서 모서리', 1, 4, ['S', 'S', 'S', 'S'], 'architecture', space, role='wall',
               tags=tags + ['모서리'], desc=f'{ko} — 북벽과 서벽이 만나는 모서리(서벽 윗면 띠가 위까지 이어진다).', rules='서쪽 열 0~3행.')
    def _nw(c, face=face):
        cap_top(c, 0, 16, 0, 64, face, west=True); m, t = CAP[face]; c.HL(0, 0, 16, K(m, 1))

    @REG.piece(P + 'ne', f'{ko} 북동 모서리', 1, 4, ['S', 'S', 'S', 'S'], 'architecture', space, role='wall',
               tags=tags + ['모서리'], desc=f'{ko} — 북벽과 동벽이 만나는 모서리.', rules='동쪽 열 0~3행.')
    def _ne(c, face=face):
        cap_top(c, 0, 16, 0, 64, face, west=False); m, t = CAP[face]; c.HL(0, 0, 16, K(m, 1))

    @REG.piece(P + 'w', f'{ko} 서벽 윗면 띠', 1, 1, ['S'], 'architecture', space, role='wall', repeat=True,
               tags=tags + ['서벽'], desc=f'{ko} — 서쪽 벽 윗면(두께) 1칸. 세로로 이어 칠한다.', rules='서쪽 가장자리 열.')
    def _ww(c, face=face):
        side_strip(c, face, True)

    @REG.piece(P + 'e', f'{ko} 동벽 윗면 띠', 1, 1, ['S'], 'architecture', space, role='wall', repeat=True,
               tags=tags + ['동벽'], desc=f'{ko} — 동쪽 벽 윗면(두께) 1칸.', rules='동쪽 가장자리 열.')
    def _we(c, face=face):
        side_strip(c, face, False)

    @REG.piece(P + 's', f'{ko} 남벽 갓', 1, 1, ['S'], 'architecture', space, role='wall', repeat=True,
               tags=tags + ['남벽'], desc=f'{ko} — 남쪽 벽 윗면 한 줄(3/4 시점이라 남벽 정면은 보이지 않는다).', rules='방 남쪽 마지막 줄.')
    def _s(c, face=face):
        south_cap(c, face)

    for corner, west in (('sw', True), ('se', False)):
        @REG.piece(P + corner, f'{ko} 남{"서" if west else "동"} 모서리', 1, 1, ['S'], 'architecture', space, role='wall',
                   tags=tags + ['모서리'], desc=f'{ko} — 남벽 갓과 {"서" if west else "동"}벽 띠가 만나는 모서리.', rules='남쪽 줄 양 끝.')
        def _c(c, face=face, west=west):
            south_cap(c, face); m, t = CAP[face]
            x = 0 if west else 15
            c.VL(x, 0, 16, K(m, 1)); c.VL(x + (1 if west else -1), 0, 13, K(m, t + 1 if west else t - 1))

    @REG.piece(P + 'door1', f'{ko} 북벽 문(열림 1칸)', 1, 4, ['S', 'S', 'C', 'F'], 'architecture', space, role='wall',
               tags=tags + ['문', '출입구'], desc=f'{ko} — 깊은 문틀의 첨두 아치 문이 열려 어두운 복도가 보인다. 아랫줄로 지나간다.', rules='북벽 줄 안. 아랫줄(3행)에 이동 이벤트.')
    def _d1(c, face=face):
        north_wall(c, face); doorway(c, 1, 14, face)

    @REG.piece(P + 'door2', f'{ko} 북벽 큰 문(열림 2칸)', 2, 4, ['SS', 'SS', 'CC', 'FF'], 'architecture', space, role='wall',
               tags=tags + ['문', '출입구', '쌍문'], desc=f'{ko} — 2칸 폭 첨두 아치 쌍문이 열렸다. 아랫줄로 지나간다.', rules='북벽 줄 안 2칸.')
    def _d2(c, face=face):
        north_wall(c, face, w=32); doorway(c, 2, 28, face, y_top=22)


for sid, (face, ko, space) in SETS.items():
    _reg(sid, face, ko, space)


if __name__ == '__main__':
    sys.exit(1 if run_module(MODULE) else 0)
