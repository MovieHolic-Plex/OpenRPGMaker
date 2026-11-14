#!/usr/bin/env python3
"""modern_city 한국 건물·옥상·시골 기물 참고문서 — 용도 `mc-kr-buildings` 하나를 src/assets/modernCityReferences.json 에 넣는다(있으면 갈아 끼운다).
사전(키트 id·크기·문 앞 접근 칸·실내 program·지붕 면·통행)과 급별 그림. 값은 전부 구운 정의(modernCityTileset.json)에서 읽는다.
그림은 public/assets/modern-city-kr-references/*.png — 번들 JSON 에는 경로만 둔다. bake_refs.py 가 JSON 을 통째로 다시 쓰므로 그 끝에서 references(ROOT) 를 다시 부른다.

  python3 scripts/content/modern-city-street/bake_kr_buildings.py     # 먼저 굽는다
  python3 scripts/content/modern-city-street/refs_kr_buildings.py
"""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
CAT_ID = 'mc-kr-buildings'
IMG_DIR = os.path.join(ROOT, 'public/assets/modern-city-kr-references')
URL = '/assets/modern-city-kr-references/'
D = os.path.join(ROOT, 'tiledata/modern-city/kr-buildings')
STORE = os.path.join(D, 'refs')
REFS = os.path.join(ROOT, 'src/assets/modernCityReferences.json')
WAIVER = 'fable-krbuildings-2026-11-14'
TIERS = [('small', '소형'), ('medium', '중형'), ('large', '대형'), ('xlarge', '초대형'), ('landmark', '랜드마크')]
BG = (122, 134, 140, 255)


def build():
    from PIL import Image
    ts = json.load(open(os.path.join(ROOT, 'src/assets/modernCityTileset.json'), encoding='utf-8'))
    sheet = Image.open(os.path.join(ROOT, 'public/assets/modern-city/modern-city-chipset.png')).convert('RGBA'); tpr = ts['tilesPerRow']
    kits = [k for k in ts['structureKits'] if k['id'].startswith(('mc-bld-kr-', 'mc-roof-kr-', 'mc-prop-krr-'))]

    def png(k):
        im = Image.new('RGBA', (k['width'] * 16, k['height'] * 16))
        for y, r in enumerate(k['rows']):
            for x in range(k['width']):
                for key in ('tiles', 'upperTiles'):
                    t = r[key][x]
                    if t >= 0: im.alpha_composite(sheet.crop(((t % tpr) * 16, (t // tpr) * 16, (t % tpr) * 16 + 16, (t // tpr) * 16 + 16)), (x * 16, y * 16))
        return im

    def strip(ks, name, caption, maxw=1600):
        rows = [[]]; w = 0
        for k in ks:
            if w + k['width'] * 16 + 6 > maxw and rows[-1]: rows.append([]); w = 0
            rows[-1].append(k); w += k['width'] * 16 + 6
        hs = [max(k['height'] for k in r) * 16 + 8 for r in rows]
        out = Image.new('RGBA', (min(maxw, max(sum(k['width'] * 16 + 6 for k in r) for r in rows) + 6), sum(hs)), BG); y = 0
        for r, h in zip(rows, hs):
            x = 6
            for k in r: out.alpha_composite(png(k), (x, y + h - 4 - k['height'] * 16)); x += k['width'] * 16 + 6
            y += h
        os.makedirs(IMG_DIR, exist_ok=True)
        out.convert('RGB').quantize(128).save(os.path.join(IMG_DIR, name), optimize=True)
        return dict(id='mc-img-kr-' + name[:-4], name=name, caption=caption + f' 원본 해상도 {out.width}×{out.height}(시트 칸 이어 붙임, 왼쪽부터 표의 순서). 3/4 관문 미통과 — 오너 면제 그림.', dataUrl=URL + name)

    tag = lambda k, p: next((t[len(p):] for t in k['ai']['tags'] if t.startswith(p)), None)
    bld = [k for k in kits if k['id'].startswith('mc-bld-kr-')]; roof = [k for k in kits if k['id'].startswith('mc-roof-kr-')]; rural = [k for k in kits if k['id'].startswith('mc-prop-krr-')]
    md = [f'# modern_city · 한국 건물 {len(bld)}종 · 옥상 기물 {len(roof)}종 · 시골 기물 {len(rural)}종', '',
          '현대 도시 칩셋 `modern_city`, 16px 칸, 시트 48열. 한국 도시(`compose_modern_city_street` 의 `korean:true`)와 한국 시골 장면에 쓰는 키트다.',
          f'**이 그림들은 3/4 관문 미통과 — 오너 면제 그림**(면제 묶음 {WAIVER}, Claude Fable 5.2 한 방 부품과 그 코드 조립)이다 — 스토어로는 나가지 않는다.',
          '원본 `tiledata/modern-city/kr-buildings/`(부품 parts/ · 조립법 recipes.txt · 굽는 그림 pieces/), 조립 `scripts/content/modern-city-street/kr_buildings_asm.py`, 굽기 `bake_kr_buildings.py`.', '',
          '## 1. 건물', '',
          '건물 한 채 = 키트 하나(위층 `upperTiles`). 키트의 모든 칸은 막힘이다. 그림은 정면 + 위에서 본 넓은 지붕 면이고, 문 앞 접근 칸은 **키트 바깥 한 줄 아래**(표의 접근 칸, 키트 원점 기준)다 — 그 칸이 걷는 땅이어야 한다.',
          '간판은 지어낸 이름이다. 지붕 면 칸(표의 «지붕 면»)에는 옥상 기물 키트(2절)를 4층에 더 얹을 수 있다 — «빈» 지붕은 얹어야 채워진다.', '']
    images = []
    for tid, tko in TIERS:
        ks = [k for k in bld if tag(k, 'tier:') == tid]
        if not ks: continue
        md += [f'### {tko} ({len(ks)})', '', '| 키트 id | 이름 | 크기 | 접근 칸 (dx,dy) | 실내 program | 지붕 면 (dx,dy · w×h) |', '|---|---|---|---|---|---|']
        for k in ks:
            acc = ' '.join(f"({a['dx']},{a['dy']})" for a in k['ai'].get('access', [])) or '없음(기념물)'
            rf = k['ai'].get('roofFace'); rtx = f"({rf['dx']},{rf['dy']}) · {rf['w']}×{rf['h']} · {'빈' if rf['empty'] else '기물 있음'}" if rf else '—'
            md.append(f"| `{k['id']}` | {k['name']} | {k['width']}×{k['height']} | {acc} | {k['ai'].get('program') or '—'} | {rtx} |")
        md.append('')
        images.append(strip(ks, f'bld-{tid}.png', f'한국 {tko} 건물 {len(ks)}종.'))
    if roof:
        md += ['## 2. 옥상 기물', '', '건물 키트를 찍은 뒤 그 지붕 면 칸 위 4층(겹침)에 키트째 찍는다. 땅에는 놓지 않는다. 이웃한 건물의 옥상이 같은 조합이 되지 않게 고른다.', '', '| 키트 id | 이름 | 크기 |', '|---|---|---|']
        md += [f"| `{k['id']}` | {k['name']} | {k['width']}×{k['height']} |" for k in roof] + ['']
        images.append(strip(roof, 'roof.png', f'한국 옥상 기물 {len(roof)}종.'))
    if rural:
        md += ['## 3. 시골 기물 — 장면 벌', '', '같은 벌(`kind:<벌>` 태그)끼리 모아 한 장면을 만든다. 통행: 키트 설명의 통행 줄(X 막힘 · * 사람 위 · . 밟는 바닥 그림, 위 줄부터). 바닥 그림(논·멍석·두둑·계단)은 아래층, 나머지는 위층.', '',
               '| 키트 id | 벌 | 이름 | 크기 | 층 |', '|---|---|---|---|---|']
        md += [f"| `{k['id']}` | {tag(k, 'kind:')} | {k['name']} | {k['width']}×{k['height']} | {'아래층(바닥 그림)' if k['ai']['layerHome'] == 'lower' else '위층'} |" for k in rural] + ['']
        images.append(strip(rural, 'rural.png', f'한국 시골 기물 {len(rural)}종.'))
    md += ['## 4. 놓는 순서', '', '1. 땅(보도·광장·흙·풀)을 깐다.', '2. 건물 키트를 위층에 찍는다 — 뒷줄 먼저, 앞줄 나중. 접근 칸이 걷는 땅인지 확인한다.', '3. 지붕 면에 옥상 기물을 4층에 얹는다(빈 지붕 먼저).',
           '4. 문 앞 접근 칸과 그 좌우 한 칸은 비운다. 건물 이름표에 문·접근 칸·program 을 적는다.', '5. 시골 기물은 벌마다 모아 놓고, 길 한가운데와 문 앞은 비운다.']
    doc = dict(id=CAT_ID, name=f'modern_city · 한국 건물 {len(bld)} · 옥상 기물 {len(roof)} · 시골 기물 {len(rural)} — 사전·놓는 순서', markdown='\n'.join(md))
    cat = dict(id=CAT_ID, name='현대 도시 · 한국 건물·옥상·시골 기물',
               description=f'modern_city 한국 건물 {len(bld)}종(소형·중형·대형·초대형·랜드마크) · 옥상 기물 {len(roof)}종 · 시골 기물 {len(rural)}종 — 사전(크기·접근 칸·program·지붕 면)과 급별 그림. 3/4 관문 미통과 — 오너 면제 그림({WAIVER}).',
               documents=[doc], images=images)
    ids = {k['id'] for k in ts['structureKits']}
    import re
    for kid in re.findall(r'`(mc-[a-z0-9-]+)`', doc['markdown']): assert kid in ids or kid == 'mc-kr-buildings', kid      # 문서의 키트 id 는 전부 정의에 있다
    os.makedirs(STORE, exist_ok=True)
    json.dump(cat, open(os.path.join(STORE, 'category.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    open(os.path.join(STORE, CAT_ID + '.md'), 'w', encoding='utf-8').write(doc['markdown'] + '\n')
    return cat


def references(root=ROOT):
    """bake_refs.py 가 부른다 — 저장된 용도 하나(없으면 None)."""
    p = os.path.join(root, 'tiledata/modern-city/kr-buildings/refs/category.json')
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else None


def install(cat):
    refs = json.load(open(REFS, encoding='utf-8'))
    refs = [c for c in refs if c['id'] != CAT_ID] + [cat]
    json.dump(refs, open(REFS, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    return refs


if __name__ == '__main__':
    cat = build(); refs = install(cat)
    print(CAT_ID, 'docs', len(cat['documents']), 'images', len(cat['images']), '· categories', len(refs), '· img KB', sum(os.path.getsize(os.path.join(IMG_DIR, f)) for f in os.listdir(IMG_DIR)) // 1024)
