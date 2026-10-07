"""조각 모듈 불러오기 — 모듈마다 새 Registry 로 실행해 서로 섞이지 않게 한다."""
import importlib.util, os, sys, traceback
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import wzlib  # noqa: E402

PIECES_DIR = os.path.join(HERE, 'pieces')
sys.path.insert(0, PIECES_DIR)  # 모듈끼리 공유하는 도우미(_<모듈>_*.py)


def module_names(include_private=False):
    return sorted(f[:-3] for f in os.listdir(PIECES_DIR) if f.endswith('.py') and (include_private or not f.startswith('_')))


def load(name):
    """모듈 하나 → Registry (실패하면 예외)."""
    reg = wzlib.Registry(); wzlib.REG = reg
    spec = importlib.util.spec_from_file_location('wzpieces_' + name, os.path.join(PIECES_DIR, name + '.py'))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return reg


def load_all(names=None, quiet=False):
    """{모듈: Registry}, {모듈: 오류 문자열}"""
    regs, errs = {}, {}
    for n in names or module_names():
        try: regs[n] = load(n)
        except Exception:
            errs[n] = traceback.format_exc(limit=3)
            if not quiet: print(f'✗ {n} 불러오기 실패\n{errs[n]}', file=sys.stderr)
    return regs, errs


def index(regs):
    """전 모듈 조각·오토타일 id → (모듈, 정의)."""
    pieces, autos = {}, {}
    for n, r in regs.items():
        for k, v in r.pieces.items(): pieces[k] = (n, v)
        for k, v in r.autotiles.items(): autos[k] = (n, v)
    return pieces, autos
