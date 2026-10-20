#!/usr/bin/env python3
# noqa: SIZE_OK - jp-inaka walls / fences / water crossings (3/4 top-down)
# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "pillow"]
# ///
"""jp-inaka 담·울타리·물 건너기 키트: 수문·죽담(建仁寺垣)·이끼 돌담 2종·붉은 철교·징검다리. (R5 에서 inaka_art_props.py 에서 떼어 냄)"""
from __future__ import annotations

from inaka_art_houses import (  # noqa: E402,F401
    OL, Cv, H, J, K, add_outline, disc, kit, line, post, rect_3d, rows, stones,
)
from inaka_art_props import _blit  # noqa: E402
from inaka_style import ground_shadow, tint_outlines  # noqa: E402,F401


@kit('inaka-sluice-gate', '농수로 수문(水門) - 양 둑 콘크리트 기둥·3/4 윗면 다리판 보도·핸들 축·내려온 철 수문판·아래 흰 물거품(2×2)', 2, 2, 'structure',
     solid=[(0, 0), (1, 0), (0, 1), (1, 1)], tags=['inaka', '수문', '水門', '농수로'],
     rules='폭 2칸 남북 농수로(수로) 위에 가로질러 놓는다. 양 기둥이 양쪽 호안에 선다.', role='water')
def sluice(c, base):
    # 물(수로 물 색) + 수문 밑 흰 물거품
    c.R(6, 22, 20, 10, J('canal_indigo', 2))
    c.HL(6, 29, 20, J('canal_indigo', 3)); c.HL(9, 31, 6, J('canal_indigo', 4))
    for x in range(7, 25):
        c.P(x, 23, K('shiro', 3 if x % 3 else 2)); c.P(x, 24, K('shiro', 1) if x % 2 else J('canal_indigo', 4))
        if x % 4 == 1: c.P(x, 25, K('shiro', 1))
    # 철 수문판: 기둥 홈 사이로 내려와 물에 잠긴다(가로 보강대 + 왼쪽 빛)
    c.R(6, 12, 20, 11, K('tekko', 0))
    for y in (14, 18): c.HL(6, y, 20, K('tekko', 2)); c.HL(6, y + 1, 20, K('tekko', -1))
    c.VL(6, 12, 11, K('tekko', 2)); c.HL(6, 22, 20, K('tekko', -2))
    for x in (10, 16, 22): c.P(x, 16, K('tekko', 3))
    # 양 둑 콘크리트 기둥(호안 위): 윗면 3px + 정면, 안쪽 홈은 짙게
    rect_3d(c, 0, 4, 7, 28, 3, 'concrete_grey', top_t=3, front_t=2)
    rect_3d(c, 25, 4, 7, 28, 3, 'concrete_grey', top_t=3, front_t=1)
    c.VL(6, 9, 22, J('concrete_grey', 0)); c.VL(25, 9, 22, J('concrete_grey', 0))
    # 다리판 보도(3/4 윗면 + 앞 갓) + 뒤 난간
    c.HL(0, 2, 32, OL); c.HL(1, 3, 30, K('tekko', 1))
    rect_3d(c, 0, 5, 32, 7, 4, 'concrete_grey', top_t=4, front_t=2)
    # 핸들 축(가운데 세로 나사봉) + 붉은 핸들 바퀴(타원 윗면)
    c.R(15, 0, 2, 7, K('tekko', 1)); c.VL(15, 0, 7, K('tekko', 3))
    disc(c, 16, 2, 4.6, OL, ry=2.0); disc(c, 16, 2, 3.8, K('aka', 1), ry=1.4); disc(c, 16, 2, 2.0, K('aka', -1), ry=0.6)
    c.P(13, 1, K('aka', 3)); c.P(16, 2, K('tekko', 3))


# 대나무 줄기 문법: PR #3026(jp_regions_pack.bamboo_culm, 보류 중)과 같은 규칙을 이나카 팩 안에 둔다.
#   줄기 2~3px(왼쪽 빛·몸·오른쪽 그늘), 줄기마다 윤곽선 없음, 마디 7~9px 간격으로 줄기마다 어긋남(마디 줄 + 바로 위 밝은 턱).
def bamboo_culm(c, x, top, bot, w=3, depth=2, seed=0, lean=0):
    """대나무 줄기 하나: x = 밑동 왼쪽 열, top~bot(포함), 폭 w(2|3), depth 0 뒤(그늘) · 1 가운데 · 2 앞(밝음)."""
    hi, body, sh = ((('pine_bamboo', 2), ('pine_bamboo', 1), ('pine_bamboo', 0)),
                    (('pine_bamboo', 4), ('pine_bamboo', 3), ('pine_bamboo', 2)),
                    (('moss', 4), ('pine_bamboo', 4), ('pine_bamboo', 3)))[depth]
    hi, body, sh = J(*hi), J(*body), J(*sh)
    node = J('pine_bamboo', (0, 1, 2)[depth])
    ridge = J(*(('pine_bamboo', 3), ('moss', 4), ('tatami_straw', 3))[depth])
    span = max(1, bot - top)
    gap = 7 + int(H(x, depth, seed) * 3)
    first = bot - 3 - int(H(x, top, seed + 1) * gap)
    dark = J('pine_bamboo', max(0, (0, 1, 2)[depth] - (depth == 0)))
    for y in range(top, bot + 1):
        ox = x + round(lean * ((bot - y) / span) ** 2)
        ww = w if y > top + 6 else max(2, w - 1)
        seg = (first - y) % gap if y < first else gap
        c.P(ox, y, hi)
        if ww == 3: c.P(ox + 1, y, body if seg not in (1, 2) else sh)
        c.P(ox + ww - 1, y, sh if seg != 1 else dark)
        if y < first and y > top + 2 and seg == 0:
            c.HL(ox, y, ww, node)
        elif y < first - 1 and y > top + 2 and seg == gap - 1:
            c.HL(ox, y, ww - 1, ridge)


def _takegaki_panel(c, x0, x1, top, bot, seed):
    """建仁寺垣 판: 3px 쪼갠 대를 빈틈없이 세운 판(줄기 사이 윤곽 없음, 앞뒤 단을 섞어 결을 낸다) +
    위 갓대(玉縁) + 가로 누름대(押縁) 2줄 + 검은 종려 끈 매듭. 줄기마다 마디 높이가 어긋나 사다리 가로대로 읽히지 않는다."""
    k = 0
    c.R(x0, top, x1 - x0, bot - top + 1, J('pine_bamboo', 1))      # 판 뒤 그늘: 줄기 끝이 가늘어진 틈이 투명하면 윤곽이 검은 눈금으로 들어찬다
    for x in range(x0, x1, 3):
        tp = top + (1 if H(x, 1, seed) > 0.55 else 0)
        bamboo_culm(c, x, tp, bot, w=min(3, x1 - x), depth=(2, 1, 2, 1, 0)[k % 5] if H(x, 2, seed) > 0.25 else 1, seed=seed + k)
        k += 1
    # 갓대(玉縁) 윗면: 위에서 내려다본 반쪽 대 3줄(밝은 등·몸·그늘) + 앞 처마 그늘 1줄 — 3/4 윗면이 2줄로 얇으면 정면 입면으로 읽힌다.
    c.HL(x0, top - 2, x1 - x0, J('pine_bamboo', 4)); c.HL(x0, top - 1, x1 - x0, J('pine_bamboo', 3))
    for x in range(x0, x1):
        c.P(x, top, J('pine_bamboo', 2 if (x // 5 + top) % 3 else 3))      # 반쪽 대 이음 마디가 윗면에 드문드문
    c.HL(x0, top + 1, x1 - x0, J('pine_bamboo', 0))
    for y in (top + 6, bot - 5):                                   # 누름대: 밝은 윗면 + 그늘
        c.HL(x0, y, x1 - x0, J('tatami_straw', 3)); c.HL(x0, y + 1, x1 - x0, J('tatami_straw', 1))
        for x in range(x0 + 2 + (y % 3), x1 - 1, 6):
            c.P(x, y, K('sumi', 1)); c.P(x, y + 1, K('sumi', 0))   # 종려 끈 매듭


@kit('inaka-bamboo-fence-gate', '대나무 울타리와 문(建仁寺垣) - 쪼갠 대 판·갓대·누름대·종려 끈·작은 기와 문(4×2)', 4, 2, 'structure',
     solid=[(0, 1), (1, 1), (3, 1)], tags=['inaka', '대나무울타리', '竹垣', '문'],
     rules='농가 마당 경계. 세 번째 칸이 드나드는 문.', role='fence')
def bamboo_fence(c, base):
    t = Cv(c.w, c.h)
    _takegaki_panel(t, 0, 33, 12, 28, 3)
    _takegaki_panel(t, 57, 64, 12, 28, 8)
    for x in (33, 54):                                           # 문 기둥 + 갓(윗면)
        post(t, x, 6, 25, 'aged_cedar', 2, 3)
        rect_3d(t, x - 2, 3, 7, 4, 2, 'kawara_dark_tile', top_t=3, front_t=1)
    rect_3d(t, 31, 1, 28, 5, 2, 'kawara_dark_tile', top_t=3, front_t=1)   # 문 위 작은 기와 지붕
    t.HL(36, 10, 18, J('aged_cedar', 2)); t.HL(36, 11, 18, J('aged_cedar', 0))
    add_outline(t)                                               # 실루엣만 윤곽(대 판 안쪽은 윤곽 없음)
    c.HL(1, 30, 31, K('yoru', -1)); c.HL(58, 30, 6, K('yoru', -1))   # 발치 그늘
    _blit(c, t)


def _mossy_wall(c, seed):
    """이끼 돌담 4×2 한 토막. 양옆 끝에 윤곽을 두르지 않아 이어 붙여도 4칸마다 검은 세로 이음매가 생기지 않는다(줄눈만 1px 어두운 돌색).
    윗줄·밑줄 윤곽은 가로로 이어지고, 이끼는 열마다 한두 줄 아래로 흘러내린다. 풀포기는 윤곽 없는 풀잎 3장."""
    c.HL(0, 4, 64, OL); c.HL(0, 30, 64, OL)
    y = 11                                                       # 줄 높이는 두 토막 모두 6·7·6px 로 고정: 이어 놓았을 때 가로 줄눈이 끊기지 않는다
    for k, ch in enumerate((6, 7, 6)):                           # (돌 폭·엇갈림·이끼만 토막마다 다르다)
        stones(c, 0, y, 64, ch, 'shrine_flagstone', seed=seed + 31 * k, course=(ch, ch), width=(8, 13), moss=0.18)
        y += ch
    for x in range(64):                                          # 윗길: 이끼 2~3단 클러스터 + 열마다 흘러내림
        drip = 10 + int(H(x // 2, 1, seed + 7) * 3)
        for y in range(5, drip + 1):
            h = H(x // 3, y // 2, seed + 6)
            c.P(x, y, J('moss', 3 if h < 0.5 else 4 if h < 0.7 else 2))
        c.P(x, drip, J('moss', 1))
    for k in range(4):                                           # 윗길 풀포기(토막마다 자리 다름)
        x = 4 + k * 16 + int(H(k, 2, seed) * 9)
        c.P(x, 4, J('pine_bamboo', 2)); c.P(x + 1, 4, J('pine_bamboo', 3)); c.P(x + 2, 4, J('pine_bamboo', 2))
        c.P(x, 3, J('pine_bamboo', 3)); c.P(x + 1, 2, J('pine_bamboo', 4)); c.P(x + 2, 3, J('moss', 4))


@kit('inaka-mossy-stone-wall', '이끼 낀 돌담 - 이끼 덮인 윗길·돌 쌓기 정면(4×2)', 4, 2, 'wall',
     solid=rows(4, [0, 1]), tags=['inaka', '돌담', '石垣', '이끼'],
     rules='경사 밭·집터 경계를 가로로 이어 쌓는다. 길게 이을 때는 inaka-mossy-stone-wall-mid 와 번갈아 놓는다.', role='wall')
def stone_wall(c, base):
    _mossy_wall(c, 5)


@kit('inaka-mossy-stone-wall-mid', '이끼 낀 돌담(이음 토막) - 다른 돌 쌓기·이끼 결(4×2)', 4, 2, 'wall',
     solid=rows(4, [0, 1]), tags=['inaka', '돌담', '石垣', '이끼'],
     rules='inaka-mossy-stone-wall 과 번갈아 가로로 이어 쌓아 4칸마다 같은 돌 무늬가 되풀이되지 않게 한다.', role='wall')
def stone_wall_mid(c, base):
    _mossy_wall(c, 17)


@kit('inaka-red-iron-bridge', '붉은 철교(人道橋) - 먼 난간·판재 다리 바닥 윗면·가까운 난간 갓 윗면·거더(6×3)', 6, 3, 'structure',
     solid=rows(6, [0]), other='floor', tags=['inaka', '철교', '다리', '橋'],
     rules='개울·수로 위에 가로로. 가운데 줄(바닥 판재)을 건넌다.', role='terrain')
def iron_bridge(c, base):
    W = 96
    # 먼 난간(북): 갓 윗면 2px + 세로 살
    c.R(0, 6, W, 3, OL); c.HL(1, 7, W - 2, K('aka', 2)); c.HL(1, 8, W - 2, K('aka', 0))
    for x in range(3, W - 2, 6): c.R(x, 9, 2, 7, K('aka', -1))
    c.HL(1, 13, W - 2, K('aka', -1))
    # 다리 바닥(윗면 판재: 세로 줄눈 + 판 끝 엇갈림)
    c.R(0, 16, W, 22, J('aged_cedar', 3))
    for x in range(0, W, 4): c.VL(x, 16, 22, J('aged_cedar', 2))
    for x in range(0, W, 8): c.P(x + 1, 16 + (x * 5) % 19, J('aged_cedar', 1))
    c.HL(0, 16, W, J('aged_cedar', 1))
    # 가까운 난간(남): 기둥 + 갓 윗면 + 가로대
    for x in range(1, W, 16):
        c.R(x, 30, 3, 10, K('aka', 1)); c.VL(x, 30, 10, K('aka', 2)); c.VL(x + 2, 30, 10, K('aka', -1))
    c.HL(0, 29, W, OL); c.HL(0, 30, W, K('aka', 2)); c.HL(0, 31, W, K('aka', 1)); c.HL(0, 32, W, OL)
    c.HL(0, 36, W, K('aka', 0))
    # 거더(앞면, 리벳)
    c.R(0, 39, W, 7, K('aka', -1)); c.HL(0, 39, W, K('aka', 1)); c.HL(0, 45, W, K('aka', -2))
    for x in range(3, W, 6): c.P(x, 42, K('aka', 1))
    c.HL(0, 46, W, OL)
    c.HL(0, 47, W, K('kon', -1))                                  # 물에 진 그늘
    # 양 끝 돌 교대(橋台): 거더 끝이 둑 돌 위에 얹힌다
    for ax in (0, W - 7):
        c.R(ax, 38, 7, 10, OL)
        stones(c, ax + 1, 39, 5, 8, 'shrine_flagstone', seed=ax + 3, course=(4, 4), width=(4, 6), moss=0.2)
        c.HL(ax + 1, 39, 5, J('shrine_flagstone', 4))


@kit('inaka-stepping-stones', '개울 징검다리(飛び石) - 윗면 밝은 납작 돌·물에 잠긴 옆면(4×2)', 4, 2, 'terrain',
     solid=[], other='floor', tags=['inaka', '징검다리', '飛び石'],
     rules='얕은 개울(inaka-river-shallow) 위에 깔아 건넌다.', role='terrain')
def stepping(c, base):
    for k, (x, y, rx, ry) in enumerate(((7, 9, 6, 3.6), (22, 18, 6.5, 3.8), (38, 10, 6, 3.4), (54, 19, 6.5, 3.8), (28, 4, 4, 2.4))):
        disc(c, x + 0.5, y + 2.6, rx + 0.4, K('kon', -1), ry=ry)   # 물 그늘
        disc(c, x, y + 1.6, rx + 0.8, OL, ry=ry + 0.9)
        disc(c, x, y + 1.4, rx, J('shrine_flagstone', 1), ry=ry)   # 옆면
        disc(c, x, y, rx, J('shrine_flagstone', 3), ry=ry - 0.6)   # 윗면
        disc(c, x - rx * 0.3, y - ry * 0.3, rx * 0.45, J('shrine_flagstone', 4), ry=ry * 0.3)
        c.HL(round(x - rx) + 1, round(y + ry) + 2, round(rx * 2) - 1, K('shiro', 2))   # 물살
