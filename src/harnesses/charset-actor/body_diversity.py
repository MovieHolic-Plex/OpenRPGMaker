"""Review admission also compares centered silhouettes of the four idle views."""
from collections import defaultdict
from functools import lru_cache
import json

import harness as H
import novelty as N


@lru_cache(maxsize=1024)
def idle_mask(flat):
    result = 0
    for direction in range(4):
        frame = flat[direction * 2304 + 768:direction * 2304 + 1536]
        points = [(i % 24, i // 24) for i, ch in enumerate(frame) if ch != '.']
        if not points:
            continue
        x0, y0 = min(p[0] for p in points), min(p[1] for p in points)
        width = max(p[0] for p in points) - x0 + 1
        height = max(p[1] for p in points) - y0 + 1
        dx, dy = (24 - width) // 2 - x0, (32 - height) // 2 - y0
        for x, y in points:
            result |= 1 << (direction * 768 + (y + dy) * 24 + x + dx)
    return result


def inspect(path, refs, policy):
    candidate = N.grid(path)
    mask = idle_mask(candidate['flat'])
    matches = []
    for ref in refs:
        other = idle_mask(ref['flat'])
        union = (mask | other).bit_count()
        overlap = (mask & other).bit_count() / max(union, 1)
        alpha, change, repeated = N.compare(candidate, ref)
        if overlap >= 0.90 or repeated:
            matches.append(dict(id=ref['id'], path=ref['path'], centeredIdleIoU=round(overlap, 4),
                                alphaIoU=round(alpha, 4), paletteIndependentChange=round(change, 4)))
    return dict(version=N.VERSION, bodyAdmissionVersion=1, sourceSha256=candidate['sha256'],
                referencesSha256=policy['referencesSha256'], eligible=not matches,
                matches=sorted(matches, key=lambda m: (-m['centeredIdleIoU'], -m['alphaIoU']))[:5])


def filter_items(items):
    manifests, grouped, ordinary, blocked = {}, defaultdict(list), [], defaultdict(int)
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
        policy, refs = N.configuration(root)
        candidates.sort(key=lambda i: ((H.run_dir(i['run']) / i['dir'] / 'published.json').stat().st_mtime_ns, i['id']))
        for item in candidates:
            folder = H.run_dir(item['run']) / item['dir']
            report = inspect(folder / 'out.chr.txt', refs, policy)
            H.write_json_atomic(folder / 'novelty.json', report)
            if report['eligible']:
                ordinary.append(item)
                refs.append(dict(N.grid(folder / 'out.chr.txt'), id=item['id']))
            else:
                blocked[item['run']] += 1
    return ordinary, dict(blocked)
