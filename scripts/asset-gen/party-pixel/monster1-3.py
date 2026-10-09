"""monster1-3 유령(파티원) — 15칸 시트(3열×5행). 셀 64(칩 21×20 → 42×40). 검은 눈·붉은 입·흰 천 주름을 칩 그대로. 평소 4px 떠 있고 dead 만 바닥. 도깨비불·통곡 음파·작은 유령 행렬(필살기).
빌더는 pp15_pp2.py(걷기 칩 왼쪽 보기 가운데 칸 → Scale2x 2배 → 부위 이동·새 외곽선·왼쪽 위 명암). 실행하면 시트를 쓰고 검사한다."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import pp15_pp2  # noqa: E402

if __name__ == '__main__':
    sys.exit(0 if pp15_pp2.build('monster1-3') else 1)
