#!/usr/bin/env python3
"""후보를 거리 맥락에 놓은 그림.
  python3 scripts/content/atlas-pick/context.py tiledata/atlas-pick/candidates-jp/<slug>/j1-A.pxg   # → j1-A.ctx.png (4배)

일본 세트(현재판 없음): 현대 시트의 보도(3076)·아스팔트(3136) 칸을 깔고, 벽 걸이는 콘크리트 벽면 위에, 그 위에 후보를 놓는다.
현대 세트: 강남역 맵 렌더에서 그 조각이 처음 놓인 자리 둘레를 잘라, 그 자리 그림만 후보로 바꿔 끼운다(make_modern_set.py 가 좌표를 적는다)."""
import os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa

PAVE, ASPH = 3076, 3136
# 세트마다 바꿀 수 있다: sets.json 의 "backdrop": {"sheet": "public/…png", "cols": 30, "floor": 칸, "alt": 칸, "wall": "#rrggbb"}
#   floor = 물체·벽 걸이·외관 밑 바닥, alt = 바닥(ground) 조각 둘레(없으면 floor). 없으면 현대 시트 보도(3076)·아스팔트(3136).
BACKDROP = {}
_SHEETS = {}
def sheet_cell(t, sheet=None, cols=30):
    sheet = sheet or MODERN_SHEET
    if sheet not in _SHEETS: _SHEETS[sheet] = Image.open(sheet).convert('RGBA')
    return _SHEETS[sheet].crop(((t % cols) * 16, (t // cols) * 16, (t % cols) * 16 + 16, (t // cols) * 16 + 16))

def street(wc, hc, ground):
    im = Image.new('RGBA', (wc * 16, hc * 16)); b = BACKDROP
    sheet = os.path.join(ROOT, b['sheet']) if b.get('sheet') else None
    if isinstance(ground, str) and ground in b: ground = b[ground]
    elif isinstance(ground, str): ground = PAVE if ground == 'floor' else ASPH
    for y in range(hc):
        for x in range(wc):
            im.paste(sheet_cell(ground, sheet, b.get('cols', 30)), (x * 16, y * 16))
    return im

def wall_rows(im, rows):
    sys.path.insert(0, MODERN_LIB); import pal
    a = np.array(im); a[:rows * 16] = pal.C('conc', 4); a[rows * 16 - 1] = pal.C('conc', 2); a[rows * 16 - 2] = pal.C('conc', 3)
    return Image.fromarray(a)

def jp_context(it, slot):
    """slot = 후보 그림(RGBA). 기물 칸 둘레 2칸 거리."""
    w, h = it['cells']; layer = it['layer']
    hint = it.get('palette_hint', '')
    if layer == 'ground':
        wc, hc = w + 4, h + 4; im = street(wc, hc, 'floor' if ('mpave' in hint or 'ishi' in hint or BACKDROP) else 'alt'); ox, oy = 2, 2
    elif layer in ('wall',):
        wc, hc = w + 4, h + 4; im = wall_rows(street(wc, hc, 'floor'), h + 3); ox, oy = 2, 1
    elif layer == 'facade':
        wc, hc = w + 4, h + 2; im = street(wc, hc, 'floor'); ox, oy = 2, 0
    elif layer == 'over':
        wc, hc = w * 2 + 2, h + 4; im = street(wc, hc, 'alt')
        for k in range(2): im.alpha_composite(slot, ((1 + k * w) * 16, 16))
        return im
    else:
        wc, hc = w + 4, h + 3; im = street(wc, hc, 'floor'); ox, oy = 2, 1
    if slot is not None:
        im.alpha_composite(slot, (ox * 16, oy * 16))
    return im

def modern_context(it, slot):
    """강남 맵 렌더에서 잘라 둔 둘레(v0 판 그대로) 위에 후보를 덮어 쓴다. 조각 자리 = it['ctx']['at'](그림 기준 px)."""
    c = it.get('ctx')
    if not c: return None
    im = Image.open(os.path.join(cand_dir('modern'), it['slug'], 'ctx-base.png')).convert('RGBA')
    if slot is not None:
        x, y = c['at']; w, h = slot.size
        base = Image.open(os.path.join(cand_dir('modern'), it['slug'], 'ctx-under.png')).convert('RGBA')   # 조각 밑 바닥(아래층)
        im.paste(base, (x, y)); im.alpha_composite(slot, (x, y))
    return im

def custom_context(spec, it, slot):
    """sets.json 의 "context": "모듈:함수" — 세트 전용 맥락 그림(학원 school_context, 호러 horror_context, 월드맵 worldmap_context).
    함수는 (it, slot) → PIL RGBA(1배). 특례 horror_context:lit_dark = 밝은 방 + 어두운 방 나란히(horror_context.py main 과 같다)."""
    import importlib
    mod, fn = spec.split(':', 1); m = importlib.import_module(mod)
    if fn == 'lit_dark':
        lit = m.room(it, slot); dark = m.darkened(lit)
        both = Image.new('RGBA', (lit.width * 2 + 8, lit.height), (20, 18, 24, 255)); both.paste(lit, (0, 0)); both.paste(dark, (lit.width + 8, 0))
        return both
    return getattr(m, fn)(it, slot)

def context_image(set_id, it, slot):
    global BACKDROP
    conf = set_conf(set_id); BACKDROP = conf.get('backdrop') or {}
    if set_id == 'modern': return modern_context(it, slot)
    if conf.get('context'):
        if slot is None: return None
        return custom_context(conf['context'], it, slot)
    return jp_context(it, slot)

def main():
    for f in sys.argv[1:]:
        st, s = set_of_path(f); it = items_by_slug(st)[s]
        png = os.path.splitext(f)[0] + '.png'
        if not os.path.exists(png):
            sys.path.insert(0, PXGRID); import pxgrid; pxgrid.render(f, png)
        im = context_image(st, it, Image.open(png).convert('RGBA'))
        out = os.path.splitext(f)[0] + '.ctx.png'
        im.resize((im.width * 4, im.height * 4), Image.NEAREST).save(out); print(out)

if __name__ == '__main__':
    main()
