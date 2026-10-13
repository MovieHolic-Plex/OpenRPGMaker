#!/usr/bin/env python3
"""gothic_manor 건물 키트 — 지붕 윗면 + 정면 한 겹을 조립한 건물 한 장을 kind=structure 로 관문에 낸다.
python3 gx_build.py -> tiledata/gothic-manor/buildings/_gate/gx-bld-*.png + preview"""
from gx_parts import *
R = Reg('buildings'); A = R.add

def body(c, W, H, roof_h, ins, wall_mat='stone', roof='slate', floors=2, bay=16, doorx=None, lit=(), ivyd=35, wear=2, s=0, roofy=6, back=5):
    wy = roofy + roof_h + 2
    wall(c, 0, wy, W, H - wy - 3, wall_mat, s)
    hip(c, 0, roofy, W, roof_h, ins, roof, back=back, wear=wear, s=s)
    eave(c, 0, roofy + roof_h, W)
    plinth(c, 0, H - 4, W, 3)
    fh = (H - 4 - wy) // floors
    n = (W - 4) // bay
    for f in range(floors):
        for i in range(n):
            cx = 2 + i * bay + bay // 2 - 3
            if f == floors - 1 and doorx is not None and abs(cx + 3 - doorx) < 8: continue
            if f == floors - 1 and doorx is None and i == n // 2 and floors > 0 and False: continue
            gwin(c, cx, wy + 3 + f * fh, 6, min(11, fh - 7), lit=((f * 7 + i) in lit))
    if doorx is not None: gdoor(c, doorx - 5, H - 4 - 14, 10, 14)
    ivy(c, 0, wy, W, H - wy - 5, s, ivyd)

@A('bld-manor2', '저택(2층 · 슬레이트 寄棟 · 굴뚝 둘)', 6, 5, 'structure', solid=[(0, 3), (1, 3), (2, 3), (3, 3), (4, 3), (5, 3), (0, 4), (1, 4), (2, 4), (3, 4), (4, 4), (5, 4)], tags=['저택', '건물'], rules='고딕 저택 기본. 문은 가운데 아래.')
def _m2(c):
    body(c, 96, 80, 26, 22, doorx=48, lit=(1, 6), s=1)
    chimney(c, 16, 3, 7, 4, 8); chimney(c, 72, 3, 7, 4, 8); c.outline()

@A('bld-manor3', '저택(3층 · 뾰족 중앙 탑)', 6, 6, 'structure', solid=[(x, y) for y in (4, 5) for x in range(6)], tags=['저택', '건물'], rules='큰 저택. 중앙 문.')
def _m3(c):
    body(c, 96, 96, 22, 18, floors=3, doorx=48, lit=(2, 10), s=2, roofy=8)
    chimney(c, 10, 4, 7, 4, 8); chimney(c, 80, 4, 7, 4, 8)
    hip(c, 36, 0, 24, 14, 11, 'slate', back=3, s=2); c.outline()

@A('bld-manor-ruin', '폐저택(무너진 지붕 · 덩굴)', 6, 5, 'structure', solid=[(x, y) for y in (3, 4) for x in range(6)], tags=['저택', '폐허', '건물'], rules='폐저택.')
def _mr(c):
    body(c, 96, 80, 26, 22, doorx=48, lit=(), ivyd=75, wear=7, s=3)
    for (x, y, w, h) in ((30, 10, 16, 9), (62, 18, 14, 7)):                 # 무너진 지붕 구멍: 어두운 서까래 속
        c.R(x, y, w, h, K('shadow', 1)); c.HL(x, y, w, K('slate', -2))
        for i in range(0, w, 4): c.VL(x + i, y + 1, h - 1, K('wood', -1))
    chimney(c, 16, 3, 7, 4, 8); c.outline()

@A('bld-chapel', '예배당(좁은 박공 · 뾰족 창 · 작은 탑)', 5, 5, 'structure', solid=[(x, y) for y in (3, 4) for x in range(5)], tags=['예배당', '교회', '건물'], rules='묘지 곁.')
def _ch(c):
    body(c, 80, 80, 24, 16, floors=1, doorx=40, s=4, roofy=8, lit=(0, 2))
    hip(c, 28, 0, 24, 14, 11, 'slate', back=3, s=4)
    c.VL(40, 0, 2, K('iron', 3)); c.HL(38, 1, 5, K('iron', 3)); c.outline()

@A('bld-mausoleum', '묘소(돌 지붕 · 철문)', 4, 4, 'structure', solid=[(x, y) for y in (2, 3) for x in range(4)], tags=['묘소', '묘지', '건물'], rules='가문 묘역 안쪽.')
def _mz(c):
    W, H = 64, 64
    wall(c, 0, 26, W, 34, 'stone', 5); hip(c, 0, 4, W, 20, 14, 'stone', back=5, wear=3, s=5); eave(c, 0, 24, W); plinth(c, 0, 60, W, 3)
    c.R(22, 30, 20, 30, K('stone', 2)); c.R(24, 33, 16, 27, K('iron', -2))
    for x in range(25, 40, 3): c.VL(x, 34, 26, K('iron', 1)); c.P(x, 33, K('iron', 3))
    c.HL(24, 46, 16, K('iron', 2)); c.VL(31, 33, 27, K('iron', 3)); c.HL(20, 28, 24, K('stone', 3)); c.HL(20, 29, 24, K('stone', -2))
    cube(c, 28, 0, 8, 3, 4, 'stone', tt=3, ft=0, ol=False); ivy(c, 0, 26, W, 30, 5, 45); c.outline()

@A('bld-belltower', '종탑(피라미드 첨탑 + 아가리 아치)', 3, 6, 'structure', solid=[(0, 4), (1, 4), (2, 4), (0, 5), (1, 5), (2, 5)], tags=['종탑', '탑', '건물'], rules='예배당 옆.')
def _bt(c):
    W, H = 48, 96
    hip(c, 0, 10, W, 26, 22, 'slate', back=6, wear=2, s=6)
    wall(c, 4, 38, W - 8, 52, 'stone', 6); c.R(2, 36, W - 4, 3, K('stone', 2)); c.HL(2, 38, W - 4, K('stone', -3))
    c.R(14, 44, 20, 20, K('stone', 2)); c.R(16, 46, 16, 18, K('shadow', 1)); c.HL(18, 45, 12, K('stone', 3))
    c.ell(24, 56, 3, 4, K('iron', 1)); c.VL(24, 52, 2, K('iron', 2))
    gwin(c, 21, 70, 6, 12); plinth(c, 2, 90, W - 4, 3); ivy(c, 4, 40, W - 8, 48, 6, 45)
    c.VL(24, 2, 9, K('iron', 3)); c.HL(22, 5, 5, K('iron', 3)); c.outline()

@A('bld-gatehouse', '정문(석조 문루 + 철제 양개 문)', 6, 4, 'structure', solid=[(0, 2), (1, 2), (4, 2), (5, 2)], tags=['정문', '문루', '건물'], rules='저택 앞마당 정문.')
def _gh(c):
    W, H = 96, 64
    for ox in (0, 72):
        wall(c, ox, 22, 24, 38, 'stone', ox); hip(c, ox - 1, 4, 26, 16, 11, 'slate', back=4, s=ox); eave(c, ox, 20, 24); plinth(c, ox, 60, 24, 3)
        gwin(c, ox + 9, 32, 6, 10)
    cube(c, 22, 8, 52, 9, 8, 'stone', tt=3, ft=-1, ol=False); c.HL(24, 11, 48, K('stone', 4)); c.HL(24, 14, 48, K('stone', 4))
    c.R(22, 25, 52, 3, K('stone', -3))
    for x in range(26, 70, 4): c.VL(x, 30, 30, K('iron', 1)); c.P(x, 29, K('iron', 3)); c.P(x, 28, K('iron', 2))
    c.HL(24, 42, 48, K('iron', 2)); c.HL(24, 58, 48, K('iron', 2)); c.VL(47, 30, 30, K('iron', -2)); c.VL(48, 30, 30, K('iron', -2)); ivy(c, 0, 22, 96, 38, 8, 30); c.outline()

@A('bld-irongate', '철문(철창 양개 · 석주 둘, 얕은 윗면)', 4, 3, 'structure', solid=[(0, 1), (3, 1)], tags=['철문', '문', '묘지'], rules='묘지·정원 입구.')
def _ig(c):
    W, H = 64, 48
    for ox in (0, 52):
        cube(c, ox, 2, 12, 7, 3, 'stone', tt=3, ft=-1, ol=False); wall(c, ox + 1, 12, 10, 32, 'stone', ox); plinth(c, ox, 42, 12, 3)
        cube(c, ox + 2, 8, 8, 2, 2, 'stone', tt=2, ft=0, ol=False)
    cube(c, 12, 12, 40, 4, 2, 'iron', tt=2, ft=0, ol=False)
    for x in range(14, 51, 4): c.VL(x, 18, 24, K('iron', 1)); c.P(x, 17, K('iron', 4)); c.P(x, 16, K('iron', 3))
    cube(c, 12, 36, 40, 4, 3, 'iron', tt=2, ft=0, ol=False); c.VL(31, 18, 18, K('iron', -3)); c.VL(32, 18, 18, K('iron', -3)); c.outline()

@A('bld-orphanage', '고아원(붉은 벽돌 3층 · 긴 지붕)', 6, 5, 'structure', solid=[(x, y) for y in (3, 4) for x in range(6)], tags=['고아원', '건물'], rules='저택보다 낮고 길다.')
def _or(c):
    body(c, 96, 80, 24, 14, wall_mat='brick', roof='slate', floors=2, doorx=48, lit=(1, 4, 7), s=7)
    chimney(c, 20, 3, 6, 4, 8, 'stone'); chimney(c, 70, 3, 6, 4, 8, 'stone'); c.outline()

@A('bld-asylum', '요양소(창살 창 · 긴 벽돌 병동)', 7, 5, 'structure', solid=[(x, y) for y in (3, 4) for x in range(7)], tags=['요양소', '건물'], rules='고아원과 형제 건물.')
def _as(c):
    body(c, 112, 80, 24, 18, wall_mat='stone', roof='slate', floors=2, doorx=56, lit=(2, 9), s=8, ivyd=20)
    chimney(c, 12, 3, 7, 4, 8); chimney(c, 92, 3, 7, 4, 8)
    c.R(44, 4, 24, 8, K('slate', 2)); c.HL(44, 4, 24, K('slate', 3)); c.outline()

@A('bld-greenhouse', '온실(철 뼈대 유리 지붕 · 죽은 식물)', 5, 4, 'structure', solid=[(x, y) for y in (2, 3) for x in range(5)], tags=['온실', '건물'], rules='저택 뒤뜰.')
def _gr(c):
    W, H = 80, 64
    hip(c, 0, 6, W, 24, 20, 'glass', back=5, s=9)
    for x in range(12, W - 10, 10): c.VL(x, 8, 22, K('iron', 1))
    c.HL(8, 14, W - 16, K('iron', 1)); c.HL(4, 22, W - 8, K('iron', 1))
    wall(c, 0, 32, W, 26, 'stone', 9); c.R(0, 32, W, 2, K('iron', 1))
    for i in range(4): c.R(4 + i * 19, 36, 16, 16, K('glass', -1)); c.HL(4 + i * 19, 36, 16, K('glass', 1)); c.VL(11 + i * 19, 36, 16, K('iron', 0)); c.HL(4 + i * 19, 44, 16, K('iron', 0))
    for i in range(4): c.P(8 + i * 19, 48, K('dead', 1)); c.P(9 + i * 19, 47, K('dead', 2))
    plinth(c, 0, 58, W, 3); c.outline()

@A('bld-shed', '창고(낮은 나무 판벽 + 슬레이트)', 3, 3, 'structure', solid=[(0, 2), (1, 2), (2, 2)], tags=['창고', '건물'], rules='저택 뒤.')
def _sh(c):
    W, H = 48, 48
    c.R(0, 22, W, 22, K('wood', 0))
    for x in range(0, W, 4): c.VL(x, 22, 22, K('wood', -2)); c.VL(x + 1, 22, 22, K('wood', 1))
    hip(c, 0, 4, W, 16, 8, 'slate', back=4, wear=5, s=10); eave(c, 0, 20, W); plinth(c, 0, 44, W, 3)
    gdoor(c, 19, 30, 10, 14); ivy(c, 0, 22, W, 20, 10, 25); c.outline()

@A('bld-carriage', '마차고(넓은 문 · 낮은 지붕)', 5, 3, 'structure', solid=[(x, 2) for x in range(5)], tags=['마차고', '건물'], rules='저택 옆.')
def _cg(c):
    W, H = 80, 48
    wall(c, 0, 22, W, 22, 'stone', 11); hip(c, 0, 4, W, 16, 12, 'slate', back=4, wear=3, s=11); eave(c, 0, 20, W); plinth(c, 0, 44, W, 3)
    c.R(14, 26, 52, 18, K('stone', 2)); c.R(16, 28, 48, 16, K('wood', -2))
    for x in range(16, 64, 6): c.VL(x, 28, 16, K('wood', -3)); c.VL(x + 1, 28, 16, K('wood', 0))
    c.VL(39, 28, 16, K('iron', 0)); c.HL(16, 34, 48, K('iron', 1)); c.HL(16, 40, 48, K('iron', 1)); c.HL(14, 25, 52, K('stone', 3)); ivy(c, 0, 22, W, 20, 11, 25); c.outline()

@A('bld-castle-wall', '폐성 성벽(총안 + 걷는 윗면)', 4, 2, 'structure', solid=[(x, 1) for x in range(4)], tags=['성벽', '폐성', '건물'], rules='폐성 둘레.')
def _cw(c):
    W, H = 64, 32
    c.R(0, 4, W, 8, K('stone', 2)); c.HL(0, 4, W, K('stone', 3))
    for x in range(0, W, 8): c.VL(x + 3, 6, 4, K('stone', 1))
    c.HL(0, 11, W, K('stone', -1)); battlements(c, 0, 8, W)
    for x in range(0, W, 8): c.R(x + 1 + (0), 4, 6, 3, K('stone', 3)); 
    wall(c, 0, 20, W, 11, 'stone', 12); c.HL(0, 19, W, K('stone', -3)); ivy(c, 0, 20, W, 10, 12, 35); plinth(c, 0, 29, W, 3); c.outline()

@A('bld-castle-tower', '폐성 탑(네모 · 총안 · 윗면 슬래브)', 3, 4, 'structure', solid=[(x, y) for y in (2, 3) for x in range(3)], tags=['성탑', '폐성', '건물'], rules='폐성 모서리.')
def _ct(c):
    W, H = 48, 64
    c.R(0, 4, W, 20, K('stone', 2)); c.HL(0, 4, W, K('stone', 3)); c.VL(0, 4, 20, K('stone', 3))
    c.R(6, 8, W - 12, 12, K('stone', 1)); c.HL(6, 8, W - 12, K('stone', -1)); c.VL(6, 8, 12, K('stone', -1))
    for x in range(10, W - 10, 8): c.VL(x, 9, 11, K('stone', 2))
    battlements(c, 0, 18, W); c.HL(0, 24, W, K('stone', -3))
    wall(c, 0, 28, W, 32, 'stone', 13); gwin(c, 21, 36, 5, 10, arch=True); ivy(c, 0, 28, W, 30, 13, 40); plinth(c, 0, 60, W, 3); c.outline()

if __name__ == '__main__':
    m, ims = R.export(); sheet([i for _, i in ims], os.path.join(OUT, 'buildings', 'preview', '_all-x3.png'), W=420, z=3); print(len(m), 'items')
