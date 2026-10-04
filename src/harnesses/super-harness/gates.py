"""Fail-closed material and visual gates; all approvals are bound to current files."""
from functools import lru_cache
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[3]
VERSION = 2
ROLES = {'floor', 'wall', 'ceiling', 'prop', 'event-graphic', 'terrain'}
VISUAL_CHECKS = ('north', 'east', 'south', 'west', 'interior-walls', 'era', 'materials', 'scale', 'access', 'purpose', 'planning')


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


PLAN_VERSION = 1
PLAN_CHECKS = ('identity', 'use', 'routes', 'boundaries', 'scale', 'requirements')


def _planning_report(folder, approved=True, document=None, detail=False):
    folder = Path(folder)
    plan = document if document is not None else read(folder / 'planning.json', {})
    issues = []
    variants = plan.get('variants') or []
    if plan.get('version') != PLAN_VERSION or plan.get('concept') != folder.name or not variants:
        issues.append('공간 기획과 텍스트 평면도가 없음 — 재료 조사·시공 전 기획 필요')
    ids = set()
    worlds = {w['id'] for w in read(ROOT / 'harness-data/super-harness/seed.json', {})['worldviews']}
    for v in variants:
        vid = v.get('id')
        if not isinstance(vid, str) or not vid or vid in ids:
            issues.append('기획 변형 id가 없거나 중복됨')
        ids.add(vid)
        if v.get('worldviewId') not in worlds or v.get('layout') not in ('room', 'building', 'dungeon', 'outdoor'):
            issues.append(f'{vid}: 시대·공간 종류가 없음')
        if v.get('spaceProfile') not in ('compact', 'open', 'corridor'):
            issues.append(f'{vid}: 공간 밀도 목적이 없음')
        for field in ('purpose', 'experience', 'scaleReason'):
            if not isinstance(v.get(field), str) or not v[field].strip():
                issues.append(f'{vid}: {field} 기획 근거 없음')
        reqs = v.get('requirements') or []
        req_ids = {r['id'] for r in reqs}
        if not reqs or len(req_ids) != len(reqs) or any(not r['id'] or not r.get('what') or r.get('role') not in ROLES for r in reqs):
            issues.append(f'{vid}: 필수 재료 목록 누락/중복')
        roles = {r.get('role') for r in reqs}
        if not roles.intersection({'prop', 'terrain'}) or (v.get('layout') != 'outdoor' and not {'floor', 'wall', 'ceiling'} <= roles):
            issues.append(f'{vid}: 공간 핵심 재료 또는 실내 바닥·벽·천장 기획 누락')
        zones = v.get('zones') or []
        symbols = {z['symbol'] for z in zones}
        if not zones or len(symbols) != len(zones):
            issues.append(f'{vid}: 구역 범례 누락/중복')
        for z in zones:
            symbol = z['symbol']
            if not isinstance(symbol, str) or len(symbol) != 1 or symbol not in 'ABCDFGHIJKLMNOPQRSTUVWYZ':
                issues.append(f'{vid}: 구역은 E/X를 제외한 대문자 한 글자')
            if not z.get('name') or not z.get('purpose') or not set(z.get('requirements', [])) <= req_ids:
                issues.append(f'{vid}/{symbol}: 구역 용도 또는 재료 연결 오류')
        rows = v.get('diagram') or []
        if not (3 <= len(rows) <= 80 and all(isinstance(r, str) for r in rows) and
                3 <= len(rows[0]) <= 80 and len({len(r) for r in rows}) == 1):
            issues.append(f'{vid}: 텍스트 도면은 같은 폭의 ASCII 행 3~80칸이어야 함')
            continue
        if type(v.get('cellScale')) is not int or not 1 <= v['cellScale'] <= 8:
            issues.append(f'{vid}: 도면 한 칸의 실제 타일 축척(1~8)이 없음')
        allowed = symbols | set('#.+EX')
        if any(ch not in allowed for row in rows for ch in row) or not symbols <= set(''.join(rows)):
            issues.append(f'{vid}: 도면과 구역 범례가 다름')
        h, w = len(rows), len(rows[0])
        walkable = {(x, y) for y, row in enumerate(rows) for x, ch in enumerate(row) if ch != '#'}
        entries = [(x, y) for x, y in walkable if rows[y][x] == 'E']
        if len(entries) != 1:
            issues.append(f'{vid}: 진입점 E가 정확히 하나 필요함')
            continue
        for x, y in walkable:
            if (x in (0, w - 1) or y in (0, h - 1)) and rows[y][x] not in 'EX':
                issues.append(f'{vid}: 외곽 ({x},{y})가 벽/선언된 출입구가 아님')
        reached, pending = {entries[0]}, [entries[0]]
        while pending:
            x, y = pending.pop()
            for cell in ((x-1,y), (x+1,y), (x,y-1), (x,y+1)):
                if cell in walkable and cell not in reached:
                    reached.add(cell)
                    pending.append(cell)
        if reached != walkable:
            issues.append(f'{vid}: 입구에서 닿지 않는 도면 칸 {len(walkable - reached)}개')
        routes = v.get('routes') or []
        if not routes or any(not r.get('name') or not r.get('purpose') or len(r.get('via', [])) < 2 or
                             not set(r['via']) <= symbols | (set(''.join(rows)) & set('EX')) for r in routes):
            issues.append(f'{vid}: 범례와 연결된 사용 동선이 없음')
    if not detail:
        import planning_details
        for v in variants:
            issues += [f'{v.get("id")}: {error}' for error in planning_details.validate(folder, v)]
    fp = fingerprint({'version': PLAN_VERSION, 'plan': plan})
    if approved and not issues:
        for label in ('A', 'B'):
            review = read(folder / 'planning-reviews' / f'{label}.json', {})
            if review.get('verdict') != 'PASS' or review.get('fingerprint') != fp:
                issues.append(f'기획 {label}: 현재 도면의 독립 적대적 검수 PASS가 없음')
            checked = {v['id']: v for v in review.get('variants', [])}
            if set(checked) != ids or len(checked) != len(review.get('variants', [])):
                issues.append(f'기획 {label}: 검수하지 않은 변형이 있음')
            for vid in ids:
                checks = checked.get(vid, {}).get('checks', {})
                for key in PLAN_CHECKS:
                    check = checks.get(key, {})
                    if check.get('verdict') != 'PASS' or not isinstance(check.get('evidence'), str) or not check['evidence'].strip():
                        issues.append(f'기획 {label}/{vid}: {key} 검수 근거 없음 또는 실패')
                source = next(v for v in variants if v['id'] == vid)
                if source.get('details'):
                    detail_reviews = {d['id']: d for d in checked.get(vid, {}).get('details', [])}
                    if set(detail_reviews) != {d['id'] for d in source['details']}:
                        issues.append(f'기획 {label}/{vid}: 상세 도면 검수 누락')
                    for did, dr in detail_reviews.items():
                        for key in PLAN_CHECKS:
                            item = dr.get('checks', {}).get(key, {})
                            if item.get('verdict') != 'PASS' or not item.get('evidence'):
                                issues.append(f'기획 {label}/{vid}/{did}: {key} 상세 검수 부족')
                    connection = checks.get('connections', {})
                    if connection.get('verdict') != 'PASS' or not connection.get('evidence'):
                        issues.append(f'기획 {label}/{vid}: 구역 연결 검수 부족')
    return {'ok': not issues, 'problems': issues, 'fingerprint': fp, 'variants': variants}


def planning_report(folder, approved=True):
    try:
        return _planning_report(folder, approved)
    except (OSError, ValueError, TypeError, AttributeError, KeyError) as error:
        return {'ok': False, 'problems': [f'기획 근거 형식 오류: {error}'], 'fingerprint': '', 'variants': []}


def _planning_markdown(folder):
    plan = read(Path(folder) / 'planning.json', {})
    if not isinstance(plan, dict) or not plan.get('variants'):
        return '## 공간 기획\n\n아직 작성되지 않았습니다. 기획과 텍스트 도면을 검수한 뒤 재료를 조사합니다.\n'
    report = planning_report(folder)
    lines = ['## 공간 기획·텍스트 도면', '', '**기획 승인** ' + ('A/B 통과' if report['ok'] else '미승인 — 작성/수정/검수 필요'), '']
    for v in plan.get('variants', []):
        lines += [f'### {v.get("title") or v.get("id")}', '', f'**용도** {v.get("purpose", "")}', '',
                  f'**경험·활동** {v.get("experience", "")}', '', f'**축척** 도면 1칸 ≈ {v.get("cellScale", "?")}타일. {v.get("scaleReason", "")}', '',
                  '```text', *v.get('diagram', []), '```', '', '`#` 벽/구역 밖 · `.` 통로 · `+` 문 · `E` 진입 · `X` 외부 출구. 좌표는 왼쪽 위 (0,0).', '']
        lines += [f'- **{z["symbol"]} — {z.get("name", "")}**: {z.get("purpose", "")}' for z in v.get('zones', [])] + ['']
        lines += [f'- **{r.get("name", "")}**: {" → ".join(r.get("via", []))} — {r.get("purpose", "")}' for r in v.get('routes', [])] + ['']
        lines += ['**필수 재료**', ''] + [f'- {r.get("what", "")}' for r in v.get('requirements', [])] + ['']
    for v in plan.get('variants', []):
        for d in v.get('details', []):
            lines += [f'### 세부 도면 — {d.get("title") or d["id"]}', '', f'**위치** 전체 지도 타일 좌표 {d.get("origin")} · 한 칸 = 1타일', '', '```text', *d['diagram'], '```', '']
            lines += [f'- **{z["symbol"]} — {z.get("name", "")}**: {z.get("purpose", "")}' for z in d.get('zones', [])] + ['']
            lines += [f'- 연결 **{p["id"]}**: {p["side"]} · 폭 {p["width"]}타일 · 높이 {p["level"]} → {p["connectsTo"]}' for p in d.get('ports', [])] + ['']
    for label in ('A', 'B'):
        r = read(Path(folder) / 'planning-reviews' / f'{label}.json', {})
        current = r.get('fingerprint') == report['fingerprint']
        lines += [f'### 기획 검수 {label} — {r.get("verdict", "대기")}' + ('' if current or not r else ' (이전 기획 판정)'), '']
        lines += [f'- {reason}' for reason in r.get('reasons', [])] + ['']
        for v in r.get('variants', []):
            lines += [f'- **{v.get("id")} / {key} / {c.get("verdict")}**: {c.get("evidence", "")}' for key, c in v.get('checks', {}).items()] + ['']
    return '\n'.join(lines)


def planning_markdown(folder):
    try:
        return _planning_markdown(folder)
    except (OSError, ValueError, TypeError, AttributeError, KeyError):
        return '## 공간 기획\n\n기획 문서 형식에 오류가 있습니다. 승인할 수 없으며 수정이 필요합니다.\n'


def _material_report(folder, approved=True):
    folder = Path(folder)
    plan = read(folder / 'materials.json', {})
    planning = planning_report(folder)
    issues, missing, images, requirements = list(planning['problems']), [], [], []
    if plan.get('planningFingerprint') != planning['fingerprint']:
        issues.append('승인 기획 이후 재료 조사서가 갱신되지 않음')
    planned = {v['id']: v for v in planning['variants']}
    if set(planned) != {v['id'] for v in plan.get('variants', [])}:
        issues.append('기획과 재료 조사서의 변형 목록이 다름')
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
        pv = planned.get(vid, {})
        if any(v.get(k) != pv.get(k) for k in ('worldviewId', 'layout', 'spaceProfile')):
            issues.append(f'{vid}: 승인 기획의 시대·공간 종류 변경 금지')
        actual = {r['id']: r for r in v.get('requirements', [])}
        for req in pv.get('requirements', []):
            if any(actual.get(req['id'], {}).get(k) != req.get(k) for k in ('role', 'what')):
                issues.append(f'{vid}/{req["id"]}: 기획의 필수 재료가 삭제/변경됨')
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
            'requirements': requirements, 'images': images, 'variants': variants, 'planningFingerprint': planning['fingerprint']}


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
    if read(folder / 'card.json', {}).get('planningFingerprint') != planning_report(folder)['fingerprint']:
        issues.append('예제 카드가 현재 승인 기획에 묶이지 않음')
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
    command = {'materials': material_report, 'planning': planning_report}.get(sys.argv[1])
    result = command(sys.argv[2], approved='--draft' not in sys.argv) if command else None
    if result is None:
        raise SystemExit('usage: gates.py planning|materials <concept folder> [--draft]')
    print(json.dumps(result, ensure_ascii=False))
    sys.exit(0 if result['ok'] else 1)
