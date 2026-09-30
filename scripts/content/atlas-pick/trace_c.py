#!/usr/bin/env python3
"""트레이싱 C — 손 도트 에셋 전량 출력 + 에셋만으로 장면 재조립.
  python3 scripts/content/atlas-pick/trace_c.py
출력: tiledata/atlas-pick/trace-c/{assets/<name>.pxg|.png, assets.json, sheet.png, scene.png, placements.json}"""
import json, os, shutil, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import trace_c_kit as K, trace_c_props as P
from trace_lib import Cv

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))
OUT = os.path.join(ROOT, 'tiledata/atlas-pick/trace-c')
PAL = os.path.join(ROOT, 'tiledata/atlas-pick/palette/modern3.pal')
FONT = os.path.join(ROOT, 'tiledata/atlas-pick/bakeoff/c-32px/work/Galmuri11.ttf')

# (이름, 함수, 종류, 밑그림, 반복방향, 통행 격자(행마다 문자열: . 걷기  X 막힘  v 차량만), 비고)
def G(w, h, rows=None, fill='X'):
    cw, ch = w // 32, h // 32
    return rows if rows else [fill * cw] * ch
L, R, Pp, S = 'L-r1-1', 'R-r1-2', 'P-r2-1/3', 'scene.png(C 장면)'
def warm(fn):
    """R 건물은 밑그림이 베이지 벽이다: conc(7단) 칸을 kinari(5단)로 다시 정한다(단 -2). 램프 지정만 바꾼다."""
    def g():
        from trace_lib import RID
        cv = fn(); m = cv.rp == RID['conc']
        cv.rp[m] = RID['kinari']; cv.tn[m] = (cv.tn[m] - 2).clip(0, 4)
        return cv
    return g


ASSETS = [
 ('roof_top', K.d_roof_top, '건물 조립', L, 'xy', None, '옥상 윗면'),
 ('roof_parapet', K.d_roof_parapet, '건물 조립', L, 'x', None, '난간 띠'),
 ('roof_parapet_w', warm(K.d_roof_parapet), '건물 조립', R, 'x', None, '난간 띠(베이지)'),
 ('roof_rail', K.d_roof_rail, '건물 조립', L, 'x', None, '옥상 철제 난간'),
 ('wall_tile', K.d_wall_tile, '건물 조립', L, 'xy', None, '타일 벽면'),
 ('win_plain', K.d_win_plain, '건물 조립', L, 'x', None, '창 칸(낮)'),
 ('win_lit', K.d_win_lit, '건물 조립', L, 'x', None, '창 칸(불 켜짐)'),
 ('side_face', K.d_side_face, '건물 조립', L, 'y', None, '오른쪽 옆면'),
 ('sf_side', K.d_sf_side, '상가 앞면', L, 'y', None, '1층 옆면'),
 ('sf_band', K.d_sf_band, '상가 앞면', L, 'x', None, '노란 간판 띠'),
 ('sf_glass', K.d_sf_glass, '상가 앞면', L, 'x', None, '편의점 유리(진열대)'),
 ('sf_door_auto', K.d_sf_door_auto, '상가 앞면', L, '-', None, '자동문'),
 ('sf_pillar', K.d_sf_pillar, '상가 앞면', L, '-', None, '기둥'),
 ('sf_noren', K.d_sf_noren, '상가 앞면', L, '-', None, '식당 노렌+나무문'),
 ('sign_vert', K.d_sign_vert, '상가 앞면', L, '-', None, '세로 간판(빈 판)'),
 ('wall_conc', warm(K.d_wall_conc), '건물 조립', R, 'xy', None, '콘크리트 벽면'),
 ('win_conc', warm(K.d_win_conc), '건물 조립', R, 'x', None, '창 칸'),
 ('win_balcony', warm(K.d_win_balcony), '건물 조립', R, 'x', None, '발코니 창'),
 ('side_conc', K.d_side_conc, '건물 조립', R, 'y', None, '어두운 옆면'),
 ('wall_conc_g', warm(K.d_wall_conc_g), '상가 앞면', R, 'x', None, '1층 벽(2칸 높이)'),
 ('ent_conc', warm(K.d_ent_conc), '상가 앞면', R, '-', None, '현관'),
 ('shutter', K.d_shutter, '상가 앞면', R, '-', None, '셔터'),
 ('rt_tank', P.d_rt_tank, '옥상 소품', Pp, '-', ['XX', 'XX'], '물탱크'),
 ('rt_ac', P.d_rt_ac, '옥상 소품', Pp, '-', None, '실외기'),
 ('rt_stair', P.d_rt_stair, '옥상 소품', Pp, '-', None, '계단실'),
 ('tree1', P.d_tree1, '가로 소품', Pp, '-', ['..', '..', 'XX'], '가로수 A(밑 줄기 칸만 막힘)'),
 ('tree2', P.d_tree2, '가로 소품', Pp, '-', ['..', '..', 'XX'], '가로수 B'),
 ('vend_red', P.d_vend_red, '가로 소품', Pp, '-', ['.', 'X'], '자판기 빨강'),
 ('vend_blue', P.d_vend_blue, '가로 소품', Pp, '-', ['.', 'X'], '자판기 파랑'),
 ('lamp', P.d_lamp, '가로 소품', Pp, '-', ['.', '.', 'X'], '가로등'),
 ('tlight', P.d_tlight, '가로 소품', Pp, '-', ['.', '.', 'X'], '신호등'),
 ('guardrail', P.d_guardrail, '가로 소품', Pp, 'x', ['X'], '가드레일'),
 ('taxi', P.d_taxi, '가로 소품', Pp, '-', ['vvvv', 'vvvv'], '택시'),
 ('manhole', P.d_manhole, '바닥', Pp, '-', ['.'], '맨홀(장식)'),
 ('shadow_wall', P.d_shadow_wall, '바닥', S, 'x', ['.'], '건물 밑 그림자(장식)'),
 ('shadow_tree', P.d_shadow_tree, '바닥', S, '-', ['..'], '나무 그림자(장식)'),
 ('shadow_car', P.d_shadow_car, '바닥', S, '-', ['....'], '차 그림자(장식)'),
 ('tactile', P.d_tactile, '바닥', S, 'x', ['.'], '점자블록 띠'),
 ('ground_sidewalk', P.d_ground_sidewalk, '바닥', S, 'xy', ['.'], '인도 블록'),
 ('ground_curb', P.d_ground_curb, '바닥', S, 'x', ['X'], '연석(인도→차도)'),
 ('ground_road', P.d_ground_road, '바닥', S, 'xy', ['v'], '차도'),
 ('ground_lane', P.d_ground_lane, '바닥', S, 'x', ['v'], '차선(파선)'),
 ('ground_crosswalk', P.d_ground_crosswalk, '바닥', S, 'y', ['.'], '횡단보도'),
]
WALK_DEFAULT = 'X'


def main():
    ad = os.path.join(OUT, 'assets'); os.makedirs(ad, exist_ok=True)
    cvs, meta = {}, []
    for name, fn, kind, under, rep, walk, note in ASSETS:
        cv = fn(); cvs[name] = cv
        cv.save_png(os.path.join(ad, name + '.png')); cv.emit_pxg(os.path.join(ad, name + '.pxg'))
        shutil.copyfile(PAL, os.path.join(ad, 'palette.pal'))
        cw, ch = cv.w // 32, cv.h // 32
        if walk is None: walk = [WALK_DEFAULT * cw] * ch
        assert len(walk) == ch and all(len(r) == cw for r in walk), (name, walk)
        meta.append(dict(name=name, kind=kind, note=note, size=[cv.w, cv.h], cells=[cw, ch], cellCount=cw * ch,
                         walk=walk, repeat=rep, tracedFrom=under,
                         opaquePx=int((cv.rp >= 0).sum())))
    json.dump(meta, open(os.path.join(OUT, 'assets.json'), 'w'), ensure_ascii=False, indent=1)

    # ---- 장면: 에셋만으로 조립 (밑그림 화소 읽지 않음) ----
    W, H = 512, 448
    sc = Cv(W, H)
    for y in range(H):
        for x in range(W): sc.px(x, y, 'conc', 5)
    place = []
    def put(name, x, y):
        sc.blit(cvs[name], x, y); place.append([name, x, y])
    def tiles(name, x0, y0, nx, ny):
        cw, ch = cvs[name].w, cvs[name].h
        for j in range(ny):
            for i in range(nx): put(name, x0 + i * cw, y0 + j * ch)
    # 바닥
    tiles('ground_sidewalk', 288, 232, 7, 1)
    tiles('ground_sidewalk', 0, 264, 16, 2)
    tiles('ground_curb', 0, 312, 16, 1)
    tiles('ground_road', 0, 344, 16, 1)
    tiles('ground_road', 0, 376, 16, 1)
    for x in range(0, W, 32):
        if not 384 <= x < 480: put('ground_lane', x, 378)
    tiles('ground_road', 0, 408, 16, 1); tiles('ground_road', 0, 440, 16, 1)
    for y in (344, 376, 408, 440): tiles('ground_crosswalk', 384, y, 3, 1)
    tiles('shadow_wall', 0, 264, 9, 1); tiles('shadow_wall', 288, 232, 6, 1)
    tiles('tactile', 0, 286, 16, 1)
    put('manhole', 56, 400)
    # R 건물 (뒤): 옥상 8..40, 난간 40..72, 창 3층, 1층 168..232
    tiles('roof_top', 288, 8, 6, 1); tiles('roof_parapet_w', 288, 40, 6, 1)
    for row, y in enumerate((72, 104, 136)):
        for c in range(3):
            put('win_balcony' if row == 1 else 'win_conc', 288 + c * 64, y)
    put('wall_conc_g', 288, 168); put('wall_conc_g', 320, 168)
    put('ent_conc', 352, 168); put('shutter', 416, 168)
    tiles('side_conc', 480, 72, 1, 3); tiles('side_conc', 480, 168, 1, 1); tiles('side_conc', 480, 200, 1, 1)
    put('roof_top', 480, 8); put('roof_parapet_w', 480, 40)
    put('rt_stair', 320, 8); put('rt_ac', 440, 8); put('rt_ac', 470, 8)
    # L 건물: 옥상 -24..72, 난간 72..104, 창 3층 104..200, 간판 띠 200, 상가 232..264
    tiles('roof_top', 0, -24, 9, 1); tiles('roof_top', 0, 8, 9, 1); tiles('roof_top', 0, 40, 9, 1)
    tiles('roof_parapet', 0, 72, 9, 1)
    for row, y in enumerate((104, 136, 168)):
        for c in range(4):
            put('win_lit' if (row, c) == (1, 2) else 'win_plain', c * 64, y)
    tiles('side_face', 256, 104, 1, 3); tiles('side_face', 256, 200, 1, 1)
    tiles('sf_band', 0, 200, 6, 1)
    for c in range(3, 4): put('win_plain', 192 + 0, 200)
    put('sf_side', 256, 232)
    put('sf_glass', 0, 232); put('sf_glass', 64, 232); put('sf_door_auto', 128, 232)
    put('sf_noren', 192, 232); put('sf_pillar', 224, 232)
    tiles('wall_tile', 192, 200, 0, 0)
    put('sign_vert', 260, 100)
    put('rt_tank', 28, 8)
    put('rt_ac', 140, 36); put('rt_ac', 180, 36); put('rt_ac', 220, 36)
    # 가로 소품 (foot 순)
    put('shadow_tree', 164, 292); put('shadow_tree', 378, 292); put('shadow_car', 142, 378)
    put('guardrail', 104, 281); put('guardrail', 136, 281)
    put('vend_red', 300, 226); put('vend_blue', 334, 226)
    put('tree1', 164, 210); put('tree2', 378, 210)
    put('lamp', 451, 210); put('tlight', 478, 214)
    put('taxi', 142, 344)
    sc.save_png(os.path.join(OUT, 'scene.png'))
    json.dump(place, open(os.path.join(OUT, 'placements.json'), 'w'), ensure_ascii=False)

    # ---- 시트: 종류별 줄, 이름표, 통행 표시 ----
    f = ImageFont.truetype(FONT, 11)
    Z = 2; pad = 8
    kinds = []
    for m in meta:
        if m['kind'] not in kinds: kinds.append(m['kind'])
    SW = 1500
    rows = []
    for k in kinds:
        items = [m for m in meta if m['kind'] == k]
        x = pad; y = 0; line = []; lines = []; lh = 0
        for m in items:
            w = m['size'][0] * Z + pad
            if x + w > SW: lines.append((line, lh)); line = []; x = pad; lh = 0
            line.append(m); x += w; lh = max(lh, m['size'][1] * Z)
        lines.append((line, lh)); rows.append((k, lines))
    height = pad
    for k, lines in rows:
        height += 22 + sum(lh + 22 + pad for _, lh in lines)
    sheet = Image.new('RGBA', (SW, height), (56, 60, 72, 255))
    d = ImageDraw.Draw(sheet); y = pad
    for k, lines in rows:
        d.text((pad, y), '■ ' + k, font=f, fill=(255, 255, 255, 255)); y += 22
        for line, lh in lines:
            x = pad
            for m in line:
                w, h = m['size'][0] * Z, m['size'][1] * Z
                # 바둑판 배경
                for gy in range(0, h, 8):
                    for gx in range(0, w, 8):
                        c = (74, 78, 92, 255) if (gx // 8 + gy // 8) % 2 == 0 else (66, 70, 84, 255)
                        d.rectangle([x + gx, y + gy, x + gx + 7, y + gy + 7], fill=c)
                im = Image.open(os.path.join(ad, m['name'] + '.png')).resize((w, h), Image.NEAREST)
                sheet.alpha_composite(im, (x, y))
                d.rectangle([x - 1, y - 1, x + w, y + h], outline=(150, 156, 176, 255))
                for j, r in enumerate(m['walk']):
                    for i, ch in enumerate(r):
                        if ch in 'Xv':
                            col = (255, 64, 64, 150) if ch == 'X' else (64, 160, 255, 130)
                            ov = Image.new('RGBA', (64, 64), col); sheet.alpha_composite(ov.resize((64, 64)), (x + i * 64, y + j * 64)) if False else None
                            over = Image.new('RGBA', (64 - 2, 64 - 2), col)
                            sheet.alpha_composite(over, (x + i * 64 + 1, y + j * 64 + 1)) if False else None
                            d.rectangle([x + i * 64 + 2, y + j * 64 + 2, x + i * 64 + 61, y + j * 64 + 61], outline=col[:3] + (255,), width=1)
                            d.text((x + i * 64 + 5, y + j * 64 + 3), ch, font=f, fill=col[:3] + (255,))
                d.text((x, y + h + 3), '%s %dx%d' % (m['name'], m['size'][0], m['size'][1]), font=f, fill=(230, 230, 240, 255))
                x += w + pad
            y += lh + 22 + pad
    sheet.convert('RGB').save(os.path.join(OUT, 'sheet.png'))
    print('assets', len(meta), 'scene', sc.w, sc.h)


if __name__ == '__main__':
    main()
