# Regenerates refs/ : chipset style crops, accepted sheets, and rejected-vs-accepted pairs with the reason.
# usage: python3 make_refs.py   (PX_CHIPSET overrides the chipset path)
import os, sys
HERE=os.path.dirname(os.path.abspath(__file__)); SK=os.path.dirname(HERE)
sys.path.insert(0,HERE); sys.path.insert(1,os.path.join(HERE,'rejected_v1'))
from PIL import Image, ImageDraw, ImageFont
import sheet2, pa, pb, pc, pd, pe, zig, zig2, rejected_examples as rej
import pieces as v1
R=os.path.join(SK,'refs')
for d in ('chipset','good','rejected'): os.makedirs(os.path.join(R,d),exist_ok=True)
F=ImageFont.truetype('/usr/share/fonts/truetype/nanum/NanumSquare_acR.ttf',18)
FB=ImageFont.truetype('/usr/share/fonts/truetype/nanum/NanumSquareRoundB.ttf',20)
lawn,water=sheet2.lawn,sheet2.water
RED=(255,110,100); GRN=(120,230,130); YEL=(255,220,120)
def on(im,bg=None,S=4): return sheet2.card(im,wat=(bg is water),S=S)[0]
def label(im,text,color=(230,230,230),top=None):
    h=60 if top else 34
    tw=max(F.getlength(text),FB.getlength(top) if top else 0)+14
    out=Image.new('RGBA',(int(max(im.width,tw)),im.height+h),(27,28,31,255)); out.paste(im,(0,h)); d=ImageDraw.Draw(out)
    if top: d.text((6,4),top,font=FB,fill=color); d.text((6,32),text,font=F,fill=(200,200,200))
    else: d.text((6,8),text,font=F,fill=color)
    return out
def hjoin(ims,gap=16):
    o=Image.new('RGBA',(sum(i.width for i in ims)+gap*(len(ims)-1),max(i.height for i in ims)),(27,28,31,255)); x=0
    for i in ims: o.paste(i,(x,0)); x+=i.width+gap
    return o
def vjoin(ims,gap=16):
    o=Image.new('RGBA',(max(i.width for i in ims),sum(i.height for i in ims)+gap*(len(ims)-1)),(27,28,31,255)); y=0
    for i in ims: o.paste(i,(0,y)); y+=i.height+gap
    return o
def pair(name,bad,badnote,good,goodnote,why):
    img=label(hjoin([label(bad,badnote,RED,top='[거절]'),label(good,goodnote,GRN,top='[통과]')],24),why,YEL)
    img.save(os.path.join(R,'rejected',name+'.png'))
def onl(im):
    bg=Image.new('RGBA',im.size)
    for x in range(0,im.width,16):
        for y in range(0,im.height,16): bg.paste(lawn,(x,y))
    bg.alpha_composite(im); return bg
def up(im,S): return im.resize((im.width*S,im.height*S),Image.NEAREST)
# chipset style
chip=Image.open(os.environ.get('PX_CHIPSET','/home/main/z-project/rpg-zzu/public/assets/atlas-biomes/jungle-chipset.png')).convert('RGBA')
for nm,box in (('props-a',(288,128,480,256)),('props-b',(288,384,480,480)),('bridge-and-signs',(288,224,400,256))):
    up(chip.crop(box),5).save(os.path.join(R,'chipset',nm+'.png'))
# pairs
v=lambda f,*a: on(f(*a).img())
pair('01-flat-bands-vs-textured',hjoin([v(v1.serpent),v(v1.boulder),v(v1.pillar)]),'평탄한 색 띠·결 없음 (v1)',
     hjoin([v(pa.P['뱀 석두상']),v(pa.P['물가 바위']),v(pa.P['무너진 기둥 (선 것)'])]),'재질 결·6단 명암·최암색 윤곽 (px2)',
     '왜: 칩셋 옆에 두면 싸구려로 보인다. 칩셋은 결이 촘촘하다 — chipset/ 를 먼저 봐라')
pair('02-oblique-vs-front-view',hjoin([v(rej.tent_teepee),v(rej.tent_oblique)]),'원뿔(작음) / 비스듬히 돌린 천막',
     v(pb.P['야영 천막']),'정면-위 고정 시점, 좌우 대칭, 3×3',
     '왜: 칩셋의 모든 물건은 정면에서 내려다본다. 돌리면 "시야각이 이상"')
def scene(im):
    sc=Image.new('RGBA',(96,64))
    for x in range(0,96,16):
        for y in range(0,64,16): sc.paste(lawn if (x<16 or x>=80) else water,(x,y))
    for x in range(16,80,16): sc.alpha_composite(im,(x,24))
    return up(sc,4)
pair('03-bridge',hjoin([scene(rej.bridge_fence().img()),scene(rej.bridge_boxes().img())]),'울타리처럼 / 상자 줄처럼 읽힘',
     scene(pa.P['통나무 다리 (가로)']().img()),'칩셋 다리 관용: 윗면 + 앞 단면 + 물 그림자',
     '왜: 이어 붙는 조각은 강을 건너는 장면으로 판정한다. chipset/bridge-and-signs 를 따라라')
grand=zig.render(*zig.build_grand([(17,4),(15,3),(13,3),(11,2)],stair_w=3,shrine_w=5,decor_seed=3),lawn)
walk=zig2.render(*zig2.build(),lawn)
pair('04-temple',hjoin([on(pa.P['계단식 제단']().img(),S=3),up(grand,2)]),'통째 그림 제단 / 정면 입면도(벽 위에 벽)',
     up(walk,2),'층 윗면 = 걸어 다닐 테라스, 벽은 앞끝 1~3줄, 꼭대기 광장',
     '왜: 탑다운 맵이다 — "위에서 보면 돌아다닐 공간". 큰 건물은 조각 조립')
top=lambda im: up(im.crop((96,0,272,120)),3)
pair('05-summit-crest',top(grand),'높은 투각 지붕 볏',top(walk),'지붕 가운데 낮은 받침 + 보석',
     '왜: 볏이 떠 보이고 묘비처럼 읽혔다')
pair('06-misreads',hjoin([on(v1.lily(0).img(),water),v(v1.pitcher)]),'수련 = 초록 공 / 벌레잡이 = 선인장',
     hjoin([on(pa.P['수련 잎 A']().img(),water),v(pb.P['벌레잡이 식물'])]),'갈라진 틈·잎맥 / 불룩한 주머니·빨간 입구·뚜껑',
     '왜: "다른 물건으로 읽히지 않는가"를 7~8배 확대로 매번 확인한다')
v4=lambda m,n,wat=None: on(m.P[n]().img(),wat)
pair('07-flat-halves-vs-volume',hjoin([v4(pd,'돌 우물'),v4(pd,'덩굴 감긴 오벨리스크'),v4(pd,'흰개미 둔덕'),v4(pd,'통나무 카누',water)]),
     '돌 = 결 노이즈만 / 밝은 반쪽·어두운 반쪽 두 덩어리 / 납작한 판',
     hjoin([v4(pe,'돌 우물'),v4(pe,'덩굴 감긴 오벨리스크'),v4(pe,'흰개미 둔덕'),v4(pe,'통나무 카누',water)]),
     '돌 한 장씩(줄눈)·둥근 바닥 / 모서리 빛·파인 문양 / 골 있는 원뿔 / 파인 속·휜 이물',
     '왜: "허접". 통과한 석두·토템 옆에 같은 배율로 놓고 비교한 뒤에만 보여 준다')
pair('08-hut-single-vs-kit',v4(pd,'부족 오두막 (기둥 위)'),'3×3 통째 그림 한 장',
     hjoin([up(pe.P['기둥 오두막 3칸']().img(),4),up(pe.P['기둥 오두막 7칸']().img(),4)]),'열 5종 × 줄 4종 조각, 어떤 너비든 조립',
     '왜: 집·오두막도 건물이다 — 조립형. 잘라 낸 조각으로 다른 너비를 다시 붙여 픽셀 동일을 증명')
import pf_v1, pf
pair('09-view-by-eye',hjoin([up(onl(chip.crop((396,396,428,428))),4),v4(pf_v1,'시공의 문'),v4(pf_v1,'술통 더미')]),
     '칩셋 술통 옆: 세워 놓은 원반 같은 문 / 뚜껑 크고 키 큰 술통(그루터기처럼 읽힘)',
     hjoin([up(onl(chip.crop((396,396,428,428))),4),v4(pf,'시공의 문'),v4(pf,'술통 더미')]),
     '분수 수반만큼 납작하게 누운 문 / 얇은 뚜껑·통통한 술통',
     '왜: 시야각은 숫자가 아니라 눈으로 본다. review.py 로 칩셋 물건 옆에 두고 조각마다 판정')
import pg, pj_demo
pair('10-whole-house-vs-blocks',up(pg.build(7,2).img(),3),'너비·층수를 넣으면 집 한 채를 통째로 그려 자름',
     hjoin([pj_demo.render(n,pj_demo.H[n],grid=True) for n in list(pj_demo.H)[2:5]]),'칸마다 블록 이름을 찍어 조립 (1층 돌+2층 목조, 3층 탑, 높이 다른 두 채)',
     '왜: "통짜로 짓지 말고 블록 조립형". 블록은 서로 독립이고, 집은 블록 이름 격자다')
_vb=Image.open(os.path.join(HERE,'rejected_v1','village_before.png')); _va=Image.open(os.path.join(HERE,'rejected_v1','village_after.png'))
pair('11-palette-and-shadow',up(_vb.crop((128,16,432,320)),2),'재질마다 임의 색, 드리운 그림자 없음 (밋밋·slop)',
     up(_va.crop((128,16,432,320)),2),'고정 팔레트 67색 + 왼쪽 위 빛, 오른쪽 아래 그림자',
     '왜: "그림자·대비… 팔레트를 정해 놓고 써야". palette.apply() 먼저, 장면은 그림자까지')
# accepted
def sheet(mods,cols=7):
    cards=[label(on(f().img(),water if n in m.WATER else None),n) for m in mods for n,f in m.P.items() if n!='계단식 제단']
    return vjoin([hjoin(cards[i:i+cols]) for i in range(0,len(cards),cols)])
sheet([pa]).save(os.path.join(R,'good','objects-ruins-water.png'))
sheet([pb]).save(os.path.join(R,'good','objects-plants-camp.png'))
sheet([pc]).save(os.path.join(R,'good','objects-extra.png'))
up(walk,3).save(os.path.join(R,'good','temple-walkable-4tier.png'))
up(zig2.render(*zig2.build(n=3,seed=4),lawn),3).save(os.path.join(R,'good','temple-walkable-3tier.png'))
cells=[label(up(zig.T[k],4),k) for k in zig.T]
vjoin([hjoin(cells[i:i+10],8) for i in range(0,len(cells),10)],8).save(os.path.join(R,'good','temple-kit-pieces.png'))
print('refs written to',R)
PD_REJ={'돌 우물','통나무 카누','덩굴 감긴 오벨리스크','흰개미 둔덕','부족 오두막 (기둥 위)'}
hjoin([label(on(f().img(),water if n in pd.WATER else None),n) for n,f in pd.P.items() if n not in PD_REJ]).save(os.path.join(R,'good','objects-batch4.png'))
pe_cards=[label(on(pe.P[n]().img(),water if n in pe.WATER else None),n) for n in ('돌 우물','통나무 카누','덩굴 감긴 오벨리스크','흰개미 둔덕')]
hjoin(pe_cards).save(os.path.join(R,'good','objects-batch4-redraw.png'))
cols=pe.hut_build(7,door=2,windows=(1,4)); ref=pe._hut_canvas(cols).img(); cells=[]
for kind,i in (('L',0),('W',1),('D',2),('M',3),('R',6)):
    for r in range(4):
        t=Image.new('RGBA',(16,16)); t.paste(lawn,(0,0)); t.alpha_composite(ref.crop((i*16,r*16,i*16+16,r*16+16))); cells.append(label(up(t,5),f'{kind}{r}'))
vjoin([hjoin(cells[k::4],8) for k in range(4)],8).save(os.path.join(R,'good','hut-kit-pieces.png'))
