# 몬스터 수집 게임용 실내 칩셋(회복 센터·도구 상점·주인공 집·연구소) 빌드.
#
# 입력:
#   tiledata/pkmn-interior/raw/*.png  이미지 생성 모델 출력 원본(투명 배경 RGBA). 가구·설비만 여기서 온다.
#     스타일 기준은 tiledata/pkmn-interior/ref/indoor-style-4x.png(Scarloxy 실내·주인공·센터 4배 원본).
#   vendor/scarloxy-mpwsp01/graphics/tilesets/indoor.png  Scarloxy 실내 원본(4배). 바닥·벽 색과 무늬를 여기서 뜬다.
# 출력:
#   public/assets/monster-interior/monster-interior.png  480x256 (16px, 30x16칸 = 480칸) 칩셋
#   src/assets/monsterInteriorManifest.json              블록 배치 + 바닥·벽·틀 칸 이름표
#
# 바닥·벽·틀은 이어 깔려야 하므로 생성 그림을 쓰지 않는다. Scarloxy 실내 원본을 원래 해상도(1/4)로
# 되돌린 뒤 나무 마루·흰 타일(16px 주기)과 벽면 색띠를 그대로 떠서 칸으로 만들고,
# 틀(검은 바깥 + 회색 외곽선 + 흰 띠 3px)은 원본의 침대·옷장 테두리 규칙으로 그린다.
# 카펫·문 매트는 같은 팔레트로 손 도트를 찍는다. 가구는 생성 그림을 빈 열로 나눠 칸 상자에 맞춘다.
#
# 실행: python3 scripts/content/build-monster-interior.py

import json
import os

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAW = os.path.join(ROOT, "tiledata", "pkmn-interior", "raw")
SCARLOXY_INDOOR = os.path.join(ROOT, "vendor", "scarloxy-mpwsp01", "graphics", "tilesets", "indoor.png")
OUT_DIR = os.path.join(ROOT, "public", "assets", "monster-interior")
OUT_PNG = os.path.join(OUT_DIR, "monster-interior.png")
MANIFEST = os.path.join(ROOT, "src", "assets", "monsterInteriorManifest.json")

TILE = 16
COLS, ROWS = 30, 16
PALETTE_COLORS = 96
# 비율을 지키되 칸 상자를 더 채우려고 한 축을 이만큼까지 늘린다(픽셀아트가 뭉개지지 않는 범위).
MAX_STRETCH = 1.25

# 생성 그림 한 장 = 빈 열로 나뉜 물체들(왼쪽부터). (블록 이름, 가로 칸, 세로 칸, 종류, 시트 col, row, 세로 맞춤)
# 세로 맞춤: bottom = 바닥에 닿게(가구), top = 윗줄에 붙게(벽걸이 1칸 소품은 벽 윗줄에 건다).
SOURCES = {
    "fixtures.png": [
        ("stairs-up", 2, 2, "stairs", 0, 3, "bottom"),
        ("stairs-down", 2, 2, "stairs", 2, 3, "bottom"),
        ("wall-window", 2, 2, "wall-decor", 4, 3, "bottom"),
        ("wall-clock", 1, 1, "wall-decor", 6, 3, "top"),
        ("wall-poster", 1, 1, "wall-decor", 7, 3, "top"),
        ("whiteboard", 2, 2, "wall-decor", 8, 3, "bottom"),
    ],
    "center-furniture.png": [
        ("reception-counter", 5, 2, "furniture", 0, 5, "bottom"),
        ("healing-machine", 2, 2, "furniture", 5, 5, "bottom"),
        ("pc-terminal", 1, 2, "furniture", 7, 5, "bottom"),
        ("lobby-bench", 3, 2, "furniture", 8, 5, "bottom"),
        ("potted-plant", 1, 2, "furniture", 11, 5, "bottom"),
    ],
    "shop-furniture.png": [
        ("shelf-wall", 3, 2, "furniture", 12, 5, "bottom"),
        ("shelf-island", 2, 2, "furniture", 15, 5, "bottom"),
        ("shop-counter", 3, 2, "furniture", 17, 5, "bottom"),
        ("drink-cooler", 2, 2, "furniture", 20, 5, "bottom"),
    ],
    "home-furniture.png": [
        ("bed", 2, 3, "furniture", 0, 7, "bottom"),
        ("tv-set", 2, 2, "furniture", 2, 8, "bottom"),
        ("dining-table", 3, 2, "furniture", 4, 8, "bottom"),
        ("chair-down", 1, 1, "furniture", 7, 9, "bottom"),
        ("chair-up", 1, 1, "furniture", 8, 9, "bottom"),
        ("kitchen-counter", 3, 2, "furniture", 9, 8, "bottom"),
    ],
    "lab-furniture.png": [
        ("bookshelf", 2, 2, "furniture", 12, 7, "bottom"),
        ("lab-bench", 3, 2, "furniture", 14, 7, "bottom"),
        ("starter-stand", 3, 2, "furniture", 17, 7, "bottom"),
        ("lab-computer", 2, 2, "furniture", 20, 7, "bottom"),
    ],
}

# Scarloxy 실내 원본(원래 해상도)에서 뜬 색.
OUTLINE = (0x55, 0x5F, 0x64, 255)
BAND = (0xFB, 0xF9, 0xF5, 255)
VOID = (0, 0, 0, 255)


def load(name):
    return Image.open(os.path.join(RAW, name)).convert("RGBA")


def crop_opaque(im):
    a = np.array(im)[..., 3]
    ys, xs = np.where(a > 128)
    return im.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))


def fit_pixels(im, tiles_w, tiles_h):
    """불투명 영역을 칸 상자에 맞춘다. 비율을 지키되 한 축을 MAX_STRETCH 까지 늘려 상자를 채운다."""
    box_w, box_h = tiles_w * TILE, tiles_h * TILE
    sx, sy = box_w / im.width, box_h / im.height
    s = min(sx, sy)
    w = max(1, min(box_w, round(im.width * min(sx, s * MAX_STRETCH))))
    h = max(1, min(box_h, round(im.height * min(sy, s * MAX_STRETCH))))
    # premultiply 후 BOX: 투명 픽셀의 검은 RGB 가 테두리로 번지지 않게 한다.
    arr = np.array(im).astype(np.float32)
    alpha = arr[..., 3:4] / 255.0
    pre = np.concatenate([arr[..., :3] * alpha, arr[..., 3:4]], axis=-1).astype(np.uint8)
    small = np.array(Image.fromarray(pre, "RGBA").resize((w, h), Image.BOX)).astype(np.float32)
    a = small[..., 3:4] / 255.0
    rgb = np.where(a > 0, small[..., :3] / np.maximum(a, 1e-6), 0)
    out = np.concatenate([np.clip(rgb, 0, 255), small[..., 3:4]], axis=-1).astype(np.uint8)
    out[..., 3] = np.where(out[..., 3] >= 110, 255, 0)
    return Image.fromarray(out, "RGBA")


def place(sheet, sprite, col, row, tiles_w, tiles_h, align):
    box_w, box_h = tiles_w * TILE, tiles_h * TILE
    x = col * TILE + (box_w - sprite.width) // 2
    y = row * TILE + (box_h - sprite.height if align == "bottom" else 0)
    sheet.alpha_composite(sprite, (x, y))


def components(im):
    """빈 열 구간으로 물체를 나눠 가로 순서로 뽑는다(작은 부스러기는 버린다)."""
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
    spans = [s for s in spans if s[1] - s[0] > 20]
    return [crop_opaque(im.crop((x0, 0, x1, im.height))) for x0, x1 in spans]


def reduce_palette(sheet):
    alpha = np.array(sheet)[..., 3]
    rgb = sheet.convert("RGB").quantize(PALETTE_COLORS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    out = np.dstack([np.array(rgb), alpha])
    out[alpha == 0] = 0
    return Image.fromarray(out.astype(np.uint8), "RGBA")


# --- 바닥·벽·틀 -------------------------------------------------------------

def scarloxy_native():
    src = Image.open(SCARLOXY_INDOOR).convert("RGBA")
    # 원본은 4배 확대 배포본이다(4x4 블록 일치율 99.97%). 원래 해상도로 되돌린다.
    return np.array(src.resize((src.width // 4, src.height // 4), Image.NEAREST))


def tile_from(arr):
    return Image.fromarray(np.ascontiguousarray(arr).astype(np.uint8), "RGBA")


def wall_face(edge, body, base, line):
    """벽 앞면 2칸(위·아래). Scarloxy 민트 벽과 같은 띠 구성: 윗단 3px · 몸통 · 걸레받이 3px · 선 1px."""
    col = [edge] * 3 + [body] * 25 + [base] * 3 + [line]
    arr = np.array([[c] * TILE for c in col], dtype=np.uint8)
    return tile_from(arr[:TILE]), tile_from(arr[TILE:])


def frame_tile(n=False, s=False, w=False, e=False, corner=None):
    """틀 칸. 검은 바깥에, 방(바닥·벽) 쪽으로 흰 띠 3px + 그 바깥 외곽선 1px 을 두른다.
    n/s/w/e = 그 변 너머에 방이 있다. corner = 대각선 너머에만 방이 있다('se' 등, 바깥 모서리).
    픽셀마다 방까지의 거리 d 를 재서 d<=3 이면 띠, d==4 면 외곽선 — Scarloxy 침대·옷장 테두리와 같은 규칙.
    방이 두 변에 붙으면(안쪽 모서리) 거리의 최솟값이라 띠가 L 자로 이어진다."""
    arr = np.zeros((TILE, TILE, 4), dtype=np.uint8)
    for y in range(TILE):
        for x in range(TILE):
            ds = []
            if s: ds.append(TILE - y)
            if n: ds.append(y + 1)
            if e: ds.append(TILE - x)
            if w: ds.append(x + 1)
            if corner:
                dy = TILE - y if "s" in corner else y + 1
                dx = TILE - x if "e" in corner else x + 1
                ds.append(max(dx, dy))
            d = min(ds) if ds else 99
            arr[y, x] = BAND if d <= 3 else OUTLINE if d == 4 else VOID
    return tile_from(arr)


def rug_tiles(body, dark, light, dot):
    """3x3 깔개(가장자리 칸에 테두리, 가운데 칸은 반복). 칸을 꽉 채운다 — 어느 바닥 위에도 1층으로 깐다."""
    def base():
        arr = np.zeros((TILE, TILE, 4), dtype=np.uint8)
        arr[:] = body
        for y in range(TILE):
            for x in range(TILE):
                if (x % 8, y % 8) in ((2, 2), (6, 6)):
                    arr[y, x] = dot
        return arr
    tiles = {}
    for ry, vn in enumerate(("n", "m", "s")):
        for rx, hn in enumerate(("w", "m", "e")):
            arr = base()
            if vn == "n": arr[0, :] = dark; arr[1:3, :] = light; arr[3, :] = dark
            if vn == "s": arr[15, :] = dark; arr[13:15, :] = light; arr[12, :] = dark
            if hn == "w": arr[:, 0] = dark; arr[:, 1:3] = light; arr[:, 3] = dark
            if hn == "e": arr[:, 15] = dark; arr[:, 13:15] = light; arr[:, 12] = dark
            # 모서리: 바깥 외곽선만 남기고 안쪽 선이 띠를 끊지 않게.
            if vn == "n" and hn == "w": arr[1:3, 1:4] = light; arr[1:4, 1:3] = light; arr[0, :] = dark; arr[:, 0] = dark; arr[3, 3:] = dark; arr[3:, 3] = dark
            if vn == "n" and hn == "e": arr[1:3, 12:15] = light; arr[1:4, 13:15] = light; arr[0, :] = dark; arr[:, 15] = dark; arr[3, :13] = dark; arr[3:, 12] = dark
            if vn == "s" and hn == "w": arr[13:15, 1:4] = light; arr[12:15, 1:3] = light; arr[15, :] = dark; arr[:, 0] = dark; arr[12, 3:] = dark; arr[:13, 3] = dark
            if vn == "s" and hn == "e": arr[13:15, 12:15] = light; arr[12:15, 13:15] = light; arr[15, :] = dark; arr[:, 15] = dark; arr[12, :13] = dark; arr[:13, 12] = dark
            tiles[(rx, ry)] = tile_from(arr)
    return tiles, tile_from(base())


def mat_tiles():
    """문 매트(1칸·2칸). 가장자리 2px 투명 — 바닥 위 3층에 놓는다."""
    dark, mid, lite = (0x2E, 0x6B, 0x45, 255), (0x4B, 0x9A, 0x5E, 255), (0x62, 0xB3, 0x72, 255)
    def mat(w):
        arr = np.zeros((TILE, w * TILE, 4), dtype=np.uint8)
        y0, y1, x0, x1 = 3, 13, 1, w * TILE - 1
        arr[y0:y1, x0:x1] = dark
        for y in range(y0 + 1, y1 - 1):
            for x in range(x0 + 1, x1 - 1):
                arr[y, x] = lite if (x // 2 + y // 2) % 2 == 0 else mid
        return Image.fromarray(arr, "RGBA")
    return mat(1), mat(2)


def draw_terrain(sheet, native):
    blocks, names = [], {}
    def put(img, col, row):
        sheet.paste(img, (col * TILE, row * TILE))
        return row * COLS + col

    # 바닥 1칸들 — 나무 마루·흰 타일은 Scarloxy 원본의 16px 주기를 그대로 뜬다.
    names["floor-wood"] = put(tile_from(native[0:16, 48:64]), 0, 0)
    names["floor-tile"] = put(tile_from(native[0:16, 128:144]), 1, 0)
    red = dict(body=(0xD9, 0x66, 0x5B, 255), dark=(0xA8, 0x43, 0x3F, 255), light=(0xEC, 0x8F, 0x7F, 255), dot=(0xE5, 0x7C, 0x6E, 255))
    teal = dict(body=(0x77, 0xB7, 0xAC, 255), dark=(0x30, 0x6B, 0x78, 255), light=(0xB9, 0xE1, 0xD9, 255), dot=(0x9C, 0xD0, 0xC7, 255))
    red_rug, red_body = rug_tiles(**red)
    teal_rug, teal_body = rug_tiles(**teal)
    names["floor-carpet-red"] = put(red_body, 2, 0)
    names["floor-carpet-teal"] = put(teal_body, 3, 0)
    for label, col in (("floor-wood", 0), ("floor-tile", 1), ("floor-carpet-red", 2), ("floor-carpet-teal", 3)):
        blocks.append({"name": label, "col": col, "row": 0, "w": 1, "h": 1, "kind": "floor"})

    for label, rug, col in (("rug-red", red_rug, 4), ("rug-teal", teal_rug, 7)):
        for (rx, ry), img in rug.items():
            put(img, col + rx, ry)
        blocks.append({"name": label, "col": col, "row": 0, "w": 3, "h": 3, "kind": "rug"})

    # 틀 3x3(바깥 모서리·변·천장) + 안쪽 모서리 2x2.
    frame = {
        "corner-nw": frame_tile(corner="se"), "top": frame_tile(s=True), "corner-ne": frame_tile(corner="sw"),
        "left": frame_tile(e=True), "ceiling": frame_tile(), "right": frame_tile(w=True),
        "corner-sw": frame_tile(corner="ne"), "bottom": frame_tile(n=True), "corner-se": frame_tile(corner="nw"),
    }
    order = [["corner-nw", "top", "corner-ne"], ["left", "ceiling", "right"], ["corner-sw", "bottom", "corner-se"]]
    for ry, line in enumerate(order):
        for rx, key in enumerate(line):
            names["frame-" + key] = put(frame[key], 10 + rx, ry)
    blocks.append({"name": "wall-frame", "col": 10, "row": 0, "w": 3, "h": 3, "kind": "frame"})
    # 안쪽 모서리: 이름은 방이 붙은 두 변. 예) inner-se = 남·동에 방 → 띠가 아래·오른쪽.
    inner = [["inner-se", "inner-sw"], ["inner-ne", "inner-nw"]]
    for ry, line in enumerate(inner):
        for rx, key in enumerate(line):
            d = key.split("-")[1]
            names["frame-" + key] = put(frame_tile(n="n" in d, s="s" in d, w="w" in d, e="e" in d), 13 + rx, ry)
    blocks.append({"name": "wall-frame-inner", "col": 13, "row": 0, "w": 2, "h": 2, "kind": "frame"})

    # 벽 앞면 2칸 3색. 민트·라벤더는 Scarloxy 원본 색 그대로, 크림은 같은 명도 단계로 맞춘 새 색.
    walls = {
        "wall-mint": ((0x9C, 0xD0, 0xC7, 255), (0xB9, 0xE1, 0xD9, 255), (0xFF, 0xF5, 0xD9, 255), (0xA4, 0x63, 0x37, 255)),
        "wall-lavender": ((0x80, 0x7B, 0xA2, 255), (0x8F, 0x8A, 0xB6, 255), (0xB1, 0xCB, 0xD4, 255), (0x6D, 0x69, 0x8A, 255)),
        "wall-cream": ((0xEF, 0xD9, 0xB0, 255), (0xFB, 0xF0, 0xD6, 255), (0xE7, 0xB6, 0x7F, 255), (0xA4, 0x63, 0x37, 255)),
    }
    for i, (label, colors) in enumerate(walls.items()):
        top, bottom = wall_face(*colors)
        names[label + "-upper"] = put(top, 15 + i, 0)
        names[label + "-lower"] = put(bottom, 15 + i, 1)
        blocks.append({"name": label, "col": 15 + i, "row": 0, "w": 1, "h": 2, "kind": "wall"})

    mat1, mat2 = mat_tiles()
    sheet.alpha_composite(mat2, (18 * TILE, 0))
    sheet.alpha_composite(mat1, (20 * TILE, 0))
    blocks.append({"name": "door-mat-wide", "col": 18, "row": 0, "w": 2, "h": 1, "kind": "mat"})
    blocks.append({"name": "door-mat", "col": 20, "row": 0, "w": 1, "h": 1, "kind": "mat"})
    return blocks, names


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    furn = Image.new("RGBA", (COLS * TILE, ROWS * TILE), (0, 0, 0, 0))
    blocks = []
    for file, specs in SOURCES.items():
        comps = components(load(file))
        if len(comps) != len(specs):
            raise SystemExit(f"{file} 성분 {len(comps)}개 — 기대 {len(specs)}개")
        for (name, tw, th, kind, col, row, align), comp in zip(specs, comps):
            place(furn, fit_pixels(comp, tw, th), col, row, tw, th, align)
            blocks.append({"name": name, "col": col, "row": row, "w": tw, "h": th, "kind": kind})
    # 생성 가구만 팔레트를 줄인다. 바닥·벽·틀은 Scarloxy 원본 색을 그대로 지켜야 한다.
    sheet = reduce_palette(furn)
    terrain_blocks, names = draw_terrain(sheet, scarloxy_native())
    blocks = terrain_blocks + blocks
    sheet.save(OUT_PNG, optimize=True)
    with open(MANIFEST, "w", encoding="utf-8") as f:
        json.dump({"file": "monster-interior.png", "columns": COLS, "rows": ROWS, "tiles": names, "blocks": blocks}, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"sheet: {OUT_PNG} ({os.path.getsize(OUT_PNG)} bytes)")
    print(f"manifest: {MANIFEST} ({len(blocks)} blocks, {len(names)} named tiles)")


if __name__ == "__main__":
    main()

