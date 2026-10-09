"""카탈로그의 recipes 22개와 L자 lRecipes 3개를 jpstreet.Kit(시트+카탈로그 파일만)으로 조립해 한 장 PNG 로 만든다(눈 확인용).
  python3 preview_recipes.py [--out tiledata/jp-city/preview-recipes.png] [--scale 2]"""
import os, sys, argparse
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import jpenv
from jpstreet import Kit

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--out', default=os.path.join(jpenv.TD, 'preview-recipes.png')); ap.add_argument('--scale', type=int, default=2)
    ap.add_argument('--width', type=int, default=1800); a = ap.parse_args()
    kit = Kit.load(jpenv.OUT); cat = kit.cat; S = a.scale
    items = [(k, kit.render(kit.assemble(v)), 'recipe') for k, v in cat['recipes'].items()] + [(k, kit.render(kit.assemble_L(v)), 'L') for k, v in cat['lRecipes'].items()]
    font = ImageFont.load_default(); BG = (150, 142, 150, 255); PAD = 14; LAB = 14
    placed = []; x = y = PAD; rowh = 0
    for nm, arr, kind in items:
        im = Image.fromarray(arr).resize((arr.shape[1] * S, arr.shape[0] * S), Image.NEAREST)
        if x + im.width + PAD > a.width and x > PAD: x = PAD; y += rowh + PAD + LAB; rowh = 0
        placed.append((nm, im, x, y)); x += im.width + PAD; rowh = max(rowh, im.height)
    H = y + rowh + PAD + LAB
    sheet = Image.new('RGBA', (a.width, H), BG); dr = ImageDraw.Draw(sheet)
    # 같은 줄은 바닥을 맞춘다
    rows = {}
    for p in placed: rows.setdefault(p[3], []).append(p)
    for y0, ps in rows.items():
        rh = max(p[1].height for p in ps)
        for nm, im, x0, _ in ps:
            yy = y0 + LAB + (rh - im.height); sheet.alpha_composite(im, (x0, yy)); dr.text((x0, yy - LAB), nm, fill=(20, 20, 30, 255), font=font)
    os.makedirs(os.path.dirname(a.out), exist_ok=True); sheet.convert('RGB').save(a.out)
    print(a.out, sheet.size, len(items), 'items (recipes', len(cat['recipes']), '+ L', len(cat['lRecipes']), ')')
if __name__ == '__main__': main()
