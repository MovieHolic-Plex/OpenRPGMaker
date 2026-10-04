from w6lib import emit
LG = {'W':'wood:1','p':'wood:2','w':'wood:3','v':'wood:4','x':'wood:5','y':'wood:6','z':'wood:7',
 'a':'leaf:1','b':'leaf:2','c':'leaf:3','d':'leaf:4','e':'leaf:5','f':'leaf:6',
 'L':'linen:6','M':'linen:5','N':'linen:4','O':'linen:3','P':'linen:2',
 '7':'blue:6','6':'blue:5','5':'blue:4','4':'blue:3','3':'blue:2','2':'blue:1','1':'blue:0','~':'P:~','-':'P:-'}
def pad(rows, top=10):
    return ['.'*16]*top + rows
A = """
.bc..cdb.bdc..b.
abdcbcdedcdbcdba
WxbdeWWWWWWedbwW
WxWyyyyyyyyyyWwW
WxWyzyyyyyyyyWwW
WxWxxxxxxxxxxWwW
WxWxxvvvvvvxxWwW
WxWxvwwwwwwvxWwW
WxWxvwppppwvxWwW
WxWxvwwwwwwvxWwW
WxWxxvvvvvvxxWwW
WxWwwwwwwwwwwWwW
WxWppppppppppWwW
WxMMMMMMMMMMMMwW
WxMPNNNNNNNNPMwW
WxMPLLLLLLMNPMwW
WxMPLLLLMMNNPMwW
WxMPMMMMMNNOPMwW
WxMOPPPPPPPPOMwW
WxLLLLLLLLLLLLwW
WxNNNNNNNNNNNNwW
Wx666666666666wW
Wx655555555543wW
Wx655655555543wW
Wx655555556543wW
Wx655555555543wW
Wx655655555543wW
Wx655555556543wW
Wx655555555543wW
Wx655655555543wW
Wx655555556543wW
Wx655555555543wW
Wx655555555443wW
Wx655555555543wW
Wx644444444433wW
WxyyyyyyyyyyyywW
WxWxxxxxxxxxxWwW
WWpppppppppppppW
""".strip('\n').split('\n')
assert len(A)==38
emit('../w6-A.pxg', LG, pad(A))
