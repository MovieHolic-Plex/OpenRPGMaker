"""Bake explicitly authored palette rows into a native casting bundle.

No source sprite is read, cropped, mirrored, traced, rescaled or recolored.
The existing screenshot is used only as the separate scale-comparison backdrop.
"""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[4]
DIRECTIONS = ('up', 'right', 'down', 'left')
POSES = ('stepA', 'idle', 'stepB')

def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--candidate', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    source = json.loads(args.source.read_text())
    meta = json.loads(args.candidate.read_text())
    assert (source['width'], source['height']) == (16, 32)
    assert source['maxColors'] <= 15
    palette = {'.': (0, 0, 0, 0)}
    for key, color in source['palette'].items():
        assert len(key) == 1 and key != '.' and len(color) == 7 and color[0] == '#'
        palette[key] = tuple(bytes.fromhex(color[1:])) + (255,)
    frames = {}
    for frame in source['frames']:
        name = frame['id']
        assert name not in frames
        rows = frame['rows']
        assert len(rows) == 32 and all(len(row) == 16 for row in rows), name
        image = Image.new('RGBA', (16, 32))
        image.putdata([palette[key] for row in rows for key in row])
        frames[name] = image
    expected = [d + '_' + p for d in DIRECTIONS for p in POSES]
    assert set(frames) == set(expected), 'Write all twelve named poses explicitly.'
    atlas = Image.new('RGBA', (48, 128))
    for row, direction in enumerate(DIRECTIONS):
        for col, pose in enumerate(POSES):
            atlas.paste(frames[direction + '_' + pose], (col * 16, row * 32))
    opaque = sorted({p[:3] for p in atlas.get_flattened_data() if p[3]})
    assert len(opaque) <= 15
    args.out.mkdir(parents=True, exist_ok=True)
    atlas.save(args.out / 'charset.png')
    lookup = {color: i + 1 for i, color in enumerate(opaque)}
    gif_palette = [0, 0, 0] + [v for color in opaque for v in color]
    gif_palette += [0] * (768 - len(gif_palette))
    gif_frames = []
    for pose in ('stepA', 'idle', 'stepB', 'idle'):
        image = Image.new('RGBA', (68, 32))
        for col, direction in enumerate(DIRECTIONS):
            image.paste(frames[direction + '_' + pose], (col * 17, 0))
        indexed = Image.new('P', image.size)
        indexed.putpalette(gif_palette)
        indexed.putdata([lookup[p[:3]] if p[3] else 0 for p in image.get_flattened_data()])
        gif_frames.append(indexed)
    gif_frames[0].save(args.out / 'walk.gif', save_all=True,
                      append_images=gif_frames[1:], duration=130, loop=0,
                      transparency=0, disposal=2, optimize=False)
    background = ROOT / 'verify-shots/pokemon-hero-reference-fidelity/runtime-walking.png'
    context = Image.open(background).convert('RGBA').resize((480, 360), Image.Resampling.NEAREST)
    context.alpha_composite(frames['down_idle'].resize((32, 64), Image.Resampling.NEAREST), (235, 252))
    context.save(args.out / 'context.png')
    (args.out / 'candidate.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2) + '\n')
    recipe = {
        'method': 'explicit-palette-row-authoring',
        'author': 'Codex (GPT-6), model-authored pixel rows; not a human artist claim',
        'sourceSha256': sha(args.source),
        'sourceFile': args.source.name,
        'sourceGrid': source,
        'rendererSha256': sha(__file__),
        'copiedOriginalPixels': False,
        'resizingAuthoredPixels': False,
        'automaticMirroring': False,
        'automaticPoseGeneration': False,
        'referenceUse': 'Visual study of Emerald proportions, face clusters and walk timing only. No original sprite input in renderer.',
        'referenceManifestSha256': sha(Path(__file__).parent.parent / 'references/sources.json'),
        'referenceUrls': ['https://github.com/pret/pokeemerald/tree/master/graphics/object_events/pics/people'],
        'walk': {'directions': DIRECTIONS, 'poses': POSES, 'cycle': [0, 1, 2, 1], 'frameMs': 130},
        'scope': 'New walking candidate. Scale placement is a mockup. Human Allow still required.'
    }
    (args.out / 'recipe.json').write_text(json.dumps(recipe, ensure_ascii=False, indent=2) + '\n')
    (args.out / 'origin.txt').write_text(meta['sourceNote'] + '\nExplicit 16x32 palette rows authored by Codex GPT-6. Twelve independently specified poses; Python only renders and packs the rows. Full source grid is embedded in recipe.json. Emerald originals observed for proportion and timing, not used as input pixels.\n')
    print(json.dumps({'bundle': str(args.out.resolve()), 'sourceSha256': sha(args.source), 'opaqueColors': len(opaque), 'poses': len(frames)}))

if __name__ == '__main__':
    main()
