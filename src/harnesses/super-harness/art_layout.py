"""Review the exact prepared scene before spending a native drawing attempt."""
from collections import Counter
from copy import deepcopy
from pathlib import Path
import hashlib
import json
import art_acceptance

LAYOUT_CHECKS = ('proportions', 'spaceUse', 'circulation', 'identity', 'composition', 'projection')
SCENE_CHECKS = ('identity', 'scale', 'attachments', 'circulation', 'style', 'spaceUse', 'composition', 'specification', 'projection')
VERSION = 3


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def verified(root, ref):
    p = (Path(root) / ref['path']).resolve()
    if not p.is_relative_to(Path(root).resolve()) or digest(p) != ref['sha256']:
        raise ValueError('도면 입력 파일 경로/해시 불일치')
    return p


def build_input(root, request):
    path = verified(root, request['layout'])
    layout = json.loads(path.read_text())
    grid, legend = layout['grid'], layout['legend']
    size, cell = layout['canvas'], layout['cellSize']
    if (not isinstance(cell, int) or cell < 1 or len(size) != 2 or
        any(not isinstance(n, int) or n < 1 or n % cell for n in size) or
        len(grid) != size[1] // cell or any(not isinstance(row, str) or len(row) != size[0] // cell for row in grid)):
        raise ValueError('실제 캔버스와 ASCII 도면 크기가 다릅니다.')
    counts = Counter(''.join(grid))
    for symbol in counts:
        item = legend.get(symbol, {})
        if symbol.isspace() or item.get('role') not in ('structure','parking','circulation','clearance','equipment','outside') or len(item.get('purpose','').strip()) < 8:
            raise ValueError('모든 도면 칸에 실제 용도와 근거가 필요합니다: ' + repr(symbol))
    sources = layout['sources']
    paths = {str(verified(root, r).relative_to(Path(root).resolve())) for r in sources}
    if layout.get('phase') not in ('calibration', 'scene'):
        raise ValueError('시점 표본(calibration) 또는 공간(scene) 단계 필요')
    camera = layout.get('camera', {})
    for key in ('groundPlane', 'heightAxis', 'lighting'):
        if len(str(camera.get(key, '')).strip()) < 20:
            raise ValueError('바닥·높이·광원 투영 계약 누락: ' + key)
    references = camera.get('references', [])
    if not references: raise ValueError('실제 시점 기준 이미지 필요')
    for ref in references:
        path = verified(root, ref)
        if str(path.relative_to(Path(root).resolve())) not in paths:
            raise ValueError('시점 기준 그림을 도면 sources에도 묶어야 합니다.')
        from PIL import Image
        with Image.open(path) as image: image.verify()
    objects = camera.get('objects', [])
    if len(objects) < 2: raise ValueError('기준 기물과 접합 기물의 투영 명세 필요')
    for obj in objects:
        for key in ('id', 'footprint', 'topFace', 'verticalFace', 'contact', 'occlusion'):
            if not isinstance(obj.get(key), str) or len(obj[key].strip()) < (1 if key == 'id' else 12):
                raise ValueError('물체의 바닥 면적·윗면·수직면·접지·가림 명세 누락: ' + key)
    if layout['phase'] == 'calibration' and len(objects) > 4:
        raise ValueError('시점 표본은 기준 기물·저상 기물·벽 모서리 등 최대 4종만 사용합니다.')
    data = Path(request['data'])
    required = {str(data/name) for name in ('seed.json', 'harness.sqlite') if (Path(root)/data/name).is_file()}
    # A read-only SQLite connection may create a zero-byte WAL. It contains no
    # transaction and must not invalidate an otherwise identical prepared input.
    wal = Path(root)/data/'harness.sqlite-wal'
    if wal.is_file() and wal.stat().st_size:
        required.add(str(data/'harness.sqlite-wal'))
    if not required: raise ValueError('준비된 시드 또는 native 후보 저장소가 필요합니다.')
    if request['harness'] == 'modern-chipset':
        seed_path = Path(root) / data / 'seed.json'
        seed = json.loads(seed_path.read_text())
        for name in ('promptTemplate', 'reviewTemplate'):
            if seed.get(name):
                required.add(str((Path(root) / seed[name]).resolve().relative_to(Path(root).resolve())))
        for name in ('parking-contract.json', 'parking-brief.md'):
            if (Path(root)/data/name).is_file(): required.add(str(data/name))
        if (Path(root)/data/'parking-contract.json').is_file():
            # Receipt creation reads this after drawing; fail before spending a
            # model attempt if preparation forgot its registration metadata.
            required.add(str(data/'registration-source.json'))
        round_dir = Path(request['runs'])/request['round']
        required.add(str(round_dir/'state.json'))
        for name in ('brief.md', 'parking-brief.md', 'parking-contract.json'):
            if (Path(root)/round_dir/'brief'/name).is_file(): required.add(str(round_dir/'brief'/name))
        for name in ('harness.py', 'check.py', 'parking_small.py', 'prompt-parking-small.md', 'review-parking-small.md'):
            p = Path('src/harnesses/modern-chipset')/name
            if (Path(root)/p).is_file(): required.add(str(p))
    if not required <= paths:
        raise ValueError('실행 시드·치수 명세·주문서·준비 판을 도면 해시에 묶어야 합니다: ' + ', '.join(sorted(required - paths)))
    for key in ('proportions', 'negativeSpace', 'identityCues'):
        if len(str(layout.get(key, '')).strip()) < 20: raise ValueError('도면 설명 누락: '+key)
    snapshot = {'version':VERSION, 'layout':layout, 'layoutRef':request['layout'],
                'execution':{k:v for k,v in request.items() if k != 'layoutApproval'},
                'areaCells':{s:{'count':n, **legend[s]} for s,n in counts.items()}, 'root':str(root)}
    if request.get('acceptance'):
        accepted = verified(root, request['acceptance'])
        snapshot['acceptance'] = {'sha256': request['acceptance']['sha256'], 'contract': json.loads(accepted.read_text())}
    snapshot['fingerprint'] = hashlib.sha256(json.dumps(snapshot, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    return snapshot


class ReviewFormatError(ValueError):
    """Incomplete response, eligible for bounded reviewer correction, never a PASS."""


def preserve_verdict(original, repaired):
    """Formatting corrections cannot reverse a verdict or rewrite supplied observations."""
    if not isinstance(original, dict):
        return
    if not isinstance(repaired, dict):
        raise ReviewFormatError('보완 응답은 JSON 객체여야 합니다.')
    for key in ('fingerprint', 'gateVersion', 'verdict', 'checks', 'reasons',
                'acceptanceSha256', 'criterionResults', 'facilityVerdict', 'adjudication'):
        if key == 'checks' and isinstance(original.get(key), dict):
            if not isinstance(repaired.get('checks'), dict):
                raise ReviewFormatError('checks 객체 필요')
            for axis, observation in original[key].items():
                if not isinstance(observation, dict):
                    continue
                supplied = repaired['checks'].get(axis, {})
                if not isinstance(supplied, dict):
                    raise ReviewFormatError('검수 축의 관찰 객체 필요: ' + axis)
                for field, value in observation.items():
                    if value not in (None, '') and supplied.get(field) != value:
                        raise ReviewFormatError('형식 보완 중 기존 관찰 변경 금지: ' + axis + '.' + field)
        elif key in original and original[key] not in (None, '') and repaired.get(key) != original[key]:
            raise ReviewFormatError('형식 보완 중 기존 판정·근거 변경 금지: ' + key)
    if isinstance(original.get('fixes'), list):
        fixes = repaired.get('fixes')
        if not isinstance(fixes, list) or len(fixes) < len(original['fixes']):
            raise ReviewFormatError('기존 수정 지시를 삭제할 수 없습니다.')
        for before, after in zip(original['fixes'], fixes):
            if not isinstance(before, dict):
                continue
            if not isinstance(after, dict):
                raise ReviewFormatError('수정 지시 객체 필요')
            for key in ('target', 'problem', 'change', 'keep'):
                if isinstance(before.get(key), str) and before[key].strip() and after.get(key) != before[key]:
                    raise ReviewFormatError('기존 수정 지시 변경 금지: ' + key)
            category = before.get('category', before.get('type'))
            if category in ('asset', 'assembly', 'spec') and after.get('category', after.get('type')) != category:
                raise ReviewFormatError('기존 수정 분류 변경 금지')


def normalize_fixes(fixes):
    if not isinstance(fixes, list) or not fixes:
        raise ReviewFormatError('반려 도면의 구체적인 수정 지시 필요')
    normalized = deepcopy(fixes)
    for fix in normalized:
        if not isinstance(fix, dict): raise ReviewFormatError('fixes 항목은 객체여야 합니다.')
        # Known synonym only. Conflicts/unknown values and missing substance remain errors.
        if 'category' not in fix and fix.get('type') in ('asset','assembly','spec'):
            fix['category'] = fix.pop('type')
        if 'type' in fix and fix.get('category') != fix['type']:
            raise ReviewFormatError('수정 지시 category/type 분류 충돌')
        if fix.get('category') not in ('asset','assembly','spec'):
            raise ReviewFormatError('수정 지시 category는 asset/assembly/spec 중 하나여야 합니다.')
        missing = [k for k in ('target','problem','change','keep') if not isinstance(fix.get(k), str) or not fix[k].strip()]
        if missing: raise ReviewFormatError('수정 지시 누락: ' + ', '.join(missing))
    return normalized


def validate_verdict(result, fingerprint, checks):
    if not isinstance(result, dict): raise ReviewFormatError('검수 결과 JSON 객체 필요')
    if result.get('fingerprint') != fingerprint or result.get('gateVersion') != VERSION:
        raise ValueError('현재 도면/검수 기준 해시가 필요합니다.')
    normalized = deepcopy(result)
    if normalized.get('verdict') not in ('PASS','FAIL'): raise ReviewFormatError('판정 누락')
    observations = normalized.get('checks')
    if not isinstance(observations, dict): raise ReviewFormatError('checks 객체 필요')
    for key in checks:
        c = observations.get(key)
        if not isinstance(c, dict) or c.get('verdict') not in ('PASS','FAIL') or not isinstance(c.get('evidence'), str) or len(c['evidence'].strip()) < 20:
            raise ReviewFormatError('검수 관찰 누락: '+key)
    failed = any(observations[k]['verdict']=='FAIL' for k in checks)
    if failed != (normalized['verdict']=='FAIL'): raise ValueError('세부/전체 판정 불일치')
    if failed:
        normalized['fixes'] = normalize_fixes(normalized.get('fixes'))
    # Preserve the original object until all checks pass; callers also see normalization.
    result.clear()
    result.update(normalized)
    return result


def require_approval(root, request):
    current = build_input(root, request)
    report = json.loads(Path(request['layoutApproval']).read_text())
    validate_verdict(report, current['fingerprint'], LAYOUT_CHECKS)
    art_acceptance.validate(report, current.get('acceptance'), LAYOUT_CHECKS)
    if report['verdict'] != 'PASS': raise ValueError('배치 도면이 반려되어 그림을 시작할 수 없습니다.')
    return current


def require_completed(root, request, snapshot):
    """Queue state may advance; the approved drawing instructions must stay identical."""
    verified(root, request['layout'])
    if request['layout'] != snapshot.get('layoutRef'):
        raise ValueError('수집된 그림의 도면 승인 입력이 다릅니다.')
    report = json.loads(Path(request['layoutApproval']).read_text())
    validate_verdict(report, snapshot['fingerprint'], LAYOUT_CHECKS)
    if request.get('acceptance'): verified(root, request['acceptance'])
    art_acceptance.validate(report, snapshot.get('acceptance'), LAYOUT_CHECKS)
    if report['verdict'] != 'PASS': raise ValueError('도면 승인 없이 그림을 수집할 수 없습니다.')
    mutable = {'harness.sqlite', 'harness.sqlite-wal', 'state.json'}
    for ref in snapshot['layout']['sources']:
        if Path(ref['path']).name not in mutable: verified(root, ref)
