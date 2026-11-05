# 조각 그림 캐시(검토용)
import os, sys, pickle, inspect
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
def load(mod, names=None, force=()):
    import importlib; M = importlib.import_module(mod)
    d = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cache'); os.makedirs(d, exist_ok=True)
    out = {}
    for n in names:
        p = os.path.join(d, f'{mod}.{n}.png')
        from PIL import Image
        if os.path.exists(p) and n not in force: out[n] = Image.open(p).convert('RGBA')
        else: im = getattr(M, n)(); im.save(p); out[n] = im
    return out
