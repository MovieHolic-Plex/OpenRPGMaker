"""글자 격자(한 글자 = 한 화소) + 범례 {글자: (램프, 단)} → pxgrid .pxg (@mat + @mblock 재료 + @tblock 단).
손으로 그린 격자를 램프 팔레트 열쇠로 옮겨 적는 표기 도우미일 뿐이다(보간·난수·도형 채우기 없음).
범례 밖 글자 '~' '-' '%' 는 팔레트의 반투명 한 글자 색으로 그대로 @block 에 놓는다. '.' = 투명.

  from pxg_emit import emit
  open('j1-A.pxg','w').write(emit(rows, legend, title='torii j1-A'))
"""
MAT_LETTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
TONES = '0123456789abcde'
SINGLE = '~-%'

def emit(rows, legend, title=''):
    H = len(rows); W = len(rows[0])
    assert all(len(r) == W for r in rows), [len(r) for r in rows]
    ramps = sorted({v[0] for v in legend.values()})
    mat = {r: MAT_LETTERS[i] for i, r in enumerate(ramps)}
    out = [f'// {title}', f'@size {W} {H}', '@cell 16', '@palette palette.pal', '@layer main']
    out += [f'@mat {mat[r]} {r} 0' for r in ramps]
    mb, tb, sb = [], [], []
    for r in rows:
        m = t = s = ''
        for ch in r:
            if ch in legend:
                rp, tone = legend[ch]; m += mat[rp]; t += TONES[tone]; s += '.'
            elif ch in SINGLE:
                m += '.'; t += '.'; s += ch
            else:
                assert ch == '.', f'범례에 없는 글자 {ch!r}'
                m += '.'; t += '.'; s += '.'
        mb.append(m); tb.append(t); sb.append(s)
    out += ['@mblock 0 0'] + mb + ['@tblock 0 0'] + tb
    if any(set(x) - {'.'} for x in sb):
        out += ['@layer shadow', '@block 0 0'] + sb
    return '\n'.join(out) + '\n'
