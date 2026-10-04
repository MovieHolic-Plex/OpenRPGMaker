import sys, os, json, base64, io
import jpenv
import build_tokyo as B
from jpstreet import Kit
import numpy as np
from PIL import Image
from modern_style_bible_proof import K, Cv, RAMPS, hero, rgb

import argparse
_ap = argparse.ArgumentParser(description='시트·카탈로그를 굽고(bake_source.export) 파일로만 다시 읽은 키트로 검증한다: 픽셀 일치·팔레트·ACCESS·DOORBLOCK·DECOCLASH.')
_ap.add_argument('--no-people', action='store_true', default=True, help='행인 제외(기본·유일 모드)')
_ap.add_argument('--scenes', help='장면 PNG 를 저장할 폴더(눈 확인용, 생략하면 저장 안 함)')
_ap.add_argument('--html', help='viz HTML 저장 경로(생략하면 안 만듦)')
_ap.add_argument('--json', help='결과 요약 JSON 경로')
ARGS = _ap.parse_args()
import bake_source
# ───── 내보내기 (원본 make.py 는 build 만 읽어 836칸 시트를 썼다; 이식본은 최종 시트를 만드는 bake_source 를 그대로 호출한다) ─────
bake_source.export()
sheet = np.array(Image.open(f'{B.OUT}/jp_shopstreet16.png').convert('RGBA')); n = json.load(open(f'{B.OUT}/jp_shopstreet16.catalog.json'))['sheet']['count']
kit = Kit.load(B.OUT)      # 파일로만 다시 읽은 키트로 검증한다

# ───── 검증 1: 픽셀 동일 ─────
verify = []
for nm, spec in {**B.CANON, **B.NEW, **B.NEW3, **B.NEW4, **B.NEW5}.items():
    a = kit.render(kit.assemble(spec)); d = B.direct(spec)
    verify.append((nm, spec['n'], a.shape[0] // 16, bool(a.shape == d.shape and (a == d).all()), len({x for r in kit.assemble(spec)['cells'] for x in r if x})))
def direct_L(spec):
    a = kit.assemble_L(spec); n = a['n']; R = a['rows']; mm = B.direct(spec['main']); ww = B.direct(spec['wing']); k = spec['wing']['n']; d = spec.get('depth', 2)
    off = 0 if spec.get('side', 'L') == 'L' else n - k
    im = np.zeros((R * 16, n * 16, 4), np.uint8)
    def blit(arr, y, x):
        sub = im[y:y + arr.shape[0], x:x + arr.shape[1]]; mk = arr[..., 3] > 0; sub[mk] = arr[mk]
    for r in range(R - d, R):
        for c in range(n):
            if off <= c < off + k: continue
            nm = a['cells'][r][c]; blit(kit.cell(nm), r * 16, c * 16)
    blit(mm, (R - d) * 16 - mm.shape[0], 0); blit(ww, R * 16 - ww.shape[0], off * 16)
    if a.get('shadow'):
        from jpstreet import shade_rect; shade_rect(im, *a['shadow'], -1)
    return im
for nm, spec in B.LSPEC.items():
    a = kit.assemble_L(spec); img = kit.render(a); dd = direct_L(spec)
    verify.append((nm + ' (L)', a['n'], a['rows'], bool(img.shape == dd.shape and (img == dd).all()), len({x for r in a['cells'] for x in r if x})))
# ───── 검증 2: 팔레트 ─────
pal = {rgb(h) for r in RAMPS.values() for h in r}
used = {tuple(int(v) for v in p[:3]) for p in sheet.reshape(-1, 4) if p[3]}
off = used - pal
partial = int(((sheet[..., 3] > 0) & (sheet[..., 3] < 255)).sum())

PLACED = []
# ───── 장면 ─────
def street_scene(layout, ncols, base_rows, seed=0):
    R = base_rows + 11; W = ncols * 16; H = R * 16
    sc = Cv(W, H); walk = [['X'] * ncols for _ in range(R)]
    for y in range(H):
        for x in range(W): sc.P(x, y, K('garasu', 5 - y // 36))
    for x0, w0, h0 in ((0, 50, 70), (60, 34, 90), (170, 60, 60), (260, 44, 84), (330, 58, 66), (396, 44, 78), (470, 50, 80), (520, 40, 60)):
        if x0 + w0 > W: break
        yb = base_rows * 16 - 30
        sc.R(x0, yb - h0 + 10, w0, h0, K('tairu', 3)); sc.R(x0, yb - h0 + 10, w0, 2, K('tairu', 4))
        for j in range(yb - h0 + 18, yb + 10, 9):
            for i in range(x0 + 4, x0 + w0 - 4, 8): sc.R(i, j, 3, 4, K('tairu', 1))
    img = sc.a
    def put_cell(r, c, name):
        a = kit.cell(name); sub = img[r * 16:(r + 1) * 16, c * 16:(c + 1) * 16]; m = a[..., 3] > 0; sub[m] = a[m]
    def put_arr(r, c, a):
        sub = img[r * 16:r * 16 + a.shape[0], c * 16:c * 16 + a.shape[1]]; m = a[..., 3] > 0; sub[m] = a[m]
    rS = base_rows          # 인도 시작 행
    # 건물
    doors = []
    for spec, c0 in layout:
        asm = kit.assemble(spec); r0 = rS - asm['rows']; arr = kit.render(asm); put_arr(r0, c0, arr)
        for r in range(asm['rows']):
            for c in range(asm['n']): walk[r0 + r][c0 + c] = asm['walk'][r][c]
        doors += [(rS - 1, c0 + dc) for dc in asm['door_cols']]
    cw = [ncols // 2 - 1, ncols // 2, ncols // 2 + 1]                                   # 횡단보도 3칸(3m)
    for c in range(ncols):
        for r, nm in ((rS, 'sw_shade'), (rS + 1, 'sw'), (rS + 2, 'sw')): put_cell(r, c, kit.street[nm]); walk[r][c] = 'F'
        zb = c in cw; stp = c in (cw[0] - 1, cw[-1] + 1)
        rows_ = ('n', 'c', 'dash', 'c', 's')
        for k, kind in enumerate(rows_):
            if zb: nm = {'n': 'zeb_n', 'c': 'zeb_c', 'dash': 'zeb_c', 's': 'zeb_s'}[kind]
            elif stp and kind in ('n', 'c', 's') and not (c == cw[0] - 1 and k >= 3) and not (c == cw[-1] + 1 and k <= 1): nm = {'n': 'stop_n', 'c': 'stop_c', 's': 'stop_s'}[kind]
            else: nm = {'n': 'road_n', 'c': 'road_c', 'dash': 'road_dash', 's': 'road_s'}[kind]
            put_cell(rS + 3 + k, c, kit.street[nm]); walk[rS + 3 + k][c] = 'F'
        for r, nm in ((rS + 8, 'sw'), (rS + 9, 'sw'), (rS + 10, 'sw')): put_cell(r, c, kit.street[nm]); walk[r][c] = 'F'
    for c in range(ncols):
        if c in cw:
            put_cell(rS + 2, c, kit.street['tactile_dot']); put_cell(rS + 8, c, kit.street['tactile_dot']); continue
        put_cell(rS + 2, c, kit.street['guard']); walk[rS + 2][c] = 'S'
        put_cell(rS + 8, c, kit.street['guard']); walk[rS + 8][c] = 'S'
    def prop(name, r_base, c0):
        P = kit.props[name]; w_, h_ = P['w'], P['h']; r0_ = r_base - h_ + 1
        def clash(c):
            if c < 0 or c + w_ > ncols: return True
            for (dr, dc) in doors:
                if c <= dc <= c + w_ - 1 and dr <= r_base <= dr + 3: return True
            for (wid, nm, a0, a1, b0, b1) in PLACED:
                if wid == id(walk) and not (b1 < c or b0 > c + w_ - 1) and not (a1 < r0_ or a0 > r_base): return True
            return False
        for dlt in (0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6, 7, -7):
            if not clash(c0 + dlt): c0 += dlt; break
        else: print('NOPLACE', name, c0); return
        put_arr(r0_, c0, kit.prop_image(name)); PLACED.append((id(walk), name, r0_, r_base, c0, c0 + w_ - 1))
        for rr in range(h_):
            for cc in range(w_):
                if P['walk'][rr][cc] == 'S': walk[r0_ + rr][c0 + cc] = 'S'
    return sc, walk, doors, prop, put_cell

def add_wires(sc, walk):
    for (wid, nm, r0, r1, c0, c1) in PLACED:
        if wid == id(walk) and nm == 'utility_pole':
            x = c0 * 16 + 20 + 3; y = r0 * 16 + 12
            for k, off in enumerate((0, 3, 6)):
                for side, x_end in ((-1, -8), (1, sc.w + 8)):
                    x0, x1 = sorted((x, x_end))
                    for xx in range(x0, x1 + 1):
                        t = abs(xx - x) / max(abs(x_end - x), 1); yy = y + off + int(10 * t * t) - 1
                        sc.P(xx, yy, K('tekko', -2) if k < 2 else K('tekko', 0))
def hero_at(sc, c, r_bottom):  # r_bottom: 서 있는 칸의 맨 아래 행
    hero(sc, c * 16, (r_bottom + 1) * 16 - 24 - 2)

# 장면 1 (표준 5동)
lay1 = [(B.CANON['izakaya_tower'], 0), (B.CANON['konbini_block'], 6), (B.CANON['garage_flats'], 12), (B.CANON['shutter_office'], 17), (B.CANON['setback_shop'], 22)]
sc1, walk1, doors1, prop1, _ = street_scene(lay1, 28, 18)
rS = 18
prop1('vend_trio', rS + 1, 6); prop1('bike.sora', rS + 1, 15); prop1('vend_pair', rS + 1, 21)
prop1('signal', rS + 10, 11); prop1('roadsign', rS + 10, 18); prop1('utility_pole', rS + 10, 25)
prop1('bike.aka', rS + 10, 9)
add_wires(sc1, walk1); hero_at(sc1, 7, rS + 9)
# 접근 칸 검사
access_ok = all(walk1[r][c] == 'F' for r, c in doors1)
# 장면 2 (같은 칸만으로 다른 조합)
lay2 = [(B.NEW['narrow_shutter'], 0), (B.NEW['wide_konbini'], 4), (B.NEW['izakaya_alt'], 12), (B.NEW['garage_tall'], 19), (B.NEW['big_setback'], 24)]
sc2, walk2, doors2, prop2, _ = street_scene(lay2, 34, 15)
rS2 = 15
prop2('vend_pair', rS2 + 1, 2); prop2('bike.aka', rS2 + 1, 18); prop2('vend_trio', rS2 + 1, 23)
prop2('signal', rS2 + 10, 14); prop2('roadsign', rS2 + 10, 22); prop2('utility_pole', rS2 + 10, 30); prop2('bike.midori', rS2 + 10, 12)
add_wires(sc2, walk2); hero_at(sc2, 9, rS2 + 9)
access2 = all(walk2[r][c] == 'F' for r, c in doors2)

# ───── 장면 구성 ─────
def dusk(a):
    """규칙: 유채색(창 불빛·간판·자판기·노렌 천 등 발광/유색 물체)은 그대로, 무채 재질(벽·지붕·바닥·하늘·꺼진 유리)은 낮은 단으로."""
    a = a.copy(); from paint import post as _post
    glow = ('mado', 'kii', 'aka', 'daidai', 'midori', 'sora', 'murasaki', 'neonP', 'neonC', 'kon')
    for y in range(a.shape[0]):
        for x in range(a.shape[1]):
            if a[y, x, 3]:
                f = _post.fam(a, x, y)
                if f in glow: continue
                a[y, x, :3] = _post.step(a[y, x], -4 if f == 'garasu' and y < 150 else -3)
    return a

from jp import wires as _unused
def lane_scene(layout, ncols, base_rows):
    R = base_rows + 7; W = ncols * 16; H = R * 16; sc = Cv(W, H); walk = [['X'] * ncols for _ in range(R)]
    for y in range(H):
        for x in range(W): sc.P(x, y, K('garasu', 5 - y // 36))
    img = sc.a
    def put_cell(r, c, name):
        a = kit.cell(name); sub = img[r * 16:(r + 1) * 16, c * 16:(c + 1) * 16]; mk = a[..., 3] > 0; sub[mk] = a[mk]
    def put_arr(r, c, a):
        sub = img[r * 16:r * 16 + a.shape[0], c * 16:c * 16 + a.shape[1]]; mk = a[..., 3] > 0; sub[mk] = a[mk]
    rS = base_rows; doors = []
    for spec, c0 in layout:
        asm = kit.assemble_L(spec) if 'main' in spec else kit.assemble(spec); r0 = rS - asm['rows']; put_arr(r0, c0, kit.render(asm))
        for r in range(asm['rows']):
            for c in range(asm['n']): walk[r0 + r][c0 + c] = asm['walk'][r][c]
        doors += [(r0 + r, c0 + c) for r, c in asm.get('doors', [])] or [(rS - 1, c0 + dc) for dc in asm['door_cols']]
    for c in range(ncols):
        for r, nm in ((rS, 'lane_n'), (rS + 1, 'lane_c'), (rS + 2, 'lane_c'), (rS + 3, 'lane_s')): put_cell(r, c, kit.street[nm]); walk[r][c] = 'F'
        for r in (rS + 4, rS + 5): put_cell(r, c, kit.street['sw']); walk[r][c] = 'F'
        put_cell(rS + 6, c, kit.street['sw_shade']); walk[rS + 6][c] = 'F'
    def prop(name, r_base, c0):
        P = kit.props[name]; w_, h_ = P['w'], P['h']; r0_ = r_base - h_ + 1
        def clash(c):
            if c < 0 or c + w_ > ncols: return True
            for (dr, dc) in doors:
                if c <= dc <= c + w_ - 1 and dr <= r_base <= dr + 3: return True
            for (wid, nm, a0, a1, b0, b1) in PLACED:
                if wid == id(walk) and not (b1 < c or b0 > c + w_ - 1) and not (a1 < r0_ or a0 > r_base): return True
            return False
        for dlt in (0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6, 7, -7):
            if not clash(c0 + dlt): c0 += dlt; break
        else: print('NOPLACE', name, c0); return
        put_arr(r0_, c0, kit.prop_image(name)); PLACED.append((id(walk), name, r0_, r_base, c0, c0 + w_ - 1))
        for rr in range(h_):
            for cc in range(w_):
                if P['walk'][rr][cc] == 'S': walk[r0_ + rr][c0 + cc] = 'S'
    return sc, walk, doors, prop, rS

# 장면 A: 표준 5동(문 9종·일본식 도로)  — scene1
# 장면 B: 간판·마치야 — scene3
# 장면 C: L자 + 생활도로
lane_layout = [(B.LSPEC['L_office_cafe'], 0), (B.LSPEC['L_machiya_annex'], 7), (B.LSPEC['L_flats_lot'], 14)]
scl, walkl, doorsl, propl, rSl = lane_scene(lane_layout, 21, 17)
propl('vend_pair', rSl + 5, 6); propl('coin_p', rSl - 1, 9); propl('post_box', rSl - 1, 11); propl('nobori.aka', rSl - 1, 10)
propl('garbage_net', rSl + 5, 17); propl('curve_mirror', rSl - 1, 6)
propl('stop_sign', rSl + 5, 5); propl('utility_pole', rSl + 6, 17); propl('bike.sora', rSl + 5, 12); propl('pot', rSl + 5, 2); propl('bollard', rSl + 5, 13)
add_wires(scl, walkl); hero_at(scl, 9, rSl + 4)
accessl = all(walkl[r][c] == 'F' for r, c in doorsl)
# 장면 D: 간판·마치야
lay3 = [(B.NEW3['machiya_izakaya'], 0), (B.NEW3['sushi_bar'], 6), (B.NEW3['ramen_tower'], 11), (B.NEW3['bento_corner'], 18), (B.NEW3['sento_front'], 23)]
sc3, walk3, doors3, prop3, _ = street_scene(lay3, 30, 17)
rS3 = 17
prop3('vend_pair', rS3 + 1, 6); prop3('pot', rS3 + 1, 5); prop3('planter', rS3 + 1, 14); prop3('bench', rS3 + 1, 9); prop3('bollard', rS3 + 1, 22)
prop3('bike.sora', rS3 + 1, 1); prop3('signal', rS3 + 10, 12); prop3('roadsign', rS3 + 10, 19); prop3('utility_pole', rS3 + 10, 26)
add_wires(sc3, walk3); hero_at(sc3, 9, rS3 + 9)
access3 = all(walk3[r][c] == 'F' for r, c in doors3)
# 장면 E: RC 밀도
lay5 = [(B.NEW5['mansion_veranda'], 0), (B.NEW5['office_slide'], 7), (B.NEW5['mixed_tenant'], 12), (B.NEW5['slim_tower'], 19), (B.NEW['wide_konbini'], 23)]
sc6, walk6, doors6, prop6, _ = street_scene(lay5, 31, 17)
rS6 = 17
prop6('vend_trio', rS6 + 1, 9); prop6('bike_rack', rS6 + 1, 15); prop6('post_box', rS6 + 1, 5)
prop6('signal', rS6 + 10, 12); prop6('utility_pole', rS6 + 10, 28); prop6('roadsign', rS6 + 10, 4)
add_wires(sc6, walk6); hero_at(sc6, 8, rS6 + 9)
access6 = all(walk6[r][c] == 'F' for r, c in doors6)

def b64(im, scale=1):
    if isinstance(im, np.ndarray): im = Image.fromarray(im)
    if scale != 1: im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
    b = io.BytesIO(); im.save(b, 'PNG'); return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()
def on_bg(a, bg=(150, 142, 150)):
    im = Image.new('RGBA', (a.shape[1], a.shape[0]), bg + (255,)); im.alpha_composite(Image.fromarray(a)); return im
if ARGS.scenes:
    os.makedirs(ARGS.scenes, exist_ok=True)
    for nm_, s_ in (('scene_standard', sc1), ('scene_recombined', sc2), ('scene_signs', sc3), ('scene_lane_L', scl), ('scene_rc', sc6)):
        Image.fromarray(s_.a).save(f'{ARGS.scenes}/{nm_}.png')
    Image.fromarray(dusk(sc6.a)).save(f'{ARGS.scenes}/scene_dusk.png')
door_row = ''.join(f'<figure><img src="{b64(on_bg(kit.cell_arr_deco(k)), 3)}"><figcaption>{k.split(".")[1]}</figcaption></figure>' for k in kit.decos if k.startswith('door.'))
ok = all((access_ok, access3, accessl, access6))
nv = sum(1 for v in verify if v[3])
html = f'''<!doctype html><meta charset=utf-8><title>일본 상가 거리 타일셋</title>
<style>body{{background:#161a22;color:#dfe5ee;font:14px/1.5 system-ui,sans-serif;margin:0;padding:16px 24px;max-width:1000px}}h1{{margin:0 0 4px;font-size:20px}}h2{{margin:22px 0 6px;font-size:15px;border-bottom:1px solid #333b4a}}
img{{image-rendering:pixelated;display:block;max-width:100%}}.row{{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end}}figure{{margin:0}}figcaption{{font-size:11px;color:#9aa6b8}}.note{{color:#9aa6b8;font-size:12px}}</style>
<h1>일본 상가 거리 타일셋 jp_shopstreet16</h1>
<div class=note>16px · 3/4 정면 · 칸 {n}개 · 레시피 {nv}/{len(verify)} 직접 그림과 픽셀 일치 · 새 색 {len(off)}개 · 문 앞 접근 {'전부 통과' if ok else '실패 있음'} · 소품이 문 앞 가림 0건 · 창 가림 0건</div>
<h2>① 표준 5동 · 일본식 도로</h2><img src="{b64(Image.fromarray(sc1.a), 2)}">
<h2>② 간판·마치야</h2><img src="{b64(Image.fromarray(sc3.a), 2)}">
<h2>③ L자 건물 + 생활도로</h2><img src="{b64(Image.fromarray(scl.a), 3)}">
<h2>④ RC 건물 (베란다·미닫이창·옥상 설비)</h2><img src="{b64(Image.fromarray(sc6.a), 2)}">
<h2>⑤ 저녁 변형 (같은 칸, 낮은 단만 사용)</h2><img src="{b64(Image.fromarray(dusk(sc6.a)), 2)}">
<h2>⑥ 문 9종</h2><div class=row>{door_row}</div>'''
if ARGS.html: open(ARGS.html, 'w').write(html)
print('cells', n, 'verify', nv, '/', len(verify), 'off-palette', len(off), 'partial', partial, 'html KB', len(html) // 1024)
for v in verify:
    if not v[3]: print('MISMATCH', v)
print('ACCESS', access_ok, access3, accessl, access6)

def door_block_report(tag, walk, doors):
    bad = []
    for (wid, name, r0, r1, c0, c1) in PLACED:
        if wid != id(walk): continue
        for (dr, dc) in doors:
            if c0 <= dc <= c1 and dr <= r1 <= dr + 3: bad.append((name, dc))
    print(f'DOORBLOCK {tag}: {len(bad)}건', sorted(set(bad)))
    return bad
DOORBLOCK = {tag: len(door_block_report(tag, w_, d_)) for tag, w_, d_ in (('standard', walk1, doors1), ('signs', walk3, doors3), ('lane', walkl, doorsl), ('rc', walk6, doors6))}
_allr = {**B.CANON, **B.NEW, **B.NEW3, **B.NEW4, **B.NEW5}
_bad = [x for nm, sp in _allr.items() for x in B.lint_decos(nm, sp)]
print('DECOCLASH', len(_bad)); [print('  ', x) for x in _bad]
if ARGS.json:
    json.dump({'cells': n, 'recipesPixelMatch': nv, 'recipesTotal': len(verify), 'offPalette': len(off), 'partialAlpha': partial,
               'ACCESS': {'standard': bool(access_ok), 'signs': bool(access3), 'lane': bool(accessl), 'rc': bool(access6)},
               'DOORBLOCK': DOORBLOCK, 'DECOCLASH': len(_bad), 'DECOCLASH_items': [list(map(str, x)) for x in _bad],
               'mismatch': [list(map(str, v)) for v in verify if not v[3]]}, open(ARGS.json, 'w'), ensure_ascii=False, indent=1)
