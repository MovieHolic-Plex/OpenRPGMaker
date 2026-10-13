#!/usr/bin/env python3
"""modern_campus 첫 묶음 — 교문·담장·벤치·자전거 거치대·자판기·화단·신발장·운동장 선. 설계: openwiki/modern-campus.md

jp_city 손 도트 규약을 따른다(modern3 램프 K(램프,단)·윤곽 OL=sumi, 빛 왼쪽 위, 3/4: 윗면 + 남쪽 앞면, 사람·글자·상표 없음).
jp_city 파일은 읽지도 고치지도 않는다 — 공용 그리개(atlas-pick/modern_style_bible_proof.py 의 K·Cv·RAMPS)만 빌린다.
  python3 scripts/content/modern-campus/campus_props.py     # selftest + tiledata/modern-campus/{_gate,preview}/
산출: _gate/mc-<id>.png (투명 배경, object-gate 에 낼 정본) · preview/_all-x4.png (눈 확인용).
"""
import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, os.path.join(HERE, '..', 'atlas-pick'))
import numpy as np                                        # noqa: E402
from PIL import Image                                     # noqa: E402
from modern_style_bible_proof import K, Cv, RAMPS         # noqa: E402

OUT = os.path.join(ROOT, 'tiledata', 'modern-campus')
OL = K('sumi', 0)
P = []    # dict(id, name, w, h, kind, draw, solid, tags, rules)


def prop(id_, name, w, h, kind, solid=(), tags=(), rules=''):
    def deco(fn):
        P.append(dict(id=id_, name=name, w=w, h=h, kind=kind, draw=fn, solid=list(solid), tags=list(tags), rules=rules)); return fn
    return deco


def cube(c, x, y, w, top, front, mat, tt=3, ft=0, sides=True, lip=True):
    """윗면 top 행 + 앞면 front 행 상자. 위쪽 뒷변 하이라이트, 앞면 왼쪽 빛/오른쪽 그늘/밑 그늘. sides=False 면 좌우 윤곽을 안 그린다(가로로 잇는 담)."""
    c.R(x, y, w, top, K(mat, tt)); c.HL(x, y, w, K(mat, tt + 1)); c.HL(x, y + top - 1, w, K(mat, tt - 1))
    c.R(x, y + top, w, front, K(mat, ft)); c.VL(x, y + top, front, K(mat, ft + 1)); c.VL(x + w - 1, y + top, front, K(mat, ft - 1))
    c.HL(x, y + top + front - 1, w, K(mat, ft - 2)); (c.HL(x, y + top, w, K(mat, ft - 2)) if lip else None)   # 앞면 맨 윗줄 그늘 = 윗면과 앞면을 가른다
    c.HL(x - (1 if sides else 0), y - 1, w + (2 if sides else 0), OL); c.HL(x - (1 if sides else 0), y + top + front, w + (2 if sides else 0), OL)
    if sides: c.VL(x - 1, y - 1, top + front + 2, OL); c.VL(x + w, y - 1, top + front + 2, OL)


def bricks(c, x, y, w, h, mat='renga'):
    """붉은 벽돌 앞면: 3행 코스, 코스 줄눈 -1, 세로 줄눈 엇갈림."""
    c.R(x, y, w, h, K(mat, 0))
    for j in range(0, h, 3):
        c.HL(x, y + j + 2, w, K(mat, -1)) if j + 2 < h else None
        if j + 1 < h: c.HL(x, y + j, w, K(mat, 1))
        for i in range(2 if (j // 3) % 2 else 6, w, 8):
            for k in range(2):
                if j + k < h: c.P(x + i, y + j + k, K(mat, -1))


def post(c, ox):
    """교문 기둥: 콘크리트 갓돌(윗면 4행) + 벽돌 몸통 + 콘크리트 받침."""
    cube(c, ox + 1, 2, 14, 6, 3, 'conc', tt=3, ft=-1)
    c.R(ox + 4, 12, 8, 2, K('conc', -2))                                  # 갓돌 밑 목(그림자 띠)
    bricks(c, ox + 3, 12, 10, 16)
    c.R(ox + 3, 12, 10, 1, K('renga', -2)); c.VL(ox + 3, 13, 15, K('renga', 2)); c.VL(ox + 12, 13, 15, K('renga', -2))
    c.VL(ox + 2, 12, 16, OL); c.VL(ox + 13, 12, 16, OL)
    cube(c, ox + 2, 27, 12, 1, 3, 'conc', tt=2, ft=-1)


@prop('gatepost', '교문 기둥(벽돌·콘크리트 갓돌)', 1, 2, 'column', solid=[(0, 1)], tags=['교문', '학교', '기둥'],
      rules='교문 개구부 양쪽, 담장과 같은 줄. 담장 fence 와 이어 쓴다.')
def _post(c): post(c, 0)


@prop('gate', '교문(벽돌 기둥 둘 + 철제 양개 문)', 4, 2, 'structure', solid=[(0, 1), (3, 1)], tags=['교문', '학교', '철문'],
      rules='학교 남쪽 담 한가운데 4칸. 가운데 두 칸은 닫힌 철문이다 — 등하교 길로 열어 두려면 문짝 칸을 비우고 gatepost 두 개만 쓴다.')
def _gate(c):
    post(c, 0); post(c, 48)
    for x0 in (16, 33):
        for sx in range(x0 + 1, x0 + 15, 3):                              # 창살 + 창끝
            c.VL(sx, 17, 8, K('tekko', 1)); c.P(sx, 8, K('tekko', 4)); c.VL(sx, 9, 8, K('tekko', 0))
        cube(c, x0, 11, 15, 4, 2, 'tekko', tt=2, ft=0, sides=False)         # 위 가로대 윗면 4행
        cube(c, x0, 23, 15, 3, 3, 'tekko', tt=2, ft=0, sides=False)         # 아래 가로대
        c.VL(x0, 9, 21, OL); c.VL(x0 + 14, 9, 21, OL)
    c.VL(31, 9, 21, K('sumi', 1)); c.VL(32, 9, 21, K('sumi', 1)); c.HL(16, 30, 32, K('conc', -1))


@prop('fence', '학교 담장 2칸(벽돌 기둥 + 벽돌 담 + 철제 울타리)', 2, 2, 'structure', solid=[(0, 1), (1, 1)], tags=['담', '학교', '울타리'],
      rules='학교 둘레를 가로로 잇는다(2칸 단위: 왼쪽 벽돌 기둥 + 담). 교문 gatepost 가 양쪽 끝.')
def _fence(c):
    post(c, 0)                                                                # 왼쪽 칸: 기둥
    x0 = 16
    for sx in range(x0 + 1, x0 + 15, 3):                                      # 철 창살(교문과 같은 처리)
        c.VL(sx, 17, 8, K('tekko', 1)); c.P(sx, 8, K('tekko', 4)); c.VL(sx, 9, 8, K('tekko', 0))
    cube(c, x0, 11, 16, 4, 2, 'tekko', tt=2, ft=0, sides=False)
    cube(c, x0, 23, 16, 3, 3, 'tekko', tt=2, ft=0, sides=False)
    c.R(x0, 28, 16, 1, K('conc', 0)); c.HL(x0, 29, 16, K('conc', -1)); c.HL(x0, 30, 16, OL)


@prop('bench', '교정 벤치(나무 판 + 철제 다리)', 2, 1, 'seat', solid=[(0, 0), (1, 0)], tags=['벤치', '교정', '의자'],
      rules='교정·화단 옆. 남쪽을 보는 벤치. 앉는 칸은 막힘.')
def _bench(c):
    cube(c, 2, 1, 28, 2, 2, 'ita', tt=2, ft=0)                               # 등받이(앞면 판 둘)
    c.HL(3, 2, 26, K('ita', -1))
    c.VL(2, 4, 3, K('tekko', 1)); c.VL(29, 4, 3, K('tekko', -1))
    cube(c, 1, 6, 30, 6, 2, 'ita', tt=3, ft=-2)                              # 앉는 판 윗면 6행
    c.HL(2, 8, 28, K('ita', 1)); c.HL(2, 10, 28, K('ita', 1))
    for lx in (3, 25):
        c.R(lx, 14, 3, 1, K('tekko', 0)); c.VL(lx, 14, 1, K('tekko', 2)); c.VL(lx + 2, 14, 1, OL); c.VL(lx - 1, 14, 1, OL)
    c.HL(2, 15, 28, K('yoru', -2))


@prop('bike-rack', '자전거 거치대(콘크리트 받침 + 철 고리 4)', 2, 1, 'frame', solid=[(0, 0), (1, 0)], tags=['자전거', '거치대', '학교'],
      rules='학교 본관 옆. 고리 사이로 자전거가 들어간다(자전거 소품은 거치대 위에).')
def _bike(c):
    cube(c, 1, 1, 30, 11, 3, 'conc', tt=3, ft=-1)                             # 콘크리트 받침 윗면 11행
    c.HL(2, 4, 28, K('conc', 4)); c.HL(2, 9, 28, K('conc', 4))
    for bx in (4, 11, 18, 25):                                                # 윗면에 눕힌 철 고리(위에서 본 U)
        c.R(bx, 3, 4, 7, K('tekko', 1)); c.R(bx + 1, 4, 2, 5, K('conc', 2))
        c.HL(bx, 3, 4, K('tekko', 4)); c.VL(bx, 3, 7, K('tekko', 3)); c.VL(bx + 3, 3, 7, K('tekko', -1)); c.HL(bx, 9, 4, K('tekko', -2))
    c.HL(2, 15, 28, K('yoru', -2))


@prop('vending', '자판기(글자 없음)', 1, 2, 'tall_furniture', solid=[(0, 1)], tags=['자판기', '교정', '소품'],
      rules='학교 현관·체육관 옆 벽 가까이. 앞 칸은 서서 쓰는 칸으로 비운다.')
def _vend(c):
    cube(c, 0, 1, 16, 9, 3, 'conc', tt=3, ft=-2)                              # 튀어나온 윗덮개: 몸통보다 넓은 윗면 9행 + 어두운 앞 테
    c.HL(2, 3, 12, K('conc', 4)); c.HL(2, 6, 12, K('conc', 4)); c.HL(1, 1, 14, K('conc', 1))
    c.HL(1, 13, 14, K('sumi', 1)); c.HL(1, 14, 14, K('sumi', 2))              # 덮개 밑 그림자
    c.R(2, 15, 12, 15, K('sora', 0)); c.VL(2, 15, 15, K('sora', 1)); c.VL(13, 15, 15, K('sora', -1))
    c.VL(1, 15, 16, OL); c.VL(14, 15, 16, OL); c.HL(1, 31, 14, OL)
    c.R(3, 16, 7, 7, K('garasu', -2)); c.HL(3, 16, 7, K('garasu', 1)); c.VL(3, 16, 7, OL); c.VL(9, 16, 7, K('sumi', 1)); c.HL(3, 23, 7, OL)
    cols = ('aka', 'kii', 'midori', 'daidai', 'sora', 'pinku')
    for r in range(2):
        for i in range(3): c.R(4 + i * 2, 17 + r * 3, 2, 2, K(cols[(r * 3 + i) % 6], 1))
    c.R(11, 16, 2, 4, K('conc', 1)); c.P(11, 17, K('aka', 1)); c.P(12, 17, K('midori', 1))
    c.R(3, 26, 8, 3, K('sumi', 2)); c.HL(3, 26, 8, K('sumi', 0)); c.HL(2, 29, 12, K('sora', -2))


@prop('flowerbed', '화단(벽돌 둘레 + 흙 + 꽃)', 2, 1, 'container', solid=[(0, 0), (1, 0)], tags=['화단', '교정', '꽃'],
      rules='본관 앞·교문 안쪽 길가. 꽃은 3/4 윗면(열린 흙).')
def _bed(c):
    cube(c, 1, 1, 30, 3, 0, 'conc', tt=2, ft=0, lip=False)
    c.R(1, 2, 30, 2, K('conc', 2)); c.HL(1, 1, 30, K('conc', 3))
    c.R(3, 3, 26, 8, K('soil', -1)); c.HL(3, 3, 26, K('soil', -2)); c.VL(3, 3, 8, K('soil', -2))
    for fx, col in ((5, 'pinku'), (10, 'kii'), (15, 'aka'), (20, 'pinku'), (25, 'kii')):
        c.R(fx - 1, 6, 3, 3, K('midori', 0)); c.P(fx - 1, 5, K('midori', 1)); c.P(fx + 1, 5, K('midori', 1)); c.HL(fx - 1, 8, 3, K('midori', -1))
        c.R(fx, 4, 2, 2, K(col, 1)); c.P(fx, 4, K(col, 3)); c.P(fx - 2, 8, K('soil', 1)); c.P(fx + 3, 9, K('soil', 1))
    c.R(1, 11, 30, 4, K('soil', 0)); c.R(1, 11, 30, 1, K('conc', 2))
    bricks(c, 1, 12, 30, 3)
    c.HL(1, 11, 30, K('conc', 2)); c.VL(1, 2, 13, OL); c.VL(30, 2, 13, OL); c.HL(1, 15, 30, OL)
    c.VL(2, 3, 12, K('conc', 3)); c.VL(29, 3, 12, K('conc', 0)); c.HL(1, 0, 30, OL)


@prop('shoe-locker', '신발장 줄(철제 4×3 칸)', 2, 2, 'tall_furniture', solid=[(0, 1), (1, 1)], tags=['신발장', '현관', '학교'],
      rules='교사 현관 안쪽 벽 앞. 이어 붙여 줄을 만든다.')
def _shoe(c):
    cube(c, 1, 2, 30, 8, 21, 'tekko', tt=3, ft=1, lip=False)
    c.HL(3, 5, 26, K('tekko', 4)); c.HL(3, 7, 26, K('tekko', 4))
    for r in range(3):
        for i in range(4):
            x0 = 3 + i * 7; y0 = 11 + r * 6
            c.R(x0, y0, 6, 5, K('yoru', -3)); c.HL(x0, y0, 6, K('sumi', 1))
            if (r + i * 2) % 3 != 1:
                c.R(x0 + 1, y0 + 3, 4, 2, K('shiro', 1) if (r + i) % 2 else K('sora', 1)); c.HL(x0 + 1, y0 + 3, 4, K('shiro', 3) if (r + i) % 2 else K('sora', 3))
    for i in range(5): c.VL(2 + i * 7 - (1 if i == 4 else 0), 10, 18, K('tekko', 3) if i == 0 else K('tekko', 0))
    c.HL(2, 28, 28, K('tekko', -2)); c.HL(1, 29, 30, K('yoru', -2))


@prop('field-line-h', '운동장 흰 선(가로)', 1, 1, 'flat', tags=['운동장', '선', '바닥'], rules='흙 운동장 위에 가로로 잇는다(1층 위 투명 덧그림).')
def _lh(c): c.HL(0, 7, 16, K('shiro', 3)); c.HL(0, 8, 16, K('shiro', 2))


@prop('field-line-corner', '운동장 흰 선(ㄱ 모서리 동→남)', 1, 1, 'flat', tags=['운동장', '선', '바닥'], rules='가로 선이 동쪽에서 와 남쪽으로 꺾이는 모서리.')
def _lc(c):
    c.HL(7, 7, 9, K('shiro', 3)); c.HL(7, 8, 9, K('shiro', 2)); c.VL(7, 9, 7, K('shiro', 3)); c.VL(8, 9, 7, K('shiro', 2))


# ─────────────────────────── 굽기·검사 ───────────────────────────
def render(p):
    c = Cv(p['w'] * 16, p['h'] * 16); p['draw'](c); return c.a


def palette_issues(a, tag):
    own = {c for r in RAMPS.values() for c in r}; out = []
    al = a[..., 3]
    if not np.all((al == 0) | (al == 255)): out.append('%s: 반투명 화소' % tag)
    for y in range(a.shape[0]):
        for x in range(a.shape[1]):
            if al[y, x] == 255:
                v = (int(a[y, x, 0]) << 16) | (int(a[y, x, 1]) << 8) | int(a[y, x, 2])
                if v not in own: out.append('%s: 팔레트 밖 #%06x @%d,%d' % (tag, v, x, y)); return out
                if v == 0xe040c0: out.append('%s: 마커색' % tag); return out
    return out


def export():
    os.makedirs(os.path.join(OUT, '_gate'), exist_ok=True); os.makedirs(os.path.join(OUT, 'preview'), exist_ok=True)
    ims = []; meta = []
    for p in P:
        a = render(p); im = Image.fromarray(a, 'RGBA'); path = os.path.join(OUT, '_gate', 'mc-%s.png' % p['id']); im.save(path)
        ims.append((p, im)); meta.append(dict(id='mc-' + p['id'], name=p['name'], kind=p['kind'], w=p['w'], h=p['h'], png=path))
    W = 560; x = y = rowh = 0; pos = []
    for p, im in ims:
        if x + im.width > W: x = 0; y += rowh + 8; rowh = 0
        pos.append((x, y)); x += im.width + 8; rowh = max(rowh, im.height)
    S = Image.new('RGBA', (W, y + rowh), (104, 103, 122, 255))
    for (p, im), pp in zip(ims, pos): S.alpha_composite(im, pp)
    S.resize((S.width * 4, S.height * 4), Image.NEAREST).save(os.path.join(OUT, 'preview', '_all-x4.png'))
    with open(os.path.join(OUT, '_gate', 'items.jsonl'), 'w') as f:
        for m in meta: f.write(json.dumps(dict(png=m['png'], kind=m['kind'], name=m['name'], label='modern-campus/' + m['id']), ensure_ascii=False) + '\n')
    return meta


def selftest():
    bad = []
    ids = [p['id'] for p in P]
    if len(ids) != len(set(ids)): bad.append('id 중복')
    for p in P:
        a = render(p); bad += palette_issues(a, p['id'])
        if a[..., 3].sum() == 0: bad.append('%s: 빈 그림' % p['id'])
        for (sx, sy) in p['solid']:
            if not a[sy * 16:(sy + 1) * 16, sx * 16:(sx + 1) * 16, 3].any(): bad.append('%s: 막힘 칸 (%d,%d) 빔' % (p['id'], sx, sy))
        if a[0].any() and p['kind'] != 'flat' and False: bad.append('%s: 윗줄 잘림' % p['id'])
    meta = export()
    print('modern_campus campus_props — 조각 %d' % len(meta))
    for m in bad: print('  x', m)
    return len(bad)


if __name__ == '__main__':
    sys.exit(1 if selftest() else 0)
