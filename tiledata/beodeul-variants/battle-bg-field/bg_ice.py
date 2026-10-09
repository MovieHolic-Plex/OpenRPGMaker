# 전투 배경 3 — 빙하기 설원 (ice-age-field). 바닥·빙벽·물체 = src-ice/ 의 복사한 그림 함수
# (눈 바닥 snow_rgb·눈길 오토타일·눈 번짐·빙하 윗면/앞면 glacier_layer·언 폭포·세락·눈 전나무·매머드 뼈).
import os, sys, random
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, 'src-ice'))
import numpy as np
from PIL import Image
import bgkit as K
from iaf_scene import Scene
import iaf_pieces as A, iaf_props as B, iaf_ground as G

SLUG = 'ice-age-field'
CW, CH = 40, 23
MF = os.path.join(K.VROOT, 'mountain-fortress', 'parts')      # 원 지도가 쓰는 공용 눈 전나무·눈 바위(읽기만)
def mf(n): return Image.open(os.path.join(MF, n + '.png')).convert('RGBA')
SN = ['#2c3c66', '#4c6394', '#7a92c0', '#a6bcdc', '#cadaee', '#e6f0fa', '#ffffff']
IC = ['#16305c', '#24548c', '#3e84b8', '#6cb4d8', '#9ce0ee', '#cff4f8', '#f2ffff']


def backdrop():
    b = K.canvas()
    K.sky(b, [(40, '#6c9cd0'), (84, '#86b0cc'), (124, '#aad0e0'), (176, '#cceaf0')])
    CL = ['#a6bcdc', '#cadaee', '#e6f0fa', '#ffffff']
    K.cloud(b, 120, 44, 110, 22, CL, seed=13)
    K.cloud(b, 470, 30, 70, 14, CL, seed=15)
    K.cloud(b, 330, 70, 50, 8, CL, seed=17, flat=True)
    # 먼 얼음 산(눈 램프 → 얼음 램프): 뾰족 봉우리, 왼쪽 위 빛, 오른쪽 사면 그늘
    K.ridge(b, 120, 22, ['#3a5a86', '#86b0cc', '#aad0e0', '#eefcff'], seed=41, sc=80, sc2=21,
            peaks=[(70, 70, 70), (210, 44, 50), (360, 82, 80), (560, 66, 70)], tex=0.04)
    K.ridge(b, 132, 14, ['#24548c', '#6cb4d8', '#9ce0ee', '#cff4f8'], seed=43, sc=50, sc2=13,
            peaks=[(140, 40, 46), (470, 46, 56), (630, 30, 40)], tex=0.04)
    return b


def build():
    s = Scene(CW, CH, seed=52)
    rng = random.Random(5202)
    # ---------------------------------------------------------- 빙하(뒤): 윗면 끝줄 GT, 앞면 밑줄은 10줄로 고르다 → 앞면이 지평선 뒤 벽
    GT = []
    for x in range(CW):
        g = 6
        if x < 5: g = 7
        elif 12 <= x < 20: g = 5
        elif 28 <= x < 33: g = 6
        elif x >= 35: g = 7
        GT.append(g)
    FH = [10 - g for g in GT]
    s.set_glacier(GT, FH)
    # ---------------------------------------------------------- 바닥: 눈 + 바람 눈 번짐(양옆) + 가로지르는 눈길(발자국)
    for y in range(11, 13):
        for x in range(CW):
            if (x < 8 and y == 11) or (x > 31 and y == 12): s.drift.add((x, y))
    for (cx, cy, rx, ry, sd) in ((2, 17, 3.2, 2.6, 3), (38, 18, 3.0, 2.8, 5)):
        for y in range(CH):
            for x in range(CW):
                if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 + 0.4 * (K.h2(x, y, sd) - 0.5): s.drift.add((x, y))
    s.path -= s.drift
    # 언 웅덩이(왼쪽 앞) — 원 지도의 언 호수 얼음 그림
    for y in range(CH):
        for x in range(CW):
            if ((x - 3.5) / 3.6) ** 2 + ((y - 20.5) / 1.6) ** 2 <= 1: s.lake.add((x, y))
    s.drift -= s.lake; s.path -= s.lake
    # ---------------------------------------------------------- 빙벽 앵커: 언 폭포 · 갇힌 짐승 · 빙벽 동굴
    s.face_decal(A.glacier_cave(FH[30]), 30 * 16, (GT[30] + 1) * 16, name='glacier_cave')
    s.face_decal(A.frozen_beast(), 14 * 16, (GT[15] + 1) * 16 + 4, name='frozen_beast')
    IF = A.icefall(FH[6])
    s.at(IF, 6, 11, block=None, shadow=False, sorty=(GT[6] + 1) * 16, name='icefall')
    for (x, y, n) in ((2, 6, 'serac'), (9, 5, 'ice_shards'), (22, 5, 'serac'), (26, 5, 'ice_shards'), (36, 6, 'ice_shards')):
        im = getattr(A, n)()
        s.at(im, x, GT[x], block=None, dy=-3, name=n)          # 빙하 윗면 마지막 줄(지평선 아래 보이는 눈 갓) 위에 선다
    # ---------------------------------------------------------- 가장자리: 눈 전나무 덩이·눈 바위·세락·매머드 뼈·표지
    for (n, x, y, fl) in (('fir_snow_l', -1, 13, 0), ('fir_snow_m', 2, 12, 1), ('fir_snow_s', 5, 13, 0), ('fir_dusted', 0, 16, 1),
                          ('fir_snow_m', 34, 12, 0), ('fir_snow_l', 37, 13, 1), ('fir_snow_s', 33, 14, 1), ('fir_dusted', 38, 16, 0)):
        im = mf(n); im = im.transpose(Image.FLIP_LEFT_RIGHT) if fl else im
        s.at(im, x, y, block=None, name=n)
    s.at(mf('snowrock_l'), 0, 22, block=None)
    s.at(A.rock_rimed(), 6, 18, block=None, shadow=False)
    s.at(A.serac(), 1, 19, block=None)
    s.at(B.marker_standing(), 7, 12, block=None)
    s.at(A.mammoth_ribs(), 30, 11, block=None, dx=6)
    s.at(A.mammoth_skull(), 35, 21, block=None)
    s.at(A.tusk_single(), 36, 19, block=None, dx=2)
    s.at(A.ice_shards(), 37, 21, block=None, dx=4)
    s.at(mf('snowrock_m'), 36, 18, block=None, dx=6)
    s.at(B.frost_snag(), 9, 12, block=None, dx=-4)
    for (x, y, n) in ((4, 14, 'rocks_snowy'), (6, 15, 'frozen_grass'), (36, 15, 'frozen_grass'), (35, 16, 'rocks_snowy'), (12, 11, 'frozen_grass'),
                      (27, 11, 'rocks_snowy'), (3, 22, 'frozen_grass'), (36, 22, 'bone_scatter')):
        im = (getattr(A, n) if hasattr(A, n) else getattr(B, n))()
        s.decal(im, x, y, rng.randrange(-3, 4), rng.randrange(-2, 2), name=n)
    for (x, y) in ((4, 20), (2, 21)): s.decal(B.frozen_reeds(), x, y, name='frozen_reeds')
    for (x, y) in ((1, 13), (3, 14), (34, 14), (36, 13)): s.decal(B.tracks_beast(), x, y, name='tracks_beast')
    im = s.render(G.trail_sheet(footprints=False), G.ground_packed(footprints=False), G.drift_sheet())
    # 지평선 = 빙하 윗면 마지막 몇 화소(눈 갓) 위. 그 위는 하늘·먼 얼음 산.
    xs = np.arange(640)
    hz = np.array([(GT[x // 16]) * 16 - 10 for x in xs]) + np.rint((K.n1(xs, 7, 3) - 0.5) * 4).astype(int)
    out = K.compose(backdrop(), im, s.objs, hz, rim=SN[2], tufts=None, seed=3)
    return K.finish(out)


if __name__ == '__main__':
    im = build()
    im.save(os.path.join(HERE, SLUG + '.png'))
    print(SLUG, im.size, K.ncolors(im))
