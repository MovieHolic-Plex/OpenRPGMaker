"""monster2-2 흡혈귀 — 15칸 전투 시트(셀 64, 왼쪽 보기). 파티 motion: float.

걷기 칩 Monster2 2번(은발·보라 바지 흡혈귀)의 왼쪽 보기 가운데 칸을 2배 밑그림으로 쓴다(pp15_pp4).
움직이는 부위: 앞팔(어깨 축, 마법 방출·손톱).
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp15_pp4 import Rig, run  # noqa: E402

PARTS = {
    'arm': ([(5, 18), (10, 18), (10, 25), (5, 25)], (8, 19), 'front', (7, 24), [(8, 18), (10, 18), (10, 25), (8, 25)]),
}
ROLES = {'arm': [('arm', 1)]}

if __name__ == '__main__':
    rig = Rig(2, PARTS, chest=18, fx=('ffe0f0', 'e0406a', '801838'))
    run('monster2-2', rig, ROLES, style='magic', weapon='arm')
