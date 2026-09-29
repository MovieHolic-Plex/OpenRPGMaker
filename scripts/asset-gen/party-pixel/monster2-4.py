"""monster2-4 흙 골렘 — 15칸 전투 시트(셀 64, 왼쪽 보기). 파티 motion: stomp.

걷기 칩 Monster2 4번(돔 머리 점토 거인)의 왼쪽 보기 가운데 칸을 2배 밑그림으로 쓴다(pp15_pp4).
움직이는 부위: 앞·뒤 팔(어깨 축, 내려찍기).
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp15_pp4 import Rig, run  # noqa: E402

PARTS = {
    'arm_back': ([(15, 11), (20, 11), (20, 22), (15, 22)], (16, 12), 'back', (17, 21), None),
    'arm': ([(6, 12), (11, 12), (11, 24), (6, 24)], (9, 13), 'front', (8, 23), [(9, 12), (11, 12), (11, 24), (9, 24)]),
}
ROLES = {'arm': [('arm', 1), ('arm_back', 0.6)]}

if __name__ == '__main__':
    rig = Rig(4, PARTS, chest=16, fx=('fff0d0', 'c89a60', '7a5a34'))
    run('monster2-4', rig, ROLES, style='punch', weapon='arm')
