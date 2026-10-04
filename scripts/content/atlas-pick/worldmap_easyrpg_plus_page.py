#!/usr/bin/env python3
"""월드맵 EasyRPG 개선판 비교 페이지(자체완결 HTML) 생성. 이미지는 전부 data URI."""
import base64, io, json, os, sys
from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
D = os.path.join(ROOT, 'tiledata/atlas-pick/worldmap-easyrpg-plus')
V = os.path.join(ROOT, 'verify-shots/worldmap-easyrpg-plus')
ORIG = os.path.join(ROOT, 'public/assets/easyrpg-chipset-world.png')
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/claude-viz/worldmap-easyrpg-plus.html')
KEY = (255, 103, 139)


def uri(im):
    b = io.BytesIO(); im.save(b, 'PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()


def load(p): return Image.open(p).convert('RGB')


def keyed(im, bg=(46, 50, 56)):
    """분홍 키를 회색 격자 배경으로 바꿔 보여 준다(원본 파일은 그대로)."""
    a = im.copy(); px = a.load()
    for y in range(a.height):
        for x in range(a.width):
            if px[x, y] == KEY:
                px[x, y] = (58, 62, 70) if ((x // 4 + y // 4) % 2) else bg
    return a


def scale(im, k): return im.resize((im.width * k, im.height * k), Image.NEAREST)


def overlay(orig, plus, ch):
    im = scale(keyed(plus), 2); d = ImageDraw.Draw(im)
    col = {'palette-only': (255, 210, 60), 'redrawn': (255, 60, 60), 'tidied': (60, 255, 255)}
    for c in ch['cells']:
        x, y = c['col'] * 32, c['row'] * 32
        d.rectangle([x, y, x + 31, y + 31], outline=col[c['kind']], width=1 if c['kind'] == 'palette-only' else 3)
    return im


def diffmask(orig, plus):
    a, b = orig, plus
    im = Image.new('RGB', a.size, (20, 20, 24)); pa, pb, pi = a.load(), b.load(), im.load()
    for y in range(a.height):
        for x in range(a.width):
            if pa[x, y] != pb[x, y]:
                pi[x, y] = (255, 255, 255)
    return scale(im, 2)


orig, plus, ext = load(ORIG), load(os.path.join(D, 'world-plus.png')), load(os.path.join(D, 'world-plus-ext.png'))
ch = json.load(open(os.path.join(D, 'changes.json'))); ej = json.load(open(os.path.join(D, 'world-plus-ext.json')))
imgs = {k: uri(load(os.path.join(V, f'map-ctx-{k}.png'))) for k in ('orig-1x', 'plus-1x', 'orig-2x', 'plus-2x')}
plus_v1, ext_v1 = load(os.path.join(D, 'world-plus-v1.png')), load(os.path.join(D, 'world-plus-ext-v1.png'))
rounds = {f'{r}-{z}': uri(load(os.path.join(V, 'rounds', f'{r}-before-plus-{z}.png'))) for r in ('r1', 'r2', 'r3') for z in ('1x',)}


def crop(im, c0, r0, c1, r1, k):
    return scale(keyed(im.crop((c0 * 16, r0 * 16, c1 * 16, r1 * 16))), k)


def edge_row(c0, r0, c1, r1, k):
    return ''.join(f'<figure><figcaption>{n}</figcaption><img src="{uri(crop(im, c0, r0, c1, r1, k))}"></figure>'
                   for n, im in (('원본', orig), ('1판(네모 계단)', plus_v1), ('지금', plus)))


def strip(items, k, gap=8, h=None):
    """items: (이미지, 라벨) — 아래 정렬로 한 줄에 붙여 4x 로 보여 준다."""
    ims = [scale(keyed(i), k) for i, _ in items]
    H = max(i.height for i in ims); W = sum(i.width for i in ims) + gap * (len(ims) - 1)
    o = Image.new('RGB', (W, H), (21, 24, 29)); x = 0
    for i in ims:
        o.paste(i, (x, H - i.height)); x += i.width + gap
    return o


def cellrect(im, c, r, w=1, h=1): return im.crop((c * 16, r * 16, (c + w) * 16, (r + h) * 16))


def sheetrect(im, ic):
    c, r = ic['col'], ic['row']; w, h = ic['cells']
    return im.crop((c * 16, r * 16, (c + w) * 16, (r + h) * 16))


ext_v1u = uri(scale(keyed(ext_v1), 2))
E1 = {i['name']: i for i in ej['icons']}
cmp_orig = strip([(cellrect(orig, 20, 10, 2, 2), ''), (cellrect(orig, 22, 10, 2, 2), ''), (cellrect(orig, 20, 12, 1, 2), ''),
                  (cellrect(orig, 22, 8), ''), (cellrect(orig, 22, 9), ''), (cellrect(orig, 23, 8), ''), (cellrect(orig, 23, 9), '')], 4)
cmp_new = strip([(sheetrect(ext, E1[n]), n) for n in ('castle_dark', 'castle_dark_grand')], 4)
cmp_town = strip([(sheetrect(ext, E1[n]), n) for n in ('town_bell', 'town_red', 'town_snow', 'village_wood', 'village_snow')], 4)

sheet_o, sheet_p = uri(scale(keyed(orig), 2)), uri(scale(keyed(plus), 2))
ov, dm, ex = uri(overlay(orig, plus, ch)), uri(diffmask(orig, plus)), uri(scale(keyed(ext), 2))

by = {}
for c in ch['cells']:
    by.setdefault((c['zone'], c['kind']), []).append(c['cell'])


def rng(v):
    v = sorted(v); out = []; s = p = v[0]
    for n in v[1:]:
        if n == p + 1: p = n; continue
        out.append(f'{s}-{p}' if p > s else str(s)); s = p = n
    out.append(f'{s}-{p}' if p > s else str(s)); return ', '.join(out)


ZN = {'sea': '바다', 'snow-shore': '눈 해안', 'land-kit': '땅·지형 킷', 'cliff': '절벽', 'icon': '아이콘'}
KN = {'palette-only': '팔레트만', 'redrawn': '다시 그림', 'tidied': '다듬음'}
rows = ''.join(f'<tr><td>{ZN[z]}</td><td>{KN[k]}</td><td>{len(v)}</td><td class="cells">{rng(v)}</td></tr>' for (z, k), v in sorted(by.items()))
tiers = ej['tiers']
icons = {}
for i in ej['icons']: icons.setdefault(i['tier'], []).append(i)
tl = ''.join(f'<h3>{tiers[str(t)]}</h3><ul>' + ''.join(f'<li><b>{i["name"]}</b> — {i["desc"]} <span class="c">(열{i["col"]} 행{i["row"]}, 확장시트 칸 {i["firstCell"]})</span></li>' for i in v) + '</ul>' for t, v in sorted(icons.items()))
k = ch['kinds']

html = f'''<!doctype html><html lang="ko"><meta charset="utf-8"><title>월드맵 EasyRPG 개선판 비교</title>
<style>
body{{background:#15181d;color:#dfe6ee;font:14px/1.55 system-ui,sans-serif;margin:0;padding:24px 32px;max-width:1500px}}
h1{{font-size:22px;margin:0 0 4px}}h2{{font-size:18px;margin:34px 0 8px;border-bottom:1px solid #333c48;padding-bottom:4px}}h3{{font-size:14px;margin:14px 0 4px;color:#9fc4ff}}
.sub{{color:#93a0b0}}img{{image-rendering:pixelated;display:block;border:1px solid #333c48;background:#000}}
.pair{{display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start}}.pair figure{{margin:0}}figcaption{{font-weight:600;margin:0 0 4px}}
table{{border-collapse:collapse}}td,th{{border:1px solid #333c48;padding:3px 8px;text-align:left;vertical-align:top}}.cells{{font-size:12px;max-width:900px;color:#aab6c4}}
.c{{color:#7d8a99;font-size:12px}}ul{{margin:4px 0 0 18px;padding:0}}.lg span{{display:inline-block;width:12px;height:12px;margin:0 4px 0 12px;vertical-align:middle}}
.note{{background:#1d222a;border-left:3px solid #e0a040;padding:8px 12px;margin:10px 0}}
</style>
<h1>월드맵 「EasyRPG World 개선판」 비교</h1>
<div class="sub">같은 40x30 맵, 같은 시드, 시트 칸 배치 불변. 왼쪽이 원본, 오른쪽이 개선판. 모든 픽셀은 좌표·규칙으로 직접 정했다(생성 이미지·트레이싱 없음).
원본 이미지는 EasyRPG RTP World.png (CC BY 4.0) 이고, 개선판은 그 수정본이다(팔레트 조정, 산 명암 재조명, 아이콘 2칸 다듬음; 땅 가장자리는 원본 유지).</div>

<h2>1. 같은 맵, 1x (원본 성·마을 칸 옆에 새 아이콘 배치)</h2>
<div class="pair"><figure><figcaption>원본</figcaption><img src="{imgs['orig-1x']}"></figure><figure><figcaption>개선판</figcaption><img src="{imgs['plus-1x']}"></figure></div>
<h2>2. 같은 맵, 2x</h2>
<div class="pair"><figure><figcaption>원본</figcaption><img src="{imgs['orig-2x']}" style="max-width:740px"></figure><figure><figcaption>개선판</figcaption><img src="{imgs['plus-2x']}" style="max-width:740px"></figure></div>
<p class="sub">볼 것: 새 성·마을이 원본 성·마을 칸 옆에서 튀지 않는지, 땅 바깥 모서리가 원본처럼 둥근지. 2x 원본 크기는 1280x960 이므로 클릭해 새 탭에서 열어도 된다.</p>

<h2>3. 시트 전후 (2x, 분홍 키는 회색 격자로 표시)</h2>
<div class="pair"><figure><figcaption>원본 easyrpg-chipset-world.png (480x256)</figcaption><img src="{sheet_o}"></figure><figure><figcaption>개선판 world-plus.png (480x256)</figcaption><img src="{sheet_p}"></figure></div>

<h2>4. 바뀐 칸 (총 {ch['changedCells']}/{ch['totalCells']}칸)</h2>
<p>팔레트만 <b>{k['palette-only']}</b> · 다시 그림 <b>{k['redrawn']}</b> · 다듬음 <b>{k['tidied']}</b></p>
<div class="lg"><span style="background:#ffd23c"></span>팔레트만 (1px 테두리) <span style="background:#ff3c3c"></span>다시 그림 (굵은 빨강) <span style="background:#3cffff"></span>다듬음</div>
<div class="pair" style="margin-top:8px"><figure><figcaption>칸 종류 표시 (개선판 위)</figcaption><img src="{ov}"></figure><figure><figcaption>실제로 달라진 픽셀 (흰색)</figcaption><img src="{dm}"></figure></div>
<table style="margin-top:10px"><tr><th>구획</th><th>종류</th><th>칸 수</th><th>칸 번호(행*30+열)</th></tr>{rows}</table>

<h2>5. 확장 시트: 1판 vs 2판 (2x)</h2>
<div class="sub">1판은 채도 높은 원뿔 지붕·가는 윤곽·디테일 없음이라 원본 옆에서 다른 게임 그림처럼 보였다. 2판은 원본 아이콘 픽셀을 잘라 늘리고 재배치했다(새 색 없음).</div>
<div class="pair" style="margin-top:8px"><figure><figcaption>1판 (폐기)</figcaption><img src="{ext_v1u}"></figure><figure><figcaption>2판 (지금, {len(ej['icons'])}종)</figcaption><img src="{ex}"></figure></div>
{tl}

<h2>6. 새 아이콘을 원본 옆에 (4x)</h2>
<div class="sub">위: 원본 어두운 성 2x2 · 흰 성 2x2 · 둥근 탑 1x2 · 집 (22,8) (22,9) · 눈 집 (23,8) (23,9). 아래: 새 성 3x3 · 대성 5x5 · 마을·촌락. 윤곽 111618, 왼쪽 위 빛, 같은 팔레트인지 본다.</div>
<img src="{uri(cmp_orig)}" style="margin-top:8px"><img src="{uri(cmp_new)}" style="margin-top:8px"><img src="{uri(cmp_town)}" style="margin-top:8px">

<h2>7. 땅 가장자리 고침: 원본 / 1판 / 지금 (위 3x, 아래 2x)</h2>
<div class="sub">1판의 땅 킷 다시 그리기가 둥근 굴곡을 네모 계단으로 바꿨다. 지금은 킷 40칸을 원본으로 되돌리고 팔레트 눌림만 적용했다(산 재조명 11칸은 유지). 위: 땅 킷(6-11열 0-7행), 아래: 모래·눈·흙 킷(0-11열 8-15행).</div>
<div class="pair" style="margin-top:8px">{edge_row(6, 0, 12, 8, 3)}</div>
<div class="pair" style="margin-top:8px">{edge_row(0, 8, 12, 16, 2)}</div>

<h2>8. 적대적 검토 3회: 각 회 「수정 전」 지도 (1x)</h2>
<div class="sub">1회: 성이 판자 같음·마을이 벽지 같음·낱칸 잔재·앞 성벽 이음새 → 고침. 2회: 마을이 오두막 흩뿌림처럼 보임 → 촘촘히 겹침·낱칸 제거. 3회: 앞 성벽이 너무 평평 → 화살 구멍 추가. 지도 아래가 지금(4회째) 상태다.</div>
<div class="pair" style="margin-top:8px"><figure><figcaption>1회 전</figcaption><img src="{rounds['r1-1x']}"></figure><figure><figcaption>2회 전</figcaption><img src="{rounds['r2-1x']}"></figure><figure><figcaption>3회 전</figcaption><img src="{rounds['r3-1x']}"></figure><figure><figcaption>지금</figcaption><img src="{imgs['plus-1x']}"></figure></div>

<h2>9. 솔직한 평가</h2>
<div class="note"><b>나아진 점</b> 산 명암·입체감, 눌린 색조, 땅 가장자리 원본 곡선 복구, 확장 아이콘을 원본 모듈 재조립으로 바꿔 윤곽·팔레트·디더가 원본과 같은 결.<br>
<b>아직 약한 점</b> 큰 마을(town_red)은 지붕이 겹쳐 일부가 잘려 약간 어수선함 · 대성 5x5 앞 성벽이 평평하고 문이 작음 · 설원 마을은 오두막 느낌 · 1x2 탑·신전·동굴은 원본이 충분해 새로 만들지 않음 · 숲은 팔레트만 바꿈 · 바다·해안은 원본 유지.</div>
<p class="sub">Original: EasyRPG RTP World.png, CC BY 4.0. Modified by OPRN Studio (2026-09-30): palette muted, mountains relit, two icon cells tidied, extension icons recomposed from original cell modules. 자세한 진단은 tiledata/atlas-pick/worldmap-easyrpg-plus/DIAGNOSIS.md.</p>
</html>'''
open(OUT, 'w', encoding='utf-8').write(html)
print(OUT, len(html) // 1024, 'KB')
