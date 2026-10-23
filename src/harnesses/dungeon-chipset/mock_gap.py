"""gap 판 후보로 깐 작은 던전 지도(모형) — 지금 조수 던전과 1배로 나란히 보이려는 시연 그림.

후보를 고르는 그림이 아니다(고르기는 사람이 시트에서). 굽지도 않는다. 판 모듈의 후보 함수가 돌려주는 meta(autotiles·faces·frames·parts)를
그대로 써서 격자 하나에 깐다. 사용: python3 src/harnesses/dungeon-chipset/mock_gap.py <줄><번호> [--out DIR]
  예) B1 → 바위 채움 B1 · 물가 B1 · 용암 B1 · 흙바닥 cave-r1 B1 + 공통 기물(문·레버·고블린 야영) A1
"""
import argparse
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, 'rounds'))
import dot  # noqa: E402
import harness as H  # noqa: E402
import cave_r1 as CR  # noqa: E402

T = 16
# '#' 바위 · '.' 흙 · 'w' 물 · 'l' 용암.  기물 자리는 아래 PROPS 에 칸 좌표로.
GRID = [
    "##############################",
    "##############################",
    "##############################",
    "###.......######.......#######",
    "##.........####.........######",
    "##..........##...lll.....#####",
    "##..........##..lllll.....####",
    "###.........##..llllll....####",
    "###..................l....####",
    "####.........#####...l....####",
    "####.........#####..lll...####",
    "#####.......######.lllll..####",
    "######....########..lll..#####",
    "######....######.........#####",
    "######....#####....##....#####",
    "####..www.......########..####",
    "####.wwwww.....#########...###",
    "###..wwwwww....##########..###",
    "###...wwww.....##########..###",
    "####..........###########.####",
    "##############################",
    "##############################",
]
GRID_NO_LAVA = [r.replace('l', '.') for r in GRID]


def cand(rid, item, key):
    mod = H.load_round(rid)
    im, meta = mod.CANDIDATES[item][key]()
    return meta


def first(d):
    return next(iter(d.values()))


def render(g, rock_meta, floor_at, liquids, frame=0):
    """liquids: {'w': meta, 'l': meta} (frames 가 있으면 장면 frame)."""
    rock_at = first(rock_meta['autotiles'])
    face = first(rock_meta['faces'])
    Hh, Ww = len(g), len(g[0])
    k = dot.classify(g)
    out = dot.Cv(Ww * T, Hh * T)
    for y in range(Hh):
        for x in range(Ww):
            kk = k[y][x]
            if kk == 'ceil':
                t = rock_at.tile_at(dot.mask_at(g, x, y, lambda ch, X, Y: k[Y][X] == 'ceil'), x, y)
            elif kk in ('hi', 'lo'):
                lv = 0 if kk == 'hi' else 1
                lo = not (x - 1 >= 0 and k[y][x - 1] == kk)
                ro = not (x + 1 < Ww and k[y][x + 1] == kk)
                t = face.tile(lv, lo, ro)
            elif kk in liquids:
                m = liquids[kk]
                fr = m.get('frames')
                at = first(fr)[frame % len(first(fr))] if fr else first(m['autotiles'])
                t = at.tile_at(dot.mask_at(g, x, y, lambda ch, X, Y, c=kk: ch == c), x, y)
            else:
                t = floor_at.tile_at(dot.mask_at(g, x, y, lambda ch, X, Y: ch != '#'), x, y)
            out.a[y * T:(y + 1) * T, x * T:(x + 1) * T] = t.a
    return out


def put(cv, part, cx, cy, foot_w=1):
    """part 를 칸 (cx, cy) 에 발(아래 끝)이 그 칸 아래에 닿게, 가로는 foot_w 칸 가운데."""
    p = part if isinstance(part, dot.Cv) else dot.Cv.of(part)
    x = cx * T + (foot_w * T - p.w) // 2
    y = (cy + 1) * T - p.h
    cv.paste(p, x, y)


def props_layer(cv, frame=0, key='A1'):
    P = lambda item: cand('gap-props-r1', item, key)['parts']
    door, lever = P('gap.door'), P('gap.lever')
    tent, bones, pal, fire = P('gap.goblin_tent'), P('gap.bone_pile'), P('gap.palisade'), P('gap.campfire')
    # 서쪽 방 북벽 앞면(행 1~2 = 앞면 윗단·아랫단 → 3번 행이 바닥): 문은 앞면 두 칸에, 레버는 그 옆 아랫단
    put(cv, door['닫힘'], 6, 2)
    put(cv, lever['내림'], 8, 2)
    put(cv, first(tent), 4, 7, foot_w=3)
    fires = [v for k, v in fire.items()]
    put(cv, fires[frame % len(fires)], 8, 6)
    bl = list(bones.values())
    put(cv, bl[0], 10, 4)
    put(cv, bl[1], 10, 10)
    pl = list(pal.values())
    mids = [pal[k] for k in ('가운데', '가운데2', '가운데3') if k in pal] or [pl[1]]
    west, east = pal.get('서끝', pl[0]), pal.get('동끝', pl[-1])
    for i, cx in enumerate(range(5, 11)):
        put(cv, west if i == 0 else east if i == 5 else mids[(i - 1) % len(mids)], cx, 11)
    act = dot.Cv.of(dot.actor1_frame())
    put(cv, act, 7, 13)


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument('key')
    ap.add_argument('--props', default='A1')
    ap.add_argument('--out', default=os.path.expanduser('~/claude-viz/dungeon-gap-mock'))
    a = ap.parse_args(argv)
    line, n = a.key[0], int(a.key[1:])
    rock = cand('gap-rock-r1', 'gap.rock_fill', a.key)
    floor = CR.part(line, n, 'floor')
    liq = {'w': cand('gap-liquid-r1', 'gap.water_edge', a.key)}
    g = GRID
    if not H.skipped(line, 'gap.lava_edge'):
        liq['l'] = cand('gap-liquid-r1', 'gap.lava_edge', a.key)
    else:
        g = GRID_NO_LAVA
    os.makedirs(a.out, exist_ok=True)
    frames = []
    for f in range(4):
        cv = render(g, rock, floor, liq, f)
        props_layer(cv, f, a.props)
        frames.append(cv.img())
    frames[0].save(os.path.join(a.out, f'mock-{a.key}.png'))
    frames[0].save(os.path.join(a.out, f'mock-{a.key}.gif'), save_all=True, append_images=frames[1:], duration=333, loop=0,
                   disposal=2)
    print(os.path.join(a.out, f'mock-{a.key}.png'), frames[0].size)


if __name__ == '__main__':
    main()
