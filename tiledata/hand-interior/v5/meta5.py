# v5 metadata: extends v4 (meta4) with the v5 chips (chapel basilica set, hobbit/dwarf/elf/mead/throne/tower/dungeon/
# mine/magitek/opera/casino/stable pieces), line autotiles (rugs, altar rail, fence, iron bars, mine rail, steam pipe)
# with their neighbour rules, the new floors/wall faces/ceilings, and the answer arrays of all 26 maps.
import sys, json; sys.path.insert(0,'tiledata/hand-interior/v5')
import meta4, meta, ko, room4, room2, rooms4, anim4, kit4, kit5, tiles5, chapel5, props5, props6, notes6
import tiles as TL
from kit4 import OBJ, STY, PIECES
from kit5 import LINEKITS, DIRS
from mat import G
from PIL import Image
KO={'column marble':'대리석 기둥','column stone':'돌 기둥','column dwarf':'드워프 네모 기둥(룬 무늬)','column wood':'나무 기둥(금 띠)','column live':'살아 있는 나무 기둥(잎 머리)','column steel':'강철 기둥(리벳)',
 'wall torch':'벽 횃불(움직임)','brazier':'화로(움직임)','hanging lantern':'매단 등(움직임)','round window':'둥근 창','round door':'둥근 문(2칸)','round arch':'둥근 아치 문틀(3칸)',
 'pipe rack':'담뱃대 걸이','cheese wheels':'바퀴 치즈','mine cart':'광차','ore pile':'광석 더미','rune stone':'룬석(빛남·움직임)','stone throne':'돌 왕좌','moon pool':'달빛 못(움직임, 3×2)',
 'elven harp':'엘프 하프','leaf lantern':'잎 등(움직임)','elven bed':'엘프 침대','white tree':'흰 나무(화분)','long hearth 3':'긴 화덕 3칸(움직임)','long hearth 4':'긴 화덕 4칸(움직임)',
 'long hearth 5':'긴 화덕 5칸(움직임)','long hearth 6':'긴 화덕 6칸(움직임)','tapestry':'태피스트리(2줄)','royal banner':'왕기(2줄)','spiral stair':'나선 계단(2×2)','owl perch':'부엉이 횃대(움직임)',
 'star chart':'별자리표','orrery':'천체 모형(움직임)','shackles':'족쇄','slop bucket':'오물통','drip puddle':'물방울 웅덩이(움직임)','ore vein':'광맥(벽면)','pick rack':'곡괭이 걸이','powder kegs':'화약 통',
 'timber prop':'갱도 버팀목','drain grate':'배수 창살(바닥)','gear wall':'톱니 벽(움직임, 2칸)','gauge panel':'계기판(움직임)','steam vent':'증기 구멍(움직임)','magitek engine':'마도 기관(움직임, 3×2)',
 'control console':'제어반(움직임, 2칸)','magitek armor':'마도 갑옷(2×2)','theater seat':'극장 좌석','stage curtain':'무대 막(2줄)','curtain wing':'무대 날개 막','footlights':'각광(움직임, 바닥)',
 'music stand':'보면대','scenery flat':'무대 배경판(3칸)','conductor podium':'지휘대','felt 1x1':'펠트 탁자 1×1','felt 2x1':'펠트 탁자 2×1','felt 3x1':'펠트 탁자 3×1','felt 2x2':'펠트 탁자 2×2','felt 3x2':'펠트 탁자 3×2',
 'roulette table':'룰렛(움직임, 2×2)','slot machine':'슬롯머신(움직임)','chocobo':'초코보(움직임)','hay bale':'건초 더미','feed trough':'먹이통(2칸)','water trough':'물통(2칸)','saddle rack':'안장걸이','pitchfork':'쇠스랑',
 'pew E2':'동쪽을 보는 회중석(1×2)','pew E3':'동쪽을 보는 회중석(1×3)','choir stall':'성가대석(3칸, 남향)','altar E':'독립 제단(2×2, 옆에서 본 것)','pulpit':'설교단(2×2, 계단)','confessional':'고해소(3칸)',
 'reredos':'제단 장식벽(3칸, 2줄)','bell rope':'종 줄(2줄)','hymn board':'성가 번호판','votive stand':'봉헌 초 받침(움직임)','sanctuary lamp':'성체등(움직임)','baptismal font':'세례반(움직임, 2×2)','paschal candle':'부활초(움직임)',
 'nightstand':'협탁'}
ko.UK.update(KO)
ko.GK.update(notes6.GK_FIX)
ko.CAT.update({'casino':'카지노','dungeon':'지하 감옥','elf':'엘프 궁정','hall':'연회장·알현실','hobbit':'호빗 굴','magitek':'마도 기관','mine':'광산','opera':'극장','stable':'마구간','tower':'마법사의 탑'})
D={
 'column marble':'홀을 신랑·측랑으로 나누는 대리석 기둥(1칸, 24px 솟음). 3~4칸 간격으로 두 줄. 기둥 사이 베이마다 북쪽 벽에 창 하나.',
 'column stone':'=D(column marble)','column dwarf':'드워프 홀의 네모 돌기둥, 금빛 룬. 긴 식탁 줄 사이에 두 줄.','column wood':'연회장 나무 기둥(금 띠 둘). 긴 화덕 양옆에 두 줄.',
 'column live':'엘프 궁정의 살아 있는 나무 기둥(꼭대기에 잎).','column steel':'마도 기관실 강철 기둥(리벳).',
 'wall torch':'벽면 윗줄에 거는 횃불. 불꽃이 12프레임 주기로 흔들린다. 지하·드워프·감옥 복도.','brazier':'바닥 화로(1칸). 불꽃 셋. 왕좌 단 옆, 드워프 홀 문 옆.',
 'hanging lantern':'벽면 윗줄에 거는 등. 광산·극장 무대 뒤·마구간.','round window':'호빗 굴 둥근 창(벽면 윗줄).','round door':'호빗 굴 둥근 초록 문(2칸, 벽면 두 줄 전체).',
 'round arch':'문 틈(남북 칸막이의 1칸 틈) 둘레에 거는 둥근 나무 아치 문틀. 틈 칸-1 부터 3칸, 벽면 윗줄. 문틀은 틈을 막지 않는다(검사: 옆 칸만 벽면이면 된다).',
 'pipe rack':'담뱃대 걸이(벽면 윗줄). 호빗 굴 복도·거실.','cheese wheels':'바퀴 치즈 더미(바닥). 식료품 방.','mine cart':'광차(1칸, 막힘). 선로 자동 타일 위에 올린다.',
 'ore pile':'광석 더미. 막장·대장간 바닥.','rune stone':'빛나는 룬석(1칸, 16px 솟음). 드워프 홀 통로 양옆.','stone throne':'돌 왕좌.','moon pool':'달빛이 일렁이는 얕은 못(3×2, 막힘). 엘프 전당 한가운데.',
 'elven harp':'엘프 하프(1칸, 16px 솟음). 전당·침소.','leaf lantern':'잎 모양 등(벽면 윗줄).','elven bed':'엘프 침대(1×2, 북쪽 벽 앞).','white tree':'흰 나무 화분(24px 솟음). 감실 양옆.',
 'long hearth 3':'연회장 바닥 가운데 남북으로 긴 화덕(1×N). 잉걸불이 칸마다 다른 위상으로 반짝인다. 양옆에 식탁 줄.','long hearth 4':'=D(long hearth 3)','long hearth 5':'=D(long hearth 3)','long hearth 6':'=D(long hearth 3)',
 'tapestry':'벽면 두 줄을 덮는 태피스트리(tall 걸이). 큰 가구 위에 걸지 않는다.','royal banner':'왕기(tall 걸이). 왕좌 뒤·홀 벽.',
 'spiral stair':'나선 계단(2×2, 32px 솟음). 열 계단이 남쪽 바닥에서 시계 방향으로 기둥을 돌아 오른다. 탑·종탑.','owl perch':'부엉이 횃대(눈을 깜박인다).','star chart':'별자리표(벽면 윗줄).',
 'orrery':'천체 모형(행성이 돈다).','shackles':'벽 족쇄(벽면 윗줄). 감방.','slop bucket':'오물통. 감방 구석.','drip puddle':'천장에서 떨어지는 물방울 웅덩이(밟을 수 있음, 동심원 움직임).',
 'ore vein':'광맥이 드러난 벽면(벽면 윗줄). 막장.','pick rack':'곡괭이 걸이(벽면 윗줄).','powder kegs':'화약 통 더미. 화약고.','timber prop':'갱도 버팀목(1칸, 24px 솟음). 갱도 중간중간.',
 'drain grate':'바닥 배수 창살(밟을 수 있음). 생선·고기 손질터와 찬 창고의 젖은 돌바닥.','gear wall':'맞물려 도는 톱니 벽(2칸, 벽면 두 줄).','gauge panel':'바늘이 흔들리는 계기판(벽면 윗줄).',
 'steam vent':'김이 오르는 바닥 증기 구멍.','magitek engine':'마도 기관(3×2, 핵이 맥동). 기관 홀 한가운데, 증기관 자동 타일로 벽과 잇는다.','control console':'제어반(2칸, 북쪽 벽 앞, 불빛 깜박임).',
 'magitek armor':'마도 갑옷(2×2). 정비소.','theater seat':'극장 좌석(뒤에서 본 것). 줄마다 앞뒤 한쪽은 통로에 닿게 두 줄씩 묶는다.','stage curtain':'무대 막(tall 걸이). 무대 양끝.',
 'curtain wing':'무대 날개 막(바닥, 24px 솟음).','footlights':'무대 앞 가장자리 각광(밟을 수 있음, 깜박임). 한 줄로 잇는다.','music stand':'보면대. 오케스트라 석.','scenery flat':'무대 배경판(3칸, 북쪽 벽 앞).',
 'conductor podium':'지휘대. 오케스트라 석 가운데.','roulette table':'룰렛(2×2, 바퀴가 돈다). 윗면에 칩.','slot machine':'슬롯머신(북쪽 벽 앞, 불빛).','chocobo':'초코보(고개를 끄덕이고 눈을 깜박인다). 우리 안.',
 'hay bale':'건초 더미.','feed trough':'먹이통(2칸).','water trough':'물통(2칸).','saddle rack':'안장걸이.','pitchfork':'쇠스랑(벽면 윗줄).',
 'felt 1x1':'초록 펠트 도박 탁자(자동 타일). 위에 카드·칩·주사위.','felt 2x1':'=D(felt 1x1)','felt 3x1':'=D(felt 1x1)','felt 2x2':'=D(felt 1x1)','felt 3x2':'=D(felt 1x1)',
 'pew E2':'동쪽을 보는 회중석(1×2, 옆에서 본 것): 서쪽에 등판, 동쪽이 앉는 판. 동향 예배당 신랑에 기둥 사이 칸을 피해 세운다.','pew E3':'=D(pew E2)',
 'choir stall':'성가대석(3칸, 북쪽 벽 앞, 남향). 성단소 북쪽. 맞은편 남쪽에는 북향 회중석(pew).','altar E':'독립 제단(2×2). 성단소 가운데, 사방으로 돌 수 있게 둔다. 위에 촛대·성경·성작.',
 'pulpit':'설교단(2×2, 24px 솟음, 서쪽 계단). 신랑 동쪽 끝 북쪽 기둥 곁.','confessional':'고해소(3칸, 북쪽 벽 앞): 가운데 사제 문, 양옆 커튼. 측랑이나 서쪽 끝.',
 'reredos':'후진 벽의 금빛 제단 장식벽(3칸, 벽면 두 줄). 앞에 촛대를 둘 땐 한 줄 띄운다.','bell rope':'종 치는 방의 종 줄(tall 걸이).','hymn board':'성가 번호판(벽면 윗줄). 설교단 근처.',
 'votive stand':'봉헌 초 받침(작은 초들이 따로 깜박인다). 측랑.','sanctuary lamp':'붉은 성체등(벽면 윗줄, 은은히 맥동). 성단소.','baptismal font':'세례반(2×2, 물결 움직임). 입구 가까운 서쪽 끝.',
 'paschal candle':'부활초(1칸, 32px 솟음, 불꽃). 제단 곁.','nightstand':'침대 곁 협탁. 위에 촛대·책.',
}
for k,v in D.items():
    if v.startswith('=D('): D[k]=D[v[3:-1]]
meta.D.update(D)
meta.REL.update({
 'column marble':[('tall stained window','기둥 사이 베이마다 북쪽 벽에 하나'),('pew E2','기둥 칸을 피해 신랑에')],
 'altar E':[('altar rail','서쪽 앞(자동 타일, 가운데 문)'),('reredos','뒤 후진 벽'),('paschal candle','곁'),('choir stall','성단소 북쪽')],
 'pulpit':[('hymn board','위 벽면'),('column marble','기대는 기둥'),('lectern','맞은편')],
 'baptismal font':[('confessional','같은 서쪽 끝'),('holy water font','문 옆')],
 'long hearth 5':[('column wood','양옆 두 줄'),('dining 1x3','양옆 남북 식탁'),('chair E','서쪽 식탁 곁'),('chair W','동쪽 식탁 곁')],
 'magitek engine':[('pipe','증기관 자동 타일로 벽까지'),('gauge panel','벽면'),('gear wall','벽면'),('steam vent','바닥')],
 'chocobo':[('fence','우리 칸막이 자동 타일'),('feed trough','우리 안'),('hay bale','우리 안')],
 'roulette table':[('goods:chips','윗면'),('bar stool','둘레')],
 'mine cart':[('rail','선로 자동 타일 위')],
 'moon pool':[('column live','양옆'),('elven harp','감실')],
})
FLOOR_KO={'plank':'밝은 널마루','boards':'널마루','flag':'돌 판석','grey':'회색 판석','cobble':'자갈','dplank':'짙은 마루','check':'대리석 체크','ktile':'부엌 타일','earth':'흙바닥','soot':'그을린 흙','ovenf':'화덕 앞 벽돌',
 'wetstone':'젖은 돌바닥(물기·이끼)','terra':'붉은 테라코타 타일','straw':'짚 깐 바닥','grate':'쇠 격자 바닥','cave':'동굴 바닥','elfstone':'엘프 옥돌','dwarf':'드워프 판석(금 줄)','rush':'골풀 깐 바닥',
 'marble':'대리석','stage':'무대 마루','dungeon':'감옥 돌바닥','hobbit':'호빗 굴 마루','casino':'카지노 카펫','narshe':'탄광 마을 널마루','snowmat':'눈 털이 매트','slum':'젖은 뒷골목 돌'}
WALL_KO={'plaster':'회벽+판자 징두리','stone':'돌벽','log':'통나무','rubble':'잡석','ktile':'부엌 타일 벽','rune':'룬 새긴 돌벽','livewood':'살아 있는 나무 벽','goldwood':'금 장식 나무 벽','marblewall':'대리석 벽+붉은 띠',
 'dungeonw':'이끼 낀 감옥 벽','rock':'바위벽','mine':'갱도 벽(버팀 들보)','riveted':'리벳 강철 벽','velvet':'붉은 벨벳 벽','stablew':'마구간 판자 벽','hobbitw':'호빗 굴 회벽','logdark':'짙은 통나무','slumw':'무너진 벽돌'}
LINE_KO={'rug':'깔개·통로 양탄자','altar rail':'제단 난간','fence':'나무 칸막이','bars':'쇠창살','rail':'광차 선로','pipe':'증기관'}
def line_meta(rects):
    out=[]
    for name,K in LINEKITS.items():
        pcs=[]
        for (m,ic),im in sorted(K.all_pieces().items()):
            key=f'line:{name}#{m or "0"}{"+"+ic if ic else ""}'
            pcs.append({'piece':(m or '0')+('+'+ic if ic else ''),'neighbours':{d:(d in m) for d,_,_ in DIRS},'innerCorner':ic or None,
                        'image':{'w':im.width,'h':im.height},'atlas':rects.get(key)})
        base=name.split(' ')[0] if name.startswith('rug ') else name
        out.append({'id':'line:'+name,'name_ko':(LINE_KO.get(base,K.ko)+(' ('+name.split(' ',1)[1]+')' if name.startswith('rug ') else '')),
          'kind':K.kind,'blocking':K.kind!='flat','up_px':getattr(K,'up',0),'pieces':pcs,
          'rule':'칸 목록(선·사각형·T자·十자 아무 모양)을 받아, 칸마다 4방 이웃(N E S W)으로 조각을 고른다. 두 방향이 모두 이어졌는데 그 사이 대각선 칸이 비었으면 안쪽 모서리 조각(예: NE+ne)을 쓴다. 끝·모서리·T·十자가 모두 자동. 길이 제한 없음.',
          'item':'한 아이템 = 칸 목록 전체(F.cells). 막히는 종류는 칸마다 막힘으로 계산한다.'})
    return out
def surf_meta():
    fl=[];wl=[]
    for n in sorted(TL.FLOORFN):
        fl.append({'id':'floor:'+n,'name_ko':FLOOR_KO.get(n,n)})
    for n in sorted(set(room2.FACE)|set(room2.FACEFN)):
        wl.append({'id':'wall:'+n,'name_ko':WALL_KO.get(n,n),'faceRows':2,'rule':'이어진 벽 하나에 재질 하나. 기능이 다른 방은 칸막이 뒤 방 단위로 바꾼다.'})
    ce=[{'id':'ceil:'+k,'rgb':[list(a) for a in v]} for k,v in tiles5.CEILS.items()]
    return fl,wl,ce
def building_answers():
    bs=meta4.building_answers()
    for b in bs:
        for m,src in zip(b['maps'],rooms4.B[b['id']]['maps']):
            if src.get('ceil'): m['ceil']=[k for k,v in tiles5.CEILS.items() if v==src['ceil']][0]
            if src.get('parts'): m['parts']=[{'name_ko':a,'x':x,'y':y} for a,x,y in src['parts']]
            for it,s in zip(m['items'],src['items']):
                f=s[0]
                if getattr(f,'cells',None): it['cells']=[list(c) for c in f.cells]; it['line']=getattr(f,'line',None)
    return bs
if __name__=='__main__':
    objs=[]; built=[]
    for n,(c,bf) in OBJ.items():
        f=bf(); f.id=getattr(f,'id',None) or n; built.append((n,f)); objs.append(meta.meta_for(n,f))
    sheet,rects=meta.atlas(built,list(G))
    extra=[]; y=sheet.height; x=0; W=sheet.width; rowh=0
    def put(key,im):
        global x,y,rowh
        if x+im.width>W: x=0; y+=rowh; rowh=0
        rects[key]={'x':x,'y':y,'w':im.width,'h':im.height}; extra.append((im,x,y)); x+=im.width; rowh=max(rowh,im.height)
    for st in STY:
        for (cc,rc),im in sorted(PIECES[st].items()): put(f'autotile:{st}#{cc}{rc}',im)
    x=0; y+=rowh+8; rowh=0
    for name,K in LINEKITS.items():
        for (m,ic),im in sorted(K.all_pieces().items()): put(f'line:{name}#{m or "0"}{"+"+ic if ic else ""}',im)
        x=0; y+=rowh; rowh=0
    y+=8
    for name,fr in anim4.GA.items():
        rects['goods:'+name]={'x':0,'y':y,'w':16,'h':16,'frames':len(fr)}
        for i,im in enumerate(fr): extra.append((im,i*16+(16-im.width)//2,y+16-im.height))
        y+=16
    # floor swatches (32x32) and wall faces (32x32)
    x=0; y+=8; rowh=0
    for n in sorted(TL.FLOORFN):
        im=Image.new('RGBA',(32,32)); px=im.load()
        for Y in range(32):
            for X in range(32): px[X,Y]=tuple(TL.FLOORFN[n](X,Y)[:3])+(255,)
        put('floor:'+n,im)
    x=0; y+=rowh; rowh=0
    for n in sorted(set(room2.FACE)|set(room2.FACEFN)):
        im=Image.new('RGBA',(32,32)); px=im.load()
        for Y in range(32):
            for X in range(32):
                c=room2.FACEFN[n](X,Y)[:3] if n in room2.FACEFN else room2.FACE[n][X%16,Y][:3]
                px[X,Y]=tuple(c)+(255,)
        put('wall:'+n,im)
    y+=rowh
    big=Image.new('RGBA',(W,y+8)); big.alpha_composite(sheet,(0,0))
    for im,X,Y in extra: big.alpha_composite(im,(X,Y))
    big.save('tiledata/hand-interior/v5/interior-atlas.png')
    for o in objs: o['atlas']=rects[o['id']]
    gm=meta4.goods_meta()
    for g in gm: g['atlas']=rects.get(g['id'])
    at=meta4.autotile_meta()
    for a in at:
        for p in a['pieces']: p['atlas']=rects[f"{a['id']}#{p['piece']}"]
    lm=line_meta(rects); fl,wl,ce=surf_meta()
    for s in fl+wl: s['atlas']=rects.get(s['id'])
    bs=building_answers(); pairs=meta4.stair_pairs(bs)
    notes6.apply_meta(objs, bs)  # 설명 다시 쓰기·태그·summary/where (notes6.py)
    ids={m['id'] for b in bs for m in b['maps']}
    for p in pairs:
        if p['to'] not in ids: p['aligned']=None; p['note']='바깥 맵(성 본채)으로 나가는 연결 — 이 묶음에 없는 맵이라 짝 검사 대상 아님'
    NEWIDS=set(props5.NEW)|set(props6.NEW6)|set(chapel5.NEWC)|{f'column {s}' for s in kit5.COL}|{'wall torch','brazier','hanging lantern'}|{f'felt {w}x{h}' for w,h in ((1,1),(2,1),(3,1),(2,2),(3,2))}
    for o in objs: o['since']='v5' if o['id'] in NEWIDS else 'v4 이하'
    data={'version':5,'tileSize':16,'view':'정면-위 고정(RPG 쯔꾸르 2000 / EasyRPG RTP 규칙)','objects':objs,'autotiles':at,'lineAutotiles':lm,'goods':gm,
          'floors':fl,'walls':wl,'ceilings':ce,
          'atlas':{'file':'interior-atlas.png','cell':16},'buildings':bs,'stairPairs':pairs,
          'conventions':{'plan':"'#' 벽·천장, 그 밖은 실내. 막힌 칸 바로 아래 두 줄은 벽면(못 걸음).",
            'partition':'동서 칸막이(세로 벽) 틈 = 문, 걷는 줄 1칸(그 위 두 칸은 벽면). 남북 칸막이(가로 벽) 틈 = 3줄(벽 1 + 그 아래 벽면 2가 통로).',
            'wallMaterial':'벽 재질은 이어진 벽 하나에 하나. 기능이 다른 방은 칸막이 뒤 방 단위로만 바꾼다.',
            'floorByRoom':'바닥은 방 기능마다 다르게: 찬 창고·손질터 = 젖은 돌 + 배수 창살, 가게 = 널마루·테라코타, 부엌 = 타일, 작업장 = 흙, 침실 = 짙은 마루 + 깔개(자동 타일).',
            'hangings':'걸이는 벽면 두 줄 중 윗줄에만. 걸이끼리, 또 솟는 가구(책장·계단·기둥)와 겹치지 않는다. 문틀(round arch)은 틈 둘레 예외.',
            'surfaces':'탁상 물건은 surface 가 있는 가구 위에만.',
            'passage':'정답 배열마다 BFS: 출입구(또는 start)에서 모든 방·모든 가구의 사용 칸에 닿아야 하고, 문·통로 칸(mustClear)은 비워 두며, 닿지 못하는 빈 바닥이 없어야 한다.',
            'kinds':{'floor':'막힘','wall':'북쪽 벽 앞, 막힘','hang':'벽면 윗줄','flat':'밟음','tabletop':'가구 윗면','autotile':'조각 조립','line':'칸 목록 자동 타일'},
            'chairFacing':'S N E W = 바라보는 방향. pew E* = 동쪽을 보는 회중석.'}}
    json.dump(data,open('tiledata/hand-interior/v5/interior-meta.json','w'),ensure_ascii=False,indent=1)
    miss=[o['id'] for o in objs if not o['description']]
    print('objects',len(objs),'new v5',sum(o['since']=='v5' for o in objs),'autotile sets',len(at),'pieces',sum(len(a['pieces']) for a in at),
          'line kits',len(lm),'line pieces',sum(len(l['pieces']) for l in lm),'goods',len(gm),'floors',len(fl),'walls',len(wl),'ceilings',len(ce),
          'buildings',len(bs),'maps',sum(len(b['maps']) for b in bs),'atlas',big.size)
    print('missing desc',miss); print('stairs',pairs)
    print('anim not seamless',{k:v for k,v in meta4.SEAM.items() if not v['periodic']}, 'animated',len(meta4.SEAM))
    print('maps ok',[(m['id'],m['passageCheck']['ok']) for b in bs for m in b['maps'] if not m['passageCheck']['ok']])
