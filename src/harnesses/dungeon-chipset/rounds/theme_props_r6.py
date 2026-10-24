"""theme-props-r6 — 금 간 바닥(2026-10-24). 패널 6·7 「매끈한 타원 구멍 · 유리 깨진 듯한 방사 금 · 북쪽 판석 두께 약함」 반영:
  구멍 = 판석 줄눈을 따라 각지게 꺼진 자리(타원 아님) · 북쪽 안벽 = 판석 옆면 세 단(빛 c · 중간 b · 그늘 r) 뒤 어둠 ·
  꺼진 판 한 조각이 기울어 구멍 안에 걸림(윗면 빛 t · 앞면 u) · 금은 줄눈에서 시작해 판을 비스듬히 끊고, 짧게 끝난다 ·
  떨어진 돌 조각. 판석 칠·줄눈은 r2(판석마다 칠 · 바깥 줄눈 = 성 바닥 키트 회색, 손상 둘레만 재질 색조).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import theme_earth_r1 as E1  # noqa: E402
import theme_props_r1 as P1  # noqa: E402
import theme_props_r2 as P2  # noqa: E402

WAVE = 'theme_props'
G = P1.G
CRACK = [
    'gggggdgggggggggggggggdgggggggggg',
    'gggggdgggggggggggggggdgggggggggg',
    'gggggdgggjkggggggggggdgggggggggg',
    'gggggdggggjkgggggggggdggggjkgggg',
    'gggggdggggjkgggggggggdggjkgggggg',
    'gggggdgggggjkggggggggdgjkggggggg',
    'gggggdgggggjkggggggggjkggggggggg',
    'ddddddddddddjdddddddjddddddddddd',
    'ggggggdggggjjjjjjjgjkgdggggggggg',
    'ggggggdggjjcccccccjjggdggggggggg',
    'gggjkgdgjccbbbbbbbccjgbggggggggg',
    'ggggjjdjcbbrrrrrrrbbcjdggggjkggg',
    'ggggggjjbrrppppppprrbckggjkggggg',
    'ggggggdgjppoooqooopprbkjkggggggg',
    'ggggggdjpoooqooooqooprjggggggggg',
    'dddddddjooqooooqooooqpckbcdddddd',
    'gggggdgjqooooqooooqoookggggggggg',
    'gggggdggkootttooqooooqkggggggggg',
    'gggggdgjjqotttuooooqokgggggggggg',
    'gggggjjkgkoouuuooqookdgggggggggg',
    'ggggjdggggkkoooqoookgdgggggggggg',
    'ggjjkdggggggkkkkkkkggdgggggggggg',
    'gggggdgcbggggggggjkggdgggggggggg',
    'ddddddddddddddddddjddddddddddddd',
    'ggggggdgggggggggggjkggdggggggggg',
    'ggggggdggggggggggggjkgdggggggggg',
    'ggggggdggggggggggggjkgdggggggggg',
    'ggggggdgggggggggggggjkdggggggggg',
    'ggggggdgggggggggggggggdggggggggg',
    'ggggggdgggggggggggggggdggggggggg',
    'ggggggdgggggggggggggggdggggggggg',
    'dddddddddddddddddddddddddddddddd',
]
LCRK = P1.L('g:crock6 h:cata4 k:castle6 d:iron1 c:vrock4 b:vrock3 j:vrock2 r:vrock1 o:ostone0 p:ostone2 q:ostone1 '
            't:cata5 u:vrock3 G:cata5 H:cata3 M:cata6 N:vrock3 R:castle5 D:castle2')
LCRK2 = P1.L('g:crock6 h:cata4 k:castle6 d:moss2 c:moss4 b:moss3 j:moss1 r:moss0 o:leaf0 p:moss1 q:leaf1 '
             't:cata5 u:moss3 G:cata5 H:cata3 M:cata6 N:moss3 R:castle5 D:castle2')


def art():
    return P2.damaged(CRACK, 'opqrtu', reach=1)   # 기울어진 조각 t·u·옆면 r 도 손상 둘레로 본다


def c_crack(n):
    def fn():
        cv = G(art(), LCRK if n == 1 else LCRK2)
        sc = E1.scene('castle' if n == 1 else 'catacomb', 7, 6, face_h=2, floor_kit='bd-pick-castle-catacombs-floor-castle')
        E1.place(sc, cv, 3, 3)
        E1.put_actor(sc, 1, 4)
        return cv, {'kind': 'tile', 'parts': {'금 간 바닥': cv}, 'vignette': sc}
    return fn


NOTES = {('prop.cracked_floor', 'A1'): '줄눈 따라 각지게 꺼진 성 판석(북쪽 판석 옆면 세 단·기운 판 조각·떨어진 조각), 짧은 금, 구멍 = 자두빛 어둠',
         ('prop.cracked_floor', 'A2'): '같은 짜임, 손상 둘레 = 이끼 낀 녹회색(묘지·유적)'}
FNS = {'prop.cracked_floor': {'A1': c_crack(1), 'A2': c_crack(2)}}
CANDIDATES = {item: {k: P1._noted(fn, NOTES[(item, k)]) for k, fn in c.items()} for item, c in FNS.items()}
BOARD_REFS = {'prop.cracked_floor': P1.BOARD_REFS['prop.cracked_floor']}


def line_scenes():
    return {}
