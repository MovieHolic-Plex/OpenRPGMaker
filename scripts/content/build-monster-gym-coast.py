# 체육관 내부 + 해변·항구 칩셋(생성 자산) 빌드.
#
# 입력: tiledata/pkmn-gym-coast/raw/*.png — 이미지 생성 모델 출력 원본(투명 배경 RGBA, 가로 약 2000px).
#   화풍 기준은 Scarloxy 사막/설원 시트(아레나 외관·모래·물)와 실내 시트, 몬스터 마을 부품이다.
# 출력:
#   public/assets/monster-gym-coast/monster-gym-coast.png   480x512 (16px, 30x32칸) 칩셋
#     위 480칸(0~479) = Scarloxy 사막/설원 시트 그대로(번호 동일 — 모래 34, 바다 204, 야자 110 …),
#     아래 480칸(480~) = 새 부품. 맵 하나는 타일셋 하나만 쓰므로 모래·바다와 부두·등대를 한 맵에 깔려면 한 장이어야 한다.
#   src/assets/monsterGymCoastManifest.json                 블록 배치(행은 시트 전체 기준)·층·통행
#
# 두 종류의 칸을 만든다.
#   1) 그림 부품: 원본에서 성분(연결 요소)을 잘라 목표 칸 수에 맞게 알파 가중 BOX 축소 → 알파 이진화 → 팔레트 축소.
#   2) 이어 깔리는 지형(해안 파도 테두리·젖은 모래 경계·체육관 천장 테두리): **코드로 합성**한다.
#      바다·모래는 위 반쪽의 실제 모래 0·바다 204 칸을 좌표 mod 16 으로 샘플링하므로 위 반쪽 칸과 이음새가 정확히 맞는다.
#      테두리 선은 칸 중앙(8px)에서 칸 경계를 넘고, 곧은 변의 물결은 주기 16px 이라 같은 칸을 반복해도 이어진다.
#   이 합성 칸은 팔레트 축소를 거치지 않는다(바다 색이 204 와 달라지면 이음새가 보인다).
#
# 실행: python3 scripts/content/build-monster-gym-coast.py

import json
import math
import os

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAW = os.path.join(ROOT, "tiledata", "pkmn-gym-coast", "raw")
WILDS = os.path.join(ROOT, "public", "assets", "scarloxy", "scarloxy-chipset-wilds.png")
OUT_DIR = os.path.join(ROOT, "public", "assets", "monster-gym-coast")
OUT_PNG = os.path.join(OUT_DIR, "monster-gym-coast.png")
MANIFEST = os.path.join(ROOT, "src", "assets", "monsterGymCoastManifest.json")

TILE = 16
COLS, ROWS = 30, 16
BASE_ROWS = 16
PALETTE_COLORS = 96
SAND_TILE = 34    # 위 반쪽 사막 모래 몸통(0 은 풀 조각 가장자리가 섞여 있다)
WATER_TILE = 204  # 위 반쪽 정지 바다(water-still-0)

wilds = Image.open(WILDS).convert("RGBA")


def wild_tile(i):
    return np.array(wilds.crop(((i % 30) * TILE, (i // 30) * TILE, (i % 30) * TILE + TILE, (i // 30) * TILE + TILE))).astype(np.int32)


SAND = wild_tile(SAND_TILE)
WATER = wild_tile(WATER_TILE)
# 젖은 모래 = 같은 모래 칸을 어둡고 갈색으로. 무늬가 같아서 마른 모래와 똑같이 이어 깔린다.
WET = SAND.copy()
WET[..., 0] = SAND[..., 0] * 0.80
WET[..., 1] = SAND[..., 1] * 0.66
WET[..., 2] = SAND[..., 2] * 0.52
WET = np.clip(WET, 0, 255)

# ---------------------------------------------------------------------------
# 블록 표. (이름, col, row(부품 반쪽 기준), w, h, kind, layer, passage, 추가 규칙)
#   layer: lower = 1층 불투명 지형, upper = 3층 투명 부품
#   passage: passable / solid. overRows = 위에서부터 그 줄 수만큼은 통행 가능(캐릭터 머리 위로 그려짐).
#   openCells = 막힘 블록 안의 통행 가능 칸 [dx, dy]. openPart = 그 칸의 이름(stairs 단상 계단 / center 해안 가운데 젖은 모래).
# ---------------------------------------------------------------------------
BLOCKS = []


def block(name, col, row, w, h, kind, layer, passage, **extra):
    BLOCKS.append({"name": name, "col": col, "row": row, "w": w, "h": h, "kind": kind, "layer": layer, "passage": passage, **extra})


# 0행: 바닥
for i, t in enumerate(["neutral", "grass", "fire", "water"]):
    block(f"gym-floor-{t}", i * 2, 0, 2, 1, "floor", "lower", "passable")
block("pier-deck-h", 8, 0, 1, 1, "pier", "lower", "passable")
block("pier-deck-v", 9, 0, 1, 1, "pier", "lower", "passable")
block("pier-front", 10, 0, 1, 1, "pier", "lower", "solid")
block("wet-sand", 11, 0, 1, 1, "sand", "lower", "passable")
# 1~2행: 벽·천장
for i, t in enumerate(["grass", "fire", "water"]):
    block(f"gym-wall-{t}", i * 3, 1, 1, 2, "wall", "lower", "solid")
    block(f"gym-wall-{t}-emblem", i * 3 + 1, 1, 2, 2, "wall", "lower", "solid")
block("gym-ceiling", 9, 1, 8, 1, "ceiling", "lower", "solid")
# 3~4행: 단상·조각상·장식
for i, t in enumerate(["grass", "fire", "water"]):
    block(f"leader-podium-{t}", i * 3, 3, 3, 2, "podium", "upper", "solid", openCells=[[1, 1]], openPart="stairs")
for i, t in enumerate(["grass", "fire", "water"]):
    block(f"badge-statue-{t}", 9 + i, 3, 1, 2, "statue", "upper", "solid", overRows=1)
block("gym-fern-pot", 12, 3, 1, 2, "statue", "upper", "solid", overRows=1)
block("gym-brazier", 13, 3, 1, 2, "statue", "upper", "solid", overRows=1)
block("gym-fountain", 14, 3, 2, 2, "statue", "upper", "solid")
# 5행: 바닥 표시·퍼즐
block("trainer-marker", 0, 5, 1, 1, "marker", "upper", "passable")
block("floor-switch-off", 1, 5, 1, 1, "switch", "upper", "passable")
block("floor-switch-on", 2, 5, 1, 1, "switch", "upper", "passable")
block("barrier-closed", 3, 5, 1, 1, "barrier", "upper", "solid")
block("barrier-open", 4, 5, 1, 1, "barrier", "upper", "passable")
block("gym-doormat", 5, 5, 2, 1, "marker", "upper", "passable")
# 6~8행: 이어 깔리는 모래 테두리(합성)
block("shore-sea", 0, 6, 3, 3, "shore", "lower", "solid", openCells=[[1, 1]], openPart="center")
block("shore-sea-inner", 3, 6, 2, 2, "shore", "lower", "solid")
block("sand-wet-edge", 5, 6, 3, 3, "sand-edge", "lower", "passable")
block("sand-wet-edge-inner", 8, 6, 2, 2, "sand-edge", "lower", "passable")
# 9~14행: 항구·해변 소품
block("lighthouse", 0, 9, 3, 6, "structure", "upper", "solid")
block("rowboat", 3, 13, 3, 2, "boat", "upper", "solid")
block("mooring-bollard", 6, 14, 1, 1, "harbor", "upper", "solid")
block("buoy", 7, 14, 1, 1, "harbor", "upper", "solid")
block("rope-coil", 8, 14, 1, 1, "harbor", "upper", "passable")
block("palm-shrub", 9, 14, 1, 1, "beach", "upper", "solid")
block("coconut-pile", 10, 14, 1, 1, "beach", "upper", "solid")
block("beach-umbrella", 11, 13, 2, 2, "beach", "upper", "solid", overRows=1)
block("spiral-shell", 13, 14, 1, 1, "shell", "upper", "passable")
block("scallop-shell", 14, 14, 1, 1, "shell", "upper", "passable")
block("starfish", 15, 14, 1, 1, "shell", "upper", "passable")
block("sea-rock", 16, 14, 1, 1, "beach", "upper", "solid")
block("driftwood", 17, 14, 2, 1, "beach", "upper", "solid")

BY = {b["name"]: b for b in BLOCKS}


def load(name):
    return Image.open(os.path.join(RAW, name + ".png")).convert("RGBA")


def crop_opaque(im):
    a = np.array(im)[..., 3]
    ys, xs = np.where(a > 128)
    return im.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))


def components(im, expect, rows=1):
    """연결 요소를 행 우선(위 줄 왼쪽부터). 작은 부스러기(불꽃 튀김·물방울)는 가장 가까운 큰 성분에 붙인다."""
    arr = np.array(im)
    a = arr[..., 3] > 128
    lab, n = ndimage.label(ndimage.binary_dilation(a, iterations=6))
    sizes = ndimage.sum(a, lab, range(1, n + 1))
    big = [i + 1 for i, s in enumerate(sizes) if s >= sizes.max() * 0.04]
    centers = {i: ndimage.center_of_mass(a, lab, i) for i in range(1, n + 1)}
    owner = {}
    for i in range(1, n + 1):
        if i in big:
            owner[i] = i
        else:
            cy, cx = centers[i]
            owner[i] = min(big, key=lambda b: (centers[b][0] - cy) ** 2 + (centers[b][1] - cx) ** 2)
    if len(big) != expect:
        raise SystemExit(f"성분 {len(big)}개 — 기대 {expect}개")
    out = []
    band = im.height / rows
    for b in sorted(big, key=lambda b: (int(centers[b][0] // band), np.where(lab == b)[1].min())):
        mask = np.isin(lab, [i for i in owner if owner[i] == b]) & a
        piece = arr.copy()
        piece[~mask] = 0
        out.append(crop_opaque(Image.fromarray(piece, "RGBA")))
    return out


def fit(im, w, h, fill=False):
    scale = min(w / im.width, h / im.height)
    tw, th = (w, h) if fill else (max(1, round(im.width * scale)), max(1, round(im.height * scale)))
    arr = np.array(im).astype(np.float32)
    alpha = arr[..., 3:4] / 255.0
    pre = np.concatenate([arr[..., :3] * alpha, arr[..., 3:4]], axis=-1).astype(np.uint8)
    small = np.array(Image.fromarray(pre, "RGBA").resize((tw, th), Image.BOX)).astype(np.float32)
    a = small[..., 3:4] / 255.0
    rgb = np.where(a > 0, small[..., :3] / np.maximum(a, 1e-6), 0)
    out = np.concatenate([np.clip(rgb, 0, 255), small[..., 3:4]], axis=-1).astype(np.uint8)
    out[..., 3] = np.where(out[..., 3] >= 110, 255, 0)
    return Image.fromarray(out, "RGBA")


def place(sheet, sprite, col, row, w, h, valign="bottom"):
    x = col * TILE + (w * TILE - sprite.width) // 2
    y = row * TILE + ((h * TILE - sprite.height) if valign == "bottom" else (h * TILE - sprite.height) // 2)
    sheet.alpha_composite(sprite, (x, y))


def put(sheet, b, sprite, **kw):
    place(sheet, sprite, b["col"], b["row"], b["w"], b["h"], **kw)


def opaque(im):
    """불투명 지형: 가장자리 투명 픽셀을 이웃 색으로 메워 알파 255 로."""
    arr = np.array(im).astype(np.int32)
    a = arr[..., 3] > 0
    if a.all():
        return im
    idx = ndimage.distance_transform_edt(~a, return_distances=False, return_indices=True)
    arr = arr[idx[0], idx[1]]
    arr[..., 3] = 255
    return Image.fromarray(arr.astype(np.uint8), "RGBA")


def build_art(sheet):
    # 바닥 8장: 행 우선(중립 A·B, 풀 A·B / 불 A·B, 물 A·B)
    floors = components(load("gym-floors"), 8, rows=2)
    for i, t in enumerate(["neutral", "grass", "fire", "water"]):
        b = BY[f"gym-floor-{t}"]
        for k in range(2):
            put_tile(sheet, opaque(fit(floors[i * 2 + k], TILE, TILE, fill=True)), b["col"] + k, b["row"])
    # 부두 판자: 가로·세로 판자, 앞면(판자 끝 + 말뚝 + 물). 넷째(젖은 모래 견본)는 합성 젖은 모래로 대신한다.
    dock = components(load("dock-swatches"), 4)
    put_tile(sheet, opaque(fit(dock[0], TILE, TILE, fill=True)), BY["pier-deck-h"]["col"], BY["pier-deck-h"]["row"])
    put_tile(sheet, opaque(fit(dock[1], TILE, TILE, fill=True)), BY["pier-deck-v"]["col"], BY["pier-deck-v"]["row"])
    front = np.array(opaque(fit(dock[2], TILE, TILE, fill=True))).astype(np.int32)
    r, g, bl = front[..., 0], front[..., 1], front[..., 2]
    water = (bl > 150) & (bl > r + 60) & ~((r > 190) & (g > 220))
    water[:7] = False  # 윗부분은 판자
    front[water] = WATER[water]
    put_tile(sheet, Image.fromarray(front.astype(np.uint8), "RGBA"), BY["pier-front"]["col"], BY["pier-front"]["row"])
    # 벽: 기둥 1×2 는 가운데 한 줄을 세로 32px 로 줄여 16칸 반복(가로 무늬가 없어 좌우로 정확히 이어진다).
    walls = components(load("gym-walls"), 6)
    for i, t in enumerate(["grass", "fire", "water"]):
        col = walls[i * 2]
        strip = col.crop((col.width // 2 - 2, 0, col.width // 2 + 3, col.height))
        strip = opaque(fit(strip, 1, 2 * TILE, fill=True))
        column = Image.new("RGBA", (TILE, 2 * TILE))
        for x in range(TILE):
            column.paste(strip, (x, 0))
        b = BY[f"gym-wall-{t}"]
        sheet.paste(column, (b["col"] * TILE, b["row"] * TILE))
        emblem = opaque(fit(walls[i * 2 + 1], 2 * TILE, 2 * TILE, fill=True))
        base = Image.new("RGBA", (2 * TILE, 2 * TILE))
        base.paste(column, (0, 0))
        base.paste(column, (TILE, 0))
        # 가운데 문장판만 얹는다(양옆 2px 는 기둥 무늬 그대로 — 기둥과 이어지게).
        base.paste(emblem.crop((2, 0, 2 * TILE - 2, 2 * TILE)), (2, 0))
        e = BY[f"gym-wall-{t}-emblem"]
        sheet.paste(base, (e["col"] * TILE, e["row"] * TILE))
    # 단상 3개(3×2)
    for piece, t in zip(components(load("gym-podiums"), 3), ["grass", "fire", "water"]):
        put(sheet, BY[f"leader-podium-{t}"], fit(piece, 3 * TILE, 2 * TILE))
    # 조각상·장식 6개
    names = ["badge-statue-grass", "badge-statue-fire", "badge-statue-water", "gym-fern-pot", "gym-brazier", "gym-fountain"]
    for piece, n in zip(components(load("gym-statues"), 6), names):
        b = BY[n]
        put(sheet, b, fit(piece, b["w"] * TILE, b["h"] * TILE))
    # 표시·퍼즐 6개
    names = ["trainer-marker", "floor-switch-off", "floor-switch-on", "barrier-closed", "barrier-open", "gym-doormat"]
    for piece, n in zip(components(load("gym-markers"), 6), names):
        b = BY[n]
        size = (13, 13) if n in ("trainer-marker", "floor-switch-off", "floor-switch-on") else (b["w"] * TILE, b["h"] * TILE)
        put(sheet, b, fit(piece, *size), valign="center")
    # 항구 5개
    names = ["lighthouse", "rowboat", "mooring-bollard", "buoy", "rope-coil"]
    small = {"mooring-bollard": (12, 14), "buoy": (13, 14), "rope-coil": (14, 12)}
    for piece, n in zip(components(load("harbor"), 5), names):
        b = BY[n]
        put(sheet, b, fit(piece, *small.get(n, (b["w"] * TILE, b["h"] * TILE))), valign="center" if n in small else "bottom")
    # 해변 8개
    names = ["palm-shrub", "coconut-pile", "beach-umbrella", "spiral-shell", "scallop-shell", "starfish", "sea-rock", "driftwood"]
    small = {"spiral-shell": (9, 9), "scallop-shell": (10, 9), "starfish": (10, 10), "coconut-pile": (14, 13)}
    for piece, n in zip(components(load("beach-props"), 8), names):
        b = BY[n]
        put(sheet, b, fit(piece, *small.get(n, (b["w"] * TILE, b["h"] * TILE))), valign="center" if n in small else "bottom")


def put_tile(sheet, tile, col, row):
    sheet.paste(tile, (col * TILE, row * TILE))


# ---------------------------------------------------------------------------
# 합성 지형
# ---------------------------------------------------------------------------

def wave(t, amp):
    return amp * math.sin(2 * math.pi * (t % 16) / 16)


def ring_distance(amp, hole):
    """48×48 캔버스의 3×3 테두리 거리장. 양수 = 바깥 재료 쪽. 곧은 변만 주기 16px 물결."""
    d = np.zeros((48, 48), np.float32)
    for y in range(48):
        for x in range(48):
            px, py = x + 0.5, y + 0.5
            dx, dy = max(abs(px - 24) - 8, 0), max(abs(py - 24) - 8, 0)
            s = math.hypot(dx, dy) - 8  # 반폭 8 + 반지름 8 = 칸 중앙(8px) 경계
            if abs(px - 24) <= 8 and abs(py - 24) > 8:
                s -= wave(x, amp)
            if abs(py - 24) <= 8 and abs(px - 24) > 8:
                s -= wave(y, amp)
            d[y, x] = -s if hole else s
    return d


def paint_shore(d):
    """안쪽 = 젖은 모래, 바깥 = 바다. 경계 바다 쪽으로 흰 거품 → 밝은 물 → 얕은 물 → 바다 204."""
    out = np.zeros((48, 48, 4), np.int32)
    for y in range(48):
        for x in range(48):
            s, land, water = d[y, x], WET[y % 16, x % 16], WATER[y % 16, x % 16]
            if s <= -1.2:
                out[y, x] = land
            elif s <= 0:
                out[y, x] = np.clip(land * 0.86, 0, 255); out[y, x, 3] = 255
            elif s <= 1.2:
                out[y, x] = (236, 252, 255, 255)
            elif s <= 2.4:
                out[y, x] = (120, 247, 255, 255)
            elif s <= 3.8:
                out[y, x] = (42, 181, 242, 255)
            else:
                out[y, x] = water
    return out


def paint_sand_edge(d):
    """안쪽 = 마른 모래 0, 바깥 = 젖은 모래. 경계에 한 줄 짙은 모래."""
    out = np.zeros((48, 48, 4), np.int32)
    for y in range(48):
        for x in range(48):
            s, dry, wet = d[y, x], SAND[y % 16, x % 16], WET[y % 16, x % 16]
            if s <= -0.9:
                out[y, x] = dry
            elif s <= 0.4:
                out[y, x] = (214, 150, 74, 255)
            else:
                out[y, x] = wet
    return out


def paste_ring(sheet, ring, pond, b_ring, b_inner):
    for ty in range(3):
        for tx in range(3):
            tile = ring[ty * 16:(ty + 1) * 16, tx * 16:(tx + 1) * 16]
            sheet.paste(Image.fromarray(tile.astype(np.uint8), "RGBA"), ((b_ring["col"] + tx) * TILE, (b_ring["row"] + ty) * TILE))
    # 안쪽 모서리 = 구멍(pond) 캔버스의 네 모서리 칸. [[왼위, 오른위], [왼아래, 오른아래]]
    for iy, ty in enumerate((0, 2)):
        for ix, tx in enumerate((0, 2)):
            tile = pond[ty * 16:(ty + 1) * 16, tx * 16:(tx + 1) * 16]
            sheet.paste(Image.fromarray(tile.astype(np.uint8), "RGBA"), ((b_inner["col"] + ix) * TILE, (b_inner["row"] + iy) * TILE))


CEIL = (44, 48, 70)
CEIL_DOT = (54, 59, 84)
TRIM_DARK = (26, 28, 42)
TRIM_LIGHT = (214, 220, 230)
TRIM_MID = (150, 158, 174)


def ceiling_tiles():
    """천장 8칸. 방 바닥과 닿는 쪽에 4px 테(바닥 쪽부터 중간·밝음·밝음·어두움)를 두른다.
    테는 체비셰프 거리로 그려 모서리에서 직각으로 만난다. 칸 순서:
      0 평면 / 1 왼쪽 가장자리(바닥이 오른쪽) / 2 오른쪽 가장자리(바닥이 왼쪽) / 3 아래 가장자리(바닥이 위)
      4 왼아래 안모서리(바닥이 오른위 대각) / 5 오른아래 안모서리(바닥이 왼위 대각)
      6 입구 왼끝(바닥이 위·오른쪽) / 7 입구 오른끝(바닥이 위·왼쪽)"""
    bands = (TRIM_MID, TRIM_LIGHT, TRIM_LIGHT, TRIM_DARK)
    specs = [(), ("r",), ("l",), ("t",), ("tr",), ("tl",), ("t", "r"), ("t", "l")]
    tiles = []
    for spec in specs:
        t = np.zeros((16, 16, 4), np.int32)
        t[...] = (*CEIL, 255)
        for y in range(0, 16, 4):
            for x in range((y // 4) % 2 * 2, 16, 4):
                t[y, x] = (*CEIL_DOT, 255)
        for y in range(16):
            for x in range(16):
                ds = []
                for side in spec:
                    ds.append({"r": 15 - x, "l": x, "t": y, "tr": max(15 - x, y), "tl": max(x, y)}[side])
                if ds and min(ds) < 4:
                    t[y, x] = (*bands[min(ds)], 255)
        tiles.append(t)
    return tiles


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    art = Image.new("RGBA", (COLS * TILE, ROWS * TILE), (0, 0, 0, 0))
    build_art(art)
    alpha = np.array(art)[..., 3]
    rgb = art.convert("RGB").quantize(PALETTE_COLORS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    art_arr = np.dstack([np.array(rgb), alpha])
    art_arr[alpha == 0] = 0
    sheet = Image.fromarray(art_arr.astype(np.uint8), "RGBA")

    # 합성 칸(팔레트 축소 없음)
    wet = BY["wet-sand"]
    sheet.paste(Image.fromarray(WET.astype(np.uint8), "RGBA"), (wet["col"] * TILE, wet["row"] * TILE))
    paste_ring(sheet, paint_shore(ring_distance(1.2, False)), paint_shore(ring_distance(1.2, True)), BY["shore-sea"], BY["shore-sea-inner"])
    paste_ring(sheet, paint_sand_edge(ring_distance(1.5, False)), paint_sand_edge(ring_distance(1.5, True)), BY["sand-wet-edge"], BY["sand-wet-edge-inner"])
    c = BY["gym-ceiling"]
    for i, t in enumerate(ceiling_tiles()):
        sheet.paste(Image.fromarray(t.astype(np.uint8), "RGBA"), ((c["col"] + i) * TILE, c["row"] * TILE))

    full = Image.new("RGBA", (COLS * TILE, (BASE_ROWS + ROWS) * TILE), (0, 0, 0, 0))
    full.paste(wilds, (0, 0))
    full.paste(sheet, (0, BASE_ROWS * TILE))
    full.save(OUT_PNG, optimize=True)
    blocks = [{**b, "row": b["row"] + BASE_ROWS} for b in BLOCKS]
    with open(MANIFEST, "w", encoding="utf-8") as f:
        json.dump({"file": "monster-gym-coast.png", "baseRows": BASE_ROWS, "baseSheet": "scarloxy-chipset-wilds.png", "blocks": blocks}, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"sheet: {OUT_PNG} ({os.path.getsize(OUT_PNG)} bytes)")
    print(f"manifest: {MANIFEST} ({len(blocks)} blocks)")


if __name__ == "__main__":
    main()

