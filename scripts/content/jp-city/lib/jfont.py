"""JIS 글자(가나·한자·전각 영숫자) 16x16 비트맵. tiledata/jp-city/glyphs.json 에서 읽는다 — 런타임에 시스템 글꼴(X11 jiskan16.pcf.gz)을 읽지 않는다.
글자를 더하려면 glyph_tool.py(퍼블릭 도메인 jiskan16 PCF 에서 뽑아 glyphs.json 에 합친다)."""
import json
import numpy as np
import jpenv

_G = None
def _load():
    global _G
    if _G is None:
        with open(jpenv.GLYPHS, encoding='utf-8') as f: raw = json.load(f)
        _G = {}
        for ch, s in raw.items():
            if ch.startswith('_'): continue
            rows = s.split('/')
            _G[ch] = np.array([[1 if c == '1' else 0 for c in r] for r in rows], np.uint8)
    return _G

def glyph(ch):
    """글자 한 자 → 16x16 uint8(0/1) 배열. 구워 둔 글자에 없으면 KeyError."""
    g = _load().get(ch)
    if g is None: raise KeyError(f'glyphs.json 에 없는 글자 {ch!r} — glyph_tool.py 로 추가하세요')
    return g.copy()
