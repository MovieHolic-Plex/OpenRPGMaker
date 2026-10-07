"""몬스터 수집 야생 시트 — 숲 미로·산 절벽 도로·늪지·꽃 정원·강과 다리(16px, 손 도트).
본 시트(monster-overworld)의 풀·키 큰 풀·턱·울타리·숲 벽·표지판을 그대로 받고, 장소마다 바닥·경계·벽·소품·출입구를 덧붙인다.
읽는 순서: 아래 장소별 문법(원작 배치도에서 잰 것) → 칸 사전 → 견본 맵(도달 검사·정상/오류 쌍).
공통 규칙: 통행이 막힌 칸은 눈에도 막혀 보이게 칠한다(나무는 잎, 절벽은 바위 덩이). 오토타일 경계를 넘는 물체(계단·동굴·폭포)는
그 자리의 오토타일 칸을 물체 쪽으로 「이어진」 변형으로 바꾼다(쇼케이스 join). 위층 수관 머리(*_cap)는 통행 판정에서 투명하다."""
from __future__ import annotations

import contextlib
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
import px  # noqa: E402
from px import T  # noqa: E402
import monster_overworld as mo  # noqa: E402
from pokemon_overworld import palette  # noqa: E402,F401  (관문이 recipe.palette 를 부른다)
import outdoor2 as o2  # noqa: E402
import forest as fo  # noqa: E402
import trees  # noqa: E402
import cave  # noqa: E402
import gym2 as g2  # noqa: E402
import wild_common as wc  # noqa: E402
import wild_forest as wf  # noqa: E402
import wild_mountain as wm  # noqa: E402
import wild_swamp as ws  # noqa: E402
import wild_garden as wg  # noqa: E402
import wild_river as wr  # noqa: E402
import wild_tall as wt  # noqa: E402

DOC_MODULES = ("wild_forest", "wild_mountain", "wild_swamp", "wild_garden", "wild_river")   # 참고문서에 머리말(장소 문법)이 실리는 도우미
CORE = ("ground", "ledges", "clearing", "sandpath", "fence", "trees", "forest", "outdoor_props")

_BANKS: dict[str, tuple] = {}


def _bank(prefix):
    if prefix not in _BANKS:
        _BANKS[prefix] = wc.pond_masks(prefix)
    return _BANKS[prefix]


def _solid_shadow(im, g0, g1):
    """턱 밑 그늘을 끊김 없는 2px 실선으로(o2.ledge 는 둘째 줄을 한 칸 걸러 찍는다 — 바느질 점선으로 읽혔다, QA-L3 M4·F4).
    열마다 가장 아래의 g0 칸을 찾아 그 밑 한 칸을 g1 로 채운다."""
    g0 = tuple(g0)[:3]
    for x in range(T):
        ys = [y for y in range(T) if im.getpixel((x, y))[:3] == g0]
        if ys and ys[-1] + 1 < T:
            im.putpixel((x, ys[-1] + 1), g1)
    return im


@contextlib.contextmanager
def _cave_floor_as(im):
    """본 시트 동굴 소품(cave.small_pebbles·smash_rock)이 바탕으로 읽는 바닥 칸을 im 으로 잠깐 바꾼다(wc.ground_as 와 같은 방식)."""
    old = dict(cave._FLOOR)
    cave._FLOOR.clear()
    cave._FLOOR.update({(x, y): im.getpixel((x, y)) for y in range(T) for x in range(T)})
    try:
        yield
    finally:
        cave._FLOOR.clear()
        cave._FLOOR.update(old)


def _pine_seed(sh, P2):
    """시트에 물려받은 본 시트 pine_a(본 시트 관문 표본 추출이 고른 그림)와 바이트가 같은 trees.pine_tiered 씨앗을 찾는다."""
    ref = [sh.tiles[sh.ids[f"pine_a.{x}.{y}"]].tobytes() for y in range(3) for x in range(2)]
    for sd in [f"pine-{i}" for i in range(40)] + ["pine-fallback"]:
        im = trees.pine_tiered(P2, seed=sd)
        if [im.crop((x * T, y * T, x * T + T, y * T + T)).tobytes() for y in range(3) for x in range(2)] == ref:
            return sd
    raise SystemExit("본 시트 pine_a 와 같은 침엽수 씨앗을 찾지 못했다")


def _pine_on(P2, sd, rim, inner):
    """본 시트 침엽수(trees.pine_tiered, 같은 씨앗)를 그대로 그리고 발밑 그늘 두 톤(잎 램프 lf3·lf2)만 바닥 색 rim·inner 로 바꾼다
    (QA-L6 N2 — 산은 흙 바닥이라 풀색 그늘 타원이 뜬다). 수관·줄기 픽셀은 pine_a 와 같다(아래에서 확인)."""
    lf = px.ramp(P2["_leaf_hex"])
    swap = {lf[3]: rim, lf[2]: inner}
    real, first = trees.px, []

    class _Px:
        def __getattr__(self, k):
            return getattr(real, k)

        def put(self, im, x, y, c):                                     # pine_tiered 의 첫 px.put 대상 = 발밑 그늘·줄기를 그리는 바탕 그림
            if not first:
                first.append(im)
            if im is first[0] and c in swap:
                c = swap[c]
            real.put(im, x, y, c)
    trees.px = _Px()
    try:
        im = trees.pine_tiered(P2, seed=sd)
    finally:
        trees.px = real
    ref = trees.pine_tiered(P2, seed=sd)
    bad = [(x, y) for y in range(ref.height) for x in range(ref.width)
           if im.getpixel((x, y)) != ref.getpixel((x, y)) and not (y >= 37 and ref.getpixel((x, y)) in swap)]
    if bad:
        raise SystemExit(f"산 침엽수가 발밑 그늘 밖에서 pine_a 와 다르다: {bad[:5]}")
    return im


def _anim4(sh, name, frames):
    if len(sh.tiles) % 4:
        sh.row_start()
    for f, im in enumerate(frames):
        sh.add(f"{name}_f{f}", im)
    sh.ids[name] = sh.ids[f"{name}_f0"]
    sh.anim.append(dict(baseTile=sh.ids[f"{name}_f0"], frames=4, fps=3))


def _woods(sh, P, floor_px, pre, seed, shadow_c):
    """야생 숲 그루 16벌(이웃 4비트) + 수관 머리 2칸 — wild_common.woods_pieces."""
    sh.row_start()
    pieces = wc.woods_pieces(P, floor_px, seed, shadow_c)
    # 그루 사이 이음 틈(I3 Z8): 아랫칸(ty 1)의 옆 그루 쪽 끝 열에 바닥이 1~2px 비친다 — 옆에 그루가 있으면 그 열의 바닥 점을 수관 최암으로 메운다.
    floor = {floor_px(x, y)[:3] for y in range(T) for x in range(T)}
    for code in range(16):
        for tx, bit, col in ((0, 4, 0), (1, 8, T - 1)):
            if not code & bit:
                continue
            im = pieces[f"{code:x}.{tx}.1"]
            leaf = [c for c in im.getdata() if c[3] == 255 and c[:3] not in floor]
            dark = min(leaf, key=lambda c: c[0] + c[1] + c[2])
            for y in range(T):                                          # 끝 열에서 안으로 이어진 바닥 점(틈은 1~2px)만
                for k in range(4):
                    x = col + (k if col == 0 else -k)
                    if im.getpixel((x, y))[:3] not in floor:
                        break
                    im.putpixel((x, y), dark)
    for code in range(16):
        for ty in range(2):
            for tx in range(2):
                sh.add(f"{pre}{code:x}.{tx}.{ty}", pieces[f"{code:x}.{tx}.{ty}"])
    for tx in range(2):
        sh.add(f"{pre}cap{tx}", pieces[f"cap.{tx}"])
    sh.row_start()


def build(seed: dict):
    sh = mo.build(seed, seed.get("core", CORE))
    P = palette(seed)
    # 나무다리는 한 그림(QA-L7 N5): 물려받은 본 시트 bridge_h/v 칸을 야생 정본 통나무 다리 한 줄(wild_river.log_bridge part "1")로 바꿔 굽는다.
    # 본 시트도 bridge_h/v = wr.log_bridge(P, o, "1") 로 import 하면 두 시트가 같은 그림이 된다.
    for o in "hv":
        sh.tiles[sh.ids[f"bridge_{o}"]] = wr.log_bridge(P, o, "1")
    P2 = dict(P)
    P2["_leaf_hex"] = seed["palette"]["leaf"]
    grass0 = wc.tex_px(mo.grass_tex(P, 0))

    sh.section("숲 벽 외줄 조각(가로 외줄·세로 외줄·외톨이 그루)")
    for name, t in wc.forest_singles(P2, grass0, "forest-crown").items():
        sh.add(f"forest_{name}", t)
    sh.end_section()

    # ---- 숲 미로 ------------------------------------------------------------------------------
    sh.section("숲 미로(어두운 숲 바닥·빛 공터·숲 벽·통나무·그루터기·버섯·숲 턱)")
    for v in range(4):
        sh.add(f"wfl{v}", wf.floor(P, v))
    wfl0 = wf.floor(P, 0)
    PW = dict(P2)
    PW["tall"] = P["wtall"]
    PW["grass"] = [P["wfloor"][0], P["wfloor"][0], P["wfloor"][1], P["wfloor"][2], P["wfloor"][3]]
    with wc.ground_as(wfl0):
        sh.add("wtall0", o2.tall_grass(PW, 0))
        sh.add("wtall1", o2.tall_grass(PW, 1))
    for side in ("s", "e", "w"):                                          # 숲 풀숲 가장자리 잎끝 = 본 시트 o2.tall_fringe(숲 풀 램프 인자, QA-L6 N4)
        sh.add(f"wtall_fringe_{side}", o2.tall_fringe(PW, side))
    # 숲 턱 = 본 시트 턱(outdoor2.ledge — 가는 혹 띠·끝은 가늘어져 말림·아래 그늘 2줄)을 숲 흙 램프·숲 바닥 그늘로 다시 칠한 것
    WLEDGE = ["#563619", "#76502c", "#986c3c", "#b88c52", "#d6ac6e"]      # 숲 턱 흙 램프: 따뜻한 흙(QA-L7 F10 — 회갈 숲 흙 램프로는 가는 띠가 떨어진 가지로 읽혔다)
    # 풀 램프 5톤: 밑 그늘 두 톤(숲 그늘 잎 램프 — 숲 바닥보다 두 단 짙은 실선 2px) + 숲 바닥 둘 + 빛 공터 밝은 톤 — 윗면 가장자리 빛 1px(g[4])이 선다.
    # 그늘 두 톤만 넣으면 o2.ledge 의 빛 가장자리가 그늘색으로 떨어져, 턱이 윗땅 끝이 아니라 바닥에 놓인 가는 흙 막대로 읽혔다(I3 Z7)
    Pwl = dict(P, rock=[px.hexc(c) for c in WLEDGE], grass=[P["leaf_dark"][1], P["leaf_dark"][2], P["wfloor"][2], P["wfloor"][3], P["wsun"][2]])
    for part, nm in (("m0", "mid"), ("m1", "mid1"), ("l", "l")):
        with wc.ground_as(wf.floor(P, 1 if nm == "mid1" else 0)):
            sh.add(f"wledge_s_{nm}", _solid_shadow(o2.ledge(Pwl, part), Pwl["grass"][0], Pwl["grass"][1]))
    # 오른끝 = 왼끝을 좌우로 뒤집은 돌 띠(바닥 결은 그대로) — 양 끝이 똑같이 가늘어진다(QA-L4 F4: 오른끝이 직각이었다)
    from PIL import ImageOps
    fl0 = wf.floor(P, 0)
    with wc.ground_as(fl0):
        lft = _solid_shadow(o2.ledge(Pwl, "l"), Pwl["grass"][0], Pwl["grass"][1])
    mir, flm = ImageOps.mirror(lft), ImageOps.mirror(fl0)
    rgt = fl0.copy()
    for y in range(T):
        for x in range(T):
            if mir.getpixel((x, y)) != flm.getpixel((x, y)):
                rgt.putpixel((x, y), mir.getpixel((x, y)))
    sh.add("wledge_s_r", rgt)
    for v in range(len(wf.MUSH_SPOTS)):
        sh.add(f"mush{v}", wf.mushrooms(P, v, wc.tex_px(wf.floor(P, v % 4))))
    # 숲 들꽃 = 본 시트 들꽃 o2.flowers(갈래 꽃잎 5×5 두 송이 + 줄기·잎, QA-L6 N3) — 바탕만 숲 바닥, 잎 밑 그늘은 숲 바닥 최암
    PF = dict(P2, grass=PW["grass"])
    for v, (kind, fr) in enumerate((("white", 0), ("white", 1), ("yellow", 0))):
        with wc.ground_as(wf.floor(P, (v + 1) % 4)):
            sh.add(f"wflower{v}", o2.flowers(PF, kind, fr))
    sh.add("cuttree", wf.cut_tree(P2))
    sh.add("stump", wf.stump(P))
    sh.add("flog.0.0", wf.log(P, 0))
    sh.add("flog.1.0", wf.log(P, 1))
    sh.row_start()
    # 숲 빛 공터 = 본 시트 밝은 공터 o2.clearing(빛 램프 wsun·숲 바닥 인자), 숲 흙길 = 본 시트 모래길 mo.sand_path(숲 흙 램프 인자) — QA-L6 전수 감사
    PS = dict(P, grass_light=P["wsun"], grass=PW["grass"])
    PD = dict(P, sand=P["wdirt"], grass=PW["grass"])
    with wc.ground_as(wfl0):
        for k in px.ALL47:
            sh.add(f"wsun_at{k}", wf.sun_clearing(PS, k, wc.tex_px(wfl0)))   # 칠 규칙은 o2.clearing, 모양은 둥근 덩이(I4 W4)
        sh.row_start()
        for k in px.ALL47:
            sh.add(f"wdirt_at{k}", mo.sand_path(PD, k))
        for k in wf.END_MASKS:                                           # 흙길 둥근 끝(I3 Z4)
            sh.add(f"wdirt_end{k}", wf.dirt_end(PD, k))
    sh.row_start()
    _woods(sh, P2, wc.tex_px(wfl0), "wood_", "forest-crown", P["wfloor"][0])   # 본 시트 숲벽과 같은 수관(같은 seed)
    sh.end_section()

    # ---- 산·절벽 ------------------------------------------------------------------------------
    sh.section("산·절벽 도로(돌흙 바닥·단 윗면 3벌·덩이 앞면 2벌·돌계단·아치 동굴·침엽수·흙 턱·풀 바닥)")
    for v in range(4):
        sh.add(f"mfl{v}", wm.mfloor(P, v))
    mfl0 = wm.mfloor(P, 0)
    mflp = wc.tex_px(mfl0)
    mf = P["mfloor"]
    msh = lambda x, y: P["mshadow"][0]                                   # 앞면 밑 그늘(돌흙)
    g = P["grass"]
    gsh = lambda x, y: g[0]                                              # 앞면 밑 그늘(풀)
    # 산의 바위는 램프 하나(QA-L7 M14): 벼랑 앞면·테·큰 바위·잔돌·깨는 바위가 모두 seed palette.cliff(적갈 바위 — 나무 램프와 다른 색상).
    # 본 시트 함수가 읽는 램프 이름(cave_floor 4톤·cave_wall 5톤)에 그 바위 램프를 넣어 부른다. 밀 바위(boulder)는 장치라 회색 그대로.
    PR = dict(P, cave_floor=P["cliff"][1:5], cave_wall=P["cliff"])
    for v in range(2):                                                    # 잔돌 = 본 시트 cave.small_pebbles(바탕만 산 돌흙), 깨는 바위 = cave.smash_rock
        with _cave_floor_as(wm.mfloor(P, v)):
            sh.add(f"mpeb{v}", cave.small_pebbles(PR, v))
    with _cave_floor_as(mfl0):
        sh.add("smashrock", cave.smash_rock(PR))
    # 산 턱 = 본 시트 턱 문법을 절벽 바위 램프·돌흙 그늘로(같은 게임의 같은 턱)
    Pml = dict(P, rock=P["cliff"], grass=[P["mshadow"][0], P["mfloor"][0]])
    for part, nm, v in (("m0", "mid", 0), ("m1", "mid1", 1), ("l", "l", 2), ("r", "r", 3)):
        with wc.ground_as(wm.mfloor(P, v)):
            sh.add(f"mledge_s_{nm}", _solid_shadow(o2.ledge(Pml, part), Pml["grass"][0], Pml["grass"][1]))
    sh.row_start()
    big = g2.big_rock(PR, outline=P["cliff"][0])                           # 큰 바위 2×2 = 본 시트 g2.big_rock(벼랑과 같은 바위 램프, 윤곽도 바위 최암 — QA-L8 N8)
    hi = tuple(PR["cave_floor"][3])
    for y in range(1, big.height):                                       # 윗변이 밝은 톤으로 끝나는 열: 바깥 1px 를 짙은 바위로 이어 윤곽이 끊기지 않게(QA-L9 M18)
        for x in range(big.width):
            if tuple(big.getpixel((x, y))) == hi and big.getpixel((x, y - 1))[3] == 0:
                big.putpixel((x, y - 1), P["cliff"][1])
    for x in range(2):
        for y in range(2):
            sh.add(f"bigrock.{x}.{y}", big.crop((x * T, y * T, x * T + T, y * T + T)))
    pine = _pine_on(P2, _pine_seed(sh, P2), P["mfloor"][0], P["mshadow"][0])   # 산 침엽수 = 본 시트 pine_a(같은 씨앗), 발밑 그늘만 돌흙 최암(QA-L6 N2)
    for y in range(3):
        for x in range(2):
            sh.add(f"pine_m.{x}.{y}", pine.crop((x * T, y * T, x * T + T, y * T + T)))
    for part in range(2):
        sh.add(f"ccave.0.{part}", wm.cave_mouth(P, part, mflp, mflp, msh))
    sh.row_start()
    for nm, top, rows in (("cstairs", mflp, 2), ("cstairs1", mflp, 1), ("gstairs", grass0, 2)):
        for y in range(rows):
            for x in range(2):
                sh.add(f"{nm}.{x}.{y}", wm.stairs(P, x, y, top, top, rows))
    mtops = [wc.tex_px(wm.mfloor(P, v)) for v in range(4)]
    htops = [wc.tex_px(wm.mfloor_hi(P, v)) for v in range(4)]              # 꼭대기 고원(cliff_a) 윗면: 한 단 밝은 톤
    gtops = [wc.tex_px(mo.grass_tex(P, v)) for v in range(4)]
    for pre, top, low, shd, tops in (("cliffa_at", htops[0], mflp, msh, htops), ("cliffb_at", mflp, mflp, msh, mtops), ("cliffg_at", grass0, grass0, gsh, gtops)):
        sh.row_start()
        for k in px.ALL47:
            sh.add(f"{pre}{k}", wm.cliff_top(P, k, top, low, shd))
        for v in range(3):                                               # 윗면 속 칸: 바닥 결 변형(아랫땅과 같은 네 벌)
            sh.add(f"{pre}in0_{v}", wm.cliff_top(P, 255, tops[v + 1], low, shd))
    for pre, top, low, shd in (("cface_at", mflp, mflp, msh), ("gface_at", grass0, grass0, gsh)):
        sh.row_start()
        for k in px.ALL47:
            sh.add(f"{pre}{k}", wm.face_tile(P, k, top, low, shd))
        for tier, mm in ((0, wm.ROW_T), (1, wm.ROW_B)):
            for v in range(wm.FACE_VARS):
                sh.add(f"{pre}in{tier}_{v}", wm.face_tile(P, mm, top, low, shd, v + 1))
        wm.add_round_face(sh, P, pre[:-3], top, low, shd)               # 띠 끝 둥근 어깨·발끝(정본, I3 Z3 · I4 W3)
    sh.row_start()
    for k in px.ALL47:
        sh.add(f"mgrass_at{k}", wm.grass_patch(P, k, mflp, grass0))
    sh.end_section()

    # ---- 늪지 ---------------------------------------------------------------------------------
    sh.section("늪지(젖은 풀땅·진흙·늪 물·갈대·부들·연잎·마른 나무)")
    for v in range(4):
        sh.add(f"swg{v}", ws.ground(P, v))
    swg0 = wc.tex_px(ws.ground(P, 0))
    for nm, inner, below in (("reed", False, True), ("reedin", True, True), ("reedbt", True, False), ("reedone", False, False)):
        for sd in ("", "_l", "_r"):                                       # 윗끝·속·아랫끝·한 줄 덩이 × 왼끝·오른끝
            for v in range(2):
                sh.add(f"{nm}{v}{sd}", ws.reeds(P, v, wc.tex_px(ws.ground(P, v)), inner=inner, side=sd[1:], below=below))
    for v in range(2):
        sh.add(f"cattail{v}", ws.cattail(P, v))
    for v in range(2):
        sh.add(f"lily{v}", ws.lily(P, v))
    sh.add("snag.0.0", ws.snag(P, 0))
    sh.add("snag.0.1", ws.snag(P, 1))
    sh.row_start()
    Psw = dict(P2, _leaf_hex=seed["palette"]["leaf_dark"])                # 늪 나무: 같은 수관 그림, 잎 램프만 한 단 어둡게
    _woods(sh, Psw, swg0, "swood_", "forest-crown", P["swamp"][0])
    sh.row_start()
    for k in px.ALL47:
        sh.add(f"mud_at{k}", ws.mud_cell(P, k, swg0))
    for t in (0, 1):
        for v in range(3):                                               # 진흙 속 칸 변형 셋씩(덩이·윤기 점 자리가 다르다)
            sh.add(f"mud_atin{t}_{v}", ws.mud_cell(P, 255, swg0, 1 + t * 3 + v))
    sh.row_start()
    for k in px.ALL47:
        _anim4(sh, f"swater_at{k}", [ws.swamp_water(P, k, f, swg0, _bank("swater")) for f in range(4)])
    for t in (0, 1):
        for v in range(3):                                               # 속 칸 반짝임 자리 셋씩(QA-L6 S10 — 같은 자리 반복 격자)
            _anim4(sh, f"swater_atin{t}_{v}", [ws.swamp_water(P, 255, f, swg0, _bank("swater"), 1 + (t * 3 + v) % 5) for f in range(4)])
    sh.end_section()

    # ---- 꽃 정원·열매밭 -------------------------------------------------------------------------
    sh.section("꽃 정원(꽃밭 오토타일 두 벌·부드러운 흙·열매 덤불 성장 단계·잎 덩이 생울타리·디딤돌)")
    for v in range(4):
        sh.add(f"fcarpet{v}", wg.carpet(P, v))
    soil1 = wg.soil(P, "1", grass0)
    sh.add("soil_1", soil1)
    for v in range(3):
        sh.add(f"gstone{v}", wg.stepping(P, v, grass0))

    def on_soil(im):                                                    # 열매 덤불은 흙 받침째 한 칸(찍어도 흙이 지워지지 않는다)
        base = soil1.copy()
        base.alpha_composite(im)
        return base
    for kind in ("red", "blue", "yellow"):
        sh.add(f"berry_{kind}.0.0", on_soil(wg.berry_bush(P, kind)))
    sh.add("berry_sprout.0.0", on_soil(wg.berry_bush(P, "red", "sprout")))
    sh.add("berry_bloom.0.0", on_soil(wg.berry_bush(P, "red", "bloom")))
    sh.row_start()
    for m in range(16):
        sh.add(f"hedge_at{m}", wg.hedge(P, m))
    for grp, cols in (("fbeda_at", ("pink", "white")), ("fbedb_at", ("yellow", "red"))):
        sh.row_start()
        for k in px.ALL47:
            sh.add(f"{grp}{k}", wg.flower_bed(P, k, grass0, cols, 0))
        for t in (0, 1):
            for v in range(3):
                sh.add(f"{grp}in{t}_{v}", wg.flower_bed(P, 255, grass0, cols, 1 + t * 3 + v))
    sh.end_section()

    # ---- 강·다리·폭포 ---------------------------------------------------------------------------
    sh.section("강과 다리(바위 둑 강물·물살·폭포·통나무 다리와 끝 말뚝·강 바위·풀밭 꽃)")
    for o, parts in (("h", ("n", "s", "1")), ("v", ("w", "e", "1"))):
        for p_ in parts:
            sh.add(f"logbr_{o}_{p_}", wr.log_bridge(P, o, p_))
        for p_ in parts[:2]:
            sh.add(f"logbr_{o}_{p_}p", wr.log_bridge(P, o, p_, post=True))
    for o, parts, sides in (("h", ("n", "s"), ("w", "e")), ("v", ("w", "e"), ("n", "s"))):
        for sd in sides:
            for p_ in parts:
                sh.add(f"logbr_{o}_{p_}_{sd}", wr.bridge_end(P, o, p_, sd, grass0))
    for v in range(2):                                                    # 물 바위 = 벼랑과 같은 적갈 바위 램프·최암 윤곽(거품 테 그대로, QA-L8 N9)
        sh.add(f"rrock{v}", wr.river_rock(dict(P, rock=P["cliff"]), v))
    PRg = dict(P, cave_floor=P["cliff"][1:5])
    for v in range(2):                                                    # 풀밭 잔돌 = 산 잔돌과 같은 그림(본 시트 cave.small_pebbles), 바탕만 풀
        with _cave_floor_as(mo.grass_tex(P, v)):
            sh.add(f"gpeb{v}", cave.small_pebbles(PRg, v))
    # 풀밭 들꽃은 본 시트 flower_pink/white/yellow/red 를 그대로 쓴다(야생 gflower 는 없앴다, QA-L6 N3)
    sh.row_start()
    for d in "dulr":
        _anim4(sh, f"cur_{d}", [wr.current(P, d, f) for f in range(4)])
    for v in (1, 2):
        _anim4(sh, f"cur_d{v}", [wr.current(P, "d", f, v) for f in range(4)])
    for part in "tb":
        _anim4(sh, f"wfall_{part}", [wr.waterfall(P, part, f) for f in range(4)])
    for i in range(3):
        _anim4(sh, f"wfoot{i}", [wr.fall_foot(P, i, f) for f in range(4)])
    sh.row_start()
    for k in px.ALL47:
        _anim4(sh, f"rwater_at{k}", [wr.river_water(P, k, f) for f in range(4)])
    sh.end_section()

    # ---- 키 큰 풀 덩이 둥근 귀(정본 wild_tall, I3 Z5 · I4 W2·W6) ------------------------------------------------------------
    sh.section("키 큰 풀 덩이 둥근 귀(바깥 귀를 깎은 풀숲 칸 — 바닥 풀·산 돌흙·숲 바닥 · 귀 쪽 끝을 자른 잎끝 · 옆 잎끝 두 벌)")
    wfl0p = wc.tex_px(wfl0)
    for base, key, grounds in (("tall", "tall", (("g", grass0), ("m", mflp))), ("wtall", "wtall", (("w", wfl0p),))):
        wt.add_round_tall(sh, base, P[key], grounds)                      # 정본 둥근 귀 풀숲 한 벌(I4 W2)
    sh.end_section()
    return sh


def autotile_masks(kind: str) -> dict:
    if kind == "wsun":
        return {m: wf.sun_mask(m) for m in px.ALL47}
    if kind == "cliff_top":
        return {m: wm.top_mask(m) for m in px.ALL47}
    if kind == "cface":
        return {m: wm.face_mask(m) for m in px.ALL47}
    if kind == "mgrass":
        return {m: wm.grass_mask(m) for m in px.ALL47}
    if kind == "fbed":
        return {m: wg.fbed_mask(m) for m in px.ALL47}
    if kind == "wdirt":
        return mo.autotile_masks("sand")
    if kind == "mud":
        return {m: ws.mud_mask(m) for m in px.ALL47}
    if kind in ("rwater_outer", "rwater_inner"):
        return mo.autotile_masks(kind.replace("rwater", "water"))
    for pre in ("swater",):
        if kind == f"{pre}_outer":
            return _bank(pre)[0]
        if kind == f"{pre}_inner":
            return _bank(pre)[1]
    return mo.autotile_masks(kind)


def role_ids(sh):
    return mo.role_ids(sh)


landmark_roles = mo.landmark_roles
negatives = mo.negatives
FAMILIES = [("밝은 공터", "clear_at", "clearing", ""), ("모래길", "sand_at", "sand", ""),
            ("숲 빛 공터", "wsun_at", "wsun", ""), ("숲 흙길", "wdirt_at", "wdirt", ""),
            ("절벽 윗면 A", "cliffa_at", "cliff_top", ""), ("절벽 윗면 B", "cliffb_at", "cliff_top", ""), ("절벽 윗면 풀", "cliffg_at", "cliff_top", ""),
            ("절벽 앞면", "cface_at", "cface", ""), ("풀 절벽 앞면", "gface_at", "cface", ""), ("흙 위 풀 바닥", "mgrass_at", "mgrass", ""), ("진흙", "mud_at", "mud", ""), ("꽃밭 A", "fbeda_at", "fbed", ""), ("꽃밭 B", "fbedb_at", "fbed", ""),
            ("늪 물", "swater_at", "swater_inner", "_f0"), ("강물", "rwater_at", "rwater_inner", "_f0")]
EXTRA_MASKS = {"늪 둑 바깥": "swater_outer", "강 둑 바깥": "rwater_outer"}
OPAQUE = ["grass0", "tall0", "sand0", "wfl0", "wtall0", "wsun_at255", "mfl0", "mpeb0", "cliffa_at255", "cliffg_at0", "cface_at255", "gface_at255", "mgrass_at255", "cface_atin0_0",
          "swg0", "reed0", "mud_at255", "swater_at255_f0", "fcarpet0", "soil_1", "gstone0", "fbeda_at255", "logbr_h_n", "logbr_v_w",
          "cur_d_f0", "wfall_t_f0", "rwater_at255_f0", "ccave.0.1", "cstairs.0.1"]
