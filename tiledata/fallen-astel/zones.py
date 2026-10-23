"""아스텔 왕도 fs_hub 구역 스케치(계획 2판, 칸 좌표). python3 zones.py → zones.png"""
from PIL import Image, ImageDraw
W, H, S = 64, 67, 10
Z = [  # (이름, x, y, w, h, 색)
 ("outside forest", 38, 0, 26, 12, (40, 90, 50)),
 ("forest road", 55, 0, 2, 11, (150, 120, 80)),
 ("N wall (west)", 1, 2, 37, 6, (150, 150, 160)),
 ("notch wall", 36, 2, 2, 12, (150, 150, 160)),
 ("N wall (east, low)", 36, 12, 27, 6, (150, 150, 160)),
 ("W wall", 1, 2, 2, 60, (150, 150, 160)),
 ("E wall", 61, 12, 2, 50, (150, 150, 160)),
 ("S wall", 1, 61, 62, 6, (150, 150, 160)),
 ("canal", 20, 0, 4, 67, (60, 100, 170)),
 ("moat (canal-fed)", 24, 55, 37, 3, (60, 100, 170)),
 ("NW houses: bakery/lisa/stargazer + mill", 3, 8, 17, 9, (190, 110, 80)),
 ("NW gardens", 3, 17, 17, 6, (110, 160, 80)),
 ("observatory tower + telescope", 24, 8, 11, 16, (90, 110, 200)),
 ("main road + bridge 1", 3, 24, 36, 2, (200, 190, 160)),
 ("inn", 39, 18, 8, 8, (200, 120, 70)),
 ("gate plaza / proclamation", 39, 18, 22, 12, (215, 200, 160)),
 ("gatehouse (arch 54-57)", 54, 11, 4, 8, (120, 120, 130)),
 ("cone tower", 51, 10, 3, 9, (60, 70, 140)), ("cone tower", 58, 10, 3, 9, (60, 70, 140)),
 ("cone tower (notch)", 36, 10, 3, 9, (60, 70, 140)),
 ("sentry booth", 59, 19, 2, 2, (120, 80, 60)),
 ("escorts y19-25", 55, 19, 2, 7, (240, 240, 240)),
 ("dais", 54, 26, 4, 2, (160, 160, 170)),
 ("fountain", 49, 23, 4, 4, (90, 160, 230)),
 ("crowd front", 52, 28, 8, 2, (230, 200, 110)),
 ("crowd W flank", 45, 19, 4, 9, (230, 200, 110)), ("crowd E flank", 58, 21, 3, 7, (230, 200, 110)),
 ("stalls + well", 40, 26, 6, 4, (170, 140, 90)),
 ("craft yard + apothecary", 28, 26, 11, 4, (170, 120, 90)),
 ("palace street", 24, 30, 37, 2, (200, 190, 160)),
 ("castle (bd-castle rows 0-22 + side walls)", 28, 32, 33, 23, (120, 120, 200)),
 ("quay strip", 24, 32, 4, 23, (200, 190, 160)),
 ("royal avenue", 16, 26, 4, 35, (220, 210, 180)),
 ("mansion A", 3, 26, 13, 11, (230, 210, 230)),
 ("mansion B", 3, 38, 13, 11, (230, 210, 230)),
 ("chapel", 3, 49, 12, 12, (210, 210, 240)),
 ("forecourt + drawbridge", 24, 58, 37, 3, (220, 210, 180)),
 ("bridge 2", 20, 58, 4, 3, (130, 100, 70)),
]
im = Image.new("RGB", (W * S, H * S), (95, 150, 70)); d = ImageDraw.Draw(im)
for n, x, y, w, h, c in Z:
    d.rectangle([x * S, y * S, (x + w) * S - 1, (y + h) * S - 1], fill=c, outline=(20, 20, 20))
for n, x, y, w, h, c in Z:
    d.text((x * S + 2, y * S + 2), n, fill=(0, 0, 0))
for x in range(0, W, 8): d.text((x * S, H * S - 10), str(x), fill=(255, 255, 255))
for y in range(0, H, 8): d.text((W * S - 16, y * S), str(y), fill=(255, 255, 255))
R = [((55, 29), (55, 28)), ((55, 25), (55, 11)), ((55, 11), (55, 1)), ((52, 29), (39, 25)), ((39, 25), (27, 25)), ((27, 25), (27, 24))]
for (a, b) in R: d.line([(a[0] * S + 5, a[1] * S + 5), (b[0] * S + 5, b[1] * S + 5)], fill=(220, 30, 30), width=3)
im.save("zones.png"); print(im.size)
