#!/usr/bin/env python3
"""r16 다시 그림을 시트에 **제자리**로 굽는다 (칸 번호·통행·사양 불변, 저장 맵은 새 그림을 그대로 받는다).

  python3 scripts/content/modern-city-int/r16/rebake.py [--check] [--only ids.json]

원본: tiledata/modern-city/interior/r16/grids/<id>.json (grid.py 참고). 사양 cells 의 칸 번호에 16×16 을 붙여 넣고,
tiledata/modern-city/pins.json · interior/baked.json 의 옛 내용 해시 키를 새 키로 바꿔 적는다(rebake_wood_seat.py 와 같은 규칙).
등록 안 된 칸에 화소가 있거나, 다른 기물과 같이 쓰는 칸을 다른 그림으로 덮으면 멈춘다.
r10/rebake_inplace.py 가 끝에서 이 굽기를 다시 부른다(코드 그림이 r16 그림을 덮어 되돌리지 않게).
"""
import collections, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(ROOT, 'src', 'harnesses', 'modern-chipset'))
import numpy as np                     # noqa: E402
from PIL import Image                  # noqa: E402
import grid as G                       # noqa: E402

PINS = os.path.join(ROOT, 'tiledata/modern-city/pins.json')
OWN = os.path.join(ROOT, 'tiledata/modern-city/interior/baked.json')
TPR = 48


def work(sp, only=None):
    """[(칸 번호, 16×16 RGBA Image, 이름)]"""
    out, users = [], collections.defaultdict(set)
    for k, o in sp['objects'].items():
        for c in o['cells']: users[c[2]].add(k)
    ids = sorted(f[:-5] for f in os.listdir(G.GRIDS) if f.endswith('.json'))
    if only is not None: ids = [i for i in ids if i in only]
    seen = {}
    for pid in ids:
        e = G.check(pid, sp)
        if e: sys.exit('격자 오류 %s: %s' % (pid, ' · '.join(e[:4])))
        img = G.to_img(G.load(pid)); mx, my, _cw, _ch = G.box(sp, pid)
        for dx, dy, t, _l in sp['objects'][pid]['cells']:
            x, y = (dx - mx) * 16, (dy - my) * 16
            cell = img.crop((x, y, x + 16, y + 16))
            if t in seen and seen[t][1].tobytes() != cell.tobytes():
                sys.exit('칸 %d 를 %s 와 %s 가 다른 그림으로 덮는다' % (t, seen[t][0], pid))
            others = users[t] - {pid} - set(ids)
            if others: sys.exit('칸 %d 는 다른 기물 %s 도 쓴다 — 같이 다시 그려야 한다 (%s)' % (t, sorted(others), pid))
            seen[t] = (pid, cell)
            out.append((t, cell, '%s(%d,%d)' % (pid, dx, dy)))
    return out


def apply(check=False, only=None):
    import bake_lib as BL
    sp = G.spec()
    items = work(sp, only)
    sheet = Image.open(G.PNG).convert('RGBA')
    pins = json.load(open(PINS, encoding='utf-8')); own = json.load(open(OWN, encoding='utf-8'))
    by_tid = collections.defaultdict(list)
    for k, v in pins['cells'].items(): by_tid[v].append(k)
    blank = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    changed = rekeyed = 0
    done = set()
    for t, cell, name in items:
        if t in done: continue
        done.add(t)
        xy = ((t % TPR) * 16, (t // TPR) * 16)
        old = BL.norm(sheet.crop((*xy, xy[0] + 16, xy[1] + 16))); new = BL.norm(cell)
        if old.tobytes() == new.tobytes(): continue
        changed += 1
        for k in by_tid.get(t, []):
            pc = next((p for p in BL.PC if BL.Sheet.key_of(old, p) == k), None)
            if pc is None: continue
            nk = BL.Sheet.key_of(new, pc)
            if nk in pins['cells'] and pins['cells'][nk] != t: continue     # 같은 그림이 이미 다른 칸 키 — 옛 키만 지운다
            del pins['cells'][k]; pins['cells'][nk] = t
            if k in own['cells']: del own['cells'][k]; own['cells'][nk] = t
            rekeyed += 1
        sheet.paste(blank, xy); sheet.paste(new, xy)
    if not check:
        sheet.save(G.PNG, optimize=True)
        open(PINS, 'w', encoding='utf-8').write(json.dumps(pins, ensure_ascii=False, separators=(',', ':')) + '\n')
        own['cells'] = dict(sorted(own['cells'].items(), key=lambda kv: kv[1]))
        open(OWN, 'w', encoding='utf-8').write(json.dumps(own, ensure_ascii=False, indent=0) + '\n')
    print('r16', ('would change' if check else 'changed'), changed, 'tiles ·', rekeyed, 'pin keys ·', len({n.split('(')[0] for _t, _c, n in items}), 'objects')
    return changed


if __name__ == '__main__':
    a = sys.argv
    only = set(json.load(open(a[a.index('--only') + 1]))) if '--only' in a else None   # 부분 굽기(PR 나누기용): id 목록 JSON
    apply('--check' in a, only)
