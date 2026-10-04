"""ascii_pixelize.py 결과 → ~/claude-viz/ascii-pixelize.html (자체완결)."""
import base64, io, json, html
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
D = ROOT / 'tiledata/atlas-pick/ascii-pixelize'
OUT = Path.home() / 'claude-viz/ascii-pixelize.html'
TAGS = [('a-nearest', 'A. 그냥 최근접 축소'), ('b-box-quant', 'B. 평균 축소 → 팔레트'),
        ('c-ascii', 'C. 제안 경로 (글자 = 픽셀)'), ('d-glyph', 'D. 제안 경로 (글자 모양 = 밝기)'),
        ('post', 'E. C + Sonnet 5.5 medium 손질'), ('scratch', 'F. Sonnet 5.5 medium 처음부터'),
        ('view34', 'G. E + 3/4 시점 고쳐 찍기'), ('h34', 'H. 3/4로 생성 → C → E')]
V34 = {r['name']: r for r in json.loads((D / 'view34/view34-result.json').read_text(encoding='utf-8'))}
SCR = {r['name']: r for r in json.loads((D / 'fresh/scratch-result.json').read_text(encoding='utf-8'))}
H34 = {r['name']: r for r in json.loads((D / 'h34/result.json').read_text(encoding='utf-8'))}
EYE = {'tree_sakura': '눈 · 둥근 수관, 윗면 구분 약함', 'tree_green': '눈 · 둥근 수관, 윗면 구분 약함',
       'street_lamp': '눈 · 등갓 윗면 있음', 'traffic_light': '눈 · 상자 윗띠 있음', 'hero': '눈 · 정면 그대로'}
POST = {r['name']: r for r in json.loads((D / 'post/post-result.json').read_text(encoding='utf-8'))}


def img_of(n, t):
    if t == 'h34':
        f = D / 'h34' / f'{n}-post.png'
        return Image.open(f if f.exists() else D / 'h34' / f'{n}-c.png')
    if t == 'view34':
        f = D / 'view34' / f'{n}-view34.png'
        return Image.open(f) if f.exists() else Image.open(D / 'post' / f'{n}-post.png')
    if t == 'scratch':
        return Image.open(D / 'fresh' / f'{n}-scratch.png')
    return Image.open(D / 'post' / f'{n}-post.png') if t == 'post' else Image.open(D / f'{n}-{t}.png')


def uri(im, s=1):
    if s != 1:
        im = im.resize((im.width * s, im.height * s), Image.NEAREST)
    b = io.BytesIO(); im.save(b, 'PNG')
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()


def street(res, tag, s):
    """아스팔트·보도 위 1줄 — 게임 화면 배율로."""
    W = sum(r['target'][0] + 6 for r in res) + 6
    im = Image.new('RGBA', (W, 64), (0x46, 0x44, 0x52, 255))
    for y in range(40, 64):
        for x in range(W):
            im.putpixel((x, y), (0x7b, 0x7b, 0x8f, 255) if (x // 16 + y // 8) % 2 else (0x69, 0x68, 0x7a, 255))
    x = 6
    for r in res:
        tw, th = r['target']
        o = img_of(r['name'], tag)
        im.alpha_composite(o, (x, 52 - th)); x += tw + 6
    return uri(im, s)


res = json.loads((D / 'result.json').read_text(encoding='utf-8'))
rows = []
for r in res:
    n = r['name']
    src = Image.open(D / f'{n}-src.png'); src.thumbnail((140, 140))
    hsrc = Image.open(D / 'h34' / f'{n}-src.png').convert('RGB'); hsrc.thumbnail((140, 140))
    def meta(t):
        if t == 'post':
            q = POST[n]
            return f'{q["changed_pct"]}% 고침 · ${q["cost_usd"]:.2f}'
        if t == 'view34':
            q = V34.get(n)
            if not q:
                return '예외(E 그대로)'
            c = q.get('check')
            verdict = c[0].split()[-1] if c and c[0].split()[-1] in ('OK', 'FRONT', 'TOPDOWN') else ('NOTOP' if c else '눈 판정')
            if c and 'NOTOP' in c[0]:
                verdict = 'NOTOP'
            return f'검사 {verdict} · ${q["cost_usd"]:.2f}' + (' · 줄 보정' if q.get('padded_rows') else '')
        if t == 'h34':
            q = H34[n]
            if q.get('e_failed'):
                v = 'E 줄 길이 실패 → C 그대로'
            elif q['cls'] == 'exempt':
                v = EYE[n]
            else:
                ck = q['check']['post']
                v = '검사 ' + ('OK' if ck.rstrip().endswith('OK') else 'TOPDOWN' if 'TOPDOWN' in ck else ck.split()[-1])
            return f'{v} · ${q["cost_usd"]:.2f}' + (' · 줄 보정' if q.get('padded_rows') else '')
        if t == 'scratch':
            q = SCR[n]
            return f'${q["cost_usd"]:.2f}' + (' · 줄 보정' if q.get('padded_rows') else '')
        return f'{r["colors"][t[0]]}색'
    cells = ''.join(
        f'<td><img src="{uri(img_of(n, t), 4)}"><br><img class=x1 src="{uri(img_of(n, t))}"><div class=m>{meta(t)}</div></td>'
        for t, _ in TAGS)
    notes = (D / 'post' / f'{n}.notes.md').read_text(encoding='utf-8') if (D / 'post' / f'{n}.notes.md').exists() else ''
    fn = D / 'fresh' / f'{n}.notes.md'
    fnotes = fn.read_text(encoding='utf-8') if fn.exists() else ''
    hn = D / 'h34' / f'{n}-notes.md'
    hnote = html.escape(hn.read_text(encoding='utf-8')).replace(chr(10), '<br>') if hn.exists() and n not in ('taxi', 'traffic_light') else '(재실행 메모만 남아 생략)'
    rows.append(f'<tr><td colspan=10 class=note><b>E 손질 메모</b><br>{html.escape(notes).replace(chr(10), "<br>")}<br><b>F 작가 메모</b><br>{html.escape(fnotes).replace(chr(10), "<br>")}' + (f'<br><b>G 3/4 메모</b><br>{html.escape(gn.read_text(encoding="utf-8")).replace(chr(10), "<br>")}' if (gn := D / 'view34' / f'{n}.notes.md').exists() else '') + f'<br><b>H 3/4 메모</b><br>{hnote}</td></tr>')
    rows.insert(len(rows) - 1, f'<tr><th>{n}<br><small>{r["target"][0]}×{r["target"][1]}</small></th><td><img src="{uri(src)}"><br><small>H 원본(3/4 생성)</small><br><img src="{uri(hsrc)}"></td>{cells}</tr>')

ex = 'vending_red'
r0 = next(r for r in res if r['name'] == ex)
legend = ' '.join(f'<span class=sw style="background:{c}"></span><code>{html.escape(k)}</code>' for k, c in r0['legend'].items())
ctext = html.escape((D / f'{ex}.txt').read_text(encoding='utf-8'))
dtext = html.escape((D / f'{ex}-glyph.txt').read_text(encoding='utf-8'))
drender = uri(Image.open(D / f'{ex}-d-render.png'))

streets = ''.join(f'<h3>{label}</h3><img src="{street(res, t, 3)}">' for t, label in TAGS)

page = f'''<!doctype html><meta charset=utf-8><title>생성 이미지 → 팔레트 제한 → 아스키 → 다시 픽셀화</title>
<style>
body{{background:#1d1c22;color:#ddd;font:14px/1.55 system-ui,sans-serif;margin:24px;max-width:1500px}}
img{{image-rendering:pixelated;vertical-align:bottom}} img.x1{{margin-top:6px}}
table{{border-collapse:collapse}} td,th{{border:1px solid #333;padding:8px;text-align:center;background:#2a2932}}
th small{{color:#999}} .m{{color:#9ab;font-size:12px}} pre{{background:#111;color:#cfe;padding:10px;font:11px/1.05 'DejaVu Sans Mono',monospace;display:inline-block;vertical-align:top;margin-right:16px}}
.sw{{display:inline-block;width:14px;height:14px;border:1px solid #000;vertical-align:middle;margin:0 2px 0 10px}}
.note{{text-align:left;font-size:12px;color:#aab;background:#232229}} .box{{background:#2a2932;border-left:4px solid #e0a040;padding:10px 14px;margin:14px 0}} h2{{margin-top:34px}}
</style>
<h1>생성 이미지 → 팔레트 제한 → 모노스페이스 아스키 → 다시 픽셀화</h1>
<p>원본: 비교전 C조가 뽑았던 생성 그림 한 장(소품 9개, 1774×887). 목표 크기는 현대 공통 규격 축척표(자판기 16×26, 택시 56×24, 가로수 32×48, 주인공 16×24). 색은 modern3 팔레트에서 물건마다 최대 10색.</p>
<div class=box><b>무엇을 보면 되나</b> — 같은 원본을 네 가지로 줄였다. A·B 는 흔한 방법, C·D 는 제안 경로의 두 해석이다.<br>
C: 글자 하나가 픽셀 하나. 칸 안에서 <b>가장 많은 색</b>을 고르고(평균이 아니라서 섞인 흐린 중간색이 안 생긴다) 색마다 글자를 준다.<br>
D: 진짜 「아스키아트」 — 밝기를 글자 잉크 농도(<code> .:-=+*#%@</code>)로 적고, 고정폭 글꼴로 실제로 그린 뒤 잉크 농도를 재서 다시 밝기로 되돌린다.</div>

<h2>1. 물건별 비교 (4배 / 아래 1배)</h2>
<table><tr><th></th><th>원본(축소 미리보기)</th>{''.join(f'<th>{l}</th>' for _, l in TAGS)}</tr>{''.join(rows)}</table>

<h2>2. 거리 위 게임 배율(3배)</h2>{streets}

<h2>3. 중간 단계 — 빨간 자판기</h2>
<p>C 의 아스키(한 글자 = 한 픽셀, 16×26): {legend}</p>
<pre>{ctext}</pre><pre>{dtext}</pre>
<p>오른쪽이 D 의 글자 모양 아스키(가로 32글자 × 26줄, 고정폭 글자는 세로가 가로 2배라 한 픽셀 = 가로 2글자). 이것을 글꼴로 실제로 그린 그림:</p>
<img src="{drender}">

<h2>4. 판정</h2>
<div class=box><b>E (Sonnet 5.5 medium 손질)</b> — 물건마다 claude -p 한 번(글자 격자 + 12배 격자 그림 + 원본 생성 그림을 보고 격자를 다시 씀). 9개 합계 약 $8.5, 개당 3~4분. 신호등·가드레일은 첫 시도에 줄 길이가 어긋나 「쓴 뒤 다시 읽어 확인」을 붙여 한 번 더 돌렸다.<br>
고친 양은 4~42%: 가로등·벚나무는 거의 그대로, 자판기는 진열창·버튼을 다시 찍어 40% 넘게 바꿨다. 손질 메모는 표의 각 줄 아래.</div>
<div class=box><b>F (Sonnet 5.5 medium 처음부터)</b> — 생성 그림을 보여 주지 않고 물건 설명·캔버스 크기·C 와 같은 10색만 주고 글자 격자로 바로 찍게 했다. 9개 합계 약 $5, 개당 2~3분. 택시는 두 번 모두 한 줄이 1~2자 짧아서, 두 번째 결과의 그 한 줄만 양쪽에 투명 한 칸씩 채웠다(「줄 보정」 표시).<br>
생성 그림에서 출발하지 않으므로 에셋 규칙(생성 픽셀 금지)에 걸리지 않는 유일한 열이다.</div>
<div class=box><b>G (E + 3/4 시점)</b> — E 는 원본(정면·옆모습) 시점을 그대로 물려받는다. G 는 E 를 받아 Sonnet 5.5 medium 이 계약(§10) 수치대로 윗면을 새로 그려 넣었다. 6개 합계 약 $5.6. 나무·주인공은 계약상 예외라 E 그대로.<br>
결과: 자판기 둘·택시는 검사기 OK, 신호 상자·등갓은 윗면이 생겼다. 그러나 <b>택시는 윗면을 얹느라 상자형 승합차처럼 뭉툭해졌고</b>, 가드레일은 윗면이 앞면과 구분되지 않아 검사기 NOTOP. 정면 그림에 윗면을 덧대는 방식의 한계다.</div>
<div class=box><b>H (3/4 로 생성 → C → E)</b> — G 처럼 정면 그림에 윗면을 덧대는 대신, 「처음부터 3/4 로 뽑게」 했다. 9개 물건을 두 톤 틀(밝은 윗띠 + 중간 앞면)에 앉히고 Tibo(sunburst)에 「카메라는 높은 앞쪽, 45도 내려다봄, 윗면은 앞면의 1/3 이상」이라고 적어 3라운드 8장을 뽑아 최선 한 장(r3-1)을 골랐다. 그 그림을 C(modern3·10색·칸 최빈색)로 줄이고 E(Sonnet 5.5 medium)로 손질했다.<br>
<b>원본의 3/4 성공률은 낮다.</b> 8장 중 쓸 만한 것은 3~4장뿐이고 두 장은 틀만 되돌려 줬다. 「45도」를 못 박은 3라운드에야 자판기·가드레일에 뚜렷한 윗면이 나왔다. 나무·신호등·주인공·가로등은 여전히 정면에 가깝다(등갓·신호 상자에 윗띠만 있음).<br>
<b>검사기 대상 4개 중 OK 3</b>: 자판기 둘 OK(T4~5·F24), <b>택시 OK</b>(T8·F24, T/F 0.33). 가드레일은 TOPDOWN(T7·F6, T/F 1.17, 윗면이 앞면보다 두꺼움). 예외 조각(나무 둘·가로등·신호등·주인공)은 눈 판정.<br>
<b>택시는 차로 읽힌다</b> — G 처럼 상자가 되지 않았다. 다만 <b>측면 옆모습에 지붕·보닛·트렁크 윗띠가 얹힌 「가벼운 3/4」</b>이라 윗면이 지붕 위 표지등 주변 밖에서는 얇다. 자판기는 G 보다 자연스럽게 뚜껑이 나온다. E 는 신호등에서 줄 수가 틀려(49줄) 재실행해도 33자 줄이 나와 실패 → C 그대로(「E 줄 길이 실패」), 택시는 첫 결과의 한 줄을 채우고(「줄 보정」) 재실행 결과(57자 줄)는 버렸다.<br>
<b>비용</b> — 생성 8장(Tibo, 라운드당 약 2분, 병렬) + Sonnet E 11회 약 $7.7(재실행 포함, 신호등 $2.1·택시 $1.7). 가로등·주인공·나무의 E 는 색만 조금 다듬었고 녹색 나무는 잎 무늬가 지워져 밋밋해졌다.</div>
<div class=box>
<b>C 가 가장 깨끗하다.</b> A 는 생성 그림의 수백 색이 그대로 남고, B 는 평균 때문에 경계가 뭉개진 중간색(45~70색)이 생긴다. C 는 10색 이하·경계 또렷.<br>
<b>D 는 점묘처럼 거칠어진다.</b> 글자 농도 10단계가 밝기를 계단처럼 끊고, 글자 두 개를 한 픽셀로 합치며 얼룩이 생긴다. 아스키아트 「모양」은 16px 에서 이득이 없다.<br><br>
<b>솔직한 한계 세 가지</b><br>
① C 의 아스키 단계 자체는 정보를 바꾸지 않는다(글자 ↔ 색이 1:1). 품질을 올린 건 「칸 최빈 색 + 색 수 제한」이다. 아스키의 진짜 값은 <b>사람·에이전트가 글자로 손질할 수 있다</b>는 것 — 이 형식은 우리 pxgrid 격자와 같아서 그대로 pxlint 에 넣고 한 줄씩 고칠 수 있다.<br>
② 손질 없이 여기서 멈추면 결과는 여전히 <b>생성 그림을 변환한 픽셀</b>이다. 정한 규칙(생성 픽셀은 에셋에 쓰지 않는다)대로라면 이 상태로는 못 쓴다. 쓰려면 아스키를 밑그림 삼아 사람·에이전트가 다시 찍는 단계가 필요하다.<br>
③ 원본이 옆모습이다(택시 옆면, 자판기 정면). 변환은 시점을 못 고친다 — 방금 짚은 3/4 시점 문제가 그대로 따라온다.
</div>
'''
OUT.write_text(page, encoding='utf-8')
print(OUT, len(page))
