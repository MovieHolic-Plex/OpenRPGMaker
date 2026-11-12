"""이야기 기물 참고문서 한 장(사전 · 실행 순서 · 조립 예제 전체 배열 · 정상/오류 그림 · 좌표 검사) — 칩셋 공용.

칩셋마다 굽기·참고문서 스크립트가 따로 있어서, 그 스크립트가 이 모듈의 build() 를 불러 (문서, 그림 목록)을 받아 자기 용도에 넣는다.
읽는 것은 구운 정의 JSON(칸 통행·키트)과 시트 PNG 뿐이다 — 문서의 칸 번호·좌표는 전부 거기서 읽은 값이고, 예제 장면은 키트 배열을 그대로 찍은 뒤
같은 검사(objects_check)로 다시 확인한다. 계약: tiledata/AI-REFERENCE-CONTRACT.md.

  doc, images = build(dict(
      tileset=<정의 dict>, sheet=<PIL RGBA>, spec=<spec.json dict>, kit_prefix='mc-prop-', chipset='modern_city',
      doc_id='mc-story-objects', img_id='mc-img-story-', img_dir=<public/... 폴더>, url='/assets/.../',
      scene=[('note', 1, 2), ...], size=(12, 6), ground=lambda x, y: <아래층 칸 번호>,
      title='modern_city · 이야기 기물 5종(…)', head='<머리 한 줄>', ground_note='보도·실내 바닥', compose_tool='compose_modern_city_street',
      order_notes=['큰 것부터 …', …], source='tiledata/modern-city/objects', bake='scripts/content/modern-city-street/bake_story.py'))
"""
import json, os
from PIL import Image, ImageDraw

T = 16


def _arr(a): return ' '.join('%5d' % v for v in a)


def stamp(d, kit, x, y):
    W = d['width']
    for r, row in enumerate(kit['rows']):
        for c, t in enumerate(row.get('upperTiles') or []):
            if t >= 0: d['upper'][(y + r) * W + x + c] = t


def render(d, sheet, tpr):
    im = Image.new('RGBA', (d['width'] * T, d['height'] * T), (0, 0, 0, 255))
    for layer in ('lower', 'upper'):
        for i, t in enumerate(d[layer]):
            if t < 0: continue
            cell = sheet.crop(((t % tpr) * T, (t // tpr) * T, (t % tpr) * T + T, (t // tpr) * T + T))
            im.alpha_composite(cell, ((i % d['width']) * T, (i // d['width']) * T))
    return im


def objects_check(d, cfg):
    """예제 장면 좌표 검사: 키트 칸이 위층에 통째로 있는가 · 칸 통행이 선언(막힌 칸/걷는 칸)과 같은가."""
    ts = cfg['tileset']; W = d['width']; kits = {k['id']: k for k in ts['structureKits']}; by = {it['id']: it for it in cfg['spec']['items']}; errs = []
    for pid, ox, oy in cfg['scene']:
        it = by[pid]; kid = cfg['kit_prefix'] + pid; block = {tuple(c) for c in it['block']}
        for r, row in enumerate(kits[kid]['rows']):
            for c, t in enumerate(row['upperTiles']):
                if t < 0: continue
                i = (oy + r) * W + ox + c
                if d['upper'][i] != t: errs.append(('E_OBJ_LAYER' if d['lower'][i] == t else 'E_OBJ_INCOMPLETE', kid, ox + c, oy + r)); continue
                if ts['passability'][t]['up'] == ((c, r) in block): errs.append(('E_OBJ_PASSAGE', kid, ox + c, oy + r))
    return errs


def build(cfg):
    ts, sheet, spec = cfg['tileset'], cfg['sheet'], cfg['spec']
    tpr = ts['tilesPerRow']; kits = {k['id']: k for k in ts['structureKits']}; by = {it['id']: it for it in spec['items']}
    P = cfg['kit_prefix']; W, H = cfg['size']; n = len(spec['items'])
    assert {p for p, _x, _y in cfg['scene']} == set(by), '예제 장면에 모든 기물이 한 번씩 있어야 한다'
    d = dict(width=W, height=H, lower=[cfg['ground'](x, y) for y in range(H) for x in range(W)], upper=[-1] * (W * H))
    for pid, x, y in cfg['scene']: stamp(d, kits[P + pid], x, y)
    errs = objects_check(d, cfg); assert not errs, errs[:4]
    os.makedirs(cfg['img_dir'], exist_ok=True)
    im = render(d, sheet, tpr); im.save(os.path.join(cfg['img_dir'], 'objects-scene.png'), optimize=True)
    im.resize((im.width * 3, im.height * 3), Image.NEAREST).save(os.path.join(cfg['img_dir'], 'objects-scene-3x.png'), optimize=True)
    # 변조 둘: (1) 바닥 그림(없으면 첫 기물)의 한 칸을 아래층으로 (2) 두 칸 이상인 첫 기물의 첫 줄을 뺀다
    pos = {p: (x, y) for p, x, y in cfg['scene']}
    a = next((it for it in spec['items'] if it['place'] == 'decal'), spec['items'][0]); ax, ay = pos[a['id']]
    b = next(it for it in spec['items'] if it['w'] * it['h'] > 1); bx, by_ = pos[b['id']]
    t1 = json.loads(json.dumps(d)); i = ay * W + ax; t1['lower'][i] = t1['upper'][i]; t1['upper'][i] = -1
    t2 = json.loads(json.dumps(d))
    for c in range(b['w']): t2['upper'][by_ * W + bx + c] = -1
    rows = []; pics = []
    for desc, t, box in ((f"{a['name']} 칸을 위층에서 빼 아래층에 찍음 ({ax},{ay}) — 바닥이 사라지고 둘레가 뚫린다", t1, (ax, ay, 1, 1)),
                         (f"{b['name']} 첫 줄 {b['w']}칸을 뺌 ({bx},{by_}) — 기물이 잘린다", t2, (bx, by_, b['w'], 1))):
        e = objects_check(t, cfg); assert e, desc; rows.append((desc, e))
        pic = render(t, sheet, tpr); x, y, w, h = box
        ImageDraw.Draw(pic).rectangle([x * T, y * T, (x + w) * T - 1, (y + h) * T - 1], outline=(255, 30, 30, 255), width=1); pics.append(pic)
    S = 2; cmp_ = Image.new('RGBA', (im.width * S * 3 + 16, im.height * S), (20, 20, 28, 255))
    for k, pic in enumerate([im] + pics): cmp_.paste(pic.resize((pic.width * S, pic.height * S), Image.NEAREST), (k * (im.width * S + 8), 0))
    cmp_.save(os.path.join(cfg['img_dir'], 'objects-err.png'), optimize=True)

    L = [f"# {cfg['title']}\n\n{cfg['head']}\n",
         f"게임들이 바랐는데 그림이 없던 물건이다. **이 {n}장은 3/4 관문 미통과 — 오너 면제 그림**(면제 묶음 {spec['waiver']}, Claude Fable 5.2 한 방 그림)이다 — 관문 영수증이 없고 스토어로는 나가지 않는다. "
         f"그림 정본 `{cfg['source']}/pieces/`, 정의 `spec.json`, 굽기 `{cfg['bake']}`(그림을 그대로 굽는다 — 한 화소라도 바꾸면 면제가 풀린다).\n",
         f"## 1. 사전\n\n모든 칸은 **위층(upperTiles)** 에 놓는다(아래층 {cfg['ground_note']}은 그대로 — 투명 화소 밑으로 비친다). 서 있는 기물: 막힌 칸은 네 방향 막힘, 나머지 칸은 ★(사람 위에 그려지고 걷는다). 바닥 그림: 사람 아래·걷는다.\n",
         "| 키트 id | 무엇 | 크기 | 위층 칸 번호(위 줄 / 아래 줄) | 놓는 방식 | 막힌 칸 (dx,dy) | 찾는 낱말(키트 태그) |\n|---|---|---|---|---|---|---|"]
    for it in spec['items']:
        k = kits[P + it['id']]
        L.append(f"| `{P}{it['id']}` | {it['name']} | {it['w']}×{it['h']} | {' / '.join(' '.join(map(str, r['upperTiles'])) for r in k['rows'])} | {'바닥 그림(밟고 지나감)' if it['place'] == 'decal' else '서 있는 기물'} | "
                 f"{' '.join('(%d,%d)' % tuple(c) for c in it['block']) or '—'} | {', '.join(it['words'])} |")
    L.append("\n전부 고정 조각(이어 찍지 않는다). 입구·문 부품은 없다.\n")
    steps = [f"바닥({cfg['ground_note']})을 먼저 깐다 — 구성 도구 `{cfg['compose_tool']}` 이 지은 맵이면 그대로 둔다.",
             f"`stamp_tileset_object({{ mapId, objectId: \"{P}…\", base }})` — **base = 맨 아래 줄의 왼쪽 칸**(왼쪽 위가 (x,y)·높이 h 면 base = (x, y+h−1)). 조수 v2 는 `place_object({{ mapId, objectId, at }})`. 도구는 통째로 놓거나 거절한다."]
    steps += cfg['order_notes']
    steps += ["그림일 뿐이다 — 읽기·줍기·조작은 이벤트를 따로 둔다(막힌 칸의 이벤트는 «같은 높이·결정 키», 바닥 그림은 그 칸 «플레이어 아래»).",
              "빈 땅 채우기에 흩지 않는다(키트 태그 «주제 소품») — 이야기가 부를 때만 놓는다. 조각별 자리는 키트 `placementRules`."]
    L.append("## 2. 실행 순서\n\n" + '\n'.join(f"{i + 1}. {s}" for i, s in enumerate(steps)) + "\n")
    arrs = lambda a: '\n'.join(_arr(a[y * W:(y + 1) * W]) for y in range(H))   # noqa: E731
    L.append(f"## 3. 조립 예제 {W}×{H} (그림 `objects-scene.png` 원본 해상도 · `objects-scene-3x.png`)\n\n놓은 순서(키트 · 왼쪽 위): "
             + ' · '.join(f"`{P}{p}` ({x},{y})" for p, x, y in cfg['scene']) + f"\n\n아래층 lower(한 줄 = 맵 한 줄, index = y*{W}+x):\n```\n{arrs(d['lower'])}\n```\n\n위층 upper:\n```\n{arrs(d['upper'])}\n```\n")
    L.append("## 4. 정상/오류 (실제로 변조해 검출, 그림 `objects-err.png` — 왼쪽 정상 · 가운데·오른쪽 변조, 빨간 상자)\n\n| 변조 | 검출 코드 | 첫 오류(코드, 키트, x, y) |\n|---|---|---|")
    for desc, e in rows: L.append(f"| {desc} | {', '.join(sorted({x[0] for x in e})) or '못 잡음'} | {e[0] if e else '-'} |")
    L.append("\n오류 코드: E_OBJ_LAYER 키트 칸이 아래층에 있다 · E_OBJ_INCOMPLETE 키트 칸이 빠졌다 · E_OBJ_PASSAGE 칸 통행이 선언(막힌 칸/걷는 칸)과 다르다.\n"
             "확인 범위: 키트 칸이 위층에 통째로 있는가, 칸 통행이 선언과 같은가(시트 통행표). 이벤트 실행·그림의 미감·3/4 시점(이 그림들은 관문 미통과다)·모델이 실제로 잘 놓는지는 보지 않는다.")
    url, iid = cfg['url'], cfg['img_id']
    doc = dict(id=cfg['doc_id'], name=cfg['title'] + ' — 사전·순서·예제·오류', markdown='\n'.join(L))
    images = [dict(id=iid + 'scene', name='objects-scene.png', caption=f"이야기 기물 {n}종 조립 예제 — 원본 해상도 {im.width}×{im.height}(시트 칸 이어 붙임). 3/4 관문 미통과 — 오너 면제 그림.", dataUrl=url + 'objects-scene.png'),
              dict(id=iid + 'scene-3x', name='objects-scene-3x.png', caption='같은 장면 3배 최근접 확대.', dataUrl=url + 'objects-scene-3x.png'),
              dict(id=iid + 'err', name='objects-err.png', caption=f"정상(왼쪽) · {a['name']}을 아래층에(가운데) · {b['name']} 첫 줄 빠짐(오른쪽), 2배 최근접. 빨간 상자 = 변조 자리.", dataUrl=url + 'objects-err.png')]
    return doc, images, dict(scene=d, tamper=[(desc, [list(x) for x in e[:3]]) for desc, e in rows])
