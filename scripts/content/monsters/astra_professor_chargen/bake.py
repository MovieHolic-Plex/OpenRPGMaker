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
            im.save(d / f'bust-{nm}.png', optimize=True)
            prov['pictures'][f'bust-{nm}.png'] = {'source': src.name, 'sourceSha256': hashlib.sha256(src.read_bytes()).hexdigest(), 'pixelSha256': B.sha(im)}
        (d / 'provenance.json').write_text(json.dumps(prov, indent=1) + '\n')
        print(key, bn.size, info)


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/astra-qa/prof3/raw'))
