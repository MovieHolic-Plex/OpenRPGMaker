import sys; sys.path.insert(0,'.')
from w6lib import emit
LG = {'O':'straw:1','Q':'straw:0','u':'straw:5','t':'straw:4','s':'straw:3','S':'straw:2',
 'L':'linen:6','l':'linen:5','n':'linen:4','m':'linen:3','k':'linen:2',
 'p':'linen:5','q':'linen:4','r':'red:3','R':'red:2','c':'wood:3','d':'wood:5','~':'P:~','-':'P:-'}
C = """
................
................
.....LLLn.......
....LLLLLnn.....
...OtLLLLLnsO...
..OuttttttssSO..
..OSssssssSSSO..
..OutttttttssO..
..OutpplpptsSO..
..OutpRRRptsSO..
..OusqppppqsSO..
..OtssssssssSO..
...OSsssssSSSQ..
....QQSSSSQQ~~..
.....~~~~~~~~...
................
""".strip('\n').split('\n')
emit('../w6-C.pxg', LG, C)
