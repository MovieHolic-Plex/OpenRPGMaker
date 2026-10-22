#!/usr/bin/env python3
"""jp_city 블록 `jp_regions_pack` - 일본 30 지역(상점가 밖: 신사·사찰·성·유적·산길·계곡·습원·폐선·온천·다랑논·항구·해변·시골 간이역) 손 도트 팩.

2026-10-18 사용자: 「이건 약간 '상점가' 고 다른 지역들도 많을거같은데 ... 학교, 주거지, 등산로, 유적지 ... 한 30가지 쯤 생각해바」.
2026-10-18 사용자(21:08): 「새로 만든 칩들의 화풍이 들쭉날쭉이구나. 애초에 화풍을 고정하고 만들었어야지 .. 그리고 탑 3/4 뷰는 왜 안지키는거지 ? jp_city 타일셋 기준으로 화풍이 맞게해라.」
지역 목록·조합 규칙은 src/editor/jpCity/japaneseRegionsCatalog.ts, 이 팩은 그 지역에 없던 부품만 그린다:
  바닥(fill_region 재료): 모래사장·바다·논·산길 흙·숲 바닥·나무 데크·온천가 돌길·습원·폐선 선로.
  키트: 대숲·삼나무·곰솔·단풍·石垣·天守·露天風呂·湯けむり·폭포·출렁다리·석조 유적·이끼 석불·종루·등대·어선·해바라기·
        로프웨이 역·산장·폐선 터널·허수아비·볏단 걸이(はざ掛け)·축제 포장마차·이정표·약수터·무인역 대합실·테트라포드.
화풍 고정 규칙(jp_city 본편 건물·가로수·신사 기물과 완전히 일치):
  - 모든 독립 키트는 1px 짙은 먹색 외곽선(OL)과 접지 그림자(바닥 어두운 테/기단)를 갖는다.
  - 모든 구조물·소품은 3/4 탑뷰(윗면 + 정면): 지붕 경사면/윗면 데크/돌담 윗길/욕조 테두리 윗면/선체 갑판 윗면/터널 상부 둑 윗면/유적 기단 윗면이 반드시 보인다.
  - 색은 src/editor/jpCity/paletteContract.ts 의 일본 로케일 계약 색(J(재료, 단 0~4)) + modern3 sumi/yoru 윤곽만 쓴다.
  - 빛은 왼쪽 위, 그림자는 오른쪽 아래, 반투명 없음, 지저분한 노이즈 점 대신 깨끗한 클러스터 명암을 쓴다.

  python3 scripts/content/jp-city/blocks/jp_regions_pack.py [OUT_DIR]   # selftest + 키트·바닥 미리보기(1x, 2x)
"""
import collections, json, math, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'houses')); sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..'))
import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402
from house_kit import K, Cv, OL  # noqa: E402
from shitamachi_pack import H, disc, line  # noqa: E402

BLOCK = 'jp_regions_pack'
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
OUTDIR = os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks', BLOCK)
_CONTRACT = json.load(open(os.path.join(ROOT, 'tiledata', 'jp-city', 'palette-contract.json'), encoding='utf-8'))
_RAMP = {m['id']: [int(h[1:], 16) for h in m['steps']] for f in _CONTRACT['families'] for m in f['materials']}
SHADE = K('yoru', -1)


def J(mat, s):
    """계약 재료 mat 의 단 s(0 깊은 그늘 … 4 하이라이트). 범위를 넘으면 끝 단."""
    r = _RAMP[mat]
    return r[max(0, min(4, s))]


# ═══════════════════════════ 공통 3/4 도트 부품 (jp_city 표준) ═══════════════════════════
def add_outline(c, x0=0, y0=0, x1=None, y1=None, skip_bottom=False):
    """그려진 불투명 픽셀 둘레에 1px 짙은 윤곽(OL)을 두른다(jp_city ink2 와 동일한 실루엣 결속)."""
    if x1 is None: x1 = c.w
    if y1 is None: y1 = c.h
    al = c.a[y0:y1, x0:x1, 3] > 0
    h, w = al.shape
    for j in range(h):
        for i in range(w):
            if al[j, i]: continue
            if skip_bottom and j == h - 1: continue
            nb = False
            for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                nj, ni = j + dy, i + dx
                if 0 <= nj < h and 0 <= ni < w and al[nj, ni]:
                    nb = True; break
            if nb:
                c.P(x0 + i, y0 + j, OL)


def rect_3d(c, x, y, w, h, top_h, mat, top_t=3, front_t=2):
    """3/4 직육면체: 밝은 윗면(top_h px) + 정면(h - top_h px) + 모서리 하이라이트 + 외곽선."""
    c.R(x, y, w, h, OL)
    if top_h > 0:
        c.R(x + 1, y + 1, w - 2, top_h, J(mat, top_t))
        c.HL(x + 1, y + 1, w - 2, J(mat, min(4, top_t + 1)))
        c.HL(x + 1, y + top_h, w - 2, J(mat, max(0, top_t - 1)))
    fy = y + 1 + top_h
    fh = h - 2 - top_h
    if fh > 0:
        c.R(x + 1, fy, w - 2, fh, J(mat, front_t))
        c.VL(x + 1, fy, fh, J(mat, min(4, front_t + 1)))
        c.VL(x + w - 2, fy, fh, J(mat, max(0, front_t - 1)))
        c.HL(x + 1, y + h - 2, w - 2, J(mat, max(0, front_t - 2)))


def plinth_34(c, x, y, w, h=10, top_h=4, mat='shrine_flagstone'):
    """jp_city 신사/사찰 표준 3/4 석조 기단: 넓은 판석 윗면(top_h px) + 정면 돌 줄눈 + 접지 어두운 단."""
    c.R(x, y, w, h, OL)
    c.R(x + 1, y + 1, w - 2, top_h, J(mat, 3))
    c.HL(x + 1, y + 1, w - 2, J(mat, 4))
    for sx in range(x + 10, x + w - 4, 12):
        c.VL(sx, y + 1, top_h, J(mat, 2))
    c.HL(x + 1, y + top_h, w - 2, J(mat, 4))
    fy = y + 1 + top_h
    fh = h - 2 - top_h
    if fh > 0:
        c.R(x + 1, fy, w - 2, fh, J(mat, 2))
        c.VL(x + 1, fy, fh, J(mat, 3))
        c.VL(x + w - 2, fy, fh, J(mat, 1))
        c.HL(x + 1, y + h - 2, w - 2, J(mat, 0))
        for sx in range(x + 8, x + w - 4, 12):
            c.VL(sx, fy, fh, J(mat, 1))


def canopy_clusters(c, blobs, mat, seed=0):
    """jp_city 가로수·느티나무 표준 5단 클러스터 수관 + 1px 외곽선(OL).
    지저분한 노이즈 대신 둥근 잎 덩이마다 오른쪽 아래 깊은 그늘 -> 몸통 -> 중간 -> 왼쪽 위 밝은 면 -> 하이라이트."""
    t = Cv(c.w, c.h)
    for bx, by, rx, ry in blobs:
        disc(t, bx + 1.5, by + 2.0, rx, J(mat, 0), ry=ry)
    for bx, by, rx, ry in blobs:
        disc(t, bx, by, rx, J(mat, 1), ry=ry)
    for bx, by, rx, ry in blobs:
        disc(t, bx - 0.8, by - 0.8, max(2.0, rx - 1.5), J(mat, 2), ry=max(2.0, ry - 1.2))
    for bx, by, rx, ry in blobs:
        disc(t, bx - rx * 0.22 - 0.8, by - ry * 0.22 - 0.8, max(1.8, rx * 0.62), J(mat, 3), ry=max(1.8, ry * 0.62))
    for bx, by, rx, ry in blobs:
        disc(t, bx - rx * 0.34 - 1.0, by - ry * 0.34 - 1.0, max(1.2, rx * 0.32), J(mat, 4), ry=max(1.2, ry * 0.32))
    # 덩이 경계에 작은 잎결 클러스터(2x1)만 절제해서 찍는다
    for k, (bx, by, rx, ry) in enumerate(blobs):
        for a in range(5):
            ang = (a * 1.25 + k * 0.7)
            px = int(round(bx + math.cos(ang) * (rx * 0.72)))
            py = int(round(by + math.sin(ang) * (ry * 0.72)))
            lv = 3 if math.cos(ang) + math.sin(ang) < -0.2 else 1
            if 1 <= px < c.w - 2 and 1 <= py < c.h - 2 and t.a[py, px, 3]:
                t.P(px, py, J(mat, lv)); t.P(px + 1, py, J(mat, lv))
    add_outline(t)
    for y in range(c.h):
        for x in range(c.w):
            if t.a[y, x, 3]:
                c.P(x, y, (int(t.a[y, x, 0]) << 16) | (int(t.a[y, x, 1]) << 8) | int(t.a[y, x, 2]))


def trunk_34(c, x, y, w, h, mat='aged_cedar', t=2):
    """윤곽선(OL)이 있는 나무 줄기 + 뿌리 벌어진 밑동."""
    c.R(x - 1, y, w + 2, h, OL)
    c.R(x, y, w, h, J(mat, t))
    c.VL(x, y, h, J(mat, min(4, t + 1)))
    if w >= 4:
        c.VL(x + 1, y, h, J(mat, min(4, t + 1)))
    c.VL(x + w - 1, y, h, J(mat, max(0, t - 1)))
    for k in range(3, h - 2, 5):
        c.HL(x + 1, y + k, max(1, w - 2), J(mat, max(0, t - 1)))
    # 뿌리 밑동
    c.R(x - 2, y + h - 3, w + 4, 3, OL)
    c.R(x - 1, y + h - 3, w + 2, 2, J(mat, t))
    c.HL(x - 1, y + h - 3, w + 2, J(mat, min(4, t + 1)))


def stones(c, x0, y0, w, h, mat='shrine_flagstone', seed=0, course=(6, 8), width=(9, 15), moss=0.0, inside=None):
    """다듬은 성벽/석축 돌 쌓기: 줄마다 높이, 돌마다 위·왼 밝은 턱, 아래·오른 어두운 턱, 줄눈 0단."""
    y = y0; row = 0
    while y < y0 + h:
        ch = course[0] + int(H(row, 7, seed) * (course[1] - course[0] + 1))
        x = x0 - int(H(row, 3, seed) * 5); k = 0
        while x < x0 + w:
            sw = width[0] + int(H(row, k, seed + 1) * (width[1] - width[0] + 1))
            tone = 2 + (1 if H(row, k, seed + 2) > 0.65 else 0) - (1 if H(row, k, seed + 3) > 0.8 else 0)
            mossy = H(row, k, seed + 4) < moss
            for j in range(ch):
                for i in range(sw):
                    px, py = x + i, y + j
                    if not (x0 <= px < x0 + w and y0 <= py < y0 + h): continue
                    if inside is not None and not inside(px, py): continue
                    if i == sw - 1 or j == ch - 1: col = J(mat, 0)
                    elif j == 0 or i == 0: col = J(mat, min(4, tone + 1))
                    elif j == ch - 2 or i == sw - 2: col = J(mat, max(0, tone - 1))
                    else: col = J(mat, tone)
                    if mossy and 0 < j < ch - 2 and 0 < i < sw - 2 and (j <= 2 or H(px // 2, py // 2, seed + 5) < 0.45):
                        col = J('moss', 3 if j == 1 else 2)
                    c.P(px, py, col)
            x += sw; k += 1
        y += ch; row += 1


def kawara_roof_34(c, x0, x1, y0, y1, flare=4, mat='kawara_dark_tile', ridge_ornament=False):
    """jp_city 사찰·성곽 표준 3/4 기와 지붕:
    - 두꺼운 용마루(4px: OL + 밝은 단 + 중간 단 + 어두운 단)와 양끝 치미/마구리
    - 경사 기와면: 3px 주기 세로 기와 골 + 4px 주기 가로 기와 단, 위쪽 밝고 처마 쪽 한 단 깊어짐
    - 처마 끝 막새 밝은 줄 + OL + 처마 밑 두공/그림자 줄."""
    w = x1 - x0
    hgt = y1 - y0
    taper = max(2, int(hgt * 0.42))
    # 지붕 경사 몸통
    for j in range(3, hgt - 2):
        y = y0 + j
        f = (j - 3) / max(1, hgt - 6)
        ins = max(0, round((1.0 - f) * taper))
        fl = max(0, j - (hgt - 3 - flare))
        xs, xe = x0 + ins - fl, x1 - ins + fl
        c.P(xs - 1, y, OL); c.P(xe, y, OL)
        for x in range(xs, xe):
            k = (x - xs) % 3
            base_t = 3 if f < 0.52 else 2
            tt = base_t + (1 if k == 0 else -1 if k == 2 else 0)
            if j % 4 == 3: tt -= 1
            if x - xs < 2: tt = min(4, tt + 1)
            elif xe - x <= 2: tt = max(0, tt - 1)
            c.P(x, y, J(mat, tt))
    # 용마루 (3/4 윗면 두께)
    rx0, rx1 = x0 + taper - 1, x1 - taper + 1
    rw = max(4, rx1 - rx0)
    c.HL(rx0, y0, rw, OL)
    c.HL(rx0, y0 + 1, rw, J(mat, 4))
    c.HL(rx0, y0 + 2, rw, J(mat, 2))
    c.HL(rx0, y0 + 3, rw, J(mat, 0))
    for rx in range(rx0 + 3, rx1 - 2, 4):
        c.P(rx, y0 + 1, J(mat, 3))
    c.VL(rx0 - 1, y0, 4, OL); c.VL(rx1, y0, 4, OL)
    if ridge_ornament:
        for ox in (rx0, rx1 - 2):
            c.R(ox, y0 - 2, 2, 3, J(mat, 3)); c.P(ox, y0 - 2, J(mat, 4))
    # 처마 막새 줄 + 턱 + 그림자
    ex0, ex1 = x0 - flare, x1 + flare
    ew = ex1 - ex0
    c.HL(ex0, y1 - 3, ew, J(mat, 3))
    for x in range(ex0 + 1, ex1 - 1, 3):
        c.P(x, y1 - 3, J(mat, 4))
    c.HL(ex0, y1 - 2, ew, J(mat, 1))
    c.HL(ex0, y1 - 1, ew, OL)
    c.VL(ex0 - 1, y1 - 3, 3, OL); c.VL(ex1, y1 - 3, 3, OL)


def hip_metal_roof_34(c, x0, y0, w, h, mat='noren_rust', ridge_mat='kawara_dark_tile'):
    """3/4 우진각/박공 함석 지붕(산장·무인역·로프웨이 부속): 용마루 윗면 + 세로 이음 골 + 가로 판 겹침 + 처마 두께."""
    taper = max(2, h // 3)
    for j in range(3, h - 3):
        y = y0 + j
        ins = max(0, round((1.0 - (j - 3) / max(1, h - 7)) * taper))
        xs, xe = x0 + ins, x0 + w - ins
        c.P(xs - 1, y, OL); c.P(xe, y, OL)
        for x in range(xs, xe):
            k = (x - x0) % 4
            tt = 3 if j < h // 2 else 2
            if k == 0: tt = min(4, tt + 1)
            elif k == 3: tt = max(0, tt - 1)
            if j == h // 2: tt = max(0, tt - 1)
            c.P(x, y, J(mat, tt))
    rx0, rx1 = x0 + taper, x0 + w - taper
    c.HL(rx0 - 1, y0, rx1 - rx0 + 2, OL)
    c.HL(rx0, y0 + 1, rx1 - rx0, J(ridge_mat, 4))
    c.HL(rx0, y0 + 2, rx1 - rx0, J(ridge_mat, 2))
    c.VL(rx0 - 1, y0 + 1, 2, OL); c.VL(rx1, y0 + 1, 2, OL)
    # 처마 앞 두께 3px
    c.HL(x0, y0 + h - 3, w, J(mat, 4))
    c.HL(x0, y0 + h - 2, w, J(mat, 1))
    c.HL(x0, y0 + h - 1, w, OL)
    c.VL(x0 - 1, y0 + h - 3, 3, OL); c.VL(x0 + w, y0 + h - 3, 3, OL)


def plaster_wall(c, x0, y0, w, h, seed=0):
    c.HL(x0, y0, w, J('cream_stucco', 1))
    for y in range(y0 + 1, y0 + h):
        for x in range(x0, x0 + w):
            lv = 3 + (1 if x <= x0 + 1 else 0) - (1 if x >= x0 + w - 2 else 0) - (1 if H(x // 2, y // 2, seed) > 0.92 else 0)
            c.P(x, y, J('cream_stucco', lv))
    c.VL(x0 - 1, y0, h, OL); c.VL(x0 + w, y0, h, OL)


def boards(c, x0, y0, w, h, mat='machiya_timber', t=2, bw=4, seed=0):
    """세로 판자벽(下見板) + 좌우 외곽선."""
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            k = (x - x0) % bw
            lv = t + (1 if k == 0 else -1 if k == bw - 1 else 0)
            if y == y0: lv = max(0, lv - 1)
            c.P(x, y, J(mat, lv))
    c.VL(x0 - 1, y0, h, OL); c.VL(x0 + w, y0, h, OL)


def window_slot(c, x, y, w, h):
    c.R(x - 1, y - 1, w + 2, h + 2, OL)
    c.R(x, y, w, h, J('machiya_timber', 0))
    for i in range(x + 1, x + w - 1, 2):
        c.VL(i, y + 1, h - 2, J('machiya_timber', 3))
    c.HL(x - 1, y + h, w + 2, J('cream_stucco', 4))


def steam_puff(c, x, y, h, seed=0, width=5):
    """고운 픽셀 클러스터 김(湯けむり): 흩어진 점 대신 둥근 김 구름 방울들이 곡선으로 피어오른다."""
    steps = max(3, h // 5)
    for k in range(steps):
        f = k / max(1, steps - 1)
        cy = y + h - 2 - int(f * (h - 4))
        cx = x + round(math.sin(k * 1.1 + seed) * 2.2)
        rx = max(1.6, (width * 0.55) * (1.0 - f * 0.35))
        ry = max(1.4, rx * 0.75)
        disc(c, cx + 1, cy + 1, rx, J('vending_cool_white', 1), ry=ry)
        disc(c, cx, cy, rx, J('vending_cool_white', 3 if f < 0.6 else 2), ry=ry)
        disc(c, cx - 0.6, cy - 0.6, max(1.0, rx * 0.55), J('vending_cool_white', 4), ry=max(1.0, ry * 0.55))


# ═══════════════════════════ 키트 등록 ═══════════════════════════
KITS = []


def kit(id_, name, w, h, kind, solid=(), other='star', tags=(), rules='', role='prop'):
    def deco(fn):
        KITS.append(dict(id=id_, name=name, w=w, h=h, kind=kind, draw=fn, solid=set(solid), other=other, tags=list(tags), rules=rules, role=role))
        return fn
    return deco


def rows(w, ys):
    return [(x, y) for y in ys for x in range(w)]


# ----------------------------- 나무 -----------------------------
# 대나무 문법(2026-10-20 R4 재작화, 사용자 「대나무가 끔찍하다」): 옛 대숲은 4~5px 굵은 기둥 + 10px 마다 검은 마디 띠 + 활엽수 공 수관이라
# 「초록 철창 위의 브로콜리」로 읽혔다. 새 문법 —
#   · 줄기(稈) 2~3px: 왼쪽 빛 1px · 몸 · 오른쪽 그늘. 줄기마다 윤곽선을 두르지 않는다(실루엣만 OL) — 굵은 검은 띠가 철창으로 읽히던 원인.
#   · 마디(節) 6~9px 간격, 줄기마다 어긋남: 마디 줄 1px 어둡게 + 바로 위 1px 밝은 마디 턱. 앞줄일수록 밝다(뒷줄 = 그늘 단).
#   · 잎은 둥근 덩이가 아니라 아래로 처진 가는 잎 부채(笹 잎 4~6px, 밑동 2px → 끝 1px)를 겹쳐 뾰족하게 솟은 수관을 만든다.
#   · 3/4 발치: 줄기 밑동이 타원 위에 앞뒤로 어긋나게 선다(뒤 줄기는 높이, 앞 줄기는 낮게) + 마른 댓잎(다다미 짚) 깔린 타원 + 오른쪽 아래 그늘.
def bamboo_culm(c, x, top, bot, w=3, depth=2, seed=0, lean=0):
    """대나무 줄기 하나: x = 밑동 왼쪽 열, top~bot(포함), 폭 w(2|3), depth 0 뒤(그늘) · 1 가운데 · 2 앞(밝음).
    lean = 꼭대기에서 옆으로 기운 화소 수(밑동은 곧고 위로 갈수록 휜다). 마디는 줄기마다 어긋난다."""
    hi, body, sh = ((('pine_bamboo', 2), ('pine_bamboo', 1), ('pine_bamboo', 0)),
                    (('pine_bamboo', 4), ('pine_bamboo', 3), ('pine_bamboo', 2)),
                    (('moss', 4), ('pine_bamboo', 4), ('pine_bamboo', 3)))[depth]
    hi, body, sh = J(*hi), J(*body), J(*sh)
    node = J('pine_bamboo', (0, 1, 2)[depth])
    ridge = J(*(('pine_bamboo', 3), ('moss', 4), ('tatami_straw', 3))[depth])
    span = max(1, bot - top)
    gap = 7 + int(H(x, depth, seed) * 3)                          # 마디 간격 7~9
    first = bot - 3 - int(H(x, top, seed + 1) * gap)
    dark = J('pine_bamboo', max(0, (0, 1, 2)[depth] - (depth == 0)))
    for y in range(top, bot + 1):
        ox = x + round(lean * ((bot - y) / span) ** 2)
        ww = w if y > top + 6 else max(2, w - 1)                    # 끝은 가늘어진다
        seg = (first - y) % gap if y < first else gap               # 마디 위로 몇 줄째(0 = 마디 줄)
        c.P(ox, y, hi)
        if ww == 3: c.P(ox + 1, y, body if seg not in (1, 2) else sh)  # 마디 바로 위 2줄은 마디 턱 그늘(마디마다 둥근 결)
        c.P(ox + ww - 1, y, sh if seg != 1 else dark)
        if y < first and y > top + 2 and seg == 0:
            c.HL(ox, y, ww, node)
        elif y < first - 1 and y > top + 2 and seg == gap - 1:
            c.HL(ox, y, ww - 1, ridge)


def _tri(v, period):
    """톱니 0..1(가운데 1): 잎 끝이 아래로 뾰족하게 처지는 띠 경계·실루엣에 쓴다."""
    ph = v % period
    return 1.0 - abs(ph - period / 2.0) / (period / 2.0)


def bamboo_mass(cx, cy, rx, ry, w, h, seed=0, tip=5):
    """笹 잎 덩이 하나의 마스크(h×w bool)와 덩이 안 위치값 f(-1 왼쪽 위 … +1 오른쪽 아래).
    둥근 공이 아니라 처진 잎 부채: 윗면은 둥근 반타원(ry), 아랫면은 납작(0.45ry)하고 그 아래로 4~5px 간격의
    처진 잎 끝(밑동 2px → 끝 1px, 길이 tip±1)이 매달린다. 옆구리 잎 끝도 바깥보다 아래를 향한다."""
    m = np.zeros((h, w), bool)
    f = np.full((h, w), 9.0)
    rb = ry * 0.45
    for y in range(max(0, int(cy - ry - 2)), min(h, int(cy + rb + 2))):
        for x in range(max(0, int(cx - rx - 2)), min(w, int(cx + rx + 2))):
            dx = (x - cx) / rx
            dy = (y - cy) / (ry if y < cy else rb)
            if dx * dx + dy * dy <= 1.0:
                m[y, x] = True; f[y, x] = dx * 0.55 + (y - cy) / ry * 1.25
    tips = []
    n = max(4, int(round(2 * rx / 4.3)))
    for i in range(n + 1):
        u = -1.0 + 2.0 * i / n                                          # 아래 테두리를 왼쪽 끝 → 오른쪽 끝
        u += (H(i, 1, seed) - 0.5) * 0.12
        ex = cx + u * (rx - 0.8)
        ey = cy + rb * math.sqrt(max(0.0, 1 - u * u)) - 1.0
        nx, ny = u * 0.7, 1.0
        L = math.hypot(nx, ny); nx, ny = nx / L, ny / L
        ln = tip + (1 if H(i, 3, seed) < 0.4 else 0) - (1 if H(i, 4, seed) < 0.25 else 0) - (1 if abs(u) > 0.85 else 0)
        side = -1 if u < 0 else 1
        for k in range(ln + 1):
            px, py = int(round(ex + nx * k)), int(round(ey + ny * k))
            cols = (px, px + side) if k < ln - 1 else (px,)              # 밑동 2px · 끝 1px
            for j, qx in enumerate(cols):
                if 0 <= qx < w and 0 <= py < h and not m[py, qx]:
                    m[py, qx] = True
                    lit = (u < 0.3) and qx == min(cols)                  # 잎 끝은 숲 속 그늘(가장 짙은 단) 위에서 읽히게 중간 단, 빛 쪽 열은 한 단 밝다
                    f[py, qx] = (-0.35 if lit else 0.05) + u * 0.35 + 0.1 * k / max(1, ln)
    return m, f


def bamboo_crown(c, masses, seed=0):
    """대숲 수관: 겹친 잎 덩이(뒤·위 → 앞·아래 순서). 덩이마다 4단 띠 명암(왼쪽 위 빛 → 오른쪽 아래 그늘),
    띠 경계는 5px 주기 처진 잎 끝 톱니(밑동 넓고 끝 뾰족)로 끊어 겹겹이 매달린 笹 잎 층을 만든다.
    앞 덩이는 뒤 덩이 위에 1px 그늘을 드리운다. 반환: 잎 마스크(h×w bool)."""
    G = [J('pine_bamboo', s) for s in range(5)]
    lvl = np.full((c.h, c.w), -1, int)
    gx0, gx1 = min(m[0] - m[2] for m in masses), max(m[0] + m[2] for m in masses)
    gy0, gy1 = min(m[1] - m[3] for m in masses), max(m[1] + m[3] for m in masses)
    for k, (cx, cy, rx, ry) in enumerate(masses):
        m, f = bamboo_mass(cx, cy, rx, ry, c.w, c.h, seed=seed + 31 * k, tip=5 if rx >= 7 else 3)
        # 수관 전체의 빛: 왼쪽 위 덩이일수록 밝고 오른쪽 아래 덩이일수록 그늘 — 덩이마다 같은 띠라 단조롭지 않게
        f = f + 1.1 * ((cx - gx0) / max(1, gx1 - gx0) - 0.45) + 1.0 * ((cy - gy0) / max(1, gy1 - gy0) - 0.35)
        prev = lvl.copy()
        off = int(H(k, 9, seed) * 5)
        amp = 3.2 * 1.25 / ry                                            # 잎 끝 톱니 3px(밑동 5px → 끝 1px)
        for y, x in zip(*np.nonzero(m)):
            g = f[y, x]
            tooth = amp * _tri(x + off, 5) if g < 0.9 else 0.0
            lvl[y, x] = 4 if g < -0.45 else 3 if g - tooth < -0.05 else 2 if g < 0.62 else 1
        # 밝은 잎 층 끝 바로 아래 1px 은 한 단 어둡게 — 매달린 잎 끝이 아래 층에 드리운 그늘(톱니 하나 = 잎 한 장)
        cur = lvl.copy()
        for y, x in zip(*np.nonzero(m)):
            if y > 0 and m[y - 1, x] and cur[y - 1, x] == 3 and cur[y, x] == 2:
                lvl[y, x] = 1
        for y, x in zip(*np.nonzero(~m & (prev >= 0))):
            if (y > 0 and m[y - 1, x]) or (x > 0 and y > 0 and m[y - 1, x - 1]):
                lvl[y, x] = max(0, min(prev[y, x], 2) - 1)
    leaf = lvl >= 0
    for y, x in zip(*np.nonzero(leaf)):                                   # 윗선의 외톨이 1px 뾰루지(아래에만 이웃) 정리
        nb = [(dy, dx) for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)) if 0 <= y + dy < c.h and 0 <= x + dx < c.w and leaf[y + dy, x + dx]]
        if nb == [(1, 0)]: lvl[y, x] = -1
    leaf = lvl >= 0
    for y, x in zip(*np.nonzero(leaf)):
        c.P(int(x), int(y), G[lvl[y, x]])
    return leaf


def bamboo_grove_art(c, cx, ground_y, rx, culms, masses, seed=0, twigs=()):
    """대숲 한 덩이. culms=[(x, top, bot, w, depth, lean)], masses=[(cx, cy, rx, ry)] 뒤·위 → 앞·아래 순서,
    twigs=[(cx, cy, rx, ry)] 줄기 사이에 매달린 작은 잎 덩이(맨 줄기와 수관을 잇는다)."""
    # 1) 3/4 발치: 오른쪽 아래 그늘 → 윤곽 → 이끼 둔덕 윗면(타원) 위 마른 댓잎 2px 결
    disc(c, cx + 3, ground_y + 1.5, rx, J('pine_bamboo', 0), ry=4)
    disc(c, cx, ground_y, rx, OL, ry=4)
    disc(c, cx, ground_y - 0.5, rx - 1, J('moss', 1), ry=3.2)
    disc(c, cx - 2, ground_y - 1, rx - 4, J('moss', 2), ry=2.2)
    for i in range(int(rx * 0.8)):
        lx = int(cx - rx + 3 + H(i, 1, seed) * (rx * 2 - 7)); ly = int(ground_y - 2 + H(i, 2, seed) * 3)
        if ((lx + 1 - cx) / (rx - 2.5)) ** 2 + ((ly - ground_y + 0.5) / 2.4) ** 2 < 1:
            c.HL(lx, ly, 2, J('tatami_straw', 1)); c.P(lx, ly, J('tatami_straw', 2))
    for _ in range(2):                                                   # 타원 끝의 외톨이 1px 뾰루지 정리
        for y in range(max(0, ground_y - 6), min(c.h, ground_y + 7)):
            for x in range(c.w):
                if c.a[y, x, 3] and sum(1 for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1))
                                        if 0 <= y + dy < c.h and 0 <= x + dx < c.w and c.a[y + dy, x + dx, 3]) <= 1:
                    c.a[y, x, 3] = 0
    # 2) 수관(겹친 잎 덩이) — 먼저 따로 그려 둔다. 잎 둘레 윤곽은 잎 색 가장 짙은 단(검정 아님)
    tc = Cv(c.w, c.h)
    leaf = bamboo_crown(tc, list(masses) + list(twigs), seed=seed)
    hh, ww = leaf.shape
    edge = J('pine_bamboo', 0)
    for y in range(hh):
        for x in range(ww):
            if leaf[y, x]: continue
            if any(0 <= y + dy < hh and 0 <= x + dx < ww and leaf[y + dy, x + dx] for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1))):
                tc.P(x, y, edge)
    t = Cv(c.w, c.h)
    # 3) 숲 속 그늘: 줄기 사이 뒤쪽은 짙은 잎 그늘 한 면(점·결 없이). 위에 잎이 덮인 열만, 그 열 잎의 아랫선 3px 위부터 발치까지 —
    #    수관 밖으로 네모 모서리가 삐져나오지 않게 한다
    def gtop(x):                                                         # 이끼 둔덕 윗면(타원) 윗선 — 숲 그늘·줄기 밑동이 이 곡선에 박힌다
        return int(round(ground_y - 0.5 - 3.2 * math.sqrt(max(0.0, 1 - ((x - cx) / (rx - 1)) ** 2))))
    xs = [x for x, *_ in culms]
    x0, x1 = min(xs) + 1, max(xs) + 1
    for x in range(x0, x1 + 1):
        col = np.nonzero(leaf[:, x])[0] if 0 <= x < ww else []
        if len(col) == 0: continue
        for y in range(int(col[-1]) - 3, gtop(x) + 2):
            t.P(x, y, J('pine_bamboo', 0))
    # 4) 줄기(뒤 → 앞) — 꼭대기는 수관 속에 묻힌다(잎 윗선보다 위로 삐져나온 맨 막대가 없게 그 열 잎 윗선 5px 아래에서 시작)
    for d in (0, 1, 2):
        for x, top, bot, w, dd, lean in culms:
            if dd != d: continue
            tx = min(ww - 1, max(0, x + lean + 1))
            col = np.nonzero(leaf[:, tx])[0]
            if len(col): top = max(top, int(col[0]) + 5)
            bamboo_culm(t, x, top, max(gtop(x), gtop(x + w - 1)) + 2 - (d == 0), w, d, seed, lean)
    add_outline(t)
    for y, x in zip(*np.nonzero(t.a[..., 3] > 0)):                      # 둔덕 윗면 안쪽 윤곽선은 지운다(발치에 검은 네모·톱니가 생기지 않게)
        if y >= gtop(x) and abs(x - cx) < rx - 1 and tuple(t.a[y, x, :3]) == ((OL >> 16) & 255, (OL >> 8) & 255, OL & 255):
            t.a[y, x, 3] = 0
    # 수관 속 투명 구멍(바깥과 이어지지 않은 빈칸)은 숲 속 그늘로 메운다 — 구멍에 윤곽선이 둘러지지 않게
    opaque = (t.a[..., 3] > 0) | (tc.a[..., 3] > 0)
    seen = np.zeros_like(opaque); stack = [(0, x) for x in range(ww)] + [(y, 0) for y in range(hh)] + [(y, ww - 1) for y in range(hh)]
    while stack:
        y, x = stack.pop()
        if not (0 <= y < hh and 0 <= x < ww) or seen[y, x] or opaque[y, x]: continue
        seen[y, x] = True; stack += [(y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)]
    for y, x in zip(*np.nonzero(~seen & ~opaque)):
        if y < ground_y - 4: tc.P(int(x), int(y), J('pine_bamboo', 0))
    for src in (t, tc):
        for y in range(c.h):
            for x in range(c.w):
                if src.a[y, x, 3]:
                    c.P(x, y, (int(src.a[y, x, 0]) << 16) | (int(src.a[y, x, 1]) << 8) | int(src.a[y, x, 2]))


@kit('rg-bamboo-grove', '대숲(竹林) 한 덩이(줄기 열하나·마디·처진 笹 잎 덩이·마른 댓잎 발치, 4×6)', 4, 6, 'tree', solid=[(1, 5), (2, 5)],
     tags=['대나무', '대숲', '竹林', '산길', '사가노'], rules='길 양옆에 겹쳐 줄지어 세워 대숲 터널을 만든다. 발 두 칸만 막힌다. 같은 덩이만 잇지 말고 rg-bamboo-grove-b·rg-bamboo-clump 와 섞는다.', role='prop')
def bamboo_grove(c, base):
    culms = [(10, 30, 86, 2, 0, -3), (20, 20, 85, 2, 0, -1), (30, 10, 84, 2, 0, 0), (40, 20, 85, 2, 0, 2), (50, 30, 86, 2, 0, 3),
             (15, 34, 89, 3, 1, -2), (35, 30, 88, 3, 1, 1), (46, 38, 89, 3, 1, 2),
             (9, 48, 92, 3, 2, -2), (25, 44, 93, 3, 2, -1), (52, 48, 92, 3, 2, 1)]
    masses = [(31, 11, 9, 9), (22, 20, 10, 8), (41, 20, 10, 8), (14, 31, 9, 8), (49, 31, 9, 8), (31, 29, 11, 9),
              (21, 41, 10, 8), (42, 42, 10, 8), (11, 50, 7, 6), (52, 52, 7, 6), (31, 51, 9, 6)]
    twigs = []
    bamboo_grove_art(c, 31, 89, 27, culms, masses, seed=11, twigs=twigs)


@kit('rg-bamboo-grove-b', '대숲(竹林) 좁은 덩이(줄기 아홉·높이 솟은 끝, 3×6)', 3, 6, 'tree', solid=[(1, 5)],
     tags=['대나무', '대숲', '竹林', '산길', '사가노'], rules='rg-bamboo-grove 사이·뒤에 끼워 대숲 가장자리를 들쭉날쭉하게. 발 한 칸만 막힌다.', role='prop')
def bamboo_grove_b(c, base):
    culms = [(8, 30, 86, 2, 0, -2), (18, 8, 84, 2, 0, -1), (29, 18, 85, 2, 0, 1), (38, 32, 86, 2, 0, 2),
             (13, 36, 89, 3, 1, -1), (33, 38, 88, 3, 1, 1),
             (7, 50, 91, 2, 2, -2), (23, 44, 92, 3, 2, 0), (38, 52, 90, 2, 2, 1)]
    masses = [(20, 10, 8, 8), (12, 21, 8, 8), (30, 20, 9, 8), (21, 31, 10, 9), (10, 41, 7, 7), (35, 42, 8, 7),
              (22, 50, 9, 6)]
    twigs = []
    bamboo_grove_art(c, 23, 89, 20, culms, masses, seed=23, twigs=twigs)


@kit('rg-bamboo-clump', '대나무 작은 무리(줄기 다섯·잎 덩이, 2×4) — 대숲 가장자리·절·료칸 뜰', 2, 4, 'tree', solid=[(0, 3), (1, 3)],
     tags=['대나무', '竹', '정원', '대숲 가장자리'], rules='대숲 가장자리·사찰·료칸 뜰 모퉁이에 한두 무리. 큰 대숲 앞줄에 세워 숲 끝을 낮춘다.', role='prop')
def bamboo_clump(c, base):
    culms = [(9, 16, 55, 2, 0, -1), (19, 8, 54, 2, 0, 1), (13, 26, 58, 3, 1, -1), (21, 28, 59, 3, 2, 1), (7, 32, 59, 2, 2, -1)]
    masses = [(16, 9, 7, 7), (10, 18, 7, 6), (23, 18, 7, 6), (16, 27, 8, 6), (7, 34, 5, 4), (25, 35, 5, 4)]
    bamboo_grove_art(c, 16, 57, 13, culms, masses, seed=37)


@kit('rg-sugi', '삼나무(杉) 한 그루 - 원뿔 층 잎·붉은 줄기(3×6)', 3, 6, 'tree', solid=[(1, 5)],
     tags=['삼나무', '杉', '산길', '신사 숲'], rules='참배길·산길 양옆에 2~3칸 간격으로 줄지어 세운다.', role='prop')
def sugi(c, base):
    # 3/4 발치 이끼·뿌리 윗면
    disc(c, 24, 91, 13, OL, ry=3.5)
    disc(c, 24, 90, 12, J('moss', 1), ry=3.0)
    disc(c, 23, 89, 9, J('moss', 2), ry=2.2)
    trunk_34(c, 21, 66, 6, 25, 'aged_cedar', 2)
    # 아래에서 위로 겹쳐 올라가는 5단 원뿔 수관 (하나의 삼나무 실루엣으로 묶고 층마다 아랫단 그늘로 단차를 표현)
    t = Cv(c.w, c.h)
    tiers = [
        [(24, 60, 18, 10), (14, 64, 10, 6), (34, 64, 10, 6)],
        [(24, 48, 16, 9), (15, 51, 9, 5), (33, 51, 9, 5)],
        [(24, 36, 13, 8), (17, 39, 8, 5), (31, 39, 8, 5)],
        [(24, 24, 10, 8), (19, 27, 6, 4), (29, 27, 6, 4)],
        [(24, 14, 7, 7), (24, 8, 4.5, 5)],
    ]
    for blobs in tiers:
        for bx, by, rx, ry in blobs:
            disc(t, bx, by + 2.0, rx + 0.5, J('pine_bamboo', 0), ry=ry)
        for bx, by, rx, ry in blobs:
            disc(t, bx, by, rx, J('pine_bamboo', 1), ry=ry)
        for bx, by, rx, ry in blobs:
            disc(t, bx - 0.6, by - 0.8, max(2.0, rx - 1.4), J('pine_bamboo', 2), ry=max(2.0, ry - 1.2))
        for bx, by, rx, ry in blobs:
            disc(t, bx - rx * 0.22 - 0.6, by - ry * 0.22 - 0.8, max(1.6, rx * 0.6), J('pine_bamboo', 3), ry=max(1.6, ry * 0.6))
        for bx, by, rx, ry in blobs:
            disc(t, bx - rx * 0.34 - 0.8, by - ry * 0.34 - 1.0, max(1.0, rx * 0.3), J('pine_bamboo', 4), ry=max(1.0, ry * 0.3))
    add_outline(t)
    for y in range(c.h):
        for x in range(c.w):
            if t.a[y, x, 3]:
                c.P(x, y, (int(t.a[y, x, 0]) << 16) | (int(t.a[y, x, 1]) << 8) | int(t.a[y, x, 2]))


@kit('rg-pine', '곰솔(黒松) - 굽은 줄기·층층 솔잎 구름(4×5)', 4, 5, 'tree', solid=[(1, 4), (2, 4)],
     tags=['소나무', '黒松', '방풍림', '해안', '성', '정원'], rules='해안도로 방풍림은 2칸 간격으로 줄지어, 성·사찰 정원에는 한 그루씩.', role='prop')
def pine(c, base):
    # 3/4 발치 이끼·정원석 받침
    disc(c, 30, 75, 16, OL, ry=4)
    disc(c, 30, 74, 15, J('moss', 1), ry=3.2)
    disc(c, 29, 73, 11, J('moss', 3), ry=2.2)
    # 굽은 소나무 줄기 + 굵은 가지 (외곽선 OL 포함)
    t = Cv(c.w, c.h)
    for j in range(36, 75):
        x = 27 + round(math.sin((j - 36) / 8.5) * 4.5) - (75 - j) // 12
        t.R(x, j, 7, 1, J('machiya_timber', 2))
        t.P(x, j, J('machiya_timber', 4)); t.P(x + 1, j, J('machiya_timber', 3))
        t.P(x + 5, j, J('machiya_timber', 1)); t.P(x + 6, j, J('machiya_timber', 0))
        if j % 4 == 0: t.HL(x + 2, j, 3, J('machiya_timber', 1))
    # 좌우로 뻗은 가지
    for s in range(16):
        lx, ly = 28 - s, 48 - s // 2
        rx, ry = 32 + s, 44 - s // 2
        t.R(lx, ly, 3, 3, J('machiya_timber', 3)); t.P(lx, ly, J('machiya_timber', 4))
        t.R(rx, ry, 3, 3, J('machiya_timber', 2)); t.P(rx, ry, J('machiya_timber', 3))
    add_outline(t)
    for y in range(c.h):
        for x in range(c.w):
            if t.a[y, x, 3]:
                c.P(x, y, (int(t.a[y, x, 0]) << 16) | (int(t.a[y, x, 1]) << 8) | int(t.a[y, x, 2]))
    # 층층 솔잎 구름 패드 (각 층마다 독립 윤곽과 윗면 하이라이트)
    pads = [
        [(15, 34, 12, 6), (10, 36, 7, 4), (21, 36, 7, 4)],
        [(47, 30, 12, 6), (41, 32, 7, 4), (53, 32, 7, 4)],
        [(36, 42, 11, 5), (45, 43, 7, 4)],
        [(31, 17, 16, 8), (20, 20, 10, 6), (42, 20, 10, 6)],
    ]
    for idx, blobs in enumerate(pads):
        canopy_clusters(c, blobs, 'pine_bamboo', seed=20 + idx)


@kit('rg-maple', '단풍나무(紅葉) - 진홍 잎 덩이·가는 줄기·떨어진 잎(4×5)', 4, 5, 'tree', solid=[(1, 4), (2, 4)],
     tags=['단풍', '紅葉', '가을', '계곡', '사찰'], rules='계곡 길·사찰 마당에 가을 장면만. 봄·여름 장면엔 rg-sugi·벚나무를 쓴다.', role='prop')
def maple(c, base):
    # 3/4 발치 이끼 + 떨어진 단풍잎 패드
    disc(c, 32, 75, 15, OL, ry=3.8)
    disc(c, 32, 74, 14, J('moss', 1), ry=3.0)
    disc(c, 31, 73, 10, J('moss', 2), ry=2.0)
    trunk_34(c, 29, 46, 6, 29, 'machiya_timber', 2)
    canopy_clusters(c, [
        (16, 36, 12, 9), (48, 35, 12, 9),
        (32, 28, 19, 13), (21, 18, 12, 9), (43, 18, 12, 9), (32, 12, 12, 8)
    ], 'autumn_maple', seed=21)
    # 발치 낙엽 클러스터
    for lx, ly in ((22, 74), (36, 75), (28, 76), (41, 73)):
        c.P(lx, ly, J('autumn_maple', 4)); c.P(lx + 1, ly, J('autumn_maple', 2))


@kit('rg-sunflower', '해바라기 무리(3송이·큰 잎, 3×2)', 3, 2, 'flower', solid=[],
     tags=['해바라기', '여름', '시골', '들판'], rules='시골 역·밭 가장자리에 여러 개를 붙여 들판을 만든다(걸어서 지나갈 수 있다).', role='prop')
def sunflower(c, base):
    # 3/4 흙 이랑 + 무성한 잎 덤불 + 3/4 위에서 본 해바라기 꽃판 4송이 + 전체 1px OL
    t = Cv(c.w, c.h)
    disc(t, 24, 27, 20, J('aged_cedar', 1), ry=3.5)
    disc(t, 24, 26, 18, J('moss', 1), ry=3.0)
    # 풍성한 아래 잎 덩이
    for bx, by, rx, ry in ((11, 22, 8, 5), (24, 23, 9, 5), (37, 22, 8, 5), (17, 19, 7, 5), (31, 19, 7, 5)):
        disc(t, bx, by, rx, J('pine_bamboo', 2), ry=ry)
        disc(t, bx - 1, by - 1, rx * 0.65, J('pine_bamboo', 3), ry=ry * 0.65)
    # 줄기
    for sx, sy in ((10, 10), (21, 7), (31, 11), (39, 8)):
        t.R(sx - 1, sy + 3, 3, 25 - sy, J('pine_bamboo', 2))
        t.VL(sx - 1, sy + 3, 25 - sy, J('pine_bamboo', 3))
    # 3/4 타원 해바라기 꽃송이 (윗면으로 살짝 기울어진 꽃잎 테 + 갈색 씨앗 중심)
    for sx, sy, rx, ry in ((10, 10, 5.5, 4.5), (21, 7, 6.2, 5.0), (31, 12, 5.2, 4.2), (39, 8, 5.8, 4.8)):
        disc(t, sx + 0.5, sy + 0.8, rx, J('lantern_amber', 2), ry=ry)
        disc(t, sx, sy, rx - 0.5, J('lantern_amber', 3), ry=ry - 0.4)
        disc(t, sx - 1.0, sy - 1.0, rx * 0.65, J('lantern_amber', 4), ry=ry * 0.65)
        disc(t, sx, sy + 0.3, rx * 0.45, J('machiya_timber', 2), ry=ry * 0.45)
        t.P(int(sx - 1), int(sy - 1), J('machiya_timber', 4))
        t.P(int(sx + 1), int(sy + 1), J('machiya_timber', 0))
    add_outline(t)
    for y in range(c.h):
        for x in range(c.w):
            if t.a[y, x, 3]:
                c.P(x, y, (int(t.a[y, x, 0]) << 16) | (int(t.a[y, x, 1]) << 8) | int(t.a[y, x, 2]))


# ----------------------------- 성·사찰·유적 -----------------------------
@kit('rg-ishigaki', '성 돌담(石垣) 한 구간 - 다듬지 않은 돌 쌓기·윗돌·풀(8×4)', 8, 4, 'wall', solid=rows(8, (1, 2, 3)),
     tags=['石垣', '성', '돌담', '해자', '유적'], rules='해자 물가를 따라 가로로 이어 붙인다(8칸마다 하나). 윗줄은 걸을 수 있는 돌담 위.', role='structure')
def ishigaki(c, base):
    # 3/4 윗면(y=0..15): 걷는 돌담 상부 길(판석 + 뒤쪽 성벽 턱 + 앞쪽 갓돌 코핑)
    c.HL(0, 0, 128, OL)
    c.HL(0, 1, 128, J('shrine_flagstone', 4))
    c.HL(0, 2, 128, J('shrine_flagstone', 2))
    # 윗면 판석/잔디 길 (y=3..11)
    for y in range(3, 12):
        for x in range(128):
            sx = (x + (y // 5) * 6) % 12
            if sx == 11 or y == 7:
                col = J('shrine_flagstone', 1)
            else:
                col = J('shrine_flagstone', 3 if (x % 12 < 3 or y == 3) else 2)
            if y in (3, 4) and H(x // 2, y, 7) > 0.65:
                col = J('moss', 3 if y == 3 else 2)
            c.P(x, y, col)
    # 앞쪽 갓돌(코핑 스톤, y=12..16): 밝은 윗면 턱 + 구분선 OL
    c.HL(0, 12, 128, J('shrine_flagstone', 4))
    c.HL(0, 13, 128, J('shrine_flagstone', 3))
    c.HL(0, 14, 128, J('shrine_flagstone', 1))
    for x in range(0, 128, 16):
        c.VL(x, 12, 3, J('shrine_flagstone', 1))
        c.P(x + 1, 12, J('shrine_flagstone', 4))
    c.HL(0, 15, 128, OL)
    # 정면 石垣 석축 (y=16..61) + 배수구 + 하단 접지 단
    stones(c, 0, 16, 128, 45, seed=7, course=(7, 9), width=(10, 16), moss=0.14)
    for wx in (28, 92):
        c.R(wx, 38, 6, 5, OL); c.R(wx + 1, 39, 4, 3, J('wet_cobble', 0))
        c.HL(wx, 37, 6, J('shrine_flagstone', 4))
    c.HL(0, 61, 128, J('shrine_flagstone', 1))
    c.HL(0, 62, 128, J('shrine_flagstone', 0))
    c.HL(0, 63, 128, OL)


@kit('rg-tenshu', '천수각(天守) - 石垣 받침·흰 회벽·검은 판자·3단 기와 지붕·금 샤치호코(10×11)', 10, 11, 'landmark', solid=rows(10, range(5, 11)),
     tags=['天守', '성', '城', '유적', '랜드마크'], rules='성곽 맵 한가운데 북쪽. 앞에 판석 광장과 해자. 한 맵에 하나.', role='structure')
def tenshu(c, base):
    # 1. 石垣 대좌: 3/4 상부 판석 테라스(y=124..132) + 사다리꼴 석축 정면(y=133..175) + 중앙 돌계단
    c.HL(14, 124, 132, OL)
    c.R(15, 125, 130, 6, J('shrine_flagstone', 3))
    c.HL(15, 125, 130, J('shrine_flagstone', 4))
    for sx in range(24, 140, 12): c.VL(sx, 125, 6, J('shrine_flagstone', 2))
    c.HL(14, 131, 132, J('shrine_flagstone', 4))
    c.HL(14, 132, 132, OL)
    c.VL(14, 124, 9, OL); c.VL(145, 124, 9, OL)
    for y in range(133, 175):
        f = (y - 133) / 41.0
        a, b = round(14 - 11 * f), round(145 + 11 * f)
        c.P(a - 1, y, OL); c.P(b, y, OL)
    stones(c, 3, 133, 154, 41, seed=31, course=(6, 8), width=(8, 14), moss=0.1,
           inside=lambda x, y: round(14 - 11 * (y - 133) / 41.0) <= x < round(145 + 11 * (y - 133) / 41.0))
    c.HL(2, 174, 156, J('shrine_flagstone', 0))
    c.HL(2, 175, 156, OL)
    # 중앙 출입구 돌계단 (3/4 윗면 디딤판 + 그림자)
    c.R(66, 126, 28, 49, OL)
    for st in range(8):
        sy = 127 + st * 6
        c.R(68, sy, 24, 3, J('shrine_flagstone', 4 if st % 2 == 0 else 3))
        c.R(68, sy + 3, 24, 2, J('shrine_flagstone', 1))
        c.HL(68, sy + 5, 24, OL)
    c.R(65, 126, 3, 49, J('shrine_flagstone', 3)); c.R(92, 126, 3, 49, J('shrine_flagstone', 2))

    # 2. 1층 본채 (y=94..125) + 1층 지붕 (y=76..95)
    plaster_wall(c, 20, 95, 120, 15, seed=1)
    boards(c, 20, 110, 120, 15, seed=2)
    c.HL(20, 110, 120, OL)
    for x in (28, 46, 104, 122): window_slot(c, x, 99, 9, 8)
    # 1층 중앙 대문
    c.R(70, 108, 20, 17, OL); c.R(71, 109, 18, 16, J('machiya_timber', 1))
    c.VL(80, 109, 16, OL); c.HL(71, 109, 18, J('lantern_amber', 3))
    kawara_roof_34(c, 12, 148, 76, 95, flare=5)

    # 3. 2층 몸채 (y=58..76) + 2층 지붕 (y=42..59) + 중앙 박공(千鳥破風)
    plaster_wall(c, 32, 58, 96, 12, seed=3)
    boards(c, 32, 70, 96, 6, seed=4)
    c.HL(32, 70, 96, OL)
    for x in (40, 56, 94, 110): window_slot(c, x, 60, 8, 7)
    kawara_roof_34(c, 24, 136, 42, 59, flare=4)
    # 1층 지붕 위 중앙 박공(千鳥破風)
    for y in range(66, 78):
        half = (y - 66) * 1.25
        x0, x1 = round(80 - half), round(80 + half)
        c.P(x0 - 1, y, OL); c.P(x0, y, J('kawara_dark_tile', 4))
        for x in range(x0 + 1, x1):
            c.P(x, y, J('cream_stucco', 4 if x < 80 else 3))
        c.P(x1, y, J('kawara_dark_tile', 1)); c.P(x1 + 1, y, OL)
    c.HL(65, 78, 31, OL)
    c.R(78, 71, 4, 4, J('lantern_amber', 3))

    # 4. 3층 망루 (y=26..42) + 최상층 入母屋 대지붕 (y=6..27) + 금 샤치호코
    plaster_wall(c, 48, 26, 64, 11, seed=5)
    boards(c, 48, 37, 64, 5, seed=6)
    for x in (55, 76, 97): window_slot(c, x, 28, 8, 6)
    # 망루 붉은/검은 난간
    c.HL(44, 39, 72, OL); c.HL(44, 40, 72, J('torii_vermilion', 3)); c.HL(44, 41, 72, OL)
    kawara_roof_34(c, 38, 122, 7, 27, flare=5)
    # 최상층 용마루 금 샤치호코 (좌우 한 쌍, OL 둘레)
    for sx, d in ((48, 1), (109, -1)):
        c.R(sx - 1, 1, 5, 7, OL)
        c.R(sx, 2, 3, 5, J('lantern_amber', 3))
        c.P(sx + (0 if d > 0 else 2), 2, J('lantern_amber', 4))
        c.P(sx + (2 if d > 0 else 0), 1, J('lantern_amber', 4))


@kit('rg-shoro', '종루(鐘楼) - 돌 기단·나무 기둥·청동 범종·당목·기와 지붕(5×6)', 5, 6, 'landmark', solid=rows(5, (4, 5)),
     tags=['종루', '鐘楼', '사찰', '범종'], rules='사찰 경내 본당 옆(오중탑 반대쪽). 앞 한 칸은 비운다.', role='structure')
def shoro(c, base):
    # 1. 3/4 석조 기단: 넓은 윗면 판석 테라스(y=68..77) + 정면 석축(y=78..94) + 중앙 돌계단
    c.R(4, 68, 72, 27, OL)
    c.R(5, 69, 70, 8, J('shrine_flagstone', 3))
    c.HL(5, 69, 70, J('shrine_flagstone', 4))
    for sx in range(15, 70, 12): c.VL(sx, 69, 8, J('shrine_flagstone', 2))
    c.HL(5, 77, 70, J('shrine_flagstone', 4))
    c.HL(5, 78, 70, OL)
    stones(c, 5, 79, 70, 15, seed=19, course=(5, 6), width=(8, 12), moss=0.1)
    c.HL(5, 93, 70, J('shrine_flagstone', 0))
    # 중앙 돌계단
    c.R(30, 72, 20, 23, OL)
    for st in range(4):
        sy = 73 + st * 5
        c.R(32, sy, 16, 3, J('shrine_flagstone', 4))
        c.R(32, sy + 3, 16, 2, OL)

    # 2. 기둥 4본 (뒷기둥 2본 먼저, 그 다음 범종, 앞기둥 2본)
    for px in (18, 56):
        trunk_34(c, px, 30, 5, 40, 'aged_cedar', 1)
    # 상부 대들보·두공
    rect_3d(c, 8, 25, 64, 7, 2, 'torii_vermilion', top_t=3, front_t=2)

    # 3. 청동 범종 (3/4 원통 + 용뉴 + 가로 띠 + 음각 격자 + OL)
    bt = Cv(c.w, c.h)
    bt.R(38, 31, 4, 5, J('onsen_mineral_teal', 2))
    for y in range(35, 61):
        half = 7.5 + (y - 35) * 0.16 + (2.0 if y >= 57 else 0.0)
        for x in range(round(40 - half), round(40 + half) + 1):
            lv = 3 if x < 36 else 2 if x < 43 else 1
            if y in (41, 49, 56): lv = min(4, lv + 1)
            elif y in (42, 50, 58): lv = max(0, lv - 1)
            elif 43 <= y <= 48 and (x % 3 == 0): lv = max(0, lv - 1)
            bt.P(x, y, J('onsen_mineral_teal', lv))
    # 범종 아래 타원 아가리 (3/4 안쪽 그늘)
    disc(bt, 40, 61, 11, J('onsen_mineral_teal', 0), ry=2.5)
    # 당목(撞木: 종 치는 통나무와 밧줄)
    bt.VL(58, 31, 15, J('tatami_straw', 3))
    bt.VL(39, 52, 12, J('torii_vermilion', 3))
    bt.R(50, 45, 22, 4, J('aged_cedar', 3))
    bt.HL(50, 45, 22, J('aged_cedar', 4))
    disc(bt, 50, 46.5, 2.2, J('cream_stucco', 4))
    add_outline(bt)
    for y in range(c.h):
        for x in range(c.w):
            if bt.a[y, x, 3]:
                c.P(x, y, (int(bt.a[y, x, 0]) << 16) | (int(bt.a[y, x, 1]) << 8) | int(bt.a[y, x, 2]))

    # 앞기둥 2본
    for px in (10, 64):
        trunk_34(c, px, 30, 6, 44, 'torii_vermilion', 2)
        plinth_34(c, px - 1, 71, 8, 5, top_h=2, mat='shrine_flagstone')

    # 4. 3/4 사찰 기와 지붕
    kawara_roof_34(c, 5, 75, 4, 26, flare=4, ridge_ornament=True)


@kit('rg-stone-ruin', '석조 유적 - 무너진 돌벽·쓰러진 기둥 돌·이끼(4×3)', 4, 3, 'ruin', solid=[(0, 1), (1, 1), (0, 2), (1, 2), (2, 2), (3, 2)],
     tags=['유적', '석조', '이끼', '숲', '古墳'], rules='숲 바닥·이끼 땅 위에 2~4개를 흩어 놓는다. 사이로 산길이 지나간다.', role='structure')
def stone_ruin(c, base):
    # 1. 3/4 유적 석조 기단(윗면 판석 테라스 + 정면 돌턱 + 계단 흔적)
    plinth_34(c, 2, 20, 44, 24, top_h=12, mat='shrine_flagstone')
    # 기단 윗면 이끼와 균열
    for (mx, my, mw) in ((6, 23, 8), (22, 26, 10), (14, 29, 7)):
        c.R(mx, my, mw, 3, J('moss', 2)); c.HL(mx, my, mw, J('moss', 3))
    # 2. 기단 왼쪽 위에 서 있는 무너진 ㄱ자 돌담 (3/4 윗두께 5px + 정면 석축 + OL)
    c.R(4, 3, 28, 24, OL)
    c.R(5, 4, 26, 5, J('shrine_flagstone', 4))
    c.R(5, 5, 24, 3, J('moss', 3))
    c.HL(5, 9, 26, OL)
    stones(c, 5, 10, 26, 16, seed=41, course=(5, 6), width=(7, 11), moss=0.35)
    # 3. 기단 오른쪽 부러진 원기둥 밑동 (3/4 원통 + 타원 윗면)
    c.R(33, 13, 10, 12, OL)
    c.R(34, 15, 8, 9, J('shrine_flagstone', 2))
    c.VL(34, 15, 9, J('shrine_flagstone', 3)); c.VL(41, 15, 9, J('shrine_flagstone', 1))
    disc(c, 37.5, 14.5, 4.8, OL, ry=2.6)
    disc(c, 37.5, 14.5, 3.8, J('shrine_flagstone', 4), ry=1.8)
    # 4. 앞쪽에 쓰러진 석주 토막 (3/4 원통 옆면 + 타원 단면 + 이끼 + OL)
    c.R(36, 31, 24, 13, OL)
    for j in range(1, 12):
        lv = 4 if j <= 2 else 3 if j <= 5 else 2 if j <= 8 else 1
        c.HL(37, 31 + j, 20, J('shrine_flagstone', lv))
    c.R(41, 32, 7, 3, J('moss', 3)); c.R(50, 33, 5, 2, J('moss', 2))
    disc(c, 57, 37, 4.5, OL, ry=5.5)
    disc(c, 57, 37, 3.5, J('shrine_flagstone', 3), ry=4.5)
    disc(c, 57, 37, 1.5, J('shrine_flagstone', 1), ry=2.0)


@kit('rg-moss-buddha', '이끼 낀 석불(좌상·광배 돌, 2×2)', 2, 2, 'statue', solid=[(0, 1), (1, 1)],
     tags=['석불', '이끼', '유적', '지장', '고개'], rules='숲 유적·고개 쉼터에 줄지어(2칸 간격). 앞에 꽃이나 공양 돌.', role='prop')
def moss_buddha(c, base):
    t = Cv(c.w, c.h)
    # 1. 3/4 석조 연화 대좌 (윗면 + 정면)
    t.R(4, 23, 24, 7, J('shrine_flagstone', 2))
    t.R(5, 22, 22, 3, J('shrine_flagstone', 4))
    t.HL(4, 25, 24, J('shrine_flagstone', 1))
    t.HL(4, 29, 24, J('shrine_flagstone', 0))
    for px in range(7, 26, 4):
        t.VL(px, 25, 4, J('shrine_flagstone', 3))
    # 2. 배 모양 광배(舟形光背: 왼쪽 위 밝은 두께 + 안쪽 오목 면)
    for y in range(2, 23):
        half = 10.5 * math.sin(math.pi * min(1.0, (y - 1) / 23.0) * 0.88 + 0.22)
        x0, x1 = round(16 - half), round(16 + half)
        for x in range(x0, x1 + 1):
            if x <= x0 + 1 or (y < 6 and x < 16): lv = 4
            elif x >= x1 - 1: lv = 1
            else: lv = 2 if x < 16 else 1
            t.P(x, y, J('shrine_flagstone', lv))
    # 3. 불상 머리·가사·붉은 턱받이(마에다레)
    disc(t, 16, 9, 4.0, J('shrine_flagstone', 3))
    disc(t, 15, 8, 2.2, J('shrine_flagstone', 4))
    for y in range(13, 23):
        half = 4.2 + (y - 13) * 0.42
        for x in range(round(16 - half), round(16 + half) + 1):
            t.P(x, y, J('shrine_flagstone', 3 if x < 16 else 2))
    # 붉은 봉헌 턱받이 + 선정인 손
    t.R(12, 13, 8, 4, J('torii_vermilion', 2))
    t.HL(12, 13, 8, J('torii_vermilion', 4))
    t.R(13, 19, 6, 2, J('shrine_flagstone', 4))
    # 이끼 클러스터
    for mx, my in ((9, 6), (22, 12), (7, 23), (23, 24)):
        t.R(mx, my, 3, 2, J('moss', 3)); t.P(mx, my, J('moss', 4))
    add_outline(t)
    for y in range(c.h):
        for x in range(c.w):
            if t.a[y, x, 3]:
                c.P(x, y, (int(t.a[y, x, 0]) << 16) | (int(t.a[y, x, 1]) << 8) | int(t.a[y, x, 2]))


# ----------------------------- 물·온천·자연 -----------------------------
@kit('rg-rotenburo', '노천탕(露天風呂) - 둥근 바위 테·청록 온천물·김·나무 통(6×4)', 6, 4, 'water', solid=rows(6, (1, 2, 3)),
     tags=['온천', '露天風呂', '료칸', '김'], rules='온천 마을 료칸 뒤뜰·강가. 주위를 대나무 울타리나 생울타리로 가린다.', role='structure')
def rotenburo(c, base):
    # 1. 뒤쪽 대나무 가림막 울타리(竹垣, 3/4 윗대나무 테 + 세로 대살 + OL)
    c.R(6, 2, 54, 14, OL)
    c.R(7, 3, 52, 2, J('moss', 4))
    for x in range(7, 59):
        c.VL(x, 5, 10, J('tatami_straw', 3 if x % 3 == 0 else 2 if x % 3 == 1 else 1))
    c.HL(7, 9, 52, J('machiya_timber', 1))
    # 2. 오른쪽 3/4 노송나무(히노키) 욕실 마루 데크 (윗면 판재 + 앞면 두께)
    rect_3d(c, 64, 10, 28, 22, 14, 'aged_cedar', top_t=3, front_t=1)
    for dy in range(14, 24, 4):
        c.HL(65, dy, 26, J('aged_cedar', 2))
    # 데크 위 나무 목욕통(오케) 2개
    for bx, by in ((69, 13), (80, 16)):
        c.R(bx, by, 7, 6, OL)
        c.R(bx + 1, by + 1, 5, 2, J('tatami_straw', 4))
        c.R(bx + 1, by + 3, 5, 2, J('aged_cedar', 3))
    # 3. 3/4 온천 암석 수조 바닥 + 청록 온천수
    cx, cy = 44, 38
    disc(c, cx, cy + 3, 39, OL, ry=20)
    disc(c, cx, cy, 34, J('onsen_mineral_teal', 1), ry=16)
    disc(c, cx, cy - 1, 31, J('onsen_mineral_teal', 2), ry=14)
    disc(c, cx - 2, cy - 2, 24, J('onsen_mineral_teal', 3), ry=10)
    # 물결 하이라이트 줄
    for wx, wy, ww in ((26, 33, 12), (44, 30, 14), (32, 41, 16), (50, 38, 10), (36, 46, 11)):
        c.HL(wx, wy, ww, J('onsen_mineral_teal', 4))
    # 4. 3/4 자연석 테두리 바위들 (각 바위마다 윗면 밝은 단 + 정면 중간/어두운 단 + 1px OL)
    boulders = []
    for k in range(20):
        ang = k / 20.0 * math.pi * 2
        rx = cx + math.cos(ang) * 34.5
        ry = cy + math.sin(ang) * 16.5
        rw = 6.2 + (k % 3) * 1.1
        rh = 4.6 + ((k + 1) % 2) * 0.9
        boulders.append((ry, rx, rw, rh, k))
    boulders.sort(key=lambda b: b[0])  # 뒤쪽 바위부터 앞쪽 바위 순으로 겹쳐 그린다
    for ry, rx, rw, rh, k in boulders:
        mat = 'wet_cobble' if k % 2 == 0 else 'shrine_flagstone'
        disc(c, rx, ry + 1.2, rw + 1.0, OL, ry=rh + 1.0)
        disc(c, rx, ry + 0.8, rw, J(mat, 1), ry=rh)
        disc(c, rx, ry - 0.4, rw * 0.92, J(mat, 2), ry=rh * 0.82)
        disc(c, rx - 0.8, ry - 1.2, rw * 0.68, J(mat, 3), ry=rh * 0.58)
        disc(c, rx - 1.4, ry - 1.8, rw * 0.38, J(mat, 4), ry=rh * 0.34)
    # 5. 온천수 대나무 홈통(湯口) + 떨어지는 온천 물줄기 (오른쪽 마루 데크에서 탕 안쪽으로)
    c.R(58, 20, 14, 5, OL)
    c.R(59, 21, 12, 2, J('moss', 4)); c.R(59, 23, 12, 1, J('pine_bamboo', 2))
    c.R(57, 24, 3, 9, J('vending_cool_white', 4)); c.VL(59, 24, 9, J('onsen_mineral_teal', 4))
    disc(c, 58, 33, 4.0, J('vending_cool_white', 4), ry=1.8)
    # 6. 모락모락 피어오르는 온천 김 클러스터
    steam_puff(c, 28, 8, 22, seed=1, width=5)
    steam_puff(c, 46, 6, 24, seed=2, width=5)


@kit('rg-yukemuri', '湯けむり 김 기둥(온천 도랑·湯畑에서 오르는 흰 김, 2×3)', 2, 3, 'effect', solid=[],
     tags=['온천', '김', '湯けむり', '湯畑'], rules='온천 마을 도랑·湯畑·노천탕 위에 겹쳐 둔다(통행을 막지 않는다).', role='prop')
def yukemuri(c, base):
    # 3/4 노송나무 온천 원천 틀(湯畑 木枠) 윗면 + 정면 + 그 위로 피어오르는 뭉게 김
    rect_3d(c, 3, 32, 26, 14, 6, 'aged_cedar', top_t=3, front_t=2)
    c.R(6, 34, 20, 4, J('onsen_mineral_teal', 3))
    c.HL(8, 35, 16, J('onsen_mineral_teal', 4))
    c.VL(11, 34, 4, J('aged_cedar', 2)); c.VL(20, 34, 4, J('aged_cedar', 2))
    steam_puff(c, 10, 3, 30, seed=5, width=6)
    steam_puff(c, 20, 8, 25, seed=8, width=5)


@kit('rg-waterfall', '폭포 - 이끼 바위 절벽·떨어지는 물줄기·물보라 소(4×6)', 4, 6, 'water', solid=rows(4, range(6)),
     tags=['폭포', '계곡', '절벽', '등산로'], rules='계곡 맵 북쪽 끝 절벽. 아래로 수로(fill_region 「수로」)를 이어 강을 만든다.', role='structure')
def waterfall(c, base):
    # 1. 3/4 절벽 상단(y=0..16): 이끼 바위 윗면 테라스 + 상류 물길
    c.R(0, 0, 64, 96, OL)
    c.R(1, 1, 62, 14, J('shrine_flagstone', 3))
    for x in (1, 52):
        c.R(x, 1, 11, 12, J('moss', 2)); c.R(x + 1, 2, 8, 6, J('moss', 3))
    # 상류 수면 (y=1..15, x=18..46)
    c.R(18, 1, 28, 14, J('canal_indigo', 2))
    c.R(20, 1, 24, 14, J('onsen_mineral_teal', 3))
    for wy in (3, 7, 11):
        c.HL(22, wy, 20, J('vending_cool_white', 4))
    # 절벽 상단 턱 (y=14..16)
    c.HL(1, 14, 17, J('shrine_flagstone', 4)); c.HL(46, 14, 17, J('shrine_flagstone', 4))
    c.HL(1, 15, 17, OL); c.HL(46, 15, 17, OL)

    # 2. 계단식 바위 절벽 정면 (y=16..76) + 중간 바위 턱(y=44..48)
    stones(c, 1, 16, 62, 60, seed=51, course=(7, 10), width=(9, 15), moss=0.32)
    # 중간 계단식 바위 선반 윗면 (3/4 깊이감)
    c.R(1, 43, 18, 4, J('shrine_flagstone', 4)); c.HL(1, 47, 18, OL)
    c.R(45, 45, 18, 4, J('shrine_flagstone', 4)); c.HL(45, 49, 18, OL)

    # 3. 2단 폭포 물줄기 (x=18..46, y=14..78)
    c.VL(17, 14, 64, OL); c.VL(46, 14, 64, OL)
    streams = ((19, 3, 2), (22, 4, 5), (26, 2, 1), (28, 5, 0), (33, 3, 4), (36, 4, 2), (40, 3, 6), (43, 2, 3))
    for y in range(14, 78):
        step_ledge = 43 <= y <= 46
        for x in range(18, 46):
            if x in (18, 45):
                c.P(x, y, J('canal_indigo', 1)); continue
            if step_ledge:
                c.P(x, y, J('vending_cool_white', 4 if y <= 44 else 3)); continue
            col = J('onsen_mineral_teal', 2)
            for sx, sw, ph in streams:
                if sx <= x < sx + sw:
                    cyc = (y + ph * 3) % (11 + (sw * 2))
                    if cyc < 5:
                        col = J('vending_cool_white', 4 if (x == sx or cyc < 2) else 3)
                    elif cyc < 9:
                        col = J('onsen_mineral_teal', 3)
                    else:
                        col = J('canal_indigo', 2)
                    break
            c.P(x, y, col)

    # 4. 3/4 폭포수 소(滝壺, y=72..95) + 거품 물보라 클러스터 + 바위 테두리
    disc(c, 32, 84, 30, OL, ry=11)
    disc(c, 32, 84, 28, J('canal_indigo', 2), ry=10)
    disc(c, 32, 83, 24, J('onsen_mineral_teal', 3), ry=8)
    disc(c, 32, 78, 16, J('vending_cool_white', 3), ry=5)
    disc(c, 32, 77, 11, J('vending_cool_white', 4), ry=3.5)
    for bx, by in ((8, 78), (55, 79), (14, 88), (50, 88)):
        disc(c, bx, by, 5, OL, ry=3.5)
        disc(c, bx, by - 0.5, 4, J('wet_cobble', 3), ry=2.5)


@kit('rg-tsuribashi', '출렁다리(吊り橋) - 나무 발판·밧줄 난간·양끝 기둥(8×2)', 8, 2, 'bridge', solid=[],
     tags=['출렁다리', '吊り橋', '계곡', '다리'], rules='계곡 물(수로) 위를 가로로 건넌다. 아래 줄이 걷는 발판, 양끝 칸이 땅에 닿게 놓는다.', role='structure')
def tsuribashi(c, base):
    # 1. 3/4 다리 바닥층(base, y=16..31 만 사용하여 100% 불투명 보장): 나무 발판 윗면(y=17..27) + 앞면 두께(y=28..30) + 물 그림자(y=31)
    base.HL(0, 16, 128, OL)
    for x in range(128):
        k = x % 4
        for y in range(17, 28):
            if k == 3:
                col = OL
            else:
                lv = 4 if (y == 17 or k == 0) else 3 if y < 25 else 2
                col = J('aged_cedar', lv)
            base.P(x, y, col)
        base.P(x, 28, J('aged_cedar', 1))
        base.P(x, 29, J('machiya_timber', 0))
        base.P(x, 30, OL)
        base.P(x, 31, J('canal_indigo', 0))
    base.HL(0, 18, 128, J('machiya_timber', 1))
    base.HL(0, 26, 128, J('machiya_timber', 1))

    # 2. 양끝 석조 교대(3/4 윗면 + 정면) + 목조 주탑 기둥 쌍
    for ax in (0, 116):
        plinth_34(c, ax, 10, 12, 20, top_h=5, mat='shrine_flagstone')
        # 뒤쪽 주탑 기둥
        trunk_34(c, ax + 2, 1, 4, 16, 'machiya_timber', 2)
        # 앞쪽 주탑 기둥
        trunk_34(c, ax + 6, 4, 4, 24, 'aged_cedar', 3)
        # 기둥 위 가로 관목
        rect_3d(c, ax + 1, 1, 10, 4, 1, 'aged_cedar', top_t=4, front_t=2)

    # 3. 3/4 뒤쪽 케이블 난간 + 앞쪽 케이블 난간 + 세로 현수 로프
    for x in range(10, 118):
        sag = round(math.sin((x - 10) / 108.0 * math.pi) * 5.0)
        by = 3 + sag
        fy = 15 + sag // 2
        # 뒤쪽 주 케이블 (OL + 짚색)
        c.P(x, by - 1, OL); c.P(x, by, J('tatami_straw', 4)); c.P(x, by + 1, OL)
        # 앞쪽 주 케이블
        c.P(x, fy - 1, OL); c.P(x, fy, J('tatami_straw', 3)); c.P(x, fy + 1, OL)
        if (x - 10) % 9 == 0:
            c.VL(x, by + 2, 14 - by, J('tatami_straw', 2))
            c.VL(x + 1, by + 2, 14 - by, OL)
            c.VL(x, fy + 2, 28 - fy, J('tatami_straw', 2))
            c.VL(x + 1, fy + 2, 28 - fy, OL)


# ----------------------------- 바다·항구 -----------------------------
@kit('rg-lighthouse', '등대(灯台) - 흰 탑·전망 난간·불 켜진 등실·붉은 지붕(3×8)', 3, 8, 'landmark', solid=[(0, 7), (1, 7), (2, 7), (1, 6)],
     tags=['등대', '灯台', '항구', '방파제', '해안'], rules='방파제 끝이나 곶 끝. 한 맵에 하나.', role='structure')
def lighthouse(c, base):
    # 1. 3/4 팔각 콘크리트 기단(윗면 테라스 y=104..111 + 정면 벽 y=112..126 + 출입문)
    plinth_34(c, 4, 104, 40, 23, top_h=7, mat='concrete_grey')
    c.R(19, 113, 10, 13, OL)
    c.R(20, 114, 8, 12, J('noren_indigo', 1))
    c.HL(20, 114, 8, J('vending_cool_white', 4))
    c.P(26, 120, J('lantern_amber', 4))

    # 2. 3/4 원통형 흰 탑신 (위로 갈수록 좁아지며 타원형 이음 띠가 3/4 곡률을 보여준다)
    for y in range(30, 106):
        f = (y - 30) / 75.0
        hw = round(10.5 + 5.5 * f)
        a, b = 24 - hw, 24 + hw
        c.P(a - 1, y, OL); c.P(b, y, OL)
        ring = y in (48, 68, 88)
        for x in range(a, b):
            u = (x - a) / max(1, b - a - 1)
            lv = 4 if u < 0.35 else 3 if u < 0.72 else 2 if u < 0.9 else 1
            if ring: lv = max(0, lv - 1)
            c.P(x, y, J('vending_cool_white', lv))
    # 탑신 밑동 3/4 타원 몰딩
    c.HL(8, 105, 32, J('vending_cool_white', 2))
    c.HL(8, 106, 32, OL)
    # 채광창 3개 (테두리 OL + 유리 하이라이트)
    for wy in (40, 60, 80):
        c.R(21, wy, 6, 7, OL)
        c.R(22, wy + 1, 4, 5, J('arcade_skylight_slate', 2))
        c.P(22, wy + 1, J('arcade_skylight_slate', 4))
        c.HL(21, wy + 7, 6, J('vending_cool_white', 4))

    # 3. 3/4 전망대 갤러리 데크 (타원 윗면 바닥 + 쇠 난간)
    disc(c, 24, 28, 16, OL, ry=4.5)
    disc(c, 24, 28, 15, J('kawara_dark_tile', 2), ry=3.5)
    disc(c, 24, 27, 13, J('concrete_grey', 3), ry=2.5)
    # 난간 기둥과 상부 링
    c.HL(10, 22, 28, OL); c.HL(10, 23, 28, J('kawara_dark_tile', 4))
    for rx in range(10, 39, 4):
        c.VL(rx, 23, 5, OL)

    # 4. 등실(유리 격자 + 밝은 호박색 등불) + 3/4 붉은 돔 지붕 + 피뢰침
    c.R(15, 12, 18, 12, OL)
    c.R(16, 13, 16, 10, J('lantern_amber', 3))
    c.R(18, 14, 8, 8, J('lantern_amber', 4))
    for gx in (19, 24, 29): c.VL(gx, 13, 10, OL)
    c.HL(16, 17, 16, OL)
    # 붉은 돔 지붕 (3/4 구형 명암 + 처마 테 + OL)
    disc(c, 24, 11, 11, OL, ry=6.5)
    disc(c, 24, 11, 10, J('torii_vermilion', 2), ry=5.5)
    disc(c, 22, 9.5, 6.5, J('torii_vermilion', 3), ry=3.5)
    disc(c, 21, 8.5, 3.2, J('torii_vermilion', 4), ry=2.0)
    c.HL(13, 12, 22, OL)
    c.VL(24, 1, 5, OL); c.P(24, 3, J('lantern_amber', 4))


@kit('rg-fishing-boat', '어선(漁船) - 흰 선체·쪽빛 띠·조타실·大漁旗(6×3)', 6, 3, 'boat', solid=rows(6, (0, 1, 2)),
     tags=['어선', '항구', '어시장', '바다'], rules='항구 물(바다) 위, 부두(콘크리트)에 붙여 댄다. 2~3척을 엇갈려 둔다.', role='prop')
def fishing_boat(c, base):
    # 1. 수면 접지 물결 그림자
    disc(c, 48, 36, 44, J('canal_indigo', 0), ry=9)
    # 2. 3/4 선체: 위에서 내려다본 배 모양 타원 갑판(나무 데크 y=18..31) + 흰 불워크 테두리 + 정면 선체 외판(y=31..43)
    for y in range(18, 44):
        for x in range(4, 92):
            # 뱃머리(오른쪽 x=91)가 뾰족하고 선미(왼쪽 x=5)가 각진 3/4 배 윤곽
            u = (x - 6) / 84.0
            half_w = 10.5 * math.sin(min(1.0, u * 1.15) * math.pi * 0.85 + 0.25) * (1.0 - max(0.0, u - 0.65) * 1.6)
            deck_cy = 25.0
            hull_bot = deck_cy + half_w + 9.0 * (1.0 - max(0.0, u - 0.78) * 1.8)
            deck_top = deck_cy - half_w * 0.72
            deck_front = deck_cy + half_w * 0.78
            if y < round(deck_top) or y > round(hull_bot):
                continue
            if y == round(deck_top) or y == round(hull_bot) or x in (5, 90):
                c.P(x, y, OL)
            elif y <= round(deck_top) + 2:
                # 뒤쪽 난간(건웨일) 윗면
                c.P(x, y, J('vending_cool_white', 4 if y == round(deck_top) + 1 else 2))
            elif y < round(deck_front):
                # 3/4 나무 갑판 윗면 (판자 결이 보임!)
                plank = (y - round(deck_top)) % 3 == 0
                c.P(x, y, J('aged_cedar', 2 if plank else 3))
            elif y == round(deck_front):
                # 앞쪽 건웨일 상단 밝은 테
                c.P(x, y, J('vending_cool_white', 4))
            elif y == round(deck_front) + 1:
                c.P(x, y, OL)
            else:
                # 선체 정면 외판 (흰색 + 쪽빛 띠 + 흘수선 그늘)
                hy = y - (round(deck_front) + 2)
                if 3 <= hy <= 5:
                    c.P(x, y, J('noren_indigo', 3 if hy == 3 else 2))
                elif y >= round(hull_bot) - 2:
                    c.P(x, y, J('torii_vermilion', 1))
                else:
                    c.P(x, y, J('vending_cool_white', 3 if hy < 3 else 2))
    # 갑판 위 어창 해치 2개 (3/4 직육면체)
    rect_3d(c, 50, 21, 12, 7, 3, 'concrete_grey', top_t=3, front_t=2)
    rect_3d(c, 64, 22, 10, 6, 3, 'noren_indigo', top_t=3, front_t=2)
    # 선체 측면 검은 방충 타이어 3개
    for fx in (18, 42, 66):
        disc(c, fx, 36, 2.8, OL); disc(c, fx, 36, 1.6, J('kawara_dark_tile', 2))

    # 3. 3/4 조타실(브리지): 지붕 윗면(y=5..10) + 정면 유리창과 문(y=11..24) + 마스트·집어등·대어기
    rect_3d(c, 20, 6, 26, 19, 5, 'vending_cool_white', top_t=4, front_t=3)
    # 조타실 앞 유리창
    c.R(23, 13, 20, 6, OL)
    c.R(24, 14, 18, 4, J('arcade_skylight_slate', 2))
    c.HL(24, 14, 18, J('arcade_skylight_slate', 4))
    c.VL(30, 14, 4, OL); c.VL(36, 14, 4, OL)
    # 마스트 + 대어기(大漁旗, 1px OL 포함) + 집어등
    c.R(55, 1, 3, 20, OL); c.VL(56, 2, 18, J('aged_cedar', 3))
    c.R(57, 1, 18, 11, OL)
    c.R(58, 2, 16, 9, J('torii_vermilion', 3))
    c.R(58, 5, 16, 3, J('lantern_amber', 4))
    c.R(61, 3, 6, 3, J('vending_cool_white', 4))
    c.R(58, 9, 16, 2, J('noren_indigo', 3))
    for lx in (14, 48, 72):
        c.R(lx - 1, 14, 4, 4, OL); c.R(lx, 15, 2, 2, J('lantern_amber', 4))


@kit('rg-tetrapod', '테트라포드 무리(방파제 소파 블록, 4×2)', 4, 2, 'rock', solid=rows(4, (0, 1)),
     tags=['테트라포드', '방파제', '항구', '해안'], rules='방파제 바다 쪽 가장자리에 줄지어 놓는다.', role='prop')
def tetrapod(c, base):
    # 수면/바닥 접지 어두운 테
    for px, py in ((13, 18), (31, 22), (49, 18), (22, 26), (40, 26)):
        disc(c, px, py + 3, 10, J('canal_indigo', 0), ry=4)
    t = Cv(c.w, c.h)
    pods = ((13, 13), (31, 15), (49, 12), (22, 21), (41, 21))
    for k, (x, y) in enumerate(pods):
        # 4개의 원뿔형 콘크리트 다리: 위쪽 다리는 타원 윗면 단면이 뚜렷하게 보인다
        legs = ((0, -7, 4), (-7, 4, 3), (7, 4, 1), (0, 6, 2))
        for ex, ey, lv in legs:
            for s in range(8):
                f = s / 7.0
                r = 4.4 - f * 1.4
                disc(t, x + ex * f, y + ey * f, r, J('concrete_grey', lv))
            # 각 다리 끝 3/4 원형 단면 하이라이트
            disc(t, x + ex, y + ey, 2.6, J('concrete_grey', min(4, lv + 1)), ry=2.0)
        disc(t, x - 1, y - 1, 3.0, J('concrete_grey', 4))
    add_outline(t)
    for y in range(c.h):
        for x in range(c.w):
            if t.a[y, x, 3]:
                c.P(x, y, (int(t.a[y, x, 0]) << 16) | (int(t.a[y, x, 1]) << 8) | int(t.a[y, x, 2]))


# ----------------------------- 산·고원 -----------------------------
@kit('rg-ropeway', '로프웨이 산정역 - 콘크리트 역사·승강구·쇠줄 두 가닥·붉은 곤돌라(7×6)', 7, 6, 'landmark', solid=rows(7, (3, 4, 5)),
     tags=['로프웨이', '케이블카', '전망대', '산'], rules='고원 맵 아래쪽 끝. 쇠줄이 맵 밖(위·오른쪽)으로 나간다.', role='structure')
def ropeway(c, base):
    # 1. 3/4 콘크리트 기단 및 앞 승강 계단
    plinth_34(c, 4, 86, 104, 10, top_h=3, mat='concrete_grey')
    # 2. 3/4 평지붕 옥상 데크(y=26..46, 깊이 20px!) + 파라펫 난간 + 옥상 권상기 기계실
    rect_3d(c, 6, 26, 100, 62, 20, 'concrete_grey', top_t=3, front_t=2)
    # 옥상 방수 판 줄눈과 파라펫 안쪽 테두리
    c.R(9, 29, 94, 14, J('concrete_grey', 2))
    for rx in range(20, 100, 16): c.VL(rx, 29, 14, J('concrete_grey', 1))
    c.HL(9, 36, 94, J('concrete_grey', 1))
    # 옥상 오른쪽 케이블 권상기 하우스(3/4 상자) + 대형 활차(불휠)
    rect_3d(c, 58, 16, 36, 20, 7, 'kawara_dark_tile', top_t=3, front_t=2)
    disc(c, 76, 21, 9, OL, ry=3.5); disc(c, 76, 21, 7.5, J('noren_rust', 3), ry=2.5)
    # 3. 정면 파사드(y=47..86): 왼쪽 대합실 창문·출입문 + 오른쪽 승강구 베이 + 간판
    for px in (22, 50, 100):
        c.VL(px, 47, 39, J('concrete_grey', 1)); c.VL(px + 1, 47, 39, J('concrete_grey', 3))
    # 대합실 파노라마 유리창
    c.R(12, 53, 34, 15, OL)
    c.R(13, 54, 32, 13, J('arcade_skylight_slate', 2))
    c.HL(13, 54, 32, J('arcade_skylight_slate', 4))
    for wx in (23, 34): c.VL(wx, 54, 13, OL)
    c.HL(11, 68, 36, J('vending_cool_white', 4))
    # 대합실 출입문
    c.R(18, 71, 18, 16, OL); c.R(19, 72, 16, 14, J('aged_cedar', 2))
    c.VL(27, 72, 14, OL); c.R(21, 74, 5, 5, J('arcade_skylight_slate', 3)); c.R(29, 74, 5, 5, J('arcade_skylight_slate', 3))
    # 오른쪽 곤돌라 승강 베이 (3/4 안쪽 승강장 바닥과 안전 난간이 보인다)
    c.R(54, 58, 44, 29, OL)
    c.R(55, 59, 42, 18, J('kawara_dark_tile', 0))
    c.R(55, 77, 42, 9, J('paving_stone', 2))
    c.HL(55, 77, 42, J('lantern_amber', 3))  # 승강장 안전 노란 선
    # 승강구 위 간판
    c.R(54, 48, 44, 8, OL); c.R(55, 49, 42, 6, J('vending_cool_white', 4))
    for k in range(6): c.R(58 + k * 6, 51, 4, 3, J('noren_indigo', 2))

    # 4. 복선 케이블(OL + 철색) + 3/4 붉은 곤돌라 캐빈(지붕 윗면 + 정면 창 + 현수기)
    for off in (0, 7):
        line(c, 74, 36 - off, 110, 2 + off // 2, OL)
        line(c, 74, 37 - off, 110, 3 + off // 2, J('kawara_dark_tile', 3))
    gx, gy = 86, 8
    c.R(gx + 6, gy - 5, 3, 6, OL)
    rect_3d(c, gx, gy, 18, 16, 4, 'torii_vermilion', top_t=4, front_t=3)
    c.R(gx + 2, gy + 6, 14, 5, OL)
    c.R(gx + 3, gy + 7, 12, 3, J('arcade_skylight_slate', 3))
    c.HL(gx + 1, gy + 12, 16, J('vending_cool_white', 4))


@kit('rg-lodge', '산장(山小屋) - 통나무 벽·녹슨 함석 박공 지붕·돌 굴뚝·간판(7×6)', 7, 6, 'building', solid=rows(7, (3, 4, 5)),
     tags=['산장', '山小屋', '고원', '등산로'], rules='고원·습원 탐방로 갈림길. 문 앞 한 칸(아래 가운데)은 비운다.', role='structure')
def lodge(c, base):
    # 1. 오른쪽 뒤 석조 굴뚝 (3/4 윗면 아가리 + 정면 돌 줄눈 + 연기)
    rect_3d(c, 82, 4, 13, 30, 4, 'shrine_flagstone', top_t=4, front_t=2)
    c.R(85, 5, 7, 2, J('kawara_dark_tile', 0))
    for cy in range(12, 30, 5): c.HL(83, cy, 11, J('shrine_flagstone', 0))
    steam_puff(c, 88, 0, 5, seed=3, width=4)

    # 2. 3/4 우진각/맞배 녹슨 함석 지붕 (단순 삼각형 대신 넓은 경사 기와/함석 윗면 y=12..50!)
    hip_metal_roof_34(c, 6, 12, 100, 38, mat='noren_rust', ridge_mat='kawara_dark_tile')
    # 지붕 중앙 작은 채광 다락창(도머, 3/4 지붕 + 창)
    rect_3d(c, 46, 22, 20, 14, 4, 'aged_cedar', top_t=4, front_t=2)
    c.R(49, 28, 14, 6, OL); c.R(50, 29, 12, 4, J('lantern_amber', 4))

    # 3. 석조 기단(y=84..95) + 정면 통나무 벽(y=50..84) + 양끝 교차 통나무 마구리
    plinth_34(c, 8, 84, 96, 11, top_h=3, mat='shrine_flagstone')
    c.R(10, 50, 92, 35, OL)
    for y in range(51, 84):
        r = (y - 51) % 5
        lv = 3 if r == 0 else 2 if r < 3 else 1 if r == 3 else 0
        c.HL(11, y, 90, J('aged_cedar', lv))
    # 좌우 통나무 교차 마구리 단면
    for row in range(6):
        ry = 52 + row * 5
        for ex in (9, 101):
            c.R(ex - 2, ry, 5, 4, OL)
            c.R(ex - 1, ry + 1, 3, 2, J('aged_cedar', 4))

    # 4. 따뜻한 불 켜진 격자 창문 2개 + 현관 포치 계단 + 문 + 현판 + 장작 더미
    for wx in (18, 76):
        c.R(wx - 1, 58, 18, 15, OL)
        c.R(wx, 59, 16, 13, J('lantern_amber', 3))
        c.R(wx + 1, 60, 6, 11, J('lantern_amber', 4))
        c.VL(wx + 8, 59, 13, OL); c.HL(wx, 65, 16, OL)
        c.HL(wx - 1, 73, 18, J('aged_cedar', 4))
    # 현관 문 + 돌계단
    c.R(47, 62, 18, 23, OL); c.R(48, 63, 16, 21, J('machiya_timber', 2))
    c.VL(56, 63, 21, OL); c.R(50, 66, 5, 6, J('lantern_amber', 3)); c.R(57, 66, 5, 6, J('lantern_amber', 3))
    c.R(44, 85, 24, 10, OL)
    c.R(45, 86, 22, 4, J('shrine_flagstone', 4)); c.HL(45, 90, 22, OL)
    c.R(45, 91, 22, 3, J('shrine_flagstone', 3))
    # 현관 위 나무 현판 + 왼쪽 벽 밑 장작 더미
    rect_3d(c, 42, 51, 28, 9, 2, 'aged_cedar', top_t=4, front_t=3)
    for k in range(4): c.R(45 + k * 6, 55, 4, 3, J('machiya_timber', 0))
    rect_3d(c, 14, 76, 22, 9, 3, 'aged_cedar', top_t=4, front_t=2)
    for lx in range(16, 34, 4):
        c.R(lx, 80, 3, 3, J('aged_cedar', 4)); c.P(lx + 1, 81, J('machiya_timber', 1))


@kit('rg-tunnel', '폐선 터널 입구 - 벽돌·돌 아치·검은 굴·담쟁이·녹슨 레일(6×5)', 6, 5, 'structure', solid=rows(6, range(5)),
     tags=['터널', '폐선', '廃線', '유적', '숲'], rules='폐선 맵 북쪽 끝. 아래로 rg 폐선 선로(「폐선 녹슨 선로」)를 이어 깐다.', role='structure')
def tunnel(c, base):
    # 1. 3/4 터널 상부 산비탈 둑 윗면(y=0..16, 이끼와 수풀) + 상단 석조 파라펫 두겁돌(y=16..22)
    c.R(0, 0, 96, 79, OL)
    for y in range(1, 16):
        for x in range(1, 95):
            lv = 3 if y < 6 else 2 if y < 12 else 1
            if H(x // 2, y // 2, 17) > 0.65: lv = min(4, lv + 1)
            c.P(x, y, J('moss', lv))
    for bx, by, rx, ry in ((14, 8, 10, 5), (38, 7, 12, 5), (62, 7, 11, 5), (82, 8, 10, 5)):
        disc(c, bx, by, rx, J('pine_bamboo', 2), ry=ry)
        disc(c, bx - 1, by - 1, rx * 0.65, J('pine_bamboo', 3), ry=ry * 0.65)
    # 상단 파라펫 갓돌(3/4 윗면 밝은 단 + 정면 턱 + OL)
    c.R(1, 15, 94, 4, J('shrine_flagstone', 4))
    for sx in range(12, 90, 12): c.VL(sx, 15, 4, J('shrine_flagstone', 2))
    c.HL(1, 19, 94, J('shrine_flagstone', 2))
    c.HL(1, 20, 94, OL)

    # 2. 터널 정면 석축 면벽(y=21..78) + 좌우 부벽(필라스터, 3/4 윗면 캡 포함)
    stones(c, 1, 21, 94, 57, mat='shrine_flagstone', seed=61, course=(6, 7), width=(9, 14), moss=0.26)
    for px in (2, 82):
        rect_3d(c, px, 18, 12, 60, 4, 'shrine_flagstone', top_t=4, front_t=3)
        for py in range(28, 76, 8): c.HL(px + 1, py, 10, J('shrine_flagstone', 1))

    # 3. 3/4 아치형 굴 입구: 쐐기돌(보수아르) 링 + 안쪽 아치 두께 벽 + 깊은 어둠
    for y in range(28, 79):
        for x in range(20, 76):
            dy = max(0, 48 - y)
            d = ((x - 48) / 27.0) ** 2 + (dy / 20.0) ** 2
            if d > 1.0: continue
            if d > 0.76:
                # 쐐기돌 아치 테두리
                ang = math.atan2(dy, x - 48)
                seg = int(ang / math.pi * 11) % 2
                c.P(x, y, OL if d > 0.93 else J('shrine_flagstone', 4 if seg == 0 else 3))
            elif d > 0.62:
                c.P(x, y, OL)
            else:
                # 3/4 터널 내부 왼쪽 안벽 두께가 살짝 보인 뒤 깊은 어둠으로 들어간다
                inner = x < 28 + (48 - y) // 5
                c.P(x, y, J('wet_cobble', 1) if inner else K('sumi', 0))

    # 4. 터널 굴 속에서 밖으로 이어지는 3/4 자갈 도상·침목·녹슨 레일 (y=58..79)
    for y in range(58, 79):
        for x in range(27, 69):
            c.P(x, y, J('gravel', 1 if y < 66 else 2))
    for ty in range(60, 79, 5):
        c.R(30, ty, 36, 2, J('machiya_timber', 2)); c.HL(30, ty + 2, 36, OL)
    for rx in (36, 58):
        c.VL(rx - 1, 58, 21, OL)
        c.VL(rx, 58, 21, J('noren_rust', 3))
        c.VL(rx + 1, 58, 21, J('noren_rust', 1))
        c.VL(rx + 2, 58, 21, OL)

    # 5. 입구 위 현판석 + 드리운 담쟁이 덩굴
    rect_3d(c, 38, 21, 20, 7, 2, 'shrine_flagstone', top_t=4, front_t=3)
    for vx, vlen in ((16, 22), (76, 26)):
        for vy in range(21, 21 + vlen, 3):
            disc(c, vx + (vy % 2), vy, 2.2, J('pine_bamboo', 3))


# ----------------------------- 마을·논·축제 -----------------------------
@kit('rg-kakashi', '허수아비(案山子) - 밀짚모자·쪽빛 옷·팔 막대(1×2)', 1, 2, 'figure', solid=[(0, 1)],
     tags=['허수아비', '논', '시골'], rules='논 한가운데·논두렁 끝에 하나씩.', role='prop')
def kakashi(c, base):
    t = Cv(c.w, c.h)
    # 3/4 발치 흙 둔덕
    disc(t, 8, 29, 5.5, J('aged_cedar', 1), ry=2.2)
    disc(t, 8, 28, 4.5, J('moss', 2), ry=1.6)
    # 기둥과 가로 팔 막대
    t.R(7, 10, 3, 19, J('aged_cedar', 2)); t.VL(7, 10, 19, J('aged_cedar', 4))
    t.R(1, 12, 14, 3, J('aged_cedar', 3)); t.HL(1, 12, 14, J('aged_cedar', 4))
    # 쪽빛 기모노 몸통 + 붉은 띠(오비)
    t.R(4, 12, 8, 11, J('noren_indigo', 2))
    t.VL(4, 12, 11, J('noren_indigo', 3)); t.VL(11, 12, 11, J('noren_indigo', 1))
    t.HL(4, 17, 8, J('torii_vermilion', 3)); t.HL(4, 18, 8, J('torii_vermilion', 2))
    # 자루 얼굴 + 3/4 넓은 삿갓(밀짚모자 윗면과 챙)
    disc(t, 8, 8.5, 3.2, J('cream_stucco', 3))
    disc(t, 8, 5.5, 6.2, J('tatami_straw', 2), ry=2.8)
    disc(t, 8, 4.8, 5.2, J('tatami_straw', 3), ry=2.2)
    disc(t, 7.5, 3.8, 3.0, J('tatami_straw', 4), ry=1.5)
    add_outline(t)
    for y in range(c.h):
        for x in range(c.w):
            if t.a[y, x, 3]:
                c.P(x, y, (int(t.a[y, x, 0]) << 16) | (int(t.a[y, x, 1]) << 8) | int(t.a[y, x, 2]))


@kit('rg-hazakake', '볏단 걸이(はざ掛け) - 나무 장대·가로대·말리는 볏단(4×2)', 4, 2, 'rack', solid=[(0, 1), (1, 1), (2, 1), (3, 1)],
     tags=['볏단', 'はざ掛け', '논', '가을', '시골'], rules='논두렁을 따라 가로로 이어 놓는다(가을).', role='prop')
def hazakake(c, base):
    # 바닥 접지 그림자
    c.R(2, 27, 60, 4, SHADE)
    t = Cv(c.w, c.h)
    # 양끝 + 중앙 A자 삼나무 버팀 다리 (앞다리 + 뒤쪽으로 뻗은 3/4 보조 다리)
    for px in (5, 31, 57):
        line(t, px, 4, px - 3, 29, J('aged_cedar', 3))
        line(t, px + 1, 4, px - 2, 29, J('aged_cedar', 2))
        line(t, px, 4, px + 3, 27, J('aged_cedar', 1))
        line(t, px + 1, 4, px + 4, 27, J('aged_cedar', 0))
    # 상단 가로 장대
    t.R(2, 5, 60, 3, J('aged_cedar', 3)); t.HL(2, 5, 60, J('aged_cedar', 4))
    # 3/4 볏단 걸이: 위에서 본 둥근 볏단 등(y=6..11, 밝은 짚색) + 아래로 늘어진 볏단 앞면(y=12..25)
    for bx in range(6, 56, 6):
        # 3/4 윗면 아치형 볏단 묶음
        disc(t, bx + 2, 9, 3.2, J('tatami_straw', 4), ry=2.6)
        t.HL(bx, 10, 5, J('torii_vermilion', 2))  # 묶은 새끼줄
        # 정면 볏단 술
        for y in range(11, 25):
            for i in range(5):
                lv = 3 if i < 2 else 2 if i < 4 else 1
                if y >= 22: lv = max(0, lv - 1)
                t.P(bx + i, y, J('tatami_straw', lv))
        # 앞쪽 갈래와 뒤쪽 갈래 사이 어두운 틈(3/4 깊이)
        t.VL(bx + 2, 18, 7, J('tatami_straw', 0))
    add_outline(t)
    for y in range(c.h):
        for x in range(c.w):
            if t.a[y, x, 3]:
                c.P(x, y, (int(t.a[y, x, 0]) << 16) | (int(t.a[y, x, 1]) << 8) | int(t.a[y, x, 2]))


@kit('rg-yatai', '축제 포장마차(屋台) - 주홍·흰 줄무늬 차양·초롱·쪽빛 노렌·나무 매대(4×3)', 4, 3, 'stall', solid=[(0, 2), (1, 2), (2, 2), (3, 2)],
     tags=['포장마차', '屋台', '축제', '마츠리', '야시장'], rules='축제 마당 참배길 양옆에 마주 보게 줄지어 놓는다. 사이에 초롱 줄(jp-prop-string-lanterns4).', role='prop')
def yatai(c, base):
    # 1. 바닥 접지 그림자
    c.R(3, 44, 58, 3, SHADE)
    # 2. 3/4 경사 줄무늬 차양 지붕(윗면 경사 y=2..14 + 용마루 + 물결 프릴 y=14..17 + 전체 OL)
    c.HL(5, 1, 54, OL)
    c.HL(5, 2, 54, J('aged_cedar', 4))  # 나무 용마루 대
    for y in range(3, 14):
        ins = max(0, (13 - y) // 4)
        xs, xe = 3 + ins, 61 - ins
        c.P(xs - 1, y, OL); c.P(xe, y, OL)
        for x in range(xs, xe):
            stripe = ((x - 3) // 6) % 2
            hi = y < 8
            if stripe == 0:
                col = J('torii_vermilion', 3 if hi else 2)
            else:
                col = J('vending_cool_white', 4 if hi else 3)
            if (x - 3) % 6 == 5:
                col = J('torii_vermilion', 1) if stripe == 0 else J('vending_cool_white', 2)
            c.P(x, y, col)
    # 차양 앞 물결 프릴 + 아래 OL
    for x in range(3, 61):
        stripe = ((x - 3) // 6) % 2
        col = J('torii_vermilion', 2) if stripe == 0 else J('vending_cool_white', 3)
        dip = 1 if (x - 3) % 6 in (1, 2, 3, 4) else 0
        for y in range(14, 16 + dip):
            c.P(x, y, col)
        c.P(x, 16 + dip, OL)
    c.VL(2, 13, 4, OL); c.VL(61, 13, 4, OL)

    # 3. 기둥 + 쪽빛 노렌(4폭, 흰 글자 문양) + 매대 안쪽 어두운 공간
    c.R(7, 17, 50, 13, J('machiya_timber', 0))
    for px in (5, 56):
        trunk_34(c, px, 16, 3, 28, 'aged_cedar', 3)
    for k in range(4):
        nx = 9 + k * 12
        c.R(nx, 17, 10, 9, OL)
        c.R(nx + 1, 17, 8, 8, J('noren_indigo', 2))
        c.HL(nx + 1, 17, 8, J('noren_indigo', 3))
        c.R(nx + 3, 19, 4, 4, J('vending_cool_white', 4))
        c.P(nx + 4, 20, J('noren_indigo', 2)); c.P(nx + 5, 21, J('noren_indigo', 2))

    # 4. 3/4 나무 카운터 상판(윗면 깊이 5px: y=26..30) + 음식 진열 트레이 + 정면 허리판(y=31..43) + 수레 바퀴
    rect_3d(c, 4, 26, 56, 18, 5, 'aged_cedar', top_t=4, front_t=2)
    # 상판 위 철판/음식 트레이 3개
    for tx, mat in ((11, 'kawara_dark_tile'), (26, 'torii_vermilion'), (41, 'lantern_amber')):
        c.R(tx, 26, 11, 4, OL)
        c.R(tx + 1, 27, 9, 2, J(mat, 3))
        c.P(tx + 3, 27, J('vending_cool_white', 4)); c.P(tx + 6, 27, J('lantern_amber', 4))
    # 카운터 정면 세로 판자줄
    for x in range(9, 56, 5):
        c.VL(x, 32, 10, J('aged_cedar', 1))
        c.VL(x + 1, 32, 10, J('aged_cedar', 3))
    # 아래 수레 바퀴 2개
    for wx in (14, 50):
        disc(c, wx, 43, 3.8, OL)
        disc(c, wx, 43, 2.6, J('machiya_timber', 2))
        c.P(wx, 43, J('cream_stucco', 4))

    # 5. 양옆 축제 초롱 (1px OL + 붉은 위아래 테 + 밝은 호박색 몸통)
    for lx in (1, 58):
        c.R(lx, 17, 5, 10, OL)
        c.HL(lx + 1, 18, 3, J('torii_vermilion', 3))
        c.R(lx + 1, 19, 3, 6, J('lantern_amber', 4))
        c.P(lx + 3, 21, J('torii_vermilion', 3))
        c.HL(lx + 1, 25, 3, J('torii_vermilion', 3))


@kit('rg-doshirube', '등산로 이정표(道標) - 나무 기둥·화살표 판 둘(1×2)', 1, 2, 'sign', solid=[(0, 1)],
     tags=['이정표', '등산로', '산길'], rules='산길 갈림길 가장자리에 하나.', role='prop')
def doshirube(c, base):
    # 1. 3/4 석조 받침대 (윗면 + 정면 + OL)
    plinth_34(c, 3, 24, 10, 7, top_h=2, mat='shrine_flagstone')
    # 2. 3/4 사각 나무 기둥 + 피라미드 갓머리 + 좌우 이정표 화살판 (모두 1px OL)
    t = Cv(c.w, c.h)
    t.R(6, 4, 4, 21, J('aged_cedar', 2))
    t.VL(6, 4, 21, J('aged_cedar', 4)); t.VL(9, 4, 21, J('aged_cedar', 1))
    t.R(5, 3, 6, 2, J('kawara_dark_tile', 3)); t.HL(6, 2, 4, J('kawara_dark_tile', 4))
    # 위쪽 오른쪽 화살판 (윗두께 1px 밝은 단 포함)
    t.R(2, 7, 12, 5, J('aged_cedar', 3)); t.HL(2, 7, 12, J('aged_cedar', 4))
    t.P(14, 9, J('aged_cedar', 3)); t.P(13, 8, J('aged_cedar', 4)); t.P(13, 10, J('aged_cedar', 2))
    for gx in (4, 7, 10): t.P(gx, 9, J('machiya_timber', 0))
    # 아래쪽 왼쪽 화살판
    t.R(2, 14, 12, 5, J('aged_cedar', 3)); t.HL(2, 14, 12, J('aged_cedar', 4))
    t.P(1, 16, J('aged_cedar', 4)); t.P(2, 15, J('aged_cedar', 4)); t.P(2, 17, J('aged_cedar', 2))
    for gx in (5, 8, 11): t.P(gx, 16, J('machiya_timber', 0))
    add_outline(t)
    for y in range(c.h):
        for x in range(c.w):
            if t.a[y, x, 3]:
                c.P(x, y, (int(t.a[y, x, 0]) << 16) | (int(t.a[y, x, 1]) << 8) | int(t.a[y, x, 2]))


@kit('rg-wakimizu', '약수터(湧き水) - 대나무 대롱·돌 물받이·국자(2×2)', 2, 2, 'water', solid=[(0, 1), (1, 1)],
     tags=['약수터', '湧き水', '등산로', '신사'], rules='산길·참배길 가장자리 바위 옆.', role='prop')
def wakimizu(c, base):
    # 1. 바닥 젖은 판석 패드 (3/4)
    plinth_34(c, 2, 23, 28, 8, top_h=3, mat='wet_cobble')
    # 2. 왼쪽 뒤 이끼 바위 기둥 (3/4 윗면 + 정면 + OL)
    rect_3d(c, 2, 4, 13, 21, 5, 'shrine_flagstone', top_t=4, front_t=2)
    c.R(4, 5, 7, 3, J('moss', 3)); c.R(4, 12, 5, 3, J('moss', 2))
    # 3. 3/4 돌 물받이 수조(つくばい: 넓은 테두리 윗면 + 청록 물 윗면 + 정면 돌 몸통 + OL)
    rect_3d(c, 11, 15, 19, 13, 6, 'shrine_flagstone', top_t=4, front_t=2)
    c.R(14, 17, 13, 4, J('onsen_mineral_teal', 3))
    c.HL(15, 17, 11, J('onsen_mineral_teal', 4))
    c.HL(14, 20, 13, J('onsen_mineral_teal', 1))
    # 4. 대나무 홈통(筧) + 떨어지는 물줄기 + 수조 위 나무 국자(柄杓)
    c.R(10, 9, 14, 4, OL)
    c.HL(11, 10, 12, J('moss', 4)); c.HL(11, 11, 12, J('pine_bamboo', 2))
    c.R(21, 12, 2, 6, J('vending_cool_white', 4))
    # 국자
    c.R(23, 15, 4, 3, OL); c.R(24, 16, 2, 1, J('aged_cedar', 4))
    line(c, 26, 15, 30, 12, OL); line(c, 26, 16, 30, 13, J('aged_cedar', 4))


@kit('rg-mujin-eki', '시골 무인역 대합실 - 녹슨 함석 지붕·판자벽·나무 의자·역명판(6×4)', 6, 4, 'building', solid=[(0, 2), (1, 2), (2, 2), (3, 2), (0, 3), (1, 3), (2, 3), (3, 3)],
     tags=['무인역', '간이역', '시골', '철도'], rules='승강장(판석 광장 띠) 위, 선로와 나란히. 오른쪽 역명판 앞은 걸을 수 있다.', role='structure')
def mujin_eki(c, base):
    # 1. 3/4 콘크리트 승강장 연단 기단 (전체 6칸 폭 x=1..95, y=48..63: 판석 윗면 + 노란 점자블록 + 정면 턱)
    plinth_34(c, 1, 48, 94, 15, top_h=8, mat='paving_stone')
    # 승강장 앞쪽 노란 안전 점자블록 줄
    for x in range(3, 93):
        c.P(x, 54, J('lantern_amber', 4 if x % 2 == 0 else 3))

    # 2. 왼쪽 무인역 목조 대합실 (x=3..63):
    # (a) 3/4 함석 경사 지붕 (y=4..22, 깊은 지붕 윗면 + 용마루 + 처마 두께)
    hip_metal_roof_34(c, 2, 4, 62, 18, mat='noren_rust', ridge_mat='kawara_dark_tile')
    # (b) 대합실 3면 나무 판자벽 + 안쪽 개방된 대합실 공간 + 긴 나무 벤치 + 시간표·창문
    c.R(4, 22, 58, 28, OL)
    boards(c, 5, 22, 56, 27, mat='aged_cedar', t=2, bw=4, seed=3)
    # 대합실 안쪽 개방 개구부 (3/4 안쪽 마루 바닥과 뒷벽이 보인다)
    c.R(10, 26, 46, 23, OL)
    c.R(11, 27, 44, 16, J('machiya_timber', 1))
    c.R(11, 43, 44, 5, J('aged_cedar', 2))  # 안쪽 바닥
    # 뒷벽 시간표·노선도 게시판 + 채광창
    c.R(15, 29, 10, 7, OL); c.R(16, 30, 8, 5, J('vending_cool_white', 4))
    c.HL(17, 31, 6, J('torii_vermilion', 3)); c.HL(17, 33, 6, J('noren_indigo', 2))
    c.R(29, 29, 12, 7, OL); c.R(30, 30, 10, 5, J('arcade_skylight_slate', 3)); c.VL(35, 30, 5, OL)
    c.R(44, 29, 8, 7, OL); c.R(45, 30, 6, 5, J('lantern_amber', 3))
    # 3/4 나무 긴 벤치 (좌석 윗면 + 다리)
    rect_3d(c, 14, 39, 38, 7, 3, 'aged_cedar', top_t=4, front_t=2)
    # 대합실 앞기둥 2본 + 처마 중앙 둥근 역 시계
    trunk_34(c, 5, 22, 4, 27, 'aged_cedar', 3)
    trunk_34(c, 57, 22, 4, 27, 'aged_cedar', 3)
    disc(c, 33, 22, 4.2, OL); disc(c, 33, 22, 3.0, J('vending_cool_white', 4)); c.P(33, 21, OL); c.P(34, 22, OL)

    # 3. 오른쪽 역명판(駅名標, x=66..93): 3/4 지붕 캡 + 흰 간판 + 남색 노선 띠 + 두 기둥 + OL
    for px in (70, 87):
        c.R(px, 31, 3, 19, OL); c.VL(px + 1, 31, 18, J('kawara_dark_tile', 3))
    rect_3d(c, 66, 16, 27, 16, 3, 'vending_cool_white', top_t=4, front_t=4)
    c.R(67, 27, 25, 3, J('noren_indigo', 2))
    c.HL(68, 28, 23, J('torii_vermilion', 3))
    for k in range(4):
        c.R(70 + k * 5, 21, 3, 4, K('sumi', 1))


# ═══════════════════════════ 바닥(fill_region 재료) ═══════════════════════════
def _sand(c):
    for y in range(16):
        for x in range(16):
            ripple = (y + round(math.sin((x + 3) / 16 * math.pi * 2) * 1.2)) % 6 == 0
            t = 3 + (1 if H(x, y, 1) > 0.9 else 0) - (1 if ripple else 0)
            c.P(x, y, J('cream_stucco', t) if H(x, y, 2) > 0.12 else J('tatami_straw', 3))


def _sea(c):
    for y in range(16):
        for x in range(16):
            t = 2
            if (y % 8 == 3 and (x + (y // 8) * 7) % 16 < 5): t = 3
            if (y % 8 == 4 and (x + (y // 8) * 7) % 16 < 4): t = 1
            if (x, y) in ((11, 11), (3, 2)): t = 4
            c.P(x, y, J('canal_indigo', t))


def _paddy(c):
    for y in range(16):
        for x in range(16):
            c.P(x, y, J('onsen_mineral_teal', 2 if (x + y * 3) % 13 else 3) if y % 4 else J('onsen_mineral_teal', 1))
    for y in range(1, 16, 4):
        for x in range(1, 16, 4):
            c.P(x, y, J('moss', 4)); c.P(x, y + 1, J('moss', 3)); c.P(x + 1, y, J('moss', 3)); c.P(x - 1, y + 1, J('moss', 2))


def _trail(c):
    for y in range(16):
        for x in range(16):
            h = H(x, y, 3)
            t = 3 if h < 0.6 else 2 if h < 0.9 else 4
            c.P(x, y, J('aged_cedar', t))
    for (x, y) in ((3, 4), (11, 2), (7, 11), (13, 13)): c.P(x, y, J('shrine_flagstone', 4)); c.P(x + 1, y + 1, J('shrine_flagstone', 1))


def _forest(c):
    for y in range(16):
        for x in range(16):
            h = H(x, y, 5)
            c.P(x, y, J('moss', 1 if h < 0.45 else 2 if h < 0.85 else 0))
    for (x, y) in ((2, 3), (9, 6), (5, 12), (13, 10)): c.P(x, y, J('aged_cedar', 3)); c.P(x + 1, y, J('aged_cedar', 2))
    for (x, y) in ((12, 2), (3, 8)): c.P(x, y, J('pine_bamboo', 4)); c.P(x - 1, y + 1, J('pine_bamboo', 3)); c.P(x + 1, y + 1, J('pine_bamboo', 3))


def _deck(c):
    for y in range(16):
        for x in range(16):
            r = y % 4
            t = 3 if r == 0 else 2 if r < 3 else 0
            if r != 3 and (x + (y // 4) * 5) % 16 == 0: t = 0
            c.P(x, y, J('aged_cedar', t))
    for (x, y) in ((2, 1), (13, 5), (6, 9), (10, 13)): c.P(x, y, J('aged_cedar', 1))


def _ishidatami(c):
    for y in range(16):
        for x in range(16):
            row = y // 5; ox = (row % 2) * 4
            sx = (x + ox) % 8; sy = y % 5 if y < 15 else 0
            if sx == 7 or sy == 4: c.P(x, y, J('wet_cobble', 0)); continue
            t = 2 + (1 if sx == 0 or sy == 0 else 0) - (1 if sx == 6 or sy == 3 else 0)
            if H((x + ox) // 8, row, 4) > 0.7: t += 1 if t < 3 else 0
            c.P(x, y, J('wet_cobble', t))


def _marsh(c):
    for y in range(16):
        for x in range(16):
            h = H(x, y, 7)
            c.P(x, y, J('moss', 3 if h < 0.5 else 2 if h < 0.85 else 4))
    for (x, y) in ((4, 10), (5, 10), (5, 11), (6, 11)): c.P(x, y, J('onsen_mineral_teal', 2))
    c.P(12, 4, J('vending_cool_white', 4)); c.P(12, 5, J('pine_bamboo', 3))
    for x in range(0, 16, 3): c.P(x, (x * 5) % 16, J('moss', 4))


def _oldrail(c):
    for y in range(16):
        for x in range(16):
            h = H(x, y, 9)
            c.P(x, y, J('gravel', 2 if h < 0.6 else 1 if h < 0.85 else 3))
    for y in (2, 10):
        c.HL(1, y, 14, J('machiya_timber', 2)); c.HL(1, y + 1, 14, J('machiya_timber', 1)); c.HL(1, y + 2, 14, J('machiya_timber', 0))
    for y in range(16):
        c.P(4, y, J('noren_rust', 3)); c.P(5, y, J('noren_rust', 1))
        c.P(11, y, J('noren_rust', 3)); c.P(12, y, J('noren_rust', 1))
    for (x, y) in ((1, 6), (8, 14), (14, 7), (7, 5)): c.P(x, y, J('moss', 3)); c.P(x, y - 1, J('moss', 4))


GROUND = collections.OrderedDict((
    ('gnd/sand', (_sand, 'floor')), ('gnd/sea', (_sea, 'solidfloor')), ('gnd/paddy', (_paddy, 'solidfloor')), ('gnd/trail', (_trail, 'floor')),
    ('gnd/forest', (_forest, 'floor')), ('gnd/deck', (_deck, 'floor')), ('gnd/ishidatami', (_ishidatami, 'floor')), ('gnd/marsh', (_marsh, 'floor')),
    ('gnd/oldrail', (_oldrail, 'floor')),
))
GROUND_GROUPS = (
    ('jp:region-sand', '해변 모래사장', ['gnd/sand'], '해변·해안도로 모래(크림 회벽 밝은 단 + 짚빛 알갱이, 물결 자국). fill_region 몸통. 바다(「바다」)와 맞붙인다.'),
    ('jp:region-sea', '바다', ['gnd/sea'], '항구·해변의 바다(운하 쪽빛 램프, 물결 줄). 걸을 수 없다. 어선·테트라포드 키트를 위에 둔다.'),
    ('jp:region-paddy', '논(물 댄 모)', ['gnd/paddy'], '다랑논·시골 논(온천 청록 물 + 이끼색 모 줄). 걸을 수 없다 - 논두렁은 「산길 흙」으로 1칸 띠를 남긴다.'),
    ('jp:region-trail', '산길 흙', ['gnd/trail'], '등산로·논두렁·고개 흙길(삭은 삼나무 밝은 단 + 돌 알갱이). fill_region path 로 굽은 길.'),
    ('jp:region-forest', '숲 바닥(이끼·낙엽)', ['gnd/forest'], '삼나무·대숲·유적 숲의 바닥(이끼 그늘 단 + 낙엽 점).'),
    ('jp:region-deck', '나무 데크 탐방로', ['gnd/deck'], '고원 습원 나무 데크(가로 판재·이음). 습원(「습원 풀밭」) 위를 1~2칸 폭으로 지난다.'),
    ('jp:region-ishidatami', '온천가 돌길(이시다타미)', ['gnd/ishidatami'], '온천 마을 돌계단 길·항구 부두의 젖은 돌(엇갈린 돌판).'),
    ('jp:region-marsh', '습원 풀밭', ['gnd/marsh'], '고원 습원의 풀(이끼 램프 + 작은 물웅덩이·흰 꽃).'),
    ('jp:region-oldrail', '폐선 녹슨 선로', ['gnd/oldrail'], '폐선 철길: 자갈 도상·침목·녹슨 레일·풀. 가로/세로로 이어 깐다.'),
)


def _cv(w, h):
    return Cv(w * 16, h * 16)


def _cells_of(a, R, C):
    for cy in range(R):
        for cx in range(C):
            t = a[cy * 16:(cy + 1) * 16, cx * 16:(cx + 1) * 16].copy()
            if not t[:, :, 3].any(): yield cx, cy, None; continue
            t[t[:, :, 3] == 0] = 0
            yield cx, cy, t


_CACHE = {}


def _finalize():
    if 'r' in _CACHE: return _CACHE['r']
    cells = collections.OrderedDict(); seen = {}; kits = []; renders = {}
    names = {cs[0]: nm for _, nm, cs, _ in GROUND_GROUPS}
    for name, (fn, pc) in GROUND.items():
        c = Cv(16, 16); fn(c)
        seen[(c.a.tobytes(), pc)] = name
        cells[name] = dict(img=Image.fromarray(c.a, 'RGBA'), pc=pc, label='일본 지역 바닥 · ' + names[name], desc='[지역 팩] 바닥 몸통 칸(1층).', tags=['바닥', '일본 지역'])
    for k in KITS:
        up, base = _cv(k['w'], k['h']), _cv(k['w'], k['h'])
        k['draw'](up, base)
        grids = {}
        for layer, cv in (('up', up), ('base', base)):
            g = [[None] * k['w'] for _ in range(k['h'])]
            for cx, cy, t in _cells_of(cv.a, k['h'], k['w']):
                if t is None: continue
                pc = 'floor' if layer == 'base' else ('solid' if (cx, cy) in k['solid'] else k['other'])
                key = (t.tobytes(), pc)
                if key not in seen:
                    loc = '%s/%s%d.%d' % (k['id'], 'b' if layer == 'base' else '', cx, cy)
                    seen[key] = loc
                    cells[loc] = dict(img=Image.fromarray(t, 'RGBA'), pc=pc, label='%s 칸 (%d,%d)%s' % (k['name'], cx, cy, ' 바닥' if layer == 'base' else ''),
                                      desc='[지역 팩] %s 의 일부. 키트 jp-%s 로 통째로 놓는다.' % (k['name'], k['id']), tags=list(k['tags']))
                g[cy][cx] = seen[key]
            grids[layer] = g
        has_base = any(v for r in grids['base'] for v in r)
        desc = '%s - 폭 %d칸×높이 %d칸. 손 도트 일본 지역 팩(일본 로케일 팔레트 계약 색, 빛 왼쪽 위, 3/4).%s' % (k['name'], k['w'], k['h'], ' 바닥(1층) 칸 포함.' if has_base else '')
        ai = dict(snap='floor', tags=list(k['tags']) + ['jp-region'], description=desc, placementRules=k['rules'], repeatability='fixed', growthAxis=None,
                  anchor=dict(dx=0, dy=k['h'] - 1), access=[], role=STRUCTURE_ROLE.get(k['id'], k['role']) if k['role'] == 'structure' else k['role'])
        kits.append(dict(id='jp-' + k['id'], name=k['name'], grid=grids['up'], base=grids['base'] if has_base else None, parts=[], ai=ai))
        comp = Image.new('RGBA', (k['w'] * 16, k['h'] * 16), (0, 0, 0, 0))
        comp.alpha_composite(Image.fromarray(base.a, 'RGBA')); comp.alpha_composite(Image.fromarray(up.a, 'RGBA'))
        renders[k['id']] = comp
    groups = [dict(id=gid, name=nm, role='terrain', defaultLayer='lower', cells=list(cs), desc=d, rules=d)
              for gid, nm, cs, d in GROUND_GROUPS]
    _CACHE['r'] = (cells, kits, renders, groups)
    return _CACHE['r']


# 굽기 키트 역할 열거(bake_lib ENUM krole)에 「structure」는 없다 - 구조물을 가장 가까운 역할로 맞춘다.
STRUCTURE_ROLE = {'rg-ishigaki': 'wall', 'rg-tenshu': 'castle', 'rg-shoro': 'building', 'rg-stone-ruin': 'wall', 'rg-rotenburo': 'water',
                  'rg-waterfall': 'water', 'rg-tsuribashi': 'terrain', 'rg-lighthouse': 'building', 'rg-ropeway': 'building', 'rg-lodge': 'building',
                  'rg-tunnel': 'wall', 'rg-mujin-eki': 'building'}

NOTES = '일본 30 지역 팩: 모래사장·바다·논·산길·숲 바닥·데크·온천 돌길·습원·폐선 바닥 + 대숲·삼나무·곰솔·단풍·石垣·天守·露天風呂·湯けむり·폭포·출렁다리·유적·석불·종루·등대·어선·해바라기·로프웨이·산장·폐선 터널·허수아비·はざ掛け·屋台·이정표·약수터·무인역·테트라포드. 키트 %d종.'


def build():
    cells, kits, renders, groups = _finalize()
    return {'cells': collections.OrderedDict((k, dict(v, img=v['img'].copy(), tags=list(v['tags']))) for k, v in cells.items()),
            'autotiles': [], 'groups': [dict(g, cells=list(g['cells'])) for g in groups], 'kits': [dict(k) for k in kits], 'notes': NOTES % len(kits)}


def kinds():
    return {'jp-' + k['id']: k['kind'] for k in KITS}


def _allowed():
    from lib_blocks_lines.core import _owner
    return set(_owner()) | {v for r in _RAMP.values() for v in r}


def selftest(verbose=True):
    """칸 16×16 RGBA · 알파 0/255 · 색 ⊂ modern3 ∪ 일본 로케일 계약 · 키트 칸 참조 · 채도 상한."""
    out = []
    allowed = _allowed()
    b = build()
    for k, c in b['cells'].items():
        a = np.array(c['img'])
        if a.shape != (16, 16, 4): out.append('(a) %s 크기' % k); continue
        al = a[..., 3]
        if not np.all((al == 0) | (al == 255)): out.append('(a) %s 반투명' % k)
        vis = a[al == 255][:, :3]
        for r, g, bb in {tuple(map(int, p)) for p in vis}:
            if ((r << 16) | (g << 8) | bb) not in allowed: out.append('(a) %s 팔레트 밖 #%02x%02x%02x' % (k, r, g, bb)); break
    ids = [k['id'] for k in b['kits']]
    if len(ids) != len(set(ids)): out.append('키트 id 중복')
    for k in b['kits']:
        for layer in ('grid', 'base'):
            for row in (k[layer] or []):
                for v in row:
                    if v is not None and v not in b['cells']: out.append('(b) %s 칸 %s 없음' % (k['id'], v))
    if verbose:
        print('jp_regions_pack: 칸 %d · 키트 %d · 문제 %d' % (len(b['cells']), len(b['kits']), len(out)))
        for m in out[:20]: print('  ', m)
    return len(out)


def preview(outdir=OUTDIR):
    os.makedirs(outdir, exist_ok=True)
    cells, kits, renders, groups = _finalize()
    bg = (78, 92, 70, 255)
    ims = [renders[k['id']] for k in KITS]
    W = 900; x = y = 0; rowh = 0; pos = []
    for im in ims:
        if x + im.width > W: x = 0; y += rowh + 8; rowh = 0
        pos.append((x, y)); x += im.width + 8; rowh = max(rowh, im.height)
    gy = y + rowh + 10
    S = Image.new('RGBA', (W, gy + 40), bg)
    for im, p in zip(ims, pos): S.alpha_composite(im, p)
    for i, name in enumerate(GROUND):                                               # 바닥은 2×2 로 이어 붙여 이음새를 본다
        for dy in range(2):
            for dx in range(2): S.alpha_composite(cells[name]['img'], (i * 40 + dx * 16, gy + dy * 16))
    S.save(os.path.join(outdir, '_all.png'))
    S.resize((S.width * 2, S.height * 2), Image.NEAREST).save(os.path.join(outdir, '_all-x2.png'))
    for k in KITS: renders[k['id']].save(os.path.join(outdir, 'jp-%s.png' % k['id']))
    return os.path.join(outdir, '_all-x2.png')


if __name__ == '__main__':
    bad = selftest()
    print(preview(sys.argv[1] if len(sys.argv) > 1 else OUTDIR))
    sys.exit(1 if bad else 0)
