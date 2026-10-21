#!/usr/bin/env python3
"""판정자에게 줄 자작 도식: 3/4 탑뷰(남쪽 위에서 내려다봄)로 본 '바닥에 누운' 비닐 터널. 저작권 그림 아님 — 단순 선 도식.
python3 tunnel_reference_sketch.py <out.png>"""
import sys
from PIL import Image, ImageDraw

W, H = 560, 420
im = Image.new('RGB', (W, H), (236, 236, 228))
d = ImageDraw.Draw(im)
L, R = 90, 250            # 터널 좌우
TOP, SOUTH, BOT = 60, 250, 330   # 북쪽 끝 위쪽, 남쪽 아치 시작, 바닥
FILM, DARK, LINE = (200, 214, 214), (150, 166, 170), (60, 70, 72)
# 동쪽 그림자(전체 길이)
d.polygon([(R, TOP + 14), (R + 22, TOP + 30), (R + 22, BOT + 6), (R, BOT)], fill=(176, 176, 166))
# 몸통(위에서 본 긴 지붕면) + 북쪽 끝 얕은 호(폭의 약 1/3 높이보다 훨씬 얕게)
d.rectangle([L, TOP + 14, R, BOT], fill=FILM)
d.chord([L, TOP, R, TOP + 28], 180, 360, fill=FILM)
d.arc([L, TOP, R, TOP + 28], 180, 360, fill=LINE, width=2)
# 가운데 밝고 옆으로 어두운 가로 명암
for i, c in enumerate([(220, 232, 232), (210, 224, 224)]):
    d.rectangle([L + 40 + i * 20, TOP + 14, R - 40 - i * 20, SOUTH], fill=c)
d.rectangle([L, TOP + 14, L + 18, BOT], fill=(178, 194, 196)); d.rectangle([R - 18, TOP + 14, R, BOT], fill=(178, 194, 196))
# 얕은 갈비대(가로로 거의 평평한 호)
for y in range(TOP + 40, SOUTH, 26):
    d.arc([L, y - 10, R, y + 10], 180, 360, fill=(120, 136, 140), width=1)
# 남쪽 아치면(키 큰 ∩) + 문
d.chord([L, SOUTH - 10, R, BOT + (BOT - SOUTH) + 10], 180, 360, fill=DARK)
d.rectangle([L, (SOUTH + BOT) // 2 + 30, R, BOT], fill=DARK)
d.arc([L, SOUTH - 10, R, BOT + (BOT - SOUTH) + 10], 180, 360, fill=LINE, width=2)
d.rectangle([(L + R) // 2 - 18, BOT - 56, (L + R) // 2 + 18, BOT], outline=LINE, width=2)
d.line([(L + R) // 2, BOT - 56, (L + R) // 2, BOT], fill=LINE, width=1)
d.line([L, TOP + 14, L, BOT], fill=LINE, width=2); d.line([R, TOP + 14, R, BOT], fill=LINE, width=2)
d.line([L - 6, BOT, R + 26, BOT], fill=(110, 96, 80), width=3)
# 설명
t = d.text
t((L - 70, 12), "TOP-DOWN 3/4 VIEW (camera above, looking down from the south)", fill=LINE)
t((R + 34, TOP + 4), "<- north end: SHALLOW arc", fill=LINE)
t((R + 34, TOP + 18), "   (vertical half-circle seen from", fill=LINE)
t((R + 34, TOP + 32), "    above projects flat)", fill=LINE)
t((R + 34, 150), "<- long film roof seen from above,", fill=LINE)
t((R + 34, 164), "   ribs are nearly flat arcs,", fill=LINE)
t((R + 34, 178), "   centre lighter, sides darker", fill=LINE)
t((R + 34, 270), "<- south end: TALL arch face (n-shape)", fill=LINE)
t((R + 34, 284), "   with door, facing the camera", fill=LINE)
t((R + 34, 320), "<- soft east cast shadow, full length", fill=LINE)
t((L - 70, 380), "Ends differ: shallow at top, tall at bottom = a tube LYING on the ground.", fill=LINE)
t((L - 70, 396), "A full half-circle at the top would instead read as a standing silo.", fill=LINE)
im.save(sys.argv[1])
