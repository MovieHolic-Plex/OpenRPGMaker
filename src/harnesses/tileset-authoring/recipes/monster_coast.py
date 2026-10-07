"""몬스터 수집 해안 시트 — 항구 도시·해변·바닷길. 공통 절(풀·모래길·나무·숲·집·센터)은 monster_overworld 에서 받고 해안 절을 덧붙인다.
문법·타일 설명은 coast.py 머리말."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
import px  # noqa: E402
import monster_overworld as mo  # noqa: E402
import buildings as bd  # noqa: E402
import coast  # noqa: E402
import city  # noqa: E402
import wild_common as wc  # noqa: E402
import wild_tall as wt  # noqa: E402
from pokemon_overworld import palette  # noqa: E402  (관문이 recipe.palette 를 부른다)

DOC_MODULES = ("coast", "city")   # 참고문서에 머리말(장소 문법)이 실리는 도우미
CORE = ("ground", "ledges", "clearing", "sandpath", "fence", "trees", "forest", "outdoor_props", "houses", "landmarks")


def _water_family(sh, name, draw):
    for k in px.ALL47:
        sh.row_start() if len(sh.tiles) % 4 else None
        for f in range(4):
            sh.add(f"{name}{k}_f{f}", draw(k, f))
        sh.ids[f"{name}{k}"] = sh.ids[f"{name}{k}_f0"]
        sh.anim.append(dict(baseTile=sh.ids[f"{name}{k}_f0"], frames=4, fps=3))


def _interior(sh, prefix, draw):
    """속 변형: 0단(가장자리 2칸 안) = 얕은 바다 무늬 3변형, 1단(더 깊은 곳) = 깊은 바다 3변형. 굽기가 interiorVariants 로 묶는다."""
    for t in (0, 1):
        for v in range(3):
            sh.row_start() if len(sh.tiles) % 4 else None
            for f in range(4):
                sh.add(f"{prefix}in{t}_{v}_f{f}", draw(f, t == 1, v + 1))
            sh.anim.append(dict(baseTile=sh.ids[f"{prefix}in{t}_{v}_f0"], frames=4, fps=3))


def build(seed: dict):
    sh = mo.build(seed, seed.get("sections", CORE))
    P = palette(seed)
    coast.init(P, mo.sand_tex(P, 0), lambda x, y: mo._GRASS0[(x, y)], lambda v: mo.sand_tex(P, v))

    # 키 큰 풀 덩이 둥근 귀(정본 wild_tall — 감독 결정 I4 W2: 모든 풀숲). 본 시트가 같은 이름을 이미 물려주면 다시 굽지 않는다
    # (같은 정본 호출이라 바이트도 같다). 바닥 g = 풀(본 grass0), 해안에 다른 바닥 위 풀숲은 없다.
    if "tall0rg1" not in sh.ids:
        sh.section("키 큰 풀 덩이 둥근 귀(정본 wild_tall — 바깥 귀를 깎은 풀숲 칸 · 귀 쪽 끝을 자른 잎끝 · 옆 잎끝 두 벌)")
        wt.add_round_tall(sh, "tall", P["tall"], (("g", wc.tex_px(mo.grass_tex(P, 0))),))
        sh.end_section()

    sh.section("해안 바닥(잔교)")
    sh.row_start()
    sh.add("dock_v", coast.dock(P, "v"))
    sh.add("dock_h", coast.dock(P, "h"))
    sh.add("dock_post", coast.dock_post(P))
    sh.end_section()

    sh.section("해변 물가 오토타일(47 × 4프레임, 안 = 바다)")
    _water_family(sh, "shore_at", lambda k, f: coast.shore(P, k, f))
    _interior(sh, "shore_at", lambda f, deep, v: coast.sea(P, f, False, v))   # 깊이는 deep 그룹이 맡는다 — 속 단마다 반짝임 양이 달라 칸 네모가 보이던 것을 없앤다
    sh.end_section()
    sh.section("깊은 바다 오토타일(47 × 4프레임, 안 = 깊은 물 · 밖 = 바다, 둥근 덩이 + 2px 점묘 테)")
    _water_family(sh, "deep_at", lambda k, f: coast.deep(P, k, f))
    sh.end_section()
    sh.section("부두 벽 오토타일(47 × 4프레임, 안 = 항구 물)")
    _water_family(sh, "quay_at", lambda k, f: coast.quay(P, k, f))
    _interior(sh, "quay_at", lambda f, deep, v: coast.sea(P, f, False, v))
    sh.end_section()
    sh.section("포장길 오토타일(47)")
    for k in px.ALL47:
        sh.add(f"pave_at{k}", coast.pave(P, k))
    sh.row_start()
    for t in (0, 1):
        for v in range(3):
            sh.add(f"pave_atin{t}_{v}", coast.pave(P, 255, v + 1 + 3 * t))
    for part in ("l", "m", "r"):
        sh.add(f"seawall_steps_{part}", coast.seawall_steps(P, part))
    for part in ("l", "m", "r"):
        sh.add(f"seawall_stepfoot_{part}", coast.seawall_steps_foot(P, part))
    sh.end_section()
    sh.section("모래 둔치 오토타일(47, 안 = 모래 · 밖 = 높은 마을, 부두와 같은 갓돌 테두리)")
    for k in px.ALL47:
        sh.add(f"bsand_at{k}", coast.bsand(P, k))
    sh.row_start()
    for v in range(2):
        sh.add(f"bsand_atin0_{v}", coast.bsand(P, 255, v + 1))
    sh.end_section()

    sh.section("해안 소품(바위·부표·튜브·모래성·계선주·상자·통·화분)")
    for name, fn in coast.SINGLES.items():
        sh.add(f"{name}.0.0", fn(P))
    sh.end_section()
    sh.section("해안 물체(파라솔·의자·수건·야자·천막·등대·배·가로등·벤치·분수·그물)")
    for name, (fn, _k) in coast.PROPS.items():
        for nm, t in bd.cut(fn(P), name).items():
            sh.add(nm, t)
        sh.row_start()
    sh.end_section()
    sh.section("도시 건물(백화점·아파트·사무실·회관 — 평지붕 여러 층)")
    for name, fn in city.BUILDINGS.items():
        for nm, t in bd.cut(fn(P), name).items():
            sh.add(nm, t)
        sh.row_start()
    sh.end_section()
    return sh


def autotile_masks(kind: str) -> dict:
    return coast.masks(kind) if kind in coast.AUTOTILE_PARAMS or kind in coast.BAND_KINDS else mo.autotile_masks(kind)


role_ids = mo.role_ids
landmark_roles = mo.landmark_roles
negatives = mo.negatives
FAMILIES = [("밝은 공터", "clear_at", "clearing", ""), ("모래길", "sand_at", "sand", ""), ("해변 물가", "shore_at", "shore", "_f0"),
            ("부두 벽", "quay_at", "quay", "_f0"), ("포장길", "pave_at", "pave", ""), ("모래 둔치", "bsand_at", "bsand", ""), ("깊은 바다", "deep_at", "deep", "_f0")]
OPAQUE = ["grass0", "tall0", "sand0", "sand_at255", "shore_at255_f0", "quay_at255_f0", "pave_at255", "bsand_at255", "bsand_atin0_0", "seawall_steps_m", "seawall_stepfoot_m", "dock_v", "dock_h", "deep_at255_f0"]
