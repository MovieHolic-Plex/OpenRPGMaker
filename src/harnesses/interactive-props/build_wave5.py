#!/usr/bin/env python3
"""Wave 5: 12 Sci-Fi + 5 Steampunk + 3 Ancient/Arcane Dungeon real-source animated props."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import animator as A
from build_wave1 import save_and_audit

SF = "tiledata/sf-station/redraw/pieces"
SP_P = "tiledata/steampunk-city/fable-redraw/pieces/props"
SP_H = "tiledata/steampunk-city/fable-redraw/held"


def build_wave5() -> list[dict]:
    items = [
        # --- Sci-Fi (12) ---
        dict(
            id="scifi-cryo-pod", name="SF 냉동 수면 캡슐", era="scifi", motion="roll-shutter", playback="toggle",
            footprint=[1, 2], anchorX=0.5, anchorY=0.94, frameMs=105, se="sci_hiss",
            tags=["냉동캡슐", "크라이오", "pod", "SF"],
            sourcePng=f"{SF}/cryo-pod.png",
            frames_img=A.animate_cryo_pod_from_source(str(ROOT / f"{SF}/cryo-pod.png")),
        ),
        dict(
            id="scifi-cargo-crate", name="우주기지 화물 상자", era="scifi", motion="hinge-lid", playback="toggle",
            containerStyle="crate", footprint=[1, 1], anchorX=0.5, anchorY=0.88, frameMs=95, se="sci_latch",
            tags=["화물상자", "컨테이너", "crate", "SF"],
            sourcePng=f"{SF}/cargo-crate.png",
            frames_img=A.animate_hinged_lid_padded(
                str(ROOT / f"{SF}/cargo-crate.png"),
                lid_box=(1, 1, 14, 6), seam_y=7, pad_top=5, loot_style="scifi",
            ),
        ),
        dict(
            id="scifi-terminal", name="SF 제어 단말기", era="scifi", motion="activate-loop", playback="loopAfterOpen",
            loopFromFrame=2, footprint=[1, 2], anchorX=0.5, anchorY=0.94, frameMs=100, se="sci_beep",
            tags=["단말기", "터미널", "컴퓨터", "SF"],
            sourcePng=f"{SF}/terminal.png",
            frames_img=A.animate_screen_machine_from_source(
                str(ROOT / f"{SF}/terminal.png"),
                screen_box=(3, 4, 12, 12), accent_rgb=(122, 246, 255), mode="terminal",
            ),
        ),
        dict(
            id="scifi-server-rack", name="SF 데이터 서버 랙", era="scifi", motion="activate-loop", playback="loopAfterOpen",
            loopFromFrame=2, footprint=[1, 2], anchorX=0.5, anchorY=0.94, frameMs=100, se="sci_beep",
            tags=["서버", "데이터", "server", "SF"],
            sourcePng=f"{SF}/server-rack.png",
            frames_img=A.animate_screen_machine_from_source(
                str(ROOT / f"{SF}/server-rack.png"),
                screen_box=(3, 6, 12, 24), accent_rgb=(98, 255, 196), mode="terminal",
            ),
        ),
        dict(
            id="scifi-locker", name="우주선 대원 로커", era="scifi", motion="swing-single", playback="toggle",
            containerStyle="cabinet", footprint=[1, 2], anchorX=0.5, anchorY=0.94, frameMs=95, se="metal_locker",
            tags=["로커", "사물함", "locker", "SF"],
            sourcePng=f"{SF}/locker.png",
            frames_img=A.animate_single_door_from_source(
                str(ROOT / f"{SF}/locker.png"),
                door_box=(2, 9, 13, 27), side="left", pad_x=6, pad_y_bot=3, contents="locker",
            ),
        ),
        dict(
            id="scifi-fridge", name="우주선 주방 냉장고", era="scifi", motion="swing-single", playback="toggle",
            containerStyle="cabinet", footprint=[1, 2], anchorX=0.5, anchorY=0.94, frameMs=95, se="sci_hiss",
            tags=["냉장고", "주방", "fridge", "SF"],
            sourcePng=f"{SF}/galley-fridge.png",
            frames_img=A.animate_single_door_from_source(
                str(ROOT / f"{SF}/galley-fridge.png"),
                door_box=(1, 8, 14, 18), side="right", pad_x=6, pad_y_bot=2, contents="locker",
            ),
        ),
        dict(
            id="scifi-supply-capsule", name="궤도 보급 캡슐", era="scifi", motion="hinge-lid", playback="toggle",
            containerStyle="chest", footprint=[2, 2], anchorX=0.5, anchorY=0.92, frameMs=105, se="sci_hiss",
            tags=["보급캡슐", "캡슐", "상자", "SF"],
            sourcePng=f"{SF}/supply-capsule.png",
            frames_img=A.animate_hinged_lid_padded(
                str(ROOT / f"{SF}/supply-capsule.png"),
                lid_box=(2, 1, 29, 12), seam_y=13, pad_top=6, loot_style="scifi", flip_lid=False,
            ),
        ),
        dict(
            id="scifi-airlock", name="우주기지 대형 에어록", era="scifi", motion="slide-door", playback="toggle",
            footprint=[3, 3], anchorX=0.5, anchorY=0.95, frameMs=110, se="sci_door",
            tags=["에어록", "격벽문", "airlock", "SF"],
            sourcePng=f"{SF}/airlock.png",
            frames_img=A.animate_split_doors_from_source(
                str(ROOT / f"{SF}/airlock.png"),
                door_box=(15, 23, 32, 46), mode="split", interior_tint=(16, 26, 38),
            ),
        ),
        dict(
            id="scifi-elevator-door", name="SF 엘리베이터 문", era="scifi", motion="slide-door", playback="toggle",
            footprint=[2, 2], anchorX=0.5, anchorY=0.94, frameMs=100, se="sci_door",
            tags=["엘리베이터", "자동문", "elevator", "SF"],
            sourcePng=f"{SF}/elevator-door.png",
            frames_img=A.animate_split_doors_from_source(
                str(ROOT / f"{SF}/elevator-door.png"),
                door_box=(6, 7, 25, 29), mode="split", interior_tint=(22, 30, 42),
            ),
        ),
        dict(
            id="scifi-floor-hatch", name="갑판 바닥 해치", era="scifi", motion="slide-door", playback="toggle",
            footprint=[1, 1], anchorX=0.5, anchorY=0.88, frameMs=100, se="sci_latch",
            tags=["해치", "바닥문", "hatch", "SF"],
            sourcePng=f"{SF}/hatch-floor.png",
            frames_img=A.animate_split_doors_from_source(
                str(ROOT / f"{SF}/hatch-floor.png"),
                door_box=(3, 3, 12, 12), mode="split", interior_tint=(14, 18, 28),
            ),
        ),
        dict(
            id="scifi-holo-table", name="홀로그램 작전 테이블", era="scifi", motion="activate-loop", playback="loopAfterOpen",
            loopFromFrame=2, footprint=[2, 2], anchorX=0.5, anchorY=0.92, frameMs=110, se="sci_hum",
            tags=["홀로그램", "테이블", "작전실", "SF"],
            sourcePng=f"{SF}/holo-table.png",
            frames_img=A.animate_screen_machine_from_source(
                str(ROOT / f"{SF}/holo-table.png"),
                screen_box=(8, 8, 23, 18), accent_rgb=(116, 242, 255), mode="holo",
            ),
        ),
        dict(
            id="scifi-reactor", name="동력 원자로 가동", era="scifi", motion="activate-loop", playback="loopAfterOpen",
            loopFromFrame=2, footprint=[2, 2], anchorX=0.5, anchorY=0.94, frameMs=105, se="sci_hum",
            tags=["원자로", "발전기", "reactor", "SF"],
            sourcePng=f"{SF}/reactor.png",
            frames_img=A.animate_screen_machine_from_source(
                str(ROOT / f"{SF}/reactor.png"),
                screen_box=(7, 8, 24, 24), accent_rgb=(98, 232, 255), mode="reactor",
            ),
        ),
        # --- Steampunk (5) ---
        dict(
            id="steampunk-regulator", name="증기 압력 조절 밸브", era="steampunk", motion="toggle-switch", playback="toggle",
            footprint=[1, 2], anchorX=0.5, anchorY=0.94, frameMs=105, se="steam_hiss",
            tags=["밸브", "증기", "조절기", "스팀펑크"],
            sourcePng=f"{SP_H}/sp-regulator.png",
            frames_img=A.animate_ring_or_wheel_from_source(
                str(ROOT / f"{SP_H}/sp-regulator.png"),
                center_xy=(7, 6), mode="valve",
            ),
        ),
        dict(
            id="steampunk-alarm", name="황동 증기 경보벨", era="steampunk", motion="toggle-switch", playback="oneshot",
            footprint=[1, 2], anchorX=0.5, anchorY=0.94, frameMs=100, se="bell_alarm",
            tags=["경보벨", "종", "알람", "스팀펑크"],
            sourcePng=f"{SP_H}/sp-alarm.png",
            frames_img=A.animate_ring_or_wheel_from_source(
                str(ROOT / f"{SP_H}/sp-alarm.png"),
                center_xy=(8, 15), mode="bell", ring_rgb=(255, 214, 118),
            ),
        ),
        dict(
            id="steampunk-terminal", name="스팀 진공관 제어반", era="steampunk", motion="activate-loop", playback="loopAfterOpen",
            loopFromFrame=2, footprint=[2, 2], anchorX=0.5, anchorY=0.94, frameMs=105, se="steam_click",
            tags=["제어반", "계기판", "터미널", "스팀펑크"],
            sourcePng=f"{SP_H}/sp-terminal.png",
            frames_img=A.animate_screen_machine_from_source(
                str(ROOT / f"{SP_H}/sp-terminal.png"),
                screen_box=(3, 8, 28, 15), accent_rgb=(255, 206, 112), mode="terminal",
            ),
        ),
        dict(
            id="steampunk-gas-lamp", name="스팀 가스 가로등 점화", era="steampunk", motion="activate-loop", playback="loopAfterOpen",
            loopFromFrame=3, footprint=[1, 3], anchorX=0.5, anchorY=0.96, frameMs=110, se="fire_ignite",
            tags=["가스등", "가로등", "조명", "스팀펑크"],
            sourcePng=f"{SP_P}/sp-gas-lamp.png",
            frames_img=A.animate_flame_or_lamp_from_source(
                str(ROOT / f"{SP_P}/sp-gas-lamp.png"),
                flame_box=(4, 9, 12, 17), mode="glow-pulse", glow_rgb=(255, 224, 134),
            ),
        ),
        dict(
            id="steampunk-plaza-lamp", name="광장 황동 증기등 점화", era="steampunk", motion="activate-loop", playback="loopAfterOpen",
            loopFromFrame=3, footprint=[1, 3], anchorX=0.5, anchorY=0.96, frameMs=110, se="fire_ignite",
            tags=["증기등", "광장등", "조명", "스팀펑크"],
            sourcePng=f"{SP_P}/sp-plaza-lamp.png",
            frames_img=A.animate_flame_or_lamp_from_source(
                str(ROOT / f"{SP_P}/sp-plaza-lamp.png"),
                flame_box=(5, 7, 13, 16), mode="glow-pulse", glow_rgb=(255, 228, 146),
            ),
        ),
        # --- Ancient / Arcane Dungeon Specialty (3) ---
        dict(
            id="desert-seal-altar", name="사막 고대 봉인 제단", era="dungeon", motion="activate-loop", playback="loopAfterOpen",
            loopFromFrame=2, footprint=[2, 2], anchorX=0.5, anchorY=0.94, frameMs=115, se="magic_chime",
            tags=["제단", "봉인", "사막", "유적", "던전"],
            sourcePng="tiledata/desert-east/objects/pieces/de-seal-altar.png",
            frames_img=A.animate_magic_activate_from_source(
                str(ROOT / "tiledata/desert-east/objects/pieces/de-seal-altar.png"),
                gem_box=(9, 10, 22, 20), glow_rgb=(255, 212, 98),
            ),
        ),
        dict(
            id="sky-seal-altar", name="하늘섬 수정 봉인 제단", era="dungeon", motion="activate-loop", playback="loopAfterOpen",
            loopFromFrame=2, footprint=[2, 2], anchorX=0.5, anchorY=0.94, frameMs=115, se="magic_chime",
            tags=["제단", "봉인", "하늘섬", "마법", "던전"],
            sourcePng="tiledata/sky-island/objects/pieces/si-seal-altar.png",
            frames_img=A.animate_magic_activate_from_source(
                str(ROOT / "tiledata/sky-island/objects/pieces/si-seal-altar.png"),
                gem_box=(8, 6, 23, 18), glow_rgb=(128, 234, 255),
            ),
        ),
        dict(
            id="dungeon-magic-pedestal", name="마법탑 보주 받침대", era="dungeon", motion="activate-loop", playback="loopAfterOpen",
            loopFromFrame=2, footprint=[1, 2], anchorX=0.5, anchorY=0.94, frameMs=110, se="magic_chime",
            tags=["받침대", "보주", "마법", "던전"],
            sourcePng="tiledata/beodeul-dungeon/fable/pieces/tw-pedestal.png",
            frames_img=A.animate_magic_activate_from_source(
                str(ROOT / "tiledata/beodeul-dungeon/fable/pieces/tw-pedestal.png"),
                gem_box=(4, 4, 12, 14), glow_rgb=(136, 216, 255),
            ),
        ),
    ]
    for it in items:
        it["wave"] = "wave5-scifi-steampunk"
        it["frames"] = len(it["frames_img"])
        it["frameWidth"], it["frameHeight"] = it["frames_img"][0].size
    return items


if __name__ == "__main__":
    save_and_audit(build_wave5(), "wave5-scifi-steampunk")
