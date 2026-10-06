"""Accumulate independently executed batches before assembling a dedicated set."""
import hashlib
import json
from pathlib import Path
import time

import art_choices
import theme_production


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix('.tmp')
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2))
    tmp.replace(path)


def collect(data, cid, result):
    """Called only after the current execution and candidate refs were verified.

    Older batches retain their receipts; a new batch cannot claim their images
    as its own execution. Changed/missing old evidence is not carried forward.
    """
    if not theme_production.policy(cid): return result
    theme_production.require_binding(cid, result)
    import theme_actors
    actors = theme_actors.collect(data, cid)
    if actors:
        theme_production.require_binding(cid, {'theme': actors['theme']})
        result = dict(result, candidates=[*result['candidates'], actors['batch']],
                      themeCoverage={**result.get('themeCoverage', {}), **actors['coverage']})
    folder = Path(data) / 'concepts' / cid
    root = Path(data) / 'art-worktrees' / cid
    archive = folder / 'art-batches'
    key = hashlib.sha256(json.dumps(result, sort_keys=True).encode()).hexdigest()
    if not list(archive.glob('*-' + key + '.json')):
        write(archive / (str(time.time_ns()) + '-' + key + '.json'), {
            'result': result,
            'execution': art_choices.read(folder / 'art-execution.json'),
            'layoutInput': art_choices.read(folder / 'art-layout-input.json'),
            'layoutReview': art_choices.read(folder / 'art-layout-review.json'),
        })
    candidates, coverage = {}, {}
    for path in sorted(archive.glob('*.json')):
        previous = art_choices.read(path)['result']
        if any((previous.get('theme') or {}).get(k) != result['theme'].get(k)
               for k in ('policyHash', 'briefSha256')): continue
        usable = {(r['path'], r['sha256']) for r in theme_production.policy(cid).get('reuseExceptions', [])}
        for batch in previous.get('candidates', []):
            try:
                for ref in [batch['receipt'], *batch['images']]:
                    art_choices.verified(root, ref)
                receipt = batch['receipt']['path']
                native = art_choices.read(root / receipt)
                refs = {(r['path'], r['sha256']) for r in batch['images']}
                refs.update((r['path'], r['sha256']) for r in native.get('candidateImages', []))
                # Later versions of the same receipt supersede its old content.
                candidates.pop(receipt, None)
                candidates[receipt] = batch
                usable.update(refs)
            except (OSError, ValueError, KeyError, TypeError):
                continue
        for rid, refs in previous.get('themeCoverage', {}).items():
            if isinstance(refs, list) and refs and all(
                isinstance(r, dict) and (r.get('path'), r.get('sha256')) in usable for r in refs
            ):
                coverage[rid] = refs
    merged = dict(result, candidates=list(candidates.values()), themeCoverage=coverage)
    write(folder / 'art-result.json', merged)
    return merged


def queue_missing(data, cid, result, components):
    """Missing initial materials are production, not another quality rejection.

    One follow-up is allowed per actual coverage state. If another batch adds
    no required material, stop with its concrete missing IDs instead of looping.
    """
    status = theme_production.coverage_status(cid, result, components)
    if status is None or not status['missing']: return None
    folder = Path(data) / 'concepts' / cid
    path = folder / 'theme-material-progress.json'
    state = art_choices.read(path) if path.is_file() else {'states': []}
    signature = hashlib.sha256(json.dumps(status['covered'], sort_keys=True).encode()).hexdigest()
    repeated = signature in state['states']
    if not repeated: state['states'].append(signature)
    state.update(missing=status['missing'], covered=status['covered'], repeated=repeated)
    write(path, state)
    write(folder / 'theme-material-feedback.json', {
        'kind': 'missing-production', 'missing': status['missing'], 'covered': status['covered'],
        'batches': str(folder / 'art-batches'), 'preserveExisting': True,
        'instruction': '이미 제작된 원본·영수증을 보존하고 누락 재료만 별도 격리 묶음으로 제작한다. '
                       '기존 그림 재제작이나 요구사항 삭제로 대체하지 않는다.',
    })
    return state
