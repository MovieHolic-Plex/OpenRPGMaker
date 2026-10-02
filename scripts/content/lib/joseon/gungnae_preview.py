"""국내성식 집 변형 세트 미리보기: python3 gungnae_preview.py [out.png] [scale]  — 전 조각을 라벨과 함께 3배로, 같은 종류끼리 나란히."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw, ImageFont
import gungnae_houses as GH
import ground as GR
from tk import T

SECTIONS = [
    ('1. ㄱ자·ㄷ자 몸채 (기와 팔작/맞배 · 초가)', ['gn_l_giwa_6', 'gn_l_brown_5g', 'gn_l_teal_7', 'gn_u_giwa_7', 'gn_u_brown_8g', 'gn_l_thatch_5', 'gn_u_thatch_6']),
    ('2. 주막 ㅁ자 마당집 키트 (모서리·안채·대문채·가로/세로 행랑)', ['gn_jm_corner_l', 'gn_jm_corner_r', 'gn_jm_anchae_4', 'gn_jm_anchae_5', 'gn_jm_daemun_6', 'gn_jm_row_room_4', 'gn_jm_row_store_5', 'gn_jm_row_back_6', 'gn_jm_row_v_3', 'gn_jm_row_v_end', 'gn_jm_row_v_cap']),
    ('3. 상점 4종 (대장간·푸줏간·포목상·갑옷/무기점)', ['gn_shop_smithy', 'gn_shop_butcher', 'gn_shop_cloth', 'gn_shop_armory']),
    ('4. 2·3층 기와집 (누각형·객주형, 회청·갈색·청록, 팔작/맞배)', ['gn_g2_nugak_5', 'gn_g2_inn_6', 'gn_g3_nugak_4t', 'gn_g3_inn_7']),
    ('5. 초가 4종 (a 둥근 방석·b 낮고 넓음·c 맞배·d 헛간 딸림)', ['gn_thatch_a', 'gn_thatch_b', 'gn_thatch_c', 'gn_thatch_d']),
]
WALL_SETS = [('gn_mud', '흙담(이엉)'), ('gn_mudg', '흙담(기와)'), ('gn_stone', '돌담(덮개돌)')]


def ring(o, tag, W=9, H=6, hole=None):
    """구획 담으로 한 채를 두른 모양(안쪽은 흙 마당) — 가로 변형을 섞어 이음 없이 이어지는지 본다."""
    from PIL import Image as I
    cv = I.new('RGBA', (W * T, H * T), (0, 0, 0, 0))
    for ty in range(H):
        for tx in range(W):
            cv.alpha_composite(GR.yard((tx + ty) % 2).img(), (tx * T, ty * T))
    def P(n, x, y): cv.alpha_composite(o[n].img(), (x * T, y * T))
    for x in range(1, W - 1):
        P(f'{tag}_h{x % 3}', x, 0); P(f'{tag}_h{(x + 1) % 3}', x, H - 1)
    for y in range(1, H - 1):
        P(f'{tag}_v', 0, y); P(f'{tag}_v1', W - 1, y)
    P(f'{tag}_c_nw', 0, 0); P(f'{tag}_c_ne', W - 1, 0); P(f'{tag}_c_sw', 0, H - 1); P(f'{tag}_c_se', W - 1, H - 1)
    return cv


def main(out='/tmp/vqa20/bldg_preview.png', sc=3):
    o = GH.objects()
    colw = 1900 // sc
    blocks = []                      # (title, [(label, Image)])
    for title, names in SECTIONS:
        blocks.append((title, [(n.replace('gn_', ''), o[n].img()) for n in names]))
    walls = []
    for tag, nm in WALL_SETS:
        for k in ('h0', 'h1', 'h2', 'v', 'v1', 'c_nw', 'c_ne', 'c_sw', 'c_se'):
            walls.append((f'{nm[:2]}{k}', o[f'{tag}_{k}'].img()))
    walls += [('sarip흙', o['gn_sarip_mud'].img()), ('sarip돌', o['gn_sarip_stone'].img()), ('삼문돌', o['gn_samun_stone'].img()), ('삼문흙', o['gn_samun_mud'].img())]
    blocks.append(('6. 구획 담 (흙/돌, 가로·세로·모서리·사립문·삼문)', walls))
    blocks.append(('6b. 구획 담으로 한 채를 두른 예 (가로 변형 혼합, 안쪽 yard 지형)', [(nm, ring(o, tag)) for tag, nm in WALL_SETS]))
    mad = GH.jumak_madang(5, 4, 'brown')
    mad2 = GH.jumak_madang(3, 3, 'giwa', wall='gn_stone', gate='samun')
    blocks.append(('2b. 주막 ㅁ자 마당집 조합 예 (키트 조각만으로 조립, 바닥은 yard)', [('madang 안채5 마당4 · 갈색 · 기와 토담 · 사립문', mad.img()), ('madang 안채3 마당3 · 회청 · 돌담 · 삼문', mad2.img())]))
    # 배치
    pad = 6
    y = 0
    placed = []
    for title, items in blocks:
        y += 14
        placed.append(('title', title, 4, y - 12))
        x = 4; rowh = 0; y0 = y
        for label, im in items:
            w, h = im.width + pad, im.height
            if x + w > colw and x > 4:
                y0 += rowh + 12; x = 4; rowh = 0
            placed.append(('img', label, x, y0, im))
            x += w; rowh = max(rowh, h)
        y = y0 + rowh + 12
    H = y + 4
    sheet = Image.new('RGBA', (colw, H), (88, 160, 53, 255))
    for p in placed:
        if p[0] == 'img':
            sheet.alpha_composite(p[4], (p[2], p[3]))
    big = sheet.resize((colw * sc, H * sc), Image.NEAREST).convert('RGB')
    d = ImageDraw.Draw(big)
    try:
        fnt = ImageFont.truetype('/usr/share/fonts/truetype/nanum/NanumGothic.ttf', 13)
    except OSError:
        fnt = None
    for p in placed:
        if p[0] == 'title':
            d.rectangle([p[2] * sc - 2, p[3] * sc - 2, colw * sc, p[3] * sc + 12], fill=(30, 40, 30))
            d.text((p[2] * sc, p[3] * sc), p[1], fill=(255, 255, 200), font=fnt)
        else:
            d.text((p[2] * sc, p[3] * sc - 14), p[1], fill=(255, 255, 255), font=fnt)
    big.save(out)
    print(out, big.size)


if __name__ == '__main__':
    main(*(sys.argv[1:2] or ['/tmp/vqa20/bldg_preview.png']), *(int(a) for a in sys.argv[2:3]))
