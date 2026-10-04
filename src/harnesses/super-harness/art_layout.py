"""Review the exact prepared scene before spending a native drawing attempt."""
from collections import Counter
from pathlib import Path
import hashlib
import json

LAYOUT_CHECKS = ('proportions', 'spaceUse', 'circulation', 'identity', 'composition')
SCENE_CHECKS = ('identity', 'scale', 'attachments', 'circulation', 'style', 'spaceUse', 'composition', 'specification')
VERSION = 2


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
    data = Path(request['data'])
    required = {str(data/'seed.json')}
    if request['harness'] == 'modern-chipset':
        for name in ('parking-contract.json', 'parking-brief.md'):
            if (Path(root)/data/name).is_file(): required.add(str(data/name))
        round_dir = Path(request['runs'])/request['round']
        required.add(str(round_dir/'state.json'))
        for name in ('brief.md', 'parking-brief.md', 'parking-contract.json'):
            if (Path(root)/round_dir/'brief'/name).is_file(): required.add(str(round_dir/'brief'/name))
        for name in ('harness.py', 'check.py', 'parking_small.py', 'prompt-parking-small.md'):
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
