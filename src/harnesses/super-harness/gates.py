"""Fail-closed material and visual gates; all approvals are bound to current files."""
from functools import lru_cache
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[3]
VERSION = 2
ROLES = {'floor', 'wall', 'ceiling', 'prop', 'event-graphic', 'terrain'}
VISUAL_CHECKS = ('north', 'east', 'south', 'west', 'interior-walls', 'era', 'materials', 'scale', 'access', 'purpose')


def read(path, default=None):
    try:
        return json.loads(Path(path).read_text())
    except (OSError, ValueError):
        return default


@lru_cache(maxsize=512)
def _digest(path, mtime_ns, ctime_ns, size):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def digest(path):
    path = Path(path).resolve()
    stat = path.stat()
    return _digest(str(path), stat.st_mtime_ns, stat.st_ctime_ns, stat.st_size)


def fingerprint(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def repo_file(relative):
    path = (ROOT / relative).resolve()
    if not path.is_relative_to(ROOT) or not path.is_file():
        raise ValueError(f'실제 저장소 파일이 아님: {relative}')
    return path


def evidence(ref, pointer=False):
    if not isinstance(ref, dict):
        raise ValueError('재료 근거가 없음')
    path = repo_file(ref.get('path', ''))
    if ref.get('sha256') != digest(path):
        raise ValueError(f'재료 근거 해시가 바뀜: {ref.get("path")}')
    if pointer:
        value = read(path)
        key = ref.get('pointer')
        if not isinstance(key, str) or not key.startswith('/'):
            raise ValueError(f'재료의 JSON pointer가 없음: {path.name}')
        try:
            for part in key[1:].split('/'):
                part = part.replace('~1', '/').replace('~0', '~')
                value = value[int(part)] if isinstance(value, list) else value[part]
        except (KeyError, IndexError, TypeError, ValueError):
            raise ValueError(f'재고에 없는 재료: {key}')
        if value is None or value == [] or value == {}:
            raise ValueError(f'빈 재료: {key}')
    return ref


def _material_report(folder, approved=True):
    folder = Path(folder)
    plan = read(folder / 'materials.json', {})
    issues, missing, images, requirements = [], [], [], []
    worlds = {w['id']: w for w in read(ROOT / 'harness-data/super-harness/seed.json', {}).get('worldviews', [])}
    variants = plan.get('variants') or []
    if plan.get('version') != VERSION or plan.get('concept') != folder.name or not variants:
        issues.append('새 재료 조사서가 없다 — 맵 제작 전에 재료부터 조사해야 함')
    variant_ids = set()
    for v in variants:
        vid, world = v.get('id'), v.get('worldviewId')
        if not vid or vid in variant_ids:
            issues.append('변형 id가 없거나 중복됨')
        variant_ids.add(vid)
        if world not in worlds or v.get('tilesetId') not in worlds.get(world, {}).get('native', []):
            issues.append(f'{vid}: 시대에 맞는 공용 칩셋이 없음 — 다른 시대의 바닥·벽도 대용 금지')
        if not isinstance(v.get('purpose'), str) or not v['purpose'].strip():
            issues.append(f'{vid}: 공간의 목적 근거가 없음')
        if v.get('layout') not in ('room', 'building', 'dungeon', 'outdoor') or v.get('spaceProfile') not in ('compact', 'open', 'corridor'):
            issues.append(f'{vid}: 공간 종류와 빈 공간의 목적을 먼저 정해야 함')
        needed = v.get('requirements') or []
        roles = {r.get('role') for r in needed}
        if not roles.intersection({'prop', 'terrain'}):
            issues.append(f'{vid}: 공간을 알아볼 수 있는 핵심 재료가 없음')
        if v.get('layout') != 'outdoor' and not {'floor', 'wall', 'ceiling'} <= roles:
            issues.append(f'{vid}: 바닥·벽·천장 재료가 모두 필요함')
        seen = set()
        for r in needed:
            rid = r.get('id')
            if not rid or rid in seen or r.get('role') not in ROLES or not r.get('what'):
                issues.append(f'{vid}: 재료 id·역할·이름이 없거나 중복됨')
            seen.add(rid)
            requirements.append(f'{vid}/{rid}')
            if r.get('available') is not True:
                missing.append({'variant': vid, **r})
                continue
            try:
                evidence(r.get('catalog'), pointer=True)
                bindings = r.get('bindings') or []
                if not bindings or any(not all(isinstance(b.get(k), str) and b[k] for k in ('tool', 'field', 'id')) for b in bindings):
                    raise ValueError('실제 도구의 재료 선택 인자 근거가 없음')
                ref = evidence(r.get('preview'))
                if Path(ref['path']).suffix.lower() not in ('.png', '.webp', '.jpg', '.jpeg'):
                    raise ValueError('실제 칩 이미지가 필요함')
                images.append(ref)
                refs = r.get('references') or []
                if not refs:
                    raise ValueError('해당 칩셋의 참고문서 근거가 없음')
                for ref in refs:
                    evidence(ref)
            except (ValueError, TypeError, OSError) as err:
                issues.append(f'{vid}/{rid}: {err}')
    fp = fingerprint({'version': VERSION, 'plan': plan})
    if missing:
        issues.append(f'필수 재료 {len(missing)}건 미준비 — 맵 제작 금지')
    if approved and not issues:
        review = read(folder / 'material-review.json', {})
        if review.get('fingerprint') != fp or review.get('verdict') != 'PASS':
            issues.append('현재 재료에 대한 독립 검수 PASS가 없음')
        if set(review.get('requirements', [])) != set(requirements):
            issues.append('독립 검수에서 빠진 필수 재료가 있음')
        if any(review.get('checks', {}).get(k) != 'PASS' for k in ('era', 'coverage', 'renderability')):
            issues.append('시대·핵심 재료·실제 조립 가능 여부 검수가 필요함')
        if {fingerprint(r) for r in review.get('images', [])} != {fingerprint(r) for r in images}:
            issues.append('독립 검수의 실제 칩 이미지 근거가 부족함')
    return {'ok': not issues, 'problems': issues, 'missing': missing, 'fingerprint': fp,
            'requirements': requirements, 'images': images, 'variants': variants}


def material_report(folder, approved=True):
    try:
        return _material_report(folder, approved)
    except (OSError, ValueError, TypeError, AttributeError, KeyError) as error:
        return {'ok': False, 'problems': [f'재료 근거 형식 오류: {error}'],
                'missing': [], 'fingerprint': '', 'requirements': [], 'images': [], 'variants': []}


def visual_manifest(folder):
    folder = Path(folder)
    images = []
    check = read(folder / 'examples/check.json', {})
    for ex in check.get('examples', []):
        for m in ex.get('maps', []):
            name = m.get('png', '')
            path = (folder / 'examples' / name).resolve()
            if not path.is_relative_to((folder / 'examples').resolve()) or not path.is_file():
                raise ValueError('예제 이미지가 없음')
            images.append({'path': 'examples/' + name, 'sha256': digest(path), 'mapId': m['mapId']})
    # Generated quadrant crops make thin/missing walls visible at native pixel size.
    from PIL import Image
    crops = folder / 'visual'
    crops.mkdir(exist_ok=True)
    originals = list(images)
    for entry in originals:
        with Image.open(folder / entry['path']) as im:
            w, h = im.size
            for name, box in [('nw', (0, 0, (w + 1)//2, (h + 1)//2)), ('ne', (w//2, 0, w, (h + 1)//2)),
                              ('sw', (0, h//2, (w + 1)//2, h)), ('se', (w//2, h//2, w, h))]:
                out = crops / (Path(entry['path']).stem + '-' + name + '.png')
                im.crop(box).save(out)
                images.append({'path': str(out.relative_to(folder)), 'sha256': digest(out), 'mapId': entry['mapId']})
    payload = {'version': VERSION, 'card': digest(folder / 'card.json'), 'materials': material_report(folder)['fingerprint'],
               'check': digest(folder / 'examples/check.json'), 'images': images}
    payload['fingerprint'] = fingerprint(payload)
    (folder / 'visual-input.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    return payload


def _visual_report(folder, reviews):
    folder = Path(folder)
    issues = list(material_report(folder)['problems'])
    manifest = read(folder / 'visual-input.json', {})
    check = read(folder / 'examples/check.json', {})
    payload = {k: v for k, v in manifest.items() if k != 'fingerprint'}
    if manifest.get('version') != VERSION or manifest.get('fingerprint') != fingerprint(payload):
        issues.append('시각 검수 입력의 버전·해시 불일치')
    expected_originals = {'examples/' + m['png'] for ex in check.get('examples', []) for m in ex.get('maps', [])}
    actual_originals = {im['path'] for im in manifest.get('images', []) if im['path'].startswith('examples/')}
    if not expected_originals or expected_originals != actual_originals:
        issues.append('예제의 전체 그림이 검수 목록에서 빠짐')
    paths = {im['path'] for im in manifest.get('images', [])}
    for original in expected_originals:
        for quadrant in ('nw', 'ne', 'sw', 'se'):
            if f'visual/{Path(original).stem}-{quadrant}.png' not in paths:
                issues.append('네 구역 확대 그림이 부족함')
    if not check.get('ok'):
        issues.append('예제 기계 검사 미통과')
    try:
        if manifest.get('card') != digest(folder / 'card.json') or manifest.get('check') != digest(folder / 'examples/check.json'):
            issues.append('시각 검수 이후 설계 또는 예제 검사가 변경됨')
        if manifest.get('materials') != material_report(folder)['fingerprint']:
            issues.append('시각 검수 이후 재료가 변경됨')
        for im in manifest.get('images', []):
            image_path = (folder / im['path']).resolve()
            if not image_path.is_relative_to(folder.resolve()):
                issues.append('시각 검수 이미지가 해당 개념 폴더 밖에 있음')
                continue
            if digest(image_path) != im['sha256']:
                issues.append('시각 검수 이후 그림이 변경됨')
    except (OSError, KeyError):
        issues.append('시각 검수 입력이 없음')
    expected = {im['path']: im['sha256'] for im in manifest.get('images', [])}
    if not expected:
        issues.append('실제 전체 그림·구역 그림이 없음')
    maps = {im['mapId'] for im in manifest.get('images', [])}
    for label in ('A', 'B'):
        r = reviews.get(label) or {}
        if r.get('verdict') != 'PASS' or not manifest.get('fingerprint') or r.get('fingerprint') != manifest['fingerprint']:
            issues.append(f'{label}: 현재 그림에 대한 독립 검수 PASS가 없음')
        if {im.get('path'): im.get('sha256') for im in r.get('images', [])} != expected:
            issues.append(f'{label}: 전체·구역 그림의 확인 기록이 부족함')
        checked = {m.get('mapId'): m for m in r.get('maps', [])}
        if set(checked) != maps:
            issues.append(f'{label}: 확인하지 않은 맵이 있음')
        for mid in maps:
            checks = checked.get(mid, {}).get('checks', {})
            for key in VISUAL_CHECKS:
                if checks.get(key, {}).get('verdict') != 'PASS' or not checks.get(key, {}).get('evidence'):
                    issues.append(f'{label}/{mid}: {key} 검수 근거 없음 또는 실패')
    return {'ok': not issues, 'problems': issues}


def visual_report(folder, reviews):
    try:
        return _visual_report(folder, reviews)
    except (OSError, ValueError, TypeError, AttributeError, KeyError) as error:
        return {'ok': False, 'problems': [f'시각 검수 근거 형식 오류: {error}']}


if __name__ == '__main__':
    result = material_report(sys.argv[2], approved='--draft' not in sys.argv) if sys.argv[1] == 'materials' else None
    if result is None:
        raise SystemExit('usage: gates.py materials <concept folder> [--draft]')
    print(json.dumps(result, ensure_ascii=False))
    sys.exit(0 if result['ok'] else 1)
