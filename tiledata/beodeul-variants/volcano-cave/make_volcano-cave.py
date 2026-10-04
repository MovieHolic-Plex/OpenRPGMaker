# 화산 동굴 — 56x44 한 화면 던전. 용암 강·용암 폭포·바위 다리·대장간 터·흑요석 제단. 다시 돌리면 같은 그림.
#   python3 make_volcano-cave.py
import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '_common-4'))
sys.path.insert(0, HERE)
import numpy as np
from PIL import Image
import c4
from c4 import Scene, Parts
import pf, pd, pz
import vc_pieces as V
import vc_terrain as T
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = HERE
W, H = T.W, T.H
P = Parts()

op, lava, solid, face, kind = T.build_grid()
frames = []
for t in range(4):
    a, meta = T.render_base(t)
    frames.append(a)
lavapx = meta['lavapx']
S = Scene(W, H)
S.walk[:] = op & ~lava
dec = solid | lava | (kind == 4) | (kind == 6)                    # 「있는 것」 칸
def mark(x0, y0, w, h):
    dec[max(0, y0):min(H, y0 + h), max(0, x0):min(W, x0 + w)] = True

def at(img, cx, cy, nb=1, name='', walk=False, cover=True):
    """img 의 바닥 왼쪽 칸이 (cx,cy). nb: 막을 아랫줄 수."""
    if hasattr(img, 'img'): img = pz.fin(img)
    w, h = img.size
    cw, ch = (w + 15) // 16, (h + 15) // 16
    x = cx * 16 + (16 * cw - w) // 2; y = (cy + 1) * 16 - h
    fp = np.s_[cy:cy + 1, cx:cx + cw]
    if solid[fp].any() or face[fp].any() or (lava[fp].any() and name != 'bridge') or (not walk and dec[fp].any() and cover and False):
        print('건너뜀', name or img.size, cx, cy); return None
    S.put(img, x, y, name, block=None if walk else (cx, cy - nb + 1, cx + cw - 1, cy))
    if cover: mark(cx, cy - ch + 1, cw, ch)
    return img

# ---- 조각 (새로 찍은 것)
pieces = {
    'furnace': (V.furnace(), '대장간 큰 화덕 48x48 (3x3칸) — 벽돌 몸통·불구멍·굴뚝'),
    'bellows': (V.bellows(), '풀무 32x24'),
    'coal_pile': (V.coal_pile(), '숯더미 32x16'),
    'ingots': (V.ingots(), '주괴 더미 32x16'),
    'pillar_broken_a': (V.pillar_broken(0), '부러진 기둥 A 16x32'),
    'pillar_broken_b': (V.pillar_broken(1), '부러진 기둥 B 16x32'),
    'pillar_fallen': (V.pillar_fallen(), '쓰러진 기둥 32x16'),
    'spike_tall': (V.spike(0), '흑요석 뾰족돌 큰 것 16x32'),
    'spike_wide': (V.spike(1), '흑요석 뾰족돌 무리 32x32'),
    'spike_small': (V.spike(2), '흑요석 뾰족돌 작은 것 16x16'),
    'fire_crystal': (V.fire_crystal(), '불 수정 16x16'),
    'stalagmite': (V.stalagmite(), '석순 16x24'),
    'bones': (V.bones(), '뼈 16x16'),
    'hanging_chain': (V.hanging_chain(), '벽에 걸린 사슬 8x32'),
    'steam_vent': (V.steam_vent(), '증기 구멍 16x16'),
    'ember_a': (V.ember_patch(0), '불씨 자국 A 16x16'),
    'ember_b': (V.ember_patch(1), '불씨 자국 B 16x16'),
    'altar': (V.altar(), '흑요석 제단 64x48 (4x3칸)'),
    'bridge': (V.bridge(3, 7), '바위 다리 3x7칸'),
}
for k, (im, note) in pieces.items(): P.add(k, im, note)
G = {k: v[0] for k, v in pieces.items()}

# ---- 앵커 1: 대장간 터 (B)
at(G['furnace'], 13, 9, nb=1, name='furnace')
at(G['bellows'], 16, 9, nb=1, name='bellows')
at(pf.anvil(), 14, 12, name='anvil')
at(G['coal_pile'], 10, 11, name='coal')
at(G['ingots'], 18, 11, name='ingots')
at(pf.weapon_rack(), 7, 14, nb=1, name='rack')
at(pf.barrels(), 19, 14, nb=1, name='barrels')
at(pf.cart(), 14, 17, nb=1, name='cart')
at(pd.brazier(), 10, 9, nb=1, name='brazier'); at(pd.brazier(), 20, 10, nb=1, name='brazier')
at(G['pillar_broken_a'], 9, 17, nb=1); at(G['pillar_broken_b'], 12, 19, nb=1); at(G['pillar_fallen'], 16, 19, nb=1)
at(pf.cauldron(), 11, 14, name='cauldron')
at(G['ember_a'], 12, 15, walk=True, cover=False); at(G['ember_b'], 17, 14, walk=True, cover=False)
at(G['spike_small'], 20, 18, nb=1)
# 벽면에 걸린 사슬
for cx in (9, 20):
    S.put(G['hanging_chain'], cx * 16 + 4, 8 * 16 if cx == 9 else 8 * 16, 'chain')
# ---- 통로 BC
at(G['stalagmite'], 25, 13, nb=1); at(G['stalagmite'], 27, 15, nb=1)
at(G['bones'], 24, 15, walk=True); at(G['ember_a'], 28, 13, walk=True, cover=False)
# ---- 앵커 2: 폭포 동굴 (C)
for (cx, cy) in ((36, 11), (35, 12), (37, 13), (44, 11)):
    at(G['fire_crystal'], cx, cy, nb=1)
at(G['steam_vent'], 38, 10, walk=True); at(G['steam_vent'], 33, 10, walk=True); at(G['steam_vent'], 46, 14, walk=True)
at(G['spike_wide'], 31, 20, nb=2); at(G['spike_tall'], 33, 21, nb=1); at(G['spike_small'], 30, 21, nb=1)
at(G['stalagmite'], 28, 18, nb=1); at(G['stalagmite'], 30, 16, nb=1); at(G['stalagmite'], 29, 14, nb=1)
at(G['pillar_fallen'], 33, 17, nb=1); at(G['bones'], 35, 18, walk=True); at(G['bones'], 36, 16, walk=True)
at(G['ember_b'], 34, 14, walk=True, cover=False); at(G['ember_a'], 40, 20, walk=True, cover=False)
at(G['spike_tall'], 47, 10, nb=1); at(G['spike_small'], 47, 12, nb=1)
at(G['stalagmite'], 46, 19, nb=1); at(G['spike_small'], 46, 22, nb=1)
S.put(G['hanging_chain'], 36 * 16 + 4, 6 * 16, 'chain'); S.put(G['hanging_chain'], 45 * 16 + 4, 7 * 16, 'chain')
# ---- 다리
BR = G['bridge']
S.put(BR, 33 * 16, 23 * 16, 'bridge')
S.walk[23:30, 33:36] = True
mark(33, 23, 3, 7)
# ---- 호수 동굴 E / 통로 AB
for (cx, cy) in ((9, 24), (8, 26), (10, 29)):
    at(G['stalagmite'], cx, cy, nb=1)
at(G['steam_vent'], 14, 24, walk=True); at(G['steam_vent'], 13, 30, walk=True)
at(G['pillar_fallen'], 9, 27, nb=1); at(G['bones'], 11, 26, walk=True); at(G['ember_a'], 12, 28, walk=True, cover=False)
at(G['fire_crystal'], 15, 22, nb=1)
at(pd.brazier(), 8, 31, nb=1)
at(G['ember_b'], 12, 21, walk=True, cover=False)
# ---- 입구 동굴 A
at(pd.brazier(), 9, 41, nb=1); at(pd.brazier(), 14, 41, nb=1)
for (cx, cy) in ((5, 36), (6, 34), (4, 38)):
    at(G['stalagmite'], cx, cy, nb=1)
at(G['pillar_broken_a'], 15, 36, nb=1); at(G['pillar_broken_b'], 17, 38, nb=1); at(G['pillar_fallen'], 13, 34, nb=1)
at(G['bones'], 8, 37, walk=True); at(G['bones'], 9, 38, walk=True)
at(G['ember_a'], 11, 35, walk=True, cover=False)
at(pf.barrels(), 6, 41, nb=1)
at(G['spike_small'], 19, 33, nb=1); at(G['steam_vent'], 18, 36, walk=True)
at(G['stalagmite'], 5, 31, nb=1); at(G['spike_wide'], 16, 31, nb=2)
# ---- 남쪽 넓은 길
at(G['stalagmite'], 21, 39, nb=1); at(G['fire_crystal'], 24, 36, nb=1); at(G['bones'], 22, 36, walk=True)
# ---- 앵커 3: 흑요석 제단 (D)
at(G['altar'], 39, 37, nb=1, name='altar')
for (cx, cy) in ((37, 34), (44, 35), (37, 38), (45, 38), (36, 36)):
    at(G['fire_crystal'], cx, cy, nb=1)
at(G['spike_wide'], 33, 33, nb=2); at(G['spike_tall'], 35, 34, nb=1); at(G['spike_small'], 32, 35, nb=1)
at(G['spike_wide'], 47, 33, nb=2); at(G['spike_tall'], 49, 34, nb=1); at(G['spike_small'], 48, 36, nb=1)
at(G['spike_tall'], 30, 39, nb=1); at(G['spike_small'], 32, 39, nb=1); at(G['spike_small'], 29, 37, nb=1)
at(G['steam_vent'], 29, 32, walk=True); at(G['steam_vent'], 31, 34, walk=True); at(G['steam_vent'], 42, 31, walk=True); at(G['steam_vent'], 51, 37, walk=True)
at(G['ember_a'], 27, 33, walk=True, cover=False); at(G['ember_b'], 41, 33, walk=True, cover=False); at(G['ember_a'], 34, 30, walk=True, cover=False)
at(G['bones'], 43, 39, walk=True); at(G['bones'], 44, 40, walk=True); at(G['bones'], 26, 38, walk=True)
at(G['pillar_broken_b'], 26, 35, nb=1); at(G['pillar_broken_a'], 27, 31, nb=1); at(G['pillar_fallen'], 47, 39, nb=1)
at(G['stalagmite'], 48, 31, nb=1); at(G['stalagmite'], 50, 32, nb=1); at(G['stalagmite'], 34, 39, nb=1)
at(pf.barrels(), 24, 31, nb=1)
at(G['stalagmite'], 52, 34, nb=1); at(G['ember_b'], 38, 30, walk=True, cover=False)


# ---- 남은 큰 빈 창은 소품 덩어리(3~4개 무리)로 끊는다 — 무리 중심은 가장 빈 5x5, 결정은 고정 seed
import random
RNG = random.Random(4477)
def free_fp(cx, cy, cw, ch):
    if cx < 0 or cy - ch + 1 < 0 or cx + cw > W or cy >= H: return False
    a = np.s_[cy - ch + 1:cy + 1, cx:cx + cw]
    return bool(S.walk[a].all() and not dec[a].any() and not face[a].any())
def cluster_pool(x, y):
    if y >= 29 and x >= 23:
        return [(G['spike_tall'], 1, 1), (G['spike_small'], 1, 1), (G['fire_crystal'], 1, 1), (G['stalagmite'], 1, 2), (G['bones'], 1, 1),
                (G['pillar_broken_a'], 1, 2), (G['spike_wide'], 2, 2), (G['steam_vent'], 1, 1)]
    return [(G['stalagmite'], 1, 2), (G['bones'], 1, 1), (G['pillar_broken_b'], 1, 2), (G['fire_crystal'], 1, 1), (G['pillar_fallen'], 2, 1),
            (G['stalagmite'], 1, 2), (G['ember_a'], 1, 1), (G['spike_small'], 1, 1)]
for _it in range(60):
    worst = (0, 0, 0)
    for y in range(0, H - 14, 2):
        for x in range(0, W - 19, 2):
            r = 1 - dec[y:y + 15, x:x + 20].mean()
            if r > worst[0]: worst = (r, x, y)
    if worst[0] <= .385: break
    _, wx, wy = worst
    best = None
    for y in range(wy + 2, wy + 13):
        for x in range(wx + 2, wx + 18):
            if S.walk[y, x] and not dec[y, x]:
                sc = (~dec[y - 2:y + 3, x - 2:x + 3]).sum() if 2 <= y < H - 2 and 2 <= x < W - 2 else 0
                # 이미 걸음 통로 중앙을 막지 않게: 주변 걸음칸이 충분한 곳만
                if sc > (best[0] if best else 8) and S.walk[y - 2:y + 3, x - 2:x + 3].sum() >= 20: best = (sc, x, y)
    if not best: break
    _, bx, by = best
    n = 0
    for _t in range(14):
        img, cw, ch = RNG.choice(cluster_pool(bx, by))
        px = bx + RNG.randint(-2, 2); py = by + RNG.randint(-1, 2)
        if free_fp(px, py, cw, ch) and not dec[max(0, py - ch + 1):py + 1, px:px + cw].any():
            nm = 'ember' if img is G['ember_a'] else ''
            at(img, px, py, nb=1, walk=(img in (G['bones'], G['steam_vent'], G['ember_a'])), cover=(img is not G['ember_a']))
            n += 1
        if n >= 4: break
    if n == 0:
        dec[by, bx] = True   # 무한 루프 방지

# ---- 용암 애니메이션 조각
def crop(a, x, y, w, h): return Image.fromarray(a[y:y + h, x:x + w]).convert('RGBA')
lv = Image.new('RGBA', (32 * 4, 32)); fv = Image.new('RGBA', (48 * 4, 32))
for t in range(4):
    lv.paste(crop(frames[t], 30 * 16, 26 * 16 - 8, 32, 32), (32 * t, 0))
    fv.paste(crop(frames[t], 40 * 16, 6 * 16, 48, 32), (48 * t, 0))
P.add('lava-strip', lv, '용암 강 4프레임 32x32 — 빨강·짚색만으로 손 도트, 프레임마다 노이즈 원운동 3px')
P.add('lava-fall-strip', fv, '용암 폭포 4프레임 48x32 — 세로 줄무늬 프레임당 4px 낙하')

# ---- 합성 (프레임 0 = 렌더, 4프레임 gif)
comp = []
for t in range(4):
    S.base = Image.fromarray(frames[t]).convert('RGBA')
    comp.append(S.compose().convert('RGB'))
c4.save_pair(comp[0], OUT)
os.makedirs(os.path.join(HERE, '..', '_out-4'), exist_ok=True)
comp[0].save(os.path.join(OUT, 'lava-anim.gif'), save_all=True, append_images=comp[1:], duration=220, loop=0)

# ---- 검사
marks = {'entrance': (11, 43), 'forge': (14, 10), 'fall_pool': (36, 10), 'bridge_north': (34, 23), 'bridge_south': (34, 29),
         'altar': (40, 38), 'lake_shore': (10, 25), 'passage_bc': (26, 14), 'south_road': (16, 37), 'east_bank': (40, 16)}
ok, n = S.bfs(marks['entrance'], {k: v for k, v in marks.items() if k != 'entrance'})
print('BFS', ok, '걸음칸', n)
print('빈칸 최악', c4.empty_stats(S, dec))
bad = [(x, y, round(1 - dec[y:y + 15, x:x + 20].mean(), 2)) for y in range(0, H - 14, 3) for x in range(0, W - 19, 4) if 1 - dec[y:y + 15, x:x + 20].mean() > .4]
print('40%초과 창', len(bad), bad[:12])
grid = {'w': W, 'h': H, 'walk': [''.join('.' if v else '#' for v in r) for r in S.walk],
        'legend': '. 걸음 / # 막힘 (용암·벽·천장·큰 물체)', 'marks': {k: list(v) for k, v in marks.items()},
        'bfs_from_entrance': ok, 'animation': '4프레임, render 는 프레임 0 (lava-anim.gif 참고)'}
json.dump(grid, open(os.path.join(OUT, 'grid.json'), 'w'), ensure_ascii=False)
md, cnt, cells = P.save(os.path.join(OUT, 'parts'), '화산 동굴')
open(os.path.join(OUT, 'parts.md'), 'w').write(md)
print('parts', cnt, cells)

if os.environ.get('DBG'):
    for y in range(H):
        print(''.join(('#' if solid[y,x] else '~' if lava[y,x] else ('o' if dec[y,x] else '.')) for x in range(W)))
