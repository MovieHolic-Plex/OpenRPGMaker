#!/usr/bin/env python3
"""hosp_chair hf6 A·B·C — 16x16 object, 남향 병원 의자. 쇠 다리 2px(tin) + 바랜 회녹 판(ward). 화소 하나하나 손으로."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from hf6_lib import C, emit
SLUG, W = 'hosp_chair', 'hf6'
MATS = {'a': 'ward', 't': 'tin', 'r': 'rust', 's': 'sheet'}

def build_A():
    c = C(16, 16)
    m = {'p': ('t', 4), 'q': ('t', 3), 'Q': ('t', 4), 'a': ('a', 4), 'A': ('a', 5), 'b': ('a', 2), 'o': ('a', 1),
         'S': ('a', 4), 'H': ('a', 5), 'D': ('a', 3), 'e': ('a', 2), 'L': ('t', 4), 'l': ('t', 3), 'F': ('t', 2)}
    rows = [
        "................",
        "...pppppppppp...",   # y1 등받이 윗테(쇠)
        "...QqAAAAAAQq...",   # y2 기둥 2px + 판 윗줄 밝게
        "...QqaaaaaaQq...",
        "...QqaaaaaaQq...",
        "...QqaaaaaDQq...",
        "...QqbbbbbbQq...",   # y6 판 밑 그늘
        "..oHSSSSSSSSDo..",   # y7 앉는 판 윗면(밝은 모서리)
        "..oSSSSSSSSSDo..",
        "..oSSSSSSSSSDo..",
        "..oSSSSSSSSDDo..",   # y10
        "...eeeeeeeeee...",   # y11 앞 두께
        "...Ll......Ll...",   # y12 앞 다리 2px
        "...Ll......Ll...",
        "...Ll......Ll...",
        "...lF......lF...",   # y15 발끝 한 단 어둡게
    ]
    c.paint(0, 0, rows, m)
    return c

def build_B():
    c = C(16, 16)
    m = {'p': ('t', 5), 'q': ('t', 3), 'Q': ('t', 5), 'a': ('a', 5), 'A': ('a', 6), 'b': ('a', 1), 'o': ('a', 0),
         'S': ('a', 5), 'H': ('a', 6), 'D': ('a', 3), 'e': ('a', 1), 'L': ('t', 5), 'l': ('t', 3), 'F': ('t', 1)}
    rows = [
        "................",
        "...pppppppppp...",
        "...QqAAAAAAQq...",
        "...QqaaaaaaQq...",
        "...QqaaaaaaQq...",
        "...QqaaaaaaQq...",
        "...QqbbbbbbQq...",
        "..oHSSSSSSSSDo..",
        "..oSSSSSSSSSDo..",
        "..oSSSSSSSSSDo..",
        "..oSSSSSSSSDDo..",
        "...eeeeeeeeee...",
        "...Ll......Ll...",
        "...Ll......Ll...",
        "...Ll......Ll...",
        "...lF......lF...",
    ]
    c.paint(0, 0, rows, m)
    return c

def build_C():
    c = C(16, 16)
    # 등받이는 가로 판 셋 사이에 빈틈(뒤가 비침), 앉는 판은 터져 속(sheet)이 보임, 다리에 녹
    m = {'p': ('t', 3), 'q': ('t', 3), 'Q': ('t', 4), 'a': ('a', 4), 'A': ('a', 5), 'b': ('a', 2), 'o': ('a', 1),
         'S': ('a', 3), 'H': ('a', 4), 'D': ('a', 2), 'e': ('a', 1), 'L': ('t', 4), 'l': ('t', 3), 'F': ('t', 1), 'g': ('t', 1)}
    rows = [
        "................",
        "...pppppppppp...",
        "...QqAAAAAAQq...",
        "...QqggggggQq...",
        "...QqaaaaaaQq...",
        "...QqggggggQq...",
        "...QqbbbbbbQq...",
        "..oHSSSSSSSSDo..",
        "..oSSSSSSSSSDo..",
        "..oSSSSSSSSSDo..",
        "..oSSSSSSSSDDo..",
        "...eeeeeeeeee...",
        "...Ll......Ll...",
        "...Ll......Ll...",
        "...Ll......Ll...",
        "...lF......lF...",
    ]
    c.paint(0, 0, rows, m)
    # 터진 앉는 판: 속(sheet 3)과 그 밑 그림자
    for (y, x, mat, t) in [(8, 5, 's', 3), (8, 6, 's', 3), (9, 5, 's', 2), (9, 6, 's', 2), (9, 7, 's', 2), (8, 7, 'a', 1)]:
        c.put(y, x, mat, t)
    # 녹: 왼 앞다리 아래, 오른 다리 중간
    for (y, x, mat, t) in [(13, 3, 'r', 3), (14, 3, 'r', 2), (15, 3, 'r', 2), (13, 12, 'r', 2), (14, 11, 'r', 3)]:
        c.put(y, x, mat, t)
    return c

NOTES = {
 'A': 'v5 결 기본: 쇠 윗테+기둥(tin3~4) 사이 회녹 판(ward4), 앉는 판 ward4 밝은 왼쪽 위·어두운 오른쪽·앞 두께, 앞다리 2px',
 'B': '어둠에서 읽히게: 판 ward5~6 한 단 위, 테두리 ward0·앞 두께 ward1, 쇠 기둥·다리 tin5로 밝게 — 명도 차 최대, 무늬 없음',
 'C': '재료 결: 등받이 판 사이에 뒤가 비치는 빈틈 두 줄, 앉는 판 터져 속이 보임, 앞다리에 녹 흘림',
}
for L, b in (('A', build_A), ('B', build_B), ('C', build_C)):
    emit(SLUG, W, L, b(), MATS, NOTES[L])
print('ok')
