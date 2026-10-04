"""명백한 동작 결함과 정상 bob을 구분하는 CI 계약. 모델/사용자 선택 없음."""
import copy
import chr as C
import harness as H
import motion as M


def verify(check):
    pal, frames = H.base_of('Actor1:0')
    base = (pal, frames)
    check('motion-original-gait-supported', M.analyze(pal, frames, base)['ok'])

    def copy_region(target, direction, step, source, region):
        x0, y0, x1, y1 = region
        for y in range(y0, y1+1):
            row = list(target[direction, step][y])
            row[x0:x1+1] = source[y][x0:x1+1]
            target[direction, step][y] = ''.join(row)

    regions = M._regions(frames['down', 1])
    frozen = copy.deepcopy(frames)
    for step in (0, 2):
        copy_region(frozen, 'down', step, frames['down', 1], regions['torso'])
    result = M.analyze(pal, frozen, base)
    check('motion-frozen-torso-cannot-hide-behind-head-and-feet',
          not result['ok'] and all(result['directions']['down']['torso'][str(s)]['changedPixels'] == 0 for s in (0, 2)))

    glitter = copy.deepcopy(frozen)
    x0, y0, x1, y1 = regions['torso']
    x, y = (x0+x1)//2, (y0+y1)//2
    for step, symbol in ((0, next(s for s in pal if s != '.' and s != frozen['down', 0][y][x])),
                         (2, next(s for s in reversed(pal) if s != '.' and s != frozen['down', 2][y][x]))):
        row = list(glitter['down', step][y]); row[x] = symbol; glitter['down', step][y] = ''.join(row)
    check('motion-one-pixel-glitter-does-not-animate-torso', not M.analyze(pal, glitter, base)['ok'])

    same_leg = copy.deepcopy(frames)
    copy_region(same_leg, 'down', 2, frames['down', 0], regions['legs'])
    result = M.analyze(pal, same_leg, base)
    check('motion-changing-arms-does-not-replace-alternating-feet',
          not result['ok'] and result['directions']['down']['legs']['changedPixels'] == 0)

    bob = copy.deepcopy(frames)
    # 두 걸음의 상체 bob 위상이 같아도 정상이다. 몸통 0↔2 차이를 강제하지 않는다.
    copy_region(bob, 'down', 2, frames['down', 0], regions['torso'])
    check('motion-same-torso-at-two-strides-allows-bob', M.analyze(pal, bob, base)['ok'])

    shifted = copy.deepcopy(frames)
    for direction in C.DIRS:
        for step, dy in ((0, -1), (2, -2)):
            shifted[direction, step] = [frames[direction, 1][y-dy] if 0 <= y-dy < C.FH else '.'*C.FW for y in range(C.FH)]
    result = M.analyze(pal, shifted, base)
    check('motion-shifted-standing-is-not-walking', not result['ok']
          and all(result['directions'][d]['rigidOffsets'][str(s)] is not None for d in C.DIRS for s in (0, 2)))

    # 일대일 색 치환은 RGBA만 달라지고 경계/팔다리의 상대 위치는 그대로다.
    tinted = copy.deepcopy(frames)
    expanded = dict(pal)
    free = [chr(i) for i in range(33, 127) if chr(i) not in pal and chr(i) not in '.#']
    used = sorted({c for row in frames['down', 1] for c in row if c != '.'})
    mapping = dict(zip(used, free))
    for c, replacement in mapping.items():
        r, g, b = pal[c]; expanded[replacement] = (r ^ 1, g, b)
    for step in (0, 2):
        tinted['down', step] = [''.join(mapping.get(c, c) for c in row) for row in frames['down', 1]]
    result = M.analyze(expanded, tinted, base)
    check('motion-palette-flicker-is-not-spatial-movement', not result['ok']
          and result['directions']['down']['torso']['0']['geometryPixels'] == 0)
    # Palettes must not become an accidental animation signal even after relabeling glyphs.
    renamed = {'.': None, **{mapping[c]: pal[c] for c in used}}
    check('motion-feature-map-independent-of-palette-symbols',
          M._features(M._cells(pal, frames['down', 1])) == M._features(M._cells(renamed, tinted['down', 0])))
