#!/usr/bin/env python3
"""Fable-baseline modern ground, road, sidewalk, seam, marking, and shadow tiles.

Generates a clean set of 16x16px (and multi-tile) street/terrain tiles strictly using
tiledata/jp-city/fable-city/palette.json so modern_fable maps have crisp curbs, gutters,
tactile paving, crosswalks, asphalt patches, parks, canals, and zero bare seams.
"""
import os
import json
from fable_lib import Canvas, col, hsh, OUT_ROOT


def build_ground_tiles():
    out = {}

    def add(gid, name, layer, pc, w, h, fn, tags=()):
        cv = Canvas(w * 16, h * 16)
        fn(cv)
        out[gid] = {
            'id': gid, 'name': name, 'layer': layer, 'pc': pc,
            'w': w, 'h': h, 'tags': list(tags), 'im': cv.im,
        }

    # 1. Asphalt road variants (dark tarmac with organic aggregate grain + subtle patches)
    def _asphalt(cv, seed, patch=False):
        for y in range(16):
            for x in range(16):
                r = hsh(x, y, seed)
                t = 2 if r > 0.78 else (0 if r < 0.14 else 1)
                cv.p(x, y, col('tarmac', t))
        if patch:
            cv.rect(3, 5, 12, 11, col('asphalt', 1))
            cv.hline(3, 12, 5, col('asphalt', 0))
            cv.hline(3, 12, 11, col('asphalt', 3))

    add('mf-gnd-asphalt-a', '아스팔트 차도 A', 'ground', 'floor', 1, 1, lambda c: _asphalt(c, 11), ('road',))
    add('mf-gnd-asphalt-b', '아스팔트 차도 B', 'ground', 'floor', 1, 1, lambda c: _asphalt(c, 29), ('road',))
    add('mf-gnd-asphalt-patch', '아스팔트 보수 패치', 'ground', 'floor', 1, 1, lambda c: _asphalt(c, 47, True), ('road',))

    # 2. Sidewalk paving (warm pale stone grid, interlocking brick, forecourt tile)
    def _sidewalk(cv, ramp, base_i, seed, brick=False):
        for y in range(16):
            for x in range(16):
                if brick:
                    ci = y // 4
                    bx = (x + (4 if ci % 2 else 0)) % 8
                    if y % 4 == 3 or bx == 7:
                        cv.p(x, y, col(ramp, base_i - 2))
                    else:
                        r = hsh(x // 4, ci, seed)
                        cv.p(x, y, col(ramp, base_i + (1 if r > 0.7 else (-1 if r < 0.2 else 0))))
                else:
                    if x % 8 == 7 or y % 8 == 7:
                        cv.p(x, y, col(ramp, base_i - 2))
                    elif x % 8 == 0 or y % 8 == 0:
                        cv.p(x, y, col(ramp, base_i + 1))
                    else:
                        r = hsh(x, y, seed)
                        cv.p(x, y, col(ramp, base_i + (-1 if r < 0.15 else 0)))

    add('mf-gnd-sidewalk-a', '보도 블록 판석 A', 'ground', 'floor', 1, 1, lambda c: _sidewalk(c, 'pavement', 5, 101), ('path',))
    add('mf-gnd-sidewalk-b', '보도 블록 판석 B', 'ground', 'floor', 1, 1, lambda c: _sidewalk(c, 'concrete', 5, 131), ('path',))
    add('mf-gnd-sidewalk-brick', '인터로킹 벽돌 보도', 'ground', 'floor', 1, 1, lambda c: _sidewalk(c, 'stone', 4, 151, True), ('path',))
    add('mf-gnd-forecourt', '상가 앞마당 테라코타 판석', 'ground', 'floor', 1, 1, lambda c: _sidewalk(c, 'cream', 4, 171), ('path',))
    add('mf-gnd-alley', '골목 생활도로 포장', 'ground', 'floor', 1, 1, lambda c: _sidewalk(c, 'lane', 3, 191, True), ('alley',))

    # 3. Park grass, dirt plaza, canal water
    def _lawn(cv, seed, flowers=False):
        for y in range(16):
            for x in range(16):
                r = hsh(x, y, seed)
                t = 4 if r > 0.80 else (2 if r < 0.20 else 3)
                cv.p(x, y, col('lawn', t))
                if flowers and r > 0.94:
                    cv.p(x, y, col('yellow', 5) if (x + y) % 2 == 0 else col('white', 6))

    add('mf-gnd-lawn-a', '공원 잔디 A', 'ground', 'floor', 1, 1, lambda c: _lawn(c, 211), ('green',))
    add('mf-gnd-lawn-b', '공원 잔디 꽃밭', 'ground', 'floor', 1, 1, lambda c: _lawn(c, 223, True), ('green',))

    def _dirt(cv, seed):
        for y in range(16):
            for x in range(16):
                r = hsh(x, y, seed)
                t = 4 if r > 0.82 else (2 if r < 0.18 else 3)
                cv.p(x, y, col('earth', t))

    add('mf-gnd-earth', '운동장·마당 흙바닥', 'ground', 'floor', 1, 1, lambda c: _dirt(c, 241), ('terrain',))

    def _water(cv, seed):
        for y in range(16):
            for x in range(16):
                r = hsh(x // 2, y, seed)
                t = 4 if (y % 5 == 1 and r > 0.65) else (2 if r < 0.25 else 3)
                cv.p(x, y, col('glass', t))

    add('mf-gnd-water', '운하·하천 수면', 'ground', 'solidfloor', 1, 1, lambda c: _water(c, 257), ('water',))

    # 4. Curbs, gutters, road markings, crosswalks, tactile paving, manholes, building foot shadow (Layer 2 overlays!)
    def _curb_s(cv):
        # South curb edge (sidewalk north of road) + concrete gutter grate
        cv.hline(0, 16, 11, col('concrete', 6))
        cv.hline(0, 16, 12, col('concrete', 4))
        cv.hline(0, 16, 13, col('concrete', 1))
        cv.hline(0, 16, 14, col('asphalt', 0))
        cv.hline(0, 16, 15, col('asphalt', 2))
        for x in (0, 8):
            cv.vline(x, 11, 14, col('concrete', 2))

    def _curb_n(cv):
        # North curb edge (sidewalk south of road)
        cv.hline(0, 16, 0, col('asphalt', 0))
        cv.hline(0, 16, 1, col('concrete', 6))
        cv.hline(0, 16, 2, col('concrete', 4))
        cv.hline(0, 16, 3, col('concrete', 2))

    def _curb_e(cv):
        cv.vline(12, 0, 16, col('concrete', 6))
        cv.vline(13, 0, 16, col('concrete', 4))
        cv.vline(14, 0, 16, col('concrete', 1))
        cv.vline(15, 0, 16, col('asphalt', 0))

    def _curb_w(cv):
        cv.vline(0, 0, 16, col('asphalt', 0))
        cv.vline(1, 0, 16, col('concrete', 6))
        cv.vline(2, 0, 16, col('concrete', 4))
        cv.vline(3, 0, 16, col('concrete', 2))

    add('mf-curb-s', '보도 남측 연석·측구', 'floor', 'flat', 1, 1, _curb_s, ('border',))
    add('mf-curb-n', '보도 북측 연석', 'floor', 'flat', 1, 1, _curb_n, ('border',))
    add('mf-curb-e', '보도 동측 연석', 'floor', 'flat', 1, 1, _curb_e, ('border',))
    add('mf-curb-w', '보도 서측 연석', 'floor', 'flat', 1, 1, _curb_w, ('border',))

    def _crosswalk_h(cv):
        for y in (2, 3, 7, 8, 12, 13):
            cv.hline(1, 15, y, col('white', 5))
            cv.hline(1, 15, y + 1, col('white', 3))

    def _crosswalk_v(cv):
        for x in (2, 3, 7, 8, 12, 13):
            cv.vline(x, 1, 15, col('white', 5))
            cv.vline(x + 1, 1, 15, col('white', 3))

    def _lane_h(cv):
        cv.rect(2, 7, 13, 9, col('yellow', 4))
        cv.hline(2, 13, 7, col('yellow', 5))

    def _lane_v(cv):
        cv.rect(7, 2, 9, 13, col('yellow', 4))
        cv.vline(7, 2, 13, col('yellow', 5))

    def _lane_dash_h(cv):
        cv.rect(3, 7, 13, 9, col('white', 4))

    def _stop_line(cv):
        cv.rect(0, 12, 16, 15, col('white', 5))

    def _tactile(cv):
        cv.rect(2, 2, 14, 14, col('yellow', 4))
        for y in range(4, 13, 3):
            for x in range(4, 13, 3):
                cv.p(x, y, col('yellow', 5))
                cv.p(x + 1, y + 1, col('yellow', 2))

    def _manhole(cv):
        for y in range(4, 12):
            for x in range(4, 12):
                d2 = (x - 7.5) ** 2 + (y - 7.5) ** 2
                if d2 <= 14.5:
                    cv.p(x, y, col('steel', 1 if d2 > 10 else (3 if (x + y) % 2 == 0 else 2)))

    def _drain_grate(cv):
        cv.outline_box(3, 5, 13, 11, col('steel', 1), col('steel', 0))
        for x in range(5, 12, 2):
            cv.vline(x, 6, 10, col('steel', 4))

    def _foot_shade(cv):
        # Soft top-3px solid dark contact edge for building south base
        cv.hline(0, 16, 0, col('ink', 0))
        cv.hline(0, 16, 1, col('ink', 1))
        for x in range(0, 16, 2):
            cv.p(x, 2, col('ink', 2))

    add('mf-mark-zebra-h', '횡단보도 가로', 'floor', 'flat', 1, 1, _crosswalk_h, ('mark',))
    add('mf-mark-zebra-v', '횡단보도 세로', 'floor', 'flat', 1, 1, _crosswalk_v, ('mark',))
    add('mf-mark-yellow-h', '황색 중앙선 가로', 'floor', 'flat', 1, 1, _lane_h, ('mark',))
    add('mf-mark-yellow-v', '황색 중앙선 세로', 'floor', 'flat', 1, 1, _lane_v, ('mark',))
    add('mf-mark-dash-h', '백색 차선 점선', 'floor', 'flat', 1, 1, _lane_dash_h, ('mark',))
    add('mf-mark-stop', '정지선', 'floor', 'flat', 1, 1, _stop_line, ('mark',))
    add('mf-floor-tactile', '노란 점자블록', 'floor', 'flat', 1, 1, _tactile, ('detail',))
    add('mf-floor-manhole', '철제 맨홀 뚜껑', 'floor', 'flat', 1, 1, _manhole, ('detail',))
    add('mf-floor-grate', '도로 배수구 그레이팅', 'floor', 'flat', 1, 1, _drain_grate, ('detail',))
    add('mf-shade-south', '건물 발치 그늘', 'shade', 'flat', 1, 1, _foot_shade, ('shade',))

    # Canal stone bank (2x1)
    def _canal_bank(cv):
        cv.rect(0, 0, 16, 16, col('stone', 3))
        cv.hline(0, 16, 0, col('stone', 6))
        cv.hline(0, 16, 1, col('stone', 5))
        cv.hline(0, 16, 2, col('stone', 1))
        cv.brick_wall(0, 3, 16, 14, ramp='stone', base_i=3, course_h=4, brick_w=6, seed=91)
        cv.hline(0, 16, 14, col('moss', 2))
        cv.hline(0, 16, 15, col('glass', 1))

    add('mf-bank-canal', '하천·운하 석축 둑', 'bank', 'solidfloor', 1, 1, _canal_bank, ('bank',))

    # Save ground PNGs & manifest
    gdir = os.path.join(OUT_ROOT, 'ground')
    os.makedirs(gdir, exist_ok=True)
    meta = []
    for gid, item in out.items():
        p = os.path.join(gdir, f'{gid}.png')
        item['im'].save(p)
        meta.append({k: v for k, v in item.items() if k != 'im'})
    json.dump({'tiles': meta}, open(os.path.join(gdir, 'manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    print(f'ground_tiles: generated {len(out)} tiles -> {gdir}')
    return out


if __name__ == '__main__':
    build_ground_tiles()
