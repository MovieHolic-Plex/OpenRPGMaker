# 손으로 놓은 행을 조립만 한다(틀 + 칠판 8칸). 폭 검사 포함.
hdr = open('j4-C.hdr').read() if False else None
L = """// standing_sign C — 실루엣 재해석: 박공 지붕 모양 판 + 분필로 그린 김 나는 머그잔(글씨 줄 대신 그림 하나로 「카페」가 읽힘)
@size 16 16
@cell 16
@palette palette.pal
@mat T hinoki 5
@mat H hinoki 4
@mat h hinoki 3
@mat D hinoki 2
@mat d hinoki 1
@mat g matsu 1
@mat G matsu 2
@mat w mwhite 3
@mat u mwhite 2
@mat v mwhite 1
@mat y myellow 3
@mblock 0 0
"""
top = ["......dTTd......", "....dTTHHhhd....", "..dTTHHHHHHhhd.."]
board = ["GGgggggg","gggvgvgg","ggvgvggg","gwwwwwgg","gwwwwuwg","gwwwwugw","gwwwwuwg","gwwwwwwg"]
frame = lambda b: "..dH" + b + "hd.."
rest = ["..dHHHHHHHHhhd..", "..dHd......dhd..".replace("......","......"), "..dHd......dhd..", "..ddd......ddd..", "...-~~~~~~~~~~--"]
# 다리: 판 폭(x2~13) 아래 두 발
rest[1] = "..dHd" + "." * 6 + "dhd.."
rest[2] = rest[1]
rows = top + [frame(b) for b in board] + rest
for r in rows: assert len(r) == 16, (r, len(r))
assert len(rows) == 16, len(rows)
open('j4-C.pxg', 'w').write(L + "\n".join(rows) + "\n")
