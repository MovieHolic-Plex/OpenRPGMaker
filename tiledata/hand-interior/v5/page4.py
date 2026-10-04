# page: ~/claude-viz/interior-v4.html (self-contained; animated lossless WebP as data URIs)
import sys, os, io, json, base64, shutil; sys.path.insert(0,'tiledata/hand-interior/v5')
import rooms4, room4, anim4, kit4, meta4
import anim as A
from kit4 import OBJ, assemble, STY, PIECES
from PIL import Image, ImageDraw
VIZ=os.path.expanduser('~/claude-viz')
def u(im):
    b=io.BytesIO(); im.save(b,'PNG'); return 'data:image/png;base64,'+base64.b64encode(b.getvalue()).decode()
def uw(frames,ms,scale=1,bg=None):
    fr=[]
    for f in frames:
        if bg:
            b=Image.new('RGBA',f.size,bg+(255,)); b.alpha_composite(f); f=b
        fr.append(f.resize((f.width*scale,f.height*scale),Image.NEAREST).convert('RGB'))
    b=io.BytesIO(); fr[0].save(b,'WEBP',save_all=True,append_images=fr[1:],duration=ms,loop=0,lossless=True)
    return 'data:image/webp;base64,'+base64.b64encode(b.getvalue()).decode()
def sc(im,k): return im.resize((im.width*k,im.height*k),Image.NEAREST)
def card(items,bg=(96,78,60),pad=6,k=4,labels=None):
    W=sum(i.width+pad for i in items)+pad; Hh=max(i.height for i in items)+2*pad
    im=Image.new('RGBA',(W,Hh),bg+(255,)); x=pad
    for i in items: im.alpha_composite(i,(x,Hh-pad-i.height)); x+=i.width+pad
    return sc(im,k)
MAPS=list(rooms4.all_maps()); CHK={m['key']:room4.check(m) for _,_,m in MAPS}
FR={}
for k,b,m in MAPS: FR[m['key']]=[room4.compose(m,t) for t in range(anim4.N)]
def overlay(key):
    m=[mm for _,_,mm in MAPS if mm['key']==key][0]; base=FR[key][0].copy(); r=CHK[key]
    ov=Image.new('RGBA',base.size); d=ImageDraw.Draw(ov)
    col={'c':(0,220,255,120),'u':(80,255,80,90),'D':(255,220,0,150),'S':(255,120,255,140),',':(255,0,80,160),'X':None}
    for y,row in enumerate(r['grid']):
        for x,ch in enumerate(row):
            c=col.get(ch)
            if c: d.rectangle((x*16+1,y*16+1,x*16+14,y*16+14),fill=c)
            if ch=='X': d.rectangle((x*16+1,y*16+1,x*16+14,y*16+14),outline=(255,60,60,200))
    base.alpha_composite(ov); return base
def crop(im,x0,y0,x1,y1): return im.crop((x0*16,y0*16,(x1+1)*16,(y1+1)*16))
BEF=lambda k: Image.open(f'tiledata/hand-interior/v5/before/v3_{k}.png').convert('RGBA')
AFT=lambda k: FR[k][0]
def pair(b,a,k=2,note_b='v3',note_a='v4'):
    return f'<div class=pair><figure><img src="{u(sc(b,k))}"><figcaption>{note_b}</figcaption></figure><figure><img src="{u(sc(a,k))}"><figcaption>{note_a}</figcaption></figure></div>'
H=[]
H.append('''<!doctype html><meta charset=utf-8><title>실내 v4 — 13가지 지적 반영</title><style>
body{background:#16161a;color:#ddd;font:14px/1.6 system-ui,sans-serif;margin:24px;max-width:1900px}
img{image-rendering:pixelated;display:block}h2{margin-top:40px;border-top:1px solid #333;padding-top:16px}h3{margin:18px 0 4px}
.pair,.row{display:flex;gap:18px;flex-wrap:wrap;align-items:flex-end}figure{margin:6px 0}figcaption{color:#aaa;font-size:12px}
table{border-collapse:collapse;font-size:13px}td,th{border:1px solid #333;padding:4px 8px;text-align:left}.ok{color:#7f7}.bad{color:#f77}
pre{background:#22222a;padding:10px;overflow:auto;max-height:460px;font-size:12px}a{color:#9cf}.note{color:#bbb;max-width:1100px}</style>''')
okn=sum(1 for v in CHK.values() if v['ok'])
H.append(f'''<h1>실내 v4 — 13가지 지적을 모두 고친 판</h1><p class=note>건물 10곳(저택은 1층·2층 두 장) = 맵 {len(MAPS)}장. 통행 검사 {okn}/{len(MAPS)} 통과.
모든 식탁·책상·진열 탁자·작업대·카운터는 자동 타일 조각으로 조립했고, 움직이는 것은 12프레임 주기 함수라 이음매가 없다.
데이터: <a href="interior-meta.json">interior-meta.json</a> · <a href="interior-atlas.png">interior-atlas.png</a></p>''')
# ---- rooms
H.append('<h2>방 전체 (2배, 움직임)</h2>')
for k,b,m in MAPS:
    if k=='manor': continue
    r=CHK[m['key']]
    H.append(f'<h3>{b["name"]}</h3><p class=note>통행 검사 <b class={"ok" if r["ok"] else "bad"}>{"통과" if r["ok"] else "실패"}</b> · 방 {sum(x["reached"] for x in r["rooms"])}/{len(r["rooms"])} · 사용 칸 {r["usesOk"]}/{r["usesTotal"]}</p><img src="{uw(FR[m["key"]],anim4.MS,2)}">')
H.append(f'<h2>저택 — 1층과 2층 (계단 같은 x,y = (11,3))</h2><p class=note>{rooms4.B["manor"]["name"]}. 부엌 문과 식당 문이 뒤 복도를 사이에 두고 한 줄 — 하인 동선. 안방은 안방 거실을 거쳐서만 들어간다.</p><div class=row>')
for m in rooms4.B['manor']['maps']:
    H.append(f'<figure><img src="{uw(FR[m["key"]],anim4.MS,2)}"><figcaption>{m["name"]}</figcaption></figure>')
H.append('</div>')
# ---- before / after
H.append('<h2>지적 13가지 — 전(v3) / 후(v4)</h2>')
def old(n): f=kit4.OLD[n](); return f.im
# 1 oven room
H.append('<h3>1. 빵 굽는 방: 불 옆 나무 바닥 → 돌 벽·돌 바닥 (칸막이 뒤 방 단위로만 재질 변경)</h3>'+pair(crop(BEF('bakery'),0,0,9,6),crop(AFT('bakery'),0,0,9,6)))
# 2 firewood
fw_old=old('firewood pile'); fw=[OBJ[n][1]().im for n in ('firewood rack','firewood rack 2w','firewood bundle')]
H.append('<h3>2. 장작: 고정 시점에 맞춰 다시 그림 — 남북으로 눕힌 장작의 둥근 단면이 정면에 보이는 1×2 선반 (8배)</h3>'+pair(card([fw_old],k=8),card(fw,k=8),1,'v3 장작더미','v4 장작 선반 1칸·2칸, 바닥 장작 묶음'))
# 3 passage
H.append('<h3>3. 통행 보장: 출입구에서 BFS — 모든 방과 모든 가구의 사용 칸에 닿는지, 문·통로 칸이 비었는지 자동 검사</h3><p class=note>하늘색 = 비워 둘 칸(문·통로), 초록 = 사용 칸, 노랑 = 출입구, 분홍 = 계단, 빨간 테두리 = 가구. v3 빵집은 의자가 통로를 막았다.</p>'
         +pair(crop(BEF('bakery'),8,6,19,13),overlay('bakery'),2,'v3 빵집 (의자가 길을 막음)','v4 빵집 통행 검사 오버레이'))
# 4 autotile
H.append('<h3>4. 탁자·책상·카운터 = 자동 타일 조각 조립. 빵·상품·지구의는 가구 위에</h3>'+pair(crop(BEF('bakery'),1,9,9,12),crop(AFT('bakery'),1,9,14,12),2,'v3: 바구니·빵이 바닥에','v4: 진열 탁자와 카운터 위에'))
H.append(pair(crop(BEF('library'),5,5,11,11),crop(AFT('scholar'),12,1,16,5),2,'v3: 지구의가 바닥에','v4: 지구의·촛대·깃펜이 책상 위에'))
# 5 kitchens
H.append('<h3>5. 부엌: 흰 타일 바닥·타일 벽, 조리 화덕(레인지) 위 끓는 냄비(움직임), 조리대</h3>'+
         f'<div class=pair><figure><img src="{u(sc(crop(BEF("tavern"),0,0,8,6),2))}"><figcaption>v3 선술집 부엌</figcaption></figure><figure><img src="{uw([crop(f,0,0,7,6) for f in FR["tavern"]],anim4.MS,2)}"><figcaption>v4 선술집 부엌</figcaption></figure><figure><img src="{uw([crop(f,15,0,24,6) for f in FR["manor_1f"]],anim4.MS,2)}"><figcaption>v4 저택 부엌</figcaption></figure></div>')
# 6 animation
old_tank=A.a_tank(); new_tank=OBJ['fish tank'][1]()
H.append(f'<h3>6. 이음매 없는 반복: 수조 v3 4프레임(마지막→첫 프레임이 튄다) → v4 12프레임 주기 운동</h3><div class=pair><figure><img src="{uw(old_tank.frames,180,5,(58,48,40))}"><figcaption>v3 (4프레임, 180ms)</figcaption></figure><figure><img src="{uw(new_tank.frames,anim4.MS,5,(58,48,40))}"><figcaption>v4 (12프레임, 100ms) — 물고기 가로질러 감아 돌기, 거품 계속 오름, 수초 흔들림</figcaption></figure></div>')
# 7 size
H.append('<h3>7. 크기: 창고는 좁게, 남는 바닥은 줄였다</h3>'+pair(crop(BEF('bakery'),10,0,19,6),crop(AFT('bakery'),9,0,15,6),2,'v3 빵집 창고 (9칸 폭, 빈 바닥)','v4 밀가루 창고 (5칸)'))
# 8 bakery flow
H.append('<h3>8. 빵집 흐름: 문 → 벽 빵 선반·진열 탁자에서 고르기 → 문 옆 카운터에서 계산. 주인은 굽는 방 문으로</h3>'+pair(BEF('bakery'),AFT('bakery'),2))
# 9 smithy
H.append('<h3>9. 대장간: 화로-모루-담금 통 삼각형을 세 걸음 안에, 흙바닥 + 화로 앞 그을린 판석</h3>'+pair(BEF('smithy'),AFT('smithy'),2))
# 10 chapel
H.append('<h3>10. 예배당: 창은 좌우 대칭·같은 간격, 제단 뒤 가운데 큰 창, 깃발·오르간과 겹침 없음</h3>'+pair(BEF('chapel'),AFT('chapel'),2))
# 11 scholar
H.append('<h3>11. 학자의 집: 서재(책상 위 지구의·촛대) · 서고 · 침실 · 작은 부엌</h3>'+pair(BEF('library'),AFT('scholar'),2))
# 12 manor
H.append('<h3>12. 저택: 한 층 → 두 층(계단 정렬), 복도, 방 13개</h3>'+pair(BEF('manor'),Image.open('tiledata/hand-interior/v5/v4_manor_1f.png').convert('RGBA'),1,'v3 저택','v4 1층 (2층은 위 참고)'))
H.append('''<h3>13. 전반</h3><ul class=note><li>물건마다 사람이 어떻게 쓰는지로 자리를 정했다: 주인은 뒷문으로 카운터 뒤, 손님은 앞, 의자는 탁자를 보고 뒤로 걸을 줄을 남김, 침대 양옆 협탁, 벽 가구는 북쪽 벽 앞.</li>
<li>걸이는 벽면 윗줄에만 — 자동 검사가 윗줄이 아니거나 서로/큰 가구와 겹치면 실패로 잡는다.</li>
<li>한 벽에 재질 하나 — 이어진 벽면 줄마다 재질이 둘이면 실패. 빵 굽는 방·부엌·욕실·대장장이 방만 칸막이 뒤에서 바꿨다.</li>
<li>ㅁ자 한 칸 방 없음, 칸막이 규칙(동서 틈=문, 남북 틈=3줄) 유지.</li></ul>''')
# ---- kit
H.append('<h2>새 기물</h2><h3>자동 타일 탁자 — 16조각(이웃 N·E·S·W)으로 어떤 크기든 조립 (4배)</h3>')
for st in STY:
    sizes=[(1,1),(2,1),(4,1)] if kit4.ONE_ROW(st) else [(1,1),(2,1),(3,2),(2,3),(4,2)]
    H.append(f'<figure><img src="{u(card([assemble(st,w,h).im for w,h in sizes],k=3))}"><figcaption>{STY[st]["ko"]} — {", ".join(f"{w}×{h}" for w,h in sizes)}</figcaption></figure>')
P=PIECES['dining']; keys=sorted(P); tiles=[]
g=Image.new('RGBA',(len(keys)*20,20),(40,40,48,255))
for i,kk in enumerate(keys): g.alpha_composite(P[kk],(i*20+2,2))
H.append(f'<figure><img src="{u(sc(g,4))}"><figcaption>식탁 조각 16개: {" ".join(a+b for a,b in keys)} (열 S/L/M/R × 행 S/T/M/B)</figcaption></figure>')
H.append(f'<h3>장작 · 조리 화덕 · 발효 선반 · 빵 선반 · 화덕 삽 · 계단통 · 큰 색유리창 (4배)</h3><div class=row><figure><img src="{uw(OBJ["kitchen range"][1]().frames,anim4.MS,4,(96,78,60))}"><figcaption>조리 화덕(불 문 움직임)</figcaption></figure>'
         f'<figure><img src="{uw(anim4.GA["stewpot"],anim4.MS,8,(60,60,66))}"><figcaption>끓는 냄비 8배</figcaption></figure>'
         f'<figure><img src="{u(card([OBJ[n][1]().im for n in ("firewood rack","firewood rack 2w","firewood bundle","proofing rack","bread shelf","bread shelf baguette","peel rack","coal bin","broom and bucket","towel rail")],k=4))}"><figcaption>장작 선반·묶음, 발효 선반, 빵 선반, 삽 걸이, 숯 통, 빗자루, 수건걸이</figcaption></figure>'
         f'<figure><img src="{u(card([OBJ[n][1]().im for n in ("stairwell down","tall stained window","fur rug")],k=4))}"><figcaption>2층 계단통, 제단 뒤 큰 창, 모피 깔개</figcaption></figure></div>')
H.append(f'<h3>빵 굽는 방 (3배, 움직임)</h3><img src="{uw([crop(f,0,0,9,6) for f in FR["bakery"]],anim4.MS,3)}">')
# ---- animation loop check
H.append('<h2>반복 이음매 검사 — 첫 프레임 / 마지막 프레임 (4배)</h2><p class=note>주기 = t=12 로 한 번 더 그린 그림이 첫 프레임과 픽셀까지 같은가. 이음 변화량 = 마지막→첫 프레임에서 바뀐 픽셀 수(평균 한 걸음과 비슷하면 튀지 않는다).</p><table><tr><th>기물</th><th>첫 프레임</th><th>마지막(12번째)</th><th>움직임</th><th>프레임</th><th>주기 일치</th><th>이음 변화량 / 평균 한 걸음</th></tr>')
names=list(anim4.ANIM)
for n in names:
    f=OBJ[n][1](); s=anim4.seamless(f)
    H.append(f'<tr><td>{meta4.ko.ko(n)}</td><td><img src="{u(card([f.frames[0]],k=3,pad=2))}"></td><td><img src="{u(card([f.frames[-1]],k=3,pad=2))}"></td><td><img src="{uw(f.frames,anim4.MS,3,(96,78,60))}"></td><td>{len(f.frames)} × {anim4.MS}ms</td><td class={"ok" if s["periodic"] else "bad"}>{"예" if s["periodic"] else "아니오"}</td><td>{s["wrapStepPx"]} / {s["meanStepPx"]}</td></tr>')
for n in anim4.GA:
    fr=anim4.GA[n]; ok=anim4.ga_seamless(n,anim4.GA_FN[n])
    H.append(f'<tr><td>goods:{n}</td><td><img src="{u(card([fr[0]],k=4,pad=2))}"></td><td><img src="{u(card([fr[-1]],k=4,pad=2))}"></td><td><img src="{uw(fr,anim4.MS,4,(96,78,60))}"></td><td>{len(fr)} × {anim4.MS}ms</td><td class={"ok" if ok else "bad"}>{"예" if ok else "아니오"}</td><td>-</td></tr>')
H.append('</table>')
# ---- passage table
H.append('<h2>통행 검사 표</h2><table><tr><th>맵</th><th>결과</th><th>방(닿음/전체)</th><th>사용 칸</th><th>비워 둘 칸</th><th>닿는 바닥 / 바닥</th><th>방 이름</th></tr>')
for k,b,m in MAPS:
    r=CHK[m['key']]
    H.append(f'<tr><td>{m["name"]}</td><td class={"ok" if r["ok"] else "bad"}>{"통과" if r["ok"] else "실패: "+"; ".join(r["issues"])}</td><td>{sum(x["reached"] for x in r["rooms"])}/{len(r["rooms"])}</td><td>{r["usesOk"]}/{r["usesTotal"]}</td><td>{len(r["mustClear"])}</td><td>{r["reachableCells"]}/{r["floorCells"]}</td><td>{", ".join(x["room"] for x in r["rooms"])}</td></tr>')
H.append('</table><p class=note>계단 짝: '+', '.join(f'{p["from"]}→{p["to"]} ({p["x"]},{p["y"]}) {"정렬됨" if p["aligned"] else "어긋남"}' for p in meta4.stair_pairs(meta4.building_answers()))+'</p>')
H.append('<h3>통행 오버레이 (저택 1층·2층)</h3><div class=row>'+''.join(f'<img src="{u(sc(overlay(k),2))}">' for k in ('manor_1f','manor_2f'))+'</div>')
# ---- metadata excerpt
d=json.load(open('tiledata/hand-interior/v5/interior-meta.json'))
ex=[o for o in d['objects'] if o['id'] in ('kitchen range','firewood rack','dining 4x1')]
bm=[m for b in d['buildings'] if b['id']=='manor' for m in b['maps']][1]
bm2={k:bm[k] for k in ('id','name_ko','floor','wall','links','start','passageCheck')}; bm2['grid']=bm['grid']; bm2['items']=bm['items'][:6]
H.append(f'<h2>메타데이터 발췌</h2><p class=note>칩 {len(d["objects"])}개 · 자동 타일 {len(d["autotiles"])}벌({sum(len(a["pieces"]) for a in d["autotiles"])}조각) · 탁상 물건 {len(d["goods"])}개 · 건물 {len(d["buildings"])}곳 / 맵 {sum(len(b["maps"]) for b in d["buildings"])}장</p><pre>'
         +json.dumps(ex,ensure_ascii=False,indent=1).replace('<','&lt;')+'</pre><pre>'+json.dumps(d['autotiles'][0],ensure_ascii=False,indent=1)[:2500].replace('<','&lt;')+' …</pre><pre>'
         +json.dumps(bm2,ensure_ascii=False,indent=1).replace('<','&lt;')+'</pre>')
at=Image.open('tiledata/hand-interior/v5/interior-atlas.png')
H.append(f'<h2>아틀라스 (2배)</h2><img src="{u(sc(at,2))}">')
for n in ('interior-meta.json','interior-atlas.png'):
    dst=os.path.join(VIZ,n)
    if os.path.exists(dst) and not os.path.exists(os.path.join(VIZ,'interior-v3-'+n.split('-',1)[1])):
        shutil.copy(dst,os.path.join(VIZ,'interior-v3-'+n.split('-',1)[1]))
    shutil.copy('tiledata/hand-interior/v5/'+n,dst)
open(os.path.join(VIZ,'interior-v4.html'),'w').write('\n'.join(H))
print('ok',sum(len(x) for x in H)//1024,'KB')
