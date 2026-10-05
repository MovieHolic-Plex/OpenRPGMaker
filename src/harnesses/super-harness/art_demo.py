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
    import theme_production
    theme_sources=theme_production.demo_sources(cid,choices.read(folder/'art-result.json'),manifest)
    inputs = dict(version=1, root=str(root), generation=generation, components=manifest,
                  selections=choices.selections(cid), title=store.concept(cid)['title'])
    layout = folder / 'art-layout-input.json'
    inputs['layout'] = choices.read(layout) if layout.exists() else {}
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
    candidates = []
    for number, demo in enumerate(demos, 1):
        if not isinstance(demo, dict): raise ValueError('데모 객체 필요')
        components = demo.get('components', {})
        if not isinstance(components, dict): raise ValueError('데모 품목 목록 필요')
        if set(components) != set(originals): raise ValueError('모든 필수 품목을 포함한 데모가 필요합니다.')
        selected = [originals[g][c] for g,c in components.items()]
        import re
        required_images = [{c['sheet']['sha256']} | {r['sha256'] for r in c['sources']
            if re.search(r'/h[0-9]+-[A-Z]\.png$', r['path'])} for c in selected]
        refs = [r for c in selected for r in c['sources'] + [c['sheet']]]
        for ref in refs: choices.verified(root, ref)
        recipes = demo.get('recipes', [])
        if not 1 <= len(recipes) <= 4: raise ValueError('전체 공간 및 필요한 문 상태의 조립 배치표가 필요합니다.')
        previews = []
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
            previews.append(choices.ref(root, dest, recipe.get('label') or '실제 타일 공간 데모'))
        passed = all(c['passed'] for c in selected)
        candidates.append(dict(id=f'demo-{number}', title=demo.get('title') or f'공간 데모 {number}',
            passed=passed, summary='데모 조립 완료 · 독립 검수 대기',
            reasons=[str(r) for c in selected if not c['passed'] for r in c['reasons']],
            repairFixes=[f for c in selected for f in c.get('repairFixes', [])],
            sources=list({r['path']:r for r in refs}.values()), images=previews, sheet=previews[0],
            components=components, generation=inputs['generation'], phase='scene',
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
