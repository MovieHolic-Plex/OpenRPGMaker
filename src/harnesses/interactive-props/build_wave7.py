#!/usr/bin/env python3
"""Wave 7: 16 Real-Source Push-In Doors, Push-Through Curtains/Noren & Pass-Through Gates."""
from __future__ import annotations

import math
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import animator as A
from build_wave1 import save_and_audit


def animate_confessional_push(src_path: str) -> list[Image.Image]:
    """
    Confessional booth: right lattice wooden door swings INWARD into dark booth,
    while left purple velvet curtain parts aside slightly!
    Frame 0 = exact original PNG.
    """
    src = A.load_rgba(src_path)
    w, h = src.size
    tones = A.sample_palette_tones(src, (18, 7, 27, 41))
    door_img = src.crop((18, 7, 28, 42))
    curt_box = (3, 7, 13, 41)
    curt_img = src.crop((3, 7, 14, 42))

    angles = [0.0, 26.0, 52.0, 72.0, 82.0]
    curt_scales = [1.0, 0.84, 0.64, 0.50, 0.45]
    frames: list[Image.Image] = []
    for fi, (ang, csc) in enumerate(zip(angles, curt_scales)):
        fr = src.copy()
        if fi == 0:
            frames.append(fr)
            continue
        # Left booth dark interior + parted real purple curtain
        A._draw_doorway_interior(fr, curt_box, mode="dark_room")
        nw = max(3, int(round(curt_img.width * csc)))
        c_res = curt_img.resize((nw, curt_img.height), Image.NEAREST)
        for yy in range(c_res.height):
            for xx in range(nw):
                c = c_res.getpixel((xx, yy))
                if c[3] >= 128:
                    fold = 0.85 if xx == nw - 1 else (1.05 if xx % 2 == 0 else 0.94)
                    fr.putpixel((3 + xx, 7 + yy), A.scale_rgb(c, fold))
        # Right booth dark interior + inward-pushing real lattice door
        A._draw_doorway_interior(fr, (18, 7, 27, 41), mode="dark_room")
        A.project_real_door_inward(fr, door_img, 27, 7, "right", ang, tones, top_clip_y=7)
        frames.append(fr)
    return frames


def animate_tent_flaps_push(
    src_path: str,
    flap_box: tuple[int, int, int, int],
    warm_glow: bool = True,
) -> list[Image.Image]:
    """Part real canvas/dome tent doorway flaps smoothly inward to reveal a warm shadowed tent interior."""
    src = A.load_rgba(src_path)
    w, h = src.size
    x0, y0, x1, y1 = flap_box
    cw = x1 - x0 + 1
    ch = y1 - y0 + 1
    mid = (x0 + x1) // 2
    left_flap = src.crop((x0, y0, mid + 1, y1 + 1))
    right_flap = src.crop((mid + 1, y0, x1 + 1, y1 + 1))
    lw, rw = left_flap.width, right_flap.width

    scales = [1.0, 0.78, 0.56, 0.36, 0.30]
    frames: list[Image.Image] = []
    for fi, sc in enumerate(scales):
        fr = src.copy()
        if fi == 0:
            frames.append(fr)
            continue
        # Paint triangular/arched interior inside flap_box only where original was opaque
        for y in range(y0, y1 + 1):
            v = (y - y0) / max(1, ch - 1)
            # Narrower opening near tent apex
            half_open = int(round((cw * 0.5) * (0.28 + 0.72 * v)))
            for x in range(max(x0, mid - half_open), min(x1 + 1, mid + half_open + 1)):
                if src.getpixel((x, y))[3] < 128:
                    continue
                if warm_glow and v > 0.35 and abs(x - mid) <= max(1, half_open - 1):
                    # Soft cozy warm lantern glow deep inside open tent
                    if v > 0.52 and abs(x - mid) <= 3:
                        c = (134, 94, 48, 255) if (x + y) % 2 == 0 else (112, 76, 38, 255)
                    else:
                        c = (56, 40, 28, 255)
                else:
                    c = (28, 22, 24, 255)
                fr.putpixel((x, y), c)
        nlw = max(2, int(round(lw * sc)))
        nrw = max(2, int(round(rw * sc)))
        l_res = left_flap.resize((nlw, ch), Image.NEAREST)
        r_res = right_flap.resize((nrw, ch), Image.NEAREST)
        for yy in range(ch):
            v = yy / max(1, ch - 1)
            # Keep apex joined, peel outward further down
            shift = int(round((1.0 - sc) * (cw * 0.16) * v))
            for xx in range(nlw):
                c = l_res.getpixel((xx, yy))
                if c[3] >= 128:
                    nx = max(x0, x0 + xx - shift)
                    fr.putpixel((nx, y0 + yy), A.scale_rgb(c, 0.88 if xx == nlw - 1 else 1.0))
            for xx in range(nrw):
                c = r_res.getpixel((xx, yy))
                if c[3] >= 128:
                    nx = min(x1, x1 - nrw + 1 + xx + shift)
                    fr.putpixel((nx, y0 + yy), A.scale_rgb(c, 0.88 if xx == 0 else 1.0))
        frames.append(fr)
    return frames


def animate_lock_sluice_push(src_path: str) -> list[Image.Image]:
    """
    Canal wooden sluice double gate: preserve the curved wooden top arch beam (y<12),
    swing the two vertical slat gates INWARD into rushing foamy canal water!
    Frame 0 = exact original PNG.
    """
    src = A.load_rgba(src_path)
    tones = A.sample_palette_tones(src, (4, 12, 27, 26))
    door_l = src.crop((4, 12, 16, 27))
    door_r = src.crop((16, 12, 28, 27))
    # Preserve the curved top wooden arch & side stone posts above y=12
    arch_cap = src.crop((0, 0, src.width, 12))

    angles = [0.0, 26.0, 52.0, 72.0, 82.0]
    frames: list[Image.Image] = [src.copy()]
    for fi, ang in enumerate(angles[1:], start=1):
        fr = src.copy()
        A._draw_doorway_interior(fr, (4, 12, 27, 26), mode="water")
        # Animated white water foam ripples surging outward at bottom
        for fx in range(8, 24):
            if (fx + fi) % 2 == 0:
                fr.putpixel((fx, 26 + (fx % 2)), (222, 246, 255, 255))
            if 10 <= fx <= 21 and (fx + fi) % 3 == 0:
                fr.putpixel((fx, 28), (186, 232, 250, 235))
        A.project_real_door_inward(fr, door_l, 4, 12, "left", ang, tones, top_clip_y=12)
        A.project_real_door_inward(fr, door_r, 27, 12, "right", ang, tones, top_clip_y=12)
        # Re-composite the intact curved top arch beam cleanly on top
        A.paste_over(fr, arch_cap, 0, 0)
        frames.append(fr)
    return frames


def animate_subway_fare_gates(src_path: str) -> list[Image.Image]:
    """
    Subway fare gates: IC card reader flashes cyan/green LED + green passage indicator strips,
    while the twin metallic flap gates in BOTH aisles swing smoothly INWARD into the pedestals!
    Frame 0 = exact original PNG.
    """
    src = A.load_rgba(src_path)
    w, h = src.size
    aisles = [(14, 13, 18, 17), (30, 13, 34, 17)]
    led_decks = [(9, 10), (10, 10), (11, 10), (25, 10), (26, 10), (27, 10), (41, 10), (42, 10), (43, 10)]
    front_arrows = [(8, 16), (9, 16), (24, 16), (25, 16), (40, 16), (41, 16)]

    frames: list[Image.Image] = [src.copy()]
    flap_fracs = [1.0, 0.78, 0.45, 0.18, 0.0]
    for fi in range(1, 5):
        fr = src.copy()
        led_col = (92, 248, 164, 255) if fi >= 2 else (112, 234, 255, 255)
        for lx, ly in led_decks:
            fr.putpixel((lx, ly), led_col)
            fr.putpixel((lx, ly + 1), A.scale_rgb(led_col, 0.75))
        if fi >= 2:
            for ax, ay in front_arrows:
                fr.putpixel((ax, ay), (86, 238, 154, 255))
        frac = flap_fracs[fi]
        for ax0, ay0, ax1, ay1 in aisles:
            flap_patch = src.crop((ax0, ay0, ax1 + 1, ay1 + 1))
            for y in range(ay0, ay1 + 1):
                for x in range(ax0, ax1 + 1):
                    fr.putpixel((x, y), (0, 0, 0, 0))
            if frac > 0.05:
                nw = max(1, int(round(flap_patch.width * frac)))
                fl_res = flap_patch.resize((nw, flap_patch.height), Image.NEAREST)
                dy = -1 if fi >= 2 else 0
                for yy in range(fl_res.height):
                    for xx in range(nw):
                        c = fl_res.getpixel((xx, yy))
                        if c[3] >= 128 and 0 <= ay0 + yy + dy < h:
                            fr.putpixel((ax0 + xx, ay0 + yy + dy), A.scale_rgb(c, 0.90))
        frames.append(fr)
    return frames


def animate_parking_barrier(src_path: str) -> list[Image.Image]:
    """
    Parking barrier gate: red-and-white striped arm smoothly lifts upward 78° around
    its real pivot at (11, 14.5) using inverse affine sampling (zero holes, zero ghost bar!).
    Frame 0 = exact original PNG (with extra top headroom for the raised arm).
    """
    src = A.load_rgba(src_path)
    sw, sh = src.size
    pad_top = 24
    fw, fh = sw, sh + pad_top
    oy = pad_top

    # Cleanly remove the entire horizontal bar (x=13..47, y=10..14) while keeping the left housing & right rest post (y>=21)
    bar_x0, bar_y0, bar_x1, bar_y1 = 11, 10, 46, 14
    base = src.copy()
    for y in range(10, 15):
        for x in range(13, 48):
            base.putpixel((x, y), (0, 0, 0, 0))

    piv_x, piv_y = 11.5, 12.0
    angles_deg = [0.0, 20.0, 44.0, 66.0, 78.0]
    frames: list[Image.Image] = []
    for fi, ang in enumerate(angles_deg):
        fr = A.make_canvas(fw, fh)
        if fi == 0:
            A.paste_over(fr, src, 0, oy)
            frames.append(fr)
            continue
        A.paste_over(fr, base, 0, oy)
        # Green indicator light on barrier housing top
        for lx, ly in ((6, oy + 9), (7, oy + 9), (8, oy + 9)):
            fr.putpixel((lx, ly), (104, 246, 148, 255))
        # Inverse affine map every destination pixel back into the real bar rectangle (100% solid, zero gaps!)
        rad = math.radians(ang)  # inverse of -ang rotation
        cos_a, sin_a = math.cos(rad), math.sin(rad)
        for py in range(fh):
            dy = (py - oy) - piv_y
            for px in range(fw):
                dx = px - piv_x
                sx = piv_x + dx * cos_a - dy * sin_a
                sy = piv_y + dx * sin_a + dy * cos_a
                isx, isy = int(round(sx)), int(round(sy))
                if bar_x0 <= isx <= bar_x1 and bar_y0 <= isy <= bar_y1:
                    c = src.getpixel((isx, isy))
                    if c[3] >= 128:
                        fr.putpixel((px, py), c)
        frames.append(fr)
    return frames


def animate_photo_booth_curtain(src_path: str) -> list[Image.Image]:
    """Arcade photo booth orange curtain pushed aside to reveal dark interior + bright camera flash on F3."""
    frames = A.animate_curtain_push_from_source(
        src_path, curtain_box=(6, 10, 25, 25), mode="slide_left", interior="dark_room"
    )
    # Subtle camera flash glint inside booth on frame 3
    f3 = frames[3]
    for fx, fy, fc in [
        (20, 14, (255, 252, 224, 255)),
        (19, 14, (216, 242, 255, 220)),
        (21, 14, (216, 242, 255, 220)),
        (20, 13, (216, 242, 255, 220)),
        (20, 15, (216, 242, 255, 220)),
    ]:
        f3.putpixel((fx, fy), fc)
    return frames


def build_wave7() -> list[dict]:
    items = [
        # --- 1. Authentic 8-frame real inward-pushing oak house door! ---
        dict(
            id="door-push-house-oak", name="버들항 밀고 들어가는 참나무 문", era="fantasy",
            motion="swing-single", playback="toggle",
            footprint=[1, 2], anchorX=0.5, anchorY=0.95, frameMs=95, se="door_wood",
            tags=["밀기문", "미는문", "여닫이문", "출입문", "참나무문", "문", "판타지"],
            sourcePng="public/assets/beodeul-door/door-0.png",
            frames_img=A.animate_frame_sequence([
                ROOT / "public/assets/beodeul-door/door-0.png",
                ROOT / "public/assets/beodeul-door/door-2.png",
                ROOT / "public/assets/beodeul-door/door-4.png",
                ROOT / "public/assets/beodeul-door/door-6.png",
                ROOT / "public/assets/beodeul-door/door-7.png",
            ]),
        ),
        # --- 2. Arched desert wooden room push-in door ---
        dict(
            id="door-push-desert-arch", name="사막 아치형 밀기 나무문", era="fantasy",
            motion="swing-single", playback="toggle",
            footprint=[1, 2], anchorX=0.5, anchorY=0.95, frameMs=100, se="door_wood",
            tags=["밀기문", "미는문", "아치문", "출입문", "나무문", "문", "판타지"],
            sourcePng="tiledata/desert-east/variety/pieces/de-room-door.png",
            frames_img=A.animate_push_in_door_from_source(
                str(ROOT / "tiledata/desert-east/variety/pieces/de-room-door.png"),
                door_box=(3, 8, 12, 28), side="left", interior="warm_room", pad_top=0, top_clip_to_door=True,
            ),
        ),
        # --- 3. Heavy dungeon iron-slat cell push-in door ---
        dict(
            id="door-push-dungeon-cell", name="던전 철격자 밀기 감옥문", era="dungeon",
            motion="swing-single", playback="toggle",
            footprint=[1, 2], anchorX=0.5, anchorY=0.95, frameMs=105, se="metal_grate",
            tags=["밀기문", "미는문", "감옥문", "철문", "던전", "문"],
            sourcePng="tiledata/hand-interior/plus/oneshot/pieces/in-cell-door.png",
            frames_img=A.animate_push_in_door_from_source(
                str(ROOT / "tiledata/hand-interior/plus/oneshot/pieces/in-cell-door.png"),
                door_box=(1, 4, 14, 29), side="left", interior="dark_room", pad_top=0, top_clip_to_door=True,
            ),
        ),
        # --- 4. Church confessional booth inward push door + curtain ---
        dict(
            id="door-push-confessional", name="성당 고해실 밀기 문·커튼", era="fantasy",
            motion="swing-single", playback="toggle",
            footprint=[2, 3], anchorX=0.5, anchorY=0.94, frameMs=105, se="door_wood",
            tags=["밀기문", "고해실", "성당", "커튼", "문", "판타지"],
            sourcePng="tiledata/beodeul-interiors/pieces/confessional.png",
            frames_img=animate_confessional_push(
                str(ROOT / "tiledata/beodeul-interiors/pieces/confessional.png"),
            ),
        ),
        # --- 5. Ranch paddock wooden single push-in gate ---
        dict(
            id="door-push-paddock-gate", name="목장 나무 울타리 밀기문", era="fantasy",
            motion="swing-single", playback="toggle",
            footprint=[2, 1], anchorX=0.5, anchorY=0.90, frameMs=95, se="door_wood",
            tags=["밀기문", "미는문", "목장문", "울타리문", "게이트", "판타지"],
            sourcePng="tiledata/beodeul-objects/pieces/bd-paddock-gate.png",
            frames_img=A.animate_push_in_door_from_source(
                str(ROOT / "tiledata/beodeul-objects/pieces/bd-paddock-gate.png"),
                door_box=(4, 1, 26, 14), side="left", interior="transparent", pad_top=4, top_clip_to_door=False,
            ),
        ),
        # --- 6. Village white picket push-in gate ---
        dict(
            id="door-push-picket-gate", name="마을 하얀 울타리 밀기문", era="fantasy",
            motion="swing-single", playback="toggle",
            footprint=[1, 1], anchorX=0.5, anchorY=0.90, frameMs=95, se="door_wood",
            tags=["밀기문", "미는문", "울타리문", "정원문", "마을", "판타지"],
            sourcePng="tiledata/beodeul-objects/pieces/bd-picket-gate.png",
            frames_img=A.animate_push_in_door_from_source(
                str(ROOT / "tiledata/beodeul-objects/pieces/bd-picket-gate.png"),
                door_box=(4, 1, 12, 14), side="left", interior="transparent", pad_top=3, top_clip_to_door=False,
            ),
        ),
        # --- 7. Manor wrought-iron double push-in gate ---
        dict(
            id="door-push-iron-garden", name="저택 철제 양문 밀기 대문", era="fantasy",
            motion="swing-double", playback="toggle",
            footprint=[2, 1], anchorX=0.5, anchorY=0.90, frameMs=105, se="metal_grate",
            tags=["밀기문", "양문", "철제대문", "정원문", "저택", "판타지"],
            sourcePng="tiledata/beodeul-objects/pieces/bd-iron-gate.png",
            frames_img=A.animate_push_in_double_door_from_source(
                str(ROOT / "tiledata/beodeul-objects/pieces/bd-iron-gate.png"),
                left_box=(5, 1, 15, 13), right_box=(16, 1, 26, 13), cavity_box=(5, 1, 26, 13),
                interior="transparent", pad_top=3, top_clip_to_door=False,
            ),
        ),
        # --- 8. Rustic wooden plank fence push-in gate ---
        dict(
            id="door-push-hedge-rustic", name="시골 나무 판자 밀기문", era="fantasy",
            motion="swing-single", playback="toggle",
            footprint=[2, 2], anchorX=0.5, anchorY=0.92, frameMs=95, se="door_wood",
            tags=["밀기문", "미는문", "판자문", "울타리", "시골", "판타지"],
            sourcePng="public/assets/beodeul-objects/city_hedge_wood_fence_gate.png",
            frames_img=A.animate_push_in_door_from_source(
                str(ROOT / "public/assets/beodeul-objects/city_hedge_wood_fence_gate.png"),
                door_box=(4, 14, 26, 28), side="left", interior="transparent", pad_top=0, top_clip_to_door=False,
            ),
        ),
        # --- 9. Canal wooden sluice lock double push-in gate ---
        dict(
            id="door-push-lock-sluice", name="수로 나무 수문 양문 밀기", era="fantasy",
            motion="swing-double", playback="toggle",
            footprint=[2, 2], anchorX=0.5, anchorY=0.92, frameMs=110, se="water_splash",
            tags=["밀기문", "수문", "양문", "수로", "판타지"],
            sourcePng="tiledata/beodeul-objects/pieces/bd-lock-gate.png",
            frames_img=animate_lock_sluice_push(
                str(ROOT / "tiledata/beodeul-objects/pieces/bd-lock-gate.png"),
            ),
        ),
        # --- 10. Adventurer canvas tent push-through flaps ---
        dict(
            id="door-push-tent-canvas", name="모험가 천막 들추기 입구", era="fantasy",
            motion="swing-double", playback="toggle",
            footprint=[3, 3], anchorX=0.5, anchorY=0.92, frameMs=100, se="cloth_rustle",
            tags=["천막", "텐트", "입구", "밀고들어가기", "야영", "판타지"],
            sourcePng="public/assets/beodeul-objects/tent_canvas_small.png",
            frames_img=animate_tent_flaps_push(
                str(ROOT / "public/assets/beodeul-objects/tent_canvas_small.png"),
                flap_box=(16, 19, 31, 41), warm_glow=True,
            ),
        ),
        # --- 11. Modern camping dome tent push-through entrance ---
        dict(
            id="door-push-dome-tent", name="캠핑 돔텐트 입구 열기", era="modern",
            motion="swing-double", playback="toggle",
            footprint=[3, 2], anchorX=0.5, anchorY=0.90, frameMs=95, se="cloth_rustle",
            tags=["텐트", "캠핑", "입구", "밀고들어가기", "현대"],
            sourcePng="public/assets/beodeul-objects/city_campout_dome_tent.png",
            frames_img=animate_tent_flaps_push(
                str(ROOT / "public/assets/beodeul-objects/city_campout_dome_tent.png"),
                flap_box=(16, 15, 31, 27), warm_glow=True,
            ),
        ),
        # --- 12. Karaoke / lounge push-through doorway curtain ---
        dict(
            id="door-push-curtain-booth", name="입구 커튼 헤치고 들어가기", era="modern",
            motion="swing-double", playback="toggle",
            footprint=[2, 2], anchorX=0.5, anchorY=0.92, frameMs=90, se="cloth_rustle",
            tags=["커튼", "입구", "밀고들어가기", "헤치기", "현대"],
            sourcePng="public/assets/beodeul-objects/city_karao_door_curtain_frame.png",
            frames_img=A.animate_curtain_push_from_source(
                str(ROOT / "public/assets/beodeul-objects/city_karao_door_curtain_frame.png"),
                curtain_box=(6, 8, 25, 24), mode="part", interior="transparent",
            ),
        ),
        # --- 13. Izakaya noren push-through cloth ---
        dict(
            id="door-push-izakaya-noren", name="선술집 노렌 젖히고 들어가기", era="modern",
            motion="swing-single", playback="toggle",
            footprint=[1, 2], anchorX=0.5, anchorY=0.90, frameMs=90, se="cloth_rustle",
            tags=["노렌", "선술집", "커튼", "밀고들어가기", "현대"],
            sourcePng="public/assets/beodeul-objects/city_izaka_noren_curtain_stand.png",
            frames_img=A.animate_curtain_push_from_source(
                str(ROOT / "public/assets/beodeul-objects/city_izaka_noren_curtain_stand.png"),
                curtain_box=(3, 7, 13, 17), mode="noren", interior="transparent",
            ),
        ),
        # --- 14. Arcade photo booth push-aside curtain ---
        dict(
            id="door-push-photo-curtain", name="포토부스 커튼 젖히기", era="modern",
            motion="swing-single", playback="toggle",
            footprint=[2, 2], anchorX=0.5, anchorY=0.90, frameMs=95, se="cloth_rustle",
            tags=["포토부스", "커튼", "밀고들어가기", "오락실", "현대"],
            sourcePng="public/assets/beodeul-objects/city_arcad_photo_booth_curtain.png",
            frames_img=animate_photo_booth_curtain(
                str(ROOT / "public/assets/beodeul-objects/city_arcad_photo_booth_curtain.png"),
            ),
        ),
        # --- 15. Subway IC-card push-through fare gates ---
        dict(
            id="door-push-subway-gate", name="지하철 개찰구 통과 열기", era="modern",
            motion="swing-double", playback="toggle",
            footprint=[3, 2], anchorX=0.5, anchorY=0.90, frameMs=90, se="sci_beep",
            tags=["개찰구", "지하철", "게이트", "밀고들어가기", "현대"],
            sourcePng="public/assets/beodeul-objects/city_subw_fare_gates.png",
            frames_img=animate_subway_fare_gates(
                str(ROOT / "public/assets/beodeul-objects/city_subw_fare_gates.png"),
            ),
        ),
        # --- 16. Parking lot barrier arm lift ---
        dict(
            id="door-push-parking-barrier", name="주차장 차단바 열기", era="modern",
            motion="hinge-lid", playback="toggle",
            footprint=[3, 2], anchorX=0.5, anchorY=0.94, frameMs=95, se="metal_latch",
            tags=["차단바", "차단기", "주차장", "게이트", "현대"],
            sourcePng="public/assets/beodeul-objects/city_park3_barrier_gate.png",
            frames_img=animate_parking_barrier(
                str(ROOT / "public/assets/beodeul-objects/city_park3_barrier_gate.png"),
            ),
        ),
    ]
    for it in items:
        it["wave"] = "wave7-push-doors"
        it["frames"] = len(it["frames_img"])
        it["frameWidth"], it["frameHeight"] = it["frames_img"][0].size
    return items


if __name__ == "__main__":
    save_and_audit(build_wave7(), "wave7-push-doors")
