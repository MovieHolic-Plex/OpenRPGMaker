#!/usr/bin/env python3
"""REFMAP 변형 인물 칩(RefmapDoll<N>)의 옆모습 전투 시트를 설치한다(2026-10-29). install_refmap_dolls.py 의 짝.

대표 인물 13명만 시트가 있다. 비공개 생성기 char-gen 의 battledraw 가 만든다: 모델(Claude Opus 5.5)이 칩을 보고 자세마다 화소를 찍고,
다른 호출이 그린 판을 적대적으로 검사해 결함을 적고, 그 지적으로 고쳐 그린다(걷기 3칸·정면은 칩 그대로). 파이썬은 칸에 놓고 묶고 검사만 한다.
이 스크립트는 **다시 그리지 않는다**: 내보낸 시트를 그대로 복사하고, 칸이 명단(refmapDollCharsets.json)에 있는지, 모든 칸이 전투 시트 규칙
(scripts/asset-gen/charset-battler/cb_lib.py validate: 48×48, 알파 0/255, 발끝 44행)을 지키는지 본다.

  char-gen 쪽(비공개): <폴더>/RefmapDoll<n>-<i>.png · cast/RefmapDoll<n>-<i>.png · battlers.json(characters: id·sheet·index·drawnBy)
  python3 src/harnesses/charset-actor/install_refmap_battlers.py --from <폴더>          # 쓰기
  python3 src/harnesses/charset-actor/install_refmap_battlers.py --from <폴더> --check  # 쓰지 않고 현재 번들이 같은지만(0 이면 같음)

산출: public/assets/generated/charset-battlers/refmap-doll/RefmapDoll<n>-<i>.png (144×384, 24자세)
      public/assets/generated/charset-battlers/refmap-doll/cast/RefmapDoll<n>-<i>.png (144×336, 7속성×3단계)
      src/assets/refmapDollCharsets.ts 의 REFMAP_DOLL_BATTLER_SLOTS (시트가 있는 칸 「시트-칸」 목록)
REFMAP 조건(고친 그림 재배포 가능·「고침」과 출처 표기·원본 재배포 금지): public/assets/ATTRIBUTION.md 「RefmapDoll」.
"""
import argparse
import json
import re
import sys
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / 'scripts/asset-gen/charset-battler'))
from cb_lib import POSES, validate  # noqa: E402

OUT = ROOT / 'public/assets/generated/charset-battlers/refmap-doll'
ROSTER = ROOT / 'src/assets/refmapDollCharsets.json'
MODULE = ROOT / 'src/assets/refmapDollCharsets.ts'
PREFIX = 'RefmapDoll'
CREDIT = 'REFMAP (http://refmap.wixsite.com/fsm-material), modified'
CELL = 48
FLOATING = {'victory', 'victory_b', 'cast_raise', 'evade'}


def cell_issues(name, im, cells):
    bad = []
    for pose, c, r in cells:
        for issue in validate(name, pose, im.crop((c * CELL, r * CELL, c * CELL + CELL, r * CELL + CELL))):
            bad.append(f'{name} {pose}: {issue}')
    return bad


def load(folder):
    meta = json.loads((folder / 'battlers.json').read_text(encoding='utf-8'))
    if meta.get('credit') != CREDIT:
        sys.exit(f'battlers.json 의 credit 이 「{CREDIT}」 가 아니다')
    roster = {c['id']: (c['sheet'], c['index']) for c in json.loads(ROSTER.read_text(encoding='utf-8'))['characters']}
    want = []
    for c in meta['characters']:
        if roster.get(c['id']) != (c['sheet'], c['index']):
            sys.exit(f'battlers.json 의 {c["id"]} (시트 {c["sheet"]} 칸 {c["index"]}) 가 명단(refmapDollCharsets.json)에 없거나 칸이 다르다')
        if not str(c.get('drawnBy', '')).startswith('claude-opus'):
            sys.exit(f'{c["id"]}: drawnBy 가 없다 — 모델이 그리고 검사·수정한 시트만 싣는다')
        want.append((c['id'], c['sheet'], c['index']))
    if not want or len(set(want)) != len(want):
        sys.exit('battlers.json 의 characters 가 비었거나 겹친다')
    cast_cells = [(f'cast{r}-{s}', s, r) for r in range(7) for s in range(3)]
    files, bad = {}, []
    for _, sheet, index in want:
        name = f'{PREFIX}{sheet}-{index}.png'
        battle, cast = Image.open(folder / name), Image.open(folder / 'cast' / name)
        if battle.size != (144, 384) or cast.size != (144, 336):
            sys.exit(f'{name}: 크기 {battle.size} / {cast.size} (144×384 / 144×336 이어야 한다)')
        b, c = battle.convert('RGBA'), cast.convert('RGBA')
        bad += cell_issues(name, b, [(p[0], p[1], p[2]) for p in POSES])
        # 마법 시트는 준비·들기 칸이 발을 땅에 두고, 발사 칸도 땅에 선다 — 같은 검사를 쓴다(들기 칸은 cast_raise 와 같이 뜰 수 있다).
        bad += [x for x in cell_issues(name + ' cast', c, cast_cells) if '떠 있음' not in x]
        files[name] = ((folder / name).read_bytes(), (folder / 'cast' / name).read_bytes())
    if bad:
        sys.exit(f'전투 시트 규칙 위반 {len(bad)}건: ' + '; '.join(bad[:5]))
    return files, want


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--from', dest='src', required=True, help='char-gen `refmap --battlers` 폴더')
    ap.add_argument('--check', action='store_true')
    a = ap.parse_args()
    files, want = load(Path(a.src))
    if a.check:
        same = all((OUT / n).exists() and (OUT / n).read_bytes() == b and (OUT / 'cast' / n).exists() and (OUT / 'cast' / n).read_bytes() == c
                   for n, (b, c) in files.items()) and len(list(OUT.glob(f'{PREFIX}*.png'))) == len(files)
        print('같다' if same else '다르다')
        return 0 if same else 1
    (OUT / 'cast').mkdir(parents=True, exist_ok=True)
    for n, (b, c) in files.items():
        (OUT / n).write_bytes(b)
        (OUT / 'cast' / n).write_bytes(c)
    for p in [*OUT.glob(f'{PREFIX}*.png'), *(OUT / 'cast').glob(f'{PREFIX}*.png')]:
        if p.name not in files:
            p.unlink()
    text = MODULE.read_text(encoding='utf-8')
    slots = ', '.join(f'"{s}-{i}"' for _, s, i in sorted(want, key=lambda w: (w[1], w[2])))
    MODULE.write_text(re.sub(r'export const REFMAP_DOLL_BATTLER_SLOTS: readonly string\[\] = \[[^\]]*\];',
                             f'export const REFMAP_DOLL_BATTLER_SLOTS: readonly string[] = [{slots}];', text), encoding='utf-8')
    print(f'설치: 전투 시트 {len(files)}장 + 마법 시트 {len(files)}장')
    return 0


if __name__ == '__main__':
    sys.exit(main())
