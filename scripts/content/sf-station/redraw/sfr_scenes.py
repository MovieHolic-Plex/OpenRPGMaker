"""구성기 출력(compose_probe out.json) → 장면 그림. 같은 구성기 호출·같은 씨앗의 전/후. 주인공(Actor1 첫 칩) + 사람 3명을 지나갈 수 있는 칸에 세운다(문 앞·기물 옆·빈 바닥)."""
import json, sys
from PIL import Image
import sfr_lib as L
H = L.HERE


def load(which):
    if which == 'before': return json.load(open(f'{H}/before/sfStationTileset.json')), Image.open(f'{H}/before/sf-station-chipset.png').convert('RGBA')
    return json.load(open(f'{L.REPO}/src/assets/sfStationTileset.json')), Image.open(f'{L.REPO}/public/assets/sf-station/sf-station-chipset.png').convert('RGBA')


def render(ex, data, sheet, people=True):
    W, Hh = ex['w'], ex['h']; n = data['tilesPerRow']
    im = Image.new('RGBA', (W * 16, Hh * 16), (0, 0, 0, 255))
    cell = lambda t: sheet.crop(((t % n) * 16, (t // n) * 16, (t % n) * 16 + 16, (t // n) * 16 + 16))
    l2 = ex.get('l2') or [-1] * (W * Hh)
    for i in range(W * Hh):
        for t in (ex['lower'][i], l2[i]):
            if t >= 0: im.alpha_composite(cell(t), ((i % W) * 16, (i // W) * 16))
    ppl = []
    if people:
        ok = lambda x, y: 0 <= x < W and 0 <= y < Hh and all(t < 0 or data['passability'][t]['up'] for t in (ex['lower'][y * W + x], l2[y * W + x], ex['upper'][y * W + x])) and ex['lower'][y * W + x] >= 0
        sp = ex['spawn']; cand = [(sp['x'], sp['y'])]
        for a in ex['areas']:
            d = a.get('door')
            if d: cand.append((d['x'], d['y'] + 1)); cand.append((d['x'], d['y'] - 1))
        kits = {k['id']: k for k in data['structureKits']}
        for p in ex['placed']:
            k = kits.get('sf-' + p['id'])
            if k: cand.append((p['x'] + k['width'] // 2, p['y'] + k['height']))
        seen = set()
        for (x, y) in cand:
            if ok(x, y) and (x, y) not in seen and all(abs(x - a) + abs(y - b) > 4 for a, b in seen):
                seen.add((x, y)); ppl.append((x, y))
            if len(ppl) >= 5: break
    # 위층은 사람 위에 그린다(★ 칸) — 런타임과 같게: 사람을 먼저, 위층을 나중에... 가 아니라 막힌 위층 칸은 사람이 못 가므로 위층 → 사람 순서로 그려도 같다. ★ 칸만 사람 위.
    star = lambda t: t >= 0 and data['priority'][t] != 'lower' and data['passability'][t]['up']
    for i in range(W * Hh):
        t = ex['upper'][i]
        if t >= 0 and not star(t): im.alpha_composite(cell(t), ((i % W) * 16, (i // W) * 16))
    for k, (x, y) in enumerate(ppl):
        im.alpha_composite(L.chip([0, 1, 5, 2, 6][k]), (x * 16 - 4, (y + 1) * 16 - 31))
    for i in range(W * Hh):
        t = ex['upper'][i]
        if star(t): im.alpha_composite(cell(t), ((i % W) * 16, (i // W) * 16))
    return im


if __name__ == '__main__':
    which = sys.argv[1]; src = json.load(open(f'{H}/probe/{which}.json')); data, sheet = load(which)
    for spec, ex in src.items():
        im = render(ex, data, sheet); name = spec.replace(':', '-')
        im.save(f'{H}/look/scene-{which}-{name}.png'); print(spec, im.size)
