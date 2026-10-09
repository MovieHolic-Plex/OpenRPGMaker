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
    candidates, coverage, declared = {}, {}, []
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
                declared.append((rid, refs, usable))
    for rid, refs in scene_links(folder, result, declared).items():
        known = {r['sha256'] for r in coverage.get(rid, [])}
        coverage[rid] = coverage.get(rid, []) + [r for r in refs if r['sha256'] not in known]
    merged = dict(result, candidates=list(candidates.values()), themeCoverage=coverage)
    write(folder / 'art-result.json', merged)
    return merged


def scene_links(folder, result, declared):
    """The current preparation's coverage links, if receipt-backed and scene-bound.

    Collectors declare coverage only for their own execution and the newest batch
    wins, so links to parts the scene still uses (e.g. a preserved north shelf)
    were dropped, and the preparation that re-declared them was overwritten by the
    collection result. Older batches are not unioned: the layout also binds
    superseded versions for comparison.
    """
    try:
        layout = art_choices.read(folder / 'art-layout-input.json')['layout']
        execution = art_choices.read(folder / 'art-execution.json')
        prep = art_choices.read(folder / 'art-prepare-result.json')
    except (OSError, ValueError, KeyError, TypeError):
        return {}
    if any((prep.get('theme') or {}).get(k) != (result.get('theme') or {}).get(k) for k in ('policyHash', 'briefSha256')):
        return {}
    if (prep.get('execution') or {}).get('layout') != execution.get('layout'):
        return {}
    bound = {(r['path'], r['sha256']) for r in layout.get('sources', [])}
    usable = set().union(*(u for _, _, u in declared)) if declared else set()
    links = {}
    for rid, refs in (prep.get('themeCoverage') or {}).items():
        for r in refs if isinstance(refs, list) else []:
            key = (r.get('path'), r.get('sha256')) if isinstance(r, dict) else None
            if key in bound and key in usable:
                links.setdefault(rid, []).append({'path': key[0], 'sha256': key[1]})
    return links


def queue_missing(data, cid, result, components):
    """Missing initial materials are production, not another quality rejection.

    One follow-up is allowed per actual coverage state. If another batch adds
    no required material, stop with its concrete missing IDs instead of looping.
    """
    status = theme_production.coverage_status(cid, result, components)
    if status is None: return None
    folder = Path(data) / 'concepts' / cid
    path = folder / 'theme-material-progress.json'
    state = art_choices.read(path) if path.is_file() else {'states': []}
    signature = hashlib.sha256(json.dumps(status['covered'], sort_keys=True).encode()).hexdigest()
    repeated = bool(status['missing']) and signature in state['states']
    if signature not in state['states']: state['states'].append(signature)
    state.update(missing=status['missing'], covered=status['covered'], repeated=repeated)
    write(path, state)
    write(folder / 'theme-material-feedback.json', {
        'kind': 'missing-production' if status['missing'] else 'production-collected',
        'missing': status['missing'], 'covered': status['covered'],
        'batches': str(folder / 'art-batches'), 'preserveExisting': True,
        'instruction': ('이미 제작된 원본·영수증을 보존하고 누락 재료만 별도 격리 묶음으로 제작한다. '
                        '기존 그림 재제작이나 요구사항 삭제로 대체하지 않는다.' if status['missing'] else
                        '모든 재료 ID에 원본이 수집됐다. 이전 누락 제작 지시는 완료됐다. '
                        '품질 합격을 뜻하지 않으며 실제 공간 데모·독립 검수 및 구체 반려 항목의 수정을 이어간다. '
                        '원본·영수증을 보존하고 이미 수집된 재료를 미제작으로 다시 주문하지 않는다.'),
    })
    return state if status['missing'] else None
