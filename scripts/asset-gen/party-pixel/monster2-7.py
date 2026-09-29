"""monster2-7 마족 공작 — 15칸 전투 시트(셀 64, 왼쪽 보기). 파티 motion: shoot.

걷기 칩 Monster2 7번(보라 피부·금 장식 마족 귀족)의 왼쪽 보기 가운데 칸을 2배 밑그림으로 쓴다(pp15_pp4).
움직이는 부위: 앞팔(어깨 축, 암흑 구체).
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp15_pp4 import Rig, run  # noqa: E402

PARTS = {
    'arm': ([(6, 15), (11, 15), (11, 23), (6, 23)], (9, 16), 'front', (7, 22), [(9, 15), (11, 15), (11, 23), (9, 23)]),
}
ROLES = {'arm': [('arm', 1)]}

if __name__ == '__main__':
    rig = Rig(7, PARTS, chest=16, fx=('f0e0ff', 'a060ff', '502890'))
    run('monster2-7', rig, ROLES, style='magic', weapon='arm')
