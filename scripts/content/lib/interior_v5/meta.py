# machine-readable metadata for every interior chip: the editor AI reads this to lay pieces down again
import sys, json, re; sys.path.insert(0,'/tmp/j8v5')
import ko
from surf import OBJ
from mat import G
D={ # unique pieces: what it is + where it goes (Korean, 1-2 sentences)
'apothecary drawers':'작은 서랍이 격자로 붙은 약재 서랍장. 약국 조제실·가게 카운터 뒤 북쪽 벽에 둘러 세운다.',
'alembic':'유리 플라스크와 관이 달린 증류기. 약국 조제실 작업대 옆 바닥에 둔다.',
'cauldron':'불 위에 걸린 쇠 가마솥, 초록 약이 끓는다(애니메이션). 조제실·마녀집 구석에 둔다.',
'herb drying rack':'약초 다발을 매단 선반형 건조대. 약국 벽을 따라 세운다.',
'balance scale':'놋쇠 천칭을 받침대에 올린 큰 저울. 약국·상점 카운터 옆 바닥에 둔다.',
'mortar and pestle':'바닥용 큰 돌 절구. 탁상용은 goods:mortar 를 쓴다.',
'fish tank':'살아 있는 물고기가 헤엄치는 벽붙이 수조(애니메이션). 생선가게 손질터 북쪽 벽에 둔다.',
'fishing net':'벽에 건 그물. 생선가게·어부 집 벽면 장식.',
'chopping block':'칼이 꽂힌 통나무 도마. 정육점·생선 손질터 작업대 옆 바닥에 둔다.',
'meat hooks':'고기를 매단 걸이대(2칸). 정육점 북쪽 벽 앞에 세운다.',
'bread oven':'벽돌 돔 화덕, 안에서 불이 일렁인다(애니메이션). 빵집 굽는 방 북쪽 벽에 붙인다.',
'dough table':'반죽과 밀대가 놓인 작업대(2칸). 빵집 굽는 방.',
'cake display case':'유리 뚜껑 케이크 진열장(2칸). 빵집 카운터 줄에 둔다.',
'anvil':'쇠모루. 대장간 용광로 앞 1~2칸에 둔다.',
'forge':'돌 후드가 달린 용광로, 숯불이 일렁인다(애니메이션). 대장간 북쪽 벽에 붙인다.',
'grindstone':'나무 틀에 건 숫돌 바퀴. 대장간 작업장 바닥.',
'quench barrel':'물이 찬 담금질 통. 모루 옆에 둔다.',
'armor stand':'갑옷을 입힌 거치대(키가 크다). 대장간 가게·성 무기고 바닥.',
'weapon barrel':'칼·창이 꽂힌 통. 대장간·무기점 바닥.',
'tool wall':'망치·편자·집게를 건 벽 판. 대장간 벽면.',
'keg rack':'눕힌 술통 다섯 개를 쌓은 선반(2칸). 선술집 바 뒤 벽.',
'dart board':'다트판. 선술집 홀 벽면.',
'piano':'업라이트 피아노(2칸). 선술집·저택 홀 북쪽 벽, 앞에 스툴.',
'lute':'벽에 건 류트. 선술집·음유시인 집 벽면.',
'bar stool':'쇠다리 둥근 바 의자. 바 카운터 앞(남쪽) 줄로 둔다.',
'pew':'등받이 긴의자(2칸). 예배당 중앙 통로 양쪽에 줄지어 둔다.',
'altar':'보라 천을 두른 대리석 제단(2칸). 윗면에 초·성경을 올린다. 예배당 제단부 북쪽 벽.',
'lectern':'성경을 올리는 설교대. 제단 앞 한쪽.',
'pipe organ':'금빛 파이프 오르간(2칸, 키가 크다). 예배당 제단부 벽.',
'stained glass':'색유리 아치창. 예배당 벽면.',
'candelabra':'세 갈래 큰 촛대, 불꽃이 흔들린다(애니메이션). 제단 양옆·긴의자 줄 끝.',
'holy water font':'성수반. 예배당 입구 안쪽 양옆.',
'globe':'놋쇠 받침 지구의. 서재 바닥.',
'telescope':'삼각대 망원경. 서재·천문대 창가.',
'scroll rack':'두루마리를 칸마다 꽂은 선반. 서재·도서관 북쪽 벽.',
'armchair':'천을 씌운 안락의자. 벽난로·찻상 옆.',
'sofa':'2인 소파(2칸). 거실·응접실, 앞에 찻상.',
'coat rack':'외투와 모자를 건 옷걸이. 방 입구·구석.',
'vanity mirror':'거울 달린 화장대. 침실 북쪽 벽.',
'washbasin':'세면대. 욕실·침실 북쪽 벽.',
'bathtub':'다리 달린 욕조(2칸). 욕실 바닥.',
'cradle':'아기 요람. 부부 침실 침대 옆.',
'canopy bed':'닫집이 달린 2인 침대(2×2, 키가 크다). 저택 침실 북쪽 벽 가운데, 양옆에 협탁.',
'straw bed':'짚 침대. 헛간·빈민 집 바닥.',
'kitchen sink':'펌프 달린 돌 개수대. 부엌 북쪽 벽.',
'dish rack':'그릇·찻잔 선반. 부엌 벽면.',
'hanging pans':'냄비·프라이팬 걸이. 부엌 벽면.',
'firewood pile':'쌓은 장작. 화덕·벽난로 옆.',
'water jar':'물이 찬 큰 독. 부엌·작업장 구석.',
'crystal ball':'받침 위 수정구. 점술가·마법사 방.',
'spellbook stand':'빛나는 마법서 받침. 마법사 방.',
'magic circle':'바닥에 그린 마법진(2×2, 밟을 수 있음). 마법사 방·지하실 가운데.',
'treasure pile':'금화·보석 더미(2칸). 보물고·용의 둥지.',
'wall clock':'벽시계. 거실·서재 벽면.',
'deer trophy':'사슴 머리 박제. 사냥꾼 집·선술집 벽면.',
'wall map':'벽 지도. 서재·길드 벽면.',
'notice board':'쪽지가 붙은 게시판. 길드·선술집·가게 벽면.',
'curtained window':'커튼 달린 창. 침실·저택 벽면.',
'wall sconce':'벽등, 불꽃이 흔들린다(애니메이션). 복도·침실 벽면.',
'throne':'금테 왕좌(키가 크다). 알현실 북쪽 가운데.',
'royal chest':'붉은 칠 보물 상자. 저택 침실·보물고.',
'mannequin':'옷을 입힌 마네킹(키가 크다). 재단사 가게·작업실.',
'spinning wheel':'물레. 재단사 작업실·농가.',
'loom':'베틀(2칸). 재단사 작업실 북쪽 벽.',
'sewing table':'재봉대. 윗면에 옷감·가위를 올린다.',
'fabric bolt rack':'색색 옷감을 꽂은 선반. 재단사 벽.',
'tailor mirror':'전신 거울. 재단사 탈의실.',
'desk':'서랍 달린 짙은 나무 책상(2칸). 윗면에 종이·잉크병·책·등을 올린다. 남쪽에 의자 N(북쪽을 보는 의자).',
'writing desk':'= desk.',
'side table':'작은 1칸 탁자. 의자 E/W 두 개를 양옆에, 윗면에 잔·카드·주사위.',
'tea table':'붉은 체크 천을 깐 찻상. 안락의자 사이, 윗면에 찻주전자·찻잔.',
'nightstand':'침대 옆 협탁. 윗면에 초·등·책.',
'cupboard':'서랍장. 윗면에 꽃병·병. 침실·거실 북쪽 벽.',
'fireplace':'돌 벽난로, 불꽃 애니메이션(2칸). 거실·홀 북쪽 벽, 옆에 장작더미·안락의자.',
'stove':'무쇠 화덕, 창으로 불이 보인다(애니메이션). 부엌 북쪽 벽.',
'candle':'바닥 촛대, 불꽃 애니메이션. 탁상용은 goods:candle.',
'chest':'쇠띠 두른 나무 상자. 침대 발치·창고.',
'barrel':'술·물 통. 창고·부엌·가게 구석.','crate':'나무 궤짝. 창고·가게 구석에 쌓는다.','sack':'곡식 자루.',
'plant':'화분 식물.','pot':'항아리.','window':'나무 창. 벽면.','picture':'풍경화 액자. 벽면.','shelf pots':'단지 벽 선반.','bottles':'병 벽 선반.',
'wardrobe':'두 문 옷장(키가 크다). 침실 북쪽 벽.','clock':'괘종시계(키가 크다). 거실·여관 북쪽 벽.','bookshelf':'책장(키가 크다). 서재·도서관 북쪽 벽.',
'stairs down':'바닥에 뚫린 내려가는 계단(1칸, 밟을 수 있음 → 지하 이동 이벤트).','stairs up':'북쪽 벽으로 올라가는 계단(3칸 폭, 벽면 두 줄을 덮는다 → 위층 이동 이벤트).',
'doormat':'발깔개(밟을 수 있음). 출입문 안쪽 한 칸.','roundtable':'외다리 원탁(1칸).','weapon rack':'무기걸이. 벽면.','shield':'방패 장식. 벽면.',
'bench':'등받이 없는 긴 의자. 식탁 위·아래에 붙인다.','stool':'등받이 없는 의자.','counter':'가게 카운터. 윗면에 저울·돈궤·종. 뒤(북쪽)는 주인 자리, 앞(남쪽)은 손님 자리.',
'table':'식탁. 윗면에 접시·잔을 올리고 의자를 둘러 놓는다.','work table':'작업대. 업종에 맞는 도구를 올린다.','chair':'나무 의자. 글자는 바라보는 방향(S=남쪽/화면 아래).',
'bed':'1인 침대(1×2). 머리판은 북쪽 벽에 붙인다.','double bed':'2인 침대(2×2). 머리판은 북쪽 벽에 붙인다.',
'display':'진열 상자.','ice chest':'얼음을 채운 진열 상자(2칸). 생선가게·정육점 카운터 줄.',
'tall vase':'키큰 꽃병.','potted':'화분.','rug':'양탄자(밟을 수 있음).','banner':'벽에 거는 깃발.',
'fish ice chest':'얼음 위에 생선을 늘어놓은 진열함(2칸). 생선가게 카운터 줄.',
'green rug':'초록 네모 양탄자(2×2, 밟을 수 있음). 거실·가게 바닥.','purple rug':'보라 네모 양탄자(2×2, 밟을 수 있음). 침실·서재 바닥.',
'round rug':'둥근 양탄자(2×2, 밟을 수 있음). 안락의자 자리 밑.','runner':'긴 양탄자(1×3). 복도·통로.','fur rug':'모피 깔개(2×2). 벽난로 앞.',
}
TAGS={'pharm':['약국','조제실'],'fish':['생선가게','항구'],'bake':['빵집'],'butcher':['정육점'],'veg':['채소가게','시장','부엌'],'smith':['대장간','무기점'],
 'tavern':['선술집','여관'],'church':['예배당','신전'],'study':['서재','도서관'],'tailor':['재단사','옷가게'],'home':['집','침실','거실'],'kitchen':['부엌'],
 'magic':['마법사 방','보물고'],'decor':['장식'],'misc':['잡화점','창고'],'shop':['상점']}
REL={ # related pieces and why
'desk':[('chair N','책상 남쪽에 북쪽을 보는 의자'),('goods:papers','책상 위'),('goods:inkwell','책상 위'),('goods:lamp','책상 위'),('bookshelf 2w','같은 방 북쪽 벽')],
'table 2x1':[('chair S','북쪽 줄 의자(남쪽을 봄)'),('chair N','남쪽 줄 의자'),('goods:breadplate','식탁 위'),('goods:beer','식탁 위'),('bench 2','의자 대신 위·아래')],
'side table':[('chair E','서쪽에'),('chair W','동쪽에'),('goods:cards','위에'),('goods:beer','위에')],
'tea table':[('armchair','양옆'),('goods:teapot','위에'),('goods:cup','위에')],
'nightstand':[('bed green','침대 바로 옆'),('goods:candle','위에'),('goods:lamp','위에')],
'counter 3':[('stool','주인 자리 뒤'),('goods:scale','위에'),('goods:cashbox','위에'),('goods:bell','위에'),('cabinet:potion+potionb+potiong','뒤 벽')],
'forge':[('anvil','앞 1~2칸'),('quench barrel','모루 옆'),('firewood pile','옆'),('tool wall','벽면')],
'anvil':[('forge','뒤'),('quench barrel','옆')],
'bread oven':[('firewood pile','옆'),('dough table','같은 방'),('sack:grain','같은 방')],
'fireplace':[('firewood pile','옆'),('armchair','앞'),('fur rug','앞')],
'stove':[('kitchen sink','옆'),('work table pine','같은 부엌'),('hanging pans','위 벽면')],
'fish tank':[('work table pine','손질터'),('chopping block','손질터'),('ice chest:fish+fishg+fishr','가게 쪽')],
'altar':[('candelabra','양옆'),('lectern','앞 한쪽'),('pew','남쪽 줄'),('runner','중앙 통로')],
'pew':[('runner','중앙 통로 양옆'),('altar','북쪽')],
'canopy bed':[('nightstand','양옆'),('royal chest','발치'),('wardrobe','같은 방')],
'bar stool':[('counter 6','북쪽')],'piano':[('stool','앞')],'loom':[('spinning wheel','옆'),('basket:wool','같은 방')],
'mannequin':[('tailor mirror','같은 방'),('fabric bolt rack','같은 방')],'bathtub':[('washbasin','같은 욕실'),('water jar','옆')],
'armchair':[('tea table','옆'),('fireplace','앞')],'cauldron':[('work table pine','조제실'),('basket:herb','옆')],
}
def base_key(n):
    for k in sorted(D,key=len,reverse=True):
        if n==k or n.startswith(k+' ') or n.startswith(k): return k
def meta_for(n,f):
    cat=OBJ[n][0]
    w=f.im.width; h=f.im.height
    fw,fh,up=f.fw,f.fh,f.up
    kind=f.kind
    kind_ko={'floor':'바닥 기물(막힘)','wall':'북쪽 벽 앞 기물(막힘, 벽에 붙임)','hang':'벽면 걸이(벽 두 줄 중 윗줄)','flat':'바닥 무늬(밟을 수 있음)'}[kind]
    if ':' in n:
        c,g=n.split(':'); gname=ko.ko(n)
        desc=f'{gname}. 같은 {ko.CK[c]}에 담긴 상품만 바꾼 재고 변형이다. '+{'crate':'가게 앞 진열·창고 바닥에 줄지어 둔다.','basket':'가게 바닥 진열·부엌 구석.','barrel':'가게·창고 바닥.','shelf':'벽면(벽 두 줄 중 윗줄)에 건다.','cabinet':'북쪽 벽 앞에 세운다(카운터 뒤).','hang':'벽면에 건다.','table':'가게·부엌 바닥.','sack':'창고·굽는 방 바닥.','ice chest':'카운터 줄에 둔다.'}[c]
        rel=[{'id':f'{c}:{x}','why':'같은 그릇 다른 상품(변형)'} for x in ('fish','apple','loaf') if f'{c}:{x}' in OBJ and f'{c}:{x}'!=n][:2]
        vg=c
    else:
        bk=base_key(n); desc=D.get(n) or D.get(bk,'')
        if desc.startswith('='): desc=D[desc[2:-1]]
        rel=[{'id':a,'why':b} for a,b in REL.get(n,REL.get(bk,[]))]
        vg=bk or n
    rows=[]
    for yy in range(fh): rows.append('X'*fw if kind in ('floor','wall') else '.'*fw)
    over=(up+15)//16
    rules=[]
    if kind=='wall': rules.append('발밑 줄이 북쪽 벽면 바로 아래 첫 바닥 줄이어야 한다')
    if kind=='hang': rules.append('벽면 두 줄 중 윗줄(y=벽면 첫 줄)에 건다. 바닥 칸은 차지하지 않는다')
    if kind=='flat': rules.append('밟을 수 있다. 다른 기물 밑에 먼저 깐다')
    if up and kind!='hang': rules.append(f'그림이 발밑 칸 위로 {up}px 솟는다 → 위 {over}칸은 플레이어 위에 그리는 겹침층')
    if kind in ('floor','wall'): rules.append('출입문 칸과 문으로 이어지는 통로를 막지 않는다')
    if getattr(f,'surf',None): rules.append('윗면에 탁상 물건(goods:*)을 올린다. 비워 두지 않는다')
    m={'id':n,'name_ko':ko.ko(n),'name_en':n,'category':cat,'category_ko':ko.CAT.get(cat,cat),'tags':TAGS.get(cat,[]),'description':desc,
       'kind':kind,'kind_ko':kind_ko,'footprint':{'w':fw,'h':fh},'image':{'w':w,'h':h},'overhang_px':up,
       'cells':{'floor':rows,'overlayRowsAbove':over},'placement':rules,'related':rel,'variantGroup':vg}
    if getattr(f,'surf',None):
        x0,y0,x1,y1=f.surf; m['surface']={'rect_px':[x0,y0,x1,y1],'capacity':max(1,(x1-x0)//7),'note':'탁상 물건의 밑변을 윗면 안에 둔다'}
    if getattr(f,'frames',None): m['animation']={'frames':len(f.frames),'ms':180,'loop':True}
    return m
GOODS_KO={'papers':'종이 뭉치','inkwell':'잉크병과 깃펜','openbook':'펼친 책','bookstack':'책 더미','teapot':'찻주전자','bowl':'수프 그릇','vase':'꽃병','lamp':'등잔','bell':'손님 종','cashbox':'돈궤',
 'scissors':'가위','spools':'실패','dice':'주사위','cards':'카드','wineglass':'포도주 잔','board':'도마','knife':'칼','mortar':'절구(탁상)','scale':'저울(탁상)','pan':'프라이팬','soup':'수프','breadplate':'빵 접시',
 'fishplate':'생선 요리','fruitbowl':'과일 그릇','smallflask':'작은 플라스크','herbbundle':'약초 다발','clothfold':'접은 옷감','tongs':'집게','beer':'맥주잔','hammer':'망치','dagger':'단검'}
def goods_meta():
    out=[]
    for g,(f,a,b) in G.items():
        out.append({'id':'goods:'+g,'name_ko':GOODS_KO.get(g,ko.GK.get(g,g)),'kind':'tabletop','kind_ko':'탁상 물건(표면 위에만)','image':{'w':a,'h':b},
          'placement':['surface 가 있는 가구(식탁·책상·카운터·협탁·찻상·작업대·제단·서랍장) 윗면에만 놓는다','밑변을 윗면 안쪽에 맞춘다','바닥에 두지 않는다'],
          'description':f'{GOODS_KO.get(g,ko.GK.get(g,g))}. 탁상에 올리는 작은 물건이다. 그릇(궤짝·바구니·선반) 안 상품으로도 쓰인다.'})
    return out
def room_answers():
    rs=[]
    for k,r in rooms2.R.items():
        items=[]
        for it in r['items']:
            f,x,y=it[:3]; e={'id':f.id,'x':x,'y':y}
            if len(it)>3: e['on']=[{'goods':g,'fx':fx,'fy':fy} for g,fx,fy in it[3]]
            items.append(e)
        rs.append({'id':k,'name_ko':r['name'],'floor':r['floor'],'wall':r['wall'],'plan':r['plan'],'items':items,
          'rules':['벽 재질은 건물 하나에 하나','E-W 칸막이 틈은 문(1칸 이상), N-S 칸막이 틈은 3줄(벽면 2 + 걷는 1)','카운터 뒤 = 주인, 앞 = 손님, 주인은 뒷방 문으로 들어간다','탁상 물건은 반드시 가구 윗면에']})
    return rs
def atlas(objs_f,goods):
    # pack every chip into a 16-px-grid sheet: objects bottom-aligned in cells (height padded up to 16), animation frames
    # to the right of frame 0, goods one per 16x16 cell. Returns (sheet, rects)
    from PIL import Image
    W=640; x=y=0; rowh=0; rects={}; placed=[]
    for n,f in objs_f:
        frames=getattr(f,'frames',None) or [f.im]
        cw=f.im.width*len(frames); ch=((f.im.height+15)//16)*16
        if x+cw>W: x=0; y+=rowh; rowh=0
        rects[n]={'x':x,'y':y,'w':f.im.width,'h':ch,'frames':len(frames),'padTop':ch-f.im.height}
        placed.append((frames,x,y+ch-f.im.height)); x+=cw; rowh=max(rowh,ch)
    x=0; y+=rowh
    for g in goods:
        if x+16>W: x=0; y+=16
        rects['goods:'+g]={'x':x,'y':y,'w':16,'h':16}; placed.append((('G',g),x,y)); x+=16
    y+=16
    sheet=Image.new('RGBA',(W,y))
    import room3
    for fr,X,Y in placed:
        if isinstance(fr,tuple):
            gi=room3.good_img(fr[1]); sheet.alpha_composite(gi,(X+(16-gi.width)//2,Y+16-gi.height))
        else:
            for i,im in enumerate(fr): sheet.alpha_composite(im,(X+i*im.width,Y))
    return sheet,rects
if __name__=='__main__':
    objs=[]; built=[]
    for n,(c,b) in OBJ.items():
        f=b(); built.append((n,f)); objs.append(meta_for(n,f))
    sheet,rects=atlas(built,list(G))
    sheet.save('/tmp/j8v5/interior-atlas.png')
    for o in objs: o['atlas']=rects[o['id']]
    gm=goods_meta()
    for g in gm: g['atlas']=rects[g['id']]
    data={'version':1,'tileSize':16,'view':'정면-위 고정(RPG 쯔꾸르)','objects':objs,'goods':gm,'atlas':{'file':'interior-atlas.png','cell':16},'rooms':room_answers(),
          'conventions':{'plan':"'#' 벽·천장, '.' 실내. 벽 아래 두 줄은 벽면(못 걸음).",'kinds':{'floor':'막힘','wall':'북쪽 벽 앞, 막힘','hang':'벽면','flat':'밟음','tabletop':'가구 윗면'},'chairFacing':'S N E W = 바라보는 방향'}}
    json.dump(data,open('/tmp/j8v5/interior-meta.json','w'),ensure_ascii=False,indent=1)
    miss=[o['id'] for o in objs if not o['description']]
    print(len(objs),len(data['goods']),len(data['rooms']),'missing desc:',miss[:20])
