#!/usr/bin/env python3
"""미술관 벽걸이 넷: frame_landscape(32×16) frame_small(16×16) plaque(16×16). wall 층: 위 2px 비움, 네 귀퉁이 투명."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from hf5_lib import Cv

def bevel_frame(c, x0, y0, x1, y1, mat, out, hi, body, lo, dark):
    """바깥 1px 윤곽(out) → 3px 테: 위·왼 hi/body, 아래·오른 body→lo. 안쪽 1px 어둠(dark)."""
    for x in range(x0, x1 + 1):
        c.put(x, y0, mat, out); c.put(x, y1, mat, out)
    for y in range(y0, y1 + 1):
        c.put(x0, y, mat, out); c.put(x1, y, mat, out)
    # 테 2px (윤곽 안쪽)
    for x in range(x0 + 1, x1):
        c.put(x, y0 + 1, mat, hi);   c.put(x, y0 + 2, mat, body)
        c.put(x, y1 - 1, mat, lo);   c.put(x, y1 - 2, mat, body if lo == body else lo)
    for y in range(y0 + 1, y1):
        c.put(x0 + 1, y, mat, hi);   c.put(x0 + 2, y, mat, body)
        c.put(x1 - 1, y, mat, lo);   c.put(x1 - 2, y, mat, body if lo == body else lo)
    # 안쪽 어둠 띠
    for x in range(x0 + 3, x1 - 2):
        c.put(x, y0 + 3, mat, dark); c.put(x, y1 - 3, mat, dark)
    for y in range(y0 + 3, y1 - 2):
        c.put(x0 + 3, y, mat, dark); c.put(x1 - 3, y, mat, dark)
    return (x0 + 4, y0 + 4, x1 - 4, y1 - 4)      # 그림 자리

def paint(c, box, rows, cmap):
    x0, y0, x1, y1 = box
    assert len(rows) == y1 - y0 + 1 and all(len(r) == x1 - x0 + 1 for r in rows), (len(rows), y1 - y0 + 1, len(rows[0]), x1 - x0 + 1)
    c.stamp(rows, x0, y0, cmap)

# ── 풍경 그림 (프레임 32×16: 테 x1..30 y2..14 → 그림 x5..26, y6..10 = 22×5) ────────────────
LAND_A = [
    "ssssssssssssssssssssss",
    "SSSccSSSSSSSSSSSSccSSS",
    "SSSSSSSHHHSSSSSHHHHSSS",
    "HHHHHHHHHHHHHTHHHHHHHH",
    "GgGGgGGGGGgGGGGgGGGgGG",
]
LAND_B = [   # 대비 크게: 밝은 하늘 · 어두운 언덕 · 밝은 길
    "wwwwwwwwwwwwwwwwwwwwww",
    "wwwWWwwwwwwwwwwwWWwwww",
    "wwwwwwwHHHwwwwwHHHHwww",
    "HHHHHHHHHHHHHTHHHHHHHH",
    "DDDDDDDDDDPPPPDDDDDDDD",
]
LAND_C = [   # 붓 자국·크랙 — 두꺼운 물감 덩이
    "smsmsSsmsSsmsmsSsmsSsm",
    "SsScScSsSsSmSsSsScSsSS",
    "SsSmHhHHSsSsmHhHHhSsSm",
    "HhHTHhHhHhHhTHHhHhHhHH",
    "GgGdGgdGGgGdGgGGdgGgGG",
]

def frame_landscape(v):
    c = Cv(32, 16)
    if v == 'A':
        box = bevel_frame(c, 1, 2, 30, 14, 't', 1, 5, 4, 2, 0)
        cm = dict(s=('m', 3), S=('m', 4), c=('p', 5), H=('g', 2), T=('g', 1), G=('g', 1), g=('g', 2))
        mats = {'t': 'tarn', 'm': 'moon', 'p': 'paper', 'g': 'vgreen'}
        rows = LAND_A
        note = 'A: v5 식구 — 금테(tarn 5/4 위·왼, 2 아래·오른, 윤곽 1) 안에 조용한 풍경(하늘 moon3/4, 구름 paper5, 언덕·들판 vgreen1/2, 나무 한 그루). 이상한 것 없음.'
    elif v == 'B':
        box = bevel_frame(c, 1, 2, 30, 14, 'b', 0, 6, 4, 2, 0)
        cm = dict(w=('m', 5), W=('p', 6), H=('g', 2), T=('g', 0), D=('g', 1), P=('p', 4))
        mats = {'b': 'vbrass', 'm': 'moon', 'p': 'paper', 'g': 'vgreen'}
        rows = LAND_B
        note = 'B: 어둠에서 읽히게 — 놋쇠 테(vbrass 6 하이라이트/4 몸/2 그늘, 윤곽 0)로 벽 흰면과 세 단 이상 벌리고, 그림도 밝은 하늘 moon5 · 어두운 언덕 vgreen2 · 밝은 길 paper4 큰 덩이 셋으로 대비.'
    else:
        box = bevel_frame(c, 1, 2, 30, 14, 't', 0, 5, 3, 2, 0)
        # 구슬 몰딩: 테 윗·아랫줄 2px 간격 점
        for x in range(4, 28, 3):
            c.put(x, 3, 't', 6 if False else 5); c.put(x, 4, 't', 4)
        cm = dict(s=('m', 3), S=('m', 4), m=('m', 2), c=('p', 5), H=('g', 2), h=('g', 3), T=('g', 1), G=('g', 1), g=('g', 2), d=('g', 0))
        mats = {'t': 'tarn', 'm': 'moon', 'p': 'paper', 'g': 'vgreen'}
        rows = LAND_C
        note = 'C: 재료·무늬 — 구슬 몰딩을 돋운 tarn 테 + 두껍게 바른 유화 붓 자국(하늘·언덕·들판이 한 단씩 섞여 결이 보인다). 세월 탄 금박.'
    paint(c, box, rows, cm)
    c.emit('frame_landscape', f'hf5-{v}', mats, note)

# ── 작은 액자 (16×16: 테 x2..13 y2..14 → 그림 x6..9? 12×13 라 안쪽은 4×5 … 작아서 테를 얇게) ─────
def frame_small(v):
    c = Cv(16, 16)
    # 테 2px: 윤곽 + 1px 테. 그림 x4..11 (8) × y4..12 (9)
    def thin(mat, out, hi, lo):
        for x in range(2, 14): c.put(x, 2, mat, out); c.put(x, 14, mat, out)
        for y in range(2, 15): c.put(2, y, mat, out); c.put(13, y, mat, out)
        for x in range(3, 13): c.put(x, 3, mat, hi); c.put(x, 13, mat, lo)
        for y in range(3, 14): c.put(3, y, mat, hi); c.put(12, y, mat, lo)
    if v == 'A':
        thin('t', 1, 5, 2)
        cm = dict(b=('v', 2), B=('v', 1), q=('s', 5), Q=('s', 3), t=('s', 2), l=('g', 2))
        mats = {'t': 'tarn', 'v': 'velv', 's': 'sheet', 'g': 'vgreen'}
        rows = ["bbbbbbbb", "bbbllbbb", "bblbbBbb", "bbbqqbbb", "bbqQQqbb", "bbqQQqbb", "bbbtttbb", "BBBBBBBB", "BBBBBBBB"]
        note = 'A: v5 식구 — 같은 tarn 금테를 얇게(1칸), 안은 짙은 붉은 벽(velv2) 위 화병 하나(sheet5/3)와 줄기 잎 하나.'
    elif v == 'B':
        thin('b', 0, 6, 3)
        cm = dict(b=('m', 5), B=('m', 4), q=('v', 0), Q=('v', 1), t=('v', 0), l=('g', 1))
        mats = {'b': 'vbrass', 'm': 'moon', 'v': 'vblack', 'g': 'vgreen'}
        rows = ["bbbbbbbb", "bbbllbbb", "bblbbBbb", "bbbqqbbb", "bbqQQqbb", "bbqQQqbb", "bbbtttbb", "BBBBBBBB", "BBBBBBBB"]
        note = 'B: 어둠에서 읽히게 — 밝은 놋쇠 테(vbrass6/3/0) + 밝은 회청 바탕(moon5)에 까만 화병 실루엣(vblack0/1)이 뚜렷이. 세부는 화병 목 하나뿐.'
    else:
        thin('t', 0, 5, 1)
        for x in (5, 8, 11): c.put(x, 3, 't', 6 if False else 4)
        cm = dict(b=('d', 2), B=('d', 1), p=('d', 3), q=('s', 5), Q=('s', 3), t=('s', 2), l=('g', 2))
        mats = {'t': 'tarn', 'd': 'damask', 's': 'sheet', 'g': 'vgreen'}
        rows = ["bpbpbpbp", "pbpllpbp", "bpbpbBbp", "pbpqqbpb", "bpqQQqpb", "pbqQQqbp", "bpbtttpb", "BpBpBpBp", "pBpBpBpB"]
        note = 'C: 재료·무늬 — 다마스크 벽(damask 2/3 체크 문양) 위 화병. 테는 tarn 에 윗줄 구슬 세 점.'
    x0, y0 = 4, 4
    c.stamp(rows, x0, y0, cm)
    c.emit('frame_small', f'hf5-{v}', mats, note)

# ── 명패 (16×16: 가운데 판, 나머지 투명) ────────────────────────────────────────────────────
def plaque(v):
    c = Cv(16, 16)
    if v == 'A':      # 판 10×7 x3..12 y4..10, 획 y6·y8
        c.rect(3, 4, 12, 10, 'p', 1)
        c.rect(4, 5, 11, 9, 'p', 5)
        for x in range(4, 12): c.put(x, 5, 'p', 6)
        for x in range(4, 12): c.put(x, 9, 'p', 4)
        for x in range(5, 11): c.put(x, 6, 'k', 1)
        for x in range(5, 9): c.put(x, 8, 'k', 1)
        mats = {'p': 'sheet', 'k': 'void'}
        note = 'A: v5 식구 — 10×7 sheet 판(윤곽 1, 면 5, 윗줄 6·아랫줄 4), 글씨 줄 두 개(긴 획 6px / 짧은 획 4px, 한 줄 띄움, void1). 가짜 글자 없음.'
    elif v == 'B':    # 놋쇠 판 12×7
        c.rect(2, 4, 13, 10, 'b', 1)
        c.rect(3, 5, 12, 9, 'b', 5)
        for x in range(3, 13): c.put(x, 5, 'b', 6)
        for x in range(4, 12): c.put(x, 6, 'k', 0)
        for x in range(4, 9): c.put(x, 8, 'k', 0)
        for (x, y) in [(2, 4), (13, 4), (2, 10), (13, 10)]: c.put(x, y, 'b', 6)
        mats = {'b': 'vbrass', 'k': 'void'}
        note = 'B: 어둠에서 읽히게 — 12×7 놋쇠 판(면 vbrass5, 윗줄 6, 윤곽 1) 위에 새까만 획 두 줄(void0, 한 줄 띄움)로 대비 최대. 네 모서리에 밝은 못.'
    else:
        c.rect(3, 4, 12, 10, 'p', 0)
        c.rect(4, 5, 11, 9, 'p', 4)
        for x in range(4, 12): c.put(x, 5, 'p', 5)
        for x in range(5, 11): c.put(x, 6, 'k', 1)
        for x in range(5, 9): c.put(x, 8, 'k', 1)
        for (x, y) in [(3, 4), (12, 4), (3, 10), (12, 10)]: c.put(x, y, 'g', 2)
        mats = {'p': 'wax', 'k': 'void', 'g': 'tarn'}
        note = 'C: 재료·무늬 — 누렇게 바랜 밀랍색(wax) 종이 명패에 tarn 못 네 개, 잉크 획 두 줄(한 줄 띄움). 오래 걸린 명패.'
    c.emit('plaque', f'hf5-{v}', mats, note)

if __name__ == '__main__':
    for v in 'ABC':
        frame_landscape(v); frame_small(v); plaque(v)
