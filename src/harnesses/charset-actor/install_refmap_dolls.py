#!/usr/bin/env python3
"""REFMAP 변형 인물 칩을 공용 번들 시트 RefmapDoll<N> 으로 설치한다(2026-10-28). install_scarloxy_people.py 와 같은 규칙(덧붙이기 전용·화소 해시).

칩은 비공개 생성기 char-gen 의 `refmap` 종이 인형이 만든다: REFMAP 인물 242명 중 한 사람의 머리 덩어리를 다른 사람의 몸에 얹고 목을 다시 그린 것.
짝 58,322개 → 숫자 관문(크기·성별·피부·뒷머리·만들어 넣은 칸·목) 4,798 → Kiro Opus 눈 검사 2,793 → 같은 인물의 색 바꾼 쌍둥이 짝 93개 뺌 → 2,700 → 원본 한쪽과 거의 같은 칩 133개 뺌 → 2,567. 사용자 위임(2026-10-28 「번들, 검수 위임」).
이름·외형 문장·역할·태그는 Kiro Opus 가 칩 8개씩 보고 적었다(char-gen `refmap.read_labels`). char-gen 이 시트와 명단을 내보내고,
이 스크립트는 **다시 그리지 않는다**: 내보낸 시트를 그대로 복사하고 칸 화소 해시를 명단과 맞춰 본다.

  python3 cli.py refmap --export <폴더>        # char-gen 쪽(비공개): RefmapDoll<n>.png + roster.json
  python3 src/harnesses/charset-actor/install_refmap_dolls.py --from <폴더>          # 쓰기
  python3 src/harnesses/charset-actor/install_refmap_dolls.py --from <폴더> --check  # 쓰지 않고 현재 번들이 같은지만(0 이면 같음)

산출: public/assets/generated/charsets/RefmapDoll<n>.png (288×256 RGBA, 8명 = 4열×2행, 칸 72×128 = 3패턴×4방향, 행 0 위·1 오른쪽·2 아래·3 왼쪽)
      src/assets/refmapDollCharsets.json (이름·설명·역할·태그·성별·나이·칸 번호 — 조수 검색용, 에디터만 읽는다)
      src/assets/refmapDollCharsets.ts 의 REFMAP_DOLL_SHEETS (시트 수 — 플레이어는 명단 JSON 없이 이것만 본다)
      harness-data/charset-actor/refmap-dolls-source.json (칸마다 머리·몸 원본 인물과 칸 RGBA SHA-256)
칸 번호는 덧붙이기 전용이다: 이미 설치된 id 의 시트·칸·화소가 바뀌면 거절한다(--force 없이는 덮지 않는다).
REFMAP 조건(변형 재배포 가능·출처 표기·소재 판매 금지·원본 재배포 금지): public/assets/ATTRIBUTION.md 「RefmapDoll」. 원본 시트는 이 저장소에 넣지 않는다.
사람 캐릭터 칩이라 3/4 관문(object-gate) 대상이 아니다.
"""
import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SHEET_DIR = ROOT / 'public/assets/generated/charsets'
ROSTER = ROOT / 'src/assets/refmapDollCharsets.json'
MODULE = ROOT / 'src/assets/refmapDollCharsets.ts'
SOURCE = ROOT / 'harness-data/charset-actor/refmap-dolls-source.json'
PREFIX = 'RefmapDoll'
CREDIT = 'REFMAP (http://refmap.wixsite.com/fsm-material), modified'
SLOT_W, SLOT_H, COLS = 72, 128, 4
FIELDS = ('id', 'name', 'desc', 'genre', 'role', 'gender', 'age', 'tags', 'sheet', 'index')


def slot_sha(sheet, index):
    x, y = (index % COLS) * SLOT_W, (index // COLS) * SLOT_H
    return hashlib.sha256(sheet.crop((x, y, x + SLOT_W, y + SLOT_H)).tobytes()).hexdigest()


def load_export(folder):
    roster = json.loads((folder / 'roster.json').read_text(encoding='utf-8'))
    if roster.get('credit') != CREDIT:
        sys.exit(f'roster.json 의 credit 이 「{CREDIT}」 가 아니다')
    sheets = {}
    for n in range(1, roster['sheets'] + 1):
        im = Image.open(folder / f'{PREFIX}{n}.png')
        if im.size != (288, 256) or im.mode != 'RGBA':
            sys.exit(f'{PREFIX}{n}.png: 288×256 RGBA 가 아니다({im.size}, {im.mode})')
        sheets[n] = im
    for c in roster['characters']:
        if slot_sha(sheets[c['sheet']], c['index']) != c['source']['slotRgbaSha256']:
            sys.exit(f"{c['id']}: 시트 칸 화소가 명단의 해시와 다르다")
        if not c.get('name') or not c.get('desc'):
            sys.exit(f"{c['id']}: 이름·외형 문장이 없다(char-gen refmap --labels 먼저)")
    return roster, sheets


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--from', dest='src', required=True, help='char-gen `refmap --export` 폴더')
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--force', action='store_true', help='설치된 칸의 그림·번호가 바뀌어도 덮는다')
    a = ap.parse_args()
    roster, sheets = load_export(Path(a.src))
    chars = roster['characters']
    old = {c['id']: c for c in json.loads(ROSTER.read_text(encoding='utf-8'))['characters']} if ROSTER.exists() else {}
    old_src = {s['id']: s for s in json.loads(SOURCE.read_text(encoding='utf-8'))['slots']} if SOURCE.exists() else {}
    moved = [c['id'] for c in chars if c['id'] in old and ((old[c['id']]['sheet'], old[c['id']]['index']) != (c['sheet'], c['index'])
                                                           or old_src.get(c['id'], {}).get('slotRgbaSha256') != c['source']['slotRgbaSha256'])]
    gone = sorted(set(old) - {c['id'] for c in chars})
    if a.check:
        same = not moved and not gone and len(old) == len(chars) and all(
            (SHEET_DIR / f'{PREFIX}{n}.png').exists() and Image.open(SHEET_DIR / f'{PREFIX}{n}.png').convert('RGBA').tobytes() == im.tobytes()
            for n, im in sheets.items())
        print('같다' if same else f'다르다 (바뀐 칸 {len(moved)}, 빠진 칸 {len(gone)}, 명단 {len(old)} → {len(chars)})')
        return 0 if same else 1
    if (moved or gone) and not a.force:
        sys.exit(f'설치된 칸이 바뀐다(바뀐 칸 {len(moved)}: {moved[:3]}, 빠진 칸 {len(gone)}: {gone[:3]}) — 덧붙이기 전용, 덮으려면 --force')
    SHEET_DIR.mkdir(parents=True, exist_ok=True)
    for n, im in sheets.items():
        im.save(SHEET_DIR / f'{PREFIX}{n}.png', optimize=True)
    for p in SHEET_DIR.glob(f'{PREFIX}*.png'):
        m = re.fullmatch(rf'{PREFIX}(\d+)\.png', p.name)
        if m and int(m[1]) not in sheets:
            p.unlink()
    lines = ',\n'.join(json.dumps({k: c[k] for k in FIELDS}, ensure_ascii=False) for c in chars)
    head = json.dumps(dict(version=1, sheets=roster['sheets'], sheetName=roster['sheetName'], credit=CREDIT,
                           selection=dict(by='user-delegated-to-supervisor',
                                          note='2026-10-28 사용자 「번들, 검수 위임」: char-gen refmap 의 숫자 관문과 Kiro Opus 눈 검사(dolleye)를 통과한 칩 전부. '
                                               '이름·외형 문장은 Kiro Opus 가 칩을 보고 적었다.')), ensure_ascii=False)
    ROSTER.write_text(head[:-1] + ', "characters": [\n' + lines + '\n]}\n', encoding='utf-8')
    SOURCE.parent.mkdir(parents=True, exist_ok=True)
    SOURCE.write_text(json.dumps(dict(credit=CREDIT, note='칸마다 머리·몸 원본 REFMAP 인물(시트-칸)과 칸 RGBA SHA-256. 원본 시트는 이 저장소에 없다(비공개 char-gen).',
                                      slots=[dict(id=c['id'], sheet=c['sheet'], index=c['index'], **c['source']) for c in chars]),
                                 ensure_ascii=False, indent=0) + '\n', encoding='utf-8')
    text = MODULE.read_text(encoding='utf-8')
    MODULE.write_text(re.sub(r'export const REFMAP_DOLL_SHEETS = \d+;', f"export const REFMAP_DOLL_SHEETS = {roster['sheets']};", text), encoding='utf-8')
    print(f"설치: 시트 {roster['sheets']}장, 칩 {len(chars)}개")
    return 0


if __name__ == '__main__':
    sys.exit(main())
