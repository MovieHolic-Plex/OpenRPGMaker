# 결과 페이지 + 수치: python3 tiledata/hand-interior/v6-objects/page6.py  → ~/claude-viz/v6-objects.html, results.json, out/
import sys, os, json, base64, io, html
sys.path.insert(0, 'tiledata/hand-interior/v6-objects'); sys.path.insert(0, 'tiledata/hand-interior/v5')
import apply6, rooms4, room4, rooms6, sheet6, metrics6 as M
from draw6 import PAL, RAMP
from kit4 import OBJ
from PIL import Image, ImageDraw
VIZ = os.path.expanduser('~/claude-viz/v6-objects'); OUT = 'tiledata/hand-interior/v6-objects/out'
os.makedirs(VIZ, exist_ok=True); os.makedirs(OUT, exist_ok=True)
BG = (120, 96, 76, 255)
def on_bg(im, s):
    b = Image.new('RGBA', im.size, BG); b.alpha_composite(im); return b.resize((im.width * s, im.height * s), Image.NEAREST)
def slug(n): return ''.join(ch if ch.isalnum() else '-' for ch in n)
# ---- 전체 대상 (112 id) ----
ALL = []
for i in list(OBJ):
    if apply6.builder(i) is None: continue
    f = OBJ[i][1](); f.id = i; ALL.append((i, f, apply6.patch_item(f)))
v5ims = [f.im for _, f, _ in ALL]; v6ims = [g.im for _, _, g in ALL]
cp = apply6.assemble_counter(3); from kit4 import assemble; c5 = assemble('counter', 3, 1).im
v5ims.append(c5); v6ims.append(cp)
st5 = M.stats(v5ims); st6 = M.stats(v6ims)
pal = {c[:3] for r in PAL.values() for c in r}
cols6 = set()
for im in v6ims:
    for c in im.get_flattened_data():
        if c[3] > 128: cols6.add(c[:3])
shared = len(cols6 & pal); other = len(cols6 - pal)
# 상품·불꽃 없는 몸통만: 상품을 얹지 않는 대상
bodies = [g.im for i, _, g in ALL if ':' not in i and not getattr(g, 'frames', None) and i != 'cake display case'] + [cp]
bodies5 = [f.im for i, f, g in ALL if ':' not in i and not getattr(g, 'frames', None) and i != 'cake display case'] + [c5]
sb5 = M.stats(bodies5); sb6 = M.stats(bodies)
colsb = set(c[:3] for im in bodies for c in im.get_flattened_data() if c[3] > 128)
# ---- EasyRPG/Tibo 대조 ----
R, srcs = M.ref_cells()
def worst(ims):
    mx = 0; n95 = 0; cells = 0
    for im in ims:
        for c in M.cells_of(im):
            s = M.similarity(c, R); cells += 1; mx = max(mx, s); n95 += s >= 0.95
    return {'cells': cells, 'maxSimilarity': round(mx, 3), 'cells95': int(n95)}
cmp6 = worst(v6ims); cmp5 = worst(v5ims)
# ---- 소품별 8배 전후 (대표 44종) ----
rows = []
for n in sheet6.DEF:
    a, b = sheet6.pair(n); s = 8 if a.width <= 32 else 6
    fn = f'o-{slug(n)}.png'
    o = Image.new('RGBA', (a.width * s * 2 + 24, a.height * s), (40, 36, 44, 255))
    o.paste(on_bg(a, s), (0, 0)); o.paste(on_bg(b, s), (a.width * s + 24, 0)); o.save(f'{VIZ}/{fn}')
    rows.append((n, fn, M.stats([a]), M.stats([b])))
# ---- 방 3장 ----
rooms = []
for b, key in rooms6.ROOMS:
    m = rooms6.get(b, key); A = room4.compose(m); Z = room4.compose(rooms6.after(m))
    A.save(f'{OUT}/room-{key}-v5.png'); Z.save(f'{OUT}/room-{key}-v6.png')
    for tag, im in (('v5', A), ('v6', Z)):
        im.resize((im.width * 2, im.height * 2), Image.NEAREST).save(f'{VIZ}/room-{key}-{tag}.png')
        im.save(f'{VIZ}/room-{key}-{tag}-1x.png')
    rooms.append((key, m['name'], rooms6.usage(m)))
# ---- 색 줄 ----
sw = 22; rp = Image.new('RGBA', (sw * 6 + 90, sw * len(RAMP)), (40, 36, 44, 255)); d = ImageDraw.Draw(rp)
for j, (m, r) in enumerate(RAMP.items()):
    d.text((2, j * sw + 6), m, fill=(230, 230, 230))
    for k, c in enumerate(PAL[m]): d.rectangle((90 + k * sw, j * sw, 90 + k * sw + sw - 2, j * sw + sw - 2), fill=c)
rp.save(f'{VIZ}/ramps.png')
res = {'targets': len(ALL) + 1, 'drawings': len(sheet6.DEF), 'v5': st5, 'v6': st6, 'bodyOnlyV5': sb5, 'bodyOnlyV6': sb6,
       'v6Colors': {'all': len(cols6), 'sharedRamp': shared, 'goodsAndFire': other, 'bodyOnly': len(colsb), 'rampSize': len(pal)},
       'refCompare': {'v6': cmp6, 'v5': cmp5, 'refCells': int(len(R)), 'refSources': len(srcs)},
       'rooms': [{'key': k, 'name': nm, 'v6Items': u[0], 'items': u[1]} for k, nm, u in rooms],
       'perObject': {n: {'v5': a, 'v6': b} for n, _, a, b in rows}}
json.dump(res, open('tiledata/hand-interior/v6-objects/results.json', 'w'), ensure_ascii=False, indent=1)
print(json.dumps({k: v for k, v in res.items() if k != 'perObject'}, ensure_ascii=False))
# ---- 페이지 ----
E = html.escape
def img(src, w=None, cls=''): return f'<img src="v6-objects/{src}" class="{cls}"' + (f' style="width:{w}px"' if w else '') + '>'
H = [f'''<!doctype html><meta charset=utf-8><title>v6 소품 다시 그리기</title>
<style>body{{background:#1e1b22;color:#e8e2da;font:14px/1.5 system-ui,sans-serif;margin:24px;max-width:1500px}}
img{{image-rendering:pixelated}} h2{{margin-top:36px;border-bottom:1px solid #444}} table{{border-collapse:collapse}}
td,th{{border:1px solid #3a3440;padding:4px 8px;text-align:right}} th{{background:#2a2630}} td.l{{text-align:left}}
.grid{{display:flex;flex-wrap:wrap;gap:14px}} .card{{background:#28242e;padding:8px;border-radius:6px}} .card b{{display:block;margin-bottom:4px}}
.pair{{display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap}} .note{{color:#b8b0a6}} .bad{{color:#f0a080}}</style>
<h1>손 도트 실내 v6 소품 — EasyRPG 규칙으로 다시 그리기 (사본, 아직 교체 안 함)</h1>
<p class=note>벽·바닥·식탁(dining)은 v5 그대로. 크기·칸 점유·윗면 자리·애니메이션 주기도 v5 그대로이고 그림만 바꿨다. 각 칸 왼쪽 = v5, 오른쪽 = v6.
대상 {res["drawings"]}종 그림 → 가구 id {res["targets"]}개(과일·생선 통, 상품 궤짝·바구니·진열장은 몸통 공유).</p>
<h2>1. 방 3장 (원본 크기의 2배, 벽·바닥 그대로)</h2>''']
for k, nm, u in rooms:
    H.append(f'<h3>{E(nm)} — 가구 {u[1]}개 중 {u[0]}개가 v6</h3><div class=pair><div>v5<br>{img(f"room-{k}-v5.png")}</div><div>v6<br>{img(f"room-{k}-v6.png")}</div></div>'
             f'<p class=note>원본 크기: {img(f"room-{k}-v5-1x.png")} {img(f"room-{k}-v6-1x.png")}</p>')
H.append('<h2>2. 수치 (전후, 대상 전체)</h2><table><tr><th></th><th>안쪽 명도차 평균</th><th>큰 차(&gt;40) %</th><th>체크 디더 %</th><th>색 수</th></tr>')
for tag, s in (('v5 전체(상품 얹은 것 포함)', st5), ('v6 전체', st6), ('v5 몸통만(상품·불 없음)', sb5), ('v6 몸통만', sb6)):
    H.append(f'<tr><td class=l>{tag}</td><td>{s["meanDiff"]}</td><td>{s["bigDiffPct"]}</td><td>{s["ditherPct"]}</td><td>{s["colors"]}</td></tr>')
H.append(f'''<tr><td class=l>참고: EasyRPG 소품 영역(같은 계산)</td><td>28.7</td><td>25.6</td><td>1.5</td><td>93</td></tr></table>
<p class=note>안쪽 = 불투명하고 네 이웃도 불투명한 화소(윤곽 한 줄 제외). 명도차 = 이웃 화소 명도(0.299R+0.587G+0.114B) 차의 평균. 체크 디더 = 네 이웃이 모두 같은 색인데 자기만 다른 화소.
연구 페이지 수치(EasyRPG 22.3 / v5 29.4)는 계산 범위가 달라 이 표와 절대값이 다르다 — 이 표 안의 전후만 비교한다.</p>
<p>v6 색 수 {len(cols6)} = 공유 색 줄 {shared}색 + 상품·불꽃 {other}색(v5 상품 그림과 불꽃 공식을 그대로 얹음). 상품·불이 없는 몸통만 보면 <b>{len(colsb)}색</b>, 모두 공유 색 줄 안.</p>
<h3>EasyRPG·Tibo 칸 대조</h3>
<p>대조 칸 {len(R)}개(EasyRPG 실내 2장 + Tibo 실내 {len(srcs)-2}장을 16px 칸으로). 칸마다 (어느 한쪽이라도 불투명한 화소) 중 둘 다 불투명하고 채널 차 ≤12 인 비율의 최댓값.</p>
<table><tr><th></th><th>칸</th><th>최대 닮음</th><th>95% 이상 칸</th></tr>
<tr><td class=l>v6</td><td>{cmp6["cells"]}</td><td>{cmp6["maxSimilarity"]}</td><td><b>{cmp6["cells95"]}</b></td></tr>
<tr><td class=l>v5</td><td>{cmp5["cells"]}</td><td>{cmp5["maxSimilarity"]}</td><td>{cmp5["cells95"]}</td></tr></table>
<h2>3. 공유 색 줄 (재질마다 한 줄)</h2>{img("ramps.png")}
<p class=note>어두운 쪽은 채도를 올리고 붉은 쪽으로(나무 0단 #3d160a), 밝은 끝은 크림. 돌은 보라 기운. 검정에 가까운 색은 쇠 0단뿐(금속·구멍).</p>
<h2>4. 소품별 8배 전후</h2><div class=grid>''')
for n, fn, a, b in rows:
    H.append(f'<div class=card><b>{E(n)}</b>{img(fn)}<div class=note>명도차 {a["meanDiff"]}→{b["meanDiff"]} · 큰 차 {a["bigDiffPct"]}→{b["bigDiffPct"]}% · 디더 {a["ditherPct"]}→{b["ditherPct"]}% · 색 {a["colors"]}→{b["colors"]}</div></div>')
H.append('</div>')
H.append(open('tiledata/hand-interior/v6-objects/weak.html').read() if os.path.exists('tiledata/hand-interior/v6-objects/weak.html') else '')
open(os.path.expanduser('~/claude-viz/v6-objects.html'), 'w').write('\n'.join(H))
