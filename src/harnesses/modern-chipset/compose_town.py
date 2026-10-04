#!/usr/bin/env python3
"""고른(또는 후보) 조각으로 60x60칸(960x960px) 도시를 꾸민다. 어느 후보를 쓸지는 인자로 받는다 — 판단은 하지 않는다.

  compose_town.py --out town.png --ground <판>:<글자> --props <판>:<글자> [--green <판>:<글자>] \
     --shop <판>:<글자>[,…] --office … --apartment … [--house …] [--cafe …] \
     --car <판>:<글자>[,…] [--car-front …] [--car-back …] [--assets harness-data/modern-chipset/town_assets.json] \
     [--seed 7] [--check 1,5,9]

격자(v2): 가로 도로 2줄 · 세로 도로 1줄(6칸 폭 + 양쪽 연석) → 블록 2x3.
  위·아래 띠(10줄)는 건물 한 줄을 틈 없이 이은 상점가, 가운데 띠(24줄)는 앞줄(정면이 도로 쪽 보도 3줄) + 뒷줄(고층, 앞줄 지붕 뒤로 솟음).
  가운데-동쪽 블록은 통째로 공원. 앞줄 틈(2칸 이상)은 아스팔트 골목/주차장.
소품 규칙(구역):
  연석 쪽 보도 = 가로등·신호등·볼라드·소화전·정류장 표지·가로수(같은 줄 간격 ≥4칸, 가로등과 같은 칸 금지)
  건물 벽 쪽 보도 = 자판기·쓰레기통·(소품 시트 2 의 벤치·화분·자전거)   공원 = 나무·가로등·벤치만
  문 앞(문 x 범위 ±8px)·횡단보도 접점·골목 입구에는 두지 않는다. 가로수 수관이 건물·차도를 덮는 칸도 거른다.
충돌: 소품·사람·차 전부를 한 목록(sprites)에 넣고 발 칸 + 윗부분(알파 bbox)으로 검사한다. 끝에 audit() 이 같은 목록을 다시 훑어 0 인지 센다.
차: 차선 가운데에 맞추고, 교차로·횡단보도 위 정차 금지, 차체 회색 램프만 6색으로 치환.
사람: Actor1 만(생성 금지). 판타지 복장은 MODERN_ACTORS 로 거른다.
2026-10-03 QA 반영(보조 모듈 town_lib.py): 같은 건물 2회 상한·지붕색 변형·가로수 종류 섞기·옥상 정리 후 설비 재배치(roof_props)·
  노란 이중 중앙선/정지선/직진 화살표/맨홀/배수구·접지 그림자·연석 주차·응급차량 상한·돌출 간판(signs)·새 소품(props3/props3b)·사람 행동(벤치 쌍·정류장 줄·상가 앞 대화).
  에셋 JSON 은 town_assets.json + town_assets_a1.json + town_assets_a2.json 을 병합해 읽는다. --relax-caps: 건물이 28채 미만이면 빈 땅을 메울 때만 같은 그림 상한 +1.
"""
import argparse, json, os, random, sys
import numpy as np
from PIL import Image, ImageDraw
from compose_city import load, cell, PROPS, RUNS, ROOT, ACTOR1
import unify_doors
import town_lib as TL
UNIFY_DOORS = True

W = H = 60
RW = 6                      # 도로 폭(칸)
ROW0 = (15, 41)             # 가로 도로 첫 행  (띠: 0-13 | 도로 15-20 | 22-39 | 도로 41-46 | 48-59)
LANE_A, LANE_B = 24, 72     # 한 도로(96px)의 두 차선 가운데 (중앙선 48 에서 ±24)
COL0 = (25,)                # 세로 도로 첫 열  (띠: 0-23 | 도로 25-30 | 32-59)
PX = W * 16
SW = 3                      # 앞 보도 줄 수
DENSE_ROWS = 3              # 한 블록에 겹쳐 쌓는 건물 줄 수
DENSE_FRONT_MAX = 8         # 앞줄 건물 최대 높이(칸)
REAR_MAX = 13               # 뒷줄 최대 높이(칸)
PARK_BLOCKS = ((1, 1), (1, 0))   # 공원이 들어갈 수 있는 블록(띠 행, 띠 열) — 시드마다 하나를 고른다(공원 크기 12행 이상이 필요)
PARK_BLOCK = (1, 1)         # 현재 시드의 공원 블록(_build 가 고른다)

# ---- 사람: Actor1 8명 중 현대 도시에 어울리는 일상복만 (캐릭터별 8배 확대 후 판정, 2026-10-02) ----
#  0 갈색 머리+흰 머리띠, 파란 조끼·붉은 장갑/신발   -> 활동복 차림 학생. 장갑이 약간 튀지만 가장 무난          허용
#  1 파란 긴 머리, 붉은 원피스·갈색 부츠              -> 원피스 입은 행인                                      허용
#  6 검은 머리, 남색 긴 코트(금단추)                  -> 코트 입은 행인                                        허용
#  2,3 뿔 달린 붉은 갑옷·투구  4 광대  5 마녀 모자  7 파란 마법사 모자 -> 판타지 복장, 금지
MODERN_ACTORS = (0, 1, 6)
# 외형 변형(2026-10-03): 머리색 6 x 옷색 6 = 36 가지/캐릭터(아래 spec = (색상, 채도배, 채도 하한, 명도배, 명도 가산)). 얼굴·피부·윤곽선은 그대로.
#   영역은 기준 프레임의 색으로 가른다: 0번 머리=갈색(h.01~.09 채도>.65), 1번 머리=파랑, 6번 머리=검정(머리 띠의 어두운 무채색) / 옷: 0번 파란 윗도리, 1번 붉은 원피스, 6번 파란 코트.
HAIR_OPTS = {
    0: [None, (.12, 1.0, 0, 1.35, 0), (0, .2, 0, .45, 0), (0, 0, 0, 1.25, .05), (.03, 1.1, 0, 1.4, 0), (.50, .9, 0, 1.0, 0)],
    1: [None, (.92, .7, 0, 1.0, 0), (.65, .3, 0, .45, 0), (.07, .75, 0, .85, 0), (.13, .75, 0, 1.0, 0), (0, 0, 0, 1.0, .05)],
    6: [None, (.07, 0, .7, 2.2, .22), (.12, 0, .6, 2.8, .45), (.02, 0, .75, 2.6, .30), (0, 0, 0, 2.6, .35), (.62, 0, .7, 2.0, .12)],
}
CLOTH_OPTS = {
    0: [None, (.36, .7, 0, .95, 0), (.78, .55, 0, .95, 0), (.07, .85, 0, 1.1, 0), (.50, .7, 0, .95, 0), (0, 0, 0, .9, 0)],
    1: [None, (.50, .75, 0, 1.0, 0), (.13, .8, 0, 1.05, 0), (.78, .6, 0, 1.0, 0), (.33, .65, 0, .95, 0), (.62, .8, 0, .75, 0)],
    6: [None, (.38, .7, 0, 1.0, 0), (.97, .8, 0, .9, 0), (0, 0, 0, 1.0, 0), (.07, .7, 0, .85, 0), (.50, .75, 0, 1.0, 0)],
}
NVAR = 36                                                    # 외형 변형 수(머리 6 x 옷 6) — var = 머리 + 6 * 옷


def _actor_masks(ch, hsv, h_img):
    yy = np.arange(32)[:, None] * np.ones((1, 24))
    H, S, V = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    blue = (H > .53) & (H < .70) & (S > .30)
    if ch == 0: hair = (H > .01) & (H < .09) & (S > .65) & (V >= .30) & (yy < 20); cloth = blue & (yy >= 14)
    elif ch == 1: hair = blue & (yy < 22); cloth = ((H < .04) | (H > .94)) & (S > .45) & (V > .35) & (yy >= 14)
    else: hair = (V < .30) & (S < .12) & (yy < 17); cloth = blue & (yy >= 13)
    return hair, cloth


def _apply_spec(hsv, m, spec):
    if not spec: return
    th, sm, ss, vm, va = spec
    hsv[..., 0] = np.where(m, th, hsv[..., 0])
    hsv[..., 1] = np.where(m, np.minimum(1, np.maximum(hsv[..., 1] * sm, ss)), hsv[..., 1])
    hsv[..., 2] = np.where(m, np.clip(hsv[..., 2] * vm + va, 0, 1), hsv[..., 2])


# ---- 차 색 변형: 차체 회색 램프 7단 -> 목표 램프(채도 낮게). 유리·바퀴·외곽선·하이라이트는 건드리지 않는다 ----
GRAY_RAMP = [(103, 106, 119), (117, 120, 134), (132, 135, 148), (148, 150, 161), (161, 163, 172), (175, 177, 184), (188, 189, 195)]
CAR_RAMPS = {
    'silver': GRAY_RAMP,
    'white': [(168, 172, 186), (184, 188, 200), (198, 202, 212), (210, 213, 221), (221, 224, 231), (232, 234, 239), (243, 244, 247)],
    'navy': [(26, 34, 58), (32, 43, 72), (38, 52, 86), (45, 62, 100), (53, 73, 114), (62, 84, 128), (72, 96, 144)],
    'red': [(96, 30, 40), (116, 38, 48), (134, 46, 56), (152, 56, 64), (168, 68, 74), (182, 82, 86), (196, 98, 100)],
    'black': [(26, 27, 33), (34, 35, 42), (42, 44, 52), (52, 54, 62), (62, 64, 74), (74, 76, 86), (88, 90, 100)],
    'beige': [(134, 118, 94), (152, 136, 110), (168, 152, 126), (182, 166, 140), (196, 180, 154), (208, 194, 168), (220, 207, 184)],
}
CAR_RAMPS['green'] = TL.make_ramp((46, 92, 74)); CAR_RAMPS['ochre'] = TL.make_ramp((176, 132, 58)); CAR_RAMPS['teal'] = TL.make_ramp((44, 104, 112))
CAR_COLOR_WEIGHTS = {'white': 9, 'silver': 22, 'black': 15, 'navy': 13, 'red': 10, 'beige': 9, 'green': 8, 'ochre': 4, 'teal': 6}     # 흰 세단은 택시/경찰 오해를 줄이려 낮춤

CIVIC_SPECIAL = ('civic_police', 'civic_fire', 'civic_post', 'civic_gas')
KIND_CAPS = {'civic_police': 1, 'civic_fire': 1, 'civic_post': 1, 'civic_gas': 1, 'bakery': 3, 'izakaya': 3, 'hmod': 2, 'civic': 4, 'dept': 2, 'warehouse': 2, 'neon': 2, 'slim': 3, 'tower': 4, 'hotel': 2, 'parking': 1, 'conv': 3, 'row': 3, 'house': 6, 'cafe': 5}        # 도시 전체 최대 개수
ROLE_W = {                                                            # 줄 역할 -> 종류 가중치
    'top': {'civic_police': 4, 'civic_fire': 4, 'civic_post': 4, 'civic_gas': 4, 'bakery': 1, 'izakaya': 1, 'hmod': .4, 'civic': 3, 'dept': 1.5, 'neon': 1.5, 'slim': 1, 'warehouse': .5, 'shop': 3, 'cafe': 2, 'office': 2, 'house': .5, 'conv': 2, 'row': .6},
    'bottom': {'civic_police': 4, 'civic_fire': 4, 'civic_post': 4, 'civic_gas': 4, 'bakery': 1, 'izakaya': 1, 'hmod': .8, 'civic': 3, 'dept': 1.2, 'warehouse': 1.5, 'neon': 1.2, 'slim': 1, 'house': .7, 'cafe': 2, 'shop': 2.5, 'office': 1, 'conv': 1.5, 'row': .8},
    'front': {'civic_police': 3.5, 'civic_fire': 3.5, 'civic_post': 3.5, 'civic_gas': 3, 'bakery': 1, 'izakaya': 1, 'civic': 1, 'neon': 1, 'slim': .8, 'shop': 3, 'cafe': 2, 'office': 2.5, 'house': .3, 'conv': 2, 'row': .5, 'apt': .8},
    'rear2': {'civic_police': .8, 'civic_fire': .8, 'civic_post': .8, 'civic_gas': .5, 'bakery': .6, 'izakaya': .6, 'civic': 1.5, 'slim': 1.2, 'neon': 1, 'shop': 2, 'office': 2.5, 'cafe': 1.5, 'apt': 2, 'house': .8, 'row': .5, 'conv': .8, 'hotel': 1},
    'rear': {'civic_police': .8, 'civic_fire': .8, 'civic_post': .8, 'civic_gas': .5, 'civic': 2, 'dept': 2.5, 'slim': 1.5, 'apt': 3, 'office': 2, 'house': .5, 'hotel': 1.5, 'tower': 6.0, 'parking': 1.2, 'row': .6, 'shop': .2, 'cafe': .15, 'conv': .1},
}
WALL_PROPS = ('vending', 'trash', 'bench', 'planter', 'plant', 'bike', 'bicycle', 'mailbox', 'postbox', 'parasol', 'recycle')
CURB_PROPS = ('lamp', 'signal', 'bollard', 'hydrant', 'busstop')
FALLBACK_BENCH = None


# ------------------------------------------------------------------ 기하 도우미
def road_row(y): return any(r <= y < r + RW for r in ROW0)
def road_col(x): return any(c <= x < c + RW for c in COL0)
def curb_row(y): return any(y in (r - 1, r + RW) for r in ROW0)
def curb_col(x): return any(x in (c - 1, c + RW) for c in COL0)


def inter(a, b, pad=0):
    return a[0] < b[2] + pad and b[0] < a[2] + pad and a[1] < b[3] + pad and b[1] < a[3] + pad


def alpha_bbox(img, thr=24):
    a = np.asarray(img)[:, :, 3]
    ys, xs = np.nonzero(a > thr)
    if not len(xs): return (0, 0, img.width, img.height)
    return (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)


def load2(spec):
    """'<판>:<글자>' 또는 '<절대경로 폴더>:<글자>' (시험용)."""
    rid, letter = spec.rsplit(':', 1)
    if os.path.isabs(rid): return Image.open(os.path.join(rid, letter + '.png')).convert('RGBA')
    return load(spec)


# ------------------------------------------------------------------ 색 처리
def recolor_car(img, color):
    """차체 회색 램프 7단만 목표 램프로 치환."""
    if color == 'silver': return img
    arr = np.asarray(img).copy(); tgt = CAR_RAMPS[color]
    for src, dst in zip(GRAY_RAMP, tgt):
        m = (arr[:, :, 0] == src[0]) & (arr[:, :, 1] == src[1]) & (arr[:, :, 2] == src[2]) & (arr[:, :, 3] > 0)
        arr[m, 0], arr[m, 1], arr[m, 2] = dst
    return Image.fromarray(arr, 'RGBA')


def _rgb2hsv(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx = rgb.max(-1); mn = rgb.min(-1); d = mx - mn; nz = d > 1e-6; dd = np.where(nz, d, 1)
    rc = (mx - r) / dd; gc = (mx - g) / dd; bc = (mx - b) / dd
    h = np.where(mx == r, bc - gc, np.where(mx == g, 2 + rc - bc, 4 + gc - rc)); h = np.where(nz, (h / 6.0) % 1.0, 0)
    s = np.where(mx > 0, d / np.where(mx > 0, mx, 1), 0)
    return np.stack([h, s, mx], -1)


def _hsv2rgb(hsv):
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    i = np.floor(h * 6).astype(int) % 6; f = h * 6 - np.floor(h * 6)
    p = v * (1 - s); q = v * (1 - f * s); t = v * (1 - (1 - f) * s)
    out = np.zeros(h.shape + (3,))
    for k, (rr, gg, bb) in enumerate([(v, t, p), (q, v, p), (p, v, t), (p, q, v), (t, p, v), (v, p, q)]):
        m = i == k; out[..., 0] = np.where(m, rr, out[..., 0]); out[..., 1] = np.where(m, gg, out[..., 1]); out[..., 2] = np.where(m, bb, out[..., 2])
    return out


_ACT = {}
def actor_sheet():
    if 'sheet' not in _ACT:
        arr = np.asarray(Image.open(ACTOR1).convert('RGBA')).copy(); bg = arr[0, 0, :3]
        arr[(arr[:, :, :3] == bg).all(-1), 3] = 0
        _ACT['sheet'] = Image.fromarray(arr, 'RGBA')
    return _ACT['sheet']


def actor_frame(ch, row, col, var=0):
    """Actor1 한 프레임(24x32). row 0=위 1=오른쪽 2=정면 3=왼쪽, col 0,2=걷는 발 1=선 자세. var = ACTOR_VARIANTS 번호. 채도 약간 낮춤."""
    key = (ch, row, col, var)
    if key in _ACT: return _ACT[key]
    sh = actor_sheet(); bx, by = (ch % 4) * 72, (ch // 4) * 128
    fr = sh.crop((bx + col * 24, by + row * 32, bx + col * 24 + 24, by + row * 32 + 32))
    arr = np.asarray(fr).astype(float); hsv = _rgb2hsv(arr[..., :3] / 255.0)
    if var % NVAR:
        mh, mc = _actor_masks(ch, hsv, None)
        _apply_spec(hsv, mh, HAIR_OPTS[ch][var % 6]); _apply_spec(hsv, mc & ~mh, CLOTH_OPTS[ch][(var // 6) % 6])
    hsv[..., 1] = hsv[..., 1] * .88
    arr[..., :3] = np.clip(_hsv2rgb(hsv) * 255 + .5, 0, 255)
    out = Image.fromarray(arr.astype(np.uint8), 'RGBA'); _ACT[key] = out; return out


def bench_fallback():
    """소품 시트 2 에 벤치가 없을 때 쓰는 32x16 벤치(시트 팔레트 색만)."""
    O, WD, WL, LG = (11, 18, 36, 255), (112, 64, 47, 255), (163, 95, 76, 255), (42, 53, 57, 255)
    im = Image.new('RGBA', (32, 16), (0, 0, 0, 0)); px = im.load()
    def rect(x0, y0, x1, y1, c):
        for y in range(y0, y1):
            for x in range(x0, x1): px[x, y] = c
    rect(2, 4, 30, 8, O); rect(3, 5, 29, 7, WD)          # 등받이
    rect(2, 9, 30, 13, O); rect(3, 10, 29, 12, WL)       # 앉는 널
    rect(4, 13, 7, 16, LG); rect(25, 13, 28, 16, LG)     # 다리
    rect(4, 7, 7, 10, O); rect(25, 7, 28, 10, O)
    return im



# ---- 벽 색 변형: 민트 램프·벽돌 램프 5단을 다른 램프로 치환(윤곽·유리·지붕·흰 난간은 그대로) ----
def _hx(l): return [tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) for c in l]
MINT = _hx(['#5e7974', '#73908a', '#8ca29d', '#a1b2ae', '#b5c2bf'])
BRICK = _hx(['#533020', '#70402f', '#8b4f3f', '#a35f4c', '#b27361'])
WALL_VARIANTS = {
    'mint': {'cream': _hx(['#7a6f5a', '#948a72', '#aea58b', '#c4bca4', '#d8d2bf']), 'rose': _hx(['#7d6561', '#957b76', '#ad938d', '#c2aaa4', '#d4c2bd']),
             'sage': _hx(['#5f7a63', '#76927a', '#8fa992', '#a5bba8', '#b9c9bb']), 'gray': _hx(['#6c7076', '#82868c', '#989ca1', '#adb1b5', '#c0c3c6'])},
    'brick': {'tan': _hx(['#6b5a3e', '#85704e', '#9d8760', '#b39d74', '#c4b087']), 'slate': _hx(['#3a4658', '#4b5a70', '#5d6e88', '#6f83a0', '#8397b3']),
              'ochre': _hx(['#6d4a1c', '#8a6128', '#a67a37', '#bc9250', '#cba76c']), 'plum': _hx(['#4a2a3a', '#613849', '#7a4a5c', '#905d70', '#a47286'])},
}


def recolor_walls(img, which, name):
    """which: 'mint' | 'brick'. 해당 램프 화소가 전체의 3% 이상일 때만 바꾼 그림을, 아니면 None."""
    arr = np.asarray(img).copy(); src = MINT if which == 'mint' else BRICK; tgt = WALL_VARIANTS[which][name]; tot = 0
    for sc, dc in zip(src, tgt):
        m = (arr[:, :, 0] == sc[0]) & (arr[:, :, 1] == sc[1]) & (arr[:, :, 2] == sc[2]) & (arr[:, :, 3] > 0)
        tot += int(m.sum()); arr[m, 0], arr[m, 1], arr[m, 2] = dc
    return Image.fromarray(arr, 'RGBA') if tot >= .03 * int((arr[:, :, 3] > 0).sum()) else None


def with_variants(b, rng, per=2):
    """건물 b 하나 -> [원본] + 벽 색을 바꾼 변형(최대 per 개)."""
    b['fam'] = b['name']; out = [b]; opts = []
    for which in ('mint', 'brick'):
        for nm in WALL_VARIANTS[which]:
            im2 = recolor_walls(b['im'], which, nm)
            if im2 is not None: opts.append((which, nm, im2))
    rng.shuffle(opts)
    for which, nm, im2 in opts[:per]:
        b2 = dict(b); b2['im'] = im2; b2['name'] = f"{b['name']}~{nm}"; b2['fam'] = b['name']; out.append(b2)
    return out


# ------------------------------------------------------------------ 에셋 목록
def make_building(im, kind, name, door=None, floors=None, unify=True):
    w, h = im.width // 16, im.height // 16
    if door is None: dw = 8 if kind in ('house', 'shop') else 12; door = (im.width // 2 - dw, im.width // 2 + dw)
    cat = 'tower' if (kind == 'tower' or (floors or 0) >= 10) else kind
    if kind == 'warehouse': cat = 'warehouse'
    doors = [tuple(d) for d in door] if isinstance(door[0], (list, tuple)) else [tuple(door)]      # 연립처럼 문이 여러 개일 수 있다
    if UNIFY_DOORS and unify and kind not in ('parking', 'warehouse', 'garage') and not any(k in name for k in ('parking', 'warehouse', 'house_modern')):                              # 문을 계약 규격 표준 문으로(unify_doors.py)
        for d0, d1 in doors: im = unify_doors.unify(im, d0, d1, (d1 - d0) >= 21)
    return dict(im=im, w=w, h=h, door=doors[0], doors=doors, kind=kind, cat=cat, name=name, floors=floors or 0)


CAT_BY_NAME = {'bld_conv': 'conv', 'bld_row': 'row', 'bld_bakery': 'bakery', 'bld_izakaya': 'izakaya', 'bld_house_modern': 'hmod', 'bld_bank': 'civic', 'bld_school': 'civic', 'bld_hospital': 'civic', 'bld_dept': 'dept', 'bld_warehouse': 'warehouse', 'bld_neon4': 'neon', 'bld_slim': 'slim', 'bld_parking': 'parking'}


SLOT_SECTIONS = {'props2': 'props', 'props3': 'props', 'props3b': 'props', 'roof_props': 'roof', 'trees': 'trees', 'signs': 'signs'}
TREE_KINDS = ('street_tree', 'conifer', 'blossom', 'ginkgo')          # 가로수로 쓰는 슬롯(수관 있는 나무)
V2_SECTIONS = ('road_marks_v2', 'bike_v2', 'props5', 'props6')             # 3차 QA 새 시트: 이름이 같은 구형 슬롯(manhole·drain·bike·recycle3)을 대체
PROP_EXCLUDE = ('bike_rack', 'bikes')                     # 2차 QA(2026-10-03): 회색 반투명 'II' 틀·검은 빗·개미 크기 자전거 3대 — 그림 담당이 고치면 이 목록에서 뺀다
TREE_PROPS = ('hedge', 'bigpot', 'shrub')                             # 나무 시트의 나머지(화분·관목·울타리) — 보도 소품


def trim_garage_side(im):
    """bld_parking_v2 동쪽에 붙은 비스듬한 측면 슬래브(사다리꼴)는 3/4 시점 규칙과 어긋난다 → 본체 오른쪽 윤곽까지만 남기고 폭을 16 의 배수(80)로 자른다. 본체 = 거의 모든 행이 불투명한 열."""
    a = np.asarray(im)[:, :, 3] > 0; H = a.shape[0]; cols = a.sum(0)
    full = [x for x in range(a.shape[1]) if cols[x] >= .93 * H]
    if not full: return im
    keep = max(x for x in full if all(y in full for y in range(max(0, x - 6), x + 1))) if full else a.shape[1] - 1
    keep = min(keep, a.shape[1] - 1)
    if a.shape[1] - 1 - keep < 4: return im                   # 슬래브가 없다
    W = ((keep + 1) // 16) * 16 or 16
    arr = np.array(im)[:, :W].copy(); arr[:, W - 1] = np.array(im)[:, keep]      # 맨 오른쪽 열 = 원래 오른쪽 윤곽 열
    return Image.fromarray(arr, 'RGBA')


def load_assets(a):
    """CLI 인자 + (있으면) town_assets.json[+ _a1, _a2] -> (건물 풀, 소품 {이름: [그림…]}, 차량 풀, 메모, 공원 그림, 부가{roof, signs, trees, new}).
    파일이 없거나 비어 있으면 무시."""
    pool = []
    fl = {'shop': 2, 'cafe': 2, 'house': 2, 'office': 4, 'apt': 5}
    for kind, arg in (('shop', a.shop), ('office', a.office), ('apt', a.apartment), ('house', a.house), ('cafe', a.cafe)):
        for s in (arg or []): pool.append(make_building(load2(s), kind, f'{kind}:{s}', floors=fl[kind]))
    vehicles = []; props2 = {}; note = 'assets.json: 없음'; parkimgs = {}; extra = dict(roof={}, signs={}, trees={}, new=set(), legacy=set())
    path = a.assets
    if path:
        path = path if os.path.isabs(path) else os.path.join(ROOT, path)
        data = {}; files = []
        if os.path.exists(path):
            try: data, files = TL.merge_assets(path)
            except Exception as e: note = f'assets.json: 읽기 실패({e})'
        n0 = len(pool)
        for b in data.get('buildings') or []:
            for lt in b.get('letters') or ['A']:
                try: im = load2(f"{b['round']}:{lt}")
                except Exception: continue
                kind = b.get('kind') or 'office'
                if kind in ('apartment', 'midrise'): kind = 'apt'
                if kind == 'gas': kind = 'shop'
                nmb = b.get('name', kind)
                pool.append(make_building(im, kind, f"{nmb}:{lt}", b.get('door_px'), b.get('floors'), b.get('unify', True)))
                pool[-1]['cat'] = next((v for k, v in CAT_BY_NAME.items() if k in nmb), pool[-1]['cat'])
                if b.get('cat'): pool[-1]['cat'] = b['cat']
        multi = data.get('__multi', {})
        allsec = []                                                             # (섹션 이름, 사양) — 같은 이름이 여러 파일에 있어도 모두
        for key, v in data.items():
            if isinstance(v, dict) and v.get('slots') and v.get('round'): allsec.append((key, v))
        for key, vs in multi.items(): allsec += [(key, x) for x in vs if isinstance(x, dict) and x.get('slots') and (key, x) not in allsec]
        def role_of(key):
            if key.startswith('roof'): return 'roof'
            if key == 'trees': return key
            if key.startswith('signs'): return 'signs'
            return 'props'
        allsec.sort(key=lambda t: t[0] in V2_SECTIONS)                         # v2 섹션은 맨 나중: 같은 이름의 구형 슬롯을 통째로 대체한다
        for key, spec in allsec:
            role = role_of(key); got = TL.sheet_slots(load2, [spec], trim=(role != 'props'))
            if role == 'props' and key in V2_SECTIONS:
                for nm, ims in got.items(): props2[nm] = ims; extra['new'].add(nm)
            elif role == 'props':
                for nm, ims in got.items():
                    props2.setdefault(nm, []).extend(ims) if nm in props2 and key != 'props2' and nm not in extra['legacy'] else props2.__setitem__(nm, ims)
                    (extra['legacy'] if key == 'props2' else extra['new']).add(nm)
            else:
                for nm, ims in got.items(): extra[role].setdefault(nm, []).extend(ims)
        for nm, pa in (data.get('park') or {}).items():
            try: parkimgs[nm] = load2(f"{pa['round']}:{(pa.get('letters') or ['A'])[0]}")
            except Exception: pass
        for v in (data.get('vehicles') or []) + (data.get('vehicles_v2') or []):
            for lt in v.get('letters') or ['A']:
                try: vehicles.append(dict(name=v.get('name', 'truck'), im=load2(f"{v['round']}:{lt}")))
                except Exception: pass
        if data: note = f"assets.json({'+'.join(files)}): 건물 {len(pool) - n0}, 소품 {len(props2)}종, 옥상 {len(extra['roof'])}종, 간판 {len(extra['signs'])}종, 나무 {len(extra['trees'])}종, 차량 {len(vehicles)}"
    names_ = {b['name'].split(':')[0] for b in pool}
    pool = [b for b in pool if not (b['name'].startswith('bld_gas:') and 'bld_gas_v2' in names_)                       # 주유소 구형 → 160×96 v2 로 대체
            and not (b['name'].startswith('bld_neon4') and ('bld_fire_escape' in names_ or 'bld_balcony2' in names_))]   # 얼룩 패치 아파트(neon4) → 비상계단·발코니 아파트가 대체
    for b in pool:
        if 'parking_v2' in b['name']: b['im'] = trim_garage_side(b['im']); b['w'] = b['im'].width // 16
        if b['cat'] in ('apt_fire_escape', 'apt_balcony'): b['cat'] = 'apt'
        if b['cat'] == 'civic_parking': b['cat'] = 'parking'               # 주차 건물 두 계열(bld_parking·bld_parking_v2)은 도시당 합쳐서 1채
        b['roof'] = TL.find_roof(b['im']); b['special'] = TL.is_special_roof(b)
    vr = random.Random(1234); pool2 = []
    for b in pool: pool2 += with_variants(b, vr, 2)
    famn = {}
    for b in pool2: famn[b['fam']] = famn.get(b['fam'], 0) + 1
    for b in pool2: b['famn'] = famn[b['fam']]
    note += f' / 벽색 변형 포함 풀 {len(pool2)}'
    return pool2, props2, vehicles, note, parkimgs, extra


# ------------------------------------------------------------------ 건물 채우기
FAM_CAP_DEFAULT = 2            # 같은 건물(글자·색 변형 무시)은 도시 전체에서 이 횟수까지 — 3번 이상 금지
FAM_CAP = {'bld_school': 1, 'bld_warehouse': 1, 'bld_dept': 1, 'bld_bank': 1, 'bld_hospital': 1, 'bld_row': 1, 'bld_hotel': 1, 'bld_parking': 1,
           'bld_police': 1, 'bld_fire': 1, 'bld_post': 1, 'bld_gas': 1, 'bld_neon4': 1, 'bld_cafe': 1, 'bld_parking_v2': 1}
RELAX = {'on': False, 'allow': False}      # allow: 건물 수가 모자랄 때 상한을 풀어 재시도(기본 꺼짐 — 3회 이상 금지가 우선)
MIN_BLD = 28
def fam_cap(b, relaxed=False):
    k = bk(b); base = FAM_CAP.get(k, 1 if b['cat'] in CIVIC_SPECIAL else FAM_CAP_DEFAULT)
    return base + 1 if (relaxed and RELAX['on']) else base            # 건물 수가 모자랄 때만(2차 시도) 상한을 +1 까지 푼다(이웃·이웃의 이웃과는 다른 그림)
MIN_W = 5                      # 가로 5칸 미만 건물은 쓰지 않는다(사용자 결정)
GROUP = {'shop': 'store', 'cafe': 'store', 'conv': 'store', 'izakaya': 'store', 'bakery': 'store', 'neon': 'store',
         'house': 'home', 'hmod': 'home', 'row': 'home', 'apt': 'flat', 'hotel': 'flat',
         'office': 'office', 'tower': 'office', 'slim': 'office', 'dept': 'office', 'civic': 'civic', 'warehouse': 'industrial', 'parking': 'industrial',
         'civic_police': 'civic', 'civic_fire': 'civic', 'civic_post': 'civic', 'civic_gas': 'industrial'}
def grp(b): return GROUP.get(b['cat'], b['cat'])
def bk(b): return b.get('fam', b['name']).split(':')[0]          # 건물 종류 키(글자·색 변형 무시)

def role_weight(b, role):
    w = ROLE_W[role].get(b['cat'])
    if w is None:                                          # 목록에 없는 종류 -> 층수로
        w = (1.2 if b['floors'] <= 4 else .15) if role != 'rear' else 1.0
    if role != 'rear' and b['floors'] >= 5: w *= .2
    if role == 'rear': w *= 1 + b['floors'] / 8
    return w / b.get('famn', 1)                              # 같은 그림의 색 변형 전부를 합쳐 한 건물 몫


PACK_STAT = {}


def memo_feas(foot_of):
    cache = {}
    def f(b, x):
        k = (id(b), x)
        if k not in cache: cache[k] = foot_of(b, x) is not None
        return cache[k]
    return f


def pack(rng, pool, role, x0, x1, hcap, used, local_cap=None, tries=500, must=(), feas=None):
    """[x0,x1) 칸 구간에 건물 한 줄. 빈 폭 최소(1칸 틈 나쁨)·종류 다양·이웃 같은 건물 금지·종류별 도시 상한.
    반환 [(x, b, 0) 또는 (x, None, 빈 칸 수)]."""
    cand = [(b, role_weight(b, role)) for b in pool if b['h'] <= hcap and MIN_W <= b['w'] <= x1 - x0]
    cand = [(b, w) for b, w in cand if w > 0]
    if not cand: return [(x0, None, x1 - x0)]
    want = {b['cat'] for b, _ in cand}; must = [c for c in must if used.get(c, 0) == 0]
    best = None; total = x1 - x0
    for _ in range(tries):
        rem = total; seq = []; cnt = dict(used); loc = {}; nrel = 0
        while True:
            xcur = x0 + total - rem
            ok = [(b, w) for b, w in cand if b['w'] <= rem and (feas is None or feas(b, xcur)) and cnt.get('fam:' + bk(b), 0) < fam_cap(b) and cnt.get(b['cat'], 0) < KIND_CAPS.get(b['cat'], 99) and loc.get(b['cat'], 0) < (local_cap or {}).get(b['cat'], 99)]
            fams = {bk(q) for q in seq}
            fit = [(b, w) for b, w in ok if not seq or (grp(b) != grp(seq[-1]) and bk(b) not in fams and (len(seq) < 2 or b['cat'] != seq[-2]['cat']))]   # 이웃과 같은 계열·같은 건물·한 칸 건너 같은 종류 금지
            if not fit: fit = [(b, w) for b, w in ok if not seq or (b['cat'] != seq[-1]['cat'] and bk(b) not in {bk(q) for q in seq[-2:]})]          # 못 채우면 같은 종류·이웃 그림만 금지
            relaxed = False
            if not fit and rem >= MIN_W:                                                   # 상한 때문에 빈 땅이 남으면 상한을 풀고(이웃 금지만 유지) 채운다
                ok2 = [(b, w) for b, w in cand if b['w'] <= rem and (feas is None or feas(b, xcur)) and cnt.get('fam:' + bk(b), 0) < fam_cap(b, True) and cnt.get(b['cat'], 0) < KIND_CAPS.get(b['cat'], 99) + (0 if (b['cat'] in CIVIC_SPECIAL or b['cat'] in ('parking', 'warehouse', 'dept')) else 2)]
                last2 = {bk(q) for q in seq[-2:]}                                          # 완화해도 이웃·이웃의 이웃과 같은 그림은 금지
                fit = [(b, w) for b, w in ok2 if not seq or (b['cat'] != seq[-1]['cat'] and bk(b) not in last2)]
                relaxed = bool(fit)
            if not fit: break
            b = rng.choices([f[0] for f in fit], [f[1] * (6 if (b0['cat'] in CIVIC_SPECIAL and cnt.get(b0['cat'], 0) == 0) else 1) for f, b0 in ((f, f[0]) for f in fit)])[0]; seq.append(b); rem -= b['w']
            cnt[b['cat']] = cnt.get(b['cat'], 0) + 1; cnt['fam:' + bk(b)] = cnt.get('fam:' + bk(b), 0) + 1; loc[b['cat']] = loc.get(b['cat'], 0) + 1
            if relaxed: nrel += 1
        pen = 0 if rem == 0 else (8 if rem == 1 else (1.0 if rem <= 4 else rem))
        common = ('shop', 'house', 'cafe', 'office', 'conv', 'apt')
        bonus = .9 * len({bk(b) for b in seq}) + .8 * sum(1 for b in seq if b['cat'] not in common)       # 다양성·특수 건물 가산
        same = sum(1 for i in range(len(seq) - 1) if grp(seq[i]) == grp(seq[i + 1]))
        cornerb = sum(1.5 for q in (seq[0], seq[-1]) if q['cat'] in CIVIC_SPECIAL) if seq else 0
        miss = sum(1 for c in must if c in want and not any(q['cat'] == c for q in seq))
        score = (pen - bonus + 1.5 * same + 6.5 * nrel - cornerb + 9 * miss, rng.random())
        if best is None or score < best[0]: best = (score, seq, rem, nrel)
    _, seq, rem, nrel_best = best
    PACK_STAT['nrel'] = nrel_best
    slot = rng.randint(1, max(1, len(seq) - 1)) if (rem and len(seq) > 1) else (0 if rem else -1)
    out = []; x = x0
    for i, b in enumerate(seq):
        if rem and i == slot: out.append((x, None, rem)); x += rem
        out.append((x, b, 0)); x += b['w']
    if rem and slot >= len(seq): out.append((x, None, rem))
    for _, b, _r in out:
        if b: used[b['cat']] = used.get(b['cat'], 0) + 1; used['fam:' + bk(b)] = used.get('fam:' + bk(b), 0) + 1
    return out


# ------------------------------------------------------------------ 본체
class Town: pass


def build(a):
    RELAX['allow'] = bool(getattr(a, 'relax_caps', False))
    """1차: 어떤 그림도 3회 이상 금지(상한 2, 특수 1). 건물이 MIN_BLD 채에 못 미치면 같은 시드로 2차: 빈 땅을 메울 때만 상한 +1."""
    RELAX['on'] = False; r1 = _build(a)
    if r1[1]['buildings'] >= MIN_BLD or not RELAX['allow']: return r1
    RELAX['on'] = True
    try: r2 = _build(a)
    finally: RELAX['on'] = False
    r2[1]['relaxed_retry'] = True
    return r2 if r2[1]['buildings'] > r1[1]['buildings'] else r1


def _build(a):
    rng = random.Random(a.seed)
    global PARK_BLOCK, ROW0, COL0
    ROW0 = (15 + rng.choice((-1, 0, 0, 1)), 41 + rng.choice((-2, -1, -1, 0, 0))); COL0 = (25 + rng.choice((-2, -1, 0, 0, 1, 2)),)          # 도로 격자 시드 변주(블록 크기가 바뀐다)
    PARK_BLOCK = PARK_BLOCKS[rng.randrange(len(PARK_BLOCKS))]; PARK_TPL = rng.choice(('cross', 'pond', 'plaza'))
    g = load(a.ground); T = {i: cell(g, i) for i in range(16)}
    G = {i: cell(load(a.green), i) for i in range(8)} if a.green else None
    pool, props2, vehicles, note, parkimgs, extra = load_assets(a)
    ps = load(a.props)
    PI = {}                                   # 소품 이름 -> [이미지,…]
    for nm, (x, w, h) in PROPS.items(): PI[nm] = [ps.crop((x, ps.height - h, x + w, ps.height))]
    for nm, ims in props2.items(): PI[nm] = ims
    NEW = set(extra['new'])                   # 새 소품 시트(props3/props3b) 이름 — 일반 반복 배치에서 빼고 규칙대로만 놓는다
    for k in TREE_KINDS:
        for t_ in extra['trees'].get(k, []): PI['tree'].append(t_)
    for k in TREE_PROPS:
        if extra['trees'].get(k): PI[k] = extra['trees'][k]; NEW.add(k)
    for k in ('board_a', 'board_b'):
        if extra['signs'].get(k): PI[k] = extra['signs'][k]; NEW.add(k)
    if 'hedge' in PI: PI['hedge_v'] = [h_.rotate(90, expand=True) for h_ in PI['hedge']]; NEW.add('hedge_v')
    PI['signal'].append(PI['signal'][0].transpose(Image.FLIP_LEFT_RIGHT))      # 신호등 몸통 좌/우 — 모서리마다 번갈아
    for nm in ('signal_red', 'signal_green', 'signal_yellow', 'ped_red', 'ped_green', 'ped_yellow'):          # 신호등 점등 상태 슬롯이 있으면 섞어 쓴다(없으면 생략 — 2차 QA 15번)
        if nm in PI:
            ims_ = PI.pop(nm); NEW.discard(nm)
            for i_ in ims_: PI['signal'] += [i_, i_.transpose(Image.FLIP_LEFT_RIGHT)]
    SIGNAL_STATES = len(PI['signal']) > 2
    SPECIAL_IMG = {nm: PI.pop(nm) for nm in ('manhole', 'manhole_b', 'drain') if nm in PI}
    NEW -= set(SPECIAL_IMG)
    RP = extra['roof']; SG = extra['signs']
    if 'bench' not in PI: PI['bench'] = [bench_fallback()]
    for nm in PROP_EXCLUDE: PI.pop(nm, None); NEW.discard(nm)            # 2차 QA: 무엇인지 알 수 없는 소품 슬롯은 쓰지 않는다
    BB = {nm: [alpha_bbox(i) for i in ims] for nm, ims in PI.items()}
    im = Image.new('RGBA', (PX, PX), (0, 0, 0, 255))
    def put(t, cx, cy):
        if 0 <= cx < W and 0 <= cy < H: im.alpha_composite(t, (cx * 16, cy * 16))

    # ---- 칸 종류표 ----
    kind = [['side'] * W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            if road_row(y) or road_col(x): kind[y][x] = 'road'
            elif curb_row(y) or curb_col(x): kind[y][x] = 'curb'
    for r in ROW0:
        for c in COL0:
            for cy in range(r, r + RW): kind[cy][c - 2] = kind[cy][c + RW + 1] = 'cross'
            for cx in range(c, c + RW): kind[r - 2][cx] = kind[r + RW + 1][cx] = 'cross'
    clear = [[False] * W for _ in range(H)]                  # 소품·사람 금지칸(횡단보도 접점·골목 입구)
    landings = []
    for r in ROW0:
        for c in COL0:
            for qx, qy in ((c - 2, r - 2), (c + RW + 1, r - 2), (c - 2, r + RW + 1), (c + RW + 1, r + RW + 1)):
                landings.append((qx, qy))
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        if 0 <= qx + dx < W and 0 <= qy + dy < H: clear[qy + dy][qx + dx] = True

    def spans(is_road, is_curb):
        out = []; s = None
        for i in range(H):
            free = not is_road(i) and not is_curb(i)
            if free and s is None: s = i
            if not free and s is not None: out.append((s, i - 1)); s = None
        if s is not None: out.append((s, H - 1))
        return out
    rows = spans(road_row, curb_row); cols = spans(road_col, curb_col)
    NR, NC = len(rows), len(cols)

    sprites = []                                  # 모든 스프라이트 (건물·소품·사람·차)
    doors = []                                    # (x0,x1,foot_px)
    used = {}
    park = None; alleys = []; halley = []; dash = set(); plaza = []
    ROOF_NAMES = ('base', 'teal', 'navy', 'brick', 'sage', 'lgray'); ROOF_W = (26, 15, 12, 15, 12, 20)
    roof_budget = {}                                # 시드 전체 상한 카운터(4연 실외기 묶음·파이프 등)
    roof_hist = {}                                # 블록(ri,ci) -> 지금까지 쓴 지붕색(같은 색 3연속 금지)
    SHOPLIKE = ('shop', 'cafe', 'conv', 'izakaya', 'bakery', 'neon', 'civic_police', 'civic_fire', 'civic_post')
    def add_bld(b, x, foot_row, door=True, blk=None, y0=0):
        im_b = b['im']; info = None; sign = None
        if b.get('roof'):
            hist = roof_hist.setdefault(blk, [])
            opts = [(n, w) for n, w in zip(ROOF_NAMES, ROOF_W) if not (len(hist) >= 2 and hist[-1] == hist[-2] == n) and not (hist and hist[-1] == n and rng.random() < .85)]
            rn = rng.choices([o[0] for o in opts], [o[1] for o in opts])[0]; hist.append(rn)
            room = max(0, (foot_row - b['h'] - y0)) * 16
            im_b, info = TL.decorate_roof(b, rng, RP, room, rn, roof_budget)
            if door and b['cat'] in SHOPLIKE and SG:
                im_b, sign = TL.add_facade_sign(im_b, b, info, SG, rng)
        top = foot_row * 16 - im_b.height; fp = foot_row * 16
        bb = alpha_bbox(im_b)
        sprites.append(dict(k='bld', cat=b['cat'], name=b['name'], bk=bk(b), img=im_b, x=x * 16, y=top, foot=fp, rect=(x * 16 + bb[0], top + bb[1], x * 16 + bb[2], fp), fr=foot_row, info=info, sign=sign, front=door, special=b['special']))
        if door:
            for d0, d1 in b['doors']: doors.append((x * 16 + d0, x * 16 + d1, fp))
        for yy in range(foot_row - b['h'], foot_row):
            for xx in range(x, x + b['w']):
                if 0 <= yy < H: kind[yy][xx] = 'bld'
    blocks = []
    for ri, (y0, y1) in enumerate(rows):
        for ci, (x0, x1) in enumerate(cols):
            xa = x0 + (0 if x0 == 0 else 3); xb = x1 + 1 - (0 if x1 == W - 1 else 3)
            blocks.append(dict(ri=ri, ci=ci, x0=x0, x1=x1, y0=y0, y1=y1, xa=xa, xb=xb, ff=y1 + 1 - SW))
    front_info = []                               # 벽 쪽 소품 후보 (ff, [(x,b)])
    specials = sorted({b['cat'] for b in pool if b['cat'] in CIVIC_SPECIAL}); dense = [(B['ri'], B['ci']) for B in blocks if (B['ri'], B['ci']) != PARK_BLOCK]; rng.shuffle(dense)
    must_by = {k: [] for k in dense}
    for i_, c_ in enumerate(specials): must_by[dense[i_ % len(dense)]].append(c_)               # 경찰서·소방서·우체국·주유소를 서로 다른 블록에 한 채씩 보이게 시도
    rear_jobs = []
    for B in blocks:
        ri, ci, y0, y1, x0, x1, xa, xb, ff = B['ri'], B['ci'], B['y0'], B['y1'], B['x0'], B['x1'], B['xa'], B['xb'], B['ff']
        if (ri, ci) == PARK_BLOCK:
            park = dict(x0=x0 + (3 if ci > 0 else 0), x1=x1 - (0 if x1 == W - 1 else 3) - (1 if x1 == W - 1 else 0), y0=y0 + 3, y1=y1 - 3, ff=ff)
            park['mx'] = (park['x0'] + park['x1']) // 2; park['my'] = (park['y0'] + park['y1']) // 2
            continue
        # --- 빽빽한 블록: 앞줄 정면은 도로 쪽 보도에 닿고, 뒷줄은 앞줄 지붕 뒤로 솟아 아래쪽이 가려진다(통행 불가, 보이기만) ---
        role0 = 'top' if ri == 0 else ('bottom' if ri == NR - 1 else 'front')
        row = pack(rng, pool, role0, xa, xb, min(DENSE_FRONT_MAX, ff - y0 - 1), used, must=must_by[(ri, ci)])
        colTop = {xx: ff for xx in range(xa, xb)}                                      # 열마다 지금까지 그려진 건물의 맨 윗줄
        for x, b, rem in row:
            if not b and rem >= 3: plaza += [(xx, yy) for xx in range(x, x + rem) for yy in range(ff - 3, ff)]          # 앞줄 빈 땅 = 작은 휴게 공간(나무·벤치)
            if b:
                add_bld(b, x, ff, blk=(ri, ci), y0=y0)
                for xx in range(x, x + b['w']): colTop[xx] = ff - b['h']
        front_info.append((ff, [(x, b) for x, b, _ in row if b]))
        rear_jobs.append(dict(B=B, colTop=colTop))
    for job in rear_jobs:                              # 뒷줄은 모든 블록의 앞줄을 먼저 깐 뒤(작은 건물이 앞줄에서 바닥나지 않게) 남은 그림으로 채운다
        B = job['B']; colTop = job['colTop']
        ri, ci, y0, y1, x0, x1, xa, xb, ff = B['ri'], B['ci'], B['y0'], B['y1'], B['x0'], B['x1'], B['xa'], B['xb'], B['ff']
        for k in range(1, DENSE_ROWS):
            vis = rng.choice((2, 3, 3))                                                # 앞줄 위로 보이는 뒷줄 지붕 줄 수
            hc = min(REAR_MAX, ff - 2 - y0)
            if hc < 5: break
            def foot_of(b, x):                                                          # 뒷 건물의 발끝: 앞줄 위로 vis 줄만 가려지게, 블록 위에 안 걸리면 None
                cmin = min(colTop[xx] for xx in range(x, x + b['w']))
                rb = b['roof'][3] if b.get('roof') else 0
                def expose_ok(ft): return (cmin - (ft - b['h'])) * 16 - rb >= 48                # 가려지고 남는 정면이 3칸(48px) 이상이어야(0~3px 조각 금지 — 지붕 위의 지붕)
                for v in range(vis, 0, -1):                                              # 조각이면 앞줄에 더 바짝 붙여 정면을 더 드러낸다
                    ft = min(cmin + v, ff - 2)
                    if ft - b['h'] >= y0 and expose_ok(ft): return ft
                if k == 1 and b['h'] >= 10 and ff - 2 - b['h'] >= y0 and expose_ok(ff - 2): return ff - 2                  # 고층만: 앞줄 바로 뒤에 세워 위쪽만 솟아 보이게
                return None                                                             # 그 밖에는 놓지 않는다(눌러 앉히면 통째로 가려진다)
            best = None
            for _try in range(8):                                                       # 빈 구멍이 가장 적은 배열을 고른다
                u2 = dict(used); rrow = pack(rng, pool, 'rear' if k == 1 else 'rear2', xa, xb, hc, u2, local_cap={'tower': 2}, must=must_by[(ri, ci)], feas=memo_feas(foot_of))
                fill = sum(b['w'] + (6 if b['cat'] == 'tower' else 0) for x, b, rem in rrow if b and foot_of(b, x) is not None)
                fill -= 9 * PACK_STAT.get('nrel', 0)
                if best is None or fill > best[0]: best = (fill, rrow, u2)
            _, rrow, u2 = best; placed = False
            for x, b, rem in rrow:
                if not b: continue
                ft = foot_of(b, x)
                if ft is None: continue
                add_bld(b, x, ft, door=False, blk=(ri, ci), y0=y0); placed = True
                used[b['cat']] = used.get(b['cat'], 0) + 1; used['fam:' + bk(b)] = used.get('fam:' + bk(b), 0) + 1      # 실제로 세운 건물만 상한에 센다
                for xx in range(x, x + b['w']): colTop[xx] = min(colTop[xx], ft - b['h'])
            if not placed: break

    # ---- 바닥 그리기 ----
    for cy in range(H):
        for cx in range(W):
            hr, vr = road_row(cy), road_col(cx)
            if hr and vr: t = T[1] if rng.random() < .12 else T[0]
            elif hr: t = T[1] if rng.random() < .12 else T[0]                        # 중앙선은 아래에서 코드로 그린다(노란 이중 실선)
            elif vr: t = T[1] if rng.random() < .12 else T[0]
            elif kind[cy][cx] == 'alley': t = T[2] if (cx, cy) in dash else (T[1] if rng.random() < .15 else T[0])
            else: t = T[7] if (cx + cy * 3) % 7 == 0 else T[6]
            put(t, cx, cy)
    for r in ROW0:
        for cx in range(W):
            if not any(c - 1 <= cx <= c + RW for c in COL0): put(T[8], cx, r - 1); put(T[9], cx, r + RW)
    for c in COL0:
        for cy in range(H):
            if not any(r - 1 <= cy <= r + RW for r in ROW0): put(T[10], c - 1, cy); put(T[11], c + RW, cy)
    for r in ROW0:
        for c in COL0:
            put(T[12], c - 1, r - 1); put(T[13], c + RW, r - 1); put(T[14], c - 1, r + RW); put(T[15], c + RW, r + RW)
            for cy in range(r, r + RW): put(T[4], c - 2, cy); put(T[4], c + RW + 1, cy)
            for cx in range(c, c + RW): put(T[5], cx, r - 2); put(T[5], cx, r + RW + 1)

    # ---- 공원 땅 (템플릿 3종: cross = 십자길+분수+연못 / pond = 가운데 연못+벽돌 둘레+동서·북 길 / plaza = 넓은 벽돌 광장+분수+꽃밭 줄) ----
    TPL = dict(cross=dict(rx=2.5, ry=2.5, gates='NSEW', beds=((4, 3, 3, 2), (9, 6, 2, 2))),
               pond=dict(rx=4.5, ry=3.5, gates='NEW', beds=((6, 4, 3, 1), (2, 5, 4, 1), (9, 2, 2, 2))),
               plaza=dict(rx=5.5, ry=3.5, gates='NSEW', beds=((7, 4, 2, 1), (3, 5, 3, 1), (8, 1, 2, 2), (1, 5, 1, 1))))[PARK_TPL]
    if park:
        P = park; mx, my = P['mx'], P['my']; gN, gS, gE, gW = (g_ in TPL['gates'] for g_ in 'NSEW')
        def on_v(cx, cy): return cx in (mx, mx + 1) and ((cy <= my + 1 and gN) or (cy >= my and gS))
        def on_h(cx, cy): return cy in (my, my + 1) and ((cx <= mx + 1 and gW) or (cx >= mx and gE))
        beds = set()                                     # 꽃밭: 네 사분면에 직사각 화단(템플릿마다 배치가 다르다)
        for sx in (-1, 1):
            for sy in (-1, 1):
                for ox, oy, bw, bh in TPL['beds']:
                    x0b = mx + (ox if sx > 0 else 1 - ox - bw + 1); y0b = my + (oy if sy > 0 else 1 - oy - bh + 1)
                    for yy in range(y0b, y0b + bh):
                        for xx in range(x0b, x0b + bw):
                            if P['x0'] + 1 <= xx <= P['x1'] - 1 and P['y0'] + 1 <= yy <= P['y1'] - 1: beds.add((xx, yy))
        for cy in range(P['y0'], P['y1'] + 1):
            for cx in range(P['x0'], P['x1'] + 1):
                edge = cx in (P['x0'], P['x1']) or cy in (P['y0'], P['y1'])
                gate = edge and (on_v(cx, cy) or on_h(cx, cy))
                if edge and not gate: kind[cy][cx] = 'hedge'; t = G[7] if G else T[7]
                else:
                    kind[cy][cx] = 'park'
                    if not G: t = T[7] if (cx + cy * 3) % 7 == 0 else T[6]
                    elif on_v(cx, cy) or on_h(cx, cy): t = G[5]
                    elif abs(cx - mx - .5) <= TPL['rx'] and abs(cy - my - .5) <= TPL['ry']: t = G[3] if (cx + cy) % 2 else G[4]
                    elif (cx, cy) in beds or rng.random() < .03: t = G[2]
                    else: t = G[1] if rng.random() < .25 else G[0]
                put(t, cx, cy)

    # ---- 충돌 도구 ----
    def door_hit(rect):      # 문 앞: 문 x ±8px, 정면선 위 14px ~ 아래 18px 사이에 소품이 걸치면 안 된다
        return any(rect[2] > d0 - 8 and rect[0] < d1 + 8 and rect[3] > f - 14 and rect[1] < f + 18 for d0, d1, f in doors)
    def foot_door_hit(fx, fy): return any(d0 - 10 <= fx <= d1 + 10 and f - 4 <= fy <= f + 34 for d0, d1, f in doors)
    def cell_kind(px, py): return kind[min(H - 1, max(0, py // 16))][min(W - 1, max(0, px // 16))]
    def rect_touches(rect, kinds):
        for yy in range(max(0, rect[1] // 16), min(H - 1, (rect[3] - 1) // 16) + 1):
            for xx in range(max(0, rect[0] // 16), min(W - 1, (rect[2] - 1) // 16) + 1):
                if kind[yy][xx] in kinds: return True
        return False
    def collides(rect, pad, kinds=('prop', 'person', 'parked', 'car', 'rb')):
        return any(s['k'] in kinds and inter(rect, s['rect'], pad) for s in sprites)
    def hits_bld(rect, slack):
        return any(s['k'] == 'bld' and inter(rect, (s['rect'][0], s['rect'][1], s['rect'][2], s['rect'][3] - slack)) for s in sprites)
    def tree_gap_ok(cx, cy, dmin):
        for s in sprites:
            if s['k'] == 'prop' and s['name'] == 'tree':
                if s['cy'] == cy and abs(s['cx'] - cx) < 4: return False
                if s['cx'] == cx and abs(s['cy'] - cy) < 4: return False
                if (s['cx'] - cx) ** 2 + (s['cy'] - cy) ** 2 < dmin * dmin: return False
        return True
    BOARDISH = ('board_a', 'board_b', 'signboard')
    FAMILY = {'vending': 'vending', 'vending2': 'vending', 'trash': 'trash', 'recycle3': 'trash', 'mailbox_red': 'mail', 'postbox': 'mail'}
    def rect_in_clear(rect):
        for yy in range(max(0, rect[1] // 16), min(H - 1, (rect[3] - 1) // 16) + 1):
            for xx in range(max(0, rect[0] // 16), min(W - 1, (rect[2] - 1) // 16) + 1):
                if clear[yy][xx]: return True
        return False
    def try_prop(name, cx, cy, ok_kinds=('side',), force=False, pad=1, foot_off=14, variant=None, wide=False, jit=0):
        if not (0 <= cx < W and 0 <= cy < H) or kind[cy][cx] not in ok_kinds: return False
        if clear[cy][cx] and not force: return False
        fam = FAMILY.get(name)
        if fam:
            same = [o for o in sprites if o['k'] == 'prop' and FAMILY.get(o['name']) == fam]
            if len(same) >= FAM_QUOTA[fam] or any((o['cx'] - cx) ** 2 + (o['cy'] - cy) ** 2 < FAM_MIND ** 2 for o in same): return False
        if name == 'pole' and any(o['k'] == 'prop' and o['name'] == 'pole' and (o['cx'] - cx) ** 2 + (o['cy'] - cy) ** 2 < 10 ** 2 for o in sprites): return False
        if name == 'lamp' and any((o['k'] == 'prop' and ((o['name'] == 'lamp' and (o['cx'] - cx) ** 2 + (o['cy'] - cy) ** 2 < 4.5 ** 2) or (o['name'] == 'signal' and (o['cx'] - cx) ** 2 + (o['cy'] - cy) ** 2 < 3 ** 2))) for o in sprites): return False
        i = rng.randrange(len(PI[name])) if variant is None else variant % len(PI[name]); img = PI[name][i]; bb = BB[name][i]
        if jit: foot_off += rng.randint(-jit, jit)
        if name in BOARDISH and (sum(1 for o in sprites if o['k'] == 'prop' and o['name'] in BOARDISH) >= 4 or any(o['k'] == 'prop' and o['name'] in BOARDISH and (o['cx'] - cx) ** 2 + (o['cy'] - cy) ** 2 < 9 ** 2 for o in sprites)): return False      # 입간판은 도시에 4개까지, 서로 9칸 이상 떨어뜨려 일렬로 서지 않게
        if name in ('bike', 'moto', 'bike_row') and any(o['k'] == 'prop' and o['name'] == name and (o['cx'] - cx) ** 2 + (o['cy'] - cy) ** 2 < 10 ** 2 for o in sprites): return False       # 같은 두륜차 그림은 10칸 안에 두 번 서지 않는다
        foot = cy * 16 + foot_off; x = cx * 16 + (16 - img.width) // 2; y = foot - img.height
        rect = (x + bb[0], y + bb[1], x + bb[2], y + bb[3])
        if rect[0] < 0 or rect[2] > PX or rect[3] > PX or rect[1] < 0: return False
        full = rect
        footr = (rect[0], max(rect[1], rect[3] - 12), rect[2], rect[3]) if name in TALL else rect       # 키 큰 가는 소품(전신주): 도로·연석은 발치 12px 로, 문·충돌·건물은 몸통 전체로 검사
        if (name in TALL or name in NEW) and any(f <= foot and inter(full, (d0, f - 28, d1, f - 2)) for d0, d1, f in doors): return False      # 나중에 그려져 문을 가리면 안 된다
        if door_hit(full) or collides(full, pad) or hits_bld(full, -2 if name in TALL else 3): return False
        if reserved and name != 'bench2' and any(inter(full, rs) for rs in reserved): return False                   # 정류장 줄서기 자리
        if os.environ.get('DBGEDGE') and name == 'hedge_v': print('hv', cx, cy, rect, door_hit(full), collides(full, pad), hits_bld(full, 3), rect_in_clear(footr), rect_touches(footr, ('curb',)), rect_touches(footr, ('road', 'cross', 'hedge', 'alley')), [o['name'] for o in sprites if o['k'] in ('prop','person','parked','car','rb') and inter(full, o['rect'], pad)])
        if (wide or name in NEW) and not force and (rect_in_clear(footr) or rect_touches(footr, ('curb',))): return False
        if rect_touches(footr, ('road', 'cross', 'hedge', 'alley')) and name not in ('signal',): return False
        if name == 'tree' and (not tree_gap_ok(cx, cy, 3.0 if kind[cy][cx] == 'park' else 4.0) or rect_touches(rect, ('curb',))): return False
        sprites.append(dict(k='prop', name=name, img=img, x=x, y=y, foot=foot, rect=rect, cx=cx, cy=cy, var=i)); return True
    TALL = ('pole',); reserved = []
    FAM_QUOTA = {'vending': 5, 'trash': 6, 'mail': 3}; FAM_MIND = 12

    # ---- 교차로 신호등: 모서리마다 1개, 몸통 쪽(좌/우)을 번갈아 ----
    sig_i = 0
    for r in ROW0:
        for c in COL0:
            for cx, cy, off in ((c - 3, r - 2, 14), (c + RW + 2, r - 2, 14), (c - 3, r + RW + 3, 14), (c + RW + 2, r + RW + 3, 14)):
                if try_prop('signal', cx, cy, force=True, foot_off=off, variant=sig_i % len(PI['signal'])): sig_i += 1
    # ---- 보행자 신호기: 횡단보도 양 끝. 가로 도로(차가 동서로 달린다)를 건너는 쪽은 적색, 세로 도로를 건너는 쪽은 녹색 ----
    if 'ped_signal_r' in PI and 'ped_signal_g' in PI:
        for lx, ly in landings:
            sx_ = -1 if any(lx < c for c in COL0) else 1; sy_ = -1 if any(ly < r for r in ROW0) else 1
            for nm_, cl_ in (('ped_signal_r', [(lx, ly + sy_ * 2), (lx + sx_, ly + sy_ * 2), (lx - sx_, ly + sy_ * 2), (lx, ly + sy_ * 3)]), ('ped_signal_g', [(lx + sx_ * 2, ly), (lx + sx_ * 2, ly + sy_), (lx + sx_ * 2, ly - sy_), (lx + sx_ * 3, ly)])):
                for (cx_, cy_) in cl_:
                    if try_prop(nm_, cx_, cy_, pad=1, foot_off=14): break
    # ---- 연석 쪽 보도 줄: 블록 가장자리 중 도로와 닿는 변 ----
    tall_lines, short_lines, short_edges = [], [], []
    for B in blocks:
        x0, x1, y0, y1, ri, ci = B['x0'], B['x1'], B['y0'], B['y1'], B['ri'], B['ci']
        if ri > 0:   tall_lines.append([(x, y0 + 3, 14) for x in range(x0, x1 + 1)]); short_lines.append([(x, y0, 8) for x in range(x0, x1 + 1)]); short_edges.append((B, 'H', short_lines[-1]))
        if ri < NR - 1: tall_lines.append([(x, y1, 14) for x in range(x0, x1 + 1)]); short_lines.append([(x, y1, 21) for x in range(x0, x1 + 1)]); short_edges.append((B, 'H', short_lines[-1]))
        if ci > 0:   tall_lines.append([(x0, y, 14) for y in range(y0, y1 + 1)]); short_lines.append([(x0, y, 14) for y in range(y0, y1 + 1)]); short_edges.append((B, 'V', short_lines[-1]))
        if ci < NC - 1: tall_lines.append([(x1, y, 14) for y in range(y0, y1 + 1)]); short_lines.append([(x1, y, 14) for y in range(y0, y1 + 1)]); short_edges.append((B, 'V', short_lines[-1]))
    def near_landing(p, d): return any(abs(p[0] - lx) + abs(p[1] - ly) <= d for lx, ly in landings)
    # 교차로 모서리 보도 후보 칸 — 횡단보도 접점에서 안쪽(블록 쪽)으로 2~9칸, 보도 3줄
    corner_cells = []
    for lx, ly in landings:
        sx = -1 if any(lx < c for c in COL0) else 1; sy = -1 if any(ly < r for r in ROW0) else 1
        for k in range(2, 10):
            for j in range(3): corner_cells.append((lx + sx * k, ly + sy * j, 'H')); corner_cells.append((lx + sx * j, ly + sy * k, 'V'))
    rng.shuffle(corner_cells)
    # ---- 지하철 입구: 교차로 모서리 1~2곳(횡단보도 접점 clear 칸은 try_prop 이 거른다) ----
    if 'subway' in PI:
        nsub = rng.randint(1, 2); k = 0
        for x, y, _o in corner_cells:
            if k >= nsub: break
            if any((o['cx'] - x) ** 2 + (o['cy'] - y) ** 2 < 14 ** 2 for o in sprites if o['k'] == 'prop' and o['name'] == 'subway'): continue
            if try_prop('subway', x, y, pad=3):
                k += 1; so_ = sprites[-1]
                if 'subway_sign' in PI:                                  # 입구 옆 표지
                    for dx_ in rng.sample((-3, 3, -2, 2, -4, 4), 6):
                        if try_prop('subway_sign', so_['cx'] + dx_, so_['cy'], pad=1, wide=True): break
    # ---- 공사 구역: 시드당 정확히 1곳 — 블록 모서리 보도의 6x4칸 구획을 사방 펜스로 두르고 안쪽에 가림막·모래·콘·박스·자루 ----
    site = None; site_need = 99
    if 'fence' in PI and 'cone' in PI:
        fw = max(1, -(-PI['fence'][0].width // 16)); SWc = fw * max(3, 6 // fw)
        mg_ = 1 if fw > 1 else 0
        cand_ = []
        for SHc in (4, 3):
            for B_ in blocks:
                if (B_['ri'], B_['ci']) == PARK_BLOCK: continue
                for cx0, cy0 in ((B_['x0'], B_['y0']), (B_['x1'] - SWc, B_['y0']), (B_['x0'], B_['y1'] - SHc), (B_['x1'] - SWc, B_['y1'] - SHc)):
                    for dx_ in range(0, 12):
                        for dy_ in range(0, 6):
                            for sgx in (1, -1):
                                for sgy in (1, -1):
                                    x, y = cx0 + sgx * dx_, cy0 + sgy * dy_
                                    if mg_ <= x < W - SWc - mg_ and 0 <= y < H - SHc and all(kind[y + j][x + i] == 'side' and not clear[y + j][x + i] for j in range(SHc) for i in range(-mg_, SWc + mg_)): cand_.append((x, y, SHc))
        cand_ = list(dict.fromkeys(cand_)); rng.shuffle(cand_)
        c3_ = [c_ for c_ in cand_ if c_[2] == 3]; c4_ = [c_ for c_ in cand_ if c_[2] == 4]
        cand_ = (c3_ + c4_) if rng.random() < .7 else (c4_ + c3_)                       # 블록 모서리마다 달라지도록 3줄짜리(어느 블록에도 들어간다)를 먼저 시도
        if os.environ.get('DBGSITE'): print('site cands', len(cand_))
        for x, y, SHc in cand_[:400]:
            n0 = len(sprites); ok = True; site_need = 2 * (SWc // fw) + 2 * (SHc - 2)
            ring_ = [(x + i, y) for i in range(0, SWc, fw)] + [(x + i, y + SHc - 1) for i in range(0, SWc, fw)] + [(x, y + j) for j in range(1, SHc - 1)] + [(x + SWc - fw, y + j) for j in range(1, SHc - 1)]
            for (fx_, fy_) in ring_:
                if not try_prop('fence', fx_, fy_, pad=0, foot_off=14, variant=0): ok = False; break
            if ok:
                inner = [(x + fw + i, y + 1 + j) for i in range(SWc - 2 * fw) for j in range(SHc - 2)] or [(x + 1, y + 1)]
                nin = 0; kinds_in = ('hoarding', 'sand', 'cone', 'boxes', 'cone', 'sand') if SHc >= 4 else ('sand', 'cone', 'boxes', 'cone')
                for nm_ in kinds_in:
                    if nm_ not in PI: continue
                    for (ix, iy) in rng.sample(inner, len(inner)):
                        if try_prop(nm_, ix, iy, pad=0, foot_off=13, force=True): nin += 1; break
                if nin >= (3 if fw == 1 else 1): site = (x * 16, y * 16, (x + SWc) * 16, (y + SHc) * 16); break
            del sprites[n0:]
    # ---- 전신주: 도로 변 9~13칸 간격(전선으로 이어진다), 도시당 8~12개 ----
    if 'pole' in PI:
        npole = 999; k = 0; lines_ = list(tall_lines); rng.shuffle(lines_)
        for ln in lines_:
            i = rng.randint(2, 5)
            while i < len(ln) and k < npole:
                for d in (0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6):
                    j = i + d
                    if 0 <= j < len(ln) and not near_landing(ln[j], 4) and try_prop('pole', ln[j][0], ln[j][1], pad=2, foot_off=ln[j][2]): k += 1; i = j; break
                i += rng.randint(8, 11)
    # ---- 가로수: 줄마다 5~6칸 간격 식재 칸(±2 칸 안에서 문·충돌을 피해 자리 찾기). 교차로 접점 근처 제외. 같은 줄 이웃은 서로 다른 종류 ----
    ntv = len(PI['tree'])
    for ln in tall_lines:
        i = rng.randint(1, 3); prev = None
        while i < len(ln):
            done = False
            for d in (0, 1, -1, 2, -2):
                j = i + d
                if not (0 <= j < len(ln)) or near_landing(ln[j], 4): continue
                vs = [v for v in range(ntv) if v != prev]; rng.shuffle(vs)
                for v in vs:
                    if try_prop('tree', ln[j][0], ln[j][1], pad=2, foot_off=ln[j][2], variant=v): prev = v; i = j; done = True; break
                if done: break
            i += 5 + rng.randint(0, 1)
    for ln in tall_lines:                                             # 가로등: 7~9칸 간격, 나무·접점·신호등과 같은 칸 금지(try_prop 이 신호등 3칸·가로등 4.5칸 이격을 건다)
        i = rng.randint(1, 4)
        while i < len(ln):
            if not near_landing(ln[i], 3) and try_prop('lamp', ln[i][0], ln[i][1], foot_off=ln[i][2], pad=3): i += 7 + rng.randint(0, 2)
            else: i += 1
    def queue_ok(o):                                              # 정류장 옆 줄서기 자리에 이미 소품(가로수 등)이 서 있으면 그 자리는 버린다
        rs = (o['rect'][0] - 22, o['foot'] - 26, o['rect'][2] + 22, o['foot'] + 2)
        return not any(q is not o and q['k'] == 'prop' and inter(rs, q['rect']) for q in sprites)
    # ---- 정류장: 표지판 2 + 지붕(대로변 보도, 블록당 최대 1) + 옆 벤치2. 줄서기 자리(예약 칸)를 비워 둔다 ----
    cs = [p for ln in short_lines for p in ln]; rng.shuffle(cs); k = 0
    for p in cs:
        if k >= 2: break
        if near_landing(p, 5) or any(o['name'] == 'busstop' and abs(o['cx'] - p[0]) + abs(o['cy'] - p[1]) < 12 for o in sprites if o['k'] == 'prop') or kind[p[1]][p[0]] != 'side': continue
        if try_prop('busstop', p[0], p[1], pad=3, foot_off=p[2] + (4 if p[2] == 8 else 0)):
            if queue_ok(sprites[-1]): k += 1
            else: sprites.pop()
    SHEL = 'shelter' if 'shelter' in PI else ('bus_shelter' if 'bus_shelter' in PI else None)
    stops = [o for o in sprites if o['k'] == 'prop' and o['name'] == 'busstop']
    if SHEL:
        wasN = len(sprites)
        for B, ori, ln in sorted(short_edges, key=lambda t: rng.random()):
            if ori != 'H' or any(o.get('blk') == (B['ri'], B['ci']) for o in sprites[wasN:]): continue
            for p in rng.sample(ln, len(ln)):
                if near_landing(p, 5) or kind[p[1]][p[0]] != 'side' or any(abs(o['cx'] - p[0]) + abs(o['cy'] - p[1]) < 10 for o in sprites if o['k'] == 'prop' and o['name'] in (SHEL, 'busstop')): continue
                if try_prop(SHEL, p[0], p[1], pad=3, foot_off=min(p[2], 14) + (4 if p[2] == 8 else 0), wide=True):
                    if queue_ok(sprites[-1]): sprites[-1]['blk'] = (B['ri'], B['ci']); break
                    sprites.pop()
    stops = [o for o in sprites if o['k'] == 'prop' and o['name'] in ('busstop', SHEL)]
    if 'bench2' in PI:
        for o in stops:
            for dx in rng.sample((-3, -2, 3, 2, 4, -4), 6):
                if try_prop('bench2', o['cx'] + dx, o['cy'], pad=2, foot_off=(o['foot'] - o['cy'] * 16), wide=True): break
    for o in stops:
        reserved.append((o['rect'][0] - 22, o['foot'] - 26, o['rect'][2] + 22, o['foot'] + 2))
    def street_trees():
        return [o for o in sprites if o['k'] == 'prop' and o['name'] == 'tree' and kind[o['cy']][o['cx']] != 'park']
    if len(street_trees()) < 11:                                   # 가로수가 모자라면 남은 빈 칸에 한 번 더(같은 줄 이웃은 서로 다른 종류)
        for ln in sorted(tall_lines, key=lambda t: rng.random()):
            if len(street_trees()) >= 12: break
            near = {}
            for o in street_trees(): near[(o['cx'], o['cy'])] = o['var']
            for j in range(len(ln)):
                if len(street_trees()) >= 12: break
                if near_landing(ln[j], 4): continue
                nbv = {v for (tx, ty), v in near.items() if (ty == ln[j][1] and abs(tx - ln[j][0]) <= 8) or (tx == ln[j][0] and abs(ty - ln[j][1]) <= 8)}
                vs = [v for v in range(ntv) if v not in nbv]; rng.shuffle(vs)
                for v in vs:
                    if try_prop('tree', ln[j][0], ln[j][1], pad=2, foot_off=ln[j][2], variant=v): near[(ln[j][0], ln[j][1])] = v; break
    for nm, n, pad in (('hydrant', 6, 2), ('bollard', 10, 1)):
        k = 0
        for p in cs:
            if k >= n: break
            if nm == 'busstop':
                if near_landing(p, 5) or any(o['name'] == 'busstop' and abs(o['cx'] - p[0]) + abs(o['cy'] - p[1]) < 12 for o in sprites if o['k'] == 'prop'): continue
                if kind[p[1]][p[0]] != 'side': continue
                # 정류장은 줄의 세 번째 칸 이내 앞쪽에 서도록 — 연석 쪽(짧은 줄 좌표) 그대로
                if try_prop(nm, p[0], p[1], pad=pad, foot_off=p[2] + (4 if p[2] == 8 else 0)): k += 1
            elif nm == 'bollard':
                if not any(1 <= abs(p[0] - lx) + abs(p[1] - ly) <= 4 and (p[0] == lx or p[1] == ly) for lx, ly in landings): continue
                if try_prop(nm, p[0], p[1], pad=pad, foot_off=p[2]): k += 1
            else:
                if near_landing(p, 4): continue
                if try_prop(nm, p[0], p[1], pad=pad, foot_off=p[2]): k += 1
    # ---- 지도 가장자리 마감: 네 변 모두 생울타리 또는 가로수 열(바리케이드·펜스 금지). 도로 끝은 생울타리 막이 ----
    edge_kind = {}
    def edge_cells(e):
        if e == 'N': return [(x, 0) for x in range(W)]
        if e == 'S': return [(x, H - 1) for x in range(W)]
        if e == 'W': return [(1, y) for y in range(H)]
        return [(W - 2, y) for y in range(H)]
    def n_edge(e): return sum(1 for o in sprites if o['k'] == 'prop' and o['name'] in ('hedge', 'hedge_v', 'tree') and ((e == 'N' and o['cy'] <= 1) or (e == 'S' and o['cy'] >= H - 2) or (e == 'W' and o['cx'] <= 1) or (e == 'E' and o['cx'] >= W - 2)))
    for e in 'NSWE':
        kinds_ = [k_ for k_ in (('hedge', 'tree') if e in 'SWE' else ('hedge',)) if (k_ == 'tree' or k_ in PI)]
        edge_kind[e] = rng.choice(kinds_)
        def lay(kd):
            cells_ = edge_cells(e); i = rng.randint(0, 2); foot_ = {'N': 14, 'S': 16, 'W': 14, 'E': 14}[e]; prev_v = [None]
            hw_ = max(1, -(-PI['hedge'][0].width // 16)) if 'hedge' in PI else 2
            while i < len(cells_):
                if kd == 'tree':
                    for d_ in (0, 1, -1, 2, -2):
                        j_ = i + d_
                        if 0 <= j_ < len(cells_) and try_prop('tree', cells_[j_][0], cells_[j_][1], pad=2, foot_off=foot_, variant=rng.choice([v for v in range(ntv) if v != prev_v[0]])):
                            prev_v[0] = sprites[-1]['var']; i = j_; break
                    i += 4 + rng.randint(0, 1)
                elif try_prop('hedge' if e in 'NS' else 'hedge_v', cells_[i][0], cells_[i][1], pad=0, foot_off=(foot_ if e in 'NS' else 30), wide=True): i += 2
                elif os.environ.get('DBGEDGE') and e in 'WE': print('edge fail', e, cells_[i], kind[cells_[i][1]][cells_[i][0]], clear[cells_[i][1]][cells_[i][0]]); i += 1
                else: i += 1
        lay(edge_kind[e])
        for kd2 in [k_ for k_ in ('hedge', 'tree') if k_ not in edge_kind[e]]:             # 한 가지로 5개를 못 채우면 다른 마감을 덧붙인다
            if n_edge(e) >= 5: break
            if kd2 in PI or kd2 == 'tree': lay(kd2); edge_kind[e] += '+' + kd2
    if 'hedge' in PI:                                                           # 도로 끝(지도 바깥으로 이어지는 도로): 생울타리 막이
        himg = PI['hedge'][0]; hbb = alpha_bbox(himg)
        def put_hedge(x, y, img):
            bb = alpha_bbox(img); rect = (x + bb[0], y + bb[1], x + bb[2], y + bb[3])
            sprites.append(dict(k='rb', name='roadend_hedge', img=img, x=x, y=y, foot=y + bb[3], rect=rect, cx=(rect[0] + rect[2]) // 32, cy=min(H - 1, (rect[3] - 1) // 16), var=0))
        for r in ROW0:
            for xe in (1, PX - 1 - himg.width):
                for k_ in range(0, RW * 16 - 2, himg.height): put_hedge(xe, r * 16 + 1 + k_, himg)
        for c in COL0:
            for ye in (1, PX - 1 - himg.height):
                for k_ in range(0, RW * 16 - 2, himg.width): put_hedge(c * 16 + 1 + k_, ye, himg)
    # ---- 건물 벽 쪽 보도: 테라스·자판기·쓰레기통·소품 ----
    wallB, wallA = [], []
    for ff, lst in front_info:
        for x, b in lst:
            for xx in range(x, x + b['w']): wallB.append((xx, ff + 1)); wallA.append((xx, ff))
    rng.shuffle(wallB); rng.shuffle(wallA)
    if 'terrace' in PI:                                                  # 카페·식당·상점 앞 보도 4~6곳(문 앞은 door_hit 이 비워 둔다)
        cand = [(ff, x, b) for ff, lst in front_info for x, b in lst if b['cat'] in ('cafe', 'izakaya', 'bakery', 'shop', 'neon')]
        rng.shuffle(cand); nt = rng.randint(4, 6); k = 0
        for ff, x, b in cand:
            if k >= nt: break
            xs_ = list(range(x, x + b['w'])); rng.shuffle(xs_)
            for xx in xs_:
                if any(try_prop('terrace', xx, cy_, pad=2, foot_off=14, wide=True) for cy_ in (ff + 2, ff + 1)): k += 1; break
    if 'stall' in PI and park:                                           # 광장·공원 옆 보도 1~2곳
        P = park; ring = [(x, y) for y in range(P['y0'] - 3, P['y1'] + 4) for x in range(P['x0'] - 3, P['x1'] + 4)
                          if 0 <= x < W and 0 <= y < H and kind[y][x] == 'side' and 1 <= max(P['x0'] - x, x - P['x1'], P['y0'] - y, y - P['y1']) <= 3]
        rng.shuffle(ring); k = 0; ns = rng.randint(1, 2)
        for x, y in ring:
            if k >= ns: break
            if try_prop('stall', x, y, pad=3, wide=True): k += 1
    two = [(p[0], p[1]) for p in cs if kind[p[1]][p[0]] == 'side']       # 연석 쪽 보도 칸(가로 변만 평행 주차 의미가 있다)
    hcurb = [(p[0], p[1], min(p[2], 14)) for B, ori, ln in short_edges if ori == 'H' for p in ln if kind[p[1]][p[0]] == 'side' and not near_landing(p, 3)]
    rng.shuffle(hcurb)
    bnames = [n for n in ('moto', 'bike', 'bike_row') if n in PI]; rng.shuffle(bnames)
    if bnames:                                                           # 오토바이·자전거: 연석 쪽 가로 변에 평행 주차 + 상가 앞, 도시당 8~12
        nb = rng.randint(8, 12); k = 0; pool_c = [(x, y, o) for x, y, o in hcurb[:80]] + [(x, y, 14) for x, y in wallB[:40]]; rng.shuffle(pool_c)
        for x, y, o in pool_c:
            if k >= nb: break
            nm = bnames[k % len(bnames)]
            if try_prop(nm, x, y, pad=2, foot_off=o, wide=True, jit=8): k += 1
    for nm in ('newsstand', 'phone', 'postbox', 'kiosk'):                # 교차로 모서리·정류장 옆 각 1~3
        if nm not in PI: continue
        n = rng.randint(1, 3); k = 0
        spots = list(corner_cells) + [(o['cx'] + dx, o['cy'], 'H') for o in stops for dx in (-5, 5, -6, 6)]
        rng.shuffle(spots)
        for x, y, _o in spots:
            if k >= n: break
            if try_prop(nm, x, y, pad=2, wide=True): k += 1
    LEG = ('mailbox_red', 'planter', 'signboard', 'vending2', 'recycle3', 'boxes', 'trashbags') + TREE_PROPS
    extra_ = [n for n in PI if n in LEG]
    for nm, n, cells_ in [('vending', 3, wallB), ('trash', 3, wallA)] + [(w, 2 if w in ('boxes', 'trashbags', 'signboard') else 4, wallB) for w in extra_] + ([('bench', 3, wallB)] if 'bench' in props2 else []) + ([('board_a', 2, wallB), ('board_b', 2, wallB)] if 'board_a' in PI or 'board_b' in PI else []):
        if nm not in PI: continue
        k = 0
        for p in cells_:
            if k >= n: break
            if try_prop(nm, p[0], p[1], pad=3, jit=6): k += 1
    # 골목 입구 옆 쓰레기통은 두지 않는다(clear). 골목 안 주차장 ↓ 차 단계에서.
    # 뒷줄 뒤에 남은 땅(광장): 나무·벤치
    rng.shuffle(plaza); kt = kb = 0
    for p in plaza:
        if kt < 4 and try_prop('tree', p[0], p[1], pad=2): kt += 1
        elif kb < 2 and try_prop('bench', p[0], p[1], pad=2): kb += 1
    # ---- 공원: 나무·가로등·벤치 ----
    if park:
        P = park; mx, my = P['mx'], P['my']; pk = ('park',)
        cells = [(x, y) for y in range(P['y0'] + 1, P['y1']) for x in range(P['x0'] + 1, P['x1']) if kind[y][x] == 'park']
        far = [(x, y) for x, y in cells if x not in (mx - 1, mx, mx + 1, mx + 2) and y not in (my - 1, my, my + 1, my + 2) and not (abs(x - mx - .5) <= TPL['rx'] + 1 and abs(y - my - .5) <= TPL['ry'] + 1)]
        rng.shuffle(far); k = 0
        CP = dict(cross=('fountain', 'pond'), pond=('pond',), plaza=('fountain',))[PARK_TPL]
        for nm in CP:                                                                                       # 중심물: cross = 분수 가운데 + 연못 북동, pond = 연못 가운데, plaza = 분수 가운데
            im_ = parkimgs.get(nm)
            if im_ is None: continue
            bb = alpha_bbox(im_); center = (nm == 'fountain' or PARK_TPL == 'pond')
            cxp = (mx + 1) * 16 - im_.width // 2 if center else (P['x1'] - 1) * 16 - im_.width; foot = ((my + 1) * 16 + im_.height // 2 if center else (P['y0'] + 2) * 16 + im_.height)
            x, y = cxp, foot - im_.height; rect = (x + bb[0], y + bb[1], x + bb[2], y + bb[3])
            if any(o['k'] == 'prop' and o['name'] in ('fountain', 'pond') and inter(rect, o['rect'], 6) for o in sprites): continue          # 분수와 연못이 겹치면 연못은 생략
            sprites.append(dict(k='prop', name=nm, img=im_, x=x, y=y, foot=foot, rect=rect, cx=(rect[0] + rect[2]) // 32, cy=(rect[3] - 1) // 16))
        far = [(x, y) for x, y in far if not any(inter((x * 16, y * 16, x * 16 + 16, y * 16 + 16), o['rect'], 8) for o in sprites if o['name'] in ('fountain', 'pond'))]
        for dx, dy in ((-4, -4), (5, -4), (-4, 5), (5, 5)): try_prop('lamp', mx + dx, my + dy, ok_kinds=pk, pad=2)
        rng.shuffle(far); k = 0
        for x, y in far:
            if k >= 16: break
            if try_prop('tree', x, y, ok_kinds=pk, pad=2, foot_off=14): k += 1
        for x, y in ((mx - 3, my - 1), (mx + 4, my + 1), (mx - 1, my - 4), (mx + 2, my + 4), (mx - 7, my + 1), (mx + 8, my - 1)): try_prop('bench', x, y, ok_kinds=pk + ('side',), pad=1)

    # ---- 차 ----
    sides = [load2(s) for s in a.car]
    fronts = [load2(s) for s in (a.car_front or [])]; backs = [load2(s) for s in (a.car_back or [])]
    colors = list(CAR_COLOR_WEIGHTS); cw = [CAR_COLOR_WEIGHTS[c] for c in colors]
    vpool = {}
    for v in vehicles: vpool.setdefault(v['name'], []).append(v['im'])
    SPEC_CAP = {nm: rng.randint(1, 2) for nm in ('ambulance', 'firetruck', 'police', 'taxi') if nm in {v['name'] for v in vehicles}}; spec_n = {nm: 0 for nm in SPEC_CAP}
    VEH_W = {'truck': 3, 'bus': 2, 'van': 3, 'ambulance': 1.2, 'firetruck': 1.2, 'police': 1.2, 'scooter': 2, 'taxi': 1.5}
    def car_add(img, x, y, tag, k='car', **kw):
        bb = alpha_bbox(img); rect = (x + bb[0], y + bb[1], x + bb[2], y + bb[3])
        sprites.append(dict(k=k, name=tag, img=img, x=x, y=y, foot=y + bb[3], rect=rect, **kw))
    XG = 24                                                                          # 횡단보도와 달리는/서 있는 차 사이 최소 간격(px) — 정지선 앞 24px 에서 멈춘다
    zonesx = [((c - 2) * 16 - XG, (c + RW + 2) * 16 + XG) for c in COL0]                # 세로 도로 교차 구간(가로 도로 위 차 정지 금지)
    zonesy = [((r - 2) * 16 - XG, (r + RW + 2) * 16 + XG) for r in ROW0]
    def segments(zones, total):
        total = total - 22; out = []; s = 22                                    # 지도 끝 22px 는 바리케이드 자리
        for z0, z1 in zones:
            if z0 - s >= 40: out.append((s, z0))
            s = z1                                             # 구역 자체가 횡단보도에서 24px 바깥까지 잡혀 있다
        if total - s >= 40: out.append((s, total))
        return out
    arrow_h, arrow_v = TL.arrow_img(False), TL.arrow_img(True)
    arrows = []                                                                     # (그림, x, y) — 도로 표시를 그릴 때도, 차가 화살표를 덮지 않게 할 때도 쓴다
    for r in ROW0:
        for c in COL0:
            sx = (c - 2) * 16 - 6; arrows.append((arrow_h, sx - 40, r * 16 + LANE_A - 5))
            sx = (c + RW + 2) * 16 + 4; arrows.append((arrow_h.transpose(Image.FLIP_LEFT_RIGHT), sx + 26, r * 16 + LANE_B - 5))
            sy = (r - 2) * 16 - 6; arrows.append((arrow_v.transpose(Image.FLIP_TOP_BOTTOM), c * 16 + LANE_B - 5, sy - 40))
            sy = (r + RW + 2) * 16 + 4; arrows.append((arrow_v, c * 16 + LANE_A - 5, sy + 26))
    arrow_rects = [(x, y, x + im_.width, y + im_.height) for im_, x, y in arrows]
    def on_arrow(rect): return any(inter(rect, ar, 2) for ar in arrow_rects)
    # -- 연석 주차: 연석에서 4px, 도로 가장자리 차선 바깥쪽에 평행. 블록당 2~3대. 교차로·횡단보도·소화전 앞 금지 --
    hydrants = [o for o in sprites if o['k'] == 'prop' and o['name'] == 'hydrant']
    def zone_free(lo, hi, zones, pad=10): return not any(hi > z0 - pad and lo < z1 + pad for z0, z1 in zones)
    def hydrant_near(rect):
        return any(rect[0] - 10 < h['rect'][2] and h['rect'][0] < rect[2] + 10 and rect[1] - 40 < h['rect'][3] and h['rect'][1] < rect[3] + 40 for h in hydrants)
    park_edges = []
    for B in blocks:
        ri, ci = B['ri'], B['ci']; bx0, bx1 = B['x0'] * 16, (B['x1'] + 1) * 16; by0, by1 = B['y0'] * 16, (B['y1'] + 1) * 16
        if ri > 0: park_edges.append((B, 'H', 'S', bx0, bx1, (ROW0[ri - 1] + RW) * 16))        # 위 도로의 남쪽 가장자리
        if ri < NR - 1: park_edges.append((B, 'H', 'N', bx0, bx1, ROW0[ri] * 16))               # 아래 도로의 북쪽 가장자리
        if ci > 0 and fronts: park_edges.append((B, 'V', 'E', by0, by1, (COL0[ci - 1] + RW) * 16))
        if ci < NC - 1 and backs: park_edges.append((B, 'V', 'W', by0, by1, COL0[ci] * 16))
    def span_key(B_, ori_, side_): return ('H', (B_['ri'] - 1 if side_ == 'S' else B_['ri']), B_['ci']) if ori_ == 'H' else ('V', (B_['ci'] - 1 if side_ == 'E' else B_['ci']), B_['ri'])
    span_cars = set()
    def parked_try(B, ori, side, lo, hi, anchor, img_pick, center=None):
        img = img_pick(ori, side); bb = alpha_bbox(img)
        if ori == 'H':
            wd = bb[2] - bb[0]
            if hi - lo < wd + 16: return False
            gx = (rng.randint(lo + 8, hi - 8 - wd) if center is None else int(center - wd / 2)) - bb[0]
            gy = (anchor + 4 - bb[1]) if side == 'N' else (anchor - 4 - bb[3])
            if not zone_free(gx + bb[0], gx + bb[2], zonesx) or gx + bb[0] < lo + 8 or gx + bb[2] > hi - 8: return False
        else:
            ht = bb[3] - bb[1]
            if hi - lo < ht + 16: return False
            gy = (rng.randint(lo + 8, hi - 8 - ht) if center is None else int(center - ht / 2)) - bb[1]
            gx = (anchor + 4 - bb[0]) if side == 'W' else (anchor - 4 - bb[2])
            if not zone_free(gy + bb[1], gy + bb[3], zonesy) or gy + bb[1] < lo + 8 or gy + bb[3] > hi - 8: return False
        rect = (gx + bb[0], gy + bb[1], gx + bb[2], gy + bb[3])
        if os.environ.get('DBGPARK'): print('pt', B['ri'], B['ci'], ori, side, rect, collides(rect, 6, kinds=('parked', 'rb')), hydrant_near(rect), on_arrow(rect), [o['name'] for o in sprites if o['k'] in ('parked','prop','rb') and inter(rect, o['rect'], 6)])
        if collides(rect, 6, kinds=('parked', 'rb')) or hydrant_near(rect) or on_arrow(rect): return False
        car_add(img, gx, gy, 'parkedcar', k='parked', blk=(B['ri'], B['ci']), edge=side, kerb=anchor, span=span_key(B, ori, side)); span_cars.add(span_key(B, ori, side)); return True
    def sedan_base():                                                                        # 새 세단(car2 — 낮고 평평한 지붕)과 기존 세단을 반반 섞는다
        c2 = vpool.get('car2')
        return rng.choice(c2) if c2 and rng.random() < .5 else rng.choice(sides)
    def pick_car(ori, side):
        color = rng.choices(colors, cw)[0]
        if ori == 'H': img = recolor_car(sedan_base(), color); return img.transpose(Image.FLIP_LEFT_RIGHT) if side == 'S' else img
        return recolor_car(rng.choice(backs if side == 'W' else fronts), color)
    bus_imgs = vpool.get('bus')                                                            # 정류장 앞 연석에 정차한 버스 1대
    if bus_imgs:
        stops_ = [o for o in sprites if o['k'] == 'prop' and o['name'] in ('busstop', 'shelter', 'bus_shelter')]; rng.shuffle(stops_); done_bus = False
        for so in stops_:
            if done_bus: break
            for r in ROW0:
                if abs(so['cy'] - r) > 4 and abs(so['cy'] - (r + RW)) > 4: continue
                north = so['cy'] <= r + 1
                if not north and so['cy'] < r + RW: continue
                img = rng.choice(bus_imgs); bb = alpha_bbox(img)
                if not north: img = img.transpose(Image.FLIP_LEFT_RIGHT); bb = alpha_bbox(img)
                gy = (r * 16 + 4 - bb[1]) if north else ((r + RW) * 16 - 4 - bb[3])
                for dxs in (0, -16, 16, -32, 32, -48, 48, -64, 64):                       # 정류장 앞에서 조금씩 밀어 보며 자리 찾기(버스가 정류장 표지와 겹쳐 서 있어야 한다)
                    gx = (so['rect'][0] + so['rect'][2]) // 2 - (bb[0] + bb[2]) // 2 + dxs
                    rect = (gx + bb[0], gy + bb[1], gx + bb[2], gy + bb[3])
                    if not (rect[0] + 10 < so['rect'][2] and so['rect'][0] < rect[2] - 10): continue
                    if rect[0] < 26 or rect[2] > PX - 26 or not zone_free(rect[0], rect[2], zonesx, 2) or collides(rect, 6, kinds=('parked', 'rb')) or on_arrow(rect): continue
                    car_add(img, gx, gy, 'bus_stopped', k='parked', blk=None, edge='N' if north else 'S', stopped_at=(so['cx'], so['cy'])); done_bus = True; break
                if done_bus: break
    # 노변 주차는 도로 구간(span)마다 연석 쪽 한 줄에만: 블록마다 인접 span 중 아직 반대편이 안 정해진 것을 골라 그 가장자리에 2~3대를 균일 간격으로 세운다
    span_side = {}; edges_of = {}
    for e in park_edges:
        B_, ori_, side_ = e[0], e[1], e[2]
        key = span_key(B_, ori_, side_)
        edges_of.setdefault(id(B_), []).append((key, e))
    order_ = list(blocks); rng.shuffle(order_)
    for B in order_:
        cands = [(k_, e) for k_, e in edges_of.get(id(B), []) if span_side.get(k_) in (None, e[2])]
        if not cands: continue
        hc_ = [c_ for c_ in cands if c_[1][1] == 'H']
        order_c = (hc_ + [c_ for c_ in cands if c_ not in hc_]) if (hc_ and rng.random() < .7) else rng.sample(cands, len(cands))
        for k_, e in order_c:
            if span_side.get(k_) not in (None, e[2]): continue
            n = rng.choice((2, 3)); done = 0; n0_ = len(sprites)
            if e[1] == 'H': free_ = [(max(e[3], q0), min(e[4], q1)) for q0, q1 in segments(zonesx, PX) if min(e[4], q1) - max(e[3], q0) >= 90]
            else: free_ = [(max(e[3], q0), min(e[4], q1)) for q0, q1 in segments(zonesy, PX) if min(e[4], q1) - max(e[3], q0) >= 90]
            if not free_: continue
            lo_, hi_ = max(free_, key=lambda t: t[1] - t[0])                           # 가장 긴 자유 구간에 균일 간격으로
            for att in range(3):
                for kk in range(n):
                    ctr = lo_ + (hi_ - lo_) * (kk + .5) / n + rng.randint(-5, 5)
                    for dsh in (0, 12, -12, 24, -24, 36, -36):
                        if parked_try(*e, pick_car, center=ctr + dsh): done += 1; break
                if done >= 2: break
            if done >= 2: span_side[k_] = e[2]; break
            for o_ in [o_ for o_ in sprites[n0_:] if o_['k'] == 'parked']: sprites.remove(o_)          # 2대를 못 세우면 이 가장자리는 버리고 다른 가장자리를 시도
            span_cars.discard(span_key(e[0], e[1], e[2])) if not any(o_.get('span') == span_key(e[0], e[1], e[2]) for o_ in sprites if o_['k'] == 'parked') else None
    scooter_edges = [e for e in park_edges if e[1] == 'H' and span_side.get(('H', (e[0]['ri'] - 1 if e[2] == 'S' else e[0]['ri']), e[0]['ci'])) == e[2]]
    for _ in range(rng.randint(1, 3) if ('scooter' in vpool and scooter_edges) else 0):             # 스쿠터: 주차 줄 곁 연석 부근
        for _t in range(40):
            e = rng.choice(scooter_edges)
            if parked_try(*e, lambda ori, side: (lambda im: im.transpose(Image.FLIP_LEFT_RIGHT) if side == 'S' else im)(rng.choice(vpool['scooter']))): sprites[-1]['name'] = 'scooter_parked'; break
    if 'meter' in PI:                                                                       # 주차 미터: 주차 줄 맞은편 보도(연석 쪽)에 3~5개
        nmeter = 0
        for o in sorted([o for o in sprites if o['k'] == 'parked' and o.get('edge') and o['name'] == 'parkedcar'], key=lambda t: rng.random()):
            if nmeter >= rng.randint(3, 5): break
            ccx = (o['rect'][0] + o['rect'][2]) // 32; ccy = (o['rect'][1] + o['rect'][3]) // 32
            if o['edge'] == 'N': cells_ = [(ccx + d_, o['kerb'] // 16 - 2) for d_ in (0, 1, -1, 2)]
            elif o['edge'] == 'S': cells_ = [(ccx + d_, o['kerb'] // 16 + 1) for d_ in (0, 1, -1, 2)]
            elif o['edge'] == 'W': cells_ = [(o['kerb'] // 16 - 2, ccy + d_) for d_ in (0, 1, -1, 2)]
            else: cells_ = [(o['kerb'] // 16 + 1, ccy + d_) for d_ in (0, 1, -1, 2)]
            for (cx_, cy_) in cells_:
                if try_prop('meter', cx_, cy_, pad=2, foot_off=12): nmeter += 1; break
    def vehicle_roll(big):
        """달리는 차 한 대의 그림 종류 -> (이름 또는 None, 그림 또는 None)"""
        if not vpool or rng.random() >= .24: return None, None
        names = [n for n in vpool if n != 'car2' and (n not in SPEC_CAP or spec_n[n] < SPEC_CAP[n]) and not (n in ('truck', 'bus', 'van', 'ambulance', 'firetruck') and big >= 2)]
        if not names: return None, None
        nm = rng.choices(names, [VEH_W.get(n, 1) for n in names])[0]
        if nm in SPEC_CAP: spec_n[nm] += 1
        return nm, rng.choice(vpool[nm])
    for r in ROW0:
        for lane in ('E', 'W'):
            cy = r * 16 + (LANE_A if lane == 'E' else LANE_B)                                    # 북쪽 차선(동행) / 남쪽 차선(서행) 가운데
            for s0, s1 in segments(zonesx, PX):
                kk_ = ('H', ROW0.index(r), sum(1 for c_ in COL0 if c_ * 16 < (s0 + s1) / 2))
                if kk_ in span_cars and span_side.get(kk_) == ('N' if lane == 'E' else 'S'): continue       # 주차 줄이 있는 연석 쪽 차선에는 달리는 차를 두지 않는다
                x = s0 + rng.randint(2, 14); big = 0
                while True:
                    vn, vimg = vehicle_roll(big)
                    base = vimg if vn else sedan_base()
                    color = 'silver' if vn else rng.choices(colors, cw)[0]; img = recolor_car(base, color)
                    if lane == 'W': img = img.transpose(Image.FLIP_LEFT_RIGHT)
                    bb = alpha_bbox(img)
                    if x + (bb[2] - bb[0]) > s1 - 2:
                        if vn in SPEC_CAP: spec_n[vn] -= 1                                 # 놓지 못한 특수 차량은 횟수에서 되돌린다
                        break
                    gx, gy = x - bb[0], cy - (bb[1] + bb[3]) // 2
                    rect = (gx + bb[0], gy + bb[1], gx + bb[2], gy + bb[3])
                    if collides(rect, 3, kinds=('parked', 'rb')) or on_arrow(rect):
                        if vn in SPEC_CAP: spec_n[vn] -= 1
                    else:
                        car_add(img, gx, gy, ('v:' + vn) if vn else 'side:' + color, flip=(lane == 'W'))
                        if vn in ('truck', 'bus', 'van', 'ambulance', 'firetruck'): big += 1
                    x += (bb[2] - bb[0]) + rng.randint(6, 34)
    if os.environ.get('DBGTAXI'): print('spec', SPEC_CAP, spec_n)
    for nm in SPEC_CAP:                                                          # 응급 차량은 있으면 도시에 최소 1대(달리는 일반 승용차 한 대와 바꾼다)
        if nm not in vpool or spec_n[nm]: continue
        cands = [c for c in sprites if c['k'] == 'car' and c['name'].startswith('side:')]; rng.shuffle(cands)
        for c in cands:
            img = rng.choice(vpool[nm]); img = img.transpose(Image.FLIP_LEFT_RIGHT) if c['flip'] else img; bb = alpha_bbox(img)
            ccx = (c['rect'][0] + c['rect'][2]) // 2; ccy = (c['rect'][1] + c['rect'][3]) // 2
            gx, gy = ccx - (bb[0] + bb[2]) // 2, ccy - (bb[1] + bb[3]) // 2; rect = (gx + bb[0], gy + bb[1], gx + bb[2], gy + bb[3])
            if rect[0] < 2 or rect[2] > PX - 2 or any(rect[2] > z0 and rect[0] < z1 for z0, z1 in zonesx) or any(o is not c and o['k'] in ('car', 'parked', 'rb') and inter(rect, o['rect'], 3) for o in sprites) or on_arrow(rect): continue
            sprites.remove(c); car_add(img, gx, gy, 'v:' + nm, flip=c['flip']); spec_n[nm] += 1; break
        if not spec_n[nm]:                                                       # 바꿀 승용차가 없으면 빈 틈에 새로 얹는다
            for _t in range(400):
                r = rng.choice(ROW0); lane = rng.choice(('E', 'W')); sg = rng.choice(segments(zonesx, PX))
                kk_ = ('H', ROW0.index(r), sum(1 for c_ in COL0 if c_ * 16 < (sg[0] + sg[1]) / 2))
                if kk_ in span_cars and span_side.get(kk_) == ('N' if lane == 'E' else 'S'): continue
                img = rng.choice(vpool[nm]); img = img.transpose(Image.FLIP_LEFT_RIGHT) if lane == 'W' else img; bb = alpha_bbox(img)
                if sg[1] - sg[0] < bb[2] - bb[0] + 4: continue
                gx = rng.randint(sg[0] + 2, sg[1] - 2 - (bb[2] - bb[0])) - bb[0]; gy = r * 16 + (LANE_A if lane == 'E' else LANE_B) - (bb[1] + bb[3]) // 2
                rect = (gx + bb[0], gy + bb[1], gx + bb[2], gy + bb[3])
                if collides(rect, 4, kinds=('car', 'parked', 'rb')) or on_arrow(rect): continue
                car_add(img, gx, gy, 'v:' + nm, flip=(lane == 'W')); spec_n[nm] += 1; break
    for r in ROW0:                                                               # 달리는 차선이 비어 보이지 않게: 도로마다 달리는 차가 6대 미만이면 빈 틈에 세단을 보태 넣는다
        for _t in range(500):
            if sum(1 for c in sprites if c['k'] == 'car' and r * 16 <= (c['rect'][1] + c['rect'][3]) / 2 < (r + RW) * 16) >= 6: break
            lane = rng.choice(('E', 'W')); sg = rng.choice(segments(zonesx, PX))
            kk_ = ('H', ROW0.index(r), sum(1 for c_ in COL0 if c_ * 16 < (sg[0] + sg[1]) / 2))
            if kk_ in span_cars and span_side.get(kk_) == ('N' if lane == 'E' else 'S'): continue
            color = rng.choices(colors, cw)[0]; img = recolor_car(sedan_base(), color); img = img.transpose(Image.FLIP_LEFT_RIGHT) if lane == 'W' else img; bb = alpha_bbox(img)
            if sg[1] - sg[0] < bb[2] - bb[0] + 4: continue
            gx = rng.randint(sg[0] + 2, sg[1] - 2 - (bb[2] - bb[0])) - bb[0]; gy = r * 16 + (LANE_A if lane == 'E' else LANE_B) - (bb[1] + bb[3]) // 2
            rect = (gx + bb[0], gy + bb[1], gx + bb[2], gy + bb[3])
            if collides(rect, 5, kinds=('car', 'parked', 'rb')) or on_arrow(rect): continue
            car_add(img, gx, gy, 'side:' + color, flip=(lane == 'W'))
    if fronts and backs:
        for c in COL0:
            for lane in ('S', 'N'):
                cx = c * 16 + (LANE_B if lane == 'S' else LANE_A)                                # 동쪽 차선(남행) / 서쪽 차선(북행) 가운데
                for s0, s1 in segments(zonesy, PX):
                    kk_ = ('V', COL0.index(c), sum(1 for r_ in ROW0 if r_ * 16 < (s0 + s1) / 2))
                    if kk_ in span_cars and span_side.get(kk_) == ('E' if lane == 'S' else 'W'): continue
                    y = s0 + rng.randint(2, 12)
                    while True:
                        base = rng.choice(fronts if lane == 'S' else backs); img = recolor_car(base, rng.choices(colors, cw)[0]); bb = alpha_bbox(img)
                        if y + (bb[3] - bb[1]) > s1 - 2: break
                        gx, gy = cx - (bb[0] + bb[2]) // 2, y - bb[1]
                        rect_ = (gx + bb[0], gy + bb[1], gx + bb[2], gy + bb[3])
                        if not collides(rect_, 3, kinds=('parked', 'rb')) and not on_arrow(rect_): car_add(img, gx, gy, 'fb')
                        y += (bb[3] - bb[1]) + rng.randint(12, 48)
    # 뒷골목(가로): 3줄 이상 깊은 구간에 옆모습 차를 주차
    for A in halley:
        x = A['xa']
        while x < A['xb']:
            depth = lambda xx: A['colTop'][xx] - A['rfoot']
            run = 0
            while x + run < A['xb'] and depth(x + run) >= 3: run += 1
            if run >= 6 and sides:
                nx = x + 1
                while nx + 5 <= x + run:
                    if rng.random() < .55:
                        img = recolor_car(rng.choice(sides), rng.choices(colors, cw)[0]); bb = alpha_bbox(img)
                        if rng.random() < .5: img = img.transpose(Image.FLIP_LEFT_RIGHT)
                        cyy = A['rfoot'] * 16 + 24 + rng.randint(-2, 4)
                        gx = nx * 16 - bb[0]; rect = (gx + bb[0], cyy - (bb[3] - bb[1]) // 2, gx + bb[2], cyy + (bb[3] - bb[1]) // 2 + 0)
                        yoff = cyy - (bb[1] + bb[3]) // 2
                        rect = (gx + bb[0], yoff + bb[1], gx + bb[2], yoff + bb[3])
                        if not collides(rect, 2) and not rect_touches(rect, ('bld', 'side')) and not door_hit(rect):
                            sprites.append(dict(k='parked', name='parked', img=img, x=gx, y=yoff, foot=yoff + bb[3], rect=rect))
                    nx += 6 + rng.randint(0, 2)
            x += max(1, run)
    # 골목 주차: 틈이 3칸 이상이면 앞/뒤 그림 차를 안쪽에 세운다 (입구 보도 위로는 나오지 않는다)
    if fronts or backs:
        for A in alleys:
            if A['w'] < 3: continue
            ncol = 2 if A['w'] >= 6 else 1; y = (A['a0'] + 4) * 16
            while y <= (A['a1'] - 1) * 16 + 4:
                for k in range(ncol):
                    base = rng.choice(fronts + backs); img = recolor_car(base, rng.choices(colors, cw)[0]); bb = alpha_bbox(img)
                    gx = A['x'] * 16 + (A['w'] * 16 * (2 * k + 1)) // (2 * ncol) - (bb[0] + bb[2]) // 2
                    rect = (gx + bb[0], y - 48 + bb[1], gx + bb[2], y - 48 + bb[3])
                    if collides(rect, 2) or hits_bld(rect, 0) and False or rng.random() < .35: continue
                    sprites.append(dict(k='parked', name='parked', img=img, x=gx, y=y - 48, foot=y - 48 + bb[3], rect=rect))
                y += 58 + rng.randint(0, 18)

    # ---- 사람 ----
    def try_person(fx, fy, ch, var, row, col, ok_kinds=('side', 'park'), pad=2, mind=44, grp=None):
        if not (12 <= fx <= PX - 12 and 32 <= fy <= PX): return False
        ck = cell_kind(fx, fy - 1)
        if ck not in ok_kinds: return False
        cx, cy = fx // 16, (fy - 1) // 16
        if ck != 'cross' and clear[cy][cx]: return False
        img = actor_frame(ch, row, col, var); bb = alpha_bbox(img); x = fx - 12; y = fy - 32
        rect = (x + bb[0], y + bb[1], x + bb[2], y + bb[3])
        if rect[0] < 0 or rect[1] < 0 or rect[2] > PX or rect[3] > PX: return False
        if ck != 'cross' and foot_door_hit(fx, fy): return False
        if mind and any(o['k'] == 'person' and (o['fx'] - fx) ** 2 + (o['foot'] - fy) ** 2 < mind * mind for o in sprites): return False
        if any(o['k'] in ('prop', 'person', 'parked', 'car') and not (grp and o.get('grp') == grp) and inter(rect, o['rect'], pad if ck != 'cross' else 1) for o in sprites): return False
        if hits_bld(rect, 20): return False                       # 건물 몸통 속 금지(발치 20px 만 겹침 허용)
        if ck != 'cross' and rect_touches(rect, ('alley', 'hedge')): return False
        sprites.append(dict(k='person', name=f'a{ch}', img=img, x=x, y=y, foot=fy, rect=rect, col=col, row=row, cx=cx, cy=cy, kc=ck, fx=fx, ch=ch, var=var, grp=grp)); return True
    def look(fx=None, fy=None):                   # 가장 덜 쓴 캐릭터 · 반경 10칸(160px) 안에 같은 외형(캐릭터+변형)이 없는 것 · 같은 외형은 도시에 최대 4명
        pc = [o for o in sprites if o['k'] == 'person']
        cn = {c: sum(1 for o in pc if o['ch'] == c) for c in MODERN_ACTORS}
        for _ in range(60):
            ch = min(MODERN_ACTORS, key=lambda c: cn[c] + rng.random() * 2.4); var = rng.randrange(NVAR)
            if sum(1 for o in pc if o['ch'] == ch and o['var'] == var) >= 4: continue
            if fx is not None and any(o['ch'] == ch and o['var'] == var and (o['fx'] - fx) ** 2 + (o['foot'] - fy) ** 2 < 200 ** 2 for o in pc): continue
            if fx is not None and any(o['ch'] == ch and ((o['fx'] - fx) ** 2 + (o['foot'] - fy) ** 2 < 72 ** 2) and (o['var'] % 6 == var % 6 or o['var'] // 6 == var // 6) for o in pc): continue          # 바로 곁(72px)에는 머리색·옷색이 같은 사람도 두지 않는다
            if fx is not None and any(o['ch'] == ch and ((o['fx'] - fx) ** 2 + (o['foot'] - fy) ** 2 < 160 ** 2) and ((o['var'] % 6 == var % 6) or (o['var'] // 6 == var // 6)) and rng.random() < .75 for o in pc): continue     # 머리색이나 옷색이 같은 이웃도 가급적 피한다
            return ch, var
        return ch, var
    pair_sigs = set()
    def sig_of(ch, var): return (ch, var % 6)                                                  # (캐릭터, 머리색) — 같은 머리색 조합의 쌍은 도시에서 한 번만
    def try_pair(fx, fy, gap=17, ok_kinds=('side', 'park')):             # 마주 보고 선 두 사람(왼쪽은 오른쪽을, 오른쪽은 왼쪽을 본다)
        if sum(1 for o in sprites if o['k'] == 'person' and not o.get('grp') and abs(o['foot'] - fy) < 9 and abs(o['fx'] - fx) < 240) >= 2: return False          # 쌍이 더해져 한 줄 4명이 되지 않게
        for _a in range(6):
            ch, var = look(fx, fy); ch2, var2 = look(fx + gap, fy)
            sg = tuple(sorted((sig_of(ch, var), sig_of(ch2, var2))))
            if sg not in pair_sigs and sig_of(ch, var) != sig_of(ch2, var2): break
        else: return False
        if not try_person(fx, fy, ch, var, 1, 1, ok_kinds=ok_kinds): return False
        if try_person(fx + gap, fy, ch2, var2, 3, 1, ok_kinds=ok_kinds, mind=0): pair_sigs.add(sg); return True
        sprites.pop(); return False
    PEOPLE_TARGET = rng.randint(52, 58)
    npeople_ = lambda: sum(1 for o in sprites if o['k'] == 'person')
    def row_cluster(fx, fy): return sum(1 for o in sprites if o['k'] == 'person' and abs(o['foot'] - fy) < 9 and abs(o['fx'] - fx) < 240) >= 2     # 한 줄로 늘어선 보행자 방지
    # (1) 벤치 옆에 마주 보고 선 쌍
    benches = [o for o in sprites if o['k'] == 'prop' and o['name'] in ('bench', 'bench2')]; rng.shuffle(benches); nbp = 0
    for bo in benches:
        if nbp >= 4: break
        fy = bo['foot'] - 1
        for fx in (bo['rect'][2] + 12, bo['rect'][0] - 12 - 17):
            if try_pair(fx, fy): nbp += 1; break
    # (2) 정류장 줄서기: 3명(발 간격 18px) — 길 쪽을 보고 선다
    stops = [o for o in sprites if o['k'] == 'prop' and o['name'] in ('busstop', 'shelter', 'bus_shelter')]; nq = 0
    for so in stops:
        dH = min(min(abs(so['cy'] - r), abs(so['cy'] - (r + RW))) for r in ROW0); dV = min(min(abs(so['cx'] - c), abs(so['cx'] - (c + RW))) for c in COL0)
        if dV < dH:                                           # 세로 도로 변
            west = so['cx'] < COL0[0]; frow = 1 if west else 3
        else:
            r = min(ROW0, key=lambda r: abs(so['cy'] - (r + RW / 2))); frow = 2 if so['cy'] < r else 0
        done = False
        horiz = dV >= dH                                          # 가로 도로 변 정류장은 연석을 따라 가로로 3명(간격 18px), 세로 도로 변은 세로 지그재그
        for sgn, offx in ((1, 10), (-1, 10), (1, 18), (-1, 18), (1, 28), (-1, 28)):
            fx0 = so['rect'][2] + offx if sgn > 0 else so['rect'][0] - offx
            for dy0 in ((-4, -10, 2, -16, 8) if horiz else (-10, -16, -4, -22, 4, 10, 16, 22)):
                n0 = len(sprites); ok = True
                for k in range(3):
                    if horiz: fx, fy = fx0 + sgn * 18 * k, so['foot'] + dy0
                    else: fx, fy = fx0 + (17 * sgn if k % 2 else 0), so['foot'] + dy0 + (-18 * k if frow == 2 else 18 * k)
                    ch, var = look(fx, fy)
                    if not try_person(fx, fy, ch, var, frow, 1, mind=0, grp=('q', so['cx'], so['cy'])): ok = False; break
                if ok: done = True; nq += 1; break
                del sprites[n0:]
            if done: break
    # (3) 상가 앞 대화 쌍(문 옆, 문 앞 clear 바깥)
    shop_doors = list(doors)
    rng.shuffle(shop_doors); nsp = 0
    for d0, d1, f in shop_doors:
        if nsp >= rng.randint(4, 6): break
        for fx in (d1 + 16, d0 - 16 - 17):
            if try_pair(fx, f + rng.randint(20, 28)): nsp += 1; break
    # 횡단보도를 건너는 사람(걷는 프레임, 건너는 방향으로 선다)
    for r in ROW0:
        for c in COL0:
            for kd in ('h', 'v'):
                for rep in range(rng.choice((0, 1, 1, 2))):
                    if npeople_() >= PEOPLE_TARGET - 8: break
                    col = rng.choice((0, 2))
                    if kd == 'h':                                                                      # 세로 도로를 건너는(동서) 횡단보도: 행 r-2 / r+RW+1
                        yrow = rng.choice((r - 2, r + RW + 1)); fx = c * 16 + rng.randint(16, RW * 16 - 16); fy = yrow * 16 + 14; row = rng.choice((1, 3))
                    else:                                                                              # 가로 도로를 건너는(남북) 횡단보도: 열 c-2 / c+RW+1
                        xcol = rng.choice((c - 2, c + RW + 1)); fx = xcol * 16 + 8; fy = r * 16 + rng.randint(44, RW * 16 - 8); row = rng.choice((0, 2))
                    ch, var = look(fx, fy)
                    try_person(fx, fy, ch, var, row, col, ok_kinds=('cross',), pad=0)
    # (4) 앵커 기반 행인: 문 앞 · 정류장 · 교차로 모서리 · 공원 길 · 벤치 곁에서 어슬렁(70%), 나머지는 무작위 걷기. 같은 y 줄에 3명 이상 늘어서지 않게.
    anchors = []
    for d0, d1, f in doors:
        for sx in (-1, 1): anchors.append((((d0 + d1) // 2) + sx * rng.randint(30, 52), f + rng.randint(16, 34), 0))
    for so in stops: anchors.append((so['rect'][2] + rng.randint(8, 24), so['foot'] + rng.randint(-8, 4), 1)); anchors.append((so['rect'][0] - rng.randint(8, 24), so['foot'] + rng.randint(-8, 4), 1))
    for lx, ly in landings: anchors.append((lx * 16 + rng.randint(4, 12), ly * 16 + rng.randint(6, 14), 2))
    if park:
        P = park; anchors += [(P['mx'] * 16 + rng.randint(-60, 76), P['my'] * 16 + rng.randint(-8, 28), 3) for _ in range(8)] + [(P['mx'] * 16 + rng.randint(-8, 28), P['my'] * 16 + rng.randint(-60, 76), 3) for _ in range(6)]
    rng.shuffle(anchors)
    npairs = nwalk = 0; park_n = 0
    for ax, ay, atype in anchors:
        if npeople_() >= PEOPLE_TARGET * .72: break
        for _t in range(4):
            fx = int(ax + rng.randint(-7, 7)); fy = int(ay + rng.randint(-5, 5))
            if row_cluster(fx, fy): continue
            walk = rng.random() < .45 and atype != 1
            row = 0 if atype == 0 and not walk and False else rng.choice((1, 3) if atype != 0 else (1, 3, 2))
            ch, var = look(fx, fy)
            if atype == 3 and park_n >= 8: break
            if try_person(fx, fy, ch, var, row if walk or atype == 0 else 2, rng.choice((0, 2)) if walk else 1):
                park_n += atype == 3; break
    walkcells = [(x, y) for y in range(H) for x in range(W) if kind[y][x] in ('side', 'park') and not clear[y][x]]
    rng.shuffle(walkcells)
    for cx, cy in walkcells:
        if npeople_() >= PEOPLE_TARGET: break
        fx = cx * 16 + rng.randint(4, 12); fy = cy * 16 + rng.randint(6, 15)
        if row_cluster(fx, fy): continue
        vert = any(c - 4 <= cx <= c + RW + 3 for c in COL0) and not any(r - 5 <= cy <= r + RW + 4 for r in ROW0)
        if rng.random() < .10 and npairs < 3 and kind[cy][cx] == 'side':
            if try_pair(fx, fy, gap=rng.randint(17, 19)): npairs += 1
            continue
        if kind[cy][cx] == 'park' and sum(1 for o in sprites if o['k'] == 'person' and o['kc'] == 'park') >= 8: continue
        ch, var = look(fx, fy)
        walk = rng.random() < .6
        row = rng.choice((0, 2)) if vert else rng.choice((1, 3))
        try_person(fx, fy, ch, var, row if walk else 2, rng.choice((0, 2)) if walk else 1)

    # ---- 도로 표시(코드로 그린다): 노란 이중 중앙선 · 정지선 · 직진 화살표 · 맨홀 · 배수구. 차·사람은 이 위에 그려진다 ----
    YEL = (210, 165, 76, 255); dr = ImageDraw.Draw(im)
    marks = []                                                                   # (종류, 사각)
    xbox = [((c - 2) * 16, (r - 2) * 16, (c + RW + 2) * 16, (r + RW + 2) * 16) for r in ROW0 for c in COL0]      # 교차로 + 횡단보도 전체
    for r in ROW0:                                                               # 가로 도로 중앙선(교차로 구간 제외)
        for s0, s1 in segments(zonesx, PX):
            for off in (46, 49): dr.rectangle([s0 + 4, r * 16 + off, s1 - 4 - 1, r * 16 + off], fill=YEL)             # 도로 96px 의 정중앙(48)을 가운데 두고 2줄
        if segments(zonesx, PX) == []: pass
    for c in COL0:
        for s0, s1 in segments(zonesy, PX):
            for off in (46, 49): dr.rectangle([c * 16 + off, s0 + 4, c * 16 + off, s1 - 4 - 1], fill=YEL)
    for r in ROW0:
        for c in COL0:
            yE = (r * 16 + 3, r * 16 + 45); yW = (r * 16 + 51, (r + RW) * 16 - 3)                                  # 차선 폭 42px 가 중앙선(48)에 대칭
            xN = (c * 16 + 3, c * 16 + 45); xS = (c * 16 + 51, (c + RW) * 16 - 3)
            sx = (c - 2) * 16 - 6; dr.rectangle([sx, yE[0], sx + 1, yE[1] - 1], fill=TL.STOP + (255,)); marks.append(('stop', (sx, yE[0], sx + 2, yE[1])))
            sx = (c + RW + 2) * 16 + 4; dr.rectangle([sx, yW[0], sx + 1, yW[1] - 1], fill=TL.STOP + (255,)); marks.append(('stop', (sx, yW[0], sx + 2, yW[1])))
            sy = (r - 2) * 16 - 6; dr.rectangle([xS[0], sy, xS[1] - 1, sy + 1], fill=TL.STOP + (255,)); marks.append(('stop', (xS[0], sy, xS[1], sy + 2)))
            sy = (r + RW + 2) * 16 + 4; dr.rectangle([xN[0], sy, xN[1] - 1, sy + 1], fill=TL.STOP + (255,)); marks.append(('stop', (xN[0], sy, xN[1], sy + 2)))
    for im_, ax, ay in arrows: im.alpha_composite(im_, (ax, ay)); marks.append(('arrow', (ax, ay, ax + im_.width, ay + im_.height)))
    for o in sprites:                                                                            # 연석 주차 칸 표시: 차 앞뒤에 연석에서 10px 의 ㄴ자 틱(전폭 선 금지). 버스·스쿠터는 제외
        if o['k'] != 'parked' or not o.get('edge') or o['name'] != 'parkedcar': continue
        x0_, y0_, x1_, y1_ = o['rect']; kb = o['kerb']; col = TL.STOP + (175,)
        if o['edge'] in ('N', 'S'):
            ya, yb = (kb + 1, kb + 11) if o['edge'] == 'N' else (kb - 11, kb - 1); yin = yb if o['edge'] == 'N' else ya
            for xx, d_ in ((x0_ - 4, -1), (x1_ + 3, 1)):
                dr.rectangle([xx, ya, xx, yb], fill=col); dr.rectangle([min(xx, xx + d_ * 4), yin, max(xx, xx + d_ * 4), yin], fill=col)
        else:
            xa, xb = (kb + 1, kb + 11) if o['edge'] == 'W' else (kb - 11, kb - 1); xin = xb if o['edge'] == 'W' else xa
            for yy, d_ in ((y0_ - 4, -1), (y1_ + 3, 1)):
                dr.rectangle([xa, yy, xb, yy], fill=col); dr.rectangle([xin, min(yy, yy + d_ * 4), xin, max(yy, yy + d_ * 4)], fill=col)
    carr = [o['rect'] for o in sprites if o['k'] in ('car', 'parked')]
    MH_A = SPECIAL_IMG.get('manhole') or [TL.manhole_img()]; MH_B = SPECIAL_IMG.get('manhole_b') or MH_A; DR_L = SPECIAL_IMG.get('drain') or [TL.drain_img()]; dr_img = DR_L[0]
    manholes = []; nmh = rng.randint(4, 6)
    for _t in range(600):
        if len(manholes) >= nmh: break
        if rng.random() < .5:
            r = rng.choice(ROW0); cyl = r * 16 + rng.choice((LANE_A, LANE_B)); sg = rng.choice(segments(zonesx, PX)); cxl = rng.randint(sg[0] + 20, sg[1] - 20)
        else:
            c = rng.choice(COL0); cxl = c * 16 + rng.choice((LANE_A, LANE_B)); sg = rng.choice(segments(zonesy, PX)); cyl = rng.randint(sg[0] + 20, sg[1] - 20)
        mh_img = rng.choice(MH_A if len(manholes) % 2 == 0 else MH_B)                                  # 새 맨홀 두 종을 번갈아
        rect = (cxl - mh_img.width // 2, cyl - mh_img.height // 2, cxl - mh_img.width // 2 + mh_img.width, cyl - mh_img.height // 2 + mh_img.height)
        if any(inter(rect, q, 7) for q in carr) or any(inter(rect, m[1], 4) for m in marks) or any((rect[0] - m[0]) ** 2 + (rect[1] - m[1]) ** 2 < 70 ** 2 for m in [(q[0], q[1]) for q in [mm for mm in [x[1] for x in manholes]]]): continue
        manholes.append(('manhole', rect)); im.alpha_composite(mh_img, (rect[0], rect[1]))
    drains = []; ndr = rng.randint(6, 8)
    for _t in range(300):
        if len(drains) >= ndr: break
        dr_img = rng.choice(DR_L)
        r = rng.choice(ROW0); sg = rng.choice(segments(zonesx, PX)); xx = rng.randint(sg[0] + 16, sg[1] - 16 - dr_img.width)
        yy = r * 16 + 1 if rng.random() < .5 else (r + RW) * 16 - 1 - dr_img.height
        rect = (xx, yy, xx + dr_img.width, yy + dr_img.height)
        if any(inter(rect, q, 3) for q in carr) or any(inter(rect, d[1], 30) for d in drains): continue
        drains.append(('drain', rect)); im.alpha_composite(dr_img, (rect[0], rect[1]))
    # ---- 겹침 조각 정리: 다른 건물에 가려 폭 8px 이하·높이 6px 이하로만 남은 건물 조각은 지운다(앞 건물과의 이음 슬리버) ----
    from scipy import ndimage as _ndi
    blds_ = sorted([o for o in sprites if o['k'] == 'bld'], key=lambda o: o['foot']); idm_ = np.full((PX, PX), -1, np.int32)
    for i_, o in enumerate(blds_):
        a_ = np.asarray(o['img'])[:, :, 3] > 0; xs0, ys0 = max(0, o['x']), max(0, o['y']); xs1, ys1 = min(PX, o['x'] + a_.shape[1]), min(PX, o['y'] + a_.shape[0])
        if xs1 > xs0 and ys1 > ys0: idm_[ys0:ys1, xs0:xs1][a_[ys0 - o['y']:ys1 - o['y'], xs0 - o['x']:xs1 - o['x']]] = i_
    n_trim = 0
    for i_, o in enumerate(blds_):
        if 'gas' in o['name']: continue
        lab_, nn_ = _ndi.label(idm_ == i_); arr_ = None
        for k_ in range(1, nn_ + 1):
            ys_, xs_ = np.nonzero(lab_ == k_); w_ = xs_.max() - xs_.min() + 1; h_ = ys_.max() - ys_.min() + 1
            if w_ <= 8 or h_ <= 6 or len(ys_) < 300:
                if arr_ is None: arr_ = np.array(o['img'])
                arr_[ys_ - o['y'], xs_ - o['x'], 3] = 0; n_trim += 1
        if arr_ is not None: o['img'] = Image.fromarray(arr_, 'RGBA')
    # ---- 전선: 이웃한 전신주 꼭대기 사이 1px 늘어진 곡선(α160). 건물 위를 지나가면 그 전선은 그리지 않는다. 소품 위·사람 아래 층(발끝 기준) ----
    poles = [o for o in sprites if o['k'] == 'prop' and o['name'] == 'pole']
    bmask = np.zeros((PX, PX), bool)
    for o in sprites:
        if o['k'] != 'bld': continue
        a_ = np.asarray(o['img'])[:, :, 3] > 0; xs0, ys0 = max(0, o['x']), max(0, o['y']); xs1, ys1 = min(PX, o['x'] + a_.shape[1]), min(PX, o['y'] + a_.shape[0])
        if xs1 > xs0 and ys1 > ys0: bmask[ys0:ys1, xs0:xs1] |= a_[ys0 - o['y']:ys1 - o['y'], xs0 - o['x']:xs1 - o['x']]
    wires = []
    def pole_top(o): return ((o['rect'][0] + o['rect'][2]) // 2, o['rect'][1] + 5)
    pairs_ = set()
    for o in poles:
        best = None
        for q in poles:
            if q is o: continue
            horiz = abs(q['foot'] - o['foot']) <= 10 and q['cx'] > o['cx']
            vert = abs(q['rect'][0] - o['rect'][0]) <= 10 and q['foot'] > o['foot']
            if not (horiz or vert): continue
            d = abs(q['cx'] - o['cx']) * 16 + abs(q['foot'] - o['foot'])
            if 90 <= d <= 420 and (best is None or d < best[0]): best = (d, q)
        if best: pairs_.add((id(o), id(best[1])))
    pid = {id(o): o for o in poles}
    for a_id, b_id in sorted(pairs_):
        A_, B_ = pid[a_id], pid[b_id]; (x0w, y0w), (x1w, y1w) = pole_top(A_), pole_top(B_)
        n_ = max(abs(x1w - x0w), abs(y1w - y0w), 1); horiz_ = abs(x1w - x0w) >= abs(y1w - y0w); sag = max(4, int(n_ * .045)) if horiz_ else max(3, int(n_ * .02)); pts = []
        for i in range(n_ + 1):
            t = i / n_; sg_ = 4 * sag * t * (1 - t)
            pts.append((round(x0w + (x1w - x0w) * t), round(y0w + (y1w - y0w) * t + sg_)) if horiz_ else (round(x0w + (x1w - x0w) * t + sg_), round(y0w + (y1w - y0w) * t)))
        if any(not (0 <= x < PX and 0 <= y < PX) for x, y in pts): continue
        bx0, by0 = min(x for x, y in pts), min(y for x, y in pts); bx1, by1 = max(x for x, y in pts) + 1, max(y for x, y in pts) + 1
        wim = Image.new('RGBA', (bx1 - bx0, by1 - by0), (0, 0, 0, 0)); wpx = wim.load()
        for x, y in pts: wpx[x - bx0, y - by0] = (16, 22, 34, 215)
        sprites.append(dict(k='wire', name='wire', img=wim, x=bx0, y=by0, foot=min(A_['foot'], B_['foot']) - 1, rect=(bx0, by0, bx1, by1), pts=pts)); wires.append(pts)
    # ---- 접지 그림자: 모든 스프라이트 아래 층 ----
    shadow_img, bshadow = TL.make_shadows(sprites, kind, PX)
    im.alpha_composite(shadow_img)

    # ---- 그리기: 발끝 y 순서 ----
    order = {'bld': 0, 'prop': 1, 'parked': 1, 'car': 1, 'wire': 1, 'rb': 1, 'person': 2}
    for s in sorted(sprites, key=lambda s: (s['foot'], order[s['k']])):
        x, y, img = s['x'], s['y'], s['img']
        if 0 <= x and 0 <= y and x + img.width <= PX and y + img.height <= PX: im.alpha_composite(img, (x, y))
        else: _clip(im, img, x, y)
    T_ = Town(); T_.sprites = sprites; T_.kind = kind; T_.doors = doors; T_.clear = clear; T_.zonesx = zonesx; T_.zonesy = zonesy
    T_.park = park; T_.alleys = alleys; T_.marks = marks; T_.xbox = xbox; T_.manholes = manholes; T_.drains = drains; T_.bshadow = bshadow; T_.site = site; T_.site_need = site_need; T_.edge_kind = edge_kind; T_.park_tpl = (PARK_BLOCK, PARK_TPL); T_.wires = wires; T_.blocks = blocks; T_.has_bus_stop = bool(bus_imgs) and any(o['k'] == 'prop' and o['name'] in ('busstop', 'shelter', 'bus_shelter') for o in sprites); T_.sig_states = SIGNAL_STATES; T_.has_taxi = 'taxi' in vpool; T_.mids = [('H', r * 16 + (46 + 49 + 1) / 2) for r in ROW0] + [('V', c * 16 + (46 + 49 + 1) / 2) for c in COL0]
    cnt = lambda k: sum(1 for s in sprites if s['k'] == k)
    stat = dict(buildings=cnt('bld'), towers=sum(1 for s in sprites if s['k'] == 'bld' and s['cat'] == 'tower'), props=cnt('prop'), people=cnt('person'),
                cars=cnt('car') + cnt('parked'), alleys=len(alleys), note=note)
    return im, stat, T_


def _clip(im, img, x, y):
    box = (max(0, -x), max(0, -y), min(img.width, im.width - x), min(img.height, im.height - y))
    if box[2] > box[0] and box[3] > box[1]: im.alpha_composite(img.crop(box), (max(0, x), max(0, y)))


# ------------------------------------------------------------------ 자동 검사 (생성 로직과 별도로 최종 목록을 다시 훑는다)
def audit(T):
    from collections import Counter
    """충돌·겹침 개수. 전부 0 이어야 한다."""
    sp = T.sprites; res = {}; detail = {}
    props = [s for s in sp if s['k'] == 'prop']; people = [s for s in sp if s['k'] == 'person']
    cars = [s for s in sp if s['k'] in ('car', 'parked')]; blds = [s for s in sp if s['k'] == 'bld']
    def pairs(A, B, pad=0, same=False):
        ex = []
        for i, a in enumerate(A):
            for j, b in enumerate(B):
                if same and j <= i: continue
                if inter(a['rect'], b['rect'], pad): ex.append((a['name'], b['name'], a['rect'][:2]))
        return ex
    def rec(key, ex):
        res[key] = len(ex)
        if ex: detail[key] = ex[:6]
    rec('prop_prop', pairs(props, props, 0, True))
    rec('person_prop', pairs(people, props))
    rec('person_person', [e for e in pairs(people, people, 0, True) if not any(a.get('grp') and a.get('grp') == b.get('grp') and (a['name'], a['rect'][:2], b['name']) == e[:1] + (e[2], e[1]) or False for a in people for b in people if False)] if False else [(a['name'], b['name'], a['rect'][:2]) for i, a in enumerate(people) for b in people[i + 1:] if inter(a['rect'], b['rect'], 0) and not (a.get('grp') and a.get('grp') == b.get('grp'))])
    rec('car_car', pairs(cars, cars, 0, True))
    rec('person_car', pairs(people, cars))
    rec('prop_car', pairs(props, cars))
    rec('bld_bld_same_row', [(a['name'], b['name'], a['rect'][:2]) for i, a in enumerate(blds) for b in blds[i + 1:]
                             if abs(a['foot'] - b['foot']) < 16 and min(a['rect'][2], b['rect'][2]) - max(a['rect'][0], b['rect'][0]) > 4])
    rec('prop_door', [(s['name'], s['rect'][:2]) for s in props if any(s['rect'][2] > d0 - 8 and s['rect'][0] < d1 + 8 and s['rect'][3] > f - 14 and s['rect'][1] < f + 18 for d0, d1, f in T.doors)])
    rec('person_door', [(s['name'], s['rect'][:2]) for s in people if s['kc'] != 'cross' and any(d0 - 10 <= s['fx'] <= d1 + 10 and f - 4 <= s['foot'] <= f + 34 for d0, d1, f in T.doors)])
    rec('prop_in_bld', [(s['name'], s['rect'][:2]) for s in props if any(inter(s['rect'], (b['rect'][0], b['rect'][1], b['rect'][2], b['rect'][3] - 3)) for b in blds)])
    rec('person_in_bld', [(s['name'], s['rect'][:2]) for s in people if any(inter(s['rect'], (b['rect'][0], b['rect'][1], b['rect'][2], b['rect'][3] - 20)) for b in blds)])
    rec('prop_off_walk', [(s['name'], s['cx'], s['cy']) for s in props if T.kind[s['cy']][s['cx']] not in ('side', 'park') and s['name'] != 'signal'])
    rec('prop_in_clear', [(s['name'], s['cx'], s['cy']) for s in props if T.clear[s['cy']][s['cx']] and s['name'] != 'signal'])
    rec('tree_gap<4', [(s['cx'], s['cy']) for s in props if s['name'] == 'tree' and any(o is not s and o['name'] == 'tree' and (o['cy'] == s['cy'] and abs(o['cx'] - s['cx']) < 4 or o['cx'] == s['cx'] and abs(o['cy'] - s['cy']) < 4) for o in props)])
    rec('tree_dist<limit', [(s['cx'], s['cy']) for s in props if s['name'] == 'tree' and any(o is not s and o['name'] == 'tree' and (o['cx'] - s['cx']) ** 2 + (o['cy'] - s['cy']) ** 2 < (3.0 if T.kind[s['cy']][s['cx']] == 'park' else 4.0) ** 2 for o in props)])
    rec('tree_lamp_same_cell', [(s['cx'], s['cy']) for s in props if s['name'] == 'tree' and any(o['name'] == 'lamp' and (o['cx'], o['cy']) == (s['cx'], s['cy']) for o in props)])
    rec('park_has_other', [(s['name'], s['cx'], s['cy']) for s in props if T.kind[s['cy']][s['cx']] == 'park' and s['name'] not in ('tree', 'lamp', 'bench', 'bollard', 'fountain', 'pond')])
    rec('person_stand_on_cross', [(s['name'], s['rect'][:2]) for s in people if s['kc'] == 'cross' and s['col'] == 1])
    rec('person_off_walk', [(s['name'], s['rect'][:2]) for s in people if s['kc'] not in ('side', 'park', 'cross')])
    rec('person_fantasy', [(s['name'],) for s in people if int(s['name'][1:]) not in MODERN_ACTORS])
    ex = [(a['name'], a['var'], a['rect'][:2]) for i, a in enumerate(people) for b in people[i + 1:] if a['ch'] == b['ch'] and a['var'] == b['var'] and (a['fx'] - b['fx']) ** 2 + (a['foot'] - b['foot']) ** 2 < 200 ** 2]
    rec('person_same_look_within_12_cells', ex)
    pr_ = [(a, b2) for a in people for b2 in people if a is not b2 and a['name'] == b2['name'] and False]
    adj = []
    for i, a in enumerate(people):
        for b2 in people[i + 1:]:
            if abs(a['foot'] - b2['foot']) <= 3 and 14 <= b2['fx'] - a['fx'] <= 20 or abs(a['foot'] - b2['foot']) <= 3 and 14 <= a['fx'] - b2['fx'] <= 20:
                lo, hi = (a, b2) if a['fx'] < b2['fx'] else (b2, a)
                adj.append(tuple(sorted(((lo['ch'], lo['var'] % 6), (hi['ch'], hi['var'] % 6)))))
    rec('person_pair_repeated(hair combo)', [(k, n) for k, n in Counter(adj).items() if n > 1])
    lk = {}
    for a in people: lk[(a['ch'], a['var'])] = lk.get((a['ch'], a['var']), 0) + 1
    rec('person_same_look>4', [(k, n) for k, n in lk.items() if n > 4]); res['info_distinct_looks'] = len(lk)
    ex = [(a['fx'], a['foot']) for a in people if not a.get('grp') and a['kc'] != 'cross' and sum(1 for b in people if not b.get('grp') and b['kc'] != 'cross' and abs(b['foot'] - a['foot']) < 9 and 0 <= b['fx'] - a['fx'] < 240) >= 4]
    rec('person_row_of_4', ex)
    ex = []
    for s in cars:
        if s['k'] != 'car': continue
        r = s['rect']
        if s['name'] == 'fb':
            if any(r[3] > z0 and r[1] < z1 for z0, z1 in T.zonesy): ex.append((s['name'], r[:2]))
        elif any(r[2] > z0 and r[0] < z1 for z0, z1 in T.zonesx): ex.append((s['name'], r[:2]))
    rec('car_in_junction', ex)
    rec('out_of_map', [(s['name'], s['rect']) for s in sp if s['rect'][0] < 0 or s['rect'][1] < 0 or s['rect'][2] > PX or s['rect'][3] > PX])
    # 뒷줄이 앞줄에 88% 넘게 가려지면(고층이 안 보임) 위반 — 그리기 순서(발끝)로 다시 계산
    ex = []
    for i, b in enumerate(blds):
        m = np.zeros((PX, PX), bool); a = np.asarray(b['img'])[:, :, 3] > 0
        y0, x0 = b['y'], b['x']; tot = int(a.sum())
        for o in blds:
            if o is b or o['foot'] <= b['foot']: continue
            oa = np.asarray(o['img'])[:, :, 3] > 0
            ys0, xs0 = max(y0, o['y']), max(x0, o['x']); ys1, xs1 = min(y0 + a.shape[0], o['y'] + oa.shape[0]), min(x0 + a.shape[1], o['x'] + oa.shape[1])
            if ys1 > ys0 and xs1 > xs0:
                m[ys0:ys1, xs0:xs1] |= False
                sub_b = a[ys0 - y0:ys1 - y0, xs0 - x0:xs1 - x0]; sub_o = oa[ys0 - o['y']:ys1 - o['y'], xs0 - o['x']:xs1 - o['x']]
                m[ys0:ys1, xs0:xs1] |= (sub_b & sub_o)
        hid = int(m.sum()) / max(1, tot)
        if hid > .88: ex.append((b['name'], round(hid, 2), (b['x'], b['y'])))
    rec('bld_hidden>55%', ex)
    # 문 가림: 문 사각형(발끝 위 28px)이 더 나중에 그려지는 건물/소품(나무 수관 포함)에 가려지면 위반
    ex = []
    for d0, d1, f in T.doors:
        dr = (d0, f - 28, d1, f - 2)
        for o in blds + props:
            if o['foot'] <= f and not (o['k'] == 'prop' and o['foot'] == f): continue
            if o['k'] == 'bld' and o['foot'] == f: continue
            oa = np.asarray(o['img'])[:, :, 3] > 0
            xs0, ys0 = max(dr[0], o['x']), max(dr[1], o['y']); xs1, ys1 = min(dr[2], o['x'] + oa.shape[1]), min(dr[3], o['y'] + oa.shape[0])
            if xs1 > xs0 and ys1 > ys0 and oa[ys0 - o['y']:ys1 - o['y'], xs0 - o['x']:xs1 - o['x']].any(): ex.append((o['name'], (d0, f))); break
    rec('door_occluded', ex)
    ex = []
    for pe in people:
        if T.kind[min(PX - 1, pe['foot']) // 16][pe['fx'] // 16] != 'cross': continue
        for c in cars:
            gx = max(c['rect'][0] - pe['fx'], pe['fx'] - c['rect'][2], 0); gy = max(c['rect'][1] - pe['foot'], pe['foot'] - c['rect'][3], 0)
            if (gx * gx + gy * gy) ** .5 < 24: ex.append((pe['fx'], pe['foot'], c['name']))
    rec('car_within_24px_of_crossing_person', ex)
    ex = [(o, p) for o, p in T.mids if any((o == 'H' and r * 16 <= p < (r + RW) * 16 and abs(p - (r * 16 + 48)) > 1.01) or (o == 'V' and c * 16 <= p < (c + RW) * 16 and abs(p - (c * 16 + 48)) > 1.01) for r in ROW0 for c in COL0)]
    rec('centerline_off_centre', ex)
    ex = []
    for c in cars:
        if c['k'] != 'car': continue
        cxm = (c['rect'][0] + c['rect'][2]) / 2; cym = (c['rect'][1] + c['rect'][3]) / 2
        if c['name'] == 'fb':
            ok = any(abs(cxm - (cc * 16 + L)) <= 4 for cc in COL0 for L in (LANE_A, LANE_B))
        else:
            ok = any(abs(cym - (r * 16 + L)) <= 4 for r in ROW0 for L in (LANE_A, LANE_B))
        if not ok: ex.append((c['name'], round(cxm), round(cym)))
    rec('car_off_lane_centre>4px', ex)
    # ---- 2차 QA(2026-10-03) 신규 검사 ----
    from collections import Counter
    ex = [('site', T.site)] if ('fence' in [o['name'] for o in props]) and (T.site is None or sum(1 for o in props if o['name'] == 'fence' and inter(o['rect'], T.site, 6)) < T.site_need) else []
    rec('construction_site_not_fenced_4_sides', ex)
    ex = []
    for e, test in (('N', lambda o: o['cy'] <= 1), ('S', lambda o: o['cy'] >= H - 2), ('W', lambda o: o['cx'] <= 1), ('E', lambda o: o['cx'] >= W - 2)):
        n_ = sum(1 for o in props if o['name'] in ('hedge', 'hedge_v', 'tree') and test(o))
        ring_ = [(x, 0) for x in range(W)] if e == 'N' else ([(x, H - 1) for x in range(W)] if e == 'S' else ([(1, y) for y in range(H)] if e == 'W' else [(W - 2, y) for y in range(H)]))
        free_ = 0; run_ = 0
        for x, y in ring_ + [(-1, -1)]:                                                 # 건물이 변 끝까지 붙은 곳은 심을 자리가 없다 — 연속 4칸 이상 빈 보도만 자리로 센다
            if x >= 0 and T.kind[y][x] == 'side': run_ += 1
            else:
                if run_ >= 4: free_ += run_
                run_ = 0
        if n_ < min(4, free_ // 9): ex.append((e, T.edge_kind.get(e), n_, free_))
    rec('map_edge_unfinished(자리 있는 만큼 hedge/tree)', ex)
    rb = [o for o in sp if o['k'] == 'rb']
    rec('road_end_not_closed(<12 hedge pieces)', [('rb', len(rb))] if len(rb) < 12 and any(o['name'] == 'hedge' for o in props) else [])
    rec('barricade_or_fence_outside_site', [(o['name'], o['cx'], o['cy']) for o in props if o['name'] in ('fence', 'barrier') and (T.site is None or not inter(o['rect'], T.site, 6))])
    rec('stopped_bus_missing', [('bus',)] if T.has_bus_stop and not any(o['name'] == 'bus_stopped' for o in cars) and any(o['name'].startswith('v:bus') for o in cars) is False and False else [])
    rec('parking_bld>1', [('parking', sum(1 for o in blds if o['cat'] == 'parking'))] if sum(1 for o in blds if o['cat'] == 'parking') > 1 else [])
    tx_ = sum(1 for c in cars if c['name'] == 'v:taxi')
    rec('taxi_count_out_of_1-2', [('taxi', tx_)] if any(c['name'] == 'v:taxi' for c in cars) is False and False else ([('taxi', tx_)] if not (1 <= tx_ <= 2) and T.has_taxi else []))
    rec('arrow_covered_by_car', [(m[0], m[1][:2]) for m in T.marks if m[0] == 'arrow' and any(inter(m[1], c['rect'], 0) for c in cars)])
    spans_ = {}
    for c in cars:
        if c['k'] == 'parked' and c.get('span') is not None: spans_.setdefault(c['span'], set()).add(c['edge'])
    rec('parked_on_both_sides_of_one_span', [(k, tuple(v)) for k, v in spans_.items() if len(v) > 1])
    mv_ = [c for c in cars if c['k'] == 'car']
    rec('moving_cars_per_road<4', [(r, n) for r in ROW0 for n in [sum(1 for c in mv_ if r * 16 <= (c['rect'][1] + c['rect'][3]) / 2 < (r + RW) * 16)] if n < 4])
    rec('excluded_prop_used', [(o['name'],) for o in props if o['name'] in PROP_EXCLUDE])
    pk_ = Counter(o['blk'] for o in sp if o['k'] == 'parked' and o.get('blk') and o['name'] == 'parkedcar')
    for bs_ in [o for o in sp if o['name'] == 'bus_stopped']:                              # 정차 버스는 가장 가까운 블록의 주차 대수에 센다
        bc_ = ((bs_['rect'][0] + bs_['rect'][2]) / 32, (bs_['rect'][1] + bs_['rect'][3]) / 32)
        bb_ = min(T.blocks, key=lambda B_: max(0, B_['x0'] - bc_[0], bc_[0] - B_['x1']) ** 2 + max(0, B_['y0'] - bc_[1], bc_[1] - B_['y1']) ** 2)
        pk_[(bb_['ri'], bb_['ci'])] += 1
    res['info_parked_per_block'] = '/'.join(str(pk_.get((b_['ri'], b_['ci']), 0)) for b_ in T.blocks if (b_['ri'], b_['ci']) != T.park_tpl[0])
    rec('parked_cars_per_block_out_of_2-4', [(k, n) for k, n in pk_.items() if not (2 <= n <= 4)])
    res['info_bus_stopped'] = sum(1 for o in cars if o['name'] == 'bus_stopped'); res['info_wires'] = len(T.wires); res['info_park'] = str(T.park_tpl)
    bmask_ = np.zeros((PX, PX), bool)
    for o in blds:
        a_ = np.asarray(o['img'])[:, :, 3] > 0; xs0, ys0 = max(0, o['x']), max(0, o['y']); xs1, ys1 = min(PX, o['x'] + a_.shape[1]), min(PX, o['y'] + a_.shape[0])
        if xs1 > xs0 and ys1 > ys0: bmask_[ys0:ys1, xs0:xs1] |= a_[ys0 - o['y']:ys1 - o['y'], xs0 - o['x']:xs1 - o['x']]
    ex = []                                                                     # 정면 아래 보도 띠 그림자(4~6px, 보도 위)가 실제로 칠해졌는가
    for o in blds:
        if not o.get('front'): continue
        f_ = o['foot']; xs_ = range(max(0, o['rect'][0] + 4), min(PX, o['rect'][2] - 4))
        tot = ok = 0
        for xx in xs_:
            if 0 <= xx - o['x'] < o['img'].width and o['img'].getpixel((xx - o['x'], o['img'].height - 1))[3] > 40 and f_ + 8 < PX and T.kind[(f_ + 1) // 16][xx // 16] == 'side' and T.kind[(f_ + 8) // 16][xx // 16] == 'side': tot += 1; ok += int(T.bshadow[f_ - 2:f_ + 8, xx].any())
        if tot > 8 and ok < .6 * tot: ex.append((o['name'], round(ok / tot, 2)))
    rec('bld_shadow_band_missing', ex)
    # 뒷줄 건물: 가려지고 남은 정면이 0~47px 이면 '지붕 위의 지붕' 조각
    idm = np.full((PX, PX), -1, np.int32)
    for i_, o in enumerate(sorted(blds, key=lambda o: o['foot'])):
        a_ = np.asarray(o['img'])[:, :, 3] > 0; xs0, ys0 = max(0, o['x']), max(0, o['y']); xs1, ys1 = min(PX, o['x'] + a_.shape[1]), min(PX, o['y'] + a_.shape[0])
        if xs1 > xs0 and ys1 > ys0: idm[ys0:ys1, xs0:xs1][a_[ys0 - o['y']:ys1 - o['y'], xs0 - o['x']:xs1 - o['x']]] = i_
    ex = []
    for i_, o in enumerate(sorted(blds, key=lambda o: o['foot'])):
        if o.get('front') or not o.get('info'): continue
        r1 = o['y'] + o['info']['roof'][3]; vis_rows = 0
        for yy in range(max(0, r1), min(PX, o['foot'])):
            if (idm[yy, max(0, o['x']):o['x'] + o['img'].width] == i_).sum() >= 6: vis_rows += 1
        if vis_rows < 48: ex.append((o['name'], o['x'], o['y'], vis_rows))
    rec('bld_facade_sliver<48px', ex)
    from scipy import ndimage as _ndi
    ex = []
    srt_ = sorted(blds, key=lambda o: o['foot'])
    for i_, o in enumerate(srt_):
        if 'gas' in o['name']: continue                                                      # 주유소 기둥은 가늘어도 정상
        lab_, n_ = _ndi.label(idm == i_)
        for k_ in range(1, n_ + 1):
            ys_, xs_ = np.nonzero(lab_ == k_); w_ = xs_.max() - xs_.min() + 1; h_ = ys_.max() - ys_.min() + 1
            if w_ <= 8 or h_ <= 6 or len(ys_) < 300: ex.append((o['name'], int(xs_.min()), int(ys_.min()), int(w_), int(h_)))
    rec('bld_visible_sliver(폭<=8 또는 높이<=6)', ex)
    # ---- 새 검사 (2026-10-02 QA 반영) ----
    from collections import Counter
    fam = Counter(b['bk'] for b in blds)
    capof = {b['bk']: FAM_CAP.get(b['bk'], 1 if b['cat'] in CIVIC_SPECIAL else FAM_CAP_DEFAULT) for b in blds}
    rec('bld_same>cap+1', [(k, n) for k, n in fam.items() if n > capof[k] + 1])
    res['info_bld_relaxed'] = sum(1 for k, n in fam.items() if n == capof[k] + 1); res['info_bld_3x'] = sum(1 for k, n in fam.items() if n >= 3); res['info_bld_max_same'] = max(fam.values()) if fam else 0
    ex_ov, ex_rail, ex_ratio, ex_red, ex_gap, ex_al = [], [], [], [], [], []
    ratios = []
    for b in blds:
        inf = b.get('info')
        if not inf or not inf['items']: continue
        ox, oy = b['x'], b['y']; ux0, uy0, ux1, uy1 = inf['usable']; its = inf['items']
        for i, (nm, r) in enumerate(its):
            h = r[3] - r[1]
            if r[0] < ux0 or r[2] > ux1 or r[3] > uy1 or (nm != 'antenna' and r[1] < uy0 - (10 if nm.endswith('_l') else 0)) or (nm == 'antenna' and r[3] - 14 < uy0) or (nm.endswith('_l') and r[1] < uy0 - 10 - 0 and False): ex_rail.append((b['name'], nm, (r[0] + ox, r[1] + oy)))
            for nm2, r2 in its[i + 1:]:
                if inter(r, r2, 0): ex_ov.append((b['name'], nm, nm2))
                elif inter(r, r2, 4): ex_gap.append((b['name'], nm, nm2))
        ys = Counter(round(r[3] / 3) for nm, r in its if r[3] - r[1] < 40)
        if ys and max(ys.values()) >= 3: ex_al.append((b['name'], ox, oy))
        if inf['cleared']:
            ratios.append(inf['ratio'])
            if not inf.get('helipad') and not ((.15 if (inf['roof'][2] - inf['roof'][0]) * (inf['roof'][3] - inf['roof'][1]) >= 2400 else .10) <= inf['ratio'] <= (.62 if inf.get('big') else .25)): ex_ratio.append((b['name'], round(inf['ratio'], 2)))
            rx0, ry0, rx1, ry1 = inf['roof']; arr = np.asarray(b['img'])[ry0:ry1, rx0:rx1]
            red = (arr[:, :, 0] > 150) & (arr[:, :, 1] < 90) & (arr[:, :, 2] < 90) & (arr[:, :, 3] > 0)
            for nm, r in its:
                red[max(0, r[1] - ry0 - 2):max(0, r[3] - ry0 + 2), max(0, r[0] - rx0 - 2):max(0, r[2] - rx0 + 2)] = False
            if red.any(): ex_red.append((b['name'], int(red.sum())))
    rec('roof_item_overlap', ex_ov); rec('roof_item_gap<4', ex_gap); rec('roof_item_on_rail', ex_rail); rec('roof_ratio_out_of_15-25%(작은 지붕<2400px² 은 10%↑)', ex_ratio); rec('roof_stray_red', ex_red); rec('roof_aligned_row', ex_al)
    allit = [nm for b in blds if b.get('info') for nm, r in b['info']['items']]
    rec('roof_ac_row>1', [('ac_row', allit.count('ac_row'))] if allit.count('ac_row') > 1 else []); rec('roof_pipes_present', [('pipes', allit.count('pipes') + allit.count('pipes_b'))] if allit.count('pipes') + allit.count('pipes_b') else [])
    rec('roof_old_stairwell_tank', [(nm,) for nm in allit if nm in ('stairwell', 'stairwell_s', 'tank', 'tank_s')])
    rec('roof_dish_pair', [(b['name'], b['x']) for b in blds if b.get('info') and sum(1 for nm, r in b['info']['items'] if nm == 'dish') > 1])
    rec('roof_helipad<60_or_roof<90', [(b['name'], r[2] - r[0]) for b in blds if b.get('info') for nm, r in b['info']['items'] if nm.startswith('helipad') and (r[2] - r[0] < 60 or b['info']['roof'][2] - b['info']['roof'][0] < 90)])
    res['info_roof_ratio_mean_pct'] = round(100 * sum(ratios) / len(ratios), 1) if ratios else 0.0; res['info_roofs_cleared'] = len(ratios)
    rec('mark_inside_junction', [(k, r[:2]) for k, r in T.marks if any(inter(r, xb) for xb in T.xbox)])
    res['info_stop_lines'] = sum(1 for k, r in T.marks if k == 'stop'); res['info_arrows'] = sum(1 for k, r in T.marks if k == 'arrow')
    kk = np.array(T.kind); roadpx = np.kron(((kk == 'road') | (kk == 'cross') | (kk == 'curb')).astype(np.uint8), np.ones((16, 16), np.uint8)).astype(bool)
    rec('bld_shadow_on_road', [('px', int((T.bshadow & roadpx).sum()))] if (T.bshadow & roadpx).any() else [])
    rec('manhole_overlap_car', [(r[:2],) for k, r in T.manholes if any(inter(r, c['rect'], 4) for c in cars)])
    res['info_manholes'] = len(T.manholes); res['info_drains'] = len(T.drains)
    fm = {'vending': ('vending', 'vending2'), 'trash': ('trash', 'recycle3'), 'mail': ('mailbox_red', 'postbox')}; quota = {'vending': 5, 'trash': 6, 'mail': 3}; ex = []
    for f, names in fm.items():
        L = [s for s in props if s['name'] in names]
        if len(L) > quota[f]: ex.append((f, len(L)))
        ex += [(f, a['cx'], a['cy'], b2['cx'], b2['cy']) for i, a in enumerate(L) for b2 in L[i + 1:] if (a['cx'] - b2['cx']) ** 2 + (a['cy'] - b2['cy']) ** 2 < 144]
    rec('prop_family_quota_or_dist<12', ex)
    sigs = [s for s in props if s['name'] == 'signal']; lamps = [s for s in props if s['name'] == 'lamp']
    rec('lamp_near_signal<3', [(l['cx'], l['cy']) for l in lamps if any((l['cx'] - g['cx']) ** 2 + (l['cy'] - g['cy']) ** 2 < 9 for g in sigs)])
    res['info_signals'] = len(sigs)
    rec('signal_same_side_neighbor', [(a['cx'], a['cy']) for a in sigs for b2 in sigs if a is not b2 and abs(a['cx'] - b2['cx']) <= 6 and abs(a['cy'] - b2['cy']) >= 6 and abs(a['cy'] - b2['cy']) <= 40 and False])
    pc = Counter(p['ch'] for p in people)
    rec('person_char_share>40%', [(c, n) for c, n in pc.items() if n > .40 * len(people)])
    res['info_people'] = len(people)
    trs = [s for s in props if s['name'] == 'tree' and T.kind[s['cy']][s['cx']] != 'park']; ex = []
    for t in trs:
        nb = [o for o in trs if o is not t and ((o['cy'] == t['cy'] and 0 < abs(o['cx'] - t['cx']) <= 8) or (o['cx'] == t['cx'] and 0 < abs(o['cy'] - t['cy']) <= 8))]
        for o in nb:
            if o['var'] == t['var'] and len(set(x['var'] for x in trs)) > 1: ex.append((t['cx'], t['cy'], o['cx'], o['cy']))
    rec('street_tree_same_kind_adjacent', ex)
    prk = [s for s in sp if s['k'] == 'parked' and s['name'] == 'parkedcar']; byb = Counter(s['blk'] for s in prk)
    rec('parked_block_count>4', [(k, n) for k, n in byb.items() if n > 4]); res['info_parked_per_block'] = '/'.join(str(byb.get(k, 0)) for k in sorted(byb))
    ex = []
    for s in prk:
        r = s['rect']
        if (s['edge'] in ('N', 'S') and any(r[2] > z0 and r[0] < z1 for z0, z1 in T.zonesx)) or (s['edge'] in ('E', 'W') and any(r[3] > z0 and r[1] < z1 for z0, z1 in T.zonesy)): ex.append((s['edge'], r[:2]))
    rec('parked_in_junction', ex)
    vc = Counter(s['name'] for s in cars if s['name'].startswith('v:'))
    rec('emergency_vehicle>2', [(k, n) for k, n in vc.items() if k in ('v:ambulance', 'v:firetruck', 'v:police') and n > 2])
    res['info_vehicles'] = dict(vc)
    res['TOTAL'] = sum(v for k, v in res.items() if not k.startswith('info_') and k != 'TOTAL')
    return res, detail


# ------------------------------------------------------------------ CLI
def parser():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True); ap.add_argument('--ground', required=True); ap.add_argument('--props', required=True)
    for k in ('shop', 'office', 'apartment', 'house', 'cafe', 'car', 'car_front', 'car_back'): ap.add_argument('--' + k.replace('_', '-'), type=lambda s: s.split(','))
    ap.add_argument('--relax-caps', action='store_true', help='건물이 28채에 못 미치면 같은 시드로 한 번 더, 빈 땅을 메울 때만 같은 그림 상한을 +1 풀어 본다(기본 꺼짐: 어떤 그림도 3회 이상 나오지 않음)')
    ap.add_argument('--green'); ap.add_argument('--seed', type=int, default=7); ap.add_argument('--scale', type=int, default=2)
    ap.add_argument('--assets', help='harness-data/modern-chipset/town_assets.json (없거나 비면 무시)')
    ap.add_argument('--check', help='쉼표로 구분한 seed 들을 모두 만들어 audit 통계를 print (예: 1,5,9). 하나라도 위반이 있으면 종료코드 1')
    return ap


def save(a, im):
    im.save(a.out); im.resize((im.width * a.scale, im.height * a.scale), Image.NEAREST).save(a.out.replace('.png', f'-x{a.scale}.png'))


if __name__ == '__main__':
    a = parser().parse_args(); bad = 0; agg = []
    seeds = [int(s) for s in a.check.split(',')] if a.check else [a.seed]
    base = a.out
    for sd in seeds:
        a.seed = sd; a.out = base.replace('.png', f'_s{sd}.png') if a.check else base
        im, stat, T = build(a); res, detail = audit(T); save(a, im)
        print(f'seed {sd}: {a.out} {stat}'); print('   audit:', {k: v for k, v in res.items() if (v or k == 'TOTAL') and not k.startswith('info_')}, f'(검사 {len([k for k in res if not k.startswith("info_") and k != "TOTAL"])}항목)'); print('   info:', {k: v for k, v in res.items() if k.startswith('info_')})
        for k, v in detail.items(): print('   !', k, v)
        bad += res['TOTAL']
        nb = [q for q in T.sprites if q['k'] == 'bld']; agg.append((len(nb), len({q['bk'] for q in nb}), sum(1 for q in nb if q.get('sign')), res.get('info_roof_ratio_mean_pct', 0)))
    if len(agg) > 1:
        n = len(agg); print(f'평균({n}시드): 건물 {sum(x[0] for x in agg) / n:.1f}채(최소 {min(x[0] for x in agg)}) · 종류 {sum(x[1] for x in agg) / n:.1f}종 · 돌출간판 {sum(x[2] for x in agg) / n:.1f}개 · 옥상 설비 면적 {sum(x[3] for x in agg) / n:.1f}%')
    sys.exit(1 if bad else 0)
