#!/usr/bin/env python3
"""현대 연애물 인물 걷기 칩 24종을 공용 번들 시트 Modern1~3 로 굽는다(2026-10-16). install_ct_ff6.py(Heroes1)와 같은 경로·같은 규칙이다.

사용자가 「고르지 않는다, 기준으로 직접 거르라」 고 위임했고 제작자가 24종을 걸렀다(명단·순서: harness-data/charset-actor/romance-install.json).
입력은 하네스가 낸 최종 격자 harness-data/charset-actor/romance-pick1/<key>/chip.chr.txt 이며, 이 스크립트는 **다시 그리지 않는다**:
격자를 RGBA 로 렌더해 시트 칸에 그대로 붙이고 칸 화소 해시를 명단에 남긴다(사용자가 본 그림 = 설치되는 그림).

  python3 src/harnesses/charset-actor/install_modern_romance.py          # 쓰기(시트 PNG + src/assets/modernCharsets.json)
  python3 src/harnesses/charset-actor/install_modern_romance.py --check  # 쓰지 않고 현재 번들이 입력과 화소 동일한지만 확인(0 이면 일치)

산출: public/assets/generated/charsets/Modern<n>.png (288×256 RGBA, 8명=4열×2행, 칸 72×128 = 3패턴×4방향, 행 0 위·1 오른쪽·2 아래·3 왼쪽)
      src/assets/modernCharsets.json (이름·설명·태그·칸 번호·화소 해시·원본 격자 해시·베이스 칩 계보)
칸 번호는 덧붙이기 전용이다: 이미 설치된 id 의 시트·칸·화소가 바뀌면 거절한다(--force 없이는 덮지 않는다).
베이스 칩은 EasyRPG RTP(CC BY 4.0)다 — public/assets/ATTRIBUTION.md 「Modern1~3」 절을 함께 유지한다.
사람 캐릭터 칩이라 3/4 관문(object-gate) 대상이 아니다.
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
from PIL import Image  # noqa: E402

SPEC = ROOT / 'harness-data/charset-actor/romance-install.json'
PICKS = ROOT / 'harness-data/charset-actor/romance-pick1'
SHEET_DIR = ROOT / 'public/assets/generated/charsets'
ROSTER = ROOT / 'src/assets/modernCharsets.json'
SLOT_W, SLOT_H, COLS, ROWS = 72, 128, 4, 2


def sha(data):
    return hashlib.sha256(data).hexdigest()


def render(key):
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
            raise SystemExit(f'Modern{n}: 한 시트는 8칸이다. 새 시트로 나눈다(기존 칸 번호 유지).')
        sheet = Image.new('RGBA', (COLS * SLOT_W, ROWS * SLOT_H), (0, 0, 0, 0))
        for index, row in enumerate(chars):
            image, grid_bytes, meta = render(row['key'])
            sheet.paste(image, ((index % COLS) * SLOT_W, (index // COLS) * SLOT_H))
            entry = {
                'id': row['id'], 'name': row['name'], 'desc': row['desc'], 'genre': row['genre'], 'role': row['role'],
                'gender': row.get('gender'), 'age': row.get('age'), 'tags': row['tags'], 'sheet': n, 'index': index,
                'source': {
                    'harnessKey': row['key'], 'model': meta['model'], 'baseChip': meta['base'],
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
    document = {'version': 1, 'sheets': len(sheets), 'sheetName': 'Modern{n} · 현대 연애 인물 · OPRN', 'selection': spec['selection'], 'characters': roster}
    text = json.dumps(document, ensure_ascii=False, indent=1) + '\n'
    if args.check:
        same_png = all((SHEET_DIR / f'Modern{n}.png').exists() and Image.open(SHEET_DIR / f'Modern{n}.png').convert('RGBA').tobytes() == s.tobytes() for n, s in sheets.items())
        same_json = ROSTER.exists() and ROSTER.read_text(encoding='utf-8') == text
        print(json.dumps({'sheetPixelsIdentical': same_png, 'rosterIdentical': same_json}))
        sys.exit(0 if same_png and same_json else 1)
    SHEET_DIR.mkdir(parents=True, exist_ok=True)
    for n, sheet in sheets.items():
        out_png = SHEET_DIR / f'Modern{n}.png'
        sheet.save(out_png, 'PNG')
        print(out_png.relative_to(ROOT), sha(out_png.read_bytes())[:12])
    ROSTER.write_text(text, encoding='utf-8')
    for e in roster:
        print(e['id'], f'Modern{e["sheet"]}#{e["index"]}', e['source']['slotRgbaSha256'][:8], e['name'])
    print(ROSTER.relative_to(ROOT))


if __name__ == '__main__':
    main()
