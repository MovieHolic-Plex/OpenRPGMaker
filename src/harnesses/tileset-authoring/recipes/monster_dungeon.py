"""몬스터 수집 던전 시트 — 얼음 동굴·용암 동굴·유령 탑·발전소/아지트·고대 유적·해저 동굴.

공통 절(풀·나무·집)은 받지 않는다: 던전은 바깥 땅이 없다. 본 시트 화풍은 cave·gym2·interior2·outdoor2 의 그리기 함수를
램프만 바꾼 P 로 불러 그대로 잇는다(dungeon_kit). 장소별 그림과 원작에서 잰 장소 문법은 dungeon_cavern(동굴 계열 셋)·dungeon_rooms(방 계열 셋),
여섯 장소가 함께 쓰는 문법(패인 웅덩이·올린 칸막이·벽 붙박이·대각 결 바닥)은 dungeon_kit 머리말에 있다.
퍼즐 바닥: 얼음 판(ic_ice, slide ice — 들어온 방향으로 바위·벽·눈까지), 회전 화살표(pw_spin_*, 정지 칸 pw_spin_stop), 거친 얼음 덧그림(ic_rough, 정지).
용암은 물이 아니다(terrain none, 파도타기 불가) — 건너는 길은 식은 껍질 판(lv_cb) 다리뿐."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
import px  # noqa: E402
import cave  # noqa: E402
import gym2 as g2  # noqa: E402
import monster_overworld as mo  # noqa: E402
from pokemon_overworld import Sheet, palette  # noqa: E402,F401  (관문이 recipe.palette 를 부른다)
import dungeon_cavern as dc  # noqa: E402
import dungeon_rooms as dr  # noqa: E402
import dungeon_kit as dk  # noqa: E402

# 참고문서(lib/refdocs.py)가 이 레시피 docstring 다음에 이어 싣는 모듈 — 장소마다 원작에서 잰 문법이 각 모듈 docstring 에 있다.
DOC_MODULES = ("dungeon_cavern", "dungeon_rooms", "dungeon_kit")


def build(seed: dict):
    P = palette(seed)
    sh = mo.build(seed, seed.get("sections", []))          # 공통 절 없음(빈 목록) — 시드에서 늘릴 수 있다
    dc.build(sh, P)
    dr.build(sh, P)
    return sh


def autotile_masks(kind: str) -> dict:
    if kind in dc.AUTOTILE_PARAMS:
        return dc.autotile_masks(kind)
    if kind == "pool":
        return dk.pool_masks()
    if kind == "isle":
        return dc.isle_masks()
    if kind == "block2":
        return dk.block2_masks()
    if kind == "pb":
        return g2.autotile_masks("pb_teal")
    return mo.autotile_masks(kind)


def role_ids(sh) -> dict[str, list[str]]:
    ids = sh.ids
    pick = lambda *names: [n for n in names if n in ids]
    return {
        "ice_floor": pick("ic_at255"), "snow_floor": pick("ic_snow0"), "ice_wall": pick("ic_wall_at255"),
        "lava": pick("lv_at255"), "lava_floor": pick("lv_fl0"), "lava_wall": pick("lv_wall_at255"),
        "tower_floor": pick("gh_fl0"), "grave": pick("gh_grave_a"),
        "plant_floor": pick("pw_fl0"), "spin": pick("pw_spin_u", "pw_spin_d", "pw_spin_l", "pw_spin_r"), "spin_stop": pick("pw_spin_stop"),
        "ruin_floor": pick("ru_fl0"), "ruin_wall": pick("ru_wall_up"),
        "sea_water": pick("se_at255"), "sea_wall": pick("se_wall_at255"),
    }


def landmark_roles(P) -> dict:
    return {}


def negatives(P, root):
    return {}


FAMILIES = [
    ("얼음 벽", "ic_wall_at", "cave_wall", ""), ("용암 동굴 벽", "lv_wall_at", "cave_wall", ""), ("해저 동굴 벽", "se_wall_at", "cave_wall", ""),
    ("얼음 판", "ic_at", "ice", ""),
    ("용암(패인 못)", "lv_at", "pool", "_f0"), ("해저 물웅덩이(패인 못)", "se_at", "pool", "_f0"), ("해저 바위섬", "se_isle_at", "isle", "_f0"),
    ("발전소 칸막이", "pw_pb_at", "block2", ""), ("유적 돌담", "ru_pb_at", "block2", ""),
]
OPAQUE = ["ic_snow0", "ic_at255", "ic_wall_at255", "lv_fl0", "lv_cb", "lv_at255_f0", "lv_wall_at255",
          "gh_fl0", "gh_wall_up", "gh_edge_v", "pw_fl0", "pw_wall_up", "pw_spin_u", "pw_pb_at255",
          "ru_sand0", "ru_fl0", "ru_wall_up", "ru_pb_at255", "se_fl0", "se_at255_f0", "se_wall_at255"]
