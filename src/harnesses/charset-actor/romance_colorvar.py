#!/usr/bin/env python3
"""모델 호출 없는 색 변형(Argon 쿼터 소진 대용, 2026-10-16). 이미 하네스를 통과한 후보의 edit.json 에서 모델이 새로 정한 팔레트 글자만
부위별(H·T·B·S)로 색상 변환해 새 후보를 만든다. 모양(paint)·부위 규칙은 그대로이며 같은 하네스 검증(partedit.run_apply)을 다시 통과해야 한다.
  python3 romance_colorvar.py RUNDIR SRC_KEY NEW_KEY SPEC.json    (SPEC: {"label": "...", "H": {hue,s,v}, "T": {...}, "B": ..., "S": ...})
변환 {hue: 목표 색상(0~360)|null, s: 채도 배수, v: 명도 배수, hue_min_s: 이 채도 미만(무채색)은 색상 유지}
"""
import colorsys
import json
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import romance_specs  # noqa: E402,F401
import chr as C  # noqa: E402
import partedit as P  # noqa: E402
import harness as H  # noqa: E402

LETTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'


def xf(hexv, t):
    r, g, b = P.hex_rgb(hexv)
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    if t.get('v_below') is not None and v >= t['v_below']:   # 밝은 글자(셔츠 흰색 등)는 그대로
        return hexv
    if t.get('hue') is not None and (s >= t.get('hue_min_s', 0.18) or t.get('set_s') is not None):
        h = (t['hue'] / 360.0) % 1.0
        if t.get('set_s') is not None:
            s = max(s, t['set_s'])
    s = min(1.0, s * t.get('s', 1.0))
    v = min(1.0, v * t.get('v', 1.0))
    r, g, b = colorsys.hsv_to_rgb(h, s, v)
    return '#%02x%02x%02x' % (round(r * 255), round(g * 255), round(b * 255))


def main():
    run, src, new, spec_path = Path(sys.argv[1]), sys.argv[2], sys.argv[3], Path(sys.argv[4])
    spec = json.loads(spec_path.read_text(encoding='utf-8'))
    meta = json.loads((run / src / 'meta.json').read_text())
    edit = json.loads((run / src / 'edit.json').read_text())
    bpal, _ = H.base_of(meta['base'])
    pal = dict(edit.get('palette') or {})
    used = set(bpal) | set(pal)
    use = {}                                              # 글자 → 쓰는 부위 집합
    for rc in edit.get('recolor', []):
        for n in rc['map'].values():
            use.setdefault(n, set()).add(rc['region'])
    for pt in edit.get('paint', []):
        for row in pt['rows'].values():
            for ch in row:
                use.setdefault(ch, set()).add(pt['region'])
    for ch in list(pal):                                  # 안 쓰는 글자는 팔레트에서 뺀다
        if ch not in use:
            del pal[ch]
    used = set(bpal) | set(pal)
    free = [c for c in LETTERS if c not in used]
    newpal, remap, inplace = {}, {}, {}

    def nl(region, ch):
        if ch not in pal or region not in spec:           # 베이스 글자·변환 없는 부위는 그대로
            return ch
        if use.get(ch, set()) <= set(spec) - {'label'}:   # 변환하는 부위에서만 쓰는 글자는 제자리 변환
            if ch not in inplace:
                inplace[ch] = xf(pal[ch], spec[region]) if len({json.dumps(spec[r], sort_keys=True) for r in use[ch]}) == 1 else None
            if inplace[ch] is not None:
                newpal[ch] = inplace[ch]
                return ch
        k = (region, ch)
        if k not in remap:
            c = free.pop(0)
            remap[k] = c
            newpal[c] = xf(pal[ch], spec[region])
        return remap[k]

    out = dict(edit)
    out['recolor'] = [dict(rc, map={o: nl(rc['region'], n) for o, n in rc['map'].items()}) for rc in edit.get('recolor', [])]
    out['paint'] = [dict(p, rows={y: ''.join(nl(p['region'], ch) for ch in row) for y, row in p['rows'].items()}) for p in edit.get('paint', [])]
    out['palette'] = {**pal, **newpal}   # 제자리 변환은 newpal 이 덮는다
    cdir = run / new
    work = cdir / 'attempts' / '1'
    work.mkdir(parents=True, exist_ok=True)
    (work / 'edit.json').write_text(json.dumps(out, ensure_ascii=False, indent=1))
    (work / 'base.json').write_text(json.dumps(dict(base=meta['base'])))
    res, errs, warns, m = P.run_apply(work, write=True)
    print(new, 'OK' if res else 'FAIL', errs[:5], warns[:1])
    if not res:
        sys.exit(1)
    pal2 = {'.': None, **{c: v for c, v in res['pal'].items() if any(c in r for rows in res['frames'].values() for r in rows)}}
    (cdir / 'chip.chr.txt').write_text(C.dump(pal2, {}, res['frames'], header=f'{new} — color variant of {src}\nbase {meta["base"]}'))
    C.sheet_rgba(pal2, res['frames']).save(cdir / 'chip.png')
    shutil.copy(work / 'edit.json', cdir / 'edit.json')
    meta2 = dict(meta, key=new, variant=spec['label'], model='script-colorvar(of %s)' % meta.get('model', ''), effort=meta.get('effort', 'high'),
                 ok=True, warnings=warns, metrics=m, colorvar_of=src, attempts=[dict(n=1, agy_exit=None, errors=[], warnings=warns)])
    (cdir / 'meta.json').write_text(json.dumps(meta2, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
