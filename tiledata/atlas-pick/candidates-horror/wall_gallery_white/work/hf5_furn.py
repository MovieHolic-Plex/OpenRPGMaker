#!/usr/bin/env python3
"""미술관 object 셋: pedestal(16×16) rope_barrier(32×16) bench_gallery(32×16). 맨 아래 그림 줄은 y=14."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from hf5_lib import Cv

# ── 받침대 10×12 (x3..12, y3..14). 글자: o 윤곽 · H 윗면 밝음 · h 윗면 · e 윗면 오른쪽 · L 앞 윗입술 · F 앞면 · f 앞 왼줄 · S 옆면 · B 밑단
PED_ROWS = [
 "oooooooooo",
 "oHHHHHHHeo",
 "ohhhhhhheo",
 "ohhhhhhheo",
 "oheeeeeeSo",
 "oLLLLLLLSo",
 "ofFFFFFFSo",
 "ofFFFFFFSo",
 "ofFFFFFFSo",
 "ofFFFFFFSo",
 "oBBBBBBBSo",
 "oooooooooo",
]
def pedestal(v):
    c = Cv(16, 16)
    if v == 'A':
        cm = dict(o=('m', 1), H=('m', 6), h=('m', 5), e=('m', 4), L=('m', 6), F=('m', 4), f=('m', 5), S=('m', 2), B=('m', 3))
        mats = {'m': 'vmarble'}
        note = 'A: v5 식구 — 흰 대리석 사각 받침(폭 10px = 칸의 2/3). 윗면 5/6(위 얼굴이 보인다), 앞 입술 6, 앞면 4(왼줄 5), 오른쪽 옆면 2(얇게), 밑단 3, 윤곽 vmarble1.'
    elif v == 'B':
        cm = dict(o=('m', 0), H=('m', 6), h=('m', 6), e=('m', 5), L=('m', 6), F=('m', 4), f=('m', 5), S=('m', 1), B=('m', 2))
        mats = {'m': 'vmarble'}
        note = 'B: 어둠에서 읽히게 — 윗면 전부 6(가장 밝게), 앞면 4, 옆면 1, 윤곽 0 으로 세 얼굴이 서로 두세 단씩 벌어지고 외곽선이 가장 어둡다.'
    else:
        cm = dict(o=('m', 1), H=('m', 6), h=('m', 5), e=('m', 4), L=('g', 5), F=('m', 4), f=('m', 5), S=('m', 2), B=('m', 3))
        mats = {'m': 'vmarble', 'g': 'vgold'}
        note = 'C: 재료·무늬 — 대리석 받침 앞면에 세로 홈(flute) 무늬와 금(vgold5) 입술줄. 홈은 4/3 을 두 칸씩 번갈아, 옆면은 매끈.'
    c.stamp(PED_ROWS, 3, 3, cm)
    if v == 'C':
        for y in range(9, 13):
            for x in (5, 6, 9, 10): c.put(x, y, 'm', 3)
        for x in (5, 6, 7, 8, 9, 10): c.put(x, 12, 'm', 4)
        # 윗면 대리석 결
        for (x, y) in [(6, 5), (7, 5), (8, 6)]: c.put(x, y, 'm', 4)
    c.emit('pedestal', f'hf5-{v}', mats, note)

# ── 줄 울타리 32×16: 기둥 x7..8, x23..24. 줄은 기둥 사이(9..22, 25..38→25..31,0..6) 같은 처짐.
SAG = [0, 1, 1, 2, 2, 3, 3, 3, 3, 2, 2, 1, 1, 0]
def rope(v):
    c = Cv(32, 16)
    post = {'A': ('t', 'tarn', (1, 3, 4, 5)), 'B': ('b', 'vbrass', (1, 4, 5, 6)), 'C': ('b', 'vbrass', (0, 3, 4, 6))}[v]
    pm, pr, (po, pd, pb, ph) = post
    for cx in (7, 23):
        # 받침 원반 y13..14 (x-2..x+3)
        for y, (a, b) in ((13, (-1, 2)), (14, (-2, 3))):
            for x in range(cx + a, cx + b + 1): c.put(x, y, pm, pd if y == 14 else pb)
        for x in range(cx - 2, cx + 4): c.put(x, 15, pm, po) if False else None
        for x in range(cx - 2, cx + 4): c.put(x, 14, pm, po if x in (cx - 2, cx + 3) else pd)
        # 기둥 몸통 x cx..cx+1, y5..12
        for y in range(5, 13):
            c.put(cx - 1, y, pm, po); c.put(cx, y, pm, ph if v != 'B' else ph); c.put(cx + 1, y, pm, pd); c.put(cx + 2, y, pm, po)
        if v == 'C':
            for y in (8, 9): 
                for dx in (0, 1): c.put(cx + dx, y, pm, pb)      # 기둥 띠(굵은 마디)
        # 꼭지 공 y2..5 (x cx-1..cx+2)
        for y, (a, b) in ((2, (0, 1)), (3, (-1, 2)), (4, (-1, 2)), (5, (-1, 2))):
            for x in range(cx + a, cx + b + 1): c.put(x, y, pm, pb)
        for x in (cx, cx + 1): c.put(x, 2, pm, po)
        c.put(cx - 1, 3, pm, po); c.put(cx + 2, 3, pm, po)
        c.put(cx, 3, pm, ph)
    # 줄
    rm = {'A': ('r', 'velv', (4, 3, 2)), 'B': ('r', 'vred', (4, 3, 1)), 'C': ('r', 'velv', (5, 3, 1))}[v]
    rmat, rramp, (rh, rb, rd) = rm
    for seg0 in (9, 25):
        for i, s in enumerate(SAG):
            x = seg0 + i; y = 6 + s
            if v == 'C':
                t1, t2 = (rh, rb) if (i // 2) % 2 == 0 else (rb, rh)   # 꼬임: 두 칸씩 밝은/어두운 교대
                c.wput(x, y, rmat, t1); c.wput(x, y + 1, rmat, t2); c.wput(x, y + 2, rmat, rd)
            else:
                c.wput(x, y, rmat, rh); c.wput(x, y + 1, rmat, rb); c.wput(x, y + 2, rmat, rd)
    # 기둥 옆 줄 고리(기둥에 걸린 곳)
    mats = {pm: pr, rmat: rramp}
    notes = {
      'A': 'A: v5 식구 — tarn 놋 기둥(폭 2px 몸통+공 꼭지+원반 밑단) 둘, 벨벳 붉은 줄(velv 4/3/2)이 가운데로 처짐(0→3px). 기둥 중심 x=7,23 → 이어 붙이면 16px 간격, 줄 끝이 x=31→0 으로 이어진다.',
      'B': 'B: 어둠에서 읽히게 — vbrass 밝은 기둥(6/5/4, 윤곽 1)과 vred 선명한 줄(4/3/1)로 바닥·벽보다 밝고 채도 있는 실루엣. 이어짐은 A 와 같다.',
      'C': 'C: 재료·무늬 — 놋 기둥에 마디 띠 하나, 줄은 두 칸씩 밝고 어두움이 엇갈리는 꼬임(velv 5/3/1). 기둥 x=7,23 이어붙임 16px.'}
    c.emit('rope_barrier', f'hf5-{v}', mats, notes[v])

# ── 관람 의자 32×16 ────────────────────────────────────────────────────────────────────
def bench(v):
    c = Cv(32, 16)
    cfg = {'A': dict(m='velv', o=1, hi=5, top=4, ft=3, fb=2, lm='tin', lo=1, ll=4, ld=3),
           'B': dict(m='mahog', o=0, hi=6, top=5, ft=3, fb=1, lm='tin', lo=0, ll=6, ld=4),
           'C': dict(m='velv', o=0, hi=5, top=4, ft=3, fb=1, lm='tarn', lo=0, ll=5, ld=3)}[v]
    ramp = cfg['m']; m = 'm'
    x0, x1 = 2, 29
    # 윗면 y5..10, 앞 두께 y11..12, 그림자띠 없음 / 다리 y13..14
    for x in range(x0, x1 + 1):
        c.put(x, 5, m, cfg['o'])
        for y in range(6, 11): c.put(x, y, m, cfg['top'])
        c.put(x, 6, m, cfg['hi'])                  # 윗면 뒤쪽 모서리 하이라이트
        c.put(x, 10, m, cfg['ft'])                 # 앞 모서리 한 단 어둡게(둥근 배)
        c.put(x, 11, m, cfg['ft']); c.put(x, 12, m, cfg['fb'])
        c.put(x, 13, m, cfg['o']) if x in (x0, x1) else None
    for y in range(5, 13): c.put(x0, y, m, cfg['o']); c.put(x1, y, m, cfg['o'])
    for x in range(x0, x1 + 1): c.put(x, 12, m, cfg['o'] if False else cfg['fb'])
    # 밑선 윤곽
    for x in range(x0, x1 + 1): c.put(x, 13, m, cfg['o'])
    # 다리 두 개 (앞다리): x4..5, x26..27,  y13..14
    for lx in (4, 26):
        for y in (13, 14):
            c.put(lx, y, 'l', cfg['ll']); c.put(lx + 1, y, 'l', cfg['ld'])
            c.put(lx - 1, y, 'l', cfg['lo']); c.put(lx + 2, y, 'l', cfg['lo'])
        c.put(lx - 1, 14, 'l', cfg['lo']); c.put(lx + 2, 14, 'l', cfg['lo'])
    # 모서리 둥글림: 윗줄 양 끝 한 칸 비움
    for (x, y) in [(x0, 5), (x1, 5)]: c.m[y][x] = '.'; c.t[y][x] = '.'
    mats = {'m': ramp, 'l': cfg['lm']}
    if v == 'C':
        # 단추 박음질: 윗면에 4px 간격 단추(어두운 점) + 능형 솔기(3단)
        for bx in range(6, 27, 5):
            c.put(bx, 8, m, 1); c.put(bx + 1, 8, m, 2)
            c.put(bx - 1, 7, m, 3); c.put(bx + 2, 7, m, 3); c.put(bx - 1, 9, m, 3); c.put(bx + 2, 9, m, 3)
        for x in range(x0 + 1, x1): c.put(x, 11, m, 2) if x % 5 in (0, 1) else None   # 앞면 솔기 점선
        c.emit('bench_gallery', f'hf5-{v}', mats, 'C: 재료·무늬 — 단추 박음질 가죽(velv, 5px 간격 단추+능형 솔기)과 점선 박음질 앞면, tarn 놋 다리.')
    elif v == 'A':
        c.emit('bench_gallery', f'hf5-{v}', mats, 'A: v5 식구 — 등받이 없는 긴 가죽 의자. 윗면 velv4(뒷모서리 5) 5줄, 앞 두께 3/2, 회색 tin 다리 둘(1칸 폭), 윤곽 velv1. 위 ¾ 시점.')
    else:
        c.emit('bench_gallery', f'hf5-{v}', mats, 'B: 어둠에서 읽히게 — mahog 가죽 윗면 5(뒷 모서리 6, 가장 밝음), 앞 3/1, 윤곽 0, tin 다리를 밝게(6/4)해 바닥과 분리.')

if __name__ == '__main__':
    for v in 'ABC':
        pedestal(v); rope(v); bench(v)
