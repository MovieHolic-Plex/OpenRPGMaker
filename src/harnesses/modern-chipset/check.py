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


def building_style(a, soft, hard):
    """건물 화풍 계약(style-building.md): 바깥 윤곽은 사방 정확히 1px 짙은 선(바닥 줄 포함)."""
    H, W = a.shape[:2]; solid = a[..., 3] >= 200
    def runs(line):                      # 불투명이 시작하는 곳에서부터 연속 짙은 화소 수
        k = 0
        for px, al in line:
            if al < 200: continue
            if luma(px) <= 78: k += 1
            else: break
        return k
    L = []; R = []
    for y in range(H // 3, H - 4, 3):
        row = [(a[y, x], a[y, x, 3]) for x in range(W)]
        if any(al >= 200 for _, al in row): L.append(runs(row)); R.append(runs(row[::-1]))
    bottom = np.nonzero(solid.any(axis=1))[0].max()
    brow = [luma(a[bottom, x]) <= 78 for x in range(W) if solid[bottom, x]]
    soft['bottom_ink'] = round(float(np.mean(brow)), 3) if brow else 0
    soft['side_run'] = (int(np.median(L)) if L else -1, int(np.median(R)) if R else -1)
    if soft['bottom_ink'] < .70: hard.append(f'style-bottom: 맨 아래 줄이 짙은 윤곽이 아니다({soft["bottom_ink"]:.0%}, 90% 이상)')
    if L and (soft['side_run'][0] != 1 or soft['side_run'][1] != 1): hard.append(f'style-side: 좌우 바깥 윤곽 두께 {soft["side_run"]}px (정확히 1px)')


def run(path, w, h, view, kind='vehicle'):
    hard, soft = [], {}
    d, im = pxgrid.render(path)
    if kind == 'tilesheet': return run_tilesheet(path, w, h, im, hard, soft)
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
    if kind == 'building': building_style(a, soft, hard)
    # 접지
    rows = np.nonzero(solid.any(axis=1))[0]; bottom = rows.max(); top = rows.min()
    if bottom < H - 3: hard.append(f'ground: 맨 아래 불투명 줄 y={bottom} (캔버스 바닥 {H-1}, 3줄 안이어야 한다)')
    # 한 덩어리
    lab, n = ndimage.label(solid, structure=np.ones((3, 3)))
    sizes = ndimage.sum(solid, lab, range(1, n + 1)) if n else []
    stray = int(sum(1 for s in sizes if s < 3)); big = int(sum(1 for s in sizes if s >= 3))
    if stray > 6: hard.append(f'one: 흩어진 점 {stray}개(6 이하)')
    if big > 1 and kind == 'vehicle' and view != 'side': hard.append(f'one: 덩어리 {big}개')
    # 바퀴(옆면): 바닥 줄 근처 가장 어두운 x/y 두 덩이
    if view == 'side' and kind == 'vehicle':
        low = solid[max(bottom - 2, 0):bottom + 1].any(axis=0)
        runs = ndimage.label(low)[1]
        soft['bottom_runs'] = int(runs)
        if runs < 2: hard.append('wheels: 바닥 줄에 바퀴 둘이 보이지 않는다(접지 덩이 2개 이상 필요)')
    if view in ('front', 'back') and kind == 'vehicle':
        m = solid[:, ::-1]; inter = (solid & m).sum(); uni = (solid | m).sum()
        soft['sym'] = round(float(inter / uni), 3)
        if inter / uni < .90: hard.append(f'sym: 좌우 실루엣 대칭 {inter/uni:.0%} (90% 이상)')
    ww = np.nonzero(solid.any(axis=0))[0]; soft['silhouette'] = f'{ww.max()-ww.min()+1}x{bottom-top+1}'
    soft['aspect_h_over_w'] = round(float((bottom - top + 1) / (ww.max() - ww.min() + 1)), 3)
    soft['colors'] = int(len({tuple(p) for p in a[solid].tolist()}))
    return finish(path, hard, soft)

SEAMLESS = []


def run_tilesheet(path, w, h, im, hard, soft):
    """16px 타일: 꽉 찬 불투명 + 반대편 가장자리와 이어짐(좌우·상하). 이음 차이가 내부 인접 차이의 2배 넘으면 불합격."""
    a = np.array(im).astype(int)
    if (a.shape[1], a.shape[0]) != (w, h): hard.append(f'size: {a.shape[1]}x{a.shape[0]} (필요 {w}x{h})')
    if (a[..., 3] < 255).any(): hard.append('opaque: 타일에 투명/반투명 화소가 있다(꽉 차야 한다)')
    rgb = a[..., :3]; cols = w // 16
    for idx in SEAMLESS:
        cx, cy = (idx % cols) * 16, (idx // cols) * 16
        t = rgb[cy:cy + 16, cx:cx + 16]
        inner_h = np.abs(t[:, 1:] - t[:, :-1]).sum(axis=2).mean(); inner_v = np.abs(t[1:] - t[:-1]).sum(axis=2).mean()
        seam_h = np.abs(t[:, 0] - t[:, -1]).sum(axis=1).mean(); seam_v = np.abs(t[0] - t[-1]).sum(axis=1).mean()
        soft[f't{idx}'] = f'in{inner_h:.0f}/{inner_v:.0f} seam{seam_h:.0f}/{seam_v:.0f}'
        if seam_h > inner_h * 2 + 8: hard.append(f'seam: 칸 {idx} 좌우 이음 {seam_h:.0f} > 내부 {inner_h:.0f}×2')
        if seam_v > inner_v * 2 + 8: hard.append(f'seam: 칸 {idx} 상하 이음 {seam_v:.0f} > 내부 {inner_v:.0f}×2')
    soft['colors'] = int(len({tuple(p) for p in rgb.reshape(-1, 3).tolist()}))
    return finish(path, hard, soft)


def finish(path, hard, soft):
    res = {'ok': not hard, 'hard': hard, 'soft': soft}
    json.dump(res, open(os.path.splitext(path)[0] + '.check.json', 'w'), ensure_ascii=False, indent=1)
    return res

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('pxg'); ap.add_argument('--w', type=int, required=True); ap.add_argument('--h', type=int, required=True)
    ap.add_argument('--view', required=True); ap.add_argument('--kind', default='vehicle', choices=['vehicle', 'prop', 'building', 'tilesheet']); ap.add_argument('--seamless', default='')
    o = ap.parse_args(); SEAMLESS[:] = [int(x) for x in o.seamless.split(',') if x]; r = run(o.pxg, o.w, o.h, o.view, o.kind)
    print(('OK ' if r['ok'] else 'HARD ✗ ') + '; '.join(r['hard']) + f" | {r['soft']}"); sys.exit(0 if r['ok'] else 1)
