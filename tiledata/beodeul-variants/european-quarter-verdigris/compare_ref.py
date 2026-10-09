# 비교 시트(compare-ref.png): 같은 배율(2x)로 [기준 | 이 장소]를 나란히.
#  1) 버들항 도시 렌더(city6_base — 석재·지붕·자갈) | 이 장소 저택 줄
#  (사용자 참고 그림은 제3자 그림이라 이 시트·저장소에 넣지 않는다 — 눈으로만 대조했다)
#  2) 고친 기록: 앞 판(어두운 청색 골목·구름 같은 눈·촘촘한 작은 창·어두운 벽·눈알 다락창·네모 계단 자갈 마당) → 지금
#  3) 전투 배경 | 같은 장소 맵 렌더
#   python3 compare_ref.py
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from PIL import Image, ImageDraw
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))

def crop2(path, box, scale=2):
    im = Image.open(path).convert('RGBA').crop(box)
    return im.resize((im.width * scale, im.height * scale), Image.NEAREST)

def main():
    me = HERE + '/render-1x.png'
    rows = []
    city = ROOT + '/tiledata/beodeul-city/render/city6_base.png'
    rows.append(('Beodeul city6_base castle (pale stone wall, slate roof, windows)  |  verdigris mansion row',
                 [crop2(city, (40, 20, 280, 220)), crop2(me, (176, 20, 416, 220))]))
    rows.append(('Beodeul city6_base market plaza (fountain, flagstone, props)  |  verdigris plaza (cobble, fountain, lamps)',
                 [crop2(city, (900, 560, 1140, 760)), crop2(me, (120, 150, 360, 350))]))
    v1 = HERE + '/_qa/rb_full.png'
    if os.path.exists(v1):
        rows.append(('fix log: earlier pass (navy wet alleys, puffy cloud-like snow, dense small windows, dark walls, eye dormers)  |  now',
                     [crop2(v1, (0, 300, 240, 500)), crop2(me, (0, 300, 240, 500))]))
        rows.append(('fix log: earlier pass garden (square stepped gravel court)  |  now (round cobble court via autotile)',
                     [crop2(v1, (528, 200, 768, 400)), crop2(me, (528, 200, 768, 400))]))
    bg = HERE + '/battle-bg.png'
    if os.path.exists(bg):
        rows.append(('battle-bg (640x360, 1x)  |  map render (1x)', [Image.open(bg).convert('RGBA'), crop2(me, (0, 0, 640, 360), 1)]))
    Wt = max(sum(i.width for i in ims) + 30 for _, ims in rows); Ht = sum(max(i.height for i in ims) + 34 for _, ims in rows) + 10
    o = Image.new('RGBA', (Wt, Ht), (22, 22, 26, 255)); d = ImageDraw.Draw(o); y = 8
    for title, ims in rows:
        d.text((10, y), title, fill=(235, 235, 235, 255)); y += 18; x = 10
        for im in ims: o.alpha_composite(im, (x, y)); x += im.width + 10
        y += max(i.height for i in ims) + 16
    o.convert('RGB').save(HERE + '/compare-ref.png')
    print(o.size)

if __name__ == '__main__':
    main()
