"""제작 틀 → 생성 기준 이미지.  python3 scripts/asset-gen/forest-harmony-buildings/frame.py [id ...]
<OUT>/<id>-ref.png   1254² 마젠타: 왼쪽 회색 틀(정확히 scale 배), 오른쪽 원본 집(같은 배율, 화풍 기준)
<OUT>/<id>-frame.png 원 해상도 틀 미리보기, <OUT>/<id>-frame.json 구역·통행·배치 정보"""
import json, sys
import numpy as np
from PIL import Image
from fhlib import *

s = spec()
ids = sys.argv[1:] or [b['id'] for b in s['buildings']]
for bid in ids:
    s, b = building(bid)
    z, fixed, pm = zone_map(s, b)
    H, W = z.shape
    art = np.zeros((H, W, 4), np.uint8)
    for k, c in GRAY.items(): art[z == k] = (*c, 255)
    art[(z == 0)] = 0
    m = fixed[..., 3] > 0; art[m] = fixed[m]
    im = Image.fromarray(art, 'RGBA'); im.save(f'{OUT}/{bid}-frame.png')
    L = layout(s, b); k = L['scale']
    ref = Image.new('RGB', (s['canvas'], s['canvas']), MAGENTA)
    ref.paste(im.resize((W * k, H * k), Image.NEAREST), tuple(L['frame'][:2]), im.resize((W * k, H * k), Image.NEAREST))
    st = house_render(s['styleGuides'][b['roof']]); st = st.resize((st.width * k, st.height * k), Image.NEAREST)
    ref.paste(st, tuple(L['style'][:2]), st)
    ref.save(f'{OUT}/{bid}-ref.png')
    np.save(f'{OUT}/{bid}-zones.npy', z)
    json.dump(dict(id=bid, width=W, height=H, layout=L, **pm), open(f'{OUT}/{bid}-frame.json', 'w'), ensure_ascii=False)
    print(bid, W, H, L)
