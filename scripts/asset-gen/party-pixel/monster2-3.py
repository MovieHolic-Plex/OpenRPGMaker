"""monster2-3 마기사 — 15칸 전투 시트(셀 64, 왼쪽 보기). 파티 motion: dash.

걷기 칩 Monster2 3번(붉은·검은 갑옷 마기사)의 왼쪽 보기 가운데 칸을 2배 밑그림으로 쓴다(pp15_pp4).
움직이는 부위: 앞팔(어깨 축, 마검 베기 — 칼날은 효과 호로 그린다).
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp15_pp4 import Rig, run  # noqa: E402

PARTS = {
    'arm': ([(5, 14), (10, 14), (10, 23), (5, 23)], (8, 15), 'front', (7, 22), [(8, 14), (10, 14), (10, 23), (8, 23)]),
}
ROLES = {'arm': [('arm', 1)]}

if __name__ == '__main__':
    rig = Rig(3, PARTS, chest=15, fx=('ffe8e0', 'e04040', '801820'))
    run('monster2-3', rig, ROLES, style='slash', weapon='arm')
