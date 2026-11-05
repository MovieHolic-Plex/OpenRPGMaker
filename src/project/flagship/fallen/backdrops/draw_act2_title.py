# 제2막 막 제목 카드(480x270, 무대와 같은 크기) — 제1막 끝 카드(엔딩 화면 kicker·heading·금빛 밑줄·가는 가로선)와 같은 꼴.
# 엔진에 「막 제목 카드」 명령이 없어 그림 한 장으로 띄운다(showPicture). 배경은 밤하늘 아래 감방 쇠창살 너머로 새는 횃불 한 점.
# 다시 그리기: 이 폴더에서 python3 draw_act2_title.py → act2-title.png·act2-title.json 을 다시 쓴다.
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import base64, hashlib, io, json, math, random
random.seed(11)
W, H = 480, 270
im = Image.new('RGB', (W, H))
px = im.load()
top, bot = (10, 12, 26), (24, 16, 22)
for y in range(H):
  t = y / (H - 1)
  c = tuple(round(top[i] + (bot[i] - top[i]) * t) for i in range(3))
  for x in range(W): px[x, y] = c
d = ImageDraw.Draw(im)
for _ in range(90):
  x, y = random.randrange(W), random.randrange(0, 150)
  v = random.choice([70, 90, 120, 160])
  d.point((x, y), fill=(v, v + 6, v + 24))
# 아래 가운데 — 빌린 불 한 점(겹친 원을 흐리게).
glow = Image.new('RGB', (W, H), (0, 0, 0))
g = ImageDraw.Draw(glow)
for r, col in [(120, (60, 28, 10)), (70, (120, 58, 18)), (34, (210, 120, 40)), (12, (255, 210, 130))]:
  g.ellipse((W / 2 - r, 238 - r * 0.6, W / 2 + r, 238 + r * 0.6), fill=col)
glow = glow.filter(ImageFilter.GaussianBlur(18))
im = Image.composite(im, im, Image.new('L', (W, H), 255))
im = Image.fromarray(__import__('numpy').clip(__import__('numpy').asarray(im, dtype='int16') + __import__('numpy').asarray(glow, dtype='int16'), 0, 255).astype('uint8'))
d = ImageDraw.Draw(im)
# 쇠창살 그림자 — 불빛 앞에 선 세로 막대(어둡게).
for i in range(-6, 7):
  x = W / 2 + i * 22
  d.rectangle((x - 2, 176, x + 2, H), fill=(14, 10, 14))
d.rectangle((W / 2 - 150, 196, W / 2 + 150, 199), fill=(16, 12, 16))
# 가는 가로선(제1막 카드처럼 위·아래).
for y in (44, 226):
  for x in range(68, 413):
    a = 1 - abs((x - 240) / 172) ** 3
    base = px_val = im.getpixel((x, y))
    im.putpixel((x, y), tuple(round(base[i] + (200 - base[i]) * 0.45 * a) for i in range(3)))
FONT = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
def font(size):
  return ImageFont.truetype(FONT, size, index=1)  # index 1 = KR
def centered(text, y, size, fill, spacing=0):
  f = font(size)
  if spacing:
    widths = [d.textlength(ch, font=f) for ch in text]
    total = sum(widths) + spacing * (len(text) - 1)
    x = (W - total) / 2
    for ch, w in zip(text, widths):
      d.text((x, y), ch, font=f, fill=fill)
      x += w + spacing
  else:
    d.text(((W - d.textlength(text, font=f)) / 2, y), text, font=f, fill=fill)
shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
sd = ImageDraw.Draw(shadow)
d = ImageDraw.Draw(im)
centered('폴른 스타', 72, 9, (248, 217, 200), spacing=3)
for text, y in (('제2막', 96), ('빌린 불', 136)):
  f = font(36)
  x = (W - d.textlength(text, font=f)) / 2
  sd.text((x, y + 2), text, font=f, fill=(0, 0, 0, 200))
im = Image.alpha_composite(im.convert('RGBA'), shadow.filter(ImageFilter.GaussianBlur(2))).convert('RGB')
d = ImageDraw.Draw(im)
for text, y in (('제2막', 96), ('빌린 불', 136)):
  centered(text, y, 36, (255, 248, 238))
# 금빛 밑줄(가운데 진하고 양끝 사라짐).
for x in range(240 - 32, 240 + 33):
  a = 1 - abs(x - 240) / 32
  for y in (190, 191):
    base = im.getpixel((x, y))
    im.putpixel((x, y), tuple(round(base[i] + ((243, 201, 139)[i] - base[i]) * a) for i in range(3)))
im.save('act2-title.png')
buf = io.BytesIO(); im.save(buf, 'PNG')
json.dump({"resource": {"id": "picture_fs2_act2_title", "name": "제2막 막 제목 카드 「빌린 불」", "kind": "picture",
           "dataUrl": "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()},
           "pixelSha256": hashlib.sha256(im.tobytes()).hexdigest()}, open('act2-title.json', 'w'), ensure_ascii=False)
print('ok', im.size)
