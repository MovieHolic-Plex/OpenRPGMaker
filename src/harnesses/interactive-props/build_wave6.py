#!/usr/bin/env python3
"""Wave 6: 20 Real-Source Doors/Gates (8) + Environmental Motion (12) animated props."""
from __future__ import annotations

import math
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import animator as A
from build_wave1 import save_and_audit

J_DIR = "harness-data/interactive-props/sources/joseon"


def animate_fountain(src_path: str) -> list[Image.Image]:
    """Animate real stone wall fountain with cascading water stream & ripples."""
    src = A.load_rgba(src_path)
    w, h = src.size
    # Spout around (16, 13..18), basin water around x=8..24, y=19..22
    frames: list[Image.Image] = []
    for fi in range(5):
        fr = src.copy()
        if fi == 0:
            frames.append(fr)
            continue
        # Cascading stream pixels from spout (16, 14) down to basin (16, 20)
        for y in range(14, 21):
            phase = (y + fi) % 3
            c = (214, 246, 255, 255) if phase == 0 else ((136, 212, 242, 255) if phase == 1 else (86, 174, 216, 255))
            fr.putpixel((16, y), c)
            if y >= 17 and (y + fi) % 2 == 0:
                fr.putpixel((15, y), (164, 226, 248, 220))
        # Splash droplets & expanding ripples on basin surface
        rad = fi + 1
        for dx in (-rad, rad):
            px = 16 + dx
            if 8 <= px <= 24:
                fr.putpixel((px, 20), (226, 250, 255, 255))
                if 9 <= px <= 23:
                    fr.putpixel((px, 21), (146, 218, 246, 220))
        # Tiny splash mist above basin center
        for sx, sy in ((15, 19 - (fi % 2)), (17, 19 - ((fi + 1) % 2))):
            fr.putpixel((sx, sy), (234, 252, 255, 230))
        frames.append(fr)
    return frames


def animate_rotor_spin(src_path: str, center_xy: tuple[int, int], radius: int, step_deg: float = -30.0) -> list[Image.Image]:
    """Spin the real blades/vane/mill-arm patch around center_xy while keeping post/base 100% original."""
    src = A.load_rgba(src_path)
    w, h = src.size
    cx, cy = center_xy
    x0, y0 = max(0, cx - radius), max(0, cy - radius)
    x1, y1 = min(w, cx + radius + 1), min(h, cy + radius + 1)
    patch = src.crop((x0, y0, x1, y1))

    # Build a clean base with blade pixels cleared above the post/hub so rotated blades don't double-ghost
    base = src.copy()
    pw, ph = patch.size
    pcx, pcy = cx - x0, cy - y0
    for yy in range(ph):
        for xx in range(pw):
            dist = math.hypot(xx - pcx, yy - pcy)
            if 2.2 <= dist <= radius:
                # Keep vertical post below center if close to cx and below cy + 2
                if abs(xx - pcx) <= 1 and yy > pcy + 2:
                    continue
                base.putpixel((x0 + xx, y0 + yy), (0, 0, 0, 0))

    # Mask patch to circular disc so rotating corners don't snag base/post
    disc = A.make_canvas(pw, ph)
    for yy in range(ph):
        for xx in range(pw):
            dist = math.hypot(xx - pcx, yy - pcy)
            if dist <= radius:
                if abs(xx - pcx) <= 1 and yy > pcy + 3:
                    continue
                disc.putpixel((xx, yy), patch.getpixel((xx, yy)))

    frames: list[Image.Image] = [src.copy()]
    for fi in range(1, 5):
        fr = base.copy()
        rot = disc.rotate(step_deg * fi, resample=Image.NEAREST, expand=False)
        A.paste_over(fr, rot, x0, y0)
        frames.append(fr)
    return frames


def animate_weather_vane(src_path: str) -> list[Image.Image]:
    """Spin the rooster vane horizontally around the vertical post in true 3/4 view (no 2D roll!)."""
    src = A.load_rgba(src_path)
    w, h = src.size
    # Vane top sits at y=4..14, post below y=15..30
    vane = src.crop((2, 4, 14, 15))
    post = src.copy()
    for y in range(4, 15):
        for x in range(2, 14):
            post.putpixel((x, y), (0, 0, 0, 0))
    # (scale_x, flip_x) -> smooth horizontal 180° wind turn
    steps = [(1.0, False), (0.62, False), (0.28, False), (0.62, True), (1.0, True)]
    frames: list[Image.Image] = []
    for fi, (sx, flip) in enumerate(steps):
        if fi == 0:
            frames.append(src.copy())
            continue
        fr = post.copy()
        v = vane.transpose(Image.FLIP_LEFT_RIGHT) if flip else vane
        nw = max(2, int(round(v.width * sx)))
        v_sc = v.resize((nw, v.height), Image.NEAREST)
        A.paste_over(fr, v_sc, 8 - nw // 2, 4)
        frames.append(fr)
    return frames


def animate_yeonja_mill(src_path: str) -> list[Image.Image]:
    """Keep the 3/4 millstone base intact while sweeping the wooden turning beam & milling grain dust."""
    src = A.load_rgba(src_path)
    w, h = src.size
    # Sweeping beam orbits around hub (16, 13) in 3/4 ellipse
    # First clean the original protruding right beam tip (x=19..27, y=10..17) without touching the stone
    base = src.copy()
    for y in range(6, 18):
        for x in range(18, 28):
            r, g, b, a = base.getpixel((x, y))
            if a > 128 and r > b + 20:  # warm wood pixels of the beam
                base.putpixel((x, y), (0, 0, 0, 0))
    beam_hi = (168, 114, 72, 255)
    beam_sh = (106, 68, 42, 255)
    angles = [0.0, 0.75, 1.55, 2.35, 3.10]
    frames: list[Image.Image] = [src.copy()]
    for fi in range(1, 5):
        fr = base.copy()
        ang = angles[fi]
        # Draw wooden turning arm from hub (16, 12) to outer tip in 3/4 projection
        tx = 16 + math.cos(ang) * 10.5
        ty = 12 + math.sin(ang) * 5.2
        steps = 12
        for s in range(steps + 1):
            u = s / steps
            px = int(round(16 + (tx - 16) * u))
            py = int(round(12 + (ty - 12) * u))
            if 0 <= px < w and 0 <= py < h:
                fr.putpixel((px, py), beam_hi)
                if py + 1 < h:
                    fr.putpixel((px, py + 1), beam_sh)
        # Subtle white flour dust puffs around the stone base rim
        for dx, dy in [(-6, 10), (5, 11), (0, 12), (-3, 11)]:
            px = int(round(16 + dx + ((fi % 2) * 2 - 1)))
            py = 13 + dy
            if 0 <= px < w and 0 <= py < h:
                fr.putpixel((px, py), (236, 232, 224, 185))
        frames.append(fr)
    return frames


def animate_campfire(src_path: str) -> list[Image.Image]:
    """Unlit campfire (erase ALL flame + flame-outline pixels above logs y<=18) -> ignite -> original fire loop."""
    lit = A.load_rgba(src_path)
    w, h = lit.size
    unlit = lit.copy()
    flame_layer = A.make_canvas(w, h)
    for y in range(0, 19):
        for x in range(8, 25):
            c = lit.getpixel((x, y))
            if c[3] > 0:
                flame_layer.putpixel((x, y), c)
                unlit.putpixel((x, y), (0, 0, 0, 0))
    f0 = unlit.copy()
    f1 = unlit.copy()
    for dx, dy, col in [
        (0, 0, (255, 224, 118, 255)), (-1, 0, (242, 138, 42, 240)), (1, 0, (242, 138, 42, 240)),
        (0, -1, (252, 178, 56, 245)), (0, -2, (226, 86, 28, 230)), (1, -3, (255, 212, 98, 210)),
    ]:
        f1.putpixel((16 + dx, 18 + dy), col)
    f2 = unlit.copy()
    fb = flame_layer.getbbox() or (10, 4, 23, 19)
    fc = flame_layer.crop(fb)
    fm = fc.resize((max(4, int(fc.width * 0.72)), max(4, int(fc.height * 0.68))), Image.NEAREST)
    A.paste_over(f2, fm, fb[0] + (fc.width - fm.width) // 2, fb[3] - fm.height)
    f3 = lit.copy()
    f4 = unlit.copy()
    A.paste_over(f4, fc.transpose(Image.FLIP_LEFT_RIGHT), fb[0], max(0, fb[1] - 1))
    return [f0, f1, f2, f3, f4]


def animate_forge_sparks(src_path: str) -> list[Image.Image]:
    """Animate real anvil & forge: furnace flame flare + flying golden anvil sparks."""
    frames = A.animate_flame_or_lamp_from_source(src_path, flame_box=(20, 14, 34, 24), mode="ignite")
    # Add flying anvil strike sparks around anvil (x=6..18, y=22..33) on frames 2..4
    spark_sets = [
        [],
        [(13, 25, (255, 232, 138, 255))],
        [(11, 24, (255, 248, 198, 255)), (14, 23, (255, 206, 92, 240)), (9, 26, (255, 174, 62, 215))],
        [(10, 22, (255, 246, 188, 255)), (15, 21, (255, 214, 102, 235)), (8, 25, (248, 152, 48, 200)), (13, 24, (255, 252, 220, 255))],
        [(12, 23, (255, 236, 152, 245)), (16, 22, (255, 188, 72, 210)), (9, 24, (255, 218, 114, 225))],
    ]
    for fi, pts in enumerate(spark_sets):
        for sx, sy, sc in pts:
            if 0 <= sx < frames[fi].width and 0 <= sy < frames[fi].height:
                frames[fi].putpixel((sx, sy), sc)
    return frames


def build_wave6() -> list[dict]:
    items = [
        # --- Doors & Gates (8 real closed originals!) ---
        dict(
            id="door-wooden-gate", name="마을 나무 대문", era="fantasy", motion="swing-double", playback="toggle",
            footprint=[3, 2], anchorX=0.5, anchorY=0.92, frameMs=105, se="door_wood",
            tags=["대문", "나무문", "문", "게이트", "판타지"],
            sourcePng="public/assets/beodeul-objects/wooden_gate.png",
            frames_img=A.animate_double_door_from_source(
                str(ROOT / "public/assets/beodeul-objects/wooden_gate.png"),
                left_box=(9, 10, 23, 24), right_box=(25, 10, 39, 24), cavity_box=(9, 10, 39, 24),
                pad_x=6, pad_y_top=0, pad_y_bot=5, contents="transparent",
            ),
        ),
        dict(
            id="door-fence-gate", name="울타리 양문 게이트", era="fantasy", motion="swing-double", playback="toggle",
            footprint=[2, 1], anchorX=0.5, anchorY=0.88, frameMs=95, se="door_wood",
            tags=["울타리문", "문", "게이트", "마을", "판타지"],
            sourcePng="public/assets/beodeul-objects/wooden_fence_gate_h.png",
            frames_img=A.animate_double_door_from_source(
                str(ROOT / "public/assets/beodeul-objects/wooden_fence_gate_h.png"),
                left_box=(6, 4, 15, 12), right_box=(17, 4, 26, 12), cavity_box=(6, 4, 26, 12),
                pad_x=5, pad_y_top=0, pad_y_bot=4, contents="transparent",
            ),
        ),
        dict(
            id="door-stone-gate", name="돌담 나무 출입문", era="fantasy", motion="swing-double", playback="toggle",
            footprint=[2, 1], anchorX=0.5, anchorY=0.88, frameMs=100, se="door_wood",
            tags=["돌담문", "문", "게이트", "마을", "판타지"],
            sourcePng="public/assets/beodeul-objects/stone_wall_gate_h.png",
            frames_img=A.animate_double_door_from_source(
                str(ROOT / "public/assets/beodeul-objects/stone_wall_gate_h.png"),
                left_box=(8, 4, 15, 12), right_box=(17, 4, 24, 12), cavity_box=(8, 4, 24, 12),
                pad_x=5, pad_y_top=0, pad_y_bot=4, contents="transparent",
            ),
        ),
        dict(
            id="door-hedge-gate", name="정원 생울타리 문", era="fantasy", motion="swing-double", playback="toggle",
            footprint=[2, 1], anchorX=0.5, anchorY=0.88, frameMs=95, se="door_wood",
            tags=["정원문", "울타리", "문", "판타지"],
            sourcePng="public/assets/beodeul-objects/hedge_gate_h.png",
            frames_img=A.animate_double_door_from_source(
                str(ROOT / "public/assets/beodeul-objects/hedge_gate_h.png"),
                left_box=(8, 4, 15, 12), right_box=(17, 4, 24, 12), cavity_box=(8, 4, 24, 12),
                pad_x=5, pad_y_top=0, pad_y_bot=4, contents="transparent",
            ),
        ),
        dict(
            id="door-ruin-sealed", name="고대 유적 봉인 석문", era="dungeon", motion="slide-door", playback="toggle",
            footprint=[2, 3], anchorX=0.5, anchorY=0.95, frameMs=120, se="stone_scrape",
            tags=["석문", "유적", "봉인문", "문", "던전"],
            sourcePng="tiledata/beodeul-dungeon/fable/pieces/ru-door.png",
            frames_img=A.animate_split_doors_from_source(
                str(ROOT / "tiledata/beodeul-dungeon/fable/pieces/ru-door.png"),
                door_box=(6, 15, 25, 49), mode="split", interior_tint=(16, 18, 24),
            ),
        ),
        dict(
            id="door-joseon-hanji", name="한옥 창호지 미닫이문", era="joseon", motion="slide-door", playback="toggle",
            footprint=[1, 2], anchorX=0.5, anchorY=0.94, frameMs=100, se="drawer_slide",
            tags=["미닫이문", "창호지문", "한옥", "문", "조선"],
            sourcePng=f"{J_DIR}/in_wall_chang_door.png",
            frames_img=A.animate_split_doors_from_source(
                str(ROOT / f"{J_DIR}/in_wall_chang_door.png"),
                door_box=(2, 4, 14, 24), mode="slide-right", interior_tint=(28, 22, 18),
            ),
        ),
        dict(
            id="door-joseon-palace", name="조선 궁궐 붉은 대문", era="joseon", motion="swing-single", playback="toggle",
            footprint=[1, 2], anchorX=0.5, anchorY=0.94, frameMs=105, se="door_wood",
            tags=["궁궐문", "대문", "문", "조선"],
            sourcePng=f"{J_DIR}/pal_wall_hoe_doorl.png",
            frames_img=A.animate_single_door_from_source(
                str(ROOT / f"{J_DIR}/pal_wall_hoe_doorl.png"),
                door_box=(2, 5, 13, 26), side="left", pad_x=6, pad_y_bot=3, contents="transparent",
            ),
        ),
        dict(
            id="door-modern-gate", name="현대 실내 출입 게이트", era="modern", motion="swing-single", playback="toggle",
            footprint=[1, 2], anchorX=0.5, anchorY=0.94, frameMs=95, se="door_glass",
            tags=["출입문", "게이트", "문", "현대"],
            sourcePng="public/assets/beodeul-objects/city_ice_low_gate_door.png",
            frames_img=A.animate_single_door_from_source(
                str(ROOT / "public/assets/beodeul-objects/city_ice_low_gate_door.png"),
                door_box=(2, 12, 14, 27), side="left", pad_x=6, pad_y_bot=3, contents="transparent",
            ),
        ),
        # --- Environmental Motion Props (12 real-source animated props!) ---
        dict(
            id="env-wall-clock", name="벽걸이 괘종시계", era="fantasy", motion="activate-loop", playback="loopAfterOpen",
            loopFromFrame=1, footprint=[1, 2], anchorX=0.5, anchorY=0.92, frameMs=140, se="bell_gong",
            tags=["시계", "괘종시계", "실내", "환경"],
            sourcePng="tiledata/beodeul-interiors/pieces/wall-clock.png",
            frames_img=A.animate_clock_or_pendulum_from_source(
                str(ROOT / "tiledata/beodeul-interiors/pieces/wall-clock.png"),
                face_xy=(8, 9), pendulum_box=(5, 15, 10, 24),
            ),
        ),
        dict(
            id="env-anvil-forge", name="대장간 화덕과 모루", era="fantasy", motion="activate-loop", playback="loopAfterOpen",
            loopFromFrame=3, footprint=[3, 3], anchorX=0.5, anchorY=0.92, frameMs=110, se="fire_ignite",
            tags=["대장간", "화덕", "모루", "불꽃", "환경"],
            sourcePng="public/assets/beodeul-objects/anvil_and_forge_small.png",
            frames_img=animate_forge_sparks(str(ROOT / "public/assets/beodeul-objects/anvil_and_forge_small.png")),
        ),
        dict(
            id="env-campfire", name="야외 모닥불 점화", era="fantasy", motion="activate-loop", playback="loopAfterOpen",
            loopFromFrame=3, footprint=[2, 2], anchorX=0.5, anchorY=0.90, frameMs=105, se="fire_ignite",
            tags=["모닥불", "캠프파이어", "불", "야외", "환경"],
            sourcePng="public/assets/beodeul-objects/campfire.png",
            frames_img=animate_campfire(
                str(ROOT / "public/assets/beodeul-objects/campfire.png"),
            ),
        ),
        dict(
            id="env-candle-stand", name="실내 스탠드 촛대", era="fantasy", motion="activate-loop", playback="loopAfterOpen",
            loopFromFrame=3, footprint=[1, 2], anchorX=0.5, anchorY=0.92, frameMs=110, se="fire_ignite",
            tags=["촛대", "촛불", "조명", "실내"],
            sourcePng="public/assets/beodeul-objects/candle_stand.png",
            frames_img=A.animate_flame_or_lamp_from_source(
                str(ROOT / "public/assets/beodeul-objects/candle_stand.png"),
                flame_box=(5, 2, 12, 10), mode="ignite",
            ),
        ),
        dict(
            id="env-cooking-pot", name="모닥불 걸이 솥 끓이기", era="fantasy", motion="activate-loop", playback="loopAfterOpen",
            loopFromFrame=2, footprint=[2, 3], anchorX=0.5, anchorY=0.92, frameMs=115, se="pot_boil",
            tags=["솥", "요리", "냄비", "김", "환경"],
            sourcePng="public/assets/beodeul-objects/cooking_pot_on_hook.png",
            frames_img=A.animate_steam_pot_from_source(
                str(ROOT / "public/assets/beodeul-objects/cooking_pot_on_hook.png"),
                vent_xy=(18, 22), steam_rgb=(236, 238, 242), pad_top=4, ember_box=(11, 36, 23, 42),
            ),
        ),
        dict(
            id="env-wall-fountain", name="마을 돌벽 분수대", era="fantasy", motion="activate-loop", playback="loopAfterOpen",
            loopFromFrame=1, footprint=[2, 2], anchorX=0.5, anchorY=0.92, frameMs=115, se="water_splash",
            tags=["분수대", "물", "마을", "환경"],
            sourcePng="public/assets/beodeul-objects/wall_fountain_stone.png",
            frames_img=animate_fountain(str(ROOT / "public/assets/beodeul-objects/wall_fountain_stone.png")),
        ),
        dict(
            id="env-weather-vane", name="지붕 풍향계 회전", era="fantasy", motion="toggle-switch", playback="oneshot",
            footprint=[1, 2], anchorX=0.5, anchorY=0.94, frameMs=105, se="metal_latch",
            tags=["풍향계", "바람", "마을", "환경"],
            sourcePng="public/assets/beodeul-objects/weather_vane_post.png",
            frames_img=animate_weather_vane(
                str(ROOT / "public/assets/beodeul-objects/weather_vane_post.png"),
            ),
        ),
        dict(
            id="env-yeonja-mill", name="조선 연자방아 돌리기", era="joseon", motion="activate-loop", playback="loopAfterOpen",
            loopFromFrame=1, footprint=[2, 2], anchorX=0.5, anchorY=0.92, frameMs=130, se="stone_scrape",
            tags=["연자방아", "방아", "마을", "조선", "환경"],
            sourcePng=f"{J_DIR}/yeonja_mill.png",
            frames_img=animate_yeonja_mill(
                str(ROOT / f"{J_DIR}/yeonja_mill.png"),
            ),
        ),
        dict(
            id="env-fishcake-cart", name="어묵 국물 포장마차 김", era="modern", motion="activate-loop", playback="loopAfterOpen",
            loopFromFrame=2, footprint=[2, 2], anchorX=0.5, anchorY=0.92, frameMs=115, se="pot_boil",
            tags=["포장마차", "어묵", "김", "야시장", "현대", "환경"],
            sourcePng="public/assets/beodeul-objects/city_fest_fishcake_broth_cart.png",
            frames_img=A.animate_steam_pot_from_source(
                str(ROOT / "public/assets/beodeul-objects/city_fest_fishcake_broth_cart.png"),
                vent_xy=(16, 10), steam_rgb=(240, 242, 246), pad_top=6,
            ),
        ),
        dict(
            id="env-ramen-pot", name="라멘 육수 솥 김", era="modern", motion="activate-loop", playback="loopAfterOpen",
            loopFromFrame=2, footprint=[1, 2], anchorX=0.5, anchorY=0.92, frameMs=115, se="pot_boil",
            tags=["라멘", "육수", "냄비", "김", "현대", "환경"],
            sourcePng="public/assets/beodeul-objects/city_ramen_broth_pot_tall.png",
            frames_img=A.animate_steam_pot_from_source(
                str(ROOT / "public/assets/beodeul-objects/city_ramen_broth_pot_tall.png"),
                vent_xy=(8, 12), steam_rgb=(240, 242, 246), pad_top=5,
            ),
        ),
        dict(
            id="env-grill-cart", name="숯불 꼬치 구이 수레", era="modern", motion="activate-loop", playback="loopAfterOpen",
            loopFromFrame=2, footprint=[2, 2], anchorX=0.5, anchorY=0.92, frameMs=115, se="fire_ignite",
            tags=["숯불", "구이", "포장마차", "연기", "현대", "환경"],
            sourcePng="public/assets/beodeul-objects/city_izaka_charcoal_grill_cart.png",
            frames_img=A.animate_steam_pot_from_source(
                str(ROOT / "public/assets/beodeul-objects/city_izaka_charcoal_grill_cart.png"),
                vent_xy=(15, 14), steam_rgb=(232, 232, 236), pad_top=6, ember_box=(8, 16, 22, 19),
            ),
        ),
        dict(
            id="env-wind-turbine", name="옥상 소형 풍력 발전기", era="modern", motion="activate-loop", playback="loopAfterOpen",
            loopFromFrame=1, footprint=[2, 2], anchorX=0.5, anchorY=0.92, frameMs=105, se="sci_hum",
            tags=["풍력", "발전기", "옥상", "회전", "현대", "환경"],
            sourcePng="public/assets/beodeul-objects/city_repl_rooftop_wind_turbine_demo.png",
            frames_img=animate_rotor_spin(
                str(ROOT / "public/assets/beodeul-objects/city_repl_rooftop_wind_turbine_demo.png"),
                center_xy=(16, 12), radius=10, step_deg=-36.0,
            ),
        ),
    ]
    for it in items:
        it["wave"] = "wave6-doors-env"
        it["frames"] = len(it["frames_img"])
        it["frameWidth"], it["frameHeight"] = it["frames_img"][0].size
    return items


if __name__ == "__main__":
    save_and_audit(build_wave6(), "wave6-doors-env")
