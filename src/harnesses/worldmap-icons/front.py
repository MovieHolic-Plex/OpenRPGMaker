"""정면 카메라 다시 찍기 — 투영 렌더러로 그린 세트를 같은 3D 장면 그대로 정면 3/4 로 다시 렌더해 후보로 올린다.

사막·동양풍 아이콘은 손그림이 아니라 `iconsets/<세트>/build.py` 가 지은 3D 장면을 `lib/oblique.py` 가 레이캐스트로 찍은 것이다.
투영은 u = x + KX·y, v = z + KY·y. KY(.5)가 윗면을 보이게 하고, KX(.28)가 뒤쪽을 오른쪽으로 밀어 옆면을 만든다.
KX = 0 이면 카메라가 정남쪽에 서서 옆면이 0px 이 되고, 장면·재질·명암·색표는 그대로라 결이 남는다(2026-10-02, 사용자가 읍성으로 확인).
현대·SF 는 하지 않는다 — 빌딩은 정면만으로는 납작해져 사용자가 기존(옆면 약간)이 낫다고 했다.

후보는 그 아이콘의 열린 판에 글자 R·S… 로 들어가고(engine=render:front-kx0-light), 검수자(review.md)를 거친다. 떨어지면 다시 그리지 않고 버린다.
"""
import importlib
import json
import sys
from pathlib import Path

import harness as H

FRONT_SETS = ('desert-east',)
ENGINE = 'render:front-kx0-light'   # v1 'render:front-kx0' 은 원래 빛(왼쪽 위) — 오른쪽 그늘이 옆면으로 읽혔다
DIRECTION = '정면 카메라 — 원래 3D 장면을 카메라와 빛만 정남쪽으로 옮겨 다시 찍음(KX .28 → 0, 빛 정면 위). 그림·재질·색은 원래 그대로'
KEY = (255, 103, 139)
SHADOW = (254, 103, 139)
_LIBMODS = ('oblique', 'east', 'scenes_a', 'scenes_b', 'icons_v9_lib', 'show')


def _center(a):
    """KX=0 이면 뒤쪽이 오른쪽으로 안 밀려 그림이 왼쪽에 쏠린다 — 가로 가운데로 옮긴다."""
    import numpy as np
    k = np.all(a == KEY, -1) | np.all(a == SHADOW, -1)
    xs = np.nonzero(~k)[1]
    W = a.shape[1]
    dx = (W - (xs.max() + 1 - xs.min())) // 2 - xs.min()
    if dx == 0:
        return a
    o = np.empty_like(a)
    o[:] = KEY
    src = a[:, max(0, -dx):W - max(0, dx)]
    o[:, max(0, dx):max(0, dx) + src.shape[1]] = src
    return o


def render_set(iset, kx=0.0, light=(0.0, -.35, .8), sun=(0.0, .55, 1.0)):
    """세트의 장면을 KX=kx 로 다시 찍는다 → {아이콘 이름: RGB 배열}.
    정면 카메라에서는 빛도 정면 위에서 온다(light·sun 의 x=0). 원래 빛(왼쪽 위)은 팔각·원통 탑의 오른쪽 면과 땅 그림자를 오른쪽으로
    몰아 검수자가 「오른쪽 옆면」으로 읽었다(2026-10-02, 정면 렌더 20장 중 14장 SIDE). light=None 이면 원래 빛."""
    import numpy as np
    sdir = H.ROOT / 'tiledata' / 'worldmap-kit' / 'iconsets' / iset
    for m in _LIBMODS:
        sys.modules.pop(m, None)
    sys.path.insert(0, str(sdir / 'lib'))
    try:
        ob = importlib.import_module('oblique')
        ob.KX = kx
        ob.D_VIEW = np.array([-kx, 1.0, -ob.KY])
        if light is not None:
            L = np.array(light, float)
            ob.LIGHT = L / np.linalg.norm(L)
            ob.D_SUN = np.array(sun, float)
        importlib.import_module('east')
        reg = {**importlib.import_module('scenes_a').ICONS, **importlib.import_module('scenes_b').ICONS}
        out = {}
        for ic in json.loads((sdir / 'manifest.json').read_text())['icons']:
            a, _ = reg[ic['id']]()
            out[ic['name']] = _center(a) if kx == 0 else a
        return out
    finally:
        sys.path.pop(0)
        for m in _LIBMODS:
            sys.modules.pop(m, None)


def add_candidates(sets=FRONT_SETS):
    """사용자가 받지 않은 아이콘마다 정면 렌더 후보를 판에 올린다(판이 없으면 연다). 이미 올렸으면 건너뛴다."""
    from PIL import Image
    import redraw as R
    c = H.db()
    R.tables(c)
    dec = H._latest_decisions(c)
    added = []
    for iset in sets:
        arrs = render_set(iset)
        for it in list(c.execute('select * from items where iset=? order by role, name', (iset,))):
            if dec.get(it['id'], {}).get('decision') == 'accept':
                continue
            a = arrs.get(it['name'])
            if a is None:
                continue
            row = c.execute('select id from rounds where item=? order by id desc', (it['id'],)).fetchone()
            rnd = row['id'] if row else R.open_round(it['id'], '정면 카메라 후보', '', 0, [])
            if c.execute('select 1 from cands where round=? and engine=?', (rnd, ENGINE)).fetchone():
                continue
            # 옛 판 렌더 후보는 버린다 — 같은 장면이라 둘 다 둘 이유가 없다
            c.execute("update cands set status='discarded', finished=? where round=? and engine like 'render:%' and engine != ?",
                      (H.now(), rnd, ENGINE))
            used = {x['letter'] for x in c.execute('select letter from cands where round=?', (rnd,))}
            L = next(ch for ch in 'RSTUVWXYZ' if ch not in used)
            out = R.attempt_dir(rnd, L, 1)
            out.mkdir(parents=True, exist_ok=True)
            Image.fromarray(a).save(out / 'cand.png')
            (out / 'note.txt').write_text(DIRECTION + '\n', encoding='utf-8')
            res = R.preview(out, it['id'])
            c.execute('insert into cands(round,letter,direction,status,attempt,engine,check_json,started) values(?,?,?,?,?,?,?,?)',
                      (rnd, L, DIRECTION, 'review_queued' if res['ok'] else 'discarded', 1, ENGINE,
                       json.dumps(res, ensure_ascii=False), H.now()))
            c.commit()
            added.append((it['id'], f'r{rnd}/{L}', res['ok']))
    R.ensure_pool()
    return added
