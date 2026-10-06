"""24×32 사람형의 명백한 걷기 결함을 읽는다. 픽셀을 수정하지 않는다.

몸통/다리 영역은 원본 정지의 발끝과 중심으로 고정한다. 해부학 분할이나
자연스러움의 증명이 아니다. 두 걸음의 몸통이 같아도 정지 대비 bob은 허용한다.
"""
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw
import chr as C

VERSION = 1
MIN_PIXELS = 4


def _cells(pal, rows):
    pixels = tuple(C.frame_rgba(pal, rows).getdata())
    return [pixels[y*C.FW:(y+1)*C.FW] for y in range(C.FH)]


def _at(cells, x, y):
    return cells[y][x] if 0 <= x < C.FW and 0 <= y < C.FH else (0, 0, 0, 0)


def _features(cells):
    # Alpha와 색 경계의 위치만 비교한다. 일대일 팔레트 교체는 움직임이 아니다.
    result = {}
    for y in range(C.FH):
        for x in range(C.FW):
            pixel = cells[y][x]
            if not pixel[3]:
                continue
            result[x, y] = tuple(0 if not (other := _at(cells, x+dx, y+dy))[3]
                                 else 1 if other == pixel else 2
                                 for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)))
    return result


def _regions(rows):
    occupied = C._opaque(rows)
    if not occupied:
        raise ValueError('걷기 원본의 정지가 비어 있습니다')
    foot = max(y for _, y in occupied)
    # RM2000 사람형 계약: 부츠 위 몸통 중앙 7줄, 하단 5줄 다리/발.
    # 모자·팔·소품의 변화가 몸통 움직임을 대신하지 않게 중앙 절반만 잰다.
    band = [(x, y) for x, y in occupied if foot-10 <= y <= foot-4]
    if not band or foot < 12:
        raise ValueError('24×32 사람형 몸통/발 영역을 찾을 수 없습니다')
    left, right = min(x for x, _ in band), max(x for x, _ in band)
    width = max(4, min(8, (right-left+1)//2))
    x0 = (left+right+1-width)//2
    return dict(torso=[x0, foot-10, x0+width-1, foot-4], legs=[0, foot-4, C.FW-1, foot])


def _difference(a, b, fa, fb, region):
    x0, y0, x1, y1 = region
    pixels, geometry = [], []
    for y in range(y0, y1+1):
        for x in range(x0, x1+1):
            if _at(a, x, y) != _at(b, x, y):
                pixels.append([x, y])
            if fa.get((x, y)) != fb.get((x, y)):
                geometry.append([x, y])
    return dict(changedPixels=len(pixels), geometryPixels=len(geometry),
                rows=len({y for x, y in pixels}), columns=len({x for x, y in pixels}),
                pixels=pixels, geometry=geometry)


def _moves(change):
    return (change['changedPixels'] >= MIN_PIXELS and change['geometryPixels'] >= MIN_PIXELS
            and change['rows'] >= 2 and change['columns'] >= 2)


def _rigid_offset(idle, walk):
    for dy in range(-2, 3):
        for dx in range(-2, 3):
            shifted = {(x+dx, y+dy): feature for (x, y), feature in idle.items()}
            # 칸 밖으로 잘린 복사는 통과시키지 않는다. 양자화/색 치환도 공간 이동이 아니다.
            if shifted == walk:
                return [dx, dy]
    return None


def analyze(pal, frames, base=None):
    errors = C.structural_errors(pal, frames)
    if errors:
        return dict(version=VERSION, ok=False, fails=errors[:20], directions={})
    bp, bf = base if base else (pal, frames)
    directions, fails = {}, []
    for d in C.DIRS:
        regions = _regions(bf[d, 1])
        cells = [_cells(pal, frames[d, step]) for step in range(3)]
        features = [_features(image) for image in cells]
        row = dict(regions=regions, torso={}, rigidOffsets={})
        for step in (0, 2):
            change = _difference(cells[1], cells[step], features[1], features[step], regions['torso'])
            row['torso'][str(step)] = change
            if not _moves(change):
                fails.append(f'{d} {step}: 몸통 중앙 정지↔걸음 변화 {change["changedPixels"]}px/'
                             f'공간 경계 {change["geometryPixels"]}px. 머리·발만 변경하거나 색만 바꾸지 말고 해당 걸음을 직접 수정하세요.')
            offset = _rigid_offset(features[1], features[step])
            row['rigidOffsets'][str(step)] = offset
            if offset is not None:
                fails.append(f'{d} {step}: 정지 전체의 이동/색 치환 {offset}. 팔·다리의 상대 자세를 직접 저작하세요.')
        row['legs'] = _difference(cells[0], cells[2], features[0], features[2], regions['legs'])
        if not _moves(row['legs']):
            fails.append(f'{d}: 두 걸음 다리/발 교대 변화 {row["legs"]["changedPixels"]}px/'
                         f'공간 경계 {row["legs"]["geometryPixels"]}px. 반대 발의 걸음을 직접 저작하세요.')
        directions[d] = row
    return dict(version=VERSION, ok=not fails, fails=fails, directions=directions,
                scope='RM2000 humanoid: base-foot-anchored torso core and legs; geometric defect check, not natural-walk proof',
                minimum=dict(pixels=MIN_PIXELS, geometry=MIN_PIXELS, rows=2, columns=2))


def render(pal, frames, report, out):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    image = Image.new('RGB', (780, 4*184), '#242730')
    draw = ImageDraw.Draw(image)
    for index, d in enumerate(C.DIRS):
        top = index*184
        row = report['directions'][d]
        draw.text((8, top+4), f'{d}   walk 0 / idle 1 / walk 2   |   diff vs idle: RGB / spatial boundaries', fill='white')
        for step in range(3):
            bg = C._bg(C.FW, C.FH, None, 'checker')
            bg.alpha_composite(C.frame_rgba(pal, frames[d, step]))
            painter = ImageDraw.Draw(bg)
            painter.rectangle(row['regions']['torso'], outline='#ffad52')
            painter.rectangle(row['regions']['legs'], outline='#70c3ff')
            image.paste(C.up(bg.convert('RGB'), 4), (8+step*104, top+24))
        for column, step in enumerate((0, 2)):
            diff = Image.new('RGB', (C.FW, C.FH), '#3b3e48')
            painter = ImageDraw.Draw(diff)
            for region, change in (('torso', row['torso'][str(step)]), ('legs', row['legs'])):
                painter.rectangle(row['regions'][region], outline='#ffad52' if region == 'torso' else '#70c3ff')
                for xy in change['pixels']:
                    painter.point(tuple(xy), fill='#eeeeee')
                for xy in change['geometry']:
                    painter.point(tuple(xy), fill='#60de98')
            image.paste(C.up(diff, 4), (342+column*108, top+24))
        for column, step in enumerate((0, 2)):
            change = row['torso'][str(step)]
            draw.text((8, top+154+column*13), f'torso idle->{step}: RGB {change["changedPixels"]}, spatial {change["geometryPixels"]}', fill='#ffad52')
        legs = row['legs']
        draw.text((342, top+154), f'legs 0->2: RGB {legs["changedPixels"]}, spatial {legs["geometryPixels"]}', fill='#70c3ff')
    image.save(out / 'motion.png')
    C.gif_walk(pal, frames, out / 'motion.gif', 6, background='checker', ms=320)


def audit_file(file, out, base=None, gate=None):
    import harness as H
    file, out = Path(file), Path(out)
    raw = file.read_bytes()
    pal, _, frames = C.parse(raw.decode())
    report = analyze(pal, frames, base)
    inspected = dict(version=C.GATE_VERSION, sourceSha256=hashlib.sha256(raw).hexdigest(),
                     baseSha256=hashlib.sha256(C.dump(base[0], {}, base[1]).encode()).hexdigest() if base else None,
                     strength=(gate or {}).get('strength', 'free'))
    if gate is not None and inspected != H.binding(gate):
        raise ValueError('걷기 검사 중 격자/원본 binding이 변경되었습니다')
    if report['directions']:
        render(pal, frames, report, out)
    proof = dict(version=VERSION, inspected=inspected, at=H.now(), check=report,
                 implementationSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                 artifacts={name: hashlib.sha256((out / name).read_bytes()).hexdigest()
                            for name in ('motion.png', 'motion.gif') if (out / name).is_file()})
    H.write_json_atomic(out / 'motion.json', proof)
    return proof


def fresh(w, gate):
    import harness as H
    from delivery import digest
    try:
        w = Path(w)
        meta = json.loads((w / 'meta.json').read_text())
        manifest = json.loads((H.run_dir(meta['run']) / 'manifest.json').read_text())
        policy = manifest.get('motionPolicy')
        if policy is None:
            return meta.get('motionPolicy') is None  # 옛 공개 픽셀/사람 선택은 당시 계약을 보존한다.
        proof = json.loads((w / 'views/motion.json').read_text())
        return (policy == meta.get('motionPolicy') == proof['version'] == VERSION
                and proof['inspected'] == H.binding(gate) and proof['check']['ok']
                and proof['implementationSha256'] == digest(Path(__file__))
                and set(proof['artifacts']) == {'motion.png', 'motion.gif'}
                and all(digest(w / 'views' / name) == value for name, value in proof['artifacts'].items()))
    except (OSError, ValueError, KeyError, TypeError):
        return False
