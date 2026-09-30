#!/usr/bin/env python3
"""hf1 덮개 두 기물: exit_dark(32x32 over), moonlight_floor(16x32 decal). 반투명 글자를 손으로 놓는다(계산 색 없음).
실행: python3 tiledata/atlas-pick/candidates-horror/ceil_black/work/hf1_overlay.py"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from hf1_lib import emit_raw

# ── exit_dark ────────────────────────────────────────────────────────────────
DK = '^"*&'
def exit_rows(bands, dither, edge_w, edge_step, ragged=False, checker_fringe=False):
    """bands: 줄마다 단 번호(-1=투명), dither: {줄: 아랫단} 이면 그 줄을 체스판 반반. 가장자리는 edge_w px 한 단 짙게"""
    rows = []
    for y in range(32):
        b = bands[y]; row = []
        for x in range(32):
            if b < 0: row.append('.'); continue
            tone = b
            if y in dither and (x + y) % 2 == 1: tone = min(3, b + 1)
            ew = edge_w
            if ragged and (y // 2) % 2 == 1: ew = edge_w - 1
            if x < ew or x >= 32 - ew: tone = min(3, tone + edge_step)
            row.append(DK[tone])
        rows.append(''.join(row))
    return rows
def bands_from(spec):  # [(줄수, 단)] 위에서부터
    out = []
    for n, b in spec: out += [b] * n
    assert len(out) == 32, len(out); return out

A = exit_rows(bands_from([(3, -1), (6, 0), (7, 1), (7, 2), (9, 3)]), {8, 14, 21}, 3, 1)
emit_raw('exit_dark', 'hf1-A', A,
  'A(v5 식구·부드럽게): 위 3줄 투명 → ^ 6줄 → " 7줄 → * 7줄 → & 9줄(맨 아래 줄 &). 단이 바뀌는 줄(9·15·22째)만 체스판 반반으로 이음매를 풀고, 좌우 3px 는 한 단 짙게(문틀 안쪽 벽이 더 어두워 보이도록). 2칸 폭 틈용')
B = exit_rows(bands_from([(4, -1), (6, 0), (7, 1), (7, 2), (8, 3)]), set(), 2, 1)
emit_raw('exit_dark', 'hf1-B', B,
  'B(어둠에서 읽힘): 반투명 네 단을 이음 없이 딱 자른 계단 — 위 4줄 투명 → ^ 6 → " 7 → * 7 → & 8. 단 경계가 또렷해 어두운 방에서 복도가 계단식으로 깊어 보임. 좌우 2px 한 단 짙게')
C = exit_rows(bands_from([(2, -1), (4, 0), (2, 0), (6, 1), (4, 1), (6, 2), (4, 2), (4, 3)]), {4, 5, 12, 13, 18, 19, 24, 25}, 3, 1, ragged=True)
emit_raw('exit_dark', 'hf1-C', C,
  'C(안개 낀 복도식): 단 사이를 두 줄씩 체스판으로 넓게 풀어 어둠이 번지듯, 좌우 가장자리는 두 줄마다 3px/2px 로 들쭉날쭉(젖은 벽 느낌). 위 2줄 투명, 맨 아래 &')

# ── moonlight_floor ──────────────────────────────────────────────────────────
def moon(panes, gapx, hgaps, top_fade, bot_fade, start, shift_every, xshift_rows=None, sparse=None):
    """panes: 창살 사이 폭 목록(가로), 사이 gapx 폭 빈 줄(창살 그림자). 왼쪽 시작 = start + y//shift_every"""
    rows = []
    for y in range(32):
        r = ['.'] * 16
        if 1 <= y <= 30 and y not in hgaps:
            x = start + y // shift_every
            for i, wd in enumerate(panes):
                for k in range(wd):
                    if 0 <= x + k <= 15: r[x + k] = '?'
                x += wd + gapx
            if y in top_fade or y in bot_fade:               # 가장자리는 한 픽셀씩 걸러 옅게
                for i in range(16):
                    if (i + y) % 2 == 0: r[i] = '.'
        rows.append(r)
    if sparse:
        for (x, y) in sparse: rows[y][x] = '?'
    return [''.join(r) for r in rows]
MA = moon([4, 4], 1, {14}, {1, 30}, {1, 30}, 1, 5)
emit_raw('moonlight_floor', 'hf1-A', MA,
  'A(v5 식구): 창 십자 창살 — 폭 4+4 두 판 사이 세로 1px 그림자 줄을 비우고, 가로 창살 그림자(14째 줄)도 비움. 5줄마다 오른쪽으로 1px 밀림(위 x=1 → 아래 x=7, 32줄에 1px씩이면 캔버스 밖이라 여러 줄에 1px). 위·아래 첫 줄은 한 픽셀 걸러 옅게. ? 만')
MB = moon([5, 5], 1, set(), set(), set(), 1, 8)
emit_raw('moonlight_floor', 'hf1-B', MB,
  'B(어둠에서 읽힘): 굵은 판 5+5, 세로 창살 줄 1px 만 비우고 가로 줄은 없음, 걸러내기 없이 또렷한 가장자리. 8줄마다 1px 밀림(x=1→4). 어두운 방에서 바닥에 큰 빛 두 덩이가 한눈에 읽힘')
MC = moon([3, 3], 1, {14, 15}, {1, 2, 29, 30}, {1, 2, 29, 30}, 1, 4, sparse=[(0, 8), (0, 9), (15, 22), (14, 24)])
# 창살 격자: 빛 조각이 흩어지는 티끌 (8·9줄 왼쪽, 22·24줄 오른쪽)
emit_raw('moonlight_floor', 'hf1-C', MC,
  'C(무늬·창살 격자): 폭 3+3 두 판(세로 창살 1px + 가로 창살 2px 를 14·15줄에 비움), 4줄마다 1px 밀림(x=1→8), 위·아래 두 줄은 걸러 옅게. 빛 티끌 몇 점을 판 밖에 흩어 유리 반사 느낌')
