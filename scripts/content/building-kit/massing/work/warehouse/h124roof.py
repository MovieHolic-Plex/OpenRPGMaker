"""남북 박공 지붕 — 버들항 bd-house-h124_0 규약(BRIEF ㉚). 앞 박공 뒤로 오각형 지붕이 화면 위로 물러나고,
기와는 용마루와 나란한 세로 열: 열 이음(세로)이 줄마다 같은 자리에 서고, 4px 마다 가로 겹침 그늘 줄.
왼 사면 8px 열(밝은 윗머리 L), 오른 사면 4px 열(어두운 @=). 가운데 용마루 2px(밝은 < · 짙은 7/6), 바깥 끝 2px 테.
낱장 변화는 손으로 쓴 표(난수 없음)로 몇 장만 윗머리 빛을 빼거나 한 단 어둡게."""

LIT_T = ['####??##', 'LLL#?ρρL', 'ρLLρ??ρρ', 'ρρρ##ρρρ']
DRK_T = ['@@=@', '=@==', 'ππ=π', 'ππ@=']
VAR = '000100200001000020100000300010002000'
LIT_V = {'1': {'L': 'ρ'}, '2': {'ρ': 'π', 'L': 'ρ'}, '3': {'ρ': 'L'}}
DRK_V = {'1': {'π': '?'}, '2': {'=': '@', 'π': '='}, '3': {'π': 'ρ'}}
RAKE_L = ('-', 'β')
RAKE_R = ('-', '_')
RIDGE = ('<', '7', '6')

SLATE = {'#': 'a', '?': 'e', 'L': 'n', 'ρ': 'h', 'π': 'e', '@': 'X', '=': 'a', '<': 'k', '7': 'W', '6': 'X',
         '-': 'Y', 'β': 'b', '_': 'X', '*': 'X'}


def paint(c, inside, rl, x0, x1, y0, y1, ox=0, oy=0, cmap=None):
    """rl = 용마루 왼(빛) 화소. inside(x,y) 가 참인 곳만 칠한다."""
    m = cmap or {}
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if not inside(x, y):
                continue
            if x == rl:
                ch = RIDGE[0]
            elif x == rl + 1:
                ch = RIDGE[1] if (y // 2) % 2 else RIDGE[2]
            elif x < rl:
                u = (rl - 1 - x + ox)
                v = (y + oy)
                tile = (u // 8) * 7 + (v // 4) * 3
                ch = LIT_T[v % 4][7 - (u % 8)]
                ch = LIT_V.get(VAR[tile % len(VAR)], {}).get(ch, ch)
            else:
                u = (x - rl - 2 + ox)
                v = (y + oy)
                tile = (u // 4) * 5 + (v // 4) * 3
                ch = DRK_T[v % 4][u % 4]
                ch = DRK_V.get(VAR[(tile + 11) % len(VAR)], {}).get(ch, ch)
            c.put(x, y, m.get(ch, ch))


def rake(c, pts_left, pts_right, cmap=None):
    """바깥 끝 2px 테: pts 는 (x, y, 안쪽 방향 dx) 목록."""
    m = cmap or {}
    for (x, y, d) in pts_left:
        c.put(x, y, m.get(RAKE_L[0], RAKE_L[0]))
        c.put(x + d, y, m.get(RAKE_L[1], RAKE_L[1]))
    for (x, y, d) in pts_right:
        c.put(x, y, m.get(RAKE_R[0], RAKE_R[0]))
        c.put(x + d, y, m.get(RAKE_R[1], RAKE_R[1]))
