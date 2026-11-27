#!/usr/bin/env python3
"""Wave 3: 20 Modern City real-source animated props."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import animator as A
from build_wave1 import save_and_audit


def build_wave3() -> list[dict]:
    items = [
        dict(
            id="modern-vending", name="건강음료 자판기", era="modern", motion="drop-flap", playback="oneshot",
            footprint=[2, 3], anchorX=0.5, anchorY=0.92, frameMs=105, se="vending_drop",
            tags=["자판기", "음료", "vending", "현대"],
            sourcePng="public/assets/beodeul-objects/city_clinic_health_drink_vending.png",
            frames_img=A.animate_vending_from_source(
                str(ROOT / "public/assets/beodeul-objects/city_clinic_health_drink_vending.png"),
            ),
        ),
        dict(
            id="modern-lockers", name="학교 학생 사물함", era="modern", motion="swing-single", playback="toggle",
            containerStyle="cabinet", footprint=[2, 2], anchorX=0.5, anchorY=0.92, frameMs=95, se="metal_locker",
            tags=["사물함", "학교", "locker", "현대"],
            sourcePng="public/assets/beodeul-objects/city_camp_student_lockers.png",
            frames_img=A.animate_single_door_from_source(
                str(ROOT / "public/assets/beodeul-objects/city_camp_student_lockers.png"),
                door_box=(12, 8, 18, 15), side="left", pad_x=4, pad_y_bot=2, contents="locker",
            ),
        ),
        dict(
            id="modern-toolbox", name="현장 빨간 공구함", era="modern", motion="hinge-lid", playback="toggle",
            containerStyle="chest", footprint=[1, 1], anchorX=0.5, anchorY=0.88, frameMs=90, se="metal_latch",
            tags=["공구함", "공구", "toolbox", "현대"],
            sourcePng="public/assets/beodeul-objects/city_cons_toolbox.png",
            frames_img=A.animate_hinged_lid_padded(
                str(ROOT / "public/assets/beodeul-objects/city_cons_toolbox.png"),
                lid_box=(1, 2, 15, 7), seam_y=8, pad_top=5, loot_style="tools",
            ),
        ),
        dict(
            id="modern-arcade", name="오락실 리듬 게임기", era="modern", motion="activate-loop", playback="loopAfterOpen",
            loopFromFrame=2, footprint=[1, 2], anchorX=0.5, anchorY=0.92, frameMs=105, se="arcade_blip",
            tags=["오락기", "게임기", "arcade", "현대"],
            sourcePng="public/assets/beodeul-objects/city_arcad_rhythm_game_cabinet.png",
            frames_img=A.animate_screen_machine_from_source(
                str(ROOT / "public/assets/beodeul-objects/city_arcad_rhythm_game_cabinet.png"),
                screen_box=(4, 7, 11, 17), accent_rgb=(122, 232, 255), mode="terminal",
            ),
        ),
        dict(
            id="modern-claw-machine", name="오락실 인형 뽑기 기계", era="modern", motion="toggle-switch", playback="oneshot",
            footprint=[2, 2], anchorX=0.5, anchorY=0.92, frameMs=115, se="arcade_blip",
            tags=["인형뽑기", "오락실", "claw", "현대"],
            sourcePng="public/assets/beodeul-objects/city_arcad_claw_machine.png",
            frames_img=A.animate_screen_machine_from_source(
                str(ROOT / "public/assets/beodeul-objects/city_arcad_claw_machine.png"),
                screen_box=(8, 8, 25, 19), accent_rgb=(255, 196, 224), mode="claw",
            ),
        ),
        dict(
            id="modern-cooler-box", name="해변 아이스박스", era="modern", motion="hinge-lid", playback="toggle",
            containerStyle="chest", footprint=[1, 1], anchorX=0.5, anchorY=0.88, frameMs=95, se="plastic_lid",
            tags=["아이스박스", "쿨러", "cooler", "현대"],
            sourcePng="public/assets/beodeul-objects/city_beach_cooler_box_ice.png",
            frames_img=A.animate_hinged_lid_padded(
                str(ROOT / "public/assets/beodeul-objects/city_beach_cooler_box_ice.png"),
                lid_box=(1, 4, 15, 7), seam_y=8, pad_top=4, loot_style="ice",
            ),
        ),
        dict(
            id="modern-waste-bin", name="아파트 음식물 수거함", era="modern", motion="hinge-lid", playback="toggle",
            containerStyle="crate", footprint=[1, 1], anchorX=0.5, anchorY=0.88, frameMs=90, se="plastic_lid",
            tags=["쓰레기통", "수거함", "bin", "현대"],
            sourcePng="public/assets/beodeul-objects/city_apt_food_waste_bin.png",
            frames_img=A.animate_hinged_lid_padded(
                str(ROOT / "public/assets/beodeul-objects/city_apt_food_waste_bin.png"),
                lid_box=(1, 2, 15, 5), seam_y=6, pad_top=4, loot_style="trash",
            ),
        ),
        dict(
            id="modern-recycle-bins", name="캔·병 분리수거함", era="modern", motion="hinge-lid", playback="toggle",
            containerStyle="crate", footprint=[2, 1], anchorX=0.5, anchorY=0.88, frameMs=90, se="plastic_lid",
            tags=["분리수거함", "쓰레기통", "recycle", "현대"],
            sourcePng="public/assets/beodeul-objects/city_benbn_can_bottle_bin_pair.png",
            frames_img=A.animate_hinged_lid_padded(
                str(ROOT / "public/assets/beodeul-objects/city_benbn_can_bottle_bin_pair.png"),
                lid_box=(2, 4, 15, 7), seam_y=8, pad_top=4, loot_style="trash",
            ),
        ),
        dict(
            id="modern-parcel-locker", name="무인 택배 보관함", era="modern", motion="swing-single", playback="toggle",
            containerStyle="cabinet", footprint=[2, 2], anchorX=0.5, anchorY=0.92, frameMs=95, se="metal_locker",
            tags=["택배함", "보관함", "locker", "현대"],
            sourcePng="public/assets/beodeul-objects/city_terr_parcel_locker.png",
            frames_img=A.animate_single_door_from_source(
                str(ROOT / "public/assets/beodeul-objects/city_terr_parcel_locker.png"),
                door_box=(12, 15, 19, 19), side="left", pad_x=4, pad_y_bot=2, contents="locker",
            ),
        ),
        dict(
            id="modern-parcel-boxes", name="택배 상자 더미 개봉", era="modern", motion="untie-open", playback="oneshot",
            containerStyle="crate", footprint=[2, 2], anchorX=0.5, anchorY=0.90, frameMs=95, se="cardboard_open",
            tags=["택배", "택배상자", "parcel", "현대"],
            sourcePng="public/assets/beodeul-objects/city_logi_parcel_boxes.png",
            frames_img=A.animate_rummage_from_source(
                str(ROOT / "public/assets/beodeul-objects/city_logi_parcel_boxes.png"),
                top_box=(10, 6, 22, 13), particle_rgb=(228, 198, 146), pad_top=3,
            ),
        ),
        dict(
            id="modern-fire-hose-box", name="옥상 소화전함", era="modern", motion="swing-single", playback="toggle",
            containerStyle="cabinet", footprint=[1, 2], anchorX=0.5, anchorY=0.92, frameMs=95, se="metal_latch",
            tags=["소화전", "소화전함", "firehose", "현대"],
            sourcePng="public/assets/beodeul-objects/city_roof_fire_hose_box.png",
            frames_img=A.animate_single_door_from_source(
                str(ROOT / "public/assets/beodeul-objects/city_roof_fire_hose_box.png"),
                door_box=(3, 11, 13, 23), side="left", pad_x=6, pad_y_bot=2, contents="locker",
            ),
        ),
        dict(
            id="modern-signal-box", name="거리 신호등 제어함", era="modern", motion="swing-single", playback="toggle",
            footprint=[1, 2], anchorX=0.5, anchorY=0.92, frameMs=100, se="metal_latch",
            tags=["제어함", "분전반", "신호등", "현대"],
            sourcePng="public/assets/beodeul-objects/city_lamps_signal_control_box.png",
            frames_img=A.animate_single_door_from_source(
                str(ROOT / "public/assets/beodeul-objects/city_lamps_signal_control_box.png"),
                door_box=(3, 11, 13, 23), side="left", pad_x=6, pad_y_bot=2, contents="locker",
            ),
        ),
        dict(
            id="modern-battery-swap", name="전기 배터리 교환함", era="modern", motion="drop-flap", playback="oneshot",
            footprint=[2, 2], anchorX=0.5, anchorY=0.92, frameMs=100, se="sci_beep",
            tags=["배터리", "충전함", "battery", "현대"],
            sourcePng="public/assets/beodeul-objects/city_evchg_battery_swap_cabinet.png",
            frames_img=A.animate_screen_machine_from_source(
                str(ROOT / "public/assets/beodeul-objects/city_evchg_battery_swap_cabinet.png"),
                screen_box=(4, 8, 27, 22), accent_rgb=(112, 255, 168), slot_xy=(16, 22), mode="dispense",
            ),
        ),
        dict(
            id="modern-charging-kiosk", name="휴대폰 충전 키오스크", era="modern", motion="activate-loop", playback="loopAfterOpen",
            loopFromFrame=2, footprint=[1, 2], anchorX=0.5, anchorY=0.92, frameMs=105, se="sci_beep",
            tags=["키오스크", "충전기", "kiosk", "현대"],
            sourcePng="public/assets/beodeul-objects/city_phone_charging_station_kiosk.png",
            frames_img=A.animate_screen_machine_from_source(
                str(ROOT / "public/assets/beodeul-objects/city_phone_charging_station_kiosk.png"),
                screen_box=(4, 9, 11, 18), accent_rgb=(128, 240, 255), mode="terminal",
            ),
        ),
        dict(
            id="modern-phone-booth", name="빈티지 공중전화 부스", era="modern", motion="swing-single", playback="toggle",
            footprint=[1, 2], anchorX=0.5, anchorY=0.92, frameMs=105, se="door_glass",
            tags=["공중전화", "전화부스", "booth", "현대"],
            sourcePng="public/assets/beodeul-objects/city_phone_phone_booth_vintage.png",
            frames_img=A.animate_single_door_from_source(
                str(ROOT / "public/assets/beodeul-objects/city_phone_phone_booth_vintage.png"),
                door_box=(3, 10, 12, 26), side="left", pad_x=6, pad_y_bot=3, contents="locker",
            ),
        ),
        dict(
            id="modern-mask-vending", name="약국 마스크 자판기", era="modern", motion="drop-flap", playback="oneshot",
            footprint=[1, 2], anchorX=0.5, anchorY=0.92, frameMs=100, se="vending_drop",
            tags=["자판기", "마스크", "약국", "현대"],
            sourcePng="public/assets/beodeul-objects/city_pharm_mask_vending_box.png",
            frames_img=A.animate_screen_machine_from_source(
                str(ROOT / "public/assets/beodeul-objects/city_pharm_mask_vending_box.png"),
                screen_box=(3, 7, 12, 18), accent_rgb=(156, 242, 255), slot_xy=(8, 24), mode="dispense",
            ),
        ),
        dict(
            id="modern-ticket-machine", name="식당 식권 자판기", era="modern", motion="drop-flap", playback="oneshot",
            footprint=[1, 2], anchorX=0.5, anchorY=0.92, frameMs=100, se="vending_drop",
            tags=["식권", "자판기", "키오스크", "현대"],
            sourcePng="public/assets/beodeul-objects/city_ramen_menu_ticket_machine_icon.png",
            frames_img=A.animate_screen_machine_from_source(
                str(ROOT / "public/assets/beodeul-objects/city_ramen_menu_ticket_machine_icon.png"),
                screen_box=(4, 9, 12, 18), accent_rgb=(255, 224, 134), slot_xy=(8, 24), mode="dispense",
            ),
        ),
        dict(
            id="modern-coin-changer", name="빨래방 동전 교환기", era="modern", motion="drop-flap", playback="oneshot",
            footprint=[1, 2], anchorX=0.5, anchorY=0.92, frameMs=95, se="coin_clink",
            tags=["동전교환기", "빨래방", "자판기", "현대"],
            sourcePng="public/assets/beodeul-objects/city_laund_coin_change_machine.png",
            frames_img=A.animate_screen_machine_from_source(
                str(ROOT / "public/assets/beodeul-objects/city_laund_coin_change_machine.png"),
                screen_box=(4, 8, 11, 16), accent_rgb=(140, 232, 255), slot_xy=(8, 22), mode="dispense",
            ),
        ),
        dict(
            id="modern-bottle-return", name="빈병 무인 회수기", era="modern", motion="drop-flap", playback="oneshot",
            footprint=[2, 2], anchorX=0.5, anchorY=0.92, frameMs=105, se="sci_beep",
            tags=["회수기", "재활용", "자판기", "현대"],
            sourcePng="public/assets/beodeul-objects/city_btl_bottle_return_machine.png",
            frames_img=A.animate_screen_machine_from_source(
                str(ROOT / "public/assets/beodeul-objects/city_btl_bottle_return_machine.png"),
                screen_box=(7, 9, 22, 19), accent_rgb=(126, 255, 192), slot_xy=(16, 24), mode="dispense",
            ),
        ),
        dict(
            id="modern-storage-cabinet", name="사무실 철제 캐비닛", era="modern", motion="swing-double", playback="toggle",
            containerStyle="cabinet", footprint=[1, 2], anchorX=0.5, anchorY=0.94, frameMs=100, se="metal_locker",
            tags=["캐비닛", "사무실", "철제장", "cabinet", "현대"],
            sourcePng="tiledata/modern-city/objects/pieces/mc-storage-cabinet.png",
            frames_img=A.animate_double_door_from_source(
                str(ROOT / "tiledata/modern-city/objects/pieces/mc-storage-cabinet.png"),
                left_box=(1, 6, 6, 27), right_box=(8, 6, 14, 27), cavity_box=(1, 6, 14, 27),
                pad_x=6, pad_y_top=0, pad_y_bot=3, contents="locker",
            ),
        ),
    ]
    for it in items:
        it["wave"] = "wave3-modern"
        it["frames"] = len(it["frames_img"])
        it["frameWidth"], it["frameHeight"] = it["frames_img"][0].size
    return items


if __name__ == "__main__":
    save_and_audit(build_wave3(), "wave3-modern")
