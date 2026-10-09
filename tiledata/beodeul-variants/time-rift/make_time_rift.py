# 시간의 틈·허공 쉼터(time-rift) — 40x32 데모 지도 + 조각 내보내기.
# 다시 돌리면 같은 그림: python3 tiledata/beodeul-variants/time-rift/make_time_rift.py
import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import numpy as np
from tr_base import *
from tr_base import _hash
import tr_isle as I, tr_void as V, tr_auto as A, tr_props as PR
from tr_scene import Scene

W, H = 40, 32


def ell(cx, cy, rx, ry, seed=1, wob=0.0): return I.ellipse_mask(W * T, H * T, cx, cy, rx, ry, seed, wob)


def build():
    s = Scene(W, H, seed=7)
    Wp, Hp = W * T, H * T
    # ---------------------------------------------------------------- 떠 있는 돌 (한 덩이 = 같은 높이로 이어진 돌)
    DAIS = (328, 216, 106, 70)
    dais = ell(*DAIS)
    plat_s = ell(328, 436, 56, 38, 3, 2.0)
    plat_n = ell(330, 70, 54, 36, 4, 2.0)
    plat_e = ell(570, 126, 56, 38, 5, 2.0)
    path = set()
    path |= {(x, y) for x in (20, 21) for y in range(17, 26)}                 # 남쪽 길(도착 → 돌 단)
    path |= {(x, y) for x in (20, 21) for y in range(6, 11)}                  # 북쪽 길
    path |= {(x, y) for x in range(26, 31) for y in (12, 13)}                 # 동쪽 길: 돌 단 → 동쪽
    path |= {(x, y) for x in (29, 30) for y in range(8, 12)}                  #   → 북으로 꺾어
    path |= {(x, y) for x in (31, 32) for y in (8, 9)}                        #   → 동쪽 포털 단
    pm = I.cells_mask(path, W, H, seed=11, round_r=3, wob=1.4)
    main = dais | plat_s | plat_n | plat_e | pm
    isl = I.Island(main, 'path', body=5, root=12, seed=21)
    isl.region(dais, 'dais', body=18, root=58, seed=22, center=DAIS, glow='blue')
    for i, m in enumerate((plat_s, plat_n, plat_e)): isl.region(m, 'plat', body=8, root=30, seed=30 + i)
    s.add_island(isl)
    s.dais_center = DAIS
    # 서쪽 포털 단(별빛 다리로 잇는다)
    plat_w = ell(84, 206, 58, 42, 6, 2.0)
    iw = I.Island(plat_w, 'plat', body=8, root=32, seed=41)
    ww = s.add_island(iw)
    # 남동 쉼터 섬(징검돌로 잇는다)
    rest = ell(522, 342, 68, 42, 7, 2.5)
    ir = I.Island(rest, 'plat', body=8, root=34, seed=51)
    rw = s.add_island(ir)
    # 별빛 다리(서쪽): y 13 줄, 서쪽 단 끝 ~ 돌 단 끝
    ywest = 13
    xw = max(x for (x, y) in ww if y == ywest); xd = min(x for (x, y) in s.walk if y == ywest and x > 10)
    s.bridge |= {(x, ywest) for x in range(xw + 1, xd)}
    # 징검돌(남동): 돌 단 → 쉼터 섬, 4방향으로 이어지게 굽이진 사슬
    chain = [(26, 16), (27, 16), (27, 17), (28, 17), (28, 18), (29, 18)]
    for i, (x, y) in enumerate(chain):
        if (x, y) in s.walk: continue
        m = ell(x * T + 8 + (_hash(i, 1, 3) - .5) * 2, y * T + 8, 7.4, 6.2)
        s.add_island(I.Island(m, 'rock', body=3, root=9, seed=60 + i), walk={(x, y)})
    s.stones = chain
    return s


def furnish(s):
    """앵커·소품 배치. 좌표는 칸(왼쪽 아래 칸 기준)."""
    # ① 중앙 돌 단: 시간 받침(가운데 낮은 둥근 단 위)
    s.prop(PR.chrono_pedestal(), 20, 13, name='chrono-pedestal')
    # ② 부러진 기둥 고리(돌 단 가장자리, 높이·망가짐 제각각) + 쓰러진 토막·돌무더기
    s.prop(PR.pillar_broken(True, 3), 15, 12, name='pillar-broken-tall')
    s.prop(PR.pillar_broken(False, 8), 25, 11, name='pillar-broken-short')
    s.prop(PR.pillar_broken(True, 12), 24, 16, name='pillar-broken-tall')
    s.prop(PR.drum_fallen(), 15, 15, name='drum-fallen')
    s.prop(PR.rubble(), 23, 10, name='rubble-rift')
    # ③ 포털 넷(각 갈래 끝)
    s.prop(PR.portal('teal', 4), 19, 28, blocks=[(0, 0), (3, 0)], name='portal-teal')       # 도착(남)
    s.prop(PR.portal('blue', 1), 19, 4, blocks=[(0, 0), (3, 0)], name='portal-blue')        # 북
    s.prop(PR.portal('violet', 2), 3, 12, blocks=[(0, 0), (3, 0)], name='portal-violet')    # 서
    s.prop(PR.portal('gold', 3), 34, 8, blocks=[(0, 0), (3, 0)], name='portal-gold')        # 동
    for (cells, col) in (({(20, 29), (21, 29)}, 'teal'), ({(20, 5), (21, 5), (20, 6), (21, 6)}, 'blue'),
                         ({(4, 13), (5, 13), (4, 14), (5, 14)}, 'violet'), ({(35, 9), (36, 9), (35, 10), (36, 10)}, 'gold')):
        s.spill.append((cells, col))
    # ④ 별빛 다리 기둥(다리 양 끝)
    xs = sorted(x for (x, y) in s.bridge)
    s.prop(PR.bridge_post('violet'), xs[0] - 1, 12, name='bridge-post')
    s.prop(PR.bridge_post('blue'), xs[-1] + 1, 12, name='bridge-post')
    # ⑤ 허공의 쉼터: 벤치 + 가로등 + 빛 수정
    s.prop(PR.bench_stone(), 31, 21, name='rift-bench')
    s.prop(PR.rift_lamp(), 33, 21, name='rift-lamp')
    s.prop(PR.light_crystal(), 35, 22, name='light-crystal')
    s.prop(PR.pillar_broken(False, 5), 30, 23, name='pillar-broken-short')
    # 바닥 장식
    s.decal(PR.crack_glow(29, 2), 16, 13, name='crack-glow')
    s.decal(PR.crack_glow(33, 1), 23, 14, name='crack-glow-small')
    s.decal(PR.star_motes(31), 18, 16, name='star-motes')
    s.decal(PR.star_motes(37), 33, 23, name='star-motes')
    s.decal(PR.star_motes(41), 5, 15, name='star-motes')
    # ⑥ 허공의 떠다니는 조각(섬 아래 층) — 통행과 무관(허공 막힘)
    s.voidprop(PR.arch_drift(7), 2 * T, 19 * T, name='arch-drift')
    s.voidprop(PR.pillar_drift(5), 9 * T, 24 * T + 6, name='pillar-drift')
    s.voidprop(PR.pillar_drift(9, 1), 35 * T + 4, 26 * T, name='pillar-drift')
    s.voidprop(PR.clock_ring(9), 9 * T, 2 * T, name='clock-ring')
    s.voidprop(PR.time_shard(25), 27 * T, 1 * T + 8, name='time-shard')
    s.voidprop(PR.time_shard(26), 14 * T + 8, 27 * T, name='time-shard')
    s.voidprop(PR.far_isles(27), 30 * T, 1 * T, name='far-isles')
    s.voidprop(PR.far_isles(28), 1 * T, 28 * T, name='far-isles')
    s.voidprop(PR.rock_drift(True, 71), 37 * T, 14 * T, name='rock-drift-big')
    s.voidprop(PR.rock_drift(False, 72), 12 * T, 21 * T, name='rock-drift-small')
    s.voidprop(PR.rock_drift(False, 73), 25 * T, 26 * T, name='rock-drift-small')
    s.voidprop(PR.rock_drift(False, 74), 1 * T + 8, 4 * T, name='rock-drift-small')
    s.marks.update({'arrival_portal': (20, 28), 'north_portal': (20, 4), 'west_portal': (4, 12), 'east_portal': (35, 8),
                    'chrono_pedestal_front': (20, 14), 'rest_bench': (31, 22), 'bridge_west': (xs[0], 13), 'bridge_east': (xs[-1], 13)})


if __name__ == '__main__':
    s = build(); furnish(s)
    im = s.render()
    os.makedirs(os.path.join(HERE, '_work'), exist_ok=True)
    im.convert('RGB').save(os.path.join(HERE, '_work', 'map1x.png'))
    im.convert('RGB').resize((im.width * 2, im.height * 2), Image.NEAREST).save(os.path.join(HERE, '_work', 'map2x.png'))
    seen = s.bfs((20, 27))
    g = s.walk_grid()
    print('walk', int(g.sum()), 'reached', len(seen), 'empty', s.empty())
    for k, v in s.marks.items(): print(k, v, v in seen)
