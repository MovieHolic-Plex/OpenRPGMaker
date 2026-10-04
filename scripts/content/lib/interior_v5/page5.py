# page: ~/claude-viz/interior-v5.html + images in ~/claude-viz/iv5/ (same server dir, relative links)
import sys, os, io, json, shutil; sys.path.insert(0,'/tmp/j8v5')
import rooms4, room4, anim4, kit4, kit5, meta4, meta5, ko, props5, props6, chapel5
from kit4 import OBJ
from kit5 import LINEKITS, rug, rect, line
from PIL import Image, ImageDraw
VIZ=os.path.expanduser('~/claude-viz'); OUT=os.path.join(VIZ,'iv5'); os.makedirs(OUT,exist_ok=True)
def sc(im,k): return im.resize((im.width*k,im.height*k),Image.NEAREST)
def png(name,im):
    im.save(os.path.join(OUT,name+'.png')); return f'iv5/{name}.png'
def webp(name,frames,ms=anim4.MS,scale=1,bg=None):
    fr=[]
    for f in frames:
        if bg: b=Image.new('RGBA',f.size,bg+(255,)); b.alpha_composite(f); f=b
        fr.append(f.resize((f.width*scale,f.height*scale),Image.NEAREST).convert('RGB'))
    fr[0].save(os.path.join(OUT,name+'.webp'),'WEBP',save_all=True,append_images=fr[1:],duration=ms,loop=0,lossless=True)
    return f'iv5/{name}.webp'
def card(items,bg=(96,78,60),pad=6,k=4):
    W=sum(i.width+pad for i in items)+pad; Hh=max(i.height for i in items)+2*pad
    im=Image.new('RGBA',(W,Hh),bg+(255,)); x=pad
    for i in items: im.alpha_composite(i,(x,Hh-pad-i.height)); x+=i.width+pad
    return sc(im,k)
MAPS=list(rooms4.all_maps()); CHK={m['key']:room4.check(m) for _,_,m in MAPS}
FR={m['key']:[room4.compose(m,t) for t in range(anim4.N)] for _,_,m in MAPS}
def overlay(key):
    base=FR[key][0].copy(); r=CHK[key]; ov=Image.new('RGBA',base.size); d=ImageDraw.Draw(ov)
    col={'c':(0,220,255,120),'u':(80,255,80,90),'D':(255,220,0,150),'S':(255,120,255,140),',':(255,0,80,160)}
    for y,row in enumerate(r['grid']):
        for x,ch in enumerate(row):
            c=col.get(ch)
            if c: d.rectangle((x*16+1,y*16+1,x*16+14,y*16+14),fill=c)
            if ch=='X': d.rectangle((x*16+1,y*16+1,x*16+14,y*16+14),outline=(255,60,60,200))
    base.alpha_composite(ov); return base
def crop(im,x0,y0,x1,y1): return im.crop((x0*16,y0*16,(x1+1)*16,(y1+1)*16))
V4=lambda k: Image.open(f'/tmp/j8v5/v4ref/v4_{k}.png').convert('RGBA')
def pair(name,b,a,k=2,nb='v4',na='v5',anim_after=None):
    sa=webp(name+'_a',anim_after,scale=k) if anim_after else png(name+'_a',sc(a,k))
    return f'<div class=pair><figure><img src="{png(name+"_b",sc(b,k))}"><figcaption>{nb}</figcaption></figure><figure><img src="{sa}"><figcaption>{na}</figcaption></figure></div>'
NEWKEYS=['hobbit','inn','dwarf','elf','mead','throne','tower','dungeon','mine','magitek','opera','casino','stable','narshe','zozo']
H=['''<!doctype html><meta charset=utf-8><title>실내 v5 — 방별 바닥 · 바실리카 예배당 · 깔개 자동 타일 · 새 실내 15곳</title><style>
body{background:#16161a;color:#ddd;font:14px/1.6 system-ui,sans-serif;margin:24px;max-width:1900px}
img{image-rendering:pixelated;display:block;max-width:none}h2{margin-top:40px;border-top:1px solid #333;padding-top:16px}h3{margin:18px 0 4px}
.pair,.row{display:flex;gap:18px;flex-wrap:wrap;align-items:flex-end}figure{margin:6px 0}figcaption{color:#aaa;font-size:12px;max-width:640px}
table{border-collapse:collapse;font-size:13px}td,th{border:1px solid #333;padding:4px 8px;text-align:left;vertical-align:top}.ok{color:#7f7}.bad{color:#f77}
pre{background:#22222a;padding:10px;overflow:auto;max-height:460px;font-size:12px}a{color:#9cf}.note{color:#bbb;max-width:1150px}
nav a{margin-right:12px}.scroll{overflow-x:auto}</style>''']
okn=sum(1 for v in CHK.values() if v['ok'])
d=json.load(open('/tmp/j8v5/interior-meta.json'))
H.append(f'''<h1>실내 v5</h1><p class=note>맵 {len(MAPS)}장 (v4 건물 10곳 11장 + 새 실내 15곳), 통행 검사 <b class=ok>{okn}/{len(MAPS)} 통과</b>.
새 칩 {sum(o["since"]=="v5" for o in d["objects"])}개, 선 자동 타일 {len(d["lineAutotiles"])}벌 ({sum(len(l["pieces"]) for l in d["lineAutotiles"])}조각), 새 바닥·벽·천장 포함 바닥 {len(d["floors"])} · 벽 {len(d["walls"])} · 천장 {len(d["ceilings"])}.
데이터: <a href="interior-meta.json">interior-meta.json</a> · <a href="interior-atlas.png">interior-atlas.png</a> (v4 판: <a href="interior-v4.html">interior-v4.html</a>, <a href="interior-v4-meta.json">interior-v4-meta.json</a>)</p>
<nav><a href="#p1">1. 방마다 바닥</a><a href="#p2">2. 예배당</a><a href="#p3">3. 깔개 자동 타일</a><a href="#p4">4. 새 실내 15곳</a><a href="#cat">새 기물 목록</a><a href="#anim">움직임 이음매</a><a href="#pass">통행 표</a><a href="#meta">메타데이터</a><a href="#all">고친 맵 전체</a></nav>''')
# ---------------- 1 floors
H.append('<h2 id=p1>1. 방 기능마다 바닥이 다르다 — 찬 창고·손질터는 젖은 돌 + 배수 창살, 가게는 널마루·테라코타</h2>')
H.append('<h3>생선가게</h3><p class=note>찬 창고·손질터 = 젖은 돌바닥(물기·이끼), 손질터 바닥에 배수 창살 두 개. 가게 = 널마루.</p>'+pair('fish',V4('fish'),None,2,'v4: 세 방 모두 같은 판석','v5',FR['fish']))
H.append('<h3>정육점</h3><p class=note>손질방·찬 창고 = 젖은 돌 + 배수 창살(칸막이 문 칸까지 같은 돌), 가게 = 붉은 테라코타 타일.</p>'+pair('butcher',V4('butcher'),None,2,'v4','v5',FR['butcher']))
H.append('<h3>같은 원칙을 다른 건물에도</h3><div class=row>'+
  ''.join(f'<figure><img src="{png("f_"+k+"_b",sc(V4(k),1))}"><img src="{png("f_"+k+"_a",sc(FR[k][0],1))}"><figcaption>{t}</figcaption></figure>' for k,t in (
   ('pharmacy','약국: 조제실 = 돌 판석, 약사 방 = 짙은 마루 (위 v4 / 아래 v5)'),('tailor','재단사: 작업실 = 골풀 자리, 탈의실 = 짙은 마루 + 보라 깔개'),
   ('smithy','대장간: 가게 = 널마루 (작업장 흙·그을림은 그대로)'),('scholar','학자의 집: 침실 파란 깔개, 서고 열람 탁자 밑 초록 깔개')))+'</div>')
# ---------------- 2 chapel
m=[mm for _,_,mm in MAPS if mm['key']=='chapel'][0]
H.append('<h2 id=p2>2. 예배당 — 동쪽을 향한 바실리카로 다시 설계</h2>')
H.append('<p class=note>남쪽 현관으로 들어오면 서쪽 끝(세례반·고해소·오르간)과 종탑(나선 계단·종 줄)이 왼쪽, 오른쪽으로 긴 신랑. 대리석 기둥 두 줄(아케이드)이 신랑과 남·북 측랑을 나누고, '
         '북쪽 측랑 벽의 스테인드글라스는 기둥 사이 베이마다 하나(기둥 x=6·9·12·15·18·21, 창 x=7·10·13·16·19) — 창빛이 바닥에 떨어진다. 회중석은 모두 동쪽(제단)을 본다. '
         '신랑 동쪽 끝 북쪽 기둥에 붙은 설교단, 남쪽 독서대. 두 계단 위 대리석 성단소에 제단 난간(자동 타일, 가운데 문), 북쪽 성가대석·남쪽 성가대 긴의자, 사방으로 도는 독립 제단, 부활초, 성체등. '
         '동쪽 후진에는 금빛 제단 장식벽. 성단소 남쪽 문으로 제의실(제의 옷장·초 선반·손 씻는 대야·성작 작업대).</p>')
H.append(pair('chapel',V4('chapel'),None,2,'v4: 남북 한 칸 홀','v5: 동향 바실리카 (움직임)',FR['chapel']))
H.append('<h3>부분 이름</h3><table><tr><th>부분</th><th>좌표(대표 칸)</th></tr>'+''.join(f'<tr><td>{a}</td><td>({x},{y})</td></tr>' for a,x,y in m['parts']+[(r,x,y) for r,x,y in m['rooms']])+'</table>')
H.append(f'<figure><img src="{png("chapel_ov",sc(overlay("chapel"),2))}"><figcaption>통행 오버레이: 하늘색 = 비워 둘 문·통로, 초록 = 사용 칸, 노랑 = 출입구, 빨간 테두리 = 막는 가구</figcaption></figure>')
H.append(f'<h3>예배당 새 기물 (4배)</h3><div class=row><figure><img src="{png("chapel_kit",card([OBJ[n][1]().im for n in ("pew E2","pew E3","choir stall","altar E","pulpit","confessional","reredos","bell rope","hymn board","column marble","spiral stair")],k=3))}"><figcaption>동향 회중석 2·3칸, 성가대석, 독립 제단, 설교단, 고해소, 제단 장식벽, 종 줄, 성가 번호판, 대리석 기둥, 나선 계단</figcaption></figure>'
         +''.join(f'<figure><img src="{webp("ck_"+n.replace(" ","_"),OBJ[n][1]().frames,scale=4,bg=(96,78,60))}"><figcaption>{ko.ko(n)}</figcaption></figure>' for n in ('votive stand','sanctuary lamp','baptismal font','paschal candle'))
         +f'<figure><img src="{png("chapel_rail",card([chapel5.altar_rail(line(0,0,0,4)+line(0,6,0,8))[0].im,chapel5.altar_rail(line(0,0,3,0))[0].im,chapel5.dais_w(4,3).im],k=3))}"><figcaption>제단 난간 자동 타일(남북·동서), 서쪽 두 계단 성단소</figcaption></figure></div>')
# ---------------- 3 rugs
H.append('<h2 id=p3>3. 깔개·통로 양탄자 = 선 자동 타일 — 끊김 없이 어떤 길이든, 끝·모서리·T·十자</h2>')
H.append('<p class=note>v4 는 1×3 양탄자 조각을 3칸마다 놓아 이음매가 보였다. v5 는 칸 목록을 받아 칸마다 이웃 4방(N E S W)과 안쪽 모서리로 조각을 고른다. 저택 현관 홀은 계단 발치 → 정문 한 줄에 뒤 복도가 十자, 응접실·식당 문으로 T자. 2층도 계단통 → 복도 → 안방 거실·서재 문으로 갈라진다.</p>')
H.append(pair('manor1',crop(V4('manor_1f'),9,3,15,19),crop(FR['manor_1f'][0],0,3,24,19),2,'v4 현관 홀: 3칸마다 끊김','v5 1층: 十자·T자 통로 깔개 + 식당 깔개'))
H.append(pair('manor2',crop(V4('manor_2f'),0,5,24,17),crop(FR['manor_2f'][0],0,5,24,17),2,'v4 2층','v5 2층: 복도 깔개, 안방 보라 깔개(사각형)'))
demo=[]
shapes=[('한 줄',line(0,0,5,0)),('ㄱ자',line(0,0,4,0)+line(4,0,4,3)),('T자',line(0,0,6,0)+line(3,0,3,3)),('十자',line(0,2,6,2)+line(3,0,3,5)),('사각형',rect(0,0,3,2)),('ㄷ자·안쪽 모서리',rect(0,0,4,1)+rect(0,2,1,4)+rect(3,2,4,4))]
for t,cells in shapes:
    f,_,_=rug(cells,'royal'); demo.append((t,f.im))
H.append('<div class=row>'+''.join(f'<figure><img src="{png("rug_"+str(i),card([im],bg=(58,48,40),k=3))}"><figcaption>{t}</figcaption></figure>' for i,(t,im) in enumerate(demo))+'</div>')
H.append('<h3>선 자동 타일 모두 — 조각 표 (3배)</h3>')
for name,K in LINEKITS.items():
    P=sorted(K.all_pieces().items()); ims=[im for _,im in P]
    H.append(f'<figure><div class=scroll><img src="{png("lk_"+name.replace(" ","_"),card(ims,bg=(58,48,40),pad=3,k=3))}"></div><figcaption>{name} — {len(P)}조각: {" ".join((m or "0")+("+"+ic if ic else "") for (m,ic),_ in P)}</figcaption></figure>')
# ---------------- 4 new maps
H.append('<h2 id=p4>4. 새 실내 15곳 (2배, 움직임)</h2><p class=note>모두 방 둘 이상, 칸막이 규칙·걸이 규칙·벽 재질 규칙·통행 검사 통과. 방 기능마다 바닥이 다르고 천장 색도 장소에 맞췄다.</p>')
for k in NEWKEYS:
    b=rooms4.B[k]; mm=b['maps'][0]; r=CHK[mm['key']]
    H.append(f'<h3>{b["name"]}</h3><p class=note>{mm["plan"].__len__()}줄 × {len(mm["plan"][0])}칸 · 바닥 {mm["floor"]}{" + "+", ".join(sorted(set(z[4] for z in mm.get("zones",()) if z[4]))) if mm.get("zones") else ""} · 벽 {mm["wall"]} · 통행 <b class={"ok" if r["ok"] else "bad"}>{"통과" if r["ok"] else "실패"}</b> · 방 {", ".join(x["room"] for x in r["rooms"])} · 사용 칸 {r["usesOk"]}/{r["usesTotal"]}</p><img src="{webp("map_"+k,FR[mm["key"]],scale=2)}">')
# ---------------- catalogue
H.append('<h2 id=cat>새 기물 목록 (v5, 3배 · 움직이는 것은 움직임)</h2>')
groups={}
for o in d['objects']:
    if o['since']=='v5': groups.setdefault(o['category_ko'],[]).append(o['id'])
for g,ns in groups.items():
    cells=[]
    for n in ns:
        f=OBJ[n][1]()
        src=webp('o_'+n.replace(' ','_').replace(':','_'),f.frames,scale=3,bg=(96,78,60)) if getattr(f,'frames',None) else png('o_'+n.replace(' ','_').replace(':','_'),card([f.im],k=3,pad=3))
        cells.append(f'<figure><img src="{src}"><figcaption>{ko.ko(n)}<br><small>{n} · {f.fw}×{f.fh} {f.kind}{" +"+str(f.up)+"px" if f.up else ""}</small></figcaption></figure>')
    H.append(f'<h3>{g} ({len(ns)})</h3><div class=row>'+''.join(cells)+'</div>')
H.append('<h3>새 바닥 · 벽면 (2배)</h3><div class=row>'+''.join(f'<figure><img src="{png("sw_"+s["id"].replace(":","_"),sc(Image.open("/tmp/j8v5/interior-atlas.png").crop((s["atlas"]["x"],s["atlas"]["y"],s["atlas"]["x"]+32,s["atlas"]["y"]+32)),2))}"><figcaption>{s["name_ko"]}<br><small>{s["id"]}</small></figcaption></figure>' for s in d['floors']+d['walls'])+'</div>')
# ---------------- animation seam table (new animated)
H.append('<h2 id=anim>움직임 이음매 — 새로 움직이는 기물 (12프레임 × 100ms, t=12 가 t=0 과 픽셀 동일해야 통과)</h2><table><tr><th>기물</th><th>첫</th><th>마지막</th><th>움직임</th><th>주기 일치</th><th>이음 변화 / 평균 한 걸음 (px)</th></tr>')
newanim=[n for n in anim4.ANIM if n in {o['id'] for o in d['objects'] if o['since']=='v5'}]
for n in newanim:
    f=OBJ[n][1](); s=anim4.seamless(f); t=n.replace(' ','_')
    H.append(f'<tr><td>{ko.ko(n)}</td><td><img src="{png("a0_"+t,card([f.frames[0]],k=2,pad=2))}"></td><td><img src="{png("a1_"+t,card([f.frames[-1]],k=2,pad=2))}"></td><td><img src="{webp("aa_"+t,f.frames,scale=2,bg=(96,78,60))}"></td><td class={"ok" if s["periodic"] else "bad"}>{"예" if s["periodic"] else "아니오"}</td><td>{s["wrapStepPx"]} / {s["meanStepPx"]}</td></tr>')
H.append('</table>')
# ---------------- passage table
H.append('<h2 id=pass>통행 검사 표 (맵 26장)</h2><table><tr><th>맵</th><th>결과</th><th>방(닿음/전체)</th><th>사용 칸</th><th>비워 둘 칸</th><th>닿는 바닥 / 바닥</th><th>방 이름</th></tr>')
for k,b,mm in MAPS:
    r=CHK[mm['key']]
    H.append(f'<tr><td>{mm["name"]}{" (v5 새)" if k in NEWKEYS else ""}</td><td class={"ok" if r["ok"] else "bad"}>{"통과" if r["ok"] else "실패: "+"; ".join(r["issues"])}</td><td>{sum(x["reached"] for x in r["rooms"])}/{len(r["rooms"])}</td><td>{r["usesOk"]}/{r["usesTotal"]}</td><td>{len(r["mustClear"])}</td><td>{r["reachableCells"]}/{r["floorCells"]}</td><td>{", ".join(x["room"] for x in r["rooms"])}</td></tr>')
H.append('</table><p class=note>계단 짝: '+', '.join(f'{p["from"]}→{p["to"]} ({p["x"]},{p["y"]}) '+({True:'정렬됨',False:'어긋남',None:'바깥 연결'}[p["aligned"]]) for p in d['stairPairs'])+'</p>')
H.append('<div class=row>'+''.join(f'<figure><img src="{png("ov_"+k,sc(overlay(k),1))}"><figcaption>{k} 통행 오버레이</figcaption></figure>' for k in ('dungeon','stable','casino','tower'))+'</div>')
# ---------------- metadata
ex=[o for o in d['objects'] if o['id'] in ('pulpit','spiral stair','roulette table')]
lk=[l for l in d['lineAutotiles'] if l['id']=='line:rug royal'][0]; lk2=dict(lk); lk2['pieces']=lk['pieces'][:5]
bm=[mm for b in d['buildings'] if b['id']=='chapel' for mm in b['maps']][0]
bm2={k:bm[k] for k in ('id','name_ko','floor','wall','zones','ceil','parts','passageCheck') if k in bm}; bm2['grid']=bm['grid']; bm2['items']=[i for i in bm['items'] if 'cells' in i][:2]+bm['items'][20:24]
H.append(f'<h2 id=meta>메타데이터 발췌</h2><p class=note>칩 {len(d["objects"])}개(v5 새 {sum(o["since"]=="v5" for o in d["objects"])}) · 표면 자동 타일 {len(d["autotiles"])}벌({sum(len(a["pieces"]) for a in d["autotiles"])}조각) · 선 자동 타일 {len(d["lineAutotiles"])}벌({sum(len(l["pieces"]) for l in d["lineAutotiles"])}조각) · 탁상 물건 {len(d["goods"])} · 바닥 {len(d["floors"])} · 벽 {len(d["walls"])} · 천장 {len(d["ceilings"])} · 건물 {len(d["buildings"])}곳 / 맵 {sum(len(b["maps"]) for b in d["buildings"])}장</p>'
         '<pre>'+json.dumps(ex,ensure_ascii=False,indent=1).replace('<','&lt;')+'</pre><pre>'+json.dumps(lk2,ensure_ascii=False,indent=1).replace('<','&lt;')+'</pre><pre>'
         +json.dumps(bm2,ensure_ascii=False,indent=1).replace('<','&lt;')+'</pre>')
# ---------------- all fixed maps
H.append('<h2 id=all>고친 v4 맵 전체 (2배, 움직임)</h2>')
for k,b,mm in MAPS:
    if k in NEWKEYS: continue
    H.append(f'<h3>{b["name"]} — {mm["name"]}</h3><img src="{webp("fix_"+mm["key"],FR[mm["key"]],scale=2)}">')
at=Image.open('/tmp/j8v5/interior-atlas.png')
H.append(f'<h2>아틀라스 (2배)</h2><img src="{png("atlas2",sc(at,2))}">')
for n in ('interior-meta.json','interior-atlas.png'):
    dst=os.path.join(VIZ,n); keep=os.path.join(VIZ,'interior-v4-'+n.split('-',1)[1])
    if os.path.exists(dst) and not os.path.exists(keep): shutil.copy(dst,keep)
    shutil.copy('/tmp/j8v5/'+n,dst)
open(os.path.join(VIZ,'interior-v5.html'),'w').write('\n'.join(H))
print('ok',sum(len(x) for x in H)//1024,'KB', len(os.listdir(OUT)),'files')
