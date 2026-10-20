#!/usr/bin/env python3
"""숲 r3 적대적 검수 — 장면(붓으로 칠한 모양)마다 Argon 판정자를 따로 부른다(서로 독립, 앞 판 결과를 보지 않는다).

  python3 argon_r3_judge.py --round N --out DIR --ref ref-beodeul.png --scene NAME=IMG=DESC [--scene ...] [--jobs 3]

각 판정자는 1배 전체(버들항 기준 1배와 나란히)와 4배 사분면 넷(버들항 4배 크롭과 같은 배율)을 받는다.
점수를 매기는 게 아니라 결함을 찾는다: 출하를 막는 결함(blocking)과 작은 결함(minor)을 위치와 함께 JSON 으로.
키는 ~/.omp/agent/models.yml 의 providers.argonproxy.apiKey 를 실행 때 읽는다(출력·저장하지 않는다).
"""
import argparse
import concurrent.futures as cf
import json
import os
import re
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from argon_judge import ask, uri  # noqa: E402

PROMPT = """You are an adversarial pixel-art QA judge. Your only job is to FIND FAULTS that should block shipping. Do not grade on a curve,
do not praise, do not compare against "typical AI art". The bar is the REFERENCE, which is hand-made art from this same project.

Context: a 16px-per-tile, 3/4 top-down JRPG map editor. The candidate is a FOREST AUTOTILE: the user paints a forest region with a brush
and every tile is chosen automatically from its 8 neighbours (plus its position), so the forest must look hand-drawn for ANY painted shape.
Species: {species}. Painted shape in this scene: {desc}.

Images:
 1) REFERENCE at 1x (beodeul forest, hand-placed tree groves on grass).
 2) CANDIDATE scene at 1x.
 3) REFERENCE crop at 4x.
 4-7) CANDIDATE quadrants q0 (top-left), q1 (top-right), q2 (bottom-left), q3 (bottom-right) at 4x. 64 screen px = one 16px tile.

Hunt specifically for:
- any visible 16px grid: straight cuts, seams, stair steps along edges, tiles that do not join, half crowns cut by a tile line
- edges: north skyline (irregular or ruler-straight?), south edge (trunk band reading as a fence/comb/black stripe?), east/west edges,
  inner corners, narrow 1-2 tile strips (do they still read as trees?), edges against water/road/buildings
- repetition: the same crown or pattern repeating at a fixed interval (say the interval in tiles)
- crown rendering vs reference: bubble/cauliflower clumps, blur/mush, missing leaf texture, outline weight/colour, light direction
- trunks, shadows, undergrowth: stick trunks, identical trunks, checkerboard/dither shadows, floating pieces, orphan fragments
- colour: value range, saturation, hue shift shadow->light vs reference; muddy or flat areas
Report in JSON only (no prose outside JSON):
{{"blocking":[{{"where":"q0..q3 or 1x, tile col/row","what":"...","fix":"pixel-level fix"}}],
  "minor":[{{"where":"...","what":"...","fix":"..."}}],
  "repeat_interval_tiles": <number or null>,
  "verdict":"SHIP" or "NO-SHIP"}}
List every blocking defect you can find (up to 12), then minor ones (up to 8)."""


def quads(im, scale=4):
    W, H = im.size
    out = []
    for qy in range(2):
        for qx in range(2):
            c = im.crop((qx * W // 2, qy * H // 2, (qx + 1) * W // 2, (qy + 1) * H // 2))
            out.append(c.resize((c.width * scale, c.height * scale), Image.NEAREST))
    return out


def judge(name, img, desc, species, ref, out, rnd):
    im = Image.open(img).convert('RGBA')
    rf = Image.open(ref).convert('RGBA')
    rc = rf.crop((rf.width // 4, rf.height // 8, rf.width // 4 + im.width // 2, rf.height // 8 + im.height // 2))
    rc = rc.resize((rc.width * 4, rc.height * 4), Image.NEAREST)
    content = [{'type': 'text', 'text': PROMPT.format(species=species, desc=desc)},
               {'type': 'image_url', 'image_url': {'url': uri(rf)}}, {'type': 'image_url', 'image_url': {'url': uri(im)}},
               {'type': 'image_url', 'image_url': {'url': uri(rc)}}] + [{'type': 'image_url', 'image_url': {'url': uri(q)}} for q in quads(im)]
    txt = ask(content)
    m = re.search(r'\{.*\}', txt, re.S)
    try:
        res = json.loads(m.group(0)) if m else {'raw': txt}
    except Exception:  # noqa: BLE001
        res = {'raw': txt}
    res['scene'] = name; res['round'] = rnd
    json.dump(res, open(os.path.join(out, f'argon-r{rnd}-{name}.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return name, res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--round', type=int, required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--ref', required=True)
    ap.add_argument('--species', default='broadleaf (keyaki / mixed deciduous)')
    ap.add_argument('--scene', action='append', required=True, help='NAME=IMG=DESC')
    ap.add_argument('--jobs', type=int, default=3)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    jobs = [s.split('=', 2) for s in a.scene]
    with cf.ThreadPoolExecutor(a.jobs) as ex:
        for name, res in ex.map(lambda j: judge(j[0], j[1], j[2], a.species, a.ref, a.out, a.round), jobs):
            b = res.get('blocking', [])
            print(f"{name}: {res.get('verdict', '?')} blocking={len(b) if isinstance(b, list) else '?'} minor={len(res.get('minor', []) or [])} repeat={res.get('repeat_interval_tiles')}")
            for d in (b or [])[:12]:
                print('   -', d.get('where', ''), '|', d.get('what', '')[:220])


if __name__ == '__main__':
    main()
