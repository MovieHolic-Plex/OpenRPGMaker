"""r16 격자 손질 도우미 — 행 문자열을 읽고 바꿔 쓴다(그림 생성 없음)."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
G = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..', 'tiledata/modern-city/interior/r16/grids'))
CH = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*+-=@?!<>^~:;/|()[]{}_,'
def load(i): return json.load(open(f'{G}/{i}.json'))
def save(g, note):
    g['note'] = note; json.dump(g, open(f"{G}/{g['id']}.json", 'w'), ensure_ascii=False, indent=1)
def pr(i):
    g = load(i); print(i, g['w'], g['h'], ' '.join(f'{k}={v[1:7]}' + ('' if v.endswith('ff') else v[7:]) for k, v in g['legend'].items()))
    print('    ' + ''.join(str(x // 10 % 10) for x in range(g['w']))); print('    ' + ''.join(str(x % 10) for x in range(g['w'])))
    for y, r in enumerate(g['rows']): print('%3d %s' % (y, r))
def col(g, hexrgb):
    h = '#' + hexrgb.lstrip('#').lower(); h = h if len(h) == 9 else h + 'ff'
    for k, v in g['legend'].items():
        if v == h: return k
    k = next(c for c in CH if c not in g['legend']); g['legend'][k] = h; return k
def put(rows, y, x, s):
    r = rows[y]; rows[y] = r[:x] + s + r[x + len(s):]
if __name__ == '__main__':
    for i in sys.argv[1:]: pr(i)
