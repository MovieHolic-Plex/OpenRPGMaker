"""building-kit 마감 검사 — 마감 에이전트가 고칠 때마다 `python3 check.py` 로 돌린다. 하네스도 깨끗한 사본으로 다시 돌린다.

(a) 윤곽: finished.png 알파 = mask.png 알파(화소 하나도 다르면 FAIL)
(b) 문: 문 칸(regions.json doorRects) 화소는 문 재질 램프 안 · 원래 문짝(wood/timber/iron) 화소의 90% 이상이 문짝 램프로 남는다
(c) 팔레트: 불투명 화소는 잠긴 팔레트 색(그림자 자리는 그 색에 그림자를 얹은 값) · 반투명은 그림자 하나
(d) 처마 선: 바탕의 지붕→벽 경계 화소(열마다)가 ±1px 안에 그대로 있다(투영이 밀리지 않는다)
(e) 코드: finish_draw.py AST — 허용 import 만, 난수·잡음·modulo·식으로 넓은 면 채우기 금지(반복은 명시 좌표 목록·짧은 range 만,
    겹친 반복 금지), finish_lib 공개 함수만
(f) 변화량: 불투명 화소의 12% 이상이 바뀌었다(아무것도 안 하면 통과 못 한다)
(g) 16px 주기: 지붕·벽 영역의 16px 자기상관(가로·세로 평균)이 바탕보다 낮다

결과는 화면에 수치로, check.json 에 기록한다. 종료코드 0 = 전부 통과.
"""
import ast
import hashlib
import json
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
ALLOWED_IMPORTS = {'finish_lib'}
LIB_API = {'load', 'L', 'put', 'row', 'block', 'get', 'names', 'save'}
BANNED_CALLS = {'eval', 'exec', 'compile', '__import__', 'globals', 'locals', 'vars', 'setattr', 'getattr', 'delattr',
                'hash', 'open', 'input', 'breakpoint', 'map', 'filter', 'iter', 'next', 'memoryview', 'bytearray'}
BANNED_OPS = (ast.Mod, ast.BitXor, ast.BitAnd, ast.BitOr, ast.LShift, ast.RShift, ast.Pow)
MAX_RANGE = 16
MAX_REPEAT = 16
ITER_WRAPPERS = {'enumerate', 'zip', 'reversed', 'sorted', 'list', 'tuple'}


def _p(name):
    return os.path.join(ROOT, name)


def load_inputs():
    leg = json.load(open(_p('legend.json'), encoding='utf-8'))
    reg = json.load(open(_p('regions.json'), encoding='utf-8'))
    base_chars = [list(r) for r in open(_p('pixels.txt'), encoding='utf-8').read().splitlines()]
    return leg, reg, base_chars


def hex_rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def shade_rgb(rgb, leg):
    k = leg['shadow']['alpha'] / 255.0
    return tuple(int(v) for v in np.round(np.asarray(rgb, float) * (1 - k) + np.array(leg['shadow']['rgb'], float) * k))


def to_chars(a, leg, shade):
    plain = {hex_rgb(v['hex']): ch for ch, v in leg['chars'].items()}
    shaded = {}
    for rgb, ch in plain.items():
        shaded.setdefault(shade_rgb(rgb, leg), ch)
    sh_rgb, sh_a = tuple(leg['shadow']['rgb']), leg['shadow']['alpha']
    h, w = a.shape[:2]
    out = [[None] * w for _ in range(h)]
    bad = []
    for y in range(h):
        for x in range(w):
            al = int(a[y, x, 3])
            rgb = tuple(int(v) for v in a[y, x, :3])
            if al == 0:
                out[y][x] = '.'
            elif al == sh_a and rgb == sh_rgb:
                out[y][x] = '~'
            elif al == 255:
                ch = (shaded if shade[y, x] else plain).get(rgb)
                if ch is None:
                    bad.append((x, y, '#%02x%02x%02x' % rgb))
                out[y][x] = ch
            else:
                bad.append((x, y, f'alpha {al}'))
    return out, bad


def ramps_of(ch, leg):
    if ch is None or ch not in leg['chars']:
        return set()
    return {n.rstrip('0123456789') for n in leg['chars'][ch]['names']}


def check_door(fin, base, leg, reg):
    leaf_ramps = set(reg['doorLeafRamps'])
    total = kept = 0
    bad = []
    for rect in reg['doorRects']:
        x0, y0, w, h = rect['px']
        allowed = set(rect['allowedRamps'])
        step = set(rect['stepRamps'])
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                b, f = base[y][x], fin[y][x]
                if b in ('.', '~'):
                    continue
                ok = allowed | (step if y >= y0 + h - rect['stepRows'] else set())
                if not (ramps_of(f, leg) & ok):
                    bad.append((x, y))
                if ramps_of(b, leg) & leaf_ramps:
                    total += 1
                    kept += bool(ramps_of(f, leg) & leaf_ramps)
    frac = kept / total if total else 1.0
    ok = not bad and frac >= reg['doorKeep']
    msg = (f'문 칸 {len(reg["doorRects"])}개 · 문짝 화소 {kept}/{total} = {frac:.1%} 가 문짝 램프({"·".join(sorted(leaf_ramps))}) '
           f'(하한 {reg["doorKeep"]:.0%}) · 문 재질 밖 화소 {len(bad)}' + (f' 예 {bad[:4]}' if bad else ''))
    return ok, msg, {'leafKept': kept, 'leafTotal': total, 'leafFrac': frac, 'offMaterial': len(bad)}


def eave_points(chars, roof):
    pts = set()
    for y in range(len(chars) - 1):
        for x in range(len(chars[0])):
            a, b = chars[y][x], chars[y + 1][x]
            if a in roof and b not in roof and b not in ('.', '~', None):
                pts.add((x, y))
    return pts


def check_eaves(fin, base, reg):
    roof = set(reg['roofChars'])
    bp, fp = eave_points(base, roof), eave_points(fin, roof)
    lost = sorted(p for p in bp if not any((p[0], p[1] + d) in fp for d in (-1, 0, 1)))
    ok = not lost
    return ok, (f'바탕 처마 경계 {len(bp)}점 중 ±1px 안에 남은 것 {len(bp) - len(lost)} · 잃은 것 {len(lost)}'
                + (f' 예 {lost[:6]}' if lost else '')), {'basePoints': len(bp), 'lost': len(lost)}


def lag_corr(lum, mask, dx, dy):
    h, w = lum.shape
    pair = mask[:h - dy, :w - dx] & mask[dy:, dx:]
    if pair.sum() < 32:
        return None
    m = lum[mask].mean()
    a = lum[:h - dy, :w - dx][pair] - m
    b = lum[dy:, dx:][pair] - m
    d = np.sqrt((a * a).sum() * (b * b).sum())
    return float((a * b).sum() / d) if d else 1.0


def periodicity(img, mask):
    a = np.asarray(img, float)
    lum = 0.299 * a[:, :, 0] + 0.587 * a[:, :, 1] + 0.114 * a[:, :, 2]
    vals = [v for v in (lag_corr(lum, mask, 16, 0), lag_corr(lum, mask, 0, 16)) if v is not None]
    return float(np.mean(vals)) if vals else None


def check_period(fin_a, base_a, reg_mask):
    out = {}
    ok = True
    parts = []
    for name, code in (('roof', 1), ('wall', 2)):
        m = reg_mask == code
        b, f = periodicity(base_a, m), periodicity(fin_a, m)
        out[name] = {'base': b, 'finished': f}
        if b is None or f is None:
            parts.append(f'{name} 표본 부족(건너뜀)')
            continue
        good = f < b
        ok &= good
        parts.append(f'{name} {b:.3f} → {f:.3f} {"낮아짐" if good else "안 낮아짐"}')
    return ok, '16px 자기상관 ' + ' · '.join(parts), out


def _literal(node):
    try:
        ast.literal_eval(node)
        return True
    except (ValueError, TypeError, SyntaxError, RecursionError):
        return False


def _const_int(node):
    if isinstance(node, ast.Constant) and isinstance(node.value, int) and not isinstance(node.value, bool):
        return node.value
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.USub):
        v = _const_int(node.operand)
        return -v if v is not None else None
    return None


class CodeCheck(ast.NodeVisitor):
    def __init__(self, tree):
        self.problems = []
        self.literal_names = self._literal_names(tree)
        self.loop_funcs = {f.name for f in ast.walk(tree) if isinstance(f, (ast.FunctionDef, ast.AsyncFunctionDef))
                           and any(isinstance(n, (ast.For, ast.While, ast.comprehension)) for n in ast.walk(f))}
        self.lib_alias = set()
        self.calls_alias = {}
        self.calls = set()
        self.depth = 0

    @staticmethod
    def _literal_names(tree):
        lit, other = set(), set()
        for n in ast.walk(tree):
            if isinstance(n, ast.Assign):
                for t in n.targets:
                    if isinstance(t, ast.Name):
                        (lit if _literal(n.value) else other).add(t.id)
            elif isinstance(n, (ast.AugAssign, ast.AnnAssign)) and isinstance(n.target, ast.Name):
                other.add(n.target.id)
            elif isinstance(n, (ast.For, ast.comprehension)):
                for t in ast.walk(n.target):
                    if isinstance(t, ast.Name):
                        other.add(t.id)
        return lit - other

    def bad(self, node, why):
        self.problems.append(f'{getattr(node, "lineno", "?")}행: {why}')

    def iterable_ok(self, it):
        if _literal(it):
            return True
        if isinstance(it, ast.Name) and it.id in self.literal_names:
            return True
        if isinstance(it, ast.Call) and isinstance(it.func, ast.Name):
            if it.func.id == 'range':
                args = [_const_int(a) for a in it.args]
                return bool(args) and None not in args and len(range(*args)) <= MAX_RANGE
            if it.func.id in ITER_WRAPPERS and not it.keywords:
                return all(self.iterable_ok(a) for a in it.args)
        return False

    def loop(self, node, target_iter):
        if self.depth:
            self.bad(node, '겹친 반복 — 넓은 면을 식으로 채우는 것으로 본다(반복은 한 겹, 명시 좌표 목록만)')
        if not self.iterable_ok(target_iter):
            self.bad(node, f'반복 대상이 명시 좌표 목록·{MAX_RANGE} 이하 상수 range 가 아니다')

    def visit_For(self, node):
        self.loop(node, node.iter)
        self.depth += 1
        self.generic_visit(node)
        self.depth -= 1

    visit_AsyncFor = visit_For

    def visit_While(self, node):
        self.bad(node, 'while 금지')
        self.depth += 1
        self.generic_visit(node)
        self.depth -= 1

    def _comp(self, node):
        if len(node.generators) > 1:
            self.bad(node, '여러 겹 내포(comprehension) 금지')
        for g in node.generators:
            self.loop(node, g.iter)
        self.depth += 1
        self.generic_visit(node)
        self.depth -= 1

    visit_ListComp = visit_SetComp = visit_DictComp = visit_GeneratorExp = _comp

    def visit_Import(self, node):
        for a in node.names:
            root = a.name.split('.')[0]
            if root not in ALLOWED_IMPORTS or (root == 'finish_lib' and a.name != 'finish_lib'):
                self.bad(node, f'import {a.name} 금지(허용: {", ".join(sorted(ALLOWED_IMPORTS))})')
            if root == 'finish_lib':
                self.lib_alias.add(a.asname or 'finish_lib')

    def visit_ImportFrom(self, node):
        mod = (node.module or '').split('.')[0]
        if mod not in ALLOWED_IMPORTS or node.level:
            self.bad(node, f'from {node.module} import 금지')
        if mod == 'finish_lib':
            for a in node.names:
                if a.name not in LIB_API:
                    self.bad(node, f'finish_lib.{a.name} 은 공개 함수가 아니다({", ".join(sorted(LIB_API))})')
                self.calls_alias[a.asname or a.name] = a.name

    def visit_Attribute(self, node):
        if node.attr.startswith('_'):
            self.bad(node, f'밑줄 속성 {node.attr} 금지')
        if isinstance(node.value, ast.Name) and node.value.id in self.lib_alias and node.attr not in LIB_API:
            self.bad(node, f'finish_lib.{node.attr} 금지 — 공개 함수만')
        if node.attr in ('random', 'noise', 'seed', 'rand', 'randint', 'choice', 'shuffle'):
            self.bad(node, f'난수 속성 .{node.attr} 금지')
        self.generic_visit(node)

    def visit_Name(self, node):
        if node.id in ('random', 'noise', 'numpy', 'np', 'secrets', 'math', '__builtins__'):
            self.bad(node, f'이름 {node.id} 금지')

    def visit_Call(self, node):
        f = node.func
        name = f.id if isinstance(f, ast.Name) else f.attr if isinstance(f, ast.Attribute) else None
        if isinstance(f, ast.Name) and f.id in BANNED_CALLS:
            self.bad(node, f'{f.id}() 금지')
        if name:
            self.calls.add(self.calls_alias.get(name, name))
        if self.depth and isinstance(f, ast.Name) and f.id in self.loop_funcs:
            self.bad(node, f'반복 안에서 반복을 가진 함수 {f.id}() 호출 — 겹친 반복으로 본다')
        self.generic_visit(node)

    def visit_BinOp(self, node):
        if isinstance(node.op, BANNED_OPS):
            self.bad(node, f'연산자 {type(node.op).__name__} 금지(좌표 식 무늬·해시 금지)')
        if isinstance(node.op, ast.Mult):
            for seq, n in ((node.left, node.right), (node.right, node.left)):
                if isinstance(seq, (ast.List, ast.Tuple, ast.JoinedStr)) or (
                        isinstance(seq, ast.Constant) and isinstance(seq.value, str)):
                    k = _const_int(n)
                    if k is None or k > MAX_REPEAT:
                        self.bad(node, f'문자열·목록 반복은 상수 {MAX_REPEAT} 이하만')
        self.generic_visit(node)

    def visit_Lambda(self, node):
        self.bad(node, 'lambda 금지')
        self.generic_visit(node)


def check_code(path):
    if not os.path.exists(path):
        return False, 'finish_draw.py 가 없다', {'problems': ['missing']}
    src = open(path, encoding='utf-8').read()
    try:
        tree = ast.parse(src)
    except SyntaxError as e:
        return False, f'구문 오류 {e}', {'problems': [str(e)]}
    c = CodeCheck(tree)
    c.visit(tree)
    for need in ('load', 'save'):
        if need not in c.calls:
            c.problems.append(f'finish_lib.{need}() 를 부르지 않는다 — pixels.txt 를 load 해 고치고 save 한다')
    ok = not c.problems
    return ok, ('코드 통과' if ok else f'코드 문제 {len(c.problems)}: ' + ' / '.join(c.problems[:6])), {'problems': c.problems}


def run(write=True):
    leg, reg, base_chars = load_inputs()
    res = {'checks': {}}
    sha_px = hashlib.sha256(open(_p('pixels.txt'), 'rb').read()).hexdigest()
    if sha_px != reg['pixelsSha256']:
        res['checks']['pixels'] = {'ok': False, 'msg': 'pixels.txt 가 바뀌었다 — 고치는 것은 finish_draw.py 안에서만(하네스는 원본으로 다시 돌린다)'}
    code_ok, code_msg, code_info = check_code(_p('finish_draw.py'))
    res['checks']['e_code'] = {'ok': code_ok, 'msg': code_msg, **code_info}
    if not os.path.exists(_p('finished.png')):
        res['checks']['finished'] = {'ok': False, 'msg': 'finished.png 가 없다 — python3 finish_draw.py'}
        return _finish(res, write)
    fin = np.array(Image.open(_p('finished.png')).convert('RGBA'))
    base = np.array(Image.open(_p('base.png')).convert('RGBA'))
    mask = np.array(Image.open(_p('mask.png')).convert('L'))
    shade = np.array(Image.open(_p('shade.png')).convert('L')) > 0
    regm = np.array(Image.open(_p('regions.png')).convert('L'))
    if fin.shape != base.shape:
        res['checks']['a_mask'] = {'ok': False, 'msg': f'크기 {fin.shape[1]}×{fin.shape[0]} ≠ 바탕 {base.shape[1]}×{base.shape[0]}'}
        return _finish(res, write)
    diff = int((fin[:, :, 3] != mask).sum())
    res['checks']['a_mask'] = {'ok': diff == 0, 'msg': f'알파가 mask.png 와 다른 화소 {diff}', 'diff': diff}
    fin_chars, off = to_chars(fin, leg, shade)
    res['checks']['c_palette'] = {'ok': not off, 'msg': f'팔레트 밖 화소 {len(off)}' + (f' 예 {off[:5]}' if off else ''),
                                  'off': len(off)}
    ok, msg, info = check_door(fin_chars, base_chars, leg, reg)
    res['checks']['b_door'] = {'ok': ok, 'msg': msg, **info}
    ok, msg, info = check_eaves(fin_chars, base_chars, reg)
    res['checks']['d_eaves'] = {'ok': ok, 'msg': msg, **info}
    opaque = base[:, :, 3] == 255
    changed = int(((fin[:, :, :3] != base[:, :, :3]).any(axis=2) & opaque).sum())
    frac = changed / max(1, int(opaque.sum()))
    res['checks']['f_changed'] = {'ok': frac >= reg['minChanged'],
                                  'msg': f'바뀐 불투명 화소 {changed}/{int(opaque.sum())} = {frac:.1%} (하한 {reg["minChanged"]:.0%})',
                                  'changed': changed, 'opaque': int(opaque.sum()), 'frac': frac}
    ok, msg, info = check_period(fin[:, :, :3], base[:, :, :3], regm)
    res['checks']['g_period'] = {'ok': ok, 'msg': msg, **info}
    return _finish(res, write)


def _finish(res, write):
    res['pass'] = all(c['ok'] for c in res['checks'].values())
    if write:
        json.dump(res, open(_p('check.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return res


def main():
    res = run()
    for k, c in sorted(res['checks'].items()):
        print(f'{"PASS" if c["ok"] else "FAIL"} {k:10} {c["msg"]}')
    print('마감 검사: ' + ('전부 통과' if res['pass'] else '실패 — 고치고 다시 돌린다'))
    return 0 if res['pass'] else 1


if __name__ == '__main__':
    sys.exit(main())
