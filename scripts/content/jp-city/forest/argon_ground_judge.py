#!/usr/bin/env python3
"""숲 접지(나무가 땅에 앉아 보이나) 적대적 검수 — 그림마다 따로, 판정자는 어느 쪽이 새 판인지 모른다.

  python3 argon_ground_judge.py --out DIR --ref REF.png --cand NAME=IMG [--cand ...] [--runs 3] [--jobs 5]

판정자는 기준(버들항 숲 1배 + 4배 크롭)과 후보 1배 + 4배 사분면 넷을 받고, 「떠 보이는」 결함만 찾는다.
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

PROMPT = """You are an adversarial pixel-art QA judge. Judge ONE question only: do the trees in the CANDIDATE look GROUNDED
(standing on the ground) or FLOATING (pasted on top of the grass)? Ignore leaf texture, colour taste and composition unless they
directly cause floating. The bar is the REFERENCE: hand-made art from this same project, 16px tiles, 3/4 top-down JRPG, light from upper-left.

Images:
 1) REFERENCE at 1x (beodeul forest on its own grass).
 2) REFERENCE crop at 4x.
 3) CANDIDATE at 1x.
 4-7) CANDIDATE quadrants q0 (top-left), q1 (top-right), q2 (bottom-left), q3 (bottom-right) at 4x.

Look for grounding cues and their absence:
- trunk base: does it widen into roots that bite into the ground, or end in a flat cut / sit on top of the grass?
- contact shadow: is there a darker ground shadow under and beside trunks and under the canopy mass, offset away from the light (lower-right)?
- canopy lower edge: does it hover over bright empty grass with nothing under it?
- forest mass: is the ground under the forest darker than open grass, so the mass sits on the ground?
- front-row trunks: do they meet the ground, or float as a row of pegs?
- shadow shape: does the ground shadow itself look like a tile-shaped rectangle or stair steps?
Report JSON only:
{"grounded_score": 1-5 (5 = as grounded as the reference, 1 = clearly floating),
 "floating_blocking":[{"where":"q0..q3 or 1x","what":"...","fix":"..."}],
 "minor":[{"where":"...","what":"..."}],
 "verdict":"GROUNDED" or "FLOATING"}"""


def quads(im, scale=4):
    W, H = im.size
    out = []
    for qy in range(2):
        for qx in range(2):
            c = im.crop((qx * W // 2, qy * H // 2, (qx + 1) * W // 2, (qy + 1) * H // 2))
            out.append(c.resize((c.width * scale, c.height * scale), Image.NEAREST))
    return out


def judge(name, path, ref, out, run):
    r = Image.open(ref).convert('RGBA'); c = Image.open(path).convert('RGBA')
    rc = r.crop((r.width // 4, r.height // 3, r.width // 4 + r.width // 2, r.height // 3 + r.height // 2))
    content = [{'type': 'text', 'text': PROMPT}, {'type': 'image_url', 'image_url': {'url': uri(r)}},
               {'type': 'image_url', 'image_url': {'url': uri(rc.resize((rc.width * 4, rc.height * 4), Image.NEAREST))}},
               {'type': 'image_url', 'image_url': {'url': uri(c)}}]
    content += [{'type': 'image_url', 'image_url': {'url': uri(q)}} for q in quads(c)]
    txt = ask(content)
    m = re.search(r'\{.*\}', txt, re.S)
    try: res = json.loads(m.group(0)) if m else {'raw': txt}
    except Exception: res = {'raw': txt}  # noqa: BLE001
    json.dump(res, open(os.path.join(out, f'ground-{name}-run{run}.json'), 'w'), ensure_ascii=False, indent=1)
    return name, run, res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True); ap.add_argument('--ref', required=True)
    ap.add_argument('--cand', action='append', required=True); ap.add_argument('--runs', type=int, default=3)
    ap.add_argument('--jobs', type=int, default=5)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    jobs = [(n, p, run) for c in a.cand for n, p in [c.split('=', 1)] for run in range(a.runs)]
    agg = {}
    with cf.ThreadPoolExecutor(a.jobs) as ex:
        for name, run, res in ex.map(lambda j: judge(j[0], j[1], a.ref, a.out, j[2]), jobs):
            agg.setdefault(name, []).append(res)
    for name, rs in agg.items():
        sc = [r.get('grounded_score') for r in rs if isinstance(r.get('grounded_score'), (int, float))]
        vb = [r.get('verdict') for r in rs]
        nb = [len(r.get('floating_blocking', [])) for r in rs]
        print(f'{name}: score {sc} mean {sum(sc) / max(1, len(sc)):.2f} verdicts {vb} floating_blocking {nb}')
        for r in rs[:1]:
            for d in r.get('floating_blocking', [])[:4]: print('   -', d.get('where'), '|', d.get('what'))


if __name__ == '__main__':
    main()
