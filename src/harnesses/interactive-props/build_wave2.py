#!/usr/bin/env python3
"""Wave 2: 20 Jar/Pot Smash & Dungeon Gimmick real-source animated props."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import animator as A
from build_wave1 import save_and_audit


def build_wave2() -> list[dict]:
    items = [
        # --- Jars, Pots, Amphorae, Ceramic Smash (7 distinct real-source jars!) ---
        dict(
            id="water-jug-smash", name="토기 물항아리 깨기", era="fantasy", motion="smash-break", playback="break",
            containerStyle="jar", footprint=[1, 1], anchorX=0.5, anchorY=0.88, frameMs=85, se="ceramic_break",
            tags=["항아리", "물항아리", "토기", "파괴", "jar"],
            sourcePng="public/assets/beodeul-objects/water_jug_large.png",
            frames_img=A.animate_voronoi_smash_from_source(
                str(ROOT / "public/assets/beodeul-objects/water_jug_large.png"),
                fw=28, fh=24, seed=101, num_shards=8, dust_rgb=(218, 198, 176),
            ),
        ),
        dict(
            id="clay-pots-smash", name="토기 항아리 묶음 깨기", era="fantasy", motion="smash-break", playback="break",
            containerStyle="jar", footprint=[2, 1], anchorX=0.5, anchorY=0.88, frameMs=85, se="ceramic_break",
            tags=["항아리", "토기", "파괴", "pot", "jar"],
            sourcePng="public/assets/beodeul-objects/clay_pots_group.png",
            frames_img=A.animate_voronoi_smash_from_source(
                str(ROOT / "public/assets/beodeul-objects/clay_pots_group.png"),
                fw=40, fh=24, seed=102, num_shards=10, dust_rgb=(216, 192, 168),
            ),
        ),
        dict(
            id="storage-jars-smash", name="채색 저장 항아리 깨기", era="fantasy", motion="smash-break", playback="break",
            containerStyle="jar", footprint=[3, 2], anchorX=0.5, anchorY=0.90, frameMs=90, se="ceramic_break",
            tags=["항아리", "저장단지", "파괴", "jar"],
            sourcePng="public/assets/beodeul-objects/storage_jars_row.png",
            frames_img=A.animate_voronoi_smash_from_source(
                str(ROOT / "public/assets/beodeul-objects/storage_jars_row.png"),
                fw=56, fh=36, seed=103, num_shards=12, dust_rgb=(220, 202, 184),
            ),
        ),
        dict(
            id="terracotta-pot-smash", name="테라코타 화분 더미 깨기", era="fantasy", motion="smash-break", playback="break",
            containerStyle="jar", footprint=[1, 2], anchorX=0.5, anchorY=0.90, frameMs=85, se="ceramic_break",
            tags=["화분", "항아리", "테라코타", "파괴"],
            sourcePng="public/assets/beodeul-objects/city_flori_terracotta_pot_stack.png",
            frames_img=A.animate_voronoi_smash_from_source(
                str(ROOT / "public/assets/beodeul-objects/city_flori_terracotta_pot_stack.png"),
                fw=28, fh=34, seed=104, num_shards=9, dust_rgb=(220, 186, 158),
            ),
        ),
        dict(
            id="sweet-jar-smash", name="유리 사탕병 깨기", era="fantasy", motion="smash-break", playback="break",
            containerStyle="jar", footprint=[1, 1], anchorX=0.5, anchorY=0.88, frameMs=80, se="glass_break",
            tags=["유리병", "항아리", "사탕병", "파괴"],
            sourcePng="tiledata/beodeul-interiors/pieces/goods-sweet-jar.png",
            frames_img=A.animate_voronoi_smash_from_source(
                str(ROOT / "tiledata/beodeul-interiors/pieces/goods-sweet-jar.png"),
                fw=26, fh=22, seed=105, num_shards=8, dust_rgb=(218, 238, 248),
            ),
        ),
        dict(
            id="dungeon-amphora-smash", name="고대 암포라 항아리 깨기", era="dungeon", motion="smash-break", playback="break",
            containerStyle="jar", footprint=[1, 1], anchorX=0.5, anchorY=0.88, frameMs=85, se="ceramic_break",
            tags=["암포라", "항아리", "던전", "파괴", "jar"],
            sourcePng="tiledata/beodeul-dungeon/fable/pieces/su-amphora.png",
            frames_img=A.animate_voronoi_smash_from_source(
                str(ROOT / "tiledata/beodeul-dungeon/fable/pieces/su-amphora.png"),
                fw=28, fh=24, seed=106, num_shards=8, dust_rgb=(212, 182, 156),
            ),
        ),
        dict(
            id="pyramid-jars-smash", name="피라미드 카노푸스 단지 깨기", era="dungeon", motion="smash-break", playback="break",
            containerStyle="jar", footprint=[2, 2], anchorX=0.5, anchorY=0.90, frameMs=85, se="ceramic_break",
            tags=["단지", "항아리", "피라미드", "유적", "파괴"],
            sourcePng="tiledata/beodeul-dungeon/fable/pieces/py-jars.png",
            frames_img=A.animate_voronoi_smash_from_source(
                str(ROOT / "tiledata/beodeul-dungeon/fable/pieces/py-jars.png"),
                fw=42, fh=34, seed=107, num_shards=10, dust_rgb=(224, 212, 182),
            ),
        ),
        # --- Crates, Barrels, Sacks, Hay ---
        dict(
            id="dungeon-crate-smash", name="던전 나무상자 파괴", era="dungeon", motion="smash-break", playback="break",
            containerStyle="crate", footprint=[1, 1], anchorX=0.5, anchorY=0.88, frameMs=85, se="wood_break",
            tags=["나무상자", "상자", "crate", "던전", "파괴"],
            sourcePng="tiledata/beodeul-dungeon/fable/pieces/sh-crate.png",
            frames_img=A.animate_voronoi_smash_from_source(
                str(ROOT / "tiledata/beodeul-dungeon/fable/pieces/sh-crate.png"),
                fw=28, fh=24, seed=11, num_shards=8, dust_rgb=(206, 188, 158),
            ),
        ),
        dict(
            id="dungeon-barrel-smash", name="던전 오크통 파괴", era="dungeon", motion="smash-break", playback="break",
            containerStyle="barrel", footprint=[1, 1], anchorX=0.5, anchorY=0.88, frameMs=85, se="wood_break",
            tags=["오크통", "나무통", "barrel", "던전", "파괴"],
            sourcePng="tiledata/beodeul-dungeon/fable/pieces/sh-barrel.png",
            frames_img=A.animate_voronoi_smash_from_source(
                str(ROOT / "tiledata/beodeul-dungeon/fable/pieces/sh-barrel.png"),
                fw=28, fh=24, seed=23, num_shards=8, dust_rgb=(202, 184, 156),
            ),
        ),
        dict(
            id="crate-stack-smash", name="시장 나무상자 더미 파괴", era="dungeon", motion="smash-break", playback="break",
            containerStyle="crate", footprint=[3, 2], anchorX=0.5, anchorY=0.90, frameMs=90, se="wood_break",
            tags=["상자더미", "창고", "crate", "파괴"],
            sourcePng="public/assets/beodeul-objects/crate_stack.png",
            frames_img=A.animate_voronoi_smash_from_source(
                str(ROOT / "public/assets/beodeul-objects/crate_stack.png"),
                fw=56, fh=36, seed=108, num_shards=12, dust_rgb=(210, 192, 162),
            ),
        ),
        dict(
            id="sack-pile-search", name="곡식 자루 더미 뒤지기", era="dungeon", motion="untie-open", playback="oneshot",
            containerStyle="sack", footprint=[2, 2], anchorX=0.5, anchorY=0.90, frameMs=95, se="cloth_rustle",
            tags=["자루", "포대", "sack", "탐색"],
            sourcePng="public/assets/beodeul-objects/sack_pile.png",
            frames_img=A.animate_rummage_from_source(
                str(ROOT / "public/assets/beodeul-objects/sack_pile.png"),
                top_box=(11, 5, 22, 11), particle_rgb=(234, 218, 174), pad_top=3,
            ),
        ),
        dict(
            id="hay-stack-search", name="건초 더미 파헤치기", era="dungeon", motion="untie-open", playback="oneshot",
            containerStyle="basket", footprint=[2, 2], anchorX=0.5, anchorY=0.92, frameMs=95, se="cloth_rustle",
            tags=["건초", "짚더미", "hay", "탐색"],
            sourcePng="public/assets/beodeul-objects/hay_stack_cone.png",
            frames_img=A.animate_rummage_from_source(
                str(ROOT / "public/assets/beodeul-objects/hay_stack_cone.png"),
                top_box=(10, 8, 22, 16), particle_rgb=(236, 206, 114), pad_top=3,
            ),
        ),
        # --- Dungeon Gimmicks, Sarcophagus, Crystals, Braziers, Traps ---
        dict(
            id="dungeon-sarcophagus", name="지하묘지 석관 개방", era="dungeon", motion="lid-aside", playback="oneshot",
            containerStyle="chest", footprint=[1, 2], anchorX=0.42, anchorY=0.94, frameMs=120, se="stone_scrape",
            tags=["석관", "묘지", "sarcophagus", "던전"],
            sourcePng="tiledata/beodeul-dungeon/fable/pieces/cr-sarcophagus-ns.png",
            sourceOpenPng="tiledata/beodeul-dungeon/fable/pieces/cr-sarcophagus-open.png",
            frames_img=A.animate_sarcophagus_pair(
                str(ROOT / "tiledata/beodeul-dungeon/fable/pieces/cr-sarcophagus-ns.png"),
                str(ROOT / "tiledata/beodeul-dungeon/fable/pieces/cr-sarcophagus-open.png"),
            ),
        ),
        dict(
            id="dungeon-brazier", name="던전 화로 점화", era="dungeon", motion="activate-loop", playback="loopAfterOpen",
            loopFromFrame=3, footprint=[1, 2], anchorX=0.5, anchorY=0.92, frameMs=105, se="fire_ignite",
            tags=["화로", "불", "brazier", "던전"],
            sourcePng="tiledata/beodeul-dungeon/fable/pieces/ru-brazier.png",
            frames_img=A.animate_brazier_from_source(
                str(ROOT / "tiledata/beodeul-dungeon/fable/pieces/ru-brazier.png"),
                flame_bottom_y=10,
            ),
        ),
        dict(
            id="dungeon-wall-torch", name="던전 벽 횃불 점화", era="dungeon", motion="activate-loop", playback="loopAfterOpen",
            loopFromFrame=3, footprint=[1, 2], anchorX=0.5, anchorY=0.92, frameMs=100, se="fire_ignite",
            tags=["횃불", "불", "torch", "던전"],
            sourcePng="tiledata/beodeul-dungeon/fable/pieces/cv-torch.png",
            frames_img=A.animate_flame_or_lamp_from_source(
                str(ROOT / "tiledata/beodeul-dungeon/fable/pieces/cv-torch.png"),
                flame_box=(4, 0, 14, 14), mode="ignite",
            ),
        ),
        dict(
            id="dungeon-crystal-smash", name="동굴 마력 수정 채굴", era="dungeon", motion="smash-break", playback="break",
            footprint=[2, 2], anchorX=0.5, anchorY=0.90, frameMs=85, se="crystal_shatter",
            tags=["수정", "크리스탈", "광석", "파괴", "던전"],
            sourcePng="tiledata/beodeul-dungeon/fable/pieces/cv-crystal.png",
            frames_img=A.animate_voronoi_smash_from_source(
                str(ROOT / "tiledata/beodeul-dungeon/fable/pieces/cv-crystal.png"),
                fw=42, fh=34, seed=109, num_shards=10, dust_rgb=(176, 232, 255),
            ),
        ),
        dict(
            id="dungeon-ice-crystal-smash", name="빙결 수정 파괴", era="dungeon", motion="smash-break", playback="break",
            footprint=[1, 2], anchorX=0.5, anchorY=0.92, frameMs=85, se="crystal_shatter",
            tags=["얼음", "수정", "빙결", "파괴", "던전"],
            sourcePng="tiledata/beodeul-dungeon/fable/pieces/ic-crystal.png",
            frames_img=A.animate_voronoi_smash_from_source(
                str(ROOT / "tiledata/beodeul-dungeon/fable/pieces/ic-crystal.png"),
                fw=28, fh=34, seed=110, num_shards=9, dust_rgb=(204, 242, 255),
            ),
        ),
        dict(
            id="dungeon-skulls-scatter", name="해골 더미 흩어지기", era="dungeon", motion="smash-break", playback="break",
            footprint=[1, 1], anchorX=0.5, anchorY=0.88, frameMs=85, se="bone_rattle",
            tags=["해골", "뼈", "skulls", "던전", "파괴"],
            sourcePng="tiledata/beodeul-dungeon/fable/pieces/sh-skulls.png",
            frames_img=A.animate_voronoi_smash_from_source(
                str(ROOT / "tiledata/beodeul-dungeon/fable/pieces/sh-skulls.png"),
                fw=28, fh=24, seed=111, num_shards=7, dust_rgb=(224, 220, 210),
            ),
        ),
        dict(
            id="dungeon-sewer-valve", name="하수구 수문 밸브", era="dungeon", motion="toggle-switch", playback="toggle",
            footprint=[1, 2], anchorX=0.5, anchorY=0.92, frameMs=105, se="valve_turn",
            tags=["밸브", "하수구", "기믹", "던전"],
            sourcePng="tiledata/beodeul-dungeon/fable/pieces/sw-valve.png",
            frames_img=A.animate_ring_or_wheel_from_source(
                str(ROOT / "tiledata/beodeul-dungeon/fable/pieces/sw-valve.png"),
                center_xy=(7, 13), mode="valve",
            ),
        ),
        dict(
            id="dungeon-sewer-bars", name="하수구 철창 수문", era="dungeon", motion="roll-shutter", playback="toggle",
            footprint=[2, 2], anchorX=0.5, anchorY=0.92, frameMs=110, se="metal_grate",
            tags=["철창", "수문", "하수구", "기믹", "던전"],
            sourcePng="tiledata/beodeul-dungeon/fable/pieces/sw-bars.png",
            frames_img=A.animate_split_doors_from_source(
                str(ROOT / "tiledata/beodeul-dungeon/fable/pieces/sw-bars.png"),
                door_box=(6, 11, 26, 27), mode="slide-up", interior_tint=(14, 18, 22),
            ),
        ),
    ]
    for it in items:
        it["wave"] = "wave2-smash-dungeon"
        it["frames"] = len(it["frames_img"])
        it["frameWidth"], it["frameHeight"] = it["frames_img"][0].size
    return items


if __name__ == "__main__":
    save_and_audit(build_wave2(), "wave2-smash-dungeon")
