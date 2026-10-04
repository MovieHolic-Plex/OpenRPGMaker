from w6lib import emit, Cv
LG = {'W':'wood:1','p':'wood:2','w':'wood:3','v':'wood:4','x':'wood:5','y':'wood:6','z':'wood:7',
 'a':'leaf:1','b':'leaf:2','c':'leaf:3','d':'leaf:4','e':'leaf:5','f':'leaf:6',
 'L':'linen:6','M':'linen:5','N':'linen:4','O':'linen:3','P':'linen:2',
 'I':'ice:6','J':'ice:5','K':'ice:4','Q':'ice:3','R':'ice:2',
 '7':'blue:6','6':'blue:5','5':'blue:4','4':'blue:3','3':'blue:2','2':'blue:1','1':'blue:0',
 'G':'gold:4','H':'gold:3','~':'P:~','-':'P:-'}
c = Cv(16, 48)
# posts
for y in range(11, 48):
    c.px(0, y, 'W'); c.px(1, y, 'y' if y < 46 else 'x'); c.px(14, y, 'v'); c.px(15, y, 'W')
c.px(1, 11, 'z'); c.px(0,11,'.'); c.px(15,11,'.')
c.hl(1, 10, 2, 'W'); c.px(14,10,'W')
# headboard
c.hl(2, 11, 12, 'W')
c.hl(2, 12, 12, 'y'); c.px(2,12,'z')
c.rect(2, 13, 12, 8, 'x')
c.hl(2, 13, 12, 'y'); c.vl(2, 13, 8, 'y')
c.vl(13, 13, 8, 'v'); c.hl(2, 20, 12, 'v')
c.hl(2, 21, 12, 'w'); c.hl(2,22,12,'p')
# leaf emblem
c.put(5, 14, ["..aa..",".adfa.","adfeca","adeeca",".aeca.","..aa.."])
# sheet + pillow
c.rect(2, 23, 12, 7, 'M'); c.hl(2, 23, 12, 'N'); c.vl(13, 23, 7, 'N')
c.put(3, 24, [".PPPPPPPPP.","PIIIIIIIJJP","PIJJJJJJJKP","PJJJJJJJKKP","PJJJJJKKKQP",".PQQQQQQQP.".replace('Q','R')[:11]])
c.hl(2, 30, 12, 'L'); c.hl(2, 31, 12, 'N')
# blanket
c.rect(2, 32, 12, 13, '5')
c.hl(2, 32, 12, '7'); c.hl(2, 33, 12, '6')
c.hl(2, 34, 12, '4')
c.vl(2, 32, 13, '6'); c.vl(3, 35, 8, '6')
c.vl(13, 32, 13, '3'); c.vl(12, 35, 8, '4')
c.hl(4, 38, 8, '6'); c.hl(5, 39, 6, '4')
for x in (5,7,9): c.px(x,40,'6')
c.hl(2, 42, 12, '4'); c.hl(2,43,12,'3'); c.hl(2,44,12,'2')
# footboard
c.hl(2, 45, 12, 'z'); c.hl(2, 46, 12, 'y'); c.hl(2,47,12,'W')
c.px(14,47,'W')
# vines
c.put(0,11,["cd","bc"],'.'); 
c.put(11,10,[".dcb","dfec","cedb"]); c.put(3,9,["..","."])if False else None
c.put(1,12,["dc","cb"]); c.put(13,12,["cd","bc"])
c.put(0,14,["dc","ab"]); c.put(14,15,["cd","ba"])
c.put(4,9+1,[".cd.","cee."]) if False else None
for x,ch in zip(range(3,13),"abcdcdcbca"): c.px(x,10,ch)
for x,ch in zip(range(3,13),"dcecdcecdc"): c.px(x,11,ch)
for x,ch in zip(range(4,12),"bdcbdcbd"): c.px(x,9+1,ch) if False else None
rows = c.rows()
emit('../w6-A.pxg', LG, rows)
