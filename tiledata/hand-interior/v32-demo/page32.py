# 결과 페이지: 저장소 루트에서 python3 tiledata/hand-interior/v32-demo/page32.py
#   → ~/claude-viz/interior-32.html + ~/claude-viz/interior-32/*.png, tiledata/hand-interior/v32-demo/out/, results.json
import sys, os, json, html
for p in ('tiledata/hand-interior/v5', 'tiledata/hand-interior/v6-objects', 'tiledata/hand-interior/v32-demo'):
    sys.path.insert(0, p)
from PIL import Image
import room16, room32, compare
from layout import OBJECTS, KO, ITEMS
from draw32 import RAMP
D = 'tiledata/hand-interior/v32-demo'; OUT = f'{D}/out'
VIZ = os.path.expanduser('~/claude-viz/interior-32'); os.makedirs(VIZ, exist_ok=True); os.makedirs(OUT, exist_ok=True)

def colors(ims):
    s = set()
    for im in ims:
        for c in im.convert('RGBA').get_flattened_data():
            if c[3] == 255: s.add(c[:3])
    return s

# ---- 캐릭터 (24×32, 크기 비교용: 32px 프로젝트는 캐릭터 1배가 사용자 결정) ----
HERO = Image.open('public/assets/generated/starter/hero-01-charset.png').convert('RGBA').crop((24, 64, 48, 96))
def with_hero(im, S):
    im = im.copy(); cx, cy = 6, 7
    im.alpha_composite(HERO, (cx * S + S // 2 - 12, (cy + 1) * S - 32)); return im
def with_hero2(im, S):
    im = im.copy(); cx, cy = 6, 7; h = HERO.resize((48, 64), Image.NEAREST)
    im.alpha_composite(h, (cx * S + S // 2 - 24, (cy + 1) * S - 64)); return im

# ---- 방 세 판 ----
r5 = room16.room(False); r6 = room16.room(True); r32 = room32.room()
r5.save(f'{OUT}/room16-v5.png'); r6.save(f'{OUT}/room16-v6.png'); r32.save(f'{OUT}/room32.png')
def up(im, k): return im.resize((im.width * k, im.height * k), Image.NEAREST)
up(r5, 2).save(f'{VIZ}/room-v5.png'); up(r6, 2).save(f'{VIZ}/room-v6.png'); r32.save(f'{VIZ}/room-32.png')
up(with_hero(r5, 16), 2).save(f'{VIZ}/hero-v5.png'); with_hero(r32, 32).save(f'{VIZ}/hero-32.png'); with_hero2(r32, 32).save(f'{VIZ}/hero-32x2.png')
fr = [room32.room(t).convert('RGB') for t in range(4)]
fr[0].save(f'{VIZ}/room-32-anim.webp', save_all=True, append_images=fr[1:], duration=180, loop=0, lossless=True)

# ---- 소품별 ----
rows = []; I5 = []; I6 = []; I32 = []
for n in OBJECTS:
    a, b, z = compare.ims(n)
    I5.append(a); I6.append(b); I32.append(z)
    fn = f'obj-{n.replace(" ", "-")}.png'
    compare.card(n, 4).save(f'{VIZ}/{fn}')
    z.save(f'{OUT}/obj32-{n.replace(" ", "-")}.png')
    rows.append(dict(id=n, ko=KO[n], file=fn, size16=list(a.size), size32=list(z.size),
                     colors=dict(v5=len(colors([a])), v6=len(colors([b])), v32=len(colors([z])))))
c5 = colors(I5); c6 = colors(I6); c32 = colors(I32)
ramp = {tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) for r in RAMP.values() for h in r}
base = room32.render(room32.PLAN)
cwall = colors([base])
res = dict(objects=rows, total=dict(v5=len(c5), v6=len(c6), v32=len(c32), v32InRamp=len(c32 & ramp), v32OffRamp=len(c32 - ramp)),
           rampSize={m: len(r) for m, r in RAMP.items()}, rampTotal=len(ramp), wallFloor32=len(cwall),
           room=dict(v5=len(colors([r5])), v6=len(colors([r6])), v32=len(colors([r32]))),
           pixels=dict(v16=sum(a.width * a.height for a in I5), v32=sum(z.width * z.height for z in I32)))
json.dump(res, open(f'{D}/results.json', 'w'), ensure_ascii=False, indent=1)
print(json.dumps(res['total']), res['wallFloor32'], res['room'], res['rampTotal'])

# ---- 색 줄 그림 ----
sw = Image.new('RGBA', (7 * 20, len(RAMP) * 20), (30, 28, 34, 255))
for j, (m, r) in enumerate(RAMP.items()):
    for i, h in enumerate(r):
        sw.paste(tuple(int(h[k:k + 2], 16) for k in (1, 3, 5)) + (255,), (i * 20, j * 20, i * 20 + 19, j * 20 + 19))
sw.save(f'{VIZ}/ramps.png')

E = html.escape
cards = ''.join(f'<figure><figcaption>{E(r["ko"])} <small>{E(r["id"])} · 색 v5 {r["colors"]["v5"]} / v6 {r["colors"]["v6"]} / 32px {r["colors"]["v32"]}</small></figcaption>'
                f'<img src="interior-32/{r["file"]}"></figure>' for r in rows)
names = ' · '.join(f'{m} {len(r)}' for m, r in RAMP.items())
T = res['total']
doc = f'''<!doctype html><html lang="ko"><meta charset="utf-8"><title>실내 소품 32px 시험</title>
<style>
body{{background:#1b1a20;color:#e8e4dc;font:15px/1.6 system-ui,sans-serif;margin:24px}}
h1{{font-size:22px}} h2{{font-size:18px;margin-top:36px;border-bottom:1px solid #444;padding-bottom:4px}}
img{{image-rendering:pixelated;display:block}} .row{{display:flex;gap:18px;flex-wrap:wrap;align-items:flex-start}}
.row figure{{margin:0}} figcaption{{font-size:13px;color:#cfc8bb;margin-bottom:4px}} small{{color:#9a948a}}
.big{{flex-wrap:nowrap;overflow-x:auto;padding-bottom:8px}} .big img{{width:768px;max-width:none}} .grid{{display:flex;flex-wrap:wrap;gap:22px}} .grid figure{{margin:0}}
table{{border-collapse:collapse}} td,th{{border:1px solid #444;padding:4px 10px;text-align:left}}
.v{{background:#26242c;padding:12px 18px;border-left:4px solid #c8844c}} .note{{color:#b8b2a6;font-size:13px}}
</style>
<h1>실내 소품: 16px 에서 32px 로 바꾸면 나아지나</h1>
<p class="note">같은 방, 같은 배치. 16px 판은 2배, 32px 판은 1배로 놓아 화면 크기를 맞췄다(아래는 다시 2배 표시). 방: 안쪽 10×8칸(벽 2줄 + 바닥 6줄).
32px 소품 12종과 벽·바닥은 처음부터 32px 로 그렸다(16px 확대 아님). 기존 칩셋은 바꾸지 않았다.</p>

<h2>1. 같은 방 세 판</h2>
<div class="row big">
<figure><figcaption>16px v5 (2배)</figcaption><img src="interior-32/room-v5.png"></figure>
<figure><figcaption>16px v6 소품 (2배) — 벽·바닥은 v5</figcaption><img src="interior-32/room-v6.png"></figure>
<figure><figcaption>32px (1배) — 벽·바닥·소품 모두 새로 그림</figcaption><img src="interior-32/room-32.png"></figure>
</div>
<p class="note">가로로 밀어 세 판을 보거나, 창을 넓히면 나란히 보인다. 32px 벽난로는 4장 애니메이션도 있다: <a href="interior-32/room-32-anim.webp" style="color:#e4b47c">room-32-anim.webp</a></p>

<h2>2. 소품마다 v5 · v6 · 32px (같은 화면 크기)</h2>
<div class="grid">{cards}</div>

<h2>3. 색 수</h2>
<table>
<tr><th></th><th>16px v5</th><th>16px v6</th><th>32px</th></tr>
<tr><td>소품 12종 전체 (불투명 색)</td><td>{T["v5"]}</td><td>{T["v6"]}</td><td>{T["v32"]}</td></tr>
<tr><td>방 한 장 전체</td><td>{res["room"]["v5"]}</td><td>{res["room"]["v6"]}</td><td>{res["room"]["v32"]}</td></tr>
<tr><td>소품 화소 수 (12종 합)</td><td colspan="2">{res["pixels"]["v16"]:,}</td><td>{res["pixels"]["v32"]:,} (4배)</td></tr>
</table>
<p>32px 색 줄: 재질 {len(RAMP)}개 · 단 수 {names} → 합 {res["rampTotal"]}색. 소품 12종 {T["v32"]}색은 전부 이 표 안({T["v32InRamp"]}색, 표 밖 {T["v32OffRamp"]}).
32px 벽·바닥은 v5 색 줄 그대로 {res["wallFloor32"]}색. (방 한 장 색 수에는 반투명 접지 그림자·벽 발치 그늘이 섞인 색이 들어 있다. 32px 판은 화소가 4배인데도 색은 v5 보다 적다.)</p>
<img src="interior-32/ramps.png" style="width:280px">

<h2>4. 판정</h2>
<div class="v">
<p><b>해상도가 원인의 일부이긴 하지만 전부는 아니다. 32px 가 "확실히" 낫다고 하기는 어렵다.</b></p>
<p><b>32px 에서 좋아진 것</b>
<br>· 책장: 책마다 등 띠·금박·눕힌 책·기울어진 책이 들어가 "책"으로 읽힌다. 16px 는 색 막대였다.
<br>· 옷장 문판·괘종시계(눈금·바늘·유리 속 진자)·벽난로 돌 한 장씩·아치: 16px 에 들어갈 자리가 없던 부분이다.
<br>· 침대 이불: 몸 자리 둔덕과 흘러내리는 주름을 넣을 수 있었다. v6 침대가 밋밋했던 것은 16px 이불 한 칸에 둘 곳이 없어서다.
<br>· 통의 쇠테 반사광, 항아리의 세로 띠 명암, 식탁 모서리 둥글림, 발치 접지 그림자.</p>
<p><b>해상도와 무관한 것</b>
<br>· 북향 의자가 사다리처럼 읽힌 것은 구도 문제다. 32px 에서도 가로살을 두면 똑같이 사다리가 된다. 등받이 뒷면을 통판으로 바꿔서 풀었다. 16px 에서도 같은 방법이 통한다.
<br>· 식탁은 32px 에서도 v5 구도(윗면 위주, 밝은 테)를 따랐을 때만 괜찮았다. 첫 판에 판자 이음새를 밝게 넣었더니 서랍장처럼 보였다. 해상도가 올라가면 오히려 "넣을 수 있는 것"이 늘어 과해지기 쉽다.
<br>· 소파·안락의자: 첫 판에 단추 누빔을 넣었더니 얼굴처럼 보여서 뺐다. 천 가구가 뭉툭하게 보이는 것은 부위를 나누는 문제다.
<br>· 방 전체 인상(벽·바닥의 조용함, 가구와 바닥의 명도 차, 천장 띠)은 세 판이 거의 같다. 그림이 좋아지는 폭은 가까이 볼 때 크고, 방 전체로 보면 작다.</p>
<p><b>정리</b>: 16px 에서 약했던 것 가운데 <i>작은 부품이 많은 가구</i>(책장·시계·옷장·벽난로·이불)는 해상도가 원인이다. <i>읽히는 모양</i>(의자·식탁·소파)은 구도가 원인이라 16px 에서 고칠 수 있다.
32px 로 전체를 바꾸기 전에, 16px 에서 구도 문제부터 고치는 편이 비용 대비 효과가 크다.</p>
</div>

<h2>5. 32px 로 바꾸면 드는 비용</h2>
<div class="row big">
<figure><figcaption>16px 방 + 캐릭터 24×32 (2배 표시)</figcaption><img src="interior-32/hero-v5.png" style="width:768px"></figure>
<figure><figcaption>32px 방 + 캐릭터 1배 (32px 프로젝트 규칙)</figcaption><img src="interior-32/hero-32.png" style="width:768px"></figure>
<figure><figcaption>32px 방 + 캐릭터 2배 (캐릭터 도트가 뭉툭해진다)</figcaption><img src="interior-32/hero-32x2.png" style="width:768px"></figure>
</div>
<table>
<tr><th>항목</th><th>내용</th></tr>
<tr><td>캐릭터 크기</td><td>이 엔진의 걷는 캐릭터는 모두 24×32(RM2000 틀)이다. 16px 방에서는 1.5칸×2칸이지만, 32px 방에서는 0.75칸×1칸이라 가구보다 작다(위 가운데 그림).
2배로 키우면 크기는 맞지만 캐릭터 도트가 2배로 뭉툭해져 32px 가구와 화풍이 어긋난다. 크기를 맞추려면 캐릭터도 48×64 로 새로 그려야 한다.</td></tr>
<tr><td>16px 맵과 섞을 때</td><td><code>src/project/mapViewScale.ts</code>: 가장 많은 맵의 칸 크기가 기준이다. 16px 마을이 기준이면 32px 실내는 카메라가 0.5배로 줄어 같은 화면 크기로 보인다.
이때 캔버스 밀도를 정수배(2)로 올려 32px 도트가 뭉개지지 않게 한다. 캐릭터는 세계에서 2배로 그려져 화면 크기가 같게 남는다(그래서 캐릭터는 2배 뭉툭).
즉 섞어 쓰면 <b>실내만 도트가 촘촘하고 캐릭터·마을은 성긴</b> 화면이 된다.</td></tr>
<tr><td>화면에 보이는 칸 수</td><td>논리 화면 320×240 기준: 16px = 20×15칸, 32px 단독 프로젝트(배율 1) = 10×7.5칸. 32px 로 같은 시야를 보려면 해상도를 640×480 으로 올려야 한다.
섞은 프로젝트에서는 기준 칸으로 맞춰 주므로 시야는 20×15칸 그대로다.</td></tr>
<tr><td>다른 칩셋과 섞기</td><td>마을·필드·던전 생성 칩셋(atlas-biomes 등)과 EasyRPG 계열은 16px 이다. 한 맵 안에서는 칸 크기를 섞을 수 없으므로, 32px 실내 맵에는 16px 소품을 쓸 수 없다(반대도 같다).</td></tr>
<tr><td>그려야 할 양</td><td>v5 실내 시트: 소품 381종 · 상품 119종 · 바닥 27 · 벽 19 · 천장 7 · 자동 타일 20벌 · 예제 방 26장(640×1760 시트).
32px 는 화소가 4배이고, 이번 12종도 부품이 늘어 한 종당 코드가 16px 판의 2~3배였다. 전부 옮기면 v5 를 만든 분량의 몇 배가 든다.
예제 방 26장과 AI 참고문서(칸 좌표·통행·위에 얹기)도 전부 다시 만들어야 한다.</td></tr>
</table>
<p class="note">소스: tiledata/hand-interior/v32-demo/ (draw32.py 색 줄·캔버스, objs32.py 소품, room32.py 벽·바닥·방, room16.py 16px 판, page32.py 이 페이지). 수치: results.json.</p>
</html>'''
open(os.path.expanduser('~/claude-viz/interior-32.html'), 'w').write(doc)
print('ok')
