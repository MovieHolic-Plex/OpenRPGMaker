#!/usr/bin/env python3
"""선 문법 측정 — 외곽 테두리·안쪽 선의 두께와 색을 화소로 잰다(2026-10-02, 사용자 「선의 두께도 그렇고, 외곽선도 그렇고」).

「어두운 단 = 선」으로 재면 검은 재료 면(석탄·초상화 배경·선반 안)이 전부 선으로 잡힌다(실측). 그래서 선은 **양옆보다 어두운 골**로,
외곽은 **바깥(투명) 바로 안쪽에서 안으로 걸어가며 밝아지는 데까지**로 정의한다.

항목(전부 「높을수록 나쁨」):
  o_thick   외곽 표본 중 두께 2칸 이상(바닥에 닿는 아래 테는 뺀다)
  o_melt    외곽이 몸통에 묻힘: 안으로 4칸 걸어도 밝아지지 않는다(검은 몸통에 검은 테)
  o_none    외곽이 안쪽보다 어둡지 않다(테두리 없음·연한 테)
  o_foreign 외곽 색이 안쪽 재료와 다른 계열(검정·회색 테를 색 있는 재료에 둘렀다)
  light_inv 아래·오른 테가 위·왼 테보다 밝다(빛이 왼쪽 위라는 규칙의 역)
  l_thick   안쪽 선(양옆보다 어두운 골) 화소 중 폭 2칸 이상
  python3 scripts/content/hand-interior-pick/line_metrics.py A.png [B.png …]   # 수치 출력
"""
import colorsys, json, sys
from PIL import Image, ImageDraw

D4 = ((1, 0), (-1, 0), (0, 1), (0, -1))
DARKER = 14     # 외곽·골: 이웃보다 이만큼 어두우면 「어둡다」
SAME = 12       # 같은 테(띠) 안: 밝기 차가 이 안
MAXW = 4        # 이보다 넓은 어두운 띠는 선이 아니라 면


def luma(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def load(path):
    im = Image.open(path).convert('RGBA')
    W, H = im.size; px = im.load()
    P = {(x, y): px[x, y] for y in range(H) for x in range(W) if px[x, y][3] >= 128}
    return im, P


def measure(path, marks=False):
    im, P = load(path)
    if len(P) < 20: return None
    L = {p: luma(c) for p, c in P.items()}
    hsv = {p: colorsys.rgb_to_hsv(*(v / 255 for v in c[:3])) for p, c in P.items()}
    bottom = max(y for _, y in P)
    dark_cut = sorted(L.values())[len(L) // 3]   # 물건 밝기 아래 ⅓
    edge = {p for p in P if any((p[0] + a, p[1] + b) not in P for a, b in D4)}
    M = dict(thick=set(), melt=set(), none=set(), foreign=set(), lthick=set(), line=set(), outline=set())
    n_o = 0; tl = []; br = []; C = dict(thick=0, melt=0, none=0, foreign=0)
    for e in edge:
        for a, b in D4:
            if (e[0] + a, e[1] + b) in P: continue
            if b == 1 and e[1] >= bottom - 1: continue   # 바닥에 닿는 아래 테는 두께·빛에서 뺀다
            (tl if (a, b) in ((0, -1), (-1, 0)) else br).append(L[e])
            run = [e]; q = (e[0] - a, e[1] - b)
            while q in P and L[q] <= L[e] + SAME and len(run) <= MAXW: run.append(q); q = (q[0] - a, q[1] - b)
            if q not in P:                       # 반대편 바깥까지 이어진 얇은 부재(다리·막대) — 두께를 잴 수 없다
                continue
            n_o += 1
            if len(run) > MAXW:                  # 안으로 4칸 넘게 같은 밝기: 어두운 테면 몸통에 묻힌 것, 아니면 테 없음
                if L[e] <= dark_cut: M['melt'].update(run); C['melt'] += 1
                else: M['none'].add(e); C['none'] += 1
                continue
            if L[q] < L[e] + DARKER:             # 안쪽이 테보다 뚜렷이 밝지 않다(더 어둡다) = 테 없음·밝은 테
                M['none'].add(e); C['none'] += 1; continue
            M['outline'].update(run)
            if len(run) >= 2: M['thick'].update(run); C['thick'] += 1
            hi, ho = hsv[q], hsv[e]
            if hi[1] > 0.25:                     # 색 있는 재료에 둘린 테가 무채색이거나 색상이 다르다
                dh = abs(hi[0] - ho[0]); dh = min(dh, 1 - dh)
                if ho[1] < 0.15 or dh > 0.09: M['foreign'].add(e); C['foreign'] += 1
    # 안쪽 골: 가로 또는 세로로 양옆보다 어두운 MAXW 칸 이하 띠
    for p in P:
        if p in edge: continue
        best = None
        for dx, dy in ((1, 0), (0, 1)):
            run = [p]
            for s in (1, -1):
                q = (p[0] + s * dx, p[1] + s * dy)
                while q in P and abs(L[q] - L[p]) <= SAME and len(run) <= MAXW: run.append(q); q = (q[0] + s * dx, q[1] + s * dy)
                if q not in P or L[q] < L[p] + DARKER: run = None; break
            if run and len(run) <= MAXW: best = len(run) if best is None else min(best, len(run))
        if best is not None:
            M['line'].add(p)
            if best >= 2: M['lthick'].add(p)
    lit = (sum(tl) / len(tl) - sum(br) / len(br)) if tl and br else 0
    span = (max(L.values()) - min(L.values())) or 1
    nl = len(M['line'])
    r = dict(o_thick=C['thick'] / max(1, n_o), o_melt=C['melt'] / max(1, n_o), o_none=C['none'] / max(1, n_o), o_foreign=C['foreign'] / max(1, n_o), light_inv=-lit / span, l_thick=len(M['lthick']) / max(1, nl),
             n=len(P), n_outline=n_o, n_line=nl)
    return (r, im, M) if marks else r


COL = dict(thick=(255, 40, 40, 190), melt=(255, 150, 0, 190), none=(60, 200, 255, 200), foreign=(255, 255, 0, 200), lthick=(255, 0, 230, 170))


def overlay(path, S=6):
    """원본 S배 | 표시 S배 나란히. 빨강 = 두꺼운 외곽, 주황 = 몸통에 묻힌 외곽, 하늘 = 테 없음, 노랑 = 다른 색 테, 분홍 = 굵은 안쪽 선."""
    r, im, M = measure(path, marks=True)
    W, H = im.size
    a = im.resize((W * S, H * S), Image.NEAREST); o = a.copy(); d = ImageDraw.Draw(o, 'RGBA')
    for k in ('lthick', 'melt', 'thick', 'none', 'foreign'):
        for (x, y) in M[k]: d.rectangle([x * S, y * S, x * S + S - 1, y * S + S - 1], fill=COL[k])
    c = Image.new('RGBA', (W * S * 2 + 6, H * S), (143, 127, 102, 255))
    c.alpha_composite(a, (0, 0)); c.alpha_composite(o, (W * S + 6, 0))
    return r, c


if __name__ == '__main__':
    for f in sys.argv[1:]:
        print(f, json.dumps({k: round(v, 3) for k, v in measure(f).items()}, ensure_ascii=False))
