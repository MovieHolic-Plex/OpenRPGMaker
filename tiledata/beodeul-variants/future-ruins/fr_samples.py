# 미래 폐허 — 기계 재질 표본(이후 공장·제국 도시·열차 웨이브가 같은 규약으로 이어 쓴다). 모두 3x? 칸, 이어 붙여도 이음새 없음(주기 48/16).
from fr_mat import *


def mat_steel_panels(seed=3):
    """외장 강철판 앞면 3x3(48x48): 32x16 판, 줄마다 반 장 엇갈림, 판 줄눈(아래·오른쪽 톤 1, 위·왼쪽 +1), 리벳 6px 간격."""
    tc = TC(48, 48, seed)
    panels(tc, 0, 0, 48, 48, 'steel', 3, 32, 16, stagger=True, rivets=True, face='top', seed=seed, vary=0)
    tc.grain(.04)
    return tc.img()


def mat_rust_panels(seed=5):
    """녹슨 강철판 3x3(48x48): 같은 판에 녹 번짐 규약 적용(줄눈·리벳에서 시작, 아래로 흘러내린 줄)."""
    tc = TC(48, 48, seed)
    panels(tc, 0, 0, 48, 48, 'steel', 3, 32, 16, stagger=True, rivets=True, face='top', seed=seed, vary=1)
    rustify(tc, 0, 0, 48, 48, amount=.75, seed=seed + 1)
    tc.grain(.04)
    return tc.img()


def mat_pipe16(seed=0):
    """가는 관 3x1(48x16): 지름 6px, 이음 테 16px 마다(폭 2) — 강철 위 · 놋쇠 아래."""
    tc = TC(48, 16, seed)
    pipe_h(tc, 0, 48, 4, 6, 'steel', step=16); pipe_h(tc, 0, 48, 12, 6, 'brass', step=16)
    return tc.img()


def mat_pipe32(seed=0):
    """굵은 관 3x2(48x32): 지름 12px, 이음 테 32px 마다(폭 3, 볼트) — 강철 위 · 녹슨 관 아래."""
    tc = TC(48, 32, seed)
    pipe_h(tc, 0, 48, 8, 12, 'steel', step=32); pipe_h(tc, 0, 48, 24, 12, 'steel', step=32)
    rustify(tc, 0, 17, 48, 32, amount=.7, seed=seed + 2)
    return tc.img()


def mat_cable(seed=0):
    """전선 3x1(48x16, 위층): 2px 고무 전선 세 가닥이 서로 다르게 처진다(포물선)."""
    tc = TC(48, 16, seed)
    cable(tc, 0, 2, 47, 2, sag=8); cable(tc, 0, 4, 47, 5, sag=10); cable(tc, 0, 1, 47, 3, sag=5)
    return tc.img()


def mat_glass(seed=0):
    """유리판 3x2(48x32): 강철 창살 틀 안 유리 넷 — 성한 유리(반사·45° 빛줄) 둘, 금 간 유리, 깨진 유리(조각 + 속 어둠)."""
    tc = TC(48, 32, seed)
    tc.rect(0, 0, 48, 32, 'steel', 4)
    for i, (x0, y0) in enumerate(((2, 2), (25, 2), (2, 17), (25, 17))):
        glass_pane(tc, x0, y0, x0 + 21, y0 + 13, base=3, broken=(i == 3), seed=seed + i)
    for x in range(48): tc.px(x, 0, 'steel', 5); tc.px(x, 31, 'steel', 2); tc.px(x, 15, 'steel', 2); tc.px(x, 16, 'steel', 5)
    for y in range(32): tc.px(0, y, 'steel', 5); tc.px(47, y, 'steel', 2); tc.px(23, y, 'steel', 2); tc.px(24, y, 'steel', 5)
    return tc.img()


def mat_hazard(seed=0):
    """경고 띠 3x1(48x16): 바랜 노랑·검정 사선(폭 4px)을 강철 테 사이에, 벗겨진 점."""
    tc = TC(48, 16, seed)
    tc.rect(0, 0, 48, 16, 'steel', 3)
    hazard(tc, 0, 3, 48, 13, seed)
    for x in range(48): tc.px(x, 2, 'steel', 5); tc.px(x, 13, 'steel', 1)
    return tc.img()
