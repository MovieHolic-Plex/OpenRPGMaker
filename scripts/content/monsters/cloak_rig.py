"""떠 있는 망토 유령(스펙터·레이스·밴시)의 몸 윤곽 도구. 얼굴·손·소품은 종 스크립트가 그린다.

robe(): 어깨에서 아래로 넓어지며 끝이 찢긴 갈래로 흩날리는 옷자락 다각형(바람에 뒤로 끌린다).
hood(): 앞(오른쪽)으로 숙인 두건 — 바깥 껍데기와 얼굴이 드러나는 어두운 안쪽 구멍.
"""
from __future__ import annotations

import math

from pixel_lib import add, polar


def robe(sh, hem_y, w_top, w_bot, tatters=4, drag=0.0, wave=0.0, lean=0.0):
    """sh = 목 아래 가운데. hem_y = 옷자락 끝 높이. drag 는 끝이 뒤(왼쪽)로 끌리는 양."""
    x, y = sh
    pts = [(x - w_top / 2, y), (x + w_top / 2 + lean * 0.3, y)]
    pts.append((x + w_bot / 2 + lean - drag * 0.2, hem_y - 4))
    for i in range(tatters + 1):
        t = i / tatters
        bx = x + w_bot / 2 + lean - drag * (0.2 + 0.8 * t) - t * w_bot
        tip = hem_y + 2 + math.sin(wave + i * 1.9) * 2 + t * drag * 0.15
        pts.append((bx, tip))
        if i < tatters:
            pts.append((bx - w_bot / tatters * 0.5, hem_y - 3 + math.cos(wave + i) * 1.0))
    pts.append((x - w_bot / 2 - drag, hem_y - 6))
    return pts


def hood(c, r, tilt=0.0, peak=5.0):
    """두건 바깥 윤곽과 얼굴 구멍. c 는 머리 중심, 앞 = +x."""
    a = math.radians(tilt)

    def R(dx, dy):
        return (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))
    outer = [R(-r, r * 0.9), R(-r * 1.05, -r * 0.2), R(-r * 0.6, -r * 0.9), R(-r * 0.2 - peak, -r * 1.05 - peak * 0.4),
             R(r * 0.3, -r), R(r * 0.95, -r * 0.35), R(r * 1.1, r * 0.4), R(r * 0.6, r * 1.0)]
    hole = [R(r * 0.05, -r * 0.55), R(r * 0.7, -r * 0.35), R(r * 0.85, r * 0.45), R(r * 0.3, r * 0.75), R(-r * 0.05, r * 0.25)]
    face = R(r * 0.45, 0)
    return outer, hole, face, R


def sleeve(sh, ang, ln, droop=30):
    """늘어진 소매: 어깨 → 팔꿈치 → 넓게 벌어진 소매 끝(손이 나오는 자리)."""
    el = polar(sh, ang, ln * 0.55)
    cuff = polar(el, ang + droop * 0.4, ln * 0.45)
    return el, cuff


def lerp_pts(a, b, t):
    return add(a, ((b[0] - a[0]) * t, (b[1] - a[1]) * t))
