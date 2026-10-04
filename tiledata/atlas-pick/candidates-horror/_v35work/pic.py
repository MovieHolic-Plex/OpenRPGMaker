"""한 글자=한 화소 그림 → mk.write 용 (재료 격자, 단 격자). 손으로 찍은 글자 그림을 옮겨 적을 뿐이다."""
def conv(rows, legend):
    M=[];T=[]
    for r in rows:
        m='';t=''
        for ch in r:
            if ch=='.': m+='.';t+='.'
            else:
                mat,tone=legend[ch]; m+=mat; t+=str(tone)
        M.append(m);T.append(t)
    return M,T
