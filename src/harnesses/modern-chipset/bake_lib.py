"""bake_tileset.py 의 보조 모듈 — 칸 사전(Sheet) · 번호 고정(pins) · 그림 자르기/패딩 · 도로 표시/그림자 칸 · 재조립 검증.

원칙: 새 그림을 그리지 않는다. 합격 PNG 를 16px 칸으로 자르고, 도로 표시·그림자는 compose_town 이 쓰던 코드(town_lib)를 그대로 불러
칸 단위 투명 오버레이로 굽는다. 칸 내용 해시 → 번호는 pins.json 이 고정한다(앞 번호 불변, 새 칸은 끝에 덧붙임).
"""
import hashlib, json, math, os
import numpy as np
from PIL import Image

T = 16

# 칸 통행 종류(pc) → (priority, passable, passage, 기본 층)
#   floor      불투명 땅(아래층, 걷는다)            solidfloor 불투명 땅인데 막힘(물·생울타리)
#   flat       투명 바닥 표시(2층, 걷는다)           solid  투명 배경 물체(위층, 막힘)
#   star       투명 배경 물체의 솟은 칸(위층, 걷는다, 사람 위에 그려짐)    blank  빈 칸
PC = {
    'floor': ('lower', True, 'passable', 'lower'),
    'solidfloor': ('lower', False, 'solid', 'lower'),
    'flat': ('lower', True, 'passable', 'upper'),
    'solid': ('upper', False, 'solid', 'upper'),
    'star': ('upper', True, 'star', 'upper'),
    'blank': ('lower', False, 'solid', 'lower'),
}


# ------------------------------------------------------------------ 그림 도구
def norm(im):
    """투명 화소의 RGB 를 0 으로(해시·비교가 안정되게). RGBA 복사본."""
    a = np.array(im.convert('RGBA'))
    a[a[:, :, 3] == 0] = 0
    return Image.fromarray(a, 'RGBA')


def alpha_box(im, thr=0):
    a = np.asarray(im.convert('RGBA'))[:, :, 3]
    ys, xs = np.nonzero(a > thr)
    if not len(xs): return None
    return (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)


def sprite_canvas(im):
    """소품·차량: 알파 bbox 로 자르고 밑변 정렬 + 좌우 가운데로 16 배수 캔버스에. 반환 (그림, 오프셋 dict)."""
    bb = alpha_box(im)
    if bb is None: return None, None
    crop = im.convert('RGBA').crop(bb); w, h = crop.size
    W, H = math.ceil(w / T) * T, math.ceil(h / T) * T
    pad_l = (W - w) // 2
    canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0)); canvas.paste(crop, (pad_l, H - h))
    return norm(canvas), dict(padLeft=pad_l, padRight=W - w - pad_l, padTop=H - h, srcBBox=list(bb), srcSize=list(im.size), trimmed=[w, h])


def building_canvas(im):
    """건물: 왼쪽 위 기준. 폭은 16 배수(아니면 오른쪽에 투명 패딩), 높이는 위쪽에 투명 패딩(밑변 = 발)."""
    im = im.convert('RGBA'); w, h = im.size
    W, H = math.ceil(w / T) * T, math.ceil(h / T) * T
    canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0)); canvas.paste(im, (0, H - h))
    return norm(canvas), dict(padLeft=0, padRight=W - w, padTop=H - h, srcSize=[w, h])


def cut(im):
    """16 배수 그림 → rows 개의 행, 각 행은 cols 개의 16x16 칸(RGBA)."""
    W, H = im.size
    assert W % T == 0 and H % T == 0, (W, H)
    return [[im.crop((x * T, y * T, x * T + T, y * T + T)) for x in range(W // T)] for y in range(H // T)]


def empty(cell):
    return not np.asarray(cell)[:, :, 3].any()


# ------------------------------------------------------------------ 칸 사전 + 번호 고정
class Sheet:
    """칸 사전. key = 내용 해시(+통행 종류) → 번호. pins(이전 굽기)에 있는 key 는 그 번호를 그대로, 새 key 는 끝에 덧붙인다."""
    def __init__(self, pins):
        self.pins = dict(pins.get('cells', {}))
        self.next_id = (max(self.pins.values()) + 1) if self.pins else 0
        self.cells = {}      # id -> RGBA 16x16
        self.info = {}       # id -> dict
        self.index = {}      # key -> id (이번 굽기에서 쓴 것)
        self.order = []      # 이번 굽기에서 처음 쓰인 순서의 id

    @staticmethod
    def key_of(cell, pc):
        return hashlib.sha1(np.asarray(cell).tobytes() + b'|' + pc.encode()).hexdigest()[:24]

    def add(self, cell, pc, label, role, desc, tags, cat):
        cell = norm(cell); key = self.key_of(cell, pc)
        if key in self.index: return self.index[key]
        if key in self.pins: tid = self.pins[key]
        else:
            tid = self.next_id; self.next_id += 1; self.pins[key] = tid
        assert tid not in self.cells, ('번호 충돌', tid, key)
        self.cells[tid] = cell; self.index[key] = tid; self.order.append(tid)
        self.info[tid] = dict(pc=pc, label=label, role=role, desc=desc, tags=list(tags), cat=cat)
        return tid

    def count(self): return len(self.cells)
    def used_max(self): return max(self.cells) if self.cells else -1


def provisional_count(sheet_keys, pins):
    """계획용: 지금까지 쓰인 key 집합의 크기."""
    return len(sheet_keys)


def load_pins(path):
    if os.path.exists(path): return json.load(open(path, encoding='utf-8'))
    return {'version': 1, 'cells': {}, 'tilesPerRow': None}


# ------------------------------------------------------------------ 시트 쓰기 / 읽기
def pick_tpr(count, prev_tpr=None, max_h=4096, start=48):
    """열 수 자동 선택: 이전 굽기의 열 수가 아직 들어가면 그대로(번호는 열 수와 무관하지만 시트 배치를 안정하게), 아니면 48 부터 16 씩."""
    def fits(tpr): return math.ceil(count / tpr) * T <= max_h
    if prev_tpr and fits(prev_tpr): return prev_tpr
    tpr = start
    while not fits(tpr): tpr += 16
    return tpr


def render_sheet(cells, count, tpr):
    rows = math.ceil(count / tpr)
    sheet = Image.new('RGBA', (tpr * T, rows * T), (0, 0, 0, 0))
    for tid, c in cells.items(): sheet.paste(c, ((tid % tpr) * T, (tid // tpr) * T))
    return sheet


def read_cell(sheet_img, tid, tpr):
    return sheet_img.crop(((tid % tpr) * T, (tid // tpr) * T, (tid % tpr) * T + T, (tid // tpr) * T + T))


def reassemble(kit, sheet_img, tpr):
    """시트 PNG + 킷 정의만으로 다시 조립한 RGBA(정규화). 아래층 칸 위에 윗층 칸을 올린다."""
    w, h = kit['width'], kit['height']
    out = Image.new('RGBA', (w * T, h * T), (0, 0, 0, 0))
    for y, row in enumerate(kit['rows']):
        for x in range(w):
            lo = row['tiles'][x]; up = (row.get('upperTiles') or [-1] * w)[x]
            if lo >= 0: out.paste(read_cell(sheet_img, lo, tpr), (x * T, y * T))
            if up >= 0:
                c = read_cell(sheet_img, up, tpr)
                region = out.crop((x * T, y * T, x * T + T, y * T + T))
                if empty(region): out.paste(c, (x * T, y * T))
                else:
                    region.alpha_composite(c); out.paste(region, (x * T, y * T))
    return norm(out)


def same_image(a, b):
    return a.size == b.size and np.array_equal(np.asarray(norm(a)), np.asarray(norm(b)))


# ------------------------------------------------------------------ 팔레트
def load_palette(path):
    cols = set()
    for line in open(path, encoding='utf-8'):
        line = line.split('//')[0].strip()
        if not line or line.startswith('@'): continue
        parts = line.split()
        if len(parts) >= 2 and parts[1].startswith('#') and len(parts[1]) == 7:
            cols.add(tuple(int(parts[1][i:i + 2], 16) for i in (1, 3, 5)))
    return cols


def off_palette(cell, pal):
    """칸의 보이는 화소(알파>0) 중 팔레트 밖 색 → {색: 화소 수}."""
    a = np.asarray(cell)
    vis = a[:, :, 3] > 0
    out = {}
    for r, g, b in a[vis][:, :3]:
        c = (int(r), int(g), int(b))
        if c not in pal: out[c] = out.get(c, 0) + 1
    return out
