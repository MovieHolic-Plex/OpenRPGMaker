"""Review the exact prepared scene before spending a native drawing attempt."""
from collections import Counter
from pathlib import Path
import hashlib
import json

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
    required = {str(data/name) for name in ('seed.json', 'harness.sqlite', 'harness.sqlite-wal') if (Path(root)/data/name).is_file()}
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
        raise ValueError('실행 시드·치수 명세·주문서·준비 판을 도면 해시에 묶어야 합니다.')
    for key in ('proportions', 'negativeSpace', 'identityCues'):
        if len(str(layout.get(key, '')).strip()) < 20: raise ValueError('도면 설명 누락: '+key)
    snapshot = {'version':VERSION, 'layout':layout, 'layoutRef':request['layout'],
                'execution':{k:v for k,v in request.items() if k != 'layoutApproval'},
                'areaCells':{s:{'count':n, **legend[s]} for s,n in counts.items()}, 'root':str(root)}
    snapshot['fingerprint'] = hashlib.sha256(json.dumps(snapshot, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    return snapshot


def validate_verdict(result, fingerprint, checks):
    if not isinstance(result, dict): raise ValueError('검수 결과 JSON 객체 필요')
    if result.get('fingerprint') != fingerprint or result.get('gateVersion') != VERSION:
        raise ValueError('현재 도면/검수 기준 해시가 필요합니다.')
    if result.get('verdict') not in ('PASS','FAIL'): raise ValueError('판정 누락')
    for key in checks:
        c = result.get('checks',{}).get(key,{})
        if c.get('verdict') not in ('PASS','FAIL') or len(str(c.get('evidence','')).strip()) < 20:
            raise ValueError('검수 관찰 누락: '+key)
    failed = any(result['checks'][k]['verdict']=='FAIL' for k in checks)
    if failed != (result['verdict']=='FAIL'): raise ValueError('세부/전체 판정 불일치')
    if failed:
        if not isinstance(result.get('fixes'), list) or not result['fixes']: raise ValueError('반려 도면의 구체적인 수정 지시 필요')
        for fix in result['fixes']:
            if fix.get('category') not in ('asset','assembly','spec') or any(not isinstance(fix.get(k), str) or not fix[k].strip() for k in ('target','problem','change','keep')):
                raise ValueError('반려 도면의 대상·문제·변경·보존 항목 누락')
    return result


def require_approval(root, request):
    current = build_input(root, request)
    report = json.loads(Path(request['layoutApproval']).read_text())
    validate_verdict(report, current['fingerprint'], LAYOUT_CHECKS)
    if report['verdict'] != 'PASS': raise ValueError('배치 도면이 반려되어 그림을 시작할 수 없습니다.')
    return current


def require_completed(root, request, snapshot):
    """Queue state may advance; the approved drawing instructions must stay identical."""
    verified(root, request['layout'])
    if request['layout'] != snapshot.get('layoutRef'):
        raise ValueError('수집된 그림의 도면 승인 입력이 다릅니다.')
    report = json.loads(Path(request['layoutApproval']).read_text())
    validate_verdict(report, snapshot['fingerprint'], LAYOUT_CHECKS)
    if report['verdict'] != 'PASS': raise ValueError('도면 승인 없이 그림을 수집할 수 없습니다.')
    mutable = {'harness.sqlite', 'harness.sqlite-wal', 'state.json'}
    for ref in snapshot['layout']['sources']:
        if Path(ref['path']).name not in mutable: verified(root, ref)
