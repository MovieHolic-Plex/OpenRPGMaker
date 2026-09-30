#!/usr/bin/env python3
"""월드맵 6판 — 목표 그림 재기 (보기·측정 전용).

목표 그림은 저장소 밖(~/third-party-assets/refs/wm-target/pin1.jpg)에 있고 여기서는 읽어서
통계 숫자만 낸다. 어떤 픽셀도 저장소로 옮기지 않는다(출력은 색 수·명도·색상 표뿐).
사용: measure_worldmap_target.py <그림경로>
"""
import sys, colorsys
from PIL import Image

REGIONS = {  # 이름: (x0,y0,x1,y1) — 600×689 그림 기준. 16px 칸 = 37.5×43
    '풀_넓은곳':      (20, 330, 60, 400),
    '풀_밝은얼룩':    (230, 210, 300, 260),
    '풀_어두운(북)':  (240, 120, 320, 150),
    '산_윗면':        (340, 420, 420, 470),
    '산_전체':        (320, 390, 520, 520),
    '산_그늘면':      (430, 420, 480, 480),
    '눈덩이':         (405, 465, 440, 500),
    '침엽수_숲':      (95, 200, 150, 290),
    '침엽수_한그루':  (352, 208, 368, 232),
    '밭_밀':          (125, 80, 215, 170),
    '밭_연두':        (222, 48, 308, 118),
    '길_흙':          (60, 168, 200, 190),
    '물_얕은':        (20, 570, 80, 640),
    '물_깊은':        (380, 620, 470, 680),
    '해안턱_돌':      (30, 545, 80, 570),
    '성벽':           (30, 520, 190, 545),
    '파란지붕':       (185, 300, 285, 335),
    '목조집':         (320, 60, 350, 100),
    '도시_안쪽':      (55, 445, 170, 505),
}

def q(im, n):
    return im.quantize(colors=n, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)

def hsl(c):
    h, l, s = colorsys.rgb_to_hls(*(v/255 for v in c))
    return round(h*360), round(s*100), round(l*100)

def main(path):
    im = Image.open(path).convert('RGB')
    print('크기', im.size, '칸(16px)', im.width/16, im.height/16)
    for name, box in REGIONS.items():
        c = im.crop(box)
        px = list(c.getdata())
        # 색 수: 8단 양자화로 잡음 제거한 뒤 셈(JPEG 잡음 때문에 원색 수는 뜻이 없다)
        coarse = {(r//12, g//12, b//12) for r, g, b in px}
        lum = sorted(0.299*r+0.587*g+0.114*b for r, g, b in px)
        n = len(lum)
        p = lambda f: round(lum[min(n-1, int(n*f))])
        qq = q(c, 6)
        pal = qq.getpalette()[:18]
        cnt = sorted(qq.getcolors(), reverse=True)
        print(f'\n## {name} {box} {c.size}')
        print(f'  거친색수(12단) {len(coarse)}  명도 p5/p50/p95 = {p(.05)}/{p(.5)}/{p(.95)}')
        for k, idx in cnt:
            col = tuple(pal[idx*3:idx*3+3])
            print(f'   {k/n*100:5.1f}%  #{col[0]:02x}{col[1]:02x}{col[2]:02x}  HSL {hsl(col)}')

if __name__ == '__main__':
    main(sys.argv[1])
