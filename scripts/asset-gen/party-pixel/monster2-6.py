"""monster2-6 오니 무사 — 15칸 전투 시트(셀 64, 왼쪽 보기). 파티 motion: dash.

걷기 칩 Monster2 6번(붉은 가면·뼈 칼 오니)의 왼쪽 보기 가운데 칸을 2배 밑그림으로 쓴다(pp15_pp4).
움직이는 부위: 앞으로 늘어뜨린 칼과 팔(손 축, 베기).
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp15_pp4 import Rig, run  # noqa: E402

PARTS = {
    'sword': ([(0, 15), (7, 15), (8, 22), (4, 29), (0, 29)], (6, 18), 'front', (1, 28), None),
}
ROLES = {'arm': [('sword', 0.9)]}

if __name__ == '__main__':
    rig = Rig(6, PARTS, chest=16, fx=('e8f8ff', '70c8ff', '3060c0'))
    run('monster2-6', rig, ROLES, style='slash', weapon='sword')
