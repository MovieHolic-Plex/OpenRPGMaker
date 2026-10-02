#!/usr/bin/env python3
"""「테두리 꼭 필요한 곳만」 판 — 고른 후보의 바깥 테두리를 필요한 곳에만 남긴 둘째 벌(2026-10-03, 사용자 「테두리선이 꼭 필요한 경우에만」).

작업자는 테두리를 빙 둘러 그린다(검사 line_check 가 1칸·빠짐없음을 지킨다). 고르는 화면이 후보마다 이 둘째 벌을 같이 보여 주고,
사용자가 「필요한 곳만」을 고르면 선택 이름 끝에 `.sel` 이 붙는다(예: `h248-C.sel`). 굽기·미리보기는 같은 함수로 같은 그림을 만든다.

남기는 테두리:
  ① 테두리 안쪽 칸 색이 바로 바깥 칸 뒤(맥락 방에 놓았을 때의 바닥·벽·이웃 가구) 색과 가까워서, 테두리가 없으면 물건이 배경에 녹는 곳
  ② 바닥에 닿는 맨 아래 줄 · 반대편까지 이어진 가는 부재(다리·막대)
나머지 바깥 테두리 칸은 안쪽 칸 색으로 채운다. 안쪽 선은 건드리지 않는다.
  python3 scripts/content/hand-interior-pick/outline_select.py <기물 id> <후보>   # 그 후보의 .sel.png 를 만든다
"""
import os, sys
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import line_metrics as lm  # noqa: E402

SUFFIX = '.sel'
NEAR = 60          # 안쪽 색과 둘레 색의 RGB 거리가 이 안이면 「녹는다」 → 테두리를 남긴다


def split(choice):
    """`h248-C.sel` → ('h248-C', True), 그 밖 → (choice, False)."""
    if choice and choice.endswith(SUFFIX): return choice[:-len(SUFFIX)], True
    return choice, False


def _pair(o, im):
    """(물건을 뺀 맥락 방, 이 후보를 놓은 맥락 방) — 같은 자리에. 새 기물은 놓을 자리를 찾는 place() 가 그림에 따라
    다른 자리를 고를 수 있어, 자리를 한 번 찾고 그 자리에 빈 그림·후보 그림을 각각 놓는다."""
    from common import geom
    empty = Image.new('RGBA', tuple(geom(o)['canvas']))
    if not o.get('new'):
        import context
        return context.context_image(o, empty)[0].convert('RGBA'), context.context_image(o, im)[0].convert('RGBA')
    import new_items
    rooms4, room4 = new_items.v5_modules()
    import room2   # v5_modules 가 경로를 연다
    f, fe = new_items.new_f(o, im), new_items.new_f(o, empty)
    for m in rooms4.B[o.get('contextRoom')]['maps']:
        at = new_items.place(m, f, room4, room2)
        if at is None: continue
        comp = lambda g: room4.compose(dict(m, items=list(m['items']) + [(g, at[0], at[1])])).convert('RGBA')
        return comp(fe), comp(f)
    return None, None


def background(o, im):
    """그 기물이 놓이는 자리의 실제 뒤 그림 → (뒤 그림, dx, dy): 물건 좌표 (x, y) 뒤의 색 = 뒤 그림[x+dx, y+dy].
    맥락 방을 물건 없이(투명) 한 번, 이 후보를 놓고 한 번 그려 달라진 칸의 상자로 자리를 맞춘다. 못 맞추면 None."""
    from PIL import ImageChops
    try:
        empty, full = _pair(o, im)
    except (Exception, SystemExit):
        return None
    if empty is None or full.size != empty.size: return None
    box = ImageChops.difference(full, empty).convert('RGB').getbbox()
    ob = im.getchannel('A').point(lambda v: 255 if v >= 128 else 0).getbbox()
    if not box or not ob: return None
    dx = box[0] - ob[0] if box[0] > 0 else box[2] - ob[2]   # 맥락 그림 끝에 잘렸으면 반대쪽 끝으로 맞춘다
    dy = box[1] - ob[1] if box[1] > 0 else box[3] - ob[3]
    return empty, dx, dy


def selective(im, bg, near=NEAR):
    """bg = background() 결과. → (새 그림, 지운 칸 수, 남긴 칸 수)."""
    im = im.convert('RGBA'); W, H = im.size; px = im.load(); out = im.copy(); po = out.load()
    P = {(x, y) for y in range(H) for x in range(W) if px[x, y][3] >= 128}
    if not P or not bg: return out, 0, 0
    back, dx, dy = bg; bp = back.load(); BW, BH = back.size
    L = lambda p: lm.luma(px[p])
    def melts(c, x, y):   # 안쪽 색 c 가 물건 바깥 (x, y) 자리 뒤 색과 가깝다(테두리가 없으면 녹는다). 캔버스 밖이면 남긴다
        X, Y = x + dx, y + dy
        if not (0 <= X < BW and 0 <= Y < BH): return True
        return sum((a - b) ** 2 for a, b in zip(c[:3], bp[X, Y][:3])) ** .5 < near
    bottom = max(y for _, y in P); keep, rm = set(), {}
    for e in P:
        for a, b in lm.D4:
            if (e[0] + a, e[1] + b) in P: continue
            q = (e[0] - a, e[1] - b)
            if q not in P: keep.add(e); continue                 # 가는 부재: 테두리가 곧 물건이다
            if L(q) < L(e) + lm.DARKER: continue                  # 테두리가 아닌 가장자리(이미 밝은 테·몸통)
            if b == 1 and e[1] >= bottom - 1: keep.add(e); continue
            if melts(px[q], e[0] + a, e[1] + b): keep.add(e)
            else: rm.setdefault(e, px[q])
    n = 0
    for e, c in rm.items():
        if e not in keep: po[e] = c; n += 1
    return out, n, len(keep)


def ensure_png(cand_dir, base, o):
    """`<후보>.sel.png` 를 만들거나(원본 그림보다 낡았으면 다시) 그 경로를 돌려준다."""
    src = os.path.join(cand_dir, base + '.png'); dst = os.path.join(cand_dir, base + SUFFIX + '.png')
    if not os.path.exists(src) or os.path.getmtime(src) < os.path.getmtime(os.path.join(cand_dir, base + '.pxg')):
        sys.path.insert(0, os.path.join(HERE, '..', 'pixel-harness', 'pxgrid')); import pxgrid
        pxgrid.render(os.path.join(cand_dir, base + '.pxg'), src)
    if not os.path.exists(dst) or os.path.getmtime(dst) < os.path.getmtime(src):
        im = Image.open(src).convert('RGBA')
        im, _, _ = selective(im, background(o, im))
        tmp = dst + '.tmp'; im.save(tmp, format='PNG'); os.replace(tmp, dst)
    return dst


if __name__ == '__main__':
    from common import CAND, objects_by_id, slug
    o = objects_by_id()[sys.argv[1]]
    print(ensure_png(os.path.join(CAND, slug(o['id'])), sys.argv[2], o))
