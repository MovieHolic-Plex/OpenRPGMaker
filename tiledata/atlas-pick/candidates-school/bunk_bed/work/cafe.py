import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from s3k import C
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
def out(slug, X): return ROOT + '/%s/s3-%s.pxg' % (slug, X)

def table(top, edge, leg, bench, bench_hi, bench_lo, dark_under, lit=True):
    """top=(ramp,base stage)"""
    c = C(48, 32)
    P = lambda r, s: (r, s)
    tr, ts = top
    # 뒤 벤치(테이블 뒤로 살짝 보임)
    c.rect(4, 1, 40, 4, P(bench, 4)); c.hl(4, 1, 40, P(bench, bench_hi)); c.hl(4, 4, 40, P(bench, bench_lo))
    c.vl(4, 1, 4, P(bench, bench_hi)); c.vl(43, 1, 4, P(bench, bench_lo))
    # 뒤 벤치 다리(테이블 상판에 가려 위쪽만)
    for x in (7, 40): c.rect(x, 5, 2, 2, P(leg, 2))
    # 상판 윗면
    c.rect(1, 7, 46, 10, P(tr, ts))
    c.hl(1, 7, 46, P(tr, ts + 1))
    c.rect(1, 8, 46, 1, P(tr, ts + 1))
    # 반사 한 줄
    c.hl(6, 10, 10, P(tr, min(5, ts + 1))); c.hl(30, 13, 8, P(tr, ts - 1 if ts > 1 else ts))
    c.vl(1, 7, 10, P(tr, min(5, ts + 1)))
    c.vl(46, 8, 9, P(tr, ts - 1))
    # 앞 모서리(두께)
    c.rect(1, 17, 46, 2, P(edge, 3)); c.hl(1, 17, 46, P(edge, 4)); c.hl(1, 18, 46, P(edge, 1))
    c.px(1, 19, '.')
    # 다리
    for x in (4, 42):
        c.rect(x, 19, 2, 9, P(leg, 3)); c.vl(x, 19, 9, P(leg, 4)); c.vl(x + 1, 19, 9, P(leg, 1))
        c.rect(x - 1, 28, 4, 2, P(leg, 1)); c.hl(x - 1, 28, 4, P(leg, 3))
    c.hl(7, 22, 35, P(leg, 2))  # 가로대
    # 상판 아래 그늘
    for x in range(6, 42): c.px(x, 19, P(dark_under, 1)) if c.get(x, 19) == '.' else None
    # 앞 벤치
    c.rect(6, 22, 36, 4, P(bench, 4)); c.hl(6, 22, 36, P(bench, bench_hi)); c.hl(6, 25, 36, P(bench, bench_lo))
    c.vl(6, 22, 4, P(bench, bench_hi)); c.vl(41, 22, 4, P(bench, bench_lo))
    for x in (8, 38):
        c.rect(x, 26, 2, 3, P(leg, 3)); c.vl(x, 26, 3, P(leg, 4)); c.vl(x + 1, 26, 3, P(leg, 1))
    return c

def fin(c, X, note):
    c.px(0, 0, '.'); c.px(47, 0, '.')
    c.shadow(3, 29, 44, 2)
    c.save(out('cafeteria_table', X), note)

# A: v5 결, 흰 상판 + 소나무 벤치 + 철 다리
c = table(('vwhite', 4), 'vwhite', 'viron', 'vpine', 6, 2, 'viron')
# 상판 가장자리 소나무 띠 없이 흰색. 다리는 회색 철.
fin(c, 'A', 'v5 결: 긴 흰 상판 식탁, 소나무 긴 벤치 둘(앞·뒤), 회색 철 다리와 가로대, 상판은 식판 놓을 자리로 비움')

# B: 센 명암, 크림 상판 + 짙은 철 벤치, 아래 깊은 그늘
c = table(('cream', 4), 'cream', 'locker', 'locker', 5, 1, 'locker')
# 오른쪽 절반 그늘, 상판 아래 깊은 그림자
for y in range(9, 17):
    for x in range(30, 46):
        ch = c.get(x, y)
        if ch != '.': pass
for y in range(9, 17):
    for x in range(30, 46):
        c.px(x, y, ('cream', 3))
for x in range(2, 46): c.px(x, 19, ('locker', 0)) if c.get(x, 19) in ('.',) or True else None
for x in range(7, 41): c.px(x, 20, ('locker', 0)); 
fin(c, 'B', '센 명암: 크림 상판 왼쪽 밝고 오른쪽 그늘, 상판 밑 짙은 그림자, 짙은 회색 철 벤치와 다리')

# C: 실루엣 — 고정식 원형 의자 식탁 (상판 하나 + 가운데 기둥 다리 둘 + 원형 의자 넷)
c = C(48, 32)
P = lambda r, s: (r, s)
# 뒤 의자 둘(원형, 상판 뒤로 살짝)
for cx in (13, 34):
    c.rect(cx - 4, 2, 9, 4, P('tray', 4)); c.hl(cx - 3, 1, 7, P('tray', 5)); c.hl(cx - 4, 5, 9, P('tray', 2))
    c.hl(cx - 4, 2, 9, P('tray', 5)); c.px(cx - 4, 2, '.'); c.px(cx + 4, 2, '.')
# 상판
c.rect(2, 7, 44, 10, P('vwhite', 4)); c.hl(2, 7, 44, P('vwhite', 5)); c.vl(2, 7, 10, P('vwhite', 5)); c.vl(45, 8, 9, P('vwhite', 3))
c.hl(7, 10, 9, P('vwhite', 5)); c.hl(28, 13, 7, P('vwhite', 3))
# 청록 띠 테두리(앞 모서리)
c.rect(2, 17, 44, 2, P('vblue', 3)); c.hl(2, 17, 44, P('vblue', 4)); c.hl(2, 18, 44, P('vblue', 1))
c.px(2, 19, '.')
# 기둥 다리 둘
for x in (11, 34):
    c.rect(x, 19, 3, 9, P('viron', 3)); c.vl(x, 19, 9, P('viron', 4)); c.vl(x + 2, 19, 9, P('viron', 1))
    c.rect(x - 2, 28, 7, 2, P('viron', 2)); c.hl(x - 2, 28, 7, P('viron', 4))
# 연결 파이프(밑)
c.hl(14, 26, 20, P('viron', 3)); c.hl(14, 27, 20, P('viron', 1))
# 앞 의자 둘: 원형, 팔(가로 막대)로 기둥에 붙음
for cx in (12, 35):
    c.hl(cx - 1, 24, 3, P('viron', 2))
    c.rect(cx - 5, 20, 11, 4, P('tray', 4)); c.hl(cx - 4, 20, 9, P('tray', 5)); c.hl(cx - 5, 23, 11, P('tray', 2))
    c.px(cx - 5, 20, '.'); c.px(cx + 5, 20, '.'); c.vl(cx - 5, 21, 3, P('tray', 5)); c.vl(cx + 5, 21, 3, P('tray', 1))
    c.hl(cx - 4, 21, 9, P('tray', 4))
# 상판 밑 그림자
for x in range(4, 44):
    if c.get(x, 19) == '.': c.px(x, 19, P('viron', 1))
fin(c, 'C', '실루엣 다르게: 바닥 고정형 식탁, 청색 띠 상판 + 기둥 다리 둘 + 팔로 붙은 둥근 회색 의자 넷(앞 둘·뒤 둘)')
