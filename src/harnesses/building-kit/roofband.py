"""building-kit 지붕 비율 밴드 — 버들항 기준 건물에서 지붕 높이·용마루 비율을 **재서** 만든다.

사용자 반려(2026-10-22, fantasy style-r3): 「지붕이 너무 … 머리가 길다」 — 지붕이 뾰족한 피라미드였다.
비율을 손으로 적지 않고 아래 두 기준 그림에서 매번 다시 잰다(그림이 바뀌면 밴드도 따라 바뀐다).

  bd-house-h101_0  살림집(모임지붕, 1층) — **본채만** 자른다(오른쪽 낮은 날개는 잘라 낸다)
  bd-house-inn     여관(모임지붕, 2층) — 8칸 전부

재는 법(화소만, 칸 격자 가정 없음):
  crop 안 불투명 행의 맨 위(top)~맨 아래(bottom), 행마다 폭(불투명 화소 수).
  처마(eave) = 그 폭의 최댓값이 **마지막으로** 나오는 행. 벽은 지붕보다 안쪽(`inset`)이라 그 아래는 폭이 줄어든다.
  지붕 높이(roof) = eave - top + 1 · 전체(total) = bottom - top + 1 · 비율 = roof / total.
  용마루(ridge) = 맨 윗행의 가장 긴 불투명 연속 구간 · 비율 = ridge / 처마 폭.

밴드 = 기준의 최솟값·최댓값 ± MARGIN. 실측(2026-10-22): h101 지붕 44px/76px = 0.58, 용마루 35/80 = 0.44 ·
inn 지붕 44px/108px = 0.41, 용마루 50/128 = 0.39 → 비율 밴드 0.37~0.62, 용마루 하한 0.35.

이 파일은 그림을 읽는다(beodeul.kit) — 그래서 그리기 에이전트가 쓰는 `dot` 에는 없다. 재는 쪽은 하네스뿐이다.
"""
import numpy as np

import beodeul
import dot

MARGIN = 0.04

# 기준 그림 — crop = (x0, y0, x1, y1) 칸, x1·y1 미만. 지붕 종류 kind: hip(모임)·gable(박공).
REFS = (
    {'kit': 'bd-house-h101_0', 'crop': (0, 1, 5, 6), 'kind': 'hip',
     'why': '살림집 본채 5칸 — 모임지붕 1층. 오른쪽 날개는 잘라 낸다'},
    {'kit': 'bd-house-inn', 'crop': (0, 1, 8, 8), 'kind': 'hip',
     'why': '여관 8칸 — 모임지붕 2층'},
)

_CACHE = {}

def _runs(row):
    idx = np.nonzero(row)[0]
    if not len(idx):
        return []
    out, start, prev = [], int(idx[0]), int(idx[0])
    for x in idx[1:]:
        x = int(x)
        if x != prev + 1:
            out.append((start, prev))
            start = x
        prev = x
    out.append((start, prev))
    return out

def measure(im, crop=None):
    """그림 하나에서 지붕 비율을 잰다. crop 은 (x0, y0, x1, y1) 칸(없으면 그림 전체)."""
    a = np.array(im.convert('RGBA'))
    op = a[:, :, 3] == 255
    if crop:
        x0, y0, x1, y1 = (int(c) * dot.T for c in crop)
        op = op[y0:y1, x0:x1]
    rows = np.nonzero(op.any(axis=1))[0]
    if not len(rows):
        raise ValueError('불투명 화소가 없다 — 빈 그림이다')
    top, bottom = int(rows.min()), int(rows.max())
    width = op.sum(axis=1)
    peak = int(width[top:bottom + 1].max())
    eave = max(y for y in range(top, bottom + 1) if width[y] == peak)
    roof = eave - top + 1
    total = bottom - top + 1
    runs = _runs(op[top])
    ridge = max((b - a2 + 1) for a2, b in runs) if runs else 0
    eave_w = int(peak)
    return {'top': top, 'bottom': bottom, 'eave': eave, 'roof': roof, 'total': total,
            'ratio': round(roof / total, 3), 'ridge': ridge, 'eave_w': eave_w,
            'ridge_frac': round(ridge / max(eave_w, 1), 3)}

def refs():
    """기준 그림 실측(캐시). 그림이 바뀌면 다시 잰다 — 손으로 적은 수가 아니다."""
    if 'refs' not in _CACHE:
        out = []
        for r in REFS:
            m = measure(beodeul.kit(r['kit']).img(), r['crop'])
            m.update(kit=r['kit'], kind=r['kind'], crop=list(r['crop']), why=r['why'])
            out.append(m)
        _CACHE['refs'] = out
    return _CACHE['refs']

def band():
    """기준의 모임·박공 지붕에서 뽑은 밴드. 비율 하한·상한과 용마루 하한(처마 폭 대비)."""
    if 'band' not in _CACHE:
        rs = [r for r in refs() if r['kind'] in ('hip', 'gable')]
        if not rs:
            raise SystemExit('지붕 밴드를 잴 기준 그림이 없다 — roofband.REFS')
        _CACHE['band'] = {
            'ratio_min': round(min(r['ratio'] for r in rs) - MARGIN, 3),
            'ratio_max': round(max(r['ratio'] for r in rs) + MARGIN, 3),
            'ridge_min': round(min(r['ridge_frac'] for r in rs) - MARGIN, 3),
            'margin': MARGIN,
            'refs': rs,
        }
    return _CACHE['band']

def clear():
    _CACHE.clear()
