"""monster1-0 슬라임(파티원) — 15칸 시트(3열×5행). 셀 48. 칩 13×9 방울을 그대로 2배(26×18). 출렁·납작 웅크림·튀어오름·앞으로 늘어난 박치기·녹아 퍼짐, 시전은 몸을 세우고 방울 셋 방출, 필살기는 금관.
빌더는 pp15_pp2.py(걷기 칩 왼쪽 보기 가운데 칸 → Scale2x 2배 → 부위 이동·새 외곽선·왼쪽 위 명암). 실행하면 시트를 쓰고 검사한다."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import pp15_pp2  # noqa: E402

if __name__ == '__main__':
    sys.exit(0 if pp15_pp2.build('monster1-0') else 1)
