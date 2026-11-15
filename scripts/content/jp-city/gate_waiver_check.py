#!/usr/bin/env python3
"""jp_city 굽기 진입 관문이 오너 면제 기록을 받는 규칙의 양쪽 확인(모델 호출 없음, 파일을 쓰지 않는다).
  python3 scripts/content/jp-city/gate_waiver_check.py

오너(2026-11-15): 「서명을 ? 오너 면제로 해 그냥 ....」 — 옛 거리 계단 킷 넷(jp-stage-assembled 와 부품 셋)의 통과는 서명된 사람 허용에 기대는데,
서명을 확인하는 열쇠 파일이 굽는 박스에 없다. `object-gate owner-waive` 가 적은 면제 묶음(owner-jpstreetstairs-2026-11-15)이 그 화소 해시에 닿으면 관문이 받는다.
  ① 면제된 해시: state == 'waived'(통과가 아니다) · 부품 셋은 그 조립 그림으로 덮인다(면제 표시)
  ② 면제 기록이 없으면: 전과 똑같이 거절(영수증 사유 그대로)
  ③ 화소가 하나라도 바뀌면: 거절
  ④ 부품 면제는 종류 'part' 로 물을 때만 닿는다 · 조립 그림만 면제되고 부품이 묶음에 없으면 부품은 덮이지 않는다
  ⑤ 스토어 출구에는 닿지 않는다"""
import os, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(REPO, 'src', 'harnesses', '_core'))
import numpy as np                      # noqa: E402
from PIL import Image                   # noqa: E402
import object_gate as OG               # noqa: E402
import gate_kinds as GK                # noqa: E402
import gate_rooms as GR                # noqa: E402

G = os.path.join(REPO, 'tiledata', 'jp-city', 'blocks', 'street_stairs', '_gate')
ASM = os.path.join(G, 'jp-stage-assembled.png')
PARTS = ['jp-stage-platform', 'jp-side-stair-l', 'jp-side-stair-r']
bad = []
def check(name, cond):
    print(('ok   ' if cond else 'FAIL ') + name)
    if not cond: bad.append(name)

sha = OG.pixel_sha256(ASM)
check('① 조립 그림: 면제 기록이 닿는다 → waived', GK.state(ASM, 'structure') == ('waived', None))
for p in PARTS:
    name, st = GR.covering(p, os.path.join(G, p + '.png'))
    check('① 부품 %s: 조립 그림으로 덮임(면제)' % p, name is not None and st == 'waived')
res = GK.check_all()
check('① 관문 전체: 막힌 킷 없음, 면제 넷이 따로 세어진다', not res['bad'] and sorted(res['waived']) == sorted(['jp-stage-assembled'] + PARTS))
check('① 면제는 통과로 세지 않는다', 'jp-stage-assembled' not in res['ok'])

real = OG.read_owner_waiver
OG.read_owner_waiver = lambda s: None                                       # ② 면제 기록이 없을 때
st, why = GK.state(ASM, 'structure')
check('② 면제 없음: 전과 같이 거절(영수증 사유)', st is None and '불합격' in (why or ''))
check('② 면제 없음: 부품도 덮이지 않는다', GR.covering(PARTS[0], os.path.join(G, PARTS[0] + '.png'))[0] is None)
OG.read_owner_waiver = lambda s: real(s) if s == sha else None              # ④ 조립 그림만 면제, 부품은 묶음에 없음
name, why = GR.covering(PARTS[0], os.path.join(G, PARTS[0] + '.png'))
check('④ 조립 그림만 면제: 부품은 덮이지 않는다', name is None and '면제 묶음에 없다' in why)
OG.read_owner_waiver = real

with tempfile.TemporaryDirectory() as tmp:                                  # ③ 한 화소 바뀐 그림
    a = np.array(Image.open(ASM).convert('RGBA')); y, x = [int(v[0]) for v in np.nonzero(a[..., 3])]
    a[y, x, 0] ^= 1; p = os.path.join(tmp, 'changed.png'); Image.fromarray(a, 'RGBA').save(p)
    st, why = GK.state(p, 'structure')
    check('③ 화소가 바뀐 그림: 거절', st is None and bool(why))

psha = OG.pixel_sha256(os.path.join(G, PARTS[0] + '.png'))
check('④ 부품 면제는 종류 part 로만', GK.owner_waived(psha, 'part') and not GK.owner_waived(psha, 'structure') and not OG.owner_waiver_applies(OG.read_owner_waiver(psha), psha, None, 'bundle'))
check('④ 조립 그림 면제는 다른 종류로 물으면 닿지 않는다', not GK.owner_waived(sha, 'box'))
check('⑤ 스토어 출구에는 닿지 않는다', not GK.owner_waived(sha, 'structure', 'store') and not GK.owner_waived(psha, 'part', 'store'))
print('gate_waiver_check: 실패 %d' % len(bad))
sys.exit(1 if bad else 0)
