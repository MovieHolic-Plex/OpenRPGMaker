"""던전 시트 — 방 계열 세 장소: 유령 탑(포켓몬 타워·送り火山) · 발전소/악당 아지트(무인발전소·로켓단 아지트·마그마 아지트) · 고대 유적(봉인의 방·사막 유적·석실).

원작에서 잰 장소 문법(pret 렌더를 눈으로 읽은 것, 픽셀 복사 없음). 세 방 모두 맵 위 두 줄은 뒷벽(`<p>_wall_up/dn`, 양 끝 `_l/_r`),
옆·아래 테는 검은 여백(`<p>_edge_*`), 뒷벽 바로 아래 바닥 줄은 한 톤 그늘(`<p>_fl_s`)이다.
- 유령 탑: 뒷벽은 흰 천장 끝 아래 보라 판벽(세로 살창). 바닥은 **칸 경계를 넘어 이어지는 작은 지그재그(헤링본)** 2톤, 윤곽선 없음 —
  칸마다 큰 마름모를 찍으면 이불·욕실 타일로 읽혔다. 방 가장자리 한 칸은 어둠 띠(`gh_dim_*`: 바닥 한 톤 어둡게 4px + 순검정, 디더 없음).
  묘비는 보라회색 둥근 머리 비석(가로 글줄 둘 + 넓은 받침)으로 **가로 줄을 맞춰** 늘어서고 줄 사이가 통로다. 계단은 뒷벽 두 줄에 박힌
  돌 문틀(흰 상인방 + 보라 기둥) 속 단(밝은 디딤 + 어두운 챌면, 위로 갈수록 어둡다). 출구는 아래 테 가운데의 밝은 주황 매트.
  촛대(1칸, 굵은 초)·향로(돌 받침 세 발 솥)·공양 경단 접시는 묘비 줄 끝이나 비석 앞에.
- 발전소·아지트: 바닥은 리벳 금속판, 뒷벽은 **바닥과 다른 밝은 판(세로 이음매 8px) + 배관 + 경고 띠 + 어두운 걸레받이**.
  올린 칸막이(`pw_pb`)는 윗면이 칸 대부분(청록 판 + 리벳)이고 남쪽이 빈 칸만 아래 4px 앞면 — 높이 있는 상자로 읽힌다(앞면만 있으면 배관으로 읽혔다).
  칸막이 오른쪽 바닥 칸은 6px 직사각 그늘(`pw_fl_e`). 회전 화살표가 칸막이 사이를 밀고 정지 칸·벽·칸막이가 멈춘다.
  기계(발전기·제어반·변압기)는 뒷벽이나 칸막이에 붙이고 전선은 기계에서 나와 벽으로 들어간다(허공에서 끝나지 않는다). 짐은 나무 상자·노란 드럼통.
- 유적: 뒷벽은 새긴 돌 블록(층마다 반 칸 엇갈림) + 벽기둥 + 점자 판(벽기둥은 방 안 기둥과 다른 열에). 바닥은 모래, 길은 무늬 없는 큰 판석(2×2 한 장),
  제단 앞 한 장만 무늬. 올린 돌담(`ru_pb`)은 **두 줄 두께**로 깐다 — 윗면 줄(밝은 민트 판, 칸 이음매 없음, 금 덧그림 `ru_pb_crack*` 를 3~4칸에 하나) + 앞면 줄(아래 칸의 11px 가 둥근 점 두 줄 박힌 진한 청록 앞면),
  담 오른쪽·아래 모래는 그늘(`ru_sand_e/_se/_s`, 담 끝 대각 칸은 `ru_sand_c` 로 두 띠가 「ㄱ」으로 만난다). 출구는 아래 테 바로 위 모래 칸의 노란 반원 빛.
가구 그리기는 본 시트 실내 가구 규칙(interior2.F: 통일 윤곽 i2_ol · 오른쪽 아래 반투명 그림자)을 그대로 쓴다."""
from __future__ import annotations

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
import px  # noqa: E402
from px import T, W  # noqa: E402
import interior2 as i2  # noqa: E402
from interior2 import F, C  # noqa: E402
import buildings as bd  # noqa: E402
import dungeon_kit as dk  # noqa: E402
import gym2 as g2  # noqa: E402


# ==== 유령 탑 ====================================================================================
def gh_floor(P, v: int):
    """탑 바닥: 8px 주기 지그재그(헤링본) 2톤 — 띠 한 줄(어두운 톤) + 그 위 한 줄(밝은 톤), 칸 경계를 넘어 이어진다, 윤곽선 없음.
    v1 은 밝은 줄 한 점이 빠진 낡은 판(격자 반복을 깨는 정도)."""
    d, m, b, l = P["dg_ghfl"]
    im = px.new()
    for y in range(T):
        for x in range(T):
            z = y + abs((x % 8) - 3.5) // 1
            k, n = z % 8, int(z // 8) % 2
            c = m if k == 0 else (l if n == 0 else b) if k == 7 else b      # 밝은 줄은 두 띠에 하나만(I1 X5 — 8px 마다 서던 골판 띠를 누그러뜨린다)
            im.putpixel((x, y), c)
    if v == 1:
        for x, y in ((5, 2), (13, 10)):
            if im.getpixel((x, y)) == l:
                im.putpixel((x, y), b)
    return im


def gh_dim(P, side: str):
    """어둠 가장자리(걷는다): 바깥 2px 는 순검정(여백색), 그 안 4px 는 바닥 한 톤 어둡게 — 디더 없이 두 단. 모서리는 두 변 중 가까운 쪽."""
    base = gh_floor(P, 0)
    vd = P["dg_ghceil"][0]
    im = base.copy()
    for y in range(T):
        for x in range(T):
            ds = []
            if "n" in side: ds.append(y)
            if "s" in side: ds.append(T - 1 - y)
            if "w" in side: ds.append(x)
            if "e" in side: ds.append(T - 1 - x)
            d = min(ds)
            if d < 2:
                im.putpixel((x, y), vd)
            elif d < 6:
                im.putpixel((x, y), px.tint(base.getpixel((x, y)), 0.62))
    return im


def gh_wall_col(P):
    """탑 뒷벽 32px 띠: 흰 천장 끝 → 진한 선 → 보라 판(16px 마다 굵은 틀, 판 안 세로 살 넷) → 진한 걸레받이 → 외곽선."""
    ce, wl, ol = P["dg_ghceil"], P["dg_ghwall"], C(P, "i2_ol")
    def col(x, y):
        if y <= 1: return ce[2]
        if y == 2: return ce[1]
        if y == 3: return ol
        u = x % 16
        if y == 4: return wl[4] if 1 <= u <= 14 else wl[2]
        if y <= 25:
            if u in (0, 15): return wl[0]
            if u in (1, 14): return wl[3] if u == 1 else wl[1]
            if y in (5, 25): return wl[1]
            if 7 <= y <= 22 and 3 <= u <= 12:
                k = (u - 3) % 3
                return wl[1] if k == 2 else wl[3] if (k == 0 and y < 15) else wl[2]
            return wl[2]
        if y == 26: return wl[0]
        if y <= 29: return wl[1] if y == 27 else wl[0] if y == 29 else ce[0]
        if y == 30: return wl[0]
        return ol
    return col


def grave(P, kind: str):
    """묘비(1×1, 막힘, 위층) — 보라회색(벽과 같은 계열). a: 둥근 머리 비석(가로 글줄 둘 + 머리보다 2px 넓은 받침, 포켓몬 타워) ·
    b: 십자 비석 · c: 눕힌 판석(위에서 본 직사각 윗면 + 앞면 2px) · d: a 에 이끼. 그림자는 받침 폭 안 1px 만."""
    st = P["dg_ghstone"]
    f = F(1, 1)
    if kind in ("a", "d"):
        f.r(1, 11, 14, 13, st[1]); f.r(1, 11, 14, 11, st[2])                       # 받침(머리보다 2px 넓다)
        f.r(3, 3, 12, 10, st[2]); f.r(4, 2, 11, 2, st[2]); f.r(5, 1, 10, 1, st[2])    # 둥근 머리(14×13 — 원작처럼 칸을 거의 채운다, I1 X5)
        f.r(4, 2, 10, 2, st[3]); f.r(3, 3, 3, 10, st[3]); f.r(12, 3, 12, 10, st[1])
        for y in (5, 7):                                                           # 가로 글줄 둘(밝은 줄 + 아래 그늘)
            f.r(5, y, 10, y, st[3]); f.r(5, y + 1, 10, y + 1, st[1])
        if kind == "d":
            for x, y in ((3, 9), (3, 10), (4, 10), (2, 11), (3, 11), (4, 11), (5, 11), (11, 2), (12, 3), (12, 4)):   # 이끼 덩이 둘(밑동·어깨)
                f.p(x, y, P["dg_moss"][1])
            f.p(3, 9, P["dg_moss"][2]); f.p(11, 2, P["dg_moss"][2])
    elif kind == "b":
        f.r(1, 11, 14, 13, st[1]); f.r(1, 11, 14, 11, st[2])
        f.r(5, 0, 10, 10, st[2]); f.r(2, 3, 13, 6, st[2])
        f.r(5, 0, 6, 10, st[3]); f.r(2, 3, 13, 3, st[3])
        f.r(10, 1, 10, 10, st[1]); f.r(3, 6, 13, 6, st[1])
    else:
        for y in range(5, 12):                                                     # 윗면: 위가 좁은 사다리꼴(3/4 로 누운 판)
            inset = (11 - y) // 3
            f.r(1 + inset, y, 14 - inset, y, st[2])
            f.p(1 + inset, y, st[3]); f.p(14 - inset, y, st[1])
        f.r(3, 5, 12, 5, st[3])
        f.r(1, 12, 14, 13, st[1])                                                  # 앞면 2px
        f.r(7, 6, 7, 10, st[1]); f.r(5, 8, 10, 8, st[1]); f.p(8, 7, st[3]); f.p(8, 9, st[3])  # 윗면 가운데 작은 십자 홈(세로 이음매로 안 보이게)
    im = f.done(P, shadow=False)
    for x in range(2, 16):
        if im.getpixel((x, 14))[3] == 0 and im.getpixel((x - 1, 13))[3] == 255:
            im.putpixel((x, 14), dk.SHADOW)
    return im


def obelisk(P):
    """큰 비석(1×2, 막힘): 뾰족한 머리의 돌기둥, 앞면 새긴 띠, 넓은 두 단 받침."""
    st = P["dg_ghstone"]
    f = F(1, 2)
    f.r(1, 26, 14, 29, st[1]); f.r(1, 26, 14, 26, st[2]); f.r(2, 23, 13, 25, st[2]); f.r(2, 23, 13, 23, st[3])
    for y in range(3, 23):
        half = 3 + (y - 3) // 8 if y > 6 else max(0, y - 3)
        f.r(8 - half - 1, y, 8 + half, y, st[2])
        f.p(8 - half - 1, y, st[3])
        f.p(8 + half, y, st[1])
    f.r(6, 12, 9, 12, st[0]); f.r(6, 15, 9, 15, st[0]); f.r(7, 18, 8, 18, st[0])
    return f.done(P, floor_y=26)


def candle(P):
    """촛대(1×1, 막힘): 묘비와 같은 회색 돌 받침 + 3px 굵은 흰 초(촛농 한 방울) + 노랑·주황 2px 불꽃. 바닥 빛 원 없음."""
    st, fl, w = P["dg_ghstone"], P["dg_flame"], P["i2_white"]
    f = F(1, 1)
    f.r(3, 12, 12, 14, st[1]); f.r(3, 12, 12, 12, st[2]); f.r(4, 11, 11, 11, st[2])
    f.r(5, 4, 9, 10, w[1]); f.r(5, 4, 5, 10, w[2]); f.r(9, 5, 9, 10, w[0]); f.p(10, 5, w[1]); f.p(10, 6, w[1]); f.p(10, 7, w[1])
    f.r(7, 1, 7, 2, fl[1]); f.p(7, 0, fl[0]); f.p(6, 2, fl[0]); f.p(8, 2, fl[0]); f.p(7, 3, P["dg_iron"][0])
    return f.done(P, floor_y=12)


def censer(P):
    """향로(1×2, 막힘 — 아래 칸이 솥, 위 칸은 연기): 원작 포켓몬 타워 향로처럼 넓고 낮은 세발 솥.
    밝은 입 테(타원) 속에 붉은 숯 점, 낮고 넓은 몸통(왼쪽 위 빛 · 아래 그늘), 짧은 세 발, 그 위로 굽이치며 오르는 반투명 연기 세 줄(위로 갈수록 옅다).
    1×1 의 좁은 입 그릇 + 연기 한 가닥은 원 크기에서 「어두운 술잔」으로 읽혔다(통합 검수 I2 Y4)."""
    st, fl = P["dg_ghstone"], P["dg_flame"]
    f = F(1, 2)
    for x in (3, 11):                                                              # 세 발(양옆 + 가운데 앞) — 짧고 굵다
        f.r(x, 27, x + 1, 30, st[0]); f.p(x, 27, st[1])
    f.r(7, 28, 8, 31, st[0]); f.p(7, 28, st[1])
    f.ell(8.0, 23.6, 7.0, 4.8, st[1])                                              # 둥근 배(아래가 불룩한 솥)
    f.ell(6.4, 22.6, 4.0, 2.6, st[2]); f.ell(5.0, 22.0, 1.6, 1.1, st[3])           # 배 빛(왼쪽 위)
    for x in range(3, 13):                                                         # 배 아래 그늘(둥근 밑)
        f.p(x, 26 if 4 <= x <= 11 else 25, st[0])
    f.r(1, 19, 14, 20, st[3]); f.r(2, 18, 13, 18, st[3])                           # 넓은 입 테(밝은 전, 몸보다 넓다)
    f.r(3, 19, 12, 19, st[0])                                                      # 입 속(어둠)
    f.r(1, 21, 14, 21, st[1])                                                      # 전 밑 그늘
    for x, y in ((5, 19), (8, 19), (10, 19)):                                      # 숯불
        f.p(x, y, fl[0])
    f.p(7, 19, fl[1])
    im = f.done(P, floor_y=30)
    for k, (x0, ph, top) in enumerate(((5.5, 0.0, 6), (8.2, 1.9, 1), (10.8, 3.4, 8))):   # 연기 세 줄(가운데가 가장 높다)
        for y in range(top, 18):
            t = (18 - y) / (18 - top)
            x = x0 + 1.4 * math.sin(y * 0.55 + ph)
            a = int(205 - 135 * t)
            for xx, aa in ((int(x), a), (int(x) + 1, a // 2)):
                if 0 <= xx < T and im.getpixel((xx, y))[3] == 0:
                    im.putpixel((xx, y), (236, 232, 244, aa))
    return im


def offering(P):
    """공양 과일 접시(1×1, 막힘): 낮은 돌 받침 + 납작한 접시(밝은 윗면 타원 + 어두운 앞면 2px), 그 위 주황 감 셋(아래 둘 · 위 하나).
    감마다 왼쪽 위 밝은 점 · 오른쪽 아래 그늘 · 꼭지 초록이라 하나하나 둥근 과일로 읽힌다. 흰 경단은 「흰 고리·변기」로 읽혔다(QA-L3 N27)."""
    st, fr, lf = P["dg_ghstone"], P["dg_ghmat"], P["dg_moss"]
    f = F(1, 1)
    f.r(5, 13, 10, 14, st[0]); f.r(5, 13, 10, 13, st[1])                    # 받침
    f.ell(7.5, 10.6, 6.0, 1.6, st[3]); f.r(2, 11, 13, 12, st[1])             # 접시 윗면 + 앞면
    f.r(3, 11, 12, 11, st[2])
    # 감 셋을 빈틈 없이 붙여 쌓는다 — 윤곽선이 바깥 한 줄만 먹게(속 빈틈은 고리로 읽힌다). 알끼리는 오른쪽 아래 그늘이 경계가 된다.
    for cx, cy in ((4.9, 8.4), (10.9, 8.4), (7.9, 4.8)):                  # 아래 둘 → 위 하나(아래 둘 위에 얹힌다)
        for y in range(T):
            for x in range(T):
                u, v = (x + 0.5 - cx) / 3.1, (y + 0.5 - cy) / 2.7
                if u * u + v * v <= 1.0:
                    f.p(x, y, fr[0] if u + v > 0.75 else fr[1])
        hx, hy = int(cx) - 1, int(cy) - 1
        f.p(hx, hy, fr[2]); f.p(hx + 1, hy, fr[2]); f.p(hx, hy + 1, fr[2])     # 왼쪽 위 빛
        top = int(cy - 2.7) + 1
        f.p(int(cx), top, lf[1]); f.p(int(cx) + 1, top, lf[2])                  # 꼭지
    return f.done(P, floor_y=13)


def gh_stairs(P):
    """탑 오르는 계단(2×2, 뒷벽 두 줄에 박는다, 걷는다): 돌 문틀(흰 상인방 + 보라 판벽색 기둥) 속 단 다섯 —
    단마다 밝은 디딤 2px + 어두운 챌면 2px, 위로 갈수록 어두워 맨 위는 검정으로 잠긴다(送り火山 1층)."""
    ce, wl, st = P["dg_ghceil"], P["dg_ghwall"], P["dg_ghstone"]
    f = F(2, 2)
    f.r(0, 0, 31, 31, wl[2])
    f.r(0, 0, 31, 3, ce[2]); f.r(0, 3, 31, 3, ce[1])                        # 상인방
    f.r(0, 4, 3, 31, wl[3]); f.r(28, 4, 31, 31, wl[1]); f.r(0, 4, 0, 31, wl[4])
    f.r(4, 4, 27, 31, C(P, "i2_void"))
    tread = [st[0], st[1], st[1], st[2], st[3]]
    riser = [C(P, "i2_void"), st[0], st[0], st[0], st[1]]
    for k in range(5):
        y = 11 + k * 4
        f.r(4, y, 27, y + 1, tread[k]); f.r(4, y + 2, 27, y + 3, riser[k])
        f.p(4, y, wl[1]); f.p(27, y, wl[1])
    return f.done(P, floor_y=40, shadow=False)


def gh_mat(P):
    """탑 출구 매트(아래 테 바로 위 바닥 칸): 밝은 주황 깔개 + 가로 줄 하나(送り火山 출구)."""
    im = gh_floor(P, 0)
    r = P["dg_ghmat"]
    px.rect(im, 1, 3, 14, 15, r[0]); px.rect(im, 2, 4, 13, 15, r[1]); px.rect(im, 2, 4, 13, 4, r[2])
    px.rect(im, 3, 10, 12, 10, r[0])
    return im


# ==== 발전소·악당 아지트 ===========================================================================
def pw_floor(P, v: int):
    """금속 판 바닥(16px 한 판): 왼쪽·위 밝은 테, 오른쪽·아래 진한 줄눈, 네 귀 리벳. v1 은 가운데 환기 격자, v2 는 긁힌 자국."""
    d, m, b, l = P["dg_pwfl"]
    im = px.new()
    for y in range(T):
        for x in range(T):
            c = d if (x == 15 or y == 15) else l if (x == 0 or y == 0) else b
            im.putpixel((x, y), c)
    for rx, ry in ((2, 2), (13, 2), (2, 13), (13, 13)):
        im.putpixel((rx, ry), m); im.putpixel((rx, ry - 1), l)
    if v == 1:
        for y in range(5, 11):
            for x in range(4, 12):
                im.putpixel((x, y), d if y % 2 == 1 else m)
        px.rect(im, 4, 4, 11, 4, m)
    if v == 2:
        for x, y in ((5, 6), (6, 6), (9, 10), (10, 10), (10, 9)):
            im.putpixel((x, y), m)
    return im


def pw_wall_col(P):
    """산업 뒷벽 32px 띠: 천장 끝 → 밝은 벽판(8px 마다 세로 이음매, 리벳 없음 — 바닥판과 다른 결) → 배관 한 줄 → 노랑·검정 경고 띠 → 어두운 걸레받이 2px."""
    ce, pn, wl, ol, pi, y_ = P["dg_pwceil"], P["dg_pwpanel"], P["dg_pwwall"], C(P, "i2_ol"), P["dg_pipe"], P["i2_yellow"]
    def col(x, y):
        if y <= 1: return ce[1]
        if y == 2: return ce[0]
        if y == 3: return ol
        u = x % 8
        if y <= 18:
            if u == 7: return pn[0]
            if u == 0 or y == 4: return pn[2]
            return pn[1]
        if y == 19: return wl[0]
        if y <= 22: return pi[2] if y == 20 else pi[1] if y == 21 else pi[0]
        if y == 23: return wl[0]
        if y <= 26: return y_[1] if (x + y) % 8 < 4 else ol
        if y == 27: return wl[0]
        if y <= 29: return wl[1] if y == 28 else wl[0]
        if y == 30: return wl[0]
        return ol
    return col


def pw_vent(P):
    """뒷벽 환기구(아래 칸 위 반에 박는 뒷벽 변형): 어두운 틀 속 가로 살 넷 — 로켓단 아지트 뒷벽."""
    base = pw_wall_col(P)
    pn, ol = P["dg_pwpanel"], C(P, "i2_ol")
    def col(x, y):
        if 3 <= x <= 12 and 6 <= y <= 16:
            if x in (3, 12) or y in (6, 16): return ol
            return pn[0] if (y - 7) % 2 == 0 else pn[2] if x == 4 else pn[1]
        return base(x, y)
    return col


def canon_warp(P, floor_img):
    """워프 판(걷는다 — 이동 이벤트): 정본 체육관 에스퍼 워프 판 `gyms_props.warp`(강철 판 · 시안 겹사각 · 가운데 흰 점)를 그대로 부르고
    바닥만 이 방 바닥으로 옮긴다(통합 검수 I1 X4 — 둥근 빛 원반은 조명·보주로 읽혔다). 에스퍼관 램프는 체육관 시드에서 읽어 온다(복사하지 않는다)."""
    import json
    import gyms_common as gc
    import gyms_props as gp
    pal = json.loads((Path(__file__).resolve().parents[4] / "harness-data" / "tileset-authoring" / "monster-gyms" / "seed.json").read_text())["palette"]
    Pg = dict(P)
    for k, v in pal.items():
        if k not in Pg and isinstance(v, list):
            Pg[k] = px.ramp(v)
    return dk.on_floor(gp.warp(Pg), gc.floor(Pg, "psy"), floor_img)


def pw_gate(P, closed: bool):
    """차단기(위층). 닫힘(막힘): 양쪽 기둥 + 빨강·흰 사선 막대. 열림(걷는다): 막대가 세워져 기둥에 붙는다."""
    st, r, w = P["i2_steel"], P["i2_red"], P["i2_white"]
    f = F(1, 1)
    f.r(0, 4, 2, 14, st[1]); f.r(0, 4, 2, 4, st[2]); f.r(13, 4, 15, 14, st[1]); f.r(13, 4, 15, 4, st[2])
    f.r(0, 2, 2, 3, r[1]); f.r(13, 2, 15, 3, r[1])
    if closed:
        for x in range(3, 13):
            for y in range(6, 10):
                f.p(x, y, r[1] if ((x + y) // 3) % 2 else w[2])
        f.r(3, 6, 12, 6, w[1])
    else:
        for y in range(0, 12):
            f.p(3, y, r[1] if (y // 3) % 2 else w[2]); f.p(4, y, r[1] if (y // 3) % 2 else w[1])
    return f.done(P, floor_y=12)


def pw_switch(P):
    """레버 스위치 판(걷는다 — 밟거나 조사하면 차단기가 바뀐다): 바닥 판에 박힌 노란 레버."""
    im = pw_floor(P, 0)
    ol, y_, st = C(P, "i2_ol"), P["i2_yellow"], P["i2_steel"]
    px.rect(im, 3, 3, 12, 12, ol); px.rect(im, 4, 4, 11, 11, st[0]); px.rect(im, 4, 4, 11, 4, st[1])
    px.rect(im, 7, 5, 8, 9, st[2]); px.rect(im, 6, 3, 9, 5, y_[1]); px.rect(im, 6, 3, 9, 3, y_[2]); px.rect(im, 9, 4, 9, 5, y_[0])
    px.rect(im, 5, 9, 10, 10, P["i2_red"][1])
    return im


def pw_gen(P):
    """발전기(2×2, 막힘): 받침판 위 세운 원통 — 윗면 타원(밝음), 몸통은 왼쪽 밝음→오른쪽 어둠 4단, 구리 코일 띠 둘, 앞 노란 표시창."""
    st, cu, y_ = P["i2_steel"], P["dg_copper"], P["dg_warp"]
    f = F(2, 2)
    f.r(1, 24, 30, 30, st[1]); f.r(1, 24, 30, 24, st[2]); f.r(1, 30, 30, 30, st[0])
    for x in range(4, 28):
        u = (x - 4) / 23
        c = st[2] if u < 0.25 else st[1] if u < 0.7 else st[0]
        f.r(x, 6, x, 25, c)
        for y0 in (10, 18):
            f.r(x, y0, x, y0 + 2, cu[2] if u < 0.25 else cu[1] if u < 0.7 else cu[0])
    f.ell(16, 6, 12, 4, st[2]); f.ell(15, 5.5, 8, 2.2, P["i2_white"][1]); f.ell(16, 6, 3.4, 1.6, st[0])
    f.r(12, 14, 19, 16, C(P, "i2_ol")); f.r(13, 15, 18, 15, y_[2])
    return f.done(P, floor_y=24)


def pw_console(P):
    """제어반(2×2, 막힘, 뒷벽이나 칸막이에 붙인다): 위는 화면 셋 달린 세운 판, 아래는 기울인 단추 판 + 받침."""
    st, gl, gn, r, y_ = P["i2_steel"], P["i2_glass"], P["i2_green"], P["i2_red"], P["i2_yellow"]
    f = F(2, 2)
    f.r(1, 2, 30, 17, st[1]); f.r(1, 2, 30, 2, st[2]); f.r(1, 3, 1, 17, st[2])
    for x0 in (4, 13, 22):
        f.r(x0, 5, x0 + 6, 12, C(P, "i2_ol")); f.r(x0 + 1, 6, x0 + 5, 11, gl[0])
        f.r(x0 + 1, 6, x0 + 5, 6, gl[1]); f.p(x0 + 2, 9, gn[2]); f.p(x0 + 3, 8, gn[2]); f.p(x0 + 4, 10, gn[2])
    f.r(0, 18, 31, 24, st[2]); f.r(0, 18, 31, 18, P["i2_white"][1])
    for k, x in enumerate(range(3, 29, 4)):
        f.r(x, 20, x + 1, 21, (r[1], y_[1], gn[1], gl[1])[k % 4])
    f.r(2, 25, 29, 29, st[0]); f.r(2, 25, 29, 25, st[1])
    return f.done(P, floor_y=25)


def pw_coil(P):
    """변압기(1×2, 막힘): 회색 함 위에 애자 세 단(흰·하늘), 옆에 굵은 전선 단자."""
    st, gl, w = P["i2_steel"], P["i2_glass"], P["i2_white"]
    f = F(1, 2)
    f.r(1, 16, 14, 29, st[1]); f.r(1, 16, 14, 16, st[2]); f.r(1, 17, 1, 28, st[2]); f.r(14, 17, 14, 29, st[0])
    for y in (20, 24):
        f.r(3, y, 12, y, st[0])
    f.r(4, 26, 6, 27, P["i2_yellow"][1])
    f.r(7, 3, 8, 15, st[0])
    for cy in (5, 9, 13):
        f.ell(8, cy, 5, 1.8, gl[0]); f.ell(7.6, cy - 0.4, 3.8, 1.1, w[2])
    return f.done(P, floor_y=26)


def pw_cable(P, kind: str):
    """바닥 전선(1×1, 위층, 걷는다): 굵기 3px 어두운 청록 고무 전선(윗줄 밝은 반사 1px) — h·v 와 네 굽이. 끝은 기계나 벽에 붙여 깐다."""
    cb = P["dg_cable"]
    im = px.new()
    def seg(x0, y0, x1, y1):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                im.putpixel((x, y), cb[1])
    if kind == "h":
        seg(0, 9, 15, 11)
    elif kind == "v":
        seg(6, 0, 8, 15)
    else:
        a, b = kind[0], kind[1]
        ys = (0, 10) if a == "n" else (9, 15)
        xs = (7, 15) if b == "e" else (0, 8)
        seg(6, ys[0], 8, ys[1]); seg(xs[0], 9, xs[1], 11)
    on = lambda x, y: 0 <= x < T and 0 <= y < T and im.getpixel((x, y))[3] == 255 and im.getpixel((x, y)) != (0, 0, 0, 48)
    pts = [(x, y) for y in range(T) for x in range(T) if on(x, y)]
    for x, y in pts:
        if kind == "v":
            c = cb[2] if not on(x - 1, y) else cb[0] if not on(x + 1, y) else cb[1]
        else:
            c = cb[2] if not on(x, y - 1) else cb[0] if not on(x, y + 1) else cb[1]
        im.putpixel((x, y), c)
    for x, y in pts:
        if 0 <= y + 1 < T and 0 <= x + 1 < T and im.getpixel((x + 1, y + 1))[3] == 0 and im.getpixel((x, y + 1))[3] == 0:
            im.putpixel((x, y + 1), (0, 0, 0, 48))
    return im


def pw_crate(P):
    """나무 상자(1×1, 막힘): 위에서 본 평평한 윗면 3px(밝음) + 앞면은 판자 테(위·아래·양옆 1px 진함) 안에 X 버팀목 두 획 — 갈색 3톤.
    뚜껑 띠·몸통 띠 구성은 보물상자 문법이라 버렸다."""
    w = P["wood"]
    f = F(1, 1)
    f.r(1, 3, 14, 5, w[3]); f.r(1, 3, 14, 3, w[2])
    f.r(1, 6, 14, 13, w[2]); f.r(1, 6, 14, 6, w[0]); f.r(1, 13, 14, 13, w[0]); f.r(1, 6, 2, 13, w[1]); f.r(13, 6, 14, 13, w[1])
    f.line(3, 7, 12, 12, w[1]); f.line(3, 12, 12, 7, w[1]); f.line(4, 7, 12, 11, w[0])
    return f.done(P, floor_y=11)


def pw_stairs_dn(P):
    """내려가는 계단(바닥 칸, 걷는다 — 아래층 이동 이벤트 자리): 금속 바닥에 뚫린 계단 구멍 — 양옆 강철 난간 2px, 단 넷이 아래로 갈수록 어둡다(로켓단 아지트 입구)."""
    im = pw_floor(P, 0)
    st, ol = P["i2_steel"], C(P, "i2_ol")
    d = P["dg_pwfl"]
    px.rect(im, 1, 1, 14, 15, ol)
    px.rect(im, 2, 1, 3, 15, st[2]); px.rect(im, 12, 1, 13, 15, st[0])
    for k, c in enumerate((d[3], d[2], d[1], d[0])):
        y = 2 + k * 3
        px.rect(im, 4, y, 11, y + 1, c); px.rect(im, 4, y + 2, 11, y + 2, px.tint(c, 0.55))
    px.rect(im, 4, 14, 11, 15, C(P, "i2_void"))
    return im


def pw_drum(P):
    """노란 드럼통(1×1, 막힘): 위 타원 뚜껑(밝음 + 마개) + 원통 몸통(왼쪽 밝음 → 오른쪽 진함) + 띠 두 줄 — 무인발전소의 짐."""
    y_ = P["i2_yellow"]
    f = F(1, 1)
    for x in range(3, 13):
        u = (x - 3) / 9
        f.r(x, 4, x, 13, y_[2] if u < 0.25 else y_[1] if u < 0.7 else y_[0])
    for yy in (7, 11):
        f.r(3, yy, 12, yy, y_[0])
    f.ell(8, 4, 5, 2.2, y_[1]); f.ell(7.6, 3.8, 3.6, 1.3, y_[2]); f.r(9, 3, 10, 3, y_[0])
    return f.done(P, floor_y=11)


def rect_shadow(img, kind: str, f: float = 0.8, depth: int = 4):
    """칸막이 곁 바닥 그늘(직사각 반투명 띠): e = 왼쪽 6px(맨 위 한 점만 대각으로 깎는다), se = 왼쪽 6px + 위 depth px(안쪽 모서리),
    s = 위 depth px(칸막이·뒷벽 밑 — se 와 같은 깊이, 통합 검수 I1 X6 「그늘 깊이가 칸마다 8px·4px 로 다르다」),
    c = 왼쪽 위 6×depth px(바깥 모서리: 칸막이 끝의 오른쪽 아래 대각 칸 — 오른쪽 띠와 아래 띠가 「ㄱ」으로 만난다, 귀 한 점은 깎는다, 통합 I4 W6).
    f = 그늘 톤(바닥에 곱함), depth = 아래 띠 깊이 — 그 방의 벽 밑 그늘(s 칸)과 같게 준다."""
    out = img.copy()
    for y in range(T):
        for x in range(T):
            if kind == "c":
                hit = x < 6 and y < depth and not (x == 5 and y == depth - 1)
            else:
                hit = (kind in ("e", "se") and x < 6 and not (x == 5 and y == 0)) or (kind in ("s", "se") and y < depth)
            if hit:
                out.putpixel((x, y), px.tint(img.getpixel((x, y)), f))
    return out


# ==== 고대 유적 ==================================================================================
def ru_sand(P, v: int):
    """유적 모래 = 정본 바깥 모래 `monster_overworld.sand_tex`(sand0 과 같은 재료·결, 통합 검수 I1 대조표 X8)."""
    import monster_overworld as mo
    return mo.sand_tex(P, v)


def ru_slab(P, v: int):
    """판석 바닥. v0..3: 큰 판석 2×2 칸 한 묶음(0 왼위·1 오위·2 왼아래·3 오아래) — 묶음 둘레 왼쪽·위 밝은 테 1px · 오른쪽·아래 줄눈,
    가운데 십자 이음매(진한 1px + 밝은 1px) 로 네 장이 맞물린 판, 오른쪽 아래 한 장 귀에 이 빠진 자국.
    v4: 제단 앞 한 장에만 쓰는 무늬 판(마름모 고리)."""
    d, m, b, l, hi = P["dg_rustone"]
    im = px.new()
    qx, qy = v % 2, v // 2
    for y in range(T):
        for x in range(T):
            if v < 4:
                X, Y = x + qx * T, y + qy * T
                c = d if (X == 31 or Y == 31) else l if (X == 0 or Y == 0) else b
                if X == 15 or Y == 15:
                    c = m
                elif (X == 16 or Y == 16) and c == b:
                    c = l
            else:
                c = d if (x == 15 or y == 15) else l if (x == 0 or y == 0) else b
                dd = abs(x - 7.5) + abs(y - 7.5)
                if 4.4 <= dd < 5.4:
                    c = m
                elif 5.4 <= dd < 6.0 and (x < 8) == (y < 8):
                    c = l
                if dd < 1.2:
                    c = m
            im.putpixel((x, y), c)
    if v == 3:
        for x, y in ((12, 12), (13, 12), (13, 13), (12, 13), (13, 11)):
            im.putpixel((x, y), m)
        im.putpixel((11, 11), l)
    return im


def ru_wall_col(P, kind: str = ""):
    """새긴 돌 블록 뒷벽 32px 띠: 모래빛 천장 끝 → 돌 블록 네 층(층 높이 6px, 층마다 반 칸 엇갈림, 블록 윗줄 밝음·줄눈 진함) → 받침 띠.
    kind 'p': 벽기둥(가운데 8px 진한 돌기둥 + 머리돌) · 'g0','g1': 점자 판(아래 칸 가운데)."""
    ce, br, ol = P["dg_ruceil"], P["dg_rubrick"], C(P, "i2_ol")
    def col(x, y):
        if y <= 1: return ce[2]
        if y == 2: return ce[1]
        if y == 3: return ol
        if kind == "p" and 4 <= x <= 11 and y <= 28:
            if y <= 6: return br[4] if y == 4 else br[2] if x in (4, 11) else br[3]
            if x in (4, 11): return br[0]
            if x == 5: return br[3]
            if x == 10: return br[1]
            return br[1] if x in (7, 8) and y % 6 == 0 else br[2]
        if kind in ("g0", "g1") and 2 <= x <= 13 and 17 <= y <= 27:
            if y in (17, 27) or x in (2, 13): return br[0]
            if y == 18 or x == 3: return br[3]
            gx, gy = x - 4, y - 19
            dots = ((0, 0), (0, 2), (1, 4), (3, 0), (4, 2), (3, 4), (6, 0), (7, 2), (6, 4), (8, 4)) if kind == "g0" else ((0, 2), (1, 0), (0, 4), (3, 2), (4, 0), (4, 4), (6, 2), (7, 4), (7, 0), (8, 2))
            if (gx, gy) in dots: return br[0]
            if (gx, gy - 1) in dots: return br[4]
            return br[2]
        if y <= 27:
            r = (y - 4) // 6
            off = 8 * (r % 2)
            u = (x + off) % 16
            k = (y - 4) % 6
            if k == 5 or u == 15: return br[0]
            if k == 0 or u == 0: return br[3]
            return br[2] if not (k == 4 and u > 10) else br[1]
        if y <= 29: return br[1] if y == 28 else br[0]
        if y == 30: return br[0]
        return ol
    return col


def ru_pillar(P):
    """유적 기둥(1×2, 막힘): 넓은 머리돌 · 세로 홈 셋 · 왼쪽 밝음 오른쪽 그늘 · 두 단 밑돌."""
    st = P["dg_rustone"]
    f = F(1, 2)
    f.r(2, 1, 13, 4, st[3]); f.r(2, 1, 13, 1, st[4]); f.r(3, 5, 12, 5, st[1])
    f.r(4, 6, 11, 26, st[2]); f.r(4, 6, 5, 26, st[3]); f.r(11, 6, 11, 26, st[1])
    for x in (6, 8):
        f.r(x, 7, x, 25, st[1])
    f.r(7, 7, 7, 25, st[3])
    f.r(3, 27, 12, 28, st[3]); f.r(2, 29, 13, 30, st[2]); f.r(2, 29, 13, 29, st[3])
    for x, y in ((10, 12), (11, 13), (5, 20)):
        f.p(x, y, st[0])
    return f.done(P, floor_y=27)


def ru_altar(P):
    """제단(2×2, 막힘 — 조사 이벤트를 올린다): 두 단 돌 받침 위 넓은 상판, 가운데 빛나는 구슬 받침, 앞면 새긴 문양."""
    st, gl = P["dg_rustone"], P["dg_warp"]
    f = F(2, 2)
    f.r(1, 24, 30, 30, st[2]); f.r(1, 24, 30, 24, st[3]); f.r(1, 30, 30, 30, st[0])
    f.r(3, 13, 28, 23, st[2]); f.r(3, 13, 28, 13, st[4]); f.r(3, 14, 28, 15, st[3]); f.r(3, 23, 28, 23, st[1])
    for x in range(6, 26, 5):
        f.r(x, 18, x + 2, 20, st[1]); f.p(x + 1, 19, st[3])
    f.r(12, 9, 19, 13, st[1]); f.r(12, 9, 19, 9, st[3])
    f.ell(16, 6, 3.6, 3.6, gl[0]); f.ell(15.4, 5.4, 2.4, 2.4, gl[1]); f.ell(15, 5, 1.0, 1.0, P["i2_white"][2])
    return f.done(P, floor_y=24)


def ru_braille(P):
    """점자 바위(2×2, 막힘 — 조사 이벤트): 바위 덩이 셋이 모인 무더기 아래에 평평한 돌판, 판에 점자 두 줄(봉인의 방)."""
    rk, st = P["dg_rurock"], P["dg_rustone"]
    f = F(2, 2)
    inside = dk.lobes_inside([(16, 13, 13, 10), (8, 17, 7, 7), (24, 17, 7, 7), (16, 7, 8, 6)])
    for y in range(32):
        for x in range(32):
            if inside(x, y):
                l = -((x - 14) / 14 + (y - 10) / 10)
                f.p(x, y, rk[3] if l > 0.9 else rk[2] if l > 0.0 else rk[1] if l > -0.9 else rk[0])
    f.r(5, 19, 26, 28, st[2]); f.r(5, 19, 26, 19, st[3]); f.r(5, 28, 26, 28, st[1])
    for k, x in enumerate(range(8, 25, 3)):
        for j, y in enumerate((22, 25)):
            if (k * 3 + j * 5) % 4 != 0:
                f.p(x, y, st[0]); f.p(x, y - 1, st[4])
    return f.done(P, floor_y=26)


def ru_rubble(P, v: int):
    """무너진 돌(1×1, 막힘). v0: 귀 하나씩 비스듬히 깨진 비뚠 돌덩이 셋(크기·윗면 밝기가 달라 겹쳐 쌓인 무더기 — 직각 블록은 상자로 읽혔다).
    v1: 옆으로 쓰러진 기둥 토막(원통 + 오른쪽 둥근 단면) — 서 있는 토막은 쓰레기통·컵으로 읽혔다."""
    st = P["dg_rustone"]
    f = F(1, 1)
    if v == 0:                                                                     # 귀가 깨진 비뚠 돌덩이 셋(크기·윗면 밝기 다름)
        im = f.im
        for (cx, cy, rx, ry), ramp in (((5.6, 8.0, 4.2, 3.4), (st[1], st[2], st[3], st[4])), ((11.8, 10.4, 3.0, 2.6), (st[0], st[1], st[2], st[3])),
                                       ((7.2, 13.0, 2.6, 1.6), (st[1], st[2], st[3], st[3]))):
            ins = dk.lobes_inside([(cx, cy, rx, ry)])
            cut = lambda x, y, cx=cx, cy=cy: (x + 0.5 - cx) + (cy - y - 0.5) > rx + ry * 0.35        # 오른쪽 위 귀를 비스듬히 깨뜨린다
            dk.shade_blob(im, lambda x, y, ins=ins, cut=cut: ins(x, y) and not cut(x, y), list(ramp), C(P, "i2_ol"), shadow=False)
    else:
        f.r(1, 7, 11, 13, st[2]); f.r(1, 7, 11, 8, st[3]); f.r(1, 12, 11, 13, st[1])     # 옆으로 누운 기둥 토막(원통)
        for y in (9, 11):
            f.r(2, y, 10, y, st[1])                                                      # 세로 홈이 누워 가로 홈
        f.ell(12, 10, 2.6, 3.6, st[3]); f.ell(12.2, 10, 1.6, 2.4, st[4]); f.p(12, 10, st[2])   # 둥근 깨진 단면(오른쪽)
        f.p(1, 7, (0, 0, 0, 0)); f.r(3, 14, 4, 14, st[2]); f.p(14, 14, st[2])
    return f.done(P, floor_y=11)


def ru_urn(P):
    """토기 항아리(1×1, 막힘): 둥근 몸통 · 좁은 목 · 띠 무늬 두 줄."""
    cl = P["dg_clay"]
    f = F(1, 1)
    f.ell(8, 9.5, 5.4, 4.8, cl[1]); f.ell(6.6, 8.2, 2.6, 2.6, cl[2]); f.r(6, 2, 9, 5, cl[1]); f.r(5, 2, 10, 2, cl[2])
    f.r(4, 8, 12, 8, cl[0]); f.r(3, 11, 13, 11, cl[0]); f.r(11, 6, 12, 12, cl[0])
    return f.done(P, floor_y=11)


def ru_wall_crack(P, v: int = 0):
    """돌담 윗면 깨진 자국(위층 덧그림, 장식, 담 윗줄 칸에): 윗면 안쪽(윗변 테에 닿지 않는다)의 비뚠 판 조각 하나가 한 단 내려앉은 모양.
    움푹한 속은 한 단 어두운 민트, 위·왼쪽 안벽은 최암 1px(그늘), 아래·오른쪽 깨진 면은 밝은 1px(빛), 곁에 떨어진 작은 파편(실금 꼬리는 물고기로 읽혀 뺐다).
    윗변에 매단 반원은 「고리·물방울」로 읽혔다(QA-L3 N25) — 원작 Tanoby 처럼 윗면 속의 판 조각으로 그린다. v 넷(폭 9·7·4·6px)은 자리·모양이 다르다 — 좌우 뒤집기는 빛 방향이 깨져 쓰지 않는다(QA-L4 N34)."""
    t = P["dg_rublock"]
    im = px.new()
    pal = {"d": t[0], "m": t[1], "l": t[3]}
    if v == 0:
        rows = [".ddddd....", "dmmmmmddd.", "dmmmmmmmml", "dmmmmmmml.", ".lllmmml..", "....lll..."]
        x0, y0 = 2, 4
        chips = ((x0 + 8, y0 + 6),)
    elif v == 1:
        rows = ["..ddddd.", "ddmmmmmd", "dmmmmmml", "dmmmmll.", ".dmll...", "..l....."]
        x0, y0 = 6, 4
        chips = ((x0 + 6, y0 + 6),)
    elif v == 2:                                                            # 폭 4: 작게 깨진 귀
        rows = ["ddd.", "dmmd", ".mml", "..l."]
        x0, y0 = 10, 6
        chips = ()
    else:                                                                   # 폭 6: 낮고 긴 홈 + 파편
        rows = ["..ddd.", "dmmmmd", "dmmml.", ".ll..."]
        x0, y0 = 3, 7
        chips = ((x0 + 7, y0 + 3),)
    px.stamp(im, x0, y0, rows, pal)
    for cx, cy in chips:                                                    # 떨어진 파편: 밝은 윗면 2px + 밑 그늘 2px
        if 0 <= cx < T - 1 and 0 <= cy < T - 1:
            im.putpixel((cx, cy), t[3]); im.putpixel((cx + 1, cy), t[3])
            im.putpixel((cx, cy + 1), t[0]); im.putpixel((cx + 1, cy + 1), t[0])
    return im


def ru_exit(P):
    """출구 빛(걷는다 — 이동 이벤트, 아래 테 바로 위 모래 칸): 아래 변에 붙은 밝은 노랑 반원(봉인의 방·사막 유적 아래 끝)."""
    s = P["dg_rusand"]
    return dk.floor_exit(ru_sand(P, 0), [s[4], P["i2_white"][2]], s[1])


# ==== 조립 =======================================================================================
def _room_walls(sh, P, pre, col, extra=()):
    for part in ("up", "dn"):
        im = dk.back_wall(col, part)
        sh.add(f"{pre}_wall_{part}", im)
        for side in "lr":
            e = im.copy()
            x = 0 if side == "l" else T - 1
            for y in range(T):
                e.putpixel((x, y), C(P, "i2_ol"))
            sh.add(f"{pre}_wall_{part}_{side}", e)
    for name, c in extra:
        for part in ("up", "dn"):
            sh.add(f"{pre}_wall_{part}_{name}", dk.back_wall(c, part))


def build(sh, P):
    # ---- 유령 탑 ----
    sh.section("유령 탑(마름모 바닥·어둠 가장자리·보라 판벽·묘비 넷·비석·촛대·향로·계단)")
    for v in range(2):
        sh.add(f"gh_fl{v}", gh_floor(P, v))
    sh.add("gh_fl_s", dk.under_wall(gh_floor(P, 0)))
    sh.add("gh_mat", gh_mat(P))
    for s_ in ("s", "e", "w", "se", "sw"):
        sh.add(f"gh_dim_{s_}", gh_dim(P, s_))
    for s_ in ("e", "w"):
        sh.add(f"gh_dim_{s_}_s", dk.under_wall(gh_dim(P, s_)))     # 뒷벽 바로 아래 줄의 어둠 칸(2행 모서리)
    sh.row_start()
    _room_walls(sh, P, "gh", gh_wall_col(P))
    dk.room_edges(sh, P, "gh", P["dg_ghceil"][1:3], [P["dg_ghceil"][1], P["dg_ghceil"][1], P["dg_ghceil"][2]], P["dg_ghceil"][0], C(P, "i2_ol"))
    sh.row_start()
    for k in "abcd":
        sh.add(f"gh_grave_{k}", grave(P, k))
    for nm, t in bd.cut(censer(P), "gh_censer").items():
        sh.add(nm, t)
    sh.add("gh_offer", offering(P))
    sh.add("gh_candle", candle(P))
    for nm, t in bd.cut(obelisk(P), "gh_obelisk").items():
        sh.add(nm, t)
    for nm, t in bd.cut(gh_stairs(P), "gh_stairs").items():
        sh.add(nm, t)
    sh.end_section()

    # ---- 발전소·아지트 ----
    sh.section("발전소·악당 아지트(금속 판 바닥·산업 뒷벽·청록 칸막이·회전 화살표·정지 칸·워프 판·차단기·기계·전선)")
    for v in range(3):
        sh.add(f"pw_fl{v}", pw_floor(P, v))
    base = pw_floor(P, 0)
    sh.add("pw_fl_s", rect_shadow(base, "s"))
    sh.add("pw_fl_e", rect_shadow(base, "e"))
    sh.add("pw_fl_se", rect_shadow(base, "se"))
    # 회전 화살표·정지 칸 = 정본 본 시트 gym2.spin / gym2.spin_stop(흰 단추) 화소를 금속 바닥으로 옮긴다(통합 검수 I1 X2).
    # 워프 판 = 정본 체육관 에스퍼 워프 판 gyms_props.warp 화소(I1 X4). 장치 화소는 정본 그대로, 판 밖 바닥만 이 방 바닥.
    teal = g2.floor(P, "teal", 0)
    for d in "udlr":
        sh.add(f"pw_spin_{d}", dk.on_floor(g2.spin(P, d, "teal"), teal, base))
    sh.add("pw_spin_stop", dk.on_floor(g2.spin_stop(P, "teal"), teal, base))
    sh.add("pw_warp", canon_warp(P, base))
    sh.add("pw_switch", pw_switch(P))
    sh.add("pw_gate", pw_gate(P, True))
    sh.add("pw_gate_open", pw_gate(P, False))
    sh.add("pw_crate", pw_crate(P))
    sh.add("pw_drum", pw_drum(P))
    sh.add("pw_stairs_dn", pw_stairs_dn(P))
    for k in ("h", "v", "ne", "nw", "se", "sw"):
        sh.add(f"pw_cable_{k}", pw_cable(P, k))
    sh.row_start()
    _room_walls(sh, P, "pw", pw_wall_col(P), extra=(("v", pw_vent(P)),))
    dk.room_edges(sh, P, "pw", P["dg_pwceil"][0:2], P["i2_gray"], P["i2_void"][0], C(P, "i2_ol"))
    sh.row_start()
    for nm, t in bd.cut(pw_gen(P), "pw_gen").items():
        sh.add(nm, t)
    for nm, t in bd.cut(pw_console(P), "pw_console").items():
        sh.add(nm, t)
    for nm, t in bd.cut(pw_coil(P), "pw_coil").items():
        sh.add(nm, t)
    sh.row_start()
    top, fc, ol = P["dg_pwtop"], P["dg_pwface"], C(P, "i2_ol")
    face = lambda x, yy, h: fc[0] if yy == h - 1 else fc[2] if (x % 8 == 3 and yy == 1) else fc[1]
    def rivets(im, ins, m):
        for x, y in ((3, 3), (12, 3)):
            if ins[y][x] and im.getpixel((x, y)) == top[2]:
                im.putpixel((x, y), top[0]); im.putpixel((x, y - 1), top[3])
    for k in px.ALL47:
        sh.add(f"pw_pb_at{k}", dk.block2_cell(k, base, top, face, ol, 4, deco=rivets))
    sh.end_section()

    # ---- 고대 유적 ----
    sh.section("고대 유적(모래·문양 판석·새긴 돌 블록 벽·벽기둥·점자 판·올린 돌담·기둥·제단·점자 바위)")
    for v in range(4):
        sh.add(f"ru_sand{v}", ru_sand(P, v))
    for v in range(5):
        sh.add(f"ru_fl{v}", ru_slab(P, v))
    sh.add("ru_fl_s", dk.under_wall(ru_slab(P, 0)))
    sand = ru_sand(P, 0)
    sh.add("ru_sand_s", dk.under_wall(sand))
    # 담 곁 그늘은 담 밑 그늘(ru_sand_s = 벽 밑 8px · 0.84)과 같은 톤·깊이 — 오른쪽 띠·아래 띠·모서리가 한 그늘로 이어진다(통합 I4 W6)
    sh.add("ru_sand_e", rect_shadow(sand, "e", 0.84, 8))
    sh.add("ru_sand_se", rect_shadow(sand, "se", 0.84, 8))
    sh.add("ru_sand_c", rect_shadow(sand, "c", 0.84, 8))
    # 담 끝 바로 오른쪽 판석(제단 앞 돌문 바닥 줄): 모래의 ru_sand_e 와 같은 왼쪽 6px 그늘 — 아래 모래의 「ㄱ」 모서리(ru_sand_c)까지 이어진다(QA-I5 V4)
    for v in (0, 2):
        sh.add(f"ru_fl{v}_e", rect_shadow(ru_slab(P, v), "e", 0.84, 8))
    sh.add("ru_exit", ru_exit(P))
    sh.row_start()
    _room_walls(sh, P, "ru", ru_wall_col(P), extra=(("p", ru_wall_col(P, "p")), ("g0", ru_wall_col(P, "g0")), ("g1", ru_wall_col(P, "g1"))))
    dk.room_edges(sh, P, "ru", P["dg_ruceil"][1:3], [P["dg_ruceil"][0], P["dg_ruceil"][1], P["dg_ruceil"][2]], P["i2_void"][0], C(P, "i2_ol"))
    sh.row_start()
    for v in range(2):
        sh.add(f"ru_rubble{v}", ru_rubble(P, v))
    sh.add("ru_urn", ru_urn(P))
    for nm, t in bd.cut(ru_pillar(P), "ru_pillar").items():
        sh.add(nm, t)
    for nm, t in bd.cut(ru_altar(P), "ru_altar").items():
        sh.add(nm, t)
    for nm, t in bd.cut(ru_braille(P), "ru_braille").items():
        sh.add(nm, t)
    sh.row_start()
    top, fc = P["dg_rublock"], P["dg_rublockf"]
    def rface(x, yy, h, m=255):
        if yy == h - 1: return fc[0]
        ends = (not m & px.W and x < 4) or (not m & px.E and x > T - 5)        # 담 끝 3px 안쪽에는 점을 찍지 않는다(윤곽에 반쯤 먹힌 점이 남았다)
        # 둥근 점 두 줄(2×2): 8px 간격, 아랫줄은 4px 엇갈려 선다(벽돌 쌓기). 8 은 16 을 나누므로 칸 이음매에서 간격이 그대로다 —
        # 옛 5px 간격은 칸마다 3·3·4px 로 끊겨 같은 점 배열이 16px 마다 되풀이되어 보였다(통합 I4 W5).
        u = (x + (4 if yy >= 7 else 0)) % 8
        if yy in (4, 5, 9, 10) and u in (1, 2) and not ends:
            return fc[3] if (yy in (4, 9) and u == 1) else fc[0]
        return fc[2] if yy == 0 else fc[1]
    for k in px.ALL47:                                                        # 앞면 15px — 원작 Tanoby 처럼 앞면이 윗면만큼 두껍다(QA-L2 N24)
        sh.add(f"ru_pb_at{k}", dk.block2_cell(k, sand, top, lambda x, yy, h, m=k: rface(x, yy, h, m), ol, 15))
    sh.add("ru_pb_crack", ru_wall_crack(P, 0))
    sh.add("ru_pb_crack1", ru_wall_crack(P, 1))
    sh.add("ru_pb_crack2", ru_wall_crack(P, 2))
    sh.add("ru_pb_crack3", ru_wall_crack(P, 3))
    sh.end_section()
