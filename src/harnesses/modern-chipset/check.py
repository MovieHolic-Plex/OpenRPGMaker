"""후보 깨짐 검사(기계로 잴 수 있는 것만). 3/4 판정은 독립 검수자와 사용자가 눈으로 한다 — 여기서 시점을 수치로 대신하지 않는다.

  python3 check.py FILE.pxg --w 80 --h 48 --view side|front|back  →  FILE.check.json  (hard 하나라도 있으면 exit 1)
hard: size(캔버스) · bg(귀퉁이 투명) · mark(# 표시색 잔존) · outline(가장자리 90% 이상이 짙은 윤곽) · ground(맨 아래 접지) ·
      wheels(옆면: 바퀴 둘의 바닥이 ±1) · one(한 덩어리, 흩어진 점 6 이하) · sym(앞/뒤: 좌우 실루엣 대칭 90% 이상)
soft: 실루엣 높이/폭, 색 수, 윗면 밝은 단 화소 비율(참고 수치일 뿐 합격 기준 아님)
"""
import argparse, json, os, sys
import numpy as np
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'scripts/content/pixel-harness/pxgrid')))
import pxgrid  # noqa
from scipy import ndimage

def luma(c): return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]

def run(path, w, h, view):
    hard, soft = [], {}
    d, im = pxgrid.render(path)
    a = np.array(im)
    if (a.shape[1], a.shape[0]) != (w, h): hard.append(f'size: {a.shape[1]}x{a.shape[0]} (필요 {w}x{h})')
    solid = a[..., 3] >= 200            # 본체. 반투명(그림자)은 제외
    any_ = a[..., 3] > 0
    H, W = solid.shape
    corners = [any_[0, 0], any_[0, W - 1], any_[H - 1, 0], any_[H - 1, W - 1]]
    if sum(corners) > 1: hard.append('bg: 귀퉁이가 불투명 — 투명 배경이어야 한다')
    txt = open(os.path.splitext(path)[0] + '.txt', encoding='utf-8').read()
    if '#' in ''.join(l for l in txt.splitlines() if not l.startswith('//')): hard.append('mark: # 표시색이 남았다')
    if not solid.any(): hard.append('empty: 그림이 없다'); return finish(path, hard, soft)
    # 윤곽: 본체 가장자리(4-이웃에 투명이 있는 화소)가 짙어야 한다
    pad = np.pad(solid, 1)
    edge = solid & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
    ys, xs = np.nonzero(edge)
    dark = np.array([luma(a[y, x]) <= 78 for y, x in zip(ys, xs)])
    frac = dark.mean() if len(dark) else 0
    soft['outline_dark'] = round(float(frac), 3)
    if frac < .90: hard.append(f'outline: 가장자리 {frac:.0%} 만 짙다(90% 이상, 1px 짙은 윤곽)')
    # 접지
    rows = np.nonzero(solid.any(axis=1))[0]; bottom = rows.max(); top = rows.min()
    if bottom < H - 3: hard.append(f'ground: 맨 아래 불투명 줄 y={bottom} (캔버스 바닥 {H-1}, 3줄 안이어야 한다)')
    # 한 덩어리
    lab, n = ndimage.label(solid, structure=np.ones((3, 3)))
    sizes = ndimage.sum(solid, lab, range(1, n + 1)) if n else []
    stray = int(sum(1 for s in sizes if s < 3)); big = int(sum(1 for s in sizes if s >= 3))
    if stray > 6: hard.append(f'one: 흩어진 점 {stray}개(6 이하)')
    if big > 1 and view != 'side': hard.append(f'one: 덩어리 {big}개')
    # 바퀴(옆면): 바닥 줄 근처 가장 어두운 x/y 두 덩이
    if view == 'side':
        low = solid[max(bottom - 2, 0):bottom + 1].any(axis=0)
        runs = ndimage.label(low)[1]
        soft['bottom_runs'] = int(runs)
        if runs < 2: hard.append('wheels: 바닥 줄에 바퀴 둘이 보이지 않는다(접지 덩이 2개 이상 필요)')
    if view in ('front', 'back'):
        m = solid[:, ::-1]; inter = (solid & m).sum(); uni = (solid | m).sum()
        soft['sym'] = round(float(inter / uni), 3)
        if inter / uni < .90: hard.append(f'sym: 좌우 실루엣 대칭 {inter/uni:.0%} (90% 이상)')
    ww = np.nonzero(solid.any(axis=0))[0]; soft['silhouette'] = f'{ww.max()-ww.min()+1}x{bottom-top+1}'
    soft['aspect_h_over_w'] = round(float((bottom - top + 1) / (ww.max() - ww.min() + 1)), 3)
    soft['colors'] = int(len({tuple(p) for p in a[solid].tolist()}))
    return finish(path, hard, soft)

def finish(path, hard, soft):
    res = {'ok': not hard, 'hard': hard, 'soft': soft}
    json.dump(res, open(os.path.splitext(path)[0] + '.check.json', 'w'), ensure_ascii=False, indent=1)
    return res

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('pxg'); ap.add_argument('--w', type=int, required=True); ap.add_argument('--h', type=int, required=True)
    ap.add_argument('--view', required=True, choices=['side', 'front', 'back'])
    o = ap.parse_args(); r = run(o.pxg, o.w, o.h, o.view)
    print(('OK ' if r['ok'] else 'HARD ✗ ') + '; '.join(r['hard']) + f" | {r['soft']}"); sys.exit(0 if r['ok'] else 1)
