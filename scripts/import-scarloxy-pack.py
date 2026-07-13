# Scarloxy MPWSP01 팩 변환 스크립트
#
# vendor/scarloxy-mpwsp01/graphics/ 원본(2x/4x 업스케일본)을 이 프로젝트의
# RM2K3 규격 리소스로 변환해 public/assets/scarloxy/ 에 출력한다.
#   - 전투 배경: 2:1 -> 640x360
#   - 몬스터 배틀러: 2:1 후 idle 첫 프레임 크롭 -> 96x96
#   - 몬스터 아이콘 / UI 스탯 아이콘: 원본 복사
#   - 전투 이펙트: 2:1 -> 384x96 (96px x 4프레임)
#   - 칩셋: 4:1 -> 16px 타일을 480x256(30x16) 시트 3장으로 재배치
#   - 캐릭셋: 4:1 -> 32x32 프레임을 24x32로 크롭, 4프레임->3패턴 매핑,
#     288x256 시트 2장(캐릭터 8+2)으로 재배치
# 블록 배치 결과는 src/assets/scarloxyPackManifest.json 으로 기록한다.
#
# 실행: python scripts/import-scarloxy-pack.py

import json
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "vendor", "scarloxy-mpwsp01", "graphics")
OUT = os.path.join(ROOT, "public", "assets", "scarloxy")
MANIFEST_OUT = os.path.join(ROOT, "src", "assets", "scarloxyPackManifest.json")

TILE = 16
SHEET_COLS = 30
SHEET_ROWS = 16
CHARSET_FRAME_W = 24
CHARSET_FRAME_H = 32


def load(rel: str) -> Image.Image:
    return Image.open(os.path.join(SRC, rel)).convert("RGBA")


def nearest_downscale(im: Image.Image, factor: int) -> Image.Image:
    return im.resize((im.width // factor, im.height // factor), Image.NEAREST)


def mode_downscale(im: Image.Image, factor: int) -> Image.Image:
    """블록별 최빈색 다운스케일. 업스케일 후 고해상도에서 미세 수정된
    이미지(캐릭터 시트 등)에서 원본 픽셀아트를 복원한다."""
    a = np.array(im)
    h, w = a.shape[:2]
    oh, ow = h // factor, w // factor
    blocks = (
        a[: oh * factor, : ow * factor]
        .reshape(oh, factor, ow, factor, 4)
        .transpose(0, 2, 1, 3, 4)
        .reshape(oh, ow, factor * factor, 4)
    )
    out = np.zeros((oh, ow, 4), dtype=np.uint8)
    for i in range(oh):
        for j in range(ow):
            px, counts = np.unique(blocks[i, j], axis=0, return_counts=True)
            out[i, j] = px[counts.argmax()]
    return Image.fromarray(out)


# ---------------------------------------------------------------------------
# 1. 전투 배경 / 몬스터 / 아이콘 / 이펙트 / UI
# ---------------------------------------------------------------------------

MONSTERS = [
    "Atrox", "Charmadillo", "Cindrill", "Cleaf", "Draem", "Finiette",
    "Finsta", "Friolera", "Gulfin", "Ivieron", "Jacana", "Larvea",
    "Pluma", "Plumette", "Pouch", "Sparchu",
]
BACKDROPS = ["forest", "ice", "sand"]
ATTACKS = ["explosion", "fire", "green", "ice", "scratch", "splash"]
UI_ICONS = ["attack", "defense", "energy", "health", "recovery", "speed", "star"]


def convert_battle_assets(manifest: dict) -> None:
    for name in BACKDROPS:
        im = nearest_downscale(load(f"backgrounds/{name}.png"), 2)
        assert im.size == (640, 360), im.size
        im.save(os.path.join(OUT, f"scarloxy-backdrop-{name}.png"))
    manifest["backdrops"] = BACKDROPS

    for name in MONSTERS:
        sheet = nearest_downscale(load(f"monsters/{name}.png"), 2)
        assert sheet.size == (384, 192), (name, sheet.size)
        # idle 첫 프레임(96px)을 몸통 기준으로 트림·정규화한다. 원본은 몬스터가
        # 96px 프레임 상단에 작게 그려져 있어(예: 라르베아 31×44) 전투 필드에서
        # 배경에 묻혔다 — 몸통을 프레임의 ~86%로 키우고 발밑을 하단에 맞춘다.
        battler = normalize_battler_frame(sheet.crop((0, 0, 96, 96)))
        battler.save(os.path.join(OUT, f"scarloxy-monster-{name.lower()}.png"))
        icon = load(f"icons/{name}.png")
        icon.save(os.path.join(OUT, f"scarloxy-monster-icon-{name.lower()}.png"))
    manifest["monsters"] = [m.lower() for m in MONSTERS]

    for name in ATTACKS:
        im = nearest_downscale(load(f"attacks/{name}.png"), 2)
        assert im.size == (384, 96), (name, im.size)
        im.save(os.path.join(OUT, f"scarloxy-battle-anim-{name}.png"))
    manifest["battleAnimations"] = ATTACKS

    for name in UI_ICONS:
        load(f"ui/{name}.png").save(os.path.join(OUT, f"scarloxy-ui-{name}.png"))
    manifest["uiIcons"] = UI_ICONS


def normalize_battler_frame(frame: Image.Image, target: int = 96, fill: float = 0.86, foot_pad: float = 0.04) -> Image.Image:
    """몬스터 배틀러 프레임을 몸통 기준으로 트림한 뒤 정사각 캔버스에 발밑 정렬.
    몸통 비율은 유지하고, 긴 축이 target*fill이 되도록 최근접 스케일한다."""
    a = np.array(frame.convert("RGBA"))
    ys, xs = np.nonzero(a[..., 3] > 30)
    if len(xs) == 0:
        return frame
    crop = frame.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))
    limit = target * fill
    scale = min(limit / crop.width, limit / crop.height)
    nw = max(1, round(crop.width * scale))
    nh = max(1, round(crop.height * scale))
    scaled = crop.resize((nw, nh), Image.NEAREST)
    canvas = Image.new("RGBA", (target, target), (0, 0, 0, 0))
    x = (target - nw) // 2
    y = target - nh - round(target * foot_pad)
    canvas.paste(scaled, (x, max(0, y)))
    return canvas


# ---------------------------------------------------------------------------
# 2. 칩셋 재배치
# ---------------------------------------------------------------------------

class SheetPacker:
    def __init__(self, name: str):
        self.name = name
        self.image = Image.new("RGBA", (SHEET_COLS * TILE, SHEET_ROWS * TILE), (0, 0, 0, 0))
        self.used = np.zeros((SHEET_ROWS, SHEET_COLS), dtype=bool)
        self.blocks = []

    def place(self, block_name: str, tiles: Image.Image, col: int, row: int, kind: str) -> None:
        w_px, h_px = tiles.size
        assert w_px % TILE == 0 and h_px % TILE == 0, (block_name, tiles.size)
        w, h = w_px // TILE, h_px // TILE
        assert col + w <= SHEET_COLS and row + h <= SHEET_ROWS, (
            f"{self.name}/{block_name} out of bounds at ({col},{row}) size {w}x{h}"
        )
        region = self.used[row : row + h, col : col + w]
        assert not region.any(), f"{self.name}/{block_name} overlaps at ({col},{row})"
        region[:] = True
        self.image.paste(tiles, (col * TILE, row * TILE))
        self.blocks.append(
            {"name": block_name, "col": col, "row": row, "w": w, "h": h, "kind": kind}
        )

    def save(self) -> dict:
        path = os.path.join(OUT, f"scarloxy-chipset-{self.name}.png")
        self.image.save(path)
        return {"file": f"scarloxy-chipset-{self.name}.png", "blocks": self.blocks}


def pad_to_tiles(im: Image.Image) -> Image.Image:
    """타일 경계에 못 미치는 이미지를 투명 여백으로 채워 타일 정렬한다.
    가로는 중앙, 세로는 바닥 기준(오브젝트가 지면에 닿도록)."""
    w = (im.width + TILE - 1) // TILE * TILE
    h = (im.height + TILE - 1) // TILE * TILE
    if (w, h) == im.size:
        return im
    canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    canvas.paste(im, ((w - im.width) // 2, h - im.height))
    return canvas


def replace_placeholder_water(tiles: Image.Image, water_tile: Image.Image) -> Image.Image:
    """world.png 물 섹션의 빗금 자리표시자를 실제 물 타일(프레임 0) 픽셀로
    치환한다. 빗금은 선명한 시안/연시안/흰색 대각선 밴드 조합인데 흰색이
    설원 바닥색과 겹치므로, 선명한 시안이 든 16px 타일만 자리표시자로
    판별한 뒤 그 타일 안의 빗금 계열 픽셀만 바꾼다."""
    a = np.array(tiles)
    w = np.array(water_tile)
    r, g, b = a[..., 0].astype(int), a[..., 1].astype(int), a[..., 2].astype(int)
    vivid = (a[..., 3] > 0) & (r < 120) & (g > 190) & (b > 210)
    stripe_family = (a[..., 3] > 0) & (r < 250) & (g > 190) & (b > 210) & (g + b > r + 240)
    yy, xx = np.mgrid[0 : a.shape[0], 0 : a.shape[1]]
    for ty in range(a.shape[0] // TILE):
        for tx in range(a.shape[1] // TILE):
            sl = np.s_[ty * TILE : (ty + 1) * TILE, tx * TILE : (tx + 1) * TILE]
            if vivid[sl].sum() < 8:
                continue
            mask = stripe_family[sl]
            block = a[sl]
            block[mask] = w[yy[sl][mask] % TILE, xx[sl][mask] % TILE]
    return Image.fromarray(a)


def tile_rect(im: Image.Image, col: int, row: int, w: int, h: int) -> Image.Image:
    return im.crop((col * TILE, row * TILE, (col + w) * TILE, (row + h) * TILE))


def convert_chipsets(manifest: dict) -> None:
    world = mode_downscale(load("tilesets/world.png"), 4)      # 160x336, 10x21 tiles
    coast = mode_downscale(load("tilesets/coast.png"), 4)      # 384x192, 24x12 tiles
    indoor = mode_downscale(load("tilesets/indoor.png"), 4)    # 160x144, 10x9 tiles
    water_frames = [nearest_downscale(load(f"tilesets/water/{i}.png"), 4) for i in range(4)]
    water0 = water_frames[0]

    world = replace_placeholder_water(world, water0)
    coast_f0 = tile_rect(coast, 0, 0, 24, 3)  # 프레임 0 (첫 3행)만 정적 사용

    def obj(rel: str) -> Image.Image:
        return pad_to_tiles(mode_downscale(load(rel), 4))

    sheets = []

    # --- grassland: 초원 지형 + 물 + 나무/바위 + 마을 건물 ------------------
    g = SheetPacker("grassland")
    g.place("grass-terrain", tile_rect(world, 0, 0, 10, 6), 0, 0, "terrain")
    g.place("water-terrain", tile_rect(world, 0, 18, 10, 3), 0, 6, "water")
    g.place("coast-pond-grass", tile_rect(coast_f0, 0, 0, 3, 3), 10, 6, "water")
    g.place("coast-island-grass", tile_rect(coast_f0, 3, 0, 3, 3), 13, 6, "water")
    for i in range(4):
        g.place(f"water-still-{i}", water_frames[i], 16 + i, 6, "water")
    g.place("green-tree", obj("objects/green_tree.png"), 10, 0, "tree")
    g.place("green-tree-bushy", obj("objects/green_tree_bushy.png"), 12, 0, "tree")
    g.place("teal-tree", obj("objects/teal_tree.png"), 14, 0, "tree")
    g.place("teal-tree-bushy", obj("objects/teal_tree_bushy.png"), 16, 0, "tree")
    g.place("green-tree-small", obj("objects/green_tree_small.png"), 18, 0, "tree")
    g.place("teal-tree-small", obj("objects/teal_tree_small.png"), 19, 0, "tree")
    g.place("grass-tuft", obj("objects/grass.png"), 18, 2, "deco")
    g.place("grass-rock-1", obj("objects/grassrock1.png"), 16, 7, "rock")
    g.place("grass-rock-2", obj("objects/grassrock2.png"), 17, 7, "rock")
    g.place("gate-pillar", obj("objects/gate_pillar.png"), 18, 7, "structure")
    g.place("gate-top", obj("objects/gate_top.png"), 20, 0, "overhead")
    g.place("house-small", obj("objects/house_small.png"), 0, 9, "structure")
    g.place("house-small-alt", obj("objects/house_small_alt.png"), 5, 9, "structure")
    g.place("house-large", obj("objects/house_large.png"), 10, 9, "structure")
    g.place("house-large-alt", obj("objects/house_large_alt.png"), 17, 9, "structure")
    g.place("hospital", obj("objects/hospital.png"), 24, 9, "structure")
    sheets.append(g)

    # --- wilds: 사막/설원 지형 + 해안 전체 + 야자수/설목 + 유적 + 아레나 ----
    w = SheetPacker("wilds")
    w.place("sand-terrain", tile_rect(world, 0, 6, 10, 6), 0, 0, "terrain")
    w.place("ice-terrain", tile_rect(world, 0, 12, 10, 6), 10, 0, "terrain")
    w.place("water-terrain", tile_rect(world, 0, 18, 10, 3), 20, 0, "water")
    w.place("coast-frame0", coast_f0, 0, 6, "water")
    for i in range(4):
        w.place(f"water-still-{i}", water_frames[i], 24 + i, 6, "water")
    w.place("palm", obj("objects/palm.png"), 20, 3, "tree")
    w.place("palm-alt", obj("objects/palm_alt.png"), 22, 3, "tree")
    w.place("palm-small", obj("objects/palm_small.png"), 24, 3, "tree")
    w.place("ice-tree", obj("objects/ice_tree.png"), 25, 3, "tree")
    w.place("sand-rock-1", obj("objects/sandrock1.png"), 27, 3, "rock")
    w.place("sand-rock-2", obj("objects/sandrock2.png"), 28, 3, "rock")
    w.place("ice-rock-1", obj("objects/icerock1.png"), 27, 4, "rock")
    w.place("ice-rock-2", obj("objects/icerock2.png"), 28, 4, "rock")
    w.place("grass-ice-tuft", obj("objects/grass_ice.png"), 29, 3, "deco")
    w.place("ruin-gate", obj("objects/ruin_gate.png"), 0, 9, "structure")
    w.place("ruin-pillar", obj("objects/ruin_pillar.png"), 3, 9, "structure")
    w.place("ruin-pillar-broke", obj("objects/ruin_pillar_broke.png"), 4, 9, "structure")
    w.place("ruin-pillar-broke-alt", obj("objects/ruin_pillar_broke_alt.png"), 5, 9, "structure")
    w.place("arena-plant", obj("objects/arena_plant.png"), 6, 9, "structure")
    w.place("arena-fire", obj("objects/arean_fire.png"), 13, 9, "structure")
    w.place("arena-water", obj("objects/arena_water.png"), 20, 9, "structure")
    sheets.append(w)

    # --- indoor: 실내 타일 원본 배치 유지 -----------------------------------
    ind = SheetPacker("indoor")
    ind.place("indoor-all", indoor, 0, 0, "indoor")
    sheets.append(ind)

    manifest["chipsets"] = [s.save() for s in sheets]


# ---------------------------------------------------------------------------
# 3. 캐릭셋 재배치 (RM2K3 288x256, 24x32, 캐릭터당 3패턴 x 4방향)
# ---------------------------------------------------------------------------

# 팩 시트: 4x4 그리드(32px 프레임), 행 = down/left/right/up, 열 = 걸음 프레임.
# 열 0·2는 서있는 자세, 1·3은 좌우 걸음.
PACK_ROW_BY_DIRECTION = {"down": 0, "left": 1, "right": 2, "up": 3}
# RM2K3 캐릭터 블록: 행 = up/right/down/left, 열(패턴) = [걸음A, 중립, 걸음B]
RM2K3_DIRECTIONS = ["up", "right", "down", "left"]
PATTERN_TO_PACK_COL = [1, 0, 3]

CHARSET_SHEETS = [
    ("people1", ["player", "blond", "hat_girl", "purple_girl",
                 "young_girl", "young_guy", "straw", "water_boss"]),
    ("people2", ["fire_boss", "grass_boss"]),
]


def convert_charsets(manifest: dict) -> None:
    out_sheets = []
    for sheet_name, names in CHARSET_SHEETS:
        sheet = Image.new("RGBA", (288, 256), (0, 0, 0, 0))
        for char_index, name in enumerate(names):
            src = mode_downscale(load(f"characters/{name}.png"), 4)  # 128x128
            block_col = (char_index % 4) * 3
            block_row = (char_index // 4) * 4
            for row_offset, direction in enumerate(RM2K3_DIRECTIONS):
                pack_row = PACK_ROW_BY_DIRECTION[direction]
                for pattern, pack_col in enumerate(PATTERN_TO_PACK_COL):
                    frame = src.crop(
                        (pack_col * 32, pack_row * 32, pack_col * 32 + 32, pack_row * 32 + 32)
                    )
                    # 32x32 -> 24x32 중앙 크롭 (내용물 폭은 최대 27px)
                    frame = frame.crop((4, 0, 28, 32))
                    x = (block_col + pattern) * CHARSET_FRAME_W
                    y = (block_row + row_offset) * CHARSET_FRAME_H
                    sheet.paste(frame, (x, y))
        path = os.path.join(OUT, f"scarloxy-charset-{sheet_name}.png")
        sheet.save(path)
        out_sheets.append({"file": f"scarloxy-charset-{sheet_name}.png", "characters": names})
    manifest["charsets"] = out_sheets


def main() -> None:
    if not os.path.isdir(SRC):
        sys.exit(f"source not found: {SRC}")
    os.makedirs(OUT, exist_ok=True)
    manifest = {}
    convert_battle_assets(manifest)
    convert_chipsets(manifest)
    convert_charsets(manifest)
    with open(MANIFEST_OUT, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
        f.write("\n")
    total = sum(len(files) for _, _, files in os.walk(OUT))
    print(f"done: {total} files in {OUT}")
    print(f"manifest: {MANIFEST_OUT}")


if __name__ == "__main__":
    main()
