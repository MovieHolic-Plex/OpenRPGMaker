"""monster1-2 꼬마 오거(파티원) — 15칸 시트(3열×5행). 셀 64(칩 16×22 → 32×44). 민머리 큰 귀·붉은 눈·금빛 체크 보호대를 칩 그대로(칩 49색 → 15색).
몽둥이는 휘두르기·도약·필살기 칸에만, 시전은 바위 들어 던지기, 강화는 함성.
빌더는 pp15_pp2.py. 실행하면 시트를 쓰고 검사한다."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import pp15_pp2  # noqa: E402

if __name__ == '__main__':
    sys.exit(0 if pp15_pp2.build('monster1-2') else 1)
