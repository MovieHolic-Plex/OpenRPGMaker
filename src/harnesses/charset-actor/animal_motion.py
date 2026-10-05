"""Animal.png 기준 몬스터의 몸통/보이는 발 검사. 픽셀을 수정하지 않는다.

원본에 표시한 영역을 제작 전에 고정한다. 앞/뒤 방향은 발이 겹치므로
보이는 발만 검사한다. 해부학 인식이나 자연스러운 보행의 증명이 아니다.
"""
import copy
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw
import chr as C
import motion as M

VERSION = 1
FAMILIES = ('dog', 'cat', 'bird', 'sheep', 'cow', 'horse', 'tiger', 'lion')
NAMES = ('개', '고양이', '닭', '양', '소', '말', '호랑이', '사자')
# (앞/뒤 몸통, 앞/뒤 발, 오른쪽 몸통, 앞발, 뒷발). inclusive pixel coordinates.
# 머리/꼬리만 바뀌어도 통과하는 것을 막는 작은 몸통 중심 영역이다.
REGIONS = (
    ([9,24,14,27], [6,28,17,31], [7,23,14,26], [14,27,22,31], [2,27,9,31]),
    ([10,23,13,27], [7,28,16,31], [8,23,13,26], [14,27,20,31], [3,27,10,31]),
    ([9,24,14,27], [6,28,17,31], [7,24,12,27], [5,28,18,31], None),
    ([8,24,15,27], [5,28,18,31], [6,23,15,26], [16,27,22,31], [2,27,10,31]),
    ([8,22,15,26], [5,27,18,31], [7,21,15,25], [16,26,23,31], [0,26,9,31]),
    ([10,21,13,26], [6,27,17,31], [7,20,14,25], [16,26,23,31], [0,26,9,31]),
    ([8,22,15,26], [5,27,18,31], [7,20,14,25], [16,26,23,31], [0,26,9,31]),
    ([8,24,15,27], [3,28,20,31], [7,21,14,25], [16,26,23,31], [0,26,9,31]),
)


def profile(slot):
    if type(slot) is not int or not 0 <= slot < len(FAMILIES):
        raise ValueError('동물 원본 번호는 0~7입니다')
    front_body, feet, side_body, fore, hind = copy.deepcopy(REGIONS[slot])
    def mirror(region):
        x0,y0,x1,y1 = region
        return [C.FW-1-x1,y0,C.FW-1-x0,y1]
    directions = {d: dict(body=front_body.copy(), visibleFeet=feet.copy()) for d in ('up', 'down')}
    directions['right'] = dict(body=side_body, **({'visibleFeet': fore} if hind is None else {'foreFeet': fore, 'hindFeet': hind}))
    directions['left'] = {part: mirror(region) for part,region in directions['right'].items()}
    if slot == 7:
        directions['up']['body'] = [9,22,14,27]
    return dict(version=VERSION, sourceBase=f'Animal:{slot}', family=FAMILIES[slot], directions=directions)


def validate(value):
    if not isinstance(value, dict) or value.get('family') not in FAMILIES:
        raise ValueError('동물 보행 영역이 없습니다')
    if value != profile(FAMILIES.index(value['family'])):
        raise ValueError('제작 전에 고정한 동물 보행 영역이 변경되었습니다')
    return value


def bound_profile(w):
    import harness as H
    meta = json.loads((Path(w) / 'meta.json').read_text())
    manifest = json.loads((H.run_dir(meta['run']) / 'manifest.json').read_text())
    row = next(r for r in manifest['characters'] if r['key'] == meta['brief'])
    if (manifest.get('animalPolicy') != VERSION or meta.get('animalPolicy') != VERSION
            or row.get('animalPolicy') != VERSION or manifest.get('motionPolicy') is not None
            or meta.get('motionPolicy') is not None or row.get('motionPolicy') is not None
            or row.get('animalProfile') != meta.get('animalProfile') or row['base'] != meta['base']):
        raise ValueError('동물 검사 정책/원본/영역의 실행·작업자 binding이 다릅니다')
    value = validate(meta['animalProfile'])
    if manifest.get('recipe'):
        import recipes as R
        recipe = R.verify_run(H.run_dir(meta['run']))
        if meta.get('recipe') != manifest['recipe'] or meta.get('seed') != row.get('seed'):
            raise ValueError('동물 제작 기준 binding이 다릅니다')
        if recipe['seeds'][row['seed']]['animalProfile'] != value:
            raise ValueError('동물 영역이 봉인된 원본과 다릅니다')
    return value


def _moves(change, body=False):
    # 작은 발은 한 줄 또는 한 열에도 두 픽셀이 움직일 수 있다.
    minimum = 4 if body else 2
    return (change['changedPixels'] >= minimum and change['geometryPixels'] >= minimum
            and (not body or (change['rows'] >= 2 and change['columns'] >= 2)))


def analyze(pal, frames, animal_profile):
    value = validate(animal_profile)
    errors = C.structural_errors(pal, frames)
    if errors:
        return dict(version=VERSION, ok=False, fails=errors[:20], directions={})
    directions, fails = {}, []
    for direction in C.DIRS:
        regions = value['directions'][direction]
        cells = [M._cells(pal, frames[direction, s]) for s in range(3)]
        features = [M._features(c) for c in cells]
        row = dict(regions=regions, body={}, feet={}, rigidOffsets={})
        for step in (0,2):
            change = M._difference(cells[1], cells[step], features[1], features[step], regions['body'])
            row['body'][str(step)] = change
            if not _moves(change, body=True):
                fails.append(f'{direction} {step}: 몸통 중앙 변화 {change["changedPixels"]}px/공간 경계 {change["geometryPixels"]}px. 머리·꼬리·발만 변경하지 말고 몸통의 걸음 위상을 직접 찍으세요.')
            offset = M._rigid_offset(features[1], features[step])
            row['rigidOffsets'][str(step)] = offset
            if offset is not None:
                fails.append(f'{direction} {step}: 정지 전체 이동/색 치환 {offset}. 몸과 발의 상대 자세를 직접 찍으세요.')
        for part, region in regions.items():
            if part == 'body':
                continue
            change = M._difference(cells[0], cells[2], features[0], features[2], region)
            row['feet'][part] = change
            if not _moves(change):
                fails.append(f'{direction} {part}: 두 걸음 발 교대 {change["changedPixels"]}px/공간 경계 {change["geometryPixels"]}px. 이 부위의 반대 걸음을 직접 찍으세요.')
        directions[direction] = row
    return dict(version=VERSION, ok=not fails, fails=fails, directions=directions,
                profile=value, minimum=dict(bodyPixels=4, bodyGeometry=4, bodyRows=2, bodyColumns=2, feetPixels=2, feetGeometry=2),
                scope='Source-anchored animal body core; side fore/hind feet, frontal visible feet; geometric defect check, not anatomical or natural-gait proof')


def render(pal, frames, report, out):
    out = Path(out); out.mkdir(parents=True, exist_ok=True)
    colors = dict(body='#ffad52', visibleFeet='#70c3ff', foreFeet='#70c3ff', hindFeet='#d2a7ff')
    image = Image.new('RGB', (820,4*200), '#242730'); draw = ImageDraw.Draw(image)
    for index,d in enumerate(C.DIRS):
        top = index*200; row = report['directions'][d]
        draw.text((8,top+4), f'{report["profile"]["family"]} / {d}: walk 0 / idle 1 / walk 2', fill='white')
        for step in range(3):
            bg = C._bg(C.FW,C.FH,None,'checker'); bg.alpha_composite(C.frame_rgba(pal,frames[d,step]))
            painter = ImageDraw.Draw(bg)
            for part,region in row['regions'].items():
                painter.rectangle(region,outline=colors[part])
            image.paste(C.up(bg.convert('RGB'),4),(8+step*104,top+24))
        for column,step in enumerate((0,2)):
            diff = Image.new('RGB',(C.FW,C.FH),'#3b3e48'); painter = ImageDraw.Draw(diff)
            for part,change in dict(body=row['body'][str(step)],**row['feet']).items():
                painter.rectangle(row['regions'][part],outline=colors[part])
                for xy in change['pixels']: painter.point(tuple(xy),fill='#eeeeee')
                for xy in change['geometry']: painter.point(tuple(xy),fill='#60de98')
            image.paste(C.up(diff,4),(342+column*108,top+24))
        changes = [(f'body idle->{s}',row['body'][str(s)]) for s in (0,2)]
        changes += [(f'{p} 0->2',c) for p,c in row['feet'].items()]
        for line,(name,c) in enumerate(changes):
            draw.text((572,top+38+line*20),f'{name}: {c["changedPixels"]}/{c["geometryPixels"]}',fill='white')
    image.save(out/'motion.png')
    C.gif_walk(pal,frames,out/'motion.gif',6,background='checker',ms=320)


def audit_file(file,out,base,animal_profile,gate=None):
    import harness as H
    file,out = Path(file),Path(out)
    raw = file.read_bytes(); pal,_,frames = C.parse(raw.decode())
    report = analyze(pal,frames,animal_profile)
    inspected = dict(version=C.GATE_VERSION, sourceSha256=hashlib.sha256(raw).hexdigest(),
                     baseSha256=hashlib.sha256(C.dump(base[0],{},base[1]).encode()).hexdigest(),
                     strength=(gate or {}).get('strength','free'))
    if gate is not None and inspected != H.binding(gate):
        raise ValueError('동물 검사 중 격자/원본 binding이 변경되었습니다')
    if report['directions']: render(pal,frames,report,out)
    proof = dict(version=VERSION,kind='animal',inspected=inspected,at=H.now(),check=report,
                 implementationSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                 featureImplementationSha256=hashlib.sha256(Path(M.__file__).read_bytes()).hexdigest(),
                 artifacts={name:hashlib.sha256((out/name).read_bytes()).hexdigest() for name in ('motion.png','motion.gif') if (out/name).is_file()})
    H.write_json_atomic(out/'motion.json',proof)
    return proof


def fresh(w,gate):
    import harness as H
    from delivery import digest
    try:
        w = Path(w); meta = json.loads((w/'meta.json').read_text())
        root = H.run_dir(meta['run']); manifest = json.loads((root/'manifest.json').read_text())
        recipe_policy = json.loads((root/'recipe/recipe.json').read_text()).get('animalPolicy') if meta.get('recipe') else None
        if all(p is None for p in (recipe_policy,manifest.get('animalPolicy'),meta.get('animalPolicy'))):
            return True  # 옛 사람형 정책/선택은 그대로 둔다.
        value = bound_profile(w)
        proof = json.loads((w/'views/motion.json').read_text())
        return (proof.get('kind') == 'animal' and proof['version'] == VERSION
                and proof['inspected'] == H.binding(gate) and proof['check']['ok'] and proof['check']['profile'] == value
                and proof['implementationSha256'] == digest(Path(__file__))
                and proof['featureImplementationSha256'] == digest(Path(M.__file__))
                and set(proof['artifacts']) == {'motion.png','motion.gif'}
                and all(digest(w/'views'/name) == value for name,value in proof['artifacts'].items()))
    except (OSError,ValueError,KeyError,TypeError,StopIteration):
        return False
