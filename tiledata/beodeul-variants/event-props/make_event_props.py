# 버들항 웨이브 5 — 이벤트 소품 키트 (event-props). 다시 돌리면 같은 그림이 나온다.
#   python3 make_event_props.py            → parts/*.png, partmeta.json, parts.md, render-1x.png, render-2x.png, grid.json, compare-ref.png
#   python3 make_event_props.py --parts    → 조각만
# 지침: tiledata/beodeul-kits/WAVE-BRIEF-3.md B절(목록·파일 이름·4프레임 띠·evfloor_), WAVE-BRIEF-2.md(QA·파일 규칙), SPEC.md.
import sys, os, json
_HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, _HERE)
import numpy as np
from PIL import Image, ImageDraw
from ev_base import Parts, frame_diff, T
from ev_meta import PARTS
HERE = _HERE


def build_parts():
    Pq = Parts(HERE); imgs = {}; diffs = {}
    for (n, fn, kind, ko, desc, rules, brows, cells) in PARTS:
        im = fn()
        Pq.add(n, im, kind, ko, desc, rules, brows, cells=cells)
        imgs[n] = im
        if n.endswith('-strip'):
            fw = im.width // 4
            diffs[n] = frame_diff([im.crop((k * fw, 0, (k + 1) * fw, im.height)) for k in range(4)])
    cnt = Pq.finish('이벤트 소품 키트 (event-props)')
    return imgs, cnt, diffs


def build_scenes(imgs):
    import ev_scene as S
    dun = S.dungeon(imgs); twn = S.town(imgs)
    cat = S.catalog(imgs, [p[0] for p in PARTS])
    a = dun.render(); b = twn.render()
    gap = 8
    W = max(cat.width, a.width + b.width + gap * 3)
    H = cat.height + gap + max(a.height, b.height) + gap * 2
    out = Image.new('RGBA', (W, H), (46, 44, 54, 255))
    out.alpha_composite(cat, (0, 0))
    y = cat.height + gap
    out.alpha_composite(a, (gap, y)); out.alpha_composite(b, (gap * 2 + a.width, y))
    out.convert('RGB').save(os.path.join(HERE, 'render-1x.png'))
    out.convert('RGB').resize((W * 2, H * 2), Image.NEAREST).save(os.path.join(HERE, 'render-2x.png'))
    return dun, twn, (gap, y), (gap * 2 + a.width, y), out


def grid(dun, twn, diffs):
    def g(s):
        st = s.marks['entrance']; seen = s.reach(st)
        reach = {}
        for k, (x, y) in s.marks.items():
            near = [(x + dx, y + dy) for dx, dy in ((0, 0), (0, 1), (1, 1), (-1, 0), (1, 0), (0, -1)) if 0 <= x + dx < s.W and 0 <= y + dy < s.H]
            reach[k] = bool(any(seen[yy, xx] for xx, yy in near))
        return {'w': s.W, 'h': s.H, 'rows': [''.join('.' if s.walk[y, x] else '#' for x in range(s.W)) for y in range(s.H)],
                'entrance': list(st), 'marks': {k: list(v) for k, v in s.marks.items()}, 'reach': reach,
                'walkable': int(s.walk.sum()), 'reached': int(seen.sum())}
    out = {'tile': 16, 'legend': {'.': 'walkable', '#': 'blocked'},
           'scenes': {'dungeon_entrance': g(dun), 'town_square': g(twn)},
           'strip_min_frame_diff_px': diffs,
           'kit_passage': {p[0]: ('walk (사람 아래)' if p[2] in ('decal', 'walk') else 'bottom %d row(s) blocked, above ★' % p[6]) for p in PARTS}}
    json.dump(out, open(os.path.join(HERE, 'grid.json'), 'w'), ensure_ascii=False, indent=1)
    return out


if __name__ == '__main__':
    imgs, cnt, diffs = build_parts()
    print('kits', cnt, 'strips', len(diffs), 'min frame diff', diffs)
    if '--parts' in sys.argv: sys.exit()
    dun, twn, oa, ob, full = build_scenes(imgs)
    gj = grid(dun, twn, diffs)
    for k, v in gj['scenes'].items(): print(k, 'walk', v['walkable'], 'reached', v['reached'], {m: r for m, r in v['reach'].items() if not r})
    if '--no-compare' not in sys.argv:
        import ev_compare
        ev_compare.compare(imgs, full, oa, ob)
