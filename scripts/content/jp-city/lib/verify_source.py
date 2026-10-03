"""이식본이 만든 시트·카탈로그를 원본(저장소 밖 ~/gv3-work 에서 굽던 jp_shopstreet16)과 비교한다.
  python3 verify_source.py --orig <원본 chipset 폴더> [--new <이식본 폴더>] [--json out.json]
원본은 행인(Actor1 person.0~39)이 들어 있고 이식본은 그 칸이 빈 칸이다. 비교는 '행인 칸을 뺀 부분집합'으로 한다(칸 번호는 같다)."""
import sys, json, argparse, os
import numpy as np
from PIL import Image
import jpenv

def load(d):
    cat = json.load(open(os.path.join(d, 'jp_shopstreet16.catalog.json')))
    sheet = np.array(Image.open(os.path.join(d, cat['sheet']['file'])).convert('RGBA'))
    return cat, sheet

def cell(sheet, i, cols=16): r, c = divmod(i, cols); return sheet[r * 16:(r + 1) * 16, c * 16:(c + 1) * 16]

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--orig', required=True); ap.add_argument('--new', default=jpenv.OUT); ap.add_argument('--json')
    a = ap.parse_args()
    oc, os_ = load(a.orig); nc, ns = load(a.new)
    res = {'sheetShapeOrig': list(os_.shape), 'sheetShapeNew': list(ns.shape), 'count': [oc['sheet']['count'], nc['sheet']['count']]}
    pidx = sorted({v for k, v in oc['names'].items() if k.startswith('prop.person.') and v is not None})
    S = set(pidx); n = oc['sheet']['count']
    res['personCells'] = len(pidx); res['personRange'] = [pidx[0], pidx[-1]]
    diff = [i for i in range(n) if i not in S and not (cell(os_, i) == cell(ns, i)).all()]
    res['nonPersonCells'] = n - len(S); res['nonPersonCellsDiffering'] = len(diff); res['nonPersonDiffIdx'] = diff[:20]
    res['newPersonCellsBlank'] = bool(all(not cell(ns, i)[..., 3].any() for i in S))
    res['origPersonCellsNonBlank'] = int(sum(1 for i in S if cell(os_, i)[..., 3].any()))
    res['newTrailingBlank'] = bool(not ns[(n // 16) * 16:].any()) if ns.shape[0] > (n // 16) * 16 else True
    # 카탈로그
    ok = {}
    onames = {k: v for k, v in oc['names'].items() if not k.startswith('prop.person.')}
    ok['names'] = (onames == nc['names']); res['namesCount'] = [len(onames), len(nc['names'])]
    for key in ('bands', 'decos', 'street', 'recipes', 'lRecipes', 'doorDefault'):
        ok[key] = (oc[key] == nc[key]); res[key + 'Count'] = [len(oc[key]), len(nc[key])]
    op = {k: v for k, v in oc['props'].items() if not k.startswith('person.')}
    ok['props(no person)'] = (op == nc['props']); res['propsCount'] = [len(op), len(nc['props']), len(oc['props']) - len(op)]
    meta = [k for k in oc if k not in ('names', 'bands', 'decos', 'street', 'props', 'recipes', 'lRecipes', 'doorDefault', 'sheet', 'origin')]
    ok['meta'] = all(oc[k] == nc[k] for k in meta)
    ok['sheet.file/cols/count'] = (oc['sheet'] == nc['sheet'])
    res['catalogKeysEqual'] = ok
    res['pass'] = bool(not diff and res['newPersonCellsBlank'] and all(ok.values()) and res['count'][0] == res['count'][1] and os_.shape == ns.shape)
    print(json.dumps(res, ensure_ascii=False, indent=1))
    if a.json: json.dump(res, open(a.json, 'w'), ensure_ascii=False, indent=1)
    return 0 if res['pass'] else 1
if __name__ == '__main__': sys.exit(main())
