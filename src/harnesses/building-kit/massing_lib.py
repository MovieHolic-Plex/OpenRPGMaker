"""그리는 쪽(tile-artist)이 쓰는 도구 — 글자 격자 캔버스 + building-kit 부품 문법(판타지 왕국 줄 A 부품) 꺼내 쓰기.

    import sys; sys.path.insert(0, 'src/harnesses/building-kit')
    from massing_lib import Canvas, P, RAMPS, kit_part, kit_building
    c = Canvas(9, 8)                       # 칸(16px) 단위 크기
    c.paste(kit_building({...recipe...}), 0, 0)   # 부품 문법으로 조립한 바탕(선택)
    c.rows(10, 20, ['ab..c', 'abbbc'])    # 행 문자열 — '.' 와 ' ' 는 건너뛴다
    c.save('inn', meta)                    # art/inn.txt + art/inn.json, 그리고 check + render

글자 → 색은 harness-data/building-kit/massing/palette.json(버들항 시트의 실제 화소 색만). 난수·잡음 채우기 금지 —
무늬는 손으로 고른 좌표·행 문자열로 찍는다. 그림 파일을 화소로 읽어 베끼는 헬퍼는 없다(버들항 기준 그림은 눈으로만 본다).
"""
import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import massing as M  # noqa: E402

T = 16
_pal_json = json.load(open(os.path.join(M.DATA, 'palette.json'), encoding='utf-8'))
P = {ch: h for ch, h in _pal_json['legend'].items()}            # 글자 → '#rrggbb'
RAMPS = _pal_json['ramps']                                        # 이름 → 글자들(어두운 → 밝은)
_RGB = {ch: M.dot.hx(h) for ch, h in P.items()}


def nearest(rgb):
    best, bd = None, 1e9
    for ch, c in _RGB.items():
        d = sum((a - b) ** 2 for a, b in zip(rgb, c))
        if d < bd:
            best, bd = ch, d
    return best


def _to_rows(img):
    a = np.array(img.convert('RGBA'))
    cache = {}
    out = []
    for y in range(a.shape[0]):
        r = []
        for x in range(a.shape[1]):
            p = a[y, x]
            if p[3] < 128:
                r.append('.')
                continue
            k = tuple(int(v) for v in p[:3])
            if k not in cache:
                cache[k] = nearest(k)
            r.append(cache[k])
        out.append(''.join(r))
    return out


_PARTS = None


def _parts():
    global _PARTS
    if _PARTS is None:
        import harness
        _PARTS = {}
        for rid in ('style-r4', 'style-r5', 'style-r8'):   # 뒤 판이 같은 항목을 이긴다
            try:
                _PARTS.update(harness.resolve_parts('fantasy-kingdom', rid, 'A', 'A'))
            except (Exception, SystemExit) as e:  # noqa: BLE001
                print(f'  (부품 {rid} 건너뜀: {e})', file=sys.stderr)
    return _PARTS


def kit_part(item, role=None):
    """판타지 왕국 줄 A 부품 세트(style-r8 ← r7 ← r5 …)를 글자 행으로. role 을 주면 그 조각만.
    item 예: roof.hip · roof.gf.slope · gable.front · gable.step · roof.gf.back · roof.gf.valley · wall.timber · wall.stone ·
    band.trim · extra.chimney · roof.lean.side. 목록: kit_items()."""
    p = _parts()[item]
    img = p['img']
    if role:
        pc = next(x for x in p['item']['pieces'] if x['role'] == role or x['id'] == role)
        x, y = pc['at']
        w, h = pc['size']
        img = img.crop((x * T, y * T, (x + w) * T, (y + h) * T))
    return _to_rows(img)


def kit_items():
    return {k: [pc['role'] for pc in v['item']['pieces']] for k, v in _parts().items()}


def kit_building(recipe):
    """building-kit 조립 문법(질량 ridge_side · gable_front · lean_to, 깊이 땅 r7)으로 줄 A 부품을 조립한 바탕을 글자 행으로.
    recipe 형식은 harness-data/building-kit/fantasy-kingdom/seed.json 의 buildings 와 같다(예: thouse.r7). 조립 관문 결과도 돌려준다."""
    import assemble as AS
    import dot
    recipe = dict(recipe)
    recipe.setdefault('id', 'base')
    res = AS.assemble(recipe, _parts(), dot.palette('fantasy-kingdom'), 'fantasy-kingdom', depth_ground=True)
    if res['img'] is None:
        raise SystemExit(f'조립 실패: {res.get("needsDrawing") or res}')
    fails = AS.run_checks(res)
    return _to_rows(res['img'].img()), [f'{f["code"]} {f["msg"]}' for f in fails]


class Canvas:
    def __init__(self, wcells, hcells):
        self.w, self.h = wcells * T, hcells * T
        self.g = [['.'] * self.w for _ in range(self.h)]

    def put(self, x, y, ch):
        if ch not in P and ch != '.':
            raise KeyError(f'팔레트에 없는 글자 {ch!r}')
        if 0 <= x < self.w and 0 <= y < self.h:
            self.g[y][x] = ch

    def get(self, x, y):
        return self.g[y][x]

    def rows(self, x, y, rows, skip='. '):
        for j, r in enumerate(rows):
            for i, ch in enumerate(r):
                if ch in skip:
                    continue
                self.put(x + i, y + j, ch)

    def paste(self, rows, x, y):
        self.rows(x, y, rows, skip='.')

    def rect(self, x, y, w, h, ch):
        for j in range(h):
            for i in range(w):
                self.put(x + i, y + j, ch)

    def tile(self, x, y, w, h, motif):
        """motif(행 문자열)을 (x,y) 부터 w×h 화소에 반복해 깐다 — 무늬는 손으로 그린 motif 다."""
        mh, mw = len(motif), len(motif[0])
        for j in range(h):
            for i in range(w):
                ch = motif[j % mh][i % mw]
                if ch not in '. ':
                    self.put(x + i, y + j, ch)

    def replace(self, x, y, w, h, mapping):
        for j in range(h):
            for i in range(w):
                ch = self.g[y + j][x + i]
                if ch in mapping:
                    self.g[y + j][x + i] = mapping[ch]

    def text(self):
        return [''.join(r) for r in self.g]

    def save(self, bid, meta, render=True):
        os.makedirs(M.ART, exist_ok=True)
        open(os.path.join(M.ART, f'{bid}.txt'), 'w', encoding='utf-8').write('\n'.join(self.text()) + '\n')
        meta = dict(meta)
        meta['id'] = bid
        json.dump(meta, open(os.path.join(M.ART, f'{bid}.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        fails, warns = M.check(bid)
        if render and not fails:
            print('preview:', M.render(bid) + '-cmp.png', '·', M.render(bid) + '-1x-cmp.png')
        return fails, warns


def load(bid):
    """저장된 그림을 Canvas 로 다시 읽는다(고쳐 그릴 때)."""
    rows, meta = M.load(bid)
    c = Canvas(len(rows[0]) // T, len(rows) // T)
    c.g = [list(r) for r in rows]
    return c, meta
