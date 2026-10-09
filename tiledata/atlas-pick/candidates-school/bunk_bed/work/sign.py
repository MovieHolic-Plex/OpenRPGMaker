import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from s3k import C
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
def out(slug, X): return ROOT + '/%s/s3-%s.pxg' % (slug, X)
D2 = ["..XX", "X..X", "...X", "..X.", ".X..", "X...", "XXXX"]
D1 = [".XX", "XXX", ".XX", ".XX", ".XX", ".XX", ".XX"]
def digits(c, x, y, col):
    for j, r in enumerate(D2):
        for i, ch in enumerate(r):
            if ch == 'X': c.px(x + i, y + j, col)
    c.rect(x + 5, y + 3, 3, 2, col)
    for j, r in enumerate(D1):
        for i, ch in enumerate(r):
            if ch == 'X': c.px(x + 8 + i, y + j, col)
MAN = ["..XX.", "..XX.", ".XXXX", "X.XX.", "..XX.", ".X..X", "X...X"]
def man(c, x, y, col):
    for j, r in enumerate(MAN):
        for i, ch in enumerate(r):
            if ch == 'X': c.px(x + i, y + j, col)
