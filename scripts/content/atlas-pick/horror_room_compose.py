#!/usr/bin/env python3
"""호러 2판 「기본 한 벌」 방 조립기 — 같은 방향 글자(A·B·C, pilot)의 조각만으로 방을 깔아 나란히 본다. 고르는 근거는 낱개가 아니라 이 방 그림이다.
  python3 scripts/content/atlas-pick/horror_room_compose.py                      # 방 셋 × 열(pilot A B C) → tiledata/atlas-pick/rooms-horror/
  python3 scripts/content/atlas-pick/horror_room_compose.py --cols A,B --rooms manor_hall
  python3 scripts/content/atlas-pick/horror_room_compose.py --page ~/claude-viz/horror-foundation.html   # 비교 페이지(자체완결, data URI)
  python3 scripts/content/atlas-pick/horror_room_compose.py --no-accent           # 2단계 연출 기물을 빼고 기본만

방 = 설계도(평면 문자열) + 한 벌(천장·벽면·바닥 slug, 구역별 바꿈) + 놓을 것 목록. 구조는 v5(tiledata/hand-interior/v5/room2.py)와 같은 문법:
  '#' 막힌 칸 → 천장 윗면 자동 타일(4×3 시트, 8px 사분면 규칙 — 절차서 3-a), 막힌 칸 바로 아래 두 줄 = 벽면(32×32 조각을 월드 좌표로 반복),
  그 밖 = 바닥(32×32 조각 반복). 벽면 밑 접촉 그림자·천장 밑 그늘·서쪽 벽 덩이 옆 5px 그림자는 조립기가 넣는다(조각에 그리지 않는다).
  놓을 것 (slug, x, y) = 조각 캔버스의 왼위 칸. 걸이(wall 층)는 벽면 칸에, 물체는 발 칸이 바닥에 오게. 그리는 순서: 바닥 덧칠 → 걸이 → 물체(아래 줄이 뒤) → 덮개.
열 글자 L 의 조각 = candidates-horror/<slug>/ 의 <작업자>-L.png (그 기물 담당 작업자 우선), pilot 열 = pilot-A.png 먼저, 없으면 *-A.png.
없는 조각: 벽면·바닥은 v5 조각으로 대신 깔고(「v5 대체」), 천장은 v5 식 띠, 물체·걸이는 점선 상자 — 방 그림 아래에 빠진 목록을 적는다.
어두운 판 = 어둠 덮개(바탕 0.24) + 촛불·창 빛 둘레만 밝게. 게임 안 어둠 연출을 켰을 때 방 모양이 남는지 본다."""
import argparse, base64, glob, io, json, os, re, sys
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import ROOT, BASE, atomic_write  # noqa

CAND = os.path.join(BASE, 'candidates-horror')
OUT = os.path.join(BASE, 'rooms-horror')
V5 = os.path.join(ROOT, 'tiledata/hand-interior/v5')
JOBS = os.path.join(BASE, 'jobs-horror.json')

# ── 방 설계도 ────────────────────────────────────────────────────────────────────────────────────────────────
ROOMS = {
    'manor_hall': dict(
        name='저택 복도', kit='manor', about='북쪽 알코브 오름 계단 + 긴 복도(러너) + 문 둘(하나 잠김) + 밤 창 + 남쪽 출구 둘(어둠으로 사라짐)',
        ceil='ceil_black', wall='wall_manor_damask', floor='floor_manor_plank',
        plan=['########################',
              '#######.......##########',
              '#######.......##########',
              '#......................#',
              '#......................#',
              '#......................#',
              '#......................#',
              '#......................#',
              '####..##########..######',
              '####..##########..######',
              '########################'],
        zones=[(7, 1, 13, 2, None, 'wall_wood_panel')],           # 계단 알코브 벽면 = 판벽
        runner=[(1, 5, 22, 6), (4, 7, 5, 9), (16, 7, 17, 9), (9, 3, 11, 4)],
        place=[('stairs_up_wood', 9, 1), ('candelabra_drip', 7, 2), ('candelabra_drip', 13, 2),
               ('door_wood', 3, 3), ('window_night', 6, 3), ('window_curtain', 15, 3), ('door_locked', 18, 3), ('window_night', 21, 3),
               ('moonlight_floor', 6, 5), ('moonlight_floor', 21, 5), ('grandfather_clock', 20, 4),
               ('table_wood', 1, 5), ('candle_table', 1, 5), ('chair_wood', 1, 6),
               ('exit_dark', 4, 8), ('exit_dark', 16, 8)],
        accent=[('portrait_eyes', 16, 3), ('doll_sitting', 22, 7)],
        lights=[(7.5, 2.4, 'fire'), (13.5, 2.4, 'fire'), (1.6, 5.2, 'fire'), (6.5, 4.0, 'moon'), (21.5, 4.0, 'moon')]),
    'gallery_room': dict(
        name='미술관 전시실', kit='gallery', about='북쪽 벽 액자 줄 + 가운데 전시 벽(두꺼운 칸막이) + 받침대·줄 울타리·관람 의자 + 남쪽 입구 기둥',
        ceil='ceil_plaster', wall='wall_gallery_white', floor='floor_gallery_wood',
        plan=['######################',
              '#....................#',
              '#....................#',
              '#....................#',
              '#....................#',
              '#.......######.......#',
              '#.......######.......#',
              '#....................#',
              '#....................#',
              '#....................#',
              '#....................#',
              '#########....#########',
              '#########....#########',
              '######################'],
        zones=[(8, 7, 13, 8, None, 'wall_gallery_grey')],          # 전시 벽 남면 = 구역 색
        runner=[(10, 8, 11, 12)],
        place=[('frame_landscape', 2, 1), ('plaque', 2, 2), ('frame_small', 6, 1), ('plaque', 6, 2), ('door_gallery', 10, 1),
               ('frame_landscape', 14, 1), ('plaque', 14, 2), ('frame_small', 18, 1), ('plaque', 18, 2),
               ('rope_barrier', 2, 3), ('rope_barrier', 14, 3),
               ('frame_landscape', 9, 7), ('frame_small', 12, 7),
               ('pedestal', 3, 8), ('pedestal', 18, 8), ('bench_gallery', 14, 9),
               ('pillar_marble', 9, 9), ('pillar_marble', 12, 9), ('exit_dark', 10, 11)],
        accent=[('portrait_eyes', 6, 1)],
        lights=[(10.5, 6.0, 'moon'), (4.0, 4.0, 'moon'), (17.0, 4.0, 'moon')]),
    'ward_room': dict(
        name='병원 병실', kit='ward', about='병상 셋·칸막이 커튼·링거 + 동쪽 세면실(1칸 칸막이 틈 문) + 쇠창살 창 + 남쪽 출구',
        ceil='ceil_plaster', wall='hosp_wall', floor='floor_hosp_linoleum',
        plan=['##################',
              '#...........#....#',
              '#...........#....#',
              '#...........#....#',
              '#................#',
              '#................#',
              '#................#',
              '#...........#....#',
              '#...........#....#',
              '######..##########',
              '######..##########',
              '##################'],
        zones=[(13, 1, 16, 8, 'hosp_floor', 'wall_hosp_tile')],   # 세면실 = 타일 바닥 + 타일 반벽
        runner=[],
        place=[('window_barred', 2, 1), ('window_barred', 7, 1), ('window_barred', 10, 1), ('door_hosp', 4, 1),
               ('iv_stand', 1, 2), ('hosp_bed', 2, 1), ('bedside_cabinet', 3, 3), ('hosp_bed', 5, 1), ('bedside_cabinet', 6, 3),
               ('hosp_screen', 8, 3), ('hosp_bed', 9, 1), ('bedside_cabinet', 10, 3), ('iv_stand', 11, 2),
               ('ward_sink', 14, 3), ('medicine_cabinet', 15, 2), ('ward_sink', 16, 3),
               ('hosp_chair', 3, 7), ('hosp_chair', 9, 7), ('exit_dark', 6, 9)],
        accent=[('wheelchair', 1, 7)],
        lights=[(2.5, 2.0, 'moon'), (7.5, 2.0, 'moon'), (10.5, 2.0, 'moon'), (14.5, 5.0, 'lamp')]),
    'manor_bedroom': dict(
        name='저택 침실', kit='manor', about='기둥 둘 + 닫집(썩은 천개) 침대 + 침대 하나 + 서랍장 — v35 표 규격 조각을 사람 크기와 함께 본다',
        ceil='ceil_black', wall='wall_manor_damask', floor='floor_manor_plank',
        plan=['##################',
              '#................#',
              '#................#',
              '#................#',
              '#................#',
              '#................#',
              '#................#',
              '#................#',
              '########..########',
              '########..########',
              '##################'],
        zones=[], runner=[(2, 5, 15, 6)],
        place=[('window_night', 3, 1), ('window_night', 12, 1), ('door_wood', 8, 1),
               ('pillar_stone', 1, 1), ('pillar_stone', 16, 1),
               ('canopy_bed_rot', 4, 2), ('bed_manor', 13, 2), ('dresser', 10, 2), ('bedside_cabinet', 6, 4),
               ('exit_dark', 8, 8)],
        accent=[],
        lights=[(3.5, 2.0, 'moon'), (12.5, 2.0, 'moon'), (8.5, 6.0, 'fire')]),
    'operating_room': dict(
        name='병원 수술실', kit='ward', about='수술대 둘 + 휠체어 + 병상 — v35 표 규격 조각',
        ceil='ceil_plaster', wall='hosp_wall', floor='floor_hosp_linoleum',
        plan=['##################',
              '#................#',
              '#................#',
              '#................#',
              '#................#',
              '#................#',
              '#................#',
              '######..##########',
              '######..##########',
              '##################'],
        zones=[], runner=[],
        place=[('window_barred', 3, 1), ('window_barred', 12, 1), ('door_hosp', 8, 1),
               ('operating_table', 5, 3), ('operating_table', 11, 3), ('hosp_bed', 2, 2), ('iv_stand', 8, 3),
               ('exit_dark', 6, 7)],
        accent=[('wheelchair', 14, 5)],
        lights=[(5.5, 3.5, 'lamp'), (11.5, 3.5, 'lamp')]),
}
COLS = ['pilot', 'A', 'B', 'C']
V5_FALLBACK = {   # 없는 벽면·바닥을 대신 까는 v5 조각
    'floor_manor_plank': 'floor:dplank', 'floor_manor_carpet': 'floor:casino', 'floor_checker': 'floor:check', 'floor_creaky': 'floor:dplank',
    'floor_gallery_wood': 'floor:plank', 'floor_gallery_stone': 'floor:marble', 'floor_hosp_linoleum': 'floor:grey', 'hosp_floor': 'floor:grey',
    'floor_stone': 'floor:flag', 'floor_dirt': 'floor:earth',
    'wall_manor_damask': 'wall:plaster', 'wall_manor_stripe': 'wall:plaster', 'wall_wood_panel': 'wall:logdark', 'wall_paper_torn': 'wall:plaster',
    'wall_paper_stain': 'wall:plaster', 'wall_gallery_white': 'wall:marblewall', 'wall_gallery_grey': 'wall:grey', 'hosp_wall': 'wall:plaster',
    'wall_hosp_tile': 'wall:ktile', 'wall_stone_block': 'wall:stone', 'wall_cellar_brick': 'wall:rubble',
}
CEIL_LIP = {'ceil_black': ((58, 40, 34), (92, 66, 52), (30, 22, 20)), 'ceil_plaster': ((150, 150, 150), (196, 194, 188), (74, 74, 80))}
W_RE = re.compile(r'^([a-z]{1,3}[0-9]{1,2}|pilot)-([A-Z])\.png$')

_items = None
def items():
    global _items
    if _items is None: _items = {i['slug']: i for i in json.load(open(JOBS, encoding='utf-8'))['items']}
    return _items

_v5 = None
def v5_piece(tid):
    global _v5
    if _v5 is None:
        m = json.load(open(os.path.join(V5, 'interior-meta.json'), encoding='utf-8'))
        _v5 = (Image.open(os.path.join(V5, 'interior-atlas.png')).convert('RGBA'), {o['id']: o for k in ('floors', 'walls') for o in m[k]})
    a = _v5[1][tid]['atlas']; return _v5[0].crop((a['x'], a['y'], a['x'] + a['w'], a['y'] + a['h']))

def find(slug, col):
    """열 col 의 조각 그림 경로(없으면 None)."""
    d = os.path.join(CAND, slug)
    if not os.path.isdir(d): return None
    files = {os.path.basename(f) for f in glob.glob(os.path.join(d, '*.png'))}
    if col == 'v35b':  # v35-B(감독자 검수 뒤 다시 그린 셋)가 있으면 그것, 없으면 v35 열과 같은 조각
        if 'v35-B.png' in files: return os.path.join(d, 'v35-B.png')
        col = 'v35'
    if col == 'v35':  # 표 규격 재작도(v35-A)가 있으면 그것, 없으면 v34 열과 같은 조각
        if 'v35-A.png' in files: return os.path.join(d, 'v35-A.png')
        col = 'v34'
    if col == 'v34':  # 3/4 재작도 후보가 있으면 그것, 없으면 pilot 열과 같은 조각
        if 'v34-A.png' in files: return os.path.join(d, 'v34-A.png')
        col = 'pilot'
    if col == 'pilot':
        if 'pilot-A.png' in files: return os.path.join(d, 'pilot-A.png')
        col = 'A'
    owner = items().get(slug, {}).get('worker')
    pref = f'{owner}-{col}.png'
    if pref in files: return os.path.join(d, pref)
    alt = sorted(f for f in files if W_RE.match(f) and W_RE.match(f).group(2) == col and not f.startswith('pilot'))
    return os.path.join(d, alt[0]) if alt else None

class Kit:
    """열 하나의 조각 모음 + 빠진 목록."""
    def __init__(self, col):
        self.col = col; self.cache = {}; self.missing = []; self.used = {}
    def get(self, slug):
        if slug not in self.cache:
            p = find(slug, self.col)
            self.cache[slug] = Image.open(p).convert('RGBA') if p else None
            if p: self.used[slug] = os.path.relpath(p, ROOT)
            elif slug not in self.missing: self.missing.append(slug)
        return self.cache[slug]

def analyse(plan):
    H = len(plan); W = max(len(r) for r in plan)
    g = [[(plan[y][x] if x < len(plan[y]) else '#') != '#' for x in range(W)] for y in range(H)]
    inn = lambda x, y: 0 <= x < W and 0 <= y < H and g[y][x]
    face = [[0] * W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            if g[y][x]:
                if not inn(x, y - 1): face[y][x] = 1
                elif face[y - 1][x] == 1: face[y][x] = 2
    return W, H, g, face, inn

def quad_auto(dst, sheet, cx, cy, same):
    """4×3 자동 타일 시트(3×3 덩이 + (3,0) 안쪽 모서리)를 칸 (cx,cy) 에 8px 사분면으로 붙인다. same(dx,dy) = 이웃이 같은 덩이인가."""
    for sx in (-1, 1):
        for sy in (-1, 1):
            h, v, d = same(sx, 0), same(0, sy), same(sx, sy)
            if h and v and not d: col, row = 3, 0
            else: col, row = (1 if h else 1 + sx), (1 if v else 1 + sy)
            qx, qy = (0 if sx < 0 else 8), (0 if sy < 0 else 8)
            q = sheet.crop((col * 16 + qx, row * 16 + qy, col * 16 + qx + 8, row * 16 + qy + 8))
            dst.alpha_composite(q, (cx * 16 + qx, cy * 16 + qy))

def fallback_ceiling(slug):
    """천장 조각이 없을 때 v5 식 띠를 4×3 시트 꼴로 만든다(속 짙은 검정 + 방 쪽 3px 테)."""
    lip, hi, lo = CEIL_LIP.get(slug, CEIL_LIP['ceil_black'])
    im = Image.new('RGBA', (64, 48)); px = im.load()
    for cy in range(3):
        for cx in range(3):
            for y in range(16):
                for x in range(16):
                    c = (22, 20, 26)
                    if cy == 0 and y <= 2: c = (lo, hi, lip)[y]
                    if cy == 2 and y >= 12: c = (lip, hi, lip, lo)[y - 12]
                    if cx == 0 and x <= 2: c = (lo, hi, lip)[x]
                    if cx == 2 and x >= 13: c = (lip, lip, lo)[x - 13]
                    px[cx * 16 + x, cy * 16 + y] = c + (255,)
    for y in range(16):
        for x in range(16):
            c = (22, 20, 26)
            if (x <= 2 and y <= 2): c = hi
            if (x >= 13 and y <= 2): c = lip
            if (x <= 2 and y >= 12) or (x >= 13 and y >= 12): c = hi if y == 13 else lip
            px[48 + x, y] = c + (255,)
    return im

def surface(kit, slug, notes):
    im = kit.get(slug)
    if im is None:
        fb = V5_FALLBACK.get(slug)
        if fb: notes.add(f'{slug}→v5 {fb}'); return v5_piece(fb)
        return Image.new('RGBA', (32, 32), (90, 0, 90, 255))
    return im

def mul(a, k):
    a[..., :3] = np.clip(a[..., :3].astype(np.float32) * k, 0, 255).astype(np.uint8)

def placeholder(w, h):
    im = Image.new('RGBA', (w, h)); d = ImageDraw.Draw(im)
    for i in range(0, w + h, 4): d.line([(i, 0), (i - h, h)], fill=(230, 60, 200, 70))
    d.rectangle([0, 0, w - 1, h - 1], outline=(230, 60, 200, 220))
    return im

def compose(room, col, accent=True):
    r = ROOMS[room]; kit = Kit(col); notes = set()
    W, H, g, face, inn = analyse(r['plan'])
    img = Image.new('RGBA', (W * 16, H * 16), (6, 6, 9, 255))
    def zone(x, y):
        f, w = r['floor'], r['wall']
        for x0, y0, x1, y1, ff, ww in r.get('zones', []):
            if x0 <= x <= x1 and y0 <= y <= y1: f, w = ff or f, ww or w
        return f, w
    # 바닥·벽면(월드 좌표 반복)
    for cy in range(H):
        for cx in range(W):
            if not g[cy][cx]: continue
            f, w = zone(cx, cy)
            if face[cy][cx]:
                t = surface(kit, w, notes); fy = (face[cy][cx] - 1) * 16
                img.paste(t.crop(((cx * 16) % t.width, fy, (cx * 16) % t.width + 16, fy + 16)) if t.width >= 16 else t, (cx * 16, cy * 16))
            else:
                t = surface(kit, f, notes); tw, th = t.width, t.height
                img.paste(t.crop(((cx * 16) % tw, (cy * 16) % th, (cx * 16) % tw + 16, (cy * 16) % th + 16)), (cx * 16, cy * 16))
    a = np.array(img)
    for cy in range(H):                    # 그늘: 천장 밑 2px, 벽면 밑 접촉 3px, 서쪽 벽 덩이 옆 5px
        for cx in range(W):
            if not g[cy][cx]: continue
            X, Y = cx * 16, cy * 16
            if face[cy][cx] == 1:
                mul(a[Y:Y + 1, X:X + 16], 0.62); mul(a[Y + 1:Y + 2, X:X + 16], 0.8)
            if not face[cy][cx] and cy > 0 and face[cy - 1][cx] == 2:
                for k, m in enumerate((0.58, 0.72, 0.86)): mul(a[Y + k:Y + k + 1, X:X + 16], m)
            if not inn(cx - 1, cy):
                for k in range(6): mul(a[Y:Y + 16, X + k:X + k + 1], 0.62 + 0.06 * k)
    img = Image.fromarray(a)
    # 천장 윗면 자동 타일(방에 닿는 막힌 칸 = 천장 띠, 이웃 판정은 막힌 칸 전부를 한 덩이로)
    cs = kit.get(r['ceil'])
    if cs is None: cs = fallback_ceiling(r['ceil']); notes.add(f"{r['ceil']}→v5 식 띠")
    for cy in range(H):
        for cx in range(W):
            if g[cy][cx]: continue
            if not any(inn(cx + dx, cy + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1)): continue   # 방에 닿지 않는 속 = 공허(검정 그대로)
            quad_auto(img, cs, cx, cy, lambda dx, dy, cx=cx, cy=cy: not inn(cx + dx, cy + dy))
    # 카펫 러너(자동 타일)
    cells = {(x, y) for x0, y0, x1, y1 in r.get('runner', []) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1) if inn(x, y)}
    if cells:
        rs = kit.get('carpet_runner')
        if rs is None:                                   # 빠진 러너 = 옅은 점선 칸
            for (x, y) in cells: img.alpha_composite(placeholder(16, 16), (x * 16, y * 16))
        else:
            for (x, y) in sorted(cells): quad_auto(img, rs, x, y, lambda dx, dy, x=x, y=y: (x + dx, y + dy) in cells)
    # 놓을 것
    plist = list(r['place']) + (list(r.get('accent', [])) if accent else [])
    order = {'decal': 0, 'wall': 1, 'object': 2, 'over': 3}
    draws = []
    for n, (slug, x, y) in enumerate(plist):
        it = items().get(slug, {'layer': 'object', 'cells': [1, 1]}); im = kit.get(slug)
        w, h = it['cells']
        if im is None: im = placeholder(w * 16, h * 16)
        yy = y
        if col in ('v35', 'v35b') and it['layer'] == 'object' and im.height != h * 16: yy = (y + h) - im.height / 16   # 규격 재작도는 캔버스 높이가 달라 발(아래 줄)을 옛 자리에 맞춘다
        draws.append((order.get(it['layer'], 2), (y + h) if it['layer'] == 'object' else y, n, x, yy, im))
    for _, _, _, x, y, im in sorted(draws, key=lambda d: d[:3]):
        img.alpha_composite(im, (x * 16, int(round(y * 16))))
    kit.notes = sorted(notes)
    return img, kit

def darken(img, room):
    a = np.array(img).astype(np.float32); H, W = a.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    k = np.full((H, W), 0.24, np.float32); warm = np.zeros((H, W), np.float32); cool = np.zeros((H, W), np.float32)
    for lx, ly, kind in ROOMS[room].get('lights', []):
        cx, cy = lx * 16, ly * 16; rad = {'fire': 64, 'moon': 44, 'lamp': 56}[kind]
        f = np.clip(1 - np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / rad, 0, 1) ** 1.4
        k += f * (0.75 if kind != 'moon' else 0.45)
        (cool if kind == 'moon' else warm)[...] += f
    k = np.clip(k, 0, 1.05)[..., None]
    tint = np.stack([1 + 0.10 * warm - 0.05 * cool, 1 + 0.02 * warm, 1 - 0.14 * warm + 0.10 * cool], -1)
    a[..., :3] = np.clip(a[..., :3] * k * tint, 0, 255)
    return Image.fromarray(a.astype(np.uint8))

def b64(im, scale):
    im = im.resize((im.width * scale, im.height * scale), Image.NEAREST); bio = io.BytesIO(); im.save(bio, 'PNG')
    return 'data:image/png;base64,' + base64.b64encode(bio.getvalue()).decode()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--cols', default=','.join(COLS)); ap.add_argument('--rooms', default=','.join(ROOMS))
    ap.add_argument('--no-accent', action='store_true'); ap.add_argument('--page')
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True); report = {}
    for room in a.rooms.split(','):
        for col in a.cols.split(','):
            img, kit = compose(room, col, accent=not a.no_accent)
            dark = darken(img, room)
            img.save(os.path.join(OUT, f'{room}-{col}.png')); dark.save(os.path.join(OUT, f'{room}-{col}-dark.png'))
            report[f'{room}/{col}'] = dict(missing=kit.missing, fallback=kit.notes, used=kit.used)
            print(f'{room}/{col}: 조각 {len(kit.used)} · 빠짐 {len(kit.missing)} · 대체 {len(kit.notes)}')
    atomic_write(os.path.join(OUT, 'report.json'), json.dumps(report, ensure_ascii=False, indent=1) + '\n')
    if a.page: page(a.page, a.rooms.split(','), a.cols.split(','), report)

def page(path, rooms, cols, report):
    """비교 페이지 — 위: 옛 연출 후보(1판) 몇 개의 밝은/어두운 맥락, 아래: 방마다 열(한 벌) 나란히."""
    it = items(); html = []
    html.append('<section><h2>1판: 연출 기물 위주(초상화·인형·핏자국…) — 바탕이 v5 빌린 조각이다</h2><div class="row">')
    for slug in ['portrait_eyes', 'doll_sitting', 'blood_pool', 'chandelier_fallen', 'wardrobe_ajar', 'hosp_bed']:
        d = os.path.join(CAND, slug); png = sorted(glob.glob(os.path.join(d, 'h[0-9]-A.png')))
        if not png: continue
        import horror_context as HX
        lit = HX.room(it[slug], Image.open(png[0]).convert('RGBA')); dk = HX.darkened(lit)
        both = Image.new('RGBA', (lit.width * 2 + 4, lit.height), (20, 18, 24, 255)); both.paste(lit, (0, 0)); both.paste(dk, (lit.width + 4, 0))
        html.append(f'<figure><img src="{b64(both, 2)}"><figcaption>{it[slug]["name"]} <small>{slug} · {os.path.basename(png[0])[:4]}</small></figcaption></figure>')
    html.append('</div></section>')
    for room in rooms:
        r = ROOMS[room]
        html.append(f'<section><h2>2판 한 벌 방: {r["name"]} <small>({r["kit"]})</small></h2><p>{r["about"]}</p>')
        seen = []
        for col in cols:
            rp = report[f'{room}/{col}']
            if col != 'pilot' and rp['used'] in seen:
                html.append(f'<p class="m">방향 {col}: 아직 이 방에 새로 들어온 조각이 없다(앞 열과 같은 그림이라 생략).</p>'); continue
            seen.append(rp['used']); lit = Image.open(os.path.join(OUT, f'{room}-{col}.png')); dk = Image.open(os.path.join(OUT, f'{room}-{col}-dark.png'))
            miss = ', '.join(rp['missing']) or '없음'; fb = ', '.join(rp['fallback']) or '없음'
            lab = '파일럿(감독자가 찍은 핵심 넷: 천장 윗면·벽면·바닥·문 + 창)' if col == 'pilot' else f'방향 {col} 한 벌'
            html.append(f'<div class="col"><h3>{lab}</h3><div class="pair"><img src="{b64(lit, 2)}"><img src="{b64(dk, 2)}"></div>'
                        f'<p class="m">조각 {len(rp["used"])}개 · <b>빠짐</b>(점선 상자) {len(rp["missing"])}: {miss}<br>v5 대체: {fb}</p></div>')
        html.append('</section>')
    doc = ('<!doctype html><meta charset="utf-8"><title>호러 2판 — 기본 한 벌</title><style>'
           'body{background:#16151a;color:#ddd;font:14px/1.5 sans-serif;margin:20px}h2{color:#f0d8a0;margin:28px 0 6px}h3{margin:10px 0 4px;color:#cfe}'
           'img{image-rendering:pixelated;display:block}.row{display:flex;flex-wrap:wrap;gap:12px}figure{margin:0}figcaption{font-size:12px;color:#aaa}'
           '.pair{display:flex;gap:10px;flex-wrap:wrap}.m{font-size:12px;color:#aaa;max-width:1400px}small{color:#888}.col{margin-bottom:18px}</style>'
           '<h1>호러 세트 2판 — 「기본」 먼저</h1><p>사용자: 「우선은 기본이 되어야 할 타일들을 만들어야 하지 않겠냐 … 이브나 마녀의 집 어떻게 만들었는지 생각해봐」. '
           '위는 1판 연출 후보(방 바탕은 v5 빌림), 아래는 2판 기본 조각으로 깐 방(왼쪽 밝은 방 · 오른쪽 어둠 덮개). 방향 A·B·C 는 작업자 후보가 들어오면 채워진다 — '
           '아직 없는 조각은 점선 상자, 없는 벽·바닥은 v5 로 대신 깔았다.</p>' + ''.join(html))
    os.makedirs(os.path.dirname(os.path.expanduser(path)), exist_ok=True)
    open(os.path.expanduser(path), 'w', encoding='utf-8').write(doc); print('page', path)

if __name__ == '__main__':
    main()
