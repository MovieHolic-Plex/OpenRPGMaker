"""글자를 glyphs.json 에 더하는 도구(시스템에 X11 misc 글꼴 jiskan16.pcf.gz 가 있을 때만; 굽기 자체에는 필요 없다).
  python3 glyph_tool.py 新宿 渋谷      # 글자를 읽어 tiledata/jp-city/glyphs.json 에 합친다
  python3 glyph_tool.py --verify       # 구워 둔 모든 글자가 시스템 PCF 와 같은지 비교
jiskan16 은 퍼블릭 도메인(JIS X 0208 16x16 비트맵). PCF 읽기 코드는 원본 jfont.py 에서 옮겼다."""
import gzip, struct, sys, json
import numpy as np
import jpenv

PCF = '/usr/share/fonts/X11/misc/jiskan16.pcf.gz'
_C = {}
def _load(path):
    if path in _C: return _C[path]
    d = gzip.open(path).read() if path.endswith('.gz') else open(path, 'rb').read()
    n = struct.unpack("<i", d[4:8])[0]; tabs = {}
    for i in range(n):
        t, fmt, sz, off = struct.unpack('<iiii', d[8 + 16 * i:24 + 16 * i]); tabs[t] = (fmt, sz, off)
    fmt, sz, off = tabs[32]; e = '<' if fmt & 4 == 0 else '>'
    mnb2, mxb2, mnb1, mxb1, dflt = struct.unpack(e + 'hhhhh', d[off + 4:off + 14])
    cnt = (mxb2 - mnb2 + 1) * (mxb1 - mnb1 + 1); idx = struct.unpack(e + f'{cnt}H', d[off + 14:off + 14 + 2 * cnt])
    fmt, sz, off = tabs[8]; e = '<' if fmt & 4 == 0 else '>'; ng = struct.unpack(e + 'i', d[off + 4:off + 8])[0]
    offs = struct.unpack(e + f'{ng}i', d[off + 8:off + 8 + 4 * ng]); base = off + 8 + 4 * ng + 16
    msbit = bool(fmt & 8); pad = [1, 2, 4, 8][fmt & 3]
    mf, ms, mo = tabs[4]
    if mf & 0x100:
        cm = d[mo + 6:]
        wid = [cm[i * 5 + 1] - cm[i * 5] for i in range(ng)]; asc = [cm[i * 5 + 3] - 0x80 for i in range(ng)]; dsc = [cm[i * 5 + 4] - 0x80 for i in range(ng)]
        ht = [a + b for a, b in zip(asc, dsc)]
    else:
        e2 = '<' if mf & 4 == 0 else '>'; wid = []; ht = []
        for i in range(ng):
            l, r, w, a, dd = struct.unpack(e2 + 'hhhhh', d[mo + 8 + 12 * i:mo + 8 + 12 * i + 10]); wid.append(r - l); ht.append(a + dd)
    _C[path] = (d, mnb1, mxb1, mnb2, mxb2, idx, offs, base, msbit, pad, wid, ht)
    return _C[path]

def pcf_glyph(ch, path=PCF):
    d, mnb1, mxb1, mnb2, mxb2, idx, offs, base, msbit, pad, wid, ht = _load(path)
    b = ch.encode('euc_jp'); b1, b2 = (b[0] - 0x80, b[1] - 0x80) if len(b) == 2 else (0, b[0])
    if not (mnb1 <= b1 <= mxb1 and mnb2 <= b2 <= mxb2): raise KeyError(ch)
    g = idx[(b1 - mnb1) * (mxb2 - mnb2 + 1) + (b2 - mnb2)]
    if g == 0xFFFF: raise KeyError(ch)
    w, h = wid[g], ht[g]; stride = ((w + 7) // 8 + pad - 1) // pad * pad
    out = np.zeros((h, w), np.uint8)
    for y in range(h):
        row = d[base + offs[g] + y * stride: base + offs[g] + (y + 1) * stride]
        for x in range(w):
            byte = row[x // 8]; out[y, x] = (byte >> (7 - x % 8)) & 1 if msbit else (byte >> (x % 8)) & 1
    return out

def encode(a): return '/'.join(''.join('1' if v else '.' for v in row) for row in a)

def main(argv):
    with open(jpenv.GLYPHS, encoding='utf-8') as f: raw = json.load(f)
    if argv and argv[0] == '--verify':
        bad = [ch for ch, s in raw.items() if not ch.startswith('_') and encode(pcf_glyph(ch)) != s]
        print('verified', len(raw) - 1, 'mismatch', bad); return 1 if bad else 0
    for ch in ''.join(argv):
        raw[ch] = encode(pcf_glyph(ch))
    about = raw.pop('_about'); body = sorted(((k, v) for k, v in raw.items()), key=lambda kv: kv[0].encode('euc_jp'))
    lines = [f'  {json.dumps(k, ensure_ascii=False)}: "{v}"' for k, v in body]
    with open(jpenv.GLYPHS, 'w', encoding='utf-8') as f:
        f.write('{\n  "_about": ' + json.dumps(about, ensure_ascii=False) + ',\n' + ',\n'.join(lines) + '\n}\n')
    return 0

if __name__ == '__main__': sys.exit(main(sys.argv[1:]))
