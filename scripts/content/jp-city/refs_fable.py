#!/usr/bin/env python3
"""jp_city 새 건물(탑 3/4 시점, `jp-bldg-f-*`, 블록 fable_city) 참고문서 — 용도 `jp-buildings-f` 하나를 src/assets/jpCityReferences.json 에 넣는다(있으면 갈아 끼운다).
refs_story.py 와 같은 길이다: bake_refs.py 가 JSON 을 통째로 다시 쓰므로 그 끝에서 references(ROOT) 로 이 용도를 다시 붙이고 kit_ids(ROOT) 를 «문서에 실린 키트» 로 센다.
그림은 public/assets/jp-city-fable-references/*.png (bake_refs.py 의 그림 폴더는 그 굽기가 안 쓰는 PNG 를 지우므로 따로 둔다). 번들 JSON 에는 경로만 둔다(바이트 없음).

문서의 칸 번호·크기·문 열·접근칸·통행 글자는 전부 정의 JSON(src/assets/jpCityTileset.json)에서 읽는다(손으로 쓴 값 없음). 통행 글자는 **정의의 통행·층 표**에서 읽은 것이지
엔진 실측(engine_dump.mts)이 아니다 — 문서에 그렇게 적는다. 같은 입력이면 같은 바이트(난수·시각 없음).
이 그림들은 3/4 관문을 통과하지 않았다 — 오너 면제(묶음 fable-jpbuildings-2026-11-14, 번들·공유 출구만).

  python3 scripts/content/jp-city/bake_jp.py      # 먼저 굽는다(블록 fable_city)
  python3 scripts/content/jp-city/refs_fable.py
"""
import collections, json, os
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
CAT_ID = 'jp-buildings-f'
PREFIX = 'jp-bldg-f-'
IMG_DIR = os.path.join(ROOT, 'public/assets/jp-city-fable-references')
URL = '/assets/jp-city-fable-references/'
STORE = os.path.join(ROOT, 'tiledata/jp-city/fable-city/refs')
REFS = os.path.join(ROOT, 'src/assets/jpCityReferences.json')
WAIVER = 'fable-jpbuildings-2026-11-14'
ROLE = collections.OrderedDict((('shop-row', ('상점가 줄', 'shop')), ('residential', ('주택가', 'house')), ('medium', ('중형', 'medium')), ('large', ('대형·초대형', 'large')), ('landmark', ('랜드마크', 'landmark'))))
T = 16


def _tag(k, head):
    return next((t.split(':', 1)[1] for t in k['ai']['tags'] if t.startswith(head + ':')), '-')


def _table(head, rows):
    return '\n'.join(['| ' + ' | '.join(head) + ' |', '|' + '---|' * len(head)] + ['| ' + ' | '.join(str(c) for c in r) + ' |' for r in rows])


def _jline(o):
    return json.dumps(o, ensure_ascii=False, separators=(',', ':'))


def _pages(items, width=816, pad=6, label_h=12, maxh=816):
    """(라벨, 그림) 들을 선반처럼 채운 쪽들(긴 변 ≤ 820)."""
    from PIL import Image, ImageDraw
    pages = []; cur = []; x = y = rowh = 0
    def flush():
        nonlocal cur, x, y, rowh
        if not cur: return
        im = Image.new('RGBA', (width, y + rowh + 2), (46, 46, 54, 255)); d = ImageDraw.Draw(im)
        for lab, g, px, py in cur:
            d.text((px + 1, py), lab, fill=(255, 255, 255, 255))
            bg = Image.new('RGBA', g.size, (70, 70, 78, 255))
            for cy in range(0, g.height, 8):
                for cx in range((cy // 8 % 2) * 8, g.width, 16): bg.paste((58, 58, 66, 255), (cx, cy, min(cx + 8, g.width), min(cy + 8, g.height)))
            bg.alpha_composite(g); im.alpha_composite(bg, (px, py + label_h))
        pages.append(im); cur = []; x = y = rowh = 0
    for lab, g in items:
        w = max(g.width, 6 * len(lab)) + pad; h = g.height + label_h + pad
        if x + w > width and x > 0: x = 0; y += rowh; rowh = 0
        if y + h > maxh and cur: flush()
        cur.append((lab, g, x, y)); x += w; rowh = max(rowh, h)
    flush()
    return pages


def build():
    from PIL import Image
    ts = json.load(open(os.path.join(ROOT, 'src/assets/jpCityTileset.json'), encoding='utf-8'))
    sheet = Image.open(os.path.join(ROOT, 'public/assets/jp-city/jp-city-chipset.png')).convert('RGBA')
    tpr, count = ts['tilesPerRow'], ts['count']
    kits = [k for k in ts['structureKits'] if k['id'].startswith(PREFIX)]
    assert kits, '구운 jp-bldg-f-* 키트가 없다'
    by_role = collections.OrderedDict((r, [k for k in kits if _tag(k, 'street') == r]) for r in ROLE)
    assert sum(len(v) for v in by_role.values()) == len(kits), '거리 역할 태그가 없는 키트'

    def code(t):
        if t < 0: return '_'
        assert t < count, t
        if not ts['passability'][t]['up']: return 'X'
        return '*' if ts['priority'][t] == 'upper' else '.'

    def item(k, role):
        up = [r['upperTiles'] for r in k['rows']]
        assert len(up) == k['height'] and all(len(r) == k['width'] for r in up), k['id']
        it = {'kit': k['id'], 'name': k['name'], 'role': ROLE[role][0], 'tier': _tag(k, 'tier'), 'w': k['width'], 'h': k['height']}
        ai = k['ai']
        if ai.get('anchor'): it['anchor'] = ai['anchor']
        if ai.get('access'): it['access'] = ai['access']
        parts = [{'kind': p['kind'], 'dx': p['dx'], 'dy': p['dy'], 'w': p['w'], 'h': p['h']} for p in k.get('parts', [])]
        if parts: it['parts'] = parts
        it['upperTiles'] = up
        it['codes'] = [''.join(code(t) for t in r) for r in up]
        return it

    head = (f"tilesetId `{ts['id']}` · 그림 `public/assets/jp-city/jp-city-chipset.png`(텍스처 `{ts['textureKey']}`, **{count}칸**, 16px 칸, 한 줄 **{tpr}칸** — 번호 n 의 칸은 열 n%{tpr}, 행 n÷{tpr}(내림), 픽셀 (열×16, 행×16), 모두 0 기준). "
            f"계열 `{ts['family']}` — 다른 칩셋의 칸 번호와 섞지 않는다.")
    rows = []; items = []
    for role, ks in by_role.items():
        for k in ks:
            it = item(k, role); items.append(it)
            ent = sorted({p['dx'] for p in it.get('parts', []) if p['kind'] == 'entrance'}); acc = sorted({a['dx'] for a in it.get('access', [])})
            rows.append([f"`{k['id']}`", k['name'], ROLE[role][0], it['tier'], f"{k['width']}×{k['height']}", sum(1 for r in it['codes'] if 'X' in r),
                         ', '.join(str(c) for c in ent) or '-', ', '.join(str(c) for c in acc if c not in ent) or '-', _tag(k, 'roof')])
    rules = f"""# 일본 도시 — 새 건물 {len(kits)}종 (탑 3/4 시점) · 쓰는 법

{head}

**무엇인가.** 탑 3/4 시점(거리에서 45도쯤 내려다봄)으로 새로 그린 건물 한 채 = 키트 하나(`jp-bldg-f-<이름>`, 굽기 블록 `scripts/content/jp-city/blocks/fable_city.py`). 지붕은 위에서 본 큰 면(기와 경사 · 평지붕 바닥과 옥상 기물 · 박공 ㅅ)이고 차양·발코니·상자는 윗면이 보인다.
옛 손 도트 건물(용도 「손 도트 건물」, `jp-bldg-hand-rules`)과 **다른 계열**이다 — 옛 건물은 양 끝에 처마 칸이 있어 x + w − 1 로 세우지만, 새 건물은 **키트 폭 = 벽 폭**이다. 한 거리에서 두 계열을 섞지 않는 편이 좋다(시점이 다르다).
**이 그림들은 3/4 관문을 통과하지 않았다 — 오너 면제**(묶음 `{WAIVER}`, 번들·공유 출구만 열리고 스토어 출구는 막힌다).

**찍는 법(실행 순서).**
1. 바닥을 먼저 깐다(보도·생활도로·마당). 건물 키트에는 바닥(1층) 칸이 없다 — 모든 칸이 3층(위층).
2. `stamp_object` 로 `kit:jp-bldg-f-…` 를 찍는다(좌표 = 키트 왼쪽 위). 발 = 왼쪽 위 + (0, h−1).
3. **줄지어 세우기: 다음 x = x + w.** 양옆에 처마 칸이 없으니 상점가 가게는 벽을 맞대어 틈 없이 세운다. 집은 사이에 마당 1~2칸을 두고 담(2×2, 옆으로 되풀이)과 대문으로 잇는다.
4. 두 줄 이상이면 뒷줄(화면 위쪽) 건물부터 찍는다. 큰 건물(높이 12~18칸)은 지붕이 위로 길게 올라가니 뒤에 그만큼 자리를 둔다.
5. **문 열**의 맨 아래 칸이 출입구(`parts` 의 `entrance`, 막힘)이고 그 바로 아래 한 칸(`access`, 키트 밖)은 걷는 바닥으로 비운다. 실내 이동은 그 칸에 이벤트(전이)를 따로 놓는다.
6. **지나는 열**(대문·절 산문·도리이)은 그 열 전체가 `*` 이다: 사람이 그 열로 걸어 지나가고 그림이 사람 위에 그려진다. `entrance` 부품은 없고 접근칸만 있다.
7. 간판·차양·옥상 기물은 그림에 들어 있다 — 더 얹지 않는다.

**통행(`codes`).** `X` 막힘 · `*` 걸음(그림이 캐릭터 위) · `_` 빈 칸. 맨 아래 D줄(대부분 2, 담·대문·도리이는 1)만 `X`, 그 위는 `*`. 이 글자는 **정의의 통행·층 표에서 읽은 값**이다(엔진 실측 덤프가 아니다).

**없는 것(정직한 목록).** 뒷면·옆면 그림 없음 · 간판 글자는 일본어(가나 위주) 고정 · 실내 맵 없음 · 밤 조명판 없음 · 실제 상표·로고 없음 · 3/4 관문을 통과한 그림 아님 · 이 문서는 정상/오류 변조 실험을 싣지 않는다.

## 목록 ({len(kits)}종)
{_table(['키트', '이름', '거리 역할', '크기 급', '폭×높이', '막힘 줄', '문 열', '지나는 열', '지붕'], rows)}

그림은 `jp-img-bldg-f-*`(역할마다), 칸 번호 전체는 `jp-bldg-f-dict-1` 부터.
"""
    docs = [dict(id='jp-bldg-f-rules', name=f'일본 도시 · 새 건물 {len(kits)}종(탑 3/4) · 쓰는 법·문 열·줄지어 세우기', markdown=rules)]
    chunks = []; cur = []; size = 0
    for it in items:
        n = len(_jline(it))
        if cur and size + n > 36000: chunks.append(cur); cur = []; size = 0
        cur.append(it); size += n
    if cur: chunks.append(cur)
    for i, ch in enumerate(chunks):
        body = '\n'.join(_jline(it) for it in ch)
        md = f"""# 일본 도시 — 새 건물(탑 3/4) 사전 {i + 1}/{len(chunks)} ({len(ch)}종, 칸 번호 전체)

{head}

항목(한 줄에 키트 하나): `kit` · `name` · `role`(거리 역할) · `tier` · `w`×`h` · `anchor` · `access`(접근칸 dx,dy — 키트 바깥 한 줄 아래) · `parts`(`entrance` = 출입구 칸; 지나는 열에는 없다) ·
`upperTiles`(3층 칸 전체, `-1` = 맵을 건드리지 않는 칸) · `codes`(`X` 막힘 · `*` 걸음·그림이 위 · `_` 빈 칸 — 정의의 통행·층 표에서 읽음). 쓰는 법은 `jp-bldg-f-rules`. 3/4 관문 미통과 — 오너 면제 그림.

```json
{body}
```
"""
        assert len(md) <= 120000, (i, len(md))
        docs.append(dict(id=f'jp-bldg-f-dict-{i + 1}', name=f'일본 도시 · 새 건물(탑 3/4) 사전 {i + 1}/{len(chunks)}', markdown=md))

    def kit_im(k):
        im = Image.new('RGBA', (k['width'] * T, k['height'] * T), (0, 0, 0, 0))
        for y, r in enumerate(k['rows']):
            for x, t in enumerate(r['upperTiles']):
                if t >= 0: im.alpha_composite(sheet.crop((t % tpr * T, t // tpr * T, t % tpr * T + T, t // tpr * T + T)), (x * T, y * T))
        return im
    os.makedirs(IMG_DIR, exist_ok=True); images = []; used = set()
    for role, ks in by_role.items():
        if not ks: continue
        for i, pg in enumerate(_pages([(k['id'][len(PREFIX):], kit_im(k)) for k in ks])):
            assert max(pg.size) <= 820, pg.size
            name = f'bldg-f-{ROLE[role][1]}-{i + 1}.png'
            pg.convert('RGB').quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(os.path.join(IMG_DIR, name), optimize=True)
            used.add(name)
            images.append(dict(id=f'jp-img-bldg-f-{ROLE[role][1]}-{i + 1}', name=name, dataUrl=URL + name,
                               caption=f'새 건물(탑 3/4) 도감 — {ROLE[role][0]} {len(ks)}종 {i + 1}쪽(원본 해상도, 라벨 = 키트 id 에서 jp-bldg-f- 를 뺀 것, 체크 무늬 = 빈 칸). 3/4 관문 미통과 — 오너 면제 그림. 칸 번호는 jp-bldg-f-dict-*.'))
    for fn in sorted(os.listdir(IMG_DIR)):
        if fn.endswith('.png') and fn not in used: os.remove(os.path.join(IMG_DIR, fn))
    cat = dict(id=CAT_ID, name=f'일본 도시 · 새 건물 {len(kits)}종 (탑 3/4 시점)',
               description=(f'탑 3/4 시점으로 새로 그린 일본 도시 건물 {len(kits)}종 통 키트(jp-bldg-f-*): 상점가 가게·집·담과 대문·중형(학원·목욕탕·슈퍼·우체국·은행 …)·대형(맨션·오피스·백화점·호텔·병원·단지)·초대형·랜드마크(도리이·역사·큰 목욕탕). '
                            f'키트 폭 = 벽 폭이라 벽을 맞대어 줄로 세운다(다음 x = x + w). 키트 id·크기·문 열·지나는 열·칸 번호 전체 배열·통행. 3/4 관문 미통과 — 오너 면제 그림({WAIVER}).'),
               documents=docs, images=images)
    os.makedirs(STORE, exist_ok=True)
    json.dump(cat, open(os.path.join(STORE, 'category.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    for d in docs: open(os.path.join(STORE, d['id'] + '.md'), 'w', encoding='utf-8').write(d['markdown'] + '\n')
    return cat


def references(root=ROOT):
    """bake_refs.py 가 부른다 — 저장된 용도 하나(없으면 None)."""
    p = os.path.join(root, 'tiledata/jp-city/fable-city/refs/category.json')
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else None


def kit_ids(root=ROOT):
    """이 용도가 문서로 싣는 키트 id(bake_refs.py 의 «모든 키트가 문서에 있다» 검사가 센다)."""
    p = os.path.join(root, 'tiledata/jp-city/fable-city/spec.json')
    return {it['id'] for it in json.load(open(p, encoding='utf-8'))['items']} if os.path.exists(p) else set()


def install(cat):
    refs = json.load(open(REFS, encoding='utf-8'))
    refs = [c for c in refs if c['id'] != CAT_ID] + [cat]
    open(REFS, 'w', encoding='utf-8').write(json.dumps(refs, ensure_ascii=False, indent=1) + '\n')     # bake_refs.py 와 같은 꼴
    return refs


if __name__ == '__main__':
    cat = build(); refs = install(cat)
    print(CAT_ID, 'docs', len(cat['documents']), 'images', len(cat['images']), '· categories', len(refs), '· json KB', os.path.getsize(REFS) // 1024,
          '· img KB', sum(os.path.getsize(os.path.join(IMG_DIR, f)) for f in os.listdir(IMG_DIR)) // 1024)
