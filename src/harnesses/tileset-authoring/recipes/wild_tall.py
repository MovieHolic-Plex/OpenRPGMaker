"""키 큰 풀 덩이의 둥근 귀(야생 전용 — I3 Z5: 풀숲 덩이 끝이 칸 계단으로 꺾였다).

본 시트 키 큰 풀(outdoor2.tall_grass)은 칸을 꽉 채운 카펫이라 덩이의 바깥 귀가 칸 모서리 그대로 각지고, 한 칸씩 물러나는 덩이 끝은
16px 계단으로 읽혔다. 바깥 귀(곁 두 변이 다 풀숲 밖인 모서리)를 반지름 11 로 깎은 칸을 바닥별로 따로 굽는다 —
깎인 자리는 그 칸이 놓인 바닥(풀·돌흙·숲 바닥), 곡선을 따라 1px 최암 잎끝 윤곽(반지름이 잎끝마다 ±1 흔들려 풀 포기 끝으로 읽힌다),
아래 귀의 곡선 밑 1px 은 잎끝 그늘(본 시트 tall_fringe_s 의 그늘과 같은 반투명 검정을 바닥에 미리 섞은 톤).
이웃 칸 잎끝(tall_fringe_{s,e,w})도 깎인 귀 쪽 끝을 잘라 낸 변형을 둔다 — 깎인 귀 밖에 잎끝만 떠 있지 않게.

이름: <풀>r<바닥><귀 비트>  (귀 비트 1 = 왼쪽 위 · 2 = 오른쪽 위 · 4 = 왼쪽 아래 · 8 = 오른쪽 아래, 바닥 g = 풀 · m = 산 돌흙 · w = 숲 바닥)
      <풀>_fringe_<변>_<a|b|ab>  (a = 변의 앞끝(남쪽 잎끝은 왼쪽, 옆 잎끝은 위쪽) · b = 뒤끝을 잘라 낸 잎끝)
통행·조우는 깎기 전 칸 그대로(풀숲 칸 = 조우).

**정본(감독 결정, I4 W2):** 둥근 귀 풀숲은 모든 시트의 풀숲 문법이다. 본 시트·해안·기후는 이 모듈을 import 해 색 인자로 부른다.
  add_round_tall(sh, base, ramp, grounds)      — 시트에 한 벌을 굽는다(아래 이름 전부). base 칸 <base>0/<base>1 과 잎끝 <base>_fringe_s 가 먼저 있어야 한다.
  round_tall_set(ramp, tall_tiles, fringe_s, grounds, base) — 같은 한 벌을 [(이름, 그림)] 줄 목록으로 돌려준다(시트 없이).
  tall_round(ramp, base_tile, ground_px, bits) · side_fringe(ramp, side, var) · fringe_trim(fr, side, trim) — 낱칸 함수.
  ramp = 그 풀숲의 키 큰 풀 램프(o2.tall_grass 가 읽는 P["tall"] 와 같은 4톤, [0] = 최암 윤곽).
  grounds = [(바닥 글자, ground_px(x, y))] — 깎인 귀 밖에 비칠 바닥. 글자는 이름에 들어간다(g 풀 · m 돌흙 · w 숲 바닥, 새 시트는 새 글자).
만드는 칸(base = tall 이면 tall…, wtall 이면 wtall…):
  <base><v>r<g><bits>              v 0·1, g 바닥 글자, bits 1..15 (귀 비트 합)
  <base>_fringe_s_<a|b|ab>         남쪽 잎끝(정본 o2.tall_fringe 그대로)의 귀 쪽 끝을 자른 것
  <base>_fringe_<e|w>_v<n>         옆 잎끝 n 0·1 — 이빨 폭 1~4px·틈 1~3px 가 섞인 두 벌(I4 W6: 정본 옆 잎끝은 2px 이빨이 4px 마다 서는 빗살이었다)
  <base>_fringe_<e|w>_v<n>_<a|b|ab> 그 옆 잎끝의 귀 쪽 끝을 자른 것
배치는 쇼케이스 공용 node/wild_round.mts 의 roundTall(같은 마스크 규칙) — 시트마다 다시 쓰지 않는다."""
from __future__ import annotations

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
from px import T, new, put  # noqa: E402

R = 11                                                             # 귀 반지름(6 은 대각으로 2px 남짓만 깎여 칸 귀가 그대로 읽혔다)
_JAG = (0, 1, 0, -1, 1, 0, -1, 0)                                  # 곡선을 따라 잎끝마다 반지름 흔들림(px)
SHADOW_A = 64                                                      # 본 시트 잎끝 그늘(0,0,0,64)


def _shade(c):
    k = 1 - SHADOW_A / 255
    return (round(c[0] * k), round(c[1] * k), round(c[2] * k), 255)


def _rad(ang: float) -> float:
    i = int(ang / (math.pi / 2) * len(_JAG) * 0.999)
    return R + _JAG[min(i, len(_JAG) - 1)] * 0.8


def tall_round(ramp, base, ground_px, bits: int):
    """키 큰 풀 칸 base 의 바깥 귀(bits)를 깎는다. ramp = 풀숲 램프([0] 최암), ground_px(x, y) = 그 칸이 놓인 바닥."""
    t = ramp
    im = base.copy()
    keep = [[True] * T for _ in range(T)]
    zone = set()
    for b, fx, fy in ((1, 0, 0), (2, 1, 0), (4, 0, 1), (8, 1, 1)):
        if not bits & b:
            continue
        for y in range(T):
            for x in range(T):
                X = x if not fx else T - 1 - x
                Y = y if not fy else T - 1 - y
                if X >= R + 1 or Y >= R + 1:
                    continue
                dx, dy = X - R + 0.5, Y - R + 0.5
                if dx >= 0 or dy >= 0:
                    continue
                ang = math.atan2(-dy, -dx)                          # 0 = 옆변 쪽 · π/2 = 위·아래변 쪽
                zone.add((x, y, fy))
                if math.hypot(dx, dy) > _rad(ang):
                    keep[y][x] = False
    for x, y, fy in zone:
        if keep[y][x]:
            nb = [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
            if any(0 <= a < T and 0 <= b_ < T and not keep[b_][a] for a, b_ in nb):
                im.putpixel((x, y), t[0])                           # 곡선 잎끝 윤곽(최암)
            continue
        c = ground_px(x, y)
        if fy and y > 0 and keep[y - 1][x]:
            c = _shade(c)                                            # 아래 귀: 잎끝 밑 1px 그늘
        im.putpixel((x, y), c)
    return im


def fringe_trim(fr, side: str, trim: str):
    """잎끝 칸 fr(tall_fringe_<side>)의 앞끝(a)·뒤끝(b)을 R px 잘라 낸다(깎인 귀 밖에 잎끝이 떠 있지 않게)."""
    im = fr.copy()
    for y in range(T):
        for x in range(T):
            i = x if side == "s" else y                             # 변을 따라 잰 자리
            if ("a" in trim and i < R) or ("b" in trim and i > T - 1 - R):
                im.putpixel((x, y), (0, 0, 0, 0))
    return im


# 옆 잎끝(동·서) 두 벌: 칸 변을 따라 잎끝 길이(0~3px). 이빨 폭 1~4px · 틈 1~3px 가 섞이고, 두 벌 모두 끝 줄이 0 이라
# 세로로 아무 순서로 이어 붙여도 이빨이 칸 경계에서 한 덩이로 붙지 않는다. 정본 o2.tall_fringe 와 같은 두 톤(몸 ramp[1] · 끝 ramp[0]).
SIDE_FRINGE = ((1, 2, 1, 0, 0, 2, 3, 1, 0, 1, 0, 2, 2, 3, 1, 0),
               (0, 2, 1, 0, 1, 3, 2, 2, 0, 0, 1, 2, 0, 2, 1, 0))
SIDE_VARS = len(SIDE_FRINGE)


def side_fringe(ramp, side: str, var: int):
    """풀숲 동·서 이웃 칸 위층 잎끝(side e = 풀숲 동쪽 이웃 칸, 잎끝은 그 칸 왼쪽 변 · w = 서쪽 이웃 칸, 오른쪽 변). var 0..SIDE_VARS-1.
    w 는 같은 벌을 위아래로 뒤집어 읽는다 — 덩이 양옆 술이 거울처럼 같은 높이에 서지 않게."""
    seq = SIDE_FRINGE[var]
    im = new()
    for i in range(T):
        h = seq[i if side == "e" else T - 1 - i]
        for d in range(h):
            c = ramp[1] if d < h - 1 else ramp[0]
            put(im, d if side == "e" else T - 1 - d, i, c)
    return im


def round_tall_set(ramp, tall_tiles, fringe_s, grounds, base: str, variants: int = 2):
    """둥근 귀 풀숲 한 벌을 [[(이름, 그림), …], …](줄마다) 로 돌려준다. tall_tiles[v] = 정본 풀숲 칸 <base><v>(v < variants),
    fringe_s = 정본 남쪽 잎끝 <base>_fringe_s. 이름은 모듈 머리말 표 그대로."""
    rows = []
    for g_, gpx in grounds:
        rows.append([(f"{base}{v}r{g_}{bits}", tall_round(ramp, tall_tiles[v], gpx, bits)) for v in range(variants) for bits in range(1, 16)])
    row = [(f"{base}_fringe_s_{trim}", fringe_trim(fringe_s, "s", trim)) for trim in ("a", "b", "ab")]
    for side in "ew":
        for n in range(SIDE_VARS):
            fr = side_fringe(ramp, side, n)
            row.append((f"{base}_fringe_{side}_v{n}", fr))
            row += [(f"{base}_fringe_{side}_v{n}_{trim}", fringe_trim(fr, side, trim)) for trim in ("a", "b", "ab")]
    rows.append(row)
    return rows


def add_round_tall(sh, base: str, ramp, grounds, variants: int = 2):
    """시트 sh 에 둥근 귀 풀숲 한 벌을 굽는다(줄마다 sh.row_start). <base>0..<base>{variants-1} · <base>_fringe_s 가 먼저 시트에 있어야 한다."""
    tiles = [sh.tiles[sh.ids[f"{base}{v}"]] for v in range(variants)]
    for row in round_tall_set(ramp, tiles, sh.tiles[sh.ids[f"{base}_fringe_s"]], grounds, base, variants):
        sh.row_start()
        for name, im in row:
            sh.add(name, im)
