# v4 metadata: every chip (objects incl. the new ones), the autotile surface kit with neighbour rules, tabletop goods
# (animated ones too), and every building as answer arrays: floors/links, items + things on them, must-clear cells and
# the passage-check result. Writes interior-meta.json + interior-atlas.png.
import sys, json; sys.path.insert(0,'/tmp/j8v5')
import rooms4, room4, anim4, kit4, ko, meta
from kit4 import OBJ, STY, PIECES, mask_of
from mat import G
from PIL import Image
NEW_KO={'firewood rack':'장작 선반','firewood rack 2w':'장작 선반(2칸)','firewood bundle':'장작 묶음','proofing rack':'발효 선반','stairwell down':'내려가는 계단통(2층)',
 'broom and bucket':'빗자루와 양동이','towel rail':'수건걸이','tall stained window':'큰 색유리창(2칸)','aisle runner':'통로 양탄자(2칸)','coal bin':'숯 통',
 'bread shelf':'빵 선반','bread shelf pie':'빵 선반(파이·케이크)','bread shelf baguette':'빵 선반(바게트)','peel rack':'화덕 삽 걸이','kitchen range':'조리 화덕(레인지)'}
ko.UK.update(NEW_KO)
_ko=ko.ko
def ko2(n):
    for st,s in STY.items():
        if n.startswith(st+' ') and 'x' in n.split(' ')[-1]:
            w,h=n.split(' ')[-1].split('x'); return f"{s['ko']} {w}×{h}"
    return _ko(n)
ko.ko=ko2
meta.D.update({
 'dining':'나무 식탁(자동 타일 조립, 크기 자유). 윗면에 접시·잔·촛대를 올리고 의자를 둘러 놓는다. 의자가 한 줄로 막히지 않게 뒤로 걸을 줄을 남긴다.',
 'work':'밝은 소나무 작업대(자동 타일 조립). 업종 도구를 올린다: 빵집=반죽·밀대, 대장간=집게·편자, 부엌=도마·그릇.',
 'desk':'서랍 받침이 달린 짙은 책상(자동 타일 조립). 윗면에 종이·깃펜·촛대·지구의. 남쪽에 북쪽을 보는 의자(chair N).',
 'display':'흰 천을 덮은 진열 탁자(자동 타일 조립). 가게 한가운데 섬처럼 두고 빵 바구니·접은 옷감 같은 상품을 올린다.',
 'counter':'가게 카운터(자동 타일, 한 줄 동서로만 이어진다). 북쪽 = 주인 자리, 남쪽 = 손님 자리. 출입문 가까이 둔다.',
 'kcounter':'부엌 조리대: 돌 상판 + 소나무 찬장 문(자동 타일, 동서 한 줄). 북쪽 벽에 붙이고 도마·그릇·냄비를 올린다.',
 'sideboard':'짙은 나무 낮은 찬장(자동 타일, 동서 한 줄). 식당 북쪽 벽, 위에 촛대·접시.',
 'tea':'붉은 천을 덮은 찻상(자동 타일). 안락의자·소파 곁, 찻주전자·찻잔을 올린다.',
 'firewood rack':'벽에 붙인 장작 선반. 장작을 남북으로 눕혀 쌓아 둥근 단면이 정면으로 보인다(1×2 그림, 발밑 1칸). 화덕·벽난로·레인지 바로 옆.',
 'firewood bundle':'바닥에 눕혀 둔 장작 두 개(동서로 누워 나무껍질 길이와 서쪽 단면이 보인다). 벽난로 옆 1칸.',
 'proofing rack':'반죽을 부풀리는 발효 선반(천 깐 판 세 단). 빵집 굽는 방 북쪽 벽.',
 'stairwell down':'2층 바닥의 내려가는 계단통(3×2, 난간 셋). 1층 올라가는 계단과 같은 (x,y) 에 둔다 → 1층 이동 이벤트.',
 'broom and bucket':'빗자루와 물 양동이. 하녀 방·부엌 구석.',
 'towel rail':'놋쇠 수건걸이(벽면 윗줄). 욕실.',
 'tall stained window':'제단 뒤 벽 가운데에 거는 큰 아치 색유리창(2칸, 벽면 윗줄에서 아래로). 좌우 대칭의 중심.',
 'aisle runner':'예배당 가운데 통로의 2칸 폭 붉은 양탄자(밟을 수 있음). 입구에서 제단까지 잇는다.',
 'coal bin':'숯이 담긴 나무 통. 대장간 화로 바로 옆.',
 'bread shelf':'손님이 빵을 고르는 벽 빵 선반(3단). 빵집 가게 북쪽 벽.',
 'peel rack':'화덕 삽 두 자루를 건 벽 걸이(벽면 윗줄). 빵 화덕 곁.',
 'kitchen range':'조리 화덕(레인지): 벽돌 몸체, 쇠 화판 윗면(냄비를 올리는 표면), 불 문 애니메이션, 벽면에 굴뚝과 쇠 후드. 부엌 북쪽 벽.',
 'fur rug':'모피 깔개(2×2, 밟을 수 있음). 벽난로 앞.',
})
meta.REL.update({
 'kitchen range':[('goods:stewpot','화판 위(끓는 냄비, 움직임)'),('goods:kettle_steam','화판 위'),('kcounter 2x1','옆 조리대'),('kitchen sink','같은 벽'),('firewood rack','옆')],
 'firewood rack':[('bread oven','옆'),('kitchen range','옆'),('fireplace','옆')],
 'bread oven':[('firewood rack','바로 옆'),('peel rack','위 벽면'),('proofing rack','같은 방'),('work 3x1','반죽대(위에 반죽·밀대)')],
 'bread shelf':[('display 2x1','가게 가운데 진열 탁자'),('counter 3x1','문 옆 계산대'),('goods:breadbasket','진열 탁자 위')],
 'desk':[('chair N','남쪽'),('goods:globe_s','위'),('goods:candlestick','위'),('goods:papers','위'),('goods:quill','위'),('bookshelf 3w','같은 방 북쪽 벽')],
 'stairwell down':[('stairs up wood','1층 같은 (x,y)')],
 'stairs up':[('stairwell down','2층 같은 (x,y)')],
 'forge':[('anvil','앞 1~2칸'),('quench barrel','모루 옆'),('coal bin','옆'),('tool wall','위 벽면')],
 'dining':[('chair S','북쪽 줄(남쪽을 봄)'),('chair N','남쪽 줄'),('chair E','서쪽 끝'),('chair W','동쪽 끝'),('goods:plates','위')],
 'counter':[('goods:cashbox','위'),('goods:bell','위'),('bread shelf','주인 뒤 벽')],
})
_mf=meta.meta_for
SEAM={}
def meta_for(n,f):
    m=_mf(n,f)
    m['name_ko']=ko.ko(n)
    if getattr(f,'frames',None):
        s=SEAM.get(n) or anim4.seamless(f); SEAM[n]=s
        m['animation']={'frames':len(f.frames),'ms':getattr(f,'ms',anim4.MS),'loop':True,'seamless':s['periodic'],
                        'wrapStepPx':s['wrapStepPx'],'meanStepPx':s['meanStepPx'],'note':'모든 움직임이 12프레임 안에 정수 번 도는 주기 함수 → 마지막→첫 프레임이 끊기지 않는다'}
    if getattr(f,'style',None):
        st=f.style; m['autotile']={'kit':st,'size':[f.fw,f.fh],'pieces':'autotile:'+st,'how':'각 칸을 이웃 규칙(N E S W)으로 조각을 골라 붙인다'}
    if n in ('stairwell down',): m['link']={'pairsWith':'stairs up *','rule':'아래층 올라가는 계단과 같은 (x,y) 에 둔다'}
    if n.startswith('stairs up'): m['link']={'pairsWith':'stairwell down','rule':'위층 내려가는 계단통과 같은 (x,y) 에 둔다'}
    if n=='globe': m['placement'].append('바닥용은 쓰지 않는다 — 지구의는 책상 위 goods:globe_s')
    return m
meta.meta_for=meta_for
def autotile_meta():
    out=[]
    for st,s in STY.items():
        P=PIECES[st]; pcs=[]
        for (cc,rc),im in sorted(P.items()):
            pcs.append({'piece':f'{cc}{rc}','neighbours':mask_of(cc,rc),
                        'rule':{'col':{'S':'동서 이웃 없음','L':'동쪽만 이어짐','M':'동서 모두 이어짐','R':'서쪽만 이어짐'}[cc],
                                'row':{'S':'남북 이웃 없음','T':'남쪽만 이어짐','M':'남북 모두 이어짐','B':'북쪽만 이어짐'}[rc]},
                        'image':{'w':im.width,'h':im.height}})
        out.append({'id':'autotile:'+st,'name_ko':s['ko']+' 자동 타일','kind':'autotile','up_px':s['up'],
          'oneRow':kit4.ONE_ROW(st),'pieces':pcs,
          'assemble':'W×H 칸의 각 칸 (i,j) 에 대해 서쪽 이웃 있음=i>0, 동쪽=i<W-1, 북쪽=j>0, 남쪽=j<H-1 → 열 S/L/M/R · 행 S/T/M/B 조각. 맨 윗줄 조각은 up_px 만큼 위로 솟는다.',
          'surface':'rect_px = (2, ty0+2, W*16-3, te-1); ty0/te 는 스타일 고정값 — 조립한 크기마다 meta 의 surface 를 쓴다',
          'selfcheck':'조립 결과 = 같은 크기를 한 번에 그린 그림 (픽셀 동일), 6가지 크기에서 검증'})
    return out
NEW_GOODS_KO={'globe_s':'탁상 지구의','breadbasket':'빵 바구니','loafrow':'식빵 한 줄','baguettes':'바게트 묶음','doughball':'반죽 덩이','rollingpin':'밀대','flourbowl':'밀가루 그릇',
 'kettle':'주전자','pot':'냄비','ladle':'국자','plates':'접시 더미','candlestick':'탁상 촛대','washbowl':'세숫대야','pitcher':'물주전자','sealbox':'인장 상자','quill':'깃펜','keys':'열쇠 꾸러미'}
meta.GOODS_KO.update(NEW_GOODS_KO)
def goods_meta():
    gm=meta.goods_meta()
    for name,fr in anim4.GA.items():
        gm.append({'id':'goods:'+name,'name_ko':{'stewpot':'끓는 냄비(움직임)','kettle_steam':'김 나는 주전자(움직임)'}[name],'kind':'tabletop',
          'kind_ko':'탁상 물건(표면 위에만)','image':{'w':fr[0].width,'h':fr[0].height},
          'placement':['조리 화덕(kitchen range) 화판이나 부엌 조리대 위에만','바닥에 두지 않는다'],
          'animation':{'frames':len(fr),'ms':anim4.MS,'loop':True,'seamless':anim4.ga_seamless(name,anim4.GA_FN[name])},
          'description':'끓는 수프 냄비: 거품이 부풀었다 터지고 김이 세 줄기로 오른다.' if name=='stewpot' else '주전자 주둥이에서 김이 오른다.'})
    return gm
def building_answers():
    out=[]
    for k in rooms4.ORDER:
        b=rooms4.B[k]; maps=[]
        for m in b['maps']:
            r=room4.check(m); items=[]
            for it in m['items']:
                f,x,y=it[:3]; e={'id':getattr(f,'id',''),'x':x,'y':y,'kind':f.kind,'w':f.fw,'h':f.fh}
                if len(it)>3: e['on']=[{'goods':g,'fx':fx,'fy':fy} for g,fx,fy in it[3]]
                items.append(e)
            maps.append({'id':m['key'],'name_ko':m['name'],'floor':m['floor'],'wall':m['wall'],
              'zones':[{'x0':a,'y0':b_,'x1':c,'y1':d,'floor':ff,'wall':ww} for a,b_,c,d,ff,ww in m.get('zones',())],
              'plan':m['plan'],'items':items,'links':m.get('links',[]),'start':m.get('start'),
              'mustClear':[list(c) for c in r['mustClear']],
              'passageCheck':{'ok':r['ok'],'rooms':r['rooms'],'usesOk':r['usesOk'],'usesTotal':r['usesTotal'],'issues':r['issues'],
                              'reachableCells':r['reachableCells'],'floorCells':r['floorCells']},
              'grid':r['grid'],'gridLegend':r['legend']})
        out.append({'id':k,'name_ko':b['name'],'maps':maps})
    # stairs pairing check
    return out
def stair_pairs(bs):
    res=[]
    for b in bs:
        ms={m['id']:m for m in b['maps']}
        for m in b['maps']:
            for l in m['links']:
                if l['kind']=='stairs_up':
                    other=ms.get(l['to']); ok=False
                    if other:
                        ok=any(l2['kind']=='stairs_down' and (l2['x'],l2['y'])==(l['x'],l['y']) for l2 in other['links'])
                        ok=ok and any(it['id']=='stairwell down' and (it['x'],it['y'])==(l['x'],l['y']) for it in other['items'])
                        ok=ok and any(it['id'].startswith('stairs up') and (it['x'],it['y'])==(l['x'],l['y']) for it in m['items'])
                    res.append({'building':b['id'],'from':m['id'],'to':l['to'],'x':l['x'],'y':l['y'],'aligned':ok})
    return res
if __name__=='__main__':
    objs=[]; built=[]
    for n,(c,bf) in OBJ.items():
        f=bf(); f.id=getattr(f,'id',None) or n; built.append((n,f)); objs.append(meta_for(n,f))
    # atlas: objects, then autotile pieces, then goods (animated goods: frames to the right)
    sheet,rects=meta.atlas(built,list(G))
    # append autotile pieces and animated goods below
    extra=[]; y=sheet.height; x=0; W=sheet.width; rowh=0
    for st in STY:
        for (cc,rc),im in sorted(PIECES[st].items()):
            if x+16>W: x=0; y+=rowh; rowh=0
            rects[f'autotile:{st}#{cc}{rc}']={'x':x,'y':y,'w':16,'h':im.height}; extra.append((im,x,y)); x+=16; rowh=max(rowh,im.height)
        x+=16
    x=0; y+=rowh+16
    for name,fr in anim4.GA.items():
        rects['goods:'+name]={'x':x,'y':y,'w':16,'h':16,'frames':len(fr)}
        for i,im in enumerate(fr): extra.append((im,x+i*16+(16-im.width)//2,y+16-im.height))
        y+=16
    big=Image.new('RGBA',(W,y+16)); big.alpha_composite(sheet,(0,0))
    for im,X,Y in extra: big.alpha_composite(im,(X,Y))
    big.save('/tmp/j8v5/interior-atlas.png')
    for o in objs: o['atlas']=rects[o['id']]
    gm=goods_meta()
    for g in gm: g['atlas']=rects[g['id']]
    at=autotile_meta()
    for a in at:
        for p in a['pieces']: p['atlas']=rects[f"{a['id']}#{p['piece']}"]
    bs=building_answers(); pairs=stair_pairs(bs)
    data={'version':4,'tileSize':16,'view':'정면-위 고정(RPG 쯔꾸르 2000 / EasyRPG RTP 규칙)','objects':objs,'autotiles':at,'goods':gm,
          'atlas':{'file':'interior-atlas.png','cell':16},'buildings':bs,'stairPairs':pairs,
          'conventions':{'plan':"'#' 벽·천장, 그 밖은 실내. 막힌 칸 바로 아래 두 줄은 벽면(못 걸음).",
            'partition':'동서 칸막이 틈 = 문(1~2칸). 남북 칸막이 틈 = 3줄(벽면 2 + 걷는 1).',
            'wallMaterial':'벽 재질은 이어진 벽 하나에 하나. 기능이 다르면(빵 굽는 방·부엌·욕실) 칸막이 뒤 방 단위로만 바꾼다.',
            'hangings':'걸이는 벽면 두 줄 중 윗줄에만. 걸이끼리, 또 벽면을 덮는 큰 가구(오르간·책장·계단)와 겹치지 않는다.',
            'surfaces':'탁상 물건은 surface 가 있는 가구 위에만. 바닥에 두지 않는다.',
            'passage':'정답 배열마다 BFS: 출입구(2층은 계단 도착 칸)에서 모든 방·모든 가구의 사용 칸(카운터 앞뒤, 침대 옆, 의자 옆, 벽 가구 앞, 계단 아래)에 닿아야 하고, 문·통로 칸(mustClear)은 비워 둔다.',
            'kinds':{'floor':'막힘','wall':'북쪽 벽 앞, 막힘','hang':'벽면 윗줄','flat':'밟음','tabletop':'가구 윗면','autotile':'조각 조립'},
            'chairFacing':'S N E W = 바라보는 방향'}}
    json.dump(data,open('/tmp/j8v5/interior-meta.json','w'),ensure_ascii=False,indent=1)
    miss=[o['id'] for o in objs if not o['description']]
    print('objects',len(objs),'autotile sets',len(at),'pieces',sum(len(a['pieces']) for a in at),'goods',len(gm),'buildings',len(bs),'maps',sum(len(b['maps']) for b in bs))
    print('missing desc',miss); print('stairs',pairs)
    print('anim',{k:v for k,v in SEAM.items()})
