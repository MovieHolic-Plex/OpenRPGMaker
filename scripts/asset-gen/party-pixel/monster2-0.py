"""monster2-0 하피 — 15칸 전투 시트(셀 64, 왼쪽 보기). 파티 motion: swoop.

걷기 칩 Monster2 0번의 왼쪽 보기 가운데 칸을 2배 밑그림으로 쓴다(pp15_pp4). 칩의 발밑 그림자는 지우고 떠 있다.
움직이는 부위: 등 뒤 회색 날개(어깨 축), 새 다리(엉덩이 축, 발톱 할퀴기).
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp15_pp4 import Rig, run  # noqa: E402

PARTS = {
    'wing': ([(15, 12), (24, 12), (24, 23), (16, 23), (14, 20), (13, 14)], (14, 16), 'back', (22, 20), None),
    'legs': ([(5, 22), (15, 22), (15, 28), (5, 28)], (10, 22), 'front', (8, 27), None),
}
ROLES = {'wing': [('wing', -1)], 'legs': [('legs', 0.7)], 'arm': [('legs', 0.35)]}
TUNE = {'attack': {'angles': {'legs': 55}}, 'finisher': {'angles': {'legs': 65, 'wing': -45}}, 'dead': {}}

if __name__ == '__main__':
    rig = Rig(0, PARTS, chest=15, cut=lambda x, y: y >= 28, flying=True, fx=('f4fff0', 'a8e0a0', '5a9a60'))
    run('monster2-0', rig, ROLES, style='claw', weapon='legs', hover=4, tune=TUNE, cast_part=None)
