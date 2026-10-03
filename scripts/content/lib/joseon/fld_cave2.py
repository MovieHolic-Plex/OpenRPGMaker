"""동굴 안 물체 2차(cav_): 1차 검수(복제·벽 3단·용도 연출)에 답하는 변형·벽 부착물·구역 앵커.

 - 석순·결정·돌 변형(같은 스프라이트 복제 해소), 바위 기둥(대리석 기둥 대신), 바닥 장식(이끼·물웅덩이)
 - 벽 횃불 2종(앞면 두 줄 위에 얹는다), 보물 단상(상자를 단상 위에 놓은 한 조각), 광산 수레, 뼈 둥지
기존 조각과 같은 문법: 정면-위 3/4, 빛 왼쪽 위(왼쪽 밝고 오른쪽 어둡다), 그림자 오른쪽 아래, 안쪽 외곽선, 색은 tk.RGB 램프(잠금 팔레트)만.
이름은 모두 cav_ 로 시작한다(catalog.objects() 끝에 덧붙임).
"""
import math
from tk import *
from build import outline
from props5 import ell, shadow_ell, box, cyl
from trees import ground_shadow
from fld_props import boulder, _clean, ST, WD, ER, LF, PN, SW, PL, PS, RD, DB, DG, GW
from fld_cave import CST


def _spire(c, cx, base, h, w, ramp_hi=(6, 5, 4, 2), seed=0, curve=0.0):
    """뾰족한 돌기둥 하나: 밑이 넓고 끝이 가늘다. 왼쪽 면 밝고 오른쪽 어둡다, curve 로 끝이 휜다."""
    for k in range(h):
        t = k / float(h)
        half = max(0.7, (w / 2.0) * (1 - t ** 1.15))
        cxk = cx + curve * t * t * 3
        y = base - k
        for x in range(int(round(cxk - half)), int(round(cxk + half)) + 1):
            u = (x - cxk) / max(half, 0.8)
            tone = ramp_hi[0] if u < -0.5 else (ramp_hi[1] if u < -0.05 else (ramp_hi[2] if u < 0.5 else ramp_hi[3]))
            if rnd(x, y, seed + 4) < 0.13: tone = max(2, tone - 1)
            c.put(x, y, ST[max(2, min(tone, 5) - 1)] if k > 1 else ST[5])


def stalagmite_b():
    """가는 석순 셋 16×32: 키 다른 세 줄기가 한 밑동에서 솟는다."""
    c = Cv(T, 2 * T)
    ground_shadow(c, 9, 30, 7, 1.5, 70)
    _spire(c, 4, 29, 13, 4, seed=1)
    _spire(c, 8, 29, 24, 5, seed=2, curve=0.4)
    _spire(c, 12, 29, 17, 4, seed=3, curve=-0.4)
    return _clean(c)


def stalagmite_c():
    """작은 석순 무리 16×16: 키 낮은 뿔 넷."""
    c = Cv(T, T)
    ground_shadow(c, 9, 14, 7, 1.4, 70)
    for (cx, h, w, sd) in ((3, 6, 3, 5), (7, 9, 4, 6), (11, 7, 3, 7), (14, 4, 3, 8)):
        _spire(c, cx, 13, h, w, seed=sd)
    return _clean(c)


def stalagmite_wide():
    """큰 석순 군락 32×32(2×2): 가운데 큰 줄기와 곁줄기, 바닥에 부서진 돌."""
    c = Cv(2 * T, 2 * T)
    ground_shadow(c, 18, 30, 14, 1.8, 70)
    boulder(c, 9, 26, 5, 3, 3, ramp=CST)
    boulder(c, 26, 27, 4.6, 2.8, 8, ramp=CST)
    _spire(c, 16, 29, 27, 7, seed=11, curve=0.3)
    _spire(c, 8, 29, 15, 5, seed=12)
    _spire(c, 24, 29, 18, 5, seed=13, curve=-0.4)
    _spire(c, 29, 29, 9, 4, seed=14)
    return _clean(c)


def rock_pillar():
    """바위 기둥 16×32: 천장 종유석과 석순이 만난 거친 기둥. 어두운 암반 램프(대리석처럼 밝지 않다), 마디가 울퉁불퉁."""
    c = Cv(T, 2 * T)
    ground_shadow(c, 9, 30, 7.5, 1.7, 70)
    for y in range(0, 30):
        t = y / 29.0
        hw = 3.0 + 2.4 * (abs(t - 0.5) * 2) ** 1.5 + (1.0 if (y // 5) % 2 else 0.0) * 0.8
        for x in range(int(8 - hw), int(8 + hw) + 1):
            u = (x - 8) / max(hw, 1)
            tone = 5 if u < -0.5 else (4 if u < -0.05 else (3 if u < 0.5 else 2))
            q = rnd(x, y, 321)
            if q < 0.18: tone = max(1, tone - 1)
            elif q > 0.9: tone = min(5, tone + 1)
            if y < 3 or y > 27: tone = max(1, tone - 1)
            c.put(x, y, ST[tone])
    return _clean(c)


def crystal_b():
    """결정 군락 32×16(2×1): 푸른 결정과 자줏빛 결정이 섞여 돋는다."""
    c = Cv(2 * T, T)
    ground_shadow(c, 18, 14, 13, 1.6, 70)
    boulder(c, 10, 12, 6, 2.6, 6, ramp=CST)
    boulder(c, 25, 12, 5, 2.4, 9, ramp=CST)
    for (cx, base, h, w, pal) in ((5, 12, 8, 3, DB), (10, 12, 13, 4, DB), (15, 12, 7, 3, DB), (22, 12, 9, 3, PS), (27, 12, 12, 4, DB), (30, 12, 6, 3, DB)):
        ramp = pal if pal is DB else DB
        for k in range(h):
            half = max(0.6, (w / 2.0) * (1 - k / (h * 1.12)))
            for x in range(int(cx - half), int(cx + half) + 1):
                u = (x - cx) / max(half, 0.5)
                c.put(x, base - k, ramp[6] if (u < -0.3 and k > h // 3) else (ramp[5] if u < 0.4 else ramp[3]))
        c.put(cx, base - h, ramp[6])
    return _clean(c)


def crystal_c():
    """긴 결정 한 줄기 16×32: 어둠 속에서 한 줄기만 도드라지게 빛난다(가운데 밝은 줄)."""
    c = Cv(T, 2 * T)
    ground_shadow(c, 9, 30, 6, 1.5, 70)
    boulder(c, 8, 28, 5.5, 2.4, 14, ramp=CST)
    cx, base, h, w = 8, 28, 24, 6
    for k in range(h):
        half = max(0.7, (w / 2.0) * (1 - k / (h * 1.08)))
        for x in range(int(cx - half), int(cx + half) + 1):
            u = (x - cx) / max(half, 0.5)
            c.put(x, base - k, DB[6] if u < -0.35 else (DB[5] if u < 0.35 else DB[3]))
    for k in range(4, h - 3):
        c.put(cx - 1, base - k, DB[6])
    c.put(cx, base - h, DB[6])
    return _clean(c)


def rock_shard():
    """뾰족한 돌 조각 16×16: 모난 암석 둘."""
    c = Cv(T, T)
    ground_shadow(c, 9, 14, 6.5, 1.4, 75)
    boulder(c, 6, 10, 4.2, 4.4, 21, ramp=CST, sharp=0.35)
    boulder(c, 11, 11, 3.2, 3.0, 24, ramp=CST, sharp=0.35)
    return _clean(c)


def rubble():
    """부서진 돌무더기 32×16(2×1): 천장에서 떨어진 잔돌."""
    c = Cv(2 * T, T)
    ground_shadow(c, 18, 14, 13, 1.5, 70)
    for (cx, cy, rx, ry, sd) in ((8, 10, 5, 3.6, 31), (16, 11, 4, 3, 33), (23, 10, 5.2, 3.8, 35), (28, 12, 2.6, 2.0, 37), (4, 12, 2.4, 1.8, 39)):
        boulder(c, cx, cy, rx, ry, sd, ramp=CST)
    return _clean(c)


def moss_patch():
    """바닥 이끼 16×16(걸을 수 있는 장식): 어두운 초록 얼룩 몇 덩이."""
    c = Cv(T, T)
    for (cx, cy, rx, ry, sd) in ((6, 7, 4.6, 3.2, 3), (11, 10, 3.6, 2.6, 5), (4, 12, 2.4, 1.8, 7)):
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                u, v = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
                if u * u + v * v <= 1.0 + 0.25 * (rnd(x, y, sd) - 0.5):
                    t = PN[3] if (u < -0.1 and v < 0.1) else (PN[2] if rnd(x, y, sd + 1) > 0.25 else PN[1])
                    if rnd(x, y, sd + 2) > 0.93: t = PN[4]
                    c.put(x, y, t)
    return c


def puddle():
    """물웅덩이 16×16(걸을 수 있는 장식): 얕은 웅덩이와 가장자리 젖은 돌."""
    c = Cv(T, T)
    w = RGB['water']
    for y in range(T):
        for x in range(T):
            u, v = (x + 0.5 - 8.0) / 6.2, (y + 0.5 - 9.0) / 3.6
            d = u * u + v * v + 0.18 * (rnd(x, y, 91) - 0.5)
            if d <= 1.0:
                t = DB[3] if d < 0.45 else DB[2]
                if v < -0.3 and u < 0.2: t = DB[4]
                if d < 0.6 and rnd(x, y, 92) > 0.9: t = DB[5]
                c.put(x, y, t)
            elif d <= 1.25 and rnd(x, y, 93) > 0.3:
                c.put(x, y, ST[2] if v > 0 else ST[4])
    return c


def torch(kind=0):
    """벽 횃불 16×32: 앞면 벽(두 줄)에 박힌 쇠 받침 위에서 불이 탄다. 벽 위에 얹는 조각이라 바닥 그림자가 없다. kind 1 = 둥근 화덕형."""
    c = Cv(T, 2 * T)
    for y in range(13, 24):                                              # 나무 자루
        c.put(7, y, WD[4]); c.put(8, y, WD[3])
    if kind == 0:
        for (dx, dy) in ((5, 12), (6, 12), (7, 12), (8, 12), (9, 12), (10, 12)):
            c.put(dx, dy, GW[3])                                         # 쇠 고리
        c.put(5, 11, GW[4]); c.put(10, 11, GW[2])
        flame = [(8, 3, PS[6]), (7, 4, PS[6]), (8, 4, PS[5]), (9, 4, PS[5]), (7, 5, PS[5]), (8, 5, PS[5]), (9, 5, PS[4]), (6, 6, PS[5]), (7, 6, PS[4]), (8, 6, PS[4]), (9, 6, PS[4]),
                 (10, 6, PS[3]), (6, 7, PS[4]), (7, 7, PS[3]), (8, 7, RD[5]), (9, 7, RD[5]), (10, 7, RD[4]), (6, 8, PS[3]), (7, 8, RD[5]), (8, 8, RD[4]), (9, 8, RD[4]), (10, 8, RD[3]),
                 (7, 9, RD[4]), (8, 9, RD[3]), (9, 9, RD[3]), (7, 10, PS[2]), (8, 10, PS[3]), (9, 10, PS[2])]
    else:
        ell(c, 8, 12, 5.0, 2.6, lambda x, y, u, v: GW[5] if (v < 0 and u < 0.2) else (GW[3] if v < 0.5 else GW[2]))
        ell(c, 8, 11.5, 3.6, 1.5, lambda x, y, u, v: PS[3])
        flame = [(8, 4, PS[6]), (7, 5, PS[6]), (8, 5, PS[5]), (9, 5, PS[5]), (7, 6, PS[5]), (8, 6, PS[4]), (9, 6, PS[4]), (6, 7, PS[4]), (7, 7, PS[4]), (8, 7, PS[3]), (9, 7, PS[3]),
                 (10, 7, RD[5]), (6, 8, PS[3]), (7, 8, RD[5]), (8, 8, RD[4]), (9, 8, RD[4]), (10, 8, RD[3]), (7, 9, RD[3]), (8, 9, RD[3]), (9, 9, PS[2])]
    for x, y, col in flame:
        c.put(x, y, col)
    return _clean(c)


def chest_dais():
    """보물 단상 48×32(3×2): 돌 단 위에 상자를 올렸다. 앞의 한 줄은 오를 수 있는 낮은 계단(걸을 수 있음)."""
    c = Cv(3 * T, 2 * T)
    ground_shadow(c, 26, 30, 21, 1.8, 70)
    box(c, 3, 22, 42, 8, 8, ST, top=(5, 4), face=(4, 3, 2, 2))             # 아랫단
    box(c, 9, 14, 30, 6, 6, ST, top=(6, 5), face=(5, 4, 3, 2))             # 윗단
    for x in range(9, 39):                                                 # 윗단 앞 모서리 하이라이트
        c.put(x, 14, ST[6] if x < 24 else ST[5])
    for y in range(8, 15):                                                 # 상자(윗단 위 가운데)
        for x in range(18, 30):
            if y < 11:
                if y == 8 and (x < 19 or x > 28): continue
                t = WD[6] if y == 8 else (WD[5] if x < 22 else (WD[4] if x < 26 else WD[3]))
            else:
                t = WD[5] if x < 21 else (WD[4] if x < 25 else (WD[3] if x < 28 else WD[2]))
            c.put(x, y, t)
    for x in range(18, 30):
        c.put(x, 11, WD[1]); c.put(x, 14, WD[1])
    for x in (19, 28):
        for y in range(8, 15):
            c.put(x, y, GW[4] if x == 19 else GW[2])
    c.put(23, 12, PS[5]); c.put(24, 12, PS[4]); c.put(23, 13, PS[4]); c.put(24, 13, PS[3])
    for k in range(4):                                                      # 윗단 위 금화 몇 닢(빛 받는 점)
        c.put(13 + 3 * k, 12 + (k % 2), PS[6] if k % 2 else PS[5])
    return _clean(c)


def mine_cart():
    """광산 수레 32×16(2×1): 나무 궤짝에 광석이 불룩, 쇠바퀴 둘."""
    c = Cv(2 * T, T)
    ground_shadow(c, 18, 14, 13, 1.5, 70)
    for y in range(5, 12):
        for x in range(3, 29):
            t = WD[5] if x < 8 else (WD[4] if x < 17 else (WD[3] if x < 24 else WD[2]))
            if y == 5: t = WD[6] if x < 16 else WD[5]
            c.put(x, y, t)
    for x in range(3, 29): c.put(x, 8, WD[1])
    for x in (3, 15, 27):
        for y in range(5, 12): c.put(x, y, GW[3])
    for k in range(9):                                                      # 광석 더미(윗면 위로 불룩)
        x = 5 + 2 * k
        h = 2 + (1 if k % 3 == 1 else 0) - (1 if k in (0, 8) else 0)
        for dy in range(h):
            c.put(x, 4 - dy, ST[5] if k % 2 else ST[4]); c.put(x + 1, 4 - dy, ST[3])
        if k % 3 == 1: c.put(x, 4 - h, PS[5]);
    for cx in (8, 22):
        for (dx, dy) in ((-1, 0), (0, -1), (1, 0), (0, 1), (0, 0)):
            c.put(cx + dx, 13 + dy, GW[3] if (dx, dy) != (0, 0) else GW[2])
    return _clean(c)


def bone_nest():
    """뼈 둥지 32×16(2×1): 어두운 오목한 잠자리를 뼈와 해골이 빙 두른다(몬스터 소굴 앵커)."""
    c = Cv(2 * T, T)
    for y in range(T):
        for x in range(2 * T):
            u, v = (x + 0.5 - 16.0) / 13.0, (y + 0.5 - 9.0) / 5.2
            d = u * u + v * v + 0.12 * (rnd(x, y, 61) - 0.5)
            if d <= 1.0:
                c.put(x, y, ST[0] if d < 0.45 else ST[1])
    for (x, y, k) in ((4, 8, 0), (8, 5, 1), (14, 4, 0), (20, 4, 1), (26, 7, 0), (24, 12, 1), (13, 13, 0), (7, 11, 1)):
        if k == 0:
            for i in range(4): c.put(x + i, y + (1 if i % 2 else 0), PL[6] if i < 2 else PL[4])
            c.put(x - 1, y, PL[5]); c.put(x + 4, y + 1, PL[5])
        else:
            for dx, dy in ((0, 0), (1, 0), (2, 0), (0, 1), (2, 1), (1, 1)): c.put(x + dx, y + dy, PL[6] if dy == 0 else PL[4])
            c.put(x + 1, y + 1, ST[0]); c.put(x, y + 1, ST[0]) if k == 1 else None
    return _clean(c)


def objects():
    d = {}
    d['cav_stalagmite_b'] = stalagmite_b()
    d['cav_stalagmite_c'] = stalagmite_c()
    d['cav_stalagmite_wide'] = stalagmite_wide()
    d['cav_rockpillar'] = rock_pillar()
    d['cav_crystal_b'] = crystal_b()
    d['cav_crystal_c'] = crystal_c()
    d['cav_rock_c'] = rock_shard()
    d['cav_rubble'] = rubble()
    d['cav_moss'] = moss_patch()
    d['cav_puddle'] = puddle()
    d['cav_torch_a'] = torch(0)
    d['cav_torch_b'] = torch(1)
    d['cav_chest_dais'] = chest_dais()
    d['cav_cart'] = mine_cart()
    d['cav_nest'] = bone_nest()
    return d


if __name__ == '__main__':
    import sys
    from PIL import Image
    o = objects()
    names = sys.argv[2].split(',') if len(sys.argv) > 2 and sys.argv[2] else list(o)
    sc = int(sys.argv[3]) if len(sys.argv) > 3 else 4
    ims = [(n, o[n].img()) for n in names]
    Wd = sum(i.width * sc + 12 for _, i in ims) + 12
    H = max(i.height for _, i in ims) * sc + 24
    s = Image.new('RGBA', (Wd, H), (74, 70, 66, 255))
    x = 12
    for n, i in ims:
        s.alpha_composite(i.resize((i.width * sc, i.height * sc), Image.NEAREST), (x, H - i.height * sc - 6))
        x += i.width * sc + 12
    s.convert('RGB').save(sys.argv[1])
    print('violations', len(VIOLATIONS))
