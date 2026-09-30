import sys; sys.path.insert(0,'.')
from lib import *
S='specimen_jar'
L=dict(t=('tin',5),T=('tin',3),u=('tin',1),U=('tin',2),o=('murk',1),O=('murk',0),g=('murk',6),G=('murk',5),h=('murk',4),l=('murk',3),m=('murk',2),
       b=('bisque',4),d=('bisque',2),r=('blood',3),v=('void',1),k=('void',0))
def big(c,x0,y0,rows): c.art(x0,y0,rows,L)

BIG=[
".tttttttt.",
".TTTTTTTu.",
"..oGllmO..",
".oGhlllmO.",
"oGhhllllmO",
"oGhllllllO",
"oGhllllllO",
"oGhllllllO",
"oGhllllllO",
"oGllllllmO",
"oGlllllmmO",
"oGllllmmmO",
".OGmmmmmO.",
"..OOOOOO..",
]
SMALL=[
".tt.",
"oGlO",
"oGlO",
"oGlO",
"oGlO",
".OO.",
]
def eye(c,x,y,dim=False):
    s=('bisque',3) if dim else ('bisque',4)
    c.art(x,y,[".bbb.","brvrb",".bbb."],{**L,'b':s})
# A: v5 스타일 정직판
c=C(16,16); big(c,0,2,BIG); big(c,11,10,SMALL)
eye(c,2,8,True); c.px(12,13,('bisque',2)); c.px(12,12,('bisque',2))
c.px(1,3,('tin',6)); c.px(2,2,('tin',6))
c.save(S,'h2-A','A: 초록 액체 큰 병(쇠 뚜껑, 왼쪽 유리 밝은 테) 속 눈 하나 + 옆 작은 병(손가락 조각). v5식 정직 판.')
run(S,'h2-A')
# B: 명암 강화 — 바닥 그림자 + 액체 인광
c=C(16,16); big(c,0,1,BIG); big(c,11,9,SMALL)
eye(c,2,7,False)
c.px(1,2,('tin',6)); c.px(2,1,('tin',6))
for x in range(1,15): c.px(x,15,'~')
for x in range(11,16): c.px(x,15,'-')
c.px(10,15,'~')
# 병 속 아래쪽은 더 어둡게, 위쪽 액체는 밝게(인광)
for x in range(3,8): c.px(x,5,('murk',5))
c.px(13,3,'?'); c.px(15,4,'?'); c.px(14,14,None) if False else None
c.save(S,'h2-B','B: 바닥에 ~/- 그림자를 깔고 액체 윗면을 밝은 인광 단으로, 아랫배는 어둡게. 눈은 선명(bisque 4)하게 떠올림.')
run(S,'h2-B')
# C: 실루엣 재해석 — 금간 병, 유리에 붙은 손바닥, 흐르는 액체
CB=[
".tttttttt.",
".TTTTTTTu.",
"..oGllmO..",
".oGhlllmO.",
"oGhhllllmO",
"oGhllllllO",
"oGhllllllO",
"oGhllllllO",
"oGhllllllO",
"oGllllllmO",
"oGlllllmmO",
"oGllllmmmO",
".OGmmmmmO.",
"..OOOOOO..",
]
c=C(16,16); big(c,1,1,CB)
# 유리에 붙은 손(손바닥과 손가락 넷)
HAND=[
"b.b.b",
"b.b.bb",
"bbbbb",
".bbb.",
".ddd.",
]
c.art(3,5,["d.d.d.d","dbdbdbd",".bbbbb.",".bbbbb.","..ddd.."],L)
# 금 + 새는 액체
c.line(9,7,10,11,('murk',0)); c.px(10,12,('murk',0))
c.px(11,12,('murk',3)); c.px(11,13,('murk',3)); c.px(11,14,('murk',2)); c.px(12,15,('murk',3)); c.px(13,15,('murk',3)); c.px(11,15,('murk',2)); c.px(14,15,('murk',2))
c.px(15,14,None)
c.save(S,'h2-C','C: 큰 병 하나에 손바닥과 손가락 넷이 안쪽에서 유리에 붙어 있고, 금이 간 오른쪽으로 액체가 새어 바닥에 고인다(작은 병 없음, 실루엣이 더 뾰족).')
run(S,'h2-C')
