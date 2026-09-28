# 몬스터 수집 게임용 동굴 칩셋(생성 자산) 빌드.
#
# 입력: tiledata/pkmn-cave/raw/*.png — 이미지 생성 모델 출력 원본(투명 배경 RGBA, 가로 약 2200px).
#   스타일 기준은 Scarloxy 초원 절벽 링·바위(vendor/scarloxy-mpwsp01/graphics)를 4배로 키운 그림이었다.
#   cave-textures  이음매 없는 정사각 견본 6장(흙 바닥·자갈 박힌 흙·자갈·고지대 흙·바위 덩어리·동굴 물)
#   cave-cliff-face 절벽 앞면(왼 끝·반복 띠·오른 끝, 2칸 높이)
#   cave-openings  어두운 굴·밝은 출구·오르는 돌계단·내려가는 계단·사다리(오르기)·사다리 구멍(내려가기)
#   cave-props     작은 석순·큰 석순·밀 바위·깨는 바위·광석 바위·수정·자갈 무더기·돌무더기
#   cave-small     반짝이 2프레임·물웅덩이·바닥 균열·빛 이끼
# 출력:
#   public/assets/monster-cave/monster-cave.png   480x256 (16px, 30x16칸 = 480칸) 칩셋
#   src/assets/monsterCaveManifest.json           블록 배치 + 47 모서리 세트의 마스크→칸 표
#
# 가장자리 네 세트(바위 벽·고지대·물·자갈)는 47칸 블롭이다. 8방 이웃 중 대각은 양옆 직교가 모두
# 이어졌을 때만 의미가 있으므로 256 마스크가 47 모양으로 줄어든다. 모양마다 견본 질감에서 칸을
# 픽셀 단위로 합성한다(열린 변은 바닥 흙이 드러나는 띠, 경계는 1px 외곽선, 북쪽 경계는 밝은 테).
# 솟은 세트(벽·고지대)는 남쪽 띠가 없다 — 그 아래 두 줄에 절벽 앞면을 따로 깐다.
#
# 실행: python3 scripts/content/build-monster-cave.py

import json
import os

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAW = os.path.join(ROOT, "tiledata", "pkmn-cave", "raw")
OUT_DIR = os.path.join(ROOT, "public", "assets", "monster-cave")
OUT_PNG = os.path.join(OUT_DIR, "monster-cave.png")
MANIFEST = os.path.join(ROOT, "src", "assets", "monsterCaveManifest.json")

TILE = 16
COLS, ROWS = 30, 16
PALETTE_COLORS = 96

N, E, S, W, NE, SE, SW, NW = 1, 2, 4, 8, 16, 32, 64, 128

# ---------------------------------------------------------------------------
# 원본 읽기


def load(name):
    return Image.open(os.path.join(RAW, name)).convert("RGBA")


def components(im, min_width=20):
    """빈 열 구간으로 나눠 왼쪽부터 성분을 뽑는다(작은 부스러기는 버린다)."""
    a = np.array(im)[..., 3] > 128
    cols = a.any(axis=0)
    spans, start = [], None
    for x, filled in enumerate(cols):
        if filled and start is None:
            start = x
        elif not filled and start is not None:
            spans.append((start, x))
            start = None
    if start is not None:
        spans.append((start, len(cols)))
    out = []
    for x0, x1 in spans:
        if x1 - x0 <= min_width:
            continue
        part = im.crop((x0, 0, x1, im.height))
        pa = np.array(part)[..., 3] > 128
        ys = np.where(pa.any(axis=1))[0]
        out.append(part.crop((0, int(ys.min()), x1 - x0, int(ys.max()) + 1)))
    return out


def shrink(im, w, h):
    """알파 가중 BOX 축소 후 알파 이진화 — 투명 픽셀의 검은 RGB 가 테두리로 번지지 않게 한다."""
    arr = np.array(im).astype(np.float32)
    alpha = arr[..., 3:4] / 255.0
    pre = np.concatenate([arr[..., :3] * alpha, arr[..., 3:4]], axis=-1).astype(np.uint8)
    small = np.array(Image.fromarray(pre, "RGBA").resize((w, h), Image.BOX)).astype(np.float32)
    a = small[..., 3:4] / 255.0
    rgb = np.where(a > 0, small[..., :3] / np.maximum(a, 1e-6), 0)
    out = np.concatenate([np.clip(rgb, 0, 255), small[..., 3:4]], axis=-1).astype(np.uint8)
    out[..., 3] = np.where(out[..., 3] >= 110, 255, 0)
    return Image.fromarray(out, "RGBA")


def fit(im, box_w, box_h, fill=False):
    if fill:
        return shrink(im, box_w, box_h)
    scale = min(box_w / im.width, box_h / im.height)
    return shrink(im, max(1, round(im.width * scale)), max(1, round(im.height * scale)))


def swatches():
    """이음매 없는 견본 6장 → 16x16 질감. 견본 둘레의 번짐 테두리(약 4px)를 깎고 줄인다."""
    comps = components(load("cave-textures.png"))
    if len(comps) != 6:
        raise SystemExit(f"cave-textures.png 성분 {len(comps)}개 — 기대 6개")
    names = ["dirt", "pebbles", "gravel", "high", "rock", "water"]
    out = {}
    for name, comp in zip(names, comps):
        trim = 6
        c = comp.crop((trim, trim, comp.width - trim, comp.height - trim)).convert("RGB")
        out[name] = np.array(c.resize((TILE, TILE), Image.BOX)).astype(np.int16)
    return out


# ---------------------------------------------------------------------------
# 47 블롭


def reduce_mask(mask):
    """대각 비트는 양옆 직교가 모두 이어졌을 때만 남긴다(47 모양의 대표 마스크)."""
    m = mask & (N | E | S | W)
    if (mask & NE) and (mask & N) and (mask & E):
        m |= NE
    if (mask & SE) and (mask & S) and (mask & E):
        m |= SE
    if (mask & SW) and (mask & S) and (mask & W):
        m |= SW
    if (mask & NW) and (mask & N) and (mask & W):
        m |= NW
    return m


BLOB_MASKS = sorted({reduce_mask(m) for m in range(256)})
assert len(BLOB_MASKS) == 47, len(BLOB_MASKS)


def jag(t, seed):
    """16 주기 0/1 흔들림 — 이웃 칸끼리 같은 좌표에서 같은 깊이가 나오게 좌표만의 함수로 둔다."""
    return (((t % 16) * 7 + seed * 5 + ((t % 16) * (t % 16)) * 3) % 11) < 4


class BlobStyle:
    def __init__(self, key, body, background, inset, outline, highlight, shade, soft=False, jag_seed=1):
        self.key = key
        self.body = body  # 16x16x3 int16
        self.background = background
        self.inset = inset  # dict N/E/S/W → 픽셀
        self.outline = np.array(outline, dtype=np.int16)
        self.highlight = np.array(highlight, dtype=np.int16) if highlight is not None else None
        self.shade = np.array(shade, dtype=np.int16) if shade is not None else None
        self.soft = soft
        self.jag_seed = jag_seed


def inside(style, mask, x, y):
    """(x,y) 픽셀(칸 밖 -1..16 포함)이 그 세트의 몸(바위·물·자갈)인가."""
    n, e, s, w = bool(mask & N), bool(mask & E), bool(mask & S), bool(mask & W)
    # 칸 밖 픽셀: 그 방향 이웃이 이어졌으면 몸, 아니면 바닥.
    if y < 0 and not n:
        return False
    if y > 15 and not s:
        return False
    if x < 0 and not w:
        return False
    if x > 15 and not e:
        return False
    if x < 0 and y < 0 and not (mask & NW):
        return False
    if x > 15 and y < 0 and not (mask & NE):
        return False
    if x < 0 and y > 15 and not (mask & SW):
        return False
    if x > 15 and y > 15 and not (mask & SE):
        return False
    xi, yi = min(max(x, 0), 15), min(max(y, 0), 15)
    seed = style.jag_seed
    dn = style.inset["N"] + (jag(xi, seed) if style.inset["N"] else 0)
    ds = style.inset["S"] + (jag(xi, seed + 2) if style.inset["S"] else 0)
    dw = style.inset["W"] + (jag(yi, seed + 4) if style.inset["W"] else 0)
    de = style.inset["E"] + (jag(yi, seed + 6) if style.inset["E"] else 0)
    if not n and y < dn:
        return False
    if not s and y > 15 - ds:
        return False
    if not w and x < dw:
        return False
    if not e and x > 15 - de:
        return False
    # 볼록 모서리 둥글리기(열린 두 변이 만나는 곳).
    r = 3

    def cut(cx, cy, px, py):
        return (px - cx) ** 2 + (py - cy) ** 2 > r * r

    if not n and not w and x < dw + r and y < dn + r and cut(dw + r, dn + r, x, y):
        return False
    if not n and not e and x > 15 - de - r and y < dn + r and cut(15 - de - r, dn + r, x, y):
        return False
    if not s and not w and x < dw + r and y > 15 - ds - r and cut(dw + r, 15 - ds - r, x, y):
        return False
    if not s and not e and x > 15 - de - r and y > 15 - ds - r and cut(15 - de - r, 15 - ds - r, x, y):
        return False
    # 오목 모서리 홈(두 직교는 이어졌는데 대각이 비었다) — 이웃 칸의 띠와 이어지는 직사각 홈.
    iw, ie = style.inset["W"] or 2, style.inset["E"] or 2
    inn, ins = style.inset["N"] or 2, style.inset["S"] or 0
    if n and w and not (mask & NW) and x < iw and y < inn:
        return False
    if n and e and not (mask & NE) and x > 15 - ie and y < inn:
        return False
    if s and w and not (mask & SW) and x < iw and ins and y > 15 - ins:
        return False
    if s and e and not (mask & SE) and x > 15 - ie and ins and y > 15 - ins:
        return False
    return True


def blob_tile(style, mask):
    img = np.zeros((TILE, TILE, 3), dtype=np.int16)
    grid = [[inside(style, mask, x, y) for x in range(-2, 18)] for y in range(-2, 18)]

    def at(x, y):
        return grid[y + 2][x + 2]

    for y in range(TILE):
        for x in range(TILE):
            if not at(x, y):
                img[y, x] = style.background[y, x]
                continue
            px = style.body[y, x]
            edge_n = not at(x, y - 1)
            edge_s = not at(x, y + 1)
            edge_w = not at(x - 1, y)
            edge_e = not at(x + 1, y)
            if style.soft:
                # 자갈: 외곽선 없이 경계 한 줄만 바탕과 섞는다.
                if edge_n or edge_s or edge_w or edge_e:
                    px = (px + style.background[y, x]) // 2
            elif edge_n or edge_s or edge_w or edge_e:
                px = style.outline
            elif style.highlight is not None and (not at(x, y - 2) or not at(x - 2, y)) and not (not at(x, y + 2)):
                px = style.highlight if not at(x, y - 2) else (px + style.highlight) // 2
            elif style.shade is not None and (not at(x, y + 2) or not at(x + 2, y)):
                px = (px + style.shade) // 2
            img[y, x] = px
    return img


def blob_block(style):
    """47칸을 8열x6행에 대표 마스크 오름차순으로 채운다(마지막 한 칸은 비움)."""
    tiles = [blob_tile(style, m) for m in BLOB_MASKS]
    return tiles


# ---------------------------------------------------------------------------
# 배치


def to_img(arr):
    rgba = np.dstack([np.clip(arr, 0, 255).astype(np.uint8), np.full((arr.shape[0], arr.shape[1]), 255, np.uint8)])
    return Image.fromarray(rgba, "RGBA")


def tile_img(arr):
    return to_img(arr)


def paste_tile(sheet, img, col, row):
    sheet.paste(img, (col * TILE, row * TILE))


def backed(sprite, background, box_w, box_h, anchor="bottom"):
    """투명 조각을 불투명 바탕(칸 배열) 위에 합성한다 — 1층 불투명 칸이 된다."""
    canvas = background.copy()
    x = (box_w - sprite.width) // 2
    y = box_h - sprite.height if anchor == "bottom" else (box_h - sprite.height) // 2
    canvas.alpha_composite(sprite, (x, y))
    return canvas


def repeat(arr, tw, th):
    img = Image.new("RGBA", (tw * TILE, th * TILE))
    t = tile_img(arr)
    for yy in range(th):
        for xx in range(tw):
            img.paste(t, (xx * TILE, yy * TILE))
    return img


def best_period_window(strip, width):
    """가로 반복 띠에서 [x0, x0+width) 창을 고른다 — 창 끝 열이 시작 열과 가장 닮은 곳."""
    a = np.array(strip).astype(np.int32)
    best, best_x = None, 0
    for x0 in range(2, a.shape[1] - width - 2):
        d = int(np.abs(a[:, x0, :3] - a[:, x0 + width, :3]).sum()) + int(np.abs(a[:, x0 - 1, :3] - a[:, x0 + width - 1, :3]).sum())
        if best is None or d < best:
            best, best_x = d, x0
    return best_x


def reduce_palette(sheet):
    alpha = np.array(sheet)[..., 3]
    rgb = sheet.convert("RGB").quantize(PALETTE_COLORS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    out = np.dstack([np.array(rgb), alpha])
    out[alpha == 0] = 0
    return Image.fromarray(out.astype(np.uint8), "RGBA")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    sw = swatches()
    dirt = sw["dirt"]
    outline_rock = (74, 30, 18)
    styles = [
        # (key, 원점 col,row, 스타일)
        ("wall", 0, 0, BlobStyle("wall", sw["rock"], dirt, {"N": 3, "E": 2, "S": 0, "W": 2}, outline_rock, (150, 96, 62), (40, 20, 12), jag_seed=1)),
        ("high", 8, 0, BlobStyle("high", sw["high"], dirt, {"N": 3, "E": 2, "S": 0, "W": 2}, (110, 44, 20), (246, 190, 110), (120, 60, 25), jag_seed=3)),
        ("water", 16, 0, BlobStyle("water", sw["water"], dirt, {"N": 3, "E": 3, "S": 3, "W": 3}, (28, 48, 60), (110, 196, 206), None, jag_seed=5)),
        ("gravel", 0, 6, BlobStyle("gravel", sw["gravel"], dirt, {"N": 2, "E": 2, "S": 2, "W": 2}, (0, 0, 0), None, None, soft=True, jag_seed=7)),
    ]
    sheet = Image.new("RGBA", (COLS * TILE, ROWS * TILE), (0, 0, 0, 0))
    blocks, blobs = [], {}
    for key, col, row, style in styles:
        tiles = blob_block(style)
        mask_to_tile = {}
        for i, (mask, arr) in enumerate(zip(BLOB_MASKS, tiles)):
            c, r = col + i % 8, row + i // 8
            paste_tile(sheet, tile_img(arr), c, r)
            mask_to_tile[mask] = r * COLS + c
        blobs[key] = {"col": col, "row": row, "masks": {str(m): t for m, t in mask_to_tile.items()}}
        blocks.append({"name": f"{key}-blob", "col": col, "row": row, "w": 8, "h": 6, "kind": "blob", "cells": 47})

    def add(name, col, row, w, h, kind, img):
        sheet.paste(img, (col * TILE, row * TILE))
        blocks.append({"name": name, "col": col, "row": row, "w": w, "h": h, "kind": kind})

    dirt_img = tile_img(dirt)
    # 바닥 질감(1층, 칸 하나로 이음매 없이 반복).
    add("floor-dirt", 24, 0, 1, 1, "floor", dirt_img)
    add("floor-pebbles", 25, 0, 1, 1, "floor", tile_img(sw["pebbles"]))

    small = components(load("cave-small.png"))
    if len(small) != 5:
        raise SystemExit(f"cave-small.png 성분 {len(small)}개 — 기대 5개")
    sparkle_a, sparkle_b, puddle, crack, moss = small
    props = components(load("cave-props.png"))
    if len(props) != 8:
        raise SystemExit(f"cave-props.png 성분 {len(props)}개 — 기대 8개")
    stal_s, stal_t, boulder, cracked, ore, crystal, pebble_pile, rubble = props

    # 바닥 장식은 흙 위에 구워 넣은 불투명 1층 칸이다. 투명한 채 3층(통행 가능)에 두면 ★ 이 되어
    # 캐릭터 위에 그려진다 — 물웅덩이가 발을 덮는다.
    add("floor-scatter", 26, 0, 1, 1, "floor-decal", backed(fit(pebble_pile, 12, 9), dirt_img, 16, 16, "center"))
    add("puddle", 27, 0, 1, 1, "floor-decal", backed(fit(puddle, 15, 11), dirt_img, 16, 16, "center"))
    add("floor-crack", 28, 0, 1, 1, "floor-decal", backed(fit(crack, 14, 13), dirt_img, 16, 16, "center"))
    add("glow-moss", 29, 0, 1, 1, "floor-decal", backed(fit(moss, 15, 11), dirt_img, 16, 16, "center"))
    add("sparkle-a", 24, 1, 1, 1, "sparkle", backed(fit(sparkle_a, 11, 11), dirt_img, 16, 16, "center"))
    add("sparkle-b", 25, 1, 1, 1, "sparkle", backed(fit(sparkle_b, 9, 9), dirt_img, 16, 16, "center"))

    openings = components(load("cave-openings.png"))
    if len(openings) != 6:
        raise SystemExit(f"cave-openings.png 성분 {len(openings)}개 — 기대 6개")
    tunnel, exit_, stairs_up, stairs_down, ladder_up, ladder_hole = openings
    add("ladder-hole", 26, 1, 1, 1, "ladder-down", backed(fit(ladder_hole, 16, 13), dirt_img, 16, 16, "center"))
    void = Image.new("RGBA", (TILE, TILE), (14, 8, 6, 255))
    add("void", 27, 1, 1, 1, "void", void)
    add("stairs-down", 28, 1, 2, 1, "stairs-down", backed(fit(stairs_down, 30, 16), repeat(dirt, 2, 1), 32, 16, "center"))

    # 절벽 앞면: 왼 끝·반복 A·반복 B·오른 끝(2칸 높이). 반복 띠에서 A|B 창을 고른다.
    face_parts = components(load("cave-cliff-face.png"))
    if len(face_parts) != 3:
        raise SystemExit(f"cave-cliff-face.png 성분 {len(face_parts)}개 — 기대 3개")
    cap_l, strip, cap_r = face_parts
    strip_small = shrink(strip, round(strip.width * 32 / strip.height), 32)
    x0 = best_period_window(strip_small, 32)
    face_ab = strip_small.crop((x0, 0, x0 + 32, 32))
    # 윗줄의 들쭉날쭉한 투명 홈은 외곽선 색(그늘 틈)으로, 아랫줄 투명은 바닥 흙으로 메운다.
    under = Image.new("RGBA", (32, 32), outline_rock + (255,))
    under.paste(repeat(dirt, 2, 1), (0, 16))
    face_mid = under.copy()
    face_mid.alpha_composite(face_ab)
    cap_bg = repeat(dirt, 1, 2)
    cap_l_img = backed(fit(cap_l, 16, 32, fill=True), cap_bg, 16, 32)
    cap_r_img = backed(fit(cap_r, 16, 32, fill=True), cap_bg, 16, 32)
    face = Image.new("RGBA", (64, 32))
    face.paste(cap_l_img, (0, 0))
    face.paste(face_mid, (16, 0))
    face.paste(cap_r_img, (48, 0))
    add("cliff-face", 24, 2, 4, 2, "face", face)

    # 앞면에 뚫는 조각: 앞면 A|B 위에 합성한 불투명 1층 칸.
    add("ladder-up", 28, 2, 1, 2, "ladder-up", backed(fit(ladder_up, 15, 32), face_mid.crop((0, 0, 16, 32)), 16, 32))
    add("tunnel-dark", 24, 4, 2, 2, "tunnel", backed(fit(tunnel, 32, 31), face_mid, 32, 32))
    add("exit-bright", 26, 4, 2, 2, "tunnel", backed(fit(exit_, 32, 31), face_mid, 32, 32))
    add("stairs-up", 28, 4, 2, 2, "stairs-up", backed(fit(stairs_up, 32, 32), face_mid, 32, 32))

    # 바위·석순 소품(투명 가장자리 → 3층, 막힘). 1칸 소품은 2칸 줄의 아래 칸에 둔다.
    def prop(name, col, row, w, h, sprite, box_w=None, box_h=None):
        img = Image.new("RGBA", (w * TILE, h * TILE))
        s = fit(sprite, box_w or w * TILE, box_h or h * TILE)
        img.alpha_composite(s, ((w * TILE - s.width) // 2, h * TILE - s.height))
        add(name, col, row, w, h, "prop", img)

    prop("stalagmite-small", 8, 7, 1, 1, stal_s, 14, 16)
    prop("stalagmite-tall", 9, 6, 1, 2, stal_t, 14, 32)
    prop("push-boulder", 10, 7, 1, 1, boulder, 15, 15)
    prop("cracked-rock", 11, 7, 1, 1, cracked, 15, 15)
    prop("ore-rock", 12, 7, 1, 1, ore, 15, 15)
    prop("crystal", 13, 7, 1, 1, crystal, 15, 16)
    prop("rubble", 14, 7, 2, 1, rubble, 32, 16)

    sheet = reduce_palette(sheet)
    sheet.save(OUT_PNG, optimize=True)
    manifest = {
        "file": "monster-cave.png",
        "columns": COLS,
        "rows": ROWS,
        "blobMaskBits": {"N": N, "E": E, "S": S, "W": W, "NE": NE, "SE": SE, "SW": SW, "NW": NW},
        "blobs": blobs,
        "blocks": blocks,
    }
    with open(MANIFEST, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"sheet: {OUT_PNG} ({os.path.getsize(OUT_PNG)} bytes)")
    print(f"manifest: {MANIFEST} ({len(blocks)} blocks)")


if __name__ == "__main__":
    main()

