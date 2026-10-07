"""몬스터 수집 체육관 지역 시트 — 본 시트 체육관 3관(상록·보라·회색, 공통 절 `gym`)에 8관을 더한다.
원작 FRLG·RSE 체육관 지도를 그려 읽은 문법이다(픽셀은 복사하지 않음). 드래곤관만 원작 근거 없이 지은 관이다.

공통 뼈대: 맨 위 두 줄 = 관마다 다른 뒷벽 · 옆·아래 검은 여백 + 흰 천장 띠 · 뒷벽 아래 한 톤 그늘 줄 · 아래 가운데 파란 유리 매트(입구) · 뒷벽 가운데 금 문장 · 고양이 석상 한 쌍.
관장 자리·석상 자리·단 모양·칸막이 앞면은 관마다 다르다(아래). 이벤트로 바뀌는 칸은 두 상태를 모두 칸으로 두었다 — 맵에는 지금 상태를 깔고, 이벤트가 다른 상태로 바꾼다.

관별 문법(한 관 = 한 퍼즐 장치):
- 물(블루시티 수영장): 크림 둘레 판(gy_fl_rim)이 수영장 물(gy_pool)을 두르고 물 위 길이 가운데 섬으로 간다. 관장은 단 없이 섬 위에 서고 석상 둘이 섬에서 관장을 낀다.
  섬 앞 물 위 길은 가라앉은 징검돌(gy_stone_sunk)이 끊는다 → 둘레 바닥의 밸브 판(gy_valve)을 밟으면 떠오른다(gy_stone_up). 사다리는 둘레 가장자리에 걸치고(gy_ladder_n/w/e), 다이빙대는 둘레에서 물 쪽으로 튀어나온다.
- 불(홍련섬 퀴즈관 + 용암마을): 벽돌 포장 바닥 · 크림 기둥에 붉은 띠 칸막이 두 줄이 방을 셋으로 나눈다. 칸막이마다 셔터 퀴즈 문(gy_qdoor_t/f) 하나 — 옆 퀴즈 기계 앞에서 답하면 열린다(gy_qdoor_open_t/f).
  가운데 방은 바닥과 같은 높이의 김 구멍(gy_vent) 밭 — 밟으면 떨어진다. 관장은 왼쪽 위 벽돌 단(홍련섬처럼 구석), 석상은 입구 양옆.
- 얼음(루네시티 얼음 바닥): 고드름 칸막이로 두른 얼음판(gy_ice — 던전 얼음 동굴과 같은 사선 결 얼음 판) — 들어온 방향으로 막힐 때까지 미끄러진다. 얼음 바위(gy_icerock0/1)만이 미끄럼을 세운다.
  금 간 얼음(gy_crack)은 밟고 지나면 깨진다(gy_ice_hole). 위 출구 틈 양옆을 석상이 지키고 관장은 결정 원판 단 위.
- 유령(독자 + 이끼섬 공허): 판석 길 사이 어둠 낭떠러지(gy_abyss, 북쪽에 판석 단면) — 들어갈 수 없다. 관장 단(제단)은 낭떠러지 건너. 구석의 혼불 문양(gy_sigil)을 밟으면 숨은 다리(gy_ibridge_hid → gy_ibridge_v/h)가 나타난다.
  석상은 다리 앞 판석 마당에, 촛대는 세 갈래(칸을 채우는 막힘 소품).
- 에스퍼(노랑시티): 방 아홉이 각자 뒷벽 두 줄(gy_wall_psy_up/dn)을 갖고, 방 사이는 흰 윗면 + 오른쪽 연보라 옆면의 솟은 얇은 벽(gy_psyv, 벽 줄 위로 이어지는 자리는 gy_psyv_up/dn). 문은 없다 — 같은 짝의 워프 판(gy_warp)을 밟아 옮긴다.
  관장은 한가운데 방의 원판(3×3) 위, 석상은 입구 방.
- 풀·벌레(무지개시티 정원 + 검방울): 잔디 위 둥근 나무 줄 울타리(gy_hedge, 칸마다 한 그루) 두 줄. 아래 줄 틈은 회전문(gy_turn_pivot(팔 가로)/gy_turn_pivot_v(팔 세로) + 팔 gy_turn_h(동쪽 팔)/gy_turn_h_w(서쪽 팔)/gy_turn_v(아래 팔)/gy_turn_v_n(위 팔) — 바깥 끝마다 기둥 발, 팔에 직각으로 걸어 들면 90도 돈다), 위 줄 틈은 자르기 나무(gy_cuttree).
  관장은 오른쪽 위 꽃 무대(검방울처럼 구석), 석상은 입구 길 양옆.
- 격투(노랑시티 도장 + 무로 체육관): 위 다다미 수련장 · 아래 가로 마루 앞마당 · 사이에 진갈색 나무 칸막이 미로. 미로는 어둠(gy_dark_l<빛 이웃 마스크>, 벽 위는 _w)이 덮고, 밝은 칸에 닿은 둘레만 칸 안에서 빛이 번진다(디더 경사).
  미로 입구 틈은 격파 판(gy_boards → gy_boards_broken). 관장은 다다미 위 방석.
- 드래곤(지은 관): 용암 바다(gy_lava, 현무암 단면 둑) 위 판석 길 · 현무암 벽돌 뒷벽(바닥과 다른 재료). 길이 끊긴 한 칸 틈 둘은 괴력 바위(본 시트 밀기 바위 g2_boulder0/1)를 밀어 넣어 메운다(gy_lava_fill).
  오른쪽은 고정 돌다리(gy_lbridge_v/h, 난간). 관장은 돌계단 단 위, 용 석상 둘이 단을 낀다."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
import px  # noqa: E402
import monster_overworld as mo  # noqa: E402
from pokemon_overworld import palette  # noqa: E402,F401  (관문이 recipe.palette 를 부른다)
import interior2 as i2  # noqa: E402
import gym2 as g2  # noqa: E402
import buildings as bd  # noqa: E402
import gyms_common as gc  # noqa: E402
import gyms_props as gp  # noqa: E402
import dungeon_cavern as dc  # noqa: E402  (정본: 얼음 판·얼음 바위·금 간 얼음·용암 — REGIONS.md 2-1)
import dungeon_kit as dk  # noqa: E402
import wild_forest as wf  # noqa: E402  (정본: 자르기 나무)
import json  # noqa: E402
import outdoor2 as o2  # noqa: E402  (정본: 꽃)
import dungeon_rooms as dr  # noqa: E402  (정본: 유령 탑 묘비)

_DATA = Path(__file__).resolve().parents[4] / "harness-data" / "tileset-authoring"


def borrow(P, sheet: str, keys):
    """다른 시트 시드의 램프를 그대로 읽어 온다(복사해 두지 않는다 — 그 시트 색이 바뀌면 따라온다)."""
    pal = json.loads((_DATA / sheet / "seed.json").read_text())["palette"]
    for k in keys:
        P[k] = px.ramp(pal[k])
    return P

DOC_MODULES = ("gyms_common", "gyms_props")
MAP_NOTES = {
    "gym_water": "물관(블루시티): 밸브 판을 밟아 징검돌을 띄워야 섬의 관장에게 간다.",
    "gym_fire": "불관(홍련섬 퀴즈): 퀴즈 기계 둘을 풀어 셔터 문 둘을 열고, 김 구멍을 피해 왼쪽 위 관장에게 간다.",
    "gym_ice": "얼음관(루네시티): 얼음 바위에 부딪혀 멈추는 자리를 이어 위 출구로 간다.",
    "gym_ghost": "유령관: 혼불 문양을 밟아 숨은 다리를 드러내 낭떠러지를 건넌다.",
    "gym_psychic": "에스퍼관(노랑시티): 문 없는 방 아홉을 워프 판 짝으로 옮겨 다닌다.",
    "gym_grass": "풀관(무지개시티·검방울): 회전문을 돌리고 자르기 나무를 베어 오른쪽 위 관장에게 간다.",
    "gym_dojo": "도장(노랑시티·무로): 격파 판을 깨고 어두운 미로를 지나 다다미 위 관장에게 간다.",
    "gym_dragon": "드래곤관(지은 관): 괴력 바위 둘을 용암 틈에 밀어 넣어 길을 잇는다.",
}

CORE = ("gym",)
FLOORS = ("deck", "rim", "hot", "ist", "gst", "psy", "turf", "wood", "tatami", "bas")
WALLS = ("pool", "fire", "ice", "ghost", "psy", "grass", "dojo", "dragon")
# 칸막이: 접두사 → (윗면 램프, 앞면 함수, 바닥)
BLOCKS = {"fire": ("gy_cream", gc.face_fire, "hot"), "ice": ("g2_wall", gc.face_ice, "ist"), "dojo": ("gy_wood", gc.face_dojo, "wood")}


def _floors(sh, P, kinds):
    for k in kinds:
        for v in range(4):                          # 변형 넷 — 쇼케이스가 칸 위치 해시로 고른다(격자 방지)
            sh.add(f"gy_fl_{k}{v}", gc.floor(P, k, v))
        base = gc.floor(P, k, 0)
        sh.add(f"gy_fl_{k}_s", gc.under_wall(base))
        sh.add(f"gy_fl_{k}_e", gc.east_shadow(base))
        sh.add(f"gy_fl_{k}_se", gc.east_shadow(gc.under_wall(base)))
        sh.add(f"gy_mat_{k}", gc.mat(P, k))


def _walls(sh, P, style):
    sh.row_start()
    for part in ("up", "dn"):
        sh.add(f"gy_wall_{style}_{part}", gc.wall(P, style, part))
        for side in "lr":
            sh.add(f"gy_wall_{style}_{part}_{side}", gc.corner_wall(P, style, part, side))


def _obj(sh, name, im):
    for nm, t in bd.cut(im, name).items():
        sh.add(nm, t)


def _anim(sh, name, frames, fps=3):
    """한 줄에 이어 붙인 프레임 띠(엔진 애니메이션은 연속 번호를 돈다). 이름 그대로 부르면 0 프레임."""
    if len(sh.tiles) % 4:
        sh.row_start()
    for f, im in enumerate(frames):
        sh.add(f"{name}_f{f}", im)
    sh.ids[name] = sh.ids[f"{name}_f0"]
    sh.anim.append(dict(baseTile=sh.ids[f"{name}_f0"], frames=len(frames), fps=fps))


def _flow(sh, prefix, draw):
    for k in px.ALL47:
        _anim(sh, f"{prefix}_at{k}", [draw(k, f) for f in range(4)])


def _blocks(sh, P, key):
    top, face, fl = BLOCKS[key]
    floor_im = gc.floor(P, fl, 0)
    if key == "ice":                               # 얼음판을 두르는 칸막이: 얼음 쪽 바닥 틈에 돌 바닥 줄눈이 16px 눈금으로 찍혔다 → 민 판 톤(QA-L6 N13)
        floor_im = px.new()
        for y in range(16):
            for x in range(16):
                floor_im.putpixel((x, y), P["gy_ist"][2])
    fn = face(P)
    sh.row_start()
    for k in px.ALL47:
        sh.add(f"gy_pb_{key}_at{k}", gc.block(P, k, top, fn, floor_im))


def build(seed: dict):
    sh = mo.build(seed, seed.get("sections", CORE))
    P = palette(seed)
    borrow(P, "monster-dungeon", ("dg_ghstone", "dg_moss", "dg_ice", "dg_snow", "dg_icewall", "dg_icerock", "dg_lava", "dg_crust", "dg_lvwall", "dg_lvedge", "dg_ash"))
    P["gy_ice"] = P["dg_ice"]
    P["gy_hedge"] = P["leaf"]                      # 생울타리·회전문·화분·꽃 무대 잎도 본 시트 잎 램프 하나로(자르기 나무와 같은 잎, QA-L6 N12)                      # 얼음관의 얼음 재료(칸막이 윗면·결정·단·깨진 구멍)도 던전 얼음 램프 하나로

    sh.section("방 테두리(옆·아래 검은 여백 + 흰 천장 띠)")
    for sides in ("", "l", "r", "t", "lt", "rt"):
        sh.add(f"i2_edge_{sides or 'v'}", i2.edge(P, sides))
    sh.add("i2_edge_mat", i2.edge_mat(P))
    sh.end_section()

    sh.section("물 체육관(수영장 바닥·둘레 판·물 4프레임·징검돌·밸브 판·사다리·다이빙대)")
    _floors(sh, P, ("deck", "rim"))
    _walls(sh, P, "pool")
    sh.row_start()
    sh.add("gy_valve", gp.valve(P)); sh.add("gy_valve_on", gp.valve(P, True))
    sh.add("gy_stone_sunk", gp.stone_sunk(P)); sh.add("gy_stone_sunk_lane", gp.stone_sunk_lane(P)); sh.add("gy_stone_up", gp.stone_up(P))
    for side in "nwe":
        sh.add(f"gy_ladder_{side}", gp.ladder(P, side))
    sh.add("gy_lane", gp.lane(P)); sh.add("gy_lane_end_e", gp.lane_end(P, "e")); sh.add("gy_lane_end_w", gp.lane_end(P, "w"))
    _obj(sh, "gyp_dive", gp.dive(P)); _obj(sh, "gyp_port", gp.porthole(P))
    sh.row_start(); _obj(sh, "gyp_emb_pool", g2.emblem(P, "gy_pool"))
    _flow(sh, "gy_pool", lambda k, f: gc.pool_cell(P, k, f))
    for t in (0, 1):                                    # 속 변형 7개씩(반짝임 자리만 다르다 — 엔진 칸 해시로 섞는다)
        for v in range(7):
            _anim(sh, f"gy_pool_atin{t}_{v}", [gc.pool_cell(P, 255, f, alt=(v + 3 * t) % 7) for f in range(4)])
    sh.end_section()

    sh.section("불 체육관(벽돌 포장·김 구멍 4프레임·화로·퀴즈 기계·셔터 퀴즈 문 닫힘/열림·벽돌 칸막이)")
    _floors(sh, P, ("hot",))
    _walls(sh, P, "fire")
    _anim(sh, "gy_vent", [gp.vent(P, f) for f in range(4)])
    _anim(sh, "gy_vent_s", [gp.vent(P, f, shaded=True) for f in range(4)])
    _anim(sh, "gy_vent_up", [gp.vent_up(P, f) for f in range(4)])
    sh.row_start()
    for nm, part, op in (("gy_qdoor_t", "t", False), ("gy_qdoor_f", "f", False), ("gy_qdoor_open_t", "t", True), ("gy_qdoor_open_f", "f", True)):
        sh.add(nm, gp.qdoor(P, part, op))
    _obj(sh, "gyp_brazier", gp.brazier(P)); _obj(sh, "gyp_quiz", gp.quiz(P))
    sh.row_start(); _obj(sh, "gyd_dais_fire", gp.dais_fire(P)); _obj(sh, "gyp_emb_fire", g2.emblem(P, "gy_brick"))
    _blocks(sh, P, "fire")
    sh.end_section()

    sh.section("얼음 체육관(돌 바닥·사선 결 얼음판 미끄럼·금 간 얼음/깨진 구멍·얼음 바위·결정·고드름 칸막이)")
    _floors(sh, P, ("ist",))
    _walls(sh, P, "ice")
    sh.row_start()
    # 금 간 얼음·얼음 바위는 던전 얼음 동굴 정본 함수(같은 미끄럼 퍼즐 장치) — 체육관에서 다시 그리지 않는다
    sh.add("gy_crack", dc.ice_crack(P)); sh.add("gy_ice_hole", gp.ice_hole(P)); sh.add("gy_icerock0", dc.ice_rock(P, 0)); sh.add("gy_icerock1", dc.ice_rock(P, 1))
    _obj(sh, "gyp_crystal", gp.crystal(P))
    sh.row_start(); _obj(sh, "gyd_dais_ice", gp.dais_ice(P)); _obj(sh, "gyp_emb_ice", g2.emblem(P, "gy_ice"))
    sh.row_start()
    for k in px.ALL47:
        sh.add(f"gy_ice_at{k}", gc.ice_cell(P, k))
    _blocks(sh, P, "ice")
    sh.end_section()

    sh.section("유령 체육관(판석·어둠 낭떠러지 4프레임·숨은/나타난 다리·혼불 문양 꺼짐/켜짐·세 갈래 촛대·묘비(던전 유령 탑 정본)·제단)")
    _floors(sh, P, ("gst",))
    _walls(sh, P, "ghost")
    sh.row_start()
    sh.add("gy_ibridge_hid", gp.ibridge_hidden(P)); sh.add("gy_ibridge_h", gp.ibridge(P, "h")); sh.add("gy_ibridge_v", gp.ibridge(P, "v"))
    sh.add("gy_sigil", gp.sigil(P)); sh.add("gy_sigil_on", gp.sigil(P, True)); sh.add("gy_candle", gp.candelabra(P))
    _obj(sh, "gyp_grave_a", dr.grave(P, "a")); _obj(sh, "gyp_grave_d", dr.grave(P, "d"))   # 정본: 던전 유령 탑 묘비 gh_grave_a/d
    _obj(sh, "gyp_lamp", gp.lamp(P))
    sh.row_start(); _obj(sh, "gyd_dais_ghost", gp.dais_ghost(P)); _obj(sh, "gyp_emb_ghost", g2.emblem(P, "gy_sigil"))
    _flow(sh, "gy_abyss", lambda k, f: gc.abyss_cell(P, k, f))
    sh.end_section()

    sh.section("에스퍼 체육관(방마다 뒷벽 · 얇은 남색 방 벽 · 워프 판 꺼짐/켜짐 · 수정 구슬 · 원판 단)")
    _floors(sh, P, ("psy",))
    _walls(sh, P, "psy")
    sh.row_start()
    for part in ("body", "up", "dn"):
        sh.add("gy_psyv" if part == "body" else f"gy_psyv_{part}", gc.psy_vwall(P, part))
    sh.add("gy_psyv_s", gc.psy_vwall(P, "s"))
    sh.add("gy_warp", gp.warp(P)); sh.add("gy_warp_on", gp.warp(P, True)); _obj(sh, "gyp_orb", gp.orb(P))
    sh.row_start(); _obj(sh, "gyd_dais_psy", gp.dais_psy(P)); _obj(sh, "gyp_emb_psy", g2.emblem(P, "gy_psyface"))
    sh.end_section()

    sh.section("풀·벌레 체육관(본 시트 풀·꽃밭·나무 줄 울타리·자르기 나무·회전문·화분·꽃 무대)")
    _floors(sh, P, ("turf",))
    _walls(sh, P, "grass")
    sh.row_start()
    for v, kind in enumerate(("pink", "white", "red")):        # 정본: 본 시트 꽃(outdoor2.flowers) 그대로(바닥이 본 시트 풀)
        sh.add(f"gy_flowers{v}", o2.flowers(P, kind))     # 바닥이 본 시트 풀이 되어 꽃 칸도 본 시트 그대로
    sh.add("gy_cuttree", wf.cut_tree(borrow(dict(P, _leaf_hex=seed["palette"]["leaf"]), "monster-wild", ("wfloor",))))   # 정본: 야생 자르기 나무(야생과 바이트까지 같게 발밑 그늘도 야생 팔레트)
    for part in ("pivot", "pivot_v", "h", "h_w", "v", "v_n"):
        sh.add(f"gy_turn_{part}", gp.turn(P, part))
    sh.add("gy_pot", gp.pot(P))
    sh.row_start(); _obj(sh, "gyd_dais_grass", gp.dais_grass(P)); _obj(sh, "gyp_emb_grass", g2.emblem(P, "gy_hedge"))
    sh.row_start()
    turf = gc.floor(P, "turf", 0)
    for k in px.ALL47:
        sh.add(f"gy_hedge_at{k}", gc.hedge(P, k, turf))
    sh.end_section()

    sh.section("격투 도장(가로 마루·다다미·족자·샌드백·격파 판/부서진 판·빛이 번지는 어둠 47·나무 칸막이)")
    _floors(sh, P, ("wood", "tatami"))
    _walls(sh, P, "dojo")
    sh.row_start()
    sh.add("gy_boards", gp.boards(P)); sh.add("gy_boards_broken", gp.boards(P, True))
    sh.row_start()
    for m in gp.LIGHT_MASKS:                       # 어둠 덮개 47(빛 이웃 마스크) × 바닥/벽
        sh.add(f"gy_dark_l{m}", gp.dark_light(m)); sh.add(f"gy_dark_l{m}_w", gp.dark_light(m))
    sh.row_start()
    for m in gp.LIGHT_MASKS[1:]:                   # 얕은 번짐(3·5px) — 둘레 띠 깊이를 칸마다 섞는다(QA-L3 P2)
        for k, span in enumerate((3.5, 5.5)):          # 반 픽셀 깊이 — 정수 폭이면 디더 문턱에 딱 걸려 3단 곧은 띠가 됐다(s0 동쪽 테에 디더가 없었다, I4 W7)
            sh.add(f"gy_dark_l{m}s{k}", gp.dark_light(m, span=span)); sh.add(f"gy_dark_l{m}s{k}_w", gp.dark_light(m, span=span))
    sh.ids["gy_dark"] = sh.ids["gy_dark_l0"]; sh.ids["gy_dark_w"] = sh.ids["gy_dark_l0_w"]
    sh.row_start()
    _obj(sh, "gyp_scroll", gp.scroll(P)); _obj(sh, "gyp_sandbag", gp.sandbag(P))
    sh.row_start(); _obj(sh, "gyd_dais_dojo", gp.dais_dojo(P)); _obj(sh, "gyp_emb_dojo", g2.emblem(P, "gy_brick"))
    _blocks(sh, P, "dojo")
    sh.end_section()

    sh.section("드래곤 체육관(판석 바닥·현무암 뒷벽·던전과 같은 용암·용 석상·메운 바위·난간 돌다리·돌계단 단 — 괴력 바위는 본 시트 g2_boulder)")
    _floors(sh, P, ("bas",))
    _walls(sh, P, "dragon")
    sh.row_start()
    # 괴력 바위는 본 시트 체육관 절이 물려준 밀기 바위 g2_boulder0/1 을 이름으로 쓴다(같은 게임 같은 물체 — 본 시트 그림이 바뀌면 그대로 따라온다)
    sh.add("gy_lava_fill", gp.lava_fill(P)); sh.add("gy_lbridge_h", gp.lbridge(P, "h")); sh.add("gy_lbridge_v", gp.lbridge(P, "v"))
    _obj(sh, "gyp_dragon", gp.dragon(P))
    sh.row_start(); _obj(sh, "gyd_dais_dragon", gp.dais_dragon(P)); _obj(sh, "gyp_emb_dragon", g2.emblem(P, "gy_dragon"))
    _flow(sh, "gy_lava", lambda k, f: gc.lava_cell(P, k, f))
    # I5 V2: 가장자리도 정본 자국을 쓰고 곧은 둑은 세 벌을 섞는다.
    for mask, count in dc.LAVA_EDGE_VARIANTS.items():
        for v in range(1, count):
            _anim(sh, f"gy_lava_ate{mask}_{v}", [gc.lava_cell(P, mask, f, ("e", v)) for f in range(4)])
    # 속 변형 — 기포·흐름 결 휨 열쇠만(던전 tiers 와 같은 「c」 변형 + 한 칸씩 더). 엔진 칸 해시를 4·5 로 나누면 가로로 같은 변형이
    # 줄지어 서서(실측: 4칸 연속) → 7 로 나누게 7개씩. 껍질 판은 속 변형에 넣지 않는다(줄지어 섰다, QA-L6 N14) — 아래 gy_lava_crust 를 쇼케이스가 흩뿌린다.
    for t, spots in {0: [(5, 6), (11, 10), ("c", 1), ("c", 2), ("c", 6), (8, 13), ("c", 5)],
                     1: [(7, 12), ("c", 7), (10, 5), ("c", 8), ("c", 3), ("c", 4), (3, 9)]}.items():
        for v, b in enumerate(spots):
            _anim(sh, f"gy_lava_atin{t}_{v}", [gc.lava_cell(P, 255, f, b) for f in range(4)])
    # 껍질 판 칸(던전 lv_crust 와 같은 판 번호 j — 0~3 중 · 4~9 소 · 10~11 대), 4프레임(판은 흐르지 않고 둘레 용암만 흐른다)
    for j in range(len(dc._CRUST_SHAPES)):
        _anim(sh, f"gy_lava_crust{j}", [gc.lava_cell(P, 255, f, ("k", j)) for f in range(4)])
    sh.end_section()
    return sh


def autotile_masks(kind: str) -> dict:
    if kind == "gy_ice":
        return dc.autotile_masks("ice")            # 그림이 던전 얼음 판 정본이므로 마스크도 그것
    if kind == "gy_lava":
        return dk.pool_masks()
    if kind in gc.AUTOTILE:
        return {m: gc.at_mask(kind, m) for m in px.ALL47}
    if kind.startswith("gy_pb") or kind == "gy_hedge":
        return g2.autotile_masks(kind)
    return mo.autotile_masks(kind)


def role_ids(sh) -> dict[str, list[str]]:
    return {}


landmark_roles = mo.landmark_roles
negatives = mo.negatives
FAMILIES = [("칸막이 상록", "g2_pb_teal_at", "pb_teal", ""), ("칸막이 보라", "g2_pb_elec_at", "pb_elec", ""),
            ("수영장 물", "gy_pool_at", "gy_pool", "_f0"), ("용암", "gy_lava_at", "gy_lava", "_f0"), ("낭떠러지", "gy_abyss_at", "gy_abyss", "_f0"),
            ("얼음판", "gy_ice_at", "gy_ice", ""), ("생울타리", "gy_hedge_at", "gy_hedge", "")] + \
           [(f"칸막이 {k}", f"gy_pb_{k}_at", f"gy_pb_{k}", "") for k in BLOCKS]
EXTRA_MASKS: dict = {}
OPAQUE = ["g2_fl_teal0", "g2_fl_yel0", "g2_fl_dirt0", "g2_pb_teal_at255", "i2_edge_v"] + \
         [f"gy_fl_{k}0" for k in FLOORS] + [f"gy_wall_{s}_up" for s in WALLS] + [f"gy_wall_{s}_dn" for s in WALLS] + \
         ["gy_pool_at255_f0", "gy_lava_at255_f0", "gy_abyss_at255_f0", "gy_ice_at255", "gy_hedge_at255", "gy_valve", "gy_valve_on",
          "gy_vent_f0", "gy_vent_s_f3", "gy_warp", "gy_warp_on", "gy_flowers0", "gy_psyv", "gy_psyv_up", "gy_qdoor_f", "gy_qdoor_open_f"] + \
         [f"gy_pb_{k}_at255" for k in BLOCKS] + [f"gy_pool_at{k}_f0" for k in (0, 1, 4, 15)] + [f"gy_abyss_at{k}_f0" for k in (0, 5)]
