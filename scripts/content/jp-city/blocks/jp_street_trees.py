#!/usr/bin/env python3
"""jp_city 블록 `jp_street_trees` - 가로수 느티나무·벚나무 다시 그리기(4×6 → 3×4, 2026-10-20 사용자 승인 시안).

시안: ~/claude-viz/modern-tiles-proto/outline/ (tree.py · run_tree.py 의 jp-keyaki-3x4 · jp-sakura-3x4). 그림은 lib_blocks/street_tree_art.py.
키트 id 는 그대로(jp-prop-tree-zelkova · jp-prop-tree-sakura) 두고 원본 카탈로그 소품 키트(jp16 칸 1006~1051, 4×6)를 갈아 끼운다
(`replaces: True` — bake_jp 가 같은 id 의 카탈로그 키트를 빼고 이 키트를 넣는다). 옛 칸 번호·그림은 그대로 남아 이미 깐 지도는 바뀌지 않는다.
칸 통행: 수관 줄(0~2)은 ★(걸어 지나감·사람 위), 맨 아래 줄 가운데 줄기 칸만 막힘, 그 양옆 뿌리·흙 칸은 투명 덧그림(사람 밑).
땅 그림자는 굽지 않는다(시안의 그림자는 바닥 곱하기 덧그림이라 팔레트 밖 색이 된다).
가로수를 놓는 구성기(jpCityStreetComposer)는 4×6 기준 좌표를 쓰므로 3×4 키트는 (x+1, y+2)로 옮겨 같은 줄기 자리에 선다.

  python3 scripts/content/jp-city/blocks/jp_street_trees.py [OUT_DIR]   # selftest + 미리보기 + 3/4 관문 그림
"""
import collections, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..'))
import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402
from lib_blocks import street_tree_art as T  # noqa: E402

BLOCK = 'jp_street_trees'
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
OUTDIR = os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks', BLOCK)

TREES = (
    # 키트 id, 칸 키 접두어, 그림, 이름, 원본 소품 이름
    ('jp-prop-tree-zelkova', 'tree-zelkova34', T.keyaki, '가로수 · 느티나무(欅)', 'tree.zelkova'),
    ('jp-prop-tree-sakura', 'tree-sakura34', T.sakura, '가로수 · 벚나무(桜)', 'tree.sakura'),
)


def _pc(cx, cy):
    if cy < 3: return 'star'
    return 'solid' if cx == 1 else 'flat'


_CACHE = {}


def build():
    if 'b' in _CACHE: return _copy(_CACHE['b'])
    cells = collections.OrderedDict(); kits = []
    for kid, pre, fn, name, pn in TREES:
        a = np.array(fn())
        grid = [[None] * 3 for _ in range(4)]
        for cy in range(4):
            for cx in range(3):
                t = a[cy * 16:(cy + 1) * 16, cx * 16:(cx + 1) * 16].copy()
                if not t[:, :, 3].any(): continue
                t[t[:, :, 3] == 0] = 0
                loc = '%s/%d.%d' % (pre, cx, cy)
                pc = _pc(cx, cy)
                cells[loc] = dict(img=Image.fromarray(t, 'RGBA'), pc=pc, label='%s 칸 (%d,%d)' % (name, cx + 1, cy + 1),
                                  desc='%s 3×4 키트의 %s. 키트 %s 로 통째로 놓는다(낱칸으로 칠하지 않는다).' % (
                                      name, {'star': '수관(★ 걸어 지나감·사람 위)', 'solid': '줄기 밑동(막힘)', 'flat': '뿌리·흙(투명 덧그림·사람 밑)'}[pc], kid),
                                  tags=['가로수', '나무', 'tree', pn])
                grid[cy][cx] = loc
        desc = ('%s 3×4칸 키트. 줄기 칸만 막힘(맨 아래 줄 가운데), 수관은 ★(사람 위에 그려짐), 뿌리·흙은 사람 밑 덧그림. '
                '손 도트(잎 덩이·왼쪽 위 빛 테두리·가지·껍질 결·뿌리 퍼짐). 가로수·공원·학교 담 따라.' % name)
        kits.append(dict(id=kid, name=name, grid=grid, base=None, parts=[], replaces=True,
                         ai=dict(snap='floor', tags=['jp-city', 'prop', '가로수', name, pn], description=desc,
                                 placementRules='바닥(보도·잔디·광장) 위에 키트 하나로 찍는다(낱칸으로 칠하지 않는다). 맨 아래 줄 가운데 줄기 칸이 길을 막지 않는 자리에 둔다.',
                                 role='prop', repeatability='fixed', growthAxis=None, anchor=dict(dx=1, dy=3), access=[])))
    out = dict(cells=cells, autotiles=[], groups=[dict(id='jp:prop:street-tree-34', name='소품 · 가로수(3×4)', role='prop', defaultLayer='upper',
                                                        cells=list(cells), desc='가로수 느티나무·벚나무 3×4 키트 칸.', rules='소품은 낱칸으로 칠하지 않고 키트(jp-prop-tree-…)로 찍는다.')],
               kits=kits, notes='가로수 느티나무·벚나무 3×4(4×6 원본 소품 키트를 같은 id 로 갈아 끼움). 칸 %d.' % len(cells))
    _CACHE['b'] = out
    return _copy(out)


def _copy(b):
    return dict(cells=collections.OrderedDict((k, dict(v, img=v['img'].copy(), tags=list(v['tags']))) for k, v in b['cells'].items()),
                autotiles=[], groups=[dict(g, cells=list(g['cells'])) for g in b['groups']],
                kits=[dict(k, grid=[list(r) for r in k['grid']]) for k in b['kits']], notes=b['notes'])


def _allowed():
    from lib_blocks_lines.core import _owner
    cc = {int(h[1:], 16) for h in json.load(open(os.path.join(ROOT, 'tiledata', 'jp-city', 'palette-contract.json')))['colors']}
    return set(_owner()) | cc


def selftest(verbose=True):
    out = []
    b = build(); allowed = _allowed()
    for k, c in b['cells'].items():
        a = np.array(c['img'])
        if a.shape != (16, 16, 4): out.append('(a) %s 크기' % k); continue
        al = a[..., 3]
        if not np.all((al == 0) | (al == 255)): out.append('(a) %s 반투명' % k)
        for r, g, bb in {tuple(map(int, p)) for p in a[al == 255][:, :3]}:
            if ((r << 16) | (g << 8) | bb) not in allowed: out.append('(a) %s 팔레트 밖 #%02x%02x%02x' % (k, r, g, bb)); break
    for k in b['kits']:
        if len(k['grid']) != 4 or any(len(r) != 3 for r in k['grid']): out.append('(b) %s 3×4 아님' % k['id'])
        if b['cells'].get(k['grid'][3][1], {}).get('pc') != 'solid': out.append('(b) %s 줄기 칸이 막힘 아님' % k['id'])
        for r in k['grid']:
            for v in r:
                if v is not None and v not in b['cells']: out.append('(b) %s 칸 %s 없음' % (k['id'], v))
    if verbose:
        print('jp_street_trees: 칸 %d · 키트 %d · 문제 %d' % (len(b['cells']), len(b['kits']), len(out)))
        for m in out[:20]: print('  ', m)
    return len(out)


def render(kid):
    b = build(); k = [x for x in b['kits'] if x['id'] == kid][0]
    im = Image.new('RGBA', (48, 64), (0, 0, 0, 0))
    for cy, r in enumerate(k['grid']):
        for cx, v in enumerate(r):
            if v: im.alpha_composite(b['cells'][v]['img'], (cx * 16, cy * 16))
    return im


def preview(outdir=OUTDIR):
    """키트 그림(1x·x4). 3/4 관문 그림·items.jsonl 은 jp_shore.preview() 가 물가 판·등대·폭포와 함께 한 파일로 쓴다."""
    os.makedirs(outdir, exist_ok=True)
    for kid, pre, fn, name, pn in TREES:
        im = render(kid)
        im.save(os.path.join(outdir, '%s.png' % kid)); im.resize((192, 256), Image.NEAREST).save(os.path.join(outdir, '%s-x4.png' % kid))
    return outdir


if __name__ == '__main__':
    bad = selftest()
    print(preview(sys.argv[1] if len(sys.argv) > 1 else OUTDIR))
    sys.exit(1 if bad else 0)
