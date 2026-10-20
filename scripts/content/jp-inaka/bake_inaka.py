#!/usr/bin/env python3
# noqa: SIZE_OK — self-contained jp-inaka block builder, contact-sheet renderer, and selftest
# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "pillow"]
# ///
# ─── How to run ───
# python3 scripts/content/jp-inaka/bake_inaka.py [--bake] [--sheet-out /home/main/claude-viz/jp-inaka-countryside-1/inaka-kits-sheet.png]
"""Japanese Countryside (jp-inaka) pixel-art chipset builder, contact-sheet renderer, and jp_city block integration."""
from __future__ import annotations

import argparse
import collections
import json
import os
import sys
from typing import Final

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE: Final[str] = os.path.dirname(os.path.abspath(__file__))
ROOT: Final[str] = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
JP_CITY_DIR: Final[str] = os.path.join(ROOT, 'scripts', 'content', 'jp-city')
for _p in (HERE, os.path.join(JP_CITY_DIR, 'houses'), os.path.join(JP_CITY_DIR, 'blocks'), JP_CITY_DIR):
    if _p not in sys.path:
        sys.path.insert(0, _p)

import inaka_art_props as _props  # noqa: E402,F401  (registers kits 11..30 and GROUND)
from inaka_art_houses import KITS, Cv, _RAMP  # noqa: E402
from inaka_art_props import GROUND, GROUND_GROUPS  # noqa: E402
from inaka_art_ground import autotile_cells  # noqa: E402

BLOCK: Final[str] = 'jp_inaka_pack'
OUTDIR: Final[str] = os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks', BLOCK)
DEFAULT_SHEET_OUT: Final[str] = '/home/main/claude-viz/jp-inaka-countryside-1/inaka-kits-sheet.png'
NOTES: Final[str] = (
    '일본 시골(이나카 여름방학) 팩: 모내기 물논·여름 푸른 논·가을 황금 논·논두렁 흙길·농수로 물/석축·시골 자갈길·맑은 개울·여름 들꽃 풀밭·채소밭 이랑 바닥 10종 + '
    '초가 고민가·기와 농가·토장 창고·막과자 가게·버스 정류장·무인 채소 판매대·목조 간이역·단량 디젤 동차(키하 40형 8×3)·붉은 철교·개울 징검다리·소방 망루·'
    '흰 경트럭(4×2)·붉은 트랙터(4×3)·함석 농기구 헛간·비닐하우스·해바라기 군락·수국 꽃덤불·지장보살 사당·나무 전봇대·둥근 우체통과 자판기·물레방아간·'
    '농수로 수문·하사기 볏단 건조대·허수아비 한 쌍·타케가키 대나무 울타리·이끼 돌담·커브길 볼록거울·시골 자전거·작두 우물 펌프·언덕 도리이 돌계단 키트 %d종.'
)
_CACHE: dict[str, tuple] = {}


def _cv(w: int, h: int) -> Cv:
    """Create a pixel canvas of `(w * 16) x (h * 16)` pixels."""
    return Cv(w * 16, h * 16)


def _cells_of(a: np.ndarray, rows_n: int, cols_n: int):
    """Yield `(cx, cy, tile_rgba)` for each 16x16 cell in array `a`."""
    for cy in range(rows_n):
        for cx in range(cols_n):
            t = a[cy * 16:(cy + 1) * 16, cx * 16:(cx + 1) * 16].copy()
            if not t[:, :, 3].any():
                yield cx, cy, None
                continue
            t[t[:, :, 3] == 0] = 0
            yield cx, cy, t


def _finalize():
    """Render all 9 ground tiles and 30 inaka kits into deduplicated 16x16 cells and kit definitions."""
    if 'r' in _CACHE:
        return _CACHE['r']
    cells = collections.OrderedDict()
    seen: dict[tuple[bytes, str], str] = {}
    kits: list[dict] = []
    renders: dict[str, Image.Image] = {}
    names = {cs[0]: (nm, d) for _, nm, cs, d in GROUND_GROUPS}
    for name, (fn, pc) in GROUND.items():
        c = Cv(16, 16)
        fn(c)
        seen[(c.a.tobytes(), pc)] = name
        nm, desc = names[name]
        cells[name] = dict(
            img=Image.fromarray(c.a, 'RGBA'),
            pc=pc,
            label='일본 시골 바닥 · ' + nm,
            desc='[이나카 시골 팩] ' + desc,
            tags=['바닥', '일본 시골', 'inaka', nm],
        )
    at_cells, autotiles, at_groups = autotile_cells()
    for loc, (arr, pc, lab, desc, tags) in at_cells.items():
        cells[loc] = dict(img=Image.fromarray(arr, 'RGBA'), pc=pc, label=lab, desc=desc, tags=tags)
    for k in KITS:
        up, base = _cv(k['w'], k['h']), _cv(k['w'], k['h'])
        k['draw'](up, base)
        grids: dict[str, list[list[str | None]]] = {}
        for layer, cv in (('up', up), ('base', base)):
            g: list[list[str | None]] = [[None] * k['w'] for _ in range(k['h'])]
            for cx, cy, t in _cells_of(cv.a, k['h'], k['w']):
                if t is None:
                    continue
                pc = 'floor' if layer == 'base' else ('solid' if (cx, cy) in k['solid'] else k['other'])
                key = (t.tobytes(), pc)
                if key not in seen:
                    loc = '%s/%s%d.%d' % (k['id'], 'b' if layer == 'base' else '', cx, cy)
                    seen[key] = loc
                    extra_tags = ['stair', '계단'] if ('stair' in k['tags'] and (cx, cy) not in k['solid']) else []
                    cells[loc] = dict(
                        img=Image.fromarray(t, 'RGBA'),
                        pc=pc,
                        label='%s 칸 (%d,%d)%s' % (k['name'], cx, cy, ' 바닥' if layer == 'base' else ''),
                        desc='[이나카 시골 팩] %s 의 일부. 키트 jp-%s 로 통째로 놓는다.' % (k['name'], k['id']),
                        tags=list(k['tags']) + extra_tags,
                    )
                g[cy][cx] = seen[key]
            grids[layer] = g
        has_base = any(v for r in grids['base'] for v in r)
        desc = '%s — 폭 %d칸×높이 %d칸. 손 도트 일본 시골(이나카 여름방학) 팩(일본 로케일 팔레트 계약 색, 빛 왼쪽 위, 3/4 시점).%s' % (
            k['name'],
            k['w'],
            k['h'],
            ' 바닥(1층) 칸 포함.' if has_base else '',
        )
        parts = [
            dict(kind='entrance', x=dx, y=dy, w=dw, h=1, label='출입문')
            for dx, dy, dw in k.get('doors', [])
        ]
        access = [
            dict(x=dx + ox, y=dy + 1)
            for dx, dy, dw in k.get('doors', [])
            for ox in range(dw)
        ]
        ai = dict(
            snap='floor',
            tags=list(k['tags']) + ['jp-inaka', 'jp-region'],
            description=desc,
            placementRules=k['rules'],
            repeatability='fixed',
            growthAxis=None,
            anchor=dict(dx=0, dy=k['h'] - 1),
            access=access,
            role=k['role'],
        )
        kits.append(
            dict(
                id='jp-' + k['id'],
                name=k['name'],
                grid=grids['up'],
                base=grids['base'] if has_base else None,
                parts=parts,
                ai=ai,
            )
        )
        comp = Image.new('RGBA', (k['w'] * 16, k['h'] * 16), (0, 0, 0, 0))
        comp.alpha_composite(Image.fromarray(base.a, 'RGBA'))
        comp.alpha_composite(Image.fromarray(up.a, 'RGBA'))
        renders[k['id']] = comp
    groups = [
        dict(id=gid, name=nm, role='terrain', defaultLayer='lower', cells=list(cs), desc=d, rules=d)
        for gid, nm, cs, d in GROUND_GROUPS
    ] + at_groups
    _CACHE['at'] = autotiles
    _CACHE['r'] = (cells, kits, renders, groups)
    return _CACHE['r']


def build() -> dict:  # noqa: DICT_OK — required by bake_jp.py block interface
    """Return block dictionary (`cells`, `autotiles`, `groups`, `kits`, `notes`) for `bake_jp.py`."""
    cells, kits, _, groups = _finalize()
    return {
        'cells': collections.OrderedDict((k, dict(v, img=v['img'].copy(), tags=list(v['tags']))) for k, v in cells.items()),
        'autotiles': [dict(a, member=list(a['member']), connect=list(a['connect']), variantMap=dict(a['variantMap']),
                           interior=[list(t) for t in a['interior']]) for a in _CACHE['at']],
        'groups': [dict(g, cells=list(g['cells'])) for g in groups],
        'kits': [dict(k) for k in kits],
        'notes': NOTES % len(kits),
    }


def kinds() -> dict[str, str]:
    """Return object-gate kind mapping for all 30 inaka kits."""
    return {'jp-' + k['id']: k['kind'] for k in KITS}


def _allowed() -> set[int]:
    """Return allowed 24-bit RGB palette set (`modern3 ∪ palette-contract.json`)."""
    from lib_blocks_lines.core import _owner
    return set(_owner()) | {v for r in _RAMP.values() for v in r}


def selftest(verbose: bool = True) -> int:
    """Verify 16x16 RGBA cells, alpha 0/255, palette compliance, and kit cell references."""
    out: list[str] = []
    allowed = _allowed()
    b = build()
    if len(b['kits']) < 30:
        out.append('키트 수 미달: %d < 30' % len(b['kits']))
    if len(b['autotiles']) != 6:
        out.append('오토타일 수 %d != 6' % len(b['autotiles']))
    for at in b['autotiles']:
        if set(at['variantMap']) != {str(i) for i in range(256)}:
            out.append('(c) %s variantMap 키' % at['id'])
        for v in list(at['variantMap'].values()) + list(at['member']) + [x for t in at['interior'] for x in t]:
            if v not in b['cells']:
                out.append('(c) %s 칸 %s 없음' % (at['id'], v)); break
    if len(b['groups']) < 9:
        out.append('바닥 그룹 수 미달: %d < 9' % len(b['groups']))
    for k, c in b['cells'].items():
        a = np.array(c['img'])
        if a.shape != (16, 16, 4):
            out.append('(a) %s 크기' % k)
            continue
        al = a[..., 3]
        if not np.all((al == 0) | (al == 255)):
            out.append('(a) %s 반투명' % k)
        vis = a[al == 255][:, :3]
        for r, g, bb in {tuple(map(int, p)) for p in vis}:
            if ((r << 16) | (g << 8) | bb) not in allowed:
                out.append('(a) %s 팔레트 밖 #%02x%02x%02x' % (k, r, g, bb))
                break
    ids = [k['id'] for k in b['kits']]
    if len(ids) != len(set(ids)):
        out.append('키트 id 중복')
    for k in b['kits']:
        for layer in ('grid', 'base'):
            for row in (k[layer] or []):
                for v in row:
                    if v is not None and v not in b['cells']:
                        out.append('(b) %s 칸 %s 없음' % (k['id'], v))
    if verbose:
        print('jp_inaka_pack: 칸 %d · 키트 %d · 바닥그룹 %d · 문제 %d' % (len(b['cells']), len(b['kits']), len(b['groups']), len(out)))
        for m in out[:20]:
            print('  ', m)
    return len(out)


def preview(outdir: str = OUTDIR) -> str:
    """Save individual kit PNGs and `_all.png` / `_all-x2.png` into `outdir`."""
    os.makedirs(outdir, exist_ok=True)
    cells, _, renders, _ = _finalize()
    bg = (68, 84, 62, 255)
    ims = [renders[k['id']] for k in KITS]
    width_px = 960
    x = y = 0
    rowh = 0
    pos: list[tuple[int, int]] = []
    for im in ims:
        if x + im.width > width_px:
            x = 0
            y += rowh + 10
            rowh = 0
        pos.append((x, y))
        x += im.width + 10
        rowh = max(rowh, im.height)
    gy = y + rowh + 14
    sheet = Image.new('RGBA', (width_px, gy + 44), bg)
    for im, p in zip(ims, pos):
        sheet.alpha_composite(im, p)
    for i, name in enumerate(GROUND):
        for dy in range(2):
            for dx in range(2):
                sheet.alpha_composite(cells[name]['img'], (12 + i * 44 + dx * 16, gy + dy * 16))
    sheet.save(os.path.join(outdir, '_all.png'))
    sheet.resize((sheet.width * 2, sheet.height * 2), Image.Resampling.NEAREST).save(os.path.join(outdir, '_all-x2.png'))
    valid_pngs = {'_all.png', '_all-x2.png'} | {'jp-%s.png' % k['id'] for k in KITS}
    for fn in os.listdir(outdir):
        if fn.endswith('.png') and fn not in valid_pngs:
            os.remove(os.path.join(outdir, fn))
    for k in KITS:
        renders[k['id']].save(os.path.join(outdir, 'jp-%s.png' % k['id']))
    return os.path.join(outdir, '_all-x2.png')


def _render_reused_jp_train_card() -> Image.Image:
    """Render existing `jp-train-car-a` + `jp-train-car-b` on `jp-rail-h` (8x4 tiles) from `rail_art.py` & `street_hand.py`."""
    import rail_art
    import street_hand
    comp = Image.new('RGBA', (8 * 16, 4 * 16), (0, 0, 0, 0))
    for tx in range(8):
        rc = Cv(16, 64)
        street_hand.rail_h(rc)
        comp.alpha_composite(Image.fromarray(rc.a, 'RGBA'), (tx * 16, 0))
    ca, cb = Cv(64, 48), Cv(64, 48)
    rail_art._train(ca, 'a')
    rail_art._train(cb, 'b')
    comp.alpha_composite(Image.fromarray(ca.a, 'RGBA'), (0, 0))
    comp.alpha_composite(Image.fromarray(cb.a, 'RGBA'), (64, 0))
    return comp

def _render_kiha_on_rail_card(kiha_im: Image.Image) -> Image.Image:
    """Render `inaka-single-car-train` (8x3) on `jp-rail-h` (8x4 tiles) so it can be directly compared with `jp-train-car-a/b`."""
    import street_hand
    comp = Image.new('RGBA', (8 * 16, 4 * 16), (0, 0, 0, 0))
    for tx in range(8):
        rc = Cv(16, 64)
        street_hand.rail_h(rc)
        comp.alpha_composite(Image.fromarray(rc.a, 'RGBA'), (tx * 16, 0))
    comp.alpha_composite(kiha_im, (0, 0))
    return comp


def render_contact_sheet(out_path: str = DEFAULT_SHEET_OUT, scale: int = 3) -> str:
    """Render a 3x labeled contact sheet of 30 bespoke inaka kits (incl. 8x3 Kiha, 4x2 keitora, 4x3 tractor) + reused jp_city train kit + ground tiles."""
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    cells, _, renders, _ = _finalize()
    cards: list[tuple[str, int, int, Image.Image]] = []
    for k in KITS:
        im = _render_kiha_on_rail_card(renders[k['id']]) if k['id'] == 'inaka-single-car-train' else renders[k['id']]
        cards.append((k['id'], k['w'], k['h'], im))
    cards.append(('jp-train-car-a/b [jp_city]', 8, 4, _render_reused_jp_train_card()))
    cols = 5
    card_w, card_h = 376, 290
    pad = 16
    header_h = 84
    ground_h = 150
    rows_n = (len(cards) + cols - 1) // cols
    W = pad * 2 + cols * card_w + (cols - 1) * 12
    H_px = header_h + rows_n * (card_h + 12) + ground_h + pad
    canvas = Image.new('RGBA', (W, H_px), (26, 33, 29, 255))
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.load_default()

    # Header banner
    draw.rectangle([0, 0, W, header_h - 8], fill=(36, 48, 41, 255))
    draw.text((pad, 18), 'JP-INAKA COUNTRYSIDE CHIPSET — %d INAKA KITS (4x2 KEITORA, 4x3 TRACTOR, 8x3 KIHA) + JP-TRAIN-CAR-A/B + %d GROUND TILES' % (len(KITS), len(GROUND)), fill=(238, 234, 219, 255), font=font)
    draw.text((pad, 44), 'jp_city house_kit / parts_vehicles conventions | 3/4 top-down (top plane + south face) | Top-Left Sun | 1px Sumi Contour', fill=(186, 204, 174, 255), font=font)

    for idx, (cid, cw_t, ch_t, im) in enumerate(cards):
        r_idx, c_idx = divmod(idx, cols)
        cx = pad + c_idx * (card_w + 12)
        cy = header_h + r_idx * (card_h + 12)
        draw.rectangle([cx, cy, cx + card_w, cy + card_h], fill=(42, 54, 46, 255), outline=(88, 108, 86, 255), width=2)
        stage_x, stage_y = cx + 10, cy + 32
        stage_w, stage_h = card_w - 20, card_h - 42
        draw.rectangle([stage_x, stage_y, stage_x + stage_w, stage_y + stage_h], fill=(64, 80, 62, 255))
        eff_scale = 2 if im.width * scale > stage_w - 8 else scale
        scaled = im.resize((im.width * eff_scale, im.height * eff_scale), Image.Resampling.NEAREST)
        px = stage_x + (stage_w - scaled.width) // 2
        py = stage_y + (stage_h - scaled.height) // 2
        canvas.alpha_composite(scaled, (max(stage_x + 2, px), max(stage_y + 2, py)))
        label = f"#{idx + 1:02d} {cid} ({cw_t}x{ch_t})"
        draw.text((cx + 10, cy + 10), label, fill=(250, 226, 159, 255), font=font)
    # Bottom row: 9 ground/water tiles tiled 2x2 at 3x scale
    gy0 = header_h + rows_n * (card_h + 12) + 8
    draw.rectangle([pad, gy0, W - pad, gy0 + ground_h - 12], fill=(36, 46, 40, 255), outline=(88, 108, 86, 255), width=2)
    draw.text((pad + 12, gy0 + 10), 'GROUND & WATER TILES (%dx 16x16 tiled 2x2 at 3x scale):' % len(GROUND), fill=(250, 226, 159, 255), font=font)
    g_step = (W - pad * 2 - 24) // len(GROUND)
    for i, (gkey, _) in enumerate(GROUND.items()):
        gx = pad + 16 + i * g_step
        gy = gy0 + 34
        tile_2x2 = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
        for dy in range(2):
            for dx in range(2):
                tile_2x2.alpha_composite(cells[gkey]['img'], (dx * 16, dy * 16))
        tile_scaled = tile_2x2.resize((32 * scale, 32 * scale), Image.Resampling.NEAREST)
        canvas.alpha_composite(tile_scaled, (gx, gy))
        short_nm = gkey.replace('gnd/inaka-', '')
        draw.text((gx, gy + 32 * scale + 6), short_nm, fill=(220, 225, 232, 255), font=font)

    canvas.save(out_path)
    return out_path


# object-gate 종류(키트 kind → 관문 종류). R5 영수증과 같은 대응이다. 정직하게 붙인다(면제 종류로 도망가지 않는다).
GATE_KIND: Final[dict[str, str]] = {
    'building': 'structure', 'structure': 'structure', 'wall': 'structure', 'water': 'container',
    'vehicle': 'other', 'prop': 'other', 'tree': 'organic', 'column': 'column', 'terrain': 'terrain',
}
GATE_REGION_KITS: Final[tuple[str, ...]] = ('rg-bamboo-clump', 'rg-bamboo-grove', 'rg-bamboo-grove-b')   # 이 팩이 함께 바꾼 jp_regions_pack 대나무


def _group_sheet(cells: dict, ids: list[str], per_row: int = 8) -> Image.Image:
    """바닥 그룹 칸들을 8열로 빈틈없이 이어 붙인 관문 그림(결정적 — 같은 칸이면 같은 해시)."""
    n = len(ids)
    cols = min(per_row, n)
    rows_n = (n + per_row - 1) // per_row
    im = Image.new('RGBA', (cols * 16, rows_n * 16), (0, 0, 0, 0))
    for i, cid in enumerate(ids):
        im.alpha_composite(cells[cid]['img'], ((i % per_row) * 16, (i // per_row) * 16))
    return im


def gate_items() -> list[tuple[str, str, Image.Image]]:
    """[(라벨, 관문 종류, 그림)] — 이 팩이 굽는 새 그림 전부: 키트 31 · 바닥 그룹 16장 · 대나무 3(jp_regions_pack)."""
    cells, _, renders, groups = _finalize()
    out = [('jp_inaka_pack/jp-%s' % k['id'], GATE_KIND[k['kind']], renders[k['id']]) for k in KITS]
    for g in groups:
        out.append(('jp_inaka_pack/ground/%s' % g['id'].split(':', 1)[-1], 'terrain', _group_sheet(cells, list(g['cells']))))
    import jp_regions_pack as _rg
    _, _, rg_renders, _ = _rg._finalize()
    kinds_rg = _rg.kinds()
    for rid in GATE_REGION_KITS:
        out.append(('jp_regions_pack/jp-%s' % rid, GATE_KIND.get(kinds_rg['jp-' + rid], kinds_rg['jp-' + rid]), rg_renders[rid]))
    return out


def write_gate_batch(outdir: str) -> str:
    """관문 그림 PNG 와 object-gate enqueue 용 items.jsonl 을 outdir 에 쓴다."""
    os.makedirs(outdir, exist_ok=True)
    lines = []
    for label, kind, im in gate_items():
        fn = label.replace('/', '__') + '.png'
        im.save(os.path.join(outdir, fn))
        lines.append(json.dumps(dict(png=fn, kind=kind, name=label.split('/')[-1], label=label), ensure_ascii=False))
    path = os.path.join(outdir, 'items.jsonl')
    with open(path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines) + '\n')
    return path


def require_gate() -> None:
    """3/4 관문: 굽기 전에 이 팩의 새 그림 전부가 object-gate 출구(bundle)를 통과해야 한다. 우회 없음."""
    sys.path.insert(0, os.path.join(ROOT, 'src', 'harnesses', '_core'))
    import object_gate as OG
    try:
        OG.require_all([(im, kind, label) for label, kind, im in gate_items()], context='bundle')
    except OG.ObjectGateRefused as e:
        print('3/4 관문 거절 — 굽지 않는다 (OBJECT_GATE_DATA=%s)\n%s' % (OG.GATE_DATA, e), file=sys.stderr)
        sys.exit(3)
    print('3/4 관문: jp_inaka_pack 새 그림 %d장 통과' % len(gate_items()))


def bake_into_jp_city() -> None:
    """Run `bake_jp.bake(ROOT, dry=False)` and `bake_interior_spec.main()` to bundle `jp_inaka_pack` into `jp_city`."""
    import bake_interior_spec
    import bake_jp
    require_gate()
    out = bake_jp.bake(ROOT, dry=False)
    rep = out['report']
    bad = (
        rep['reassembly']['mismatched_kits']
        or rep['definition_checks']['violations']
        or rep['relayout_identical']['mismatched']
        or rep['palette']['cells_with_off_palette']
        or rep['palette']['marker_pixels']
        or rep['palette']['partial_alpha_pixels']
        or not rep['tiles']['height_ok']
    )
    print(
        json.dumps(
            {
                'tiles': rep['tiles']['count'],
                'kits': rep['kits']['total'],
                'groups': rep['groups']['total'],
                'reassembly_mismatched': rep['reassembly']['mismatched_kits'],
                'definition_violations': rep['definition_checks']['violations'],
                'off_palette': rep['palette']['cells_with_off_palette'],
                'partial_alpha': rep['palette']['partial_alpha_pixels'],
            },
            ensure_ascii=False,
        )
    )
    if bad:
        sys.exit(1)
    bake_interior_spec.main()


def main() -> None:
    """CLI entry point for `bake_inaka.py`."""
    ap = argparse.ArgumentParser(description='Bake jp-inaka countryside pixel-art kits and ground tiles.')
    ap.add_argument('--bake', action='store_true', help='Also bake jp_inaka_pack into jp_city chipset and JSON')
    ap.add_argument('--gate-out', help='Write object-gate PNGs + items.jsonl for `object-gate enqueue` into this folder and exit')
    ap.add_argument('--sheet-out', default=DEFAULT_SHEET_OUT, help='Output path for 3x contact sheet PNG')
    args = ap.parse_args()
    if args.gate_out:
        print(write_gate_batch(args.gate_out))
        return
    bad = selftest(verbose=True)
    if bad:
        sys.exit(1)
    prev_path = preview(OUTDIR)
    sheet_path = render_contact_sheet(args.sheet_out, scale=3)
    print('preview:', prev_path)
    print('contact_sheet:', sheet_path)
    if args.bake:
        bake_into_jp_city()


if __name__ == '__main__':
    main()
