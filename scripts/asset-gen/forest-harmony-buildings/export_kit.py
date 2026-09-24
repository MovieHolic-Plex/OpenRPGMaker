"""앱(TS) 설계도 검사기가 쓰는 화풍 묶음을 한 파일로.  python3 export_kit.py → tiledata/forest-harmony-buildings/style-kit.json
bp_fit.py 가 칩셋에서 매번 뽑던 값을 미리 굳힌다: 집 27색 팔레트·지붕 전용색·화풍 기준 집 지붕 명암 비중·문 아래 칸(359)·화풍 기준 집 그림.
그림은 RGBA 원시 바이트 base64(PNG 해독 없이 TS 에서 바로 쓴다)."""
import base64, json
import numpy as np
import bp_fit as F
from fhlib import *
st = F.BP['style']; form_id = st['form']
roofc = F.roof_colors()
ref = np.array(house_render(form_id)); px = ref[ref[..., 3] > 200][:, :3]
share = np.array([(px == c).all(-1).sum() for c in roofc], float); share /= share.sum()
raw = lambda a: base64.b64encode(np.ascontiguousarray(a, np.uint8).tobytes()).decode()
kit = dict(
    note='bp_fit.py 와 같은 값. export_kit.py 로 다시 만든다(손으로 고치지 말 것).',
    tileset='forest_harmony', tile=F.T, scale=F.BP['scale'], canvas=1254, styleForm=form_id,
    palette=F.PAL.tolist(), roofColors=roofc.tolist(), roofShare=[round(float(s), 6) for s in share],
    timber=sorted(list(t) for t in F.TIM),
    doorTile=raw(np.array(tile(359).convert('RGBA'))),
    style=dict(w=ref.shape[1], h=ref.shape[0], rgba=raw(ref)),
)
json.dump(kit, open(os.path.join(ROOT, 'tiledata/forest-harmony-buildings/style-kit.json'), 'w'), ensure_ascii=False)
print('palette', len(kit['palette']), 'roof', len(kit['roofColors']), 'style', ref.shape)
