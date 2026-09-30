import sys, json; sys.path.insert(0,'/tmp/j8city')
import palette; palette.apply()
import pz, pzmeta, pe, pl, ground
from PIL import Image
FOOT={'stall_cheese_meat':2,'stall_jug_bottle':2,'stall_herb_flower':2,'stall_veg':2,'fountain_small':2,'fish_pool':2,'statue_sage':2,'well_roofed':2}
OVERLAY={'laundry_line','festoon','stair_rail'}
def entry(name,im,iid,en,desc,cat,tags,rules,rel,var,frames):
    fw=-(-im.width//16); ht=-(-im.height//16)
    foot=0 if (iid in OVERLAY or iid.startswith('sign_')) else FOOT.get(iid,1)
    grid=['O'*fw]*(ht-foot)+['B'*fw]*foot
    return dict(id=iid,name_ko=name,name_en=en,description_ko=desc,category=cat,tags=tags,footprint_cells=[fw,foot],image_px=[im.width,im.height],
        overhang_up_px=max(0,im.height-foot*16),role_grid=dict(rows=grid,anchor='맨 아랫줄 왼쪽 칸 = 배치 좌표'),
        placement_rules=list(rules)+(['문 앞 2칸·성문 통로·계단 앞뒤 2칸·다리 끝 금지','통행로 연결을 끊지 않음(BFS 재확인)'] if foot else []),
        related=rel,variants_group=var,animation_frames=frames,status='v4',drawn_by='/tmp/j8city/pz.py')
out=[]
for name,(fn,cells,where) in pz.P.items():
    o=fn(); im=o if isinstance(o,Image.Image) else pz.fin(o)
    if name.startswith('걸이 간판: '):
        tr=[k for k,v in pz.SIGN_NAME.items() if v==name.split(': ')[1]][0]
        out.append(entry(name,im,'sign_'+tr,f'Hanging sign ({pzmeta.TRADE_EN[tr]})',f'쇠 팔걸이에 매단 {pz.SIGN_NAME[tr]} 간판. 그 가게 문 오른쪽 1층 벽에 붙이고, 문 옆에 같은 업종 물건을 내놓는다.',
            'shop-sign',['shop',tr],['집 문 오른쪽 벽(문 칸+1), 1층 높이','발자국 없음(벽 겹침층)','같은 업종 물건 1~2개를 문 옆 칸에'],
            [dict(id=r,why='같은 가게 앞에 내놓는 물건') for r in pzmeta.TRADE_REL[tr]],'hanging_sign',None)); continue
    iid,en,desc,cat,tags,rules,rel,var,frames=pzmeta.M[name]
    out.append(entry(name,im,iid,en,desc,cat,tags,rules,rel,var,frames))
for name in ('돌 우물 (지붕)','꽃밭'):
    o=(pe.P['돌 우물'] if name.startswith('돌') else pl.P['꽃밭'])(); im=pz.fin(o) if hasattr(o,'img') else o
    iid,en,desc,cat,tags,rules,rel,var,frames=pzmeta.M[name]; e=entry(name,im,iid,en,desc,cat,tags,rules,rel,var,frames); e['drawn_by']='pe.py / pl.py (accepted earlier pieces)'; out.append(e)
b=pz.bridge_ew(4)
out.append(dict(id='bridge_ew',name_ko='동서 돌다리',name_en='East-west stone bridge',description_ko='남북으로 흐르는 강을 동서로 건너는 2칸 폭 돌다리. 북쪽 난간 윗면, 자갈 상판 2줄, 남쪽 난간과 아치가 뚫린 두꺼운 앞면, 물 위 그림자.',
    category='street',tags=['river','street'],footprint_cells=[4,2],image_px=[b.width,b.height],overhang_up_px=5,
    role_grid=dict(rows=['OOOO','WWWW','WWWW','OOOO'],anchor='상판 첫 줄 왼쪽 칸 = (bx,by), 그림은 (bx*16-4, by*16-5)',legend={'W':'상판 (통행)','O':'북쪽 난간 윗부분·남쪽 앞면 (물 위, 겹침층)'}),
    placement_rules=['강 양쪽 둑에 같은 줄 2칸 폭 길이 있을 때만','강 폭 4칸을 가로로 덮음, 판석 결은 길과 같은 방향','세로(남북) 띠로 깔지 않음 — v3 거절 사유'],
    related=[dict(id='lamp_crook',why='다리 머리 가로등')],variants_group='bridge',animation_frames=None,status='v4',drawn_by='pz.bridge_ew'))
GROUND=[('grass_lawn','기본 잔디','Base lawn',(0,128),'칩셋 기본 잔디. 땅 전체의 바탕.','나머지 전부'),
 ('grass_meadow','밝은 풀밭','Light meadow',(304,304),'칩셋의 밝고 잘게 얼룩진 풀. 큰 덩어리(약 70px 규모) 노이즈로 바탕 위에 섞는다.','노이즈 > 0.60 인 덩어리'),
 ('grass_shade','나무 밑 짙은 풀','Shade grass',(112,2144),'칩셋의 짙은 풀. 나무 수관 아래와 둘레(흐림 9px)에 깔고, 드물게 노이즈 덩어리로도.','나무 칸 둘레 + 노이즈 > 0.83'),
 ('grass_flower','들꽃 풀','Wildflower grass',(112,608),'노란 들꽃 점이 박힌 칩셋 풀. 작은 덩어리(20px 규모)로, 짙은 풀 위에는 안 깐다.','노이즈 > 0.70, 짙은 풀 제외'),
 ('grass_worn','길가 닳은 풀','Worn grass',(16,1776),'칩셋 올리브빛 흙풀의 가운데 8×8. 자갈길 연석 바깥 3px 띠에 노이즈로 끊어 깐다.','길에서 3px 안, 노이즈 > 0.52')]
for gid,ko,en,xy,desc,rule in GROUND:
    out.append(dict(id=gid,name_ko=ko,name_en=en,description_ko=desc,category='ground',tags=['ground','grass'],footprint_cells=[1,1],image_px=[16,16],overhang_up_px=0,
        role_grid=dict(rows=['W']),placement_rules=[rule,'칸 단위 무작위 점찍기 금지: 픽셀 단위 덩어리 노이즈 + ±0.05 디더 경계','ground.py render()'],
        related=[dict(id=g[0],why='같은 땅 섞기 묶음') for g in GROUND if g[0]!=gid],variants_group='grass',animation_frames=None,status='v4',source=f'jungle-chipset {xy[0]},{xy[1]}'))
DROPPED=['rope_coil','lobster_pots','buoys','horseshoe_board','bollards_chain','wall_fountain','tarp_pile','oar_rack','advert_column','gazebo','stall_tent','stall_carpet']
pl_=json.load(open('/tmp/j8city/city4_placements.json'))
meta=dict(schema='oprn.prop-meta/v0 (draft)',source='버들항 v4 (100x100, 16px)',coords='cell x,y = footprint top-left; px,py = image top-left in map pixels',
    dropped_since_v3=dict(ids=DROPPED,why='적대적 QA: 1배·3배에서 무엇인지 안 읽히거나(밧줄·통발·부표·편자 판·쇠사슬·가면 샘·천 짐·노 거치대·광고 기둥·정자) 광장에 안 들어감'),
    props=out,city_placements=pl_)
json.dump(meta,open('/tmp/j8city/meta.json','w'),ensure_ascii=False,indent=1)
print(len(out),'entries',len(pl_),'placements')
