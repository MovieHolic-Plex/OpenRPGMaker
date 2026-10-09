#!/usr/bin/env python3
"""modern3 자동 재채색 시험 비교 페이지 생성(자체완결 HTML, 이미지는 data URI).
  python3 scripts/content/atlas-pick/build_remap_trial_page.py [출력.html]   (저장소 루트에서. 기본 ~/claude-viz/modern3-remap-trial.html)
등급·이유·추정치는 아래 표에 손으로 적은 판정이다(remap_modern3.py 는 색만 바꾼다). 판정 근거는 modern-style-bible.md §2 면 단계·§3 슬래브·§4 축척표."""
import base64, io, json, os, sys
from PIL import Image
AP = 'tiledata/atlas-pick'
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/claude-viz/modern3-remap-trial.html')
COLOR, TOUCH, REDO = '색만', '손질 조금', '다시'
# (묶음, 이름, 원본 png, 결과 png, 리포트, 등급, 한 줄 이유)
S = lambda s, n: (f'{AP}/candidates-school/{s}/{n}.png', f'{AP}/remap-trial/school/{s}/{n}.m3.png', f'{AP}/remap-trial/school/{s}/{n}.m3.report.json')
M = lambda s: (f'{AP}/candidates-modern/{s}/v0.png', f'{AP}/remap-trial/modern/{s}/v0.m3.png', f'{AP}/remap-trial/modern/{s}/v0.m3.report.json')
ITEMS = [
 ('학원', 'classroom_wall (s2-A)', *S('classroom_wall', 's2-A'), COLOR, '띠·벽 면 단계가 이미 위 밝음/아래 어두움이라 색만 바뀜. 크림→kinari, 징두리→ita 로 자연스럽게 대응.'),
 ('학원', 'hall_wall (s1-A)', *S('hall_wall', 's1-A'), COLOR, '크림 위벽+청록 하부 판벽. 구조 변화 없이 kinari/tairu 로 옮겨짐.'),
 ('학원', 'class_window (s1-A)', *S('class_window', 's1-A'), COLOR, '반사 & 53화소를 이웃 유리색 +2단으로 구워 넣어 반투명 0. 청록 유리가 청보라 garasu 로 바뀌는 것만 차이(약한 대응 1).'),
 ('학원', 'schoolyard (s1-A)', *S('schoolyard', 's1-A'), COLOR, '3색 흙바닥. 색만 바뀜.'),
 ('학원', 'hall_door (s1-A)', *S('hall_door', 's1-A'), TOUCH, '색은 깨끗하나 문짝 폭 ≈20px 로 규격 문 16×28 보다 넓음, 문틀 위 그늘(-2 2줄)이 약함.'),
 ('학원', 'blackboard (s2-A)', *S('blackboard', 's2-A'), TOUCH, '판 색은 됐으나 분필받이 밑 그림자 59화소(반투명)를 못 구움. 벽 색 단계 확인 뒤 -2 로 다시 찍어야 함.'),
 ('학원', 'desk_set (s4-B)', *S('desk_set', 's4-B'), TOUCH, '바닥 그림자 34화소가 빈 칸 위 반투명이라 버려짐. 바닥 램프 지정(-2/가장자리 -1)으로 되살리면 색만 수준.'),
 ('학원', 'locker_row (s3-A)', *S('locker_row', 's3-A'), TOUCH, '바닥 그림자 64화소 버려짐. 몸통은 tekko/conc 로 깨끗함, 바닥 그림자만 재구움.'),
 ('학원', 'lab_bench (s5-B)', *S('lab_bench', 's5-B'), TOUCH, '검은 상판이 윗면 +2 가 아니라 가장 어둡다(면 단계 위반). 그림자 74화소도 버려짐. 상판을 tekko/conc +2 로 다시 칠해야 함.'),
 ('학원', 'grand_piano (s2-A)', *S('grand_piano', 's2-A'), TOUCH, '뚜껑(윗면)이 앞면과 같은 검정이라 +2 가 안 보임. 그림자 67화소 버려짐. 윗면 한 단 올리면 됨.'),
 ('학원', 'basketball_hoop (s3-A)', *S('basketball_hoop', 's3-A'), TOUCH, '오렌지 림 #ec9900 이 daidai 로 대응(약함). 바닥 그림자 50화소 버려짐.'),
 ('학원', 'school_gate (s4-A)', *S('school_gate', 's4-A'), TOUCH, '기둥·철책은 lavender-conc/tekko 로 옮겨졌으나 바닥 그림자 68화소 버려짐, 애매 회색 4색이 conc 로 몰림.'),
 ('일본 킷', 'kit_shopfront k2-A (조립 6종)', f'{AP}/candidates-jp/kit_shopfront/k2-A.png', f'{AP}/remap-trial/jp/kit_shopfront/k2-A.m3.png', f'{AP}/remap-trial/jp/kit_shopfront/k2-A.m3.report.json', REDO, '색은 청보라 톤으로 정상 이동(합성 6종 모두 읽힘). 그러나 킷이 층 16px·슬래브 3px 세대라 §3 의 4px 슬래브·8px 가게 물러섬·면 단계가 없음 → 부품 재작성 필요(§7-4). 반투명 76화소도 버려짐.'),
 ('강남', 'blk_gb_bg (건물 블록)', *M('blk_gb_bg'), COLOR, '16×16 유리벽. 대각 반사가 이미 청→보라 단계라 garasu/tairu 로 그대로 옮겨짐.'),
 ('강남', 'gn_car_h (승용차)', *M('gn_car_h'), REDO, '실루엣 폭 46×24 로 규격 56×24 보다 10px 짧음(3칸 캔버스). 4칸으로 늘리려면 바퀴 간격·창 배분을 다시 그려야 함. 색은 문제 없음.'),
 ('강남', 'gn_bench (벤치)', *M('gn_bench'), COLOR, '12×28 나무 벤치. 색만 ita 로 이동, 형태 손댈 곳 없음.'),
 ('강남', 'gn_trash_bags (쓰레기봉투)', *M('gn_trash_bags'), COLOR, '작은 소품. 색만 바뀜(오렌지 띠는 flat 표가 kii 로 가져가 어긋남 → 표 수정 대상).'),
]
KIT_EX = ['konbini6', 'konbini9', 'izakaya5', 'ramen4', 'closed3', 'row15']
# 전체 적용 추정 (색만, 손질, 다시)
EST = [
 ('일본 조각 58', 26, 29, 3, '표본 없음(킷만 시험) → 학원·강남 조각 비율에서 외삽'),
 ('일본 킷 10', 0, 2, 8, 'k2-A 가 다시 → 킷 전체가 16px 층 세대라 재작성 쪽으로 봄'),
 ('학원 68', 23, 43, 2, '표본 12: 색만 4·손질 8. 바닥 그림자 옵션이 붙으면 색만 ≈9/12 로 오름'),
 ('강남 67', 45, 14, 8, '표본 4: 색만 3·다시 1(차). 차·버스·표지판 축척이 갈림, 신뢰도 낮음'),
]

def uri(p, scale=None):
    im = Image.open(p).convert('RGBA'); b = io.BytesIO(); im.save(b, 'PNG')
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode(), im.size

def img(p, z):
    u, (w, h) = uri(p)
    return f'<img src="{u}" width="{w*z}" height="{h*z}" alt="">'

def badge(g):
    return f'<span class="bd {"c" if g==COLOR else "t" if g==TOUCH else "r"}">{ {COLOR:"색만 바꾸면 됨",TOUCH:"손질 조금",REDO:"다시 그려야 함"}[g] }</span>'

cnt = {COLOR: 0, TOUCH: 0, REDO: 0}
for it in ITEMS: cnt[it[5]] += 1
cards = []
for grp, name, a, b, rep, g, why in ITEMS:
    r = json.load(open(rep)); st = r.get('stat', {})
    drop = r.get('translucentDropped', 0); baked = sum((r.get('baked') or {}).values())
    meta = f'{r["size"][0]}×{r["size"][1]} · 색 {(r.get("colors") if isinstance(r.get("colors"),int) else len(r.get("colors",[])))} · 약한 {len(r["weak"]) if hasattr(r["weak"],"__len__") else r["weak"]} · 애매 {len(r["ambiguous"]) if hasattr(r["ambiguous"],"__len__") else r["ambiguous"]} · 반투명 구움 {baked} · 버림 {drop} · 밖 {r.get("outOfPalette", 0)}'
    z = 3 if r['size'][0] <= 64 and r['size'][1] <= 64 else 2
    if r['size'][0] > 100: z = 2
    cards.append(f'''<section class="card"><div class="hd"><b>{name}</b> <i>{grp}</i> {badge(g)}</div><div class="meta">{meta}</div>
<div class="pair"><div><small>이전 ×1</small>{img(a,1)}<small>이전 ×{z}</small>{img(a,z)}</div><div><small>modern3 ×1</small>{img(b,1)}<small>modern3 ×{z}</small>{img(b,z)}</div></div>
<p class="why">{why}</p></section>''')
kit = ''
base = f'{AP}/candidates-jp/kit_shopfront/k2-A.ex-%s.png'; new = f'{AP}/remap-trial/jp/kit_shopfront/k2-A.m3.ex-%s.png'
for k in KIT_EX:
    kit += f'<div class="kx"><small>{k}</small><div>{img(base%k,2)}{img(new%k,2)}</div></div>'
est_rows = ''; tot = [0, 0, 0]
for n, a, b, c, note in EST:
    tot = [tot[0]+a, tot[1]+b, tot[2]+c]
    est_rows += f'<tr><td>{n}</td><td>{a}</td><td>{b}</td><td>{c}</td><td class="n">{note}</td></tr>'
est_rows += f'<tr class="tot"><td>합계 {sum(tot)}</td><td>{tot[0]}</td><td>{tot[1]}</td><td>{tot[2]}</td><td class="n">전체 적용 시 색만 ≈{round(tot[0]/sum(tot)*100)}% · 손질 ≈{round(tot[1]/sum(tot)*100)}% · 다시 ≈{round(tot[2]/sum(tot)*100)}%</td></tr>'
html = f'''<!doctype html><html lang="ko"><meta charset="utf-8"><title>modern3 자동 재채색 시험</title>
<style>
body{{background:#1b1a22;color:#e6e2f0;font:14px/1.5 system-ui,sans-serif;margin:24px auto;max-width:1240px;padding:0 16px}}
h1{{font-size:20px}} h2{{font-size:16px;margin-top:28px;border-bottom:1px solid #3a3848;padding-bottom:4px}}
img{{image-rendering:pixelated;background:#8d8b96;vertical-align:top}}
.sum{{display:flex;gap:12px;margin:12px 0}} .sum div{{background:#262533;border-radius:8px;padding:10px 18px;text-align:center}} .sum b{{font-size:26px;display:block}}
.bd{{display:inline-block;border-radius:10px;padding:1px 10px;font-size:12px;font-weight:700;color:#111}} .bd.c{{background:#7ad39a}} .bd.t{{background:#f0c95a}} .bd.r{{background:#ef7a7a}}
table{{border-collapse:collapse}} td,th{{border:1px solid #3a3848;padding:4px 10px;text-align:right}} td:first-child,th:first-child{{text-align:left}} td.n{{text-align:left;color:#b7b2c8;font-size:12px}} tr.tot td{{font-weight:700;background:#262533}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(560px,1fr));gap:14px}}
.card{{background:#262533;border-radius:8px;padding:10px 12px}} .hd i{{color:#9a95ad;font-style:normal;margin:0 6px;font-size:12px}} .meta{{font-size:11px;color:#9a95ad;margin:2px 0 6px}}
.pair{{display:flex;gap:24px;align-items:flex-start}} .pair small{{display:block;font-size:11px;color:#9a95ad;margin:4px 0 2px}} .why{{margin:8px 0 0;font-size:13px}}
.kx{{display:inline-block;margin:0 14px 10px 0}} .kx small{{display:block;color:#9a95ad}} .kx img{{margin-right:6px}}
.fix td{{font-size:12px;text-align:left}} code{{background:#111;padding:0 4px;border-radius:3px}}
</style>
<h1>modern3 자동 재채색 시험 <small style="color:#9a95ad;font-weight:400">— 표 적용만으로 어디까지 되는가</small></h1>
<p>각 쌍의 왼쪽이 이전(원본 후보), 오른쪽이 <code>remap_modern3.py</code> 결과. 판정은 면 단계(윗면 +2·앞면 0·슬래브 밑 −2·옆면 −2)와 축척표(히어로 16×24·문 16×28·층 32px·차 56×24)로 적대적으로 봤다. 17개 전부 modern3 밖 색 0·반투명 0·마커 0.</p>
<div class="sum"><div><b style="color:#7ad39a">{cnt[COLOR]}</b>색만 바꾸면 됨</div><div><b style="color:#f0c95a">{cnt[TOUCH]}</b>손질 조금</div><div><b style="color:#ef7a7a">{cnt[REDO]}</b>다시 그려야 함</div><div><b>{sum(cnt.values())}</b>시험 총계</div></div>
<h2>전체(일본 58 + 킷 10, 학원 68, 강남 67 = 203) 적용 시 추정</h2>
<table><tr><th>묶음</th><th>색만</th><th>손질</th><th>다시</th><th>근거</th></tr>{est_rows}</table>
<p style="font-size:12px;color:#b7b2c8">추정은 표본 17개에서의 외삽이다. 학원은 표본이 넓지만 일본 조각은 표본이 0이라 신뢰도가 낮다.</p>
<h2>표에서 고칠 색</h2>
<table class="fix"><tr><th>원색</th><th>현재 대응</th><th>문제·제안</th></tr>
<tr><td>#ec9900 (주황)</td><td>flat → #c7a51c (kii, 노랑)</td><td>ramp 경로에선 daidai2 로 가고 flat 경로에선 노랑으로 감 → flat 도 daidai2 로</td></tr>
<tr><td>#d6d8d5 (밝은 회)</td><td>garasu5 #9eb0e0</td><td>회색이 유리로 감(창틀 하이라이트) → conc 또는 shiro 상단</td></tr>
<tr><td>#9cc6cc · #a7d4db (청록 유리)</td><td>garasu4/5 #9eb0e0 (약함)</td><td>청록이 청보라로 바뀜. 학원 유리를 청록으로 두려면 garasu 위에 청록 단 필요, 아니면 이대로 수용</td></tr>
<tr><td>#071528 (짙은 남색)</td><td>yoru0 #100a1a</td><td>푸른 기가 사라짐 → garasu0 #1b2138 또는 kon0</td></tr>
<tr><td>#8abae4 · #a0c4f0 (하늘)</td><td>sora3 / kon4 #7b9cf7 (약함)</td><td>명도 부족, sora 4단 상단 확인</td></tr>
<tr><td>#b6b6b0 · #dee0dd · #b9bbb8 · #4e5053 · #56585a · #3c3e41 (무채 회색)</td><td>conc 단(청보라 기)</td><td>애매 6색 전부 conc 로 몰려 무채 돌이 청보라가 됨. 규격 의도(차가운 청보라 회색)라면 그대로, 아니면 별도 무채 램프 필요</td></tr>
<tr><td>바닥 그림자 <code>~ -</code> (빈 칸 위)</td><td>버림</td><td>표가 아니라 도구 문제: <code>--floor RAMP:STEP</code> 옵션(바닥 −2, 가장자리 −1) 추가 필요</td></tr></table>
<h2>일본 킷 k2-A — 합성 6종 이전 / modern3</h2>
{kit}
<h2>개별 결과</h2>
<div class="grid">{"".join(cards)}</div></html>'''
os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, 'w', encoding='utf-8').write(html)
print(OUT, len(html)//1024, 'KB', cnt, tot)
