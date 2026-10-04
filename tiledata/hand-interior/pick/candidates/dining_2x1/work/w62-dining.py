#!/usr/bin/env python3
"""w62: dining 6종 — 몸통 = dining 2x1 pilot-B 를 크기별로 늘이고 줄인다.
가로: 왼쪽 8칸·오른쪽 8칸은 그대로, 가운데는 pilot-B 의 가운데 16칸(8..23)을 되풀이한다(v5 처럼 16px 마다 결 한 번).
세로(깊이 2): 윗면 3~8행의 6행 짜임을 되풀이해 16행을 더한다(가운데 칸은 반복마다 가로로 밀어 결이 겹치지 않게).
다리·접지 그림자·앞 테·밑 윤곽은 pilot-B 그대로. 다리 사이 막대는 v5 형제와 같이 가운데가 이어진다."""
import os, re
C = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
def blocks(path):
    L = {}; cur = None; rows = None; y = 0
    for l in open(path):
        l = l.rstrip('\n')
        if l.startswith('@layer'): cur = l.split()[1]
        elif l.startswith('@block'):
            rows = []; L.setdefault(cur, []).append((int(l.split()[2]), rows))
        elif rows is not None and l and not l.startswith(('@', '//')): rows.append(l)
    return L
L = blocks(f'{C}/dining_2x1/pilot-B.pxg')
main = L['main'][0][1]          # 16행 x 32
sh = L['shadow'][0]             # (13, 2행)
SW = 32
def xmap(c, W):
    """새 열 c -> (원본 열, 가운데 여부)"""
    if c < 8: return c, False
    if c >= W - 8: return SW - (W - c), False
    return 8 + (c - 8) % 16, True
def row_stretch(r, W, shift=0):
    out = ''
    for c in range(W):
        sc, mid = xmap(c, W)
        if mid and shift: sc = 8 + (sc - 8 + shift) % 16
        out += r[sc]
    return out
def make(W, deep):
    rows = []
    if not deep:
        rows = [row_stretch(r, W) for r in main]
        shift_rows = 0
    else:
        top = main[:9]                      # 0..8
        rows = [row_stretch(r, W) for r in top]
        ext = [main[3 + (i % 6)] for i in range(16)]
        for i, r in enumerate(ext):
            rows.append(row_stretch(r, W, shift=5 * (i // 6 + 1) if (i // 6) else 0))
        rows += [row_stretch(r, W) for r in main[9:]]
    H = len(rows)
    shr = [row_stretch(r, W) for r in sh[1]]
    return rows, shr, H
SZ = {'1x1': (16, 0), '3x1': (48, 0), '4x1': (64, 0), '2x2': (32, 1), '3x2': (48, 1), '4x2': (64, 1)}
def emit(k):
    W, deep = SZ[k]
    rows, shr, H = make(W, deep)
    sy = H - 3
    out = [f'// w62 — dining {k}: 몸통 = dining 2x1 pilot-B 를 크기에 맞게 늘이고 줄임 (work/w62-dining.py)',
           f'@size {W} {H}', '@cell 16', '@palette palette.pal', '@layer shadow', f'@block 0 {sy}'] + shr + ['@layer main', '@block 0 0'] + rows
    d = f'{C}/dining_{k}'
    open(f'{d}/w62-A.pxg', 'w').write('\n'.join(out) + '\n')
    open(f'{d}/w62-A.note', 'w').write(f'dining {k}: 몸통=dining 2x1 pilot-B(왼쪽 위 빛·앞 테 한 단 낮게·접지 그림자)를 {W}x{H}로 늘임/줄임, 16px 마다 결, 다리 양끝 ({"깊이2: 윗면 짜임 되풀이 " if deep else ""}work/w62-dining.py in candidates/dining_2x1/work)\n')
if __name__ == '__main__':
    for k in SZ: emit(k)
