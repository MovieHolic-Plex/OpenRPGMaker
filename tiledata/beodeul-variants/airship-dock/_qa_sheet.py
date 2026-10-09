# 조각 판 미리보기(감독 검수용): 이름 붙인 조각을 회색 바탕 위 정수 배율로.
from PIL import Image, ImageDraw
def sheet(items, path, scale=3, cols=8, bg=(112, 128, 96, 255)):
    cw = max(i.width for _, i in items) + 8; ch = max(i.height for _, i in items) + 16
    rows = (len(items) + cols - 1) // cols
    o = Image.new('RGBA', (cols * cw * scale, rows * ch * scale), (40, 40, 44, 255)); d = ImageDraw.Draw(o)
    for k, (n, im) in enumerate(items):
        x = (k % cols) * cw * scale; y = (k // cols) * ch * scale
        b = Image.new('RGBA', im.size, bg); b.alpha_composite(im)
        o.paste(b.resize((im.width * scale, im.height * scale), Image.NEAREST), (x + 4, y + 14))
        d.text((x + 4, y + 2), n, fill=(255, 255, 255, 255))
    o.save(path)
