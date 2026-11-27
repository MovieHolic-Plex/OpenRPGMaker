#!/usr/bin/env python3
"""Wave 1: 20 Fantasy & Interior real-source animated props."""
from __future__ import annotations

import sys
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import animator as A


def animate_cellar_hatch(open_path: str) -> list[Image.Image]:
    """`cellar-hatch.png` (16x16) is an open trapdoor with ladder; create real-palette closed lid -> open!"""
    opened = A.load_rgba(open_path)
    w, h = opened.size
    tones = A.sample_palette_tones(opened)
    wood_hi = A.pick_tone(tones, 0.80)
    wood_mid = A.pick_tone(tones, 0.55)
    wood_sh = A.pick_tone(tones, 0.32)
    wood_dk = A.pick_tone(tones, 0.14)

    # Closed hatch cover fitting exact inner frame (x=2..13, y=2..13)
    closed = opened.copy()
    for y in range(2, 13):
        for x in range(2, 14):
            if y in (5, 9):
                c = wood_dk
            elif y in (2, 6, 10):
                c = wood_hi if (x % 3 != 0) else wood_mid
            elif x == 2 or x == 13 or y == 12:
                c = wood_sh
            else:
                c = wood_mid if ((x + y) % 4 != 0) else wood_sh
            closed.putpixel((x, y), c)
    # Iron pull ring in center-bottom (x=6..9, y=9..11)
    for rx, ry, rc in [
        (7, 9, (186, 192, 204, 255)), (8, 9, (186, 192, 204, 255)),
        (6, 10, (124, 130, 142, 255)), (9, 10, (124, 130, 142, 255)),
        (7, 11, (96, 102, 114, 255)), (8, 11, (96, 102, 114, 255)),
    ]:
        closed.putpixel((rx, ry), rc)

    lid = closed.crop((2, 2, 14, 13))  # 12x11 real plank lid
    pad_top = 6
    fw, fh = w, h + pad_top
    oy = pad_top

    f0 = A.make_canvas(fw, fh)
    A.paste_over(f0, closed, 0, oy)

    # F1..F3: lid hinges upward around top edge y=2+oy, progressively revealing exact original ladder!
    frames = [f0]
    for scale_y, up_shift in [(0.72, 2), (0.45, 5), (0.36, 6)]:
        fr = A.make_canvas(fw, fh)
        A.paste_over(fr, opened, 0, oy)
        nh = max(3, int(round(lid.height * scale_y)))
        l_sc = lid.resize((lid.width, nh), Image.NEAREST)
        A.paste_over(fr, l_sc, 2, oy + 2 - up_shift)
        frames.append(fr)

    # F4: Fully open exact original hatch with upright hinged lid resting at back!
    f4 = A.make_canvas(fw, fh)
    A.paste_over(f4, opened, 0, oy)
    l_open = lid.resize((lid.width, 4), Image.NEAREST).transpose(Image.FLIP_TOP_BOTTOM)
    A.paste_over(f4, l_open, 2, oy - 3)
    frames.append(f4)
    return frames


def animate_vault_door(src_path: str) -> list[Image.Image]:
    """Spin heavy steel vault wheel, release bolts, then crack door slightly ajar!"""
    src = A.load_rgba(src_path)
    w, h = src.size
    # Wheel center is (15, 25), radius 6
    cx, cy, r = 15, 25, 6
    wheel_patch = src.crop((cx - r, cy - r, cx + r + 1, cy + r + 1))

    f0 = src.copy()

    # F1 & F2: Wheel turns 45° and 90° + metallic spark on locking bolts
    f1 = src.copy()
    A.paste_over(f1, wheel_patch.rotate(-45, resample=Image.NEAREST), cx - r, cy - r)
    f1.putpixel((6, 20), (255, 244, 186, 255))
    f1.putpixel((6, 30), (255, 244, 186, 255))

    f2 = src.copy()
    A.paste_over(f2, wheel_patch.rotate(-90, resample=Image.NEAREST), cx - r, cy - r)
    for bx, by in ((6, 20), (7, 20), (6, 30), (7, 30)):
        f2.putpixel((bx, by), (255, 230, 134, 255))

    # F3 & F4: Heavy vault slab swings open on left hinge (real pixels foreshortened + dark golden vault inside!)
    tones = A.sample_palette_tones(src)
    door_slab = src.crop((1, 4, 29, 43))
    f3 = src.copy()
    for y in range(4, 43):
        for x in range(1, 29):
            f3.putpixel((x, y), (20, 22, 30, 255) if y < 32 else (56, 44, 24, 255))
    A.project_real_door(f3, door_slab, 1, 4, "left", 32.0, tones)

    f4 = src.copy()
    for y in range(4, 43):
        for x in range(1, 29):
            if y >= 33 and x >= 12 and (x + y) % 3 == 0:
                f4.putpixel((x, y), (236, 196, 82, 255))
            elif y >= 34 and x >= 10:
                f4.putpixel((x, y), (168, 128, 42, 255))
            else:
                f4.putpixel((x, y), (18, 20, 28, 255))
    A.project_real_door(f4, door_slab, 1, 4, "left", 60.0, tones)
    return [f0, f1, f2, f3, f4]


def animate_well_crank(src_path: str) -> list[Image.Image]:
    """Lift the actual wooden bucket up out of the well water with splashing droplets."""
    src = A.load_rgba(src_path)
    w, h = src.size
    # Bucket sits at x=16..23, y=24..31; water surface around x=14..33, y=26..32
    bucket = src.crop((16, 24, 24, 32))
    water_c = src.getpixel((26, 28))
    water_sh = A.scale_rgb(water_c, 0.80)
    lifts = [0, 2, 4, 6, 5]
    frames: list[Image.Image] = []
    for fi, lift in enumerate(lifts):
        if fi == 0:
            frames.append(src.copy())
            continue
        fr = src.copy()
        # Fill vacated bucket water footprint with original water tone + ripple
        for y in range(25, 32):
            for x in range(16, 24):
                fr.putpixel((x, y), water_c if (x + y + fi) % 3 != 0 else water_sh)
        # Water ripple ring on surface
        for rx in range(15, 25):
            if (rx + fi) % 2 == 0:
                fr.putpixel((rx, 30), (192, 232, 246, 255))
        # Paste real bucket lifted upward by `lift` pixels along rope!
        A.paste_over(fr, bucket, 16, 24 - lift)
        # Dripping water droplets below lifted bucket
        for dx, dy in ((18, 32 - lift), (21, 33 - lift), (19, 34 - lift)):
            if 0 <= dx < w and 0 <= dy < h:
                fr.putpixel((dx, dy), (204, 240, 255, 225))
        frames.append(fr)
    return frames


def build_wave1() -> list[dict]:
    items = [
        dict(
            id="treasure-chest", name="오크 보물상자", era="fantasy", motion="hinge-lid", playback="toggle",
            containerStyle="chest", footprint=[2, 2], anchorX=0.5, anchorY=0.9, frameMs=95, se="chest_open",
            tags=["상자", "보물상자", "chest", "판타지"],
            sourcePng="public/assets/beodeul-objects/treasure_chest_closed.png",
            sourceOpenPng="public/assets/beodeul-objects/treasure_chest_open.png",
            frames_img=A.animate_real_pair_chest(
                str(ROOT / "public/assets/beodeul-objects/treasure_chest_closed.png"),
                str(ROOT / "public/assets/beodeul-objects/treasure_chest_open.png"),
            ),
        ),
        dict(
            id="beodeul-wardrobe", name="참나무 양문 옷장", era="fantasy", motion="swing-double", playback="toggle",
            containerStyle="wardrobe", footprint=[2, 3], anchorX=0.5, anchorY=0.92, frameMs=105, se="door_wood",
            tags=["옷장", "장롱", "wardrobe", "양문", "판타지"],
            sourcePng="public/assets/beodeul-objects/wardrobe.png",
            frames_img=A.animate_double_door_from_source(
                str(ROOT / "public/assets/beodeul-objects/wardrobe.png"),
                left_box=(6, 15, 15, 38), right_box=(18, 15, 27, 38), cavity_box=(6, 15, 27, 38),
                pad_x=9, pad_y_top=0, pad_y_bot=5, contents="clothes",
            ),
        ),
        dict(
            id="beodeul-drawers", name="원목 3단 서랍장", era="fantasy", motion="slide-drawer", playback="toggle",
            containerStyle="dresser", footprint=[2, 2], anchorX=0.5, anchorY=0.9, frameMs=95, se="drawer_slide",
            tags=["서랍장", "서랍", "dresser", "판타지"],
            sourcePng="public/assets/beodeul-objects/chest_of_drawers.png",
            frames_img=A.animate_drawers_from_source(
                str(ROOT / "public/assets/beodeul-objects/chest_of_drawers.png"),
                drawer_boxes=[(8, 9, 22, 12), (8, 14, 22, 17)],
                pulls_per_frame=[[0, 0], [1, 0], [3, 1], [3, 2], [3, 2]], pad_y_bot=4,
            ),
        ),
        dict(
            id="beodeul-bookshelf", name="비밀 통로 책장", era="fantasy", motion="slide-door", playback="toggle",
            footprint=[2, 3], anchorX=0.35, anchorY=0.94, frameMs=110, se="stone_scrape",
            tags=["책장", "비밀문", "bookshelf", "기믹"],
            sourcePng="public/assets/beodeul-objects/bookshelf_tall.png",
            frames_img=A.animate_slide_secret_from_source(
                str(ROOT / "public/assets/beodeul-objects/bookshelf_tall.png"),
                slide_px=16, pad_right=16,
            ),
        ),
        dict(
            id="interior-strongbox", name="철제 금고 상자", era="fantasy", motion="hinge-lid", playback="toggle",
            containerStyle="chest", footprint=[2, 2], anchorX=0.5, anchorY=0.92, frameMs=105, se="metal_latch",
            tags=["금고", "철상자", "strongbox", "상자"],
            sourcePng="tiledata/beodeul-interiors/pieces/strongbox.png",
            frames_img=A.animate_hinged_lid_from_source(
                str(ROOT / "tiledata/beodeul-interiors/pieces/strongbox.png"),
                lid_box=(2, 10, 27, 17), seam_y=18, loot_style="gold",
            ),
        ),
        dict(
            id="interior-chest", name="실내 나무 궤짝", era="fantasy", motion="hinge-lid", playback="toggle",
            containerStyle="chest", footprint=[2, 2], anchorX=0.5, anchorY=0.92, frameMs=95, se="chest_open",
            tags=["상자", "궤짝", "chest", "실내"],
            sourcePng="tiledata/beodeul-interiors/pieces/chest.png",
            frames_img=A.animate_hinged_lid_from_source(
                str(ROOT / "tiledata/beodeul-interiors/pieces/chest.png"),
                lid_box=(6, 15, 27, 20), seam_y=21, loot_style="gold",
            ),
        ),
        dict(
            id="interior-wardrobe", name="실내 고목 옷장", era="fantasy", motion="swing-double", playback="toggle",
            containerStyle="wardrobe", footprint=[2, 3], anchorX=0.5, anchorY=0.92, frameMs=105, se="door_wood",
            tags=["옷장", "wardrobe", "실내", "양문"],
            sourcePng="tiledata/beodeul-interiors/pieces/wardrobe.png",
            frames_img=A.animate_double_door_from_source(
                str(ROOT / "tiledata/beodeul-interiors/pieces/wardrobe.png"),
                left_box=(1, 7, 13, 39), right_box=(15, 7, 28, 39), cavity_box=(1, 7, 28, 39),
                pad_x=9, pad_y_top=0, pad_y_bot=5, contents="clothes",
            ),
        ),
        dict(
            id="interior-dresser", name="주방 식기 찬장", era="fantasy", motion="swing-double", playback="toggle",
            containerStyle="cabinet", footprint=[2, 3], anchorX=0.5, anchorY=0.92, frameMs=100, se="door_wood",
            tags=["찬장", "식기장", "cupboard", "주방"],
            sourcePng="tiledata/beodeul-interiors/pieces/dresser.png",
            frames_img=A.animate_double_door_from_source(
                str(ROOT / "tiledata/beodeul-interiors/pieces/dresser.png"),
                left_box=(1, 34, 13, 44), right_box=(16, 34, 28, 44), cavity_box=(1, 34, 28, 44),
                pad_x=8, pad_y_top=0, pad_y_bot=4, contents="locker",
            ),
        ),
        dict(
            id="interior-china-cabinet", name="도자기 진열 장식장", era="fantasy", motion="swing-double", playback="toggle",
            containerStyle="cabinet", footprint=[2, 3], anchorX=0.5, anchorY=0.92, frameMs=100, se="door_wood",
            tags=["장식장", "찬장", "cabinet", "실내"],
            sourcePng="tiledata/beodeul-interiors/pieces/china-cabinet.png",
            frames_img=A.animate_double_door_from_source(
                str(ROOT / "tiledata/beodeul-interiors/pieces/china-cabinet.png"),
                left_box=(2, 35, 14, 44), right_box=(16, 35, 29, 44), cavity_box=(2, 35, 29, 44),
                pad_x=8, pad_y_top=0, pad_y_bot=4, contents="locker",
            ),
        ),
        dict(
            id="interior-nightstand", name="침실 촛불 협탁", era="fantasy", motion="slide-drawer", playback="toggle",
            containerStyle="dresser", footprint=[1, 2], anchorX=0.5, anchorY=0.92, frameMs=95, se="drawer_slide",
            tags=["협탁", "서랍", "nightstand", "침실"],
            sourcePng="tiledata/beodeul-interiors/pieces/nightstand.png",
            frames_img=A.animate_drawers_from_source(
                str(ROOT / "tiledata/beodeul-interiors/pieces/nightstand.png"),
                drawer_boxes=[(1, 22, 12, 25)],
                pulls_per_frame=[[0], [1], [2], [3], [3]], pad_y_bot=3,
            ),
        ),
        dict(
            id="interior-vanity", name="거울 화장대", era="fantasy", motion="slide-drawer", playback="toggle",
            containerStyle="dresser", footprint=[2, 3], anchorX=0.5, anchorY=0.94, frameMs=95, se="drawer_slide",
            tags=["화장대", "서랍", "vanity", "거울"],
            sourcePng="tiledata/beodeul-interiors/pieces/vanity.png",
            frames_img=A.animate_drawers_from_source(
                str(ROOT / "tiledata/beodeul-interiors/pieces/vanity.png"),
                drawer_boxes=[(2, 30, 10, 36), (19, 30, 27, 36)],
                pulls_per_frame=[[0, 0], [1, 0], [3, 1], [3, 2], [3, 2]], pad_y_bot=3,
            ),
        ),
        dict(
            id="interior-writing-desk", name="서재 집필 책상", era="fantasy", motion="slide-drawer", playback="toggle",
            containerStyle="dresser", footprint=[2, 2], anchorX=0.5, anchorY=0.92, frameMs=95, se="drawer_slide",
            tags=["책상", "서랍", "desk", "서재"],
            sourcePng="tiledata/beodeul-interiors/pieces/writing-desk.png",
            frames_img=A.animate_drawers_from_source(
                str(ROOT / "tiledata/beodeul-interiors/pieces/writing-desk.png"),
                drawer_boxes=[(5, 23, 14, 26), (16, 23, 25, 26)],
                pulls_per_frame=[[0, 0], [1, 0], [2, 1], [3, 2], [3, 2]], pad_y_bot=3,
            ),
        ),
        dict(
            id="interior-cashbox", name="상점 금화 돈통", era="fantasy", motion="hinge-lid", playback="toggle",
            containerStyle="chest", footprint=[1, 1], anchorX=0.5, anchorY=0.88, frameMs=90, se="coin_clink",
            tags=["돈통", "금고", "cashbox", "상점"],
            sourcePng="tiledata/beodeul-interiors/pieces/goods-cashbox.png",
            frames_img=A.animate_hinged_lid_padded(
                str(ROOT / "tiledata/beodeul-interiors/pieces/goods-cashbox.png"),
                lid_box=(2, 4, 9, 7), seam_y=8, pad_top=4, loot_style="gold",
            ),
        ),
        dict(
            id="interior-cellar-hatch", name="지하실 바닥 해치", era="fantasy", motion="hinge-lid", playback="toggle",
            footprint=[1, 1], anchorX=0.5, anchorY=0.88, frameMs=105, se="wood_creak",
            tags=["다락문", "해치", "trapdoor", "지하실"],
            sourcePng="tiledata/beodeul-interiors/pieces/cellar-hatch.png",
            frames_img=animate_cellar_hatch(str(ROOT / "tiledata/beodeul-interiors/pieces/cellar-hatch.png")),
        ),
        dict(
            id="interior-vault-door", name="은행 강철 금고문", era="fantasy", motion="swing-single", playback="toggle",
            footprint=[2, 3], anchorX=0.5, anchorY=0.94, frameMs=120, se="metal_heavy",
            tags=["금고문", "은행", "vault", "기믹"],
            sourcePng="tiledata/beodeul-interiors/pieces/vault-door.png",
            frames_img=animate_vault_door(str(ROOT / "tiledata/beodeul-interiors/pieces/vault-door.png")),
        ),
        dict(
            id="interior-cell-door", name="감옥 철창문", era="fantasy", motion="slide-door", playback="toggle",
            footprint=[1, 2], anchorX=0.5, anchorY=0.94, frameMs=100, se="metal_grate",
            tags=["감옥", "철창", "cell", "문"],
            sourcePng="tiledata/beodeul-interiors/pieces/cell-door.png",
            frames_img=A.animate_split_doors_from_source(
                str(ROOT / "tiledata/beodeul-interiors/pieces/cell-door.png"),
                door_box=(1, 5, 14, 28), mode="slide-right", interior_tint=(16, 18, 24),
            ),
        ),
        dict(
            id="fireplace-stone", name="돌 벽난로 점화", era="fantasy", motion="activate-loop", playback="loopAfterOpen",
            loopFromFrame=3, footprint=[3, 3], anchorX=0.5, anchorY=0.92, frameMs=110, se="fire_ignite",
            tags=["벽난로", "불", "fireplace", "실내"],
            sourcePng="public/assets/beodeul-objects/fireplace_stone.png",
            frames_img=A.animate_flame_or_lamp_from_source(
                str(ROOT / "public/assets/beodeul-objects/fireplace_stone.png"),
                flame_box=(13, 25, 34, 36), mode="ignite",
            ),
        ),
        dict(
            id="brick-fireplace", name="붉은 벽돌 벽난로", era="fantasy", motion="activate-loop", playback="loopAfterOpen",
            loopFromFrame=3, footprint=[3, 3], anchorX=0.5, anchorY=0.94, frameMs=110, se="fire_ignite",
            tags=["벽난로", "화덕", "brick", "실내"],
            sourcePng="tiledata/beodeul-interiors/pieces/brick-fireplace.png",
            frames_img=A.animate_flame_or_lamp_from_source(
                str(ROOT / "tiledata/beodeul-interiors/pieces/brick-fireplace.png"),
                flame_box=(12, 26, 35, 42), mode="ignite",
            ),
        ),
        dict(
            id="bread-oven", name="빵집 돌화덕 가열", era="fantasy", motion="activate-loop", playback="loopAfterOpen",
            loopFromFrame=3, footprint=[3, 3], anchorX=0.5, anchorY=0.94, frameMs=115, se="fire_ignite",
            tags=["화덕", "빵가마", "oven", "주방"],
            sourcePng="tiledata/beodeul-interiors/pieces/bread-oven.png",
            frames_img=A.animate_flame_or_lamp_from_source(
                str(ROOT / "tiledata/beodeul-interiors/pieces/bread-oven.png"),
                flame_box=(15, 16, 32, 28), mode="ignite",
            ),
        ),
        dict(
            id="well-bucket-crank", name="도르래 돌우물", era="fantasy", motion="toggle-switch", playback="oneshot",
            footprint=[3, 3], anchorX=0.5, anchorY=0.90, frameMs=105, se="water_splash",
            tags=["우물", "두레박", "well", "마을"],
            sourcePng="public/assets/beodeul-objects/well_bucket_crank.png",
            frames_img=animate_well_crank(
                str(ROOT / "public/assets/beodeul-objects/well_bucket_crank.png"),
            ),
        ),
    ]
    for it in items:
        it["wave"] = "wave1-fantasy"
        it["frames"] = len(it["frames_img"])
        it["frameWidth"], it["frameHeight"] = it["frames_img"][0].size
    return items


def save_and_audit(items: list[dict], wave_tag: str) -> Path:
    out_dir = ROOT / "qa-runs/harnesses/interactive-props" / wave_tag
    out_dir.mkdir(parents=True, exist_ok=True)
    for it in items:
        A.pack_strip(it["frames_img"]).save(out_dir / f"{it['id']}.png")

    # Zoomed 5-frame audit sheet (2 columns of 10 items -> 20 items cleanly readable!)
    half = (len(items) + 1) // 2
    col_w = 104
    row_h = 112
    lbl_w = 148
    panel_w = lbl_w + 5 * col_w
    sheet = Image.new("RGBA", (panel_w * 2 + 12, half * row_h), (26, 28, 36, 255))
    d = ImageDraw.Draw(sheet)

    for idx, it in enumerate(items):
        side = 0 if idx < half else 1
        r = idx if idx < half else idx - half
        px0 = side * (panel_w + 12)
        py0 = r * row_h
        d.rectangle([px0, py0, px0 + panel_w - 1, py0 + row_h - 1], outline=(52, 56, 70, 255))
        d.text((px0 + 8, py0 + 18), it["id"], fill=(242, 245, 252, 255))
        d.text((px0 + 8, py0 + 36), f"{it['frameWidth']}x{it['frameHeight']}", fill=(160, 170, 190, 255))
        d.text((px0 + 8, py0 + 52), it["motion"], fill=(132, 182, 224, 255))
        for c, fr in enumerate(it["frames_img"]):
            cx0 = px0 + lbl_w + c * col_w
            d.rectangle([cx0 + 3, py0 + 5, cx0 + col_w - 4, py0 + row_h - 6], fill=(42, 46, 58, 255), outline=(66, 72, 88, 255))
            s = max(1, int(min(2, (col_w - 12) / fr.width, (row_h - 16) / fr.height)))
            big = fr.resize((fr.width * s, fr.height * s), Image.NEAREST)
            sheet.alpha_composite(big, (cx0 + (col_w - big.width) // 2, py0 + (row_h - big.height) // 2))

    audit_path = out_dir / f"{wave_tag}-audit.png"
    sheet.save(audit_path)
    print(f"SAVED {len(items)} strips + audit sheet -> {audit_path}")
    return audit_path


if __name__ == "__main__":
    save_and_audit(build_wave1(), "wave1-fantasy")
