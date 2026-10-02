"""국내성 원작 규모 맵(demo_gungnae_full.py)에서만 쓰는 새 조각. 기존 조각 함수를 인자만 키워 다시 조립한다(새 그림 코드 없음)."""
import gungnae_palace as GP


def objects():
    return {
        # 원작 정전(약 20×12칸)에 맞춰 폭 가변 인자(bays)만 키운 넓은 대전: 폭 bays+4 = 18칸, 가운데 칸이 축.
        'gnf_palace_hall_wide_14': GP.palace_hall_wide(14),
    }
