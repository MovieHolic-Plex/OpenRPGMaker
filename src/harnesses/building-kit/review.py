"""building-kit 독립 검수 — 그리지 않은 새 Opus 프로세스가 섞인 보드를 보고, 숨긴 함정을 통과시키면 그 회차는 무효다.

`review <테마> <판> [--runs 3] [--judge-cmd "…"]`

보드 = 버들항 기준 건물(같은 배율 2배) + 후보 건물들(라벨은 회차마다 섞은 숫자) + **숨긴 함정**:
  roof_gap 지붕·벽 사이에 투명 한 줄 / two_doors 문 두 개 / flat 평면 채우기(두 색) / noise 잡음 /
  thin_roof 정면 입면(지붕을 한 줄 띠로) / recolor_original 버들항 원본 색만 바꾼 것.
  requireGableFront 판(style-r5~)은 하나 더: flat_elevation — 후보 **자기 부품**(그 판의 용마루-정면 지붕 + 벽)으로
  조립한, 용마루가 정면과 나란한 지붕 아래 평평한 정면 입면(사용자가 반려한 투영). 판정자 프롬프트의 view34 에
  「박공 정면이 없으면 FAIL」 규칙이 붙는다.
정답(key.json)은 판정자 폴더(work/) 밖에 둔다. 판정자는 Read 로 그림만 보고 JSON 줄로 답한다.
함정 하나라도 PASS(두 축 모두 PASS)하거나 표본을 빠뜨리면 그 회차는 무효 — 무효는 유효 회차 수에 세지 않고 다시 돌린다.
유효 3회 다수결(두 축 view34·quality 모두 PASS 가 과반). 영수증 review/<판>/<후보>.json = 그림 화소 해시 + 판정 원문 해시.

기준은 tile-gen ivqa/PROMPT.md 의 적대적 아트 디렉터 기준(반복·화풍 일치·지붕/벽 짜임·3/4 관례·읽힘)을 건물로 옮긴 것이다.
판정자·그리기 프로세스는 다르다. 감독·에이전트는 판정을 고쳐 쓰지 않는다.
"""
import colorsys
import datetime
import hashlib
import json
import os
import random
import re
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import numpy as np
from PIL import Image, ImageDraw  # noqa: E402

import assemble as AS  # noqa: E402
import beodeul  # noqa: E402
import dot  # noqa: E402

REPO = dot.REPO
# 2026-10-22: 판당자(opus medium)가 표본 18개·2배·보드당 6개에서 1px 지붕·벽 틈 함정을 거듭 놓쳤다(판타지·귀족 r4 무효 4~5회).
# 기준은 그대로 두고 보는 해상도를 올린다: 보드당 4개, 3배, 판당자 강도 high.
PER_BOARD = 4
SCALE = 3
REF_SCALE = 2
DEFAULT_RUNS = 3
DEFAULT_RETRIES = 2
JUDGE_MODEL = os.environ.get('BUILDING_KIT_JUDGE_MODEL', 'opus')
JUDGE_EFFORT = os.environ.get('BUILDING_KIT_JUDGE_EFFORT', 'high')
JUDGE_TIMEOUT = int(os.environ.get('BUILDING_KIT_JUDGE_TIMEOUT', '3600'))
REF_KITS = ('bd-house-h101_0', 'bd-house-inn', 'bd-out-cabin')
PROBE_NAMES = ('roof_gap', 'two_doors', 'flat', 'noise', 'thin_roof', 'recolor_original')
GABLE_FRONT_PROBES = ('flat_elevation',)


def now():
    return datetime.datetime.now().isoformat(timespec='seconds')


def sha(im):
    return dot.image_hash(im)


def _rng(seed=None):
    seed = seed if seed is not None else os.environ.get('BUILDING_KIT_REVIEW_SEED')
    return random.Random(int(seed)) if seed else random.SystemRandom()


def ref_buildings():
    if not hasattr(ref_buildings, 'cache'):
        out = []
        for kid in REF_KITS:
            try:
                out.append((kid, beodeul.kit(kid).img()))
            except SystemExit:
                continue
        ref_buildings.cache = out
    return ref_buildings.cache


def _flat(im):
    a = np.array(im.convert('RGBA'))
    cols = sorted({tuple(int(v) for v in c) for c in a[a[:, :, 3] == 255][:, :3]}, key=lambda c: dot.lum(c))
    if not cols:
        return im
    dark, mid = cols[len(cols) // 5], cols[len(cols) // 2]
    out = a.copy()
    op = a[:, :, 3] > 0
    out[op, :3] = [dark if dot.lum(c) < 90 else mid for c in a[op][:, :3]]
    return Image.fromarray(out, 'RGBA')


def _noise(im, pal, rng):
    cols = [dot.hx(c) for c in pal['allowed']]
    a = np.array(im.convert('RGBA'))
    out = a.copy()
    h, w = a.shape[:2]
    for y in range(h):
        for x in range(w):
            if a[y, x, 3] and rng.random() < 0.3:
                out[y, x, :3] = rng.choice(cols)
    return Image.fromarray(out, 'RGBA')


def _recolor(im):
    a = np.array(im.convert('RGBA')).astype(float)
    out = a.copy()
    for y in range(a.shape[0]):
        for x in range(a.shape[1]):
            if a[y, x, 3]:
                r, g, b = (a[y, x, i] / 255 for i in range(3))
                h, s, v = colorsys.rgb_to_hsv(r, g, b)
                r2, g2, b2 = colorsys.hsv_to_rgb((h + 0.5) % 1, min(1, s * 1.6 + 0.35), v)
                out[y, x, :3] = (r2 * 255, g2 * 255, b2 * 255)
    return Image.fromarray(out.astype(np.uint8), 'RGBA')


def _insert_gap(im, row, rows=3):
    a = np.array(im.convert('RGBA'))
    out = np.zeros((a.shape[0] + rows, a.shape[1], 4), np.uint8)
    out[:row] = a[:row]
    out[row + rows:] = a[row:]
    return Image.fromarray(out, 'RGBA')


def _thin_roof(im, roof_px):
    a = np.array(im.convert('RGBA')).copy()
    keep = dot.T
    src = a[roof_px:roof_px + (roof_px - keep)].copy()
    a[:src.shape[0]] = src
    return Image.fromarray(a, 'RGBA')


def _second_door(im, kit, parts, recipe):
    door = kit.get('door')
    mass = next((m for m in kit.get('masses') or [] if m['id'] == kit.get('doorMass')), None)
    if not door or not mass or not mass.get('walls'):
        return None
    wall = parts[mass['walls'][0]]['item']
    door_pc = next((pc for pc in wall['pieces'] if pc.get('role') == 'd'), None)
    if door_pc is None:
        return None
    sheet = parts[mass['walls'][0]]['img']
    crop = np.array(sheet.crop((door_pc['at'][0] * dot.T, door_pc['at'][1] * dot.T,
                                (door_pc['at'][0] + door_pc['size'][0]) * dot.T,
                                (door_pc['at'][1] + door_pc['size'][1]) * dot.T)))
    a = np.array(im.convert('RGBA')).copy()
    dx, dy = door
    tx = mass['x'] + (0 if dx - mass['x'] > 1 else mass['cols'] - 1)
    a[dy * dot.T:dy * dot.T + crop.shape[0], tx * dot.T:tx * dot.T + crop.shape[1]] = crop
    return Image.fromarray(a, 'RGBA')


def flat_elevation(parts, pal, theme):
    """후보 자기 부품으로 만든 반려 투영 — 용마루가 정면과 나란한 지붕 + 평평한 정면 입면(질량 하나, 6칸 1층)."""
    roofs = [i for i, p in parts.items() if p['item'].get('wave') == 'roof' and not p['item'].get('form')
             and not p['item'].get('spire') and int(p['item'].get('end', AS.ROOF_END)) == AS.ROOF_END]
    walls = [i for i, p in parts.items() if p['item'].get('wave') == 'wall'
             and {'l', 'm', 'w', 'd', 'r'} <= {pc.get('role') for pc in p['item']['pieces']}]
    if not roofs or not walls:
        return None
    roof = min(roofs, key=lambda i: (parts[i]['item']['pieces'][0]['size'][1], i))
    recipe = {'id': 'probe.flat_elevation', 'title': '', 'use': 'probe',
              'masses': [{'id': 'm', 'cols': 6, 'storeys': 1, 'x': 0, 'depth': 0, 'roof': roof,
                          'walls': [{'item': sorted(walls)[0], 'letters': 'L W M D W R'}]}]}
    res = AS.assemble(recipe, parts, pal, theme, require_gable_front=False)
    return res['img'].img() if res['img'] is not None else None


def probes_for(base_im, kit, parts, recipe, pal, rng, gable_front=False, theme=None):
    rh_px = kit['roofRows'] * dot.T
    out = [('roof_gap', _insert_gap(base_im, rh_px)),
           ('flat', _flat(base_im)),
           ('noise', _noise(base_im, pal, rng)),
           ('thin_roof', _thin_roof(base_im, rh_px))]
    td = _second_door(base_im, kit, parts, recipe)
    if td is not None:
        out.append(('two_doors', td))
    refs = ref_buildings()
    if refs:
        _, rim = rng.choice(refs)
        out.append(('recolor_original', _recolor(rim)))
    if gable_front:
        fe = flat_elevation(parts, pal, theme)
        if fe is None:
            raise SystemExit('requireGableFront 판인데 flat_elevation 함정을 만들 용마루-정면 지붕·벽 부품이 없다')
        out.append(('flat_elevation', fe))
    return out


# 검수판의 그림은 게임처럼 풀 땅 위에 놓는다. 어두운 카드 바탕에 바로 놓으면 지붕·벽 사이 투명 틈이
# 처마 밑 그림자처럼 보여 판정자가 roof_gap 함정을 통과시켰다(northern-snow style-r1·r2 무효 6회).
GROUND = (98, 140, 72, 255)


def _on_ground(img):
    g = Image.new('RGBA', img.size, GROUND)
    g.alpha_composite(img.convert('RGBA'))
    return g


def _card(label, img, k=SCALE):
    img = _on_ground(img)
    big = img.resize((img.width * k, img.height * k), Image.NEAREST)
    W, H = max(big.width + img.width + 14, 120), max(big.height, img.height) + 20
    c = Image.new('RGBA', (W, H), (58, 52, 48, 255))
    c.alpha_composite(big, (4, 18))
    c.alpha_composite(img, (big.width + 10, 18))
    ImageDraw.Draw(c).text((4, 3), label[:34], fill=(255, 240, 200, 255))
    return c


def _row(cards):
    W = sum(c.width + 6 for c in cards)
    H = max(c.height for c in cards)
    o = Image.new('RGBA', (W, H), (30, 28, 26, 255))
    x = 0
    for c in cards:
        o.alpha_composite(c, (x, 0))
        x += c.width + 6
    return o


def _stack(rows):
    W = max(r.width for r in rows)
    H = sum(r.height + 6 for r in rows)
    o = Image.new('RGBA', (W, H), (30, 28, 26, 255))
    y = 0
    for r in rows:
        o.alpha_composite(r, (0, y))
        y += r.height + 6
    return o.convert('RGB')


JUDGE = """You are an ADVERSARIAL pixel-art art director for a 16px-tile RPG map (3/4 top-down view, same family as the
beodeul harbour city chipset). Your job is to find reasons to REJECT. Default to FAIL when in doubt. You did not draw any
of this. Do not run commands, edit files, or trust any claim of success. Look only at the board images with your Read tool.

Open each board image ({n_images} board(s)). The TOP row of every board is the REFERENCE: real beodeul harbour buildings at
{ref_scale}x with a 1x thumbnail — the quality and style bar. The bottom row holds samples {ids}, all meant to be NEW
buildings of the same family (a {theme} building). Some samples were made deliberately bad to test you and you are not told
which; judge every sample on its own, at the same scale.

Judge EACH sample on two axes:
A. view34 - the 3/4 top-down building convention: the roof TOP SURFACE reads as a plane seen from above (about 30-50% of the
   building height, not a thin strip), the south front wall is visible below it, the eave overhangs or meets the wall with no
   transparent gap, no side/iso projection, no pure front elevation. FAIL for a roof strip that is 1-2 rows, a gap between
   roof and wall, or a flat plan view.{projection}
B. quality vs the REFERENCE buildings:
   Q1 silhouette - reads as a building at 1x, one body, roof covers the walls, foundation sits on the ground line, exactly
      ONE door on the ground floor. A PITCHED roof must show its form the way the reference roofs do (hip end slopes cut
      back at the top corners, or a gable triangle); a pitched roof drawn as a plain rectangle slab with a cap line fails
      Q1. Flat roofs with a parapet (desert style) are exempt from this.
   Q2 light - 3-4 tones per material lit from the upper left: roof top lightest, front wall mid, under-eave/foundation
      darkest; no highlights on the shadow side, no random bright blocks.
   Q3 craft - outline in the material's own darkest tone (not a black box around every part), even weight; roof tiles and
      wall grain continue across parts without a visible seam or repeated stamp; no flat fills, no noise, no stray pixels.
   Q4 proportion - storey height vs roof, door ~32-40px tall, windows aligned in rows, eave line straight.
   Q5 readability - window/door/roof/wall are distinguishable at 1x; no two doors, no door under a window, nothing floating.
   FAIL if any of Q1-Q3 fails, or two of Q4-Q5, or it is closer to a broken sample than to the reference.
   "It looks like a building" is not a reason to pass.

Output ONLY JSON lines, one per sample, nothing else:
{{"id":"S1","view34":"PASS|FAIL","quality":"PASS|FAIL","reason":"<one short sentence; concrete pixels/parts>"}}

Samples: {ids}"""


GABLE_FRONT_RULE = """
   GABLE-FRONT PROJECTION RULE (this round requires it; it overrides the reference row on projection - the reference row is
   only the quality/style bar here): for pitched-roof buildings, FAIL view34 when EVERY mass is a ridge-parallel roof (ridge
   running left-right) over a flat front elevation, however well drawn. PASS view34 needs at least one visible GABLE FRONT:
   a triangular gable wall facing the viewer (south) above the front wall band, with the roof RECEDING NORTH (upward on
   screen) behind it - its ridge drawn as a straight VERTICAL line from the front apex up to the back end (a ^-shaped back
   apex, or a valley where it runs into another roof) - and BOTH roof slopes visible as tall areas left and right of that
   ridge, the left slope lit and the right slope darker. The roof should be the majority of that mass's silhouette."""


def judge_prompt(theme, ids, n_images, gable_front=False):
    return JUDGE.format(n_images=n_images, ref_scale=REF_SCALE, ids=', '.join(ids), theme=theme,
                        projection=GABLE_FRONT_RULE if gable_front else '')


def claude_judge(prompt, images, workdir, model=None, effort=None, timeout=None):
    listing = '\n'.join(f'- {p}' for p in images)
    full = f'{prompt}\n\nOpen and look at each of these images with the Read tool, in this order, before answering:\n{listing}'
    cmd = [shutil.which('claude') or 'claude', '-p', '--output-format', 'text', '--strict-mcp-config',
           '--allowedTools', 'Read', '--add-dir', str(workdir), '--model', model or JUDGE_MODEL]
    if effort or JUDGE_EFFORT:
        cmd += ['--effort', effort or JUDGE_EFFORT]
    return _call(cmd, full, workdir, timeout)


def command_judge(shell_cmd):
    """--judge-cmd: 프롬프트를 표준 입력으로 받고 답을 표준 출력으로 내는 다른 판정 명령(그림 목록은 프롬프트 끝에)."""
    import shlex

    def runner(prompt, images, workdir, model=None, effort=None, timeout=None):
        listing = '\n'.join(f'- {p}' for p in images)
        return _call(shlex.split(shell_cmd), f'{prompt}\n\nImages:\n{listing}', workdir, timeout)
    return runner


def _call(cmd, text, workdir, timeout):
    r = subprocess.run(cmd, input=text, cwd=workdir, capture_output=True, text=True, timeout=timeout or JUDGE_TIMEOUT)
    if r.returncode != 0:
        raise RuntimeError(f'{cmd[0]} exited {r.returncode}: {(r.stderr or r.stdout)[-600:]}')
    return r.stdout


def parse_answer(text, ids):
    items = {}
    body = re.sub(r'```(?:json)?', '', text)
    for m in re.finditer(r'\{[^{}]*\}', body):
        try:
            it = json.loads(m.group(0))
        except ValueError:
            continue
        if isinstance(it, dict) and it.get('id') in ids:
            items[it['id']] = it
    return items


def _round_dir(theme, rid):
    return os.path.join(dot.RUNS, theme, rid, 'review')


def _runs(rnd):
    return sorted((p for p in os.listdir(rnd) if p.startswith('run-')), key=lambda p: int(p.split('-')[1])) if os.path.isdir(rnd) else []


def candidates_for(theme, rid, parts_by_key, only=None):
    out = {}
    for key, parts in parts_by_key.items():
        for recipe in AS.round_buildings(theme, rid):
            if only and recipe['id'] != only:
                continue
            res = AS.assemble(recipe, parts, dot.palette(theme), theme)
            if res['img'] is None or AS.run_checks(res):
                continue
            out[f'{key}.{recipe["id"]}'] = {'img': res['img'].img(), 'recipe': recipe, 'kit': res['kit'], 'parts': parts}
    return out


def prepare(theme, rid, parts_by_key, runs=DEFAULT_RUNS, retries=DEFAULT_RETRIES, only=None, seed=None):
    rnd = _round_dir(theme, rid)
    os.makedirs(rnd, exist_ok=True)
    pal = dot.palette(theme)
    cands = candidates_for(theme, rid, parts_by_key, only)
    if not cands:
        raise SystemExit(f'{theme} {rid}: 조립까지 통과한 후보가 없다 — gate·assemble 을 먼저')
    rng = _rng(seed)
    base = next(iter(cands.values()))
    gable_front = AS.requires_gable_front(theme, rid)
    probes = probes_for(base['img'], base['kit'], base['parts'], base['recipe'], pal, rng, gable_front, theme)
    samples = [('candidate', bid, c['img']) for bid, c in cands.items()] + [('probe', n, im) for n, im in probes]
    rng.shuffle(samples)
    k = len(_runs(rnd)) + 1
    run = os.path.join(rnd, f'run-{k}')
    work = os.path.join(run, 'work')
    os.makedirs(work, exist_ok=True)
    ref_cards = [_card(f'REFERENCE {kid}', rim, k=REF_SCALE) for kid, rim in ref_buildings()]
    key, ids, scards = {}, [], []
    for i, (kind, name, im) in enumerate(samples, 1):
        sid = f'S{i}'
        im.save(os.path.join(run, f'{sid}.native.png'))
        key[sid] = {'kind': kind, 'name': name, 'pixelSha256': sha(im), 'size': [im.width, im.height]}
        ids.append(sid)
        scards.append(_card(f'{sid} new building', im))
    images = []
    for b in range(0, len(scards), PER_BOARD):
        path = os.path.join(work, f'board-{b // PER_BOARD + 1}.png')
        _stack([_row(ref_cards), _row(scards[b:b + PER_BOARD])]).save(path)
        images.append(path)
    prompt = judge_prompt(theme, ids, len(images), gable_front)
    open(os.path.join(run, 'prompt.txt'), 'w', encoding='utf-8').write(prompt)
    json.dump(key, open(os.path.join(run, 'key.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return {'round': rid, 'run': k, 'dir': run, 'work': work, 'prompt': prompt, 'images': images, 'ids': ids,
            'runs': runs, 'retries': retries, 'candidates': {bid: sha(c['img']) for bid, c in cands.items()}}


def score(theme, rid, run_id, answer_text, judge):
    run = os.path.join(_round_dir(theme, rid), f'run-{run_id}')
    key = json.load(open(os.path.join(run, 'key.json'), encoding='utf-8'))
    open(os.path.join(run, 'answer.txt'), 'w', encoding='utf-8').write(answer_text)
    items = parse_answer(answer_text, list(key))
    missing = [sid for sid in key if sid not in items]
    res = {'run': run_id, 'judge': judge, 'at': now(),
           'answerSha256': hashlib.sha256(answer_text.encode()).hexdigest(), 'samples': {}}
    if missing:
        res['void'] = f'판정자가 표본 {missing} 를 빠뜨렸다 — 이 회차는 쓰지 않는다'
    else:
        leaked = []
        for sid, k in key.items():
            it = items[sid]
            v34 = str(it.get('view34', '')).upper() == 'PASS'
            q = str(it.get('quality', '')).upper() == 'PASS'
            res['samples'][sid] = {**k, 'view34': 'PASS' if v34 else 'FAIL', 'quality': 'PASS' if q else 'FAIL',
                                   'reason': str(it.get('reason', ''))[:400]}
            if k['kind'] == 'probe' and v34 and q:
                leaked.append(k['name'])
        if leaked:
            res['void'] = f'판정자가 숨긴 함정 {leaked} 를 통과시켰다 — 이 회차는 쓰지 않는다'
    json.dump(res, open(os.path.join(run, 'result.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return aggregate(theme, rid)


def aggregate(theme, rid, need=DEFAULT_RUNS):
    rnd = _round_dir(theme, rid)
    names = _runs(rnd)
    runs = [json.load(open(os.path.join(rnd, n, 'result.json'), encoding='utf-8')) for n in names
            if os.path.exists(os.path.join(rnd, n, 'result.json'))]
    # 현재 후보 = 가장 나중 회차가 본 후보와 그 화소 해시. 후보 해시 묶음이 정확히 같은 회차만 센다 —
    # 그림이 바뀐 뒤의 옛 회차(다른 그림을 본 판정)를 새 그림의 표로 쓰지 않는다.
    def cand_set(name):
        key = json.load(open(os.path.join(rnd, name, 'key.json'), encoding='utf-8'))
        return {k['name']: k['pixelSha256'] for k in key.values() if k['kind'] == 'candidate'}
    cands = cand_set(names[-1]) if names else {}
    current = [r for n, r in zip([n for n in names if os.path.exists(os.path.join(rnd, n, 'result.json'))], runs)
               if cand_set(n) == cands]
    valid = [r for r in current if not r.get('void')]
    void = [r for r in current if r.get('void')]
    counted = valid[:need]
    complete = len(counted) >= need
    out = {'theme': theme, 'round': rid, 'at': now(), 'valid': len(counted), 'void': len(void), 'need': need,
           'complete': complete, 'judge': sorted({r['judge'] for r in counted}),
           'voids': [r['void'] for r in void], 'candidates': {}}
    for bid, psha in cands.items():
        votes = []
        for r in counted:
            s = next((v for v in r['samples'].values() if v['kind'] == 'candidate' and v['name'] == bid), None)
            if s:
                votes.append(s)
        both = sum(1 for v in votes if v['view34'] == 'PASS' and v['quality'] == 'PASS')
        verdict = ('PASS' if both * 2 > len(votes) else 'FAIL') if complete and votes else 'none'
        fails = [v for v in votes if not (v['view34'] == 'PASS' and v['quality'] == 'PASS')]
        out['candidates'][bid] = {
            'verdict': verdict, 'pixelSha256': psha, 'votes': f'{both}/{len(votes)}',
            'reasons': [v['reason'] for v in votes],
            'issues': [{'code': 'VIEW' if v['view34'] != 'PASS' else 'QUALITY', 'why': v['reason']} for v in fails],
        }
    out['probes'] = {v['name']: f"{v['view34']}/{v['quality']}" for r in current for v in r.get('samples', {}).values()
                     if v['kind'] == 'probe'}
    json.dump(out, open(os.path.join(rnd, 'result.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    _write_receipts(theme, rid, out, counted)
    return out


def _write_receipts(theme, rid, agg, counted):
    d = _round_dir(theme, rid)
    for bid, v in agg['candidates'].items():
        rec = {
            'schema': 'oprn-building-kit-review/1', 'theme': theme, 'round': rid, 'building': bid,
            'pixelSha256': v['pixelSha256'], 'verdict': v['verdict'], 'votes': v['votes'],
            'runs': [{'run': r['run'], 'judge': r['judge'], 'answerSha256': r['answerSha256']} for r in counted],
            'reasons': v['reasons'], 'issues': v['issues'], 'at': agg['at'], 'complete': agg['complete'],
        }
        json.dump(rec, open(os.path.join(d, f'{bid}.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


def receipt(theme, rid, bid):
    p = os.path.join(_round_dir(theme, rid), f'{bid}.json')
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else None


def passed(theme, rid, bid, im):
    rec = receipt(theme, rid, bid)
    return bool(rec and rec.get('complete') and rec.get('verdict') == 'PASS' and rec.get('pixelSha256') == sha(im))


def parts_by_key(theme, rid):
    import harness
    _, rendered = harness.render_round(theme, rid)
    keys = sorted({k for c in rendered.values() for k in c})
    return {k: harness.parts_for(theme, rid, k, rendered) for k in keys}


def run(theme, rid, runs=DEFAULT_RUNS, judge_cmd=None, judge_runner=None, parts=None, only=None, seed=None, quiet=False):
    if parts is None:
        parts = parts_by_key(theme, rid)
    if not parts:
        raise SystemExit(f'{theme} {rid}: 조립할 부품이 없다 — draw 로 판 후보를 만든다')
    if judge_runner is None and judge_cmd:
        judge_runner = command_judge(judge_cmd)
    judge_runner = judge_runner or claude_judge
    os.makedirs(_round_dir(theme, rid), exist_ok=True)
    budget = runs + DEFAULT_RETRIES
    label = f'claude/{JUDGE_MODEL}/{JUDGE_EFFORT}' if judge_runner is claude_judge else f'injected:{judge_cmd or "runner"}'
    agg = None
    started = 0
    while True:
        started += 1
        prep = prepare(theme, rid, parts, runs, DEFAULT_RETRIES, only, seed)
        try:
            text = judge_runner(prep['prompt'], prep['images'], prep['work'], JUDGE_MODEL, JUDGE_EFFORT, JUDGE_TIMEOUT)
        except Exception as e:  # noqa: BLE001
            shutil.rmtree(prep['dir'], ignore_errors=True)
            raise SystemExit(f'판정자 프로세스 실패(기록 없음): {e}')
        agg = score(theme, rid, prep['run'], text, label)
        if agg['complete'] or started >= budget:
            break
    if not quiet:
        print(describe(agg))
    return 0 if agg['complete'] else 1


def describe(agg):
    state = '완료' if agg['complete'] else f'무효/부족 — 유효 {agg["valid"]}/{agg["need"]}회'
    lines = [f'{agg["theme"]} {agg["round"]} 독립 검수: {state} · 무효 {agg["void"]}회 · 판정자 {", ".join(agg["judge"]) or "없음"}']
    for v in agg['voids'][:3]:
        lines.append(f'  무효: {v}')
    for bid, v in sorted(agg['candidates'].items()):
        lines.append(f'  {bid:18} {v["verdict"]:5} 두 축 {v["votes"]}  {v["pixelSha256"][:8]}')
        for why in v['reasons'][:2]:
            lines.append(f'     - {why}')
    for name, sc in sorted(agg['probes'].items()):
        lines.append(f'  함정 {name:16} {sc}')
    return '\n'.join(lines)
