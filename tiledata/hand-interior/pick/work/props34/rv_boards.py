import os, sys, json
sys.path.insert(0, '/home/main/z-project/rpg-zzu-v5-interior-props-34/scripts/content/hand-interior/props34')
import redraw as R, compare as C
W = os.path.dirname(os.path.abspath(__file__)) + '/rv'
res = R.build(); ids = list(res)
refs = [C.card('GOOD ' + r, R.frames(r)[0], 6) for r in ['bread shelf', 'wardrobe', 'globe']] + [C.card('BAD armchair', R.frames('armchair')[0], 6)]
m = {}
for b in range(0, len(ids), 4):
    grp = ids[b:b + 4]; n = b // 4
    rows = [C.row(refs), C.row([C.card(f'P{j+1} {k}', res[k][0], 6) for j, k in enumerate(grp)])]
    p = f'{W}/r2b{n}.png'; C.stack(rows, p); m[p] = grp
json.dump(m, open(W + '/r2map.json', 'w'), indent=1); print(len(ids), list(m.values()))
