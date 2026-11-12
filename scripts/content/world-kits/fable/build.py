#!/usr/bin/env python3
"""그린 그림 → 굽기 입력(모델 없음): python3 scripts/content/world-kits/fable/build.py <세계>

읽는 것: tiledata/<세계>/variety/src/<주문 id>.png (draw.py 가 쓴 그림, 한 화소도 고치지 않은 원본)
쓰는 것: tiledata/<세계>/variety/pieces/<키트 id>.png · spec.json(굽기가 읽는 목록) · waiver-manifest.json(object-gate owner-waive 입력) · build-report.json
- 변형(variantOf): 원본 키트가 비운 칸의 화소는 지운다(원본 자리에 그대로 들어가야 한다 — kitLook.fitsWhereBaseFits). 원본이 그린 칸을 비운 그림은 버린다(통행이 달라진다).
  칸마다 통행 종류는 원본 키트 칸 그대로(굽기가 같은 칸에 같은 통행을 준다).
- 벽면 가족(ACCENTS): 창 난 벽·벽감 벽은 벽면 변형마다 «그 벽면 + 원본 가족 그림이 벽면과 다른 화소» 로 같은 순번의 변형을 만든다(lookWith = 벽면 원본).
- 집: 지붕(왼·오 반쪽이면 이어 붙여) + 벽을 위아래로 잇는다. 문 칸 = 원본의 입구 칸(새 집은 주문의 문 칸).
- 바닥 재질: 재질 칸 두 장(A·B)을 그대로 한 칸 바닥으로 쓰고, 모서리 왕 타일(길·풀·사구·포석 가장자리)은 desert_east 의 왕 타일 그리기 코드에
  새 재질을 넣어 만든다(가장자리 꼴·꾸밈은 원래 코드, 재질 화소만 그림에서). 원래 재질 램프의 꾸밈 화소는 새 재질의 가장 가까운 밝기 색으로 옮긴다.
- 1배에서 읽히지 않는 그림은 build-report 의 dropped 에 적고 굽지 않는다(드롭 목록은 worlds/<세계>.py 의 DROP).
"""
import hashlib, json, os, sys
import numpy as np
from PIL import Image
import wk_common as C

T = 16


def lum(c): return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def opaque(im):
    """불투명 계약 그림(지붕·벽·벽면): 모델이 행 끝을 한두 화소 모자라게 써서 생긴 투명 화소를 왼쪽(없으면 오른쪽) 이웃 색으로 채운다. 채운 화소 수를 돌려준다."""
    a = np.array(im.convert('RGBA')); n = 0
    for y in range(a.shape[0]):
        for x in range(a.shape[1]):
            if a[y, x, 3] == 0:
                nx = x - 1 if x else x + 1
                while 0 <= nx < a.shape[1] and a[y, nx, 3] == 0: nx += -1 if x else 1
                if 0 <= nx < a.shape[1]: a[y, x] = a[y, nx]; n += 1
    return Image.fromarray(a, 'RGBA'), n


def main():
    W = C.World(sys.argv[1])
    m = W.mod
    jobs = {j['id']: j for j in m.jobs(W)}
    drop = dict(getattr(m, 'DROP', {}))
    os.makedirs(W.pieces, exist_ok=True)
    for f in os.listdir(W.pieces):
        if f.endswith('.png'): os.remove(os.path.join(W.pieces, f))
    items, report = [], dict(variants=0, houses=0, objects=0, looks=0, dropped=[], missing=[])

    def save(kid, im):
        p = os.path.join(W.pieces, kid + '.png'); im.save(p); return os.path.relpath(p, C.ROOT)

    # ── 변형·새 기물 ──
    for jid, j in jobs.items():
        if j.get('house') or j['cls'] == 'ground': continue
        im = W.src_png(jid)
        if im is None: report['missing'].append(jid); continue
        if jid in drop: report['dropped'].append(dict(id=jid, why=drop[jid])); continue
        if j.get('variantOf'):
            base = j['variantOf']; pcs = W.kit_pcs(base); k = W.kits[base]
            if j['contract'] == 'wallface':
                im, n = opaque(im)
                if n: report.setdefault('filled', {})[jid] = n
            a = np.array(im)
            bad = []
            for y in range(k['height']):
                for x in range(k['width']):
                    cell = a[y * T:(y + 1) * T, x * T:(x + 1) * T]
                    if (x, y) not in pcs: cell[...] = 0
                    elif not (cell[..., 3] > 0).any(): bad.append((x, y))
            if bad: report['dropped'].append(dict(id=jid, why=f'원본이 그린 칸 {bad} 을 비웠다(통행이 달라진다)')); continue
            kid = PREFIX(W) + jid[2:]
            src = save(kid, Image.fromarray(a, 'RGBA'))
            items.append(dict(type='variant', id=kid, variantOf=base, src=src, gate=j['gate'], w=k['width'], h=k['height'], en=j['text'].rstrip('.'),
                              cells=[[x, y, pc] for (x, y), pc in sorted(pcs.items(), key=lambda kv: (kv[0][1], kv[0][0]))]))
            report['variants'] += 1
        elif j.get('obj'):
            o = dict(j['obj']); kid = PREFIX(W) + o['id']
            src = save(kid, im)
            items.append(dict(type='object', src=src, gate=j['gate'], **{**o, 'id': kid}))
            report['objects'] += 1

    # ── 벽면에 이어 붙는 가족: 벽면 변형 + 원본 가족 그림의 덧화소 ──
    for acc, wall in getattr(m, 'ACCENTS', []):
        a0, b0 = np.array(W.kit_image(acc)), np.array(W.kit_image(wall))
        diff = (a0 != b0).any(axis=2)
        k = W.kits[acc]; pcs = W.kit_pcs(acc)
        for it in [it for it in items if it['type'] == 'variant' and it['variantOf'] == wall]:
            v = np.array(Image.open(os.path.join(C.ROOT, it['src'])).convert('RGBA')); v[diff] = a0[diff]
            kid = acc + it['id'][len(wall):]
            src = save(kid, Image.fromarray(v, 'RGBA'))
            items.append(dict(type='variant', id=kid, variantOf=acc, lookWith=wall, src=src, gate=it['gate'], w=k['width'], h=k['height'], en=it['en'] + ' — with the opening of the original piece',
                              cells=[[x, y, pc] for (x, y), pc in sorted(pcs.items(), key=lambda kv: (kv[0][1], kv[0][0]))]))
            report['variants'] += 1; report['accents'] = report.get('accents', 0) + 1

    # ── 집 ──
    houses = {}
    for jid, j in jobs.items():
        if j.get('house'): houses.setdefault(j['house']['id'], j['house'])
    for hid, h in houses.items():
        parts = {p: W.src_png(f'{hid}-{p}') for p in ('roof', 'roofl', 'roofr', 'wall')}
        roof = parts['roof']
        if roof is None and parts['roofl'] is not None and parts['roofr'] is not None:
            roof = Image.new('RGBA', (parts['roofl'].width + parts['roofr'].width, parts['roofl'].height))
            roof.alpha_composite(parts['roofl'], (0, 0)); roof.alpha_composite(parts['roofr'], (parts['roofl'].width, 0))
        if roof is None or parts['wall'] is None: report['missing'].append(hid); continue
        roof, n1 = opaque(roof); wall, n2 = opaque(parts['wall'])
        if n1 + n2: report.setdefault('filled', {})[hid] = n1 + n2
        parts['wall'] = wall
        if hid in drop: report['dropped'].append(dict(id=hid, why=drop[hid])); continue
        im = Image.new('RGBA', (h['w'] * T, h['h'] * T)); im.alpha_composite(roof, (0, 0)); im.alpha_composite(parts['wall'], (0, roof.height))
        a = np.array(im)
        holes = [(x, y) for y in range(h['h']) for x in range(h['w']) if not (a[y * T:(y + 1) * T, x * T:(x + 1) * T, 3] > 0).any()]
        if holes: report['dropped'].append(dict(id=hid, why=f'빈 칸 {holes}')); continue
        kid = PREFIX(W) + hid[2:]
        if h.get('base'): kid = PREFIX(W) + 'v-' + h['base'][len(PREFIX(W)):] + hid[hid.rindex('-'):]
        src = save(kid, im)
        items.append(dict(type='house', id=kid, variantOf=h.get('base'), name=h['ko'], src=src, gate='structure', w=h['w'], h=h['h'], entrance=h['ent'],
                          en=next(j['text'] for j in jobs.values() if j.get('house', {}).get('id') == hid).split('. Draw ONLY')[0]))
        report['houses'] += 1

    # ── 바닥 재질 → 한 칸 바닥 + 모서리 왕 타일 ──
    looks = m.build_looks(W, lambda name: (W.src_png(f't-{name}-a'), W.src_png(f't-{name}-b')), save, report) if hasattr(m, 'build_looks') else None

    spec = dict(_doc='테마 세계 칩셋 늘리기 첫 판 — scripts/content/world-kits/fable/build.py 가 쓴다(손으로 고치지 않는다). 그림은 Claude Fable 5.2 medium 한 방과 그 코드 조립 · '
                     '3/4 관문 미통과 — 오너 면제 묶음(waiver). 변형은 원본 키트와 칸 크기·통행이 같고 ai.variantOf 로 굽는다.',
                waiver=m.WAIVER, license='drawn by Claude Fable 5.2 for this project (own work)', items=items, looks=looks)
    json.dump(spec, open(os.path.join(W.dir, 'spec.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    # 이야기 기물 탐침(scripts/content/story-objects/probe.mts)이 읽는 꼴 — 새 기물만, id 는 머리말 없이
    objs = [dict(id=it['id'][len(W.prefix):], src=os.path.basename(it['src']), name=it['name'], en=it['en'], kind=it['kind'], w=it['w'], h=it['h'], place=it['place'], block=it['block'], words=it['words']) for it in items if it['type'] == 'object']
    json.dump(dict(_doc='새 기물만 탐침 꼴로(build.py 가 쓴다 — 굽기는 spec.json 을 읽는다).', waiver=m.WAIVER, items=objs), open(os.path.join(W.dir, 'objects.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    gate_items = [dict(png=it['src'], kind=it['gate'], chipset=W.id, label=f'{it["type"]}/{it["id"]}') for it in items]
    for lk in (looks or {}).get('pieces', []): gate_items.append(dict(png=lk['src'], kind='terrain', chipset=W.id, label=f'look/{lk["id"]}'))
    json.dump(dict(note=f'object-gate owner-waive 의 --manifest 입력(저장소 뿌리에서 돌린다). 묶음 {m.WAIVER}. Fable 5.2 medium 한 방 그림과 그 코드 조립(빈 칸 지우기·지붕+벽 잇기·재질로 만든 왕 타일).', items=gate_items),
              open(os.path.join(W.dir, 'waiver-manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    json.dump(report, open(os.path.join(W.dir, 'build-report.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(json.dumps({k: (v if not isinstance(v, list) else len(v)) for k, v in report.items()}, ensure_ascii=False), 'gate items', len(gate_items))
    for d in report['dropped']: print('  버림', d)


def PREFIX(W): return W.prefix


if __name__ == '__main__':
    main()
