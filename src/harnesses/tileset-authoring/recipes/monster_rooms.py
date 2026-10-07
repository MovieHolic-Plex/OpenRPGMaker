"""몬스터 수집 실내 지역 시트 — 박사 연구소·트레이너 학교·박물관·백화점·배(복도·선실·갑판)·사천왕/챔피언 방.
공통 절은 monster_overworld 의 interior(센터·마트·집 벽·바닥·가구)만 받고, 장소별 벽·바닥·가구 절을 덧붙인다.
화풍은 본 시트 interior2 와 같다(뒷벽 32px 띠 골격·3톤 규칙 바닥·통일 외곽선 i2_ol·반투명 그림자). 도우미: rooms_kit(바닥·벽·큰 구조물), rooms_furn(가구).
방별 문법(원작에서 잰 것)은 두 도우미 머리말에 있다 — 참고문서 「장소 문법」에 그대로 실린다(DOC_MODULES).
걷는 칸 규칙: 바닥(rm_fl_*)·매트(rm_mat_*)·접두사 rmw_ 물체(챔피언 단 윗면·뱃머리 널)·decor 물체(경기장 선·승강 발판)는 걷는다.
벽·바다·선체·난간·가구(prop)·벽 장식(wallart)은 막힌다. 문·계단 아치는 물체의 입구 칸(entrance)만 열린다."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
import px  # noqa: E402
import monster_overworld as mo  # noqa: E402
import buildings as bd  # noqa: E402
import interior2 as i2  # noqa: E402
import rooms_kit as rk  # noqa: E402
import rooms_furn as rf  # noqa: E402
from pokemon_overworld import palette  # noqa: E402,F401  (관문이 recipe.palette 를 부른다)

DOC_MODULES = ("rooms_kit", "rooms_furn")   # 참고문서에 머리말(방 문법)이 실리는 도우미
CORE = ("interior",)
# 장소 → (벽 양식, 바닥 종류들)
PLACES = {
    "lab": ("lab", ["lab"]),
    "school": ("school", ["school"]),
    "museum": ("museum", ["museum"]),
    "dept": ("dept", ["dept", "dept2"]),
    "ship": ("ship", ["carpet"]),
    "cabin": ("cabin", ["cabin"]),
    "deck": ("deckhouse", ["deck"]),
}


def _add_obj(sh, name, img):
    """여러 칸 물체: 완전히 빈 칸은 넣지 않는다(빈 칸이 벽 위에 찍혀 통행을 열면 안 된다)."""
    for nm, t in bd.cut(img, name).items():
        if t.getbbox() is not None:
            sh.add(nm, t)


def build(seed: dict):
    sh = mo.build(seed, seed.get("sections", CORE))
    P = palette(seed)
    P["_leaf_hex"] = seed["palette"]["leaf"]

    sh.section("실내 지역: 벽(장소마다 양식) — 위·아래 칸, 양 끝 칸")
    for style in ("lab", "school", "museum", "dept", "ship", "cabin", "deckhouse") + tuple(f"lg_{t}" for t in rk.LG_THEMES):
        for part in ("up", "dn"):
            sh.add(f"rm_wall_{style}_{part}", rk.wall(P, style, part))
            for side in "lr":
                sh.add(f"rm_wall_{style}_{part}_{side}", rk.corner_wall(P, style, part, side))
    sh.end_section()

    sh.section("실내 지역: 바닥(3톤 무늬 두 변형 · 벽 밑 그늘 · 출입 매트)")
    kinds = ["lab", "school", "museum", "museum_in", "dept", "dept2", "carpet", "cabin", "deck", "ch_top"]
    for kind in kinds:
        for v in range(2):
            sh.add(f"rm_fl_{kind}{v}", rk.floor(P, kind, v))
        sh.add(f"rm_fl_{kind}_s", i2.under_wall(rk.floor(P, kind, 0)))
        sh.add(f"rm_mat_{kind}", rk.mat(P, rk.floor(P, kind, 0)))
    sh.row_start()
    for th in rk.LG_THEMES:
        sh.add(f"rm_fl_lg_{th}", rk.floor(P, f"lg_{th}"))
        sh.add(f"rm_fl_lg_{th}_s", rk.lg_under_wall(P, th))
        sh.add(f"rm_fl_lgb_{th}", rk.floor(P, f"lgb_{th}"))
    sh.end_section()

    sh.section("박물관 안쪽 카펫 오토타일(47)")
    for k in px.ALL47:
        sh.add(f"rm_mu_carpet_at{k}", rk.carpet_cell(P, k))
    sh.end_section()

    sh.section("배 갑판: 바다(해안 시트와 같은 물, 4프레임)·선체(세 줄)·난간·선실 지붕")

    def anim4(name, frames):
        """4프레임 칸: name_f0..f3 를 한 행에 이어 놓고 애니메이션 줄을 단다(해안 시트와 같은 3fps)."""
        if len(sh.tiles) % sh.cols > sh.cols - 4:
            sh.row_start()
        for k, im in enumerate(frames):
            sh.add(f"{name}_f{k}", im)
        sh.anim.append(dict(baseTile=sh.ids[f"{name}_f0"], frames=4, fps=3))

    anim4("rm_sea", [rk.sea(P, k) for k in range(4)])
    anim4("rm_rail_t", [rk.rail(P, "t", k) for k in range(4)])
    anim4("rm_hull_b", [rk.hull(P, "b", k) for k in range(4)])
    for row in ("t", "m"):
        sh.add(f"rm_hull_{row}", rk.hull(P, row))
    for part in ("b",):
        sh.add(f"rm_rail_{part}", rk.rail(P, part))
    for part in ("c", "t", "l", "tl"):
        sh.add(f"rm_dh_roof_{part}", rk.dh_roof(P, part))
    sh.end_section()

    sh.section("배 뱃머리(7×13 큰 그림 — sh_bow 막힘 + rmw_bow 걷는 널, 바다 칸은 빠진다, 바다가 비치는 칸은 4프레임)")
    bigs = [rk.sh_bow(P, k) for k in range(4)]
    shut, walk = rk.split_big(bigs[0], rk.bow_walk, skip=(rk.sea(P, 0),))
    T = px.T
    for (i, j), t in sorted(shut.items(), key=lambda kv: (kv[0][1], kv[0][0])):
        frames = [b_.crop((i * T, j * T, i * T + T, j * T + T)) for b_ in bigs]
        if all(fr.tobytes() == frames[0].tobytes() for fr in frames):
            sh.add(f"sh_bow.{i}.{j}", t)
            continue
        if len(sh.tiles) % sh.cols > sh.cols - 4:
            sh.row_start()
        sh.add(f"sh_bow.{i}.{j}", frames[0])
        for k in (1, 2, 3):
            sh.add(f"sh_bow_{i}_{j}_f{k}", frames[k])                         # 애니메이션 프레임(물체 이름 규칙 밖)
        sh.anim.append(dict(baseTile=sh.ids[f"sh_bow.{i}.{j}"], frames=4, fps=3))
    for (i, j), t in sorted(walk.items(), key=lambda kv: (kv[0][1], kv[0][0])):
        sh.add(f"rmw_bow.{i}.{j}", t)
    sh.end_section()

    sh.section("사천왕 경기장 선(5×5 물체, 테마 바닥에 구워 넣음 — 바닥 그대로인 칸은 빠진다)")
    for th in rk.LG_THEMES[:4]:
        sh.row_start()
        for (i, j), t in sorted(rk.lg_field(P, th).items(), key=lambda kv: (kv[0][1], kv[0][0])):
            if t is not None:
                sh.add(f"lgf_{th}.{i}.{j}", t)
    sh.end_section()

    sh.section("챔피언 팔각 단(13×11 큰 그림 — ch_stage 막힘 + rmw_ch 걷는 칸, 윗면 바닥과 같은 칸은 빠진다)")
    shut, walk = rk.split_big(rk.ch_stage(P), rk.ch_walk, skip=(rk.floor(P, "ch_top", 0), rk.floor(P, "ch_top", 1)))
    for (i, j), t in sorted(shut.items(), key=lambda kv: (kv[0][1], kv[0][0])):
        sh.add(f"ch_stage.{i}.{j}", t)
    for (i, j), t in sorted(walk.items(), key=lambda kv: (kv[0][1], kv[0][0])):
        sh.add(f"rmw_ch.{i}.{j}", t)
    sh.end_section()

    sh.section("실내 지역 가구(연구소·학교·박물관·백화점·배·사천왕)")
    for name, (fn, _k) in rf.FURN.items():
        _add_obj(sh, name, fn(P))
    sh.end_section()
    mo._fit_interior_colors(sh, seed.get("limits", {}).get("max_colors", 320) - 5)   # 본 시트 실내 절 다시 그리기(2026-10-07)가 색을 늘렸다
    return sh


def autotile_masks(kind: str) -> dict:
    if kind == "mu_carpet":
        return rk.carpet_masks()
    return mo.autotile_masks(kind)


def role_ids(sh) -> dict[str, list[str]]:
    ids = sh.ids
    pick = lambda names: [n for n in names if n in ids]
    return {
        "floor": pick([f"rm_fl_{k}0" for k in ("lab", "school", "museum", "dept", "carpet", "cabin", "deck")]),
        "wall": pick([f"rm_wall_{k}_up" for k in ("lab", "school", "museum", "dept", "ship", "cabin", "deckhouse")]),
        "mat": pick(["rm_mat_lab", "rm_mat_school"]),
        "league_floor": pick([f"rm_fl_lg_{t}" for t in rk.LG_THEMES]),
        "carpet_autotile": [f"rm_mu_carpet_at{k}" for k in px.ALL47] if "rm_mu_carpet_at0" in ids else [],
    }


def landmark_roles(P) -> dict:
    return {}


def negatives(P, root):
    return {}


FAMILIES = [("박물관 카펫", "rm_mu_carpet_at", "mu_carpet", "")]
OPAQUE = (["i2_fl_center0", "i2_edge_v"] + [f"rm_fl_{k}{v}" for k in ("lab", "school", "museum", "museum_in", "dept", "dept2", "carpet", "cabin", "deck") for v in range(2)]
          + [f"rm_fl_lg_{t}" for t in rk.LG_THEMES] + [f"rm_fl_lgb_{t}" for t in rk.LG_THEMES]
          + [f"rm_wall_{s}_up" for s in ("lab", "school", "museum", "dept", "ship", "cabin", "deckhouse", "lg_champ")] + ["rm_sea_f0", "rm_hull_t", "rm_hull_m", "rm_hull_b_f0", "rm_rail_b", "rm_rail_t_f0", "rm_dh_roof_c", "rm_mu_carpet_at255", "rm_fl_ch_top0", "rm_fl_ch_top1"])
