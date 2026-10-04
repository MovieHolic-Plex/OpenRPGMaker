"""monster1-1 붉은 악마(파티원) — 15칸 시트(3열×5행). 셀 64(칩 17×26 → 34×52). 휜 뿔 한 가닥·초록 눈·불룩한 배를 칩 그대로.
삼지창은 찌르기 칸(windup·move·attack·recover·leap)에만, 시전은 손 위 불덩이, 필살기는 큰 불덩이 + 발밑 불길.
빌더는 pp15_pp2.py(걷기 칩 왼쪽 보기 가운데 칸 → Scale2x 2배 → 부위 이동·새 외곽선·왼쪽 위 명암). 실행하면 시트를 쓰고 검사한다."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import pp15_pp2  # noqa: E402

if __name__ == '__main__':
    sys.exit(0 if pp15_pp2.build('monster1-1') else 1)
