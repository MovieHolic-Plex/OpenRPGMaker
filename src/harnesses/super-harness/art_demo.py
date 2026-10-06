"""Required whole-space demos made only by placing hash-bound existing pixels."""
from pathlib import Path
import json
from PIL import Image
import art_choices as choices
import store


def write(path, value):
    path = Path(path); path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix('.tmp'); tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2)); tmp.replace(path)


def required(data, cid):
    folder = Path(data) / 'concepts' / cid
    path = folder / 'art-choices.json'
    if not path.exists(): return False
    manifest = choices.read(path)
    if manifest.get('demoVersion') == 1: return False
    return bool(manifest.get('groups')) and not any(c.get('phase') == 'calibration' for g in manifest['groups'] for c in g['candidates'])


def added_action_frames(root, layout):
    """Bind newly commissioned poses to the approved order, not a worker claim."""
    delivery = layout.get('actorActionDelivery')
    if not delivery: return {}
    manifest = choices.read(choices.verified(root, delivery['manifest']))
    approved = {r['path']: r for r in layout['sources']}
    frames = {}
    for order in manifest['orders']:
        path = Path(order['request']).resolve()
        relative = str(path.relative_to(Path(root).resolve()))
        request = choices.read(choices.verified(root, approved[relative]))
        previous = set(request.get('preserveActions', {}).get('frames', []))
        if not previous: raise ValueError('추가 행동 주문에 보존 프레임 목록이 필요합니다.')
        added = {f"{pose['id']}-{index}" for pose in request['poses']
                 for index in range(pose['frames'])} - previous
        if not added: raise ValueError('추가 행동 주문에 새 프레임이 없습니다.')
        frames['actor:' + order['actor']] = added
    return frames


def component_requirements(data, cid, manifest, layout, result):
    """Retire a replaced component only through the approved scene specification.

    Keeping an old source for audit does not require placing a second obsolete
    door in the room. Both sides must belong to the same planned material.
    """
    groups = {g['id']: g for g in manifest['groups']}
    replacements = layout.get('layout', {}).get('componentReplacements', [])
    if not replacements: return list(groups), {}
    import art_layout
    folder = Path(data) / 'concepts' / cid
    review = choices.read(folder / 'art-layout-review.json')
    if review.get('verdict') != 'PASS' or review.get('fingerprint') != layout.get('fingerprint'):
        raise ValueError('부품 교체 명세를 포함한 현재 도면의 독립 승인이 필요합니다.')
    art_layout.require_completed(Path(data) / 'art-worktrees' / cid,
        choices.read(folder / 'art-execution.json'), layout)
    retired = {}
    archive = Path(data) / 'concepts' / cid / 'art-batches'
    previous = [choices.read(p)['result'] for p in archive.glob('*.json')]
    for replacement in replacements:
        old, new, requirement = (replacement[k] for k in ('from', 'to', 'requirement'))
        # Repeating the exact declaration does not retire a second component.
        # Conflicting targets still fail below; provenance is checked on its first occurrence.
        if old in retired and retired[old] == replacement:
            continue
        if (old not in groups or new not in groups or old == new or old in retired
                or len(str(replacement.get('reason', '')).strip()) < 12
                or any(c.get('nativeHarness') == 'charset-actor'
                       for gid in (old, new) for c in groups[gid]['candidates'])):
            raise ValueError('부품 교체 명세 오류: ' + str(old) + ' → ' + str(new) + ' (' + str(requirement) + ') — 누락·상충·자기참조·사유·배우 교체 확인 필요')
        old_hashes = {c['sheet']['sha256'] for c in groups[old]['candidates']}
        new_hashes = {c['sheet']['sha256'] for c in groups[new]['candidates']}
        current_refs = result.get('themeCoverage', {}).get(requirement, [])
        prior_refs = [ref for batch in previous if all((batch.get('theme') or {}).get(k)
                      == (result.get('theme') or {}).get(k) for k in ('policyHash', 'briefSha256'))
                      for ref in batch.get('themeCoverage', {}).get(requirement, [])]
        if (not old_hashes.intersection(ref['sha256'] for ref in prior_refs)
                or not new_hashes.intersection(ref['sha256'] for ref in current_refs)):
            raise ValueError('교체 전후 부품이 같은 기획 재료에 연결되지 않았습니다: '+requirement)
        retired[old] = dict(replacement)
    if any(r['to'] in retired for r in retired.values()):
        raise ValueError('교체 부품이 다시 폐기되는 연쇄/순환 명세는 허용하지 않습니다.')
    return [gid for gid in groups if gid not in retired], retired


def preserved_sources(data, cid, layout, result):
    """Carry only explicitly approved, receipt-backed parts of a superseded sheet."""
    preserved = layout.get('layout', {}).get('preservedSources', [])
    if not preserved: return []
    import art_layout
    folder = Path(data) / 'concepts' / cid
    root = Path(data) / 'art-worktrees' / cid
    art_layout.require_completed(root, choices.read(folder / 'art-execution.json'), layout)
    return validate_preserved_sources(data, cid, layout, result)


def validate_preserved_sources(data, cid, layout, result):
    """Check receipt links before review; this does not grant layout approval."""
    preserved = layout.get('layout', {}).get('preservedSources', [])
    if not preserved: return []
    folder = Path(data) / 'concepts' / cid
    root = Path(data) / 'art-worktrees' / cid
    bound = {(r['path'], r['sha256']) for r in layout['layout']['sources']}
    evidence = set()
    for path in (folder / 'art-batches').glob('*.json'):
        previous = choices.read(path)['result']
        if any((previous.get('theme') or {}).get(k) != (result.get('theme') or {}).get(k)
               for k in ('policyHash', 'briefSha256')): continue
        native_refs = set()
        for batch in previous.get('candidates', []):
            try:
                receipt = choices.read(choices.verified(root, batch['receipt']))
                native_refs.update((r['path'], r['sha256']) for r in receipt.get('candidateImages', []))
            except (OSError, ValueError, KeyError, TypeError):
                continue
        for requirement, refs in previous.get('themeCoverage', {}).items():
            for ref in refs:
                key = (ref['path'], ref['sha256'])
                if key in native_refs: evidence.add((requirement, *key))
    for ref in preserved:
        key = (ref['path'], ref['sha256'])
        missing = []
        if key not in bound: missing.append('현재 도면 sources의 경로/해시')
        if (ref.get('requirement'), *key) not in evidence:
            missing.append('동일 테마 batch의 재료 ' + str(ref.get('requirement')) + ' 원본 영수증')
        if not ref['path'].lower().endswith('.png'): missing.append('PNG 원본')
        if len(str(ref.get('reason', '')).strip()) < 12: missing.append('구체적인 보존 사유')
        if missing:
            raise ValueError('보존 부품 근거 누락: ' + ref['path'] + ' — ' + '; '.join(missing))
        choices.verified(root, ref)
    return preserved


def prepare(data, cid):
    folder = Path(data) / 'concepts' / cid
    root = Path(data) / 'art-worktrees' / cid
    manifest = choices.read(folder / 'art-choices.json')
    generation = choices.digest(folder / 'art-result.json')
    if manifest.get('artResultSha256') != generation: raise ValueError('현재 후보 묶음으로 데모를 준비해야 합니다.')
    if manifest.get('demoVersion'): raise ValueError('현재 데모는 이미 조립되어 있습니다.')
    for g in manifest['groups']:
        for c in g['candidates']:
            for ref in c['sources'] + [c['sheet']]: choices.verified(root, ref)
            for recovery in c.get('nativeReviewRecoveries', []): choices.art_native_rereview.verify(data, cid, recovery)
    import theme_production
    theme_sources=theme_production.demo_sources(cid,choices.read(folder/'art-result.json'),manifest)
    inputs = dict(version=1, root=str(root), generation=generation, components=manifest,
                  selections=choices.selections(cid), title=store.concept(cid)['title'])
    layout = folder / 'art-layout-input.json'
    inputs['layout'] = choices.read(layout) if layout.exists() else {}
    inputs['requiredGroups'], inputs['retiredComponents'] = component_requirements(
        data, cid, manifest, inputs['layout'], choices.read(folder / 'art-result.json'))
    inputs['preservedSources'] = preserved_sources(data, cid, inputs['layout'], choices.read(folder / 'art-result.json'))
    if theme_sources is not None: theme_sources.update(r['sha256'] for r in inputs['preservedSources'])
    inputs['themeAllowedSources']=sorted(theme_sources) if theme_sources is not None else None
    inputs['planningPath'] = str(folder / 'planning.json')
    inputs['outputDirectory'] = 'art-output/space-demos/' + generation[:16]
    inputs['fingerprint'] = choices.fingerprint(inputs)
    write(folder / 'art-demo-input.json', inputs)
    write(folder / 'art-demo-history' / generation / 'components.json', manifest)
    return inputs


def compose(root, recipe, dest, required_images):
    """No drawing API: transparent canvas + unscaled crops of actual source tiles."""
    if not isinstance(recipe, dict): raise ValueError('데모 배치표 객체 필요')
    size = recipe.get('canvas', [])
    if len(size) != 2 or any(type(n) is not int or n < 64 or n > 2048 or n % 16 for n in size):
        raise ValueError('데모 캔버스는 16px 단위 64~2048px여야 합니다.')
    sources = recipe.get('sources', [])
    if not sources or len(sources) > 256: raise ValueError('데모 원본 그림 목록 필요')
    images = []
    for ref in sources:
        path = choices.verified(root, ref)
        with Image.open(path) as im: images.append(im.convert('RGBA'))
    ops = recipe.get('placements', [])
    if not ops or len(ops) > 60000: raise ValueError('실제 타일 배치 목록 필요')
    scene = Image.new('RGBA', size)
    used = set()
    for op in ops:
        index, rect, xy = op.get('source'), op.get('rect', []), op.get('at', [])
        if type(index) is not int or not 0 <= index < len(images) or len(rect) != 4 or len(xy) != 2 or any(type(n) is not int for n in rect + xy):
            raise ValueError('타일 배치 좌표 형식 오류')
        x,y,w,h = rect; dx,dy = xy; im = images[index]
        if min(x,y,dx,dy) < 0 or min(w,h) <= 0 or x+w > im.width or y+h > im.height or dx+w > size[0] or dy+h > size[1]:
            raise ValueError('데모 배치가 원본 또는 장면 밖으로 잘립니다.')
        crop = im.crop((x,y,x+w,y+h))
        if crop.getbbox(): used.add(sources[index]['sha256'])
        scene.alpha_composite(crop, (dx,dy))
    if any(not (options & used) for options in required_images): raise ValueError('데모에서 빠진 필수 후보 타일이 있습니다.')
    if not scene.getbbox(): raise ValueError('빈 데모는 제출할 수 없습니다.')
    dest.parent.mkdir(parents=True, exist_ok=True); scene.save(dest)
    return sources


def accept(data, cid, result):
    folder = Path(data) / 'concepts' / cid; root = Path(data) / 'art-worktrees' / cid
    inputs = choices.read(folder / 'art-demo-input.json')
    if not isinstance(result, dict) or result.get('fingerprint') != inputs['fingerprint']:
        raise ValueError('현재 데모 입력 해시가 필요합니다.')
    if choices.digest(folder / 'art-result.json') != inputs['generation']:
        raise ValueError('데모 제작 도중 타일 묶음이 변경되었습니다.')
    # A worker cannot silently replace the source manifest or select on the user's behalf.
    if choices.read(folder / 'art-choices.json') != inputs['components']:
        raise ValueError('데모 제작 도중 원본 후보 목록이 변경되었습니다.')
    demos = result.get('demos', [])
    if not isinstance(demos, list) or not 1 <= len(demos) <= 3: raise ValueError('공간 전체 데모 1~3개가 필요합니다.')
    import theme_production
    theme_sources=theme_production.demo_sources(cid,choices.read(folder/'art-result.json'),inputs['components'])
    originals = {g['id']: {c['id']: c for c in g['candidates']} for g in inputs['components']['groups']}
    required_groups, retired = component_requirements(data, cid, inputs['components'],
        inputs.get('layout', {}), choices.read(folder / 'art-result.json'))
    if (inputs.get('requiredGroups', list(originals)) != required_groups
            or inputs.get('retiredComponents', {}) != retired):
        raise ValueError('부품 교체의 승인 입력이 변경되었습니다.')
    preserved = preserved_sources(data, cid, inputs.get('layout', {}), choices.read(folder / 'art-result.json'))
    if inputs.get('preservedSources', []) != preserved:
        raise ValueError('보존 부품의 승인 입력이 변경되었습니다.')
    if theme_sources is not None: theme_sources.update(r['sha256'] for r in preserved)
    candidates = []
    for number, demo in enumerate(demos, 1):
        if not isinstance(demo, dict): raise ValueError('데모 객체 필요')
        components = demo.get('components', {})
        if not isinstance(components, dict): raise ValueError('데모 품목 목록 필요')
        if set(components) != set(required_groups): raise ValueError('현재 승인된 모든 필수 품목을 포함한 데모가 필요합니다.')
        selected = [originals[g][c] for g,c in components.items()]
        import re
        required_images = [{c['sheet']['sha256']} | {r['sha256'] for r in c.get('nativeSheets', [])} | {r['sha256'] for r in c['sources']
            if re.search(r'/h[0-9]+-[A-Z]\.png$', r['path'])} for c in selected]
        required_images.extend({r['sha256']} for r in preserved)
        refs = [r for c in selected for r in c['sources'] + [c['sheet']]] + preserved
        for ref in refs: choices.verified(root, ref)
        recipes = demo.get('recipes', [])
        if not 1 <= len(recipes) <= 4: raise ValueError('전체 공간 및 필요한 문 상태의 조립 배치표가 필요합니다.')
        previews = []
        actor_uses = {c['nativeSheets'][1]['sha256']: set() for c in selected
                      if c.get('nativeHarness') == 'charset-actor'}
        new_actions = added_action_frames(root, inputs.get('layout', {}).get('layout', {}))
        for gid, candidate_id in components.items():
            candidate = originals[gid][candidate_id]
            added = candidate.get('actorFrames', {}).get('requiredNewActionFrames', [])
            # Older prepared manifests predate requiredNewActionFrames. Their
            # already-bound native request remains authoritative after a reload.
            if candidate.get('nativeHarness') == 'charset-actor':
                request_path = str(Path(candidate['nativeSheets'][1]['path']).parent.parent / 'request.json')
                request_ref = next((r for r in candidate['sources'] if r['path'] == request_path), None)
                if request_ref:
                    order = choices.read(choices.verified(root, request_ref))
                    previous = set(order.get('preserveActions', {}).get('frames', []))
                    if previous:
                        added = [f['id'] for f in candidate['actorFrames']['actions'] if f['id'] not in previous]
            if added: new_actions.setdefault(gid, set()).update(added)
        new_action_uses = {gid: set() for gid in new_actions}
        for index, recipe_ref in enumerate(recipes):
            path = choices.verified(root, recipe_ref); recipe = choices.read(path)
            # New pixels, flattened context screenshots, and swapped candidates are not source tiles.
            allowed = {r['sha256'] for r in refs}
            allowed.update(r['sha256'] for r in inputs.get('layout', {}).get('layout', {}).get('sources', [])
                           if str(r.get('path', '')).lower().endswith('.png'))
            # Legacy spaces have no layout input. Only checked-in atlases can supplement their candidates.
            for ref in recipe.get('sources', []):
                if theme_sources is not None and ref['sha256'] not in theme_sources:
                    raise ValueError('테마 전용 세트에서 승인하지 않은 기존 그림은 조립에 사용할 수 없습니다: '+ref['path'])
                if ref['sha256'] not in allowed:
                    source = choices.verified(root, ref)
                    import subprocess
                    tracked = subprocess.run(['git','ls-files','--error-unmatch','--',str(source.relative_to(root))],cwd=root,capture_output=True)
                    pristine = subprocess.run(['git','diff','HEAD','--exit-code','--',str(source.relative_to(root))],cwd=root,capture_output=True)
                    if tracked.returncode or pristine.returncode or not str(source.relative_to(root)).startswith(('assets/','public/assets/')):
                        raise ValueError('데모는 실제 후보와 검증된 기존 아틀라스만 사용할 수 있습니다.')
            dest = root / inputs['outputDirectory'] / f'demo-{number}-{index}.png'
            refs.extend(compose(root, recipe, dest, required_images)); refs.append(recipe_ref)
            # Walking alone cannot demonstrate the commissioned actor action.
            # Require a complete frame crop, not one token pixel from its sheet.
            for c in selected:
                if c.get('nativeHarness') != 'charset-actor': continue
                walking, action = c['nativeSheets']
                frames = c['actorFrames']
                for op in recipe['placements']:
                    source = recipe['sources'][op['source']]['sha256']
                    rect = op['rect']
                    if (source == walking['sha256'] and rect[2:] == frames['walkSize']
                            and rect[0] % frames['walkSize'][0] == 0 and rect[1] % frames['walkSize'][1] == 0):
                        actor_uses[action['sha256']].add('walk')
                    if source == action['sha256'] and any(rect == f['rect'] for f in frames['actions']):
                        actor_uses[action['sha256']].add('action')
                        for gid, candidate_id in components.items():
                            if originals[gid][candidate_id] is c and gid in new_actions:
                                new_action_uses[gid].update(f['id'] for f in frames['actions']
                                    if rect == f['rect'] and f['id'] in new_actions[gid])
            previews.append(choices.ref(root, dest, recipe.get('label') or '실제 타일 공간 데모'))
        if any(uses != {'walk', 'action'} for uses in actor_uses.values()):
            raise ValueError('전용 인물마다 걷기/정지와 행동을 실제 공간의 별도 상태로 보여야 합니다. 전체 프레임 원본을 사용하세요.')
        if any(len(new_action_uses[gid]) < min(2, len(frames)) for gid, frames in new_actions.items()):
            raise ValueError('새로 주문한 행동의 서로 다른 프레임을 공간에서 보여야 합니다. 기존 행동만 배치하면 추가 동작 검수를 할 수 없습니다.')
        recoveries = [r for c in selected for r in c.get('nativeReviewRecoveries', [])]
        for recovery in recoveries: choices.art_native_rereview.verify(data, cid, recovery)
        passed = all(c['passed'] for c in selected)
        candidates.append(dict(id=f'demo-{number}', title=demo.get('title') or f'공간 데모 {number}',
            passed=passed, nativeReviewRecoveries=recoveries, summary='데모 조립 완료 · 독립 검수 대기',
            reasons=[str(r) for c in selected if not c['passed'] for r in c['reasons']],
            repairFixes=[f for c in selected for f in c.get('repairFixes', [])],
            sources=list({r['path']:r for r in refs}.values()), images=previews, sheet=previews[0],
            components=components, retiredComponents=retired, generation=inputs['generation'], phase='scene',
            caution='실제 타일을 조립한 공간 데모입니다. 플레이·프로젝트 설치 완료를 뜻하지 않습니다.'))
    manifest = dict(inputs['components'], demoVersion=1, groups=[dict(id='space-demo', title=inputs['title']+' · 공간 데모',
        description='이 타일로 만든 공간 전체를 보고 평가해 주세요.', requiresContextReview=True, candidates=candidates)])
    write(folder / 'art-demo-history' / inputs['generation'] / 'manifest.json', manifest)
    write(folder / 'art-choices.json', manifest)
    return manifest


if __name__ == '__main__':
    import sys
    root, recipe_path, destination = map(Path, sys.argv[1:4])
    compose(root.resolve(), choices.read(recipe_path), destination, [])
    print(destination)
