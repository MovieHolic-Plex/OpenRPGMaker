#!/usr/bin/env python3
"""jp_city 이야기 기물 참고문서 — 용도 `jp-story-objects` 하나를 src/assets/jpCityReferences.json 에 넣는다(있으면 갈아 끼운다).
계약 tiledata/AI-REFERENCE-CONTRACT.md: 사전(칸 번호)·실행 순서·조립 예제 전체 배열·정상/오류 그림·좌표 검사. 문서 틀은 칩셋 공용 scripts/content/story-objects/refs_lib.py.
그림은 public/assets/jp-city-story-references/*.png — 번들 JSON 에는 경로만 둔다(바이트 없음). bake_refs.py 의 그림 폴더(jp-city-references)는 그 굽기가 안 쓰는 PNG 를 지우므로 따로 둔다.
bake_refs.py 가 JSON 을 통째로 다시 쓰므로 그 끝에서 references(ROOT) 로 이 용도를 다시 붙이고, kit_ids(ROOT) 를 «문서에 실린 키트» 로 센다.

  python3 scripts/content/jp-city/bake_jp.py      # 먼저 굽는다(블록 story_objects)
  python3 scripts/content/jp-city/refs_story.py
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, os.path.join(HERE, '..', 'story-objects'))

CAT_ID = 'jp-story-objects'
IMG_DIR = os.path.join(ROOT, 'public/assets/jp-city-story-references')
URL = '/assets/jp-city-story-references/'
OBJ = os.path.join(ROOT, 'tiledata/jp-city/objects')
STORE = os.path.join(OBJ, 'refs')
REFS = os.path.join(ROOT, 'src/assets/jpCityReferences.json')
GROUND_AUTOTILE = 'jp-gravel-lawn'      # 자갈 참배길 — 속칸(이웃 8방 모두 같은 땅, variantMap 255)을 예제 바닥으로 쓴다
SCENE = [('spring-basin', 2, 1)]         # (기물, 왼쪽 위 x, y) — 6×5 자갈 장면


def build():
    from PIL import Image
    import refs_lib
    ts = json.load(open(os.path.join(ROOT, 'src/assets/jpCityTileset.json'), encoding='utf-8'))
    ground = next(a for a in ts['autotileGroups'] if a['id'] == GROUND_AUTOTILE)['variantMap']['255']
    assert ts['passability'][ground]['up'], ground
    spec = json.load(open(os.path.join(OBJ, 'spec.json'), encoding='utf-8'))
    sheet = Image.open(os.path.join(ROOT, 'public/assets/jp-city/jp-city-chipset.png')).convert('RGBA')
    names = '·'.join(it['name'].split('(')[0] for it in spec['items'])
    doc, images, evidence = refs_lib.build(dict(
        tileset=ts, sheet=sheet, spec=spec, kit_prefix='jp-', chipset='jp_city', doc_id='jp-story-objects', img_id='jp-img-story-', img_dir=IMG_DIR, url=URL,
        scene=SCENE, size=(6, 5), ground=lambda x, y: ground,
        title=f"jp_city · 이야기 기물 {len(spec['items'])}종({names})",
        head=f"일본 도시 칩셋 `jp_city`(텍스처 `tex_jp_city`, {ts['count']}칸, 16px 칸, 시트 {ts['tilesPerRow']}열 — 번호 n 의 칸은 열 n%{ts['tilesPerRow']}, 행 n÷{ts['tilesPerRow']}). 신사 경내·공원·마을 어귀에 쓰는 위층 키트다.",
        ground_note='흙·자갈·잔디', compose_tool='compose_jp_city_street',
        order_notes=['샘(2×2)은 신사 경내·공원·마을 어귀·산길 쉼터의 흙·자갈·잔디 위에 — 둘레 한 칸은 걷는 바닥으로 비운다. 차도·횡단보도·건물 문 앞 접근칸에는 놓지 않는다.'],
        source='tiledata/jp-city/objects', bake='scripts/content/jp-city/bake_jp.py(블록 blocks/story_objects.py)'))
    cat = dict(id=CAT_ID, name='일본 도시 · 이야기 기물(' + names + ')',
               description=f"jp_city 이야기 기물 {len(spec['items'])}종 — 사전(칸 번호·막힌 칸·찾는 낱말), 놓는 순서, 조립 예제 전체 배열, 정상/오류 그림. 3/4 관문 미통과 — 오너 면제 그림({spec['waiver']}).",
               documents=[doc], images=images)
    os.makedirs(STORE, exist_ok=True)
    json.dump(cat, open(os.path.join(STORE, 'category.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    open(os.path.join(STORE, 'jp-story-objects.md'), 'w', encoding='utf-8').write(doc['markdown'] + '\n')
    json.dump(evidence, open(os.path.join(STORE, 'check-evidence.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return cat


def references(root=ROOT):
    """bake_refs.py 가 부른다 — 저장된 용도 하나(없으면 None)."""
    p = os.path.join(root, 'tiledata/jp-city/objects/refs/category.json')
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else None


def kit_ids(root=ROOT):
    """이 용도가 문서로 싣는 키트 id(bake_refs.py 의 «모든 키트가 문서에 있다» 검사가 센다)."""
    p = os.path.join(root, 'tiledata/jp-city/objects/spec.json')
    return {'jp-' + it['id'] for it in json.load(open(p, encoding='utf-8'))['items']} if os.path.exists(p) else set()


def install(cat):
    refs = json.load(open(REFS, encoding='utf-8'))
    refs = [c for c in refs if c['id'] != CAT_ID] + [cat]
    open(REFS, 'w', encoding='utf-8').write(json.dumps(refs, ensure_ascii=False, indent=1) + '\n')     # bake_refs.py 와 같은 꼴
    return refs


if __name__ == '__main__':
    cat = build(); refs = install(cat)
    print(CAT_ID, 'docs', len(cat['documents']), 'images', len(cat['images']), '· categories', len(refs), '· json KB', os.path.getsize(REFS) // 1024,
          '· img KB', sum(os.path.getsize(os.path.join(IMG_DIR, f)) for f in os.listdir(IMG_DIR)) // 1024)
