"""Preserve an approved parking scene as a reusable two-layer modern_city kit."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys

from PIL import Image
import bake_lib as BL

ROOT = Path(__file__).resolve().parents[3]
MANIFEST = Path('tiledata/modern-city/parking-approved/manifest.json')
KIT = 'mc-parking-two-bays'


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def read(path):
    return json.loads(Path(path).read_text())


def write(path, value):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def fingerprint(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def stage(data, cid):
    os.environ['SUPER_HARNESS_DATA'] = str(data)
    sys.path.insert(0, str(ROOT / 'src/harnesses/super-harness'))
    import art_choices
    view = art_choices.view(data, cid)
    if not view['complete']:
        raise ValueError('Current native/context PASS and an explicit selection are required')
    selected = art_choices.selections(cid)['parking-kit']
    chosen = json.loads(selected['source_json'])
    work = Path(data) / 'art-worktrees' / cid
    folder = Path(data) / 'concepts' / cid
    scene = art_choices.verified(work, chosen['sheet'])
    request = read(folder / 'art-execution.json')
    contract_path = work / request['data'] / 'parking-contract.json'
    contract = read(contract_path)
    if contract.get('phase') != 'scene':
        raise ValueError('Calibration samples cannot be installed')
    out = ROOT / MANIFEST.parent
    out.mkdir(parents=True, exist_ok=True)
    refs = {}
    for name, source in {
        'scene.png': scene, 'environment.png': scene.with_name(scene.stem + '-base.png'),
        'car.png': art_choices.verified(work, contract['car']), 'contract.json': contract_path,
        'acceptance.json': folder / 'art-acceptance.json',
        'receipt.json': scene.parent / 'harness-receipt.json',
    }.items():
        target = out / name
        shutil.copy2(source, target)
        refs[name] = {'path': str(target.relative_to(ROOT)), 'sha256': sha(target)}
    proof = out / 'selection.json'
    write(proof, {'fingerprint': selected['fingerprint'], 'chosen': chosen, 'selectedAt': selected['selected_at']})
    refs['selection.json'] = {'path': str(proof.relative_to(ROOT)), 'sha256': sha(proof)}
    write(ROOT / MANIFEST, {'version': 1, 'concept': cid, 'kit': KIT, 'sources': refs})
    # All copies are checked before any shared sheet/definition is changed.
    load(ROOT, lambda **kw: kw)
    return refs


def load(root, make_item):
    root = Path(root)
    if not (root / MANIFEST).is_file():
        return []
    manifest = read(root / MANIFEST)
    refs = manifest['sources']
    for ref in refs.values():
        path = (root / ref['path']).resolve()
        if not path.is_relative_to(root.resolve()) or sha(path) != ref['sha256']:
            raise ValueError('Approved parking source hash changed')
    proof = read(root / refs['selection.json']['path'])
    chosen = proof['chosen']
    candidate = {k: v for k, v in chosen.items() if k not in ('contextReview', 'selectionActor')}
    context = chosen['contextReview']
    if fingerprint({'candidate': candidate, 'contextReview': context}) != proof['fingerprint']:
        raise ValueError('Parking selection fingerprint mismatch')
    if (candidate.get('phase') != 'scene' or candidate.get('passed') is not True
            or context.get('verdict') != 'PASS' or context.get('fingerprint') != fingerprint(candidate)
            or context.get('acceptanceSha256') != refs['acceptance.json']['sha256']
            or candidate['sheet']['sha256'] != refs['scene.png']['sha256']):
        raise ValueError('Current scene acceptance required')
    sys.path.insert(0, str(root / 'src/harnesses/super-harness'))
    import art_acceptance
    import art_layout
    art_acceptance.validate(context, {'sha256': refs['acceptance.json']['sha256'],
                            'contract': read(root / refs['acceptance.json']['path'])}, art_layout.SCENE_CHECKS)
    if not any(r.get('sha256') == refs['receipt.json']['sha256'] for r in candidate['sources']):
        raise ValueError('Native receipt differs from selected evidence')
    receipt = read(root / refs['receipt.json']['path'])
    native = next(c for c in receipt['candidates'] if c['candidate'] == candidate['id'])
    if native['independent']['verdict'] != 'PASS' or native['imageSha256'] != refs['scene.png']['sha256']:
        raise ValueError('Native receipt is not an approval of this image')
    contract = read(root / refs['contract.json']['path'])
    if receipt['contractSha256'] != refs['contract.json']['sha256']:
        raise ValueError('Native contract changed')
    environment = Image.open(root / refs['environment.png']['path']).convert('RGBA')
    scene = Image.open(root / refs['scene.png']['path']).convert('RGBA')
    car = Image.open(root / refs['car.png']['path']).convert('RGBA')
    upper = Image.new('RGBA', environment.size)
    upper.alpha_composite(car, tuple(contract['car']['origin']))
    joined = environment.copy(); joined.alpha_composite(upper)
    if not BL.same_image(joined, scene):
        raise ValueError('Separating floor/vehicle changed approved pixels')
    floor = contract['structure']['floor']
    west = contract['structure']['westFootprint']
    boxes = [(0, 0, scene.width, floor[1]),
             (min(p[0] for p in west), min(p[1] for p in west), max(p[0] for p in west), max(p[1] for p in west))]
    boxes += [(min(p[0] for p in s['footprint']), min(p[1] for p in s['footprint']),
               max(p[0] for p in s['footprint']), max(p[1] for p in s['footprint'])) for s in contract['stopProfile']['profiles']]
    def blocked(x, y):
        return any(x*16 < r and (x+1)*16 > l and y*16 < b and (y+1)*16 > t for l,t,r,b in boxes)
    grid = [[(cell, 'solidfloor' if blocked(x,y) else 'floor') for x,cell in enumerate(row)]
            for y,row in enumerate(BL.cut(environment))]
    footprint = contract['groundSizing']['firstFootprint']
    foot_row = (footprint[1] + footprint[3] - 1) // 16
    overlay = [[(None, None) if BL.empty(cell) else (cell, 'solid' if y == foot_row else 'star')
                for cell in row] for y,row in enumerate(BL.cut(upper))]
    return [make_item(id=KIT, kind='scene', cat='parking', name='지하 주차장 · 두 면', ko='지하 주차장',
        layer='lower', grid=grid, upperGrid=overlay, expected=scene,
        group='parking', gname='지하 주차장 표본', grole='terrain',
        gdesc='검수·선택한 바닥/벽/턱과 공용 자동차의 2층 조립.', grules='전체 키트로 배치. 회전·확대·낱칸 반복 금지.',
        tmeta_role='terrain', tags=['modern-city','parking','approved-scene'],
        desc='차량 1대·주차면 2개의 검수된 작은 구역. 전체 시설용 경사로·차단기·방화문은 포함하지 않는다.',
        rules='아래층은 바닥/벽/턱, 위층은 차량. 차량 몸체 윗줄은 ★, 지상 발 줄은 막힘. 서측 출입과 연결을 유지한다.',
        parts=[], repeatability='fixed', meta=dict(kind='scene', source=refs['scene.png'], door=None,
        anchor=dict(dx=0,dy=0,note='승인 그림 왼쪽 위'),access=[],selectionFingerprint=proof['fingerprint']))]


def references(root):
    root = Path(root)
    if not (root / MANIFEST).exists(): return None
    data = read(root / 'src/assets/modernCityTileset.json')
    kit = next(k for k in data['structureKits'] if k['id'] == KIT)
    manifest = read(root / MANIFEST)
    image = root / 'public/assets/modern-city/parking-approved.png'
    shutil.copy2(root / manifest['sources']['scene.png']['path'], image)
    rows = [{k: row[k] for k in ('tiles','upperTiles')} for row in kit['rows']]
    # Deliberately remove the upper layer: an executable wrong-layer example.
    approved = Image.open(image).convert('RGBA')
    wrong = Image.open(root / manifest['sources']['environment.png']['path']).convert('RGBA')
    comparison = Image.new('RGBA',(approved.width*2,approved.height))
    comparison.paste(approved,(0,0)); comparison.paste(wrong,(approved.width,0))
    comparison.save(image.with_name('parking-layer-comparison.png'))
    wrong_cells = [[x,y] for y,row in enumerate(rows) for x,t in enumerate(row['upperTiles']) if t >= 0]
    changed_pixels = sum(a != b for a,b in zip(approved.getdata(),wrong.getdata()))
    if changed_pixels == 0: raise ValueError('Wrong-layer example failed to expose the error')
    ids = sorted({t for row in rows for values in row.values() for t in values if t >= 0})
    dictionary = [{'id':t,'sourceTile':[t%data['tilesPerRow'],t//data['tilesPerRow']],
                   'sourcePixel':[16*(t%data['tilesPerRow']),16*(t//data['tilesPerRow'])],
                   'home':data['tileMeta'][t]['defaultLayer'],'priority':data['priority'][t],
                   'passability':data['passability'][t]} for t in ids]
    markdown = f'''# 지하 주차장 두 면 — 검수된 고정 구역

## 읽기와 용도
modern_city의 mc-start, mc-assemble을 읽고 이 문서를 읽는다. 키트 `{KIT}`는 {kit['width']}×{kit['height']}칸,
16px다. 이미지 `/assets/modern-city/modern-city-chipset.png`, 판본 SHA256 `{sha(root / 'public/assets/modern-city/modern-city-chipset.png')}`. 자동차 1대/두 주차면의 작은 구역이며 전체 12면 시설의 재료 완비를 의미하지 않는다.

## 사전과 조립
아래층에는 콘크리트/도색/벽/턱, 위층에는 원본차만 있다. 실제 배열은 아래와 같다.
벽/턱은 막힘, 차량 발 줄은 막힘, 솟은 차량 줄은 ★다. 바닥과 솟은 그림의 화면 겹침을 통행 불가로 해석하지 않는다.
새 맵에서 modern_city를 고르고 원점(0,0)에 키트 전체를 찍는다. 서측 출입구에서 시작한다.
레이어를 합치거나 반전/회전하지 않는다. 빈 둘째 면은 실제 주차 공간이며 장식으로 채우지 않는다.

```json
{json.dumps(rows, ensure_ascii=False)}
```

## 원본 칸 사전 (0기준)
```json
{json.dumps(dictionary, ensure_ascii=False)}
```

## 정상·오류 대조
좌 정상/우 오류: /assets/modern-city/parking-layer-comparison.png.
오류 E_MISSING_UPPER: 위층 전체를 -1로 변조해 차량이 사라진다. 맵 좌표 {wrong_cells}, 검출된 화소 불일치 {changed_pixels}.
정상 그림: /assets/modern-city/parking-approved.png. 배열을 다시 조립한 그림은 승인 PNG와 모든 화소가 같아야 한다.
오류: 차량을 아래층에 합치면 ★와 발 줄을 구별할 수 없다. 원래 2층 배열을 복구한다.
오류: 벽/턱을 걷게 하면 물체를 관통한다. passability와 priority를 각각 확인한다.
오류: 빈 면을 늘이거나 키트를 반복하면 새 벽/동선이 생기므로 이 승인으로 품질을 주장할 수 없다.

## 검증과 한계
선택/그림/부품 receipt/고정 합격 계약의 해시는 parking-approved/manifest.json으로 검증한다.
bake의 재조립은 PNG 화소를 대조한다. 게임 통행은 16px 단위로 보수적으로 막고 별도로 확인한다.
픽셀 단위 차량 회전, 문 애니메이션, 경사로·방화문·차단기는 이 키트에 없다.
층 계약 변경 이력: 승인 환경을 아래층에, 승인 원본차를 위층에 분리해 화소 변화 없이 깊이/통행을 지정했다.
출처: modern-chipset native 저작·독립 검수 → super-harness 최종 검수 → 현재 해시 선택.
'''
    target = root / 'tiledata/modern-city/parking-approved/assembly.md'
    target.write_text(markdown)
    category = {'id':'mc-parking','name':'지하 주차장 두 면','description':'선택한 작은 구역의 두 층 배열과 사용 범위.',
            'documents':[{'id':'mc-parking-assembly','name':'조립·전체 배열·검사','markdown':markdown}],
            'images':[{'id':'mc-parking-approved','name':'검수된 주차장','caption':'원본 1배. 2층 배열 재조립의 기준 그림.',
                       'dataUrl':'/assets/modern-city/parking-approved.png'},
                      {'id':'mc-parking-layer-error','name':'정상과 위층 누락 비교','caption':'좌: 정상. 우: E_MISSING_UPPER로 원본 차량이 사라진 오류. 같은 1배 크기.',
                       'dataUrl':'/assets/modern-city/parking-layer-comparison.png'}]}
    wide = root / 'tiledata/modern-city/parking-wide/reference.md'
    if wide.is_file():
        category['documents'].append({'id':'mc-parking-wide-experiment','name':'12면 확장 실험 · 완성 시설 아님','markdown':wide.read_text()})
        category['images'].append({'id':'mc-parking-wide-experiment','name':'12면 기존 칩 확장 실험','caption':'기둥·천장등·외곽 구조·출입 시설 부족. 완성 시설 참고로 쓰지 않는다.','dataUrl':'/assets/modern-city/parking-wide.png'})
    return category


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--data', default=str(Path.home()/'.local/share/oprn/super-harness'))
    parser.add_argument('--concept', default='underground-parking-garage')
    args = parser.parse_args()
    stage(Path(args.data), args.concept)
    import bake_tileset
    planned = bake_tileset.bake(str(ROOT), dry=True)
    if planned['report']['reassembly']['mismatched_pixels'] or planned['report']['definition_checks']['violations']:
        raise ValueError('Shared bundle validation failed before writing')
    baked = bake_tileset.bake(str(ROOT))
    refs = read(ROOT / 'src/assets/modernCityReferences.json')
    refs = [r for r in refs if r['id'] != 'mc-parking'] + [references(ROOT)]
    write(ROOT / 'src/assets/modernCityReferences.json', refs)
    print(json.dumps({'kit':KIT,'tiles':baked['count'],'reassembly':baked['report']['reassembly']},ensure_ascii=False))
