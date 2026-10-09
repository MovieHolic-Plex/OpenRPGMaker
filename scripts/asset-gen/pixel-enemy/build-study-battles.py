#!/usr/bin/env python3
"""Build only the four revised hand-pixel battle sets; preserve their idle art."""
from pathlib import Path
import hashlib
import json
import sys
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE / "refresh"))
from registry import ENTRIES, draw_entry, helper

SLUGS = ['kappa-01', 'wolf-grey', 'bat-cave', 'skeleton-knight']
OUT = ROOT / 'verify-shots/monster-battle-four'
BASELINE = {
    'kappa-01': 'verify-shots/kappa-redraw/kappa-native.png',
    **{slug: f'verify-shots/monster-redraw-studies/{slug}-native.png' for slug in SLUGS[1:]},
}
CAPTIONS = {
    'kappa-01': '이끼빛 큰 등껍질과 파란 물접시, 노란 부리, 굵은 물갈퀴 손발을 가진 갓파다.',
    'wolf-grey': '청회색 털과 밝은 목털, 두꺼운 뒷다리, 드러난 송곳니를 가진 회색 늑대다.',
    'bat-cave': '푸른 회색 털과 분홍빛 날개막, 긴 귀, 갈고리 발과 송곳니를 가진 동굴 박쥐다.',
    'skeleton-knight': '낡은 철제 투구와 넓은 검, 닳은 초승달 방패를 들고 갈비뼈를 드러낸 해골 전사다.',
}
NAMES = {'kappa-01': '갓파', 'wolf-grey': '회색 늑대', 'bat-cave': '동굴 박쥐', 'skeleton-knight': '해골 전사'}
POSE_NAMES = ['대기 A', '대기 B', '대기 C', '준비', '이동', '공격', '복귀', '피격', '쓰러짐']


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    # Draw all cells and validate before overwriting any public asset.
    frames = {slug: [draw_entry(slug, pose) for pose in helper.POSES] for slug in SLUGS}
    for slug, poses in frames.items():
        with Image.open(ROOT / BASELINE[slug]) as original:
            assert poses[0].tobytes() == original.convert('RGBA').tobytes(), (slug, 'idle changed')
        assert ENTRIES[slug]['cell'] == 64
        assert len({f.tobytes() for f in poses}) == 9
        for pose, im in zip(helper.POSES, poses):
            box = im.getbbox()
            assert im.size == (64, 64) and box[0] > 0 and box[1] > 0 and box[2] < 64 and box[3] <= 61, (slug, pose, box)
            assert set(im.getchannel('A').tobytes()) == {0, 255}
        assert poses[-1].getbbox()[3] == 61, (slug, 'fallen contact')
    reports = []
    for slug, poses in frames.items():
        report = helper.export_frames(ENTRIES[slug], poses)
        report['originalIdlePreserved'] = True
        report['description'] = CAPTIONS[slug]
        reports.append(report)
        helper.review_board(poses, 64, 3).save(OUT / (slug + '-poses.png'))
        timeline = [0, 1, 2, 1, 3, 4, 5, 6, 0, 7, 8]
        cycle = []
        for i in timeline:
            im = Image.new('RGBA', (256, 256), '#242d3b')
            im.alpha_composite(poses[i].resize((256, 256), Image.Resampling.NEAREST))
            cycle.append(im.convert('RGB'))
        cycle[0].save(OUT / (slug + '-cycle.gif'), save_all=True, append_images=cycle[1:],
                      duration=[180]*4 + [350, 240, 380, 280, 200, 450, 1100], loop=0, disposal=2, optimize=False)

    # One shared review animation shows all four authored cycles, not game footage.
    timeline = [0, 1, 2, 1, 3, 4, 5, 6, 0, 7, 8]
    grid = []
    font_path = Path('/usr/share/fonts/truetype/nanum/NanumGothic.ttf')
    font = ImageFont.truetype(str(font_path), 14) if font_path.exists() else ImageFont.load_default()
    for i in timeline:
        im = Image.new('RGB', (512, 552), '#242d3b')
        d = ImageDraw.Draw(im)
        for j, slug in enumerate(SLUGS):
            cell = Image.new('RGBA', (256, 256), '#242d3b')
            cell.alpha_composite(frames[slug][i].resize((256, 256), Image.Resampling.NEAREST))
            x, y = j % 2 * 256, j // 2 * 276
            im.paste(cell.convert('RGB'), (x, y))
            label = NAMES[slug] + ' · ' + POSE_NAMES[i] if font_path.exists() else slug + ' / ' + helper.POSES[i]
            d.text((x+8, y+257), label, fill='#dce5de', font=font)
        grid.append(im)
    grid[0].save(OUT / 'four-battle-poses-ko.gif', save_all=True, append_images=grid[1:],
                 duration=[180]*4 + [350, 240, 380, 280, 200, 450, 1100], loop=0, disposal=2, optimize=False)
    grid[6].save(OUT / 'four-attacks.png')
    (OUT / 'pixels.json').write_text(json.dumps(reports, indent=2) + '\n')

    # Refresh only these four contact bounds and catalog descriptions/hashes.
    bounds_path = ROOT / 'src/assets/battleContactBounds.json'
    bounds = json.loads(bounds_path.read_text())
    catalog_path = ROOT / 'src/assets/monsterCatalogData.json'
    catalog = json.loads(catalog_path.read_text())
    review_path = ROOT / 'src/assets/monsterCatalogReview.json'
    review = json.loads(review_path.read_text())
    for report in reports:
        slug = report['slug']; entry = ENTRIES[slug]
        bounds[entry['path']] = {'sha256': report['sha256'], 'cell': 64,
                                **{k: [round(v / 64, 6) for v in frames[slug][i].getbbox()]
                                   for k, i in [('idle', 0), ('strike', 5), ('attack', 5)]}}
        catalog[entry['resourceId']]['description'] = CAPTIONS[slug]
        row = review['entries'][entry['resourceId']]
        row.update(sha256=hashlib.sha256((ROOT / 'public/assets/generated/pixel-enemy-portraits' / (slug+'.png')).read_bytes()).hexdigest(),
                   observation=CAPTIONS[slug], nativeSheet=entry['path'], nativeSheetSha256=report['sha256'],
                   cell=64, reviewEvidence='verify-shots/monster-battle-four/SUMMARY.md',
                   inspectionMethod='Four species: direct native pose board review and exported-player battle evidence.')
    bounds_path.write_text(json.dumps(bounds, separators=(',', ':')) + '\n')
    catalog_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n')
    review_path.write_text(json.dumps(review, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'species': len(reports), 'poses': 36, 'originalIdlePreserved': True,
                      'cells': [r['cell'] for r in reports], 'colors': [r['colors'] for r in reports]}))


if __name__ == '__main__':
    main()
