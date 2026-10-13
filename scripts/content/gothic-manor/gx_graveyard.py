#!/usr/bin/env python3
"""gothic_manor 묘지·야외 묶음 — 묘비·무덤·십자가·철창·고사목·가시덤불·우물·마른 분수·가스등·벤치·까마귀 석상.
python3 gx_graveyard.py -> tiledata/gothic-manor/graveyard/_gate/gx-*.png + items.jsonl + preview"""
from gx_core import *
R = Reg('graveyard'); A = R.add

def cut(c, pts):
    for x, y in pts:
        if 0 <= x < c.w and 0 <= y < c.h: c.a[y, x] = (0, 0, 0, 0)


def slab(c, x, y, w, top, front, mat='stone', tex=2):
    """윗면 깊은 석판: 어두운 뒷변 + 밝은 윗면 + 결 줄 + 어두운 앞면."""
    cube(c, x, y, w, top, front, mat, tt=3, ft=-2, ol=False)
    c.HL(x, y, w, K(mat, 0)); c.HL(x, y + 1, w, K(mat, 2))
    for k in range(tex):
        yy = y + 3 + k * 2
        if yy < y + top - 1: c.HL(x + 2 + k, yy, w - 4 - k * 2, K(mat, 4))

def cracks(c, x, y, n, mat='stone', s=0):
    for i in range(n):
        cx = x + hsh(i, s, 1) % 5; cy = y + hsh(i, s, 2) % 3
        for k in range(3): c.P(cx + (k % 2), cy + k, K(mat, -3))

def moss_patch(c, x, y, w, s=0, mat='moss'):
    for i in range(w):
        for j in range(1 + hsh(i, s, 5) % 2):
            if c.has(x + i, y + j): c.P(x + i, y + j, K(mat, 0 if hsh(i, j, s) % 3 else 1))

@A('tomb-round', '둥근 묘비(윗면 두툼한 돌판)', 1, 1, 'box', solid=[(0, 0)], tags=['묘비', '묘지'], rules='묘지 무덤 머리쪽. 6종 중 둥근머리.')
def _t1(c):
    cube(c, 3, 3, 10, 6, 6, 'stone', tt=2, ft=-1, ol=False)
    cut(c, [(3, 3), (12, 3)]); c.HL(5, 5, 6, K('stone', 3)); c.HL(4, 7, 8, K('stone', 3)); cracks(c, 8, 10, 1)
    c.R(6, 11, 4, 1, K('stone', -3)); c.VL(7, 10, 3, K('stone', -3)); c.HL(5, 13, 6, K('stone', -3))   # 새긴 십자(글자 없음)
    moss_patch(c, 3, 14, 10, 1); c.HL(2, 15, 12, K('soil', -2)); c.outline()




@A('tomb-slab', '석관 뚜껑 무덤(납작한 큰 돌판)', 2, 1, 'box', solid=[(0, 0), (1, 0)], tags=['무덤', '석관', '묘지'], rules='저택 가문 묘역 중심.')
def _slab(c):
    cube(c, 1, 1, 30, 9, 5, 'stone', tt=2, ft=-1, ol=False)
    c.HL(2, 3, 28, K('stone', 3)); c.HL(2, 6, 28, K('stone', 1)); c.R(14, 3, 4, 1, K('stone', -3)); c.R(15, 2, 2, 7, K('stone', -3)); c.R(12, 4, 8, 2, K('stone', -3))
    c.HL(1, 10, 30, K('stone', -2)); cracks(c, 5, 4, 2, s=3); cracks(c, 22, 5, 2, s=5); moss_patch(c, 2, 11, 12, 2); moss_patch(c, 18, 10, 10, 4)
    c.HL(0, 15, 32, K('soil', -2)); c.outline()

@A('grave-mound', '무덤 흙더미(막대 십자)', 1, 1, 'organic', solid=[(0, 0)], tags=['무덤', '흙더미', '묘지'], rules='새 무덤. 나무 십자가는 머리쪽.')
def _mound(c):
    for y in range(6, 15):
        w = 4 + (y - 6) * 1; x0 = 8 - w // 2
        for x in range(x0, x0 + w):
            t = -1 if x > 8 + w // 4 else (1 if x < 8 - w // 4 else 0)
            c.P(x, y, K('soil', t + (1 if y == 6 else 0) + (hsh(x, y) % 4 == 0)))
    c.HL(3, 14, 10, K('soil', -2)); c.VL(8, 0, 6, K('wood', 0)); c.HL(6, 2, 5, K('wood', 0)); c.VL(7, 0, 6, K('wood', 1)); c.HL(6, 2, 5, K('wood', 1))
    c.outline()


@A('obelisk', '방첨탑(기단 + 네모 기둥, 윗면)', 1, 2, 'column', solid=[(0, 1)], tags=['오벨리스크', '묘지', '기념비'], rules='묘역 한가운데.')
def _ob(c):
    cube(c, 1, 22, 14, 5, 4, 'stone', tt=2, ft=-1, ol=False)
    cube(c, 3, 17, 10, 4, 5, 'stone', tt=2, ft=-1, ol=False)
    cube(c, 5, 3, 6, 5, 15, 'stone', tt=3, ft=0, ol=False)
    c.HL(6, 1, 4, K('stone', 3)); c.HL(5, 2, 6, K('stone', 3)); c.R(7, 12, 2, 1, K('stone', -3)); c.R(7, 14, 2, 1, K('stone', -3))
    moss_patch(c, 4, 26, 8, 2); c.HL(0, 31, 16, K('soil', -2)); c.outline()





@A('cross-wood', '나무 십자가(흙 받침)', 1, 1, 'box', solid=[(0, 0)], tags=['십자가', '묘지'], rules='얕은 무덤 머리.')
def _cw(c):
    cube(c, 1, 7, 14, 6, 3, 'soil', tt=3, ft=-1, ol=False); c.HL(3, 9, 10, K('soil', 4)); c.HL(4, 11, 8, K('soil', 4))
    c.R(7, 0, 2, 9, K('wood', 1)); c.R(4, 2, 8, 2, K('wood', 1)); c.VL(7, 0, 9, K('wood', 2)); c.HL(4, 2, 8, K('wood', 2)); c.HL(4, 3, 8, K('wood', -1))
    c.HL(0, 14, 16, K('soil', -2)); c.outline()

@A('crow-statue', '까마귀 석상(넓은 석조 받침 위)', 1, 2, 'figure', solid=[(0, 1)], tags=['까마귀', '석상', '묘지'], rules='묘지 입구·분수 곁.')
def _crow(c):
    cube(c, 1, 12, 14, 9, 8, 'stone', tt=3, ft=-1, ol=False); c.HL(3, 14, 10, K('stone', 4)); c.HL(3, 17, 10, K('stone', 4)); c.HL(1, 20, 14, K('stone', -1))
    c.R(5, 21, 6, 6, K('stone', 0)); c.HL(3, 27, 10, K('stone', 1)); c.HL(3, 28, 10, K('stone', -2))
    c.ell(8, 8, 4, 3, K('iron', 1)); c.R(2, 5, 4, 3, K('iron', 2)); c.P(1, 6, K('bone', 1)); c.P(3, 6, K('iron', -2)); c.R(10, 7, 5, 3, K('iron', 0)); c.HL(6, 5, 4, K('iron', 3)); c.R(13, 10, 2, 2, K('iron', -1))
    c.P(7, 11, K('iron', -2)); c.P(9, 11, K('iron', -2)); c.HL(1, 31, 14, K('soil', -2)); c.outline()




@A('fountain-dry', '마른 분수(둥근 석조 수반 + 중앙 기둥)', 3, 3, 'container', solid=[(x, y) for y in (1, 2) for x in range(3)], tags=['분수', '마른 분수'], rules='저택 앞마당 중앙.')
def _fd(c):
    c.ell(24, 30, 22, 14, K('stone', -1)); c.ell(24, 26, 22, 13, K('stone', 3)); c.ell(24, 27, 18, 10, K('stone', -2)); c.ell(24, 28, 16, 8, K('dead', -1))
    for k in range(12): c.P(14 + hsh(k, 1) % 20, 24 + hsh(k, 2) % 8, K('dead', 1 + k % 2))
    c.ell(24, 14, 6, 4, K('stone', 3)); c.R(19, 14, 11, 12, K('stone', 1)); c.VL(19, 14, 12, K('stone', 2)); c.VL(29, 14, 12, K('stone', -2))
    c.ell(24, 8, 8, 4, K('stone', 3)); c.ell(24, 9, 6, 2, K('stone', -1)); c.ell(24, 5, 3, 2, K('stone', 4))
    moss_patch(c, 6, 36, 10, 3); c.HL(8, 44, 32, K('soil', -2)); c.outline()



@A('dead-tree', '고사목(잎 없는 큰 나무, 뿌리 덩이)', 2, 3, 'organic', solid=[(0, 2), (1, 2)], tags=['고목', '나무'], rules='묘지·황무지.')
def _dt(c):
    def limb(x0, y0, dx, n, w=2):
        x = x0
        for i in range(n):
            c.R(int(x), y0 - i, w, 1, K('dead', 1 - (i > n // 2) + (1 if i % 5 == 0 else 0)))
            x += dx
    c.R(12, 26, 8, 14, K('dead', 0)); c.VL(12, 26, 14, K('dead', 2)); c.VL(19, 26, 14, K('dead', -2))
    for i in range(6): c.R(10 - i // 2, 40 + i % 2, 4, 1, K('dead', -1)); c.R(18 + i // 2, 40 + i % 2, 4, 1, K('dead', -1))
    c.R(8, 40, 16, 4, K('dead', -1)); c.R(5, 43, 22, 3, K('soil', -1)); c.HL(4, 47, 24, K('soil', -2))
    c.R(13, 14, 6, 14, K('dead', 0)); c.VL(13, 14, 14, K('dead', 2)); c.R(14, 8, 4, 8, K('dead', 0))
    limb(12, 20, -0.5, 13); limb(18, 18, 0.55, 13); limb(13, 14, -0.9, 9); limb(17, 12, 0.9, 9, 2)
    limb(14, 8, -0.3, 8, 1); limb(17, 8, 0.35, 8, 1)
    for (x, y) in ((1, 9), (5, 5), (3, 2), (27, 5), (29, 8), (25, 2), (14, 0), (18, 1)): c.R(x, y, 2, 1, K('dead', 1)); c.P(x + 1, y - 1, K('dead', 2))
    c.outline()

@A('bramble', '가시덤불(얽힌 마른 덩굴 덩이)', 2, 1, 'organic', solid=[(0, 0), (1, 0)], tags=['가시덤불', '덤불'], rules='묘지 가장자리·폐허 둘레.')
def _br(c):
    for y in range(3, 15):
        for x in range(1, 31):
            d = ((x - 15.5) / 15) ** 2 + ((y - 9) / 6.2) ** 2
            if d < 1 and hsh(x, y, 3) % 5 != 0: c.P(x, y, K('dead', -1 + (hsh(x, y, 4) % 3) - (1 if y > 10 else 0)))
    for k in range(34):
        x = 2 + hsh(k, 1, 7) % 27; y = 3 + hsh(k, 2, 7) % 11
        c.P(x, y, K('dead', 3)); c.P(x + 1, y - 1, K('dead', 2))
    for k in range(8): c.P(2 + hsh(k, 5) % 27, 4 + hsh(k, 6) % 9, K('blood', 1))
    c.HL(2, 15, 28, K('soil', -2)); c.outline()

@A('tomb-wide', '넓은 묘비(두툼한 돌판)', 1, 1, 'box', solid=[(0, 0)], tags=['묘비', '묘지'], rules='가족 묘 뒷줄.')
def _t2(c):
    slab(c, 1, 1, 14, 6, 8); cut(c, [(1, 2), (14, 2)]); c.VL(7, 9, 4, K('stone', -3)); c.VL(8, 9, 4, K('stone', -3)); c.HL(6, 10, 4, K('stone', -3))
    moss_patch(c, 1, 12, 8, 3); c.HL(0, 14, 16, K('soil', -2)); c.R(0, 15, 16, 1, K('soil', -1)); c.outline()

@A('tomb-tilt', '기운 묘비(오른쪽으로 쓰러지는)', 1, 1, 'box', solid=[(0, 0)], tags=['묘비', '묘지'], rules='오래된 구역에서 반듯한 묘비 사이에 섞는다.')
def _t3(c):
    for r in range(13):
        sh = r // 4; ty = 1 + r; top = r < 6
        col = (K('stone', 0) if r == 0 else K('stone', 3 if r % 3 else 4)) if top else K('stone', -2)
        c.R(2 + sh, ty, 10, 1, col)
        if not top: c.P(2 + sh, ty, K('stone', 0)); c.P(11 + sh, ty, K('stone', -3))
    c.HL(5, 5, 6, K('stone', 1)); c.VL(8, 10, 3, K('stone', -3)); c.HL(6, 11, 4, K('stone', -3)); c.HL(5, 14, 9, K('soil', -2)); c.HL(3, 14, 3, K('soil', -1))
    moss_patch(c, 4, 12, 7, 7); c.outline()

@A('tomb-cross', '십자 장식 묘비(넓은 받침 위 작은 십자)', 1, 1, 'box', solid=[(0, 0)], tags=['묘비', '십자가', '묘지'], rules='예배당 곁 묘지.')
def _t4(c):
    slab(c, 1, 3, 14, 5, 8)
    c.R(7, 0, 2, 6, K('stone', 4)); c.R(5, 1, 6, 2, K('stone', 4)); c.HL(5, 3, 6, K('stone', 1))
    c.VL(7, 9, 4, K('stone', -3)); c.HL(6, 10, 3, K('stone', -3)); moss_patch(c, 2, 11, 9, 2); c.HL(0, 14, 16, K('soil', -2)); c.outline()



@A('well', '우물(돌 둘레 + 어두운 물 + 뒤쪽 도르래 틀)', 2, 2, 'container', solid=[(0, 1), (1, 1)], tags=['우물'], rules='저택 뒤뜰·마을 광장.')
def _well(c):
    c.VL(4, 0, 10, K('wood', 0)); c.VL(27, 0, 10, K('wood', -1)); c.R(4, 0, 24, 3, K('wood', 2)); c.HL(4, 0, 24, K('wood', 3)); c.VL(16, 3, 4, K('dead', 1)); c.R(14, 6, 4, 3, K('iron', 1))
    slab(c, 1, 8, 30, 18, 7, 'stone', 0)
    c.R(6, 11, 20, 11, K('stone', -3)); c.R(7, 12, 18, 9, K('water', -2)); c.HL(7, 12, 18, K('shadow', 0)); c.HL(10, 16, 7, K('water', 0)); c.HL(12, 17, 3, K('water', 2)); c.HL(18, 19, 4, K('water', -1))
    c.HL(1, 22, 30, K('stone', 4)); c.HL(1, 25, 30, K('stone', 1))
    for x in range(4, 30, 7): c.VL(x, 26, 5, K('stone', -3))
    moss_patch(c, 2, 28, 26, 6); c.HL(0, 31, 32, K('soil', -2)); c.outline()


@A('bench-iron', '철제 벤치(두꺼운 판 + 주철 다리)', 2, 1, 'seat', solid=[(0, 0), (1, 0)], tags=['벤치'], rules='묘지·정원 길가.')
def _bi(c):
    cube(c, 2, 0, 28, 3, 2, 'iron', tt=2, ft=-1, ol=False); c.HL(2, 0, 28, K('iron', 4))
    slab(c, 0, 3, 32, 9, 3, 'iron', 2)
    for lx in (2, 26): c.R(lx, 12, 4, 3, K('iron', -2)); c.VL(lx, 12, 3, K('iron', 0))
    c.HL(1, 15, 30, K('soil', -2)); c.outline()

@A('iron-fence', '철창 울타리 2칸(석주 둘 + 철 가로대 + 창살)', 2, 1, 'structure', solid=[(0, 0), (1, 0)], tags=['철창', '울타리', '묘지'], rules='묘역 둘레. 2칸 단위로 가로로 잇는다.')
def _if(c):
    for x in (0, 28): slab(c, x, 1, 4, 5, 9, 'stone', 1)
    slab(c, 4, 4, 24, 4, 2, 'iron', 1)
    for x in range(6, 27, 3): c.VL(x, 10, 5, K('iron', 1)); c.P(x, 9, K('iron', 3))
    slab(c, 4, 12, 24, 3, 2, 'iron', 0)
    c.HL(0, 15, 32, K('soil', -2)); c.outline()




@A('fence-post', '철창 모서리 돌기둥(기단 + 네모 몸통 + 윗면 갓돌)', 1, 2, 'column', solid=[(0, 1)], tags=['기둥', '울타리', '묘지'], rules='철창이 꺾이는 곳.')
def _fp(c):
    cube(c, 1, 22, 14, 5, 4, 'stone', tt=2, ft=-1, ol=False)
    cube(c, 3, 17, 10, 4, 5, 'stone', tt=2, ft=-1, ol=False)
    cube(c, 4, 4, 8, 6, 14, 'stone', tt=3, ft=0, ol=False); c.HL(5, 6, 6, K('stone', 4)); c.HL(5, 8, 6, K('stone', 4)); c.HL(4, 12, 8, K('stone', -2))
    moss_patch(c, 3, 26, 10, 5); c.HL(0, 31, 16, K('soil', -2)); c.outline()



@A('lantern-pillar', '등롱 석주(기단 + 두꺼운 석주, 앞면에 등 구멍)', 1, 2, 'column', solid=[(0, 1)], tags=['가로등', '등롱', '묘지'], rules='묘지·정문 곁.')
def _lp(c):
    cube(c, 1, 22, 14, 5, 4, 'stone', tt=2, ft=-1, ol=False)
    cube(c, 3, 17, 10, 4, 5, 'stone', tt=2, ft=-1, ol=False)
    cube(c, 4, 3, 8, 7, 15, 'stone', tt=3, ft=0, ol=False); c.HL(5, 5, 6, K('stone', 4)); c.HL(5, 8, 6, K('stone', 4))
    c.R(6, 11, 4, 5, K('lamp', 2)); c.R(7, 12, 2, 3, K('lamp', 4)); c.HL(6, 10, 4, K('stone', -3)); c.HL(6, 16, 4, K('stone', -3))
    moss_patch(c, 3, 26, 10, 5); c.HL(0, 31, 16, K('soil', -2)); c.outline()

if __name__ == '__main__':
    m, ims = R.export(); sheet([i for _, i in ims], os.path.join(OUT, 'graveyard', 'preview', '_all-x4.png'))
    print(len(m), 'items')
