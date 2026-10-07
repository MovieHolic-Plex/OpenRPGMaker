"""얇은 재검수용 시트 — 지난 판정에서 FAIL 이었던 id 만 한 장에.
  python3 scripts/content/wizarding/recheck_sheet.py <모듈> ...
→ tiledata/wizarding/review/<모듈>-recheck.png (+ -p2 …). 재검수자는 이 한 장만 보고 판정을 고쳐 쓴 뒤 seal_verdict.py 를 돌린다."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import loader, wzlib  # noqa: E402

for m in sys.argv[1:]:
    j = json.load(open(os.path.join(wzlib.TD, 'review', f'{m}.judgments.json'), encoding='utf-8'))
    bad = {k for k, v in j.items() if isinstance(v, dict) and v.get('verdict') == 'FAIL'}
    reg = loader.load(m)
    for d in (reg.pieces, reg.autotiles, reg.characters):
        for k in list(d):
            if k not in bad: del d[k]
    wzlib.REG = reg
    out = wzlib.review_sheet(m, os.path.join(wzlib.TD, 'review', f'{m}-recheck.png'))
    print(m, '재검수 대상', len(bad), '→', out)
