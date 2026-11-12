#!/usr/bin/env python3
"""modern_city 이야기 기물 참고문서 — 용도 `mc-story-objects` 하나를 src/assets/modernCityReferences.json 에 넣는다(있으면 갈아 끼운다).
계약 tiledata/AI-REFERENCE-CONTRACT.md: 사전(칸 번호)·실행 순서·조립 예제 전체 배열·정상/오류 그림·좌표 검사. 문서 틀은 칩셋 공용 scripts/content/story-objects/refs_lib.py.
그림은 public/assets/modern-city-story-references/*.png — 번들 JSON 에는 경로만 둔다(바이트 없음).
bake_refs.py(거리 참고문서 굽기)가 JSON 을 통째로 다시 쓰므로 그 끝에서 references(ROOT) 를 다시 부른다(실내 용도 mc-interior 와 같은 방식).

  python3 scripts/content/modern-city-street/bake_story.py      # 먼저 굽는다
  python3 scripts/content/modern-city-street/refs_story.py
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, os.path.join(HERE, '..', 'story-objects'))

CAT_ID = 'mc-story-objects'
IMG_DIR = os.path.join(ROOT, 'public/assets/modern-city-story-references')
URL = '/assets/modern-city-story-references/'
OBJ = os.path.join(ROOT, 'tiledata/modern-city/objects')
STORE = os.path.join(OBJ, 'refs')
REFS = os.path.join(ROOT, 'src/assets/modernCityReferences.json')
SIDEWALK = 7        # 보도 포석(정의 tileMeta 이름표로 확인한다)
SCENE = [('storage-cabinet', 1, 1), ('device', 3, 1), ('rubble', 5, 2), ('note', 8, 2), ('ledger', 10, 2)]     # (기물, 왼쪽 위 x, y) — 12×5 보도 장면


def build():
    from PIL import Image
    import refs_lib
    ts = json.load(open(os.path.join(ROOT, 'src/assets/modernCityTileset.json'), encoding='utf-8'))
    assert ts['tileMeta'][SIDEWALK]['label'] == '보도 포석' and ts['passability'][SIDEWALK]['up'], ts['tileMeta'][SIDEWALK]
    spec = json.load(open(os.path.join(OBJ, 'spec.json'), encoding='utf-8'))
    sheet = Image.open(os.path.join(ROOT, 'public/assets/modern-city/modern-city-chipset.png')).convert('RGBA')
    names = '·'.join(it['name'].split('(')[0] for it in spec['items'])
    doc, images, evidence = refs_lib.build(dict(
        tileset=ts, sheet=sheet, spec=spec, kit_prefix='mc-prop-', chipset='modern_city', doc_id='mc-story-objects', img_id='mc-img-story-', img_dir=IMG_DIR, url=URL,
        scene=SCENE, size=(12, 5), ground=lambda x, y: SIDEWALK,
        title=f"modern_city · 이야기 기물 {len(spec['items'])}종({names})",
        head='현대 도시(도쿄풍) 칩셋 `modern_city`, 16px 칸, 시트 48열. 거리 보도와 실내 바닥 어디에나 쓰는 위층 키트다.',
        ground_note='보도·실내 바닥', compose_tool='compose_modern_city_street',
        order_notes=['서 있는 것(보관함·기계 장치 1×2, 잔해 2×1)은 보도의 건물 쪽 줄이나 실내 벽가에 — 차도(아스팔트)·횡단보도·건물 문 앞 접근칸에는 놓지 않는다(놓기 도구가 차도 위 서 있는 기물을 거절한다). '
                     '잔해는 일부러 길을 막을 때만 통로 가운데에 둔다.',
                     '바닥 그림(쪽지·장부)은 보도·실내 바닥 어디든 — 흰 타일 바닥에서는 쪽지가 묻히니 어두운 바닥에 둔다.'],
        source='tiledata/modern-city/objects', bake='scripts/content/modern-city-street/bake_story.py'))
    cat = dict(id=CAT_ID, name='현대 도시 · 이야기 기물(' + names + ')',
               description=f"modern_city 이야기 기물 {len(spec['items'])}종 — 사전(칸 번호·막힌 칸·찾는 낱말), 놓는 순서, 조립 예제 전체 배열, 정상/오류 그림. 3/4 관문 미통과 — 오너 면제 그림({spec['waiver']}).",
               documents=[doc], images=images)
    os.makedirs(STORE, exist_ok=True)
    json.dump(cat, open(os.path.join(STORE, 'category.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    open(os.path.join(STORE, 'mc-story-objects.md'), 'w', encoding='utf-8').write(doc['markdown'] + '\n')
    json.dump(evidence, open(os.path.join(STORE, 'check-evidence.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return cat


def references(root=ROOT):
    """bake_refs.py 가 부른다 — 저장된 용도 하나(없으면 None)."""
    p = os.path.join(root, 'tiledata/modern-city/objects/refs/category.json')
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else None


def install(cat):
    refs = json.load(open(REFS, encoding='utf-8'))
    refs = [c for c in refs if c['id'] != CAT_ID] + [cat]
    json.dump(refs, open(REFS, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    return refs


if __name__ == '__main__':
    cat = build(); refs = install(cat)
    print(CAT_ID, 'docs', len(cat['documents']), 'images', len(cat['images']), '· categories', len(refs), '· json KB', os.path.getsize(REFS) // 1024,
          '· img KB', sum(os.path.getsize(os.path.join(IMG_DIR, f)) for f in os.listdir(IMG_DIR)) // 1024)
