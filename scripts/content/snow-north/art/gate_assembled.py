#!/usr/bin/env python3
"""snow_north 부품 조각(목책·울타리·굴뚝 연기)은 혼자서는 윗면을 보일 수 없다 → 조립기가 놓는 대로 합친 「조립 그림」을
kind=structure 로 object-gate 에 낸다(jp-city gate_assembled.py 와 같은 방식). 부품은 조립 그림 안에 화소 그대로 들어 있어야 하고,
그 조립 그림의 영수증이 PASS 여야 덮인다(bake 의 covered() 가 화소 일치와 영수증을 다시 확인한다).

  python3 gate_assembled.py         -> tiledata/snow-north/_assembled/*.png + items.jsonl + manifest.json
"""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from kit import OUT
import props as PR, buildings as BL

D = os.path.join(OUT, '_assembled')


def img(mod, pid): return mod.R.render(mod.R.by[pid]).img()


def assemble(W, H, placements):
    """placements: [(mod, id, cx, cy)] — 칸 좌표. 뒤에 놓은 것이 위."""
    S = Image.new('RGBA', (W * 16, H * 16), (0, 0, 0, 0))
    for mod, pid, x, y in placements: S.alpha_composite(img(mod, pid), (x * 16, y * 16))
    return S


def samples():
    out = []
    # 1) 목책 문 + 양옆 목책(동서) + 양 끝 남북 목책
    pl = [(PR, 'palisade-v', 0, 4), (PR, 'palisade-v', 0, 5), (PR, 'palisade-v', 7, 4), (PR, 'palisade-v', 7, 5)]
    pl += [(PR, 'palisade', x, 2) for x in (0, 1, 6, 7)]
    pl += [(BL, 'palisade-gate', 2, 0)]
    out.append(dict(name='palisade-wall', title='통나무 목책 성벽과 지붕 얹은 목책 문(마을 방벽)', W=8, H=6, pl=pl, parts=['palisade', 'palisade-v']))
    # 2) 울타리 친 마당 + 오두막
    pl = [(BL, 'cabin-s', 2, 1)]
    pl += [(PR, 'fence', x, 0) for x in range(7)]
    pl += [(PR, 'fence-v', x, y) for x in (0, 6) for y in range(1, 6)]
    pl += [(PR, 'fence', x, 6) for x in range(7) if x != 3]
    out.append(dict(name='fenced-cabin', title='나무 울타리를 두른 마당 속 통나무 오두막', W=7, H=7, pl=pl, parts=['fence', 'fence-v']))
    # 3) 굴뚝 연기 프레임마다: 오두막 + 굴뚝 칸 위 연기
    for f in ('smoke', 'smoke-f1', 'smoke-f2'):
        out.append(dict(name='cabin-' + f, title='굴뚝에서 연기가 오르는 통나무 오두막', W=3, H=6,
                        pl=[(BL, 'cabin-s', 0, 2), (PR, f, 2, 0)], parts=[f]))
    return out


def build():
    os.makedirs(D, exist_ok=True)
    rows, man = [], {}
    for s in samples():
        im = assemble(s['W'], s['H'], s['pl'])
        p = os.path.join(D, 'asm-%s.png' % s['name']); im.save(p)
        label = 'snow-north/asm-' + s['name']
        rows.append(dict(png=os.path.basename(p), kind='structure', name=s['title'], label=label))
        for part in s['parts']:
            offs = [(x * 16, y * 16) for (m, pid, x, y) in s['pl'] if m is PR and pid == part]
            man.setdefault(part, []).append(dict(assembled=os.path.basename(p), label=label, offsets=offs))
    with open(os.path.join(D, 'items.jsonl'), 'w') as f:
        for r in rows: f.write(json.dumps(r, ensure_ascii=False) + '\n')
    json.dump(man, open(os.path.join(D, 'manifest.json'), 'w'), ensure_ascii=False, indent=1)
    return rows


if __name__ == '__main__':
    for r in build(): print(r['png'])
