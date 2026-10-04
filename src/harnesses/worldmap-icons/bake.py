"""사람 선택만 굽는다. SQLite는 읽기 전용, 칸 번호·선택 그림 해시는 저장소에 고정한다."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
DATA = Path(os.environ.get('WMI_HARNESS_DATA', '~/.local/share/oprn/worldmap-icon-harness')).expanduser()
LEDGER = ROOT / 'harness-data/worldmap-icons/slots.json'
SOURCE = ROOT / 'tiledata/worldmap-kit/selected'
SHEET = ROOT / 'public/assets/worldmap-icons/worldmap-selected.png'
META = ROOT / 'src/assets/worldmapSelectedSheet.json'
REFS = ROOT / 'src/assets/worldmapSelectedReferences.json'
BASE = ROOT / 'public/assets/easyrpg-chipset-world-transparent.png'
COLS, TILE, BASE_ROWS = 30, 16, 16
THEMES = {'fantasy': '판타지', 'desert-east': '사막·동양풍', 'modern-sf': '현대·SF'}


def read_json(path, fallback=None):
    return json.loads(path.read_text()) if path.exists() else fallback


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def live_selections():
    c = sqlite3.connect(f'file:{DATA}/harness.sqlite?mode=ro', uri=True)
    c.row_factory = sqlite3.Row
    c.execute('begin')
    items = {r['id']: dict(r) for r in c.execute('select * from items')}
    decisions = {}
    for r in c.execute('select * from decisions order by id'):
        if items.get(r['item'], {}).get('sha') != r['sha'] or r['decision'] == 'drop':
            continue
        if r['decision'] == 'clear':
            decisions.pop(r['item'], None)
        else:
            decisions[r['item']] = dict(r)
    pins = read_json(LEDGER, {}).get('selections', {})
    selected = []
    for key, d in sorted(decisions.items()):
        if d['client'] != 'web' or d['decision'] not in ('accept', 'pick'):
            continue
        it = items[key]
        original = DATA / 'items' / it['iset'] / it['name'] / 'icon.png'
        if hashlib.sha1(original.read_bytes()).hexdigest()[:12] != it['sha']:
            raise ValueError(f'{key}: 원본 그림이 선택 당시 해시와 다르다. intake 후 사람이 다시 골라야 한다.')
        file, candidate, attempt = original, None, None
        if d['decision'] == 'pick':
            candidate = d['note'].partition('|')[0]
            match = re.fullmatch(r'r(\d+)/([A-Z])', candidate)
            if not match:
                raise ValueError(f'{key}: 잘못된 후보 id')
            rnd, letter = int(match[1]), match[2]
            cand = c.execute('select c.*,r.item from cands c join rounds r on r.id=c.round '
                             'where c.round=? and c.letter=?', (rnd, letter)).fetchone()
            if not cand or cand['item'] != key or cand['status'] != 'done' or not cand['finished'] or cand['finished'] > d['at']:
                raise ValueError(f'{key}: 선택 당시 끝난 자기 후보가 아니다')
            if cand['verdict'] != 'PASS' and not (cand['engine'] or '').startswith(('render:', 'hand:')):
                raise ValueError(f'{key}: 현재 선택 후보의 검수 관문이 닫혔다')
            attempt = d.get('candidate_attempt') or cand['attempt']
            file = DATA / 'rounds' / f'r{rnd}' / letter / f'a{attempt}' / 'cand.png'
        sha = digest(file)
        bound = d.get('image_sha256') or pins.get(str(d['id']))
        if bound and bound != sha:
            raise ValueError(f'{key}: 사람이 고른 그림의 SHA256이 바뀌었다. 새 선택이 필요하다.')
        w, h = json.loads(it['cells'])
        if Image.open(file).size != (w * TILE, h * TILE):
            raise ValueError(f'{key}: 선택 그림 크기가 칸 수와 다르다')
        selected.append(dict(id=key, theme=it['iset'], name=it['descr'], role=it['role'],
                             width=w, height=h, decision=d['decision'], decisionId=d['id'],
                             selectedAt=d['at'], baseSha=it['sha'], candidate=candidate,
                             attempt=attempt, sha256=sha, file=file))
    c.close()
    if not selected:
        raise ValueError('현재 사람이 고른 아이콘이 없다')
    return selected


def pixels(file):
    im = Image.open(file).convert('RGBA')
    data = im.get_flattened_data() if hasattr(im, 'get_flattened_data') else im.getdata()
    im.putdata([(0, 0, 0, 0) if p[:3] == (255, 103, 139) else
                (0, 0, 0, 80) if p[:3] == (254, 103, 139) else p for p in data])
    return im


def layout(selected, ledger):
    slots = ledger.setdefault('slots', {})
    x, y, row_height = ledger.get('cursor', [0, BASE_ROWS, 0])
    for item in selected:
        w, h = item['width'], item['height']
        if item['id'] not in slots:
            if x + w > COLS:
                x, y, row_height = 0, y + row_height, 0
            slots[item['id']] = dict(x=x, y=y, width=w, height=h)
            x += w
            row_height = max(row_height, h)
        slot = slots[item['id']]
        if (slot['width'], slot['height']) != (w, h):
            raise ValueError(f"{item['id']}: 출하한 칸 크기를 바꾸지 않는다. 다른 id로 등록해야 한다.")
        item.update(x=slot['x'], y=slot['y'])
        item['rows'] = [[(slot['y'] + dy) * COLS + slot['x'] + dx for dx in range(w)] for dy in range(h)]
        ledger.setdefault('selections', {})[str(item['decisionId'])] = item['sha256']
    ledger['cursor'] = [x, y, row_height]
    return max(BASE_ROWS, y + row_height)


def render(selected, rows):
    sheet = Image.new('RGBA', (COLS * TILE, rows * TILE))
    sheet.paste(Image.open(BASE).convert('RGBA'), (0, 0))
    occupied = set()
    for item in selected:
        for row in item['rows']:
            for tile in row:
                if tile < COLS * BASE_ROWS or tile >= COLS * rows or tile in occupied:
                    raise ValueError(f"{item['id']}: 칸이 겹치거나 시트 밖이다")
                occupied.add(tile)
        sheet.paste(pixels(item['file']), (item['x'] * TILE, item['y'] * TILE))
    return sheet


def guidance(selected):
    categories = []
    folder = ROOT / 'public/assets/worldmap-icons-references'
    folder.mkdir(parents=True, exist_ok=True)
    instruction = '''# 사람 선택 월드맵 아이콘

tilesetId=worldmap_selected, tex_worldmap_selected, 16px, 30열. 원본 지형 0~479 뒤에 사람 선택 아이콘을 붙였다.
source SHA256·선택 후보·시트 판본은 worldmapSelectedSheet.json/selected.json에 있다. 아래 사전의 원점은 0기준 시트 칸이고 픽셀 원점은 x*16,y*16이다.

## 놓는 순서
1. list_worldmap_icons로 id·크기를 읽는다. read_tileset_reference로 용도 문서와 원본 그림을 끝까지 확인한다.
2. 지형을 먼저 깐다. stamp_worldmap_icon(mapId,iconId,at:{x,y})로 전체 위층 배열을 원형 그대로 찍는다.
   다른 월드맵 타일셋이면 번들 그림을 타일 이식으로 덧붙인다. map.tilesetId와 기존 지형 번호는 바뀌지 않는다.
3. 아이콘은 고정 조각이다. 이어 붙이기·회전·타일 번호별 재조립을 하지 않는다. 겹친 위층·맵 밖이면 전체 배치를 거부한다.
4. 땅·도시·성·탑·동굴은 열린 육지 받침에만 놓는다. floating 역할만 바다 위에 허용한다. 밑줄 중앙 1칸이 출입구이며 나머지 밑줄은 막힌다.
   위쪽 줄은 ★(tileMeta.passage=star)로 아래 지형의 통행을 따른다. 투명 여부와 통행은 별개다.
5. entrance=(at.x+floor(width/2),at.y+height-1), approach=(entrance.x,entrance.y+1).
   문 그림·접근 칸·이동 이벤트는 별개다. stamp는 이벤트를 만들지 않는다. create_map_transfer로 연결하고 실제 플레이로 왕복을 확인한다.
6. 집 실내·가구·숲·울타리 조립 부품은 이 사전에 없다. 실내는 atlas_biome_interior, 던전·배는 atlas_biome_dungeon의 현재 참고문서를 읽는다.
7. inspect_worldmap_icon으로 저장한 맵의 모든 칸을 정답 배열과 대조한다. 누락은 MISSING_CELL, 다른 그림은 WRONG_CELL로 실제 맵 좌표와 함께 반환한다.

검사는 그림 해시·칸 수·배열·경계·기존 위층 충돌·받침을 확인한다. 이벤트 실행과 미적 품질, 모델 성공률은 별도 검증이다.
'''
    (SOURCE / 'README.md').write_text(instruction)
    for theme in sorted({i['theme'] for i in selected}):
        group = [i for i in selected if i['theme'] == theme]
        cid = 'wmi-' + theme
        documents = []
        thumb = Image.new('RGB', (800, ((len(group) + 7) // 8) * 120), '#d7e1c5')
        draw = ImageDraw.Draw(thumb)
        for n, item in enumerate(group):
            x, y = n % 8 * 100, n // 8 * 120
            icon = pixels(item['file'])
            factor = min(3, 96 // max(icon.size))
            icon = icon.resize((icon.width * factor, icon.height * factor), Image.Resampling.NEAREST)
            thumb.paste(icon, (x + (100 - icon.width) // 2, y + 10), icon)
            draw.text((x + 3, y + 106), str(n + 1), fill='black')
        preview = f'{theme}.png'
        thumb.quantize(colors=128).save(folder / preview)
        markdown = instruction + f'\n## {THEMES.get(theme, theme)} 전체 사전\n\n![번호별 실제 그림](image:{cid}-sheet)\n'
        for n, item in enumerate(group):
            empty = [[-1] * item['width'] for _ in range(item['height'])]
            markdown += f'\n### {n + 1}. {item["id"]}\n\n{item["name"]}\n\n'
            markdown += '```json\n' + json.dumps(dict(id=item['id'], role=item['role'],
                            origin=dict(x=item['x'], y=item['y']), width=item['width'], height=item['height'],
                            lower=empty, upper=item['rows']), ensure_ascii=False) + '\n```\n'
        (SOURCE / f'{theme}.md').write_text(markdown)
        documents.append(dict(id=cid + '-catalog', name=THEMES.get(theme, theme) + ' 전체 배열·조립 순서', markdown=markdown))
        categories.append(dict(id=cid, name='월드맵 · ' + THEMES.get(theme, theme), description='사람이 선택한 아이콘의 정확한 칸·전체 배열·출입구 계약',
                               documents=documents, images=[dict(id=cid + '-sheet', name='선택 아이콘 실제 그림',
                               caption='번호는 사전 순서. 실제 PNG를 정수 배율 nearest로 확대한 그림이다.',
                               dataUrl='/assets/worldmap-icons-references/' + preview)]))
    # 실제 배열 한 칸을 빼고 오류 비교를 만든다. 정상·결손은 타일 좌표를 통해 재현할 수 있다.
    item = selected[0]
    normal = pixels(item['file'])
    broken = normal.copy()
    broken.paste((0, 0, 0, 0), (0, normal.height - TILE, TILE, normal.height))
    compare = Image.new('RGB', (normal.width * 2 + 16, normal.height), '#d7e1c5')
    compare.paste(normal, (0, 0), normal); compare.paste(broken, (normal.width + 16, 0), broken)
    compare.resize((compare.width * 3, compare.height * 3), Image.Resampling.NEAREST).save(folder / 'missing-cell.png')
    example = dict(iconId=item['id'], at=dict(x=4, y=4), lower=[[-1]*item['width'] for _ in range(item['height'])], upper=item['rows'],
                   error=dict(code='MISSING_CELL', mapCell=dict(x=4, y=4+item['height']-1), sourceTile=item['rows'][-1][0]))
    text = '## 전체 배치 예제와 실제 결손 오류\n\n```json\n' + json.dumps(example) + '\n```\n\n'
    text += '![왼쪽 정상·오른쪽 밑줄 왼쪽 한 칸 결손](image:wmi-missing-cell)\n\n왼쪽 배열을 그대로 찍으면 정상이다. 오른쪽은 upper[height-1][0]=-1로 변조한 오류다. lower의 -1은 기존 지형을 보존한다는 뜻이다.\n'
    categories[0]['documents'].append(dict(id='wmi-example', name='전체 배치·결손 오류', markdown=text))
    categories[0]['images'].append(dict(id='wmi-missing-cell', name='정상과 결손 비교', caption='MISSING_CELL: 예제 원점(4,4)의 밑줄 왼쪽 칸', dataUrl='/assets/worldmap-icons-references/missing-cell.png'))
    (SOURCE / 'example.md').write_text(text)
    write_json(REFS, categories)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('stage', choices=['build', 'check'])
    ap.add_argument('--snapshot', action='store_true', help='커밋한 선택·원본 사본으로 재현한다(SQLite 불필요)')
    args = ap.parse_args()
    if args.snapshot:
        selected = read_json(SOURCE / 'selected.json')['icons']
        for item in selected:
            item['file'] = SOURCE / item['source']
            if digest(item['file']) != item['sha256']:
                raise ValueError(f"{item['id']}: 원본 사본 해시가 다르다")
    else:
        selected = live_selections()
    ledger = read_json(LEDGER, dict(schema='worldmap-icon-slots/1', slots={}, selections={}))
    old_ledger = json.dumps(ledger, sort_keys=True)
    rows = layout(selected, ledger)
    sheet = render(selected, rows)
    if args.stage == 'check':
        if json.dumps(ledger, sort_keys=True) != old_ledger:
            raise ValueError('선택·슬롯 사본이 낡았다. build가 필요하다')
        meta = read_json(META)
        if meta['count'] != rows * COLS or sheet.tobytes() != Image.open(SHEET).convert('RGBA').tobytes():
            raise ValueError('번들 PNG·칸 수가 현재 선택과 다르다')
        expected = [{k:v for k,v in item.items() if k not in ('file', 'source')} for item in selected]
        if meta['icons'] != expected:
            raise ValueError('번들 사전이 현재 선택과 다르다')
        for cat in read_json(REFS):
            for image in cat['images']:
                if not (ROOT / 'public' / image['dataUrl'].lstrip('/')).is_file():
                    raise ValueError('참고 이미지가 없다: ' + image['dataUrl'])
        print(f'선택 {len(selected)}개 · {rows * COLS}칸 · 해시/배열/PNG/참고 그림 일치')
        return
    SOURCE.mkdir(parents=True, exist_ok=True)
    snapshot = []
    for item in selected:
        relative = 'icons/' + item['sha256'] + '.png'
        target = SOURCE / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(item['file'].read_bytes())
        snapshot.append({**{k:v for k,v in item.items() if k != 'file'}, 'source': relative})
    write_json(SOURCE / 'selected.json', dict(schema='worldmap-icon-selected/1', icons=snapshot))
    write_json(LEDGER, ledger)
    SHEET.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(SHEET)
    write_json(META, dict(texture='tex_worldmap_selected', tileSize=TILE, tilesPerRow=COLS, count=rows * COLS,
                         baseSha256=digest(BASE), sheetSha256=digest(SHEET), icons=[{k:v for k,v in i.items() if k not in ('file', 'source')} for i in selected]))
    guidance(selected)
    print(f'사람 선택 {len(selected)}개 → {SHEET.relative_to(ROOT)} ({COLS}×{rows}칸)')


if __name__ == '__main__':
    main()
