"""sky_steam 참고문서 굽기 — tiledata/AI-REFERENCE-CONTRACT.md 의 8항목을 채운다(사전·실행 순서·조립 예제·전체 배열·정상/오류·검사 범위·층 정정).

  python3 scripts/content/sky-steam/bake_refs_sky.py

산출: src/assets/skySteamReferences.json(그림은 경로만, 바이트 없음) · public/assets/sky-steam-references/*.png(원본 해상도, 확대는 nearest 만)
예제 그림은 구운 시트에서 칸 배열로 다시 그린 실제 출력이다(모형 아님). 오류 그림은 정상 예제를 실제로 변조하고 sky_check 가 잡은 코드·좌표를 적는다.
"""
from __future__ import annotations
import copy, json, os, sys
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import bake_sky as BS  # noqa: E402
import steam_b_scenes as SC  # noqa: E402
import sky_check as CK  # noqa: E402

ROOT = BS.ROOT
OUT_JSON = os.path.join(ROOT, 'src/assets/skySteamReferences.json')
IMG_DIR = os.path.join(ROOT, 'public/assets/sky-steam-references')
URL = '/assets/sky-steam-references/'
T = 16


def head(d):
    rows = (d['count'] + d['tilesPerRow'] - 1) // d['tilesPerRow']
    return (f"tilesetId `sky_steam` · 그림 `public/assets/sky-steam/sky-steam-chipset.png`(텍스처 `tex_sky_steam`, **{d['count']}칸**, 16px 칸, 시트 "
            f"{d['tilesPerRow'] * 16}×{rows * 16}px, 한 줄 **{d['tilesPerRow']}칸** — 번호 n 의 칸은 열 n%{d['tilesPerRow']}, 행 n÷{d['tilesPerRow']}(내림), 픽셀 (열×16, 행×16), 모두 0 기준). "
            "계열 `oprn-sky-steam` — 다른 칩셋(버들항·일본 도시·조선·마법 학교·실내 v5)의 칸 번호와 섞지 않는다. 줄 A(하늘섬, `sky-a-*`)와 줄 B(증기 산업도시, `steam-*`)가 한 시트다.\n\n")


def label_img(items, sheet, d, bg=(92, 104, 96, 255), maxw=760):
    """키트 그림(시트에서 다시 조립한 실제 출력) + ASCII 이름표. items = [(label, Image)]."""
    pad = 6; x = pad; y = pad; rowh = 0; pos = []
    for lab, im in items:
        w = max(im.width, 6 * len(lab)) ; h = im.height + 12
        if x + w > maxw: x = pad; y += rowh + pad; rowh = 0
        pos.append((lab, im, x, y)); x += w + pad; rowh = max(rowh, h)
    out = Image.new('RGBA', (maxw, y + rowh + pad), bg); dr = ImageDraw.Draw(out)
    for lab, im, px, py in pos:
        out.alpha_composite(im, (px, py)); dr.text((px, py + im.height + 1), lab, fill=(255, 255, 255, 255))
    return out


def kit_image(k, sheet, tpr):
    import bake_lib as BL
    return BL.reassemble(k, sheet, tpr)


def rows_txt(k):
    lo = [r['tiles'] for r in k['rows']]; up = [r['upperTiles'] for r in k['rows']]
    return json.dumps(lo, separators=(',', ':')), json.dumps(up, separators=(',', ':'))


def kit_dict(kits, d):
    out = ['| id | 이름 | 칸(w×h) | 아래층 rows(-1=비움) | 위층 rows | 막힘·걷기(행마다: X 막힘 · F 걷는 땅 · * 지나감(사람 위) · f 걷는 덧그림 · . 빈 칸) |', '|---|---|---|---|---|---|']
    for k in kits:
        lo, up = rows_txt(k)
        pas = []
        for r in k['rows']:
            s = ''
            for a, b in zip(r['tiles'], r['upperTiles']):
                t = b if b >= 0 else a
                if t < 0: s += '.'; continue
                p = d['tileMeta'][t].get('passage')
                s += '*' if p == 'star' else ('X' if not d['passability'][t]['up'] else ('f' if b >= 0 else 'F'))
            pas.append(s)
        out.append(f"| `{k['id']}` | {k['name']} | {k['width']}×{k['height']} | `{lo}` | `{up}` | `{' / '.join(pas)}` |")
    return '\n'.join(out)


def scene_doc(sc, connect, errs, title):
    W = sc.w
    lo = '\n'.join(f'y{y:02d}: ' + json.dumps(sc.lower[y * W:(y + 1) * W], separators=(',', ':')) for y in range(sc.h))
    up = '\n'.join(f'y{y:02d}: ' + json.dumps(sc.upper[y * W:(y + 1) * W], separators=(',', ':')) for y in range(sc.h))
    pl = '\n'.join(f"- `{kid}` 원점 ({x},{y}) · {w}×{h}칸" for kid, x, y, w, h in sc.placed)
    return (f"# 조립 예제 — {title}\n\n입력: {sc.w}×{sc.h}칸 맵. 아래 순서대로 칠하면 그림 `ex-{sc.id}.png` 와 같은 출력이 된다(원본 해상도, 구운 시트에서 칸 배열로 다시 그린 실제 출력).\n\n"
            f"## 놓은 키트(찍는 순서 = 뒤에 찍은 것이 위층 칸을 덮는다)\n{pl}\n\n"
            f"## 자동 검사\n`sky_check` 결과 오류 {len(errs)}건{' — 통과' if not errs else ''}. 이어져야 하는 건물: {', '.join(connect) if connect else '장면의 모든 건물'}.\n\n"
            f"## 아래층 전체 배열(lowerTiles, 행 우선, -1 = 빈 칸)\n```\n{lo}\n```\n\n## 위층 전체 배열(upperTiles)\n```\n{up}\n```\n")


def draw_errs(im, errs):
    im = im.copy(); dr = ImageDraw.Draw(im)
    for code, x, y, _ in errs:
        dr.rectangle([x * T, y * T, x * T + T - 1, y * T + T - 1], outline=(255, 40, 40, 255), width=2)
    return im


def main():
    b = BS.bake(dry=True); d = b['data']; sheet = b['sheet']; tpr = d['tilesPerRow']
    os.makedirs(IMG_DIR, exist_ok=True)
    for f in os.listdir(IMG_DIR): os.remove(os.path.join(IMG_DIR, f))
    imgs = {}

    def save(name, im, caption):
        im.save(os.path.join(IMG_DIR, name + '.png'), optimize=True)
        imgs[name] = dict(id=f'sky-img-{name}', name=name + '.png', caption=caption, dataUrl=URL + name + '.png')
        return imgs[name]

    H = head(d)
    save('sheet', sheet, f"시트 전체(원본 해상도 {sheet.width}×{sheet.height}px). 번호 n 은 열 n%{tpr}, 행 n÷{tpr}.")
    kits = d['structureKits']
    cats = {
        'a': [k for k in kits if k['id'].startswith('sky-a-')],
        'b-out': [k for k in kits if k['id'].startswith('steam-') and not k['id'].startswith(('steam-i-', 'steam-wall'))],
        'b-in': [k for k in kits if k['id'].startswith(('steam-i-', 'steam-wall'))],
    }
    kit_imgs = {}
    for c, ks in cats.items():
        chunk, n = [], 1
        for k in ks:
            chunk.append((k['id'].replace('steam-', '').replace('sky-a-', 'a-'), kit_image(k, sheet, tpr)))
        im = label_img(chunk, sheet, d)
        kit_imgs[c] = [save(f'kits-{c}', im, f"{({'a': '줄 A 하늘섬', 'b-out': '줄 B 거리·마당·부두', 'b-in': '줄 B 실내'})[c]} 키트 그림(원본 해상도, 시트에서 다시 조립한 실제 출력). 이름표 = id(steam- 뗌, sky-a- → a-).")]

    # 오토타일 그림(마스크 번호 = 칸 위 숫자)
    auto_imgs = []
    for a in d['autotileGroups']:
        masks = sorted({int(m) for m in a['variantMap']} if a['neighborhood'] == 4 else {BS.canon(m) for m in range(256)})
        items = [(str(m), sheet.crop(((a['variantMap'][str(m)] % tpr) * T, (a['variantMap'][str(m)] // tpr) * T, (a['variantMap'][str(m)] % tpr) * T + T, (a['variantMap'][str(m)] // tpr) * T + T)).resize((32, 32), Image.NEAREST)) for m in masks]
        auto_imgs.append(save(f"auto-{a['id'].replace('steam-at-', '')}", label_img(items, sheet, d, maxw=520), f"{a['name']} — 이웃 마스크(N1 E2 S4 W8 NE16 SE32 SW64 NW128)별 칸, 2배 nearest."))

    # 예제 + 오류 변조
    CONNECT = dict(street=('steam-tenement', 'steam-inn', 'steam-workshop', 'steam-clocktower', 'steam-pumphouse', 'steam-station'),
                   yard=('steam-factory-hall', 'steam-boilerhouse', 'steam-foundry'), dock=('steam-hangar',), boiler=(), inn=())
    TITLE = dict(street='증기 도시 거리(뒷줄·차도·전차·앞줄)', yard='공장 마당(선로·관·크레인)', boiler='보일러실(천장 테·벽·격자 바닥·기계)', inn='여관 1층(벽지 벽·판자 바닥·가구)', dock='비공정 부두(구름 바다·갑판·하늘섬)')
    scenes, ex_docs, ex_imgs, bad_lines = {}, [], [], []
    for fn in SC.SCENES:
        sc = fn(b); scenes[sc.id] = sc
        errs = CK.check(sc, CONNECT.get(sc.id))
        assert not errs, (sc.id, errs[:3])
        ex_imgs.append(save(f'ex-{sc.id}', sc.render(), f"정상 예제 {TITLE[sc.id]} {sc.w}×{sc.h}칸 — 원본 해상도 실제 출력, 검사 오류 0."))
        ex_docs.append(dict(id=f'sky-ex-{sc.id}', name=f'예제 {TITLE[sc.id]}', markdown=H + scene_doc(sc, CONNECT.get(sc.id), errs, TITLE[sc.id])))

    def bad(base, name, mutate, why):
        sc = copy.copy(scenes[base]); sc.lower = list(sc.lower); sc.upper = list(sc.upper); sc.placed = list(sc.placed)
        mutate(sc)
        errs = CK.check(sc, CONNECT.get(base))
        ok = scenes[base].render(); bd = draw_errs(sc.render(), errs)
        pair = Image.new('RGBA', (ok.width * 2 + 8, ok.height), (255, 255, 255, 255)); pair.paste(ok, (0, 0)); pair.paste(bd, (ok.width + 8, 0))
        im = save(f'bad-{name}', pair, f"왼쪽 정상 · 오른쪽 오류({why}) — 빨간 칸 = 검사가 잡은 좌표.")
        codes = sorted({e[0] for e in errs})
        bad_lines.append(f"| `bad-{name}.png` | {why} | {', '.join(codes)} | {'; '.join(f'{c} ({x},{y})' for c, x, y, _ in errs[:6])} |")
        return im

    bad_imgs = [
        bad('street', 'door', lambda s: (s.kit('steam-brick-wall', 7, 9), s.kit('steam-brick-wall', 9, 9), s.kit('steam-brick-wall', 11, 9)), '여관 문 앞 줄을 벽돌 담으로 막음'),
        bad('dock', 'cloud', lambda s: s.kit('sky-a-house', 36, 1), '줄 A 집을 섬 없이 구름 위에 놓음'),
        bad('boiler', 'layer', lambda s: [s.lower.__setitem__(i, s.upper[i]) for i in range(len(s.upper)) if s.upper[i] >= 0 and i // s.w in (4, 5)], '기계 위층 칸을 아래층 배열에 씀'),
        bad('yard', 'cut', lambda s: s.kit('steam-warehouse', 40, 20), '창고 키트를 맵 오른쪽 끝에 걸쳐 찍음(잘림)'),
        bad('street', 'reach', lambda s: s.auto('steam-at-pipe', {(x, 16) for x in range(44)} | {(x, 17) for x in range(44)}), '차도 아래 보도를 관 띠로 끊음(앞줄 건물로 못 감)'),
    ]

    # ── 문서 ──────────────────────────────────────────────────────────
    groups_tbl = '\n'.join(f"| `{g['id']}` | {g['name']} | {g['defaultLayer']} | {len(g['tileIds'])} | {g['tileIds'][0]}…{g['tileIds'][-1]} |" for g in d['tileGroups'])
    autos_tbl = '\n'.join(f"| `{a['id']}` | {a['name']} | {a['neighborhood']}방 | {a.get('layer', 'lower')} | {a['variantMap']['255' if a['neighborhood'] == 8 else '15']} | {len(a['memberTileIds'])} |" for a in d['autotileGroups'])
    strips_tbl = ', '.join(f"{s['baseTile']}(×{s['frames']})" for s in d['animationStrips'][:80])
    order = H + """# 하늘섬·증기 도시 (sky_steam) — 읽는 순서 · 층과 통행 · 실행 순서

스팀펑크 손 도트 칩셋 하나에 두 줄이 있다. **줄 A 하늘섬**: 구름 바다·떠 있는 섬·풍차·등대·비공정·기구(작은 축척 — 문 8px). **줄 B 증기 산업도시**: 벽돌·철 공장, 보일러동, 톱니 탑, 공동주택, 여관, 역, 가스 탱크, 배관, 선로·전차, 기중기, 가스등, 비공정 격납고·계류탑, 실내(공방·보일러실·기관실·연구소·여관) — 사람 크기 문(22~26px).

## 맵 한 장은 compose_sky_steam 이 기본
`compose_sky_steam({mapId, kind:"street"|"yard"|"dock"|"island", seed})` 가 땅 → 길·선로·관 → 건물 → 소품을 규칙으로 엮는다(같은 인자 = 같은 맵). 손으로 쌓을 때만 아래 순서를 따른다.

## 칸 분류(엔진 판정과 같음)
| 분류 | 층(홈) | 통행 | 뜻 |
|---|---|---|---|
| floor | 아래층 | 걷는다 | 땅(판석·자갈·마당·선로·갑판·바닥·섬 풀) |
| solidfloor | 아래층 | 막힘 | 구름 바다·섬 절벽 앞면·천장 테·실내 벽·갑판 앞 거더 |
| solid | 위층 | 막힘 | 건물·기물의 아랫줄(발), 관 |
| star (★) | 위층 | 지나감 | 건물 지붕·벽 윗부분 — 사람이 뒤로 지나가고 사람 위에 그려진다 |
| flat | 위층(잠금) | 걷는다 | 투명 덧그림(깔개·톱니 더미·섬 가장자리 풀) — 사람 밑 |

투명 여부 ≠ 층 ≠ 통행: 위층 칸은 투명 화소가 있어도 아래층 칸이 밑에 있어야 한다(위층만 찍으면 빈 칸이 검게 보인다).

## 실행 순서 — 거리(street)
1. 땅: 맵 전체를 보도 판석 `sky:fill:steam-t-flag` 한 재질로(변형 0 을 기본, 7칸에 하나만 다른 변형 — 바둑판 금지).
2. 차도: 가로 띠(높이 6 권장) 영역에 8방 오토타일 `steam-at-cobble`(연석이 자동). 전차가 다니면 차도 가운데 줄에 4방 `steam-at-tramrail`.
3. 뒷줄 건물: 차도 위쪽. 건물 키트의 **맨 아래 줄(막힘)이 차도 바로 위 보도 줄의 한 줄 위**에 오게 찍는다(문 앞 접근칸 = 건물 바로 아래 보도 줄). 건물 사이 1칸 띄움. 건물 줄을 맵 북쪽 끝에 붙인다 — 위에 빈 보도 띠를 남기지 않는다(남으면 맵을 줄인다).
4. 앞줄 건물: 차도 아래. 앞줄 건물 아래에 보도 한 줄을 남긴다.
5. 소품: 가스등 `steam-gaslamp-tall-lit`(밤)/`steam-gaslamp-tall`(낮) 8칸 간격, 건물 문 앞 칸을 피해서. 우체통·벤치·거리 시계·가판대는 문 앞이 아닌 보도에 1~2개씩.
6. 탈것: 전차는 tramrail 위(바퀴 줄 = 레일 줄), 마차는 남쪽을 보므로 남북 길·역 앞에만.

## 실행 순서 — 공장 마당(yard)
1. 땅 `sky:fill:steam-t-yard`(한 재질). 2. 큰 건물(공장·보일러동·가스 탱크·주물 공장·급수탑·기관고)을 북쪽 줄에. 굴뚝 `steam-chimney-tall` 위 칸에 `steam-smoke-anim`.
3. 선로 `steam-at-rail`(4방): 기관고 문 앞에서 시작해 마당을 가로지르고, 끝에 `steam-buffer-stop`. 기관차는 남북 선로 위, 화차는 동서 선로 위.
4. 관 `steam-at-pipe`(4방, 위층·막힘): 두 끝을 건물 발 줄 바로 아래에서 끝낸다(흙 위에서 끝내지 않음). 길을 가로막지 않게.
5. 소품은 무리로: 크레인 밑 상자 2~4개, 건물 벽 앞 통·드럼, 기관고 옆 석탄 더미. 마당 전체에 고르게 뿌리지 않는다.

## 실행 순서 — 실내(보일러실·공방·여관)
1. 테두리: 방 바깥 한 칸 고리를 천장 오토타일 `steam-at-ceiling`(남벽 문 한 칸만 비움).
2. 북벽: x=1..w-2 에 벽 키트(1×3, 맨 위 천장 칸은 오토타일이 덮어도 된다) — 같은 방은 한 재질(`steam-wall-plate*` 기계실, `steam-wall-brick*` 공방, `steam-wall-paper*` 여관·연구소), 변형(관·창·계기)은 3~5칸에 하나.
3. 바닥: y=3..h-2 를 한 재질(강판·판자·바둑 타일·격자).
4. 벽 부착물(`kind wall_mounted`: 계기판·관 벽·톱니판·벽 가스등·공구판)은 벽 앞면 두 줄(y=1..2)에만. 톱니판·계기는 강판 벽에만.
5. 높은 가구(책장·술통 거치대·난로)는 밑단을 바닥 첫 줄(y=3)에. 큰 기계부터 놓고 길(문→각 기계 앞) 한 줄을 비운다.

## 실행 순서 — 부두·하늘섬(dock / island)
1. 맵 전체 구름 바다 `sky:fill:sky-a-cloud-sea`(걷지 못함).
2. 갑판 `steam-at-deck`(8방, 아래층 불투명): 직사각형 영역. 남쪽 가장자리 줄은 거더 면이라 막힘.
3. 갑판 위: 격납고, 기중기, 계류탑(갑판 **동/서 가장자리**), 연료 펌프·캡스턴·상자. 비공정 `sky-a-airship-anim` 은 계류탑 바로 옆 구름 위.
4. 섬: 풀 `sky:fill:sky-a-grass-top` 직사각형 + 남쪽 한 줄 절벽 `sky-a-island-edge`(왼끝·가운데·오른끝). 줄 A 건물(집·풍차·등대)은 섬 풀 위에만, 문 앞 한 줄을 풀로 남긴다. 다리 `sky-a-bridge` 는 양 끝이 섬 풀·갑판에 닿을 때만.
5. 줄 A 건물을 줄 B 건물 옆에 두지 않는다(축척이 다르다 — A 는 먼 섬의 작은 집).

## 금지
- 다칸 키트를 낱칸 번호로 칠하기(반드시 stamp_object `kit:sky_steam/<id>`). 키트를 맵 밖에 걸치기(잘림).
- 띠 전체를 한 바닥으로 덮고 끝내기(빈 땅) — 빈 줄이 남으면 맵을 줄인다.
- 다른 칩셋 번호 섞기. 위층 칸을 아래층 배열에(또는 반대로).
"""
    sheetmap = H + "# 시트 지도 — 그룹별 칸 번호\n\n| 그룹 id | 이름 | 층(멤버 홈에서 유도) | 칸 수 | 범위 |\n|---|---|---|---|---|\n" + groups_tbl + \
        "\n\n## 움직이는 칸(baseTile × frames, fps 6)\n맵에는 **baseTile 번호만** 칠한다(엔진이 연속 칸을 돌린다). 키트에 이미 baseTile 이 들어 있다.\n\n" + strips_tbl + "\n"
    autodoc = H + "# 오토타일 8종\n\n| id | 이름 | 이웃 | 층 | 몸통 칸 | 칸 수 |\n|---|---|---|---|---|---|\n" + autos_tbl + """

- 8방(47칸): 마스크 N1 E2 S4 W8 NE16 SE32 SW64 NW128 — 대각은 양옆 두 변이 다 이어질 때만 센다(canon). 맵 가장자리 밖은 이어진 것으로 본다.
- 4방(16칸): N1 E2 S4 W8. 선로·전차 선로·관은 한 칸 폭 길(lay_path)로 그린다. 끝 칸(이웃 1개)은 막음 테/차막이가 그려진다.
- 붓·fill_region·lay_path 가 이웃에 맞는 칸을 고른다. 낱칸 번호로 모서리를 고르지 않는다.
- `steam-at-pipe` 는 위층·막힘(관 밑에 땅 칸이 있어야 한다). `steam-at-ceiling`·`steam-at-deck` 는 아래층 불투명(갑판 바깥 모서리는 구름으로 그려져 있다).
"""
    checkdoc = H + """# 자동 검사 범위 · 층 정정

| 코드 | 뜻 | 판정 근거 |
|---|---|---|
| `SKY-KIT-CUT` | 키트가 맵 밖으로 잘림 | 원점+폭/높이 > 맵 |
| `SKY-LAYER` | 위층 홈 칸이 아래층 배열에(또는 반대) | 칸 홈 = 잠긴 칸은 meta.defaultLayer, 아니면 priority(엔진 tileLayerHome 과 같음) |
| `SKY-NO-GROUND` | 건물·소품 맨 아래 줄 밑(아래층)이 비었거나 구름 | 나는 것(비공정·기구·구름·연기·섬·다리·부두)은 제외 |
| `SKY-DOOR-BLOCKED` | 건물 바로 아래 줄에 걷는 칸이 없음 | 위층 solid → 막힘, flat → 걸음, star·빈 위층 → 아래층 통행 |
| `SKY-UNREACHABLE` | 이어야 할 건물 문 앞끼리 4방 걸음으로 못 감 | 위와 같은 통행으로 BFS |

검사는 칸 배열의 **구조·통행만** 본다. 문을 지나 실내로 가는 이벤트(전이)·대사·미적 품질·조수 모델의 성공률은 이 검사로 주장하지 않는다.
compose_sky_steam 은 복제본에서 짜고 이 검사를 통과해야 맵에 반영한다(실패하면 부분 배치가 남지 않는다).

## 오류 예(정상 예제를 실제로 변조해 검사로 잡은 것)
| 그림 | 변조 | 코드 | 좌표(칸) |
|---|---|---|---|
""" + '\n'.join(bad_lines) + """

## 층 정정(before → after, 굽기 규칙에서 고침)
- 갑판 `steam-at-deck`: before = 위층 투명 덧그림(flat). 갑판 위 건물이 같은 위층 칸을 덮으면 밑이 구름으로 비어 보였다(검사 SKY-NO-GROUND 30건). after = 아래층 불투명(바깥 둥근 모서리는 구름 화소), 남쪽 거더 줄 막힘.
- 실내 동·서·남 테두리: before = 북벽용 천장 칸을 그대로 칠해 가로줄이 세로로 쌓였다. after = 천장 테 8방 오토타일 `steam-at-ceiling`(아래층·막힘).
- flat 칸(깔개·톱니 더미·섬 가장자리 풀): priority 는 lower 지만 meta 가 defaultLayer upper 로 **잠겨** 있어 엔진 홈은 위층이다 — 위층 배열에 쓴다.
"""
    dict_a = H + "# 줄 A 하늘섬 — 키트 사전\n\n각 키트는 `stamp_object({objectId:\"kit:sky_steam/<id>\", x, y})` 로 왼쪽 위 원점(dx 0, dy 0)에 찍는다. 행 문자열은 위층이 있으면 위층, 없으면 아래층 칸의 통행.\n섬 조각(`sky-a-island-*`)은 장식용 작은 섬이다 — 건물을 올릴 섬은 풀 채움 + 절벽 한 줄로 짓는다(실행 순서 참고).\n\n" + kit_dict(cats['a'], d)
    dict_bo = H + "# 줄 B 증기 도시 — 거리·마당·부두·탈것 키트 사전\n\n찍는 법은 줄 A 와 같다. 건물(structure)은 맨 아래 줄이 막힘(문 그림이 있는 줄) — 그 **바로 아래 줄**이 문 앞 접근칸이라 걷는 땅이어야 한다. 문을 지나 실내로 가는 것은 그 접근칸 위 전이 이벤트로 따로 둔다.\n움직이는 키트(`*-anim`)의 칸 번호는 baseTile 이다.\n\n" + kit_dict(cats['b-out'], d)
    dict_bi = H + "# 줄 B 증기 도시 — 실내 키트 사전(공방·보일러실·기관실·연구소·여관 + 벽)\n\n벽 키트 `steam-wall-*` 는 1×3(천장 칸·벽 위·벽 아래). 벽 부착물(wall_mounted)은 벽 앞면 두 줄에만 찍는다. 의자·걸상은 막힘(앉기는 이벤트).\n\n" + kit_dict(cats['b-in'], d)

    refs = [
        dict(id='sky-start', name='하늘섬·증기 도시 · 읽는 순서·층·실행 순서', description='처음 읽는 문서: 칸 좌표, 층·통행 분류, 맵 종류별 실행 순서, 금지, 시트 지도.',
             documents=[dict(id='sky-order', name='읽는 순서·층·실행 순서', markdown=order), dict(id='sky-sheet-map', name='시트 지도(그룹·움직이는 칸)', markdown=sheetmap)],
             images=[imgs['sheet']]),
        dict(id='sky-kits-a', name='하늘섬·증기 도시 · 줄 A 하늘섬 키트', description='줄 A 키트 50종 사전(원점·아래/위층 행·통행).', documents=[dict(id='sky-dict-a', name='줄 A 키트 사전', markdown=dict_a)], images=kit_imgs['a']),
        dict(id='sky-kits-b-out', name='하늘섬·증기 도시 · 줄 B 거리·마당·부두 키트', description='줄 B 바깥 키트 사전.', documents=[dict(id='sky-dict-b-out', name='줄 B 바깥 키트 사전', markdown=dict_bo)], images=kit_imgs['b-out']),
        dict(id='sky-kits-b-in', name='하늘섬·증기 도시 · 줄 B 실내 키트', description='줄 B 실내 기물·벽 키트 사전.', documents=[dict(id='sky-dict-b-in', name='줄 B 실내 키트 사전', markdown=dict_bi)], images=kit_imgs['b-in']),
        dict(id='sky-autotile', name='하늘섬·증기 도시 · 오토타일', description='8방 4종(자갈 차도·마당·벽돌 포장·갑판·천장 테)·4방 3종(선로·전차 선로·관).', documents=[dict(id='sky-auto', name='오토타일 8종', markdown=autodoc)], images=auto_imgs),
        dict(id='sky-examples', name='하늘섬·증기 도시 · 조립 예제(전체 배열)', description='거리·공장 마당·보일러실·여관·부두 완성 예제 5장 — 입력, 아래/위층 전체 배열, 원본 해상도 출력.', documents=ex_docs, images=ex_imgs),
        dict(id='sky-check', name='하늘섬·증기 도시 · 자동 검사·오류 예·층 정정', description='검사 코드·범위, 정상/오류 나란한 그림 5쌍, 층 정정 before/after.', documents=[dict(id='sky-check-doc', name='자동 검사 범위·오류 예·층 정정', markdown=checkdoc)], images=bad_imgs),
    ]
    open(OUT_JSON, 'w', encoding='utf-8').write(json.dumps(refs, ensure_ascii=False, indent=1) + '\n')
    n_docs = sum(len(c['documents']) for c in refs); n_img = sum(len(c['images']) for c in refs)
    print('용도', len(refs), '문서', n_docs, '그림', n_img, 'json', os.path.getsize(OUT_JSON), '그림 바이트', sum(os.path.getsize(os.path.join(IMG_DIR, f)) for f in os.listdir(IMG_DIR)))
    for l in bad_lines: print(l)


if __name__ == '__main__':
    main()
