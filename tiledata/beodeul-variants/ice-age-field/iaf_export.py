# 빙하기 설원 필드 내보내기: parts/*.png + partmeta.json + parts.md, render-1x/2x, grid.json, compare-ref.png.
import os, json
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from iaf_base import Parts, ROOT
from iaf_meta import META
import iaf_pieces as A, iaf_props as B, iaf_ground as G
import iaf_props2 as Q, iaf_face2 as F2, iaf_auto2 as AU

HERE = os.path.dirname(os.path.abspath(__file__))


def face_sample():
    """빙하 윗면 1줄 + 앞면 5줄 + 발치 눈 1줄(48x112)."""
    gl, fm, tm, lip, bot = G.glacier_layer([0, 0, 0], [5, 5, 5], 3, seed=113)
    base = Image.new('RGBA', (48, 112))
    g = G.ground_snow()
    for y in (0, 48, 96): base.alpha_composite(g.crop((0, 0, 48, min(48, 112 - y))), (0, y))
    base.alpha_composite(gl.crop((0, 0, 48, 96)), (0, 0))
    return base


def piece_image(name):
    if name == 'glacier_cave': return A.glacier_cave(5)
    if name == 'icefall': return A.icefall(5)
    if name == 'ice_bridge': return A.ice_bridge(5)
    if name == 'ice_floe': return A.ice_floe('l', 1)
    if name == 'ice_floe_s': return A.ice_floe('s', 3)
    if name == 'face_icewall': return face_sample()
    if name == 'ground-snow': return G.ground_snow()
    if name == 'ground-ice': return G.ground_ice()
    if name == 'ground-glacier': return G.ground_glacier()
    if name == 'ground-packed': return G.ground_packed()
    if name == 'autotile-iceedge': return G.iceedge_sheet()
    if name == 'autotile-trail': return G.trail_sheet()
    if name == 'autotile-drift': return G.drift_sheet()
    if name == 'autotile-frozenpond': return AU.frozenpond_sheet()
    if name == 'autotile-snowridge': return AU.snowridge_sheet()
    if name == 'autotile-icepit': return AU.icepit_sheet()
    if name.startswith('face_icewall_'): return F2.face_variant_sample(name[len('face_icewall_'):])
    for mod in (A, B, Q):
        if hasattr(mod, name): return getattr(mod, name)()
    raise KeyError(name)


def _font():
    for p in ('/usr/share/fonts/truetype/nanum/NanumSquareB.ttf', '/usr/share/fonts/truetype/nanum/NanumGothic.ttf'):
        if os.path.exists(p): return ImageFont.truetype(p, 12)
    return None


def compare_ref(mine_path=None, prev_path=None):
    """보정 3차 비교 시트: 같은 2배로 [이전 판 | 새 판] — 달라진 곳만(언 호수 물가 = autotile-iceedge 새 판)."""
    mine = mine_path or os.path.join(HERE, 'render-1x.png')
    prev = prev_path or os.path.join(HERE, '_qa', 'prev-render-1x.png')
    A_ = Image.open(prev).convert('RGB'); B_ = Image.open(mine).convert('RGB')
    def crop(im, x, y, w=320, h=176): return im.crop((x, y, x + w, y + h)).resize((w * 2, h * 2), Image.NEAREST)
    spots = [('언 호수 서쪽 물가 — 옛 판 직선 둑 → 굽이진 둑·둥근 모서리', 120, 220), ('언 호수 북쪽 물가 · 다리 머리', 420, 200),
             ('언 호수 동쪽 물가', 760, 230), ('언 호수 남쪽 물가 · 쓰러진 표지', 300, 420),
             ('언 호수 남동 물가', 640, 400), ('호수 속 얼음 판(격자 흰 점 없앰)', 520, 300)]
    F = _font()
    o = Image.new('RGB', (1296, sum(176 * 2 + 18 for _ in spots)), (20, 20, 24)); d = ImageDraw.Draw(o); y = 0
    for lab, x, yy in spots:
        d.text((4, y + 1), '이전 — ' + lab, fill=(200, 200, 200), font=F); d.text((660, y + 1), '새 판 — ' + lab, fill=(240, 240, 240), font=F)
        o.paste(crop(A_, x, yy), (0, y + 16)); o.paste(crop(B_, x, yy), (656, y + 16)); y += 176 * 2 + 18
    o.save(os.path.join(HERE, 'compare-ref.png'))
    return o.size


def export(s, im, reach, dens, seen):
    Pq = Parts(HERE)
    for n, md in META.items():
        img = piece_image(n)
        pad = not (n.startswith('autotile-') or n.startswith('ground-') or n.startswith('face_icewall'))
        Pq.add(n, img, md['kind'], md['ko'], md['desc'], md['rules'], md.get('brows'), md.get('layer'), md.get('role'), pad=pad)
        if 'passable' in md: Pq.meta[n]['passable'] = md['passable']
    cnt = Pq.finish('빙하기 설원 필드 (ice-age-field)')
    im.convert('RGB').save(os.path.join(HERE, 'render-1x.png'))
    im.convert('RGB').resize((im.width * 2, im.height * 2), Image.NEAREST).save(os.path.join(HERE, 'render-2x.png'))
    g = s.walk_grid()
    json.dump({'w': s.W, 'h': s.H, 'tile': 16, 'rows': [''.join('.' if g[y, x] else '#' for x in range(s.W)) for y in range(s.H)],
               'legend': {'.': 'walkable', '#': 'blocked'}, 'entrance': list(s.marks['south_entrance']),
               'marks': {k: list(v) for k, v in s.marks.items()}, 'reach': reach,
               'glacier_top_last_row': list(s.GT), 'face_rows': list(s.FH),
               'walkable': int(g.sum()), 'reached': len(seen), 'empty_window': [dens[0], list(dens[1])], 'empty_mean': dens[2],
               'count': dict(s.count)}, open(os.path.join(HERE, 'grid.json'), 'w'), ensure_ascii=False)
    compare_ref()
    AU.check_autotile([('autotile-frozenpond 두껍게 언 연못(걷기)', AU.frozenpond_sheet()), ('autotile-snowridge 큰 눈 둔덕 능선(걷기)', AU.snowridge_sheet()),
                       ('autotile-icepit 얼음 구덩이 균열(막힘)', AU.icepit_sheet())], os.path.join(HERE, 'check-autotile.png'))
    return cnt
