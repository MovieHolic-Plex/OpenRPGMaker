"""조선 실내 조각 검수 시트 — [내 조각 | 실내 v5 기준 기물] 을 같은 배율(기본 4배)로 나란히.

    python3 in_review.py out.png name1,name2,...        # 조각 이름(in_...)
    python3 in_review.py out.png --all [--cols 4]
기준 그림은 tiledata/hand-interior/v5/interior-atlas.png (손 도트 실내 v5, atlas_biome_interior 의 기물). REFS 가 조각 → v5 id 를 맺는다.
조선 조각은 같은 시점(정면-위 3/4)·같은 배율·윗면이 얼마나 보이는가·명암 단 수를 이 시트에서 눈으로 비교한다.
"""
import json, os, sys
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
V5 = os.path.join(ROOT, 'tiledata', 'hand-interior', 'v5')

REFS = {
    'in_nong': ['wardrobe', 'cupboard'], 'in_ibuljang': ['wardrobe'], 'in_bandaji': ['chest', 'sideboard 2x1'], 'in_mungap': ['sideboard 2x1', 'chest'],
    'in_soban_a': ['roundtable', 'dining 1x1'], 'in_soban_b': ['roundtable'], 'in_soban_c': ['roundtable'],
    'in_sang_2': ['dining 2x1', 'desk 2x1'], 'in_sang_jumak': ['dining 2x1', 'table:mug+bottle'], 'in_chaeksang': ['desk 2x1', 'table:book+scroll'],
    'in_hwaro': ['brazier', 'stove'], 'in_betl': ['loom', 'spinning wheel'], 'in_mulle': ['spinning wheel'],
    'in_bumak_2': ['kitchen range', 'bread oven'], 'in_bumak_3': ['kitchen range', 'forge'],
    'in_hangari_a': ['water jar', 'pot'], 'in_hangari_b': ['water jar', 'pot'], 'in_hangari_tall': ['water jar'], 'in_dok_row': ['water jar', 'pot'], 'in_suldok': ['barrel', 'water jar'],
    'in_dwiju': ['chest', 'crate'], 'in_pyeongsang_3': ['bench 3', 'dining 3x2'], 'in_bangseok_r': ['stool'], 'in_ibul_r': ['bed red', 'double bed red'],
    'in_jipjari_2': ['runner', 'doormat'], 'in_jokja_a': ['picture', 'wall map'], 'in_deungjan': ['wall sconce', 'candelabra'], 'in_chotdae': ['candelabra', 'candle'],
    'in_byeongpung_a': ['wall map', 'tapestry'], 'in_seonban': ['shelf pots', 'bookshelf 2w'], 'in_yakjang': ['apothecary drawers', 'bookshelf 2w'],
    'in_seoga': ['bookshelf 2w', 'bookshelf 3w'], 'in_forge': ['forge'], 'in_morus': ['anvil'], 'in_pulmu': ['forge', 'bread oven'],
    'in_tub': ['quench barrel', 'barrel'], 'in_charcoal': ['coal bin'], 'in_jumak_counter': ['counter 3x1', 'counter 2x1'], 'in_gwan_desk': ['desk 3x1', 'counter 3x1'],
    'in_byeongpung_royal': ['wall map', 'tapestry'], 'in_mat_hopi': ['fur rug'], 'in_boryo_2': ['runner'], 'in_ansuk': ['stool'], 'in_seoan': ['desk 1x1'], 'in_seoan_2': ['desk 2x1'], 'in_chaekdemi': ['table:book+scroll'], 'in_yak_table': ['work 2x1', 'balance scale'], 'in_sokuri_veg': ['basket:cabbage'], 'in_sewing': ['chest'], 'in_dameum': ['quench barrel'], 'in_ladder_loft': ['stairs up wood'], 'in_ibul_folded': ['bed green'],
    'pal_throne': ['throne', 'stone throne'], 'pal_byeongpung_ilwol': ['tapestry', 'wall map'], 'pal_hyangro': ['brazier', 'cauldron'], 'pal_chotdae_tall': ['candelabra', 'paschal candle'],
    'pal_deungrong': ['wall sconce', 'hanging lantern'], 'pal_deung_hang': ['hanging lantern'], 'pal_uija': ['armchair', 'chair S'], 'pal_seoan_gwan': ['desk 2x1', 'table:book+scroll'],
    'pal_munseo_ham': ['royal chest', 'chest'], 'pal_buk_big': ['barrel', 'gear wall'], 'pal_jong': ['bell rope', 'orrery'], 'pal_chimsang': ['canopy bed', 'double bed red'],
    'pal_jangnong': ['wardrobe', 'cupboard'], 'pal_hwajangdae': ['vanity mirror', 'nightstand'], 'pal_gyeongdae': ['tailor mirror'], 'pal_surasang': ['dining 2x1', 'table:plate+cup'],
    'pal_yaktang': ['alembic', 'cauldron'], 'pal_seoga_tall': ['bookshelf 2w', 'cabinet:book+bookb+bookg'], 'pal_chaekgap': ['table:book+scroll'], 'pal_gwan_seat': ['desk 2x1', 'stool'],
    'pal_gungnyeo_jari': ['tea 1x1', 'stool'], 'pal_changgeori': ['weapon rack', 'armor stand'], 'pal_pillar': ['column wood', 'column stone'], 'pal_pillar_2': ['column wood'],
    'pal_bangseok_red': ['stool'], 'pal_bangseok_blue': ['stool'],
    'in_buk': ['barrel', 'piano'], 'in_hyeongtul': ['weapon rack', 'pew'], 'in_tool_rack': ['tool wall', 'weapon rack'],
}
FLOORS = {'maru': (0xc6, 0x87, 0x5e), 'ondol': (0xc8, 0x9a, 0x66), 'dirt': (0x81, 0x6a, 0x56), 'stone': (0x92, 0x94, 0x91)}


def _v5():
    m = json.load(open(os.path.join(V5, 'interior-meta.json')))
    atlas = Image.open(os.path.join(V5, 'interior-atlas.png')).convert('RGBA')
    by = {o['id']: o for o in m['objects']}
    return atlas, by


def ref_image(atlas, by, oid):
    o = by.get(oid)
    if not o:
        return None
    a = o['atlas']
    return atlas.crop((a['x'], a['y'], a['x'] + a['w'], a['y'] + a['h']))


def sheet(objs, names, out, sc=4, floor='maru', cols=4, with_ref=True):
    atlas, by = _v5()
    fl = FLOORS[floor]
    cells = []
    for n in names:
        ims = [(n, objs[n].img())]
        if with_ref:
            for r in REFS.get(n, [])[:2]:
                im = ref_image(atlas, by, r)
                if im is not None:
                    ims.append(('v5:' + r, im))
        cells.append(ims)
    rows = [cells[i:i + cols] for i in range(0, len(cells), cols)]
    pad = 8
    row_h = []
    row_w = []
    for r in rows:
        row_h.append(max(max(i.height for _, i in c) for c in r) * sc + 16)
        row_w.append(sum(sum(i.width * sc + pad for _, i in c) + 14 for c in r))
    W = max(row_w) + 8
    H = sum(row_h) + 8
    sh = Image.new('RGBA', (W, H), (40, 36, 34, 255))
    d = ImageDraw.Draw(sh)
    y = 4
    for r, rh in zip(rows, row_h):
        x = 4
        for c in r:
            x0 = x
            wmax = sum(i.width * sc + pad for _, i in c)
            sh.paste(Image.new('RGBA', (wmax, rh - 2), fl + (255,)), (x, y))
            xx = x
            for label, im in c:
                big = im.resize((im.width * sc, im.height * sc), Image.NEAREST)
                sh.alpha_composite(big, (xx + pad // 2, y + rh - 2 - big.height))
                d.text((xx + 2, y + 1), label, fill=(255, 255, 255, 255) if not label.startswith('v5:') else (150, 255, 150, 255))
                xx += big.width + pad
            x += wmax + 14
        y += rh
    sh.convert('RGB').save(out)
    return out


if __name__ == '__main__':
    import catalog
    objs = catalog.objects()                       # 실내 키트(in_) + 궁 내부(pal_) 전부
    out = sys.argv[1]
    cols = 4
    if '--cols' in sys.argv:
        cols = int(sys.argv[sys.argv.index('--cols') + 1])
    floor = 'maru'
    if '--floor' in sys.argv:
        floor = sys.argv[sys.argv.index('--floor') + 1]
    sc = int(sys.argv[sys.argv.index('--sc') + 1]) if '--sc' in sys.argv else 4
    names = list(objs) if sys.argv[2] == '--all' else sys.argv[2].split(',')
    if len(sys.argv) > 2 and names and names[0] == '--all':
        names = list(objs)
    print(sheet(objs, names, out, sc=sc, floor=floor, cols=cols))
