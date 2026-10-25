"""Bake the round-3 professor candidates exactly like the cast (bake_astra_busts64: native grid -> place -> face-only expression
edits -> one shared 16-colour palette). Output public/assets/emerald-monster/cast/professor-<key>/bust-<expr>.png + provenance.json.
  python3 bake.py [raw_dir]      (raw_dir default ~/astra-qa/prof3/raw; raws: professor-<base>.png, professor-<base>-<expr>-<try>.png)
"""
import hashlib, json, os, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import bake_astra_busts64 as B
ROOT = Path(__file__).resolve().parents[4]
OUT = ROOT / 'public/assets/emerald-monster/cast'
EXPR = ['happy', 'sad', 'angry', 'surprised']
# candidate key -> (raw base, {expr: try})
CANDS = {
    'cg-nat10': ('nat10', {}),
    'cg-nat9': ('nat9', {}),
    'cg-nat12': ('nat12', {}),
    'cg-nat1': ('nat1', {}),
}

# Hand pixel fixes after the blind review (2026-10-25, Argon): leftovers of the face-only expression edits.
# (x, y) -> hex colour taken from the same bust's palette.
SKIN, DARK, MOUTH = '#f9c485', '#2e140f', '#4e2315'
FIXES = {
    'cg-nat10': {
        'happy': {(24, 38): SKIN, (25, 38): SKIN},                       # stray cheek smear on the left only
        'angry': {(27, 42): SKIN},                                       # leftover nasolabial pixel left of the mouth
        'surprised': {(31, 43): DARK, (32, 43): DARK, (31, 44): MOUTH, (32, 44): MOUTH},  # open mouth read as a flat brown button
    },
    # 2026-10-25 cast-portrait harness review (fresh blind Argon): right eye mirrored from the left (iris 4 vs 3 px),
    # angry keeps base's smile-line age pixels, mouths get a dark rim all round, base loses its chin bar.
    # Applied in order (later pixels win); same edits as qa-runs/harnesses/cast-portrait/astra-horizon/r3-chargen/professor-cg-nat10/fixes.json.
    'cg-nat10-r2': {
        'base': {(30, 44): '#f9c485', (31, 44): '#f9c485', (32, 44): '#f9c485', (33, 44): '#f9c485', (35, 32): '#f3f5f4', (36, 32): '#0f1330', (38, 33): '#2f467e', (39, 33): '#0f1330', (39, 34): '#2f467e', (39, 35): '#2f467e'},
        'sad': {(36, 33): '#0f1330', (37, 40): '#b36434', (38, 33): '#f3f5f4', (38, 34): '#2f467e', (39, 34): '#0f1330', (39, 35): '#2f467e'},
        'angry': {(25, 41): '#b36434', (25, 42): '#b36434', (26, 40): '#b36434', (36, 32): '#0f1330', (37, 29): '#4e2315', (37, 30): '#4e2315', (37, 40): '#b36434', (38, 33): '#2f467e', (38, 41): '#b36434', (38, 42): '#b36434', (39, 34): '#2f467e', (39, 35): '#f9c485'},
        'surprised': {(30, 45): '#f9c485', (31, 44): '#ec4e38', (32, 44): '#ec4e38', (32, 45): '#662f1a', (33, 44): '#662f1a'},
        'happy': {(28, 42): '#2e140f', (35, 41): '#2e140f', (35, 42): '#2e140f', (39, 34): '#1d0e0d'},
    },
}


def fix(key, name, im):
    im = im.copy(); px = im.load()
    for (x, y), hexc in {**FIXES.get(key, {}).get(name, {}), **FIXES.get(key + '-r2', {}).get(name, {})}.items():
        px[x, y] = (int(hexc[1:3], 16), int(hexc[3:5], 16), int(hexc[5:7], 16), 255)
    return im


def main(raw):
    raw = Path(raw)
    for key, (base, tries) in CANDS.items():
        bn = B.native(raw / f'professor-{base}.png'); b64, info = B.place(bn)
        names, ims, srcs = ['base'], [b64], [raw / f'professor-{base}.png']
        for e in EXPR:
            src = raw / f'professor-{base}-{e}-{tries.get(e, "t1")}.png'
            en = B.native(src)
            names.append(e); ims.append(B.place(B.face_only(bn, en), info['f'], fixed=(info['x0'], info['y0']))[0]); srcs.append(src)
        ims = B.shared_palette(ims)
        d = OUT / f'professor-{key}'; d.mkdir(parents=True, exist_ok=True)
        prov = {'source': 'char-gen command image engine, cast nat prompt (scripts/content/monsters/astra_professor_chargen/gen.py)', 'base': base, 'nativeGrid': list(bn.size), 'place': {k: float(v) for k, v in info.items()}, 'pictures': {}}
        for nm, im, src in zip(names, ims, srcs):
            im = fix(key, nm, im)
            im.save(d / f'bust-{nm}.png', optimize=True)
            prov['pictures'][f'bust-{nm}.png'] = {'source': src.name, 'sourceSha256': hashlib.sha256(src.read_bytes()).hexdigest(), 'pixelSha256': B.sha(im)}
        (d / 'provenance.json').write_text(json.dumps(prov, indent=1) + '\n')
        print(key, bn.size, info)


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/astra-qa/prof3/raw'))
