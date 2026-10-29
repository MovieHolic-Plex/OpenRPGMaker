# 웨이브 장소 되살리기 1단계 — 그림 스크립트를 돌려 장면 상태(통행·단·계단·물체 목록)만 꺼낸다.
# 그림 화소는 원본(~/ref/wave-places, 사본 tiledata/beodeul-variants/_revive/orig/)을 쓰고, 스크립트는 「어디가 걸을 수 있고 무엇이 물체인가」만 준다.
#   python3 extract.py <place>   → _revive/state/<place>.npz + <place>.json
import sys, os, json, runpy, pickle
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); VAR = os.path.dirname(HERE)
PLACES = {
    'volcano-field': ('volcano-field/make_volcano_field.py', 'volcano-field-0.png', 'south_entrance'),
    'ruined-village': ('ruined-village/make_ruined_village.py', 'ruin-village-0.png', 'south_gate'),
    'ice-age-field': ('ice-age-field/make_ice_age_field.py', 'ice-age-field-0.png', 'south_entrance'),
    'mountain-fortress': ('mountain-fortress/make_mountain_fortress.py', 'mountain-fort-0.png', 'entrance'),
}

def main(place):
    script, orig, entry = PLACES[place]
    path = os.path.join(VAR, script)
    cwd = os.getcwd(); os.chdir(os.path.dirname(path)); sys.path.insert(0, os.path.dirname(path))
    sys.argv = [path, '--draft']
    g = runpy.run_path(path, run_name='revive')
    os.chdir(cwd)
    s = g['s']
    W, H = s.W, s.H
    wg = (g['walk_grid']() if 'walk_grid' in g and callable(g['walk_grid']) and place == 'mountain-fortress' else s.walk_grid())
    walk = np.array([[bool(wg[y][x]) for x in range(W)] for y in range(H)])
    lev = np.array([[int(s.lev[y][x]) for x in range(W)] for y in range(H)]) if hasattr(s, 'lev') else np.zeros((H, W), int)
    sc = set(s.stair_cells()) if hasattr(s, 'stair_cells') else set()
    link = set()
    if place == 'mountain-fortress':
        link = set(g['BRIDGE']) | {(x, y) for x in (34, 35, 36) for y in (17, 18, 19, 24)} | set(g['PLANK'])
    objs = []
    for o in s.objs:
        sy, x, y, im = o[0], o[1], o[2], o[3]
        objs.append(dict(kind='obj', sy=int(sy), x=int(x), y=int(y), a=np.array(im.convert('RGBA'))))
    for t in getattr(s, 'top', []):
        x, y, im = t; objs.append(dict(kind='top', sy=10**6, x=int(x), y=int(y), a=np.array(im.convert('RGBA'))))
    for t in getattr(s, 'top_overlays', []):
        im, x, y = t; objs.append(dict(kind='top', sy=10**6, x=int(x), y=int(y), a=np.array(im.convert('RGBA'))))
    extra = {}
    for k in ('pit', 'pond', 'ridge', 'drift', 'water', 'lava', 'path'):
        v = getattr(s, k, None)
        if isinstance(v, set): extra[k] = sorted([list(c) for c in v])
    marks = {k: list(v) for k, v in s.marks.items() if isinstance(v, (tuple, list)) and len(v) == 2}
    ground = None
    if place == 'ice-age-field':
        # 원본(웨이브 3)은 웨이브 5 보정 전 그림이라 물체 배치가 스크립트와 다르다 → 물체를 뺀 땅만 렌더해 「땅 색」 표를 만든다.
        s.objs = []; s.top = []; s.decals = []
        gim = s.render(g['TRAIL'], g['PACK'], g['DRIFT'], g['SHEETS'])
        ground = np.array(gim.convert('RGB'))
        extra['gl'] = np.argwhere(np.asarray(s.gl)).tolist(); extra['face'] = np.argwhere(np.asarray(s.face)).tolist()
        extra['walk_ok'] = sorted([list(c) for c in s.walk_ok])
    os.makedirs(os.path.join(HERE, 'state'), exist_ok=True)
    pickle.dump(dict(place=place, W=W, H=H, walk=walk, lev=lev, stairs=sorted(sc), link=sorted(link), objs=objs, extra=extra,
                     marks=marks, ground=ground, entry=list(s.marks[entry]), orig=orig), open(os.path.join(HERE, 'state', place + '.pkl'), 'wb'))
    print(place, W, H, 'walk', int(walk.sum()), 'objs', len(objs), 'stairs', len(sc), 'marks', len(marks))

if __name__ == '__main__':
    main(sys.argv[1])
