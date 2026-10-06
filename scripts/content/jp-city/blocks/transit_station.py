#!/usr/bin/env python3
"""jp_city 블록 transit_station — 지하철역 콘코스·승강장 손 도트 (modern3 램프만, 16px 칸, 빛 왼쪽 위, 3/4 정면).
  python3 scripts/content/jp-city/blocks/transit_station.py      # selftest + 산출물 렌더
층: 바닥(floor/solidfloor)=키트 base(1층), 투명 덧칠(flat)=2층, 나머지=키트 grid(3층).
글자는 glyphs.json 에 이미 있는 것만 쓴다(務·算·화살표 글자는 없음 → 화살표는 픽셀)."""
import os, sys, collections
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..')); sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', 'houses'))
import numpy as np                                            # noqa: E402
from PIL import Image                                         # noqa: E402
from lib_blocks_lines.core import check_cell, ROOT            # noqa: E402
import shop_parts as SP                                       # noqa: E402
from house_kit import K, OL, Cv                               # noqa: E402

BLOCK = 'transit_station'
OUTDIR = os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks', 'transit_station')
TRAIN = os.path.join(ROOT, 'public', 'assets', 'jp-city', 'vehicles', 'jp-subway.png')
P = []
LINE = 'midori'          # 노선 색(가상의 みどり 선)


def prop(id_, name, w, h, solid=(), other='star', tags=(), rules='', ground=None, ground_solid=(), role='prop', repeat=None):
    def deco(fn):
        P.append(dict(id=id_, name=name, w=w, h=h, draw=fn, solid=list(solid), other=other, tags=list(tags), rules=rules,
                      ground=ground, ground_solid=list(ground_solid), role=role, repeat=repeat)); return fn
    return deco


def box(c, x, y, w, h, col):
    """윤곽선 사각형(속 비움)."""
    c.HL(x, y, w, col); c.HL(x, y + h - 1, w, col); c.VL(x, y, h, col); c.VL(x + w - 1, y, h, col)


def arrow(c, x, y, d, col):
    """픽셀 화살표 9x7 (d='L'|'R'|'U'|'D'). 글자 →← 이 없어서 직접 찍는다."""
    if d in 'LR':
        c.HL(x + 1, y + 3, 7, col)
        for i in range(4):
            px = x + 8 - i if d == 'R' else x + i
            c.VL(px, y + 3 - i, 2 * i + 1, col)
        c.HL(x, y + 3, 9, col)
    else:
        for i in range(4):
            py = y + 6 - i if d == 'D' else y + i
            c.HL(x + 4 - i, py, 2 * i + 1, col)
        c.VL(x + 4, y, 7, col)


def digit(c, x, y, n, col):
    """4x5 숫자(번호판용). 글자 표가 아니라 픽셀. 3x5 「3」은 ヨ 로 읽혀서 모서리를 깎은 4폭으로 찍는다."""
    F = {1: ('0110', '1110', '0110', '0110', '1111'), 2: ('1110', '0001', '0110', '1000', '1111'),
         3: ('1110', '0001', '0110', '0001', '1110'), 4: ('0010', '0110', '1010', '1111', '0010')}
    for j, row in enumerate(F[n]):
        for i, ch in enumerate(row):
            if ch == '1': c.P(x + i, y + j, col)


# ─────────────────────────── 바닥(1층) ───────────────────────────
def floor_tiles(c, x0, y0, w, h):
    """콘코스 바닥: 밝은 회색 대형 타일(8px), 줄눈은 한 단 어둡게, 타일 왼쪽 위 모서리에 빛."""
    c.R(x0, y0, w, h, K('conc', 2))
    for y in range(0, h, 8): c.HL(x0, y0 + y, w, K('conc', 1))
    for x in range(0, w, 8): c.VL(x0 + x, y0, h, K('conc', 1))
    for y in range(0, h, 8):
        for x in range(0, w, 8):
            c.HL(x0 + x + 1, y0 + y + 1, 3, K('conc', 3)); c.P(x0 + x + 1, y0 + y + 2, K('conc', 3))
            if ((x0 + x) * 7 + (y0 + y) * 13) % 5 == 0: c.P(x0 + x + 5, y0 + y + 5, K('conc', 1))


def platform_floor(c, x0, y0, w, h):
    """승강장 바닥: 콘코스보다 한 단 짙은 회색 타일(16x8 엇갈림)."""
    c.R(x0, y0, w, h, K('conc', 1))
    for y in range(0, h, 8):
        c.HL(x0, y0 + y, w, K('conc', 0))
        off = 0 if (y // 8) % 2 == 0 else 8
        for x in range(off, w, 16): c.VL(x0 + x, y0 + y, 8, K('conc', 0))
        for x in range(off, w, 16): c.HL(x0 + x + 1, y0 + y + 1, 4, K('conc', 2))


def edge_strip(c, x0, y0, w):
    """승강장 끝 1칸: 갓돌 → 흰 경계선 → 노란 점자 블록 줄 → 바닥."""
    c.R(x0, y0, w, 16, K('conc', 1))
    c.HL(x0, y0, w, K('conc', 3)); c.HL(x0, y0 + 1, w, K('conc', 2))          # 갓돌 윗면(빛 받음)
    c.R(x0, y0 + 2, w, 2, K('shiro', 2))                                       # 흰 선
    c.HL(x0, y0 + 4, w, K('conc', 0))
    c.R(x0, y0 + 6, w, 7, K('kii', 1))                                         # 점자 블록
    c.HL(x0, y0 + 5, w, K('kii', -1)); c.HL(x0, y0 + 13, w, K('kii', -1))
    for x in range(0, w, 8): c.VL(x0 + x, y0 + 6, 7, K('kii', -1))
    for x in range(0, w, 8):
        for (dx, dy) in ((2, 1), (5, 1), (2, 4), (5, 4)):
            c.P(x0 + x + dx, y0 + 6 + dy, K('kii', 3)); c.P(x0 + x + dx + 1, y0 + 6 + dy, K('kii', 2))
            c.P(x0 + x + dx + 1, y0 + 7 + dy, K('kii', 0))
    c.HL(x0, y0 + 14, w, K('kii', 2)); c.HL(x0, y0 + 15, w, K('kii', -1))      # 内方線(선로 반대쪽 2px 노란 선 + 아래 그늘)


def track_bed(c, x0, y0, w):
    """선로 바닥 2칸(32px): 짙은 바닥·콘크리트 침목·레일 2줄, 아래는 승강장 갓 그늘."""
    c.R(x0, y0, w, 32, K('yoru', -1))
    c.R(x0, y0, w, 3, K('yoru', -3))                                           # 뒷벽 밑 그늘
    for x in range(w):
        for y in range(3, 30):
            if ((x0 + x) * 31 + y * 17) % 23 == 0: c.P(x0 + x, y0 + y, K('yoru', 0))
            elif ((x0 + x) * 13 + y * 29) % 19 == 0: c.P(x0 + x, y0 + y, K('yoru', -2))
    for x in range(2, w, 8):                                                   # 침목
        c.R(x0 + x, y0 + 8, 4, 20, K('conc', -1)); c.VL(x0 + x, y0 + 8, 20, K('conc', 0))
        c.HL(x0 + x, y0 + 8, 4, K('conc', 1)); c.HL(x0 + x, y0 + 28, 4, K('yoru', -3))
    for ry in (11, 22):                                                        # 레일(윗면 빛 + 몸통 + 그늘)
        c.HL(x0, y0 + ry - 1, w, OL)
        c.HL(x0, y0 + ry, w, K('tekko', 3)); c.HL(x0, y0 + ry + 1, w, K('tekko', 1))
        c.HL(x0, y0 + ry + 2, w, K('tekko', -1)); c.HL(x0, y0 + ry + 3, w, OL)
    c.R(x0, y0 + 29, w, 3, K('sumi', 0)); c.HL(x0, y0 + 29, w, K('yoru', -3))   # 승강장 갓 밑 그늘


prop('subway-floor', '지하 콘코스 바닥(밝은 회색 대형 타일)', 1, 1, ground=lambda c: floor_tiles(c, 0, 0, 16, 16),
     role='terrain', repeat='xy', tags=('지하철', '역', '콘코스', '바닥'),
     rules='콘코스·개찰구 안팎 바닥. 넓게 반복해 깐다.')(None)
prop('subway-platform', '승강장 바닥(회색 엇갈림 타일)', 1, 1, ground=lambda c: platform_floor(c, 0, 0, 16, 16),
     role='terrain', repeat='xy', tags=('지하철', '승강장', '바닥'),
     rules='승강장 끝(jp-subway-edge) 아래쪽에 깐다.')(None)
prop('subway-edge', '승강장 끝(흰 선 + 노란 점자 블록)', 1, 1, ground=lambda c: edge_strip(c, 0, 0, 16),
     role='terrain', repeat='x', tags=('지하철', '승강장', '점자블록', '끝선'),
     rules='선로(jp-subway-track) 바로 아래 한 줄로 가로 반복. 걸을 수 있다.')(None)
prop('subway-track', '선로 바닥(레일 2줄, 통행 불가)', 1, 2, ground=lambda c: track_bed(c, 0, 0, 16),
     ground_solid=((0, 0), (0, 1)), role='terrain', repeat='x', tags=('지하철', '선로', '레일'),
     rules='뒷벽과 승강장 끝 사이에 2줄로 가로 반복. 열차(2칸 발자국)가 이 위를 달린다. 32칸 이상 이어 깐다.')(None)


# ─────────────────────────── 벽 ───────────────────────────
def white_wall(c, x0, y0, w, h):
    """흰 타일 벽 + 걸레받이. 위 3px 는 천장 경계 윗면, 아래 6px 걸레받이."""
    c.R(x0, y0, w, h, K('shiro', 1))
    for y in range(3, h - 6, 8):
        c.HL(x0, y0 + y + 7, w, K('shiro', 0))
        off = 0 if (y // 8) % 2 == 0 else 4
        for x in range(off, w, 8): c.VL(x0 + x, y0 + y, 8, K('shiro', 0))
        for x in range(off, w, 8): c.P(x0 + x + 1, y0 + y + 1, K('shiro', 2))
    c.HL(x0, y0, w, OL); c.HL(x0, y0 + 1, w, K('conc', 3)); c.HL(x0, y0 + 2, w, K('conc', 0))
    c.R(x0, y0 + h - 6, w, 5, K('yoru', 0)); c.HL(x0, y0 + h - 6, w, K('yoru', 2))
    c.HL(x0, y0 + h - 7, w, K('shiro', -1)); c.HL(x0, y0 + h - 1, w, OL)


@prop('subway-wall', '콘코스 흰 타일 벽(걸레받이)', 1, 2, solid=((0, 0), (0, 1)), role='wall', repeat='x',
      tags=('지하철', '역', '벽', '타일'), rules='콘코스 맨 위 2줄로 가로 반복. 매표기·역무실·계단 키트는 이 벽을 뒤에 품고 있다.')
def d_wall(c):
    white_wall(c, 0, 0, 16, 32)


def back_wall(c, x0, y0, w):
    """승강장 뒷벽 3칸(48px): 상아색 타일 · 노선색 띠 · 아래는 짙은 콘크리트 + 케이블 덕트."""
    c.R(x0, y0, w, 48, K('kinari', 1))
    for y in range(3, 30, 6):
        c.HL(x0, y0 + y + 5, w, K('kinari', 0))
        off = 0 if (y // 6) % 2 == 0 else 6
        for x in range(off, w, 12): c.VL(x0 + x, y0 + y, 6, K('kinari', 0))
    c.HL(x0, y0, w, OL); c.HL(x0, y0 + 1, w, K('conc', 3)); c.HL(x0, y0 + 2, w, K('conc', 0))
    c.R(x0, y0 + 30, w, 5, K(LINE, 0)); c.HL(x0, y0 + 30, w, K(LINE, 1)); c.HL(x0, y0 + 34, w, K(LINE, -1))   # 노선색 띠
    c.HL(x0, y0 + 29, w, OL); c.HL(x0, y0 + 35, w, OL)
    c.R(x0, y0 + 36, w, 12, K('conc', -1)); c.HL(x0, y0 + 36, w, K('conc', 0))   # 선로 쪽 아랫벽
    c.R(x0, y0 + 39, w, 3, K('tekko', -1)); c.HL(x0, y0 + 39, w, K('tekko', 1)); c.HL(x0, y0 + 42, w, OL)   # 케이블 덕트
    for x in range(4, w, 16): c.VL(x0 + x, y0 + 38, 5, K('tekko', -2))
    c.HL(x0, y0 + 47, w, K('yoru', -3))


@prop('subway-backwall', '승강장 뒷벽(타일·노선색 띠)', 1, 3, solid=((0, 0), (0, 1), (0, 2)), role='wall', repeat='x',
      tags=('지하철', '승강장', '벽', '노선색'), rules='선로 바로 위 3줄로 가로 반복(선로 반대편 벽).')
def d_backwall(c):
    back_wall(c, 0, 0, 16)


@prop('subway-backwall-ad', '승강장 뒷벽 + 광고판(그림만, 글자·상표 없음)', 3, 3, solid=[(x, y) for x in range(3) for y in range(3)],
      role='wall', tags=('지하철', '승강장', '벽', '광고판'), rules='뒷벽 줄 사이에 끼워 넣는다. 열차 길이마다 2~3개.')
def d_backwall_ad(c):
    back_wall(c, 0, 0, 48)
    x, y, w, h = 4, 5, 40, 22
    c.R(x, y, w, h, K('tekko', 1)); box(c, x, y, w, h, OL)
    c.HL(x + 1, y + 1, w - 2, K('tekko', 3)); c.VL(x + 1, y + 1, h - 2, K('tekko', 2))
    ix, iy, iw, ih = x + 3, y + 3, w - 6, h - 6
    for j in range(ih):                                                        # 하늘 → 언덕 그림(가상 관광 포스터)
        c.HL(ix, iy + j, iw, K('sora', 2 - j // 4))
    for i in range(iw):
        hh = 5 + int(3 * np.sin(i / 5.0))
        c.VL(ix + i, iy + ih - hh, hh, K('midori', 0 if i % 7 else 1))
    c.R(ix + 22, iy + 2, 5, 5, K('kii', 2)); c.P(ix + 22, iy + 2, K('sora', 1)); c.P(ix + 26, iy + 6, K('kii', 0))
    c.HL(x, y + h, w, K('kinari', -1))


@prop('subway-station-sign', '역명판 「さくら町」(양옆 역 みなと·森川)', 8, 3, solid=[(x, y) for x in range(8) for y in range(3)],
      role='wall', tags=('지하철', '승강장', '역명판', '간판', '벽'),
      rules='뒷벽 줄 가운데에 한 번. 뒷벽을 품은 벽 변형이다. 역명은 가상의 역 이름.')
def d_station_sign(c):
    back_wall(c, 0, 0, 128)
    x, y, w = 6, 1, 116
    c.R(x, y, w, 42, K('shiro', 2)); c.HL(x + 1, y + 1, w - 2, K('shiro', 3))
    c.R(x, y + 21, w, 21, K(LINE, 0)); c.HL(x, y + 21, w, K(LINE, 1)); c.HL(x, y + 41, w, K(LINE, -1))
    box(c, x, y, w, 43, OL)
    SP.text(c, x + 24, y + 3, 'さくら町', K('sumi', 0), step=17)
    c.R(x + 4, y + 6, 12, 11, K(LINE, 0)); box(c, x + 4, y + 6, 12, 11, OL)      # 노선 기호(초록 사각 + 흰 점)
    c.R(x + 8, y + 10, 4, 4, K('shiro', 3))
    arrow(c, x + 3, y + 26, 'L', K('shiro', 3))
    SP.text(c, x + 14, y + 23, 'みなと', K('shiro', 3), step=16)
    SP.text(c, x + w - 48, y + 23, '森川', K('shiro', 3), step=17)
    arrow(c, x + w - 12, y + 26, 'R', K('shiro', 3))
    c.HL(x, y + 43, w, K('kinari', -1))


# ─────────────────────────── 기둥 ───────────────────────────
def pillar_body(c, plate):
    x, w = 3, 10
    c.R(x, 0, w, 44, K('shiro', 1))
    for y in range(4, 42, 6): c.HL(x, y, w, K('shiro', 0))
    c.VL(x + 1, 0, 44, K('shiro', 3)); c.VL(x + 2, 0, 44, K('shiro', 2))         # 빛 받는 왼쪽 모서리
    c.VL(x + w - 2, 0, 44, K('shiro', -1))
    c.VL(x, 0, 46, OL); c.VL(x + w - 1, 0, 46, OL)
    c.R(x - 1, 0, w + 2, 3, K('conc', 1)); c.HL(x - 1, 0, w + 2, K('conc', 3)); c.HL(x - 1, 3, w + 2, OL)   # 천장 테두리
    c.VL(x - 1, 0, 3, OL); c.VL(x + w, 0, 3, OL)
    if plate:
        c.R(x + 2, 12, 6, 9, K('kon', 0)); box(c, x + 1, 11, 8, 11, OL)          # 번호판
        c.HL(x + 2, 12, 6, K('kon', 1)); digit(c, x + 3, 14, 3, K('shiro', 3))
    c.R(x, 40, w, 5, K('yoru', 0)); c.HL(x, 40, w, K('yoru', 2)); c.HL(x, 45, w, OL)   # 걸레받이
    c.VL(x + w, 41, 5, K('conc', 0)); c.HL(x + 1, 46, w, K('conc', 0))          # 오른쪽 아래 그늘


@prop('subway-pillar', '승강장 네모 타일 기둥(번호판)', 1, 3, solid=((0, 2),), tags=('지하철', '승강장', '기둥'),
      rules='승강장 전용(번호판은 승강장 위치 번호). 맨 아래 칸만 막힌다. 점자 블록 줄보다 안쪽(선로 반대쪽)에 6~12칸 간격으로.')
def d_pillar(c):
    pillar_body(c, True)


@prop('subway-pillar-plain', '콘코스 네모 타일 기둥(번호판 없음)', 1, 3, solid=((0, 2),), tags=('지하철', '역', '콘코스', '기둥'),
      rules='콘코스 전용. 맨 아래 칸만 막힌다. 천장 보(jp-subway-ceiling) 줄 바로 밑에서 시작하게 세운다.')
def d_pillar_plain(c):
    pillar_body(c, False)


@prop('subway-ceiling', '천장 보(짙은 보 + 형광등 줄)', 1, 1, role='roof', repeat='x', tags=('지하철', '역', '천장', '보'),
      rules='겹침(별) 칸, 위층. 매단 간판·LED 봉과 기둥 머리가 닿는 줄에 가로로 반복해 깐다.')
def d_ceiling(c):
    c.HL(0, 0, 16, OL); c.R(0, 1, 16, 4, K('yoru', -1)); c.HL(0, 1, 16, K('yoru', 1))
    c.HL(2, 3, 12, K('shiro', 3)); c.P(2, 3, K('shiro', 1)); c.P(13, 3, K('shiro', 1))   # 형광등(칸마다 끊김)
    c.HL(0, 5, 16, OL)
    c.R(0, 6, 16, 9, K('conc', -2)); c.HL(0, 6, 16, K('conc', -3))             # 보 뒤 천장 판(그늘)
    c.VL(15, 7, 8, K('conc', -3)); c.HL(1, 10, 13, K('conc', -1))             # 판 이음·점검구 결
    c.HL(0, 15, 16, OL)


# ─────────────────────────── 개찰구 ───────────────────────────
def gate_body(c, x, left=True, right=True):
    """한 칸 폭 개찰기: 윗면(밝은 회색, 남쪽 끝 파란 IC 판) + 남쪽 앞면(남색 판·화살표등)."""
    c.R(x + 2, 4, 12, 18, K('shiro', 2)); c.VL(x + 2, 4, 18, K('shiro', 3))     # 윗면(길게 남북으로)
    c.VL(x + 12, 5, 17, K('shiro', 0))
    c.HL(x + 2, 4, 12, K('shiro', 3))
    c.R(x + 5, 6, 6, 5, K('garasu', 0)); c.HL(x + 5, 6, 6, K('garasu', 2))      # 북쪽 끝 표시창
    c.R(x + 4, 15, 8, 5, K('sora', 0)); c.HL(x + 4, 15, 8, K('sora', 2)); c.P(x + 5, 16, K('sora', 3))   # IC 판
    box(c, x + 3, 14, 10, 7, OL)
    c.R(x + 2, 22, 12, 8, K('kon', 0)); c.HL(x + 2, 22, 12, K('kon', 1))       # 앞면
    c.VL(x + 2, 22, 8, K('kon', 1))
    c.R(x + 4, 24, 3, 3, K('midori', 1)); c.P(x + 4, 24, K('midori', 2))      # 진입 가능 등(초록)
    c.R(x + 9, 24, 3, 3, K('aka', 0)); c.P(x + 9, 24, K('aka', 1))            # 정지 등(빨강, 뒤쪽 방향)
    c.HL(x + 3, 28, 10, K('kon', -1))
    box(c, x + 1, 3, 14, 28, OL); c.HL(x + 2, 21, 12, OL)
    for on, fx in ((right, x + 14), (left, x - 3)):                            # 회색 문짝: 통로 안으로 3px 튀어나옴(닫힘)
        if not on: continue
        box(c, fx, 9, 5, 6, OL); c.R(fx + 1, 10, 3, 4, K('tekko', 1)); c.HL(fx + 1, 10, 3, K('tekko', 3))
        c.HL(fx + 1, 13, 3, K('tekko', -1))
    if right: c.VL(x + 17, 16, 14, K('shiro', 3))                              # 통로 바닥 밝은 선(1px)
    c.HL(x + 2, 31, 13, K('conc', 0))                                          # 발밑 그늘


@prop('subway-gates', '자동 개찰구 5대(사이 통로 4줄)', 9, 2, solid=[(x, 1) for x in (0, 2, 4, 6, 8)],
      ground=lambda c: floor_tiles(c, 0, 0, 144, 32), tags=('지하철', '역', '개찰구', '改札'),
      rules='콘코스를 가로질러 놓는다. 짝수 열은 개찰기, 홀수 열(1·3·5·7)은 걸어서 지나가는 통로. 양옆은 jp-subway-fence 로 벽까지 막는다(기둥이 있으면 기둥까지).')
def d_gates(c):
    for i in range(5): gate_body(c, i * 32, left=i > 0, right=i < 4)


@prop('subway-fence', '개찰 옆 낮은 스테인리스 칸막이(ラチ)', 1, 1, solid=((0, 0),), role='fence', repeat='x',
      ground=lambda c: floor_tiles(c, 0, 0, 16, 16), tags=('지하철', '역', '개찰구', '칸막이', 'ラチ'),
      rules='개찰구(jp-subway-gates)의 막힌 줄(아래 줄)과 같은 줄에, 개찰구 양끝에서 벽·기둥까지 가로로 잇는다.')
def d_fence(c):
    c.HL(0, 4, 16, OL); c.HL(0, 5, 16, K('tekko', 3)); c.HL(0, 6, 16, K('tekko', 2))   # 윗 난간(윗면)
    c.R(0, 7, 16, 7, K('tekko', 1)); c.HL(0, 7, 16, OL)                        # 앞면 판
    for x in (3, 11): c.VL(x, 8, 5, K('tekko', 3)); c.VL(x + 1, 8, 5, K('tekko', 2))   # 세로 반사
    c.HL(0, 12, 16, K('tekko', -1)); c.HL(0, 14, 16, OL); c.HL(0, 15, 16, K('conc', 0))


# ─────────────────────────── 매표기 ───────────────────────────
@prop('subway-ticket', '자동 매표기 3대 + 운임표', 6, 3, solid=[(x, 2) for x in range(6)] + [(x, 1) for x in range(6)] + [(x, 0) for x in range(6)],
      ground=lambda c: floor_tiles(c, 0, 0, 96, 48), role='building', tags=('지하철', '역', '매표기', 'きっぷ'),
      rules='콘코스 벽(jp-subway-wall) 줄에 붙여 놓는다. 위 2줄은 벽을 품는다.')
def d_ticket(c):
    white_wall(c, 0, 0, 96, 32)
    x, y, w, h = 4, 3, 88, 17                                                  # 운임표(노선도)
    c.R(x, y, w, h, K('shiro', 3)); box(c, x, y, w, h, OL); c.HL(x + 1, y + h, w - 2, K('shiro', -1))
    c.R(x + 1, y + 1, w - 2, 3, K('kon', 0))
    c.HL(x + 4, y + 10, w - 8, K(LINE, 0)); c.HL(x + 4, y + 11, w - 8, K(LINE, 0))   # 노선 2줄
    c.HL(x + 4, y + 7, 40, K('daidai', 0)); c.VL(x + 44, y + 7, 4, K('daidai', 0))
    for i, px in enumerate(range(x + 8, x + w - 4, 10)):
        c.R(px - 1, y + 9, 3, 4, K('shiro', 3)); box(c, px - 2, y + 9, 5, 4, OL)
        c.HL(px - 2, y + 14, 5, K('conc', 0 if i % 2 else -1))               # 운임 숫자 자리(작은 회색 줄)
    for i in range(3):
        mx = 3 + i * 32
        c.R(mx, 22, 26, 4, K('shiro', 2)); c.HL(mx, 22, 26, K('shiro', 3))     # 윗면
        c.R(mx, 26, 26, 20, K('shiro', 1)); c.VL(mx + 1, 26, 20, K('shiro', 2)); c.VL(mx + 24, 26, 20, K('shiro', 0))
        c.R(mx + 3, 27, 20, 3, K(LINE, 0)); c.HL(mx + 3, 27, 20, K(LINE, 1))    # 머리띠(노선색)
        c.R(mx + 4, 31, 13, 8, K('garasu', -1)); c.HL(mx + 4, 31, 13, K('garasu', 1))   # 화면(살짝 눕힘)
        c.R(mx + 5, 33, 4, 2, K('sora', 1)); c.R(mx + 10, 33, 4, 2, K('sora', 1)); c.R(mx + 5, 36, 9, 1, K('garasu', 2))
        box(c, mx + 3, 30, 15, 10, OL)
        c.R(mx + 19, 31, 3, 2, K('tekko', -1)); c.R(mx + 19, 35, 3, 4, K('tekko', 0)); c.HL(mx + 19, 35, 3, K('tekko', 2))  # 동전·지폐 구멍
        c.R(mx + 5, 42, 12, 2, K('yoru', -2)); c.HL(mx + 5, 41, 12, K('tekko', 1))   # 표 나오는 곳
        box(c, mx - 1, 21, 28, 26, OL)
        c.HL(mx, 47, 27, K('conc', 0))


# ─────────────────────────── 계단 ───────────────────────────
def parapet_front(c, x, y, w):
    """낮은 난간벽의 남쪽 앞면 16px(흰 타일 + 걸레받이)."""
    c.R(x, y, w, 16, K('shiro', 1)); c.HL(x, y, w, K('shiro', 2))
    for yy in (y + 5, y + 10): c.HL(x, yy, w, K('shiro', 0))
    c.R(x, y + 12, w, 4, K('yoru', 0)); c.HL(x, y + 12, w, K('yoru', 2))


def stair_sides(c, y_top, north):
    """낮은 난간벽: 윗면 콘크리트(3px) + 손스침(2px, 계단 쪽) 띠가 남북으로, 남쪽 끝만 16px 앞면.
    north='wall' 이면 북쪽 끝 가로 난간(윗면 + 16px 앞면), 'lintel' 이면 출구 구멍 위 가로 윗면만."""
    for x0, inner_right in ((10, True), (48, False)):
        cols = [K('conc', 3), K('conc', 2), K('conc', 1), K('tekko', 3), K('tekko', 0)] if inner_right else \
               [K('tekko', 3), K('tekko', 0), K('conc', 3), K('conc', 2), K('conc', 1)]
        for i, col in enumerate(cols): c.VL(x0 + 1 + i, y_top, 30 - y_top, col)
        c.VL(x0, y_top, 47 - y_top, OL); c.VL(x0 + 6, y_top, 47 - y_top, OL)
        c.HL(x0, 30, 7, OL); parapet_front(c, x0 + 1, 31, 5); c.HL(x0, 47, 7, OL)
        c.VL(x0 + 7, 32, 15, K('conc', 0)) if inner_right is False else None    # 오른쪽 그늘
    if north == 'wall':                                                         # 북쪽 끝 가로 난간
        c.HL(10, 0, 44, OL)
        for i, col in enumerate((K('conc', 3), K('conc', 2), K('tekko', 3), K('tekko', 0))): c.HL(11, 1 + i, 42, col)
        c.HL(10, 5, 44, OL); parapet_front(c, 16, 6, 32); c.R(16, 16, 32, 2, K('yoru', 0)); c.HL(16, 22, 32, OL)
        c.R(16, 18, 32, 4, K('yoru', -3))                                       # 앞면이 우물로 꺼지는 그늘
        c.VL(10, 0, 6, OL); c.VL(53, 0, 6, OL)
    elif north == 'lintel':                                                     # 출구 구멍 위 가로 윗면(양 난간을 잇는다)
        c.HL(10, 0, 44, OL)
        for i, col in enumerate((K('conc', 3), K('conc', 2), K('conc', 1))): c.HL(11, 1 + i, 42, col)
        c.HL(10, 4, 44, OL); c.VL(10, 0, 5, OL); c.VL(53, 0, 5, OL)


@prop('subway-stairs-down', '내려가는 계단(승강장으로)', 4, 3, solid=[(0, y) for y in range(3)] + [(3, y) for y in range(3)],
      ground=lambda c: floor_tiles(c, 0, 0, 64, 48), tags=('지하철', '역', '계단', '입구'),
      rules='콘코스 바닥 한가운데 놓는다. 가운데 2열(1·2)로 걸어 내려간다. 맨 아래 가운데가 입구(anchor).')
def d_stairs_down(c):
    c.R(16, 0, 32, 48, K('yoru', -3))
    for k in range(7):                                                         # 디딤판: 남(앞)일수록 밝고 높다
        y = 44 - k * 6
        c.R(16, y - 5, 32, 5, K('conc', 2 - k)); c.HL(16, y - 5, 32, K('conc', 3 - k))
        c.HL(16, y, 32, OL if k < 6 else K('sumi', 0))
        c.R(20, y - 4, 24, 1, K('kii', 0 - k // 3)) if k < 3 else None        # 앞 디딤판 노란 미끄럼막이
    c.HL(16, 46, 32, K('kii', 1)); c.HL(16, 47, 32, OL)
    stair_sides(c, 0, 'wall')


@prop('subway-stairs-up', '올라가는 계단(지상 출구)', 4, 3, solid=[(0, y) for y in range(3)] + [(3, y) for y in range(3)] + [(1, 0), (2, 0)],
      ground=lambda c: floor_tiles(c, 0, 0, 64, 48), tags=('지하철', '역', '계단', '출구', '입구'),
      rules='콘코스 벽(jp-subway-wall) 줄에 붙여 놓는다. 위 2줄은 벽을 품는다. 가운데 2열로 올라간다. 맨 아래 가운데가 입구(anchor).')
def d_stairs_up(c):
    white_wall(c, 0, 0, 64, 32)
    c.R(16, 3, 32, 16, K('yoru', -2)); c.HL(16, 3, 32, K('yoru', -3))         # 벽에 뚫린 출구 구멍
    for k in range(6):                                                         # 디딤판 + 챌판: 남(앞)일수록 낮고 밝다
        y = 18 + k * 5
        c.R(16, y, 32, 2, K('conc', 2 - (5 - k) // 2)); c.R(16, y + 2, 32, 3, K('conc', 0 - (5 - k) // 2))
        c.HL(16, y, 32, K('kii', 1) if k == 5 else K('conc', 3 - (5 - k) // 2))
        c.HL(16, y + 4, 32, OL)
    c.VL(15, 3, 16, OL); c.VL(48, 3, 16, OL)
    stair_sides(c, 0, 'lintel')


# ─────────────────────────── 간판 ───────────────────────────
def hanger(c, col):
    """천장에서 내려오는 매달이 줄 두 개 + 패널(y 7~30) 틀."""
    for x in (8, 39):
        c.VL(x, 0, 7, K('tekko', -2)); c.VL(x + 1, 0, 7, K('tekko', 1))
    c.R(1, 7, 46, 23, col[0]); c.HL(1, 8, 46, col[1]); c.HL(1, 28, 46, col[2])
    box(c, 0, 7, 48, 24, OL)
    c.HL(2, 31, 44, K('conc', -3))                       # 패널 밑 그늘 한 줄


@prop('subway-sign-exit', '천장 매단 출구 간판 「出口」', 3, 2, tags=('지하철', '역', '간판', '出口', '출구'),
      rules='출구·올라가는 계단 쪽 통로 위 천장에 매단다. 겹침(별) 칸이라 밑으로 걸을 수 있다.')
def d_sign_exit(c):
    hanger(c, (K('kii', 2), K('kii', 3), K('kii', 0)))
    arrow(c, 3, 15, 'L', K('sumi', 0))
    SP.text(c, 14, 11, '出口', K('sumi', 0), step=16)


@prop('subway-sign-exit-up', '천장 매단 출구 간판 「出口」(↑ 위쪽)', 3, 2, tags=('지하철', '역', '간판', '出口', '출구'),
      rules='출구 계단이 화면 위쪽(북쪽)에 있을 때 그 통로 위 천장에 매단다. 겹침(별) 칸이라 밑으로 걸을 수 있다. 계단이 왼쪽이면 jp-subway-sign-exit.')
def d_sign_exit_up(c):
    hanger(c, (K('kii', 2), K('kii', 3), K('kii', 0)))
    arrow(c, 3, 15, 'U', K('sumi', 0))
    SP.text(c, 14, 11, '出口', K('sumi', 0), step=16)


@prop('subway-sign-line', '천장 매단 승강장 안내 「のりば」', 3, 2, tags=('지하철', '역', '간판', 'のりば', '승강장'),
      rules='내려가는 계단 위 천장에 매단다. 겹침(별) 칸.')
def d_sign_line(c):
    hanger(c, (K('kon', 0), K('kon', 1), K('kon', -1)))
    SP.text(c, 1, 11, 'のりば', K('shiro', 3), step=15)


@prop('subway-office', '역무실 창구', 4, 3, solid=[(x, y) for x in range(4) for y in (1, 2)] + [(x, 0) for x in range(4)],
      ground=lambda c: floor_tiles(c, 0, 0, 64, 48), role='building', tags=('지하철', '역', '역무실', '창구'),
      rules='개찰구 옆 벽 줄에 붙인다. 위 2줄은 벽을 품는다. 창구 앞 한 칸을 비운다.')
def d_office(c):
    white_wall(c, 0, 0, 64, 32)
    c.R(4, 3, 56, 7, K('kon', 0)); c.HL(4, 3, 56, K('kon', 1)); box(c, 3, 2, 58, 9, OL)   # 안내판(파란 바탕 i 그림)
    c.R(29, 4, 6, 6, K('shiro', 3)); c.R(31, 5, 2, 1, K('kon', 0)); c.R(31, 7, 2, 2, K('kon', 0))
    c.R(4, 12, 56, 20, K('garasu', 0))                                         # 유리창
    for x in (4, 22, 41): c.VL(x, 12, 20, K('tekko', 1))
    c.VL(59, 12, 20, K('tekko', 1))
    for x in (6, 24, 43):
        c.VL(x, 13, 5, K('garasu', 3)); c.VL(x + 1, 13, 3, K('garasu', 2))      # 반사
    c.R(8, 25, 6, 4, K('sora', -1)); c.R(46, 24, 8, 5, K('kinari', 1))        # 안쪽 책상 그림자·서류
    box(c, 3, 11, 58, 22, OL)
    c.R(0, 32, 64, 4, K('ita', 2)); c.HL(0, 32, 64, K('ita', 3)); c.HL(0, 35, 64, K('ita', 0))   # 카운터 윗면
    c.R(0, 36, 64, 10, K('shiro', 1)); c.HL(0, 36, 64, K('shiro', 2))
    for x in range(8, 64, 16): c.VL(x, 37, 8, K('shiro', 0))
    c.R(0, 43, 64, 3, K('yoru', 0))
    box(c, 0, 31, 64, 16, OL); c.HL(0, 47, 64, K('conc', 0))
    c.R(26, 33, 12, 2, K('tekko', 2)); c.HL(26, 32, 12, OL)                    # 표 주고받는 홈


# ─────────────────────────── 승강장 소품 ───────────────────────────
@prop('subway-bench', '승강장 의자 4석', 3, 1, solid=((0, 0), (1, 0), (2, 0)), tags=('지하철', '승강장', '의자'),
      rules='승강장 바닥, 기둥 사이에 놓는다. 점자 블록 위에는 놓지 않는다.')
def d_bench(c):
    c.R(2, 12, 44, 2, K('tekko', 0)); c.HL(1, 14, 46, OL)                     # 받침대
    for px in (6, 40): c.R(px, 12, 2, 3, K('tekko', -1))
    for i in range(4):
        sx = 3 + i * 11
        c.R(sx, 1, 9, 6, K('sora', 0)); c.HL(sx, 1, 9, K('sora', 2)); c.VL(sx, 1, 6, K('sora', 1))   # 등받이
        c.R(sx, 7, 9, 4, K('sora', 1)); c.HL(sx, 7, 9, K('sora', 2)); c.HL(sx, 10, 9, K('sora', -1))   # 앉는 판
        box(c, sx - 1, 0, 11, 12, OL); c.HL(sx, 6, 9, K('sora', -1))
    c.HL(2, 15, 45, K('conc', 0))


@prop('subway-led', '천장 매단 발차 안내 LED판', 3, 2, tags=('지하철', '승강장', '안내판', 'LED'),
      rules='승강장 바닥 위 천장에 매단다. 겹침(별) 칸.')
def d_led(c):
    for px in (10, 37): c.VL(px, 0, 6, K('tekko', 1)); c.VL(px + 1, 0, 6, OL)   # 매다는 봉
    x, y, w, h = 1, 6, 46, 22
    c.R(x, y, w, h, K('tekko', 0)); c.HL(x, y, w, K('tekko', 2))              # 틀(윗면 빛)
    c.R(x + 2, y + 3, w - 4, h - 6, K('yoru', -3))
    for row, (yy, col1, col2) in enumerate(((y + 5, 'daidai', 'midori'), (y + 12, 'daidai', 'kii'))):
        for i in range(0, 12):
            if (i * 7 + row * 3) % 5 != 1: c.R(x + 4 + i * 2, yy, 1, 3 + (i % 2), K(col1, 1))   # 행선 점 글자(추상)
        for i in range(0, 6):
            c.R(x + 30 + i * 2, yy, 1, 3 + ((i + 1) % 2), K(col2, 1))
    c.HL(x + 2, y + 10, w - 4, K('yoru', -1))
    box(c, x, y, w, h, OL)


@prop('subway-station-sign-hang', '천장 매단 역명판 「さくら町」', 6, 2, tags=('지하철', '승강장', '역명판', '간판'),
      rules='승강장 기둥 사이 천장에 매단다(열차가 서도 보이는 역명). 겹침(별) 칸, 점자 블록 줄 안쪽 바닥 위.')
def d_station_sign_hang(c):
    for px in (14, 81): c.VL(px, 0, 6, K('tekko', 1)); c.VL(px + 1, 0, 6, OL)   # 매다는 봉
    x, y, w, h = 1, 6, 94, 24
    c.R(x, y, w, h, K('shiro', 2)); c.HL(x + 1, y + 1, w - 2, K('shiro', 3))
    c.R(x, y + 18, w, 5, K(LINE, 0)); c.HL(x, y + 18, w, K(LINE, 1)); c.HL(x, y + 22, w, K(LINE, -1))
    box(c, x, y, w, h, OL); c.HL(x, y + 17, w, OL)
    c.R(x + 3, y + 3, 11, 11, K(LINE, 0)); box(c, x + 3, y + 3, 11, 11, OL); c.R(x + 7, y + 7, 3, 3, K('shiro', 3))
    SP.text(c, x + 18, y + 1, 'さくら町', K('sumi', 0), step=17)
    c.HL(x + 2, y + h, w - 2, K('conc', -3))


def shade_floor(c, x, y, w):
    """밑동 오른쪽 아래 그늘 한 줄(바닥 위)."""
    c.HL(x + 1, y, w, K('conc', 0))


@prop('subway-recycle', '승강장 분별 쓰레기통 3칸(병·캔/페트/종이)', 2, 2, solid=((0, 1), (1, 1)), tags=('지하철', '승강장', '쓰레기통', '분리수거'),
      rules='승강장 바닥, 기둥 옆이나 의자 끝에 붙여 놓는다. 아래 줄 2칸이 막힌다. 점자 블록 위·계단 입구 앞에는 놓지 않는다.')
def d_recycle(c):
    x, y, w = 1, 6, 30
    c.R(x, y, w, 5, K('tekko', 1)); c.HL(x, y, w, K('tekko', 3)); c.HL(x, y + 4, w, K('tekko', 0))   # 윗면(뚜껑 판)
    c.VL(x + 1, y, 5, K('tekko', 2))
    for i, col in enumerate(('sora', 'kii', 'midori')):                                  # 병·캔 / 페트 / 종이
        sx = x + 1 + i * 10
        c.R(sx + 2, y + 1, 5, 2, K('yoru', -3)); c.HL(sx + 2, y + 3, 5, K('tekko', -1))  # 투입구
        c.R(sx, y + 5, 9, 20, K(col, 1)); c.VL(sx, y + 5, 20, K(col, 3)); c.VL(sx + 1, y + 5, 20, K(col, 2))
        c.VL(sx + 8, y + 5, 20, K(col, -1)); c.HL(sx, y + 5, 9, K(col, 3))
        c.R(sx + 2, y + 8, 5, 5, K('shiro', 3)); box(c, sx + 2, y + 8, 5, 5, K(col, -1))   # 기호 판(글자 대신 점)
        if i == 0: c.R(sx + 3, y + 9, 1, 3, K(col, -1)); c.R(sx + 5, y + 10, 1, 2, K(col, -1))   # 병·캔
        elif i == 1: c.R(sx + 4, y + 9, 1, 3, K(col, -1)); c.P(sx + 3, y + 11, K(col, -1)); c.P(sx + 5, y + 11, K(col, -1))   # 페트
        else: c.HL(sx + 3, y + 9, 3, K(col, -1)); c.HL(sx + 3, y + 11, 3, K(col, -1))   # 종이(줄)
        c.R(sx, y + 21, 9, 4, K('tekko', 0)); c.HL(sx, y + 21, 9, K('tekko', 2))        # 아래 받침
        c.VL(sx + 9, y + 5, 20, OL)
    box(c, x - 1, y - 1, w + 2, 6, OL); c.VL(x - 1, y + 5, 21, OL); c.HL(x - 1, y + 25, w + 2, OL)
    shade_floor(c, x, y + 26, w + 1)


@prop('subway-extinguisher', '벽 소화기 상자(빨강)', 1, 2, tags=('지하철', '승강장', '소화기', '벽'),
      rules='벽에 붙는 장식(겹침 칸, 막힘 없음 — 밑의 벽이 이미 막는다). 승강장에서는 뒷벽(jp-subway-backwall 3줄)의 아래 두 줄(둘째·셋째)에 겹쳐 둔다. 아래 칸이 선로·바닥 줄로 내려오면 안 된다. 광고판·역 이름판 칸과 겹치지 않게 그 사이 빈 벽에.')
def d_extinguisher(c):
    x, y, w, h = 3, 6, 10, 22
    c.R(x, y, w, 3, K('aka', 3)); c.HL(x, y, w, K('aka', 4))                             # 상자 윗면
    c.R(x, y + 3, w, h - 3, K('aka', 1)); c.VL(x, y + 3, h - 3, K('aka', 3)); c.VL(x + w - 1, y + 3, h - 3, K('aka', -1))
    c.R(x + 2, y + 5, 6, 12, K('aka', -1)); c.R(x + 3, y + 6, 4, 10, K('aka', 2))        # 유리 창 속 소화기
    c.VL(x + 3, y + 7, 8, K('aka', 4)); c.R(x + 4, y + 5, 2, 2, K('sumi', 2)); c.P(x + 6, y + 6, K('tekko', 2))
    c.R(x + 2, y + 18, 6, 2, K('shiro', 3)); c.HL(x + 3, y + 19, 4, K('aka', 2))   # 아래 흰 띠(빨간 줄)
    box(c, x - 1, y - 1, w + 2, h + 1, OL); c.HL(x - 1, y + 2, w + 2, OL)
    c.VL(x + w + 1, y + 1, h - 1, K('conc', -1))                                          # 벽 위 그늘(오른쪽)


@prop('subway-vending', '승강장 음료 자판기', 2, 3, solid=((0, 2), (1, 2)), tags=('지하철', '승강장', '자판기', '음료'),
      rules='승강장 바닥 기둥 사이에 홀로 세운다(뒷벽에 붙이지 않는다). 아래 줄 2칸이 막힌다. 앞(남쪽) 1칸은 비워 사람이 설 자리. 점자 블록 줄에서 1칸 이상 떨어진 안쪽.')
def d_vending(c):
    x, W, T, F = 2, 28, 6, 36; y = 4; fy = y + T; body = 'aka'
    c.R(x, y, W, T, K('conc', 1)); c.HL(x, y, W, K('conc', 3)); c.VL(x, y, T, K('conc', 2)); c.HL(x, y + T - 1, W, K('conc', 0))   # 윗면
    c.R(x, fy, W, F, K(body, 1)); c.VL(x, fy, F, K(body, 3)); c.VL(x + 1, fy, F, K(body, 2))
    c.VL(x + W - 1, fy, F, K(body, -1)); c.VL(x + W - 2, fy, F, K(body, 0)); c.HL(x, fy, W, K(body, 3))
    c.R(x + 3, fy + 2, 16, 3, K('shiro', 3)); c.R(x + 6, fy + 3, 3, 1, K(body, 2)); c.R(x + 12, fy + 3, 3, 1, K(body, 2))   # 무늬 띠(글자 아님)
    wx, wy, ww, wh = x + 3, fy + 7, 17, 15
    c.R(wx - 1, wy - 1, ww + 2, wh + 2, K('tekko', -3)); c.R(wx, wy, ww, wh, K('tekko', -1)); c.HL(wx, wy, ww, K('tekko', 1))
    cols = ['sora', 'kii', 'midori', 'aka', 'daidai', 'sora', 'kii', 'midori', 'aka', 'daidai', 'sora', 'kii', 'midori', 'aka', 'daidai']
    for row in range(3):
        sy = wy + 2 + row * 4
        for k in range(5):
            cx = wx + 1 + k * 3; cc = cols[row * 5 + k]
            c.R(cx, sy, 2, 3, K(cc, 2)); c.VL(cx, sy, 3, K(cc, 4)); c.P(cx + 1, sy + 2, K(cc, 0)); c.P(cx, sy - 1, K('shiro', 3))
        if row < 2: c.HL(wx, sy + 3, ww, K('tekko', 1))
    px = x + 22
    for k in range(4): c.R(px, wy + 1 + k * 3, 3, 2, K('shiro', 3) if k != 1 else K('kii', 3)); c.HL(px, wy + 2 + k * 3, 3, K('tekko', 1))
    c.R(px, wy + 13, 3, 2, K('tekko', -2))                                               # 동전구
    c.R(x + 4, fy + 25, 16, 6, K('tekko', -3)); c.R(x + 5, fy + 26, 14, 4, K('tekko', -1)); c.HL(x + 5, fy + 25, 14, K('tekko', 0))   # 취출구
    c.R(x, fy + F - 3, W, 3, K('tekko', 0)); c.HL(x, fy + F - 1, W, K('tekko', -2))     # 킥판
    box(c, x - 1, y - 1, W + 2, T + F + 1, OL); c.HL(x - 1, fy - 1, W + 2, OL)
    shade_floor(c, x, y + T + F, W + 1)


# ─────────────────────────── 조립(셀 자르기·키트) ───────────────────────────
def _render(fn, w, h):
    c = Cv(w * 16, h * 16)
    fn(c)
    return c.a.copy()


def _cut(a, R, C, key_of, add):
    out = []
    for cy in range(R):
        row = []
        for cx in range(C):
            t = a[cy * 16:(cy + 1) * 16, cx * 16:(cx + 1) * 16]
            row.append(None if t[:, :, 3].max() == 0 else add(t, cx, cy))
        out.append(row)
    return out


PARTS = {      # 계약 part 는 x·y·w·h 를 다 적는다. 개찰구 통로는 걸음 칸이라 entrance(막힌 문 칸)가 아니다.
    'subway-stairs-down': [dict(kind='anchor', x=1, y=2, w=2, h=1, label='계단 입구(전이 이벤트 자리 — 승강장으로)')],
    'subway-stairs-up': [dict(kind='anchor', x=1, y=2, w=2, h=1, label='계단 입구(전이 이벤트 자리 — 지상 출구로)')],
    'subway-sign-exit': [dict(kind='sign', x=0, y=0, w=3, h=1)],
    'subway-sign-exit-up': [dict(kind='sign', x=0, y=0, w=3, h=1)],
    'subway-sign-line': [dict(kind='sign', x=0, y=0, w=3, h=1)],
    'subway-station-sign': [dict(kind='sign', x=0, y=0, w=8, h=3)],
    'subway-station-sign-hang': [dict(kind='sign', x=0, y=0, w=6, h=2)],
    'subway-office': [dict(kind='window', x=0, y=0, w=4, h=2)],
    'subway-ticket': [dict(kind='sign', x=0, y=0, w=6, h=1)],
}
ACCESS = {}    # 접근칸은 ai.access 형식({dx, dy})만 — 안내 문장은 rules 에 적었다

_CACHE = {}


def _finalize():
    if 'r' in _CACHE: return _CACHE['r']
    cells = collections.OrderedDict(); seen = {}; kits = []; sprites = {}; gcells = collections.defaultdict(list)
    for p in P:
        R, C = p['h'], p['w']

        def adder(base):
            def add(t, cx, cy):
                if base: pc = 'solidfloor' if (cx, cy) in [tuple(s) for s in p['ground_solid']] else 'floor'
                else: pc = 'solid' if (cx, cy) in [tuple(s) for s in p['solid']] else p['other']
                key = (t.tobytes(), pc)
                if key in seen: return seen[key]
                local = '%s/%s%d.%d' % (p['id'], 'g' if base else '', cx, cy)
                cells[local] = dict(img=Image.fromarray(t.copy(), 'RGBA'), pc=pc, label='%s %d,%d' % (p['name'], cx, cy),
                                    desc=p['name'] + (' 바닥' if base else ''), tags=list(p['tags']))
                seen[key] = local; gcells[p['id']].append(local)
                return local
            return add
        base = _cut(_render(p['ground'], C, R), R, C, None, adder(True)) if p['ground'] else None
        grid = _cut(_render(p['draw'], C, R), R, C, None, adder(False)) if p['draw'] else [[None] * C for _ in range(R)]
        spr = Cv(C * 16, R * 16)
        if p['ground']: p['ground'](spr)
        if p['draw']: p['draw'](spr)
        sprites[p['id']] = spr.a.copy()
        ai = dict(snap='floor', tags=list(p['tags']), description=p['name'], placementRules=p['rules'],
                  repeatability='repeat' if p['repeat'] else 'fixed', growthAxis=p['repeat'],
                  anchor=dict(dx=1 if p['id'].startswith('subway-stairs') else 0, dy=R - 1),
                  access=ACCESS.get(p['id'], []), role=p['role'])
        kit = dict(id='jp-' + p['id'], name=p['name'], grid=grid, parts=PARTS.get(p['id'], []), ai=ai)
        if base is not None: kit['base'] = base
        kits.append(kit)
    groups = []
    for p in P:
        if not gcells[p['id']]: continue
        layer = 'lower' if p['ground'] and not p['draw'] else 'upper'
        groups.append(dict(id='jp:%s' % p['id'], name=p['name'], role=p['role'], defaultLayer=layer,
                           cells=gcells[p['id']], desc=p['name'], rules=p['rules']))
    _CACHE['r'] = (cells, groups, kits, sprites)
    return _CACHE['r']


NOTES = ('지하철역(콘코스·승강장) 손 도트 %d키트. 콘코스: 흰 타일 벽 2줄 → 매표기·계단(위)·역무실은 벽을 품고 벽 줄에 붙인다. '
         '개찰구는 9칸 가로로 콘코스를 막고 홀수 열로 지나간다. 승강장: 뒷벽 3줄 → 선로 2줄(solidfloor) → 승강장 끝 1줄 → 바닥. '
         '열차(jp-subway, 30칸)는 선로 2줄을 발자국으로 쓴다 → 승강장은 32칸 이상. 역명판은 8×3 뒷벽 변형(16px 글자라 6칸에 안 들어감) — 열차가 서면 가려지므로 기둥 사이에 매단 역명판(6×2)을 함께 둔다. '
         '맨 위 줄에 천장 보(jp-subway-ceiling)를 가로로 깐다. 개찰구 양옆은 칸막이(jp-subway-fence)로 벽·기둥까지 막는다. '
         '기둥은 콘코스 = pillar-plain, 승강장 = pillar(번호판). 점자 유도 블록은 바닥 타일이 아니라 장면 합성 때 그리는 선이다: '
         '출구 계단 → 매표기 → 개찰 통로 → 내려가는 계단, 승강장은 끝 줄의 점자 블록에서 계단 쪽으로 가지를 낸다.')


def build():
    cells, groups, kits, _ = _finalize()
    return {'cells': collections.OrderedDict((k, dict(v, img=v['img'].copy(), tags=list(v['tags']))) for k, v in cells.items()), 'autotiles': [], 'groups': groups, 'kits': kits,
            'notes': NOTES % len(kits)}


# ─────────────────────────── 장면·렌더 ───────────────────────────
def _kit(id_): return next(k for k in _finalize()[2] if k['id'] == 'jp-' + id_)


def _tactile(img, path, ghost=()):
    """점자 유도 블록 덧칠(장면 합성 때만, 바닥 1층 위·소품 3층 아래). path: 이어진 칸 목록.
    곧은 칸은 선형 블록, 꺾임·갈래·끝은 점형 블록(jp-tactile 모양 재구현)."""
    a = np.array(img); S = set(path) | set(ghost)   # ghost: 이어짐만 세고 그리지 않는 칸(끝 블록 줄 등)
    cyc = [K('kii', n) for n in (0, 2, 1)]
    def put(px, py, col): a[py, px] = ((col >> 16) & 255, (col >> 8) & 255, col & 255, 255)
    for (x, y) in path:
        ox, oy = x * 16, y * 16
        nb = {d for d, (dx, dy) in dict(E=(1, 0), W=(-1, 0), N=(0, -1), S=(0, 1)).items() if (x + dx, y + dy) in S}
        straight = nb in ({'E', 'W'}, {'N', 'S'})
        for d in nb:
            if d in 'EW':
                xs = range(0, 16) if straight else (range(12, 16) if d == 'E' else range(0, 4))
                for r in range(10):
                    for px in xs: put(ox + px, oy + 3 + r, cyc[r % 3])
            else:
                ys = range(0, 16) if straight else (range(12, 16) if d == 'S' else range(0, 4))
                for r in range(10):
                    for py in ys: put(ox + 3 + r, oy + py, cyc[r % 3])
        if not straight:
            for py in range(3, 13):
                for px in range(3, 13):
                    put(ox + px, oy + py, K('kii', 0) if px in (3, 12) or py in (3, 12) else K('kii', 1))
            for dx in (4, 7, 10):
                for dy in (4, 7, 10):
                    for ex, ey in ((0, 0), (1, 0), (0, 1)): put(ox + dx + ex, oy + dy + ey, K('kii', 2))
                    put(ox + dx + 1, oy + dy + 1, K('kii', 0))
    return Image.fromarray(a, 'RGBA')


def _line(*pts):
    """꺾은선 꼭짓점 → 칸 목록."""
    out = []
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(abs(x1 - x0), abs(y1 - y0))
        for i in range(n + 1):
            q = (x0 + (x1 - x0) * i // n, y0 + (y1 - y0) * i // n)
            if q not in out: out.append(q)
    return out


WALL_OVERLAY = {'subway-extinguisher'}


def _compose(W, H, base_fill, places, bg=(0, 0, 0, 255), tactile=None):
    """base_fill: (x,y)->cell key (1층). places: [(kit_id, x, y)] 순서대로 1층(base) 후 3층(grid)."""
    cells = _finalize()[0]
    L1 = {}; L3 = {}; L4 = {}   # L4: 벽에 겹치는 장식(소화기) — 밑 벽 칸을 지우지 않고 위에 얹는다
    for y in range(H):
        for x in range(W):
            k = base_fill(x, y)
            if k: L1[(x, y)] = k
    for kid, px, py in places:
        kit = _kit(kid)
        for cy, row in enumerate(kit.get('base') or []):
            for cx, k in enumerate(row):
                if k and 0 <= px + cx < W and 0 <= py + cy < H: L1[(px + cx, py + cy)] = k
        for cy, row in enumerate(kit['grid']):
            for cx, k in enumerate(row):
                if k and 0 <= px + cx < W and 0 <= py + cy < H: (L4 if kid in WALL_OVERLAY else L3)[(px + cx, py + cy)] = k
    img = Image.new('RGBA', (W * 16, H * 16), bg)
    for L in (L1, L3, L4):
        for (x, y), k in L.items():
            t = cells[k]['img']
            img.alpha_composite(t, (x * 16, y * 16))
        if L is L1 and tactile: img = _tactile(img, *tactile) if isinstance(tactile, tuple) else _tactile(img, tactile)
    return img


def scene_concourse():
    W, H = 20, 13
    places = [('subway-ceiling', x, 0) for x in range(W)] + [('subway-wall', x, 1) for x in range(W)]
    places += [('subway-ticket', 1, 1), ('subway-stairs-up', 8, 1), ('subway-office', 15, 1),
               ('subway-gates', 5, 7), ('subway-stairs-down', 8, 10)]
    places += [('subway-fence', x, 8) for x in (0, 1, 2, 3, 4, 14, 15, 16, 17, 18, 19)]
    places += [('subway-pillar-plain', 2, 5), ('subway-pillar-plain', 17, 5), ('subway-pillar-plain', 2, 9), ('subway-pillar-plain', 17, 9)]
    places += [('subway-sign-exit', 12, 5), ('subway-sign-line', 4, 10)]
    path = _line((2, 4), (18, 4)) + _line((10, 5), (10, 9))                    # 매표기 앞 → 출구 계단 → 역무실 앞 끝(맵 line(2,4,22,4)) / 개찰 통로 → 내려가는 계단
    return _compose(W, H, lambda x, y: 'subway-floor/g0.0', places, tactile=path)


def scene_platform(train=False):
    W, H = 36, 14
    places = [('subway-ceiling', x, 0) for x in range(W)] + [('subway-backwall', x, 1) for x in range(W)]
    places += [('subway-backwall-ad', 3, 1), ('subway-station-sign', 14, 1), ('subway-backwall-ad', 28, 1)]
    places += [('subway-track', x, 4) for x in range(W)] + [('subway-edge', x, 6) for x in range(W)]
    for x in (6, 18, 30): places.append(('subway-pillar', x, 6))
    places += [('subway-bench', 26, 9), ('subway-bench', 2, 9), ('subway-led', 22, 7),
               ('subway-station-sign-hang', 9, 7), ('subway-stairs-up', 12, 10), ('subway-sign-exit-up', 17, 9),
               ('subway-vending', 8, 10), ('subway-recycle', 31, 8), ('subway-extinguisher', 11, 2)]
    # 승강장 끝 점자(6줄) → 계단 옆 16열 세로 → 계단 입구(13·14, 12) 앞 13줄 가로 (맵 station.mjs 승강장과 같은 꼴)
    path = (_line((16, 7), (16, 13), (13, 13)), [(16, 6)])
    img = _compose(W, H, lambda x, y: 'subway-platform/g0.0', places, tactile=path)
    if train:
        fr = Image.open(TRAIN).convert('RGBA').crop((0, 0, 480, 64))           # 오른쪽을 보는 프레임(시트 맨 왼쪽)
        tr = Image.new('RGBA', img.size, (0, 0, 0, 0)); tr.alpha_composite(fr, (3 * 16, 6 * 16 - 64))
        # 열차는 선로(4~5줄) 위, 승강장 끝 앞의 기둥·LED·매단 역명판은 열차보다 앞에 그린다
        front = _compose(W, H, lambda x, y: None, [p for p in places if p[0] in (
            'subway-pillar', 'subway-led', 'subway-bench', 'subway-edge', 'subway-station-sign-hang',
            'subway-stairs-up', 'subway-sign-exit-up', 'subway-vending', 'subway-recycle')], bg=(0, 0, 0, 0))
        img.alpha_composite(tr); img.alpha_composite(front)
    return img


def _x(img, k): return img.resize((img.width * k, img.height * k), Image.NEAREST)


def render_all():
    os.makedirs(OUTDIR, exist_ok=True)
    cells, groups, kits, sprites = _finalize()
    floor = np.array(cells['subway-floor/g0.0']['img'])
    tiles = []
    for p in P:
        a = sprites[p['id']]; h, w = a.shape[:2]
        bg = Image.new('RGBA', (w, h))
        for y in range(0, h, 16):
            for x in range(0, w, 16): bg.alpha_composite(Image.fromarray(floor, 'RGBA'), (x, y))
        bg.alpha_composite(Image.fromarray(a, 'RGBA'))
        bg.save(os.path.join(OUTDIR, 'jp-%s.png' % p['id'])); tiles.append(bg)
    Wmax = 1100; pad = 8; x = pad; y = pad; rowh = 0; pos = []
    for t in tiles:
        tw, th = t.width * 2, t.height * 2
        if x + tw + pad > Wmax: x = pad; y += rowh + pad; rowh = 0
        pos.append((x, y)); x += tw + pad; rowh = max(rowh, th)
    sheet = Image.new('RGBA', (Wmax, y + rowh + pad), (104, 103, 122, 255))
    for t, (px, py) in zip(tiles, pos): sheet.alpha_composite(_x(t, 2), (px, py))
    sheet.save(os.path.join(OUTDIR, '_all-x2.png'))
    for name, img in (('scene-concourse', scene_concourse()), ('scene-platform', scene_platform()),
                      ('scene-platform-train', scene_platform(True))):
        img.save(os.path.join(OUTDIR, name + '.png')); _x(img, 3).save(os.path.join(OUTDIR, name + '-x3.png'))
    return len(tiles)


def selftest():
    cells, groups, kits, sprites = _finalize()
    out = []
    for k, c in cells.items():
        for m in check_cell(c['img']): out.append('(a) %s: %s' % (k, m))
        if c['pc'] not in ('floor', 'solidfloor', 'flat', 'solid', 'star'): out.append('(a) %s: pc %s' % (k, c['pc']))
    for kit in kits:                                                           # (b) 셀로 다시 맞추면 스프라이트와 같아야
        p = next(q for q in P if 'jp-' + q['id'] == kit['id'])
        R, C = p['h'], p['w']; re_ = np.zeros((R * 16, C * 16, 4), np.uint8)
        im = Image.fromarray(re_, 'RGBA')
        for L in ([kit.get('base')] if kit.get('base') else []) + [kit['grid']]:
            for cy, row in enumerate(L):
                for cx, k in enumerate(row):
                    if k: im.alpha_composite(cells[k]['img'], (cx * 16, cy * 16))
        if not np.array_equal(np.array(im), sprites[p['id']]): out.append('(b) %s: 재조립 불일치' % kit['id'])
        for (sx, sy) in p['solid']:
            if kit['grid'][sy][sx] is None: out.append('(e) %s: 막힌 칸 %d,%d 가 비었다' % (kit['id'], sx, sy))
        if kit['ai']['role'] not in ('building', 'castle', 'fence', 'roof', 'terrain', 'water', 'wall', 'prop'):
            out.append('(e) %s: role' % kit['id'])
    ids = [k['id'] for k in kits]
    if len(ids) != len(set(ids)): out.append('(e) kit id 중복')
    for c in cells.values():                                                   # 알파 0/255 만
        al = np.unique(np.array(c['img'])[:, :, 3])
        if not set(al.tolist()) <= {0, 255}: out.append('(a) 반투명 알파')
    n = render_all()
    for m in out: print(m)
    print('%s: kits %d, cells %d, groups %d, png %d, 실패 %d' % (BLOCK, len(kits), len(cells), len(groups), n, len(out)))
    return len(out)


if __name__ == '__main__':
    sys.exit(1 if selftest() else 0)
