#!/usr/bin/env python3
"""jp_city 시설 실내 문 부품 -> 조립 방 조각 그림(3/4 관문용).

문(door 16x32 · sidedoor 16x48)은 칸막이 틈에 끼우는 부품이라 혼자서는 윗면이 없다. 예제 맵을 조수 도구 그대로 지은 그림
(`verify-shots/jp-city/interior-<맵>-1x.png`, maps/interior.mjs 가 쓴다)에서 문이 화소 그대로 들어간 자리를 찾아,
문 둘레 5x5 칸(칸막이 윗면 = 천장 띠 + 벽면 + 문)을 잘라 kind `structure` 로 같은 판정자·같은 기준에 낸다.
문을 한 화소라도 다시 그리면 그 조각이 문을 화소 그대로 품지 않게 되어 덮임이 풀린다(gate_assembled.py 와 같은 규칙).

  python3 scripts/content/jp-city/gate_rooms.py            # 조각 + manifest.json + items.jsonl(object-gate review --batch 입력)
"""
from __future__ import annotations
import json, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
OUT = os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks', '_gate_rooms')
MANIFEST = os.path.join(OUT, 'manifest.json')
SHOTS = os.path.join(ROOT, 'verify-shots', 'jp-city')
INST_BLOCKS = ('interior_hospital', 'interior_school2', 'interior_office2')
# 다른 블록이 직접 내보내는 조립 그림 목록(부품 → 조립 그림). 거리 계단(2026-10-22): 상판·단상·옆 계단·곧은 계단은 육교·단상 조립 그림이 덮는다.
EXTRA_MANIFESTS = (os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks', 'street_stairs', '_gate', 'assembled.json'),)
T = 16


def parts():
    """[(블록, id, 그림 경로)] — kinds.json 에서 종류 part 인 것."""
    out = []
    for b in INST_BLOCKS:
        kj = os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks', b, '_gate', 'kinds.json')
        if not os.path.exists(kj): continue
        for k, v in json.load(open(kj, encoding='utf-8')).items():
            if v == 'part': out.append((b, k, os.path.join(os.path.dirname(kj), k + '.png')))
    return out


def find(img, part):
    """part 의 불투명 화소가 img 안 칸 정렬 자리에 화소 그대로 있으면 (x, y) 목록."""
    ph, pw = part.shape[:2]; m = part[..., 3] > 0
    hits = []
    for y in range(0, img.shape[0] - ph + 1, T):
        for x in range(0, img.shape[1] - pw + 1, T):
            sub = img[y:y + ph, x:x + pw]
            if np.array_equal(sub[m][:, :3], part[m][:, :3]): hits.append((x, y))
    return hits


def build():
    os.makedirs(OUT, exist_ok=True)
    shots = sorted(f for f in os.listdir(SHOTS) if f.startswith('interior-') and f.endswith('-1x.png')) if os.path.isdir(SHOTS) else []
    man, lines, missing = {}, [], []
    for b, pid, png in parts():
        part = np.asarray(Image.open(png).convert('RGBA'))
        got = 0
        for f in shots:
            img = np.asarray(Image.open(os.path.join(SHOTS, f)).convert('RGBA'))
            for (x, y) in find(img, part)[:2]:
                # 문 칸 위 1줄(인방·칸막이 윗면) + 문 + 아래 1줄, 좌우 2칸
                x0, y0 = max(0, x - 2 * T), max(0, y - 2 * T)
                x1, y1 = min(img.shape[1], x + 3 * T), min(img.shape[0], y + part.shape[0] + T)
                crop = img[y0:y1, x0:x1].copy()
                name = '%s__%s_%d_%d' % (pid, f[len('interior-'):-len('-1x.png')], x // T, y // T)
                p = os.path.join(OUT, name + '.png'); Image.fromarray(crop, 'RGBA').save(p)
                man[name] = dict(png=p, part=pid, block=b, x=x - x0, y=y - y0, source=f)
                lines.append(dict(png=p, kind='structure', name='interior doorway in a partition wall (%s)' % pid, label='jp_city/rooms/' + name))
                got += 1
            if got >= 2: break
        if not got: missing.append(pid)
    json.dump(man, open(MANIFEST, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    with open(os.path.join(OUT, 'items.jsonl'), 'w', encoding='utf-8') as fo:
        for m in lines: fo.write(json.dumps(m, ensure_ascii=False) + '\n')
    print('조립 방 조각 %d장 (문 부품 %d개, 예제에 안 쓰인 부품 %s)' % (len(man), len(parts()), missing or '없음'))
    return missing


def covering(pid: str, png: str, context: str = 'bundle'):
    """문 부품 pid 를 화소 그대로 품은 조각 중 영수증이 통과인 것 → (조각 이름, 상태) 또는 (None, 이유)."""
    man = {}
    if os.path.exists(MANIFEST): man.update(json.load(open(MANIFEST, encoding='utf-8')))
    for extra in EXTRA_MANIFESTS:                 # 다른 블록의 조립 그림 목록(거리 계단 등) — png 는 저장소 상대 경로
        if os.path.exists(extra):
            for k, e in json.load(open(extra, encoding='utf-8')).items():
                man[k] = dict(e, png=e['png'] if os.path.isabs(e['png']) else os.path.join(ROOT, e['png']))
    if not man: return None, '조립 방 조각 없음(gate_rooms.py)'
    part = np.asarray(Image.open(png).convert('RGBA')); m = part[..., 3] > 0
    why = '이 문을 품은 조립 방 조각이 없다'
    import gate_kinds as GK
    for name, e in man.items():
        if e['part'] != pid: continue
        if not os.path.exists(e['png']): why = '조각 파일 없음'; continue
        im = np.asarray(Image.open(e['png']).convert('RGBA'))
        sub = im[e['y']:e['y'] + part.shape[0], e['x']:e['x'] + part.shape[1]]
        if sub.shape[:2] != part.shape[:2] or not np.array_equal(sub[m][:, :3], part[m][:, :3]):
            why = '문 그림이 조각 %s 에 화소 그대로 없다(다시 그렸다 — gate_rooms.py 후 다시 판정)' % name; continue
        st, w2 = GK.state(e['png'], 'structure', context)
        if st: return name, st
        why = '조각 %s: %s' % (name, w2)
    return None, why


if __name__ == '__main__':
    sys.exit(1 if build() else 0)
