import io,base64,json,html as H
from PIL import Image
def u(im,S=1):
    im=im.convert('RGBA')
    if S!=1: im=im.resize((int(im.width*S),int(im.height*S)),Image.NEAREST if S>=1 else Image.LANCZOS)
    b=io.BytesIO(); im.save(b,'PNG',optimize=True); return 'data:image/png;base64,'+base64.b64encode(b.getvalue()).decode()
def G(p): return '<img src="data:image/gif;base64,'+base64.b64encode(open(p,'rb').read()).decode()+'">'
v4=Image.open('/tmp/j8city6/city4.png'); v5=Image.open('/tmp/j8city6/city6.png')
st=json.load(open('/tmp/j8city6/city6_stats.json')); meta=json.load(open('/home/main/claude-viz/city-beodeul-v5-meta.json'))
kits=json.load(open('/tmp/j8city6/city6_kits.json'))
FOUND={'00':['해자가 한 줄로 좁아 보임','성벽길 경비병이 성벽 그림에 가려 안 보임','성벽과 바위 사이 1칸 띠가 광장으로 칠해짐(사람이 끼어 섬)','바위 위 왕궁 옆 땅이 포장 안 됨','성벽 오르는 돌계단이 판석에 묻혀 안 읽힘'],
 '02':['저택 마구간이 그냥 집처럼 읽힘'],'03':['대성당이 사라짐 — 수도교와 자리가 겹쳐 배치 실패','수도교 서쪽 끝이 허공에서 끊김'],
 '10':['마을 대장간 지붕이 청회 슬레이트로 남음 + 성 대장간과 이름 충돌'],
 '12':['포룸 소품 밑이 잔디로 비침','카페 파라솔 2개 빠짐','카페 화분 상자 빠짐'],
 '20':['사이프러스가 한곳에 몰려 숲처럼 뭉침','서쪽 성벽이 절벽에서 끊긴 자리에 남색 사각 (v4부터)'],
 '30':['연못이 각짐 (v4부터)'],'31':['호수 어귀에 큰 다리 두 개가 붙어 붐빔'],
 '32':['큰 배 돛이 부두 위로 겹침 (v4부터)','배 둘레 물결 고리가 후광처럼 둥글게 뜸']}
LEFT={'02':['작은 마구간(3칸)은 칸이 좁아 반문 2칸 + 말 머리 1로도 집에 가깝게 보임','수도교 서쪽 끝 물받이 분수는 거리 줄과 겹쳐 못 놓음 — 성문 길 옆에서 끝남'],
 '20':['사이프러스 뭉침 (숲 한 덩어리로 받아들임)','서쪽 성벽 끊긴 자리 남색 사각 (지형 — 남김)'],'30':['연못 각짐 (지형 — 남김)'],'31':['어귀의 다리 두 개 (산책로 연결에 필요해 남김)']}
GLOBAL=[('연기가 흐려 나무 위에서 안 보임','불투명도·크기 올림, 짙은 연기 색 재조정 — 고침'),('걸을 수 있는데 길망에서 떨어진 칸 12칸(저택 일꾼 마당, 카페 테라스 안쪽)','우물·장작·메뉴판 자리를 옮김 → 0칸 — 고침')]
nb=sum(len(v) for v in FOUND.values())+len(GLOBAL); na=sum(len(v) for v in LEFT.values())
rows=''
for j in range(4):
    for i in range(4):
        k=f'{j}{i}'; b=v4.crop((i*400,j*400,i*400+400,j*400+400)); a=v5.crop((i*400,j*400,i*400+400,j*400+400))
        bl=''.join(f'<li>{H.escape(t)}</li>' for t in FOUND.get(k,[])) or '<li>없음</li>'; al=''.join(f'<li>{H.escape(t)}</li>' for t in LEFT.get(k,[])) or '<li>없음</li>'
        rows+=f'''<h3>구역 {j+1}-{i+1} (칸 x {i*25}–{i*25+24}, y {j*25}–{j*25+24}) — 찾은 결함 {len(FOUND.get(k,[]))} → 남은 {len(LEFT.get(k,[]))}</h3>
<div class=row><div><div class=lab>v4</div><img src="{u(b,1.5)}"></div><div><div class="lab ok">v5</div><img src="{u(a,1.5)}"></div><div><p><b>v5 첫 판에서 찾은 것</b></p><ul class=bad>{bl}</ul><p><b>남은 것</b></p><ul class=good>{al}</ul></div></div>'''
tbl='<table><tr><th>구역</th>'+''.join(f'<th>{i+1}</th>' for i in range(4))+'</tr>'+''.join('<tr><th>'+str(j+1)+'</th>'+''.join(f'<td>{len(FOUND.get(f"{j}{i}",[]))} → {len(LEFT.get(f"{j}{i}",[]))}</td>' for i in range(4))+'</tr>' for j in range(4))+'</table>'
def crop(box,S=2): return f'<img src="{u(v5.crop(box),S)}">'
def pair(box,S=2):
    return f'<div class=row><div><div class=lab>v4</div><img src="{u(v4.crop(box),S)}"></div><div><div class="lab ok">v5</div><img src="{u(v5.crop(box),S)}"></div></div>'
def roles(k): return H.escape('\n'.join(kits[k]['roles']))
def ans(k,n=40): return H.escape(json.dumps(kits[k]['answer'][:n],ensure_ascii=False,indent=0))
SEC=[
 ('1. 큰 다리','세로띠 돌다리를 아치 다리로 바꿈: 먼 난간은 난간살 사이로 물이 비치고, 판석 상판 2줄, 가까운 난간, 아치 2개가 뚫린 앞면, 가운데 교각 아래 뾰족한 물가름돌. 양 끝 받침 가로등(밤빛), 가운데 받침 토가 석상, 끝 받침 공 장식. 아치 안은 투명이라 물 애니메이션이 그늘진 채 흘러 지나가고, 물가름돌·교각 발치에 거품이 깜빡이며, 앞면이 물에 흔들려 비친다. 다리 3곳 전부.',['g5_bridge'],[(29*16,28*16,41*16,40*16)]),
 ('2. 신전 마당 바닥','칩셋 광장 타일(흰·회 대비가 큰 무늬)을 빼고 한 톤 회색 판석(행 높이 12~16, 폭 14~26, 결은 드문 점)으로 교체. 성 바깥뜰·항구 광장도 같은 판석.',[],[(80*16,15*16,97*16,24*16)]),
 ('3. 풍차','몸체는 바탕에 두고 날개만 따로 8장면: 한 장면에 11.25°, 8장면에 90°. 날개 4장이 90°마다 같은 모양이라 8→0이 이음매 없이 이어짐.',['g5_mills'],[]),
 ('4. 포룸','시장(11×9칸)을 포룸(20×12칸)으로 넓힘. 바닥은 길과 다른 트래버틴 큰 판석, 분수 둘레만 회색 띠 + 45° 사각 오푸스 섹틸레. 북쪽 가운데 신전 정면(계단 기단, 기둥 넷, 청동 문), 서쪽 주랑(스토아: 기둥 줄 뒤 가게 문), 동쪽 카페, 가운데 큰 분수, 받침돌 위 토가 석상 둘, 서쪽·남쪽 가장자리 노점, 모서리 쌍등, 신전 양옆 깃대.',['g5_forum'],[]),
 ('5. 카페 테라스','포룸 북동 모서리: 반목조 가게 1층에 빨강·크림 줄무늬 차양 + 잔 그림 걸이 간판, 차양 밑 등불 줄(깜빡임). 문 앞 테라스에 나무 탁자 + 쇠 의자 + 흰 잔(받침 접시) 탁자 둘, 초록·빨강 파라솔 탁자 둘, 이젤 메뉴판, 화분 상자. 문 앞 줄은 비워 둠.',[],[(1040,600,1200,760)]),
 ('6. 굴뚝 연기','굴뚝마다 종류·시작 장면·변형을 해시로: 가는 실연기 / 뭉게 연기 / 바람에 눕는 연기 / 대장간·빵집 짙은 연기. 모두 12장면, 알갱이 나이가 1→0으로 돌아가 이음매 없음.',['g5_smoke0','g5_smoke1'],[]),
 ('7. 물','둑 거리로 깊이 색(가운데 짙게, 둑 가까이 밝게), 북쪽 안벽 그늘. 강은 흐름 방향(남·동)으로 4px/장면 물살, 호수·연못·해자는 제자리에서 부풀고 사라지는 잔물결 + 느린 흐름. 반짝임, 안벽 거품, 잔교 다리·교각·물가름돌 거품, 배 둘레 물결 고리, 다리 앞면·배 반사(흔들림), 연못·호수 양끝·해자에 수련과 갈대. 8장면, 물살 주기 32px = 8×4px로 이음매 없음.',['g5_pond','g5_lake','g5_harbour'],[]),
]
sec=''
for t,d,gs,bx in SEC:
    sec+=f'<h2>{t}</h2><p>{H.escape(d)}</p><div class=row>'+''.join(f'<div>{G(f"/tmp/j8city6/{g}.gif")}</div>' for g in gs)+'</div>'+''.join(pair(b) if t.startswith(('1','2')) else f'<div class=row>{crop(b,3)}</div>' for b in bx)
ex=[p for p in meta['props'] if p['id'] in ('bridge_grand','cafe_table','smoke_dark','water_layer')]
excerpt=json.dumps(dict(props=ex,animations=meta['animations'],kits=dict(castle=dict(pieces=meta['kits']['castle']['pieces'][:3],answer=meta['kits']['castle']['answer'][:6],walk_route=meta['kits']['castle']['walk_route'],interior_link=meta['kits']['castle']['interior_link']))),ensure_ascii=False,indent=1)
SK=st['smoke_kinds']
page=f'''<!doctype html><meta charset=utf-8><title>버들항 v5 (로마풍)</title>
<style>body{{background:#1b1c1f;color:#ddd;font-family:sans-serif;margin:16px}}img{{image-rendering:pixelated;max-width:none;display:block}}
p,li{{color:#bbb;line-height:1.55;max-width:1150px}}.s{{overflow:auto;margin:6px 0 16px}}.row{{display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start;margin:6px 0}}
.lab{{display:inline-block;background:#644;color:#fff;padding:1px 8px;font-size:13px;margin:8px 0 3px}}.ok{{background:#375}}.big{{max-height:88vh;overflow:auto;border:1px solid #333}}
table{{border-collapse:collapse;font-size:14px}}td,th{{border:1px solid #333;padding:3px 10px}}pre{{background:#111;color:#cfc;padding:10px;max-height:440px;overflow:auto;font-size:12px;max-width:1150px}}
pre.g{{color:#ddd;line-height:1.05;font-size:12px}} ul.bad li{{color:#e99}} ul.good li{{color:#9d9}} .k{{display:inline-block;background:#264;padding:2px 10px;margin:2px;border-radius:3px}} a{{color:#8cf}}</style>
<h1>버들항 v5 — 로마풍: 포룸 · 큰 다리 · 움직이는 물·연기·풍차 · 왕성 · 귀족 저택</h1>
<p><span class=k>16구역 적대적 QA: 찾은 결함 {nb} → 남은 {na}</span><span class=k>문 {st["doors"]}곳 · 길 안 닿는 문 {st["unreached_after"]}</span><span class=k>걷는 칸 {st["walk_cells"]} · 떨어진 칸 {st["walk_unconnected"]}</span><span class=k>소품 {sum(st["props"].values())}개</span><span class=k>큰 다리 {st["bridges"]}</span><span class=k>연기: 실 {SK.get("wisp",0)} · 뭉게 {SK.get("puffy",0)} · 눕는 {SK.get("drift",0)} · 짙은 {SK.get("dark",0)}</span><span class=k>갈대 {st["reeds"]} · 수련 {st["lilies"]}</span><span class=k>한 바퀴 24장면 × 125ms</span></p>
<p>v4 비교: <a href="city-beodeul-v4.html">city-beodeul-v4.html</a> (그대로 둠). 메타데이터: <a href="city-beodeul-v5-meta.json">city-beodeul-v5-meta.json</a></p>
<h2>전체 (절반 크기, 0장면)</h2><div class=s><img src="{u(v5,0.5)}" style="image-rendering:auto"></div>
{sec}
<h2>8. 왕성 지구 (조각 → 조립)</h2>
<p>북서 언덕 전체. 바위(3층) 위 안뜰: 둥근 탑 + 좌우대칭 왕궁(문 가운데, 왕실 걸개) + 첨탑 예배당, 산울타리·원뿔 정원수·작은 분수·자갈길. 폭 4칸 큰 계단으로 바깥뜰(2층)로 내려가면 병영·마구간(말 머리)·대장간(짙은 연기)·우물·건초·여물통·과녁·무기 거치대·기사 석상·깃대. 남쪽 성벽(성벽길 + 여장 + 화살 구멍) 가운데 성문루(탑 둘, 쇠창살 반쯤, 걸개), 모서리 둥근 탑 둘, 동쪽 성벽길 + 네모 탑. 성문 앞 3줄 해자(수련·갈대) 위 도개교 → 남쪽 길 → 계단으로 가운데 마을.</p>
<div class=s><img src="{u(Image.open('/tmp/j8city6/z5_castle.png'))}"></div>
<div class=row><div>{G('/tmp/j8city6/g5_castle.gif')}</div></div>
<div class=row><div><p>조립 결과 (2배)</p>{crop((0,0,544,432),2)}</div></div>
<div class=row><div><p>역할 격자 (x 0–32, y 0–26) — P 광장·W 성벽길·G 성문 통로·B 도개교·S 계단·D 문·~ 해자·# 막힘</p><pre class=g>{roles('castle')}</pre></div><div><p>조립 정답 배열 (발췌)</p><pre>{ans('castle')}</pre></div></div>
<h2>8. 귀족 저택 (조각 → 조립)</h2>
<p>북쪽 언덕, 낮은 돌담으로 두른 구역. 남쪽 가운데 정문(항아리 얹은 돌기둥 + 열린 철문)과 문지기 집. 중앙 3층 7칸 + 2층 날개 3칸씩 = 13칸 좌우대칭 저택(테라코타 모임지붕, 굴뚝 둘), 가운데 박공·기둥 넷 주랑 현관과 계단. 앞은 자갈 정원: 문에서 정문까지 축 길, 산울타리 화단, 원뿔 정원수, 큰 분수, 받침돌 석상 둘, 담 안쪽 사이프러스. 동쪽 텃밭 + 작은 마구간 + 마차, 서쪽 일꾼 마당(우물·장작·술통).</p>
<div class=s><img src="{u(Image.open('/tmp/j8city6/z5_estate.png'))}"></div>
<div class=row><div>{G('/tmp/j8city6/g5_estate.gif')}</div><div><p>조립 결과 (2배)</p>{crop((576,32,896,384),2)}</div></div>
<div class=row><div><p>역할 격자 (x 36–55, y 2–22)</p><pre class=g>{roles('estate')}</pre></div><div><p>조립 정답 배열</p><pre>{ans('estate')}</pre></div></div>
<h2>9. 16구역 적대적 QA (v4 ↔ v5)</h2>
<p>v5 첫 판을 16구역으로 잘라 한 칸씩 흠을 찾아 적고, 고친 뒤 다시 16구역을 열어 확인. 자동 점검: 모든 문에서 길망까지 BFS, 걷는 칸 전체의 연결 성분.</p>{tbl}
<ul class=bad>{''.join(f'<li>(전체) {H.escape(a)} — {H.escape(b)}</li>' for a,b in GLOBAL)}</ul>
{rows}
<h2>새 소품 도감</h2><div class=s><img src="{u(Image.open('/tmp/j8city6/z5_props.png'))}"></div>
<h2>바닥·지붕</h2><div class=s><img src="{u(Image.open('/tmp/j8city6/z5_tex.png'))}"></div>
<h2>애니메이션 장면</h2><div class=s><img src="{u(Image.open('/tmp/j8city6/z5_anim.png'))}"></div>
<h2>원래 크기</h2><div class="s big"><img src="{u(v5)}"></div>
<h2>AI 배치용 메타데이터 (발췌)</h2><p>전체 {len(meta["props"])}항목(v4 소품 + 새 로마풍 {sum(1 for p in meta["props"] if p.get("status")=="v5")}) + 조립 세트 3(왕성·저택·포룸: 조각·정답 배열·역할 격자·걷는 길·실내 연결) + 애니메이션 표 + 도시 정답 배열 {len(meta["city_placements"])}건.</p><pre>{H.escape(excerpt)}</pre>'''
open('/home/main/claude-viz/city-beodeul-v5.html','w').write(page)
print(len(page)//1024,'KB',nb,na)
