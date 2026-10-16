#!/usr/bin/env python3
"""몬스터 수집용 사람 걷기 칩(Scarloxy People 변형)을 공용 번들 시트 ScarloxyPeople<N> 으로 굽는다(2026-10-16). install_modern_romance.py(Modern1~3)와 같은 경로·같은 규칙이다.

뼈대 = Scarloxy MPWSP01 People1~2 의 10명(CC BY 4.0). 사용자 결정: 「사람 칩은 기존 Scarloxy People 칩에서 변형해서 늘린다」, 후보 선별은 감독 위임.
입력은 변형 도구(scarloxy_compose.py build 또는 argon_part.py)가 낸 최종 격자 harness-data/charset-actor/scarloxy-people-chips/<key>/chip.chr.txt 이며, 이 스크립트는 **다시 그리지 않는다**:
격자를 RGBA 로 렌더해 시트 칸에 그대로 붙이고 칸 화소 해시를 명단에 남긴다(사용자가 본 그림 = 설치되는 그림).

  python3 src/harnesses/charset-actor/install_scarloxy_people.py          # 쓰기(시트 PNG + src/assets/scarloxyPeopleCharsets.json)
  python3 src/harnesses/charset-actor/install_scarloxy_people.py --check  # 쓰지 않고 현재 번들이 입력과 화소 동일한지만 확인(0 이면 일치)

산출: public/assets/generated/charsets/ScarloxyPeople<n>.png (288×256 RGBA, 8명=4열×2행, 칸 72×128 = 3패턴×4방향, 행 0 위·1 오른쪽·2 아래·3 왼쪽)
      src/assets/scarloxyPeopleCharsets.json (이름·설명·태그·칸 번호·화소 해시·원본 격자 해시·뼈대 계보)
칸 번호는 덧붙이기 전용이다: 이미 설치된 id 의 시트·칸·화소가 바뀌면 거절한다(--force 없이는 덮지 않는다). 명단은 harness-data/charset-actor/scarloxy-people-install.json.
뼈대 칩은 Scarloxy MPWSP01(CC BY 4.0, 제작 Scarloxy / Ismael Garcia)이다 — public/assets/ATTRIBUTION.md 「ScarloxyPeople」 절을 함께 유지한다.
사람 캐릭터 칩이라 3/4 관문(object-gate) 대상이 아니다(해당 없음).
2차(2026-10-16): 시트 5~ 의 칩은 Argon 부분 편집(scarloxy_argon2.py)·스크립트(scarloxy_compose.py)로 만들고 scarloxy_collect.py 가 명단에 덧붙인다. 설치·--check 는 scarloxy_lock.py 의 12프레임 화소 고정 검사를 통과해야 한다.
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE))
import chr as C  # noqa: E402
import scarloxy_lock as LOCK  # noqa: E402
from PIL import Image  # noqa: E402

SPEC = ROOT / 'harness-data/charset-actor/scarloxy-people-install.json'
PICKS = ROOT / 'harness-data/charset-actor/scarloxy-people-chips'
SHEET_DIR = ROOT / 'public/assets/generated/charsets'
ROSTER = ROOT / 'src/assets/scarloxyPeopleCharsets.json'
SLOT_W, SLOT_H, COLS, ROWS = 72, 128, 4, 2


def sha(data):
    return hashlib.sha256(data).hexdigest()


def render(key, n):
    grid = PICKS / key / 'chip.chr.txt'
    pal, _, frames = C.load(grid)
    errors = C.structural_errors(pal, frames)
    if errors:
        raise SystemExit(f'{key}: 구조 오류 {errors}')
    image = C.sheet_rgba(pal, frames)
    if image.size != (SLOT_W, SLOT_H) or image.mode != 'RGBA':
        raise SystemExit(f'{key}: 칩 규격 {image.size} {image.mode}')
    alpha = set(image.getchannel('A').tobytes())
    if not alpha <= {0, 255}:
        raise SystemExit(f'{key}: 반투명 화소 {sorted(alpha)}')
    meta = json.loads((PICKS / key / 'meta.json').read_text(encoding='utf-8'))
    if not meta.get('ok'):
        raise SystemExit(f'{key}: 하네스 meta.ok 가 아니다')
    if not (str(meta.get('model', '')).startswith('script-compose') or meta.get('model') in ('gemini-4-argon-high', 'gemini-4-argon-medium')):
        raise SystemExit(f'{key}: 저작 경로가 script-compose 나 Argon 이 아니다 ({meta.get("model")})')
    if n >= 5:   # 2차(시트 5~): 설치 직전에 얼굴·피부·손 12프레임 화소 고정 검사를 다시 한다(1~4 는 1차 승인분이라 불변).
        lock = LOCK.check(key)
        if not lock['ok']:
            raise SystemExit(f'{key}: 얼굴·피부·손 화소 고정 검사 실패 {lock["bad"]}칸 {lock["sample"]}')
    return image, grid.read_bytes(), meta


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--force', action='store_true')
    args = ap.parse_args()
    spec = json.loads(SPEC.read_text(encoding='utf-8'))
    old = json.loads(ROSTER.read_text(encoding='utf-8')) if ROSTER.exists() else {'characters': []}
    old_by_id = {c['id']: c for c in old['characters']}
    sheets, roster = {}, []
    for sheet_spec in spec['sheets']:
        n, chars = sheet_spec['n'], sheet_spec['characters']
        if len(chars) > COLS * ROWS:
            raise SystemExit(f'ScarloxyPeople{n}: 한 시트는 8칸이다. 새 시트로 나눈다(기존 칸 번호 유지).')
        sheet = Image.new('RGBA', (COLS * SLOT_W, ROWS * SLOT_H), (0, 0, 0, 0))
        for index, row in enumerate(chars):
            image, grid_bytes, meta = render(row['key'], n)
            sheet.paste(image, ((index % COLS) * SLOT_W, (index // COLS) * SLOT_H))
            entry = {
                'id': row['id'], 'name': row['name'], 'desc': row['desc'], 'genre': row['genre'], 'role': row['role'],
                'gender': row.get('gender'), 'age': row.get('age'), 'tags': row['tags'], 'sheet': n, 'index': index,
                'source': {
                    'harnessKey': row['key'], 'model': meta['model'], 'baseChip': meta['base'] if 'base' in meta else f"head {meta['head']} + body {meta['body']}",
                    'gridSha256': sha(grid_bytes), 'slotRgbaSha256': sha(image.tobytes()),
                },
            }
            prev = old_by_id.get(row['id'])
            if prev and not args.force and (prev['sheet'], prev['index']) != (entry['sheet'], entry['index']):
                raise SystemExit(f'{row["id"]}: 설치된 칸 번호가 바뀐다 ({prev["sheet"]},{prev["index"]}) → ({entry["sheet"]},{entry["index"]}). 번호는 덧붙이기 전용이다.')
            if prev and not args.force and prev['source']['slotRgbaSha256'] != entry['source']['slotRgbaSha256']:
                raise SystemExit(f'{row["id"]}: 설치된 그림의 화소가 바뀐다. 사용자가 본 그림과 달라지므로 거절한다(--force 로만 덮는다).')
            roster.append(entry)
        sheets[n] = sheet
    missing = [c['id'] for c in old['characters'] if c['id'] not in {r['id'] for r in roster}]
    if missing and not args.force:
        raise SystemExit(f'명단에서 빠진 설치 id: {missing}. 기존 칸 번호·id 는 불변(덧붙이기)이다.')
    document = {'version': 1, 'sheets': len(sheets), 'sheetName': 'ScarloxyPeople{n} · Scarloxy 변형 인물 · OPRN', 'selection': spec['selection'], 'characters': roster}
    text = json.dumps(document, ensure_ascii=False, indent=1) + '\n'
    if args.check:
        same_png = all((SHEET_DIR / f'ScarloxyPeople{n}.png').exists() and Image.open(SHEET_DIR / f'ScarloxyPeople{n}.png').convert('RGBA').tobytes() == s.tobytes() for n, s in sheets.items())
        same_json = ROSTER.exists() and ROSTER.read_text(encoding='utf-8') == text
        print(json.dumps({'sheetPixelsIdentical': same_png, 'rosterIdentical': same_json}))
        sys.exit(0 if same_png and same_json else 1)
    SHEET_DIR.mkdir(parents=True, exist_ok=True)
    for n, sheet in sheets.items():
        out_png = SHEET_DIR / f'ScarloxyPeople{n}.png'
        sheet.save(out_png, 'PNG')
        print(out_png.relative_to(ROOT), sha(out_png.read_bytes())[:12])
    ROSTER.write_text(text, encoding='utf-8')
    for e in roster:
        print(e['id'], f'ScarloxyPeople{e["sheet"]}#{e["index"]}', e['source']['slotRgbaSha256'][:8], e['name'])
    print(ROSTER.relative_to(ROOT))


if __name__ == '__main__':
    main()
