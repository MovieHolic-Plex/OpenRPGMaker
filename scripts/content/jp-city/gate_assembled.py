#!/usr/bin/env python3
"""상가 입면 띠(jp-sf-*)는 건물의 부품이라 윗면을 혼자 보일 수 없다 → 띠 + 위층 + 지붕을 조립기(src/editor/jpCity/builder.ts)가 짓는 대로 합친
「조립 건물」 그림을 kind=structure 로 object-gate 에 낸다(같은 판정자·같은 기준). 띠가 조립 그림 안에 화소 그대로 들어 있고 그 그림이 통과해야 띠가 덮인다.
사용: python3 scripts/content/jp-city/gate_assembled.py [build]   -> tiledata/jp-city/blocks/_gate_assembled/*.png + manifest.json + /tmp/jp-asm-chunk-N.jsonl
조립 입력은 jpCityStreetComposer.ts 의 LOOKS 첫 항목(층 수는 하한)을 따른다. 한 장에 폭 3~6 / 7~9 건물을 한 줄로 세운다(띠마다 따로 그리면 118장이라 비싸다)."""
from __future__ import annotations
import json, os, subprocess, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
OUT = os.path.join(REPO, 'tiledata', 'jp-city', 'blocks', '_gate_assembled')
STRIP_DIR = os.path.join(REPO, 'tiledata', 'jp-city', 'blocks', 'street_hand', '_gate')
SHEET = os.path.join(REPO, 'public', 'assets', 'jp-city', 'jp-city-chipset.png')
MANIFEST = os.path.join(OUT, 'manifest.json')
GROUPS = ((3, 4, 5, 6), (7, 8, 9))
GAP = 16

# jpCityStreetComposer.ts LOOKS(첫 항목, 층 수 하한)·ROLE_DOORS(첫 항목). tower 의 띠는 office 키트(jp-sf-office-*)를 쓴다.
LOOK = {
    'tower': dict(ground='gr.glass.sora', floorKind='ribbon', floors=7, wall='conc', roof='roof.hip', door='lobby'),
    'konbini': dict(ground='gr.konbini.0', floorKind='curtain', floors=2, wall='kinari', roof='roof.hip', door='auto'),
    'izakaya': dict(ground='gr.izakaya', floorKind='pairs', floors=2, wall='kinari', roof='roof.hip', door='noren'),
    'ramen': dict(ground='gr.izakaya', floorKind='pairs', floors=1, wall='kinari', roof='roof.hip', door='noren'),
    'cafe': dict(ground='gr.glass.kii', floorKind='veranda', floors=1, wall='shiro', roof='roof.hip', door='cafe'),
    'shop': dict(ground='gr.shutter.aka', floorKind='slide', floors=1, wall='kinari', roof='roof.hip', door='steel'),
    'bento': dict(ground='gr.glass.aka', floorKind='pairs', floors=1, wall='kinari', roof='roof.hip', door='cafe'),
    'office': dict(ground='gr.glass.sora', floorKind='slide', floors=3, wall='conc', roof='roof.hip', door='lobby'),
    'apartment': dict(ground='gr.shutter.kii', floorKind='veranda', floors=3, wall='shiro', roof='roof.hip', door='lobby'),
    'house': dict(ground='gr.machiya', floorKind='tile', floors=1, wall='kinari', roof='roof.tile', door='house'),
    'machiya': dict(ground='gr.machiya', floorKind='tile', floors=1, wall='kinari', roof='roof.tile', door='lattice'),
    'sento': dict(ground='gr.machiya', floorKind='tile', floors=1, wall='hodo', roof='roof.tile', door='lattice'),
}
OVERRIDE = {}   # (role,w) -> dict(...) 표본별 지붕 교체 자리. 기본 지붕: 평지붕(roof.plain.* — 윗면 판정 대부분 불합격, 2026-10-13 실측 6/7 fail)이 아니라 윗면이 보이는 roof.hip(composer 의 ROOFS_TILE 중 하나)


def strips() -> list[tuple[str, str, int, str]]:
    """(kit id, role, w, side)"""
    out = []
    for f in sorted(os.listdir(STRIP_DIR)):
        if not f.startswith('jp-sf-') or not f.endswith('.png'): continue
        role, w, side = f[6:-4].rsplit('-', 2)
        out.append((f[:-4], role, int(w), side))
    return out


def sample_name(role, side, grp): return f'{role}-{side}-w{grp[0]}to{grp[-1]}'


def plan():
    """표본 = (role, side, 폭 묶음). 묶음 안에 그 (role,side)의 띠가 하나라도 있는 폭만 건물을 세운다."""
    by = {}
    for kid, role, w, side in strips(): by.setdefault((role, side), {})[w] = kid
    samples = []
    for (role, side), ws in sorted(by.items()):
        for grp in GROUPS:
            members = [(w, ws[w]) for w in grp if w in ws]
            if members: samples.append(dict(name=sample_name(role, side, grp), role=role, side=side, members=members))
    return samples


def build():
    os.makedirs(OUT, exist_ok=True)
    samples = plan()
    req = []
    for s in samples:
        for w, kid in s['members']:
            L = dict(LOOK[s['role'] if s['role'] in LOOK else 'office'], **OVERRIDE.get((s['role'], w), {}))
            req.append(dict(name=kid, role=s['role'], w=w, side=s['side'], floors=L['floors'], floorKind=L['floorKind'], wall=L['wall'], ground=L['ground'], roof=L['roof'], doorType=L['door']))
    tmp_in, tmp_out = '/tmp/jp-asm-in.json', '/tmp/jp-asm-out.json'
    json.dump(req, open(tmp_in, 'w'))
    r = subprocess.run(['node', os.path.join(HERE, 'gate_assembled.mjs'), tmp_in, tmp_out], cwd=REPO, capture_output=True, text=True)
    if r.returncode: print(r.stdout[-2000:], r.stderr[-2000:]); sys.exit(2)
    res = json.load(open(tmp_out))
    sheet = Image.open(SHEET).convert('RGBA')
    T = 16
    def cell(t):
        tpr = sheet.width // T
        return sheet.crop(((t % tpr) * T, (t // tpr) * T, (t % tpr) * T + T, (t // tpr) * T + T))
    man, rows, bad = {}, [], 0
    for s in samples:
        parts = []
        for w, kid in s['members']:
            d = res[kid]
            if not d['ok']: print('조립 실패', kid, d['errors'][:2]); bad += 1; continue
            R = d['rect']; im = Image.new('RGBA', (R['w'] * T, R['h'] * T), (0, 0, 0, 0))
            for p in d['placements']:
                ry = p['y'] - R['y0']; rx = p['x'] - R['x0']
                for key in ('lower', 'upper', 'overlay'):
                    t = p.get(key)
                    if t is None or (key != 'lower' and ry >= R['h'] - 3): continue   # 아래 3줄: 조립기 위층·덧그림은 stamp_layer_block 이 비운다
                    im.alpha_composite(cell(t), (rx * T, ry * T))
            strip = Image.open(os.path.join(STRIP_DIR, kid + '.png')).convert('RGBA')
            assert strip.size == (w * T, 48), (kid, strip.size)
            sy = (R['h'] - 3) * T
            im.alpha_composite(strip, (0, sy))
            parts.append((kid, w, im, sy))
        Wt = sum(p[2].width for p in parts) + GAP * (len(parts) - 1); Ht = max(p[2].height for p in parts)
        sheet_im = Image.new('RGBA', (Wt, Ht), (0, 0, 0, 0)); x = 0; strips_meta = []
        for kid, w, im, sy in parts:
            oy = Ht - im.height; sheet_im.alpha_composite(im, (x, oy)); strips_meta.append(dict(id=kid, x=x, y=oy + sy)); x += im.width + GAP
        png = os.path.join(OUT, s['name'] + '.png'); sheet_im.save(png)
        man[s['name']] = dict(png=png, role=s['role'], side=s['side'], strips=strips_meta)
        rows.append(dict(png=png, kind='structure', name='asm-' + s['name'], label='jp_city/assembled/' + s['name']))
    json.dump(man, open(MANIFEST, 'w'), ensure_ascii=False, indent=1)
    for old in os.listdir('/tmp'):
        if old.startswith('jp-asm-chunk-'): os.remove('/tmp/' + old)
    n = 0
    for i in range(0, len(rows), 15):
        n += 1
        with open(f'/tmp/jp-asm-chunk-{n}.jsonl', 'w', encoding='utf-8') as f:
            for r_ in rows[i:i + 15]: f.write(json.dumps(r_, ensure_ascii=False) + '\n')
    print(f'표본 {len(rows)}장(띠 {sum(len(m["strips"]) for m in man.values())}개), 조립 실패 {bad} -> /tmp/jp-asm-chunk-1..{n}.jsonl')


def covering(kid: str, context: str = 'bundle') -> tuple[str | None, str]:
    """띠 kid 를 화소 그대로 품은 조립 그림 중 영수증이 통과인 것. (표본 이름 또는 None, 이유). 모델 호출 없음."""
    import object_gate as OG
    if not os.path.exists(MANIFEST): return None, '조립 표본 없음(gate_assembled.py build)'
    man = json.load(open(MANIFEST))
    strip = np.asarray(Image.open(os.path.join(STRIP_DIR, kid + '.png')).convert('RGBA'))
    why_last = '이 띠를 품은 조립 표본이 없다'
    for name, m in man.items():
        for st in m['strips']:
            if st['id'] != kid: continue
            if not os.path.exists(m['png']): why_last = '조립 그림 파일 없음'; continue
            im = np.asarray(Image.open(m['png']).convert('RGBA'))
            h, w = strip.shape[:2]; x, y = st['x'], st['y']
            sub = im[y:y + h, x:x + w] if y + h <= im.shape[0] and x + w <= im.shape[1] else None
            if sub is None or not np.array_equal(sub[..., 3] > 0, strip[..., 3] > 0) or not np.array_equal(sub[strip[..., 3] > 0], strip[strip[..., 3] > 0]):
                why_last = f'띠 그림이 조립 표본 {name} 에 화소 그대로 들어 있지 않다(띠를 다시 그렸다 — gate_assembled.py build 후 다시 판정)'; continue
            why = OG.refusal(m['png'], kind='structure', context=context)
            if why is None or '보정되지 않았다' in why: return name, ('provisional' if why else 'pass')
            why_last = f'조립 표본 {name}: {why}'
    return None, why_last


if __name__ == '__main__':
    build()
