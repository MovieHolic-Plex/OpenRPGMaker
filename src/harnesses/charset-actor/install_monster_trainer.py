#!/usr/bin/env python3
"""몬스터 수집 게임용 사람 걷기 칩(monster-trainer 계열)을 공용 번들 시트 MonsterTrainer<N> 으로 굽는다(2026-10-16).

install_ct_ff6.py(Heroes1)와 같은 경로·같은 규칙이다: 입력은 하네스가 낸 최종 격자
harness-data/charset-actor/monster-trainer-chips/<key>/chip.chr.txt 이며 **다시 그리지 않는다**. 격자를 RGBA 로 렌더해 시트 칸에 그대로 붙이고
칸 화소 해시를 명단에 남긴다. 한 시트 = 8칸(4열×2행, 칸 72×128 = 3패턴×4방향, 행 0 위·1 오른쪽·2 아래·3 왼쪽). 명단 순서가 칸 번호이고 덧붙이기 전용이다.

  python3 src/harnesses/charset-actor/install_monster_trainer.py          # 쓰기(시트 PNG + src/assets/monsterTrainerCharsets.json)
  python3 src/harnesses/charset-actor/install_monster_trainer.py --check  # 쓰지 않고 현재 번들이 입력과 화소 동일한지만 확인(0 이면 일치)

명단 harness-data/charset-actor/monster-trainer-install.json 은 `collect` 단계가 합격한 칩만으로 만든다(argon_part draw → 눈 검수 → collect).
  python3 src/harnesses/charset-actor/install_monster_trainer.py collect RUN [RUN ...] --keys mt-a-a,mt-b-a --spec monster-trainer-spec.json
베이스 칩이 EasyRPG RTP(CC BY 4.0)다 — public/assets/ATTRIBUTION.md 「MonsterTrainer」 절을 함께 유지한다.
사람 캐릭터라 3/4 관문(object-gate) 대상이 아니다. 닌텐도 원작·파생 그림은 쓰지 않는다.
"""
import argparse
import hashlib
import json
import os
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE))
import chr as C  # noqa: E402
from PIL import Image  # noqa: E402

SPEC = ROOT / 'harness-data/charset-actor/monster-trainer-install.json'
CHIPS = ROOT / 'harness-data/charset-actor/monster-trainer-chips'
SHEET_DIR = ROOT / 'public/assets/generated/charsets'
ROSTER = ROOT / 'src/assets/monsterTrainerCharsets.json'
SLOT_W, SLOT_H, COLS, ROWS = 72, 128, 4, 2
PER_SHEET = COLS * ROWS


def sha(data):
    return hashlib.sha256(data).hexdigest()


def render(key):
    grid = CHIPS / key / 'chip.chr.txt'
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
    meta = json.loads((CHIPS / key / 'meta.json').read_text(encoding='utf-8'))
    if not meta.get('ok'):
        raise SystemExit(f'{key}: 하네스 meta.ok 가 아니다')
    if meta.get('model') not in ('gemini-4-argon-high', 'gemini-4-argon-medium'):
        raise SystemExit(f'{key}: 저작 모델이 Argon 이 아니다 ({meta.get("model")})')
    return image, grid.read_bytes(), meta


def cmd_install(args):
    spec = json.loads(SPEC.read_text(encoding='utf-8'))
    chars = spec['characters']
    sheet_count = (len(chars) + PER_SHEET - 1) // PER_SHEET
    old = json.loads(ROSTER.read_text(encoding='utf-8')) if ROSTER.exists() else {'characters': []}
    old_by_id = {c['id']: c for c in old['characters']}
    sheets = [Image.new('RGBA', (COLS * SLOT_W, ROWS * SLOT_H), (0, 0, 0, 0)) for _ in range(sheet_count)]
    roster = []
    for index, row in enumerate(chars):
        image, grid_bytes, meta = render(row['key'])
        sheet_no, slot = index // PER_SHEET + 1, index % PER_SHEET
        sheets[sheet_no - 1].paste(image, ((slot % COLS) * SLOT_W, (slot // COLS) * SLOT_H))
        entry = {
            'id': row['id'], 'name': row['name'], 'desc': row['desc'], 'genre': row['genre'], 'role': row['role'],
            'gender': row.get('gender'), 'age': row.get('age'), 'tags': row['tags'], 'sheet': sheet_no, 'index': slot,
            'source': {
                'harnessKey': row['key'], 'model': meta['model'], 'baseChip': meta['base'],
                'gridSha256': sha(grid_bytes), 'slotRgbaSha256': sha(image.tobytes()),
            },
        }
        prev = old_by_id.get(row['id'])
        if prev and not args.force and (prev['sheet'], prev['index']) != (entry['sheet'], entry['index']):
            raise SystemExit(f'{row["id"]}: 설치된 칸 번호가 바뀐다 ({prev["sheet"]},{prev["index"]}) → ({entry["sheet"]},{entry["index"]}). 번호는 덧붙이기 전용이다.')
        if prev and not args.force and prev['source']['slotRgbaSha256'] != entry['source']['slotRgbaSha256']:
            raise SystemExit(f'{row["id"]}: 설치된 그림의 화소가 바뀐다. 검수한 그림과 달라지므로 거절한다(--force 로만 덮는다).')
        roster.append(entry)
    missing = [c['id'] for c in old['characters'] if c['id'] not in {r['id'] for r in roster}]
    if missing and not args.force:
        raise SystemExit(f'명단에서 빠진 설치 id: {missing}. 기존 칸 번호·id 는 불변(덧붙이기)이다.')
    document = {'version': 1, 'sheets': sheet_count, 'sheetName': spec['sheet']['name'], 'selection': spec['selection'], 'characters': roster}
    text = json.dumps(document, ensure_ascii=False, indent=1) + '\n'
    outs = [SHEET_DIR / f'MonsterTrainer{n}.png' for n in range(1, sheet_count + 1)]
    if args.check:
        same_png = all(p.exists() and Image.open(p).convert('RGBA').tobytes() == s.tobytes() for p, s in zip(outs, sheets))
        same_json = ROSTER.exists() and ROSTER.read_text(encoding='utf-8') == text
        print(json.dumps({'sheetPixelsIdentical': same_png, 'rosterIdentical': same_json}))
        sys.exit(0 if same_png and same_json else 1)
    SHEET_DIR.mkdir(parents=True, exist_ok=True)
    for p, s in zip(outs, sheets):
        s.save(p, 'PNG')
    ROSTER.write_text(text, encoding='utf-8')
    for e in roster:
        print(e['id'], f'sheet{e["sheet"]}#{e["index"]}', e['source']['slotRgbaSha256'][:8], e['name'])
    for p in outs:
        print(p.relative_to(ROOT), sha(p.read_bytes())[:12])
    print(ROSTER.relative_to(ROOT))


def verify_chip(src, key):
    """수집 전 독립 재검증: edit.json 을 베이스에 다시 적용해 chip.chr.txt 와 12프레임 화소가 같은지, 불변 검사(얼굴·맨살·다리·걷기 포즈)가 오류 0 인지 확인한다."""
    import partedit as P
    meta = json.loads((src / 'meta.json').read_text(encoding='utf-8'))
    if not meta.get('ok'):
        raise SystemExit(f'{key}: meta.ok 가 아니다')
    edit = json.loads((src / 'edit.json').read_text(encoding='utf-8'))
    pal, new, bframes, bpal, labels, zones, changed, kind, rep = P.apply_edits(meta['base'], edit)
    errs = list(rep['errors'])
    errs2, _, _ = P.verify(meta['base'], pal, new, bframes, bpal, labels, zones, changed, kind, gear_report=rep.get('gear'))
    errs += errs2
    if errs:
        raise SystemExit(f'{key}: 재검증 오류 {errs[:3]}')
    cpal, _, cframes = C.load(src / 'chip.chr.txt')
    for fk, rows in new.items():
        for y in range(C.FH):
            for x in range(C.FW):
                a, b = rows[y][x], cframes[fk][y][x]
                ca, cb = (pal.get(a) if a != '.' else None), (cpal.get(b) if b != '.' else None)
                if ca != cb:
                    raise SystemExit(f'{key}: 재적용 결과가 chip.chr.txt 와 {fk} ({x},{y}) 에서 다르다')
    face_fixed = sum(1 for fk in new for y in range(C.FH) for x in range(C.FW) if labels[fk][y][x] == 'F')
    print(f'verified {key}: 12프레임 재적용 일치, 고정 부위(얼굴·맨살) {face_fixed}칸 픽셀 동일, 불변 검사 오류 0')


def cmd_collect(args):
    """합격한 칩만 하네스 실행 폴더에서 입력 폴더로 복사한다(chip.chr.txt·edit.json·meta.json)."""
    out_root = Path(os.environ.get('CTFF6_PART_OUT', ROOT / 'qa-runs/harnesses/ct-ff6-part'))
    spec = json.loads(Path(args.spec).read_text(encoding='utf-8'))
    wanted = [k for k in args.keys.split(',') if k]
    for key in wanted:
        src = None
        for run in args.runs:
            cand = out_root / run / key
            if (cand / 'chip.chr.txt').exists():
                src = cand
        if not src:
            raise SystemExit(f'{key}: 합격 칩을 {args.runs} 에서 찾지 못했다')
        verify_chip(src, key)
        dst = CHIPS / key
        dst.mkdir(parents=True, exist_ok=True)
        for name in ('chip.chr.txt', 'edit.json', 'meta.json'):
            shutil.copy(src / name, dst / name)
        print('collected', key, '←', src)
    print('다음: monster-trainer-install.json 에 명단(id·name·desc·tags)을 적고 install_monster_trainer.py 를 실행한다.', len(spec['archetypes']), '원형 중', len(wanted), '종')


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest='cmd')
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--force', action='store_true')
    c = sub.add_parser('collect')
    c.add_argument('runs', nargs='+')
    c.add_argument('--keys', required=True)
    c.add_argument('--spec', default=str(ROOT / 'harness-data/charset-actor/monster-trainer-spec.json'))
    args = ap.parse_args()
    if args.cmd == 'collect':
        cmd_collect(args)
    else:
        cmd_install(args)


if __name__ == '__main__':
    main()
