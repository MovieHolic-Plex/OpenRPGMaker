"""답 → PNG(느슨한 읽기) → 역할 팔레트로 맞춤(OKLab) → 거울 반쪽 붙이기 → 기계 수치(크기·투명·색 수·잘림·지붕 테이퍼·바닥 이음·문 크기). 판정이 아니라 수치다."""
import json, os, sys
import numpy as np
from PIL import Image, ImageOps
import sfr_lib as L
import seam as S

H = L.HERE


def taper(im, rows):
    """지붕 줄(rows=(첫,끝))에서 왼쪽 끝 x 와 오른쪽 끝 x 의 퍼짐(px). 폭이 최대 폭의 60% 미만인 줄(안테나)은 뺀다."""
    a = np.array(im)[..., 3] == 255; r0, r1 = rows
    ls, rs = [], []
    wmax = max((a[y].sum() for y in range(r0, r1 + 1)), default=0)
    for y in range(r0, r1 + 1):
        xs = np.nonzero(a[y])[0]
        if len(xs) and (xs[-1] - xs[0] + 1) >= 0.6 * wmax: ls.append(int(xs[0])); rs.append(int(xs[-1]))
    if not ls: return None
    return dict(left=max(ls) - min(ls), right=max(rs) - min(rs), rows=len(ls))


def main(only=None):
    D = json.load(open(f'{H}/units.json', encoding='utf-8'))
    led = {}
    if os.path.exists(f'{H}/ledger.jsonl'):
        for line in open(f'{H}/ledger.jsonl'):
            r = json.loads(line); led[r['key']] = r
    out = []
    for o in D['objects']:
        if only and o['id'] not in only: continue
        r = dict(id=o['id'], name=o['name'], w=o['w'], h=o['h'], cls=o['cls'], kind=o['kind'], role=o['role'], mirror=bool(o.get('mirror')), shots=[], picture=None, defects=[])
        for n in (1, 2, 3):
            f = f'{H}/shots/{o["id"]}__{n}.json'
            if not os.path.exists(f): continue
            d = json.load(open(f)); cli = d.get('cli') or {}
            a = L.read_answer(o, cli.get('result')); lg = led.get(f'{o["id"]}__{n}', {})
            s = dict(n=n, wall=d.get('wall'), usd=lg.get('usd_counted'), output=lg.get('output'), thinking=lg.get('thinking'), stop=lg.get('stop'), picture=a['lenientOk'], strictOk=a['strictOk'], strictErrors=a['strictErrors'], note=a['note'], top=a['top'])
            if a['lenientOk']:
                raw = L.rows_to_png(a['legend'], a['rows'])
                im, changed = L.snap(raw, L.PAL.ramps_for(o['role'], o.get('extra', ())))
                s['snapped'] = changed
                im.save(f'{H}/png/{o["id"]}.half.png' if o.get('mirror') else f'{H}/png/{o["id"]}.png')
                if o.get('mirror'):
                    full = Image.new('RGBA', (im.width * 2, im.height)); full.alpha_composite(im, (0, 0)); full.alpha_composite(ImageOps.mirror(im), (im.width, 0)); im = full
                    im.save(f'{H}/png/{o["id"]}.png')
                arr = np.array(im); op = arr[..., 3] == 255
                s['fill'] = round(float(op.mean()), 2); s['colours'] = len({tuple(p[:3]) for p in arr.reshape(-1, 4) if p[3] == 255})
                ys = np.nonzero(op.any(axis=1))[0]; s['floatPx'] = int(im.height - 1 - ys.max()) if len(ys) else None
                # 잘림: 마지막 줄들이 통째로 비었는가(행 수 모자람) · 길이 틀린 행
                s['cut'] = bool(a['strictErrors'] and any('rows ' in e and '!=' in e for e in a['strictErrors']))
                badlen = [e for e in a['strictErrors'] if 'wrong length' in e]
                if badlen: s['badRows'] = badlen[0]
                # 빈 칸(16px 칸에 불투명 화소 없음)
                if o['cls'] in ('prop', 'flat', 'bwhole', 'roof', 'wall', 'mid'):
                    s['emptyCells'] = [(x // 16, y // 16) for y in range(0, im.height, 16) for x in range(0, im.width, 16) if not op[y:y + 16, x:x + 16].any()]
                if o['cls'] in ('bwhole', 'roof') and not o.get('round'):
                    rr = (0, o['roof'] - 1) if o['cls'] == 'bwhole' else (o.get('r0', 0), im.height - 1)
                    s['taper'] = taper(im, rr)
                if o['cls'] in ('ground',) and not o.get('overlay'):
                    s['seam'] = [S.seam(im.crop((x, 0, x + 16, 16))) for x in range(0, im.width, 16)]
                    # 서로 다른 칸끼리의 이음: 칸 i 오른쪽 열 ↔ 칸 j 왼쪽 열, 아래 줄 ↔ 위 줄 (밝기 차 평균)
                    Lm = arr[..., :3].astype(float) @ L.LUM; n_t = im.width // 16; cross = []
                    for i in range(n_t):
                        for j in range(n_t):
                            ti, tj = Lm[:, i * 16:(i + 1) * 16], Lm[:, j * 16:(j + 1) * 16]
                            cross.append(max(float(np.abs(ti[:, -1] - tj[:, 0]).mean()), float(np.abs(ti[-1, :] - tj[0, :]).mean())))
                    s['crossMax'] = round(max(cross), 1)
                if o.get('door'):
                    door = None
                    try:
                        txt = cli.get('result') or ''; j = json.loads(txt[txt.find('{'):txt.rfind('}') + 1]); door = j.get('door')
                    except Exception: pass
                    if isinstance(door, list) and len(door) == 4:
                        x, y, w, hh = door; w2 = w * 2 if (o.get('mirror') and x + w >= o['w'] - 1) else w
                        s['door'] = dict(declared=door, w=w2, h=hh, ok=bool(w2 >= 14 and 22 <= hh <= 34))
                    else: s['door'] = dict(declared=door, ok=None)
                r['picture'] = n
            r['shots'].append(s)
        if r['picture']:
            s = [x for x in r['shots'] if x['n'] == r['picture']][0]
            if s.get('cut'): r['defects'].append('cut off (missing rows)')
            if s.get('badRows'): r['defects'].append(s['badRows'])
            if s.get('emptyCells'): r['defects'].append(f'empty cells {s["emptyCells"][:6]}')
            t = s.get('taper')
            if t and (t['left'] > 2 or t['right'] > 2): r['defects'].append(f'roof taper left {t["left"]} right {t["right"]} px')
            if s.get('door') and s['door'].get('ok') is False: r['defects'].append(f'door {s["door"]["w"]}x{s["door"]["h"]}')
            if s.get('floatPx') and o['cls'] in ('prop', 'bwhole', 'wall') and s['floatPx'] > 2: r['defects'].append(f'floats {s["floatPx"]} px above the last row')
        elif r['shots']: r['defects'].append('no picture')
        out.append(r)
    if not only: json.dump(out, open(f'{H}/results.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    for r in out:
        for s in r['shots']:
            print(r['id'], s['n'], 'pic' if s['picture'] else 'NO', f"${s['usd']}", f"out={s['output']}", 'snap', s.get('snapped'), 'col', s.get('colours'), 'taper', s.get('taper'), 'door', s.get('door'), 'cross', s.get('crossMax'), s['strictErrors'][:2], '| DEFECTS', r['defects'])
    return out


if __name__ == '__main__':
    main(set(sys.argv[1:]) or None)
