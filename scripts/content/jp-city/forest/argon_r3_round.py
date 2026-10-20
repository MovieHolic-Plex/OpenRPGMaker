#!/usr/bin/env python3
"""숲 r3 적대 검수 한 판(전 종): 종 6 × 모양 5 + 섞인 숲 2. 판정자는 장면마다 독립, 버들항 기준과 같은 모양의 활엽을 옆에 둔다.

  python3 argon_r3_round.py --round N --scenes DIR --out DIR [--jobs 6] [--kinds bl,sg]
"""
import argparse
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SP = dict(bl='broadleaf (keyaki / mixed deciduous)', bb='bamboo grove (culms with feathery leaves)', sk='cherry blossom (sakura) forest',
          sg='japanese cedar (sugi) forest, narrow conical crowns', mp='autumn maple forest',
          mh='mixed hillside forest: cedar cones and broadleaf crowns mixed in one canopy')
SP['bd'] = SP['bl']
SHAPES = dict(blob='irregular blob of forest painted with the brush',
              strips='long horizontal strips 1, 2 and 3 tiles tall, and vertical strips 1 and 2 tiles wide (the 1-tile strips must still read as hedge or a row of small trees)',
              lshape='L-shaped forest (inner corner at the bend)', ring='forest ring around a clearing (inner edges face the clearing)',
              touching='forest touching a pond (south-west), both sides of a road, and a house (south-east clearing)')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--round', type=int, required=True)
    ap.add_argument('--scenes', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--jobs', type=int, default=6)
    ap.add_argument('--kinds', default='bl,bb,sk,sg,mp,mh')
    ap.add_argument('--no-mix', action='store_true')
    a = ap.parse_args()
    S = a.scenes
    args = [sys.executable, os.path.join(HERE, 'argon_r3_judge.py'), '--round', str(a.round), '--out', a.out, '--ref', os.path.join(S, 'ref-beodeul.png'), '--jobs', str(a.jobs)]
    for k in a.kinds.split(','):
        for sh, d in SHAPES.items():
            peer = '' if k == 'bl' else '=' + os.path.join(S, f'bl-{sh}.png')
            args += ['--scene', f'{k}-{sh}={os.path.join(S, f"{k}-{sh}.png")}={d}={SP[k]}{peer}']
    if not a.no_mix:
        for n, d in (('adj-bl-sg', 'two different forest autotiles painted next to each other: broadleaf (west) and cedar (east); judge especially the BOUNDARY between them'),
                     ('adj-sk-mh', 'two different forest autotiles painted next to each other: cherry (west) and cedar+broadleaf mix (east); judge especially the BOUNDARY between them')):
            args += ['--scene', f'{n}={os.path.join(S, n + ".png")}={d}=mixed stand={os.path.join(S, "bl-blob.png")}']
    sys.exit(subprocess.call(args))


if __name__ == '__main__':
    main()
