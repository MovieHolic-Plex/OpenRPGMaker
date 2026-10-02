"""국내성 원작 규모 맵(demo_gungnae_full.py)에서만 쓰는 새 조각. 기존 조각 함수를 인자만 키워 다시 조립한다(새 그림 코드 없음)."""
import gungnae_palace as GP
import trees as TR


def objects():
    return {
        # 원작 정전(약 20×12칸)에 맞춰 폭 가변 인자(bays)만 키운 넓은 대전: 폭 bays+4 = 18칸, 가운데 칸이 축.
        'gnf_palace_hall_wide_14': GP.palace_hall_wide(14),
        # 전사의 길 대나무숲: 같은 그림이 6칸 안에 겹치지 않도록(지도 게이트 M4) 씨앗만 바꾼 변형. 기존 bamboo·bamboo_grove 는 그대로.
        'bamboo_b': TR.bamboo(1), 'bamboo_c': TR.bamboo(2), 'bamboo_d': TR.bamboo(3),
        'bamboo_grove_b': TR.bamboo_grove(1), 'bamboo_grove_c': TR.bamboo_grove(2), 'bamboo_grove_d': TR.bamboo_grove(3),
    }
