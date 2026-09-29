"""monster2-5 용인 — 15칸 전투 시트(셀 64, 왼쪽 보기). 파티 motion: breath.

걷기 칩 Monster2 5번(초록 용인)의 왼쪽 보기 가운데 칸을 2배 밑그림으로 쓴다(pp15_pp4).
움직이는 부위: 머리(목 축, 브레스), 등 날개(사본을 어깨 축으로 펼침), 앞팔.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp15_pp4 import Rig, run  # noqa: E402

PARTS = {
    'wing': ([(14, 6), (24, 6), (24, 25), (18, 25), (15, 15)], (15, 12), 'back', (22, 8), None, True),
    'head': ([(0, 2), (13, 2), (13, 15), (0, 15)], (11, 13), 'front', (1, 12), None),
    'arm': ([(4, 17), (10, 17), (10, 23), (4, 23)], (9, 18), 'front', (5, 22), None),
}
ROLES = {'wing': [('wing', -0.8)], 'arm': [('arm', 0.8), ('head', 0.15)]}

if __name__ == '__main__':
    rig = Rig(5, PARTS, chest=17, fx=('fff4c0', 'f0a030', 'b04818'))
    run('monster2-5', rig, ROLES, style='breath', weapon='head')
