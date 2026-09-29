"""monster2-1 가고일 — 15칸 전투 시트(셀 64, 왼쪽 보기). 파티 motion: swoop.

걷기 칩 Monster2 1번(웅크린 푸른 가고일)의 왼쪽 보기 가운데 칸을 2배 밑그림으로 쓴다(pp15_pp4).
움직이는 부위: 머리(물기), 박쥐 날개(사본을 어깨 축으로 펼침), 꼬리.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp15_pp4 import Rig, run  # noqa: E402

PARTS = {
    'wing': ([(7, 5), (21, 5), (22, 15), (15, 16), (9, 12)], (13, 14), 'back', (18, 6), None, True),
    'tail': ([(17, 21), (24, 17), (24, 26), (16, 26), (16, 22)], (17, 23), 'back', (23, 22), None),
    'head': ([(0, 8), (8, 8), (9, 19), (0, 19)], (8, 15), 'front', (1, 15), None),
}
TUNE = {
    'dead': {'rot': 0, 'tilt': 70, 'squash': 3},
}
ROLES = {'wing': [('wing', -1)], 'tail': [('tail', -1)], 'arm': [('head', 0.22)], 'legs': []}

if __name__ == '__main__':
    rig = Rig(1, PARTS, chest=16, fx=('eef4ff', '9aa8ff', '5a64b0'))
    run('monster2-1', rig, ROLES, style='claw', weapon='head', tune=TUNE, cast_part=None)
