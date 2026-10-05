"""Plan distinct source pixels before starting artists; never judge their outputs."""
from __future__ import annotations

import hashlib
from pathlib import Path

import chr as C


def inspect_sources(root, recipe):
    sources = []
    for seed in recipe['seeds']:
        pal, _, frames = C.load(Path(root) / seed['folder'] / 'out.chr.txt')
        rgba = C.sheet_rgba(pal, frames)
        mask = int.from_bytes(rgba.getchannel('A').tobytes(), 'big')
        sources.append(dict(seed=seed['index'], pixels=hashlib.sha256(rgba.tobytes()).hexdigest(), mask=mask))
    return sources


def validate(manifest, root, recipe):
    """Reject silent source cycling and duplicate RGBA inputs, including aliases."""
    sources = inspect_sources(root, recipe)
    unique = len({s['pixels'] for s in sources})
    chosen = [sources[row['seed']] for row in manifest['characters']]
    if len({s['pixels'] for s in chosen}) != len(chosen):
        raise ValueError(f'서로 다른 원본은 {unique}종입니다. 같은 원본을 반복하지 않으려면 개수를 줄이거나 다른 원본을 추가하세요.')
    manifest['diversityPlan'] = dict(mode='distinct-source-pixels', planned=len(chosen),
                                     available=unique, seeds=[s['seed'] for s in chosen],
                                     pixelHashes=[s['pixels'] for s in chosen])


def spread_catalog(manifest, root, recipe):
    """Choose unused catalog sources whose silhouettes differ from those selected."""
    sources = inspect_sources(root, recipe)
    remaining = []
    seen = set()
    for source in sources:
        if source['pixels'] not in seen:
            seen.add(source['pixels'])
            remaining.append(source)
    count = len(manifest['characters'])
    if count > len(remaining):
        raise ValueError(f'서로 다른 원본은 {len(remaining)}종입니다. 같은 원본을 반복하지 않으려면 개수를 줄이거나 다른 원본을 추가하세요.')
    selected = []
    nearest = {s['seed']: 0.0 for s in remaining}
    while len(selected) < count:
        candidate = min(remaining, key=lambda s: (nearest[s['seed']], s['seed']))
        remaining.remove(candidate)
        selected.append(candidate)
        for source in remaining:
            union = (source['mask'] | candidate['mask']).bit_count()
            overlap = (source['mask'] & candidate['mask']).bit_count() / union if union else 1.0
            nearest[source['seed']] = max(nearest[source['seed']], overlap)
    for row, source in zip(manifest['characters'], selected):
        seed = recipe['seeds'][source['seed']]
        row.update(seed=seed['index'], base=seed['base'], authoringMode=seed['authoringMode'],
                   animalProfile=seed.get('animalProfile'))
    validate(manifest, root, recipe)
    manifest['diversityPlan']['ordering'] = 'least-silhouette-overlap-first'
