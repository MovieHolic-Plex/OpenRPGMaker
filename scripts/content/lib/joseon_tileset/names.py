"""조선 조각 이름 → 한국어 표시 이름·설명 문장(조각 이름 규칙은 scripts/content/lib/joseon/catalog.py)."""
import re

WORDS = [
    (r"^giwa_house_(\d)", "기와집 {0}칸"), (r"^giwa_(\w+)", "기와 {0}"), (r"^thatch_house_(\d)", "초가집 {0}칸"),
    (r"^thatch_(\w+)", "초가 {0}"), (r"^gwanah_(\d)", "관아 {0}칸"), (r"^pavilion_(\w+)", "정자 {0}"),
    (r"^palace_hall_(\w+)", "궁궐 정전 {0}"), (r"^palace_jeongak_(\w+)", "궁궐 전각 {0}"), (r"^palace_haengnak_(\w+)", "궁궐 행각 {0}"),
    (r"^palace_gate_(\w+)", "궁문 {0}"), (r"^palace_wall_(\w+)", "궁 담 {0}"), (r"^palace_(\w+)", "궁궐 {0}"),
    (r"^gungnae_gate_(\w+)", "국내성 성문 {0}"), (r"^gungnae_tower_(\w+)", "국내성 망루 {0}"), (r"^gungnae_bridge_(\w+)", "국내성 돌다리 {0}"),
    (r"^gungnae_wall_(\w+)", "국내성 성벽 {0}"), (r"^tower_(\w+)", "탑형 누각 {0}"), (r"^gn_(\w+)", "국내성 {0}"),
    (r"^zelkova_(\w+)", "느티나무 {0}"), (r"^pine_(\w+)", "소나무 {0}"), (r"^persimmon_(\w+)", "감나무 {0}"), (r"^bamboo_grove", "대숲"),
    (r"^bamboo", "대나무"), (r"^willow", "버드나무"), (r"^bush_(\w+)", "덤불 {0}"), (r"^small_(\w+)", "어린 나무 {0}"),
    (r"^wall_(\w+)", "토석담 {0}"), (r"^fort_wall_(\w+)", "성벽 {0}"), (r"^fort_gate", "성문"), (r"^gate_(\w+)", "대문 {0}"),
]
FIX = {
    "bridge": "나무다리", "well": "우물", "jars": "항아리", "bench": "벤치", "mat_peppers": "고추 멍석", "gochu_mat": "고추 멍석",
    "jangseung_m": "남장승", "jangseung_f": "여장승", "sotdae": "솟대", "lantern": "석등", "fence_h": "울타리", "haystack": "낟가리",
    "stone_bank": "돌 축대", "reeds": "갈대", "rocks": "바위", "laundry": "빨래터", "flower_bed": "화단", "bank_stairs": "물가 계단",
    "stone_pagoda": "석탑", "hongsalmun": "홍살문", "deungrong_mun": "청사초롱 문", "market_stall": "시장 가게", "wondumak": "원두막",
    "nugak": "누각", "yeonja_mill": "연자방아", "seonangdang": "서낭당", "chimney": "굴뚝", "sarip": "사립문", "toldam": "돌담",
    "waterwheel": "물레방아", "dilbang": "디딜방아", "millstone": "맷돌", "pyeongsang": "평상", "jangdokdae": "장독대", "scarecrow": "허수아비",
    "firewood": "장작더미", "dolmadam": "돌기와담", "jukbyeok": "죽벽", "geumjul_altar": "금줄 제단", "stepping_stones": "징검돌",
    "boat": "나룻배", "dock": "선착장", "stele": "비석", "stove_pot": "가마솥 부뚜막",
}
SIDES = {"h": "가로", "v": "세로", "e": "동", "nw": "북서", "ne": "북동", "sw": "남서", "se": "남동"}


# ---------------------------------------------------------------- 새 판(사냥터 fld_ · 동굴 cav_ · 실내 키트 in_b_ · 궁 내부 pal_) 조각 이름
# 조각 이름은 로마자 한국어·영어 낱말이 섞여 있다. 칸 라벨·조립 부품 이름·참고문서 표제가 읽히도록 낱말 사전으로 옮긴다(사전에 없는 낱말은 그대로 둔다).
NEW_PREFIX = (("fld_", "사냥터"), ("cav_", "동굴"), ("in_b_", "실내"), ("pal_", "궁"))
NEW_FIX = {
    # 사냥터
    "fld_cave_a": "굴 입구 홍예", "fld_cave_b": "굴 입구 갱도", "fld_cave_c": "굴 입구 짐승굴", "fld_signpost": "이정표", "fld_campfire": "모닥불",
    "fld_tent_a": "천막(작은)", "fld_tent_b": "천막(큰)", "fld_rack": "건조대", "fld_log_a": "통나무 눕힘(3칸)", "fld_log_b": "통나무 눕힘(2칸)",
    "fld_stump_a": "그루터기 A", "fld_stump_b": "그루터기 B", "fld_bones_a": "뼈 A", "fld_bones_b": "뼈 B", "fld_ruin_pagoda": "폐허 석탑",
    "fld_tombstone": "묘비", "fld_grave_a": "봉분 A", "fld_grave_b": "봉분 B", "fld_cairn": "돌탑", "fld_burrow": "짐승굴 구멍",
    "fld_rock_s_a": "작은 바위 A", "fld_rock_s_b": "작은 바위 B", "fld_rock_s_c": "작은 바위 C", "fld_rock_m_a": "중간 바위 A", "fld_rock_m_b": "중간 바위 B",
    "fld_rock_l_a": "큰 바위 A", "fld_rock_l_b": "큰 바위 B", "fld_boulder_mass": "바위 덩이", "fld_ore_a": "광석 노두 A", "fld_ore_b": "광석 노두 B",
    "fld_dead_a": "고목 A", "fld_dead_b": "고목 B", "fld_flowers_a": "들꽃 A", "fld_flowers_b": "들꽃 B", "fld_flowers_c": "들꽃 C",
    "fld_bush_flower_b": "꽃덤불", "fld_fern": "고사리",
    # 동굴
    "cav_brazier": "화로 기둥", "cav_stalagmite": "석순", "cav_stalagmite_b": "석순 B", "cav_stalagmite_c": "작은 석순", "cav_stalagmite_wide": "넓은 석순 군락",
    "cav_crystal": "수정", "cav_crystal_b": "수정 무리", "cav_crystal_c": "큰 수정", "cav_chest_dais": "보물 상자 단상", "cav_cart": "광산 수레",
    "cav_nest": "뼈 둥지", "cav_torch_a": "벽 횃불 A", "cav_torch_b": "벽 횃불 B", "cav_mushroom_a": "동굴 버섯 A", "cav_mushroom_b": "동굴 버섯 B",
    "cav_rubble": "잔해", "cav_moss": "이끼", "cav_puddle": "물웅덩이", "cav_rock_a": "바위 A", "cav_rock_b": "바위 B", "cav_rock_c": "바위 C",
}
NEW_TOK = {
    # 건축·구조
    "wall": "벽", "hoe": "회벽", "mok": "목재벽", "heuk": "흙벽", "dol": "돌벽", "changho": "창호벽", "win": "창", "round": "둥근", "door": "문", "doorway": "문틀",
    "slide": "미닫이", "open": "열린", "plank": "널", "pillar": "기둥", "beam": "보", "red": "붉은", "stair": "계단", "up": "오름", "down": "내림", "ladder": "사다리",
    "loft": "다락", "dais": "단", "wood": "목재", "stone": "돌", "exit": "출구", "mat": "깔개", "step": "디딤돌", "nangan": "난간", "dan": "단청", "gung": "궁",
    "gungho": "궁 회벽", "top": "윗면", "face": "앞면", "stair": "계단", "run": "줄무늬", "runb": "줄무늬 B", "carpet": "카펫", "royal": "왕실", "wide": "넓은",
    # 가구·기물
    "byeongpung": "병풍", "ibuljang": "이불장", "ibul": "이부자리", "folded": "갠", "chimgu": "침구", "nong": "농", "bandaji": "반닫이", "munggap": "문갑",
    "soban": "소반", "sang": "상", "low": "낮은", "gyojasang": "교자상", "hwaro": "화로", "deungjan": "등잔", "stand": "걸이", "chotdae": "촛대", "big": "큰",
    "banseok": "방석", "bangseok": "방석", "jip": "짚", "dot": "돗자리", "jokja": "족자", "hang": "벽걸이", "sirae": "시래기", "gochu": "고추", "yakcho": "약초",
    "meju": "메주", "bagaji": "바가지", "tools": "연장", "pyeongsang": "평상", "geolsang": "걸상", "stool": "걸상", "bumak": "부뚜막", "hangari": "항아리",
    "straw": "짚", "dok": "독", "ssal": "쌀", "dwiju": "뒤주", "muldongi": "물동이", "sokuri": "소쿠리", "veg": "채소", "grain": "곡식", "fruit": "과일",
    "jangjak": "장작", "seonban": "선반", "betul": "베틀", "mulle": "물레", "sewing": "바느질", "pungmu": "풀무", "moru": "모루", "sutdeomi": "숯더미",
    "hwadeok": "화덕", "dameum": "담금질 통", "sutdol": "숫돌", "cheol": "쇠", "gongjang": "작업대", "yakjang": "약장", "yakdang": "약탕", "yakyeon": "약연",
    "jakdu": "작두", "yak": "약", "table": "상", "basket": "바구니", "suldok": "술독", "sulsang": "술상", "juga": "주가", "seoan": "서안", "seoga": "서가",
    "boryo": "보료", "ansuk": "안석", "hoechori": "회초리", "chaekdemi": "책더미", "gwan": "관아", "desk": "책상", "gyoui": "교의", "gonjang": "곤장",
    "teul": "틀", "geori": "걸이", "buk": "북", "mungseo": "문서", "ham": "함", "hopi": "호피", "throne": "의자", "v4": "(길)", "mangchi": "망치",
    "yakseonban": "약선반", "weapon": "무기", "tool": "농기구", "rack": "걸이", "ilwol": "일월오봉", "yongsang": "용상", "hyangro": "향로", "jong": "종",
    "deungnong": "등롱", "deumeu": "드므", "yong": "용 문양", "jang": "장", "sinha": "신하 방석 깔개", "oa": "O-A", "ob": "O-B", "oc": "O-C", "pagoda": "석탑",
    "desk2": "책상", "pine": "소나무", "zelkova": "느티나무", "bush": "덤불", "gwan_desk": "관아 책상", "g": "G", "s": "S",
}
_SIDE = {"l": "왼끝", "r": "오른끝", "m": "가운데", "lr": "양끝"}
_SIZE = {"s": "작은", "m": "중간", "l": "큰"}
_SIDE_CTX = ("wall", "beam", "dais", "door", "nangan", "carpet", "run", "runb")


def _ko_new(name):
    for pre, label in NEW_PREFIX:
        if name.startswith(pre):
            break
    else:
        return None
    if name in NEW_FIX:
        return NEW_FIX[name]
    body = name[len(pre):]
    m = re.match(r"^dais_(top|face)_(l|m|r)(?:_(m|b))?$", body)
    if m:
        part = {"top": "윗면", "face": "앞면"}[m.group(1)]
        row = {"m": "가운데줄", "b": "뒷줄"}.get(m.group(3), "")
        return f"어좌 단 {part} {_SIDE[m.group(2)]} {row}".strip()
    toks = body.split("_")
    ctx_side = any(t in _SIDE_CTX for t in toks)
    out = []
    for i, t in enumerate(toks):
        if t == "gung" and label == "궁":      # 궁 접두와 겹치는 「궁」은 뺀다(pal_wall_gung_m → 궁 벽 가운데, 궁 창호벽 계열)
            continue
        if t == "gung2":
            out.append("2")
        elif t in _SIDE and (ctx_side or i == len(toks) - 1) and i > 0 and ctx_side:
            out.append(_SIDE[t])
        elif t in _SIZE and not ctx_side and i > 0 and toks[0] in ("rock", "stalagmite", "hangari"):
            out.append(_SIZE[t])
        elif re.fullmatch(r"\d+", t):
            out.append(f"{t}칸")
        elif re.fullmatch(r"\d+x\d+[a-z]?", t):
            out.append(t[:3].replace("x", "×") + (t[3:].upper() if len(t) > 3 else ""))
        elif re.fullmatch(r"[a-gr]\d?", t) and i > 0:
            out.append(t.upper())
        elif re.fullmatch(r"[a-z]\d+[a-z]?", t) and t[0] in "br" and i > 0:
            out.append(t.upper())
        elif re.fullmatch(r"\d[a-e]", t):
            out.append(t[0] + "칸 " + t[1].upper())
        elif t in NEW_TOK:
            out.append(NEW_TOK[t])
        else:
            out.append(t)
    return f"{label} " + " ".join(out)


def ko_name(name):
    m_ = re.match(r"^(.*)__s(\d+)$", name)
    if m_:
        return ko_name(m_.group(1)) + f" (변형 {m_.group(2)})"
    nn = _ko_new(name)
    if nn is not None:
        return nn
    if name in FIX:
        return FIX[name]
    for pat, fmt in WORDS:
        m = re.match(pat, name)
        if m:
            return fmt.format(*[g for g in m.groups()]) if m.groups() else fmt
    return name.replace("_", " ")


ROLE = {"built": "building", "wall": "wall", "tree": "prop", "bush": "prop", "sapling": "prop", "tuft": "prop", "prop": "prop"}
CLS_KO = {"built": "건물", "wall": "담·성벽", "tree": "나무", "bush": "덤불", "sapling": "어린 나무", "tuft": "풀덤불", "prop": "소품"}
