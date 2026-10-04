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


def ko_name(name):
    m_ = re.match(r"^(.*)__s(\d+)$", name)
    if m_:
        return ko_name(m_.group(1)) + f" (변형 {m_.group(2)})"
    if name in FIX:
        return FIX[name]
    for pat, fmt in WORDS:
        m = re.match(pat, name)
        if m:
            return fmt.format(*[g for g in m.groups()]) if m.groups() else fmt
    return name.replace("_", " ")


ROLE = {"built": "building", "wall": "wall", "tree": "prop", "bush": "prop", "sapling": "prop", "tuft": "prop", "prop": "prop"}
CLS_KO = {"built": "건물", "wall": "담·성벽", "tree": "나무", "bush": "덤불", "sapling": "어린 나무", "tuft": "풀덤불", "prop": "소품"}
