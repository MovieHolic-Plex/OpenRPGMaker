"""conifer wv5 — 전나무 숲 A/B/C. 세모 층 도장을 8px 엇갈린 격자에 찍는다. snow_conifer 가 같은 모양(FIR_*)을 가져다 쓴다."""
import os, sys
HERE0 = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE0, '..', '..', 'forest', 'work'))
from wv5lib import *
OUT = os.path.join(HERE0, '..')
BK = {'p': ('wbark', 1), 'q': ('wbark', 2), 'r': ('wbark', 3), 's': ('wbark', 0)}
def F(rows): return parse(rows, 'wpine', anchor=(len(rows[0]) // 2, len(rows) - 1 - 4), maps=BK)

# ---- A : 3층 세모, 폭 7 ----
FA1 = F(["...5...",
         "..454..",
         ".45431.",
         "..454..",
         ".45431.",
         "4554321",
         ".45431.",
         "4554321",
         "2454310"])
FA2 = F(["...4...",
         "..454..",
         ".44431.",
         "..454..",
         ".45431.",
         "4544321",
         ".45431.",
         "4544311",
         "2354310"])
def trunkF(cv, x, y, xb, yb):
    cv.put(x, y + 5, BK['q']); cv.put(x + 1, y + 5, BK['p']); cv.put(x, y + 6, BK['s'])
ROWS = [(4, [4, 12]), (12, [0, 8])]
def pickA(xb, yb): return {(4, 4): FA1, (12, 4): FA2, (0, 12): FA2, (8, 12): FA1}[(xb, yb)]
def pickA2(xb, yb): return {(4, 4): FA2, (12, 4): FA1, (0, 12): FA1, (8, 12): FA2}[(xb, yb)]

# ---- B : 4층 키 큰 전나무, 짙은 대비 + 큰 그림자 ----
FB1 = F(["...5...",
         "..454..",
         "..4531.",
         ".45431.",
         "..454..",
         ".455310",
         ".45431.",
         "4554321",
         ".45431.",
         "4554321",
         "1354310"])
FB2 = F(["...5...",
         "..454..",
         "..4431.",
         ".44431.",
         "..454..",
         ".454310",
         ".45431.",
         "4544321",
         ".45431.",
         "4544321",
         "1254210"])
def pickB(xb, yb): return {(4, 4): FB1, (12, 4): FB2, (0, 12): FB2, (8, 12): FB1}[(xb, yb)]
def pickB2(xb, yb): return {(4, 4): FB2, (12, 4): FB1, (0, 12): FB1, (8, 12): FB2}[(xb, yb)]

# ---- C : 작고 또렷한 2층 전나무 (전 둘레 어두운 테, 두 톤) ----
FC1 = F(["..00...",
         ".0540..",
         ".05410.",
         "0554310",
         ".0541 0.".replace(' ',''),
         "0554310",
         "0454310",
         ".00000."])
FC2 = F(["..00...",
         ".0440..",
         ".04410.",
         "0544310",
         ".04410.",
         "0544310",
         "0444310",
         ".00000."])
def pickC(xb, yb): return {(4, 4): FC1, (12, 4): FC2, (0, 12): FC2, (8, 12): FC1}[(xb, yb)]
def pickC2(xb, yb): return {(4, 4): FC2, (12, 4): FC1, (0, 12): FC1, (8, 12): FC2}[(xb, yb)]

if __name__ == '__main__':
    build_bundle(OUT, 'A', ROWS, pickA, pickA2, [(FA1, 4, 4), (FA2, 11, 5), (FA1, 8, 9)], trunkF, ('wpine', 1),
        'conifer A — World.png 결: 세모 3층 전나무가 8px 엇갈림', 'A: 폭 7 세모 3층, 왼면 밝고 오른면 어두움, 앞줄이 뒷줄 밑동을 가림, 남쪽 줄기 1~2px.')
    build_bundle(OUT, 'B', ROWS, pickB, pickB2, [(FB1, 4, 4), (FB2, 11, 5), (FB1, 8, 9)], trunkF, ('wpine', 0),
        'conifer B — 깊이: 4층 키 큰 전나무, 짙은 그늘', 'B: 4층 키 큰 세모, 정수리 5·오른아래 1로 대비를 키우고 바탕을 더 어둡게, 발치 그림자.', y_max=84)
    build_bundle(OUT, 'C', ROWS, pickC, pickC2, [(FC1, 4, 5), (FC2, 11, 6), (FC1, 8, 10)], trunkF, ('wpine', 1),
        'conifer C — 또렷한 작은 전나무', 'C: 2층 작은 전나무, 전 둘레 가장 어두운 테로 한 그루씩 또렷하게(두 톤).')
