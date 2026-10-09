# 결과 페이지: 저장소 루트에서 python3 tiledata/hand-interior/refmap-study/pager.py
#   → ~/claude-viz/interior-refmap-study.html + ~/claude-viz/interior-refmap-study/*.png  (REFMAP 잘라낸 그림은 여기에만 둔다)
#   → tiledata/hand-interior/refmap-study/results.json (수치만)
import sys, os, json, html, base64, io
D = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, D)
import numpy as np
from PIL import Image
import roomr, propsr, measure
from measure import obj_stats

ROOT = os.path.abspath(os.path.join(D, '..', '..', '..'))
VIZ = os.path.expanduser('~/claude-viz/interior-refmap-study'); os.makedirs(VIZ, exist_ok=True)
PACK = measure.PACK
MAPS = os.path.expanduser('~/.local/share/oprn/refmap-downloads/_work/refmap-interior/out/publish/')

def up(im, k): return im.resize((im.width * k, im.height * k), Image.NEAREST)
def on_bg(im, bg=(58, 54, 60, 255)):
    b = Image.new('RGBA', im.size, bg); b.alpha_composite(im.convert('RGBA')); return b
def save(im, name): im.save(f'{VIZ}/{name}'); return f'interior-refmap-study/{name}'

HERO = Image.open(f'{ROOT}/public/assets/generated/starter/hero-01-charset.png').convert('RGBA').crop((24, 64, 48, 96))

# ---------------------------------------------------------------- REFMAP 비교 그림 (페이지에만)
def refmap_crops():
    out = {}
    for n in ('refmap_bakery_home', 'refmap_old_couple_cottage'):
        out[n] = save(Image.open(f'{MAPS}{n}.png').convert('RGB'), f'ref-{n}.png')
    bak = Image.open(f'{MAPS}refmap_bakery_home.png').convert('RGBA')
    out['wall_brick'] = save(up(bak.crop((24, 24, 216, 216)), 4), 'ref-wall-brick-x4.png')
    out['wall_plaster'] = save(up(bak.crop((408, 24, 600, 216)), 4), 'ref-wall-plaster-x4.png')
    def sheet(f, box, k, name): out[name] = save(up(on_bg(Image.open(PACK + f).convert('RGBA').crop(box)), k), name + '.png')
    sheet('B_REFMAP_Interior.png', (0, 640, 48, 768), 8, 'ref-bed-x8')
    sheet('B_REFMAP_Interior.png', (0, 288, 144, 416), 4, 'ref-shelf-x4')
    sheet('B_REFMAP_Interior.png', (720, 192, 768, 288), 8, 'ref-barrel-x8')
    sheet('B_REFMAP_Interior.png', (576, 288, 672, 336), 8, 'ref-sack-jar-x8')
    sheet('C_REFMAP_Interior.png', (48, 0, 144, 96), 4, 'ref-chairs-x4')
    sheet('A5_REFMAP_Interior.png', (0, 96, 96, 144), 8, 'ref-plank-x8')
    sheet('A5_REFMAP_Interior.png', (0, 288, 96, 336), 8, 'ref-flag-x8')
    # 격자 증거: B 시트에 32px(빨강)·48px(초록) 선을 겹친다
    b = on_bg(Image.open(PACK + 'B_REFMAP_Interior.png').convert('RGBA').crop((0, 288, 288, 480)))
    b = up(b, 3); px = b.load()
    for x in range(0, b.width):
        for y in range(0, b.height):
            if (x // 3) % 48 == 0 and x % 3 == 0 or (y // 3) % 48 == 0 and y % 3 == 0: px[x, y] = (60, 230, 90, 255)
            elif ((x // 3) % 32 == 0 and x % 3 == 1) or ((y // 3) % 32 == 0 and y % 3 == 1): px[x, y] = (240, 70, 70, 255)
    out['grid'] = save(b, 'ref-grid-32-vs-48.png')
    return out

# ---------------------------------------------------------------- 방 세 판 + 캐릭터
def rooms():
    new = roomr.room(); v5 = roomr.room_v5(); v32, miss = roomr.room_v32()
    newh = roomr.room(hero=(HERO, roomr.HERO_AT))
    r = dict(new=save(up(new, 2), 'room-new-x2.png'), new1=save(new, 'room-new-x1.png'), newh=save(up(newh, 2), 'room-new-hero-x2.png'),
             v5=save(up(v5, 4), 'room-v5-x4.png'), v32=save(up(v32, 2), 'room-v32-x2.png'), missing=miss)
    # 칸·캐릭터 관계: 32px 칸 격자 위 24×32 캐릭터 / REFMAP 48px 칸 비율
    tile = newh.crop((6 * 32, 5 * 32, 11 * 32, 9 * 32)); t = up(tile, 4); px = t.load()
    for x in range(t.width):
        for y in range(t.height):
            if x % 128 == 0 or y % 128 == 0: px[x, y] = (255, 255, 255, 150)
    r['hero_grid'] = save(t, 'hero-grid-x4.png')
    return r, new

# ---------------------------------------------------------------- 소품 비교
PAIRS = [('bed', 'bed blue', 'bed blue'), ('bookshelf', 'bookshelf 2w', 'bookshelf 2w'), ('wardrobe', 'wardrobe', 'wardrobe'),
         ('dining', 'dining 2x2', 'dining 2x2'), ('chair S', 'chair S', 'chair S'), ('chair N', 'chair N', 'chair N'),
         ('barrel', 'barrel', 'barrel'), ('jar', 'water jar', 'water jar'),
         ('oven', 'bread oven', None), ('sack', 'sack:flour', None), ('crate', 'crate', None), ('bread counter', 'display bread', None),
         ('wall shelf', 'shelf pots', None), ('window', 'curtained window', None), ('rug', 'rug red', None), ('plant', 'potted fern', None)]

def props():
    roomr._paths(); cwd = os.getcwd(); os.chdir(ROOT)
    try:
        from rooms4 import o, T
        import room32
        P = propsr.all_props(); rows = []; stats = {}
        for n, n5, n32 in PAIRS:
            p = P[n]
            f5 = (T('dining', 2, 2) if n5 == 'dining 2x2' else o(n5)).im
            i32 = room32.obj32(n32) if n32 else None
            k = n.replace(' ', '-')
            row = dict(id=n, ko=p.ko, new=save(up(on_bg(p.im), 4), f'obj-new-{k}.png'), v5=save(up(on_bg(f5), 8), f'obj-v5-{k}.png'),
                       v32=save(up(on_bg(i32), 4), f'obj-v32-{k}.png') if i32 is not None else None, size=list(p.im.size), fw=p.fw, fh=p.fh)
            rows.append(row)
            a = lambda im: np.array(im.convert('RGBA')).astype(np.int32)
            stats[n] = dict(new=obj_stats(a(p.im)), v32=obj_stats(a(i32)) if i32 is not None else None, v5=obj_stats(a(f5)))
        return rows, stats
    finally: os.chdir(cwd)

def summarize(stats, ref):
    def agg(key, pick):
        vals = [pick(v[key]) for v in stats.values() if v[key]]
        return round(float(np.mean(vals)), 3) if vals else None
    def ratio(s): return s['edge_L'] / max(1, s['inner_L'])
    def sat(s): return float(s['inner_hs'][1]) if s['inner_hs'] else 0
    out = {}
    for key in ('v5', 'v32', 'new'):
        out[key] = dict(colors=agg(key, lambda s: s['colors']), inner_dL=agg(key, lambda s: s['inner_dL']), edge_ratio=agg(key, ratio),
                        edge_black=agg(key, lambda s: s['edge_black']), sat=agg(key, sat), semi_alpha=agg(key, lambda s: s['semi_alpha']))
    R = list(ref['objects'].values())
    out['refmap'] = dict(colors=round(float(np.mean([s['colors'] for s in R])), 1), inner_dL=round(float(np.mean([s['inner_dL'] for s in R])), 2),
                         edge_ratio=round(float(np.mean([ratio(s) for s in R])), 3), edge_black=round(float(np.mean([s['edge_black'] for s in R])), 3),
                         sat=round(float(np.mean([sat(s) for s in R])), 3), semi_alpha=round(float(np.mean([s['semi_alpha'] for s in R])), 3))
    return out

def img_tag(src, w=None, cap=''):
    ws = f' style="width:{w}px"' if w else ''
    return f'<figure><img src="{src}"{ws}><figcaption>{html.escape(cap)}</figcaption></figure>'

def main():
    ref = measure.main()
    crops = refmap_crops(); R, new = rooms(); rows, stats = props()
    summ = summarize(stats, ref)
    check = json.load(open(os.path.join(D, 'refmap-check.json')))
    res = dict(tile=dict(measured=48, evidence=ref['grid'], sizes=ref['sizes']), surfaces=ref['surfaces'], summary=summ,
               props={k: {kk: vv for kk, vv in v.items()} for k, v in stats.items()},
               check={k: {x: v[x] for x in ('exactMatches', 'atLeast95', 'atLeast90', 'maxSimilarity', 'maxSimilarityContent50', 'meanSimilarity')}
                      for k, v in check['modes'].items()}, ourCells=check['ourCells'], refCells48=check['refCells48'])
    json.dump(res, open(os.path.join(D, 'results.json'), 'w'), ensure_ascii=False, indent=1, default=float)

    g = ref['grid']
    grid_rows = ''.join(f'<tr><td>{html.escape(f)}</td><td>{ref["sizes"][f][0]}×{ref["sizes"][f][1]}</td>' +
                        ''.join(f'<td class="{"hit" if T == 48 else ""}">{v[str(T)] if str(T) in v else v[T]}</td>' for T in (16, 24, 32, 48)) + '</tr>'
                        for f, v in g.items())
    def srow(label, k, fmt='{}'):
        return '<tr><td>' + label + '</td>' + ''.join(f'<td>{fmt.format(summ[c][k])}</td>' for c in ('refmap', 'v5', 'v32', 'new')) + '</tr>'
    metric = (srow('소품 한 개의 색 수', 'colors') + srow('소품 속 이웃 명도차', 'inner_dL') +
              srow('윤곽 밝기 ÷ 속 밝기', 'edge_ratio') + srow('윤곽 중 검정(L&lt;28) 비율', 'edge_black') +
              srow('몸통 채도(HLS s)', 'sat') + srow('반투명 화소 비율(그림자·번짐)', 'semi_alpha'))
    prop_rows = ''.join(
        f'<div class="card"><h4>{html.escape(r["ko"])} <span class="muted">{r["size"][0]}×{r["size"][1]} · 발 {r["fw"]}×{r["fh"]}</span></h4>'
        f'<div class="trio"><div><img src="{r["v5"]}"><p>v5 16px ×8</p></div>' +
        (f'<div><img src="{r["v32"]}"><p>v32 시험 ×4</p></div>' if r['v32'] else '<div class="none">v32 시험에 없음</div>') +
        f'<div><img src="{r["new"]}"><p>새 견본 ×4</p></div></div></div>' for r in rows)
    ck = res['check']
    page = f'''<!doctype html><meta charset="utf-8"><title>실내 다시 — REFMAP 연구 + 32px 견본</title>
<style>
body{{font-family:system-ui,sans-serif;background:#15171b;color:#e4e4e4;margin:0;padding:24px 32px;max-width:1900px;line-height:1.55}}
h1{{font-size:22px}} h2{{font-size:18px;margin:28px 0 8px;border-top:1px solid #333;padding-top:16px}} h4{{margin:0 0 6px;font-size:14px}}
img{{image-rendering:pixelated;display:block;max-width:100%}} figure{{margin:0 12px 12px 0;display:inline-block;vertical-align:top}}
figcaption,.muted{{color:#9aa0a8;font-size:12px}} table{{border-collapse:collapse;font-size:13px;margin:8px 0}} td,th{{border:1px solid #333;padding:3px 8px;text-align:right}}
td:first-child,th:first-child{{text-align:left}} td.hit{{background:#244d33;font-weight:600}} .note{{background:#20242a;padding:10px 14px;border-radius:8px}}
.row{{display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start}} .card{{background:#1e2126;border-radius:8px;padding:10px;margin:0 10px 10px 0;display:inline-block;vertical-align:top}}
.trio{{display:flex;gap:10px;align-items:flex-end}} .trio p{{margin:2px 0 0;font-size:11px;color:#9aa0a8}} .none{{color:#777;font-size:12px;width:90px}}
ol li,ul li{{margin:3px 0}} .warn{{color:#e8b07a}}
</style>
<h1>실내 다시 그리기 — REFMAP 실내 팩 연구와 32px 견본 방</h1>
<p class="note"><b>실측 칸 크기: 48px</b> (RPG Maker MV 표준). 시트 폭 768 = 16칸×48, A5 폭 384 = 8칸×48, A4 높이 720 = 15칸×48.
물체 시트 B·C·D 에서 그림이 칸 경계를 넘는 정도가 48px 격자에서만 크게 줄어든다(아래 표, 1 보다 작을수록 진짜 격자). 32px 격자는 1.0 근처라 격자가 아니다.
그림 자체도 확대본이 아니다(같은 색 가로 연속 비율 0.09~0.31, 한 물체 색 수 수백~수천 = 붓으로 칠한 그림).
<br><b>견본은 32px 로 그렸다.</b> 사용자가 32×32 를 원했고, 걷는 캐릭터 24×32 가 32px 칸에 딱 맞는다. REFMAP 의 비율(벽 2칸, 마루판 높이 ¼칸, 천장 테 ½칸 등)은 48→32 로 줄여 옮겼다.</p>

<h2>1. 칸 크기 근거</h2>
<div class="row"><div><table><tr><th>시트</th><th>크기</th><th>16</th><th>24</th><th>32</th><th>48</th></tr>{grid_rows}</table>
<p class="muted">값 = 칸 경계를 가로지르는 불투명 화소 수 ÷ 반칸 선을 가로지르는 수. A1·A2·A4·A5 는 칸을 꽉 채우는 바닥·벽이라 1 근처.</p></div>
{img_tag(crops['grid'], None, 'B 시트 일부 ×3 — 초록 48px 격자에 물체가 맞고, 빨강 32px 격자는 물체를 가른다')}</div>

<h2>2. REFMAP 조립 맵 (연구용 비교 — 페이지에만)</h2>
<div class="row">{img_tag(crops['refmap_bakery_home'], None, 'REFMAP 빵집 (48px 칸, 원본 크기)')}{img_tag(crops['refmap_old_couple_cottage'], None, 'REFMAP 노부부 집 (원본 크기)')}</div>

<h2>3. 연구 요점</h2>
<div class="row">{img_tag(crops['wall_brick'], 384, '벽돌 벽 ×4: 천장 테(번짐 10px + 경사 12px) → 윗테 → 벽면 2칸(96px) → 굽 → 바닥 AO')}
{img_tag(crops['wall_plaster'], 384, '회벽 ×4: 짙은 나무 틀(위 8·아래 16px), 들보 밑 그늘 12px')}
{img_tag(crops['ref-plank-x8'], 384, '마루 ×8: 판 높이 12px(¼칸), 판마다 값이 다르고 결은 옅다')}
{img_tag(crops['ref-flag-x8'], 384, '판석 ×8: 불규칙 돌, 분홍·초록 기운, 줄눈 한 단')}</div>
<div class="row">{img_tag(crops['ref-bed-x8'], 192, '침대 ×8: 윤곽이 검정이 아니다, 흰 천은 붓 그라데이션')}
{img_tag(crops['ref-shelf-x4'], 288, '서랍장·책장 ×4: 키 큰 가구는 앞면이 주인공, 윗판은 얇다')}
{img_tag(crops['ref-barrel-x8'], 192, '통 ×8: 오른쪽 아래로 반투명 그림자')}
{img_tag(crops['ref-sack-jar-x8'], 384, '자루·항아리 ×8: 둥근 덩이 명암, 가장자리 반투명 번짐')}
{img_tag(crops['ref-chairs-x4'], 192, '의자 ×4: 등받이 방향 둘')}</div>
<table><tr><th>소품 평균</th><th>REFMAP</th><th>v5 16px</th><th>v32 시험</th><th>새 견본</th></tr>{metric}</table>
<p class="muted">REFMAP 은 물체 18종, v5·v32·새 견본은 같은 이름의 소품(v32 는 있는 8종). 윤곽 비는 1 에 가까울수록 윤곽이 연하다.</p>
<ol>
<li><b>벽은 2칸, 위아래에 테.</b> REFMAP 벽면은 96px(2칸). 위에 짙은 윗테 6~8px, 아래 굽 10~16px. 들보 밑 12px, 벽 발치 바닥 12~16px 가 그늘로 어둡다. 32px 에서는 64px 벽 · 윗테 4~5 · 굽 7~12 · 그늘 6~8px 로 옮겼다.</li>
<li><b>천장 테는 슬레이트 경사 + 바깥 번짐.</b> 안쪽부터 짙은 선 2 · 밝은 면 4 · 짙은 선 1 · 밝은 모서리 1, 그 바깥 6px 가 검정으로 번진다(REFMAP 은 12px 경사 + 10px 번짐).</li>
<li><b>윤곽은 검정이 아니라 같은 재질의 어두운 단.</b> REFMAP 윤곽 밝기는 속의 약 0.6배, v32 시험은 0.28배라 딱딱하고 까맣다. 새 견본은 아래·오른쪽 0.56배, 위·왼쪽 0.78배.</li>
<li><b>채도가 낮고 면이 부드럽다.</b> REFMAP 몸통 채도 약 0.21, v32 시험 0.40. 새 색 줄은 재질마다 12단, 채도 0.2~0.35, 어두운 끝은 붉게·보라로, 밝은 끝은 누렇게.</li>
<li><b>그림자는 반투명이고 오른쪽 아래로 진다.</b> REFMAP 은 물체 화소의 6~35% 가 반투명(그림자·번짐). 새 견본은 실루엣을 (3,2)px 밀어 두 단 알파(72/124)로 드리운다.</li>
<li><b>키 큰 가구는 앞면, 낮은 가구는 윗면.</b> 탁자는 윗면이 높이의 ¾, 앞 두께 5px. 책장·옷장은 윗판 5~6px 에 앞면이 전부. 탁자에는 늘 무언가(빵·대접)를 얹는다.</li>
<li><b>배치 문법.</b> 방마다 한 기능(부엌 = 벽돌 벽 + 판석, 거실 = 회벽 + 마루), 키 큰 가구는 북벽에 등을 대고 벽면 위로 솟는다. 문에서 안쪽까지 1칸 이상 곧은 길을 비운다. 구석은 통·자루·항아리 덩이로 채우고, 방 가운데는 탁자·깔개 한 덩이만 둔다.</li>
<li><b>32px 에서 뺀 것.</b> 붓 질감(천 주름의 수백 색), 벽지 잔무늬, 금속 반사 여러 점. <b>넣은 것:</b> 2~3px 폭 명암 띠, 윗모서리 1px 빛, 반투명 그림자, 벽·바닥 그늘.</li>
</ol>

<h2>4. 새 견본 방 — 빵집 딸린 민가 (32px, 안쪽 12×9칸)</h2>
<div class="row">{img_tag(R['newh'], None, '새 견본 ×2 (캐릭터 24×32 를 1배로 세움)')}{img_tag(R['new1'], None, '새 견본 원본 크기')}</div>
<div class="row">{img_tag(R['hero_grid'], 640, '칸과 캐릭터 ×4: 흰 선 = 32px 칸. 걷는 캐릭터 24×32 는 칸 폭의 ¾, 키는 1칸')}
<div class="note" style="max-width:520px">REFMAP(MV) 캐릭터는 48px 칸에 48×48 틀로 선다. 우리 32px 칸 + 24×32 캐릭터는 그 비율(칸 1개 = 사람 1명 키)을 그대로 지킨다.
그래서 벽 2칸 = 사람 키의 2배, 문 1칸, 탁자 2×2 등 REFMAP 치수를 칸 수 그대로 옮길 수 있다.</div></div>

<h2>5. 같은 배치 세 판</h2>
<div class="row">{img_tag(R['v5'], 448, 'v5 16px (×4 로 보여 줌, 크기를 맞추려고)')}{img_tag(R['v32'], 448, 'v32 시험 32px (×2) — 없는 소품은 v5 그림 2배')}{img_tag(R['new'], 448, '새 견본 32px (×2)')}</div>
<p class="muted">v32 시험에 없는 소품: {', '.join(R['missing'])} — v5 그림을 2배로 채웠다. v32 시험 벽은 한 종류라 부엌 벽돌·판석 구역이 없다.</p>

<h2>6. 소품 확대 비교 (16종)</h2>
{prop_rows}

<h2>7. REFMAP 화소 대조</h2>
<table><tr><th>방식</th><th>같은 칸</th><th>≥95%</th><th>≥90%</th><th>최대</th><th>그림 50% 이상 칸의 최대</th><th>평균</th></tr>
{''.join(f"<tr><td>{k}</td><td>{v['exactMatches']}</td><td>{v['atLeast95']}</td><td>{v['atLeast90']}</td><td>{v['maxSimilarity']}</td><td>{v['maxSimilarityContent50']}</td><td>{v['meanSimilarity']}</td></tr>" for k, v in ck.items())}</table>
<p class="muted">우리 칸 {res['ourCells']}개(방 + 소품 16종) × REFMAP 48px 칸 {res['refCells48']}개(시트 7장 + 조립 맵 20장). 닮음 = 둘 다 불투명이고 RGB 차 ≤ 8 인 화소 비율.
최대 0.86 은 방 네 귀퉁이 칸 — 86% 가 검정이라 REFMAP 맵의 검은 칸과 겹친다. 그림이 절반 이상인 칸은 최대 {max(v['maxSimilarityContent50'] for v in ck.values())}.
<b>95% 이상 닮은 칸 0개.</b></p>

<h2>8. 남은 약점</h2>
<ul class="warn">
<li>REFMAP 은 붓 그림(물체 한 개 수백~수천 색)이라 같은 부드러움은 32px 도트로 안 나온다. 새 견본은 색 줄 12단 띠라 가까이서 보면 계단이 보인다.</li>
<li>침대가 1칸 폭이라 동쪽 벽에 붙이면 좁아 보인다. REFMAP 침대(48×120)는 머리판이 더 높다.</li>
<li>판석 줄눈 대비가 REFMAP 보다 조금 세서 부엌 바닥이 바쁘다.</li>
<li>빵 진열대의 빵이 작아 원본 크기에서는 주황 점으로 읽힌다.</li>
<li>화분 잎이 한 덩이라 REFMAP 화분처럼 잎 결이 안 보인다.</li>
<li>수치로 남은 차이: 반투명 화소 5.8% (REFMAP 14%) — 그림자가 아직 얇다. 몸통 채도 0.30 (REFMAP 0.21) — 조금 더 빼도 된다. 속 명도차 9.7 (REFMAP 13) — 면이 REFMAP 보다 조금 평평하다. 윤곽 비 0.72 (REFMAP 0.64) — 아래·오른쪽 윤곽을 한 단 더 어둡게 해도 된다.</li>
<li>애니메이션(가마 불)은 한 장만 그렸다.</li>
</ul>
'''
    open(os.path.expanduser('~/claude-viz/interior-refmap-study.html'), 'w').write(page)
    print('ok', summ)

if __name__ == '__main__':
    main()
