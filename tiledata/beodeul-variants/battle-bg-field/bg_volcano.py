# 전투 배경 5 — 화산 필드 (volcano-field). 바닥·물체 = src-volcano/ 의 복사한 그림 함수
# (재 바닥 ground_render·용암 lava_layer·열기 heat_layer·분화구 산 crater_mountain·연기 기둥·현무암 기둥·그을린 나무).
import os, sys, random
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, 'src-volcano'))
import numpy as np
from PIL import Image
import bgkit as K
from vf_scene import Scene
import vf_pieces as V, vf_struct as S, vf_mountain as M, vf_auto as A

SLUG = 'volcano-field'
CW, CH = 40, 23


def backdrop():
    b = K.canvas()
    # 연기 낀 하늘: 위는 짙은 보라 재, 지평선 쪽은 용암 빛이 비친 붉은 띠(단 4개, 그라데이션 아님)
    K.sky(b, [(46, '#2b203f'), (96, '#3a2a44'), (136, '#582840'), (176, '#863736')])
    SMK = ['#2b203f', '#3e403d', '#595b58', '#7a6c70']
    K.cloud(b, 110, 50, 120, 22, SMK, seed=31)
    K.cloud(b, 520, 40, 130, 24, SMK, seed=33)
    K.cloud(b, 330, 22, 90, 14, ['#2b203f', '#3a2a44', '#3e403d', '#595b58'], seed=35, flat=True)
    # 먼 현무암 산줄기(아주 어둡게, 윗선에 용암 빛 테)
    K.ridge(b, 150, 20, ['#0b0b12', '#191a24', '#282a38', '#863736'], seed=61, sc=70, sc2=17,
            peaks=[(60, 40, 60), (590, 50, 70)], tex=0.03)
    # 앵커: 분화구 산(원 지도 crater_mountain 함수를 작은 칸 수로) + 연기 기둥
    MT = M.crater_mountain(Wc=12, Hc=8, seed=31, Rx=90.0, Ry=30.0, Hh=74.0)
    SM = M.smoke_column(Wc=5, Hc=6, seed=41)
    mx = 320 - MT.width // 2 + 10; mb = 170
    a = np.array(MT)[:, :, 3] > 0
    top = int(np.where(a.any(1))[0].min())
    cols = np.where(a[top + 2])[0]
    cxm = int(cols.mean()) if len(cols) else MT.width // 2
    K.blit(b, SM, mx + cxm - SM.width // 2 + 6, mb - MT.height + top - SM.height + 18)
    K.place(b, MT, mx, mb, shadow=False)
    K.ridge(b, 174, 12, ['#0b0b12', '#191a24', '#282a38', '#3a3d4e'], seed=63, sc=34, sc2=9, x0=0, x1=250)
    K.ridge(b, 174, 12, ['#0b0b12', '#191a24', '#282a38', '#3a3d4e'], seed=65, sc=34, sc2=9, x0=410, x1=640)
    return b


def build():
    s = Scene(CW, CH, seed=73)
    rng = random.Random(7303)
    # ---------------------------------------------------------- 바닥: 검은 재 + 굵은 화산재(cinder) 덩이 + 용암 줄기(양옆에서 앞으로, 뒤로 가로)
    for (cx, cy, rx, ry, sd) in ((4, 16, 2.6, 2.0, 3), (36, 17, 2.4, 2.2, 5), (11, 12, 2.2, 0.8, 9), (29, 12, 2.2, 0.8, 11)):
        for y in range(CH):
            for x in range(CW):
                if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 + 0.5 * (K.h2(x, y, sd) - 0.5): s.cinder.add((x, y))
    # 용암: 뒤쪽(지평선 바로 앞 한 줄) 줄기 두 토막 + 양옆 끝에서 비스듬히 앞으로 흘러내리는 갈래(배틀러 자리 밖)
    for x in range(0, 12):
        s.lava.add((x, 11))
        if x < 7: s.lava.add((x, 12))
    for y in range(13, 21):
        x0 = 1 if y < 15 else 0
        s.lava.add((x0, y)); s.lava.add((x0 + 1, y))
    for x in range(29, CW):
        s.lava.add((x, 11))
        if x >= 35: s.lava.add((x, 12))
    for y in range(13, 19):
        x0 = 38 if y > 13 else 37
        s.lava.add((x0, y)); s.lava.add((x0 + 1, y))
    s.join = set()
    s.scorch_pts = [(20, 11), (36, 20)]
    # ---------------------------------------------------------- 뒤쪽: 현무암 기둥·흑요석·그을린 나무(지평선 줄)
    for (n, x, y, dx) in (('basalt_columns', 15, 11, 0), ('basalt_columns_low', 17, 11, 4), ('obsidian_spire', 24, 11, 0), ('basalt_columns', 25, 11, 6),
                          ('charred_tree_b', 4, 10, 0), ('charred_tree_a', 31, 10, 0), ('obsidian_cluster', 21, 11, 0)):
        s.at(getattr(V, n)(), x, y, block=None, dx=dx)
    # ---------------------------------------------------------- 양옆 가장자리: 현무암·그을린 나무·짐승 뼈·분기공
    for (n, x, y, dx) in (('charred_tree_b', 2, 14, 0), ('basalt_columns', 5, 17, 0), ('basalt_boulder', 3, 20, 4), ('charred_snag', 6, 13, 0),
                          ('beast_skull', 35, 20, 4), ('basalt_columns_low', 37, 18, 0), ('charred_tree_a', 36, 13, 0), ('obsidian_spire', 38, 21, 2),
                          ('basalt_rocks', 6, 21, 0), ('lava_bomb', 35, 21, 0), ('charred_stump', 7, 18, 0), ('sulfur_vent_big', 35, 16, 2)):
        s.at(getattr(V, n)(), x, y, block=None, dx=dx)
    for (n, x, y) in (('ember_scatter', 9, 12), ('pumice_scatter', 30, 13), ('burnt_grass', 8, 16), ('burnt_grass', 33, 19), ('basalt_rocks', 10, 22),
                      ('ember_scatter', 29, 22), ('burnt_grass', 4, 22)):
        im = getattr(V, n)(); s.decals.append((x * 16 + rng.randrange(-3, 4), (y + 1) * 16 - im.height, im))
    sv = V.steam_wisp(); s.top.append((35 * 16 + 10, 16 * 16 - sv.height - 4, sv))
    im = s.render(A.path_sheet(), A.ground_basaltflag())
    hz = K.horizon_line(seed=17, base=175, amp=3)
    out = K.compose(backdrop(), im, s.objs + [(0, x, y, i, False) for (x, y, i) in s.top], hz, rim='#191a24', tufts=None, seed=17)
    return K.finish(out)


if __name__ == '__main__':
    im = build()
    im.save(os.path.join(HERE, SLUG + '.png'))
    print(SLUG, im.size, K.ncolors(im))
