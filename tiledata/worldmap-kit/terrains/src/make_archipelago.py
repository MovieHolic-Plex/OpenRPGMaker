#!/usr/bin/env python3
"""terrains/archipelago.json 생성기 — 굽이치는 해협 다각형은 손으로 쓰기 길어서 띠(가운데 선 + 반폭)로 만든다.

해협은 2~3칸 바다. 길이 건너는 자리만 땅 목(地峽)으로 남기고 그 목을 짧은 강으로 끊어 다리를 놓는다 —
바다만으로 가르면 같은 막(幕) 장소끼리 걸어서 못 가 여정 검사가 실패한다. 강을 길게 쓰면 1칸 운하로 읽혔다(QA 4차).
  python3 terrains/src/make_archipelago.py > terrains/archipelago.json
"""
import json
import math


def band(x0, x1, cy, half, amp=.7, per=3.3, ph=0.0, step=1.5, flare=0.0):
    """x0→x1 의 가로 띠 다각형. 가운데 선 y = cy + amp·sin, 반폭 = half(+ 양 끝으로 갈수록 flare 만큼 넓게)."""
    xs, x = [], x0
    while x < x1:
        xs.append(round(x, 1))
        x += step
    xs.append(x1)
    top, bot = [], []
    for i, x in enumerate(xs):
        t = i / max(1, len(xs) - 1)
        c = cy + amp * math.sin(x / per + ph)
        h = half + .35 * math.sin(x / 1.9 + ph * 2) + flare * abs(2 * t - 1)
        top.append([round(x, 1), round(c - h, 1)])
        bot.append([round(x, 1), round(c + h, 1)])
    return top + bot[::-1]


ops = [
    {"op": "sea", "poly": band(5, 26.4, 14.0, 1.25, ph=.4, flare=.6), "note": "북쪽 설원섬 해협 서쪽(바다 2~3칸)"},
    {"op": "sea", "poly": band(30.6, 55, 14.2, 1.3, ph=1.7, flare=.7), "note": "북쪽 설원섬 해협 동쪽 — 동해까지 열어 설원을 떼어 낸다"},
    {"op": "river", "line": [[25.5, 14], [31.5, 14]], "note": "땅 목을 끊는 짧은 물길(다리 (28,14))"},
    {"op": "sea", "poly": band(1, 16.4, 43.6, 1.3, ph=2.2, flare=.6), "note": "서대륙 남쪽 사막섬 해협 서쪽"},
    {"op": "sea", "poly": band(20.6, 38, 44.4, 1.3, ph=.9, flare=.7), "note": "사막섬 해협 동쪽"},
    {"op": "river", "line": [[15.5, 44], [21.5, 44]], "note": "땅 목을 끊는 짧은 물길(다리 (18,44))"},
    {"op": "sea", "poly": band(57, 80.4, 31.2, 1.35, amp=.6, ph=.2, flare=.5), "note": "동대륙을 남북 두 섬으로(가운데 큰 강이 (80~86) 를 잇는다)"},
    {"op": "sea", "poly": band(85.6, 96, 30.2, 1.3, amp=.5, ph=1.1, flare=.5)},
    {"op": "island", "x": 89, "y": 64, "rx": 3.0, "ry": 2.2, "ground": "jungle", "note": "남동 정글섬"},
    {"op": "island", "x": 90.5, "y": 46, "rx": 2.2, "ry": 1.9, "ground": "jungle", "note": "동쪽 바다 작은 섬"},
    {"op": "island", "x": 10, "y": 66, "rx": 2.6, "ry": 2.0, "ground": "sand", "note": "남서 모래섬"},
    {"op": "island", "x": 3, "y": 20, "rx": 1.7, "ry": 2.5, "ground": "grass", "note": "서쪽 바다 작은 섬"},
    {"op": "island", "x": 41, "y": 68, "rx": 2.6, "ry": 1.7, "ground": "sand", "note": "남쪽 모래섬"},
]
print(json.dumps({"schema": "worldmap-terrain/1", "id": "archipelago", "name": "군도 — 대륙을 바닷길로 가른 섬나라", "base": "shared-v9",
                  "ops": ops}, ensure_ascii=False, indent=1))
