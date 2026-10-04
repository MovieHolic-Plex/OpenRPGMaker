#!/usr/bin/env python3
"""bedside_cabinet hf6 A·B·C — 16x16 object. 위에서 살짝 본 쇠 협탁: 윗판(3행) + 앞 서랍 + 아래 문 + 바퀴 둘.
화소 하나하나 손으로. 이 파일은 좌표 목록만 가진다."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from hf6_lib import C, emit
SLUG, W = 'bedside_cabinet', 'hf6'
MATS = {'s': 'sheet', 't': 'tin', 'r': 'rust', 'a': 'ward', 'd': 'dust'}

def shell(c, top, lip, body, shade, gap, ol, wheel, wheel_hi):
    """공통 몸통. x2..13, 윗판 y3-5, 앞 턱 y6, 서랍 y7-9, 틈 y10, 문 y11-12, 밑 테 y13, 바퀴 y14-15."""
    c.row(2, 2, 13, 's', ol)
    for y in (3, 4, 5):
        c.row(y, 2, 13, 's', top); c.put(y, 2, 's', ol); c.put(y, 13, 's', ol); c.put(y, 12, 's', shade + 1 if shade + 1 < top else top - 1)
    c.row(6, 2, 13, 's', lip); c.put(6, 2, 's', ol); c.put(6, 13, 's', ol)
    for y in (7, 8, 9, 11, 12):
        c.row(y, 2, 13, 's', body); c.put(y, 2, 's', ol); c.put(y, 13, 's', ol); c.put(y, 12, 's', shade)
    c.row(10, 2, 13, 's', gap); c.put(10, 2, 's', ol); c.put(10, 13, 's', ol)
    c.row(13, 2, 13, 's', ol)
    # 바퀴 둘(2x2): 밝은 왼쪽 위 한 점
    for x0 in (3, 11):
        c.rect(14, 15, x0, x0 + 1, 't', wheel)
        c.put(14, x0, 't', wheel_hi)

def build_A():
    c = C(16, 16)
    shell(c, top=4, lip=5, body=3, shade=2, gap=2, ol=1, wheel=2, wheel_hi=3)
    # 서랍 손잡이(쇠 2px 가로 + 밑 그림자 한 점 없음)
    c.row(8, 7, 8, 't', 4)
    # 문 손잡이 세로 한 점
    c.put(11, 10, 't', 4)
    # 벗겨진 칠: 아랫 모서리에 쇠 두 점
    c.put(12, 4, 't', 3); c.put(12, 5, 't', 3)
    return c

def build_B():
    c = C(16, 16)
    shell(c, top=5, lip=6, body=3, shade=1, gap=1, ol=0, wheel=1, wheel_hi=3)
    # 왼쪽 세로 한 줄을 한 단 밝게 = 어둠에서 몸통 모서리가 남는다
    for y in (7, 8, 9, 11, 12): c.put(y, 3, 's', 4)
    # 큰 면: 서랍 손잡이는 굵게 4px 밝은 쇠 한 줄
    c.row(8, 6, 9, 't', 5)
    c.row(11, 9, 10, 't', 5)
    return c

def build_C():
    c = C(16, 16)
    shell(c, top=3, lip=4, body=3, shade=2, gap=1, ol=1, wheel=1, wheel_hi=2)
    # 재료 결: 서랍이 한 뼘 열림 — 틈이 벌어져 속 어둠(tin 0)이 두 행
    c.row(10, 3, 12, 't', 0); c.row(10, 2, 2, 's', 1)
    # 벗겨진 흰 칠: 드러난 쇠(tin 3)와 녹(rust 2~3)
    for (y, x, m, t) in [(3, 4, 't', 3), (3, 5, 't', 3), (4, 4, 't', 2), (5, 10, 't', 3), (7, 3, 't', 3), (7, 4, 't', 3), (8, 3, 'r', 2),
                         (9, 3, 'r', 3), (11, 11, 't', 3), (12, 11, 'r', 2), (12, 12, 'r', 3), (12, 5, 't', 3), (12, 6, 'r', 2),
                         (7, 11, 'r', 2), (8, 11, 'r', 3)]:
        c.put(y, x, m, t)
    # 서랍 손잡이 녹슨 고리
    c.row(8, 7, 8, 't', 3); c.put(8, 9, 'r', 3)
    # 앞 턱 아래 녹물 줄
    c.col(6, 11, 12, 'r', 2)
    return c

NOTES = {
 'A': 'v5 결 기본: sheet3 흰 칠 몸통·윗판 4·앞 턱 5, 서랍 하나+아래 문, 쇠 손잡이(tin4), 바퀴 둘, 벗겨진 칠 두 점',
 'B': '어둠에서 읽히게: 윗판 sheet5·턱 6·몸통 3 큰 면, 틈·테두리 홑줄을 한두 단 더 어둡게, 왼 모서리 한 줄 밝게, 굵은 밝은 손잡이',
 'C': '재료 결: 서랍이 조금 열려 속 어둠 한 줄, 벗겨진 흰 칠 아래 드러난 쇠와 녹 점, 앞 턱 밑 녹물 줄',
}
for L, b in (('A', build_A), ('B', build_B), ('C', build_C)):
    emit(SLUG, W, L, b(), MATS, NOTES[L])
print('ok')
