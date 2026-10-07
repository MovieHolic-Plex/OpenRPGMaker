"""몬스터 수집 기후 시트 — 눈 마을 · 얼음 퍼즐 눈길 · 사막(111번 도로) · 화산재 마을(꽃잎마을 + 용암마을 온천).

공통 절(울타리·집·랜드마크)은 monster_overworld 에서 받고, 기후 바닥·경계·소품은 climate_* 도우미가 그린다(장소 문법은 각 도우미 머리말).
본 시트 야외 함수(턱·키 큰 풀)는 바탕 풀 표를 기후 바닥으로 잠시 바꿔 끼워 같은 화풍으로 다시 부른다(climate_common.ground_as).
눈 지붕·재 지붕은 공통 절이 그린 집 칸 위에 덧그린다(눈은 지붕 모양을 따라 4톤, 재는 탁한 지붕 램프 + 재 2톤).

견본 맵 넷(node/monster_climate.mts): snow_town · ice_route · desert · ash_town — 맵마다 장소 문법 한 줄과 정상/오류 쌍이 참고문서에 실린다.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
import px  # noqa: E402
from PIL import ImageChops  # noqa: E402
from px import T, N, E, W  # noqa: E402
import monster_overworld as mo  # noqa: E402
from pokemon_overworld import palette  # noqa: E402,F401  (관문이 recipe.palette 를 부른다)
import outdoor2 as o2  # noqa: E402
import forest  # noqa: E402
import trees  # noqa: E402
import cave  # noqa: E402
import climate_common as cc  # noqa: E402
import climate_snow as sn  # noqa: E402
import climate_desert as ds  # noqa: E402
import climate_ash as ash  # noqa: E402
import climate_forest as cf  # noqa: E402
import climate_cliff as cl  # noqa: E402
import dungeon_cavern as dcav  # noqa: E402  (정본: 얼음 판 — 던전 얼음 동굴과 같은 그림)
import dungeon_rooms as drm  # noqa: E402  (정본: 유적 기둥 ru_pillar)
import coast  # noqa: E402  (정본: 해안 야자 palm)
import wild_mountain as wm  # noqa: E402  (정본: 둥근 큰 바위 big_rock — 벼랑은 climate_cliff 가 야생 절벽 함수를 부른다)
import wild_tall as wt  # noqa: E402  (정본: 둥근 귀 풀숲 add_round_tall — 감독 결정 I4 W2)
import buildings as bd  # noqa: E402  (정본: 지붕 높이 ROOF_H · 집 높이 HOUSE_H — 통합 I4 W1)
import landmarks as lm  # noqa: E402

CORE = ("fence", "houses", "landmarks")
DOC_MODULES = ("climate_snow", "climate_desert", "climate_ash", "climate_cliff")   # 참고문서에 머리말(장소 문법)이 실리는 도우미


_LEDGE_COLS = [0, 1, 2, 3, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 15]   # 정본 턱(8px 주기 처짐)의 열을 다시 고른다: 3 을 한 번 더, 11 을 빼서 한 칸 안 덩이가 9·7px


def _warp_cols(im, cols):
    """정본 그림의 열을 cols 순서로 다시 놓는다(새로 그리지 않는다 — 처짐 폭만 바뀐다). 0·15 열은 그대로라 이웃 칸과 이음매가 맞는다."""
    out = im.copy()
    for x, sx in enumerate(cols):
        out.paste(im.crop((sx, 0, sx + 1, im.height)), (x, 0))
    return out


def _ledges(sh, P, prefix: str, table, rock, shade):
    """본 시트 턱(outdoor2.ledge·ledge_side)을 기후 바닥·기후 바위 램프로 다시 그린다."""
    Pl = dict(P, rock=rock, grass=shade)
    with cc.ground_as(table):
        sh.add(f"{prefix}_s_l", o2.ledge(Pl, "l"))
        sh.add(f"{prefix}_s_mid", o2.ledge(Pl, "m0"))
        sh.add(f"{prefix}_s_mid1", _warp_cols(ImageChops.offset(o2.ledge(Pl, "m1"), 4, 0), _LEDGE_COLS))   # 덩이 자리를 4px 밀고(L2 N13) 열을 늘이고 줄여 덩이 폭 9·7px(L5 K3)
        sh.add(f"{prefix}_s_r", o2.ledge(Pl, "r"))
        sh.add(f"{prefix}_e", o2.ledge_side(Pl, "e"))
        sh.add(f"{prefix}_w", o2.ledge_side(Pl, "w"))


def _tall(P, table, tall, shade, v):
    with cc.ground_as(table):
        return o2.tall_grass(dict(P, tall=tall, grass=shade), v)


def _water_rows(sh, prefix: str, draw):
    for k in px.ALL47:
        if len(sh.tiles) % 4:
            sh.row_start()
        for f in range(4):
            sh.add(f"{prefix}{k}_f{f}", draw(k, f))
        sh.ids[f"{prefix}{k}"] = sh.ids[f"{prefix}{k}_f0"]
        sh.anim.append(dict(baseTile=sh.ids[f"{prefix}{k}_f0"], frames=4, fps=3))


def _obj(sh, name: str, im):
    for ry in range(im.height // T):
        for cx in range(im.width // T):
            sh.add(f"{name}.{cx}.{ry}", im.crop((cx * T, ry * T, cx * T + T, ry * T + T)))


def _pillar_outline(im, P, x_shade: int = 11, y_shade: int = 29):
    """정본 ru_pillar 는 실내 통일 윤곽(i2_ol)을 쓴다. 야외 사암 물체는 재료 최암 톤이 윤곽이라(옆 유적 문과 같게) 윤곽을 ruin[0] 으로 받고,
    그늘 쪽(오른쪽 열·밑돌 아랫줄)만 한 단 더 짙은 cliff_desert[0] 으로 바꾼다. 그림자(오른쪽 아래 반투명)는 정본 그대로."""
    ol, dark = P["ruin"][0], P["cliff_desert"][0]
    for y in range(im.height):
        for x in range(im.width):
            c = im.getpixel((x, y))
            if c[3] == 255 and c[:3] == ol[:3] and (x >= x_shade or y >= y_shade):
                im.putpixel((x, y), dark)
    return im


def build(seed: dict):
    sh = mo.build(seed, seed.get("sections", CORE))
    P = palette(seed)
    s = P["snow"]
    for hid, h in seed["houses"].items():                                  # 눈 지붕: 공통 절이 그린 집 칸 위에 눈을 덮는다
        if h.get("snow"):
            rows = bd.HOUSE_H // T                                         # 지붕 2줄 + 벽 2줄(통합 I4 W1 — 옛 5줄)
            cv = px.new(h["n"] * T, rows * T)
            for y in range(rows):
                for x in range(h["n"]):
                    cv.paste(sh.tiles[sh.ids[f"{hid}.{x}.{y}"]], (x * T, y * T))
            cv = sn.snow_roof(P, cv, h["n"], hid, h["roof"])
            for y in range(rows):
                for x in range(h["n"]):
                    sh.tiles[sh.ids[f"{hid}.{x}.{y}"]] = cv.crop((x * T, y * T, x * T + T, y * T + T))
    sn.init(P); ds.init(P); ash.init(P)
    for hid, h in seed["houses"].items():                                  # 재 지붕: 탁한 지붕 램프로 그린 집 위에 재를 얹는다
        if h.get("ash"):
            rows = bd.HOUSE_H // T
            cv = px.new(h["n"] * T, rows * T)
            for y in range(rows):
                for x in range(h["n"]):
                    cv.paste(sh.tiles[sh.ids[f"{hid}.{x}.{y}"]], (x * T, y * T))
            cv = ash.ash_roof(P, cv, h["n"], hid, h["roof"])
            for y in range(rows):
                for x in range(h["n"]):
                    sh.tiles[sh.ids[f"{hid}.{x}.{y}"]] = cv.crop((x * T, y * T, x * T + T, y * T + T))

    # ---- 눈 -------------------------------------------------------------------------------
    sh.section("눈 바닥·눈 턱·눈 소품")
    for v in range(4):
        sh.add(f"snow{v}", sn.snow_tex(P, v))
    for v in range(2):
        sh.add(f"stall{v}", _tall(P, sn._SNOW0, P["tall_snow"], [s[2], s[3]], v))
    for side in ("s", "e", "w"):                                           # 풀밭 가장자리 잎끝(정본 outdoor2.tall_fringe, 위층, L7 K4)
        sh.add(f"stall_fringe_{side}", o2.tall_fringe(dict(P, tall=P["tall_snow"]), side))
    wt.add_round_tall(sh, "stall", P["tall_snow"], [("s", sn.snow0)])          # 정본 둥근 귀 풀숲 한 벌(감독 결정 I4 W2) — 바닥 s = 눈밭
    sh.row_start()
    for part, nm in (("l", "l"), ("m0", "mid"), ("m1", "mid1"), ("r", "r")):
        sh.add(f"sledge_s_{nm}", sn.snow_ledge(P, part))
    sh.add("sledge_e", sn.snow_ledge_side(P, "e"))
    sh.add("sledge_w", sn.snow_ledge_side(P, "w"))
    for v in range(2):
        sh.add(f"snow_pile{v}", dcav.snow_drift(dict(P, dg_snow=[s[1], s[2], s[3], s[5], s[6]])))   # 정본 던전 ice_cave 눈 더미(인자 없음 → 두 이름 같은 그림, L7 N1)
        sh.add(f"ice_rock{v}", dcav.ice_rock(P, v))                        # 정본 던전 ice_cave 얼음 바위(L6 N3)
    sh.add("frost_bush", sn.frost_bush(dict(P, _leaf_hex=seed["palette"]["pine_snow"])))
    sh.add("sign_snow", sn.snow_sign(P))
    _obj(sh, "snowman", sn.snowman(P))
    sh.row_start()
    cn = lm.CENTER_N                                                       # 센터 4×4(통합 I4 W1 — 옛 6×6)
    cen = px.new(cn * T, cn * T)                                           # 눈 덮인 센터: 공통 센터 그림의 지붕 윤곽을 따라 눈을 얹는다
    for y in range(cn):
        for x in range(cn):
            cen.paste(sh.tiles[sh.ids[f"center.{x}.{y}"]], (x * T, y * T))
    _obj(sh, "center_snow", sn.snow_cap(P, cen, "center", depth=8, roof_ramp=P["roof_red"]))   # 4×4 센터 지붕은 낮다 — 옛 깊이 11 은 지붕 절반을 덮었다
    sh.end_section()
    sh.section("다져진 눈길 오토타일(47)")
    for k in px.ALL47:
        sh.add(f"snowpath_at{k}", sn.snowpath(P, k))
    for v in range(1, 4):                                                   # 속 변형(가장자리에서 2칸 안): 덩이 자리만 다르다
        sh.add(f"snowpath_atin0_{v}", sn.snowpath(P, 255, v))
    sh.end_section()
    sh.section("얼음 바닥 오토타일(47, 미끄럼)")
    Pice = dict(P, dg_snow=[s[2], s[3], s[4], s[5], s[6]])                       # 바깥 바닥 = 이 시트 눈(바탕 #dde6f4), 얼음 램프 dg_ice 는 던전과 같은 값
    for k in px.ALL47:
        sh.add(f"ice_at{k}", dcav.ice_cell(Pice, k))                              # 정본 던전 얼음 판(사선 / · 흰 점 없음, L4 N2)
    sh.end_section()
    sh.section("얼어붙은 연못(눈 돌 고리) 오토타일(47)")
    for k in px.ALL47:
        sh.add(f"pond_at{k}", sn.pond(P, k))
    sh.end_section()
    sh.section("눈 덮인 침엽수 숲 벽(9조각, 그루 = 정본 침엽수 + 눈 모자)")
    Psf = dict(P, _leaf_hex=seed["palette"]["pine_snow"], _pine_body_hex=seed["palette"]["pine_snow_body"], grass=[s[2], s[3]], trunk=P["trunk_snow"])
    for name, t in cf.nine_slice(Psf, sn.snow0, "sforest_", sn.pine_crown, "snow-pine").items():
        sh.add(name, t)
    sh.row_start()
    _obj(sh, "spine_a", sn.lone_pine(Psf))
    sh.end_section()
    sh.section("눈 벼랑(정본 두 그룹: 윗면 47 + 속 6 · 앞면 47 두 줄 + 덩이 변형 — 색만 눈, 고드름 덧칠)")
    snow_top = [P["ice_rock"][0], P["ice_rock"][1], s[2], s[4], s[6]]                # 윗면 결 = 흰 눈(그늘은 눈 그늘 톤)
    snow_cliff = [px.hexc("#46558c"), s[0], s[2], s[4], s[6]]                       # 앞면·테 램프(최암·홈·몸·빛·테) = 남색 → 청회 → 연청 → 흰색
    def icicles(name, m, im):                                                       # 앞면 윗입술 아래 2~3px 흰 고드름(1px 폭) — 모양은 정본 덩이 그대로, 위 덧칠만(I2 Y8)
        if m & N:
            return                                                                  # 아랫칸(윗입술 없음)
        var = 0 if "_atin" not in name else int(name.rsplit("_", 1)[1]) + 1
        r = px.rng(f"icicle-{var}")
        dark = {snow_cliff[0][:3], snow_cliff[1][:3]}
        last = -9
        for x in range(1, T - 1):                                               # 덩이 사이 어두운 틈 위에만 단다(밝은 덩이 위 흰 점은 안 보인다)
            if (not m & W and x < 5) or (not m & E and x > 10) or x - last < 3:
                continue
            y0 = wm._lip(var, x) + 1
            if y0 + 2 >= T or im.getpixel((x, y0))[:3] not in dark or r.random() < 0.35:
                continue
            for i in range(r.choice((2, 2, 3))):
                im.putpixel((x, y0 + i), s[6] if i < 2 else s[3])
            last = x
    for name, t in cl.plateau_set(snow_cliff, sn.snow0, "icecliff", "iceface", "icecliff", shade=lambda x, y: s[3],
                                  top_fn=lambda v: cl.snow_top(snow_top, P["ice_rock"], v, "icecliff"), face_fn=icicles).items():
        if name == f"iceface_at{px.ALL47[0]}":
            sh.row_start()
        sh.add(name, t)
    sh.end_section()

    # ---- 사막 -----------------------------------------------------------------------------
    sd = P["sand"]
    sh.section("사막 바닥·모래 언덕 턱·사막 소품")
    for v in range(4):
        sh.add(f"dsand{v}", ds.sand_tex(P, v))
    _ledges(sh, P, "dledge", ds._SAND0, P["dune"], [sd[0], sd[1]])
    sh.add("cactus", ds.cactus_small(P))
    for v in range(2):
        sh.add(f"drock{v}", ds.dry_rock(P, v))
    sh.add("ruin_stub", _pillar_outline(drm.ru_rubble(dict(P, dg_rustone=P["ruin"], i2_ol=[P["ruin"][0]]), 1), P, 11, 13))   # 정본 던전 쓰러진 기둥 토막(사암 램프·사암 윤곽, L7 K2)
    sh.add("dbush", ds.dry_bush(P))
    sh.add("dbones", ds.bones(P))
    _obj(sh, "cactus_tall", ds.cactus_tall(P))
    _obj(sh, "ruin_pillar", _pillar_outline(drm.ru_pillar(dict(P, dg_rustone=P["ruin"], i2_ol=[P["ruin"][0]])), P))  # 정본 던전 유적 기둥을 사암 램프·사암 윤곽으로(L4 N5, L5 K6)
    _obj(sh, "ruin_wall", ds.ruin_wall(P))
    sh.row_start()
    _obj(sh, "palm_a", coast.palm(P))                                            # 정본 해안 야자(같은 게임의 같은 나무, L4 N6)
    _obj(sh, "dcone", cl.rock_pile(P["cliff_desert"], "dcone", "a"))                  # 키 큰 바위 무더기 두 변형 + 낮은 둥근 바위(dcone_b)
    _obj(sh, "dcone_c", cl.rock_pile(P["cliff_desert"], "dcone", "b"))
    _obj(sh, "dcone_b", wm.big_rock(dict(P, rock=P["cliff_desert"])))                # 낮은 둥근 바위 = 정본 야생 큰 바위를 사암 램프로(L6 K5)
    sh.row_start()
    _obj(sh, "ruin_gate", ds.ruin_gate(P))
    _obj(sh, "sandpit", ds.sandpit(P))
    sh.end_section()
    sh.section("오아시스 풀 띠 오토타일(47)")
    for k in px.ALL47:
        sh.add(f"dgrass_at{k}", ds.oasis_grass(P, k))
    sh.end_section()
    sh.section("깊은 모래 오토타일(47)")
    for k in px.ALL47:
        sh.add(f"dsdeep_at{k}", ds.deep_sand(P, k))
    sh.end_section()
    sh.section("깊은 모래 얼룩 두 장(칸 안 곡선 경계, 바닥 칸) — dspatch_a 7×4 · dspatch_b 4×3")
    for nm, (cw, ch, rx, ry, rot) in {"a": (7, 4, 47.0, 21.0, -0.20), "b": (4, 3, 27.0, 16.5, -0.16)}.items():
        sh.row_start()
        for (i, jj), t in ds.sand_patch(P, cw, ch, rx, ry, rot, nm).items():
            sh.add(f"dspatch_{nm}_{i}_{jj}", t)
    sh.end_section()
    sh.section("오아시스 풀 띠 한 장(8×7, 칸 안 곡선 경계) — dgpatch_<i>_<j>, 물 칸 자리(2~5, 2~4)는 oasis 가 덮는다. 사막 맵 (4,18) 기준 — 벼랑 칸(0,0)(1,0)(0,4~6)을 피한다")
    for (i, jj), t in ds.grass_patch(P, 8, 7, 64.0, 56.0, 59.0, 41.0, "oasis", avoid=[(0, 0), (1, 0), (0, 4), (0, 5), (0, 6)]).items():
        sh.add(f"dgpatch_{i}_{jj}", t)
    sh.end_section()
    sh.section("오아시스 물 오토타일(47 × 4프레임)")
    _water_rows(sh, "oasis_at", lambda k, f: ds.oasis(P, k, f))
    sh.end_section()
    sh.section("사암 벼랑(정본 두 그룹: 윗면 47 + 속 6 · 앞면 47 두 줄 + 덩이 변형 · 돌계단)")
    for name, t in cl.plateau_set(P["cliff_desert"], ds.sand0, "dcliff", "dface", "dcliff", stairs="dstairs").items():
        if name == f"dface_at{px.ALL47[0]}" or name == "dstairs_0_0":
            sh.row_start()
        sh.add(name, t)
    sh.end_section()
    sh.section("사암 벼랑 둘째 층(정본 두 그룹)")
    upper = cl.top_table(P["cliff_desert"], "dcliff")
    for name, t in cl.plateau_set(P["cliff_desert"], lambda x, y: upper[(x, y)], "dcliff2", "dface2", "dcliff2", top_seed="dcliff-hi", stairs="dstairs2").items():
        if name == f"dface2_at{px.ALL47[0]}" or name == "dstairs2_0_0":
            sh.row_start()
        sh.add(name, t)
    sh.end_section()

    # ---- 화산재 ---------------------------------------------------------------------------
    a = P["ash"]
    sh.section("재 덮인 풀·재 턱·재 소품·재 나무")
    for v in range(4):
        sh.add(f"ash{v}", ash.ash_tex(P, v))
    for v in range(2):
        sh.add(f"atall{v}", _tall(P, ash._ASH0, P["tall_ash"], [a[1], a[1]], v))
    for side in ("s", "e", "w"):
        sh.add(f"atall_fringe_{side}", o2.tall_fringe(dict(P, tall=P["tall_ash"]), side))
    wt.add_round_tall(sh, "atall", P["tall_ash"], [("a", ash.ash0)])           # 정본 둥근 귀 풀숲 한 벌(I4 W2) — 바닥 a = 재 덮인 풀
    sh.row_start()
    _ledges(sh, P, "aledge", ash._ASH0, P["ash_rock"], [a[0], a[1]])
    for v in range(2):
        sh.add(f"ash_pile{v}", ash.ash_pile(P, v))
        sh.add(f"lava_rock{v}", ash.lava_rock(P, v))
    sh.add("sand_mound", ash.sand_mound(P))
    sh.row_start()
    _obj(sh, "vcone", cl.rock_pile(P["cliff_volcanic"], "vcone", "a"))
    _obj(sh, "vcone_c", cl.rock_pile(P["cliff_volcanic"], "vcone", "b"))
    vent = px.new(T, 2 * T)                                                          # 정본 던전 lava_cave 분기공(1×2): 틈은 현무암 램프, 속 테는 용암빛(L7 N2)
    Pv = dict(P, dg_ash=P["lava"], dg_lava=P["lava_glow"])
    vent.alpha_composite(dcav.vent(Pv, "t"), (0, 0)); vent.alpha_composite(dcav.vent(Pv, "b"), (0, T))
    _obj(sh, "steam_vent", vent)
    for v in range(2):
        sh.add(f"steam{v}", ash.steam(P, v))
    sh.row_start()
    _obj(sh, "atree_a", ash.ash_tree(dict(P, _leaf_hex=seed["palette"]["leaf_ash"], trunk=P["trunk_ash"])))
    _obj(sh, "center_ash", ash.ash_cap(P, lm.center(P, "roof_red", seed="center")))   # 센터는 본 시트 센터 그대로(빨간 지붕·십자), 재는 용마루 띠에만(L6 N2)
    sh.end_section()
    sh.section("모래찜질 터(검은 모래) 오토타일(47)")
    for k in px.ALL47:
        sh.add(f"sandbath_at{k}", ash.sandbath(P, k))
    sh.end_section()
    sh.section("흙길(꽃잎마을) 오토타일(47)")
    for k in px.ALL47:
        sh.add(f"ashpath_at{k}", ash.ash_path(P, k))
    sh.end_section()
    sh.section("온천(돌 고리·김) 오토타일(47 × 4프레임)")
    _water_rows(sh, "spring_at", lambda k, f: ash.spring(P, k, f))
    for v in range(1, 4):                                                   # 속 변형: 기포 무리(엔진이 칸 위치로 고른다)
        if len(sh.tiles) % 4:
            sh.row_start()
        for f in range(4):
            sh.add(f"spring_atin0_{v}_f{f}", ash.spring(P, 255, f, v))
        sh.ids[f"spring_atin0_{v}"] = sh.ids[f"spring_atin0_{v}_f0"]
        sh.anim.append(dict(baseTile=sh.ids[f"spring_atin0_{v}_f0"], frames=4, fps=3))
    sh.end_section()
    sh.section("화산 바위 벼랑(정본 두 그룹: 윗면 47 + 속 6 · 앞면 47 두 줄 + 덩이 변형 · 돌계단)")
    for name, t in cl.plateau_set(P["cliff_volcanic"], ash.ash0, "vcliff", "vface", "vcliff", stairs="vstairs").items():
        if name == f"vface_at{px.ALL47[0]}" or name == "vstairs_0_0":
            sh.row_start()
        sh.add(name, t)
    sh.end_section()
    sh.section("화산 바위 벼랑 둘째 층(정본 두 그룹)")
    vupper = cl.top_table(P["cliff_volcanic"], "vcliff")
    for name, t in cl.plateau_set(P["cliff_volcanic"], lambda x, y: vupper[(x, y)], "vcliff2", "vface2", "vcliff2", top_seed="vcliff-hi", stairs="vstairs2").items():
        if name == f"vface2_at{px.ALL47[0]}" or name == "vstairs2_0_0":
            sh.row_start()
        sh.add(name, t)
    sh.end_section()
    sh.section("재 덮인 숲 벽(9조각)")
    Paf = dict(P, _leaf_hex=seed["palette"]["leaf_ash"], grass=[a[0], a[1]])
    for name, t in cf.nine_slice(Paf, ash.ash0, "aforest_", forest.crown, "forest-crown").items():
        sh.add(name, t)
    sh.end_section()

    sh.section("표지판·우편함")
    sh.add("sign", o2.sign(P))
    sh.add("sign_metal", o2.sign(P, metal=True))
    sh.add("mailbox", o2.mailbox(P))
    sh.end_section()
    return sh


AUTOTILE_MASKS = {
    "snowpath": lambda: sn.masks("snowpath"), "ice": lambda: cc.masks(dcav.ICE),
    "pond_inner": lambda: sn.masks("pond_inner"), "pond_outer": lambda: sn.masks("pond_outer"),
    "deepsand": lambda: ds.masks("deepsand"), "oasis": lambda: ds.masks("oasis"), "dgrass": lambda: ds.masks("dgrass"),
    "ashpath": lambda: ash.masks("ashpath"), "sandbath": lambda: ash.masks("sandbath"), "spring_inner": lambda: ash.masks("spring_inner"), "spring_outer": lambda: ash.masks("spring_outer"),
}


def autotile_masks(kind: str) -> dict:
    if kind in AUTOTILE_MASKS:
        return AUTOTILE_MASKS[kind]()
    return mo.autotile_masks(kind)


def role_ids(sh) -> dict[str, list[str]]:
    ids = sh.ids
    pick = lambda *n: [x for x in n if x in ids]
    return {
        "snow": pick("snow0"), "ice": pick("ice_at255"), "sand": pick("dsand0"), "ash": pick("ash0"),
        "tall_grass": pick("stall0", "atall0"), "fence": pick("fence_at0"), "sign": pick("sign", "sign_snow"),
    }


landmark_roles = mo.landmark_roles
negatives = mo.negatives
FAMILIES = [("다져진 눈길", "snowpath_at", "snowpath", ""), ("얼음 바닥", "ice_at", "ice", ""), ("얼어붙은 연못", "pond_at", "pond_inner", ""),
            ("깊은 모래", "dsdeep_at", "deepsand", ""), ("오아시스 풀 띠", "dgrass_at", "dgrass", ""), ("오아시스", "oasis_at", "oasis", "_f0"), ("사암 벼랑 윗면", "dcliff_at", "cliff_top", ""), ("사암 벼랑 앞면", "dface_at", "cface", ""),
            ("흙길", "ashpath_at", "ashpath", ""), ("모래찜질 터", "sandbath_at", "sandbath", ""), ("화산 바위 벼랑 윗면", "vcliff_at", "cliff_top", ""), ("화산 바위 벼랑 앞면", "vface_at", "cface", ""), ("온천", "spring_at", "spring_inner", "_f0"),
            ("사암 벼랑 둘째 층 윗면", "dcliff2_at", "cliff_top", ""), ("사암 벼랑 둘째 층 앞면", "dface2_at", "cface", ""), ("눈 벼랑 윗면", "icecliff_at", "cliff_top", ""), ("눈 벼랑 앞면", "iceface_at", "cface", ""), ("화산 벼랑 둘째 층 윗면", "vcliff2_at", "cliff_top", ""), ("화산 벼랑 둘째 층 앞면", "vface2_at", "cface", "")]
EXTRA_MASKS = {"연못 돌 고리 바깥": "pond_outer", "온천 돌 고리 바깥": "spring_outer"}
_GROUND_AT = [("snowpath_at", ""), ("ice_at", ""), ("pond_at", ""), ("dsdeep_at", ""), ("dgrass_at", ""), ("oasis_at", "_f0"), ("ashpath_at", ""), ("sandbath_at", ""), ("spring_at", "_f0")]
OPAQUE = [f"snowpath_atin0_{v}" for v in range(1, 4)] + ["snow0", "snow1", "snow2", "snow3", "stall0", "stall1", "dsand0", "dsand1", "dsand2", "dsand3", "ash0", "ash1", "ash2", "ash3", "atall0", "atall1",
          "dcliff_at255", "vcliff_at255", "dcliff2_at255", "vcliff2_at255", "icecliff_at255"] + [f"{p}_at255" for p in ("dface", "vface", "dface2", "vface2", "iceface")] + [f"{p}{k}{s}" for p, s in _GROUND_AT for k in px.ALL47] \
    + [f"{b}{v}r{g}{bits}" for b, g in (("stall", "s"), ("atall", "a")) for v in range(2) for bits in range(1, 16)] \
    + [f"{p}_rnd{m}" for p in ("dface", "vface", "dface2", "vface2", "iceface") for m in wm.ROUND_MASKS]
