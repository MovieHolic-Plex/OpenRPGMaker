#!/usr/bin/env python3
"""modern_city 서양 도시 세트 참고문서 — 용도 `mc-west` 하나를 src/assets/modernCityReferences.json 에 넣는다(있으면 갈아 끼운다).
계약 tiledata/AI-REFERENCE-CONTRACT.md: 사전(키트·칸 번호·문 칸)·실행 순서·조립 예제 전체 배열·정상/오류 그림·좌표 검사.
읽는 것은 구운 정의 JSON 과 시트 PNG 뿐이다 — 문서의 칸 번호·좌표는 전부 거기서 읽은 값이다.
bake_refs.py(거리 참고문서 굽기)가 JSON 을 통째로 다시 쓰면 이 스크립트를 다시 돌린다(저장본 tiledata/modern-city/west/refs/category.json).

  python3 scripts/content/modern-city-street/bake_west.py      # 먼저 굽는다
  python3 scripts/content/modern-city-street/refs_west.py
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..', 'story-objects'))
from PIL import Image, ImageDraw                    # noqa: E402
import refs_lib as RL                               # noqa: E402
import west_spec as W                               # noqa: E402

CAT_ID = 'mc-west'
IMG_DIR = os.path.join(ROOT, 'public/assets/modern-city-west-references')
URL = '/assets/modern-city-west-references/'
STORE = os.path.join(W.WEST, 'refs')
REFS = os.path.join(ROOT, 'src/assets/modernCityReferences.json')
WAIVER = 'fable-westcity-2026-11-14'
SIDEWALK, ROAD, CURB_S = 7, 1, 9
T = 16
# 예제 거리 두 줄(맛마다 하나): (건물 id 들 — 왼쪽부터 벽을 맞대어), (기물 id, 건물 줄 왼쪽 끝에서 x 칸, 보도 줄 0=건물 쪽 1=가운데 2=연석 쪽)
STREETS = {
    'na': (['icecream', 'barber', 'diner', 'laundromat', 'police'],
           [('icecream-cone-sign', 0, 0), ('sandwich-board-pizza', 4, 0), ('newsbox-row', 9, 0), ('milk-crates', 13, 0), ('parking-meter-twin', 2, 2), ('mailbox-blue', 5, 2), ('hydrant-yellow', 8, 2), ('bus-stop-sign', 11, 2),
            ('bus-bench', 12, 2), ('street-name-sign', 16, 2), ('traffic-light-hang', 18, 2)]),
    'eu': (['bakery', 'florist', 'bookshop', 'newsstand', 'bus-cafe'],
           [('bread-rack-street', 0, 0), ('flower-buckets', 5, 0), ('postcard-rack', 8, 0), ('sandwich-board-coffee', 15, 0), ('lamp-twin-globe', 3, 2), ('bollard-chain', 6, 2), ('street-clock', 10, 2), ('tree-guard-iron', 13, 2),
            ('phone-booth-red', 16, 2), ('flower-lamp-basket', 19, 2)]),
}


def layout(ts, flavour):
    """맛 하나의 예제 거리: 건물 줄(벽 맞댐) + 보도 3줄 + 연석 + 차도 2줄. → (장면 dict, 놓은 목록[(키트, x, y)], 문 접근칸)"""
    kits = {k['id']: k for k in ts['structureKits']}
    blds, props = STREETS[flavour]
    blds = [b for b in blds if 'mc-bld-w-' + b in kits]; props = [p for p in props if 'mc-prop-w-' + p[0] in kits]
    Wd = sum(kits['mc-bld-w-' + b]['width'] for b in blds) + 2; top = max(kits['mc-bld-w-' + b]['height'] for b in blds); H = top + 1 + 3 + 1 + 2
    base = top + 1                                              # 건물 맨 아랫줄 다음 = 보도 첫 줄
    low = []
    for y in range(H):
        for x in range(Wd): low.append(SIDEWALK if y < base + 3 else CURB_S if y == base + 3 else ROAD)
    d = dict(width=Wd, height=H, lower=low, upper=[-1] * (Wd * H)); placed = []; access = []; x = 1
    for b in blds:
        k = kits['mc-bld-w-' + b]; y = base - k['height']
        RL.stamp(d, k, x, y); placed.append((k['id'], x, y)); access += [(x + a['dx'], y + a['dy']) for a in k['ai']['access']]; x += k['width']
    for pid, px, row in props:
        k = kits['mc-prop-w-' + pid]; y = base + row - k['height'] + 1
        if any((px + 1 + c, base + row) in access for c in range(k['width'])): continue      # 문 앞 접근칸은 비운다
        RL.stamp(d, k, px + 1, y); placed.append((k['id'], px + 1, y))
    return d, placed, access


def check(d, ts, placed, access):
    """좌표 검사: 키트 칸이 위층에 통째로 있는가 · 문 앞 접근칸이 걸을 수 있는 보도이고 위층이 비었거나 걷는 칸인가."""
    kits = {k['id']: k for k in ts['structureKits']}; Wd = d['width']; errs = []
    later = {}
    for n, (kid, ox, oy) in enumerate(placed):
        for r, row in enumerate(kits[kid]['rows']):
            for c, t in enumerate(row['upperTiles']):
                if t >= 0: later[(ox + c, oy + r)] = (n, t)
    for n, (kid, ox, oy) in enumerate(placed):
        for r, row in enumerate(kits[kid]['rows']):
            for c, t in enumerate(row['upperTiles']):
                if t < 0 or later[(ox + c, oy + r)][0] != n: continue
                i = (oy + r) * Wd + ox + c
                if d['upper'][i] != t: errs.append(('E_WEST_LAYER' if d['lower'][i] == t else 'E_WEST_INCOMPLETE', kid, ox + c, oy + r))
    for ax, ay in access:
        i = ay * Wd + ax; u = d['upper'][i]
        if not ts['passability'][d['lower'][i]]['up'] or (u >= 0 and not ts['passability'][u]['up']): errs.append(('E_WEST_DOOR_BLOCKED', '', ax, ay))
    return errs


def build():
    ts = json.load(open(os.path.join(ROOT, 'src/assets/modernCityTileset.json'), encoding='utf-8'))
    assert ts['tileMeta'][SIDEWALK]['label'] == '보도 포석' and ts['tileMeta'][ROAD]['label'] == '아스팔트' and ts['tileMeta'][CURB_S]['label'].startswith('연석'), '바닥 칸 번호가 바뀌었다'
    sheet = Image.open(os.path.join(ROOT, 'public/assets/modern-city/modern-city-chipset.png')).convert('RGBA'); tpr = ts['tilesPerRow']
    kits = {k['id']: k for k in ts['structureKits']}
    B, P, _M = W.buildings(); O = W.objects()
    B = [b for b in B if b['kit'] in kits]; O = [o for o in O if o['kit'] in kits]
    os.makedirs(IMG_DIR, exist_ok=True); os.makedirs(STORE, exist_ok=True)
    images = []; docs = []; evidence = {}
    arr = lambda a, Wd, H: '\n'.join(RL._arr(a[y * Wd:(y + 1) * Wd]) for y in range(H))   # noqa: E731
    head = (f"현대 도시 칩셋 `modern_city`(16px 칸, 시트 {tpr}열)의 **서양 도시 세트** — 태그 `country:west`. 두 가지 맛이 있고 **한 거리에 섞지 않는다**: "
            "`flavour:na` 북미 중심가(붉은 벽돌·평지붕 난간·옥상 설비·큰 그림 간판) · `flavour:eu` 유럽 구시가(파스텔 회벽·기와/슬레이트 지붕·덧문·꽃 상자·주철).\n\n"
            f"**이 그림들은 3/4 관문 미통과 — 오너 면제 그림**(면제 묶음 {WAIVER}, Claude Fable 5.2 한 방 부품 + 코드 조립)이다 — 관문 영수증이 없고 스토어로는 나가지 않는다. "
            "사양 `tiledata/modern-city/west/*.txt`, 부품 그림 `parts/`·`mats/`·`pieces/`, 조립 `scripts/content/modern-city-street/west_build.py`, 굽기 `bake_west.py`.\n")
    # ---- 문서 1: 건물
    L = [f"# modern_city · 서양 도시 건물 {len(B)}종 — 사전·순서·예제·오류\n\n{head}",
         "## 1. 사전\n\n건물 키트는 전부 **위층(upperTiles)**, 모든 칸 막힘. 그림은 정면 + 위에서 본 넓은 지붕 면(옥상 기물이 이미 그려져 있다). "
         "문 칸(dx,dy)은 키트 맨 아랫줄에 있고 막혀 있다 — **문 앞 접근칸은 키트 바깥 한 줄 아래**(dx, 키트 높이)이며 걸을 수 있는 보도여야 한다. 실내는 `program` 으로 짓는다.\n",
         "| 키트 id | 무엇 | 맛 | 등급 | 크기(칸) | 문 칸 (dx,dy) | 접근칸 (dx,dy) | program | 첫 줄 칸 번호 | 찾는 낱말 |\n|---|---|---|---|---|---|---|---|---|---|"]
    for b in B:
        k = kits[b['kit']]; h = k['height']
        L.append(f"| `{b['kit']}` | {b['ko']} — {b['type']} | {b['flavour']} | {W.TIER_KO[b['tier']]} | {k['width']}×{h} | {' '.join('(%d,%d)' % (d_, h - 1) for d_ in b['doors'])} | "
                 f"{' '.join('(%d,%d)' % (a['dx'], a['dy']) for a in k['ai']['access'])} | {b['program']} | {' '.join(map(str, k['rows'][0]['upperTiles']))} | {', '.join(b['words'] + [b['en']])} |")
    L.append("\n전부 고정 조각(이어 찍지 않는다). 키트의 전체 칸 배열은 타일셋 정의 `structureKits[id].rows[].upperTiles` 가 정본이다.\n")
    L.append("## 2. 실행 순서\n\n"
             "1. 맛을 하나 고른다(na 또는 eu) — 한 거리(한 줄)의 건물·기물은 같은 맛만. 맛이 섞이는 것은 길을 건넌 다른 블록에서만.\n"
             "2. 바닥: 건물 줄 아래로 보도 3~4줄(`mc:sidewalk` 7·8), 연석 한 줄, 차도. 건물이 서는 칸의 아래층도 보도로 둔다.\n"
             "3. 건물은 **벽을 맞대어**(틈 0칸) 왼쪽부터 `stamp_tileset_object({ mapId, objectId, base })` — base = 키트 맨 아랫줄 왼쪽 칸. 모든 건물의 맨 아랫줄을 같은 y 에 맞춘다(보도 첫 줄 바로 위). "
             "이웃한 두 건물은 층수(키트 높이)가 달라야 한다 — 윗선이 들쭉날쭉해야 거리로 읽힌다. 같은 종류는 한 줄에 한 번.\n"
             "4. 골목 틈: 건물 서너 채마다 1~2칸을 비워 골목을 낸다(골목 기물 묶음 `kind:alley`, 빨랫줄 띠는 틈 위쪽에).\n"
             "5. 문 앞 접근칸과 그 좌우 한 칸, 아래 한 줄은 비운다. 기물은 그 밖의 보도에: 건물 쪽 줄 = 가게 앞 묶음(`kind:shopfront`), 연석 쪽 줄 = 중심가 묶음(`kind:main-street`).\n"
             "6. 랜드마크·초대형(성당·시계탑·역·경기장·쇼핑몰·병원)은 맵에 하나씩, 광장이나 블록 하나를 통째로 준다.\n"
             "7. 문 이벤트(전이)는 접근칸이 아니라 문 칸에 «같은 높이·닿으면» 으로 따로 둔다 — 키트는 그림일 뿐이다.\n")
    for fl in ('na', 'eu'):
        d, placed, access = layout(ts, fl)
        if len(placed) < 2: continue
        errs = check(d, ts, placed, access); assert not errs, errs[:4]
        im = RL.render(d, sheet, tpr); im.save(os.path.join(IMG_DIR, f'street-{fl}.png'), optimize=True)
        im.resize((im.width * 2, im.height * 2), Image.NEAREST).save(os.path.join(IMG_DIR, f'street-{fl}-2x.png'), optimize=True)
        Wd, H = d['width'], d['height']
        L.append(f"## 3-{fl}. 조립 예제 — {W.FLAVOUR_KO[fl]} 거리 {Wd}×{H} (그림 `street-{fl}.png` 원본 해상도 · `street-{fl}-2x.png`)\n\n놓은 순서(키트 · 왼쪽 위): "
                 + ' · '.join(f"`{k}` ({x},{y})" for k, x, y in placed) + f"\n\n문 앞 접근칸: {' '.join('(%d,%d)' % a for a in access)}\n\n아래층 lower(한 줄 = 맵 한 줄, index = y*{Wd}+x):\n```\n{arr(d['lower'], Wd, H)}\n```\n\n위층 upper:\n```\n{arr(d['upper'], Wd, H)}\n```\n")
        images += [dict(id=f'mc-img-west-street-{fl}', name=f'street-{fl}.png', caption=f"서양 도시 {W.FLAVOUR_KO[fl]} 거리 조립 예제 — 원본 해상도 {im.width}×{im.height}(시트 칸 이어 붙임). 3/4 관문 미통과 — 오너 면제 그림.", dataUrl=URL + f'street-{fl}.png'),
                   dict(id=f'mc-img-west-street-{fl}-2x', name=f'street-{fl}-2x.png', caption='같은 장면 2배 최근접 확대.', dataUrl=URL + f'street-{fl}-2x.png')]
        # 변조 셋: 건물 첫 줄을 뺀다 · 건물 한 칸을 아래층으로 · 문 앞 접근칸에 막힌 기물을 놓는다
        k0, x0, y0 = placed[0]; kw = kits[k0]['width']
        y0 += next(r for r, row in enumerate(kits[k0]['rows']) if all(t >= 0 for t in row['upperTiles']))      # 칸이 다 찬 첫 줄(간판만 솟은 줄은 건너뛴다)
        t1 = json.loads(json.dumps(d))
        for c in range(kw): t1['upper'][y0 * Wd + x0 + c] = -1
        t2 = json.loads(json.dumps(d)); yb = placed[0][2] + kits[k0]['height'] - 1; i = yb * Wd + x0; t2['lower'][i] = t2['upper'][i]; t2['upper'][i] = -1
        solid = next(t for kk in kits.values() if kk['id'].startswith('mc-prop-w-') and kk['height'] == 1 for t in kk['rows'][0]['upperTiles'] if t >= 0 and not ts['passability'][t]['up'])
        ax, ay = access[0]; t3 = json.loads(json.dumps(d)); t3['upper'][ay * Wd + ax] = solid
        rows = []; pics = []
        for desc, t, box in ((f"{kits[k0]['name']} 첫 줄 {kw}칸을 뺌 ({x0},{y0}) — 지붕이 잘린다", t1, (x0, y0, kw, 1)),
                             (f"{kits[k0]['name']} 맨 아랫줄 왼쪽 칸을 아래층에 찍음 ({x0},{yb}) — 바닥이 사라진다", t2, (x0, yb, 1, 1)),
                             (f"문 앞 접근칸 ({ax},{ay}) 에 막힌 기물을 놓음 — 문에 닿을 수 없다", t3, (ax, ay, 1, 1))):
            e = check(t, ts, placed, access); assert e, desc; rows.append((desc, e))
            pic = RL.render(t, sheet, tpr); bx, by, bw, bh = box
            ImageDraw.Draw(pic).rectangle([bx * T, by * T, (bx + bw) * T - 1, (by + bh) * T - 1], outline=(255, 30, 30, 255), width=1); pics.append(pic)
        cmp_ = Image.new('RGBA', (im.width * 2 + 8, im.height * 2 + 8), (20, 20, 28, 255))
        for n, pic in enumerate([im] + pics): cmp_.paste(pic, ((n % 2) * (im.width + 8), (n // 2) * (im.height + 8)))
        cmp_.save(os.path.join(IMG_DIR, f'street-{fl}-err.png'), optimize=True)
        L.append(f"## 4-{fl}. 정상/오류 (실제로 변조해 검출, 그림 `street-{fl}-err.png` — 왼쪽 위 정상 · 나머지 셋 변조, 빨간 상자)\n\n| 변조 | 검출 코드 | 첫 오류(코드, 키트, x, y) |\n|---|---|---|")
        for desc, e in rows: L.append(f"| {desc} | {', '.join(sorted({x[0] for x in e}))} | {e[0]} |")
        L.append('')
        images.append(dict(id=f'mc-img-west-street-{fl}-err', name=f'street-{fl}-err.png', caption='정상(왼쪽 위) · 건물 첫 줄 빠짐 · 건물 칸을 아래층에 · 문 앞 접근칸 막힘. 빨간 상자 = 변조 자리.', dataUrl=URL + f'street-{fl}-err.png'))
        evidence[fl] = dict(scene=d, placed=placed, access=access, tamper=[(desc, [list(x) for x in e[:3]]) for desc, e in rows])
    L.append("오류 코드: E_WEST_LAYER 키트 칸이 아래층에 있다 · E_WEST_INCOMPLETE 키트 칸이 빠졌다 · E_WEST_DOOR_BLOCKED 문 앞 접근칸이 막혔다.\n"
             "확인 범위: 키트 칸이 위층에 통째로 있는가, 문 앞 접근칸이 걸을 수 있는가(시트 통행표). 이벤트 실행·그림의 미감·3/4 시점(이 그림들은 관문 미통과다)·모델이 실제로 잘 놓는지는 보지 않는다. "
             "**서양 거리를 짓는 구성기는 아직 없다** — `compose_modern_city_street` 는 이 키트를 쓰지 않는다. 위 순서대로 키트를 직접 찍는다.")
    docs.append(dict(id='mc-west-buildings', name=f'modern_city · 서양 도시 건물 {len(B)}종 — 사전·순서·예제·오류', markdown='\n'.join(L)))
    # ---- 문서 2: 기물
    L = [f"# modern_city · 서양 도시·시골 기물 {len(O)}종 — 사전·놓는 자리\n\n{head}",
         "## 1. 사전\n\n모든 칸은 **위층(upperTiles)**. 놓는 방식: `prop` = 서 있는 기물(맨 아랫줄 막힘, 그 위 줄은 ★ — 걷고 사람 위에 그려진다) · `flat` = 바닥 그림(밟고 지나간다, 사람 밑) · `over` = 걸쳐 놓는 띠(막지 않는다, 사람 위 — 차양은 가게 1층 윗줄, 빨랫줄·전구 줄은 두 건물 사이).\n"]
    for sid in W.SET_KO:
        items = [o for o in O if o['set'] == sid]
        if not items: continue
        L.append(f"### 장면 묶음 `kind:{sid}` — {W.SET_KO[sid]} ({'도시' if items[0]['setting'] == 'city' else '시골'}, {len(items)}종)\n\n{kits[items[0]['kit']]['ai']['placementRules']}\n\n"
                 "| 키트 id | 무엇 | 맛 | 크기 | 놓는 방식 | 위층 칸 번호(위 줄 / 아래 줄) | 찾는 낱말 |\n|---|---|---|---|---|---|---|")
        for o in items:
            k = kits[o['kit']]
            L.append(f"| `{o['kit']}` | {o['ko']} | {o['flavour']} | {o['w']}×{o['h']} | {o['place']} | {' / '.join(' '.join(map(str, r['upperTiles'])) for r in k['rows'])} | {', '.join(o['words'] + [o['en']])} |")
        L.append('')
    L.append("## 2. 실행 순서\n\n1. `stamp_tileset_object({ mapId, objectId, base })` — base = 맨 아랫줄 왼쪽 칸. 조수 v2 는 `place_object({ mapId, objectId, at })`.\n"
             "2. 한 묶음(`kind:`)의 기물은 같은 자리에 함께 놓아 장면을 만든다(카페 테라스 = 탁자·의자·파라솔·메뉴판·화단 상자). 맛(na/eu)이 건물 줄과 같은 것을 먼저 고른다.\n"
             "3. 문 앞 접근칸·횡단보도 앞·차도에는 서 있는 기물을 놓지 않는다. 계절 묶음은 그 계절 장면에만.\n"
             "4. 옥상 묶음(`kind:rooftop`)은 건물 그림의 지붕 면에 이미 그려져 있다 — 따로 놓을 때는 옥상 실내 맵(`mc_rooftop`)이나 지붕 면이 빈 건물 위에.\n"
             "5. 그림일 뿐이다 — 조사·줍기·대화는 이벤트를 따로 둔다.")
    docs.append(dict(id='mc-west-objects', name=f'modern_city · 서양 도시·시골 기물 {len(O)}종 — 사전·놓는 자리', markdown='\n'.join(L)))
    cat = dict(id=CAT_ID, name='현대 도시 · 서양 도시 세트(북미 중심가·유럽 구시가 건물과 기물)',
               description=f"modern_city 서양 도시 세트(country:west) — 건물 {len(B)}종·기물 {len(O)}종의 사전(칸 번호·문 칸·접근칸·찾는 낱말), 거리 조립 순서, 맛별 예제 전체 배열, 정상/오류 그림. 3/4 관문 미통과 — 오너 면제 그림({WAIVER}).",
               documents=docs, images=images)
    json.dump(cat, open(os.path.join(STORE, 'category.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    for dd in docs: open(os.path.join(STORE, dd['id'] + '.md'), 'w', encoding='utf-8').write(dd['markdown'] + '\n')
    json.dump(evidence, open(os.path.join(STORE, 'check-evidence.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return cat


def references(root=ROOT):
    p = os.path.join(root, 'tiledata/modern-city/west/refs/category.json')
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else None


def install(cat):
    refs = json.load(open(REFS, encoding='utf-8'))
    refs = [c for c in refs if c['id'] != CAT_ID] + [cat]
    json.dump(refs, open(REFS, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    return refs


if __name__ == '__main__':
    cat = build(); refs = install(cat)
    print(CAT_ID, 'docs', len(cat['documents']), 'images', len(cat['images']), '· categories', len(refs), '· json KB', os.path.getsize(REFS) // 1024)
