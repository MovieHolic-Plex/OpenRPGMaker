import io,base64,json,html as H
from PIL import Image
def u(im,S=1):
    im=im.convert('RGBA')
    if S!=1: im=im.resize((int(im.width*S),int(im.height*S)),Image.NEAREST if S>=1 else Image.LANCZOS)
    b=io.BytesIO(); im.save(b,'PNG',optimize=True); return 'data:image/png;base64,'+base64.b64encode(b.getvalue()).decode()
def G(p): return '<img src="data:image/gif;base64,'+base64.b64encode(open(p,'rb').read()).decode()+'">'
v3=Image.open('/tmp/j8city/v3_final.png'); v4=Image.open('/tmp/j8city/city4.png')
st=json.load(open('/tmp/j8city/city4_stats.json')); meta=json.load(open('/tmp/j8city/meta.json'))
BEFORE={
'00':['잔디가 한 종류','가면 벽샘 — 무엇인지 안 읽힘','가로수 화분이 집 앞벽에 붙음','성 앞마당 소품 과밀','계단 꼭대기 양옆 잔디 턱','목적 없는 빨래 건조대','가게 없는 길가 입간판'],
'01':['잔디가 한 종류','같은 덤불이 한 줄로 찍힘','집과 무관한 잔디 위 빨래 건조대'],
'02':['잔디가 한 종류','성문 통로를 가로수 화분이 막음','길이 잔디에서 뚝 끊김','파란 지붕 정자 — 정체 불명, 그림자 덩어리','벤치 그림자 과함','같은 나무가 줄지어 찍힘','2칸 절벽 조각이 갈색 구멍처럼 보임'],
'03':['잔디가 한 종류','종 기둥 — 의미 불명','새 물확 — 의미 불명','잔디에 흩어진 빨래 건조대 2','막다른 길 조각 2'],
'10':['잔디가 한 종류','목적 없는 산울타리·꽃상자','가면 벽샘','가로등 둘이 붙어 섬(옛 등롱+새 가로등)','성벽에서 끊긴 길'],
'11':['다리가 세로 띠로 깔림','길 가장자리 빨래 건조대','광고 기둥 — 의미 불명','밭 안에 가로등·벤치가 겹침','잔디가 한 종류'],
'12':['잔디가 한 종류','형틀 — 의미 불명','흉상 받침 — 의미 불명','종 기둥 — 의미 불명','광고 기둥 2','쇠사슬 말뚝 — 의미 불명','시장 과밀'],
'13':['잔디가 한 종류','가로등 둘이 붙어 섬','같은 덤불 줄','막다른 길 조각'],
'20':['잔디가 한 종류','가로등 둘이 붙어 섬','가면 벽샘','목적 없는 빨래 건조대 2','길가 잔디에 벤치·가로등·화분이 줄로 찍힘','성벽에서 끊긴 길 2','편자 판 — 의미 불명'],
'21':['잔디가 한 종류','덤불 속 분수 + 빨래 건조대 겹침','목적 없는 꽃상자','산울타리·화분 줄 찍힘','막다른 길'],
'22':['잔디가 한 종류','통발 더미 — 격자 덩어리로 읽힘','광장 밖 잔디의 생선 궤짝','막다른 길 조각'],
'23':['잔디가 한 종류','길가 잔디 소품 줄 찍힘','막다른 길 조각','같은 덤불 줄'],
'30':['잔디가 한 종류','산책로에 잔디 구멍(소품 밑 길이 지워짐)','목적 없는 빨래 건조대','통발 더미','가로등 둘이 붙어 섬','길이 조각조각 끊김','연못이 각짐'],
'31':['잔디가 한 종류','산책로 잔디 구멍','통발 더미','다리가 세로 판처럼 읽힘','기중기 받침이 잔디 위'],
'32':['잔디가 한 종류','산책로 잔디 구멍','다리가 세로 판처럼 읽힘','그물 건조대가 잔디 구멍 위','큰 배 돛이 부두 위로 겹침'],
'33':['잔디가 한 종류','산책로 잔디 구멍','생선 궤짝이 잔디 구멍 위','목적 없는 벤치']}
AFTER={'00':['계단 꼭대기 양옆 잔디 턱 (고원 가장자리 칸, 지형 — 남김)'],'02':['2칸 절벽 조각이 갈색 사각형 (지형 배치 — 남김)'],
'12':['깃대 두 개가 광장 북쪽 길 가장자리에 섬 (통행은 됨)'],'22':['항구 광장이 여전히 빽빽 (v2 생선 건조대 2 + 노점 3)'],
'23':['우물 쉼터에 벤치 자리 없음 → 벤치 빠짐'],'30':['연못 모양이 각짐 (지형 — 남김)'],'32':['큰 배 돛이 부두 줄 위로 겹침 (v2부터, 남김)']}
FIX=[('그림자','작은 소품은 던지는 그림자를 없앴고(높이 40px 이상인 집·나무·기둥만), 모든 소품의 발밑 접지 그림자를 알파 100→42, 크기 80%로 줄임.'),
('정자','파란 지붕 정자를 빼고, 예전에 통과한 지붕 우물 + 산울타리 + 꽃밭으로 된 “우물 쉼터”로 바꿈 — 길에서 바로 물 길으러 오는 자리.'),
('다리','세로(남북) 띠로 깔리던 다리를 동서 돌다리로 새로 그림: 북쪽 난간 윗면, 자갈 상판 2줄, 남쪽 난간, 아치 4개가 뚫린 두꺼운 앞면, 물 위 그림자. 다리 2곳 모두 교체.'),
('의미 불명 소품','v3 소품 12종 삭제(감은 밧줄·통발·부표·편자 판·쇠사슬 말뚝·가면 벽샘·천 짐더미·노 거치대·광고 기둥·정자·천막·양탄자 노점), v2 소품 5종 삭제(형틀·종 기둥 2·흉상·술통 받침·새 물확), 옛 나무 등롱 전부 삭제. 남은 소품은 모두 “주인”이 있음: 가게 간판 옆 같은 업종 물건, 광장·부두·계단·큰길.'),
('잔디','칩셋 풀 5종(기본·밝은 풀밭·나무 밑 짙은 풀·들꽃 풀·길가 닳은 풀)을 덩어리 노이즈로 섞음. 짙은 풀은 나무 둘레에, 닳은 풀은 연석 바깥 띠에. 경계는 픽셀 단위 디더, 칸 단위 점찍기 없음.'),
('끊긴 길',f'길 감사: 막다른 끝은 곧게 5칸 안에 다른 길이 있으면 잇고, 없으면 마지막 갈림길·집 문까지 잘라냄. 2칸 폭 길 끝·옆으로 튀어나온 1~2칸 혹도 정리. 성문 통로를 첫 길까지 이음. 결과: 이음 {st["roads"]["extended"]}곳, 잘라낸 칸 {st["roads"]["pruned_cells"]}(혹 {st["roads"].get("bulges",0)}), 떨어진 조각 {st["roads"]["islands_removed"]}칸 제거. 소품 밑 길이 지워지던 버그(v3) 수정 — 소품이 서도 자갈은 그대로.')]
nb=sum(len(v) for v in BEFORE.values()); na=sum(len(v) for v in AFTER.values())
rows=''
for j in range(4):
    for i in range(4):
        k=f'{j}{i}'; b=v3.crop((i*400,j*400,i*400+400,j*400+400)); a=v4.crop((i*400,j*400,i*400+400,j*400+400))
        bl=''.join(f'<li>{H.escape(t)}</li>' for t in BEFORE[k]); al=''.join(f'<li>{H.escape(t)}</li>' for t in AFTER.get(k,[])) or '<li>없음</li>'
        rows+=f'''<h3>구역 {j+1}-{i+1} (칸 x {i*25}–{i*25+24}, y {j*25}–{j*25+24}) — 결함 {len(BEFORE[k])} → {len(AFTER.get(k,[]))}</h3>
<div class=row><div><div class=lab>v3</div><img src="{u(b,2)}"><ul class=bad>{bl}</ul></div><div><div class="lab ok">v4</div><img src="{u(a,2)}"><ul class=good>{al}</ul></div></div>'''
tbl='<table><tr><th>구역</th>'+''.join(f'<th>{i+1}</th>' for i in range(4))+'</tr>'+''.join('<tr><th>'+str(j+1)+'</th>'+''.join(f'<td>{len(BEFORE[f"{j}{i}"])} → {len(AFTER.get(f"{j}{i}",[]))}</td>' for i in range(4))+'</tr>' for j in range(4))+'</table>'
def pair(box,S=3):
    b=v3.crop(box); a=v4.crop(box)
    return f'<div class=row><div><div class=lab>v3</div><img src="{u(b,S)}"></div><div><div class="lab ok">v4</div><img src="{u(a,S)}"></div></div>'
ex=[p for p in meta['props'] if p['id'] in ('bridge_ew','grass_shade','bench_wood')]
excerpt=json.dumps(dict(props=ex,dropped_since_v3=meta['dropped_since_v3'],city_placements=meta['city_placements'][:6]),ensure_ascii=False,indent=1)
page=f'''<!doctype html><meta charset=utf-8><title>버들항 v4</title>
<style>body{{background:#1b1c1f;color:#ddd;font-family:sans-serif;margin:16px}}img{{image-rendering:pixelated;max-width:none;display:block}}
p,li{{color:#bbb;line-height:1.5;max-width:1150px}}.s{{overflow:auto;margin:6px 0 16px}}.row{{display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start}}
.lab{{display:inline-block;background:#644;color:#fff;padding:1px 8px;font-size:13px;margin:8px 0 3px}}.ok{{background:#375}}.big{{max-height:88vh;overflow:auto;border:1px solid #333}}
table{{border-collapse:collapse;font-size:14px}}td,th{{border:1px solid #333;padding:3px 10px}}pre{{background:#111;color:#cfc;padding:10px;max-height:420px;overflow:auto;font-size:12px;max-width:1150px}}
ul.bad li{{color:#e99}} ul.good li{{color:#9d9}} .k{{display:inline-block;background:#264;padding:2px 10px;margin:2px;border-radius:3px}} a{{color:#8cf}}</style>
<h1>버들항 v4 — 그림자 · 다리 · 잔디 · 끊긴 길 · 의미 없는 소품 정리</h1>
<p><span class=k>16구역 적대적 QA 결함 {nb} → {na}</span><span class=k>문 {st["doors"]}곳 · 길 안 닿는 문 {st["unreached_after"]}</span><span class=k>소품 {sum(st["props"].values())}개 · {len(st["props"])}종</span><span class=k>다리 {st["bridges"]}곳 교체</span></p>
<p>v3 비교: <a href="city-beodeul-v3.html">city-beodeul-v3.html</a> (그대로 둠). 메타데이터: <a href="city-beodeul-v4-meta.json">city-beodeul-v4-meta.json</a></p>
<h2>무엇을 고쳤나</h2><ul>{''.join(f'<li><b>{H.escape(a)}</b>: {H.escape(b)}</li>' for a,b in FIX)}</ul>
<h2>구역별 결함 수 (v3 → v4)</h2>{tbl}
<h2>짚어 본 자리 (3배)</h2>
<div class=lab>다리 (x 33, y 33)</div>{pair((29*16,30*16,41*16,38*16))}
<div class=lab>신전 마당 — 벤치 그림자</div>{pair((80*16,15*16,97*16,24*16))}
<div class=lab>잔디와 길가 — 한 종류 잔디 → 다섯 종류</div>{pair((0*16,40*16,20*16,52*16),2)}
<h2>땅 섞기</h2><div class=s><img src="{u(Image.open('/tmp/j8city/z4_ground.png'))}"></div>
<h2>움직임</h2><div class=row><div>{G('/tmp/j8city/g4_market.gif')}<p>시장 광장</p></div><div>{G('/tmp/j8city/g4_harbour.gif')}<p>항구</p></div></div>
<h2>16구역 전후 (QA는 3배로 열어 봄, 여기는 2배)</h2>{rows}
<h2>전체 (절반)</h2><div class=s><img src="{u(v4,0.5)}" style="image-rendering:auto"></div>
<h2>원래 크기</h2><div class="s big"><img src="{u(v4)}"></div>
<h2>소품 도감 v4</h2><div class=s><img src="{u(Image.open('/tmp/j8city/z4_catalogue.png'))}"></div>
<h2>AI 배치용 메타데이터 (발췌)</h2><p>전체 {len(meta["props"])}항목(소품 + 다리 + 땅 5종) + 도시 정답 배열 {len(meta["city_placements"])}건, v3 이후 뺀 id 목록과 이유 포함.</p><pre>{H.escape(excerpt)}</pre>'''
open('/home/main/claude-viz/city-beodeul-v4.html','w').write(page)
import shutil; shutil.copy('/tmp/j8city/meta.json','/home/main/claude-viz/city-beodeul-v4-meta.json')
print(len(page)//1024,'KB',nb,na)
