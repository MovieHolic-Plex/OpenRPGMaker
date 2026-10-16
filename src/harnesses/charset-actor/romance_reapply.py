#!/usr/bin/env python3
"""모델 호출 없이 후보의 edit.json 을 현재 SPECS 로 다시 적용·검증해 chip.* 을 다시 쓴다.  python3 romance_reapply.py RUNDIR KEY"""
import json
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import romance_specs  # noqa: E402,F401
import chr as C  # noqa: E402
import partedit as P  # noqa: E402

run, key = Path(sys.argv[1]), sys.argv[2]
cdir = run / key
meta = json.loads((cdir / 'meta.json').read_text())
work = cdir / 'reapply'
work.mkdir(exist_ok=True)
shutil.copy(cdir / 'edit.json', work / 'edit.json')
(work / 'base.json').write_text(json.dumps(dict(base=meta['base'])))
res, errs, warns, m = P.run_apply(work, write=True)
print(key, 'OK' if res else 'FAIL', errs, warns)
if res:
    pal2 = {'.': None, **{c: v for c, v in res['pal'].items() if any(c in r for rows in res['frames'].values() for r in rows)}}
    (cdir / 'chip.chr.txt').write_text(C.dump(pal2, {}, res['frames'], header=f'{key} — reapplied\nbase {meta["base"]}'))
    C.sheet_rgba(pal2, res['frames']).save(cdir / 'chip.png')
    meta.update(ok=True, warnings=warns, metrics=m, reapplied=True)
    (cdir / 'meta.json').write_text(json.dumps(meta, ensure_ascii=False, indent=1))
