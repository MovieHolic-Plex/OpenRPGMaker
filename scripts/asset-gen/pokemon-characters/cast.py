"""Individually authored cast identities and native head clusters.

Each role has four explicit head views; right/left faces are authored separately.
Glyphs: o outline, h/H hair, s/t skin, w/v light cloth, a/b signature cloth,
p/q trousers, r shoe, g prop, d deep detail. Transparent '.' is never painted.
"""
from dataclasses import dataclass

@dataclass(frozen=True)
class Role:
    name:str
    label:str
    head:str
    outfit:str
    pose:str
    colors:tuple
    skin:tuple=('f4c39b','ce9070')

ROLES=[
 Role('hero','주인공','cap','vest','orb',('253f68','496d91','f2eee0','a9c3cc','d5503c','9a352f','243f60','162d48','bf6238','eab052')),
 Role('rival','라이벌','spiky','jacket','orb',('7b3e28','ad6240','e4d9b9','aaa587','397b9f','205471','94744c','654e36','343d52','dbbd65')),
 Role('professor','박사','bun','coat','book',('a0a4b4','d0d1dc','eee9d5','c1c1b1','896780','59455c','5c4964','3f3448','754e42','aa6a3d')),
 Role('nurse','간호사','bunches','apron','care',('cc6484','f38fa7','fcf0df','c6d4c8','77aa95','497f70','547d76','315e5a','c25973','f4d7b6')),
 Role('merchant','상인','short','apron','satchel',('343832','636755','e7d4a3','b5a476','ca9945','906a34','695c3e','403d2e','51432e','e4b451')),
 Role('mother','엄마','bob','dress','wave',('744837','a06a49','f8e6c1','cbbba0','a271a4','6e526f','937295','6c5270','7c473d','f1ca76')),
 Role('resident','주민','ponytail','dress','wave',('4a322b','7b5038','ffe9c4','c5b58c','df9850','af6339','bc783f','7f4c31','815332','f5cf70')),
 Role('gym_leader','체육관 관장','swept','tunic','orb',('276451','478e6e','e6dfbf','a9b994','467d6a','235a4c','456659','2c4e43','786444','c7a85d')),
 Role('company_agent','회사 요원','slick','coat','badge',('b5bcc1','e4e7df','ecece0','b8c4bd','65737a','3c505a','56636b','2e3e4b','434455','c6945c')),
 Role('captain','선장','sailor','jacket','wave',('424855','787e8a','f4eee0','bec8c7','376a91','244563','324d6b','22344e','60503d','d9aa49')),
 Role('worker','작업자','helmet','overalls','tool',('726346','a19065','eed9a5','c6b477','dbb54e','a78132','527b81','34535d','76543e','d9b954')),
 Role('explorer','탐험가','brim','vest','satchel',('6b4b33','947045','e5d8aa','b5ad82','aa8b49','755c36','777748','4a5237','77513a','a7643a')),
 Role('student','학생','parted','uniform','book',('253951','405b7a','ecdfc1','b7bea7','51698a','354765','6b4c76','443959','554744','cca65f')),
 Role('ranger','레인저','ranger','vest','orb',('3c4936','697556','ece0af','b8c69a','638052','3d5a3a','796d45','535037','826349','d6a45a')),
 Role('moon_leader','달빛단 두목','long','tunic','orb',('b4b5d2','e4deef','e8dde5','b6a9c4','9175af','624e7b','565173','363655','574659','d8aa59')),
 Role('hiker','등산가','knit','vest','satchel',('553b2c','836145','eed8ae','b9a87c','ae6350','76483e','7f7850','555338','6b4d38','9ca478')),
]

# Every head is ten native columns wide, nine native rows tall. Repeated silhouette
# coordinates are anatomy anchors, while hairstyle, hat, face and rear details differ.
HEADS={
'cap':{
'down':['...oooo...','..oaaaaao.','.ohhhhhao.','.oHHhhhho.','oahhhhhao.','..ossstoo.','..osdsdso.','...ossto..','....oo....'],
'up':['...oooo...','..oaaaaao.','.oaaaaaao.','.ohhhhaao.','.ohhhhhho.','..ohhHho..','..ohhhho..','...ohho...','....oo....'],
'right':['...oooo...','..oaaaao..','.oaaaaoo..','.ohhHhaao.','.ohhssso..','..ohsdso..','..ohssto..','...osto...','....oo....'],
'left':['...oooo...','..oaaaao..','..ooaaaao.','.oaahHhho.','..ossshho.', '..osdsho..','..otssho..','...otso...','....oo....']},
'spiky':{
'down':['..o..oo...','.ohoohho..','.oHhHhHho.','ohHHhhhho.','ohhhsssho.','oossssstoo','..osdsdso.','...ossto..','....oo....'],
'up':['..o..oo...','.ohoohho..','.oHhHhHho.','ohHHhhhho.','ohhhhhHho.','oohhhHhhoo','..ohhhho..','...ohho...','....oo....'],
'right':['..o..oo...','.ohoohho..','.oHhHhHho.','ohHHhhhho.','ohhhsssoo.','oohhsdsso.','..ohsstoo.','...osto...','....oo....'],
'left':['...oo..o..','..ohhooh o.'.replace(' ',''),'.ohHhHhHo.','.ohhhhHHo.','.oossshhho','.ossdshhoo','.oottsho..','...otso...','....oo....']},
'bun':{
'down':['..oo.oo...','.oHhoHHo..','oHHHHHHHho','ohhHhHhhho','ohssssshto','.osdsdst o.'.replace(' ',''),'.ossssst o.'.replace(' ',''),'..osstoo..','...ooo....'],
'up':['..oo.oo...','.oHhoHHo..','oHHHHHHHho','ohhhHHhhho','ohhhhHhhho','.ohhhhho..','.ohHHhho..','..ohhho...','...ooo....'],
'right':['..oo.oo...','.oHhoHHo..','oHHHHHhho.','ohhhhHhho.','ohhhsssso.','.ohsdsdso.','.ohsssto..','..ostoo...','...ooo....'],
'left':['...oo.oo..','..oHHoHho.','.ohhHHHHHo','.ohhHhhhho','.osssshhho','.osdsdsho.','..otssho..','...ootso..','....ooo...']},
'bunches':{
'down':['...oooo...','..owwwwo..','.ohhHHhho.','ohhhHHhhho','ohoo ssohho'.replace(' ',''),'ohosdsdoho','..osssso..','...osso...','....oo....'],
'up':['...oooo...','..owwwwo..','.ohhHHhho.','ohhhHHhhho','ohhhhhhhho','ohhhhhhhho','..ohhhho..','...ohho...','....oo....'],
'right':['...oooo...','..owwwwo..','.ohHHhhho.','ohHHhhhho.','ohhhsssso.','ohhhsdsso.','..ohssto..','...osto...','....oo....'],
'left':['...oooo...','..owwwwo..','.ohhhHHho.','.ohhhhHHo.','.ossshhho.','.ossdshhho','..otshho..','...otso...','....oo....']},
'short':{
'down':['...oooo...','..ohHHho..','.ohHHhhho.','.ohhhhhho.','.ohssssho.','.osdsdsso.','..osssto..','...osso...','....oo....'],
'up':['...oooo...','..ohHHho..','.ohHHhhho.','.ohhhhhho.','.ohhhhhho.','.ohhhHhho.','..ohhhho..','...ohho...','....oo....'],
'right':['...oooo...','..ohHHho..','.ohHHhhho.','.ohhhhhho.','.ohhsssso.','..ohsdsso.','..ohsstoo.','...osto...','....oo....'],
'left':['...oooo...','..ohHHho..','.ohhhHHho.','.ohhhhhho.','.osssshho.','.ossdsho..','.oottsho..','...otso...','....oo....']},
'bob':{
'down':['...oooo...','..ohHHho..','.ohHHhhho.','.ohhsssho.','ohhsssshoo','ohosdsdoho','ohossstoho','.oosssoo..','....oo....'],
'up':['...oooo...','..ohHHho..','.ohHHhhho.','.ohhhhhho.','ohhhhhhhho','ohhhhHHhho','ohhhhhhhho','.oohhhoo..','....oo....'],
'right':['...oooo...','..ohHHho..','.ohHHhhho.','.ohhhhsho.','ohhhssssoo','ohhhsdsto.','ohhhsssto.','.ohostoo..','....oo....'],
'left':['...oooo...','..ohHHho..','.ohhhHHho.','.ohshhhho.','oossshhhho','.otsdshhho','.otsshhhho','..ootsoho.','....oo....']},
'ponytail':{
'down':['...oooo...','..ohHHho..','.ohHHhhho.','.ohhhhhho.','ohhhssssoo','ohosdsdsso','..osssto..','...osso...','....oo....'],
'up':['...oooo...','..ohHHho..','.ohHHhhho.','.ohhhhhho.','ohhhhhhhho','ohhhohhho.','ohhohhho..','.o..ohho..','....oo....'],
'right':['...oooo...','..ohHHho..','.ohHHhhho.','ohhhhhsho.','ohhhssssoo','ohhhsdsto.','ohhosssto.','.o.ostoo..','....oo....'],
'left':['...oooo...','..ohHHho..','.ohhhHHho.','.ohshhhhho','oossshhhho','.otsdshhho','.otsss ohho'.replace(' ',''),'..ootso.o.','....oo....']},
}

# Accessories below are independently authored head clusters, not color swaps.
HEADS['parted']={k:list(v) for k,v in HEADS['short'].items()}
HEADS['parted']['down'][2:5]=['.ohHhHHho.','.ohhoss ho.'.replace(' ',''),'.ohssssho.']
HEADS['swept']={k:list(v) for k,v in HEADS['short'].items()}
HEADS['swept']['down'][0:4]=['..oooo....','.ohHHHho..','ohHHhhhho.','.ohhoss ho.'.replace(' ','')]
HEADS['slick']={k:list(v) for k,v in HEADS['short'].items()}
HEADS['slick']['down'][4:7]=['.osssssso.','.odddddd o.'.replace(' ',''),'..osssso..']
HEADS['long']={k:list(v) for k,v in HEADS['bob'].items()}
HEADS['long']['down'][1:4]=['..oHHHho..','.oHHhHHho.','.ohssshho.']
HEADS['long']['up'][5:8]=['ohhHHHhhho','ohhhhhhhho','.ohhhhhhoo']
HEADS['sailor']={k:list(v) for k,v in HEADS['short'].items()}
HEADS['sailor']['down'][0:5]=['...oooo...','..owwwwo..','.owwwwvvo.','.owwoawwo.','.oaahhaao.']
HEADS['sailor']['up'][0:5]=['...oooo...','..owwwwo..','.owwwwvvo.','.owwwwvvo.','.oaahhaao.']
HEADS['sailor']['right'][0:5]=['...oooo...','..owwwwo..','.owwwwvo..','.owwwvvo..','.oaahhhao.']
HEADS['sailor']['left'][0:5]=['...oooo...','..owwwwo..','..ovwwwwo.','..ovvwwwo.','.oahhhaao.']
HEADS['helmet']={k:list(v) for k,v in HEADS['short'].items()}
for direction in HEADS['helmet']:
 HEADS['helmet'][direction][0:5]=['...oooo...','..oaaaao..','.oaag aaao.'.replace(' ',''),'.oaaaaaao.','oabbbbbaao']
HEADS['brim']={k:list(v) for k,v in HEADS['short'].items()}
for direction in HEADS['brim']:
 HEADS['brim'][direction][0:5]=['...oooo...','..oggggo..','.oggggggo.','.obbbbbbo.','oggggggggo']
HEADS['ranger']={k:list(v) for k,v in HEADS['short'].items()}
for direction in HEADS['ranger']:
 HEADS['ranger'][direction][0:5]=['...oooo...','..oaaaao..','.oaaagaao.','.oaaaaaao.','oabbbbbaao']
HEADS['knit']={k:list(v) for k,v in HEADS['short'].items()}
for direction in HEADS['knit']:
 HEADS['knit'][direction][0:5]=['...oooo...','..oaaaao..','.oaabaab o.'.replace(' ',''),'.oaabaab o.'.replace(' ',''),'.obbbbbbo.']

def palette(role):
 h,H,w,v,a,b,p,q,r,g=role.colors
 return dict(o='243039',d='17242d',h=h,H=H,s=role.skin[0],t=role.skin[1],w=w,v=v,a=a,b=b,p=p,q=q,r=r,g=g)
