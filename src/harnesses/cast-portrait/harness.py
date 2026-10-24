#!/usr/bin/env python3
"""cast-portrait — new dialogue busts must look like the rest of the project's cast (same artist, same spec).

User approval of the spec (2026-10-25, Astra professor cg-nat10): 「이거는 꽤 규격이 괜찮네. 앞으로 이렇게 하도록 하네싱을 꽉 잡도록」.
The harness locks that procedure:
  1. per-project cast spec  harness-data/cast-portrait/projects/<project>.json  (lineup, canvas, rules, generation pipeline, dialogue fixture)
  2. draw      the cast's own generation pipeline (Astra: char-gen command engine + bake_astra_busts64), never resizing the source
  3. check     measurable rules (canvas, colours, framing, outline darkness, eye symmetry, scale vs the lineup, face-only expressions)
  4. lineup    each candidate inside the cast lineup (1x/3x) + expression strips + an anonymised blind packet for the reviewer
  5. dialogue  each candidate in the real dialogue box (qa:runtime) next to a cast member's line
  6. verdict   the blind reviewer's ranking and per-expression defects, bound to the candidates' pixel hashes
  7. pick      a human pick, bound to the same hashes; refused unless check + verdict pass on the current pixels
  8. install   copy the picked candidate into the project's install folder with provenance
Agents never pick. Hand pixel fixes go through `fix` so they are recorded and re-hashed (verdicts on old hashes stop counting).
"""
import argparse, base64, datetime, hashlib, io, json, os, random, shutil, string, subprocess, sys
from pathlib import Path
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
DATA = ROOT / 'harness-data/cast-portrait'
RUNS = ROOT / 'qa-runs/harnesses/cast-portrait'
sys.path.insert(0, str(HERE))
from measure import measure, face_only_violation  # noqa: E402


def now(): return datetime.datetime.now().isoformat(timespec='seconds')
def rd(p, d=None):
    try: return json.loads(Path(p).read_text())
    except FileNotFoundError: return d
def wr(p, o):
    p = Path(p); p.parent.mkdir(parents=True, exist_ok=True); p.write_text(json.dumps(o, ensure_ascii=False, indent=1) + '\n')
def spec_of(project):
    s = rd(DATA / 'projects' / f'{project}.json')
    if not s: raise SystemExit(f'no cast spec: harness-data/cast-portrait/projects/{project}.json')
    return s
def pix_sha(path): return hashlib.sha256(np.array(Image.open(path).convert('RGBA')).tobytes()).hexdigest()
def round_dir(project, rnd): return RUNS / project / rnd
def cands(project, rnd):
    d = round_dir(project, rnd)
    return sorted(p.name for p in d.iterdir() if p.is_dir() and (p / 'bust-base.png').exists() and not p.name.startswith('_')) if d.exists() else []
def hashes(project, rnd, cand, spec):
    d = round_dir(project, rnd) / cand
    return {e: pix_sha(d / f'bust-{e}.png') for e in spec['expressions'] if (d / f'bust-{e}.png').exists()}
def cast_img(spec, member, expr='base'):
    m = next(x for x in spec['lineup'] if x['id'] == member)
    p = ROOT / m['dir'] / f'bust-{expr}.png'
    return Image.open(p if p.exists() else ROOT / m['dir'] / 'bust-base.png').convert('RGBA')


# ---------------------------------------------------------------- calibrate
def calibrate(a):
    spec = spec_of(a.project); rows = {}
    for m in spec['lineup']:
        rows[m['id']] = {e: measure(cast_img(spec, m['id'], e)) for e in spec['expressions'] if (ROOT / m['dir'] / f'bust-{e}.png').exists()}
    base = [r['base'] for r in rows.values()]
    rng = lambda k: [min(b[k] for b in base), max(b[k] for b in base)]
    summary = {'sizes': sorted({tuple(b['size']) for b in base}), 'colours': rng('colours'), 'top': rng('top'), 'bottomCover': rng('bottomCover'),
               'outlineDark': rng('outlineDark'), 'headWidth': rng('headWidth'), 'headWidthRel': [round(min(b['headWidth'] / b['size'][0] for b in base), 3), round(max(b['headWidth'] / b['size'][0] for b in base), 3)],
               'eyesSymmetric': {k: r['base']['eyesSymmetric'] for k, r in rows.items()}}
    wr(DATA / a.project / 'baseline.json', {'measuredAt': now(), 'summary': summary, 'members': rows})
    print(json.dumps(summary, ensure_ascii=False, indent=1))
    print(f'-> harness-data/cast-portrait/{a.project}/baseline.json')
    return 0


def rules_of(spec, project):
    if spec['rules'] != 'calibrate': return spec['rules']
    b = rd(DATA / project / 'baseline.json')
    if not b: raise SystemExit(f'run `calibrate {project}` first (rules are derived from the cast)')
    s = b['summary']
    return {'maxColours': s['colours'][1], 'headTop': s['top'], 'bottomCoverMin': round(s['bottomCover'][0] - 0.05, 3),
            'outlineDarkMin': round(s['outlineDark'][0] - 0.05, 3), 'headWidthRelRange': s['headWidthRel'], 'headWidthTolerance': 0.12,
            'faceBox': [0.22, 0.30, 0.78, 0.80], 'faceOnlyExpressions': False, 'eyeTolerance': {'w': 2, 'h': 1, 'y': 1},
            # the pixel eye detector only means something when it reads the existing cast; illustration casts skip it
            'requireEyeSymmetry': all(v is True for v in s['eyesSymmetric'].values())}


# ---------------------------------------------------------------- draw (generation)
def ref_sheet(spec, role, out):
    """style references (cast busts, 8x nearest) on the left, the role's identity sprite on the right — the same sheet the
    cast pass used (~/astra-qa/prof3/ref-professor.png)."""
    refs = [cast_img(spec, m).resize((512, 512), Image.NEAREST) for m in spec['pipeline']['styleRefs']]
    ident = Image.open(ROOT / spec['roles'][role]['identityImage']).convert('RGBA')
    k = max(1, 496 // ident.height); ident = ident.resize((ident.width * k, ident.height * k), Image.NEAREST)
    W = 24 + len(refs) * 552 + ident.width + 40
    sheet = Image.new('RGBA', (W, 560), (255, 255, 255, 255))
    for i, r in enumerate(refs): sheet.alpha_composite(r, (24 + i * 552, 24))
    sheet.alpha_composite(ident, (24 + len(refs) * 552 + 16, 560 - ident.height - 32))
    sheet.convert('RGB').save(out)


def imagegen(prompt, ref, out):
    sys.path.insert(0, os.environ.get('CHARGEN_ROOT', '/home/main/char-gen-public'))
    os.environ.setdefault('CHARGEN_IMAGE_CMD', f'python3 {ROOT / "scripts/content/monsters/astra_professor_chargen/kaykai_cmd.py"} {{prompt}} {{ref}} {{out}} {{size}}')
    from chargen import imagegen as ig
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    Path(str(out) + '.prompt.txt').write_text(prompt)
    ig.generate('command', prompt, Path(ref), Path(out), size='1024x1024')


def bake_candidate(spec, raw_base, raw_exprs, out_dir):
    """the cast's baker, unchanged, plus the hard 'never resize' rule: the recovered native grid must already fit the canvas."""
    sys.path.insert(0, str(ROOT / 'scripts/content/monsters'))
    import bake_astra_busts64 as B
    lo, hi = spec['rules']['nativeGrid']
    bn = B.native(raw_base)
    if not (lo <= bn.size[0] <= hi and lo <= bn.size[1] <= hi):
        return f'native grid {bn.size} outside {lo}..{hi} (would need resizing or cropping the head) — rejected'
    b64, info = B.place(bn)
    if abs(info['f'] - 1.0) > 1e-6: return f'placement scale {info["f"]} != 1 — rejected (no resizing)'
    names, ims, srcs = ['base'], [b64], [raw_base]
    for e, src in raw_exprs.items():
        en = B.native(src)
        names.append(e); ims.append(B.place(B.face_only(bn, en), 1.0, fixed=(info['x0'], info['y0']))[0]); srcs.append(src)
    ims = B.shared_palette(ims, spec['rules']['maxColours'])
    out_dir.mkdir(parents=True, exist_ok=True)
    prov = {'pipeline': spec['pipeline']['kind'], 'nativeGrid': list(bn.size), 'place': {k: float(v) for k, v in info.items()}, 'pictures': {}}
    for nm, im, src in zip(names, ims, srcs):
        if im.size != tuple(spec['canvas']): return f'{nm}: output {im.size} != canvas {spec["canvas"]} — rejected'
        im.save(out_dir / f'bust-{nm}.png', optimize=True)
        prov['pictures'][f'bust-{nm}.png'] = {'source': str(src), 'sourceSha256': hashlib.sha256(Path(src).read_bytes()).hexdigest(), 'pixelSha256': B.sha(im)}
    wr(out_dir / 'provenance.json', prov)
    return None


def draw(a):
    spec = spec_of(a.project); pl = spec['pipeline']
    if pl['kind'] != 'chargen-busts64':
        print(f'{a.project}: generation pipeline not configured ({pl["kind"]}). Use `import` for pictures made elsewhere.'); return 2
    role = spec['roles'][a.role]; rdir = round_dir(a.project, a.round); raw = rdir / '_raw'; raw.mkdir(parents=True, exist_ok=True)
    ref = raw / f'ref-{a.role}.png'; ref_sheet(spec, a.role, ref)
    var = a.variant or pl['defaultVariant']
    exprs = [e for e in spec['expressions'] if e != 'base']
    made = 0
    for i in range(1, a.n + 1):
        key = f'{var}{i}'; base_raw = raw / f'{a.role}-{key}.png'
        if not base_raw.exists():
            imagegen(pl['baseTemplate'].format(style=pl['variants'][var], identity=role['identity']), ref, base_raw)
        xr = {}
        for e in exprs:
            p = raw / f'{a.role}-{key}-{e}-t1.png'
            if not p.exists(): imagegen(pl['expressionTemplate'].format(expression=pl['expressionPrompts'][e]), base_raw, p)
            xr[e] = p
        why = bake_candidate(spec, base_raw, xr, rdir / f'{a.role}-{key}')
        if why:
            print(f'{key}: {why}'); shutil.rmtree(rdir / f'{a.role}-{key}', ignore_errors=True); continue
        made += 1; print(f'{key}: baked')
    wr(rdir / 'round.json', {**(rd(rdir / 'round.json', {})), 'project': a.project, 'role': a.role, 'createdAt': now(), 'pipeline': pl['kind']})
    print(f'{made}/{a.n} candidates -> {rdir.relative_to(ROOT)}. Next: check, lineup, dialogue.')
    return 0 if made else 1


def import_(a):
    """register pictures that already exist (made by the same pipeline elsewhere). Copies bytes; never resizes."""
    spec = spec_of(a.project); src = (ROOT / a.dir) if not os.path.isabs(a.dir) else Path(a.dir)
    dst = round_dir(a.project, a.round) / a.candidate; dst.mkdir(parents=True, exist_ok=True)
    for e in spec['expressions']:
        p = src / f'bust-{e}.png'
        if not p.exists(): print(f'missing {p}'); return 1
        if spec['canvas'] and Image.open(p).size != tuple(spec['canvas']):
            print(f'{p}: {Image.open(p).size} != canvas {spec["canvas"]} — rejected (no resizing)'); return 1
        shutil.copyfile(p, dst / f'bust-{e}.png')
    if (src / 'provenance.json').exists(): shutil.copyfile(src / 'provenance.json', dst / 'provenance.json')
    wr(round_dir(a.project, a.round) / 'round.json', {**(rd(round_dir(a.project, a.round) / 'round.json', {})), 'project': a.project, 'role': a.role})
    m = rd(dst / 'import.json', {}); m.update({'from': str(a.dir), 'role': a.role, 'at': now()}); wr(dst / 'import.json', m)
    print(f'imported {a.candidate} from {a.dir}'); return 0


def fix(a):
    """hand pixel fix on one expression: x,y=#rrggbb ... Recorded and re-hashed; old verdicts no longer match."""
    spec = spec_of(a.project); d = round_dir(a.project, a.round) / a.candidate; p = d / f'bust-{a.expr}.png'
    im = Image.open(p).convert('RGBA'); before = pix_sha(p); px = im.load(); edits = {}
    for s in a.pixels:
        xy, col = s.split('='); x, y = map(int, xy.split(','))
        px[x, y] = (int(col[1:3], 16), int(col[3:5], 16), int(col[5:7], 16), 255); edits[f'{x},{y}'] = col
    im.save(p, optimize=True)
    log = rd(d / 'fixes.json', []); log.append({'expr': a.expr, 'pixels': edits, 'before': before, 'after': pix_sha(p), 'why': a.why, 'at': now()}); wr(d / 'fixes.json', log)
    print(f'{a.candidate}/{a.expr}: {len(edits)} px'); return 0


# ---------------------------------------------------------------- check
def check_one(spec, rules, project, rnd, cand):
    d = round_dir(project, rnd) / cand; base = Image.open(d / 'bust-base.png')
    b = rd(DATA / project / 'baseline.json'); fails, per = [], {}
    for e in spec['expressions']:
        p = d / f'bust-{e}.png'
        if not p.exists(): fails.append(f'{e}: missing'); continue
        im = Image.open(p); m = measure(im); per[e] = m; f = []
        if spec['canvas'] and list(im.size) != spec['canvas']: f.append(f'size {im.size} != {spec["canvas"]}')
        if m['colours'] > rules['maxColours']: f.append(f'colours {m["colours"]} > {rules["maxColours"]}')
        if m['partialAlpha'] or not m['cornersTransparent']: f.append('background not clean transparent')
        if not (rules['headTop'][0] <= m['top'] <= rules['headTop'][1]): f.append(f'head top y{m["top"]} outside {rules["headTop"]}')
        if m['bottomCover'] < rules['bottomCoverMin']: f.append(f'shoulders do not run off the bottom ({m["bottomCover"]})')
        if m['headTouchesSide']: f.append('head cut by the side edge')
        if m['outlineDark'] < rules['outlineDarkMin']: f.append(f'outline dark {m["outlineDark"]} < {rules["outlineDarkMin"]}')
        if abs(m['headCentreOffset']) > rules.get('headCentreMaxOffset', 99): f.append(f'head off-centre {m["headCentreOffset"]}')
        if b:
            s = b['summary']; tol = rules['headWidthTolerance']
            rel = m['headWidth'] / im.size[0]; lo, hi = s['headWidthRel']
            if not (lo * (1 - tol) <= rel <= hi * (1 + tol)): f.append(f'head width {m["headWidth"]}px ({rel:.2f}) outside cast {lo:.2f}..{hi:.2f} ±{tol:.0%}')
        if e in spec['openEyeExpressions'] and rules.get('requireEyeSymmetry', True):
            if m['eyesSymmetric'] is None: f.append('eyes not found (open-eye expression)')
            elif not m['eyesSymmetric']: f.append(f'eyes not symmetric {m["eyes"]}')
        if e != 'base' and rules.get('faceOnlyExpressions'):
            v = face_only_violation(base, im, tuple(rules['faceBox']))
            if v: f.append(f'{v} px changed outside the face box (expressions must edit the face only)')
        fails += [f'{e}: {x}' for x in f]
    prov = rd(d / 'provenance.json', {})
    if spec.get('rules') != 'calibrate' and prov.get('nativeGrid'):
        lo, hi = rules['nativeGrid']
        if not all(lo <= v <= hi for v in prov['nativeGrid']): fails.append(f'native grid {prov["nativeGrid"]} outside {lo}..{hi}')
        if abs(prov.get('place', {}).get('f', 1.0) - 1.0) > 1e-6: fails.append('source was resized')
    return {'pass': not fails, 'fails': fails, 'measures': per, 'hashes': hashes(project, rnd, cand, spec), 'at': now()}


def check(a):
    spec = spec_of(a.project); rules = rules_of(spec, a.project)
    if not rd(DATA / a.project / 'baseline.json'): print('no baseline yet — running calibrate first'); calibrate(a)
    out = {c: check_one(spec, rules, a.project, a.round, c) for c in (a.candidates or cands(a.project, a.round))}
    wr(round_dir(a.project, a.round) / 'checks.json', out)
    bad = 0
    for c, r in out.items():
        print(('PASS ' if r['pass'] else 'FAIL ') + c)
        for f in r['fails']: print('   ', f)
        bad += not r['pass']
    return 1 if bad else 0


# ---------------------------------------------------------------- lineup + blind packet
def strip(ims, s, pad=6, bg=(232, 240, 222, 255)):
    out = Image.new('RGBA', (len(ims) * (ims[0].width * s + pad) - pad, max(i.height for i in ims) * s), bg)
    for i, im in enumerate(ims): out.alpha_composite(im.resize((im.width * s, im.height * s), Image.NEAREST), (i * (ims[0].width * s + pad), out.height - im.height * s))
    return out


def lineup(a):
    spec = spec_of(a.project); rdir = round_dir(a.project, a.round); cs = a.candidates or cands(a.project, a.round)
    cast = [cast_img(spec, m['id']) for m in spec['lineup']]
    if spec['canvas'] is None:   # mixed-size illustration casts: compare at one display height
        H = 128; cast = [c.resize((round(c.width * H / c.height), H), Image.LANCZOS) for c in cast]
    letters = list(string.ascii_uppercase[22:] + string.ascii_uppercase[:22])[:len(cs)]
    random.Random(a.seed).shuffle(letters)
    blind = dict(zip(letters, cs)); bdir = rdir / '_blind'; shutil.rmtree(bdir, ignore_errors=True); bdir.mkdir(parents=True)
    k = min(3, len(cast))
    for L, c in blind.items():
        d = rdir / c; ims = [Image.open(d / f'bust-{e}.png').convert('RGBA') for e in spec['expressions']]
        b0 = ims[0] if spec['canvas'] else ims[0].resize((round(ims[0].width * 128 / ims[0].height), 128), Image.LANCZOS)
        row = cast[:k] + [b0] + cast[k:]
        for s in (1, 3):
            strip(row, s).save(d / f'lineup-{s}x.png'); strip(row, s).save(bdir / f'lineup-{L}-{s}x.png')
        strip(ims, 4, 8).save(d / f'expressions-4x.png'); strip(ims, 4, 8).save(bdir / f'expressions-{L}-4x.png')
    strip(cast, 3).save(bdir / 'cast-only-3x.png')
    wr(rdir / 'blind.json', {'seed': a.seed, 'letters': blind, 'hashes': {c: hashes(a.project, a.round, c, spec) for c in cs}, 'at': now()})
    prompt = f"""Blind cast-fit review — {spec['title']}.
Files in {bdir.relative_to(ROOT)}: cast-only-3x.png (the existing cast, all by one artist), and for each candidate letter
lineup-<L>-1x/3x.png (the candidate placed 4th inside the cast), expressions-<L>-4x.png ({', '.join(spec['expressions'])}),
and ingame-<L>-*.png (the real dialogue box, if present). You do not know how any candidate was made.
For EVERY candidate answer:
1. Cast fit 1-10, and "indistinguishable in style from the cast (same artist)": yes/no, with the concrete differences
   (outline colour/weight, palette and shading steps, eye and mouth construction, framing and head size).
2. Every expression: defects (asymmetric eyes, stray pixels, smears, broken mouth, wrong age/identity) or "none".
3. Ranking of all letters, best first, and a ship verdict for the best one.
Return JSON: {{"ranking": [...], "candidates": {{"<L>": {{"castFit": n, "sameArtist": true|false, "defects": {{"<expr>": "none"|"..."}}, "notes": "..."}}}}}}"""
    (bdir / 'REVIEW-PROMPT.md').write_text(prompt + '\n')
    print(f'lineup + blind packet -> {bdir.relative_to(ROOT)} ({len(cs)} candidates). Next: dialogue, then send REVIEW-PROMPT.md to an independent Argon reviewer.')
    return 0


# ---------------------------------------------------------------- dialogue (real dialogue box)
def dialogue(a):
    spec = spec_of(a.project); dl = spec.get('dialogue'); rdir = round_dir(a.project, a.round)
    if not dl: print(f'{a.project}: dialogue fixture not configured in the spec'); return 2
    role = spec['roles'][a.role]; cs = a.candidates or cands(a.project, a.round)
    pj = ROOT / dl['projectJson']
    if not pj.exists() or a.redump:
        subprocess.run(['npx', 'vite-node', '--script', dl['dump']], cwd=ROOT, check=True)
    p = json.loads(pj.read_text())
    if dl.get('disableOpening'): p['system']['opening'] = {**p['system'].get('opening', {}), 'enabled': False}
    cmds, labels = [], []
    say = lambda res, lab, line: [{'kind': 'changeFace', 'resourceId': res, 'presentation': 'bust', 'position': 'left', 'flipHorizontally': False},
                                  {'kind': 'text', 'body': f'{lab} {line}', 'position': 'bottom'}]
    for m in spec['lineup']:
        lab = f'〈{m["id"]}〉'; labels.append(lab); cmds += say(m['resource'].format(expr='base'), lab, dl['castLines'].get(m['id'], '…'))
    blind = rd(rdir / 'blind.json')
    if not blind: print('run lineup first (the dialogue shots are labelled with the blind letters, never candidate names)'); return 1
    inv = {v: k for k, v in blind['letters'].items()}
    cs = [c for c in cs if c in inv]
    for c in cs:
        for e in spec['dialogueExpressions']:
            rid = f'cast_portrait_{inv[c].lower()}_{e}'
            data = base64.b64encode((rdir / c / f'bust-{e}.png').read_bytes()).decode()
            p['assets']['uploaded'][rid] = {'id': rid, 'name': f'{inv[c]} {e}', 'kind': 'picture', 'dataUrl': f'data:image/png;base64,{data}', 'meta': {}}
            lab = f'〈{inv[c]} {e}〉'; labels.append(lab); cmds += say(rid, lab, role['lines'].get(e, '…'))
    m = p['maps'][dl['map']]; ev = [x for x in m['events'] if x['id'].endswith(dl['eventIdSuffix'])][0]
    ev['pages'][0]['commands'] = cmds + ([{'kind': 'setSwitch', 'switchId': dl['afterSwitch'], 'value': True}] if dl.get('afterSwitch') else [])
    fx = rdir / '_dialogue/fixture.json'; fx.parent.mkdir(parents=True, exist_ok=True); fx.write_text(json.dumps(p))
    wr(rdir / '_dialogue/labels.json', labels)
    env = {**os.environ, 'CAST_PORTRAIT_FIXTURE': str(fx.relative_to(ROOT)), 'CAST_PORTRAIT_LABELS': str((rdir / '_dialogue/labels.json').relative_to(ROOT)),
           'CAST_PORTRAIT_VIEWPORT': 'x'.join(map(str, dl['viewport']))}
    cmd = 'npm run qa:runtime -- --scenario cast-portrait-dialogue'
    if not a.no_netns: cmd = f"unshare -rn bash -c 'ip link set lo up; {cmd}'"
    r = subprocess.run(cmd, shell=True, cwd=ROOT, env=env)
    shots = ROOT / 'verify-shots/runtime-qa/cast-portrait-dialogue'
    for old in (rdir / '_blind').glob('ingame-*.png'): old.unlink()
    for f in sorted(shots.glob('*.png')):
        shutil.copyfile(f, rdir / '_dialogue' / f.name)
        for c in cs:
            for e in spec['dialogueExpressions']:
                if f.stem.endswith(f'-{inv[c].lower()}-{e}'): shutil.copyfile(f, rdir / '_blind' / f'ingame-{inv[c]}-{e}.png')
        for n in dl.get('neighbours', []):
            if f.stem.endswith(f'-{n}'): shutil.copyfile(f, rdir / '_blind' / f'ingame-cast-{n}.png')
    print(f'dialogue shots -> {(rdir / "_dialogue").relative_to(ROOT)} (exit {r.returncode})')
    return r.returncode


# ---------------------------------------------------------------- verdict / pick / install / status
def verdict(a):
    """record the blind reviewer's JSON (see _blind/REVIEW-PROMPT.md) against the hashes the packet was built from."""
    spec = spec_of(a.project); rdir = round_dir(a.project, a.round); blind = rd(rdir / 'blind.json')
    if not blind: print('run lineup first'); return 1
    v = json.loads(Path(a.file).read_text())
    cur = {c: hashes(a.project, a.round, c, spec) for c in blind['letters'].values()}
    stale = [c for c, h in blind['hashes'].items() if cur.get(c) != h]
    if stale: print(f'pixels changed since the blind packet was built: {stale} — rebuild lineup/dialogue and review again'); return 1
    rec = {'reviewer': a.reviewer, 'source': a.source, 'at': now(), 'letters': blind['letters'], 'hashes': blind['hashes'], 'review': v}
    log = rd(rdir / 'verdicts.json', []); log.append(rec); wr(rdir / 'verdicts.json', log)
    for L, r in v['candidates'].items():
        ok = r.get('sameArtist') and all(str(x).strip().lower() == 'none' for x in r.get('defects', {}).values())
        print(f'{L}={blind["letters"][L]}: fit {r.get("castFit")} sameArtist={r.get("sameArtist")} {"PASS" if ok else "not yet"}')
    return 0


def passes(spec, project, rnd, cand):
    cur = hashes(project, rnd, cand, spec)
    ch = rd(round_dir(project, rnd) / 'checks.json', {}).get(cand)
    if not ch or ch['hashes'] != cur: return False, 'check not run on the current pixels'
    if not ch['pass']: return False, 'check failed: ' + '; '.join(ch['fails'][:3])
    for rec in reversed(rd(round_dir(project, rnd) / 'verdicts.json', [])):
        L = {v: k for k, v in rec['letters'].items()}.get(cand)
        if L is None or rec['hashes'].get(cand) != cur: continue
        r = rec['review']['candidates'].get(L, {})
        if not r.get('sameArtist'): return False, f'blind reviewer: not the same artist ({rec["reviewer"]})'
        bad = {e: x for e, x in r.get('defects', {}).items() if str(x).strip().lower() != 'none'}
        if bad: return False, f'blind reviewer defects: {bad}'
        missing = [e for e in spec['expressions'] if e not in r.get('defects', {})]
        if missing: return False, f'blind review did not cover {missing}'
        return True, f'check PASS + blind {rec["reviewer"]} sameArtist (fit {r.get("castFit")}, rank {rec["review"].get("ranking", []).index(L) + 1 if L in rec["review"].get("ranking", []) else "?"}), no defects'
    return False, 'no blind verdict on the current pixels'


def pick(a):
    spec = spec_of(a.project); ok, why = passes(spec, a.project, a.round, a.candidate)
    if not ok: print(f'refused: {why}'); return 1
    if not a.by or a.by.lower() in ('agent', 'claude', 'supervisor'): print('refused: a pick needs the human who chose (--by "<user, quote>")'); return 1
    rd_ = round_dir(a.project, a.round)
    rec = {'project': a.project, 'role': a.role, 'round': a.round, 'candidate': a.candidate, 'by': a.by, 'at': now(), 'basis': why,
           'hashes': hashes(a.project, a.round, a.candidate, spec),
           # qa-runs/ is not committed: keep the evidence the pick stands on next to the pick
           'check': rd(rd_ / 'checks.json', {}).get(a.candidate, {}).get('measures', {}).get('base'),
           'verdict': rd(rd_ / 'verdicts.json', [])[-1] if rd(rd_ / 'verdicts.json', []) else None,
           'fixes': rd(rd_ / a.candidate / 'fixes.json', []) or rd(rd_ / a.candidate / 'provenance.json', {}).get('fixes', [])}
    picks = rd(DATA / a.project / 'picks.json', []); picks.append(rec); wr(DATA / a.project / 'picks.json', picks)
    print(f'picked {a.role} = {a.candidate} ({why})'); return 0


def install(a):
    spec = spec_of(a.project); cur = hashes(a.project, a.round, a.candidate, spec)
    pk = [p for p in rd(DATA / a.project / 'picks.json', []) if p['role'] == a.role and p['candidate'] == a.candidate and p['hashes'] == cur]
    if not pk: print('refused: no human pick on the current pixels'); return 1
    dst = ROOT / spec['roles'][a.role]['installDir'].format(candidate=a.candidate); dst.mkdir(parents=True, exist_ok=True)
    src = round_dir(a.project, a.round) / a.candidate
    for e in spec['expressions']: shutil.copyfile(src / f'bust-{e}.png', dst / f'bust-{e}.png')
    prov = rd(src / 'provenance.json', {}); prov['castPortraitHarness'] = {'pick': pk[-1], 'fixes': rd(src / 'fixes.json', [])}
    wr(dst / 'provenance.json', prov)
    print(f'installed -> {dst.relative_to(ROOT)}; wire the id in {spec["roles"][a.role].get("selectableIn", "the project")}'); return 0


def status(a):
    spec = spec_of(a.project); base = rd(DATA / a.project / 'baseline.json')
    print(f'{a.project}: {spec["title"]} · lineup {len(spec["lineup"])} · pipeline {spec["pipeline"]["kind"]} · baseline {"yes" if base else "no (calibrate)"}')
    for rdir in sorted((RUNS / a.project).glob('*')) if (RUNS / a.project).exists() else []:
        for c in cands(a.project, rdir.name):
            ok, why = passes(spec, a.project, rdir.name, c); print(f'  {rdir.name}/{c}: {"READY" if ok else "-"} {why}')
    for p in rd(DATA / a.project / 'picks.json', []): print(f'  pick {p["role"]}={p["candidate"]} by {p["by"]} at {p["at"]}')
    return 0


def list_(a):
    for p in sorted((DATA / 'projects').glob('*.json')):
        s = json.loads(p.read_text()); print(f'{s["project"]}: {s["title"]} · {len(s["lineup"])} cast · pipeline {s["pipeline"]["kind"]} · roles {", ".join(s["roles"]) or "-"}')
    return 0


def main():
    ap = argparse.ArgumentParser(prog='npm run harness -- cast-portrait'); sp = ap.add_subparsers(dest='stage', required=True)
    sp.add_parser('list')
    for n in ('calibrate', 'status'): sp.add_parser(n).add_argument('project')
    q = sp.add_parser('draw'); q.add_argument('project'); q.add_argument('role'); q.add_argument('--round', required=True); q.add_argument('--n', type=int, default=4); q.add_argument('--variant')
    q = sp.add_parser('import'); q.add_argument('project'); q.add_argument('role'); q.add_argument('round'); q.add_argument('candidate'); q.add_argument('dir')
    q = sp.add_parser('fix'); q.add_argument('project'); q.add_argument('round'); q.add_argument('candidate'); q.add_argument('expr'); q.add_argument('pixels', nargs='+'); q.add_argument('--why', required=True)
    q = sp.add_parser('check'); q.add_argument('project'); q.add_argument('round'); q.add_argument('candidates', nargs='*')
    q = sp.add_parser('lineup'); q.add_argument('project'); q.add_argument('round'); q.add_argument('candidates', nargs='*'); q.add_argument('--seed', type=int, default=7)
    q = sp.add_parser('dialogue'); q.add_argument('project'); q.add_argument('role'); q.add_argument('round'); q.add_argument('candidates', nargs='*'); q.add_argument('--redump', action='store_true'); q.add_argument('--no-netns', action='store_true')
    q = sp.add_parser('verdict'); q.add_argument('project'); q.add_argument('round'); q.add_argument('file'); q.add_argument('--reviewer', required=True); q.add_argument('--source', default='')
    for n in ('pick', 'install'):
        q = sp.add_parser(n); q.add_argument('project'); q.add_argument('role'); q.add_argument('round'); q.add_argument('candidate')
        if n == 'pick': q.add_argument('--by', required=True)
    a = ap.parse_args()
    return {'list': list_, 'calibrate': calibrate, 'draw': draw, 'import': import_, 'fix': fix, 'check': check, 'lineup': lineup, 'dialogue': dialogue,
            'verdict': verdict, 'pick': pick, 'install': install, 'status': status}[a.stage](a)


if __name__ == '__main__':
    sys.exit(main() or 0)
