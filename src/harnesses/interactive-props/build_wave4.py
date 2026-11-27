#!/usr/bin/env python3
"""Wave 4: 13 Joseon + 7 Murim real-source animated props."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import animator as A
from build_wave1 import save_and_audit

J_DIR = "harness-data/interactive-props/sources/joseon"


def build_wave4() -> list[dict]:
    items = [
        # --- Joseon (13) ---
        dict(
            id="joseon-pal-jangnong", name="궁중 자개 장롱", era="joseon", motion="swing-double", playback="toggle",
            containerStyle="wardrobe", footprint=[2, 3], anchorX=0.5, anchorY=0.94, frameMs=105, se="door_wood",
            tags=["장롱", "자개장", "궁중", "조선", "wardrobe"],
            sourcePng=f"{J_DIR}/pal_jangnong.png",
            frames_img=A.animate_double_door_from_source(
                str(ROOT / f"{J_DIR}/pal_jangnong.png"),
                left_box=(2, 14, 14, 29), right_box=(16, 14, 28, 29), cavity_box=(2, 14, 28, 29),
                pad_x=9, pad_y_top=0, pad_y_bot=4, contents="clothes",
            ),
        ),
        dict(
            id="joseon-bandaji", name="조선 안방 반닫이", era="joseon", motion="hinge-lid", playback="toggle",
            containerStyle="chest", footprint=[2, 1], anchorX=0.5, anchorY=0.88, frameMs=100, se="wood_creak",
            tags=["반닫이", "궤짝", "상자", "조선"],
            sourcePng=f"{J_DIR}/in_bandaji.png",
            frames_img=A.animate_hinged_lid_padded(
                str(ROOT / f"{J_DIR}/in_bandaji.png"),
                lid_box=(1, 2, 30, 7), seam_y=8, pad_top=5, loot_style="scroll",
            ),
        ),
        dict(
            id="joseon-dwiju", name="조선 쌀뒤주", era="joseon", motion="hinge-lid", playback="toggle",
            containerStyle="chest", footprint=[1, 2], anchorX=0.5, anchorY=0.94, frameMs=100, se="wood_creak",
            tags=["뒤주", "쌀통", "부엌", "조선"],
            sourcePng=f"{J_DIR}/in_dwiju.png",
            frames_img=A.animate_hinged_lid_padded(
                str(ROOT / f"{J_DIR}/in_dwiju.png"),
                lid_box=(1, 6, 14, 12), seam_y=13, pad_top=4, loot_style="grain",
            ),
        ),
        dict(
            id="joseon-yakjang", name="한약방 약장 서랍", era="joseon", motion="slide-drawer", playback="toggle",
            containerStyle="dresser", footprint=[2, 2], anchorX=0.5, anchorY=0.94, frameMs=95, se="drawer_slide",
            tags=["약장", "서랍", "한약방", "조선"],
            sourcePng=f"{J_DIR}/in_yakjang.png",
            frames_img=A.animate_drawers_from_source(
                str(ROOT / f"{J_DIR}/in_yakjang.png"),
                drawer_boxes=[(8, 8, 12, 11), (14, 13, 18, 16), (2, 18, 6, 21)],
                pulls_per_frame=[[0, 0, 0], [1, 0, 0], [3, 1, 0], [3, 2, 2], [3, 2, 2]], pad_y_bot=3,
            ),
        ),
        dict(
            id="joseon-nong", name="조선 안방 나무농", era="joseon", motion="swing-double", playback="toggle",
            containerStyle="wardrobe", footprint=[2, 2], anchorX=0.5, anchorY=0.94, frameMs=105, se="door_wood",
            tags=["농", "장롱", "옷장", "조선"],
            sourcePng=f"{J_DIR}/in_nong.png",
            frames_img=A.animate_double_door_from_source(
                str(ROOT / f"{J_DIR}/in_nong.png"),
                left_box=(2, 9, 14, 19), right_box=(16, 9, 28, 19), cavity_box=(2, 9, 28, 19),
                pad_x=9, pad_y_top=0, pad_y_bot=4, contents="clothes",
            ),
        ),
        dict(
            id="joseon-mungap", name="사랑방 문갑 미닫이", era="joseon", motion="slide-door", playback="toggle",
            containerStyle="cabinet", footprint=[2, 1], anchorX=0.5, anchorY=0.90, frameMs=100, se="drawer_slide",
            tags=["문갑", "사랑방", "미닫이", "조선"],
            sourcePng=f"{J_DIR}/in_mungap.png",
            frames_img=A.animate_split_doors_from_source(
                str(ROOT / f"{J_DIR}/in_mungap.png"),
                door_box=(3, 8, 28, 13), mode="split", interior_tint=(36, 24, 18),
            ),
        ),
        dict(
            id="joseon-hwajangdae", name="궁중 거울 경대", era="joseon", motion="slide-drawer", playback="toggle",
            containerStyle="dresser", footprint=[2, 2], anchorX=0.5, anchorY=0.94, frameMs=95, se="drawer_slide",
            tags=["경대", "화장대", "서랍", "조선"],
            sourcePng=f"{J_DIR}/pal_hwajangdae.png",
            frames_img=A.animate_drawers_from_source(
                str(ROOT / f"{J_DIR}/pal_hwajangdae.png"),
                drawer_boxes=[(3, 20, 14, 25), (17, 20, 27, 25)],
                pulls_per_frame=[[0, 0], [1, 0], [3, 1], [3, 2], [3, 2]], pad_y_bot=3,
            ),
        ),
        dict(
            id="joseon-stove-pot", name="부뚜막 가마솥 끓이기", era="joseon", motion="activate-loop", playback="loopAfterOpen",
            loopFromFrame=2, footprint=[2, 2], anchorX=0.5, anchorY=0.94, frameMs=115, se="pot_boil",
            tags=["가마솥", "부뚜막", "요리", "조선"],
            sourcePng=f"{J_DIR}/stove_pot.png",
            frames_img=A.animate_steam_pot_from_source(
                str(ROOT / f"{J_DIR}/stove_pot.png"),
                vent_xy=(14, 10), lid_box=(8, 9, 21, 12), steam_rgb=(236, 236, 240),
                pad_top=6, ember_box=(10, 22, 19, 26),
            ),
        ),
        dict(
            id="joseon-hwaro", name="안방 숯불 화로", era="joseon", motion="activate-loop", playback="loopAfterOpen",
            loopFromFrame=2, footprint=[1, 1], anchorX=0.5, anchorY=0.88, frameMs=110, se="fire_ignite",
            tags=["화로", "숯불", "난방", "조선"],
            sourcePng=f"{J_DIR}/in_hwaro.png",
            frames_img=A.animate_steam_pot_from_source(
                str(ROOT / f"{J_DIR}/in_hwaro.png"),
                vent_xy=(8, 4), steam_rgb=(232, 224, 214), pad_top=6, ember_box=(3, 4, 12, 7),
            ),
        ),
        dict(
            id="joseon-hwadeok", name="조선 부엌 화덕 점화", era="joseon", motion="activate-loop", playback="loopAfterOpen",
            loopFromFrame=3, footprint=[2, 2], anchorX=0.5, anchorY=0.94, frameMs=110, se="fire_ignite",
            tags=["화덕", "부엌", "불", "조선"],
            sourcePng=f"{J_DIR}/in_hwadeok.png",
            frames_img=A.animate_flame_or_lamp_from_source(
                str(ROOT / f"{J_DIR}/in_hwadeok.png"),
                flame_box=(8, 17, 23, 25), mode="ignite",
            ),
        ),
        dict(
            id="joseon-hangari-smash", name="조선 항아리 깨기", era="joseon", motion="smash-break", playback="break",
            containerStyle="jar", footprint=[1, 1], anchorX=0.5, anchorY=0.88, frameMs=85, se="ceramic_break",
            tags=["항아리", "장독", "파괴", "조선", "jar"],
            sourcePng=f"{J_DIR}/in_hangari_a.png",
            frames_img=A.animate_voronoi_smash_from_source(
                str(ROOT / f"{J_DIR}/in_hangari_a.png"),
                fw=28, fh=24, seed=201, num_shards=8, dust_rgb=(218, 186, 158),
            ),
        ),
        dict(
            id="joseon-jangdok-smash", name="김장 물독 깨기", era="joseon", motion="smash-break", playback="break",
            containerStyle="jar", footprint=[1, 2], anchorX=0.5, anchorY=0.90, frameMs=85, se="ceramic_break",
            tags=["물독", "장독", "항아리", "파괴", "조선"],
            sourcePng="public/assets/beodeul-objects/city_kim_water_jar.png",
            frames_img=A.animate_voronoi_smash_from_source(
                str(ROOT / "public/assets/beodeul-objects/city_kim_water_jar.png"),
                fw=28, fh=34, seed=202, num_shards=9, dust_rgb=(214, 190, 166),
            ),
        ),
        dict(
            id="joseon-onggi-smash", name="장독대 옹기 무더기 깨기", era="joseon", motion="smash-break", playback="break",
            containerStyle="jar", footprint=[2, 2], anchorX=0.5, anchorY=0.90, frameMs=85, se="ceramic_break",
            tags=["옹기", "장독대", "항아리", "파괴", "조선"],
            sourcePng="public/assets/beodeul-objects/city_alley_onggi_jars.png",
            frames_img=A.animate_voronoi_smash_from_source(
                str(ROOT / "public/assets/beodeul-objects/city_alley_onggi_jars.png"),
                fw=42, fh=34, seed=203, num_shards=10, dust_rgb=(218, 194, 170),
            ),
        ),
        # --- Murim / East-Asian Martial Palace (7) ---
        dict(
            id="murim-suldok-smash", name="객잔 술독 깨기", era="murim", motion="smash-break", playback="break",
            containerStyle="jar", footprint=[1, 1], anchorX=0.5, anchorY=0.88, frameMs=85, se="ceramic_break",
            tags=["술독", "항아리", "객잔", "무림", "파괴"],
            sourcePng=f"{J_DIR}/in_suldok.png",
            frames_img=A.animate_voronoi_smash_from_source(
                str(ROOT / f"{J_DIR}/in_suldok.png"),
                fw=28, fh=24, seed=204, num_shards=8, dust_rgb=(220, 194, 168),
            ),
        ),
        dict(
            id="murim-hyangro", name="문파 청동 향로 피우기", era="murim", motion="activate-loop", playback="loopAfterOpen",
            loopFromFrame=2, footprint=[1, 2], anchorX=0.5, anchorY=0.94, frameMs=115, se="incense_chime",
            tags=["향로", "도장", "문파", "무림"],
            sourcePng=f"{J_DIR}/pal_hyangro.png",
            frames_img=A.animate_steam_pot_from_source(
                str(ROOT / f"{J_DIR}/pal_hyangro.png"),
                vent_xy=(8, 11), steam_rgb=(214, 224, 240), pad_top=4, ember_box=(5, 13, 11, 16),
            ),
        ),
        dict(
            id="murim-munseo-ham", name="무공 비급 문서함", era="murim", motion="hinge-lid", playback="toggle",
            containerStyle="chest", footprint=[1, 1], anchorX=0.5, anchorY=0.90, frameMs=100, se="wood_creak",
            tags=["비급", "문서함", "상자", "무림"],
            sourcePng=f"{J_DIR}/pal_munseo_ham.png",
            frames_img=A.animate_hinged_lid_padded(
                str(ROOT / f"{J_DIR}/pal_munseo_ham.png"),
                lid_box=(2, 3, 13, 8), seam_y=9, pad_top=4, loot_style="scroll",
            ),
        ),
        dict(
            id="murim-seoga-secret", name="비밀 무공 서가", era="murim", motion="slide-door", playback="toggle",
            footprint=[2, 3], anchorX=0.35, anchorY=0.94, frameMs=110, se="stone_scrape",
            tags=["서가", "책장", "비밀문", "무림"],
            sourcePng=f"{J_DIR}/pal_seoga_tall.png",
            frames_img=A.animate_slide_secret_from_source(
                str(ROOT / f"{J_DIR}/pal_seoga_tall.png"),
                slide_px=16, pad_right=16,
            ),
        ),
        dict(
            id="murim-temple-bell", name="사찰 청동 대종 울림", era="murim", motion="toggle-switch", playback="oneshot",
            footprint=[2, 2], anchorX=0.5, anchorY=0.92, frameMs=110, se="bell_gong",
            tags=["대종", "종", "사찰", "무림"],
            sourcePng=f"{J_DIR}/pal_jong.png",
            frames_img=A.animate_ring_or_wheel_from_source(
                str(ROOT / f"{J_DIR}/pal_jong.png"),
                center_xy=(16, 17), mode="bell", ring_rgb=(255, 224, 128),
            ),
        ),
        dict(
            id="murim-war-drum", name="문파 전고 대북 타격", era="murim", motion="toggle-switch", playback="oneshot",
            footprint=[2, 2], anchorX=0.5, anchorY=0.92, frameMs=100, se="drum_boom",
            tags=["대북", "북", "전고", "무림"],
            sourcePng=f"{J_DIR}/pal_buk_big.png",
            frames_img=A.animate_ring_or_wheel_from_source(
                str(ROOT / f"{J_DIR}/pal_buk_big.png"),
                center_xy=(16, 15), mode="bell", ring_rgb=(255, 198, 114),
            ),
        ),
        dict(
            id="murim-palace-lantern", name="궁중 홍등롱 점등", era="murim", motion="activate-loop", playback="loopAfterOpen",
            loopFromFrame=3, footprint=[1, 2], anchorX=0.5, anchorY=0.94, frameMs=110, se="fire_ignite",
            tags=["등롱", "초롱", "조명", "무림"],
            sourcePng=f"{J_DIR}/pal_deungrong.png",
            frames_img=A.animate_flame_or_lamp_from_source(
                str(ROOT / f"{J_DIR}/pal_deungrong.png"),
                flame_box=(4, 5, 11, 12), mode="glow-pulse", glow_rgb=(255, 184, 112),
            ),
        ),
    ]
    for it in items:
        it["wave"] = "wave4-joseon-murim"
        it["frames"] = len(it["frames_img"])
        it["frameWidth"], it["frameHeight"] = it["frames_img"][0].size
    return items


if __name__ == "__main__":
    save_and_audit(build_wave4(), "wave4-joseon-murim")
