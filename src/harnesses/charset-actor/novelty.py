"""Opt-in duplicate shape admission for orders requesting distinct monsters."""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from functools import lru_cache
import hashlib
import json
from pathlib import Path

import chr as C
import harness as H

VERSION = 1


@lru_cache(maxsize=1024)
def _grid(path, size, modified):
    raw = Path(path).read_bytes()
    pal, _, frames = C.parse(raw.decode())
    _, frames = C._canonical_colors(pal, frames)
    flat = ''.join(row for d in C.DIRS for pose in range(3) for row in frames[d, pose])
    mask = int(''.join('0' if ch == '.' else '1' for ch in flat), 2)
    return dict(path=path, sha256=hashlib.sha256(raw).hexdigest(), flat=flat, mask=mask)


def grid(path):
    path = Path(path).resolve()
    stat = path.stat()
    return _grid(str(path), stat.st_size, stat.st_mtime_ns)


def compare(a, b):
    union = (a['mask'] | b['mask']).bit_count()
    overlap = (a['mask'] & b['mask']).bit_count() / union if union else 1.0
    if overlap < 0.84:
        return overlap, 1.0, False
    forward, backward, total = defaultdict(Counter), defaultdict(Counter), 0
    for x, y in zip(a['flat'], b['flat']):
        if x == y == '.':
            continue
        total += 1
        forward[x][y] += 1
        backward[y][x] += 1
    mapped = min(sum(max(c.values()) for c in forward.values()),
                 sum(max(c.values()) for c in backward.values())) / max(total, 1)
    change = 1.0 - mapped
    return overlap, change, overlap >= 0.94 or change <= 0.18


def configuration(root):
    root = H.run_dir(Path(root).name)
    manifest = json.loads((root / 'manifest.json').read_text())
    policy = manifest['noveltyPolicy']
    file = root / 'recipe' / 'novelty-references.json'
    raw = file.read_bytes()
    if policy['version'] != VERSION or hashlib.sha256(raw).hexdigest() != policy['referencesSha256']:
        raise ValueError('중복 검사 기준이 변경되었습니다')
    refs = []
    for row in json.loads(raw)['references']:
        item = grid(root / 'recipe' / row['file'])
        if item['sha256'] != row['sha256']:
            raise ValueError('중복 비교 원본이 변경되었습니다')
        refs.append(dict(item, id=row['id']))
    return policy, refs


def published_references(root, exclude):
    result = []
    for file in (H.DATA / 'runs').glob('*/manifest.json'):
        manifest = json.loads(file.read_text())
        if manifest.get('noveltyPolicy', {}).get('root') != Path(root).name:
            continue
        for folder in file.parent.glob('*__gpt-r1'):
            path = folder / 'out.chr.txt'
            if path.resolve() == Path(exclude).resolve() or not (folder / 'published.json').exists():
                continue
            result.append(dict(grid(path), id=file.parent.name + '/' + folder.name))
    return result


def inspect(path, root, extra=None):
    candidate = grid(path)
    policy, references = configuration(root)
    references += published_references(root, path) if extra is None else extra
    matches = []
    for ref in references:
        overlap, change, duplicate = compare(candidate, ref)
        if duplicate:
            matches.append(dict(id=ref['id'], path=ref['path'], alphaIoU=round(overlap, 4),
                                paletteIndependentChange=round(change, 4)))
    return dict(version=VERSION, sourceSha256=candidate['sha256'],
                referencesSha256=policy['referencesSha256'], eligible=not matches,
                matches=sorted(matches, key=lambda m: (-m['alphaIoU'], m['paletteIndependentChange']))[:5])


def filter_items(items):
    """Keep duplicates out of review without creating human choice receipts."""
    manifests = {}
    grouped, ordinary, blocked = defaultdict(list), [], defaultdict(int)
    for item in items:
        if item['run'] not in manifests:
            file = H.run_dir(item['run']) / 'manifest.json'
            manifests[item['run']] = json.loads(file.read_text()) if file.exists() else {}
        policy = manifests[item['run']].get('noveltyPolicy')
        if not policy:
            ordinary.append(item)
        elif item['status'] == 'done':
            grouped[policy['root']].append(item)
    for root, candidates in grouped.items():
        admitted = []
        # Published first stays first, including candidates already shown to the user.
        candidates.sort(key=lambda i: ((H.run_dir(i['run']) / i['dir'] / 'published.json').stat().st_mtime_ns, i['id']))
        for item in candidates:
            folder = H.run_dir(item['run']) / item['dir']
            report = inspect(folder / 'out.chr.txt', root, admitted)
            H.write_json_atomic(folder / 'novelty.json', report)
            if report['eligible']:
                ordinary.append(item)
                admitted.append(dict(grid(folder / 'out.chr.txt'), id=item['id']))
            else:
                blocked[item['run']] += 1
    return ordinary, dict(blocked)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['check'])
    parser.add_argument('path', type=Path)
    parser.add_argument('--root', required=True)
    args = parser.parse_args()
    report = inspect(args.path, args.root)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    raise SystemExit(0 if report['eligible'] else 1)
