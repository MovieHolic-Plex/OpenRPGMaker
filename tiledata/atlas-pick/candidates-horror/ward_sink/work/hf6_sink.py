#!/usr/bin/env python3
"""ward_sink hf6 A·B·C — 16x16 object. 북쪽 벽 앞 병실 세면대: 흰 대야(속이 한 단 어둡게) + 쇠 꼭지 + 받침 기둥, 거울 없음."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from hf6_lib import C, emit
SLUG, W = 'ward_sink', 'hf6'
MATS = {'s': 'sheet', 't': 'tin', 'r': 'rust', 'm': 'murk'}

ROWS = [
    "................",
    ".......TT.......",   # y1 꼭지 윗끝
    ".......tt.......",
    "....hhtttthh....",   # y3 꼭지 가로대 + 손잡이 둘
    "...oooooooooo...",   # y4 대야 뒤 테두리
    "..oRRRRRRRRRRo..",   # y5 뒤 테두리 면
    "..oRbbbbbbbbRo..",   # y6 대야 속(위쪽 그늘)
    "..oRmmmmmmmmDo..",   # y7 속 중간
    "..oRmmmddmmmDo..",   # y8 속 아래 + 배수구
    "..oRRRRRRRRRDo..",   # y9 앞 테두리
    "...oeeeeeeeeo...",   # y10 대야 밑면
    "....oeeeeeeo....",   # y11 좁아짐
    ".....oPeeQo.....",   # y12 받침 기둥
    ".....oPeeQo.....",
    "...oPPeeeeeQQo..",   # y14 발판
    "...oooooooooo...",   # y15
]

def build(map_):
    c = C(16, 16); c.paint(0, 0, ROWS, map_); return c

def build_A():
    return build({'T': ('t', 5), 't': ('t', 4), 'h': ('t', 5), 'o': ('s', 1), 'R': ('s', 5), 'b': ('s', 2), 'm': ('s', 3),
                  'D': ('s', 4), 'd': ('t', 1), 'e': ('s', 3), 'P': ('s', 4), 'Q': ('s', 2)})

def build_B():
    return build({'T': ('t', 6), 't': ('t', 5), 'h': ('t', 6), 'o': ('s', 0), 'R': ('s', 6), 'b': ('s', 1), 'm': ('s', 2),
                  'D': ('s', 4), 'd': ('t', 0), 'e': ('s', 3), 'P': ('s', 5), 'Q': ('s', 1)})

def build_C():
    c = build({'T': ('t', 5), 't': ('t', 3), 'h': ('t', 4), 'o': ('s', 1), 'R': ('s', 4), 'b': ('s', 2), 'm': ('s', 3),
               'D': ('s', 3), 'd': ('t', 1), 'e': ('s', 3), 'P': ('s', 4), 'Q': ('s', 2)})
    # 꼭지 끝에서 흐른 녹물 한 줄: 속 -> 앞 테두리 -> 밑면 -> 기둥
    for (y, x, mat, t) in [(4, 7, 'r', 3), (5, 7, 'r', 3), (6, 7, 'r', 3), (7, 7, 'r', 2), (9, 7, 'r', 3), (10, 7, 'r', 2),
                           (11, 7, 'r', 2), (12, 7, 'r', 2), (13, 7, 'r', 1), (14, 7, 'r', 1)]:
        c.put(y, x, mat, t)
    # 깨진 테두리 자리: 뒤 오른쪽 모서리에 속 도기(sheet 1)가 드러남
    for (y, x, mat, t) in [(5, 10, 's', 1), (5, 11, 's', 1), (6, 11, 's', 1)]:
        c.put(y, x, mat, t)
    # 머리카락 금
    for (y, x) in [(9, 4), (9, 5), (10, 5)]: c.put(y, x, 's', 2)
    # 발판 곰팡이
    for (y, x, t) in [(14, 4, 2), (14, 5, 3), (13, 6, 2)]: c.put(y, x, 'm', t)
    return c

NOTES = {
 'A': 'v5 결 기본: sheet5 흰 대야 테두리, 속 sheet2~3(한 단 이상 어둡게)에 쇠 배수구, 꼭지 tin4~5 + 손잡이 둘, 받침 기둥 sheet3(왼쪽 밝게)',
 'B': '어둠에서 읽히게: 테두리 sheet6 vs 속 sheet1~2 로 명도 차 최대, 테두리 sheet0 홑줄, 꼭지 tin6, 무늬 없음',
 'C': '재료 결: 꼭지에서 흘러내린 녹물 한 줄(속→앞 테두리→기둥), 깨진 뒤 모서리, 앞 테두리 금, 발판 곰팡이',
}
for L, b in (('A', build_A), ('B', build_B), ('C', build_C)):
    emit(SLUG, W, L, b(), MATS, NOTES[L])
print('ok')
