"""원본/시트 영역을 글자 표로 덤프한다(팔레트 글자 자동 배정). 아이콘 모듈 좌표를 재는 데 쓴다."""
import sys
from PIL import Image
import numpy as np
SYM = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
def dump(path, box, key=(255, 103, 139)):
    a = np.array(Image.open(path).convert('RGB'))
    x0, y0, x1, y1 = box
    sub = a[y0:y1, x0:x1]
    pal = {}
    lines = []
    hdr = '    ' + ''.join(str((x0 + i) // 10 % 10) if (x0 + i) % 10 == 0 else ' ' for i in range(x1 - x0))
    lines.append(hdr)
    lines.append('    ' + ''.join(str((x0 + i) % 10) for i in range(x1 - x0)))
    for y in range(y1 - y0):
        row = ''
        for x in range(x1 - x0):
            c = tuple(int(v) for v in sub[y, x])
            if c == key:
                row += '.'
                continue
            if c not in pal:
                pal[c] = SYM[len(pal)]
            row += pal[c]
        lines.append(f'{y0 + y:3d} ' + row)
    lines.append('')
    from collections import Counter
    cnt = Counter(tuple(int(v) for v in p) for p in sub.reshape(-1, 3))
    for c, s in pal.items():
        lines.append(f'{s} = {c[0]:02x}{c[1]:02x}{c[2]:02x}  x{cnt[c]}')
    return '\n'.join(lines)
if __name__ == '__main__':
    print(dump(sys.argv[1], tuple(map(int, sys.argv[2].split(',')))))
